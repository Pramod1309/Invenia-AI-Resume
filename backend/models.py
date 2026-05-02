from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class UserRole(enum.Enum):
    CANDIDATE = "candidate"
    RECRUITER = "recruiter"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(Enum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # OAuth fields
    google_id = Column(String, unique=True, nullable=True)
    github_id = Column(String, unique=True, nullable=True)
    linkedin_id = Column(String, unique=True, nullable=True)

    # Relationships
    candidate_profile = relationship("CandidateProfile", back_populates="user", uselist=False)
    recruiter_profile = relationship("RecruiterProfile", back_populates="user", uselist=False)

class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Personal information
    phone = Column(String)
    location = Column(String)
    bio = Column(Text)
    resume_url = Column(String)
    portfolio_url = Column(String)
    linkedin_url = Column(String)
    github_url = Column(String)
    
    # Professional information
    experience_years = Column(Integer)
    current_job_title = Column(String)
    current_company = Column(String)
    
    # Skills and preferences
    skills = Column(Text)  # JSON string of skills
    preferred_job_types = Column(Text)  # JSON string
    preferred_locations = Column(Text)  # JSON string
    salary_expectation = Column(String)
    
    # Status
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="candidate_profile")
    applications = relationship("JobApplication", back_populates="candidate")
    saved_jobs = relationship("SavedJob", back_populates="candidate")

class RecruiterProfile(Base):
    __tablename__ = "recruiter_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Company information
    company_name = Column(String, nullable=False)
    company_description = Column(Text)
    company_website = Column(String)
    company_size = Column(String)
    industry = Column(String)
    
    # Personal information
    job_title = Column(String, nullable=False)
    phone = Column(String)
    linkedin_url = Column(String)
    
    # Verification
    is_company_verified = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="recruiter_profile")
    job_postings = relationship("JobPosting", back_populates="recruiter")

class JobPosting(Base):
    __tablename__ = "job_postings"

    id = Column(Integer, primary_key=True, index=True)
    recruiter_id = Column(Integer, ForeignKey("recruiter_profiles.id"), nullable=False)
    
    # Job details
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    requirements = Column(Text)
    responsibilities = Column(Text)
    benefits = Column(Text)
    
    # Job metadata
    job_type = Column(String)  # Full-time, Part-time, Contract, etc.
    experience_level = Column(String)  # Entry, Mid, Senior, etc.
    salary_min = Column(Integer)
    salary_max = Column(Integer)
    location = Column(String)
    is_remote = Column(Boolean, default=False)
    
    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    recruiter = relationship("RecruiterProfile", back_populates="job_postings")
    applications = relationship("JobApplication", back_populates="job")
    saved_jobs = relationship("SavedJob", back_populates="job")

class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("job_postings.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("candidate_profiles.id"), nullable=False)
    
    # Application details
    cover_letter = Column(Text)
    resume_url = Column(String)
    
    # Status
    status = Column(String, default="pending")  # pending, reviewed, shortlisted, rejected, hired
    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    job = relationship("JobPosting", back_populates="applications")
    candidate = relationship("CandidateProfile", back_populates="applications")

class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("job_applications.id"), nullable=False)
    
    # Interview details
    interview_type = Column(String)  # HR, Technical, Final, etc.
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, default=60)
    location = Column(String)  # Can be physical address or meeting link
    notes = Column(Text)
    
    # Status
    status = Column(String, default="scheduled")  # scheduled, completed, cancelled, rescheduled
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    application = relationship("JobApplication")

class SavedJob(Base):
    __tablename__ = "saved_jobs"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidate_profiles.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("job_postings.id"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    candidate = relationship("CandidateProfile", back_populates="saved_jobs")
    job = relationship("JobPosting", back_populates="saved_jobs")

class Analytics(Base):
    __tablename__ = "analytics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Analytics data
    metric_name = Column(String, nullable=False)
    metric_value = Column(String)  # Can be JSON string for complex data
    period = Column(String)  # daily, weekly, monthly
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
