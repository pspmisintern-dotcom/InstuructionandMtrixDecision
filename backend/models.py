from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    full_name = Column(String(200), nullable=False)
    hashed_password = Column(String(300), nullable=False)
    role = Column(String(50), nullable=False, default="operator")  # admin | supervisor | operator
    department = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    # Access control fields - admin grants access to operators/supervisors
    access_granted = Column(Boolean, default=False)  # whether admin has granted current access
    access_granted_at = Column(DateTime, nullable=True)  # when access was last granted
    access_expires_at = Column(DateTime, nullable=True)  # when current access expires

    # Access request fields - operator/supervisor requests access from admin
    access_request_status = Column(String(20), nullable=True)  # None | pending | approved | rejected
    access_requested_at = Column(DateTime, nullable=True)       # when the request was submitted
    access_request_reason = Column(Text, nullable=True)         # reason/justification from user

    # One-time password flag - set True when admin issues access, cleared after user changes password
    must_change_password = Column(Boolean, default=False)

    # AI Assistant access - admin grants/revokes this feature for operators/supervisors
    ai_assistant_enabled = Column(Boolean, default=False)

    # Track last login IP address for security auditing
    last_access_ip = Column(String(45), nullable=True)  # IPv4 or IPv6

    # Email-based 2FA (currently enforced for admin only, see auth_routes.py).
    # otp_code_hash stores a bcrypt hash of the current one-time code, never
    # the code itself, mirroring how hashed_password is stored.
    otp_code_hash = Column(String(300), nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    otp_attempts = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    audit_logs = relationship("AuditLog", back_populates="user")
    checklists = relationship("Checklist", back_populates="user")
    notifications = relationship("Notification", back_populates="user", foreign_keys="Notification.user_id")


class WorkInstruction(Base):
    __tablename__ = "work_instructions"

    id = Column(Integer, primary_key=True, index=True)
    wi_number = Column(String(50), index=True, nullable=False)
    title = Column(String(300), nullable=False)
    revision = Column(String(20), default="Rev 1")
    department = Column(String(100), nullable=True)
    activity = Column(String(200), nullable=True)
    scope = Column(Text, nullable=True)
    applicability = Column(Text, nullable=True)  # applicable machines
    customer = Column(String(200), nullable=True)
    component = Column(String(200), nullable=True)
    ppe = Column(Text, nullable=True)
    tools_required = Column(Text, nullable=True)
    consumables = Column(Text, nullable=True)
    prerequisites = Column(Text, nullable=True)
    pre_start_checks = Column(Text, nullable=True)
    machine_parameters = Column(Text, nullable=True)
    procedure = Column(Text, nullable=True)
    inspection = Column(Text, nullable=True)
    quality_requirements = Column(Text, nullable=True)
    acceptance_criteria = Column(Text, nullable=True)
    shutdown_procedure = Column(Text, nullable=True)
    safety_notes = Column(Text, nullable=True)
    supervisor_approval_required = Column(Boolean, default=False)
    qa_approval_required = Column(Boolean, default=False)
    revision_history = Column(Text, nullable=True)
    file_path = Column(String(500), nullable=True)
    is_archived = Column(Boolean, default=False)
    is_latest = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sections = relationship("Section", back_populates="work_instruction", cascade="all, delete-orphan")
    checklists = relationship("Checklist", back_populates="work_instruction")
    audit_logs = relationship("AuditLog", back_populates="work_instruction")


class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    work_instruction_id = Column(Integer, ForeignKey("work_instructions.id"))
    heading = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    order_index = Column(Integer, default=0)
    metadata_json = Column(JSON, nullable=True)

    work_instruction = relationship("WorkInstruction", back_populates="sections")


class Checklist(Base):
    __tablename__ = "checklists"

    id = Column(Integer, primary_key=True, index=True)
    work_instruction_id = Column(Integer, ForeignKey("work_instructions.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    category = Column(String(100), nullable=False)  # PPE | Machine | Process | Inspection
    item = Column(String(300), nullable=False)
    is_checked = Column(Boolean, default=False)
    checked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    work_instruction = relationship("WorkInstruction", back_populates="checklists")
    user = relationship("User", back_populates="checklists")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    work_instruction_id = Column(Integer, ForeignKey("work_instructions.id"), nullable=True)
    action = Column(String(200), nullable=False)
    detail = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")
    work_instruction = relationship("WorkInstruction", back_populates="audit_logs")


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    work_instruction_id = Column(Integer, ForeignKey("work_instructions.id"))
    workflow_id = Column(Integer, nullable=True)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approver_name = Column(String(200), nullable=True)
    type = Column(String(50), nullable=False)  # supervisor | qa | deviation | customer
    status = Column(String(50), default="pending")  # pending | approved | rejected
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DecisionRule(Base):
    __tablename__ = "decision_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    work = Column(String(200), nullable=True)  # associated work type
    condition_field = Column(String(200), nullable=False)
    condition_operator = Column(String(20), nullable=False)  # >, <, >=, <=, ==, contains
    condition_value = Column(String(200), nullable=False)
    action_type = Column(String(50), nullable=False)  # display | disable | notify | recommend | block
    action_detail = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    report_type = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String(300), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(20), default="info")  # info | warning | danger
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications", foreign_keys=[user_id])
    sender = relationship("User", foreign_keys=[sender_id])
