import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Permissions from './pages/Permissions';
import Leads from './pages/Leads';
import Settings from './pages/Settings';
import Sidebar from './components/Sidebar';
import './App.css';

const API = process.env.REACT_APP_BACKEND_URL;

// Auth Context
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('gtt_token');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (res.status === 401) {
    localStorage.removeItem('gtt_token');
    localStorage.removeItem('gtt_user');
    window.location.href = '/login';
    return null;
  }
  return res;
}

function AppLayout() {
  const { user, permissions } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {permissions.includes('leads') && <Route path="/leads" element={<Leads />} />}
          {permissions.includes('employees') && <Route path="/employees" element={<Employees />} />}
          {permissions.includes('permissions') && <Route path="/permissions" element={<Permissions />} />}
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rolesConfig, setRolesConfig] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('gtt_token');
    if (token) {
      apiFetch('/api/auth/me').then(res => {
        if (res && res.ok) {
          res.json().then(data => {
            setUser(data);
            setPermissions(data.permissions || []);
            // Load roles config
            apiFetch('/api/config/roles').then(r => r && r.ok && r.json().then(setRolesConfig));
          });
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('gtt_token', data.token);
      setUser(data.user);
      setPermissions(data.user.permissions || []);
      // Load roles config
      const rc = await apiFetch('/api/config/roles');
      if (rc && rc.ok) setRolesConfig(await rc.json());
      return { success: true };
    }
    return { success: false, error: data.detail || 'Ошибка входа' };
  };

  const logout = () => {
    localStorage.removeItem('gtt_token');
    setUser(null);
    setPermissions([]);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, permissions, login, logout, rolesConfig, setUser, setPermissions }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
