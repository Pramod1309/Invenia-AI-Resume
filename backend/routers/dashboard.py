import base64
import csv
import hashlib
import io
import os
import json
import html
import mimetypes
import re
import uuid
import zipfile
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import requests
from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import get_current_candidate_user, get_current_recruiter_user, is_super_recruiter
from database import get_db
from models import (
    CandidateProfile,
    Analytics,
    Interview,
    JobApplication,
    JobPosting,
    RecruiterProfile,
    SavedJob,
    User,
    UserRole,
)
from schemas import (
    ApplicationWorkflowStageSubmit,
    CandidateDashboardProfileUpdate,
    InterviewCreate,
    InterviewUpdate,
    JobActionRequest,
    JobApplicationCreate,
    JobApplicationUpdate,
    JobPostingCreate,
    JobPostingUpdate,
    RecruiterDashboardProfileUpdate,
)
from resume_ai import (
    build_candidate_ats_signature,
    calculate_ats_score,
    calculate_deterministic_job_ats_score,
    calculate_job_ats_score,
    can_send_inline_to_gemini,
    get_gemini_api_key,
    get_gemini_model,
    guess_resume_mime_type,
)
from assessment_ai import analyze_interview_report, normalize_text as ai_normalize_text
from workflow_utils import (
    build_application_workflow,
    build_overall_score_calculation,
    calculate_mcq_result,
    calculate_overall_workflow_score,
    dump_json_field,
    evaluate_coding_answers,
    evaluate_interview_answers,
    extract_resume_text,
    load_json_field,
    normalize_assessment_config,
    serialize_workflow_for_candidate,
    summarize_workflow_for_recruiter,
    generate_interview_questions,
)

router = APIRouter()

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads" / "resumes"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
INTERVIEW_MEDIA_DIR = Path(__file__).resolve().parent.parent / "uploads" / "interviews"
INTERVIEW_MEDIA_DIR.mkdir(parents=True, exist_ok=True)
INTERVIEW_RECORDINGS_DIR = INTERVIEW_MEDIA_DIR / "recordings"
INTERVIEW_RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)
INTERVIEW_SNAPSHOTS_DIR = INTERVIEW_MEDIA_DIR / "snapshots"
INTERVIEW_SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
MAX_RESUME_UPLOAD_BYTES = int(os.getenv("MAX_RESUME_UPLOAD_BYTES", 8 * 1024 * 1024))
MAX_INTERVIEW_UPLOAD_BYTES = int(os.getenv("MAX_INTERVIEW_UPLOAD_BYTES", 200 * 1024 * 1024))
MAX_PROFILE_PHOTO_BYTES = int(os.getenv("MAX_PROFILE_PHOTO_BYTES", 5 * 1024 * 1024))


