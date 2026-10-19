import json
import re
import zipfile
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from pypdf import PdfReader

from assessment_ai import (
    analyze_interview_report,
    generate_coding_questions as ai_generate_coding_questions,
    generate_interview_question as ai_generate_interview_question,
    generate_mcq_questions as ai_generate_mcq_questions,
)

DEFAULT_STAGE_QUESTION_COUNT = 5
DEFAULT_INTERVIEW_TURNS = 3


def load_json_field(value: Any, default: Any):
    if value in (None, ""):
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError, json.JSONDecodeError):
        return default


def dump_json_field(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True)


def extract_resume_text(path: Optional[Path]) -> str:
    if path is None or not path.exists():
        return ""

    suffix = path.suffix.lower()
    try:
        if suffix == ".docx":
            with zipfile.ZipFile(path) as archive:
                xml_text = archive.read("word/document.xml").decode("utf-8", errors="ignore")
            return " ".join(re.findall(r">([^<]+)<", xml_text))

        raw = path.read_bytes()
        if suffix == ".pdf":
            reader = PdfReader(path)
            pages = []
            for page in reader.pages:
                page_text = (page.extract_text() or "").strip()
                if page_text:
                    pages.append(page_text)
            return "\n".join(pages).strip()

        return raw.decode("latin-1", errors="ignore")
    except Exception:
        return ""


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def score_resume_sections(resume_text: str) -> tuple[int, list[dict[str, Any]], list[str]]:
    text = (resume_text or "").lower()
    breakdown = []
    suggestions = []

    checks = [
        ("Experience", ["experience", "employment", "work history"], 5),
        ("Skills", ["skills", "technical skills", "core skills"], 4),
        ("Education", ["education", "university", "college"], 3),
        ("Projects", ["projects", "portfolio", "case study"], 2),
        ("Achievements", ["achievement", "certification", "award"], 1),
    ]

    total = 0
    for label, keywords, points in checks:
        hit = any(keyword in text for keyword in keywords)
        score = points if hit else 0
        total += score
        breakdown.append(
            {
                "label": label,
                "score": score,
                "maxScore": points,
                "note": "Detected in resume" if hit else f"Add a visible {label.lower()} section",
            }
        )
        if not hit:
            suggestions.append(f"Add a clear {label.lower()} section to your resume.")

    return total, breakdown, suggestions


def calculate_ats_score(profile_snapshot: dict[str, Any], resume_text: str) -> dict[str, Any]:
    skills = profile_snapshot.get("skills") or []
    profile_checks = [
        ("Full Name", bool(profile_snapshot.get("full_name")), 8, "Your name is ready for recruiters."),
        ("Email", bool(profile_snapshot.get("email")), 6, "Email is present."),
        ("Phone", bool(profile_snapshot.get("phone")), 6, "Phone number is present."),
        ("Location", bool(profile_snapshot.get("location")), 5, "Location is present."),
        ("Current Role", bool(profile_snapshot.get("current_job_title")), 6, "Current role is described."),
        ("Experience", bool(profile_snapshot.get("experience_years")), 8, "Experience is captured."),
        ("Summary", bool(profile_snapshot.get("bio")), 10, "Summary is available."),
        ("Resume Upload", bool(profile_snapshot.get("resume_url")), 12, "Resume is uploaded."),
        ("Skill Depth", min(len(skills), 8) >= 4, 12, "Skill coverage looks healthy."),
        (
            "Professional Links",
            bool(profile_snapshot.get("linkedin_url") or profile_snapshot.get("github_url") or profile_snapshot.get("portfolio_url")),
            8,
            "At least one professional link is available.",
        ),
    ]

    breakdown = []
    suggestions = []
    profile_score = 0
    for label, is_present, points, success_note in profile_checks:
        score = points if is_present else 0
        profile_score += score
        breakdown.append(
            {
                "label": label,
                "score": score,
                "maxScore": points,
                "note": success_note if is_present else f"Improve the {label.lower()} section",
            }
        )
        if not is_present:
            suggestions.append(f"Complete your {label.lower()} details.")

    resume_score, resume_breakdown, resume_suggestions = score_resume_sections(resume_text)
    breakdown.extend(resume_breakdown)
    suggestions.extend(resume_suggestions)

    total_score = max(35, min(99, profile_score + resume_score))
    if total_score >= 85:
        summary = "Your profile is ATS-ready and already communicates strong recruiter signals."
    elif total_score >= 70:
        summary = "Your ATS readiness is solid, with a few sections that can still be sharpened."
    else:
        summary = "Your profile can benefit from stronger resume structure and fuller candidate details."

    return {
        "score": total_score,
        "summary": summary,
        "breakdown": breakdown,
        "suggestions": suggestions[:6],
    }


