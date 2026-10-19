import os
import secrets
from datetime import timedelta

import requests
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    GOOGLE_CLIENT_ID,
    GOOGLE_USER_INFO_URL,
    authenticate_user,
    create_access_token,
    get_current_active_user,
    get_password_hash,
)
from database import get_db
from models import CandidateProfile, User, UserRole
from schemas import OAuthLogin, Token, UserCreate, UserResponse

router = APIRouter()
GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo"


def validate_unique_user(db: Session, email: str, username: str) -> None:
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already taken")


@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    if user.role != UserRole.CANDIDATE:
        raise HTTPException(
            status_code=403,
            detail="Recruiter accounts can only be created by the super recruiter",
        )

    validate_unique_user(db, user.email, user.username)

    db_user = User(
        email=user.email,
        username=user.username,
        hashed_password=get_password_hash(user.password),
        full_name=user.full_name,
        role=UserRole.CANDIDATE,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    existing_user = db.query(User).filter(
        or_(User.username == form_data.username, User.email == form_data.username)
    ).first()
    if existing_user and not existing_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is deactivated. Please contact the administration.",
        )

    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    form = await request.form()
    requested_role = (form.get("user_type") or "").strip().lower()
    if requested_role:
        try:
            expected_role = UserRole(requested_role)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid login type") from exc

        if user.role != expected_role:
            raise HTTPException(
                status_code=403,
                detail=(
                    "This account does not have recruiter access"
                    if expected_role == UserRole.RECRUITER
                    else "This account does not have candidate access"
                ),
            )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.post("/oauth/google")
def oauth_google_login(oauth_data: OAuthLogin, db: Session = Depends(get_db)):
    if oauth_data.provider.strip().lower() != "google":
        raise HTTPException(status_code=400, detail="Invalid OAuth provider")
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")

    try:
        token_response = requests.get(
            GOOGLE_TOKEN_INFO_URL,
            params={"access_token": oauth_data.access_token},
            timeout=10,
        )
        token_response.raise_for_status()
        token_info = token_response.json()
        token_audience = token_info.get("aud") or token_info.get("audience") or token_info.get("issued_to")
        if token_audience != GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=401, detail="Google token was issued for another application")
        if int(token_info.get("expires_in", "0")) <= 0:
            raise HTTPException(status_code=401, detail="Google sign-in session has expired")

        response = requests.get(
            GOOGLE_USER_INFO_URL,
            headers={"Authorization": f"Bearer {oauth_data.access_token}"},
            timeout=10,
        )
        response.raise_for_status()
        user_info = response.json()
        google_id = str(user_info.get("id") or "").strip()
        email = str(user_info.get("email") or "").strip().lower()
        if not google_id or not email or not user_info.get("verified_email"):
            raise HTTPException(status_code=401, detail="Google account email could not be verified")

        user = db.query(User).filter(User.google_id == google_id).first()
        if not user:
            user = db.query(User).filter(User.email == email).first()
        if user and not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is deactivated. Please contact the administration.",
            )
        if user and user.role != UserRole.CANDIDATE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This Google sign-in option is available only for candidates.",
            )
        if user:
            user.google_id = google_id
            user.is_verified = True
        else:
            username_base = email.split("@")[0]
            username = username_base
            suffix = 1
            while db.query(User).filter(User.username == username).first():
                suffix += 1
                username = f"{username_base}{suffix}"
            user = User(
                email=email,
                username=username,
                full_name=user_info.get("name"),
                hashed_password=get_password_hash(secrets.token_urlsafe(32)),
                google_id=google_id,
                is_verified=True,
                role=UserRole.CANDIDATE,
                is_active=True,
            )
            db.add(user)
            db.flush()

        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user.id).first()
        if profile is None:
            db.add(CandidateProfile(user_id=user.id))

        db.commit()
        db.refresh(user)

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username},
            expires_delta=access_token_expires,
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        db.rollback()
        raise
    except (requests.RequestException, SQLAlchemyError, ValueError, TypeError) as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Google sign-in could not be verified") from exc


@router.post("/oauth/github")
def oauth_github_login(oauth_data: OAuthLogin, db: Session = Depends(get_db)):
    try:
        response = requests.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {oauth_data.access_token}"},
        )
        response.raise_for_status()
        user_info = response.json()

        email_response = requests.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"token {oauth_data.access_token}"},
        )
        email_response.raise_for_status()
        emails = email_response.json()
        primary_email = next((email["email"] for email in emails if email["primary"]), None)

        if not primary_email:
            raise HTTPException(status_code=400, detail="No primary email found")

        user = db.query(User).filter(User.github_id == str(user_info["id"])).first()
        if not user:
            user = db.query(User).filter(User.email == primary_email).first()
        if user and not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is deactivated. Please contact the administration.",
            )
        if user:
            user.github_id = str(user_info["id"])
            user.is_verified = True
        else:
            username = user_info.get("login", primary_email.split("@")[0])
            validate_unique_user(db, primary_email, username)
            user = User(
                email=primary_email,
                username=username,
                full_name=user_info.get("name"),
                github_id=str(user_info["id"]),
                is_verified=True,
                role=UserRole.CANDIDATE,
            )
            db.add(user)

        db.commit()
        db.refresh(user)

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username},
            expires_delta=access_token_expires,
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"OAuth login failed: {exc}") from exc
