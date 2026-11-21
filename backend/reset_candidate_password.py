import sys
from pathlib import Path

# Add the parent directory to the path to import from the backend
sys.path.insert(0, str(Path(__file__).parent))

from auth import get_password_hash
from database import SessionLocal
from models import User

def reset_candidate_password(email: str, new_password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"User with email {email} not found.")
            return False
        
        if user.role.value != "candidate":
            print(f"User {email} is not a candidate. Role: {user.role.value}")
            return False
        
        user.hashed_password = get_password_hash(new_password)
        db.commit()
        print(f"Password reset successfully for {email}")
        print(f"New password: {new_password}")
        return True
    except Exception as e:
        print(f"Error resetting password: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    email = "pramodjadhav1309@gmail.com"
    new_password = "Pramod@1309"
    reset_candidate_password(email, new_password)
