from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional
import uvicorn

from database import get_db, engine
from models import Base
from schemas import UserCreate, UserResponse, Token
from auth import authenticate_user, create_access_token, get_current_user
from routers import auth, users, candidates, recruiters

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Invenia AI API",
    description="AI-powered recruitment platform",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(candidates.router, prefix="/api/candidates", tags=["candidates"])
app.include_router(recruiters.router, prefix="/api/recruiters", tags=["recruiters"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Invenia AI API"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "Invenia AI Backend"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
