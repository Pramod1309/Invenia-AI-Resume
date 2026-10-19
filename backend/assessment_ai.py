import json
import os
import random
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import requests

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_ELEVENLABS_MODEL = "eleven_multilingual_v2"


def _first_env_value(*names: str, default: Optional[str] = None) -> Optional[str]:
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    return default


def _int_env(name: str, default: int) -> int:
    try:
        return max(5, int((os.getenv(name) or str(default)).strip()))
    except (TypeError, ValueError, AttributeError):
        return default


GEMINI_REQUEST_TIMEOUT_SECONDS = _int_env("GEMINI_REQUEST_TIMEOUT_SECONDS", 45)
ELEVENLABS_REQUEST_TIMEOUT_SECONDS = _int_env("ELEVENLABS_REQUEST_TIMEOUT_SECONDS", 30)


def get_gemini_api_key() -> str:
    return _first_env_value("GEMINI_API_KEY", "GOOGLE_AI_STUDIO_API_KEY", "GOOGLE_GEMINI_API_KEY", default="") or ""


def get_gemini_model() -> str:
    return _first_env_value("GEMINI_MODEL", default=DEFAULT_GEMINI_MODEL) or DEFAULT_GEMINI_MODEL


def get_elevenlabs_api_key() -> str:
    return _first_env_value("ELEVENLABS_API_KEY", default="") or ""


def get_elevenlabs_voice_id() -> str:
    return _first_env_value("ELEVENLABS_VOICE_ID", default="") or ""


def get_elevenlabs_model() -> str:
    return _first_env_value("ELEVENLABS_MODEL_ID", default=DEFAULT_ELEVENLABS_MODEL) or DEFAULT_ELEVENLABS_MODEL


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def normalize_list(value: Any, limit: Optional[int] = None) -> list[str]:
    if isinstance(value, list):
        items = [normalize_text(str(item)) for item in value if normalize_text(str(item))]
    elif value in (None, ""):
        items = []
    else:
        items = [normalize_text(part) for part in re.split(r"[,\n;]+", str(value)) if normalize_text(part)]
    deduped: list[str] = []
    for item in items:
        if item not in deduped:
            deduped.append(item)
    if limit is not None:
        return deduped[:limit]
    return deduped


