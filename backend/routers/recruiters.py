from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, RecruiterProfile
from schemas import RecruiterProfileCreate, RecruiterProfileUpdate, RecruiterProfileResponse
from auth import get_current_active_user

router = APIRouter()

@router.post("/profile", response_model=RecruiterProfileResponse)
def create_recruiter_profile(
    profile: RecruiterProfileCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role.value != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can create recruiter profiles")
    
    # Check if profile already exists
    existing_profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == current_user.id).first()
    if existing_profile:
        raise HTTPException(status_code=400, detail="Profile already exists")
    
    db_profile = RecruiterProfile(user_id=current_user.id, **profile.dict())
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    
    return db_profile

@router.get("/profile", response_model=RecruiterProfileResponse)
def get_recruiter_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role.value != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can view recruiter profiles")
    
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return profile

@router.put("/profile", response_model=RecruiterProfileResponse)
def update_recruiter_profile(
    profile_update: RecruiterProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role.value != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiters can update recruiter profiles")
    
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    for field, value in profile_update.dict(exclude_unset=True).items():
        setattr(profile, field, value)
    
    db.commit()
    db.refresh(profile)
    
    return profile