APTITUDE_BANK = [
    {"prompt": "If a candidate improves from 50% to 65%, what is the increase in percentage points?", "options": ["15", "30", "10", "20"], "correct_index": 0},
    {"prompt": "A team finishes 40% of a task in 2 hours. At the same pace, how long for the full task?", "options": ["5 hours", "4 hours", "6 hours", "3 hours"], "correct_index": 0},
    {"prompt": "Which number comes next in the pattern 3, 6, 12, 24, ?", "options": ["48", "36", "30", "42"], "correct_index": 0},
    {"prompt": "If 5 recruiters review 5 resumes in 5 minutes, how many recruiters are needed for 20 resumes in 5 minutes?", "options": ["20", "5", "10", "15"], "correct_index": 0},
    {"prompt": "Choose the best synonym for 'concise'.", "options": ["Brief", "Complex", "Delayed", "Casual"], "correct_index": 0},
    {"prompt": "A salary rises from 8 LPA to 10 LPA. What is the percentage increase?", "options": ["25%", "20%", "30%", "15%"], "correct_index": 0},
    {"prompt": "If all shortlisted candidates are interviewed and Priya is shortlisted, what can be concluded?", "options": ["Priya will be interviewed", "Priya is hired", "Priya is rejected", "Priya is absent"], "correct_index": 0},
    {"prompt": "What is the average of 18, 22, 24, and 16?", "options": ["20", "18", "22", "21"], "correct_index": 0},
    {"prompt": "Which option is the odd one out?", "options": ["Triangle", "Square", "Circle", "Blue"], "correct_index": 3},
    {"prompt": "If one interview room handles 6 candidates per hour, how many can 3 rooms handle in 2 hours?", "options": ["36", "18", "24", "30"], "correct_index": 0},
    {"prompt": "A report is due on Tuesday. Today is Saturday. How many days remain?", "options": ["3", "4", "2", "5"], "correct_index": 0},
    {"prompt": "Which statement is most logical? Data helps decisions because it is:", "options": ["Evidence-based", "Always emotional", "Always perfect", "Never changing"], "correct_index": 0},
    {"prompt": "If a candidate answers 18 out of 30 correctly, what is the score percentage?", "options": ["60%", "55%", "65%", "70%"], "correct_index": 0},
    {"prompt": "Find the missing value: 2, 5, 11, 23, ?", "options": ["47", "35", "39", "49"], "correct_index": 0},
    {"prompt": "A document is 120 pages. 25% has been reviewed. How many pages are left?", "options": ["90", "30", "75", "60"], "correct_index": 0},
    {"prompt": "Which word best completes the sentence: 'The recruiter was ___ when the candidate arrived early.'", "options": ["Pleased", "Broken", "Silent", "Shallow"], "correct_index": 0},
    {"prompt": "If 3 developers can finish a bug list in 9 days, how many days for 9 developers at the same pace?", "options": ["3", "9", "6", "1"], "correct_index": 0},
    {"prompt": "Which comes first alphabetically?", "options": ["Analytics", "Backend", "Coding", "Design"], "correct_index": 0},
    {"prompt": "A process has 4 stages and each takes 15 minutes. Total time is:", "options": ["60 minutes", "45 minutes", "75 minutes", "30 minutes"], "correct_index": 0},
    {"prompt": "Which fraction is largest?", "options": ["3/4", "2/3", "5/8", "7/10"], "correct_index": 0},
    {"prompt": "A recruiter emails 12 candidates and 9 reply. What is the response rate?", "options": ["75%", "80%", "70%", "60%"], "correct_index": 0},
    {"prompt": "Which action shows the best attention to detail?", "options": ["Reviewing the job title before posting", "Skipping spell-check", "Ignoring cutoffs", "Posting empty fields"], "correct_index": 0},
    {"prompt": "If 1, 4, 9, 16, ? is a pattern, what comes next?", "options": ["25", "20", "24", "18"], "correct_index": 0},
    {"prompt": "A recruiter compares 5 candidates across 4 criteria. How many total criterion checks are there?", "options": ["20", "9", "10", "15"], "correct_index": 0},
    {"prompt": "Which word does not belong?", "options": ["Interview", "Assessment", "Resume", "Banana"], "correct_index": 3},
    {"prompt": "If a role requires 4 skills and a candidate has 3 of them, the coverage is:", "options": ["75%", "80%", "60%", "50%"], "correct_index": 0},
    {"prompt": "What is half of 7.2?", "options": ["3.6", "3.2", "4.1", "2.6"], "correct_index": 0},
    {"prompt": "Which sentence is grammatically strongest?", "options": ["The team has completed the review.", "The team have completes review.", "Team complete reviewed.", "Review has team complete."], "correct_index": 0},
    {"prompt": "A timer starts at 60 minutes and 18 minutes pass. How much time remains?", "options": ["42 minutes", "38 minutes", "48 minutes", "36 minutes"], "correct_index": 0},
    {"prompt": "Which decision is most data-driven?", "options": ["Using score thresholds", "Guessing from memory", "Ignoring results", "Skipping evaluation"], "correct_index": 0},
]


def _question_with_id(question: dict[str, Any], prefix: str, index: int) -> dict[str, Any]:
    return {
        "id": f"{prefix}-{index + 1}",
        "prompt": normalize_text(question["prompt"]),
        "options": [normalize_text(option) for option in question["options"]],
        "correct_index": int(question["correct_index"]),
    }


def generate_aptitude_questions(
    job_title: str = "",
    description: str = "",
    skills: Optional[list[str]] = None,
    count: int = DEFAULT_STAGE_QUESTION_COUNT,
    session_nonce: Optional[str] = None,
    manual_questions_text: str = "",
    use_ai: bool = True,
) -> list[dict[str, Any]]:
    return ai_generate_mcq_questions(
        stage="aptitude",
        job_title=job_title,
        description=description,
        skills=skills or [],
        count=count or DEFAULT_STAGE_QUESTION_COUNT,
        session_nonce=session_nonce or uuid.uuid4().hex,
        manual_questions_text=manual_questions_text,
        use_ai=use_ai,
    )


def generate_technical_questions(
    job_title: str,
    skills: list[str],
    description: str,
    count: int = DEFAULT_STAGE_QUESTION_COUNT,
    session_nonce: Optional[str] = None,
    manual_questions_text: str = "",
    use_ai: bool = True,
) -> list[dict[str, Any]]:
    return ai_generate_mcq_questions(
        stage="technical",
        job_title=job_title,
        description=description,
        skills=skills,
        count=count or DEFAULT_STAGE_QUESTION_COUNT,
        session_nonce=session_nonce or uuid.uuid4().hex,
        manual_questions_text=manual_questions_text,
        use_ai=use_ai,
    )


def parse_manual_mcq_lines(text: str, prefix: str) -> list[dict[str, Any]]:
    questions = []
    for index, raw_line in enumerate((text or "").splitlines()):
        line = raw_line.strip()
        if not line:
            continue
        parts = [part.strip() for part in line.split("|")]
        if len(parts) < 6:
            continue
        prompt = parts[0]
        options = parts[1:5]
        answer_token = parts[5].strip().lower()
        if answer_token in {"a", "b", "c", "d"}:
            correct_index = "abcd".index(answer_token)
        else:
            try:
                correct_index = max(0, min(3, int(answer_token) - 1))
            except ValueError:
                correct_index = 0
        questions.append(
            {
                "id": f"{prefix}-{len(questions) + 1}",
                "prompt": normalize_text(prompt),
                "options": [normalize_text(option) for option in options],
                "correct_index": correct_index,
            }
        )
    return questions


def generate_coding_questions(
    job_title: str,
    skills: list[str],
    description: str,
    count: int = 2,
    session_nonce: Optional[str] = None,
    manual_questions_text: str = "",
    use_ai: bool = True,
) -> list[dict[str, Any]]:
    return ai_generate_coding_questions(
        job_title=job_title,
        description=description,
        skills=skills,
        count=count or 2,
        session_nonce=session_nonce or uuid.uuid4().hex,
        manual_questions_text=manual_questions_text,
        use_ai=use_ai,
    )


