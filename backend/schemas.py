from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
from models import UserRole

# User schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    role: UserRole

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Authentication schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class OAuthLogin(BaseModel):
    provider: str  # google, github, linkedin
    access_token: str

# Candidate Profile schemas
class CandidateProfileBase(BaseModel):
    phone: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    resume_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    experience_years: Optional[int] = None
    current_job_title: Optional[str] = None
    current_company: Optional[str] = None
    skills: Optional[str] = None
    preferred_job_types: Optional[str] = None
    preferred_locations: Optional[str] = None
    salary_expectation: Optional[str] = None
    is_available: bool = True

class CandidateProfileCreate(CandidateProfileBase):
    pass

class CandidateProfileUpdate(BaseModel):
    phone: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    resume_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    experience_years: Optional[int] = None
    current_job_title: Optional[str] = None
    current_company: Optional[str] = None
    skills: Optional[str] = None
    preferred_job_types: Optional[str] = None
    preferred_locations: Optional[str] = None
    salary_expectation: Optional[str] = None
    is_available: Optional[bool] = None

class CandidateProfileResponse(CandidateProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Recruiter Profile schemas
class RecruiterProfileBase(BaseModel):
    company_name: str
    company_description: Optional[str] = None
    company_website: Optional[str] = None
    company_size: Optional[str] = None
    industry: Optional[str] = None
    job_title: str
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None

class RecruiterProfileCreate(RecruiterProfileBase):
    pass

class RecruiterProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    company_description: Optional[str] = None
    company_website: Optional[str] = None
    company_size: Optional[str] = None
    industry: Optional[str] = None
    job_title: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None

class RecruiterProfileResponse(RecruiterProfileBase):
    id: int
    user_id: int
    is_company_verified: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Job Posting schemas
class JobPostingBase(BaseModel):
    title: str
    description: str
    requirements: Optional[str] = None
    responsibilities: Optional[str] = None
    benefits: Optional[str] = None
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    location: Optional[str] = None
    is_remote: bool = False

class JobPostingCreate(JobPostingBase):
    pass

class JobPostingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    responsibilities: Optional[str] = None
    benefits: Optional[str] = None
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    location: Optional[str] = None
    is_remote: Optional[bool] = None
    is_active: Optional[bool] = None

class JobPostingResponse(JobPostingBase):
    id: int
    recruiter_id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Job Application schemas
class JobApplicationBase(BaseModel):
    cover_letter: Optional[str] = None
    resume_url: Optional[str] = None

class JobApplicationCreate(JobApplicationBase):
    job_id: int

class JobApplicationUpdate(BaseModel):
    status: Optional[str] = None

class JobApplicationResponse(JobApplicationBase):
    id: int
    job_id: int
    candidate_id: int
    status: str
    applied_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
