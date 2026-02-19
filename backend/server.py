import os
import secrets
import uuid
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends, Header, Query, Response, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pymongo import MongoClient
from jose import jwt, JWTError
from passlib.context import CryptContext
from bson import ObjectId
import csv
import io
import httpx
from bs4 import BeautifulSoup
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import aiofiles

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "gototop")
JWT_SECRET = os.environ.get("JWT_SECRET", "gtt-secure-jwt-2026-xK9mPqL3nR7")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="Go to Top Admin API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Static files for uploads
UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Collections
users_col = db["users"]
leads_col = db["leads"]
activity_log_col = db["activity_log"]
content_col = db["site_content"]
section_order_col = db["section_order"]
calc_tabs_col = db["calculator_tabs"]
calc_services_col = db["calculator_services"]
telegram_col = db["telegram_messages"]
scripts_col = db["custom_scripts"]
referrals_col = db["referral_codes"]
tgbot_col = db["telegram_bot_config"]
pdf_col = db["pdf_templates"]
slots_col = db["slot_counter"]
footer_col = db["footer_settings"]
photo_blocks_col = db["photo_blocks"]

# Indexes
users_col.create_index("username", unique=True)
leads_col.create_index("created_at")
content_col.create_index("section_key", unique=True)
section_order_col.create_index("section_id", unique=True)
referrals_col.create_index("code", unique=True)

ALL_ROLES = ["main_admin", "developer", "analyst", "operator", "buyer", "courier"]
ALL_SECTIONS = [
    "dashboard", "leads", "employees", "permissions",
    "blocks", "calculator", "pdf", "referrals", "slots",
    "footer", "telegram", "tgbot", "scripts", "settings"
]
ROLE_LABELS = {
    "main_admin": "Главный Админ", "developer": "Разработчик", "analyst": "Аналитик",
    "operator": "Оператор", "buyer": "Выкупщик", "courier": "Курьер",
}
SECTION_LABELS = {
    "dashboard": "Дашборд", "leads": "Лиды / CRM", "employees": "Сотрудники",
    "permissions": "Управление доступами", "blocks": "Конструктор блоков",
    "calculator": "Калькулятор", "pdf": "PDF шаблон", "referrals": "Реферальные коды",
    "slots": "Счётчики слотов", "footer": "Футер сайта", "telegram": "TG сообщения",
    "tgbot": "TG Бот / Уведомления", "scripts": "Скрипты", "settings": "Настройки",
}
DEFAULT_PERMISSIONS = {
    "main_admin": ALL_SECTIONS.copy(),
    "developer": ["dashboard", "blocks", "calculator", "scripts", "settings"],
    "analyst": ["dashboard", "leads"],
    "operator": ["dashboard", "leads"],
    "buyer": ["dashboard"],
    "courier": ["dashboard"],
}

# ===== PYDANTIC MODELS =====
class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class CreateUserRequest(BaseModel):
    username: str
    password: str
    display_name: str
    role: str
    phone: Optional[str] = ""
    email: Optional[str] = ""