def validate_profile_photo(file_bytes: bytes, filename: str) -> str:
    extension = Path(filename or "").suffix.lower()
    signatures = {
        ".jpg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
        ".jpeg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
        ".png": ("image/png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
        ".webp": ("image/webp", lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP"),
    }
    if extension not in signatures:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, and WebP profile photos are allowed")
    mime_type, signature_check = signatures[extension]
    if not file_bytes or not signature_check(file_bytes):
        raise HTTPException(status_code=400, detail="The selected file is not a valid image")
    if len(file_bytes) > MAX_PROFILE_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Profile photo is too large. Upload an image under 5 MB")
    return mime_type


def stored_profile_photo_url(role: str, user_id: int, profile: Any) -> str:
    stored_url = str(getattr(profile, "photo_url", "") or "")
    if not stored_url:
        return ""
    if not stored_url.startswith("/api/dashboard/profile-photos/"):
        return stored_url
    version = stored_url.split("?v=", 1)[1] if "?v=" in stored_url else ""
    base_url = f"/api/dashboard/profile-photos/{role}/{user_id}"
    return f"{base_url}?v={version}" if version and version != base_url else base_url


async def read_profile_photo_upload(request: Request) -> tuple[bytes, str]:
    form = await request.form(max_part_size=MAX_PROFILE_PHOTO_BYTES)
    file = form.get("file")
    if file is None or not hasattr(file, "filename") or not hasattr(file, "read"):
        raise HTTPException(status_code=400, detail="Profile photo is required")
    file_bytes = await file.read()
    return file_bytes, validate_profile_photo(file_bytes, file.filename or "")


def parse_list_field(value: Optional[str]) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    tokens = []
    for chunk in value.replace("\n", ",").split(","):
        chunk = chunk.strip()
        if chunk:
            tokens.append(chunk)
    return tokens


def to_utc_datetime(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def dump_list_field(items: list[str]) -> str:
    return json.dumps([item.strip() for item in items if item and item.strip()])


def calculate_match_score(candidate_skills: list[str], job_skills: list[str]) -> int:
    candidate_phrases = [_normalize_for_matching(skill) for skill in candidate_skills if _normalize_for_matching(skill)]
    job_phrases = [_normalize_for_matching(skill) for skill in job_skills if _normalize_for_matching(skill)]
    if not candidate_phrases or not job_phrases:
        return 0

    ignored = {
        "and", "the", "with", "for", "from", "role", "work", "years", "year",
        "experience", "knowledge", "skills", "skill", "required", "preferred", "strong",
    }
    candidate_terms = {
        term
        for phrase in candidate_phrases
        for term in re.findall(r"[a-z0-9+#.-]+", phrase)
        if len(term) > 1 and term not in ignored
    }
    item_scores: list[float] = []
    for job_phrase in job_phrases:
        job_terms = {
            term
            for term in re.findall(r"[a-z0-9+#.-]+", job_phrase)
            if len(term) > 1 and term not in ignored
        }
        if not job_terms:
            continue
        exact_skill = any(
            candidate == job_phrase or candidate in job_phrase or job_phrase in candidate
            for candidate in candidate_phrases
        )
        coverage = len(job_terms & candidate_terms) / len(job_terms)
        item_scores.append(1.0 if exact_skill else coverage)

    return max(0, min(100, round((sum(item_scores) / max(1, len(item_scores))) * 100)))


def calculate_profile_completion(user: User, profile: CandidateProfile) -> int:
    checks = [
        user.full_name,
        user.email,
        profile.phone,
        profile.location,
        profile.bio,
        profile.photo_url,
        profile.resume_url,
        profile.current_job_title,
        profile.experience_years,
        profile.skills,
        profile.salary_expectation,
        profile.linkedin_url,
        profile.github_url,
    ]
    filled = sum(bool(item) for item in checks)
    return round((filled / len(checks)) * 100)


def format_salary(job: JobPosting) -> str:
    currency = (getattr(job, "salary_currency", None) or "").strip()
    period = (getattr(job, "salary_period", None) or "").strip()
    if not period and (job.job_type or "").strip().lower() == "contract":
        period = "per day"

    def with_meta(value: str) -> str:
        prefix = f"{currency} " if currency else ""
        suffix = f" / {period}" if period else ""
        return f"{prefix}{value}{suffix}".strip()

    if job.salary_min is not None and job.salary_max is not None:
        return with_meta(f"{job.salary_min:,} - {job.salary_max:,}")
    if job.salary_min is not None:
        return with_meta(f"From {job.salary_min:,}")
    if job.salary_max is not None:
        return with_meta(f"Up to {job.salary_max:,}")
    return "Competitive"


def _base36(value: int) -> str:
    alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    value = max(0, int(value or 0))
    if value == 0:
        return "0"
    encoded = ""
    while value:
        value, remainder = divmod(value, 36)
        encoded = alphabet[remainder] + encoded
    return encoded


def format_public_job_id(job: JobPosting) -> str:
    created = job.created_at or datetime.utcnow()
    date_part = created.strftime("%Y%m%d")
    sequence = _base36(job.id or 0).rjust(5, "0")
    checksum_source = f"{job.id or 0}:{job.recruiter_id or 0}:{date_part}:invenia-job"
    checksum = hashlib.sha1(checksum_source.encode("utf-8", errors="ignore")).hexdigest()[:4].upper()
    return f"INV-{date_part}-{sequence}-{checksum}"


def application_next_step(status: str, interview: Optional[Interview]) -> str:
    if interview and interview.scheduled_at:
        return f"Interview scheduled for {interview.scheduled_at.strftime('%d %b %Y, %I:%M %p')}"
    mapping = {
        "pending": "Application sent to recruiter for verification. Please wait for screening approval.",
        "approved": "Screening approved. You can start the next round in the secure terminal.",
        "reviewed": "Recruiter is reviewing your profile",
        "shortlisted": "You have been shortlisted",
        "interview": "Interview will be scheduled soon",
        "offer": "Offer discussion is in progress",
        "rejected": "Application closed",
        "revoked": "You revoked this application. Re-applying to this job is disabled.",
        "hired": "Congratulations, you were hired",
    }
    return mapping.get(status, "Recruiter update pending")


def ensure_candidate_profile(db: Session, user: User) -> CandidateProfile:
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user.id).first()
    if profile is None:
        profile = CandidateProfile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def ensure_recruiter_profile(db: Session, user: User) -> RecruiterProfile:
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user.id).first()
    if profile is None:
        profile = RecruiterProfile(
            user_id=user.id,
            company_name="Invenia AI",
            job_title="Recruiter",
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def get_recruiter_jobs_query(db: Session, user: User):
    query = db.query(JobPosting)
    if is_super_recruiter(user):
        return query
    profile = ensure_recruiter_profile(db, user)
    return query.filter(JobPosting.recruiter_id == profile.id)


def can_manage_job(job: JobPosting, user: User, db: Session) -> bool:
    if is_super_recruiter(user):
        return True
    profile = ensure_recruiter_profile(db, user)
    return job.recruiter_id == profile.id


def can_manage_candidate(profile: Optional[CandidateProfile], user: User, db: Session) -> bool:
    if is_super_recruiter(user):
        return True
    if profile is None:
        return False

    job_ids = [job.id for job in get_recruiter_jobs_query(db, user).all()]
    if not job_ids:
        return False
    return (
        db.query(JobApplication)
        .filter(JobApplication.candidate_id == profile.id, JobApplication.job_id.in_(job_ids))
        .first()
        is not None
    )


def get_resume_file_path(resume_url: Optional[str]) -> Optional[Path]:
    if not resume_url:
        return None
    return UPLOADS_DIR / Path(resume_url).name


def delete_local_file_from_url(file_url: Optional[str], base_dir: Path) -> None:
    if not file_url:
        return
    file_path = base_dir / Path(file_url).name
    if not file_path.exists():
        return
    try:
        file_path.unlink()
    except OSError:
        pass


def restore_resume_file_from_binary(
    resume_url: Optional[str],
    resume_name: Optional[str],
    resume_content: Optional[bytes],
) -> Optional[Path]:
    resume_path = get_resume_file_path(resume_url)
    if resume_path and resume_path.exists():
        return resume_path
    if not resume_content:
        return resume_path

    target_name = Path(resume_url or resume_name or f"{uuid.uuid4().hex}.bin").name
    if not target_name:
        target_name = f"{uuid.uuid4().hex}.bin"
    resume_path = UPLOADS_DIR / target_name
    try:
        resume_path.parent.mkdir(parents=True, exist_ok=True)
        resume_path.write_bytes(resume_content)
    except Exception:
        return get_resume_file_path(resume_url)
    return resume_path


def ensure_profile_resume_file(profile: CandidateProfile) -> Optional[Path]:
    return restore_resume_file_from_binary(
        profile.resume_url,
        profile.resume_name,
        getattr(profile, "resume_content", None),
    )


def ensure_application_resume_file(application: JobApplication, profile: Optional[CandidateProfile] = None) -> Optional[Path]:
    return restore_resume_file_from_binary(
        application.resume_url or (profile.resume_url if profile else None),
        application.resume_name or (profile.resume_name if profile else None),
        application.resume_content or (profile.resume_content if profile else None),
    )


def serialize_ats_breakdown(profile: CandidateProfile) -> dict[str, Any]:
    stored = load_json_field(profile.ats_breakdown, {})
    if isinstance(stored, dict):
        return stored
    return {}


def get_candidate_ats_signature(profile: CandidateProfile, user: User) -> str:
    return build_candidate_ats_signature(
        build_candidate_profile_snapshot(user, profile),
        ensure_profile_resume_file(profile),
    )


def is_candidate_ats_current(profile: CandidateProfile, user: User) -> bool:
    if not profile.resume_url or not profile.ats_score or not profile.ats_last_checked_at:
        return False

    stored = serialize_ats_breakdown(profile)
    stored_signature = stored.get("input_signature")
    if not stored_signature:
        return False
    return stored_signature == get_candidate_ats_signature(profile, user)


def refresh_candidate_ats_if_needed(
    db: Session,
    profile: CandidateProfile,
    user: User,
    force: bool = False,
) -> Optional[dict[str, Any]]:
    if not profile.resume_url:
        return None
    if force or not is_candidate_ats_current(profile, user):
        return persist_candidate_ats(db, profile, user)
    return None


def recompute_candidate_ats(profile: CandidateProfile, user: User) -> dict[str, Any]:
    resume_path = ensure_profile_resume_file(profile)
    profile_snapshot = {
        "full_name": user.full_name or user.username,
        "email": user.email,
        "phone": profile.phone or "",
        "location": profile.location or "",
        "bio": profile.bio or "",
        "resume_url": profile.resume_url,
        "portfolio_url": profile.portfolio_url or "",
        "linkedin_url": profile.linkedin_url or "",
        "github_url": profile.github_url or "",
        "experience_years": profile.experience_years or 0,
        "current_job_title": profile.current_job_title or "",
        "skills": parse_list_field(profile.skills),
    }
    return calculate_ats_score(
        profile_snapshot,
        extract_resume_text(resume_path),
        resume_path=resume_path,
    )


def persist_candidate_ats(db: Session, profile: CandidateProfile, user: User) -> dict[str, Any]:
    ats_result = recompute_candidate_ats(profile, user)
    profile.ats_score = ats_result["score"]
    profile.ats_summary = ats_result["summary"]
    profile.ats_breakdown = dump_json_field(
        {
            "source": ats_result.get("source", "gemini"),
            "model": ats_result.get("model", ""),
            "scanned_at": ats_result.get("scanned_at"),
            "input_signature": ats_result.get("input_signature"),
            "breakdown": ats_result["breakdown"],
            "strengths": ats_result.get("strengths", []),
            "gaps": ats_result.get("gaps", []),
            "keywords_found": ats_result.get("keywords_found", []),
            "keywords_missing": ats_result.get("keywords_missing", []),
            "suggestions": ats_result["suggestions"],
            "optimization_tips": ats_result.get("optimization_tips", []),
            "optimized_resume_headline": ats_result.get("optimized_resume_headline", ""),
        }
    )
    profile.ats_last_checked_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    return ats_result


def get_job_assessment_config(job: JobPosting) -> dict[str, Any]:
    return normalize_assessment_config(
        load_json_field(job.assessment_config, {}),
        job_title=job.title,
        description=job.description or "",
        skills=parse_list_field(job.requirements),
    )


def build_job_snapshot(job: JobPosting) -> dict[str, Any]:
    return {
        "id": job.id,
        "public_job_id": format_public_job_id(job),
        "title": job.title,
        "company": job.recruiter.company_name if job.recruiter else "Invenia AI",
        "recruiterPhotoUrl": stored_profile_photo_url("recruiter", job.recruiter.user_id, job.recruiter) if job.recruiter else "",
        "description": job.description,
        "requirements": parse_list_field(job.requirements),
        "responsibilities": parse_list_field(job.responsibilities),
        "benefits": parse_list_field(job.benefits),
        "location": "Remote" if job.is_remote else (job.location or "Location not specified"),
        "type": job.job_type or "Full-time",
        "experience_level": job.experience_level or "",
        "salary": format_salary(job),
        "salary_currency": getattr(job, "salary_currency", None) or "",
        "salary_period": getattr(job, "salary_period", None) or "",
        "is_remote": bool(job.is_remote),
    }


def get_application_workflow_state(application: JobApplication) -> dict[str, Any]:
    return load_json_field(application.workflow_state, {})


def get_released_final_score(workflow_state: dict[str, Any], stored_score: Any = 0) -> int:
    interview_state = workflow_state.get("interview") if isinstance(workflow_state.get("interview"), dict) else {}
    if interview_state.get("score") is None:
        return 0
    calculation = build_overall_score_calculation(workflow_state)
    value = calculation.get("score", workflow_state.get("overall_score"))
    if value is None:
        value = stored_score
    try:
        return max(0, min(100, int(round(float(value or 0)))))
    except (TypeError, ValueError):
        return 0


def set_application_workflow_state(application: JobApplication, workflow_state: dict[str, Any]) -> None:
    application.workflow_state = dump_json_field(workflow_state)
    application.workflow_stage = workflow_state.get("current_stage", application.workflow_stage or "profile")
    application.final_score = get_released_final_score(workflow_state, application.final_score)


WORKFLOW_STAGE_ORDER = ["aptitude", "technical", "coding", "interview"]
ASSESSMENT_UNLOCK_STATUSES = {"approved", "shortlisted", "interview", "offer", "hired"}


def get_workflow_stage_config(workflow_state: dict[str, Any], stage: str) -> dict[str, Any]:
    return (workflow_state.get("assessment") or {}).get(stage, {})


def is_workflow_stage_enabled(workflow_state: dict[str, Any], stage: str) -> bool:
    if stage == "interview":
        return True
    stage_state = workflow_state.get(stage) if isinstance(workflow_state.get(stage), dict) else {}
    stage_config = get_workflow_stage_config(workflow_state, stage)
    return bool(stage_state.get("enabled", stage_config.get("enabled", True)))


def get_first_enabled_workflow_stage(workflow_state: dict[str, Any]) -> str:
    for stage in WORKFLOW_STAGE_ORDER:
        if is_workflow_stage_enabled(workflow_state, stage):
            return stage
    return "interview"


def get_next_workflow_stage(workflow_state: dict[str, Any], stage: str) -> str:
    if stage not in WORKFLOW_STAGE_ORDER:
        return stage
    index = WORKFLOW_STAGE_ORDER.index(stage)
    for next_stage in WORKFLOW_STAGE_ORDER[index + 1:]:
        if is_workflow_stage_enabled(workflow_state, next_stage):
            return next_stage
    return "completed"


def unlock_application_workflow(application: JobApplication, workflow_state: dict[str, Any]) -> dict[str, Any]:
    if workflow_state.get("current_stage") in {"screening", "profile", None, ""}:
        workflow_state["current_stage"] = get_first_enabled_workflow_stage(workflow_state)
    workflow_state["screening"] = {
        "approved": True,
        "approved_at": datetime.utcnow().isoformat(),
        "message": "Recruiter screening approved. Candidate can start the secure assessment rounds.",
    }
    set_application_workflow_state(application, workflow_state)
    return workflow_state


def build_interview_turn_history(workflow_state: dict[str, Any]) -> list[dict[str, Any]]:
    turns = workflow_state.get("interview", {}).get("turns") or []
    history = []
    for turn in turns:
        history.append(
            {
                "question": turn.get("question", ""),
                "answer": turn.get("answer", ""),
            }
        )
    return history


def replace_interview_question(workflow_state: dict[str, Any], question: dict[str, Any]) -> None:
    interview_state = workflow_state.setdefault("interview", {})
    interview_state["current_question"] = question
    questions = interview_state.setdefault("questions", [])
    questions.append(question)


def build_candidate_profile_snapshot(user: User, profile: CandidateProfile) -> dict[str, Any]:
    return {
        "full_name": user.full_name or user.username,
        "email": user.email,
        "phone": profile.phone or "",
        "location": profile.location or "",
        "bio": profile.bio or "",
        "photo_url": stored_profile_photo_url("candidate", user.id, profile),
        "resume_url": profile.resume_url,
        "resume_name": profile.resume_name or "",
        "portfolio_url": profile.portfolio_url or "",
        "linkedin_url": profile.linkedin_url or "",
        "github_url": profile.github_url or "",
        "experience_years": profile.experience_years or 0,
        "current_job_title": profile.current_job_title or "",
        "current_company": profile.current_company or "",
        "skills": parse_list_field(profile.skills),
        "preferred_job_types": parse_list_field(profile.preferred_job_types),
        "preferred_locations": parse_list_field(profile.preferred_locations),
        "salary_expectation": profile.salary_expectation or "",
    }


def _normalize_for_matching(value: Any) -> str:
    return ai_normalize_text(str(value or "")).strip()


def build_fast_job_ats_result(
    profile: CandidateProfile,
    user: User,
    job: JobPosting,
    match_score: int,
    previous_result: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    resume_path = ensure_profile_resume_file(profile)
    return calculate_deterministic_job_ats_score(
        build_candidate_profile_snapshot(user, profile),
        extract_resume_text(resume_path),
        build_job_snapshot(job),
        resume_path=resume_path,
        previous_result=previous_result,
    )


def build_locked_application_workflow(
    job: JobPosting,
    profile: CandidateProfile,
    user: User,
    match_score: int,
    cover_letter: str = "",
    job_ats: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    assessment_config = get_job_assessment_config(job)
    aptitude_config = assessment_config["aptitude"]
    technical_config = assessment_config["technical"]
    coding_config = assessment_config["coding"]
    interview_config = assessment_config["interview"]
    job_ats_state = job_ats if isinstance(job_ats, dict) else {}
    profile_ats_score = int(profile.ats_score or job_ats_state.get("score") or 0)
    job_ats_score = int(job_ats_state.get("score") or profile_ats_score or 0)

    return {
        "assessment_session_id": uuid.uuid4().hex,
        "current_stage": "screening",
        "job": build_job_snapshot(job),
        "profile": build_candidate_profile_snapshot(user, profile),
        "cover_letter": cover_letter or "",
        "profile_ats_score": profile_ats_score,
        "ats_score": max(0, min(job_ats_score, 100)),
        "job_ats": job_ats_state,
        "match_score": match_score,
        "screening": {
            "approved": False,
            "submitted_at": datetime.utcnow().isoformat(),
            "message": "Application sent to recruiter for verification.",
        },
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
            "questions": [],
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
            "questions": [],
            "selected_answers": [],
            "score": None,
            "percentage": None,
            "passed": None,
            "submitted_at": None,
            "skipped": False,
        },
        "coding": {
            "enabled": coding_config.get("enabled", True),
            "questions": [],
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
            "questions": [],
            "current_question": {},
            "answers": [],
            "notes": "",
            "transcript": "",
            "proctoring": {"warnings": 0, "events": []},
            "recording_url": "",
            "snapshot_url": "",
            "session_started_at": None,
            "score": None,
            "feedback": "",
            "report": None,
            "submitted_at": None,
        },
        "overall_score": None,
        "completed": False,
    }


def workflow_needs_generated_rounds(workflow_state: dict[str, Any]) -> bool:
    if not workflow_state:
        return True
    for stage in ("aptitude", "technical", "coding"):
        if is_workflow_stage_enabled(workflow_state, stage) and not workflow_state.get(stage, {}).get("questions"):
            return True
    interview_state = workflow_state.get("interview") if isinstance(workflow_state.get("interview"), dict) else {}
    return not bool(interview_state.get("current_question"))


def generate_unlocked_application_workflow(
    application: JobApplication,
    profile: CandidateProfile,
    user: User,
    previous_workflow: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    previous_workflow = previous_workflow if isinstance(previous_workflow, dict) else {}
    job_ats_result = previous_workflow.get("job_ats") if isinstance(previous_workflow.get("job_ats"), dict) else {}
    match_score = application.job_match_score or calculate_match_score(
        parse_list_field(profile.skills),
        parse_list_field(application.job.requirements),
    )
    if not job_ats_result:
        job_ats_result = build_fast_job_ats_result(profile, user, application.job, match_score)
    workflow_state = build_application_workflow(
        job_snapshot=build_job_snapshot(application.job),
        profile_snapshot=build_candidate_profile_snapshot(user, profile),
        assessment_config=get_job_assessment_config(application.job),
        ats_score=profile.ats_score or job_ats_result.get("score") or 0,
        match_score=match_score,
        cover_letter=application.cover_letter or previous_workflow.get("cover_letter") or "",
        job_ats=job_ats_result,
    )
    workflow_state["screening"] = previous_workflow.get("screening") or {
        "approved": True,
        "approved_at": datetime.utcnow().isoformat(),
        "message": "Recruiter screening approved. Candidate can start the secure assessment rounds.",
    }
    workflow_state["current_stage"] = get_first_enabled_workflow_stage(workflow_state)
    return workflow_state


def recompute_application_job_ats(profile: CandidateProfile, user: User, job: JobPosting) -> dict[str, Any]:
    resume_path = ensure_profile_resume_file(profile)
    profile_snapshot = build_candidate_profile_snapshot(user, profile)
    job_snapshot = build_job_snapshot(job)
    return calculate_job_ats_score(
        profile_snapshot,
        extract_resume_text(resume_path),
        job_snapshot,
        resume_path=resume_path,
    )


def ensure_application_workflow(db: Session, application: JobApplication, user: User, profile: CandidateProfile) -> dict[str, Any]:
    workflow_state = get_application_workflow_state(application)
    if workflow_state:
        stored_job_ats = workflow_state.get("job_ats") if isinstance(workflow_state.get("job_ats"), dict) else {}
        calculation = stored_job_ats.get("calculation") if isinstance(stored_job_ats.get("calculation"), dict) else {}
        if application.job and calculation.get("version") != "invenia-job-ats-v3":
            match_score = calculate_match_score(
                parse_list_field(profile.skills),
                parse_list_field(application.job.requirements),
            )
            refreshed_job_ats = build_fast_job_ats_result(
                profile,
                user,
                application.job,
                match_score,
                previous_result=stored_job_ats,
            )
            workflow_state["job_ats"] = refreshed_job_ats
            workflow_state["ats_score"] = refreshed_job_ats.get("score", 0)
            workflow_state["match_score"] = match_score
            workflow_state["score_calculation"] = build_overall_score_calculation(workflow_state)
            workflow_state["overall_score"] = workflow_state["score_calculation"]["score"]
            application.job_match_score = match_score
            if workflow_state.get("completed"):
                application.final_score = workflow_state["overall_score"]
            set_application_workflow_state(application, workflow_state)
            db.commit()
            db.refresh(application)
        if application.status in ASSESSMENT_UNLOCK_STATUSES and workflow_needs_generated_rounds(workflow_state):
            workflow_state = generate_unlocked_application_workflow(application, profile, user, workflow_state)
            set_application_workflow_state(application, workflow_state)
            application.job_match_score = workflow_state.get("match_score")
            db.commit()
            db.refresh(application)
        return workflow_state

    if profile.resume_url and not profile.ats_score:
        refresh_candidate_ats_if_needed(db, profile, user)
        db.refresh(application)

    match_score = application.job_match_score or calculate_match_score(
        parse_list_field(profile.skills),
        parse_list_field(application.job.requirements),
    )
    job_ats_result = build_fast_job_ats_result(profile, user, application.job, match_score) if profile.resume_url and application.job else {}
    if application.status in ASSESSMENT_UNLOCK_STATUSES:
        workflow_state = generate_unlocked_application_workflow(application, profile, user, {"job_ats": job_ats_result})
    else:
        workflow_state = build_locked_application_workflow(
            application.job,
            profile,
            user,
            match_score,
            application.cover_letter or "",
            job_ats_result,
        )
    set_application_workflow_state(application, workflow_state)
    application.job_match_score = workflow_state.get("match_score")
    db.commit()
    db.refresh(application)
    return workflow_state


def serialize_candidate_profile(user: User, profile: CandidateProfile) -> dict:
    skills = parse_list_field(profile.skills)
    preferred_job_types = parse_list_field(profile.preferred_job_types)
    preferred_locations = parse_list_field(profile.preferred_locations)
    ats_data = serialize_ats_breakdown(profile)
    return {
        "full_name": user.full_name or user.username,
        "email": user.email,
        "phone": profile.phone or "",
        "location": profile.location or "",
        "bio": profile.bio or "",
        "photo_url": stored_profile_photo_url("candidate", user.id, profile),
        "resume_url": profile.resume_url,
        "resume_name": profile.resume_name or "",
        "portfolio_url": profile.portfolio_url or "",
        "linkedin_url": profile.linkedin_url or "",
        "github_url": profile.github_url or "",
        "experience_years": profile.experience_years or 0,
        "current_job_title": profile.current_job_title or "",
        "current_company": profile.current_company or "",
        "skills": skills,
        "preferred_job_types": preferred_job_types,
        "preferred_locations": preferred_locations,
        "salary_expectation": profile.salary_expectation or "",
        "is_available": profile.is_available,
        "completion": calculate_profile_completion(user, profile),
        "ats_score": profile.ats_score,
        "ats_summary": profile.ats_summary or "",
        "ats_breakdown": ats_data.get("breakdown", []),
        "ats_strengths": ats_data.get("strengths", []),
        "ats_gaps": ats_data.get("gaps", []),
        "ats_keywords_found": ats_data.get("keywords_found", []),
        "ats_keywords_missing": ats_data.get("keywords_missing", []),
        "ats_suggestions": ats_data.get("suggestions", []),
        "ats_optimization_tips": ats_data.get("optimization_tips", []),
        "ats_optimized_resume_headline": ats_data.get("optimized_resume_headline", ""),
        "ats_source": ats_data.get("source", ""),
        "ats_model": ats_data.get("model", ""),
        "ats_last_checked_at": profile.ats_last_checked_at.isoformat() if profile.ats_last_checked_at else None,
    }


def serialize_recruiter_profile(user: User, profile: RecruiterProfile, db: Session) -> dict:
    recruiter_jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == profile.id).all()
    recruiter_job_ids = [job.id for job in recruiter_jobs]
    applications_received = 0
    if recruiter_job_ids:
        applications_received = (
            db.query(JobApplication)
            .filter(JobApplication.job_id.in_(recruiter_job_ids))
            .count()
        )

    return {
        "full_name": user.full_name or user.username,
        "email": user.email,
        "company_name": profile.company_name,
        "company_description": profile.company_description or "",
        "company_website": profile.company_website or "",
        "company_size": profile.company_size or "",
        "industry": profile.industry or "",
        "job_title": profile.job_title or "",
        "phone": profile.phone or "",
        "linkedin_url": profile.linkedin_url or "",
        "photo_url": stored_profile_photo_url("recruiter", user.id, profile),
        "is_company_verified": profile.is_company_verified,
        "is_super_recruiter": is_super_recruiter(user),
        "stats": {
            "jobs_posted": len(recruiter_jobs),
            "active_jobs": len([job for job in recruiter_jobs if job.is_active]),
            "applications_received": applications_received,
        },
    }


def serialize_job_for_candidate(
    job: JobPosting,
    candidate_skills: list[str],
    saved_job_ids: set[int],
    applied_job_ids: set[int],
) -> dict:
    recruiter_profile = job.recruiter
    company_name = recruiter_profile.company_name if recruiter_profile else "Invenia AI"
    job_skills = parse_list_field(job.requirements)
    match_score = calculate_match_score(candidate_skills, job_skills)
    return {
        "id": job.id,
        "publicJobId": format_public_job_id(job),
        "title": job.title,
        "company": company_name,
        "recruiterPhotoUrl": stored_profile_photo_url("recruiter", recruiter_profile.user_id, recruiter_profile) if recruiter_profile else "",
        "location": "Remote" if job.is_remote else (job.location or "Location not specified"),
        "salary": format_salary(job),
        "salaryCurrency": getattr(job, "salary_currency", None) or "",
        "salaryPeriod": getattr(job, "salary_period", None) or "",
        "type": job.job_type or "Full-time",
        "postedDate": job.created_at.isoformat() if job.created_at else None,
        "description": job.description,
        "requirements": job_skills,
        "responsibilities": parse_list_field(job.responsibilities),
        "benefits": parse_list_field(job.benefits),
        "skills": job_skills,
        "matchScore": match_score,
        "applicants": len(job.applications),
        "views": int(getattr(job, "view_count", None) or 0),
        "isSaved": job.id in saved_job_ids,
        "isApplied": job.id in applied_job_ids,
        "experienceLevel": job.experience_level or "",
        "isRemote": job.is_remote,
    }


def serialize_job_for_recruiter(job: JobPosting, all_candidate_profiles: list[CandidateProfile]) -> dict:
    job_skills = parse_list_field(job.requirements)
    assessment_config = get_job_assessment_config(job)
    scores = [
        calculate_match_score(parse_list_field(profile.skills), job_skills)
        for profile in all_candidate_profiles
        if profile.skills
    ]
    average_match = round(sum(scores) / len(scores)) if scores else 0
    applications = len(job.applications)
    view_count = int(getattr(job, "view_count", None) or 0)
    saved_count = len(getattr(job, "saved_jobs", []))
    shortlisted_count = len([application for application in job.applications if application.status in {"shortlisted", "interview", "offer", "hired"}])
    interviewed_count = len([application for application in job.applications if application.status in {"interview", "offer", "hired"}])
    hired_applications = [application for application in job.applications if application.status == "hired" and application.applied_at and job.created_at]
    time_to_fill_days = 0
    if hired_applications:
        first_hired = min(hired_applications, key=lambda application: application.applied_at)
        time_to_fill_days = max(0, (first_hired.applied_at - job.created_at).days)

    applicant_locations = {
        application.candidate.location
        for application in job.applications
        if application.candidate and application.candidate.location
    }
    diversity_score = round((len(applicant_locations) / max(1, applications)) * 100) if applications else max(35, average_match - 10)
    return {
        "id": job.id,
        "publicJobId": format_public_job_id(job),
        "title": job.title,
        "company": job.recruiter.company_name if job.recruiter else "Invenia AI",
        "recruiterPhotoUrl": stored_profile_photo_url("recruiter", job.recruiter.user_id, job.recruiter) if job.recruiter else "",
        "location": "Remote" if job.is_remote else (job.location or "Location not specified"),
        "type": job.job_type or "Full-time",
        "salary": format_salary(job),
        "salaryMin": job.salary_min,
        "salaryMax": job.salary_max,
        "salaryCurrency": getattr(job, "salary_currency", None) or "",
        "salaryPeriod": getattr(job, "salary_period", None) or "",
        "applications": applications,
        "appliedCount": applications,
        "views": view_count,
        "matchScore": average_match,
        "status": "active" if job.is_active else "inactive",
        "description": job.description,
        "skills": job_skills,
        "requirements": job_skills,
        "requirementsText": ", ".join(job_skills),
        "responsibilities": job.responsibilities or "",
        "responsibilitiesList": parse_list_field(job.responsibilities),
        "benefits": job.benefits or "",
        "benefitsList": parse_list_field(job.benefits),
        "postedDate": job.created_at.isoformat() if job.created_at else None,
        "experienceLevel": job.experience_level or "",
        "isRemote": job.is_remote,
        "shortlistedCount": shortlisted_count,
        "interviewedCount": interviewed_count,
        "timeToFillDays": time_to_fill_days,
        "diversityScore": diversity_score,
        "assessmentConfig": {
            "aptitude": {
                "enabled": assessment_config["aptitude"].get("enabled", True),
                "mode": assessment_config["aptitude"]["mode"],
                "required": assessment_config["aptitude"]["required"],
                "cutoff": assessment_config["aptitude"]["cutoff"],
                "duration_minutes": assessment_config["aptitude"]["duration_minutes"],
                "question_count": assessment_config["aptitude"]["question_count"],
                "manual_questions_text": assessment_config["aptitude"]["manual_questions_text"],
            },
            "technical": {
                "enabled": assessment_config["technical"].get("enabled", True),
                "mode": assessment_config["technical"]["mode"],
                "required": assessment_config["technical"]["required"],
                "cutoff": assessment_config["technical"]["cutoff"],
                "duration_minutes": assessment_config["technical"]["duration_minutes"],
                "question_count": assessment_config["technical"]["question_count"],
                "manual_questions_text": assessment_config["technical"]["manual_questions_text"],
            },
            "coding": {
                "enabled": assessment_config["coding"].get("enabled", True),
                "required": assessment_config["coding"]["required"],
                "question_count": assessment_config["coding"]["question_count"],
                "manual_questions_text": assessment_config["coding"]["manual_questions_text"],
            },
            "interview": {
                "required": assessment_config["interview"]["required"],
                "duration_minutes": assessment_config["interview"]["duration_minutes"],
                "question_count": assessment_config["interview"]["question_count"],
            },
        },
    }


def safe_number(value: Any, default: float = 0) -> float:
    try:
        if value in (None, "", "Pending", "pending", "N/A"):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value: Any, default: int = 0) -> int:
    return int(round(safe_number(value, default)))


def safe_round_average(values: list[Any]) -> int:
    usable = [safe_number(value, None) for value in values if value not in (None, "", "Pending", "pending", "N/A")]
    usable = [value for value in usable if value is not None]
    return round(sum(usable) / len(usable)) if usable else 0


def score_distribution(values: list[Any]) -> list[dict[str, Any]]:
    bands = [
        ("90-100", 90, 100),
        ("75-89", 75, 89),
        ("60-74", 60, 74),
        ("Below 60", 0, 59),
    ]
    total = len(values)
    distribution = []
    for label, low, high in bands:
        count = len([value for value in values if low <= safe_number(value, -1) <= high])
        distribution.append(
            {
                "label": label,
                "count": count,
                "percentage": round((count / max(1, total)) * 100) if total else 0,
            }
        )
    return distribution


def get_workflow_summary_safely(application: JobApplication) -> dict[str, Any]:
    workflow_state = get_application_workflow_state(application)
    if not workflow_state:
        return enrich_workflow_summary_from_storage(application, {})
    try:
        return enrich_workflow_summary_from_storage(application, summarize_workflow_for_recruiter(workflow_state))
    except Exception:
        return enrich_workflow_summary_from_storage(application, {})


def enrich_workflow_summary_from_storage(application: JobApplication, summary: Optional[dict[str, Any]]) -> dict[str, Any]:
    summary = dict(summary or {})
    interview_summary = dict(summary.get("interview") or {})

    stored_report = load_json_field(application.interview_report, {}) if application.interview_report else {}
    stored_turns = load_json_field(application.interview_turns, []) if application.interview_turns else []
    if not interview_summary.get("report") and stored_report:
        interview_summary["report"] = stored_report
    if not interview_summary.get("turns") and stored_turns:
        interview_summary["turns"] = stored_turns
    if not interview_summary.get("transcript") and application.interview_transcript:
        interview_summary["transcript"] = application.interview_transcript
    if not interview_summary.get("recordingUrl") and getattr(application, "interview_recording_content", None):
        interview_summary["recordingUrl"] = "stored-interview-recording"
    if not interview_summary.get("snapshotUrl") and getattr(application, "interview_snapshot_content", None):
        interview_summary["snapshotUrl"] = "stored-interview-snapshot"
    if application.interview_recorded_at:
        interview_summary["recordedAt"] = application.interview_recorded_at.isoformat()

    if interview_summary:
        summary["interview"] = interview_summary
    return summary


def get_job_ats_from_summary(summary: dict[str, Any], profile_score: Optional[int] = None) -> dict[str, Any]:
    job_ats = summary.get("jobAts") if isinstance(summary.get("jobAts"), dict) else {}
    if job_ats:
        return job_ats
    score = summary.get("jobAtsScore", summary.get("atsScore", profile_score or 0))
    return {
        "score": score or 0,
        "summary": "Job-specific ATS analysis is pending for this application.",
        "recommendation": "Open the candidate workflow or ask the candidate to begin the secure terminal to generate the role-fit report.",
        "requirement_match": {"matched": 0, "partial": 0, "missing": 0, "total": 0, "percentage": score or 0},
        "matched_requirements": [],
        "partial_requirements": [],
        "missing_requirements": [],
        "strengths": [],
        "gaps": [],
        "category_scores": [],
        "role_alignment": [],
        "recruiter_notes": [],
        "confidence": "low",
    }


def stage_percentage(summary: dict[str, Any], stage: str) -> Optional[int]:
    stage_data = summary.get(stage) if isinstance(summary.get(stage), dict) else {}
    if stage in {"aptitude", "technical"}:
        return stage_data.get("percentage")
    if stage in {"coding", "interview"}:
        return stage_data.get("score")
    return None


def _unique_analysis_points(values: list[Any], limit: int = 10) -> list[str]:
    points: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = ai_normalize_text(str(value or ""))
        key = text.lower()
        if not text or key in seen:
            continue
        seen.add(key)
        points.append(text)
        if len(points) >= limit:
            break
    return points


def build_candidate_decision_analysis(
    job_ats: dict[str, Any],
    summary: dict[str, Any],
    stage_scores: dict[str, Optional[int]],
    final_score: int,
    interview_report: Optional[dict[str, Any]],
) -> dict[str, Any]:
    interview_report = interview_report if isinstance(interview_report, dict) else {}
    final_calculation = summary.get("scoreCalculation") if isinstance(summary.get("scoreCalculation"), dict) else {}
    requirement_match = job_ats.get("requirement_match") if isinstance(job_ats.get("requirement_match"), dict) else {}
    evidence_assessments = [
        item for item in (job_ats.get("evidence_assessments") or []) if isinstance(item, dict)
    ]
    matched_evidence = [item for item in evidence_assessments if item.get("status") == "matched"]
    partial_evidence = [item for item in evidence_assessments if item.get("status") == "partial"]
    missing_evidence = [item for item in evidence_assessments if item.get("status") == "missing"]
    requirement_counts = {
        "total": len(evidence_assessments),
        "matched": len(matched_evidence),
        "partial": len(partial_evidence),
        "missing": len(missing_evidence),
    } if evidence_assessments else {
        "total": safe_int(requirement_match.get("total")),
        "matched": safe_int(requirement_match.get("matched")),
        "partial": safe_int(requirement_match.get("partial")),
        "missing": safe_int(requirement_match.get("missing")),
    }

    stage_labels = {
        "aptitude": "Aptitude",
        "technical": "Technical MCQ",
        "coding": "Coding",
        "interview": "Interview",
    }
    stage_analysis: list[dict[str, Any]] = []
    completed_scores: list[int] = []
    pending_stages: list[str] = []
    for stage, label in stage_labels.items():
        stage_state = summary.get(stage) if isinstance(summary.get(stage), dict) else {}
        enabled = stage == "interview" or bool(stage_state.get("enabled", True))
        skipped = bool(stage_state.get("skipped"))
        score = stage_scores.get(stage)
        if not enabled or skipped:
            status = "not-required"
            insight = "This round is excluded from the final score for this job."
        elif score is None:
            status = "pending"
            pending_stages.append(label)
            insight = "No result is available yet; the hiring recommendation remains provisional."
        else:
            completed_scores.append(score)
            status = "strong" if score >= 80 else "acceptable" if score >= 65 else "validation-required"
            insight = (
                "Strong stage performance supports progression."
                if score >= 80
                else "Usable evidence, with targeted follow-up recommended."
                if score >= 65
                else "This result needs recruiter validation before progression."
            )
        stage_analysis.append(
            {"key": stage, "label": label, "score": score, "status": status, "insight": insight}
        )

    strong_signal_values: list[Any] = []
    for item in matched_evidence:
        evidence = ai_normalize_text(str(item.get("evidence_quote") or ""))
        strong_signal_values.append(
            f"{item.get('item')}: supported by '{evidence}'" if evidence else f"{item.get('item')}: validated in the CV/profile."
        )
    strong_signal_values.extend(job_ats.get("strengths") or [])
    strong_signal_values.extend(
        f"{stage_labels[key]} score of {score}% is a strong performance signal."
        for key, score in stage_scores.items()
        if score is not None and score >= 80
    )
    strong_signal_values.extend(interview_report.get("strong_signals") or interview_report.get("strengths") or [])

    validation_values: list[Any] = []
    for item in partial_evidence:
        validation_values.append(f"Validate partial evidence for: {item.get('item')}.")
    for item in missing_evidence:
        validation_values.append(f"No submitted evidence for: {item.get('item')}.")
    validation_values.extend(job_ats.get("gaps") or [])
    validation_values.extend(
        f"Review the {stage_labels[key]} result of {score}%."
        for key, score in stage_scores.items()
        if score is not None and score < 65
    )
    validation_values.extend(interview_report.get("validation_points") or interview_report.get("gaps") or [])
    validation_values.extend(interview_report.get("risk_flags") or [])
    if pending_stages:
        validation_values.append(f"Pending evidence: {', '.join(pending_stages)}.")

    score_rationale: list[str] = []
    for component in (job_ats.get("calculation") or {}).get("components", []):
        score_rationale.append(
            f"Job ATS {component.get('label')}: {component.get('score', 0)}% x {component.get('weight', 0)}% = {component.get('contribution', 0)} points."
        )
    for component in final_calculation.get("components", []):
        score_rationale.append(
            f"Final score {component.get('label')}: {component.get('score', 0)}% x {component.get('effective_weight', 0)}% = {component.get('contribution', 0)} points."
        )
    score_context = job_ats.get("score_context") if isinstance(job_ats.get("score_context"), dict) else {}
    score_rationale.extend(score_context.get("limiting_factors") or [])
    no_missing = bool(requirement_counts["total"]) and requirement_counts["missing"] == 0 and not (job_ats.get("missing_requirements") or [])
    if no_missing and safe_int(job_ats.get("score")) < 75:
        score_rationale.append(
            "No requirement is marked missing, but the score remains below 75 because partial evidence, experience alignment, skill depth, or responsibility evidence is not yet strong enough for full credit."
        )

    completed_required = len(completed_scores)
    confidence_base = safe_int(job_ats.get("confidence_score"))
    completion_bonus = min(30, completed_required * 8)
    decision_confidence = min(100, round((confidence_base * 0.7) + completion_bonus))
    fallback_interview = bool(interview_report.get("is_provisional") or interview_report.get("analysis_source") == "local_fallback")
    report_status = "final" if final_calculation.get("status") == "final" and not pending_stages and not fallback_interview else "provisional"
    if fallback_interview:
        decision_confidence = min(decision_confidence, 50)
    job_ats_score = safe_int(job_ats.get("score"))
    interview_score = stage_scores.get("interview")

    if report_status == "provisional":
        decision_band = "Continue evaluation"
        recommendation = f"Complete {', '.join(pending_stages) or 'the remaining enabled rounds'} before making a final hiring decision."
    elif final_score >= 85 and job_ats_score >= 80 and (interview_score is None or interview_score >= 75):
        decision_band = "High-priority shortlist"
        recommendation = "Strong combined evidence supports progressing this candidate to final recruiter review."
    elif final_score >= 70 and job_ats_score >= 65:
        decision_band = "Shortlist with validation"
        recommendation = "Proceed after validating the specific points listed in this report."
    elif final_score >= 55 or job_ats_score >= 60:
        decision_band = "Manual review required"
        recommendation = "Use a focused follow-up to resolve evidence gaps before progression."
    else:
        decision_band = "Low current fit"
        recommendation = "Current submitted evidence does not support progression without substantial manual validation."

    summary_parts = [
        f"Job ATS is {job_ats_score}% with {requirement_counts['matched']} matched, "
        f"{requirement_counts['partial']} partial, and "
        f"{requirement_counts['missing']} missing requirement(s).",
        f"The combined score is {final_score}% and is {report_status}.",
    ]
    if interview_score is not None:
        summary_parts.append(f"Interview performance contributes a {interview_score}% result.")
    elif pending_stages:
        summary_parts.append(f"Pending rounds: {', '.join(pending_stages)}.")

    return {
        "brand": "Invenia AI Analysis",
        "status": report_status,
        "decisionBand": decision_band,
        "decisionConfidence": decision_confidence,
        "executiveSummary": " ".join(summary_parts),
        "recommendation": recommendation,
        "strongSignals": _unique_analysis_points(strong_signal_values, 10),
        "validationPoints": _unique_analysis_points(validation_values, 10),
        "scoreRationale": _unique_analysis_points(score_rationale, 14),
        "stageAnalysis": stage_analysis,
        "requirementEvidence": evidence_assessments[:24],
        "requirementSummary": requirement_counts,
        "interviewAnalysis": {
            "score": interview_score,
            "decision": interview_report.get("decision") or "Pending",
            "summary": interview_report.get("summary") or "Interview analysis is pending.",
            "competencyScores": interview_report.get("competency_scores") or [],
            "questionAnalysis": interview_report.get("question_analysis") or [],
            "strongSignals": interview_report.get("strong_signals") or interview_report.get("strengths") or [],
            "validationPoints": interview_report.get("validation_points") or interview_report.get("gaps") or [],
            "riskFlags": interview_report.get("risk_flags") or [],
            "recommendations": interview_report.get("recommendations") or [],
            "proctoringSummary": interview_report.get("proctoring_summary") or "No interview proctoring summary is available yet.",
            "isProvisional": fallback_interview,
            "source": interview_report.get("analysis_source") or "invenia_ai_analysis",
            "limitations": interview_report.get("limitations") or [],
        },
    }


def build_candidate_analysis_item(application: JobApplication) -> dict[str, Any]:
    candidate_profile = application.candidate
    candidate_user = candidate_profile.user if candidate_profile else None
    summary = get_workflow_summary_safely(application)
    profile_ats_score = candidate_profile.ats_score if candidate_profile else None
    job_ats = get_job_ats_from_summary(summary, profile_ats_score)
    current_match_score = safe_int(application.job_match_score)
    calculation_version = (job_ats.get("calculation") or {}).get("version") if isinstance(job_ats.get("calculation"), dict) else None
    if candidate_profile and candidate_user and application.job:
        current_match_score = calculate_match_score(
            parse_list_field(candidate_profile.skills),
            parse_list_field(application.job.requirements),
        )
        if calculation_version != "invenia-job-ats-v3":
            job_ats = build_fast_job_ats_result(
                candidate_profile,
                candidate_user,
                application.job,
                current_match_score,
                previous_result=job_ats,
            )
    job_ats_score = safe_int(job_ats.get("score") or summary.get("jobAtsScore") or profile_ats_score or 0)

    workflow_state = get_application_workflow_state(application)
    if workflow_state:
        workflow_state["job_ats"] = job_ats
        workflow_state["ats_score"] = job_ats_score
        workflow_state["match_score"] = current_match_score
        score_calculation = build_overall_score_calculation(workflow_state)
        summary["scoreCalculation"] = score_calculation
        summary["overallScore"] = score_calculation["score"]
        summary["jobAts"] = job_ats
        summary["jobAtsScore"] = job_ats_score

    stage_scores = {
        "aptitude": stage_percentage(summary, "aptitude"),
        "technical": stage_percentage(summary, "technical"),
        "coding": stage_percentage(summary, "coding"),
        "interview": stage_percentage(summary, "interview"),
    }
    interview_summary = summary.get("interview") if isinstance(summary.get("interview"), dict) else {}
    stored_interview_report = load_json_field(application.interview_report, {}) if application.interview_report else {}
    stored_interview_turns = load_json_field(application.interview_turns, []) if application.interview_turns else []
    interview_report = interview_summary.get("report") or stored_interview_report or None
    interview_turns = interview_summary.get("turns") or stored_interview_turns or []
    interview_transcript = interview_summary.get("transcript") or application.interview_transcript or ""
    interview_recording_url = interview_summary.get("recordingUrl") or (
        "stored-interview-recording" if getattr(application, "interview_recording_content", None) else ""
    )
    interview_snapshot_url = interview_summary.get("snapshotUrl") or (
        "stored-interview-snapshot" if getattr(application, "interview_snapshot_content", None) else ""
    )
    completed_stage_scores = [score for score in stage_scores.values() if score is not None]
    assessment_average = safe_round_average(completed_stage_scores)
    interview_completed = stage_scores["interview"] is not None
    final_score = safe_int(summary.get("overallScore") or application.final_score) if interview_completed else None

    if (final_score or 0) >= 85 and job_ats_score >= 80:
        recruiter_decision = "Top priority"
    elif (final_score or 0) >= 72 or job_ats_score >= 75:
        recruiter_decision = "Strong review"
    elif (final_score or 0) >= 60 or job_ats_score >= 60:
        recruiter_decision = "Needs validation"
    else:
        recruiter_decision = "Low fit"

    decision_analysis = build_candidate_decision_analysis(
        job_ats,
        summary,
        stage_scores,
        safe_int(final_score),
        interview_report,
    )

    return {
        "applicationId": application.id,
        "candidateId": candidate_user.id if candidate_user else None,
        "candidateName": candidate_user.full_name if candidate_user and candidate_user.full_name else (candidate_user.username if candidate_user else "Candidate"),
        "candidatePhotoUrl": stored_profile_photo_url("candidate", candidate_user.id, candidate_profile) if candidate_user and candidate_profile else "",
        "candidateEmail": candidate_user.email if candidate_user else "",
        "candidatePhone": candidate_profile.phone if candidate_profile else "",
        "candidateLocation": candidate_profile.location if candidate_profile else "",
        "candidateTitle": candidate_profile.current_job_title if candidate_profile else "",
        "candidateExperienceYears": candidate_profile.experience_years if candidate_profile and candidate_profile.experience_years else 0,
        "candidateSkills": parse_list_field(candidate_profile.skills if candidate_profile else ""),
        "resumeUrl": application.resume_url or (candidate_profile.resume_url if candidate_profile else ""),
        "resumeName": application.resume_name or (candidate_profile.resume_name if candidate_profile else ""),
        "coverLetter": application.cover_letter or "",
        "jobId": application.job_id,
        "publicJobId": format_public_job_id(application.job) if application.job else "",
        "jobTitle": application.job.title if application.job else "",
        "status": application.status,
        "appliedDate": application.applied_at.isoformat() if application.applied_at else None,
        "profileAtsScore": profile_ats_score,
        "jobAtsScore": job_ats_score,
        "matchScore": current_match_score,
        "assessmentAverage": assessment_average,
        "finalScore": final_score,
        "stageScores": stage_scores,
        "interviewScore": stage_scores["interview"],
        "interviewReport": interview_report,
        "interviewTurns": interview_turns,
        "interviewTranscript": interview_transcript,
        "interviewRecordedAt": application.interview_recorded_at.isoformat() if application.interview_recorded_at else interview_summary.get("recordedAt"),
        "interviewRecordingUrl": interview_recording_url,
        "interviewSnapshotUrl": interview_snapshot_url,
        "workflowSummary": summary,
        "jobAts": job_ats,
        "recommendation": job_ats.get("recommendation") or recruiter_decision,
        "recruiterDecision": recruiter_decision,
        "decisionAnalysis": decision_analysis,
    }


def html_escape(value: Any) -> str:
    return html.escape("" if value is None else str(value))


def html_list(items: list[Any], empty_text: str) -> str:
    usable = [html_escape(item) for item in items if str(item or "").strip()]
    if not usable:
        return f"<p class='muted'>{html_escape(empty_text)}</p>"
    return "<ul>" + "".join(f"<li>{item}</li>" for item in usable) + "</ul>"


def inline_binary_response(content: bytes, filename: str, mime_type: Optional[str] = None) -> Response:
    media_type = mime_type or mimetypes.guess_type(filename or "")[0] or "application/octet-stream"
    suffix = Path(filename or "").suffix.lower()
    if suffix in {".doc", ".docx"} or media_type in {
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }:
        return word_document_preview_response(content, filename or "candidate-resume")
    safe_filename = (filename or "candidate-file").replace('"', "")
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{safe_filename}"'},
    )


def extract_document_text_from_bytes(content: bytes, filename: str = "") -> str:
    suffix = Path(filename or "").suffix.lower()
    try:
        if suffix == ".docx":
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                xml_text = archive.read("word/document.xml").decode("utf-8", errors="ignore")
            text = re.sub(r"<[^>]+>", " ", xml_text)
            return re.sub(r"\s+", " ", html.unescape(text)).strip()
        raw = content.decode("utf-8", errors="ignore") or content.decode("latin-1", errors="ignore")
        raw = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]+", " ", raw)
        return re.sub(r"\s+", " ", raw).strip()
    except Exception:
        return ""


