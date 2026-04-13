from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from database import get_db
from models import User
from schemas import Token, UserCreate, UserResponse, OAuthLogin
from auth import authenticate_user, create_access_token, get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_active_user
import requests
import os

router = APIRouter()

@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Username already taken"
        )
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password,
        full_name=user.full_name,
        role=user.role
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.post("/oauth/google")
def oauth_google_login(oauth_data: OAuthLogin, db: Session = Depends(get_db)):
    try:
        # Get user info from Google
        response = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {oauth_data.access_token}"}
        )
        response.raise_for_status()
        user_info = response.json()
        
        # Check if user exists
        user = db.query(User).filter(User.google_id == user_info["id"]).first()
        if not user:
            # Check if email is already registered
            user = db.query(User).filter(User.email == user_info["email"]).first()
            if user:
                # Link Google account to existing user
                user.google_id = user_info["id"]
                user.is_verified = True
            else:
                # Create new user
                user = User(
                    email=user_info["email"],
                    username=user_info["email"].split("@")[0],
                    full_name=user_info.get("name"),
                    google_id=user_info["id"],
                    is_verified=True,
                    role="candidate"  # Default role for OAuth users
                )
                db.add(user)
        
        db.commit()
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        
        return {"access_token": access_token, "token_type": "bearer"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth login failed: {str(e)}")

@router.post("/oauth/github")
def oauth_github_login(oauth_data: OAuthLogin, db: Session = Depends(get_db)):
    try:
        # Get user info from GitHub
        response = requests.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {oauth_data.access_token}"}
        )
        response.raise_for_status()
        user_info = response.json()
        
        # Get user email (GitHub requires separate API call for email)
        email_response = requests.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"token {oauth_data.access_token}"}
        )
        email_response.raise_for_status()
        emails = email_response.json()
        primary_email = next((email["email"] for email in emails if email["primary"]), None)
        
        if not primary_email:
            raise HTTPException(status_code=400, detail="No primary email found")
        
        # Check if user exists
        user = db.query(User).filter(User.github_id == str(user_info["id"])).first()
        if not user:
            # Check if email is already registered
            user = db.query(User).filter(User.email == primary_email).first()
            if user:
                # Link GitHub account to existing user
                user.github_id = str(user_info["id"])
                user.is_verified = True
            else:
                # Create new user
                user = User(
                    email=primary_email,
                    username=user_info.get("login", primary_email.split("@")[0]),
                    full_name=user_info.get("name"),
                    github_id=str(user_info["id"]),
                    is_verified=True,
                    role="candidate"  # Default role for OAuth users
                )
                db.add(user)
        
        db.commit()
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        
        return {"access_token": access_token, "token_type": "bearer"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth login failed: {str(e)}")
