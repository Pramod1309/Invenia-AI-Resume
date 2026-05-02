from database import engine, Base
from models import User, CandidateProfile, RecruiterProfile, JobPosting, JobApplication, Interview, SavedJob, Analytics
from sqlalchemy import inspect

def init_database():
    """Initialize the database with all tables"""
    print("Creating database tables...")
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    print("Database tables created successfully!")
    
    # Check if tables exist
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Tables in database: {tables}")

if __name__ == "__main__":
    init_database()
