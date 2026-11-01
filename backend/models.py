"""Data checks (Pydantic). Anything that doesn't match is rejected with a 422 error before it reaches the database."""
from typing import Literal

from pydantic import BaseModel, Field

Operator = Literal["maroc_telecom", "orange", "inwi"]
Connection = Literal["fibre", "adsl", "4g_home", "mobile_4g", "5g"]
NetworkPath = Literal["wifi", "ethernet", "unknown"]
Issue = Literal["no_internet", "very_slow", "disconnects", "high_ping", "mobile_signal"]
Started = Literal["now", "hour", "today", "days"]
Scope = Literal["just_me", "building", "neighbourhood", "unknown"]


class MeasurementIn(BaseModel):
    """Sent by the speed test page."""
    zone_id: int = Field(ge=1)
    operator: Operator
    connection_type: Connection
    network_path: NetworkPath = "unknown"
    download_mbps: float = Field(ge=0, le=10000)
    upload_mbps: float = Field(ge=0, le=10000)
    ping_ms: float = Field(ge=0, le=5000)
    jitter_ms: float | None = Field(default=None, ge=0, le=5000)
    device_token: str | None = Field(default=None, max_length=64)


class ReportIn(BaseModel):
    """Sent by the report (Signalements) page."""
    lat: float = Field(ge=20.5, le=36.1)      # rough box around Morocco; the exact outline is checked in main.py
    lng: float = Field(ge=-17.3, le=-0.9)
    operator: Operator
    connection_type: Connection
    issue_type: Issue
    started: Started = "now"
    scope: Scope = "unknown"
    device_token: str = Field(min_length=8, max_length=64)