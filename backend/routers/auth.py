import os
from datetime import timedelta

import requests
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    authenticate_user,
    create_access_token,
    get_current_active_user,
    get_password_hash,
)
from database import get_db
from models import User, UserRole
from schemas import OAuthLogin, Token, UserCreate, UserResponse

router = APIRouter()


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
    try:
        response = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {oauth_data.access_token}"},
        )
        response.raise_for_status()
        user_info = response.json()

        user = db.query(User).filter(User.google_id == user_info["id"]).first()
        if not user:
            user = db.query(User).filter(User.email == user_info["email"]).first()
            if user:
                user.google_id = user_info["id"]
                user.is_verified = True
            else:
                validate_unique_user(
                    db,
                    user_info["email"],
                    user_info["email"].split("@")[0],
                )
                user = User(
                    email=user_info["email"],
                    username=user_info["email"].split("@")[0],
                    full_name=user_info.get("name"),
                    google_id=user_info["id"],
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