class UpdateUserRequest(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None

class UpdatePermissionsRequest(BaseModel):
    sections: list[str]

class UpdateLeadRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    name: Optional[str] = None
    contact: Optional[str] = None
    product: Optional[str] = None
    service: Optional[str] = None
    message: Optional[str] = None
    total_amount: Optional[float] = None
    calc_data: Optional[str] = None  # JSON string
    custom_fields: Optional[str] = None  # JSON string for extra links/texts
    referral_code: Optional[str] = None

class CreateLeadRequest(BaseModel):
    name: str = ""
    contact: str = ""
    product: str = ""
    service: str = ""
    message: str = ""
    source: str = "manual"
    lang: str = "ru"
    total_amount: float = 0
    calc_data: str = ""  # JSON: [{name, qty, price, sum}]
    referral_code: str = ""
    custom_fields: str = ""  # JSON for extra data

# ===== HELPERS =====
def str_id(doc):
    if doc is None:
        return None
    d = {k: v for k, v in doc.items() if k != "_id"}
    d["id"] = str(doc["_id"])
    return d

def create_token(user_id: str, role: str):
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": user_id, "role": role, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None

async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    payload = verify_token(authorization.replace("Bearer ", ""))
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = users_col.find_one({"_id": ObjectId(payload["sub"])})
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return str_id(user)

def require_section(user: dict, section: str):
    if user["role"] == "main_admin":
        return True
    permissions = user.get("permissions", DEFAULT_PERMISSIONS.get(user["role"], []))
    if section not in permissions:
        raise HTTPException(status_code=403, detail=f"Нет доступа к разделу: {SECTION_LABELS.get(section, section)}")
    return True

def log_activity(user_id: str, user_name: str, action: str, details: str = ""):
    activity_log_col.insert_one({
        "user_id": user_id, "user_name": user_name, "action": action,
        "details": details, "created_at": datetime.now(timezone.utc).isoformat()
    })

# ===== SEED =====
def seed_admin():
    if not users_col.find_one({"username": "admin"}):
        users_col.insert_one({
            "username": "admin", "password_hash": pwd_context.hash("gototop2026"),
            "display_name": "Главный Администратор", "role": "main_admin",
            "phone": "", "email": "", "is_active": True,
            "permissions": ALL_SECTIONS.copy(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

seed_admin()

# Ensure all main_admin users have up-to-date permissions
users_col.update_many({"role": "main_admin"}, {"$set": {"permissions": ALL_SECTIONS.copy()}})

# ========== AUTH ==========
@app.post("/api/auth/login")
async def login(req: LoginRequest):
    user = users_col.find_one({"username": req.username})
    if not user:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Аккаунт деактивирован")
    if not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    token = create_token(str(user["_id"]), user["role"])
    log_activity(str(user["_id"]), user.get("display_name", user["username"]), "login")
    user_data = str_id(user)
    del user_data["password_hash"]
    return {"token": token, "user": user_data}

@app.post("/api/auth/change-password")
async def change_password(req: ChangePasswordRequest, user=Depends(get_current_user)):
    db_user = users_col.find_one({"_id": ObjectId(user["id"])})
    if not pwd_context.verify(req.current_password, db_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Пароль должен быть не менее 6 символов")
    users_col.update_one({"_id": ObjectId(user["id"])}, {"$set": {"password_hash": pwd_context.hash(req.new_password)}})
    log_activity(user["id"], user["display_name"], "change_password")
    return {"success": True}

@app.get("/api/auth/me")
async def get_me(user=Depends(get_current_user)):
    u = {k: v for k, v in user.items() if k != "password_hash"}
    u["permissions"] = user.get("permissions", DEFAULT_PERMISSIONS.get(user["role"], []))
    u["role_label"] = ROLE_LABELS.get(user["role"], user["role"])
    return u

# ========== USERS ==========
@app.get("/api/users")
async def list_users(user=Depends(get_current_user)):
    require_section(user, "employees")
    users = list(users_col.find({}, {"password_hash": 0}))
    return [{"role_label": ROLE_LABELS.get(str_id(u).get("role", ""), ""), "permissions": str_id(u).get("permissions", DEFAULT_PERMISSIONS.get(str_id(u)["role"], [])), **str_id(u)} for u in users]

@app.post("/api/users")
async def create_user(req: CreateUserRequest, user=Depends(get_current_user)):
    require_section(user, "employees")
    if user["role"] != "main_admin":
        raise HTTPException(status_code=403, detail="Только главный админ может создавать сотрудников")
    if req.role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail=f"Недопустимая роль")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Пароль не менее 6 символов")
    if users_col.find_one({"username": req.username}):
        raise HTTPException(status_code=400, detail="Логин уже существует")
    new_user = {
        "username": req.username, "password_hash": pwd_context.hash(req.password),
        "display_name": req.display_name, "role": req.role, "phone": req.phone or "",
        "email": req.email or "", "is_active": True,
        "permissions": DEFAULT_PERMISSIONS.get(req.role, ["dashboard"]),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = users_col.insert_one(new_user)
    log_activity(user["id"], user["display_name"], "create_user", f"Создан: {req.display_name}")
    d = {k: v for k, v in new_user.items() if k not in ("password_hash", "_id")}
    d["id"] = str(result.inserted_id)
    d["role_label"] = ROLE_LABELS.get(req.role, req.role)
    return d

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, req: UpdateUserRequest, user=Depends(get_current_user)):
    require_section(user, "employees")
    if user["role"] != "main_admin":
        raise HTTPException(status_code=403, detail="Только главный админ")
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if req.display_name is not None: update["display_name"] = req.display_name
    if req.role is not None:
        if req.role not in ALL_ROLES: raise HTTPException(status_code=400, detail="Недопустимая роль")
        update["role"] = req.role
    if req.phone is not None: update["phone"] = req.phone
    if req.email is not None: update["email"] = req.email
    if req.is_active is not None: update["is_active"] = req.is_active
    users_col.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    return {"success": True}

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str, user=Depends(get_current_user)):
    require_section(user, "employees")
    if user["role"] != "main_admin":
        raise HTTPException(status_code=403, detail="Только главный админ")
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Нельзя удалить себя")
    users_col.delete_one({"_id": ObjectId(user_id)})
    return {"success": True}

@app.post("/api/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, user=Depends(get_current_user)):
    if user["role"] != "main_admin":
        raise HTTPException(status_code=403, detail="Только главный админ")
    new_pass = secrets.token_urlsafe(8)
    users_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"password_hash": pwd_context.hash(new_pass)}})
    return {"success": True, "new_password": new_pass}

# ========== PERMISSIONS ==========
@app.get("/api/permissions/{user_id}")
async def get_user_permissions(user_id: str, user=Depends(get_current_user)):
    require_section(user, "permissions")
    target = users_col.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    if not target: raise HTTPException(status_code=404, detail="Не найден")
    d = str_id(target)
    d["permissions"] = d.get("permissions", DEFAULT_PERMISSIONS.get(d["role"], []))
    return d

@app.put("/api/permissions/{user_id}")
async def update_user_permissions(user_id: str, req: UpdatePermissionsRequest, user=Depends(get_current_user)):
    require_section(user, "permissions")
    if user["role"] != "main_admin":
        raise HTTPException(status_code=403, detail="Только главный админ")
    valid = [s for s in req.sections if s in ALL_SECTIONS]
    users_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"permissions": valid}})
    return {"success": True, "sections": valid}

