from dotenv import load_dotenv
load_dotenv()

import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s: %(message)s")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import dashboard, connections, followups, inmails, positive_responses, leads, activity, sync, drilldown, daily_activity, settings, data
from routers import auth as auth_router

app = FastAPI(title="Lead Gen CRM API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174", "http://35.154.251.140", "https://35.154.251.140"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api")
app.include_router(connections.router, prefix="/api")
app.include_router(followups.router, prefix="/api")
app.include_router(inmails.router, prefix="/api")
app.include_router(positive_responses.router, prefix="/api")
app.include_router(leads.router, prefix="/api")
app.include_router(activity.router, prefix="/api")
app.include_router(sync.router, prefix="/api")
app.include_router(drilldown.router, prefix="/api")
app.include_router(daily_activity.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(data.router, prefix="/api")
app.include_router(auth_router.router, prefix="/api")


@app.on_event("startup")
def seed_users():
    from database import Base, engine, SessionLocal
    from models import User
    from auth import hash_password
    from datetime import datetime

    # Create users table if it doesn't exist
    Base.metadata.create_all(bind=engine, tables=[User.__table__])

    seed_data = [
        {"email": "manoj@hiteshi.com", "full_name": "Manoj", "password": "manoj@12345"},
        {"email": "ishaan@hiteshi.com", "full_name": "Ishaan", "password": "ishaan@12345"},
        {"email": "rajeshwari.parmar@hiteshi.com", "full_name": "Rajeshwari Parmar", "password": "rajeshwari@12345"},
        {"email": "raj.tomar@hiteshi.com", "full_name": "Raj Tomar", "password": "raj@12345"},
    ]

    db = SessionLocal()
    try:
        for u in seed_data:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if not existing:
                user = User(
                    email=u["email"],
                    password_hash=hash_password(u["password"]),
                    full_name=u["full_name"],
                    role="admin",
                    is_active=True,
                    created_at=datetime.utcnow(),
                )
                db.add(user)
                logging.info(f"Seeded user: {u['email']}")
        db.commit()
    except Exception as e:
        db.rollback()
        logging.error(f"Error seeding users: {e}")
    finally:
        db.close()


@app.get("/")
def root():
    return {"status": "running", "app": "Lead Gen CRM API", "version": "2.0.0"}
