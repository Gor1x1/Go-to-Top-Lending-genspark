import React, { useState } from 'react';
import { apiFetch, useAuth } from '../App';
import { Lock, Check } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (newPass !== confirmPass) {
      setMsg({ type: 'error', text: 'Пароли не совпадают' });
      return;
    }
    if (newPass.length < 6) {
      setMsg({ type: 'error', text: 'Пароль должен быть не менее 6 символов' });
      return;
    }
    setLoading(true);
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPass, new_password: newPass }),
    });
    if (res && res.ok) {
      setMsg({ type: 'success', text: 'Пароль успешно изменён' });
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } else if (res) {
      const data = await res.json();
      setMsg({ type: 'error', text: data.detail || 'Ошибка' });
    }
    setLoading(false);
  };

  return (
    <div className="page" data-testid="settings-page">
      <div className="page-header">
        <h1 className="page-title">Настройки</h1>
        <p className="page-desc">Управление аккаунтом</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
        {/* Profile info */}
        <div className="card">
          <h3 style={{fontWeight:700,marginBottom:16,color:'var(--accent)'}}>Профиль</h3>
          <div style={{display:'grid',gap:12}}>
            <div>
              <span style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>Имя</span>
              <div style={{fontWeight:600,marginTop:2}}>{user?.display_name || '—'}</div>
            </div>
            <div>
              <span style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>Логин</span>
              <div style={{fontFamily:'monospace',marginTop:2}}>{user?.username}</div>
            </div>
            <div>
              <span style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>Роль</span>
              <div style={{marginTop:4}}><span className="badge badge-purple">{user?.role_label || user?.role}</span></div>
            </div>
            <div>
              <span style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>Телефон</span>
              <div style={{marginTop:2}}>{user?.phone || '—'}</div>
            </div>
            <div>
              <span style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>Email</span>
              <div style={{marginTop:2}}>{user?.email || '—'}</div>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="card">
          <h3 style={{fontWeight:700,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
            <Lock size={18} style={{color:'var(--purple)'}} /> Смена пароля
          </h3>
          {msg && (
            <div style={{
              padding:'10px 14px',borderRadius:'var(--radius-sm)',marginBottom:12,fontSize:'0.85rem',
              background: msg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: msg.type === 'success' ? '#34d399' : '#f87171',
            }} data-testid="password-message">
              {msg.text}
            </div>
          )}
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">Текущий пароль</label>
              <input className="form-input" type="password" value={currentPass}
                onChange={e => setCurrentPass(e.target.value)} required data-testid="current-password" />
            </div>
            <div className="form-group">
              <label className="form-label">Новый пароль</label>
              <input className="form-input" type="password" value={newPass}
                onChange={e => setNewPass(e.target.value)} required placeholder="мин. 6 символов" data-testid="new-password" />
            </div>
            <div className="form-group">
              <label className="form-label">Подтвердите пароль</label>
              <input className="form-input" type="password" value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)} required data-testid="confirm-password" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} data-testid="change-password-btn">
              <Check size={16} /> {loading ? 'Сохранение...' : 'Сменить пароль'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
