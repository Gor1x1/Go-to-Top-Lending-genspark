import os
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from jose import jwt, JWTError
from passlib.context import CryptContext
from bson import ObjectId

# ===== CONFIG =====
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "gototop")
JWT_SECRET = os.environ.get("JWT_SECRET", "gtt-secure-jwt-2026-xK9mPqL3nR7")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ===== APP =====
app = FastAPI(title="Go to Top Admin API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== DB =====
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Collections
users_col = db["users"]
leads_col = db["leads"]
activity_log_col = db["activity_log"]

# Indexes
users_col.create_index("username", unique=True)
leads_col.create_index("created_at")
leads_col.create_index("status")

# ===== ROLES & PERMISSIONS =====
ALL_ROLES = ["main_admin", "developer", "analyst", "operator", "buyer", "courier"]
ALL_SECTIONS = [
    "dashboard", "leads", "employees", "permissions",
    "orders", "calculator", "content", "analytics", "settings"
]
ROLE_LABELS = {
    "main_admin": "Главный Админ",
    "developer": "Разработчик",
    "analyst": "Аналитик",
    "operator": "Оператор",
    "buyer": "Выкупщик",
    "courier": "Курьер",
}
SECTION_LABELS = {
    "dashboard": "Дашборд",
    "leads": "Лиды / CRM",
    "employees": "Сотрудники",
    "permissions": "Управление доступами",
    "orders": "Заказы",
    "calculator": "Калькулятор",
    "content": "Контент сайта",
    "analytics": "Аналитика",
    "settings": "Настройки",
}
DEFAULT_PERMISSIONS = {
    "main_admin": ALL_SECTIONS.copy(),
    "developer": ["dashboard", "content", "calculator", "analytics", "settings"],
    "analyst": ["dashboard", "leads", "analytics"],
    "operator": ["dashboard", "leads", "orders"],
    "buyer": ["dashboard", "orders"],
    "courier": ["dashboard", "orders"],
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

class CreateLeadRequest(BaseModel):
    name: str = ""
    contact: str = ""
    product: str = ""
    service: str = ""
    message: str = ""
    source: str = "manual"
    lang: str = "ru"

# ===== HELPERS =====
def str_id(doc):
    """Convert MongoDB document to JSON-safe dict"""
    if doc is None:
        return None
    d = {k: v for k, v in doc.items() if k != "_id"}
    d["id"] = str(doc["_id"])
    return d

def create_token(user_id: str, role: str):
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None

async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = users_col.find_one({"_id": ObjectId(payload["sub"])})
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return str_id(user)

def require_section(user: dict, section: str):
    """Check if user has access to a section"""
    if user["role"] == "main_admin":
        return True
    permissions = user.get("permissions", DEFAULT_PERMISSIONS.get(user["role"], []))
    if section not in permissions:
        raise HTTPException(status_code=403, detail=f"Нет доступа к разделу: {SECTION_LABELS.get(section, section)}")
    return True

def log_activity(user_id: str, user_name: str, action: str, details: str = ""):
    activity_log_col.insert_one({
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "details": details,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

# ===== SEED DEFAULT ADMIN =====
def seed_admin():
    existing = users_col.find_one({"username": "admin"})
    if not existing:
        users_col.insert_one({
            "username": "admin",
            "password_hash": pwd_context.hash("gototop2026"),
            "display_name": "Главный Администратор",
            "role": "main_admin",
            "phone": "",
            "email": "",
            "is_active": True,
            "permissions": ALL_SECTIONS.copy(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

seed_admin()

# ===== AUTH ENDPOINTS =====
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
    
    users_col.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"password_hash": pwd_context.hash(req.new_password), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    log_activity(user["id"], user["display_name"], "change_password")
    return {"success": True}

@app.get("/api/auth/me")
async def get_me(user=Depends(get_current_user)):
    u = {k: v for k, v in user.items() if k != "password_hash"}
    u["permissions"] = user.get("permissions", DEFAULT_PERMISSIONS.get(user["role"], []))
    u["role_label"] = ROLE_LABELS.get(user["role"], user["role"])
    return u

# ===== USERS / EMPLOYEES =====
@app.get("/api/users")
async def list_users(user=Depends(get_current_user)):
    require_section(user, "employees")
    users = list(users_col.find({}, {"password_hash": 0}))
    result = []
    for u in users:
        d = str_id(u)
        d["role_label"] = ROLE_LABELS.get(d.get("role", ""), d.get("role", ""))
        d["permissions"] = d.get("permissions", DEFAULT_PERMISSIONS.get(d["role"], []))
        result.append(d)
    return result

@app.post("/api/users")
async def create_user(req: CreateUserRequest, user=Depends(get_current_user)):
    require_section(user, "employees")
    if user["role"] != "main_admin":
        raise HTTPException(status_code=403, detail="Только главный админ может создавать сотрудников")
    if req.role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail=f"Роль должна быть одной из: {', '.join(ALL_ROLES)}")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Пароль должен быть не менее 6 символов")
    
    existing = users_col.find_one({"username": req.username})
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
    
    new_user = {
        "username": req.username,
        "password_hash": pwd_context.hash(req.password),
        "display_name": req.display_name,
        "role": req.role,
        "phone": req.phone or "",
        "email": req.email or "",
        "is_active": True,
        "permissions": DEFAULT_PERMISSIONS.get(req.role, ["dashboard"]),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = users_col.insert_one(new_user)
    log_activity(user["id"], user["display_name"], "create_user", f"Создан: {req.display_name} ({req.role})")
    
    new_user_data = {k: v for k, v in new_user.items() if k != "password_hash"}
    new_user_data["id"] = str(result.inserted_id)
    new_user_data["role_label"] = ROLE_LABELS.get(req.role, req.role)
    return new_user_data

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, req: UpdateUserRequest, user=Depends(get_current_user)):
    require_section(user, "employees")
    if user["role"] != "main_admin":
        raise HTTPException(status_code=403, detail="Только главный админ может редактировать сотрудников")
    
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if req.display_name is not None:
        update["display_name"] = req.display_name
    if req.role is not None:
        if req.role not in ALL_ROLES:
            raise HTTPException(status_code=400, detail="Недопустимая роль")
        update["role"] = req.role
    if req.phone is not None:
        update["phone"] = req.phone
    if req.email is not None:
        update["email"] = req.email
    if req.is_active is not None:
        update["is_active"] = req.is_active
    
    users_col.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    log_activity(user["id"], user["display_name"], "update_user", f"Обновлён: {user_id}")
    return {"success": True}

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str, user=Depends(get_current_user)):
    require_section(user, "employees")
    if user["role"] != "main_admin":
        raise HTTPException(status_code=403, detail="Только главный админ может удалять сотрудников")
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")
    
    target = users_col.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    users_col.delete_one({"_id": ObjectId(user_id)})
    log_activity(user["id"], user["display_name"], "delete_user", f"Удалён: {target.get('display_name', '')}")
    return {"success": True}

@app.post("/api/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, user=Depends(get_current_user)):
    if user["role"] != "main_admin":
        raise HTTPException(status_code=403, detail="Только главный админ")
    new_pass = secrets.token_urlsafe(8)
    users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password_hash": pwd_context.hash(new_pass), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    log_activity(user["id"], user["display_name"], "reset_password", f"Сброшен пароль для: {user_id}")
    return {"success": True, "new_password": new_pass}

# ===== PERMISSIONS =====
@app.get("/api/permissions/{user_id}")
async def get_user_permissions(user_id: str, user=Depends(get_current_user)):
    require_section(user, "permissions")
    target = users_col.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    d = str_id(target)
    d["permissions"] = d.get("permissions", DEFAULT_PERMISSIONS.get(d["role"], []))
    return d

@app.put("/api/permissions/{user_id}")
async def update_user_permissions(user_id: str, req: UpdatePermissionsRequest, user=Depends(get_current_user)):
    require_section(user, "permissions")
    if user["role"] != "main_admin":
        raise HTTPException(status_code=403, detail="Только главный админ может настраивать доступы")
    
    valid_sections = [s for s in req.sections if s in ALL_SECTIONS]
    users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"permissions": valid_sections, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    log_activity(user["id"], user["display_name"], "update_permissions", f"Обновлены для: {user_id}")
    return {"success": True, "sections": valid_sections}

# ===== LEADS / CRM =====
@app.get("/api/leads")
async def list_leads(
    status: Optional[str] = None,
    limit: int = Query(50, le=500),
    offset: int = 0,
    user=Depends(get_current_user)
):
    require_section(user, "leads")
    query = {}
    if status and status != "all":
        query["status"] = status
    
    total = leads_col.count_documents(query)
    leads = list(leads_col.find(query).sort("created_at", -1).skip(offset).limit(limit))
    
    result = []
    for lead in leads:
        d = str_id(lead)
        result.append(d)
    
    return {"leads": result, "total": total}

@app.post("/api/leads")
async def create_lead(req: CreateLeadRequest, user=Depends(get_current_user)):
    require_section(user, "leads")
    lead = {
        "source": req.source,
        "name": req.name,
        "contact": req.contact,
        "product": req.product,
        "service": req.service,
        "message": req.message,
        "lang": req.lang,
        "status": "new",
        "notes": "",
        "assigned_to": "",
        "assigned_name": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = leads_col.insert_one(lead)
    lead_data = {k: v for k, v in lead.items()}
    lead_data["id"] = str(result.inserted_id)
    log_activity(user["id"], user["display_name"], "create_lead", f"Лид: {req.name}")
    return lead_data

@app.put("/api/leads/{lead_id}")
async def update_lead(lead_id: str, req: UpdateLeadRequest, user=Depends(get_current_user)):
    require_section(user, "leads")
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if req.status is not None:
        update["status"] = req.status
    if req.notes is not None:
        update["notes"] = req.notes
    if req.assigned_to is not None:
        update["assigned_to"] = req.assigned_to
        if req.assigned_to:
            assignee = users_col.find_one({"_id": ObjectId(req.assigned_to)}, {"display_name": 1})
            update["assigned_name"] = assignee["display_name"] if assignee else ""
        else:
            update["assigned_name"] = ""
    
    leads_col.update_one({"_id": ObjectId(lead_id)}, {"$set": update})
    log_activity(user["id"], user["display_name"], "update_lead", f"Обновлён лид: {lead_id}")
    return {"success": True}

@app.delete("/api/leads/{lead_id}")
async def delete_lead(lead_id: str, user=Depends(get_current_user)):
    require_section(user, "leads")
    leads_col.delete_one({"_id": ObjectId(lead_id)})
    return {"success": True}

# ===== PUBLIC LEAD SUBMISSION (from landing) =====
@app.post("/api/lead")
async def submit_lead(req: CreateLeadRequest):
    lead = {
        "source": req.source or "form",
        "name": req.name,
        "contact": req.contact,
        "product": req.product,
        "service": req.service,
        "message": req.message,
        "lang": req.lang,
        "status": "new",
        "notes": "",
        "assigned_to": "",
        "assigned_name": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    leads_col.insert_one(lead)
    return {"success": True, "message": "Lead received"}

# ===== DASHBOARD STATS =====
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
    
    # Recent leads
    recent = list(leads_col.find({}).sort("created_at", -1).limit(5))
    recent_leads = [str_id(l) for l in recent]
    
    # Recent activity
    recent_activity = list(activity_log_col.find({}).sort("created_at", -1).limit(10))
    activity = [str_id(a) for a in recent_activity]
    
    # Leads by status
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    by_status = {r["_id"]: r["count"] for r in leads_col.aggregate(pipeline)}
    
    # Leads by source
    pipeline2 = [{"$group": {"_id": "$source", "count": {"$sum": 1}}}]
    by_source = {r["_id"]: r["count"] for r in leads_col.aggregate(pipeline2)}
    
    return {
        "leads": {
            "total": total_leads,
            "new": new_leads,
            "in_progress": in_progress,
            "completed": completed,
            "today": today_leads,
            "by_status": by_status,
            "by_source": by_source,
        },
        "users": {
            "total": total_users,
            "active": active_users,
        },
        "recent_leads": recent_leads,
        "recent_activity": activity,
    }

# ===== ACTIVITY LOG =====
@app.get("/api/activity")
async def get_activity(limit: int = Query(20, le=100), user=Depends(get_current_user)):
    require_section(user, "dashboard")
    logs = list(activity_log_col.find({}).sort("created_at", -1).limit(limit))
    return [str_id(l) for l in logs]

# ===== CONFIG ENDPOINTS =====
@app.get("/api/config/roles")
async def get_roles_config(user=Depends(get_current_user)):
    return {
        "roles": ALL_ROLES,
        "role_labels": ROLE_LABELS,
        "sections": ALL_SECTIONS,
        "section_labels": SECTION_LABELS,
        "default_permissions": DEFAULT_PERMISSIONS,
    }

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "Go to Top Admin"}
