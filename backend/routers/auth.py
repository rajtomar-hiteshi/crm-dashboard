import logging
import os
import smtplib
import uuid
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import hash_password, verify_password, create_access_token, get_current_user
from database import get_db
from models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Request / Response schemas ──────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# ── Endpoints ───────────────────────────────────────────────────────

@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account is disabled")

    token = create_access_token({"sub": user.email})

    user.last_login = datetime.utcnow()
    db.commit()

    return {
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        },
    }


@router.post("/logout")
def logout():
    return {"message": "Logged out successfully"}


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()

    if user:
        reset_token = str(uuid.uuid4())
        user.reset_token = reset_token
        user.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
        db.commit()

        reset_link = f"http://35.154.251.140/reset-password?token={reset_token}"

        smtp_host = os.getenv("SMTP_HOST")
        smtp_port = os.getenv("SMTP_PORT")
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")

        if smtp_host and smtp_port and smtp_user and smtp_password:
            try:
                msg = MIMEMultipart()
                msg["From"] = smtp_user
                msg["To"] = user.email
                msg["Subject"] = "Lead Gen CRM - Password Reset"

                body_text = (
                    f"Hi {user.full_name},\n\n"
                    f"You requested a password reset. Click the link below to reset your password:\n\n"
                    f"{reset_link}\n\n"
                    f"This link expires in 1 hour.\n\n"
                    f"If you did not request this, please ignore this email."
                )
                msg.attach(MIMEText(body_text, "plain"))

                with smtplib.SMTP(smtp_host, int(smtp_port)) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_password)
                    server.send_message(msg)

                logger.info(f"Password reset email sent to {user.email}")
            except Exception as e:
                logger.error(f"Failed to send reset email: {e}")
                logger.info(f"Password reset link for {user.email}: {reset_link}")
        else:
            logger.info(f"SMTP not configured. Password reset link for {user.email}: {reset_link}")

    # Always return success to avoid revealing whether the email exists
    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token == body.token).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if user.reset_token_expiry is None or user.reset_token_expiry < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.password_hash = hash_password(body.new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.commit()

    return {"message": "Password has been reset successfully"}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
    }
