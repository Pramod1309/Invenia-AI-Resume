import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import get_current_candidate_user, get_current_recruiter_user, is_super_recruiter
from database import get_db
from models import (
    CandidateProfile,
    Interview,
    JobApplication,
    JobPosting,
    RecruiterProfile,
    SavedJob,
    User,
    UserRole,
)
from schemas import (
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

router = APIRouter()

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads" / "resumes"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


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


def dump_list_field(items: list[str]) -> str:
    return json.dumps([item.strip() for item in items if item and item.strip()])


def calculate_match_score(candidate_skills: list[str], job_skills: list[str]) -> int:
    normalized_candidate = {skill.lower() for skill in candidate_skills if skill}
    normalized_job = {skill.lower() for skill in job_skills if skill}
    if not normalized_job and not normalized_candidate:
        return 75
    if not normalized_job:
        return 80
    if not normalized_candidate:
        return 45
    overlap = len(normalized_candidate & normalized_job)
    coverage = overlap / max(1, len(normalized_job))
    return max(35, min(99, round(coverage * 100)))


def calculate_profile_completion(user: User, profile: CandidateProfile) -> int:
    checks = [
        user.full_name,
        user.email,
        profile.phone,
        profile.location,
        profile.bio,
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
    if job.salary_min and job.salary_max:
        return f"${job.salary_min:,} - ${job.salary_max:,}"
    if job.salary_min:
        return f"From ${job.salary_min:,}"
    if job.salary_max:
        return f"Up to ${job.salary_max:,}"
    return "Competitive"


def application_next_step(status: str, interview: Optional[Interview]) -> str:
    if interview and interview.scheduled_at:
        return f"Interview scheduled for {interview.scheduled_at.strftime('%d %b %Y, %I:%M %p')}"
    mapping = {
        "pending": "Application received",
        "reviewed": "Recruiter is reviewing your profile",
        "shortlisted": "You have been shortlisted",
        "interview": "Interview will be scheduled soon",
        "offer": "Offer discussion is in progress",
        "rejected": "Application closed",
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


def serialize_candidate_profile(user: User, profile: CandidateProfile) -> dict:
    skills = parse_list_field(profile.skills)
    preferred_job_types = parse_list_field(profile.preferred_job_types)
    preferred_locations = parse_list_field(profile.preferred_locations)
    return {
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
        "current_company": profile.current_company or "",
        "skills": skills,
        "preferred_job_types": preferred_job_types,
        "preferred_locations": preferred_locations,
        "salary_expectation": profile.salary_expectation or "",
        "is_available": profile.is_available,
        "completion": calculate_profile_completion(user, profile),
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
        "title": job.title,
        "company": company_name,
        "location": "Remote" if job.is_remote else (job.location or "Location not specified"),
        "salary": format_salary(job),
        "type": job.job_type or "Full-time",
        "postedDate": job.created_at.isoformat() if job.created_at else None,
        "description": job.description,
        "requirements": job_skills,
        "skills": job_skills,
        "matchScore": match_score,
        "applicants": len(job.applications),
        "isSaved": job.id in saved_job_ids,
        "isApplied": job.id in applied_job_ids,
        "experienceLevel": job.experience_level or "",
        "isRemote": job.is_remote,
    }


def serialize_job_for_recruiter(job: JobPosting, all_candidate_profiles: list[CandidateProfile]) -> dict:
    job_skills = parse_list_field(job.requirements)
    scores = [
        calculate_match_score(parse_list_field(profile.skills), job_skills)
        for profile in all_candidate_profiles
        if profile.skills
    ]
    average_match = round(sum(scores) / len(scores)) if scores else 0
    applications = len(job.applications)
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
        "title": job.title,
        "company": job.recruiter.company_name if job.recruiter else "Invenia AI",
        "location": "Remote" if job.is_remote else (job.location or "Location not specified"),
        "type": job.job_type or "Full-time",
        "salary": format_salary(job),
        "salaryMin": job.salary_min,
        "salaryMax": job.salary_max,
        "applications": applications,
        "views": max(applications * 3, saved_count * 2, applications),
        "matchScore": average_match,
        "status": "active" if job.is_active else "inactive",
        "description": job.description,
        "skills": job_skills,
        "requirementsText": ", ".join(job_skills),
        "responsibilities": job.responsibilities or "",
        "benefits": job.benefits or "",
        "postedDate": job.created_at.isoformat() if job.created_at else None,
        "experienceLevel": job.experience_level or "",
        "isRemote": job.is_remote,
        "shortlistedCount": shortlisted_count,
        "interviewedCount": interviewed_count,
        "timeToFillDays": time_to_fill_days,
        "diversityScore": diversity_score,
    }


def get_period_start(period: str) -> datetime:
    now = datetime.utcnow()
    if period == "year":
        return now - timedelta(days=365)
    if period == "month":
        return now - timedelta(days=30)
    return now - timedelta(days=7)


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
    if search:
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

    if filter_type == "saved":
        jobs = [job for job in jobs if job["isSaved"]]
    elif filter_type == "applied":
        jobs = [job for job in jobs if job["isApplied"]]

    return {"jobs": jobs}


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
        items.append(
            {
                "id": application.id,
                "jobId": job.id,
                "jobTitle": job.title,
                "company": recruiter_profile.company_name if recruiter_profile else "Invenia AI",
                "status": application.status,
                "appliedDate": application.applied_at.isoformat() if application.applied_at else None,
                "nextStep": application_next_step(application.status, interview),
                "matchScore": calculate_match_score(
                    parse_list_field(profile.skills),
                    parse_list_field(job.requirements),
                ),
                "resumeUrl": application.resume_url,
            }
        )
    return {"applications": items}


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

    existing = (
        db.query(JobApplication)
        .filter(JobApplication.job_id == job.id, JobApplication.candidate_id == profile.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already applied to this job")

    application = JobApplication(
        job_id=job.id,
        candidate_id=profile.id,
        cover_letter=payload.cover_letter,
        resume_url=profile.resume_url,
        status="pending",
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    return {"message": "Application submitted successfully", "application_id": application.id}


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


@router.get("/candidate/profile")
def get_candidate_profile(
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    return {"profile": serialize_candidate_profile(current_user, profile)}


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


@router.post("/candidate/upload-resume")
def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    allowed_extensions = {".pdf", ".doc", ".docx"}
    extension = Path(file.filename or "").suffix.lower()
    if extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Only PDF, DOC, and DOCX files are allowed")

    filename = f"{current_user.id}_{uuid.uuid4().hex}{extension}"
    file_path = UPLOADS_DIR / filename
    file_path.write_bytes(file.file.read())

    profile = ensure_candidate_profile(db, current_user)
    profile.resume_url = f"/uploads/resumes/{filename}"
    db.commit()
    db.refresh(profile)

    return {
        "message": "Resume uploaded successfully",
        "resume_url": profile.resume_url,
        "resume_name": file.filename,
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
    new_applications = [
        application
        for application in applications
        if application.applied_at and application.applied_at >= datetime.utcnow() - timedelta(days=7)
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
        recent_applications.append(
            {
                "id": application.id,
                "name": candidate.full_name if candidate and candidate.full_name else (candidate.username if candidate else "Candidate"),
                "email": candidate.email if candidate else "",
                "position": application.job.title,
                "status": application.status,
                "appliedDate": application.applied_at.isoformat() if application.applied_at else None,
                "matchScore": calculate_match_score(
                    parse_list_field(application.candidate.skills if application.candidate else ""),
                    parse_list_field(application.job.requirements),
                ),
                "resumeUrl": application.resume_url,
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
            if interview.status == "scheduled" and interview.scheduled_at and interview.scheduled_at >= datetime.utcnow()
        ],
        key=lambda item: item["time"],
    )[:5]

    return {
        "analytics": {
            "totalJobs": len(jobs),
            "activeJobs": len([job for job in jobs if job.is_active]),
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
    if search:
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
    return {"jobs": jobs}


@router.post("/recruiter/jobs")
def create_job(
    payload: JobPostingCreate,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    profile = ensure_recruiter_profile(db, current_user)
    job = JobPosting(recruiter_id=profile.id, **payload.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return {"message": "Job created successfully", "job_id": job.id}


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

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(job, field, value)

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
        items.append(
            {
                "id": application.id,
                "candidateId": candidate_user.id if candidate_user else None,
                "name": candidate_user.full_name if candidate_user and candidate_user.full_name else (candidate_user.username if candidate_user else "Candidate"),
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
            }
        )
    return {"applications": items}


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
        application.status = payload.status
        db.commit()
        db.refresh(application)

    return {"message": "Application updated successfully"}


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

        item = {
            "id": user.id,
            "name": user.full_name or user.username,
            "email": user.email,
            "registeredAt": user.created_at.isoformat() if user.created_at else None,
            "isVerified": user.is_verified,
            "status": latest_application.status if latest_application else ("available" if profile and profile.is_available else "new"),
            "phone": profile.phone if profile else "",
            "location": profile.location if profile else "",
            "title": profile.current_job_title if profile else "",
            "experienceYears": profile.experience_years if profile and profile.experience_years else 0,
            "skills": profile_skills,
            "resumeUrl": profile.resume_url if profile else None,
            "isAvailable": profile.is_available if profile else False,
            "applicationCount": len(relevant_applications),
            "lastAppliedAt": latest_application.applied_at.isoformat() if latest_application and latest_application.applied_at else None,
            "latestApplicationId": latest_application.id if latest_application else None,
            "latestJobTitle": latest_application.job.title if latest_application and latest_application.job else "",
            "matchScore": round(sum(match_scores) / len(match_scores)) if match_scores else 0,
            "bio": profile.bio if profile else "",
        }

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
        if status == "new" and item["applicationCount"] > 0:
            continue

        candidates.append(item)

    return {"candidates": candidates}


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


@router.get("/recruiter/analytics")
def get_analytics(
    period: str = Query("week"),
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    period_start = get_period_start(period)
    jobs = [
        job
        for job in get_recruiter_jobs_query(db, current_user).all()
        if not job.created_at or job.created_at >= period_start
    ]
    job_ids = [job.id for job in jobs]
    applications = []
    if job_ids:
        applications = [
            application
            for application in db.query(JobApplication).filter(JobApplication.job_id.in_(job_ids)).all()
            if not application.applied_at or application.applied_at >= period_start
        ]

    screened = [application for application in applications if application.status in {"reviewed", "shortlisted", "interview", "offer", "hired"}]
    interviewed = [application for application in applications if application.status in {"interview", "offer", "hired"}]
    offers_sent = [application for application in applications if application.status in {"offer", "hired"}]
    hired = [application for application in applications if application.status == "hired"]

    match_scores = [
        calculate_match_score(
            parse_list_field(application.candidate.skills if application.candidate else ""),
            parse_list_field(application.job.requirements),
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
        (application.applied_at - application.job.created_at).days
        for application in hired
        if application.applied_at and application.job and application.job.created_at
    ]
    if hire_durations:
        avg_time_to_hire = round(sum(hire_durations) / len(hire_durations))

    return {
        "analytics": {
            "conversionRate": round((len(hired) / max(1, len(applications))) * 100) if applications else 0,
            "candidateQuality": candidate_quality,
            "diversityScore": diversity_score,
            "avgTimeToHire": avg_time_to_hire,
            "hiringFunnel": [
                {"stage": "Applications", "count": len(applications), "percentage": 100 if applications else 0},
                {"stage": "Screened", "count": len(screened), "percentage": round((len(screened) / max(1, len(applications))) * 100) if applications else 0},
                {"stage": "Interviewed", "count": len(interviewed), "percentage": round((len(interviewed) / max(1, len(applications))) * 100) if applications else 0},
                {"stage": "Offers Sent", "count": len(offers_sent), "percentage": round((len(offers_sent) / max(1, len(applications))) * 100) if applications else 0},
                {"stage": "Hired", "count": len(hired), "percentage": round((len(hired) / max(1, len(applications))) * 100) if applications else 0},
            ],
        }
    }


@router.get("/recruiter/profile")
def get_recruiter_dashboard_profile(
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    profile = ensure_recruiter_profile(db, current_user)
    return {"profile": serialize_recruiter_profile(current_user, profile, db)}


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
