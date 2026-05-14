"""One-time script to update all user passwords."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from database import SessionLocal
from models import User
from auth import hash_password

PASSWORDS = {
    "manoj@hiteshi.com": "manoj@12345",
    "ishaan@hiteshi.com": "ishaan@12345",
    "rajeshwari.parmar@hiteshi.com": "rajeshwari@12345",
    "raj.tomar@hiteshi.com": "raj@12345",
}

def main():
    db = SessionLocal()
    try:
        for email, pwd in PASSWORDS.items():
            user = db.query(User).filter(User.email == email).first()
            if user:
                user.password_hash = hash_password(pwd)
                print(f"Updated: {email}")
            else:
                print(f"Not found: {email}")
        db.commit()
        print("All passwords updated.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