def word_document_preview_response(content: bytes, filename: str) -> HTMLResponse:
    document_text = extract_document_text_from_bytes(content, filename)
    safe_filename = html_escape(filename or "Word CV")
    paragraphs = [
        paragraph.strip()
        for paragraph in re.split(r"(?<=[.!?])\s+|\n+", document_text)
        if paragraph.strip()
    ][:120]
    body = "\n".join(f"<p>{html_escape(paragraph)}</p>" for paragraph in paragraphs) or "<p class='muted'>Preview text could not be extracted from this Word document, but the uploaded file is stored safely.</p>"
    return HTMLResponse(
        content=f"""
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>{safe_filename} - Preview</title>
            <style>
              body {{ margin: 0; background: #eef4fb; color: #0f172a; font-family: 'Segoe UI', Arial, sans-serif; }}
              .shell {{ max-width: 980px; margin: 0 auto; padding: 32px 18px; }}
              .hero {{ border-radius: 28px; background: linear-gradient(135deg, #082f63, #0f63bd); color: white; padding: 28px; box-shadow: 0 22px 60px rgba(8, 47, 99, .2); }}
              .hero p {{ margin: 8px 0 0; color: #dbeafe; }}
              .doc {{ margin-top: 18px; border: 1px solid #dbeafe; background: #fff; border-radius: 28px; padding: 34px; box-shadow: 0 18px 48px rgba(15, 23, 42, .08); }}
              .doc p {{ margin: 0 0 14px; color: #334155; line-height: 1.75; }}
              .muted {{ color: #64748b; }}
              .badge {{ display:inline-flex; border-radius:999px; background:rgba(255,255,255,.14); padding:8px 12px; font-size:12px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; }}
            </style>
          </head>
          <body>
            <main class="shell">
              <section class="hero">
                <span class="badge">Word CV preview</span>
                <h1>{safe_filename}</h1>
                <p>This secure browser preview is generated from the uploaded Word document so recruiters and candidates do not receive a corrupted download.</p>
              </section>
              <section class="doc">{body}</section>
            </main>
          </body>
        </html>
        """,
        status_code=200,
    )


def csv_download_response(filename: str, rows: list[dict[str, Any]]) -> Response:
    output = io.StringIO()
    fieldnames = list(rows[0].keys()) if rows else ["message"]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in rows or [{"message": "No records found"}]:
        writer.writerow({key: row.get(key, "") for key in fieldnames})
    return Response(
        content=output.getvalue().encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def extract_json_object(text: str) -> dict[str, Any]:
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", (text or "").strip(), flags=re.IGNORECASE)
    for candidate in [cleaned, *re.findall(r"\{.*\}", cleaned, flags=re.DOTALL)]:
        try:
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            continue
    return {}


def call_system_autofill(
    prompt: str,
    text: str = "",
    file_bytes: Optional[bytes] = None,
    filename: str = "",
    response_schema: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    api_key = get_gemini_api_key()
    if not api_key:
        return {}
    source_text = ai_normalize_text(text)[:50000]
    parts: list[dict[str, Any]] = [{"text": f"{prompt}\n\nSOURCE TEXT:\n{source_text or 'No extractable text; inspect the attached source.'}"}]
    if file_bytes and filename and can_send_inline_to_gemini(Path(filename)):
        parts.append(
            {
                "inline_data": {
                    "mime_type": guess_resume_mime_type(Path(filename)),
                    "data": base64.b64encode(file_bytes).decode("ascii"),
                }
            }
        )

    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": 0.05,
            "maxOutputTokens": 4000,
            "responseMimeType": "application/json",
        },
    }
    if response_schema:
        payload["generationConfig"]["responseSchema"] = response_schema

    models = list(dict.fromkeys([get_gemini_model(), "gemini-2.5-flash"]))
    for model in models:
        try:
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                params={"key": api_key},
                json=payload,
                timeout=45,
            )
            response.raise_for_status()
            data = response.json()
            generated = "\n".join(
                part.get("text", "")
                for candidate in data.get("candidates", [])
                for part in candidate.get("content", {}).get("parts", [])
                if isinstance(part, dict)
            )
            parsed = extract_json_object(generated)
            if parsed:
                return parsed
        except Exception:
            continue
    return {}


JOB_AUTOFILL_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "location": {"type": "string"},
        "job_type": {"type": "string", "enum": ["Full-time", "Part-time", "Contract", "Internship", "Temporary", "NA"]},
        "experience_level": {"type": "string"},
        "salary_min": {"type": "integer"},
        "salary_max": {"type": "integer"},
        "salary_currency": {"type": "string"},
        "salary_period": {"type": "string", "enum": ["per day", "weekly", "monthly", "annually", "NA"]},
        "requirements": {"type": "array", "items": {"type": "string"}},
        "responsibilities": {"type": "array", "items": {"type": "string"}},
        "benefits": {"type": "array", "items": {"type": "string"}},
        "is_remote": {"type": "boolean"},
        "quality_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "warnings": {"type": "array", "items": {"type": "string"}},
        "field_confidence": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "field": {"type": "string"},
                    "confidence": {"type": "integer", "minimum": 0, "maximum": 100},
                    "evidence": {"type": "string"},
                },
                "required": ["field", "confidence", "evidence"],
            },
        },
    },
    "required": [
        "title", "description", "location", "job_type", "experience_level", "salary_min", "salary_max",
        "salary_currency", "salary_period", "requirements", "responsibilities", "benefits", "is_remote",
        "quality_score", "warnings", "field_confidence",
    ],
}


PROFILE_AUTOFILL_SCHEMA = {
    "type": "object",
    "properties": {
        "full_name": {"type": "string"},
        "phone": {"type": "string"},
        "location": {"type": "string"},
        "current_job_title": {"type": "string"},
        "current_company": {"type": "string"},
        "experience_years": {"type": "integer"},
        "skills": {"type": "array", "items": {"type": "string"}},
        "bio": {"type": "string"},
        "preferred_job_types": {"type": "array", "items": {"type": "string"}},
        "preferred_locations": {"type": "array", "items": {"type": "string"}},
        "salary_expectation": {"type": "string"},
        "linkedin_url": {"type": "string"},
        "github_url": {"type": "string"},
        "portfolio_url": {"type": "string"},
        "quality_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "warnings": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "full_name", "phone", "location", "current_job_title", "current_company", "experience_years", "skills",
        "bio", "preferred_job_types", "preferred_locations", "salary_expectation", "linkedin_url", "github_url",
        "portfolio_url", "quality_score", "warnings",
    ],
}


def normalize_autofill_value(value: Any, default: str = "NA") -> str:
    if value is None:
        return default
    if isinstance(value, list):
        joined = ", ".join(str(item).strip() for item in value if str(item).strip())
        return joined or default
    text = str(value).strip()
    return text or default


def normalize_autofill_multiline(value: Any, default: str = "NA") -> str:
    if isinstance(value, list):
        items = [ai_normalize_text(str(item)).strip(" -\t") for item in value if ai_normalize_text(str(item))]
        return "\n".join(dict.fromkeys(items)) or default
    text = str(value or "").strip()
    return text or default


