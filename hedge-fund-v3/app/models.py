import datetime
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    JSON,
    func,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(10), nullable=False, index=True)
    model_version = Column(String(20), nullable=False)
    data_version = Column(String(20), nullable=False)
    final_score = Column(Float, nullable=False)
    recommendation = Column(String(20), nullable=False)
    conviction = Column(Float, nullable=False)
    agent_scores = Column(JSON, nullable=False)
    report = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<AnalysisResult {self.ticker} score={self.final_score}>"


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(50), nullable=False, index=True)
    ticker = Column(String(10), nullable=False, index=True)
    event = Column(String(100), nullable=False)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<AuditLog {self.request_id} {self.event}>"


class Ranking(Base):
    __tablename__ = "rankings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(10), nullable=False, unique=True, index=True)
    final_score = Column(Float, nullable=False)
    conviction = Column(Float, nullable=False)
    recommendation = Column(String(20), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<Ranking {self.ticker} score={self.final_score}>"


class RawSnapshot(Base):
    __tablename__ = "raw_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(10), nullable=False, index=True)
    horizon = Column(Integer, nullable=False, index=True)
    data_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)

    def __repr__(self) -> str:
        return f"<RawSnapshot {self.ticker} horizon={self.horizon}>"
