import os
import logging
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - DATABASE-ORM - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Base class for ORM models
Base = declarative_base()

# ---------------------------------------------------------
# ORM Models (The Memory Bank)
# ---------------------------------------------------------
class PropertyRecord(Base):
    """Stores massive datasets for real estate underwriting"""
    __tablename__ = 'property_records'
    
    id = Column(Integer, primary_key=True)
    address = Column(String, unique=True, nullable=False)
    zoning_code = Column(String)
    arv_estimate = Column(Float)
    repair_estimate = Column(Float)
    last_satellite_scan = Column(DateTime, default=datetime.datetime.utcnow)

class FleetTelemetry(Base):
    """Stores historical V2X routing and GPR logs for the heavy fleet"""
    __tablename__ = 'fleet_telemetry'
    
    id = Column(Integer, primary_key=True)
    vehicle_id = Column(String, nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)
    status = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class ClientRecord(Base):
    """Stores all active and past clients migrated into the system."""
    __tablename__ = 'client_records'
    
    id = Column(Integer, primary_key=True)
    legacy_id = Column(Integer, unique=True) # Map back to jworden_leads.db
    name = Column(String, nullable=False)
    company = Column(String)
    email = Column(String)
    phone = Column(String)
    address = Column(String)
    city = Column(String)
    state_code = Column(String)
    client_type = Column(String)
    total_revenue = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class LeadRecord(Base):
    """Stores inbound leads captured from websites."""
    __tablename__ = 'lead_records'
    
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    phone = Column(String)
    email = Column(String)
    address = Column(String)
    service_type = Column(String)
    ai_score = Column(Integer, default=0)
    status = Column(String, default="Pending Callback") # Pending Callback, Scheduled, Converted, Dead
    source = Column(String, default="Web") # Web, Voice, Manual
    notes = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ClientJob(Base):
    """Completed and ongoing jobs."""
    __tablename__ = 'client_jobs'
    
    id = Column(Integer, primary_key=True)
    client_id = Column(Integer) # ForeignKey conceptually
    job_number = Column(String, nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, nullable=False) # e.g., Unscheduled, Scheduled, In Progress, Completed
    service_type = Column(String)
    progress_percent = Column(Integer, default=0)
    
    # New FSM Fields
    address = Column(String)
    technician = Column(String)
    scheduled_date = Column(String) # ISO 8601 string for simplicity
    notes = Column(String)
    amount = Column(Float, default=0.0)
    
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ClientEstimate(Base):
    """Estimates given that may or may not have been approved."""
    __tablename__ = 'client_estimates'
    
    id = Column(Integer, primary_key=True)
    client_id = Column(Integer) # ForeignKey conceptually
    estimate_number = Column(String, nullable=False)
    status = Column(String, nullable=False)
    service_type = Column(String)
    amount_low = Column(Float)
    amount_high = Column(Float)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Invoice(Base):
    """Tracks financial invoices issued to clients."""
    __tablename__ = 'invoices'
    
    id = Column(Integer, primary_key=True)
    client_id = Column(Integer)
    job_id = Column(Integer)
    invoice_number = Column(String, unique=True, nullable=False)
    amount_due = Column(Float, nullable=False)
    amount_paid = Column(Float, default=0.0)
    status = Column(String, default="UNPAID") # UNPAID, PARTIAL, PAID
    due_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Payment(Base):
    """Tracks payments against invoices."""
    __tablename__ = 'payments'
    
    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, nullable=False)
    amount = Column(Float, nullable=False)
    payment_method = Column(String) # ACH, CC, CHECK
    payment_date = Column(DateTime, default=datetime.datetime.utcnow)

# ---------------------------------------------------------
# Database Connection Engine
# ---------------------------------------------------------
class DatabaseEngine:
    def __init__(self, db_url="sqlite:///jworden_os_memory.db"):
        logger.info(f"Connecting to Postgres/SQLite database at {db_url}...")
        self.engine = create_engine(db_url, echo=False)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        logger.info("JARVIS DB: SQLAlchemy ORM layer initialized. Millions of records ready for persistence.")

    def get_session(self):
        return self.Session()

if __name__ == "__main__":
    db = DatabaseEngine()
