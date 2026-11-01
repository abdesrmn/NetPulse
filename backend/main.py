"""NetPulse Maroc API (FastAPI + Supabase).

Run locally:  uvicorn main:app --reload      then open http://localhost:8000/docs
"""
import logging
import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from supabase import create_client

from geo import in_morocco, snap
from models import MeasurementIn, ReportIn

load_dotenv()
log = logging.getLogger("netpulse")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]          # the SECRET service_role key: only ever lives in env vars
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000").split(",") if o.strip()]
REPORT_COOLDOWN_MIN = 30     # one report per device + operator in this time
MIN_TESTS = 5                # a statistic needs at least this many tests to count as reliable

db = create_client(SUPABASE_URL, SUPABASE_KEY)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")   # set by hosting platforms (Render, Railway, ...)
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=client_ip)
app = FastAPI(title="NetPulse Maroc API", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def run(query):
    """Execute a database query; never leak database details to the browser."""
    try:
        return query.execute().data
    except Exception:
        log.exception("database error")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/zones")
def zones():
    return run(db.table("zones").select("id,city,name").order("id"))


@app.post("/measurements", status_code=201)
@limiter.limit("20/minute")
def add_measurement(request: Request, m: MeasurementIn):
    if not run(db.table("zones").select("id").eq("id", m.zone_id).limit(1)):
        raise HTTPException(status_code=422, detail="Unknown zone_id")
    run(db.table("measurements").insert(m.model_dump()))
    return {"ok": True}


@app.post("/reports", status_code=201)
@limiter.limit("5/minute")
def add_report(request: Request, r: ReportIn):
    if not in_morocco(r.lat, r.lng):
        raise HTTPException(status_code=422, detail="Position is outside Morocco")

    since = (datetime.now(timezone.utc) - timedelta(minutes=REPORT_COOLDOWN_MIN)).isoformat()
    recent = run(
        db.table("reports").select("id")
        .eq("device_token", r.device_token).eq("operator", r.operator)
        .gte("created_at", since).limit(1)
    )
    if recent:
        raise HTTPException(status_code=429, detail="You already reported a problem with this operator recently")

    row = r.model_dump()
    row["lat"], row["lng"] = snap(r.lat), snap(r.lng)   # snap again on the server: privacy even if the browser sends more precision
    run(db.table("reports").insert(row))
    return {"ok": True}


@app.get("/reports/recent")
def recent_reports(limit: int = Query(100, ge=1, le=500), hours: int = Query(24, ge=1, le=168)):
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    rows = run(
        db.table("reports").select("lat,lng,issue_type,operator,created_at")
        .gte("created_at", since).order("created_at", desc=True).limit(limit)
    )
    public = ("lat", "lng", "issue_type", "operator", "created_at")   # device_token is deliberately NOT returned
    return [{k: r[k] for k in public if k in r} for r in rows]


@app.get("/zones/{zone_id}/stats")
def zone_stats(zone_id: int, days: int = Query(30, ge=1, le=90)):
    rows = run(db.rpc("zone_stats", {"p_zone_id": zone_id, "p_days": days}))
    for r in rows:
        r["reliable"] = r["tests"] >= MIN_TESTS
        for k in ("median_down", "median_up", "median_ping"):
            if r.get(k) is not None:
                r[k] = round(r[k], 1)
    return rows