def fallback_job_autofill(source_text: str) -> dict[str, Any]:
    lines = [line.strip(" -:\t") for line in (source_text or "").splitlines() if line.strip()]
    title = lines[0] if lines else "NA"
    skills = []
    for line in lines:
        if re.search(r"skill|requirement|technology|module", line, re.I):
            skills.extend([item.strip(" .") for item in re.split(r",|;|\||/", line) if len(item.strip()) > 2])
    return {
        "title": title[:120],
        "description": source_text.strip()[:3000] or "NA",
        "location": next((line for line in lines if re.search(r"location|remote|hybrid|onsite", line, re.I)), "NA"),
        "job_type": next((value for value in ["Full-time", "Part-time", "Contract", "Internship"] if re.search(value, source_text, re.I)), "Full-time"),
        "experience_level": next((line for line in lines if re.search(r"experience|senior|junior|lead|consultant", line, re.I)), "NA"),
        "salary_min": None,
        "salary_max": None,
        "salary_currency": "NA",
        "salary_period": "monthly",
        "requirements": ", ".join(skills[:18]) or "NA",
        "responsibilities": "NA",
        "benefits": "NA",
        "is_remote": bool(re.search(r"\bremote\b", source_text or "", re.I)),
    }


def fallback_profile_autofill(source_text: str) -> dict[str, Any]:
    lines = [line.strip(" -:\t") for line in (source_text or "").splitlines() if line.strip()]
    email_match = re.search(r"[\w.\-+]+@[\w.\-]+\.\w+", source_text or "")
    phone_match = re.search(r"(?:\+?\d[\d\s().-]{7,}\d)", source_text or "")
    skills_line = next((line for line in lines if re.search(r"skills|technologies|expertise", line, re.I)), "")
    years_match = re.search(r"(\d{1,2})\+?\s*(?:years|yrs)", source_text or "", re.I)
    return {
        "full_name": lines[0] if lines else "NA",
        "phone": phone_match.group(0).strip() if phone_match else "NA",
        "location": next((line for line in lines if re.search(r"location|address|india|germany|remote", line, re.I)), "NA"),
        "current_job_title": next((line for line in lines[1:8] if re.search(r"consultant|developer|engineer|manager|analyst|architect", line, re.I)), "NA"),
        "current_company": "NA",
        "experience_years": int(years_match.group(1)) if years_match else 0,
        "skills": normalize_autofill_value([item for item in re.split(r",|;|\||/", skills_line) if item.strip()]),
        "bio": (source_text or "NA")[:800],
        "preferred_job_types": "NA",
        "preferred_locations": "NA",
        "salary_expectation": "NA",
        "linkedin_url": next((line for line in lines if "linkedin.com" in line.lower()), "NA"),
        "github_url": next((line for line in lines if "github.com" in line.lower()), "NA"),
        "portfolio_url": "NA",
        "email": email_match.group(0) if email_match else "",
    }


def missing_file_response(filename: str, owner: str = "candidate") -> HTMLResponse:
    safe_name = html_escape(filename or "Uploaded file")
    content = f"""
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>File unavailable</title>
        <style>
          body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; color: #0f172a; font-family: 'Segoe UI', Arial, sans-serif; }}
          .card {{ width: min(680px, calc(100vw - 32px)); border: 1px solid #fecaca; background: white; border-radius: 28px; padding: 32px; box-shadow: 0 24px 70px rgba(15, 23, 42, .10); }}
          .pill {{ display: inline-flex; border-radius: 999px; background: #fff1f2; color: #be123c; padding: 8px 12px; font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }}
          h1 {{ margin: 18px 0 8px; font-size: 28px; }}
          p {{ color: #475569; line-height: 1.7; }}
          strong {{ color: #0f172a; }}
        </style>
      </head>
      <body>
        <main class="card">
          <span class="pill">Original file unavailable</span>
          <h1>CV file needs re-upload</h1>
          <p>The database has the file record <strong>{safe_name}</strong>, but the original binary is not available in the current Railway storage.</p>
          <p>Please ask the {html_escape(owner)} to upload the CV once again. New uploads are now stored in persistent Railway storage and in the database.</p>
        </main>
      </body>
    </html>
    """
    return HTMLResponse(content=content, status_code=404)


def generated_resume_preview(application: JobApplication) -> HTMLResponse:
    profile = application.candidate
    user = profile.user if profile and profile.user else None
    summary = get_workflow_summary_safely(application)
    job_ats = get_job_ats_from_summary(summary, profile.ats_score if profile else None)
    candidate_name = user.full_name if user and user.full_name else (user.username if user else "Candidate")
    job_title = application.job.title if application.job else "Applied role"
    skills = parse_list_field(profile.skills if profile else "")
    requirements = parse_list_field(application.job.requirements if application.job else "")
    matched = job_ats.get("matched_requirements") or []
    missing = job_ats.get("missing_requirements") or []
    strengths = job_ats.get("strengths") or []
    gaps = job_ats.get("gaps") or []
    resume_name = profile.resume_name if profile and profile.resume_name else Path(application.resume_url or "").name

    content = f"""
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{html_escape(candidate_name)} - CV Preview</title>
        <style>
          :root {{ color-scheme: light; font-family: 'Segoe UI', Arial, sans-serif; }}
          body {{ margin: 0; background: #f4f7fb; color: #0f172a; }}
          .page {{ max-width: 1040px; margin: 0 auto; padding: 34px; }}
          .hero {{ background: linear-gradient(135deg, #0f2a4a, #164f8f); color: #fff; border-radius: 28px; padding: 34px; box-shadow: 0 22px 60px rgba(15, 42, 74, .22); }}
          .eyebrow {{ margin: 0 0 10px; letter-spacing: .18em; text-transform: uppercase; color: #bfdbfe; font-size: 12px; font-weight: 800; }}
          h1 {{ margin: 0; font-size: 34px; line-height: 1.1; }}
          h2 {{ margin: 0 0 14px; font-size: 18px; }}
          .hero p {{ color: #dbeafe; }}
          .grid {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }}
          .card {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 22px; padding: 20px; box-shadow: 0 12px 34px rgba(15, 23, 42, .06); }}
          .metric {{ background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); border-radius: 18px; padding: 14px; }}
          .metric span {{ display:block; color:#bfdbfe; font-size:11px; letter-spacing:.14em; text-transform:uppercase; font-weight:800; }}
          .metric strong {{ display:block; margin-top:5px; font-size:22px; }}
          .section-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 18px; }}
          .muted {{ color: #64748b; }}
          .pill {{ display:inline-flex; margin:4px 6px 4px 0; padding:7px 11px; border-radius:999px; background:#eff6ff; color:#1d4ed8; font-size:12px; font-weight:700; }}
          ul {{ margin: 0; padding-left: 20px; color: #334155; line-height: 1.65; }}
          .notice {{ margin-top: 18px; border: 1px solid #fde68a; background: #fffbeb; color: #92400e; border-radius: 18px; padding: 14px 16px; font-size: 14px; }}
          @media (max-width: 820px) {{ .grid, .section-grid {{ grid-template-columns: 1fr; }} .page {{ padding: 18px; }} }}
        </style>
      </head>
      <body>
        <main class="page">
          <section class="hero">
            <p class="eyebrow">Invenia AI recruiter CV preview</p>
            <h1>{html_escape(candidate_name)}</h1>
            <p>{html_escape(profile.current_job_title if profile else "")} {("• " + html_escape(profile.location)) if profile and profile.location else ""}</p>
            <div class="grid">
              <div class="metric"><span>Applied Role</span><strong>{html_escape(job_title)}</strong></div>
              <div class="metric"><span>Job ATS</span><strong>{html_escape(job_ats.get("score", 0))}%</strong></div>
              <div class="metric"><span>Final Score</span><strong>{html_escape(get_released_final_score(get_application_workflow_state(application), application.final_score))}%</strong></div>
              <div class="metric"><span>Status</span><strong>{html_escape(application.status)}</strong></div>
            </div>
          </section>

          <div class="notice">
            Original uploaded file is not present in the current Railway container, so this preview is generated from stored application, profile, and AI analysis data.
            Filename recorded: <strong>{html_escape(resume_name or "Resume")}</strong>
          </div>

          <section class="section-grid">
            <div class="card">
              <h2>Candidate Details</h2>
              <p><strong>Email:</strong> {html_escape(user.email if user else "")}</p>
              <p><strong>Phone:</strong> {html_escape(profile.phone if profile else "")}</p>
              <p><strong>Experience:</strong> {html_escape(profile.experience_years if profile else 0)} years</p>
              <p><strong>LinkedIn:</strong> {html_escape(profile.linkedin_url if profile else "")}</p>
              <p><strong>Portfolio:</strong> {html_escape(profile.portfolio_url if profile else "")}</p>
            </div>
            <div class="card">
              <h2>Professional Summary</h2>
              <p class="muted">{html_escape(profile.bio if profile and profile.bio else "No profile summary was provided.")}</p>
            </div>
          </section>

          <section class="card" style="margin-top:18px">
            <h2>Skills</h2>
            {"".join(f"<span class='pill'>{html_escape(skill)}</span>" for skill in skills) or "<p class='muted'>No skills listed.</p>"}
          </section>

          <section class="section-grid">
            <div class="card">
              <h2>Job Requirements</h2>
              {html_list(requirements, "No job requirements listed.")}
            </div>
            <div class="card">
              <h2>Cover Letter</h2>
              <p class="muted">{html_escape(application.cover_letter or "No cover letter submitted.")}</p>
            </div>
          </section>

          <section class="section-grid">
            <div class="card">
              <h2>AI Matched Requirements</h2>
              {html_list(matched, "No matched requirements were listed.")}
            </div>
            <div class="card">
              <h2>AI Validation Points</h2>
              {html_list(missing or gaps, "No major missing requirement detected from stored analysis.")}
            </div>
          </section>

          <section class="section-grid">
            <div class="card">
              <h2>Strengths</h2>
              {html_list(strengths, "No strengths listed.")}
            </div>
            <div class="card">
              <h2>AI Recommendation</h2>
              <p class="muted">{html_escape(job_ats.get("summary") or "AI role-fit summary is pending.")}</p>
              <p><strong>{html_escape(job_ats.get("recommendation") or "Review candidate evidence before approval.")}</strong></p>
            </div>
          </section>
        </main>
      </body>
    </html>
    """
    return HTMLResponse(content=content)


