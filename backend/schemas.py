from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from models import UserRole


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)


class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    role: UserRole


class UserCreate(UserBase):
    password: str = Field(min_length=6)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class UserResponse(UserBase, ORMModel):
    id: int
    is_active: bool
    is_verified: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class OAuthLogin(BaseModel):
    provider: str
    access_token: str


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


class CandidateProfileResponse(CandidateProfileBase, ORMModel):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


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


class RecruiterProfileResponse(RecruiterProfileBase, ORMModel):
    id: int
    user_id: int
    is_company_verified: bool
    created_at: datetime
    updated_at: Optional[datetime] = None


class RecruiterCreateRequest(BaseModel):
    full_name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=6)
    company_name: str = "Invenia AI"
    company_description: Optional[str] = None
    company_website: Optional[str] = None
    company_size: Optional[str] = None
    industry: Optional[str] = None
    job_title: str = "Recruiter"
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None


class RecruiterAccessUpdate(BaseModel):
    is_active: bool


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


class JobPostingResponse(JobPostingBase, ORMModel):
    id: int
    recruiter_id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None


class JobApplicationBase(BaseModel):
    cover_letter: Optional[str] = None
    resume_url: Optional[str] = None


class JobApplicationCreate(JobApplicationBase):
    job_id: int


class JobApplicationUpdate(BaseModel):
    status: Optional[str] = None


class JobApplicationResponse(JobApplicationBase, ORMModel):
    id: int
    job_id: int
    candidate_id: int
    status: str
    applied_at: datetime
    updated_at: Optional[datetime] = None


class JobActionRequest(BaseModel):
    job_id: int


class CandidateDashboardProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
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


class RecruiterDashboardProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    company_description: Optional[str] = None
    company_website: Optional[str] = None
    company_size: Optional[str] = None
    industry: Optional[str] = None
    job_title: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None


class InterviewCreate(BaseModel):
    application_id: int
    interview_type: str
    scheduled_at: datetime
    duration_minutes: int = 60
    location: Optional[str] = None
    notes: Optional[str] = None


class InterviewUpdate(BaseModel):
    interview_type: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
