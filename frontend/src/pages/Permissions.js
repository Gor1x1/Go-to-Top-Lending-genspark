import React, { useState, useEffect } from 'react';
import { apiFetch, useAuth } from '../App';
import { Shield, Save, Check } from 'lucide-react';

export default function Permissions() {
  const { user, rolesConfig } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [perms, setPerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const SECTION_LABELS = rolesConfig?.section_labels || {};
  const ALL_SECTIONS = rolesConfig?.sections || [];
  const ROLE_LABELS = rolesConfig?.role_labels || {};

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    const res = await apiFetch('/api/users');
    if (res && res.ok) {
      const data = await res.json();
      setUsers(data);
      if (data.length > 0 && !selectedUser) {
        selectUser(data[0]);
      }
    }
    setLoading(false);
  };

  const selectUser = async (u) => {
    setSelectedUser(u);
    const res = await apiFetch(`/api/permissions/${u.id}`);
    if (res && res.ok) {
      const data = await res.json();
      setPerms(data.permissions || []);
    }
  };

  const togglePerm = (section) => {
    setPerms(prev => prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]);
  };

  const savePerms = async () => {
    if (!selectedUser) return;
    setSaving(true);
    await apiFetch(`/api/permissions/${selectedUser.id}`, {
      method: 'PUT',
      body: JSON.stringify({ sections: perms }),
    });
    setSaving(false);
    loadUsers();
  };

  if (loading) return <div className="page"><div className="loading-spinner" style={{margin:'60px auto'}} /></div>;

  const isAdmin = user?.role === 'main_admin';

  return (
    <div className="page" data-testid="permissions-page">
      <div className="page-header">
        <h1 className="page-title">Управление доступами</h1>
        <p className="page-desc">Настройте, какие разделы доступны каждому сотруднику</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:20}}>
        {/* User list */}
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',fontWeight:700,fontSize:'0.88rem',color:'var(--accent)'}}>
            Сотрудники
          </div>
          {users.map(u => (
            <div key={u.id}
              onClick={() => selectUser(u)}
              data-testid={`perm-user-${u.username}`}
              style={{
                padding:'12px 20px',cursor:'pointer',borderBottom:'1px solid var(--border)',
                transition:'all 0.2s',
                background: selectedUser?.id === u.id ? 'var(--purple-glow)' : 'transparent',
                borderLeft: selectedUser?.id === u.id ? '3px solid var(--purple)' : '3px solid transparent',
              }}
            >
              <div style={{fontWeight:600,fontSize:'0.88rem',color: selectedUser?.id === u.id ? 'var(--accent)' : 'var(--text)'}}>{u.display_name}</div>
              <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginTop:2}}>
                {ROLE_LABELS[u.role] || u.role}
              </div>
            </div>
          ))}
        </div>

        {/* Permissions editor */}
        <div className="card">
          {selectedUser ? (
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                <div>
                  <h3 style={{fontWeight:700,fontSize:'1.1rem'}}>{selectedUser.display_name}</h3>
                  <span className="badge badge-purple" style={{marginTop:6}}>{ROLE_LABELS[selectedUser.role] || selectedUser.role}</span>
                </div>
                {isAdmin && (
                  <button className="btn btn-primary" onClick={savePerms} disabled={saving} data-testid="save-permissions-btn">
                    <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                )}
              </div>

              {selectedUser.role === 'main_admin' && (
                <div style={{
                  padding:'12px 16px',background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.2)',
                  borderRadius:'var(--radius-sm)',marginBottom:20,fontSize:'0.85rem',color:'var(--accent)'
                }}>
                  <Shield size={16} style={{verticalAlign:'middle',marginRight:6}} />
                  Главный админ имеет доступ ко всем разделам
                </div>
              )}

              <div className="perm-grid" data-testid="permissions-grid">
                {ALL_SECTIONS.map(section => {
                  const checked = selectedUser.role === 'main_admin' || perms.includes(section);
                  const disabled = !isAdmin || selectedUser.role === 'main_admin';
                  return (
                    <label key={section}
                      className={`perm-item${checked ? ' checked' : ''}`}
                      style={{opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer'}}
                    >
                      <input type="checkbox" checked={checked} disabled={disabled}
                        onChange={() => !disabled && togglePerm(section)} />
                      <span>{SECTION_LABELS[section] || section}</span>
                    </label>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Shield size={48} />
              <p>Выберите сотрудника для настройки доступов</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