def summarize_common_requirements(applications: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    counter: Counter[str] = Counter()
    for item in applications:
        for requirement in item.get("jobAts", {}).get(key, []) or []:
            counter[ai_normalize_text(str(requirement))] += 1
    return [{"text": text, "count": count} for text, count in counter.most_common(6)]


def build_job_analysis(job: JobPosting, applications: list[JobApplication]) -> dict[str, Any]:
    latest_by_candidate: dict[int, JobApplication] = {}
    for application in applications:
        existing = latest_by_candidate.get(application.candidate_id)
        current_applied_at = to_utc_datetime(application.applied_at) or datetime.min.replace(tzinfo=timezone.utc)
        existing_applied_at = to_utc_datetime(existing.applied_at) if existing else None
        existing_applied_at = existing_applied_at or datetime.min.replace(tzinfo=timezone.utc)
        if existing is None or current_applied_at > existing_applied_at:
            latest_by_candidate[application.candidate_id] = application
    applications = list(latest_by_candidate.values())

    candidates = []
    for application in applications:
        try:
            candidates.append(build_candidate_analysis_item(application))
        except Exception:
            workflow_state = get_application_workflow_state(application)
            candidate_profile = application.candidate
            candidate_user = candidate_profile.user if candidate_profile else None
            candidates.append(
                {
                    "applicationId": application.id,
                    "candidateId": candidate_user.id if candidate_user else None,
                    "candidateName": candidate_user.full_name if candidate_user and candidate_user.full_name else (candidate_user.username if candidate_user else "Candidate"),
                    "candidatePhotoUrl": stored_profile_photo_url("candidate", candidate_user.id, candidate_profile) if candidate_user and candidate_profile else "",
                    "candidateEmail": candidate_user.email if candidate_user else "",
                    "candidatePhone": candidate_profile.phone if candidate_profile else "",
                    "candidateLocation": candidate_profile.location if candidate_profile else "",
                    "candidateTitle": candidate_profile.current_job_title if candidate_profile else "",
                    "candidateExperienceYears": candidate_profile.experience_years if candidate_profile and candidate_profile.experience_years else 0,
                    "candidateSkills": parse_list_field(candidate_profile.skills if candidate_profile else ""),
                    "resumeUrl": application.resume_url or (candidate_profile.resume_url if candidate_profile else ""),
                    "resumeName": application.resume_name or (candidate_profile.resume_name if candidate_profile else ""),
                    "coverLetter": application.cover_letter or "",
                    "jobId": application.job_id,
                    "jobTitle": job.title,
                    "status": application.status,
                    "appliedDate": application.applied_at.isoformat() if application.applied_at else None,
                    "profileAtsScore": candidate_profile.ats_score if candidate_profile else None,
                    "jobAtsScore": safe_int(candidate_profile.ats_score if candidate_profile else 0),
                    "matchScore": safe_int(application.job_match_score),
                    "assessmentAverage": 0,
                    "finalScore": get_released_final_score(workflow_state, application.final_score),
                    "stageScores": {"aptitude": None, "technical": None, "coding": None, "interview": None},
                    "interviewScore": None,
                    "interviewReport": None,
                    "interviewTurns": [],
                    "interviewRecordingUrl": "",
                    "interviewSnapshotUrl": "",
                    "workflowSummary": {},
                    "jobAts": get_job_ats_from_summary({}, candidate_profile.ats_score if candidate_profile else None),
                    "recommendation": "Review manually",
                    "recruiterDecision": "Needs validation",
                }
            )
    candidates.sort(key=lambda item: (item.get("finalScore") or 0, item.get("jobAtsScore") or 0), reverse=True)
    ats_scores = [item["jobAtsScore"] for item in candidates if item.get("jobAtsScore") is not None]
    final_scores = [item["finalScore"] for item in candidates if item.get("finalScore") is not None]

    stage_performance = []
    for stage, label in [
        ("aptitude", "Aptitude"),
        ("technical", "Technical MCQ"),
        ("coding", "Coding"),
        ("interview", "AI Interview"),
    ]:
        stage_values = [item["stageScores"].get(stage) for item in candidates if item["stageScores"].get(stage) is not None]
        stage_performance.append(
            {
                "stage": label,
                "average": safe_round_average(stage_values),
                "completed": len(stage_values),
                "total": len(candidates),
            }
        )

    top_candidate = candidates[0] if candidates else None
    requirement_count = len(parse_list_field(job.requirements))
    avg_ats = safe_round_average(ats_scores)
    avg_final = safe_round_average(final_scores)
    if avg_ats >= 80:
        fit_summary = "Candidate pool is strongly aligned with this job."
    elif avg_ats >= 65:
        fit_summary = "Candidate pool has useful overlap, but some requirements need deeper validation."
    elif candidates:
        fit_summary = "Candidate pool needs careful screening because role-fit evidence is limited."
    else:
        fit_summary = "No candidates have applied yet, so role-fit intelligence is waiting for applications."

    return {
        "jobId": job.id,
        "publicJobId": format_public_job_id(job),
        "title": job.title,
        "status": "active" if job.is_active else "inactive",
        "location": "Remote" if job.is_remote else (job.location or "Location not specified"),
        "type": job.job_type or "Full-time",
        "experienceLevel": job.experience_level or "",
        "requirementsCount": requirement_count,
        "applicantCount": len(candidates),
        "avgJobAtsScore": avg_ats,
        "avgFinalScore": avg_final,
        "fitSummary": fit_summary,
        "demand": {
            "level": "High" if len(candidates) >= 10 else "Medium" if len(candidates) >= 4 else "Growing",
            "requirementsCount": requirement_count,
            "assessmentIntensity": len([stage for stage in ["aptitude", "technical", "coding"] if get_job_assessment_config(job)[stage].get("required")]) + 1,
            "remote": bool(job.is_remote),
        },
        "topCandidates": candidates[:5],
        "candidateComparison": candidates,
        "atsDistribution": score_distribution(ats_scores),
        "finalScoreDistribution": score_distribution(final_scores),
        "stagePerformance": stage_performance,
        "commonMatchedRequirements": summarize_common_requirements(candidates, "matched_requirements"),
        "commonMissingRequirements": summarize_common_requirements(candidates, "missing_requirements"),
        "recommendations": [
            top_candidate and f"Top candidate: {top_candidate['candidateName']} with {top_candidate['jobAtsScore']}% job ATS."
            or "Publish the role and wait for candidate ATS data.",
            "Use job ATS first for requirement fit, then validate with assessment and interview results.",
            "Review common missing requirements before shortlisting borderline candidates.",
        ],
    }


def build_recruiter_ai_insights(job_analysis: list[dict[str, Any]], candidate_comparison: list[dict[str, Any]]) -> dict[str, Any]:
    if not job_analysis:
        return {
            "summary": "No jobs are available in this analytics period.",
            "recommendations": ["Create or activate jobs to start collecting ATS and assessment intelligence."],
            "riskFlags": [],
        }

    top_jobs = sorted(job_analysis, key=lambda item: item.get("avgJobAtsScore") or 0, reverse=True)
    best_job = top_jobs[0]
    top_candidate = candidate_comparison[0] if candidate_comparison else None
    recommendations = [
        f"Prioritize {best_job['title']} because its average job ATS is {best_job['avgJobAtsScore']}%."
    ]
    if top_candidate:
        recommendations.append(
            f"Review {top_candidate['candidateName']} first for {top_candidate['jobTitle']} with {top_candidate['jobAtsScore']}% ATS and {top_candidate['finalScore']}% overall."
        )
    recommendations.append("Compare candidates job-wise instead of using profile ATS alone.")

    risk_flags = []
    low_fit_jobs = [job for job in job_analysis if job.get("applicantCount") and (job.get("avgJobAtsScore") or 0) < 60]
    if low_fit_jobs:
        risk_flags.append(f"{len(low_fit_jobs)} job(s) have low average requirement match.")
    stalled_jobs = [job for job in job_analysis if job.get("applicantCount") == 0]
    if stalled_jobs:
        risk_flags.append(f"{len(stalled_jobs)} job(s) have no applications in this period.")

    return {
        "summary": f"{len(job_analysis)} job(s) analyzed with {len(candidate_comparison)} candidate application report(s).",
        "recommendations": recommendations,
        "riskFlags": risk_flags,
    }


def get_period_start(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period in {"all", "history", "lifetime"}:
        return datetime.min.replace(tzinfo=timezone.utc)
    if period == "year":
        return now - timedelta(days=365)
    if period == "month":
        return now - timedelta(days=30)
    return now - timedelta(days=7)


def is_after_period(value: Optional[datetime], period_start: datetime) -> bool:
    if not value:
        return True
    compare_start = period_start
    value_is_aware = value.tzinfo is not None and value.tzinfo.utcoffset(value) is not None
    start_is_aware = compare_start.tzinfo is not None and compare_start.tzinfo.utcoffset(compare_start) is not None
    if value_is_aware and not start_is_aware:
        compare_start = compare_start.replace(tzinfo=timezone.utc)
    elif not value_is_aware and start_is_aware:
        compare_start = compare_start.replace(tzinfo=None)
    return value >= compare_start


def elapsed_days(start: Optional[datetime], end: Optional[datetime]) -> Optional[int]:
    if not start or not end:
        return None
    start_value = start
    end_value = end
    start_is_aware = start_value.tzinfo is not None and start_value.tzinfo.utcoffset(start_value) is not None
    end_is_aware = end_value.tzinfo is not None and end_value.tzinfo.utcoffset(end_value) is not None
    if start_is_aware and not end_is_aware:
        end_value = end_value.replace(tzinfo=timezone.utc)
    elif not start_is_aware and end_is_aware:
        end_value = end_value.replace(tzinfo=None)
    return (end_value - start_value).days


@router.get("/candidate/overview")
def get_candidate_overview(
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    applications = (
        db.query(JobApplication)
        .filter(JobApplication.candidate_id == profile.id)
        .all()
    )
    saved_jobs_count = db.query(SavedJob).filter(SavedJob.candidate_id == profile.id).count()
    application_ids = [application.id for application in applications]
    interviews_scheduled = 0
    if application_ids:
        interviews_scheduled = (
            db.query(Interview)
            .filter(Interview.application_id.in_(application_ids), Interview.status == "scheduled")
            .count()
        )

    offers_received = len(
        [application for application in applications if application.status in {"offer", "hired"}]
    )
    candidate_skills = parse_list_field(profile.skills)
    active_jobs = db.query(JobPosting).filter(JobPosting.is_active == True).all()
    match_scores = [
        calculate_match_score(candidate_skills, parse_list_field(job.requirements))
        for job in active_jobs[:10]
    ]
    average_match_score = round(sum(match_scores) / len(match_scores)) if match_scores else 0

    return {
        "stats": {
            "applicationsSubmitted": len(applications),
            "interviewsScheduled": interviews_scheduled,
            "offersReceived": offers_received,
            "savedJobs": saved_jobs_count,
            "profileCompletion": calculate_profile_completion(current_user, profile),
            "averageMatchScore": average_match_score,
        }
    }


@router.get("/candidate/jobs")
def get_candidate_jobs(
    search: Optional[str] = Query(None),
    filter_type: Optional[str] = Query("all"),
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    candidate_skills = parse_list_field(profile.skills)
    saved_job_ids = {
        saved.job_id
        for saved in db.query(SavedJob).filter(SavedJob.candidate_id == profile.id).all()
    }
    applied_job_ids = {
        application.job_id
        for application in db.query(JobApplication).filter(JobApplication.candidate_id == profile.id).all()
    }

    jobs_query = db.query(JobPosting).filter(JobPosting.is_active == True).order_by(JobPosting.created_at.desc())
    public_id_search = bool(search and search.strip().upper().startswith("INV-"))
    if search and not public_id_search:
        wildcard = f"%{search}%"
        jobs_query = jobs_query.filter(
            or_(
                JobPosting.title.ilike(wildcard),
                JobPosting.description.ilike(wildcard),
                JobPosting.location.ilike(wildcard),
            )
        )

    jobs = [
        serialize_job_for_candidate(job, candidate_skills, saved_job_ids, applied_job_ids)
        for job in jobs_query.all()
    ]
    if public_id_search:
        normalized_search = search.strip().upper()
        jobs = [job for job in jobs if normalized_search in job["publicJobId"].upper()]

    if filter_type == "saved":
        jobs = [job for job in jobs if job["isSaved"]]
    elif filter_type == "applied":
        jobs = [job for job in jobs if job["isApplied"]]

    return {"jobs": jobs}


@router.get("/candidate/jobs/{job_id}")
def get_candidate_job_details(
    job_id: int,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    saved_job_ids = {
        saved.job_id
        for saved in db.query(SavedJob).filter(SavedJob.candidate_id == profile.id).all()
    }
    applied_job_ids = {
        application.job_id
        for application in db.query(JobApplication).filter(JobApplication.candidate_id == profile.id).all()
    }
    if not job.is_active and job.id not in applied_job_ids:
        raise HTTPException(status_code=404, detail="This job is no longer available")
    serialized_job = serialize_job_for_candidate(
        job,
        parse_list_field(profile.skills),
        saved_job_ids,
        applied_job_ids,
    )
    serialized_job["isActive"] = bool(job.is_active)
    serialized_job["availabilityMessage"] = (
        "This role is closed. Existing applicants can still review their application history."
        if not job.is_active
        else ""
    )
    return {
        "job": serialized_job
    }


@router.post("/candidate/jobs/{job_id}/view")
def track_candidate_job_view(
    job_id: int,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.is_active == True).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    job.view_count = int(getattr(job, "view_count", None) or 0) + 1
    db.commit()
    db.refresh(job)
    return {"jobId": job.id, "views": int(job.view_count or 0)}


@router.get("/candidate/applications")
def get_candidate_applications(
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    applications = (
        db.query(JobApplication)
        .filter(JobApplication.candidate_id == profile.id)
        .order_by(JobApplication.applied_at.desc())
        .all()
    )
    interviews = {}
    application_ids = [application.id for application in applications]
    if application_ids:
        interviews = {
            interview.application_id: interview
            for interview in db.query(Interview)
            .filter(Interview.application_id.in_(application_ids))
            .all()
        }

    items = []
    for application in applications:
        job = application.job
        recruiter_profile = job.recruiter
        interview = interviews.get(application.id)
        workflow_state = get_application_workflow_state(application)
        workflow_summary = get_workflow_summary_safely(application) if application.workflow_state else {}
        workflow_stage = workflow_state.get("current_stage") or application.workflow_stage or "profile"
        effective_status = "revoked" if application.status == "revoked" or workflow_stage == "revoked" else application.status
        completed = workflow_stage == "completed" or bool(workflow_state.get("completed"))
        job_active = bool(job.is_active)
        can_start_assessment = (
            effective_status in ASSESSMENT_UNLOCK_STATUSES
            and workflow_stage not in {"completed", "revoked"}
            and job_active
        )
        can_withdraw = effective_status not in {"revoked", "rejected", "hired"} and not completed
        if effective_status == "revoked":
            next_step = "Application withdrawn. This decision is final and this job cannot be applied to again."
        elif completed:
            next_step = "Assessment completed. View your result while recruiter review continues."
        elif not job_active:
            next_step = "This role is closed. Your application history remains available, but no further round can be started."
        else:
            next_step = application_next_step(effective_status, interview)
        items.append(
            {
                "id": application.id,
                "jobId": job.id,
                "publicJobId": format_public_job_id(job),
                "jobTitle": job.title,
                "company": recruiter_profile.company_name if recruiter_profile else "Invenia AI",
                "status": effective_status,
                "appliedDate": application.applied_at.isoformat() if application.applied_at else None,
                "updatedAt": application.updated_at.isoformat() if application.updated_at else None,
                "nextStep": next_step,
                "matchScore": calculate_match_score(
                    parse_list_field(profile.skills),
                    parse_list_field(job.requirements),
                ),
                "resumeUrl": application.resume_url,
                "workflowStage": workflow_stage,
                "finalScore": get_released_final_score(workflow_state, application.final_score),
                "finalScoreStatus": "available" if completed else "awaiting-assessment",
                "canStartAssessment": can_start_assessment,
                "canViewResult": completed,
                "canWithdraw": can_withdraw,
                "jobActive": job_active,
                "assessmentAvailability": "available" if can_start_assessment else "completed" if completed else "closed" if not job_active else "locked",
                "screening": workflow_summary.get("screening") or {},
            }
        )
    return {"applications": items}


@router.get("/candidate/jobs/{job_id}/application-workflow")
def get_candidate_job_workflow_preview(
    job_id: int,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    existing = (
        db.query(JobApplication)
        .filter(JobApplication.job_id == job.id, JobApplication.candidate_id == profile.id)
        .first()
    )
    if not job.is_active and existing is None:
        raise HTTPException(status_code=404, detail="This job is no longer accepting applications")
    if job.is_active:
        job.view_count = int(getattr(job, "view_count", None) or 0) + 1
        db.commit()
        db.refresh(job)
    if existing:
        workflow_state = get_application_workflow_state(existing)
        if not workflow_state:
            workflow_state = ensure_application_workflow(db, existing, current_user, profile)
        completed = workflow_state.get("current_stage") == "completed" or bool(workflow_state.get("completed"))
        return {
            "applicationId": existing.id,
            "canApply": False,
            "alreadyApplied": True,
            "status": existing.status,
            "jobActive": bool(job.is_active),
            "assessmentClosed": not job.is_active and not completed,
            "availabilityMessage": "This role is closed. Your saved application and completed result remain available, but new assessment activity is disabled." if not job.is_active else "",
            "workflow": serialize_workflow_for_candidate(workflow_state),
        }

    assessment_config = get_job_assessment_config(job)
    match_score = calculate_match_score(parse_list_field(profile.skills), parse_list_field(job.requirements))
    job_ats_result = {}
    if profile.resume_url:
        try:
            job_ats_result = recompute_application_job_ats(profile, current_user, job)
        except Exception:
            job_ats_result = build_fast_job_ats_result(profile, current_user, job, match_score)
    job_ats_score = safe_int(job_ats_result.get("score"), match_score)
    return {
        "applicationId": None,
        "canApply": True,
        "alreadyApplied": False,
        "workflow": {
            "currentStage": "profile",
            "job": build_job_snapshot(job),
            "profile": build_candidate_profile_snapshot(current_user, profile),
            "atsScore": job_ats_score,
            "profileAtsScore": profile.ats_score,
            "jobAtsScore": job_ats_score,
            "jobAts": job_ats_result,
            "matchScore": match_score,
            "assessment": {
                "aptitude": {
                    "enabled": assessment_config["aptitude"].get("enabled", True),
                    "required": assessment_config["aptitude"]["required"],
                    "questionCount": assessment_config["aptitude"]["question_count"],
                    "durationMinutes": assessment_config["aptitude"]["duration_minutes"],
                    "mode": assessment_config["aptitude"]["mode"],
                },
                "technical": {
                    "enabled": assessment_config["technical"].get("enabled", True),
                    "required": assessment_config["technical"]["required"],
                    "questionCount": assessment_config["technical"]["question_count"],
                    "durationMinutes": assessment_config["technical"]["duration_minutes"],
                    "mode": assessment_config["technical"]["mode"],
                },
                "coding": {
                    "enabled": assessment_config["coding"].get("enabled", True),
                    "required": assessment_config["coding"]["required"],
                    "questionCount": assessment_config["coding"]["question_count"],
                },
                "interview": {
                    "required": assessment_config["interview"]["required"],
                    "questionCount": assessment_config["interview"]["question_count"],
                    "durationMinutes": assessment_config["interview"]["duration_minutes"],
                },
            },
            "aptitude": {
                "enabled": assessment_config["aptitude"].get("enabled", True),
                "required": assessment_config["aptitude"]["required"],
                "cutoff": assessment_config["aptitude"]["cutoff"],
                "durationMinutes": assessment_config["aptitude"]["duration_minutes"],
                "questionCount": assessment_config["aptitude"]["question_count"],
                "mode": assessment_config["aptitude"]["mode"],
            },
            "technical": {
                "enabled": assessment_config["technical"].get("enabled", True),
                "required": assessment_config["technical"]["required"],
                "cutoff": assessment_config["technical"]["cutoff"],
                "durationMinutes": assessment_config["technical"]["duration_minutes"],
                "questionCount": assessment_config["technical"]["question_count"],
                "mode": assessment_config["technical"]["mode"],
            },
            "coding": {
                "enabled": assessment_config["coding"].get("enabled", True),
                "required": assessment_config["coding"]["required"],
                "questionCount": assessment_config["coding"]["question_count"],
            },
            "interview": {
                "required": assessment_config["interview"]["required"],
                "durationMinutes": assessment_config["interview"]["duration_minutes"],
                "questionCount": assessment_config["interview"]["question_count"],
            },
        },
    }


@router.post("/candidate/apply")
def apply_to_job(
    payload: JobApplicationCreate,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    job = db.query(JobPosting).filter(JobPosting.id == payload.job_id, JobPosting.is_active == True).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if not profile.resume_url:
        raise HTTPException(status_code=400, detail="Upload your resume before starting the application flow")

    existing = (
        db.query(JobApplication)
        .filter(JobApplication.job_id == job.id, JobApplication.candidate_id == profile.id)
        .first()
    )
    if existing:
        workflow_state = get_application_workflow_state(existing)
        if not workflow_state:
            workflow_state = ensure_application_workflow(db, existing, current_user, profile)
        return {
            "message": "You have already applied to this job. Please check your Applied tab for the current status.",
            "application_id": existing.id,
            "already_applied": True,
            "canApply": False,
            "status": existing.status,
            "workflow": serialize_workflow_for_candidate(workflow_state),
        }

    match_score = calculate_match_score(parse_list_field(profile.skills), parse_list_field(job.requirements))
    try:
        job_ats_result = recompute_application_job_ats(profile, current_user, job)
    except Exception:
        job_ats_result = build_fast_job_ats_result(profile, current_user, job, match_score)
    workflow_state = build_locked_application_workflow(
        job,
        profile,
        current_user,
        match_score,
        payload.cover_letter or "",
        job_ats_result,
    )

    application = JobApplication(
        job_id=job.id,
        candidate_id=profile.id,
        cover_letter=payload.cover_letter,
        resume_url=profile.resume_url,
        resume_name=profile.resume_name,
        resume_content=profile.resume_content,
        resume_mime_type=profile.resume_mime_type,
        status="pending",
        job_match_score=match_score,
        workflow_stage="screening",
        workflow_state=dump_json_field(workflow_state),
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    return {
        "message": "Your application is sent to the recruiter for verification. Please wait for approval before starting the next round.",
        "application_id": application.id,
        "already_applied": False,
        "canApply": False,
        "status": application.status,
        "workflow": serialize_workflow_for_candidate(workflow_state),
    }


@router.get("/candidate/applications/{application_id}/workflow")
def get_candidate_application_workflow(
    application_id: int,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    application = (
        db.query(JobApplication)
        .filter(JobApplication.id == application_id, JobApplication.candidate_id == profile.id)
        .first()
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")

    workflow_state = ensure_application_workflow(db, application, current_user, profile)

    return {
        "applicationId": application.id,
        "status": application.status,
        "workflow": serialize_workflow_for_candidate(workflow_state),
    }


@router.post("/candidate/applications/{application_id}/revoke")
def revoke_candidate_application(
    application_id: int,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    application = (
        db.query(JobApplication)
        .filter(JobApplication.id == application_id, JobApplication.candidate_id == profile.id)
        .first()
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.status == "revoked":
        return {"message": "Application is already revoked", "applicationId": application.id, "status": application.status}

    workflow_state = get_application_workflow_state(application)
    workflow_state["current_stage"] = "revoked"
    workflow_state["revoked"] = {
        "revoked_at": datetime.utcnow().isoformat(),
        "message": "Candidate revoked the application. Re-applying to this job is disabled.",
    }
    set_application_workflow_state(application, workflow_state)
    application.status = "revoked"
    db.commit()
    db.refresh(application)
    return {
        "message": "Application revoked successfully. You cannot apply to this job again.",
        "applicationId": application.id,
        "status": application.status,
    }


@router.post("/candidate/applications/{application_id}/workflow-stage")
def submit_candidate_application_stage(
    application_id: int,
    payload: ApplicationWorkflowStageSubmit,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    application = (
        db.query(JobApplication)
        .filter(JobApplication.id == application_id, JobApplication.candidate_id == profile.id)
        .first()
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")

    workflow_state = ensure_application_workflow(db, application, current_user, profile)

    stage = (payload.stage or "").strip().lower()
    if stage not in {"aptitude", "technical", "coding", "interview"}:
        raise HTTPException(status_code=400, detail="Unsupported workflow stage")
    if not application.job.is_active and workflow_state.get("current_stage") != "completed":
        raise HTTPException(
            status_code=409,
            detail="This role has been closed by the recruiter. Your saved application remains visible, but further assessment activity is disabled.",
        )
    if application.status not in ASSESSMENT_UNLOCK_STATUSES and workflow_state.get("current_stage") not in {"completed"}:
        raise HTTPException(
            status_code=403,
            detail="Your application is waiting for recruiter verification. You can start the next round after approval.",
        )
    if not is_workflow_stage_enabled(workflow_state, stage):
        raise HTTPException(status_code=400, detail=f"{stage.title()} round is not enabled for this job")

    stage_config = get_workflow_stage_config(workflow_state, stage)
    stage_required = bool(stage_config.get("required", True))
    skipped = bool(payload.skipped)

    if stage == "aptitude":
        if skipped:
            if stage_required:
                raise HTTPException(status_code=400, detail="Aptitude test is compulsory for this job")
            workflow_state["aptitude"]["skipped"] = True
            workflow_state["aptitude"]["selected_answers"] = []
            workflow_state["aptitude"]["score"] = None
            workflow_state["aptitude"]["percentage"] = None
            workflow_state["aptitude"]["passed"] = None
            workflow_state["aptitude"]["submitted_at"] = datetime.utcnow().isoformat()
            workflow_state["current_stage"] = get_next_workflow_stage(workflow_state, "aptitude")
        else:
            result = calculate_mcq_result(
                workflow_state["aptitude"]["questions"],
                payload.answers or [],
                int(workflow_state["aptitude"]["cutoff"]),
            )
            workflow_state["aptitude"]["selected_answers"] = payload.answers or []
            workflow_state["aptitude"]["score"] = result["score"]
            workflow_state["aptitude"]["percentage"] = result["percentage"]
            workflow_state["aptitude"]["passed"] = result["passed"]
            workflow_state["aptitude"]["submitted_at"] = datetime.utcnow().isoformat()
            workflow_state["aptitude"]["skipped"] = False
            if result["passed"] or not stage_required:
                workflow_state["current_stage"] = get_next_workflow_stage(workflow_state, "aptitude")
            else:
                workflow_state["current_stage"] = "aptitude"
    elif stage == "technical":
        if is_workflow_stage_enabled(workflow_state, "aptitude") and workflow_state["aptitude"].get("required", True) and workflow_state["aptitude"].get("passed") is False and not workflow_state["aptitude"].get("skipped"):
            raise HTTPException(status_code=400, detail="Clear the aptitude round before moving forward")
        if skipped:
            if stage_required:
                raise HTTPException(status_code=400, detail="Technical test is compulsory for this job")
            workflow_state["technical"]["skipped"] = True
            workflow_state["technical"]["selected_answers"] = []
            workflow_state["technical"]["score"] = None
            workflow_state["technical"]["percentage"] = None
            workflow_state["technical"]["passed"] = None
            workflow_state["technical"]["submitted_at"] = datetime.utcnow().isoformat()
            workflow_state["current_stage"] = get_next_workflow_stage(workflow_state, "technical")
        else:
            result = calculate_mcq_result(
                workflow_state["technical"]["questions"],
                payload.answers or [],
                int(workflow_state["technical"]["cutoff"]),
            )
            workflow_state["technical"]["selected_answers"] = payload.answers or []
            workflow_state["technical"]["score"] = result["score"]
            workflow_state["technical"]["percentage"] = result["percentage"]
            workflow_state["technical"]["passed"] = result["passed"]
            workflow_state["technical"]["submitted_at"] = datetime.utcnow().isoformat()
            workflow_state["technical"]["skipped"] = False
            if result["passed"] or not stage_required:
                workflow_state["current_stage"] = get_next_workflow_stage(workflow_state, "technical")
            else:
                workflow_state["current_stage"] = "technical"
    elif stage == "coding":
        if is_workflow_stage_enabled(workflow_state, "technical") and workflow_state["technical"].get("required", True) and workflow_state["technical"].get("passed") is False and not workflow_state["technical"].get("skipped"):
            raise HTTPException(status_code=400, detail="Clear the technical round before moving forward")
        if skipped:
            if stage_required:
                raise HTTPException(status_code=400, detail="Coding round is compulsory for this job")
            workflow_state["coding"]["skipped"] = True
            workflow_state["coding"]["answers"] = []
            workflow_state["coding"]["score"] = None
            workflow_state["coding"]["feedback"] = "Skipped by candidate"
            workflow_state["coding"]["submitted_at"] = datetime.utcnow().isoformat()
        else:
            coding_result = evaluate_coding_answers(
                workflow_state["coding"]["questions"],
                payload.coding_answers or [],
                parse_list_field(profile.skills),
            )
            workflow_state["coding"]["answers"] = payload.coding_answers or []
            workflow_state["coding"]["score"] = coding_result["score"]
            workflow_state["coding"]["feedback"] = coding_result["feedback"]
            workflow_state["coding"]["submitted_at"] = datetime.utcnow().isoformat()
            workflow_state["coding"]["skipped"] = False
        workflow_state["current_stage"] = get_next_workflow_stage(workflow_state, "coding")
        if not workflow_state["interview"].get("current_question"):
            next_question = generate_interview_questions(
                workflow_state["job"].get("title", ""),
                workflow_state["job"].get("description", ""),
                workflow_state["job"].get("requirements", []),
                [],
                workflow_state.get("assessment_session_id"),
                0,
            )
            replace_interview_question(workflow_state, next_question)
    elif stage == "interview":
        if skipped:
            raise HTTPException(status_code=400, detail="AI interview is compulsory for this job")

        interview_state = workflow_state["interview"]
        interview_state["proctoring"] = payload.proctoring or interview_state.get("proctoring") or {"warnings": 0, "events": []}
        interview_state["notes"] = payload.interview_notes or interview_state.get("notes") or ""
        interview_answer = (payload.interview_answer or "").strip()
        legacy_answers = payload.interview_answers or []

        if legacy_answers and not interview_answer:
            interview_result = evaluate_interview_answers(legacy_answers, interview_state["proctoring"])
            interview_state["answers"] = legacy_answers
            interview_state["turns"] = [
                {
                    "turn": index + 1,
                    "question": question.get("prompt", ""),
                    "answer": legacy_answers[index] if index < len(legacy_answers) else "",
                    "submitted_at": datetime.utcnow().isoformat(),
                }
                for index, question in enumerate(interview_state.get("questions") or [])
            ]
            interview_state["score"] = interview_result["score"]
            interview_state["feedback"] = interview_result["feedback"]
            interview_state["submitted_at"] = datetime.utcnow().isoformat()
            interview_state["report"] = {
                "overall_score": interview_result["score"],
                "summary": interview_result["feedback"],
                "decision": "review",
                "strengths": [],
                "gaps": [],
                "risk_flags": [],
                "question_analysis": [],
                "recommendations": [],
                "proctoring_summary": f"Recorded {int(interview_state['proctoring'].get('warnings') or 0)} proctoring warnings.",
            }
            workflow_state["current_stage"] = "completed"
            workflow_state["completed"] = True
            workflow_state["overall_score"] = calculate_overall_workflow_score(workflow_state)
            application.status = "reviewed" if application.status in {"pending", "approved"} else application.status
        else:
            if not interview_answer:
                raise HTTPException(status_code=400, detail="Interview answer is required")

            current_question = interview_state.get("current_question") or {}
            turn_index = int(interview_state.get("turn_index") or 0)
            turn_history = build_interview_turn_history(workflow_state)
            interview_state.setdefault("turns", []).append(
                {
                    "turn": turn_index + 1,
                    "question": current_question.get("prompt", ""),
                    "answer": interview_answer,
                    "submitted_at": datetime.utcnow().isoformat(),
                    "question_id": current_question.get("id", f"interview-{turn_index + 1}"),
                }
            )
            interview_state.setdefault("answers", []).append(interview_answer)
            interview_state["transcript"] = ai_normalize_text(
                "\n".join(
                    [
                        f"Q{item['turn']}: {item['question']}\nA{item['turn']}: {item['answer']}"
                        for item in interview_state["turns"]
                    ]
                )
            )
            interview_state["submitted_at"] = datetime.utcnow().isoformat()

            next_turn_index = turn_index + 1
            max_questions = int(interview_state.get("max_questions") or 3)
            if next_turn_index >= max_questions:
                recording_meta = {
                    "recording_url": interview_state.get("recording_url") or "",
                    "snapshot_url": interview_state.get("snapshot_url") or "",
                }
                report = analyze_interview_report(
                    workflow_state["job"].get("title", ""),
                    workflow_state["job"].get("description", ""),
                    workflow_state["job"].get("requirements", []),
                    interview_state["turns"],
                    interview_state.get("proctoring"),
                    recording_meta,
                )
                interview_state["report"] = report
                interview_state["score"] = report.get("overall_score", 0)
                interview_state["feedback"] = report.get("summary", "")
                workflow_state["current_stage"] = "completed"
                workflow_state["completed"] = True
                workflow_state["overall_score"] = calculate_overall_workflow_score(workflow_state)
                application.status = "reviewed" if application.status == "pending" else application.status
            else:
                next_question = generate_interview_questions(
                    workflow_state["job"].get("title", ""),
                    workflow_state["job"].get("description", ""),
                    workflow_state["job"].get("requirements", []),
                    turn_history + [{"question": current_question.get("prompt", ""), "answer": interview_answer}],
                    workflow_state.get("assessment_session_id"),
                    next_turn_index,
                )
                interview_state["turn_index"] = next_turn_index
                replace_interview_question(workflow_state, next_question)
                workflow_state["current_stage"] = "interview"

    if stage in {"aptitude", "technical"} and not workflow_state.get("overall_score"):
        workflow_state["overall_score"] = calculate_overall_workflow_score(workflow_state)

    if stage == "coding" and not workflow_state.get("overall_score"):
        workflow_state["overall_score"] = calculate_overall_workflow_score(workflow_state)

    if workflow_state.get("current_stage") == "completed" and not workflow_state.get("overall_score"):
        workflow_state["overall_score"] = calculate_overall_workflow_score(workflow_state)

    set_application_workflow_state(application, workflow_state)
    application.job_match_score = workflow_state.get("match_score")
    db.commit()
    db.refresh(application)

    return {
        "message": "Stage submitted successfully",
        "applicationId": application.id,
        "status": application.status,
        "workflow": serialize_workflow_for_candidate(workflow_state),
    }


@router.post("/candidate/applications/{application_id}/interview-recording")
async def upload_candidate_interview_recording(
    application_id: int,
    request: Request,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    application = (
        db.query(JobApplication)
        .filter(JobApplication.id == application_id, JobApplication.candidate_id == profile.id)
        .first()
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")

    form = await request.form(max_part_size=MAX_INTERVIEW_UPLOAD_BYTES)
    recording = form.get("recording")
    snapshot = form.get("snapshot")
    transcript = form.get("transcript") or ""
    proctoring = load_json_field(form.get("proctoring"), {"warnings": 0, "events": []})
    report = load_json_field(form.get("report"), None)

    workflow_state = ensure_application_workflow(db, application, current_user, profile)
    interview_state = workflow_state["interview"]

    if recording is not None and hasattr(recording, "read"):
        suffix = Path(getattr(recording, "filename", "") or "recording.webm").suffix or ".webm"
        filename = f"{application.id}_{uuid.uuid4().hex}{suffix}"
        recording_path = INTERVIEW_RECORDINGS_DIR / filename
        recording_bytes = await recording.read()
        if len(recording_bytes) > MAX_INTERVIEW_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Interview recording is too large")
        recording_path.write_bytes(recording_bytes)
        application.interview_recording_content = recording_bytes
        application.interview_recording_name = getattr(recording, "filename", None) or filename
        application.interview_recording_mime_type = getattr(recording, "content_type", None) or "video/webm"
        interview_state["recording_url"] = f"/uploads/interviews/recordings/{filename}"
        application.interview_recorded_at = datetime.utcnow()

    if snapshot is not None and hasattr(snapshot, "read"):
        suffix = Path(getattr(snapshot, "filename", "") or "snapshot.png").suffix or ".png"
        filename = f"{application.id}_{uuid.uuid4().hex}{suffix}"
        snapshot_path = INTERVIEW_SNAPSHOTS_DIR / filename
        snapshot_bytes = await snapshot.read()
        if len(snapshot_bytes) > MAX_INTERVIEW_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Interview snapshot is too large")
        snapshot_path.write_bytes(snapshot_bytes)
        application.interview_snapshot_content = snapshot_bytes
        application.interview_snapshot_name = getattr(snapshot, "filename", None) or filename
        application.interview_snapshot_mime_type = getattr(snapshot, "content_type", None) or "image/png"
        interview_state["snapshot_url"] = f"/uploads/interviews/snapshots/{filename}"
        if not application.interview_recorded_at:
            application.interview_recorded_at = datetime.utcnow()

    if transcript:
        interview_state["transcript"] = transcript
    application.interview_transcript = transcript or interview_state.get("transcript") or ""
    application.interview_turns = dump_json_field(interview_state.get("turns") or [])
    if isinstance(proctoring, dict):
        interview_state["proctoring"] = proctoring
    if isinstance(report, dict):
        interview_state["report"] = report
        application.interview_report = dump_json_field(report)
        if report.get("overall_score") is not None:
            interview_state["score"] = int(report.get("overall_score") or 0)
        if report.get("summary"):
            interview_state["feedback"] = report.get("summary")
    elif application.interview_report is None:
        application.interview_report = dump_json_field(interview_state.get("report") or {})
    if not application.interview_recorded_at and (
        application.interview_transcript
        or application.interview_turns
        or application.interview_report
        or application.interview_recording_content
        or application.interview_snapshot_content
    ):
        application.interview_recorded_at = datetime.utcnow()

    workflow_state["interview"] = interview_state
    set_application_workflow_state(application, workflow_state)
    db.commit()
    db.refresh(application)

    return {
        "message": "Interview media uploaded successfully",
        "applicationId": application.id,
        "workflow": serialize_workflow_for_candidate(workflow_state),
    }


@router.post("/candidate/save-job")
def save_job(
    payload: JobActionRequest,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    job = db.query(JobPosting).filter(JobPosting.id == payload.job_id, JobPosting.is_active == True).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    saved = (
        db.query(SavedJob)
        .filter(SavedJob.candidate_id == profile.id, SavedJob.job_id == payload.job_id)
        .first()
    )
    if saved:
        db.delete(saved)
        db.commit()
        return {"message": "Job removed from saved list", "saved": False}

    saved = SavedJob(candidate_id=profile.id, job_id=payload.job_id)
    db.add(saved)
    db.commit()
    return {"message": "Job saved successfully", "saved": True}


@router.get("/profile-photos/{role}/{user_id}")
def get_profile_photo(role: str, user_id: int, db: Session = Depends(get_db)):
    if role == "candidate":
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
    elif role == "recruiter":
        profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
    else:
        raise HTTPException(status_code=404, detail="Profile photo not found")
    if profile is None or not profile.photo_content:
        raise HTTPException(status_code=404, detail="Profile photo not found")
    return Response(
        content=profile.photo_content,
        media_type=profile.photo_mime_type or "image/jpeg",
        headers={"Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"},
    )


@router.post("/candidate/upload-photo")
async def upload_candidate_photo(
    request: Request,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    file_bytes, mime_type = await read_profile_photo_upload(request)
    profile = ensure_candidate_profile(db, current_user)
    version = uuid.uuid4().hex
    profile.photo_content = file_bytes
    profile.photo_mime_type = mime_type
    profile.photo_url = f"/api/dashboard/profile-photos/candidate/{current_user.id}?v={version}"
    db.commit()
    db.refresh(profile)
    return {"message": "Profile photo updated successfully", "profile": serialize_candidate_profile(current_user, profile)}


@router.get("/candidate/profile")
def get_candidate_profile(
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    return {"profile": serialize_candidate_profile(current_user, profile)}


@router.get("/candidate/resume")
def get_candidate_resume(
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    if profile.resume_content:
        return inline_binary_response(
            profile.resume_content,
            profile.resume_name or Path(profile.resume_url or "candidate-resume").name,
            profile.resume_mime_type,
        )
    resume_path = ensure_profile_resume_file(profile)
    if resume_path and resume_path.exists() and resume_path.is_file():
        return inline_binary_response(
            resume_path.read_bytes(),
            profile.resume_name or resume_path.name,
            mimetypes.guess_type(profile.resume_name or resume_path.name)[0],
        )
    return missing_file_response(profile.resume_name or Path(profile.resume_url or "").name, owner="candidate")


@router.get("/candidate/applications/{application_id}/resume")
def get_candidate_application_resume(
    application_id: int,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    application = (
        db.query(JobApplication)
        .filter(JobApplication.id == application_id, JobApplication.candidate_id == profile.id)
        .first()
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")

    if application.resume_content:
        return inline_binary_response(
            application.resume_content,
            application.resume_name or Path(application.resume_url or "submitted-resume").name,
            application.resume_mime_type,
        )
    resume_path = ensure_application_resume_file(application, profile)
    if resume_path and resume_path.exists() and resume_path.is_file():
        return inline_binary_response(
            resume_path.read_bytes(),
            application.resume_name or profile.resume_name or resume_path.name,
            mimetypes.guess_type(application.resume_name or profile.resume_name or resume_path.name)[0],
        )
    return missing_file_response(application.resume_name or profile.resume_name or Path(application.resume_url or "").name, owner="candidate")


@router.put("/candidate/profile")
def update_candidate_profile(
    payload: CandidateDashboardProfileUpdate,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    data = payload.model_dump(exclude_unset=True)

    full_name = data.pop("full_name", None)
    if full_name is not None:
        current_user.full_name = full_name

    for list_field in ("skills", "preferred_job_types", "preferred_locations"):
        if list_field in data and isinstance(data[list_field], list):
            data[list_field] = dump_list_field(data[list_field])

    for field, value in data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(current_user)
    db.refresh(profile)
    return {"message": "Profile updated successfully", "profile": serialize_candidate_profile(current_user, profile)}


@router.post("/candidate/profile/ats")
def check_candidate_ats_score(
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    if not profile.resume_url:
        raise HTTPException(status_code=400, detail="Upload your resume before checking your ATS score")

    ats_result = persist_candidate_ats(db, profile, current_user)
    return {
        "message": "ATS score calculated successfully",
        "ats": ats_result,
        "profile": serialize_candidate_profile(current_user, profile),
    }


@router.post("/candidate/upload-resume")
async def upload_resume(
    request: Request,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    form = await request.form(max_part_size=MAX_RESUME_UPLOAD_BYTES)
    file = form.get("file")
    if file is None or not hasattr(file, "filename") or not hasattr(file, "read"):
        raise HTTPException(status_code=400, detail="Resume file is required")

    allowed_extensions = {".pdf", ".doc", ".docx"}
    extension = Path(file.filename or "").suffix.lower()
    if extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Only PDF, DOC, and DOCX files are allowed")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_RESUME_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Resume is too large. Please upload a file under 8 MB")

    filename = f"{current_user.id}_{uuid.uuid4().hex}{extension}"
    file_path = UPLOADS_DIR / filename
    file_path.write_bytes(file_bytes)

    profile = ensure_candidate_profile(db, current_user)
    previous_resume_path = get_resume_file_path(profile.resume_url)
    profile.resume_url = f"/uploads/resumes/{filename}"
    profile.resume_name = file.filename or filename
    profile.resume_content = file_bytes
    profile.resume_mime_type = mimetypes.guess_type(profile.resume_name or filename)[0] or "application/octet-stream"
    ats_result = calculate_ats_score(
        build_candidate_profile_snapshot(current_user, profile),
        extract_resume_text(file_path),
        resume_path=file_path,
    )
    profile.ats_score = ats_result["score"]
    profile.ats_summary = ats_result["summary"]
    profile.ats_breakdown = dump_json_field(
        {
            "source": ats_result.get("source", "gemini"),
            "model": ats_result.get("model", ""),
            "scanned_at": ats_result.get("scanned_at"),
            "input_signature": ats_result.get("input_signature"),
            "breakdown": ats_result.get("breakdown", []),
            "strengths": ats_result.get("strengths", []),
            "gaps": ats_result.get("gaps", []),
            "keywords_found": ats_result.get("keywords_found", []),
            "keywords_missing": ats_result.get("keywords_missing", []),
            "suggestions": ats_result.get("suggestions", []),
            "optimization_tips": ats_result.get("optimization_tips", []),
            "optimized_resume_headline": ats_result.get("optimized_resume_headline", ""),
        }
    )
    profile.ats_last_checked_at = datetime.utcnow()

    applications = db.query(JobApplication).filter(JobApplication.candidate_id == profile.id).all()
    for application in applications:
        application.resume_url = profile.resume_url
        application.resume_name = profile.resume_name
        application.resume_content = file_bytes
        application.resume_mime_type = profile.resume_mime_type

    db.commit()
    db.refresh(profile)

    if previous_resume_path and previous_resume_path.exists() and previous_resume_path != file_path:
        previous_resume_path.unlink(missing_ok=True)

    return {
        "message": "Resume uploaded successfully",
        "resume_url": profile.resume_url,
        "resume_name": profile.resume_name,
        "ats": ats_result,
        "profile": serialize_candidate_profile(current_user, profile),
    }


@router.post("/candidate/profile/autofill")
async def autofill_candidate_profile(
    request: Request,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    form = await request.form(max_part_size=MAX_RESUME_UPLOAD_BYTES)
    source_text = str(form.get("text") or "")
    file = form.get("file")
    file_bytes: Optional[bytes] = None
    filename = ""
    if file is not None and hasattr(file, "read"):
        filename = getattr(file, "filename", "") or "candidate-cv"
        file_bytes = await file.read()
        if len(file_bytes) > MAX_RESUME_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="CV is too large. Please upload a file under 8 MB")
        temp_path = UPLOADS_DIR / f"autofill_{uuid.uuid4().hex}{Path(filename).suffix}"
        temp_path.write_bytes(file_bytes)
        extracted = extract_resume_text(temp_path)
        source_text = f"{source_text}\n\n{extracted}".strip()
        try:
            temp_path.unlink(missing_ok=True)
        except OSError:
            pass

    prompt = """
Act as a high-precision enterprise CV data extractor. Read the complete source before filling fields.
Copy names, contact details, employers, titles, locations, URLs, and dates exactly when present.
Calculate experience_years from non-overlapping employment dates; do not add concurrent roles twice.
Return distinct technical/domain skills only. Do not treat sentences, soft-skill claims, or section headings as skills.
Write a concise professional bio using only facts supported by the source.
Never invent candidate facts. Use "NA" for an unsupported text field, [] for unsupported lists, and 0 for unknown years.
Provide quality_score and warnings for ambiguous, unreadable, conflicting, or missing information.
Do not identify the provider or model. Return only the schema-compliant JSON object.
"""
    parsed = call_system_autofill(
        prompt,
        source_text,
        file_bytes,
        filename,
        response_schema=PROFILE_AUTOFILL_SCHEMA,
    ) or fallback_profile_autofill(source_text)
    profile_data = {
        "full_name": normalize_autofill_value(parsed.get("full_name")),
        "phone": normalize_autofill_value(parsed.get("phone")),
        "location": normalize_autofill_value(parsed.get("location")),
        "current_job_title": normalize_autofill_value(parsed.get("current_job_title")),
        "current_company": normalize_autofill_value(parsed.get("current_company")),
        "experience_years": safe_int(parsed.get("experience_years"), 0),
        "skills": normalize_autofill_value(parsed.get("skills")),
        "bio": normalize_autofill_value(parsed.get("bio")),
        "preferred_job_types": normalize_autofill_value(parsed.get("preferred_job_types")),
        "preferred_locations": normalize_autofill_value(parsed.get("preferred_locations")),
        "salary_expectation": normalize_autofill_value(parsed.get("salary_expectation")),
        "linkedin_url": normalize_autofill_value(parsed.get("linkedin_url")),
        "github_url": normalize_autofill_value(parsed.get("github_url")),
        "portfolio_url": normalize_autofill_value(parsed.get("portfolio_url")),
        "is_available": True,
    }
    return {
        "message": "Profile fields extracted successfully. Review highlighted uncertainties before saving.",
        "profile": profile_data,
        "extraction": {
            "qualityScore": safe_int(parsed.get("quality_score"), 45 if source_text else 0),
            "warnings": parsed.get("warnings") if isinstance(parsed.get("warnings"), list) else [],
        },
    }


@router.get("/recruiter/overview")
def get_recruiter_overview(
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    jobs = get_recruiter_jobs_query(db, current_user).order_by(JobPosting.created_at.desc()).all()
    job_ids = [job.id for job in jobs]
    applications = []
    if job_ids:
        applications = (
            db.query(JobApplication)
            .filter(JobApplication.job_id.in_(job_ids))
            .order_by(JobApplication.applied_at.desc())
            .all()
        )
    application_ids = [application.id for application in applications]
    interviews = []
    if application_ids:
        interviews = db.query(Interview).filter(Interview.application_id.in_(application_ids)).all()

    all_candidate_profiles = db.query(CandidateProfile).all()
    total_candidates = db.query(User).filter(User.role == UserRole.CANDIDATE).count()
    current_utc = datetime.now(timezone.utc)
    new_applications = [
        application
        for application in applications
        if to_utc_datetime(application.applied_at) and to_utc_datetime(application.applied_at) >= current_utc - timedelta(days=7)
    ]
    hires = [application for application in applications if application.status == "hired"]
    offers = [application for application in applications if application.status in {"offer", "hired"}]

    time_to_hire_days = []
    for application in hires:
        if application.job and application.applied_at:
            time_to_hire_days.append((application.applied_at - application.job.created_at).days if application.job.created_at else 0)
    avg_time_to_hire = round(sum(time_to_hire_days) / len(time_to_hire_days)) if time_to_hire_days else 0

    match_scores = []
    for application in applications:
        if application.candidate:
            match_scores.append(
                calculate_match_score(
                    parse_list_field(application.candidate.skills),
                    parse_list_field(application.job.requirements),
                )
            )
    candidate_quality = round(sum(match_scores) / len(match_scores)) if match_scores else 0

    unique_locations = {
        application.candidate.location
        for application in applications
        if application.candidate and application.candidate.location
    }
    diversity_score = round((len(unique_locations) / max(1, len(applications))) * 100) if applications else 0

    recent_applications = []
    for application in applications[:5]:
        candidate = application.candidate.user if application.candidate and application.candidate.user else None
        workflow_summary = get_workflow_summary_safely(application) if application.workflow_state else {}
        job_ats = get_job_ats_from_summary(workflow_summary, application.candidate.ats_score if application.candidate else None)
        recent_applications.append(
            {
                "id": application.id,
                "name": candidate.full_name if candidate and candidate.full_name else (candidate.username if candidate else "Candidate"),
                "photoUrl": stored_profile_photo_url("candidate", candidate.id, application.candidate) if candidate and application.candidate else "",
                "email": candidate.email if candidate else "",
                "position": application.job.title,
                "status": application.status,
                "appliedDate": application.applied_at.isoformat() if application.applied_at else None,
                "matchScore": calculate_match_score(
                    parse_list_field(application.candidate.skills if application.candidate else ""),
                    parse_list_field(application.job.requirements),
                ),
                "resumeUrl": application.resume_url,
                "profileAtsScore": application.candidate.ats_score if application.candidate else None,
                "jobAtsScore": job_ats.get("score"),
                "jobAts": job_ats,
            }
        )

    upcoming_interviews = sorted(
        [
            {
                "id": interview.id,
                "candidate": (
                    interview.application.candidate.user.full_name
                    if interview.application and interview.application.candidate and interview.application.candidate.user and interview.application.candidate.user.full_name
                    else (
                        interview.application.candidate.user.username
                        if interview.application and interview.application.candidate and interview.application.candidate.user
                        else "Candidate"
                    )
                ),
                "position": interview.application.job.title if interview.application and interview.application.job else "",
                "time": interview.scheduled_at.isoformat() if interview.scheduled_at else None,
                "type": interview.interview_type,
                "location": interview.location,
                "status": interview.status,
            }
            for interview in interviews
            if interview.status == "scheduled" and to_utc_datetime(interview.scheduled_at) and to_utc_datetime(interview.scheduled_at) >= current_utc
        ],
        key=lambda item: item["time"],
    )[:5]

    return {
        "analytics": {
            "totalJobs": len(jobs),
            "activeJobs": len([job for job in jobs if job.is_active]),
            "totalCandidates": total_candidates,
            "totalApplications": len(applications),
            "newApplications": len(new_applications),
            "interviewsScheduled": len([interview for interview in interviews if interview.status == "scheduled"]),
            "offersSent": len(offers),
            "hires": len(hires),
            "avgTimeToHire": avg_time_to_hire,
            "conversionRate": round((len(hires) / max(1, len(applications))) * 100) if applications else 0,
            "candidateQuality": candidate_quality,
            "diversityScore": diversity_score,
        },
        "recentApplications": recent_applications,
        "activeJobs": [serialize_job_for_recruiter(job, all_candidate_profiles) for job in jobs if job.is_active][:5],
        "upcomingInterviews": upcoming_interviews,
    }


@router.get("/recruiter/jobs")
def get_recruiter_jobs(
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    jobs_query = get_recruiter_jobs_query(db, current_user).order_by(JobPosting.created_at.desc())
    public_id_search = bool(search and search.strip().upper().startswith("INV-"))
    if search and not public_id_search:
        wildcard = f"%{search}%"
        jobs_query = jobs_query.filter(
            or_(
                JobPosting.title.ilike(wildcard),
                JobPosting.description.ilike(wildcard),
                JobPosting.location.ilike(wildcard),
            )
        )

    all_candidate_profiles = db.query(CandidateProfile).all()
    jobs = [serialize_job_for_recruiter(job, all_candidate_profiles) for job in jobs_query.all()]
    if public_id_search:
        normalized_search = search.strip().upper()
        jobs = [job for job in jobs if normalized_search in job["publicJobId"].upper()]
    return {"jobs": jobs}


@router.post("/recruiter/jobs/autofill")
async def autofill_recruiter_job(
    request: Request,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    ensure_recruiter_profile(db, current_user)
    form = await request.form(max_part_size=MAX_RESUME_UPLOAD_BYTES)
    source_text = str(form.get("text") or "")
    file = form.get("file")
    file_bytes: Optional[bytes] = None
    filename = ""

    if file is not None and hasattr(file, "read"):
        filename = getattr(file, "filename", "") or "job-details"
        file_bytes = await file.read()
        if len(file_bytes) > MAX_RESUME_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Job detail file is too large. Please upload a file under 8 MB")
        extracted_text = extract_document_text_from_bytes(file_bytes, filename)
        temp_path = UPLOADS_DIR / f"job_autofill_{uuid.uuid4().hex}{Path(filename).suffix}"
        try:
            temp_path.write_bytes(file_bytes)
            extracted_text = f"{extracted_text}\n\n{extract_resume_text(temp_path)}".strip()
        except Exception:
            pass
        finally:
            try:
                temp_path.unlink(missing_ok=True)
            except OSError:
                pass
        source_text = f"{source_text}\n\n{extracted_text}".strip()

    prompt = """
Act as a high-precision enterprise job-description extraction system. Read the entire source before filling fields.
Preserve the source's role title, location, employment type, required experience, compensation, requirements,
responsibilities, and benefits. Separate each requirement/responsibility/benefit into one concise list item.
Classify a statement as a requirement only when it describes candidate eligibility, knowledge, experience, skill,
certification, education, language, availability, or a must-have/preferred condition. Do not mix responsibilities into it.
Do not invent compensation, benefits, qualifications, technologies, or locations. If unsupported, use "NA", 0, or [].
Set is_remote true only when remote work is explicitly supported by the source.
salary_min and salary_max must contain digits only without currency symbols; use 0 when absent.
Use field_confidence evidence copied or tightly paraphrased from the source, and warnings for every ambiguity.
Do not identify the provider or model. Return only the schema-compliant JSON object.
"""
    parsed = call_system_autofill(
        prompt,
        source_text,
        file_bytes,
        filename,
        response_schema=JOB_AUTOFILL_SCHEMA,
    ) or fallback_job_autofill(source_text)
    job_type = normalize_autofill_value(parsed.get("job_type"), "Full-time")
    if job_type not in {"Full-time", "Part-time", "Contract", "Internship", "Temporary"}:
        job_type = "Full-time"
    salary_period = normalize_autofill_value(parsed.get("salary_period"), "monthly").lower()
    if salary_period not in {"per day", "weekly", "monthly", "annually"}:
        salary_period = "per day" if job_type == "Contract" else "monthly"
    salary_min = max(0, safe_int(parsed.get("salary_min"), 0))
    salary_max = max(0, safe_int(parsed.get("salary_max"), 0))
    if salary_min and salary_max and salary_min > salary_max:
        salary_min, salary_max = salary_max, salary_min
    remote_value = parsed.get("is_remote")
    is_remote = remote_value if isinstance(remote_value, bool) else bool(re.search(r"\bremote\b", source_text, re.I))
    warnings = parsed.get("warnings") if isinstance(parsed.get("warnings"), list) else []
    title = re.sub(r"^\s*(?:job\s*)?title\s*:\s*", "", normalize_autofill_value(parsed.get("title")), flags=re.I).strip()
    location = re.sub(r"^\s*(?:job\s*)?location\s*:\s*", "", normalize_autofill_value(parsed.get("location")), flags=re.I).strip()
    experience_level = re.sub(r"^\s*(?:experience|seniority)(?:\s*level)?\s*:\s*", "", normalize_autofill_value(parsed.get("experience_level")), flags=re.I).strip()
    if ai_normalize_text(location).lower() == ai_normalize_text(title).lower() or len(location) > 120:
        warnings.append("Location looked like a job title or long description and was cleared for manual review.")
        location = "NA"
    valid_experience = bool(re.search(r"\b(?:\d+\+?\s*(?:years?|yrs?)|entry|junior|mid(?:-level)?|senior|lead|principal|executive)\b", experience_level, re.I))
    if ai_normalize_text(experience_level).lower() == ai_normalize_text(title).lower() or (experience_level != "NA" and not valid_experience):
        warnings.append("Experience level was not supported by a seniority or years-of-experience statement and was cleared for review.")
        experience_level = "NA"
    job_data = {
        "title": title,
        "description": normalize_autofill_value(parsed.get("description")),
        "location": location,
        "job_type": job_type,
        "experience_level": experience_level,
        "salary_min": salary_min,
        "salary_max": salary_max,
        "salary_currency": normalize_autofill_value(parsed.get("salary_currency")),
        "salary_period": salary_period,
        "requirements": normalize_autofill_multiline(parsed.get("requirements")),
        "responsibilities": normalize_autofill_multiline(parsed.get("responsibilities")),
        "benefits": normalize_autofill_multiline(parsed.get("benefits")),
        "is_remote": is_remote,
    }
    quality_score = safe_int(parsed.get("quality_score"), 45 if source_text else 0)
    if not source_text and not (file_bytes and filename and can_send_inline_to_gemini(Path(filename))):
        warnings.append("The uploaded document did not contain extractable text. Verify every field manually.")
        quality_score = min(quality_score, 25)
    return {
        "message": "Job details extracted successfully. Review uncertainties before publishing.",
        "job": job_data,
        "extraction": {
            "qualityScore": max(0, min(100, quality_score)),
            "warnings": warnings,
            "fieldConfidence": parsed.get("field_confidence") if isinstance(parsed.get("field_confidence"), list) else [],
        },
    }


def sanitize_job_field_mapping(data: dict[str, Any]) -> dict[str, Any]:
    cleaned = dict(data)
    title = ai_normalize_text(str(cleaned.get("title") or "")).strip()
    for field, label_pattern in {
        "location": r"^\s*(?:job\s*)?location\s*:\s*",
        "experience_level": r"^\s*(?:experience|seniority)(?:\s*level)?\s*:\s*",
    }.items():
        if field not in cleaned or cleaned.get(field) is None:
            continue
        value = re.sub(label_pattern, "", str(cleaned.get(field) or ""), flags=re.I).strip()
        if ai_normalize_text(value).lower() == title.lower():
            value = ""
        cleaned[field] = value or None
    return cleaned


@router.get("/recruiter/jobs/{job_id}")
def get_recruiter_job_details(
    job_id: int,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if job is None or not can_manage_job(job, current_user, db):
        raise HTTPException(status_code=404, detail="Job not found")

    all_candidate_profiles = db.query(CandidateProfile).all()
    applications = (
        db.query(JobApplication)
        .filter(JobApplication.job_id == job.id)
        .order_by(JobApplication.applied_at.desc())
        .all()
    )
    return {
        "job": serialize_job_for_recruiter(job, all_candidate_profiles),
        "jobAnalysis": build_job_analysis(job, applications),
    }


@router.post("/recruiter/jobs")
def create_job(
    payload: JobPostingCreate,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    profile = ensure_recruiter_profile(db, current_user)
    data = sanitize_job_field_mapping(payload.model_dump())
    assessment_config = normalize_assessment_config(
        data.pop("assessment_config", None),
        job_title=data.get("title") or "",
        description=data.get("description") or "",
        skills=parse_list_field(data.get("requirements")),
    )
    data["assessment_config"] = dump_json_field(assessment_config)
    job = JobPosting(recruiter_id=profile.id, **data)
    db.add(job)
    db.commit()
    db.refresh(job)
    return {
        "message": "Job created successfully",
        "job_id": job.id,
        "public_job_id": format_public_job_id(job),
    }


@router.put("/recruiter/jobs/{job_id}")
def update_job(
    job_id: int,
    payload: JobPostingUpdate,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if job is None or not can_manage_job(job, current_user, db):
        raise HTTPException(status_code=404, detail="Job not found")

    update_data = sanitize_job_field_mapping(payload.model_dump(exclude_unset=True))
    assessment_config = update_data.pop("assessment_config", None)

    for field, value in update_data.items():
        setattr(job, field, value)

    if assessment_config is not None:
        job.assessment_config = dump_json_field(
            normalize_assessment_config(
                assessment_config,
                job_title=job.title,
                description=job.description or "",
                skills=parse_list_field(job.requirements),
            )
        )

    db.commit()
    db.refresh(job)
    return {"message": "Job updated successfully", "job_id": job.id}


@router.delete("/recruiter/jobs/{job_id}")
def delete_job(
    job_id: int,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if job is None or not can_manage_job(job, current_user, db):
        raise HTTPException(status_code=404, detail="Job not found")

    job.is_active = False
    db.commit()
    return {"message": "Job archived successfully"}


@router.get("/recruiter/applications")
def get_recruiter_applications(
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    jobs = get_recruiter_jobs_query(db, current_user).all()
    job_ids = [job.id for job in jobs]
    if not job_ids:
        return {"applications": []}

    applications = (
        db.query(JobApplication)
        .filter(JobApplication.job_id.in_(job_ids))
        .order_by(JobApplication.applied_at.desc())
        .all()
    )
    items = []
    for application in applications:
        candidate_profile = application.candidate
        candidate_user = candidate_profile.user if candidate_profile else None
        workflow_summary = get_workflow_summary_safely(application) if application.workflow_state else None
        job_ats = get_job_ats_from_summary(workflow_summary or {}, candidate_profile.ats_score if candidate_profile else None)
        items.append(
            {
                "id": application.id,
                "candidateId": candidate_user.id if candidate_user else None,
                "name": candidate_user.full_name if candidate_user and candidate_user.full_name else (candidate_user.username if candidate_user else "Candidate"),
                "photoUrl": stored_profile_photo_url("candidate", candidate_user.id, candidate_profile) if candidate_user and candidate_profile else "",
                "email": candidate_user.email if candidate_user else "",
                "position": application.job.title,
                "company": application.job.recruiter.company_name if application.job.recruiter else "Invenia AI",
                "status": application.status,
                "appliedDate": application.applied_at.isoformat() if application.applied_at else None,
                "matchScore": calculate_match_score(
                    parse_list_field(candidate_profile.skills if candidate_profile else ""),
                    parse_list_field(application.job.requirements),
                ),
                "resumeUrl": application.resume_url,
                "coverLetter": application.cover_letter,
                "location": candidate_profile.location if candidate_profile else "",
                "phone": candidate_profile.phone if candidate_profile else "",
                "atsScore": candidate_profile.ats_score if candidate_profile else None,
                "profileAtsScore": candidate_profile.ats_score if candidate_profile else None,
                "jobAtsScore": job_ats.get("score"),
                "jobAts": job_ats,
                "jobMatchScore": application.job_match_score,
                "workflowStage": application.workflow_stage or "profile",
                "finalScore": get_released_final_score(get_application_workflow_state(application), application.final_score),
                "workflowSummary": workflow_summary,
            }
        )
    return {"applications": items}


@router.get("/recruiter/applications/{application_id}/resume")
def get_recruiter_application_resume(
    application_id: int,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    application = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if application is None or not can_manage_job(application.job, current_user, db):
        raise HTTPException(status_code=404, detail="Application not found")

    profile = application.candidate
    resume_url = application.resume_url or (profile.resume_url if profile else "")
    resume_name = application.resume_name or (profile.resume_name if profile else "") or Path(resume_url or "").name
    resume_content = application.resume_content or (profile.resume_content if profile else None)
    resume_mime_type = application.resume_mime_type or (profile.resume_mime_type if profile else None)

    if resume_content:
        return inline_binary_response(resume_content, resume_name or "candidate-resume", resume_mime_type)

    resume_path = ensure_application_resume_file(application, profile)
    if resume_path and resume_path.exists() and resume_path.is_file():
        download_name = resume_name or Path(resume_url or "").name
        return inline_binary_response(
            resume_path.read_bytes(),
            download_name or resume_path.name,
            mimetypes.guess_type(download_name or resume_path.name)[0],
        )

    return missing_file_response(resume_name, owner="candidate")


@router.get("/recruiter/candidates/{candidate_id}/resume")
def get_recruiter_candidate_resume(
    candidate_id: int,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="Candidate profile not found")

    if not is_super_recruiter(current_user):
        managed_job_ids = [job.id for job in get_recruiter_jobs_query(db, current_user).all()]
        has_related_application = False
        if managed_job_ids:
            has_related_application = (
                db.query(JobApplication)
                .filter(JobApplication.candidate_id == profile.id, JobApplication.job_id.in_(managed_job_ids))
                .first()
                is not None
            )
        if not has_related_application:
            raise HTTPException(status_code=404, detail="Candidate profile not found")

    if profile.resume_content:
        return inline_binary_response(
            profile.resume_content,
            profile.resume_name or Path(profile.resume_url or "candidate-resume").name,
            profile.resume_mime_type,
        )

    resume_path = ensure_profile_resume_file(profile)
    if resume_path and resume_path.exists() and resume_path.is_file():
        return inline_binary_response(
            resume_path.read_bytes(),
            profile.resume_name or resume_path.name,
            mimetypes.guess_type(profile.resume_name or resume_path.name)[0],
        )
    return missing_file_response(profile.resume_name or Path(profile.resume_url or "").name, owner="candidate")


def serve_interview_media(application: JobApplication, media_type_key: str) -> Response:
    workflow_state = get_application_workflow_state(application)
    interview_state = workflow_state.get("interview", {}) if isinstance(workflow_state, dict) else {}

    if media_type_key == "recording":
        content = application.interview_recording_content
        filename = application.interview_recording_name or Path(interview_state.get("recording_url") or "interview-recording.webm").name
        mime_type = application.interview_recording_mime_type or "video/webm"
        path = INTERVIEW_RECORDINGS_DIR / Path(interview_state.get("recording_url") or "").name
        owner = "candidate"
    else:
        content = application.interview_snapshot_content
        filename = application.interview_snapshot_name or Path(interview_state.get("snapshot_url") or "interview-snapshot.png").name
        mime_type = application.interview_snapshot_mime_type or "image/png"
        path = INTERVIEW_SNAPSHOTS_DIR / Path(interview_state.get("snapshot_url") or "").name
        owner = "candidate"

    if content:
        return inline_binary_response(content, filename, mime_type)
    if path.exists() and path.is_file():
        return inline_binary_response(path.read_bytes(), filename or path.name, mimetypes.guess_type(filename or path.name)[0])
    return missing_file_response(filename, owner=owner)


@router.get("/recruiter/applications/{application_id}/interview-recording")
def get_recruiter_interview_recording(
    application_id: int,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    application = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if application is None or not can_manage_job(application.job, current_user, db):
        raise HTTPException(status_code=404, detail="Application not found")
    return serve_interview_media(application, "recording")


@router.get("/recruiter/applications/{application_id}/interview-snapshot")
def get_recruiter_interview_snapshot(
    application_id: int,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    application = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if application is None or not can_manage_job(application.job, current_user, db):
        raise HTTPException(status_code=404, detail="Application not found")
    return serve_interview_media(application, "snapshot")


@router.put("/recruiter/applications/{application_id}")
def update_application_status(
    application_id: int,
    payload: JobApplicationUpdate,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    application = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if application is None or not can_manage_job(application.job, current_user, db):
        raise HTTPException(status_code=404, detail="Application not found")

    if payload.status:
        requested_status = payload.status.strip().lower()
        workflow_state = (
            ensure_application_workflow(db, application, application.candidate.user, application.candidate)
            if application.candidate and application.candidate.user
            else get_application_workflow_state(application)
        )
        screening_state = workflow_state.get("screening", {}) if isinstance(workflow_state, dict) else {}
        final_statuses = {"approved", "rejected"}
        existing_final_decision = screening_state.get("decision") if screening_state.get("decision_final") else None
        if existing_final_decision in final_statuses and requested_status != existing_final_decision:
            raise HTTPException(
                status_code=400,
                detail=f"This application is already {existing_final_decision}. Final screening decisions cannot be reversed.",
            )
        if application.status in final_statuses and requested_status != application.status:
            raise HTTPException(
                status_code=400,
                detail=f"This application is already {application.status}. Final screening decisions cannot be reversed.",
            )

        application.status = requested_status
        if requested_status in ASSESSMENT_UNLOCK_STATUSES and workflow_state:
            workflow_state = unlock_application_workflow(application, workflow_state)
            workflow_state["screening"] = {
                **(workflow_state.get("screening") or {}),
                "approved": True,
                "decision": "approved",
                "decision_final": True,
                "approved_at": datetime.utcnow().isoformat(),
                "message": "Recruiter screening approved. Candidate can start the secure assessment rounds.",
            }
            set_application_workflow_state(application, workflow_state)
        elif requested_status == "rejected" and workflow_state:
            workflow_state["screening"] = {
                "approved": False,
                "decision": "rejected",
                "decision_final": True,
                "rejected_at": datetime.utcnow().isoformat(),
                "message": "Recruiter closed this application after screening.",
            }
            workflow_state["current_stage"] = "closed"
            set_application_workflow_state(application, workflow_state)
        elif workflow_state:
            set_application_workflow_state(application, workflow_state)
        db.commit()
        db.refresh(application)

    return {"message": "Application updated successfully", "status": application.status}


@router.get("/recruiter/export/{export_type}")
def export_recruiter_data(
    export_type: str,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    jobs = get_recruiter_jobs_query(db, current_user).order_by(JobPosting.created_at.desc()).all()
    job_ids = [job.id for job in jobs]
    applications = []
    if job_ids:
        applications = (
            db.query(JobApplication)
            .filter(JobApplication.job_id.in_(job_ids))
            .order_by(JobApplication.applied_at.desc())
            .all()
        )

    if export_type == "jobs":
        all_candidate_profiles = db.query(CandidateProfile).all()
        rows = []
        for job in jobs:
            serialized = serialize_job_for_recruiter(job, all_candidate_profiles)
            rows.append(
                {
                    "Job ID": format_public_job_id(job),
                    "Title": serialized.get("title", ""),
                    "Location": serialized.get("location", ""),
                    "Type": serialized.get("type", ""),
                    "Experience": serialized.get("experienceLevel", ""),
                    "Salary": serialized.get("salary", ""),
                    "Views": serialized.get("views", 0),
                    "Applications": serialized.get("appliedCount", serialized.get("applications", 0)),
                    "Status": serialized.get("status", ""),
                    "Created At": job.created_at.isoformat() if job.created_at else "",
                }
            )
        return csv_download_response(f"invenia-jobs-{datetime.utcnow().date()}.csv", rows)

    if export_type == "applications":
        rows = []
        for application in applications:
            candidate_user = application.candidate.user if application.candidate and application.candidate.user else None
            workflow_summary = get_workflow_summary_safely(application) if application.workflow_state else {}
            job_ats = get_job_ats_from_summary(workflow_summary, application.candidate.ats_score if application.candidate else None)
            rows.append(
                {
                    "Application ID": application.id,
                    "Job": application.job.title if application.job else "",
                    "Candidate": candidate_user.full_name if candidate_user else "",
                    "Email": candidate_user.email if candidate_user else "",
                    "Status": application.status,
                    "Applied At": application.applied_at.isoformat() if application.applied_at else "",
                    "Job ATS": job_ats.get("score", ""),
                    "Final Score": get_released_final_score(get_application_workflow_state(application), application.final_score),
                    "Workflow Stage": application.workflow_stage or "",
                }
            )
        return csv_download_response(f"invenia-applications-{datetime.utcnow().date()}.csv", rows)

    if export_type == "candidates":
        rows = []
        seen_candidates = set()
        for application in applications:
            profile = application.candidate
            candidate_user = profile.user if profile and profile.user else None
            if not candidate_user or candidate_user.id in seen_candidates:
                continue
            seen_candidates.add(candidate_user.id)
            rows.append(
                {
                    "Candidate ID": candidate_user.id,
                    "Name": candidate_user.full_name or candidate_user.username,
                    "Email": candidate_user.email,
                    "Phone": profile.phone if profile else "",
                    "Location": profile.location if profile else "",
                    "Title": profile.current_job_title if profile else "",
                    "Experience Years": profile.experience_years if profile else "",
                    "Profile ATS": profile.ats_score if profile else "",
                    "Applications": len([item for item in applications if item.candidate_id == application.candidate_id]),
                    "Active": "Yes" if candidate_user.is_active else "No",
                }
            )
        return csv_download_response(f"invenia-candidates-{datetime.utcnow().date()}.csv", rows)

    if export_type == "analytics":
        applications_by_job: dict[int, list[JobApplication]] = {}
        for application in applications:
            applications_by_job.setdefault(application.job_id, []).append(application)

        job_analysis = [
            build_job_analysis(job, applications_by_job.get(job.id, []))
            for job in jobs
        ]
        rows = [
            {
                "Job ID": item.get("publicJobId") or item.get("jobId", ""),
                "Job": item.get("title", ""),
                "Applicants": item.get("applicantCount", 0),
                "Average Job ATS": item.get("avgJobAtsScore", 0),
                "Average Final Score": item.get("avgFinalScore", 0),
                "Demand": item.get("demand", {}).get("level", ""),
                "Summary": item.get("fitSummary", ""),
            }
            for item in job_analysis
        ]
        return csv_download_response(f"invenia-analytics-{datetime.utcnow().date()}.csv", rows)

    raise HTTPException(status_code=404, detail="Unknown export type")


@router.get("/recruiter/candidates")
def get_candidates(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query("all"),
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    jobs = get_recruiter_jobs_query(db, current_user).all()
    visible_job_ids = [job.id for job in jobs]
    applications = []
    if visible_job_ids:
        applications = db.query(JobApplication).filter(JobApplication.job_id.in_(visible_job_ids)).all()

    applications_by_candidate: dict[int, list[JobApplication]] = {}
    for application in applications:
        applications_by_candidate.setdefault(application.candidate_id, []).append(application)

    candidates = []
    users = db.query(User).filter(User.role == UserRole.CANDIDATE).order_by(User.created_at.desc()).all()
    for user in users:
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user.id).first()
        profile_skills = parse_list_field(profile.skills if profile else "")
        relevant_applications = applications_by_candidate.get(profile.id if profile else -1, [])
        latest_application = sorted(
            relevant_applications,
            key=lambda item: item.applied_at or datetime.min,
            reverse=True,
        )[0] if relevant_applications else None

        match_scores = [
            calculate_match_score(profile_skills, parse_list_field(job.requirements))
            for job in jobs
        ] if jobs else []
        latest_workflow_summary = get_workflow_summary_safely(latest_application) if latest_application else None
        if (
            latest_workflow_summary
            and profile
            and latest_application
            and latest_application.job
            and not (latest_workflow_summary.get("jobAts") or {}).get("matched_requirements")
        ):
            inferred_job_ats = build_fast_job_ats_result(
                profile,
                user,
                latest_application.job,
                latest_application.job_match_score or calculate_match_score(profile_skills, parse_list_field(latest_application.job.requirements)),
            )
            latest_workflow_summary["jobAts"] = inferred_job_ats
            latest_workflow_summary["jobAtsScore"] = inferred_job_ats.get("score")
            latest_workflow_summary["atsScore"] = inferred_job_ats.get("score")

        item = {
            "id": user.id,
            "name": user.full_name or user.username,
            "photoUrl": stored_profile_photo_url("candidate", user.id, profile) if profile else "",
            "email": user.email,
            "registeredAt": user.created_at.isoformat() if user.created_at else None,
            "isVerified": user.is_verified,
            "isActive": user.is_active,
            "status": latest_application.status if latest_application else ("available" if profile and profile.is_available else "new"),
            "phone": profile.phone if profile else "",
            "location": profile.location if profile else "",
            "title": profile.current_job_title if profile else "",
            "experienceYears": profile.experience_years if profile and profile.experience_years else 0,
            "skills": profile_skills,
            "resumeUrl": profile.resume_url if profile else None,
            "resumeName": profile.resume_name if profile else "",
            "atsScore": profile.ats_score if profile else None,
            "profileAtsScore": profile.ats_score if profile else None,
            "isAvailable": profile.is_available if profile else False,
            "applicationCount": len(relevant_applications),
            "lastAppliedAt": latest_application.applied_at.isoformat() if latest_application and latest_application.applied_at else None,
            "latestApplicationId": latest_application.id if latest_application else None,
            "latestJobTitle": latest_application.job.title if latest_application and latest_application.job else "",
            "matchScore": round(sum(match_scores) / len(match_scores)) if match_scores else 0,
            "bio": profile.bio if profile else "",
            "latestApplicationWorkflow": latest_workflow_summary,
            "workflowStage": latest_application.workflow_stage if latest_application else "profile",
            "finalScore": get_released_final_score(get_application_workflow_state(latest_application), latest_application.final_score) if latest_application else 0,
        }
        if item["latestApplicationWorkflow"]:
            item["jobAtsScore"] = item["latestApplicationWorkflow"].get("jobAtsScore")
            item["jobAts"] = item["latestApplicationWorkflow"].get("jobAts")
        else:
            item["jobAtsScore"] = None
            item["jobAts"] = None

        if search:
            haystack = " ".join(
                [
                    item["name"],
                    item["email"],
                    item["title"] or "",
                    item["location"] or "",
                    " ".join(item["skills"]),
                ]
            ).lower()
            if search.lower() not in haystack:
                continue

        if status == "available" and not item["isAvailable"]:
            continue
        if status == "applied" and item["applicationCount"] == 0:
            continue
        if status == "screening" and not any(application.status == "pending" for application in relevant_applications):
            continue
        if status == "new" and item["applicationCount"] > 0:
            continue
        if status == "inactive" and item["isActive"]:
            continue

        candidates.append(item)

    return {"candidates": candidates}


@router.patch("/recruiter/candidates/{candidate_id}/access")
def update_candidate_access(
    candidate_id: int,
    payload: dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    candidate_user = db.query(User).filter(User.id == candidate_id, User.role == UserRole.CANDIDATE).first()
    if candidate_user is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_user.id).first()
    if not can_manage_candidate(profile, current_user, db):
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate_user.is_active = bool(payload.get("is_active"))
    db.commit()
    db.refresh(candidate_user)
    return {
        "message": (
            "Candidate account activated successfully"
            if candidate_user.is_active
            else "Candidate account deactivated successfully. They cannot log in until reactivated."
        ),
        "candidateId": candidate_user.id,
        "isActive": candidate_user.is_active,
    }


@router.delete("/recruiter/candidates/{candidate_id}")
def delete_candidate_account(
    candidate_id: int,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    candidate_user = db.query(User).filter(User.id == candidate_id, User.role == UserRole.CANDIDATE).first()
    if candidate_user is None:
        raise HTTPException(status_code=404, detail="Candidate not found")

    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_user.id).first()
    if not can_manage_candidate(profile, current_user, db):
        raise HTTPException(status_code=404, detail="Candidate not found")

    application_ids: list[int] = []
    if profile:
        applications = db.query(JobApplication).filter(JobApplication.candidate_id == profile.id).all()
        application_ids = [application.id for application in applications]
        delete_local_file_from_url(profile.resume_url, UPLOADS_DIR)
        for application in applications:
            delete_local_file_from_url(application.resume_url, UPLOADS_DIR)
            workflow_state = get_application_workflow_state(application)
            interview_state = workflow_state.get("interview", {}) if isinstance(workflow_state, dict) else {}
            delete_local_file_from_url(interview_state.get("recording_url"), INTERVIEW_RECORDINGS_DIR)
            delete_local_file_from_url(interview_state.get("snapshot_url"), INTERVIEW_SNAPSHOTS_DIR)
        if application_ids:
            db.query(Interview).filter(Interview.application_id.in_(application_ids)).delete(synchronize_session=False)
            db.query(JobApplication).filter(JobApplication.id.in_(application_ids)).delete(synchronize_session=False)
        db.query(SavedJob).filter(SavedJob.candidate_id == profile.id).delete(synchronize_session=False)
        db.delete(profile)

    db.query(Analytics).filter(Analytics.user_id == candidate_user.id).delete(synchronize_session=False)
    db.delete(candidate_user)
    db.commit()
    return {
        "message": "Candidate account deleted successfully. They must sign up again to use the candidate portal.",
        "candidateId": candidate_id,
        "deletedApplications": len(application_ids),
    }


@router.get("/recruiter/interviews")
def get_interviews(
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    jobs = get_recruiter_jobs_query(db, current_user).all()
    job_ids = [job.id for job in jobs]
    if not job_ids:
        return {"interviews": []}

    applications = db.query(JobApplication).filter(JobApplication.job_id.in_(job_ids)).all()
    application_ids = [application.id for application in applications]
    if not application_ids:
        return {"interviews": []}

    interviews = (
        db.query(Interview)
        .filter(Interview.application_id.in_(application_ids))
        .order_by(Interview.scheduled_at.asc())
        .all()
    )
    items = []
    for interview in interviews:
        application = interview.application
        candidate_user = application.candidate.user if application and application.candidate else None
        items.append(
            {
                "id": interview.id,
                "candidate": candidate_user.full_name if candidate_user and candidate_user.full_name else (candidate_user.username if candidate_user else "Candidate"),
                "position": application.job.title if application and application.job else "",
                "time": interview.scheduled_at.isoformat() if interview.scheduled_at else None,
                "type": interview.interview_type,
                "status": interview.status,
                "location": interview.location,
                "notes": interview.notes,
            }
        )
    return {"interviews": items}


@router.post("/recruiter/interviews")
def schedule_interview(
    payload: InterviewCreate,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    application = db.query(JobApplication).filter(JobApplication.id == payload.application_id).first()
    if application is None or not can_manage_job(application.job, current_user, db):
        raise HTTPException(status_code=404, detail="Application not found")

    interview = Interview(**payload.model_dump(), status="scheduled")
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return {"message": "Interview scheduled successfully", "interview_id": interview.id}


@router.put("/recruiter/interviews/{interview_id}")
def update_interview(
    interview_id: int,
    payload: InterviewUpdate,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if interview is None or not can_manage_job(interview.application.job, current_user, db):
        raise HTTPException(status_code=404, detail="Interview not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(interview, field, value)
    db.commit()
    db.refresh(interview)
    return {"message": "Interview updated successfully"}


@router.post("/recruiter/analytics/recalculate")
def recalculate_recruiter_scores(
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    jobs = get_recruiter_jobs_query(db, current_user).all()
    job_ids = [job.id for job in jobs]
    if not job_ids:
        return {"message": "No applications require recalculation.", "updated": 0}

    applications = db.query(JobApplication).filter(JobApplication.job_id.in_(job_ids)).all()
    updated = 0
    for application in applications:
        profile = application.candidate
        user = profile.user if profile and profile.user else None
        job = application.job
        if not profile or not user or not job:
            continue

        match_score = calculate_match_score(parse_list_field(profile.skills), parse_list_field(job.requirements))
        workflow_state = get_application_workflow_state(application)
        if not workflow_state:
            workflow_state = build_locked_application_workflow(
                job,
                profile,
                user,
                match_score,
                application.cover_letter or "",
                build_fast_job_ats_result(profile, user, job, match_score),
            )

        job_ats = workflow_state.get("job_ats") if isinstance(workflow_state.get("job_ats"), dict) else {}
        job_ats_version = (job_ats.get("calculation") or {}).get("version") if isinstance(job_ats.get("calculation"), dict) else None
        if job_ats_version != "invenia-job-ats-v3":
            job_ats = build_fast_job_ats_result(
                profile,
                user,
                job,
                match_score,
                previous_result=job_ats,
            )

        workflow_state["job_ats"] = job_ats
        workflow_state["ats_score"] = safe_int(job_ats.get("score"))
        workflow_state["match_score"] = match_score
        workflow_state["score_calculation"] = build_overall_score_calculation(workflow_state)
        workflow_state["overall_score"] = workflow_state["score_calculation"]["score"]
        application.job_match_score = match_score
        if workflow_state.get("completed"):
            application.final_score = workflow_state["overall_score"]
        set_application_workflow_state(application, workflow_state)
        updated += 1

    db.commit()
    return {
        "message": "Historical application scores were recalculated with the current formulas.",
        "updated": updated,
        "jobAtsVersion": "invenia-job-ats-v3",
        "finalScoreVersion": "invenia-final-score-v3",
    }


@router.get("/recruiter/analytics")
def get_analytics(
    period: str = Query("week"),
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    try:
        period_start = get_period_start(period)
        jobs = get_recruiter_jobs_query(db, current_user).all()
        job_ids = [job.id for job in jobs]
        all_applications = []
        if job_ids:
            all_applications = db.query(JobApplication).filter(JobApplication.job_id.in_(job_ids)).all()
        applications = [
            application
            for application in all_applications
            if is_after_period(application.applied_at, period_start)
        ]

        screened = [application for application in applications if application.status in {"reviewed", "shortlisted", "interview", "offer", "hired"}]
        interviewed = [
            application
            for application in applications
            if application.status in {"reviewed", "shortlisted", "interview", "offer", "hired"}
            or bool((get_workflow_summary_safely(application).get("interview") or {}).get("turns"))
        ]
        offers_sent = [application for application in applications if application.status in {"offer", "hired"}]
        hired = [application for application in applications if application.status == "hired"]

        match_scores = [
            calculate_match_score(
                parse_list_field(application.candidate.skills if application.candidate else ""),
                parse_list_field(application.job.requirements if application.job else ""),
            )
            for application in applications
        ]
        candidate_quality = round(sum(match_scores) / len(match_scores)) if match_scores else 0

        unique_locations = {
            application.candidate.location
            for application in applications
            if application.candidate and application.candidate.location
        }
        diversity_score = round((len(unique_locations) / max(1, len(applications))) * 100) if applications else 0

        avg_time_to_hire = 0
        hire_durations = [
            duration
            for application in hired
            if application.job
            for duration in [elapsed_days(application.job.created_at, application.applied_at)]
            if duration is not None
        ]
        if hire_durations:
            avg_time_to_hire = round(sum(hire_durations) / len(hire_durations))

        applications_by_job: dict[int, list[JobApplication]] = {job.id: [] for job in jobs}
        for application in all_applications:
            applications_by_job.setdefault(application.job_id, []).append(application)

        job_analysis = []
        for job in jobs:
            try:
                job_analysis.append(build_job_analysis(job, applications_by_job.get(job.id, [])))
            except Exception:
                job_analysis.append(
                    {
                        "jobId": job.id,
                        "publicJobId": format_public_job_id(job),
                        "title": job.title,
                        "status": "active" if job.is_active else "inactive",
                        "location": "Remote" if job.is_remote else (job.location or "Location not specified"),
                        "type": job.job_type or "Full-time",
                        "experienceLevel": job.experience_level or "",
                        "requirementsCount": len(parse_list_field(job.requirements)),
                        "applicantCount": len(applications_by_job.get(job.id, [])),
                        "avgJobAtsScore": 0,
                        "avgFinalScore": 0,
                        "fitSummary": "This job report could not fully load, but applications are still available for manual review.",
                        "demand": {"level": "Review", "requirementsCount": len(parse_list_field(job.requirements)), "assessmentIntensity": 0, "remote": bool(job.is_remote)},
                        "topCandidates": [],
                        "candidateComparison": [],
                        "atsDistribution": score_distribution([]),
                        "finalScoreDistribution": score_distribution([]),
                        "stagePerformance": [],
                        "commonMatchedRequirements": [],
                        "commonMissingRequirements": [],
                        "recommendations": ["Open candidate profiles manually while this report refreshes."],
                    }
                )

        candidate_comparison = sorted(
            [
                candidate
                for job_report in job_analysis
                for candidate in job_report.get("candidateComparison", [])
            ],
            key=lambda item: (safe_int(item.get("finalScore")), safe_int(item.get("jobAtsScore"))),
            reverse=True,
        )
        job_ats_scores = [item.get("jobAtsScore") for item in candidate_comparison if item.get("jobAtsScore") is not None]
        final_scores = [item.get("finalScore") for item in candidate_comparison if item.get("finalScore") is not None]
        if job_ats_scores:
            candidate_quality = safe_round_average(job_ats_scores)

        return {
            "analytics": {
                "totalApplications": len(applications),
                "conversionRate": round((len(hired) / max(1, len(applications))) * 100) if applications else 0,
                "candidateQuality": candidate_quality,
                "diversityScore": diversity_score,
                "avgTimeToHire": avg_time_to_hire,
                "averageJobAtsScore": safe_round_average(job_ats_scores),
                "averageFinalScore": safe_round_average(final_scores),
                "totalJobsAnalyzed": len(job_analysis),
                "totalCandidateReports": len(candidate_comparison),
                "hiringFunnel": [
                    {"stage": "Applications", "count": len(applications), "percentage": 100 if applications else 0},
                    {"stage": "Screened", "count": len(screened), "percentage": round((len(screened) / max(1, len(applications))) * 100) if applications else 0},
                    {"stage": "Interviewed", "count": len(interviewed), "percentage": round((len(interviewed) / max(1, len(applications))) * 100) if applications else 0},
                    {"stage": "Offers Sent", "count": len(offers_sent), "percentage": round((len(offers_sent) / max(1, len(applications))) * 100) if applications else 0},
                    {"stage": "Hired", "count": len(hired), "percentage": round((len(hired) / max(1, len(applications))) * 100) if applications else 0},
                ],
            },
            "jobAnalysis": job_analysis,
            "candidateComparison": candidate_comparison[:80],
            "scoreDistributions": {
                "jobAts": score_distribution(job_ats_scores),
                "final": score_distribution(final_scores),
            },
            "aiInsights": build_recruiter_ai_insights(job_analysis, candidate_comparison),
        }
    except Exception as error:
        print(f"Recruiter analytics failed: {error}")
        return {
            "analytics": {
                "conversionRate": 0,
                "candidateQuality": 0,
                "diversityScore": 0,
                "avgTimeToHire": 0,
                "averageJobAtsScore": 0,
                "averageFinalScore": 0,
                "totalJobsAnalyzed": 0,
                "totalCandidateReports": 0,
                "hiringFunnel": [
                    {"stage": "Applications", "count": 0, "percentage": 0},
                    {"stage": "Screened", "count": 0, "percentage": 0},
                    {"stage": "Interviewed", "count": 0, "percentage": 0},
                    {"stage": "Offers Sent", "count": 0, "percentage": 0},
                    {"stage": "Hired", "count": 0, "percentage": 0},
                ],
            },
            "jobAnalysis": [],
            "candidateComparison": [],
            "scoreDistributions": {"jobAts": score_distribution([]), "final": score_distribution([])},
            "aiInsights": {
                "summary": "Analytics could not fully load because one report record needs refresh.",
                "recommendations": ["Reload Analytics or open Candidates to review applications manually."],
                "riskFlags": ["A legacy application report caused a safe fallback response."],
            },
        }


@router.get("/recruiter/profile")
def get_recruiter_dashboard_profile(
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    profile = ensure_recruiter_profile(db, current_user)
    return {"profile": serialize_recruiter_profile(current_user, profile, db)}


@router.post("/recruiter/upload-photo")
async def upload_recruiter_photo(
    request: Request,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    file_bytes, mime_type = await read_profile_photo_upload(request)
    profile = ensure_recruiter_profile(db, current_user)
    version = uuid.uuid4().hex
    profile.photo_content = file_bytes
    profile.photo_mime_type = mime_type
    profile.photo_url = f"/api/dashboard/profile-photos/recruiter/{current_user.id}?v={version}"
    db.commit()
    db.refresh(profile)
    return {"message": "Profile photo updated successfully", "profile": serialize_recruiter_profile(current_user, profile, db)}


@router.put("/recruiter/profile")
def update_recruiter_dashboard_profile(
    payload: RecruiterDashboardProfileUpdate,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    profile = ensure_recruiter_profile(db, current_user)
    data = payload.model_dump(exclude_unset=True)

    full_name = data.pop("full_name", None)
    if full_name is not None:
        current_user.full_name = full_name

    for field, value in data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(current_user)
    db.refresh(profile)
    return {
        "message": "Profile updated successfully",
        "profile": serialize_recruiter_profile(current_user, profile, db),
    }
