from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import (
    SUPER_RECRUITER_EMAIL,
    get_current_recruiter_user,
    get_current_super_recruiter,
    get_password_hash,
    is_super_recruiter,
)
from database import get_db
from models import JobApplication, JobPosting, RecruiterProfile, User, UserRole
from schemas import (
    RecruiterAccessUpdate,
    RecruiterCreateRequest,
    RecruiterProfileResponse,
    RecruiterProfileUpdate,
)

router = APIRouter()


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


def serialize_recruiter(user: User, profile: RecruiterProfile, db: Session) -> dict:
    job_ids = [
        job.id
        for job in db.query(JobPosting).filter(JobPosting.recruiter_id == profile.id).all()
    ]
    application_count = 0
    if job_ids:
        application_count = (
            db.query(JobApplication)
            .filter(JobApplication.job_id.in_(job_ids))
            .count()
        )

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role.value,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "created_at": user.created_at,
        "is_super_recruiter": is_super_recruiter(user),
        "profile": {
            "company_name": profile.company_name,
            "company_description": profile.company_description,
            "company_website": profile.company_website,
            "company_size": profile.company_size,
            "industry": profile.industry,
            "job_title": profile.job_title,
            "phone": profile.phone,
            "linkedin_url": profile.linkedin_url,
            "is_company_verified": profile.is_company_verified,
        },
        "stats": {
            "jobs_posted": len(job_ids),
            "applications_received": application_count,
        },
    }


@router.get("/profile", response_model=RecruiterProfileResponse)
def get_recruiter_profile(
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    return ensure_recruiter_profile(db, current_user)


@router.put("/profile", response_model=RecruiterProfileResponse)
def update_recruiter_profile(
    profile_update: RecruiterProfileUpdate,
    current_user: User = Depends(get_current_recruiter_user),
    db: Session = Depends(get_db),
):
    profile = ensure_recruiter_profile(db, current_user)
    for field, value in profile_update.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/manage/list")
def list_recruiters(
    current_user: User = Depends(get_current_super_recruiter),
    db: Session = Depends(get_db),
):
    recruiters = db.query(User).filter(User.role == UserRole.RECRUITER).order_by(User.created_at.desc()).all()
    data = []
    for recruiter in recruiters:
        profile = ensure_recruiter_profile(db, recruiter)
        data.append(serialize_recruiter(recruiter, profile, db))
    return {"recruiters": data, "super_recruiter_email": SUPER_RECRUITER_EMAIL}


@router.post("/manage")
def create_recruiter(
    payload: RecruiterCreateRequest,
    current_user: User = Depends(get_current_super_recruiter),
    db: Session = Depends(get_db),
):
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    recruiter = User(
        email=payload.email,
        username=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=UserRole.RECRUITER,
        is_active=True,
        is_verified=True,
    )
    db.add(recruiter)
    db.commit()
    db.refresh(recruiter)

    profile = RecruiterProfile(
        user_id=recruiter.id,
        company_name=payload.company_name,
        company_description=payload.company_description,
        company_website=payload.company_website,
        company_size=payload.company_size,
        industry=payload.industry,
        job_title=payload.job_title,
        phone=payload.phone,
        linkedin_url=payload.linkedin_url,
        is_company_verified=True,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    return {
        "message": "Recruiter created successfully",
        "recruiter": serialize_recruiter(recruiter, profile, db),
    }


@router.patch("/manage/{user_id}/access")
def update_recruiter_access(
    user_id: int,
    payload: RecruiterAccessUpdate,
    current_user: User = Depends(get_current_super_recruiter),
    db: Session = Depends(get_db),
):
    recruiter = db.query(User).filter(User.id == user_id, User.role == UserRole.RECRUITER).first()
    if recruiter is None:
        raise HTTPException(status_code=404, detail="Recruiter not found")

    if is_super_recruiter(recruiter) and payload.is_active is False:
        raise HTTPException(status_code=400, detail="Super recruiter cannot be deactivated")

    recruiter.is_active = payload.is_active
    db.commit()
    db.refresh(recruiter)

    profile = ensure_recruiter_profile(db, recruiter)
    return {
        "message": "Recruiter access updated successfully",
        "recruiter": serialize_recruiter(recruiter, profile, db),
    }
