from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, CandidateProfile
from schemas import CandidateProfileCreate, CandidateProfileUpdate, CandidateProfileResponse
from auth import get_current_active_user

router = APIRouter()

@router.post("/profile", response_model=CandidateProfileResponse)
def create_candidate_profile(
    profile: CandidateProfileCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role.value != "candidate":
        raise HTTPException(status_code=403, detail="Only candidates can create candidate profiles")
    
    # Check if profile already exists
    existing_profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if existing_profile:
        raise HTTPException(status_code=400, detail="Profile already exists")
    
    db_profile = CandidateProfile(user_id=current_user.id, **profile.dict())
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    
    return db_profile

@router.get("/profile", response_model=CandidateProfileResponse)
def get_candidate_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role.value != "candidate":
        raise HTTPException(status_code=403, detail="Only candidates can view candidate profiles")
    
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return profile

@router.put("/profile", response_model=CandidateProfileResponse)
def update_candidate_profile(
    profile_update: CandidateProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role.value != "candidate":
        raise HTTPException(status_code=403, detail="Only candidates can update candidate profiles")
    
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    for field, value in profile_update.dict(exclude_unset=True).items():
        setattr(profile, field, value)
    
    db.commit()
    db.refresh(profile)
    
    return profile