def parse_manual_coding_lines(text: str) -> list[dict[str, Any]]:
    questions = []
    for raw_line in (text or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        parts = [part.strip() for part in line.split("|")]
        if len(parts) < 2:
            continue
        title = parts[0]
        prompt = parts[1]
        guidance = parts[2] if len(parts) > 2 else "Explain your approach with clean code and edge-case handling."
        questions.append(
            {
                "id": f"coding-{len(questions) + 1}",
                "title": normalize_text(title),
                "prompt": normalize_text(prompt),
                "guidance": normalize_text(guidance),
            }
        )
    return questions


def generate_interview_questions(
    job_title: str,
    description: str,
    skills: list[str],
    history: list[dict[str, Any]],
    session_nonce: Optional[str],
    turn_index: int,
    audio_dir: Optional[Path] = None,
) -> dict[str, Any]:
    return ai_generate_interview_question(
        job_title=job_title,
        description=description,
        skills=skills,
        history=history,
        session_nonce=session_nonce or uuid.uuid4().hex,
        turn_index=turn_index,
        audio_dir=audio_dir,
    )


def _coerce_bool(value: Any, default: bool = True) -> bool:
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() not in {"false", "0", "no", "none", "disabled"}
    return bool(value)


def normalize_assessment_config(raw_config: Optional[dict[str, Any]], job_title: str, description: str, skills: list[str]) -> dict[str, Any]:
    raw_config = raw_config or {}

    aptitude_raw = raw_config.get("aptitude") or {}
    technical_raw = raw_config.get("technical") or {}
    coding_raw = raw_config.get("coding") or {}
    interview_raw = raw_config.get("interview") or {}
    aptitude_count = DEFAULT_STAGE_QUESTION_COUNT
    technical_count = DEFAULT_STAGE_QUESTION_COUNT
    coding_count = 2
    aptitude_enabled = _coerce_bool(aptitude_raw.get("enabled"), True)
    technical_enabled = _coerce_bool(technical_raw.get("enabled"), True)
    coding_enabled = _coerce_bool(coding_raw.get("enabled"), True)

    return {
        "aptitude": {
            "enabled": aptitude_enabled,
            "mode": "manual" if aptitude_raw.get("mode") == "manual" else "ai",
            "required": aptitude_enabled and _coerce_bool(aptitude_raw.get("required"), True),
            "cutoff": max(1, min(int(aptitude_raw.get("cutoff") or 3), aptitude_count)),
            "duration_minutes": max(15, min(int(aptitude_raw.get("duration_minutes") or 60), 120)),
            "question_count": aptitude_count,
            "manual_questions_text": aptitude_raw.get("manual_questions_text") or "",
        },
        "technical": {
            "enabled": technical_enabled,
            "mode": "manual" if technical_raw.get("mode") == "manual" else "ai",
            "required": technical_enabled and _coerce_bool(technical_raw.get("required"), True),
            "cutoff": max(1, min(int(technical_raw.get("cutoff") or 3), technical_count)),
            "duration_minutes": max(15, min(int(technical_raw.get("duration_minutes") or 60), 120)),
            "question_count": technical_count,
            "manual_questions_text": technical_raw.get("manual_questions_text") or "",
        },
        "coding": {
            "enabled": coding_enabled,
            "required": coding_enabled and _coerce_bool(coding_raw.get("required"), True),
            "question_count": coding_count,
            "manual_questions_text": coding_raw.get("manual_questions_text") or "",
        },
        "interview": {
            "required": True,
            "question_count": DEFAULT_INTERVIEW_TURNS,
            "duration_minutes": max(5, min(int(interview_raw.get("duration_minutes") or 10), 30)),
        },
    }


def _public_mcq(question: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": question["id"],
        "prompt": question["prompt"],
        "options": question["options"],
    }


def _fallback_interview_question(job_title: str, turn_index: int) -> dict[str, Any]:
    fallback_questions = [
        f"Walk me through a project that is most relevant to this {job_title or 'role'}.",
        "Tell me about a time you handled a difficult technical tradeoff.",
        "What would you improve first if you joined this team tomorrow?",
    ]
    question_text = fallback_questions[min(turn_index, len(fallback_questions) - 1)]
    return {
        "id": f"interview-{turn_index + 1}",
        "prompt": question_text,
        "tts_text": question_text,
        "focus": "Fallback interview question generated locally.",
    }


def build_application_workflow(
    job_snapshot: dict[str, Any],
    profile_snapshot: dict[str, Any],
    assessment_config: dict[str, Any],
    ats_score: int,
    match_score: int,
    cover_letter: str,
    job_ats: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    assessment_session_id = uuid.uuid4().hex
    job_title = job_snapshot.get("title", "")
    job_description = job_snapshot.get("description", "")
    job_skills = job_snapshot.get("requirements") or []
    job_ats_state = job_ats if isinstance(job_ats, dict) else {}
    try:
        job_ats_score = int(round(float(job_ats_state.get("score", ats_score) or ats_score or 0)))
    except (TypeError, ValueError):
        job_ats_score = int(ats_score or 0)
    aptitude_config = assessment_config["aptitude"]
    technical_config = assessment_config["technical"]
    coding_config = assessment_config["coding"]
    interview_config = assessment_config["interview"]

    interview_audio_dir = Path(__file__).resolve().parent / "uploads" / "interview_audio"

    with ThreadPoolExecutor(max_workers=4) as executor:
        aptitude_future = executor.submit(
            generate_aptitude_questions,
            job_title=job_title,
            description=job_description,
            skills=job_skills,
            count=aptitude_config["question_count"],
            session_nonce=f"{assessment_session_id}-aptitude",
            manual_questions_text=aptitude_config.get("manual_questions_text", ""),
            use_ai=aptitude_config.get("mode") != "manual",
        ) if aptitude_config.get("enabled", True) else None
        technical_future = executor.submit(
            generate_technical_questions,
            job_title=job_title,
            skills=job_skills,
            description=job_description,
            count=technical_config["question_count"],
            session_nonce=f"{assessment_session_id}-technical",
            manual_questions_text=technical_config.get("manual_questions_text", ""),
            use_ai=technical_config.get("mode") != "manual",
        ) if technical_config.get("enabled", True) else None
        coding_future = executor.submit(
            generate_coding_questions,
            job_title=job_title,
            skills=job_skills,
            description=job_description,
            count=coding_config["question_count"],
            session_nonce=f"{assessment_session_id}-coding",
            manual_questions_text=coding_config.get("manual_questions_text", ""),
            use_ai=True,
        ) if coding_config.get("enabled", True) else None
        interview_future = executor.submit(
            generate_interview_questions,
            job_title=job_title,
            description=job_description,
            skills=job_skills,
            history=[],
            session_nonce=f"{assessment_session_id}-interview",
            turn_index=0,
            audio_dir=interview_audio_dir,
        )

        def _resolve_future(future, fallback_factory):
            if future is None:
                return []
            try:
                return future.result()
            except Exception:
                return fallback_factory()

        aptitude_questions = _resolve_future(
            aptitude_future,
            lambda: generate_aptitude_questions(
                job_title=job_title,
                description=job_description,
                skills=job_skills,
                count=aptitude_config["question_count"],
                session_nonce=f"{assessment_session_id}-aptitude-fallback",
                manual_questions_text=aptitude_config.get("manual_questions_text", ""),
                use_ai=False,
            ),
        )
        technical_questions = _resolve_future(
            technical_future,
            lambda: generate_technical_questions(
                job_title=job_title,
                skills=job_skills,
                description=job_description,
                count=technical_config["question_count"],
                session_nonce=f"{assessment_session_id}-technical-fallback",
                manual_questions_text=technical_config.get("manual_questions_text", ""),
                use_ai=False,
            ),
        )
        coding_questions = _resolve_future(
            coding_future,
            lambda: generate_coding_questions(
                job_title=job_title,
                skills=job_skills,
                description=job_description,
                count=coding_config["question_count"],
                session_nonce=f"{assessment_session_id}-coding-fallback",
                manual_questions_text=coding_config.get("manual_questions_text", ""),
                use_ai=False,
            ),
        )
        first_interview_question = _resolve_future(
            interview_future,
            lambda: _fallback_interview_question(job_title, 0),
        )

    return {
        "assessment_session_id": assessment_session_id,
        "current_stage": "profile",
        "job": job_snapshot,
        "profile": profile_snapshot,
        "cover_letter": cover_letter or "",
        "profile_ats_score": ats_score,
        "ats_score": max(0, min(job_ats_score, 100)),
        "job_ats": job_ats_state,
        "match_score": match_score,
        "assessment": {
            "aptitude": {
                "enabled": aptitude_config.get("enabled", True),
                "required": aptitude_config["required"],
                "mode": aptitude_config["mode"],
                "cutoff": aptitude_config["cutoff"],
                "duration_minutes": aptitude_config["duration_minutes"],
                "question_count": aptitude_config["question_count"],
            },
            "technical": {
                "enabled": technical_config.get("enabled", True),
                "required": technical_config["required"],
                "mode": technical_config["mode"],
                "cutoff": technical_config["cutoff"],
                "duration_minutes": technical_config["duration_minutes"],
                "question_count": technical_config["question_count"],
            },
            "coding": {
                "enabled": coding_config.get("enabled", True),
                "required": coding_config["required"],
                "question_count": coding_config["question_count"],
            },
            "interview": {
                "required": True,
                "question_count": interview_config["question_count"],
                "duration_minutes": interview_config["duration_minutes"],
            },
        },
        "aptitude": {
            "enabled": aptitude_config.get("enabled", True),
            "required": aptitude_config["required"],
            "cutoff": aptitude_config["cutoff"],
            "duration_minutes": aptitude_config["duration_minutes"],
            "question_count": aptitude_config["question_count"],
            "questions": aptitude_questions,
            "selected_answers": [],
            "score": None,
            "percentage": None,
            "passed": None,
            "submitted_at": None,
            "skipped": False,
        },
        "technical": {
            "enabled": technical_config.get("enabled", True),
            "required": technical_config["required"],
            "cutoff": technical_config["cutoff"],
            "duration_minutes": technical_config["duration_minutes"],
            "question_count": technical_config["question_count"],
            "questions": technical_questions,
            "selected_answers": [],
            "score": None,
            "percentage": None,
            "passed": None,
            "submitted_at": None,
            "skipped": False,
        },
        "coding": {
            "enabled": coding_config.get("enabled", True),
            "questions": coding_questions,
            "answers": [],
            "score": None,
            "feedback": "",
            "submitted_at": None,
            "required": coding_config["required"],
            "skipped": False,
        },
        "interview": {
            "required": True,
            "max_questions": interview_config["question_count"],
            "duration_minutes": interview_config["duration_minutes"],
            "turn_index": 0,
            "turns": [],
            "questions": [first_interview_question],
            "current_question": first_interview_question,
            "answers": [],
            "notes": "",
            "transcript": "",
            "proctoring": {"warnings": 0, "events": []},
            "recording_url": "",
            "snapshot_url": "",
            "session_started_at": datetime.utcnow().isoformat(),
            "score": None,
            "feedback": "",
            "report": None,
            "submitted_at": None,
        },
        "overall_score": None,
        "completed": False,
    }


def serialize_workflow_for_candidate(workflow_state: dict[str, Any]) -> dict[str, Any]:
    job_ats = workflow_state.get("job_ats") if isinstance(workflow_state.get("job_ats"), dict) else {}
    job_ats_score = job_ats.get("score", workflow_state.get("ats_score"))
    score_calculation = build_overall_score_calculation(workflow_state)
    return {
        "currentStage": workflow_state.get("current_stage", "profile"),
        "job": workflow_state.get("job") or {},
        "profile": workflow_state.get("profile") or {},
        "coverLetter": workflow_state.get("cover_letter") or "",
        "atsScore": job_ats_score,
        "profileAtsScore": workflow_state.get("profile_ats_score", workflow_state.get("ats_score")),
        "jobAtsScore": job_ats_score,
        "jobAts": job_ats,
        "matchScore": workflow_state.get("match_score"),
        "overallScore": score_calculation["score"],
        "scoreCalculation": score_calculation,
        "completed": bool(workflow_state.get("completed")),
        "screening": workflow_state.get("screening") or {},
        "assessmentSessionId": workflow_state.get("assessment_session_id"),
        "assessment": workflow_state.get("assessment") or {},
        "aptitude": {
            "enabled": workflow_state["aptitude"].get("enabled", True),
            "required": workflow_state["aptitude"].get("required", True),
            "skipped": bool(workflow_state["aptitude"].get("skipped")),
            "cutoff": workflow_state["aptitude"]["cutoff"],
            "questionCount": workflow_state["aptitude"].get("question_count") or len(workflow_state["aptitude"].get("questions") or []),
            "durationMinutes": workflow_state["aptitude"]["duration_minutes"],
            "questions": [_public_mcq(question) for question in workflow_state["aptitude"]["questions"]],
            "score": workflow_state["aptitude"]["score"],
            "percentage": workflow_state["aptitude"]["percentage"],
            "passed": workflow_state["aptitude"]["passed"],
        },
        "technical": {
            "enabled": workflow_state["technical"].get("enabled", True),
            "required": workflow_state["technical"].get("required", True),
            "skipped": bool(workflow_state["technical"].get("skipped")),
            "cutoff": workflow_state["technical"]["cutoff"],
            "questionCount": workflow_state["technical"].get("question_count") or len(workflow_state["technical"].get("questions") or []),
            "durationMinutes": workflow_state["technical"]["duration_minutes"],
            "questions": [_public_mcq(question) for question in workflow_state["technical"]["questions"]],
            "score": workflow_state["technical"]["score"],
            "percentage": workflow_state["technical"]["percentage"],
            "passed": workflow_state["technical"]["passed"],
        },
        "coding": {
            "enabled": workflow_state["coding"].get("enabled", True),
            "required": workflow_state["coding"].get("required", True),
            "skipped": bool(workflow_state["coding"].get("skipped")),
            "questionCount": len(workflow_state["coding"].get("questions") or []),
            "questions": workflow_state["coding"]["questions"],
            "score": workflow_state["coding"]["score"],
            "feedback": workflow_state["coding"]["feedback"],
        },
        "interview": {
            "required": workflow_state["interview"].get("required", True),
            "maxQuestions": workflow_state["interview"].get("max_questions") or DEFAULT_INTERVIEW_TURNS,
            "durationMinutes": workflow_state["interview"]["duration_minutes"],
            "turnIndex": workflow_state["interview"].get("turn_index", 0),
            "questions": workflow_state["interview"].get("questions") or [],
            "currentQuestion": workflow_state["interview"].get("current_question") or {},
            "turns": workflow_state["interview"].get("turns") or [],
            "score": workflow_state["interview"]["score"],
            "feedback": workflow_state["interview"]["feedback"],
            "proctoring": workflow_state["interview"]["proctoring"],
            "report": workflow_state["interview"].get("report"),
            "transcript": workflow_state["interview"].get("transcript") or "",
            "recordingUrl": workflow_state["interview"].get("recording_url") or "",
            "snapshotUrl": workflow_state["interview"].get("snapshot_url") or "",
        },
    }


def calculate_mcq_result(questions: list[dict[str, Any]], answers: list[int], cutoff: int) -> dict[str, Any]:
    total = len(questions)
    correct = 0
    selected_answers = answers or []
    for index, question in enumerate(questions):
        picked = selected_answers[index] if index < len(selected_answers) else -1
        if int(picked) == int(question["correct_index"]):
            correct += 1

    percentage = round((correct / max(1, total)) * 100)
    return {
        "score": correct,
        "total": total,
        "percentage": percentage,
        "passed": correct >= cutoff,
    }


def evaluate_coding_answers(coding_questions: list[dict[str, Any]], coding_answers: list[str], skills: list[str]) -> dict[str, Any]:
    answers = coding_answers or []
    scores = []
    for index, question in enumerate(coding_questions):
        answer = answers[index] if index < len(answers) else ""
        answer_lower = answer.lower()
        score = 20
        if len(answer.strip()) >= 150:
            score += 20
        if any(keyword in answer_lower for keyword in ["function", "def ", "return", "class ", "const ", "let ", "if ", "for ", "while "]):
            score += 20
        if any((skill or "").lower() in answer_lower for skill in skills[:5]):
            score += 15
        if "edge" in answer_lower or "case" in answer_lower or "error" in answer_lower:
            score += 10
        if "\n" in answer:
            score += 10
        if len(answer.strip()) >= 300:
            score += 5
        scores.append(min(score, 100))

    final_score = round(sum(scores) / len(scores)) if scores else 0
    if final_score >= 80:
        feedback = "Your coding responses show solid structure and implementation depth."
    elif final_score >= 60:
        feedback = "Your coding round is promising, though adding clearer edge-case handling would strengthen it."
    else:
        feedback = "Add more complete logic, structure, and implementation detail in your coding answers."

    return {"score": final_score, "feedback": feedback}


def evaluate_interview_answers(interview_answers: list[str], proctoring: Optional[dict[str, Any]]) -> dict[str, Any]:
    answers = interview_answers or []
    warnings = int((proctoring or {}).get("warnings") or 0)
    populated = [answer for answer in answers if answer and answer.strip()]
    average_length = round(sum(len(answer.strip()) for answer in populated) / len(populated)) if populated else 0

    score = 40
    if len(populated) >= 4:
        score += 20
    if average_length >= 120:
        score += 20
    elif average_length >= 70:
        score += 12
    if warnings == 0:
        score += 15
    elif warnings <= 2:
        score += 8
    score = max(35, min(98, score))

    if score >= 80:
        feedback = "You communicated your reasoning clearly and maintained a strong interview flow."
    elif score >= 60:
        feedback = "Your interview performance is steady, with room for deeper examples and sharper explanations."
    else:
        feedback = "Give fuller examples and keep your responses more structured through the interview."

    return {"score": score, "feedback": feedback}


FINAL_SCORE_WEIGHTS = {
    "job_ats": 30,
    "aptitude": 10,
    "technical": 15,
    "coding": 20,
    "interview": 25,
}


def build_overall_score_calculation(workflow_state: dict[str, Any]) -> dict[str, Any]:
    job_ats = workflow_state.get("job_ats") if isinstance(workflow_state.get("job_ats"), dict) else {}
    component_candidates = [
        ("job_ats", "Job ATS", job_ats.get("score", workflow_state.get("ats_score")), True, False),
        (
            "aptitude",
            "Aptitude",
            workflow_state.get("aptitude", {}).get("percentage"),
            workflow_state.get("aptitude", {}).get("enabled", True),
            workflow_state.get("aptitude", {}).get("skipped", False),
        ),
        (
            "technical",
            "Technical MCQ",
            workflow_state.get("technical", {}).get("percentage"),
            workflow_state.get("technical", {}).get("enabled", True),
            workflow_state.get("technical", {}).get("skipped", False),
        ),
        (
            "coding",
            "Coding",
            workflow_state.get("coding", {}).get("score"),
            workflow_state.get("coding", {}).get("enabled", True),
            workflow_state.get("coding", {}).get("skipped", False),
        ),
        (
            "interview",
            "Interview",
            workflow_state.get("interview", {}).get("score"),
            True,
            False,
        ),
    ]

    eligible = []
    pending = []
    for key, label, raw_score, enabled, skipped in component_candidates:
        if not enabled or skipped:
            continue
        if raw_score is None:
            pending.append(label)
            continue
        try:
            score = max(0, min(100, int(round(float(raw_score)))))
        except (TypeError, ValueError):
            pending.append(label)
            continue
        eligible.append((key, label, score, FINAL_SCORE_WEIGHTS[key]))

    active_weight = sum(item[3] for item in eligible)
    components = []
    weighted_total = 0.0
    for key, label, score, base_weight in eligible:
        normalized_weight = (base_weight / active_weight) if active_weight else 0
        contribution = score * normalized_weight
        weighted_total += contribution
        components.append(
            {
                "key": key,
                "label": label,
                "score": score,
                "base_weight": base_weight,
                "effective_weight": round(normalized_weight * 100, 2),
                "contribution": round(contribution, 2),
            }
        )

    interview_complete = workflow_state.get("interview", {}).get("score") is not None
    released_score = round(weighted_total) if components and interview_complete else 0
    return {
        "version": "invenia-final-score-v3",
        "score": released_score,
        "status": "final" if interview_complete and not pending and bool(components) else "pending-interview",
        "formula": "Final Score remains 0 until the compulsory interview is completed. It then becomes the weighted average of Job ATS and enabled, completed assessment stages; disabled or skipped stages are excluded and weights are normalized.",
        "release_condition": "Compulsory interview completed",
        "components": components,
        "pending_components": pending,
    }


def calculate_overall_workflow_score(workflow_state: dict[str, Any]) -> int:
    calculation = build_overall_score_calculation(workflow_state)
    workflow_state["score_calculation"] = calculation
    return calculation["score"]


def summarize_workflow_for_recruiter(workflow_state: dict[str, Any]) -> dict[str, Any]:
    job_ats = workflow_state.get("job_ats") if isinstance(workflow_state.get("job_ats"), dict) else {}
    job_ats_score = job_ats.get("score", workflow_state.get("ats_score"))
    score_calculation = build_overall_score_calculation(workflow_state)
    return {
        "currentStage": workflow_state.get("current_stage", "profile"),
        "overallScore": score_calculation["score"],
        "scoreCalculation": score_calculation,
        "completed": bool(workflow_state.get("completed")),
        "screening": workflow_state.get("screening") or {},
        "assessmentSessionId": workflow_state.get("assessment_session_id"),
        "assessment": workflow_state.get("assessment") or {},
        "atsScore": job_ats_score,
        "profileAtsScore": workflow_state.get("profile_ats_score", workflow_state.get("ats_score")),
        "jobAtsScore": job_ats_score,
        "jobAts": job_ats,
        "aptitude": {
            "enabled": workflow_state["aptitude"].get("enabled", True),
            "score": workflow_state["aptitude"].get("score"),
            "total": len(workflow_state["aptitude"].get("questions") or []),
            "percentage": workflow_state["aptitude"].get("percentage"),
            "passed": workflow_state["aptitude"].get("passed"),
            "cutoff": workflow_state["aptitude"].get("cutoff"),
            "required": workflow_state["aptitude"].get("required", True),
            "skipped": bool(workflow_state["aptitude"].get("skipped")),
        },
        "technical": {
            "enabled": workflow_state["technical"].get("enabled", True),
            "score": workflow_state["technical"].get("score"),
            "total": len(workflow_state["technical"].get("questions") or []),
            "percentage": workflow_state["technical"].get("percentage"),
            "passed": workflow_state["technical"].get("passed"),
            "cutoff": workflow_state["technical"].get("cutoff"),
            "required": workflow_state["technical"].get("required", True),
            "skipped": bool(workflow_state["technical"].get("skipped")),
        },
        "coding": {
            "enabled": workflow_state["coding"].get("enabled", True),
            "score": workflow_state["coding"].get("score"),
            "feedback": workflow_state["coding"].get("feedback"),
            "required": workflow_state["coding"].get("required", True),
            "skipped": bool(workflow_state["coding"].get("skipped")),
        },
        "interview": {
            "score": workflow_state["interview"].get("score"),
            "feedback": workflow_state["interview"].get("feedback"),
            "proctoring": workflow_state["interview"].get("proctoring") or {"warnings": 0, "events": []},
            "required": workflow_state["interview"].get("required", True),
            "turnIndex": workflow_state["interview"].get("turn_index", 0),
            "maxQuestions": workflow_state["interview"].get("max_questions") or DEFAULT_INTERVIEW_TURNS,
            "currentQuestion": workflow_state["interview"].get("current_question") or {},
            "turns": workflow_state["interview"].get("turns") or [],
            "report": workflow_state["interview"].get("report"),
            "transcript": workflow_state["interview"].get("transcript") or "",
            "recordingUrl": workflow_state["interview"].get("recording_url") or "",
            "snapshotUrl": workflow_state["interview"].get("snapshot_url") or "",
        },
    }
