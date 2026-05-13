from sqlalchemy import Column, Integer, String, Date, DateTime, Float, UniqueConstraint, func
from database import Base


class DailyActivity(Base):
    __tablename__ = "daily_activity"

    id = Column(Integer, primary_key=True, index=True)
    employee_name = Column(String, nullable=False, index=True)
    activity_date = Column(Date, nullable=False, index=True)
    linkedin_connections = Column(Integer, default=0)
    linkedin_follow_ups = Column(Integer, default=0)
    linkedin_inmails = Column(Integer, default=0)
    emails = Column(Integer, default=0)
    data_extraction = Column(Integer, default=0)
    positive_responses = Column(Integer, default=0)
    lead_generated = Column(Integer, default=0)
    cold_calling = Column(Integer, default=0)
    follow_up_calls = Column(Integer, default=0)
    calls = Column(Integer, default=0)
    source_file = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("employee_name", "activity_date", name="uq_employee_date"),
    )


class PositiveResponseDetail(Base):
    __tablename__ = "positive_responses_detail"

    id = Column(Integer, primary_key=True, index=True)
    employee_name = Column(String, nullable=False, index=True)
    response_date = Column(Date, nullable=False)
    client_name = Column(String)
    company = Column(String)
    location = Column(String)
    quality = Column(String)
    created_at = Column(DateTime, server_default=func.now())


class LeadPipeline(Base):
    __tablename__ = "leads_pipeline"

    id = Column(Integer, primary_key=True, index=True)
    employee_name = Column(String, nullable=False, index=True)
    lead_date = Column(Date, nullable=False)
    client_name = Column(String)
    company = Column(String)
    location = Column(String)
    created_at = Column(DateTime, server_default=func.now())


class SyncLog(Base):
    __tablename__ = "sync_log"

    id = Column(Integer, primary_key=True, index=True)
    sync_time = Column(DateTime, server_default=func.now())
    status = Column(String)
    records_updated = Column(Integer, default=0)
    message = Column(String)