def _extract_json_blob(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if not raw:
        return {}

    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?", "", raw, flags=re.IGNORECASE).strip()
        raw = raw.removesuffix("```").strip()

    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        raw = raw[start : end + 1]

    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


def _call_gemini_json(prompt: str, *, model: Optional[str] = None, temperature: float = 0.3, max_output_tokens: int = 1800) -> dict[str, Any]:
    api_key = get_gemini_api_key()
    if not api_key:
        return {}

    model_name = model or get_gemini_model()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
            "responseMimeType": "application/json",
            "thinkingConfig": {
                "thinkingBudget": 0,
            },
        },
    }
    response = requests.post(url, json=payload, timeout=GEMINI_REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()
    data = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        return {}
    parts = (((candidates[0] or {}).get("content") or {}).get("parts") or [])
    text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
    return _extract_json_blob(text)


def _session_random(session_nonce: str) -> random.Random:
    seed = session_nonce or datetime.utcnow().isoformat()
    return random.Random(seed)


def _fallback_mcq_questions(stage: str, job_title: str, skills: list[str], count: int, session_nonce: str) -> list[dict[str, Any]]:
    rng = _session_random(session_nonce)
    focus_skills = normalize_list(skills, limit=8) or ["problem solving", "analysis", "testing", "communication"]

    aptitude_templates = [
        ("What is the best first step when approaching a new problem?", ["Understand the requirement", "Ignore the details", "Start coding immediately", "Wait for someone else"], 0),
        ("A process improves from 40 to 52. The gain is:", ["12 points", "22 points", "8 points", "14 points"], 0),
        ("Which option shows strong attention to detail?", ["Reviewing inputs before submission", "Skipping validation", "Reusing stale data", "Guessing the answer"], 0),
        ("If 3 tasks take 9 hours, one task takes:", ["3 hours", "1 hour", "2 hours", "4 hours"], 0),
        ("Which action best supports collaboration?", ["Sharing context early", "Working in silence", "Avoiding feedback", "Hiding blockers"], 0),
        ("Which number completes the pattern 2, 4, 8, 16, ?", ["32", "24", "20", "28"], 0),
        ("A candidate keeps missing deadlines. The best response is to:", ["Break work into smaller milestones", "Ignore the issue", "Stop tracking work", "Change teams immediately"], 0),
    ]

    technical_templates = [
        ("Which practice best demonstrates solid use of {skill} in a {job_title} role?", [
            "Applying it to solve a concrete task with measurable impact",
            "Mentioning it in conversation only",
            "Avoiding any real usage",
            "Replacing it with unrelated tools",
        ], 0),
        ("What is the strongest first debugging step for a {skill} issue?", [
            "Reproduce the issue and isolate the failing layer",
            "Restart everything without checking logs",
            "Assume the problem is always the user",
            "Delete code before understanding it",
        ], 0),
        ("Which approach keeps {skill} maintainable?", [
            "Readable structure, tests, and clear names",
            "Large unreviewed changes",
            "No comments or validation",
            "Hidden logic in production only",
        ], 0),
        ("What shows depth in {skill} during an interview?", [
            "Explaining tradeoffs and one real implementation",
            "Listing buzzwords without context",
            "Refusing technical detail",
            "Skipping project examples",
        ], 0),
        ("How should {skill} be applied in the {job_title} workflow?", [
            "With validation, testing, and clear ownership",
            "Only as a resume keyword",
            "Without review or checks",
            "As a shortcut for everything",
        ], 0),
    ]

    bank = aptitude_templates if stage == "aptitude" else technical_templates
    rng.shuffle(bank)
    questions: list[dict[str, Any]] = []
    for index in range(count):
        template, options, correct_index = bank[index % len(bank)]
        skill = focus_skills[index % len(focus_skills)]
        questions.append(
            {
                "id": f"{stage}-{index + 1}",
                "prompt": normalize_text(template.format(skill=skill, job_title=job_title or "this role")),
                "options": [normalize_text(option) for option in options],
                "correct_index": correct_index,
                "rationale": "Fallback question generated locally because Gemini was unavailable.",
            }
        )
    return questions


def generate_mcq_questions(
    stage: str,
    job_title: str,
    description: str,
    skills: list[str],
    count: int,
    session_nonce: str,
    manual_questions_text: str = "",
    use_ai: bool = True,
) -> list[dict[str, Any]]:
    count = max(1, min(int(count or 5), 5))
    if manual_questions_text.strip():
        parsed = []
        for raw_line in manual_questions_text.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            parts = [part.strip() for part in line.split("|")]
            if len(parts) < 6:
                continue
            try:
                correct_index = max(0, min(3, int(parts[5]) - 1))
            except ValueError:
                correct_index = "abcd".find(parts[5].lower()) if parts[5].lower() in {"a", "b", "c", "d"} else 0
            parsed.append(
                {
                    "id": f"{stage}-{len(parsed) + 1}",
                    "prompt": normalize_text(parts[0]),
                    "options": [normalize_text(option) for option in parts[1:5]],
                    "correct_index": correct_index if correct_index >= 0 else 0,
                    "rationale": "Manually provided by recruiter.",
                }
            )
        if parsed:
            return parsed[:count]

    if use_ai:
        prompt = f"""
You are creating a unique {stage} assessment for an ATS-driven hiring workflow.
Return a JSON object with a single key "questions".

Rules:
- Generate exactly {count} questions.
- Every question must have id, prompt, options, correct_index, rationale.
- Provide exactly 4 distinct options per question.
- correct_index must be 0, 1, 2, or 3.
- Do not repeat questions across the same session.
- Make the content relevant to the role and job description.
- Keep wording concise and practical.

Context:
- Job title: {normalize_text(job_title)}
- Job description: {normalize_text(description)}
- Skills: {", ".join(normalize_list(skills, limit=10)) or "not provided"}
- Session nonce: {session_nonce}

For aptitude questions, test reasoning, attention to detail, numerical thinking, and process judgment.
For technical questions, test role-specific knowledge and practical decision-making around the listed skills.
"""
        try:
            response = _call_gemini_json(prompt, temperature=0.55, max_output_tokens=1800)
            questions = response.get("questions") if isinstance(response, dict) else None
            if isinstance(questions, list):
                normalized = []
                for index, question in enumerate(questions[:count]):
                    options = question.get("options") if isinstance(question, dict) else None
                    if not isinstance(options, list) or len(options) < 4:
                        continue
                    normalized.append(
                        {
                            "id": question.get("id") or f"{stage}-{index + 1}",
                            "prompt": normalize_text(str(question.get("prompt", ""))),
                            "options": [normalize_text(str(option)) for option in options[:4]],
                            "correct_index": int(question.get("correct_index", 0) or 0) % 4,
                            "rationale": normalize_text(str(question.get("rationale", ""))),
                        }
                    )
                if len(normalized) >= count:
                    return normalized[:count]
        except Exception:
            pass

    return _fallback_mcq_questions(stage, job_title, skills, count, session_nonce)


def generate_coding_questions(
    job_title: str,
    description: str,
    skills: list[str],
    count: int,
    session_nonce: str,
    manual_questions_text: str = "",
    use_ai: bool = True,
) -> list[dict[str, Any]]:
    if manual_questions_text.strip():
        parsed = []
        for raw_line in manual_questions_text.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            parts = [part.strip() for part in line.split("|")]
            if len(parts) < 2:
                continue
            parsed.append(
                {
                    "id": f"coding-{len(parsed) + 1}",
                    "title": normalize_text(parts[0]),
                    "prompt": normalize_text(parts[1]),
                    "guidance": normalize_text(parts[2] if len(parts) > 2 else "Explain your approach with clear logic, structure, and edge-case handling."),
                }
            )
        if parsed:
            return parsed[:count]

    count = max(1, min(int(count or 2), 2))
    if use_ai:
        prompt = f"""
You are creating coding round prompts for a hiring assessment.
Return a JSON object with a single key "questions".

Rules:
- Generate exactly {count} questions.
- Each question must have id, title, prompt, guidance.
- Make each prompt unique and relevant to the role.
- Avoid toy prompts; the prompt should resemble a real work scenario.
- Keep each question concise but clear.

Context:
- Job title: {normalize_text(job_title)}
- Job description: {normalize_text(description)}
- Skills: {", ".join(normalize_list(skills, limit=10)) or "not provided"}
- Session nonce: {session_nonce}
"""
        try:
            response = _call_gemini_json(prompt, temperature=0.55, max_output_tokens=1600)
            questions = response.get("questions") if isinstance(response, dict) else None
            if isinstance(questions, list):
                normalized = []
                for index, question in enumerate(questions[:count]):
                    normalized.append(
                        {
                            "id": question.get("id") or f"coding-{index + 1}",
                            "title": normalize_text(str(question.get("title", f"Challenge {index + 1}"))),
                            "prompt": normalize_text(str(question.get("prompt", ""))),
                            "guidance": normalize_text(str(question.get("guidance", "Focus on correctness, readability, and edge cases."))),
                        }
                    )
                if len(normalized) >= count:
                    return normalized[:count]
        except Exception:
            pass

    focus_skills = normalize_list(skills, limit=5) or ["problem solving", "data handling"]
    questions = []
    for index in range(count):
        skill = focus_skills[index % len(focus_skills)]
        questions.append(
            {
                "id": f"coding-{index + 1}",
                "title": f"{skill.title()} Challenge",
                "prompt": normalize_text(
                    f"Write a practical solution for a {job_title or 'candidate'} scenario that demonstrates {skill}. "
                    f"Explain your approach and edge cases."
                ),
                "guidance": "Focus on readable logic, edge cases, and a clean explanation.",
            }
        )
    return questions


def _interview_prompt(job_title: str, description: str, skills: list[str], history: list[dict[str, Any]], session_nonce: str, turn_index: int) -> str:
    conversation = []
    for item in history[-4:]:
        conversation.append(
            f"Q: {normalize_text(str(item.get('question', '')))}\nA: {normalize_text(str(item.get('answer', '')))}"
        )
    conversation_text = "\n\n".join(conversation) or "No prior conversation."
    return f"""
You are the interviewer for a three-question AI interview.
Ask exactly one next question that is tailored to the candidate's previous answer.

Rules:
- Return JSON object with keys: question, tts_text, focus.
- Keep the question concise and natural.
- Do not repeat previously asked questions.
- Make it job-relevant and professional.
- This is turn {turn_index + 1} of 3.

Context:
- Job title: {normalize_text(job_title)}
- Job description: {normalize_text(description)}
- Skills: {", ".join(normalize_list(skills, limit=10)) or "not provided"}
- Session nonce: {session_nonce}

Conversation so far:
{conversation_text}
"""


def generate_interview_question(
    job_title: str,
    description: str,
    skills: list[str],
    history: list[dict[str, Any]],
    session_nonce: str,
    turn_index: int,
    audio_dir: Optional[Path] = None,
) -> dict[str, Any]:
    question_text = ""
    focus = ""
    try:
        response = _call_gemini_json(
            _interview_prompt(job_title, description, skills, history, session_nonce, turn_index),
            temperature=0.6,
            max_output_tokens=900,
        )
        question_text = normalize_text(str(response.get("question", "")))
        focus = normalize_text(str(response.get("focus", "")))
    except Exception:
        question_text = ""

    if not question_text:
        fallback_questions = [
            f"Walk me through a project that is most relevant to this {job_title or 'role'}.",
            "Tell me about a time you handled a difficult technical tradeoff.",
            "What would you improve first if you joined this team tomorrow?",
        ]
        question_text = fallback_questions[min(turn_index, len(fallback_questions) - 1)]
        focus = "Fallback interview question generated locally."

    packet = {
        "id": f"interview-{turn_index + 1}",
        "prompt": question_text,
        "tts_text": question_text,
        "focus": focus,
    }

    if audio_dir is not None:
        audio_dir.mkdir(parents=True, exist_ok=True)
        audio_path = audio_dir / f"{session_nonce}_turn_{turn_index + 1}.mp3"
        audio_result = synthesize_elevenlabs_audio(question_text, audio_path)
        if audio_result is not None:
            packet["audio_url"] = f"/uploads/interview_audio/{audio_result.name}"

    return packet


def synthesize_elevenlabs_audio(text: str, output_path: Path) -> Optional[Path]:
    api_key = get_elevenlabs_api_key()
    voice_id = get_elevenlabs_voice_id()
    if not api_key or not voice_id:
        return None

    output_path.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    payload = {
        "text": normalize_text(text),
        "model_id": get_elevenlabs_model(),
        "voice_settings": {
            "stability": 0.45,
            "similarity_boost": 0.7,
            "style": 0.2,
            "use_speaker_boost": True,
        },
    }
    headers = {
        "xi-api-key": api_key,
        "accept": "audio/mpeg",
        "content-type": "application/json",
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=ELEVENLABS_REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        output_path.write_bytes(response.content)
        return output_path
    except Exception as exc:
        print(f"ElevenLabs TTS unavailable, falling back to browser voice: {exc}")
        return None


def analyze_interview_report(
    job_title: str,
    description: str,
    skills: list[str],
    turns: list[dict[str, Any]],
    proctoring: Optional[dict[str, Any]] = None,
    recording_meta: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    warnings = int((proctoring or {}).get("warnings") or 0)
    history_lines = []
    for index, turn in enumerate(turns, start=1):
        history_lines.append(
            f"Turn {index}\nQuestion: {normalize_text(str(turn.get('question', '')))}\nAnswer: {normalize_text(str(turn.get('answer', '')))}\n"
        )
    history_text = "\n".join(history_lines) or "No interview answers captured."
    recording_text = json.dumps(recording_meta or {}, ensure_ascii=True)
    prompt = f"""
You are Invenia AI Analysis, generating an evidence-grounded interview evaluation for a recruiter.
Return JSON object with keys:
- overall_score (0-100)
- summary
- decision
- strengths (array of strings)
- strong_signals (array of specific strings)
- gaps (array of strings)
- validation_points (array of specific strings)
- risk_flags (array of strings)
- competency_scores (array of objects with competency, score, evidence)
- question_analysis (array of objects with question, answer_quality, score, notes, evidence, competencies, validation_points)
- recommendations (array of strings)
- proctoring_summary

Rules:
- Evaluate every answer separately against the exact job context.
- Give point-to-point findings, not a generic overall paragraph.
- Strong signals must cite a concrete answer behavior, example, skill, decision, or outcome.
- Validation points must state exactly what is absent, vague, inconsistent, or needs follow-up.
- Score relevance, technical/domain depth, evidence and examples, problem solving, and communication.
- Do not reward answer length by itself and do not invent candidate experience.
- Keep content performance separate from interview integrity/proctoring signals.
- If warnings are present, mention them in risk_flags and proctoring_summary.
- Use only evidence from the supplied interview history and job context.
- Include one question_analysis object for every interview turn.
- Return JSON only.

Context:
- Job title: {normalize_text(job_title)}
- Job description: {normalize_text(description)}
- Skills: {", ".join(normalize_list(skills, limit=10)) or "not provided"}
- Proctoring warnings: {warnings}
- Recording metadata: {recording_text}

Interview history:
{history_text}
"""
    try:
        response = _call_gemini_json(prompt, temperature=0.2, max_output_tokens=2800)
        if response:
            question_analysis = []
            for index, item in enumerate(response.get("question_analysis") or []):
                if not isinstance(item, dict):
                    continue
                try:
                    item_score = max(0, min(100, int(round(float(item.get("score", 0) or 0)))))
                except (TypeError, ValueError):
                    item_score = 0
                question_analysis.append(
                    {
                        "question": normalize_text(str(item.get("question") or (turns[index].get("question") if index < len(turns) else ""))),
                        "answer_quality": normalize_text(str(item.get("answer_quality", "Review"))),
                        "score": item_score,
                        "notes": normalize_text(str(item.get("notes", ""))),
                        "evidence": normalize_text(str(item.get("evidence", ""))),
                        "competencies": normalize_list(item.get("competencies"), limit=6),
                        "validation_points": normalize_list(item.get("validation_points"), limit=5),
                    }
                )
            competency_scores = []
            for item in response.get("competency_scores") or []:
                if not isinstance(item, dict):
                    continue
                try:
                    competency_score = max(0, min(100, int(round(float(item.get("score", 0) or 0)))))
                except (TypeError, ValueError):
                    competency_score = 0
                competency_scores.append(
                    {
                        "competency": normalize_text(str(item.get("competency", "Competency"))),
                        "score": competency_score,
                        "evidence": normalize_text(str(item.get("evidence", ""))),
                    }
                )
            question_average = (
                round(sum(item["score"] for item in question_analysis) / len(question_analysis))
                if question_analysis
                else None
            )
            competency_average = (
                round(sum(item["score"] for item in competency_scores) / len(competency_scores))
                if competency_scores
                else None
            )
            if question_average is not None and competency_average is not None:
                overall_score = round((question_average * 0.7) + (competency_average * 0.3))
            elif question_average is not None:
                overall_score = question_average
            else:
                overall_score = max(0, min(100, int(round(float(response.get("overall_score", 0) or 0)))))
            response["overall_score"] = max(0, min(100, overall_score))
            response["summary"] = normalize_text(str(response.get("summary", "")))
            response["decision"] = normalize_text(str(response.get("decision", "review")))
            response["strengths"] = normalize_list(response.get("strengths"), limit=6)
            response["strong_signals"] = normalize_list(response.get("strong_signals"), limit=8) or response["strengths"]
            response["gaps"] = normalize_list(response.get("gaps"), limit=6)
            response["validation_points"] = normalize_list(response.get("validation_points"), limit=8) or response["gaps"]
            response["risk_flags"] = normalize_list(response.get("risk_flags"), limit=6)
            response["recommendations"] = normalize_list(response.get("recommendations"), limit=6)
            response["proctoring_summary"] = normalize_text(str(response.get("proctoring_summary", "")))
            response["question_analysis"] = question_analysis
            response["competency_scores"] = competency_scores
            response["calculation"] = {
                "version": "invenia-interview-analysis-v2",
                "formula": "70% average per-question evidence + 30% competency evidence",
                "question_average": question_average,
                "competency_average": competency_average,
            }
            if not response["summary"]:
                response["summary"] = "Interview analysis could not be fully generated."
            return response
    except Exception:
        pass

    answer_lengths = [len(normalize_text(str(turn.get("answer", "")))) for turn in turns if normalize_text(str(turn.get("answer", "")))]
    average_length = round(sum(answer_lengths) / len(answer_lengths)) if answer_lengths else 0
    score = 45
    if len(turns) >= 3:
        score += 18
    if average_length >= 120:
        score += 18
    elif average_length >= 70:
        score += 10
    if warnings == 0:
        score += 15
    elif warnings <= 2:
        score += 8
    score = max(35, min(70, score))

    fallback_question_analysis = []
    for turn in turns:
        answer = normalize_text(str(turn.get("answer", "")))
        answer_score = 70 if len(answer) >= 120 else 58 if len(answer) >= 70 else 40 if answer else 0
        fallback_question_analysis.append(
            {
                "question": normalize_text(str(turn.get("question", ""))),
                "answer_quality": "Detailed" if answer_score >= 70 else "Needs validation" if answer else "No answer",
                "score": answer_score,
                "notes": "Local fallback checks answer completeness only; recruiter review is required.",
                "evidence": answer[:220],
                "competencies": [],
                "validation_points": [] if answer_score >= 70 else ["Validate relevance and job-specific depth manually."],
            }
        )

    return {
        "overall_score": score,
        "summary": "Provisional completeness estimate only. The interview transcript and recording require recruiter review before this result can support a hiring decision.",
        "decision": "review",
        "is_provisional": True,
        "analysis_source": "local_fallback",
        "limitations": [
            "This fallback evaluates answer presence and length, not technical correctness or job relevance.",
            "The provisional score must not be treated as assessed interview performance.",
            "A recruiter must review the transcript and recording before deciding.",
        ],
        "strengths": ["Answered multiple interview prompts", "Maintained an active interview flow"],
        "strong_signals": ["Answered multiple interview prompts", "Maintained an active interview flow"],
        "gaps": ["Add more concrete examples and outcomes"],
        "validation_points": ["Validate job relevance, technical depth, and claimed outcomes manually."],
        "risk_flags": [f"Proctoring warnings: {warnings}"] if warnings else [],
        "question_analysis": fallback_question_analysis,
        "competency_scores": [],
        "recommendations": ["Review the transcript and ask for a follow-up conversation."],
        "proctoring_summary": f"Recorded {warnings} proctoring warnings.",
        "calculation": {
            "version": "invenia-interview-analysis-v2-fallback",
            "formula": "Fallback completeness estimate; recruiter validation required",
            "question_average": round(sum(item["score"] for item in fallback_question_analysis) / len(fallback_question_analysis)) if fallback_question_analysis else 0,
            "competency_average": None,
        },
    }