# ========== LEADS / CRM ==========
def get_next_lead_number():
    last = leads_col.find_one({}, sort=[("lead_number", -1)])
    return (last.get("lead_number", 0) if last else 0) + 1

@app.get("/api/leads")
async def list_leads(status: Optional[str] = None, source: Optional[str] = None, limit: int = Query(50, le=500), offset: int = 0, user=Depends(get_current_user)):
    require_section(user, "leads")
    query = {}
    if status and status != "all": query["status"] = status
    if source and source != "all": query["source"] = source
    total = leads_col.count_documents(query)
    leads = [str_id(l) for l in leads_col.find(query).sort("created_at", -1).skip(offset).limit(limit)]
    return {"leads": leads, "total": total}

@app.post("/api/leads")
async def create_lead_auth(req: CreateLeadRequest, user=Depends(get_current_user)):
    require_section(user, "leads")
    lead = {
        "lead_number": get_next_lead_number(),
        "source": req.source, "name": req.name, "contact": req.contact,
        "product": req.product, "service": req.service, "message": req.message,
        "lang": req.lang, "status": "new", "notes": "",
        "assigned_to": "", "assigned_name": "",
        "total_amount": req.total_amount or 0,
        "calc_data": req.calc_data or "",
        "referral_code": req.referral_code or "",
        "custom_fields": req.custom_fields or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = leads_col.insert_one(lead)
    d = {k: v for k, v in lead.items() if k != "_id"}
    d["id"] = str(result.inserted_id)
    log_activity(user["id"], user["display_name"], "create_lead", f"Лид #{lead['lead_number']}: {req.name}")
    return d

@app.put("/api/leads/{lead_id}")
async def update_lead(lead_id: str, req: UpdateLeadRequest, user=Depends(get_current_user)):
    require_section(user, "leads")
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if req.status is not None: update["status"] = req.status
    if req.notes is not None: update["notes"] = req.notes
    if req.name is not None: update["name"] = req.name
    if req.contact is not None: update["contact"] = req.contact
    if req.product is not None: update["product"] = req.product
    if req.service is not None: update["service"] = req.service
    if req.message is not None: update["message"] = req.message
    if req.total_amount is not None: update["total_amount"] = req.total_amount
    if req.calc_data is not None: update["calc_data"] = req.calc_data
    if req.custom_fields is not None: update["custom_fields"] = req.custom_fields
    if req.referral_code is not None: update["referral_code"] = req.referral_code
    if req.assigned_to is not None:
        update["assigned_to"] = req.assigned_to
        if req.assigned_to:
            assignee = users_col.find_one({"_id": ObjectId(req.assigned_to)}, {"display_name": 1})
            update["assigned_name"] = assignee["display_name"] if assignee else ""
        else:
            update["assigned_name"] = ""
    leads_col.update_one({"_id": ObjectId(lead_id)}, {"$set": update})
    log_activity(user["id"], user["display_name"], "update_lead", f"Лид: {lead_id}")
    return {"success": True}

@app.delete("/api/leads/{lead_id}")
async def delete_lead(lead_id: str, user=Depends(get_current_user)):
    require_section(user, "leads")
    leads_col.delete_one({"_id": ObjectId(lead_id)})
    return {"success": True}

@app.get("/api/leads/analytics")
async def leads_analytics(user=Depends(get_current_user)):
    require_section(user, "leads")
    total = leads_col.count_documents({})
    by_status = list(leads_col.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "total_amount": {"$sum": {"$ifNull": ["$total_amount", 0]}}}}
    ]))
    by_source = list(leads_col.aggregate([
        {"$group": {"_id": "$source", "count": {"$sum": 1}, "total_amount": {"$sum": {"$ifNull": ["$total_amount", 0]}}}}
    ]))
    total_amount = sum(l.get("total_amount", 0) or 0 for l in leads_col.find({}, {"total_amount": 1}))
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_count = leads_col.count_documents({"created_at": {"$gte": today}})
    today_amount = sum(l.get("total_amount", 0) or 0 for l in leads_col.find({"created_at": {"$gte": today}}, {"total_amount": 1}))
    return {
        "total": total,
        "total_amount": total_amount,
        "today_count": today_count,
        "today_amount": today_amount,
        "by_status": {r["_id"]: {"count": r["count"], "amount": r["total_amount"]} for r in by_status},
        "by_source": {r["_id"]: {"count": r["count"], "amount": r["total_amount"]} for r in by_source},
    }

@app.get("/api/leads/export")
async def export_leads(user=Depends(get_current_user)):
    require_section(user, "leads")
    leads = list(leads_col.find({}).sort("created_at", -1))
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["#", "Source", "Name", "Contact", "Product", "Service", "Amount", "Status", "Notes", "Referral", "Assigned", "Created"])
    for l in leads:
        writer.writerow([l.get("lead_number",""), l.get("source",""), l.get("name",""), l.get("contact",""), l.get("product",""), l.get("service",""), l.get("total_amount",0), l.get("status",""), l.get("notes",""), l.get("referral_code",""), l.get("assigned_name",""), l.get("created_at","")])
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=leads_export.csv"})

@app.post("/api/lead")
async def submit_lead_public(req: CreateLeadRequest):
    lead = {
        "lead_number": get_next_lead_number(),
        "source": req.source or "form", "name": req.name, "contact": req.contact,
        "product": req.product, "service": req.service, "message": req.message,
        "lang": req.lang, "status": "new", "notes": "",
        "assigned_to": "", "assigned_name": "",
        "total_amount": req.total_amount or 0,
        "calc_data": req.calc_data or "",
        "referral_code": req.referral_code or "",
        "custom_fields": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    leads_col.insert_one(lead)
    return {"success": True}

# ========== DASHBOARD STATS ==========
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(user=Depends(get_current_user)):
    require_section(user, "dashboard")
    total_leads = leads_col.count_documents({})
    new_leads = leads_col.count_documents({"status": "new"})
    in_progress = leads_col.count_documents({"status": "in_progress"})
    completed = leads_col.count_documents({"status": "completed"})
    total_users = users_col.count_documents({})
    active_users = users_col.count_documents({"is_active": True})
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_leads = leads_col.count_documents({"created_at": {"$gte": today}})
    content_count = content_col.count_documents({})
    calc_count = calc_services_col.count_documents({})
    tg_count = telegram_col.count_documents({})
    scripts_count = scripts_col.count_documents({})
    ref_count = referrals_col.count_documents({"is_active": True})
    recent = [str_id(l) for l in leads_col.find({}).sort("created_at", -1).limit(5)]
    activity = [str_id(a) for a in activity_log_col.find({}).sort("created_at", -1).limit(10)]
    by_status = {r["_id"]: r["count"] for r in leads_col.aggregate([{"$group": {"_id": "$status", "count": {"$sum": 1}}}])}
    by_source = {r["_id"]: r["count"] for r in leads_col.aggregate([{"$group": {"_id": "$source", "count": {"$sum": 1}}}])}
    return {
        "leads": {"total": total_leads, "new": new_leads, "in_progress": in_progress, "completed": completed, "today": today_leads, "by_status": by_status, "by_source": by_source},
        "users": {"total": total_users, "active": active_users},
        "content": {"sections": content_count, "calculator": calc_count, "telegram": tg_count, "scripts": scripts_count, "referrals": ref_count},
        "recent_leads": recent, "recent_activity": activity,
    }

@app.get("/api/activity")
async def get_activity(limit: int = Query(20, le=100), user=Depends(get_current_user)):
    return [str_id(l) for l in activity_log_col.find({}).sort("created_at", -1).limit(limit)]

@app.get("/api/config/roles")
async def get_roles_config(user=Depends(get_current_user)):
    return {"roles": ALL_ROLES, "role_labels": ROLE_LABELS, "sections": ALL_SECTIONS, "section_labels": SECTION_LABELS, "default_permissions": DEFAULT_PERMISSIONS}

# ========== SITE CONTENT (Block Constructor) ==========
@app.get("/api/content")
async def list_content(user=Depends(get_current_user)):
    require_section(user, "blocks")
    return [str_id(c) for c in content_col.find({}).sort("sort_order", 1)]

@app.post("/api/content")
async def create_content(body: dict, user=Depends(get_current_user)):
    require_section(user, "blocks")
    key = body.get("section_key", "")
    if not key: raise HTTPException(status_code=400, detail="section_key required")
    if content_col.find_one({"section_key": key}):
        raise HTTPException(status_code=400, detail="Секция уже существует")
    doc = {"section_key": key, "section_name": body.get("section_name", key), "content_json": body.get("content_json", []), "sort_order": body.get("sort_order", 999), "created_at": datetime.now(timezone.utc).isoformat()}
    content_col.insert_one(doc)
    return {"success": True}

@app.put("/api/content/{key}")
async def update_content(key: str, body: dict, user=Depends(get_current_user)):
    require_section(user, "blocks")
    update = {}
    if "content_json" in body: update["content_json"] = body["content_json"]
    if "section_name" in body: update["section_name"] = body["section_name"]
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    content_col.update_one({"section_key": key}, {"$set": update}, upsert=True)
    return {"success": True}

@app.delete("/api/content/{key}")
async def delete_content(key: str, user=Depends(get_current_user)):
    require_section(user, "blocks")
    content_col.delete_one({"section_key": key})
    section_order_col.delete_one({"section_id": key})
    return {"success": True}

# ========== SECTION ORDER ==========
@app.get("/api/section-order")
async def list_section_order(user=Depends(get_current_user)):
    require_section(user, "blocks")
    return [str_id(s) for s in section_order_col.find({}).sort("sort_order", 1)]

@app.post("/api/section-order")
async def save_section_order(body: dict, user=Depends(get_current_user)):
    require_section(user, "blocks")
    sections = body.get("sections", [])
    for s in sections:
        section_order_col.update_one(
            {"section_id": s["section_id"]},
            {"$set": {"sort_order": s.get("sort_order", 0), "is_visible": s.get("is_visible", True), "label_ru": s.get("label_ru", ""), "label_am": s.get("label_am", "")}},
            upsert=True
        )
    return {"success": True}

# ========== CALCULATOR ==========
@app.get("/api/calc-tabs")
async def list_calc_tabs(user=Depends(get_current_user)):
    require_section(user, "calculator")
    return [str_id(t) for t in calc_tabs_col.find({}).sort("sort_order", 1)]

@app.post("/api/calc-tabs")
async def create_calc_tab(body: dict, user=Depends(get_current_user)):
    require_section(user, "calculator")
    doc = {"tab_key": body.get("tab_key", ""), "name_ru": body.get("name_ru", ""), "name_am": body.get("name_am", ""), "sort_order": body.get("sort_order", 0), "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()}
    result = calc_tabs_col.insert_one(doc)
    d = {k: v for k, v in doc.items() if k != "_id"}
    d["id"] = str(result.inserted_id)
    return d

@app.put("/api/calc-tabs/{tab_id}")
async def update_calc_tab(tab_id: str, body: dict, user=Depends(get_current_user)):
    require_section(user, "calculator")
    update = {k: body[k] for k in ["name_ru", "name_am", "sort_order", "is_active"] if k in body}
    calc_tabs_col.update_one({"_id": ObjectId(tab_id)}, {"$set": update})
    return {"success": True}

@app.delete("/api/calc-tabs/{tab_id}")
async def delete_calc_tab(tab_id: str, user=Depends(get_current_user)):
    require_section(user, "calculator")
    calc_services_col.delete_many({"tab_id": tab_id})
    calc_tabs_col.delete_one({"_id": ObjectId(tab_id)})
    return {"success": True}

@app.get("/api/calc-services")
async def list_calc_services(user=Depends(get_current_user)):
    require_section(user, "calculator")
    services = list(calc_services_col.find({}).sort("sort_order", 1))
    result = []
    for s in services:
        d = str_id(s)
        tab = calc_tabs_col.find_one({"_id": ObjectId(d.get("tab_id", ""))}) if d.get("tab_id") else None
        d["tab_name_ru"] = tab["name_ru"] if tab else ""
        result.append(d)
    return result

@app.post("/api/calc-services")
async def create_calc_service(body: dict, user=Depends(get_current_user)):
    require_section(user, "calculator")
    doc = {k: body.get(k, "") for k in ["tab_id", "name_ru", "name_am", "price", "price_type", "price_tiers_json", "tier_desc_ru", "tier_desc_am"]}
    doc["sort_order"] = body.get("sort_order", 0)
    doc["is_active"] = True
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    result = calc_services_col.insert_one(doc)
    d = {k: v for k, v in doc.items() if k != "_id"}
    d["id"] = str(result.inserted_id)
    return d

@app.put("/api/calc-services/{svc_id}")
async def update_calc_service(svc_id: str, body: dict, user=Depends(get_current_user)):
    require_section(user, "calculator")
    update = {k: body[k] for k in ["tab_id", "name_ru", "name_am", "price", "price_type", "price_tiers_json", "tier_desc_ru", "tier_desc_am", "sort_order", "is_active"] if k in body}
    calc_services_col.update_one({"_id": ObjectId(svc_id)}, {"$set": update})
    return {"success": True}

@app.delete("/api/calc-services/{svc_id}")
async def delete_calc_service(svc_id: str, user=Depends(get_current_user)):
    require_section(user, "calculator")
    calc_services_col.delete_one({"_id": ObjectId(svc_id)})
    return {"success": True}

# ========== TELEGRAM MESSAGES ==========
@app.get("/api/telegram")
async def list_telegram(user=Depends(get_current_user)):
    require_section(user, "telegram")
    return [str_id(t) for t in telegram_col.find({}).sort("sort_order", 1)]

@app.post("/api/telegram")
async def create_telegram(body: dict, user=Depends(get_current_user)):
    require_section(user, "telegram")
    doc = {k: body.get(k, "") for k in ["button_key", "button_label_ru", "button_label_am", "telegram_url", "message_template_ru", "message_template_am", "description"]}
    doc["sort_order"] = body.get("sort_order", 0)
    doc["is_active"] = True
    result = telegram_col.insert_one(doc)
    d = {k: v for k, v in doc.items() if k != "_id"}
    d["id"] = str(result.inserted_id)
    return d

@app.put("/api/telegram/{msg_id}")
async def update_telegram(msg_id: str, body: dict, user=Depends(get_current_user)):
    require_section(user, "telegram")
    update = {k: body[k] for k in ["button_label_ru", "button_label_am", "telegram_url", "message_template_ru", "message_template_am", "description", "is_active"] if k in body}
    telegram_col.update_one({"_id": ObjectId(msg_id)}, {"$set": update})
    return {"success": True}

@app.delete("/api/telegram/{msg_id}")
async def delete_telegram(msg_id: str, user=Depends(get_current_user)):
    require_section(user, "telegram")
    telegram_col.delete_one({"_id": ObjectId(msg_id)})
    return {"success": True}

# ========== CUSTOM SCRIPTS ==========
@app.get("/api/scripts")
async def list_scripts(user=Depends(get_current_user)):
    require_section(user, "scripts")
    return [str_id(s) for s in scripts_col.find({}).sort("sort_order", 1)]

@app.post("/api/scripts")
async def create_script(body: dict, user=Depends(get_current_user)):
    require_section(user, "scripts")
    doc = {"name": body.get("name", ""), "description": body.get("description", ""), "script_type": body.get("script_type", "js"), "placement": body.get("placement", "head"), "code": body.get("code", ""), "is_active": True, "sort_order": body.get("sort_order", 0)}
    result = scripts_col.insert_one(doc)
    d = {k: v for k, v in doc.items() if k != "_id"}
    d["id"] = str(result.inserted_id)
    return d

@app.put("/api/scripts/{script_id}")
async def update_script(script_id: str, body: dict, user=Depends(get_current_user)):
    require_section(user, "scripts")
    update = {k: body[k] for k in ["name", "description", "script_type", "placement", "code", "is_active"] if k in body}
    scripts_col.update_one({"_id": ObjectId(script_id)}, {"$set": update})
    return {"success": True}

@app.delete("/api/scripts/{script_id}")
async def delete_script(script_id: str, user=Depends(get_current_user)):
    require_section(user, "scripts")
    scripts_col.delete_one({"_id": ObjectId(script_id)})
    return {"success": True}

# ========== REFERRAL CODES ==========
@app.get("/api/referrals")
async def list_referrals(user=Depends(get_current_user)):
    require_section(user, "referrals")
    return [str_id(r) for r in referrals_col.find({}).sort("created_at", -1)]

@app.post("/api/referrals")
async def create_referral(body: dict, user=Depends(get_current_user)):
    require_section(user, "referrals")
    code = (body.get("code", "") or "").strip().upper()
    if not code: raise HTTPException(status_code=400, detail="Код обязателен")
    doc = {"code": code, "description": body.get("description", ""), "discount_percent": body.get("discount_percent", 0), "free_reviews": body.get("free_reviews", 0), "is_active": True, "uses": 0, "created_at": datetime.now(timezone.utc).isoformat()}
    result = referrals_col.insert_one(doc)
    d = {k: v for k, v in doc.items() if k != "_id"}
    d["id"] = str(result.inserted_id)
    return d

@app.put("/api/referrals/{ref_id}")
async def update_referral(ref_id: str, body: dict, user=Depends(get_current_user)):
    require_section(user, "referrals")
    update = {k: body[k] for k in ["code", "description", "discount_percent", "free_reviews", "is_active"] if k in body}
    if "code" in update: update["code"] = update["code"].strip().upper()
    referrals_col.update_one({"_id": ObjectId(ref_id)}, {"$set": update})
    return {"success": True}

@app.delete("/api/referrals/{ref_id}")
async def delete_referral(ref_id: str, user=Depends(get_current_user)):
    require_section(user, "referrals")
    referrals_col.delete_one({"_id": ObjectId(ref_id)})
    return {"success": True}

# ========== TELEGRAM BOT CONFIG ==========
@app.get("/api/telegram-bot")
async def list_tgbot(user=Depends(get_current_user)):
    require_section(user, "tgbot")
    return [str_id(t) for t in tgbot_col.find({}).sort("_id", 1)]

@app.post("/api/telegram-bot")
async def create_tgbot(body: dict, user=Depends(get_current_user)):
    require_section(user, "tgbot")
    doc = {"bot_token": body.get("bot_token", ""), "chat_id": body.get("chat_id", ""), "chat_name": body.get("chat_name", ""), "notify_leads": body.get("notify_leads", True), "notify_calc": body.get("notify_calc", False), "is_active": True}
    result = tgbot_col.insert_one(doc)
    d = {k: v for k, v in doc.items() if k != "_id"}
    d["id"] = str(result.inserted_id)
    return d

@app.put("/api/telegram-bot/{bot_id}")
async def update_tgbot(bot_id: str, body: dict, user=Depends(get_current_user)):
    require_section(user, "tgbot")
    update = {k: body[k] for k in ["bot_token", "chat_id", "chat_name", "notify_leads", "notify_calc", "is_active"] if k in body}
    tgbot_col.update_one({"_id": ObjectId(bot_id)}, {"$set": update})
    return {"success": True}

@app.delete("/api/telegram-bot/{bot_id}")
async def delete_tgbot(bot_id: str, user=Depends(get_current_user)):
    require_section(user, "tgbot")
    tgbot_col.delete_one({"_id": ObjectId(bot_id)})
    return {"success": True}

@app.post("/api/telegram-bot/test")
async def test_tgbot(body: dict, user=Depends(get_current_user)):
    require_section(user, "tgbot")
    import httpx
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post(f"https://api.telegram.org/bot{body['bot_token']}/sendMessage", json={"chat_id": body["chat_id"], "text": body.get("message", "Test from Go to Top admin"), "parse_mode": "HTML"})
            data = r.json()
            if data.get("ok"): return {"success": True}
            return {"success": False, "error": data.get("description", "Ошибка")}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ========== PDF TEMPLATE ==========
@app.get("/api/pdf-template")
async def get_pdf_template(user=Depends(get_current_user)):
    require_section(user, "pdf")
    doc = pdf_col.find_one({"template_key": "default"})
    if not doc:
        pdf_col.insert_one({"template_key": "default", "header_ru": "", "header_am": "", "footer_ru": "", "footer_am": "", "intro_ru": "", "intro_am": "", "outro_ru": "", "outro_am": "", "company_name": "Go to Top", "company_phone": "", "company_email": "", "company_address": "", "btn_order_ru": "Заказать сейчас", "btn_order_am": "", "btn_download_ru": "Скачать", "btn_download_am": "", "order_telegram_url": "https://t.me/goo_to_top"})
        doc = pdf_col.find_one({"template_key": "default"})
    return str_id(doc)

@app.put("/api/pdf-template")
async def update_pdf_template(body: dict, user=Depends(get_current_user)):
    require_section(user, "pdf")
    fields = ["header_ru", "header_am", "footer_ru", "footer_am", "intro_ru", "intro_am", "outro_ru", "outro_am", "company_name", "company_phone", "company_email", "company_address", "btn_order_ru", "btn_order_am", "btn_download_ru", "btn_download_am", "order_telegram_url"]
    update = {k: body.get(k, "") for k in fields if k in body}
    pdf_col.update_one({"template_key": "default"}, {"$set": update}, upsert=True)
    return {"success": True}

# ========== SLOT COUNTERS ==========
@app.get("/api/slot-counter")
async def list_slots(user=Depends(get_current_user)):
    require_section(user, "slots")
    return {"counters": [str_id(s) for s in slots_col.find({}).sort("_id", 1)]}

@app.post("/api/slot-counter")
async def create_slot(body: dict, user=Depends(get_current_user)):
    require_section(user, "slots")
    doc = {"counter_name": body.get("counter_name", "new"), "total_slots": body.get("total_slots", 10), "booked_slots": body.get("booked_slots", 0), "label_ru": body.get("label_ru", ""), "label_am": body.get("label_am", ""), "show_timer": body.get("show_timer", True), "reset_day": body.get("reset_day", "monday"), "position": body.get("position", "after-hero")}
    result = slots_col.insert_one(doc)
    d = {k: v for k, v in doc.items() if k != "_id"}
    d["id"] = str(result.inserted_id)
    return d

@app.put("/api/slot-counter/{slot_id}")
async def update_slot(slot_id: str, body: dict, user=Depends(get_current_user)):
    require_section(user, "slots")
    update = {k: body[k] for k in ["counter_name", "total_slots", "booked_slots", "label_ru", "label_am", "show_timer", "reset_day", "position"] if k in body}
    slots_col.update_one({"_id": ObjectId(slot_id)}, {"$set": update})
    return {"success": True}

@app.delete("/api/slot-counter/{slot_id}")
async def delete_slot(slot_id: str, user=Depends(get_current_user)):
    require_section(user, "slots")
    slots_col.delete_one({"_id": ObjectId(slot_id)})
    return {"success": True}

# ========== FOOTER ==========
@app.get("/api/footer")
async def get_footer(user=Depends(get_current_user)):
    require_section(user, "footer")
    doc = footer_col.find_one({})
    if not doc:
        footer_col.insert_one({"brand_text_ru": "Безопасное продвижение товаров на Wildberries в Армении.", "brand_text_am": "", "contacts_json": "[]", "socials_json": "[]", "nav_links_json": "[]", "custom_html": "", "copyright_ru": "2026 Go to Top. Все права защищены", "copyright_am": "", "location_ru": "Ереван, Армения", "location_am": ""})
        doc = footer_col.find_one({})
    return str_id(doc)

@app.put("/api/footer")
async def update_footer(body: dict, user=Depends(get_current_user)):
    require_section(user, "footer")
    fields = ["brand_text_ru", "brand_text_am", "contacts_json", "socials_json", "nav_links_json", "custom_html", "copyright_ru", "copyright_am", "location_ru", "location_am"]
    update = {k: body.get(k, "") for k in fields if k in body}
    footer_col.update_one({}, {"$set": update}, upsert=True)
    return {"success": True}

# ========== PHOTO BLOCKS ==========
@app.get("/api/photo-blocks")
async def list_photo_blocks(user=Depends(get_current_user)):
    require_section(user, "blocks")
    return {"blocks": [str_id(b) for b in photo_blocks_col.find({}).sort("sort_order", 1)]}

@app.post("/api/photo-blocks")
async def create_photo_block(body: dict, user=Depends(get_current_user)):
    require_section(user, "blocks")
    doc = {"block_name": body.get("block_name", ""), "description_ru": body.get("description_ru", ""), "description_am": body.get("description_am", ""), "photos_json": body.get("photos_json", "[]"), "position": body.get("position", "after-services"), "sort_order": body.get("sort_order", 0), "is_visible": body.get("is_visible", True)}
    result = photo_blocks_col.insert_one(doc)
    d = {k: v for k, v in doc.items() if k != "_id"}
    d["id"] = str(result.inserted_id)
    return d

@app.put("/api/photo-blocks/{block_id}")
async def update_photo_block(block_id: str, body: dict, user=Depends(get_current_user)):
    require_section(user, "blocks")
    update = {k: body[k] for k in ["block_name", "description_ru", "description_am", "photos_json", "position", "sort_order", "is_visible"] if k in body}
    photo_blocks_col.update_one({"_id": ObjectId(block_id)}, {"$set": update})
    return {"success": True}

@app.delete("/api/photo-blocks/{block_id}")
async def delete_photo_block(block_id: str, user=Depends(get_current_user)):
    require_section(user, "blocks")
    photo_blocks_col.delete_one({"_id": ObjectId(block_id)})
    return {"success": True}

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "Go to Top Admin"}
