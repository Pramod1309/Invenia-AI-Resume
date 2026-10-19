import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

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
    "https://frontend-production-a792.up.railway.app",
    "https://frontend-production-fad4.up.railway.app",
    "https://inveniatechlabs.in",
    "https://www.inveniatechlabs.in",
    "https://api.inveniatechlabs.in",
]

extra_origins_raw = os.getenv("CORS_ORIGINS") or os.getenv("ALLOWED_ORIGINS", "")
extra_origins = extra_origins_raw.split(",")
allowed_origins = frontend_origins + [origin.strip() for origin in extra_origins if origin.strip()]
allowed_origin_regex = os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.railway\.app").strip() or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
(UPLOADS_DIR / "resumes").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)))

app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(candidates.router, prefix="/api/candidates", tags=["candidates"])
app.include_router(recruiters.router, prefix="/api/recruiters", tags=["recruiters"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])

static_dir = Path(__file__).resolve().parent / "static"


def ensure_super_recruiter() -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == SUPER_RECRUITER_EMAIL).first()
        if user is None:
            try:
                hashed_password = get_password_hash(SUPER_RECRUITER_PASSWORD)
            except Exception as e:
                print(f"Error hashing password: {e}")
                hashed_password = "fallback_hash_temp"

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
        else:
            user.username = user.username or SUPER_RECRUITER_EMAIL
            user.full_name = user.full_name or "Pramod Jadhav"
            user.role = UserRole.RECRUITER
            user.is_active = True
            user.is_verified = True
            if not user.hashed_password or "fallback" in user.hashed_password:
                try:
                    user.hashed_password = get_password_hash(SUPER_RECRUITER_PASSWORD)
                except Exception as e:
                    print(f"Error hashing password: {e}")
                    user.hashed_password = "fallback_hash_temp"

        db.flush()

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
    except Exception as e:
        print(f"Error in ensure_super_recruiter: {e}")
        db.rollback()
    finally:
        db.close()


def ensure_column(table_name: str, column_name: str, column_ddl: str, inspector=None) -> None:
    inspector = inspector or inspect(engine)
    table_names = inspector.get_table_names()
    if table_name not in table_names:
        return

    existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
    if column_name in existing_columns:
        return

    with engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_ddl}"))


def run_lightweight_migrations() -> None:
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)

    columns_to_add = [
        ("candidate_profiles", "resume_name", "VARCHAR"),
        ("candidate_profiles", "photo_url", "VARCHAR"),
        ("candidate_profiles", "photo_content", "BYTEA"),
        ("candidate_profiles", "photo_mime_type", "VARCHAR"),
        ("candidate_profiles", "resume_content", "BYTEA"),
        ("candidate_profiles", "resume_mime_type", "VARCHAR"),
        ("candidate_profiles", "ats_score", "INTEGER"),
        ("candidate_profiles", "ats_summary", "TEXT"),
        ("candidate_profiles", "ats_breakdown", "TEXT"),
        ("candidate_profiles", "ats_last_checked_at", "DATETIME"),
        ("recruiter_profiles", "photo_url", "VARCHAR"),
        ("recruiter_profiles", "photo_content", "BYTEA"),
        ("recruiter_profiles", "photo_mime_type", "VARCHAR"),
        ("job_postings", "assessment_config", "TEXT"),
        ("job_postings", "salary_currency", "VARCHAR"),
        ("job_postings", "salary_period", "VARCHAR"),
        ("job_postings", "view_count", "INTEGER DEFAULT 0"),
        ("job_applications", "job_match_score", "INTEGER"),
        ("job_applications", "resume_name", "VARCHAR"),
        ("job_applications", "resume_content", "BYTEA"),
        ("job_applications", "resume_mime_type", "VARCHAR"),
        ("job_applications", "workflow_stage", "VARCHAR DEFAULT 'profile'"),
        ("job_applications", "workflow_state", "TEXT"),
        ("job_applications", "final_score", "INTEGER"),
        ("job_applications", "interview_transcript", "TEXT"),
        ("job_applications", "interview_turns", "TEXT"),
        ("job_applications", "interview_report", "TEXT"),
        ("job_applications", "interview_recorded_at", "TIMESTAMP WITH TIME ZONE"),
        ("job_applications", "interview_recording_content", "BYTEA"),
        ("job_applications", "interview_recording_name", "VARCHAR"),
        ("job_applications", "interview_recording_mime_type", "VARCHAR"),
        ("job_applications", "interview_snapshot_content", "BYTEA"),
        ("job_applications", "interview_snapshot_name", "VARCHAR"),
        ("job_applications", "interview_snapshot_mime_type", "VARCHAR"),
    ]

    for table_name, column_name, column_ddl in columns_to_add:
        ensure_column(table_name, column_name, column_ddl, inspector=inspector)


@app.on_event("startup")
def startup_event():
    print("Invenia AI Backend starting up...")
    run_lightweight_migrations()
    ensure_super_recruiter()
    if static_dir.exists():
        print(f"Serving frontend from: {static_dir}")
    else:
        print(f"Static directory not found at {static_dir}")


@app.get("/")
def read_root_page():
    return {"message": "Welcome to Invenia AI API"}


@app.get("/api")
def read_root():
    return {"message": "Welcome to Invenia AI API"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Invenia AI Backend"}


@app.post("/api/init-db")
def init_database():
    run_lightweight_migrations()
    ensure_super_recruiter()
    return {"message": "Database initialized successfully"}


# Mount the built frontend last so local POST /api/* calls do not get intercepted by StaticFiles.
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="frontend")


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"Starting server on port {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port)
