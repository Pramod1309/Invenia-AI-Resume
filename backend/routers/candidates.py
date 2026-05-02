from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import get_current_candidate_user
from database import get_db
from models import CandidateProfile, User
from schemas import (
    CandidateProfileCreate,
    CandidateProfileResponse,
    CandidateProfileUpdate,
)

router = APIRouter()


def ensure_candidate_profile(db: Session, user: User) -> CandidateProfile:
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user.id).first()
    if profile is None:
        profile = CandidateProfile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.post("/profile", response_model=CandidateProfileResponse)
def create_candidate_profile(
    profile: CandidateProfileCreate,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    db_profile = ensure_candidate_profile(db, current_user)
    for field, value in profile.model_dump(exclude_unset=True).items():
        setattr(db_profile, field, value)
    db.commit()
    db.refresh(db_profile)
    return db_profile


@router.get("/profile", response_model=CandidateProfileResponse)
def get_candidate_profile(
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    return ensure_candidate_profile(db, current_user)


@router.put("/profile", response_model=CandidateProfileResponse)
def update_candidate_profile(
    profile_update: CandidateProfileUpdate,
    current_user: User = Depends(get_current_candidate_user),
    db: Session = Depends(get_db),
):
    profile = ensure_candidate_profile(db, current_user)
    for field, value in profile_update.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile
