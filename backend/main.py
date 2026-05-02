import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from auth import SUPER_RECRUITER_EMAIL, get_password_hash
from database import SessionLocal, engine
from models import Base, RecruiterProfile, User, UserRole
from routers import auth, candidates, dashboard, recruiters, users

SUPER_RECRUITER_PASSWORD = os.getenv("SUPER_RECRUITER_PASSWORD", "Pramod@1309")
UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"

app = FastAPI(
    title="Invenia AI API",
    description="AI-powered recruitment platform",
    version="1.0.0",
)

frontend_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]

extra_origins = os.getenv("CORS_ORIGINS", "").split(",")
allowed_origins = frontend_origins + [origin.strip() for origin in extra_origins if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
(UPLOADS_DIR / "resumes").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(candidates.router, prefix="/api/candidates", tags=["candidates"])
app.include_router(recruiters.router, prefix="/api/recruiters", tags=["recruiters"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])


def ensure_super_recruiter() -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == SUPER_RECRUITER_EMAIL).first()
        hashed_password = get_password_hash(SUPER_RECRUITER_PASSWORD)

        if user is None:
            user = User(
                email=SUPER_RECRUITER_EMAIL,
                username=SUPER_RECRUITER_EMAIL,
                hashed_password=hashed_password,
                full_name="Pramod Jadhav",
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.username = user.username or SUPER_RECRUITER_EMAIL
            user.full_name = user.full_name or "Pramod Jadhav"
            user.role = UserRole.RECRUITER
            user.is_active = True
            user.is_verified = True
            user.hashed_password = hashed_password
            db.commit()
            db.refresh(user)

        profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user.id).first()
        if profile is None:
            profile = RecruiterProfile(
                user_id=user.id,
                company_name="Invenia AI",
                company_description="AI-powered recruitment platform.",
                company_website="https://invenia.ai",
                company_size="1-10",
                industry="Recruitment Technology",
                job_title="Super Recruiter",
                is_company_verified=True,
            )
            db.add(profile)
        else:
            profile.company_name = profile.company_name or "Invenia AI"
            profile.job_title = profile.job_title or "Super Recruiter"
            profile.is_company_verified = True

        db.commit()
    finally:
        db.close()


@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)
    ensure_super_recruiter()


@app.get("/")
def read_root():
    return {"message": "Welcome to Invenia AI API"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Invenia AI Backend"}


@app.post("/api/init-db")
def init_database():
    Base.metadata.create_all(bind=engine)
    ensure_super_recruiter()
    return {"message": "Database initialized successfully"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
