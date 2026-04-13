from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, CandidateProfile, RecruiterProfile
from schemas import UserResponse, UserUpdate, CandidateProfileResponse, RecruiterProfileResponse
from auth import get_current_active_user

router = APIRouter()

@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.put("/me", response_model=UserResponse)
def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    for field, value in user_update.dict(exclude_unset=True).items():
        setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/me/profile", response_model=dict)
def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if current_user.role.value == "candidate":
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Candidate profile not found")
        return {"user": current_user, "profile": profile}
    elif current_user.role.value == "recruiter":
        profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == current_user.id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Recruiter profile not found")
        return {"user": current_user, "profile": profile}
    else:
        raise HTTPException(status_code=400, detail="Invalid user role")
