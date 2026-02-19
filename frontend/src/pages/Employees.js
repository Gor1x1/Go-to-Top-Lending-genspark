import React, { useState, useEffect } from 'react';
import { apiFetch, useAuth } from '../App';
import { UserPlus, Edit3, Trash2, Key, X, Check } from 'lucide-react';

export default function Employees() {
  const { user, rolesConfig } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', display_name: '', role: 'operator', phone: '', email: '' });
  const [error, setError] = useState('');
  const [resetPass, setResetPass] = useState(null);

  const ROLE_LABELS = rolesConfig?.role_labels || {};
  const ALL_ROLES = rolesConfig?.roles || [];

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    const res = await apiFetch('/api/users');
    if (res && res.ok) setUsers(await res.json());
    setLoading(false);
  };

  const openCreate = () => {
    setEditUser(null);
    setForm({ username: '', password: '', display_name: '', role: 'operator', phone: '', email: '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ username: u.username, password: '', display_name: u.display_name, role: u.role, phone: u.phone || '', email: u.email || '' });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (editUser) {
      const res = await apiFetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ display_name: form.display_name, role: form.role, phone: form.phone, email: form.email }),
      });
      if (res && res.ok) { setShowModal(false); loadUsers(); }
      else if (res) { const d = await res.json(); setError(d.detail || 'Ошибка'); }
    } else {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (res && res.ok) { setShowModal(false); loadUsers(); }
      else if (res) { const d = await res.json(); setError(d.detail || 'Ошибка'); }
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Удалить сотрудника "${u.display_name}"?`)) return;
    await apiFetch(`/api/users/${u.id}`, { method: 'DELETE' });
    loadUsers();
  };

  const handleToggleActive = async (u) => {
    await apiFetch(`/api/users/${u.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: !u.is_active }),
    });
    loadUsers();
  };

  const handleResetPassword = async (u) => {
    const res = await apiFetch(`/api/users/${u.id}/reset-password`, { method: 'POST' });
    if (res && res.ok) {
      const data = await res.json();
      setResetPass({ user: u.display_name, password: data.new_password });
    }
  };

  if (loading) return <div className="page"><div className="loading-spinner" style={{margin:'60px auto'}} /></div>;

  const isAdmin = user?.role === 'main_admin';

  return (
    <div className="page" data-testid="employees-page">
      <div className="page-header">
        <h1 className="page-title">Сотрудники</h1>
        <p className="page-desc">Управление командой — {users.length} сотрудник(ов)</p>
      </div>

      {isAdmin && (
        <div className="actions-bar">
          <button className="btn btn-primary" onClick={openCreate} data-testid="add-employee-btn">
            <UserPlus size={16} /> Добавить сотрудника
          </button>
        </div>
      )}

      <div className="table-wrap" data-testid="employees-table">
        <table>
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Логин</th>
              <th>Роль</th>
              <th>Контакт</th>
              <th>Статус</th>
              {isAdmin && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{fontWeight:600,color:'var(--text)'}}>{u.display_name}</div>
                </td>
                <td style={{fontFamily:'monospace',fontSize:'0.82rem'}}>{u.username}</td>
                <td><span className={`badge ${u.role === 'main_admin' ? 'badge-purple' : 'badge-blue'}`}>{ROLE_LABELS[u.role] || u.role}</span></td>
                <td>
                  {u.phone && <div style={{fontSize:'0.82rem'}}>{u.phone}</div>}
                  {u.email && <div style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>{u.email}</div>}
                  {!u.phone && !u.email && <span style={{color:'var(--text-muted)'}}>—</span>}
                </td>
                <td>
                  <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}
                    style={{cursor: isAdmin ? 'pointer' : 'default'}}
                    onClick={() => isAdmin && handleToggleActive(u)}
                  >
                    {u.is_active ? 'Активен' : 'Деактивирован'}
                  </span>
                </td>
                {isAdmin && (
                  <td>
                    <div style={{display:'flex',gap:6}}>
                      <button className="btn-icon" onClick={() => openEdit(u)} title="Редактировать" data-testid={`edit-user-${u.username}`}>
                        <Edit3 size={14} />
                      </button>
                      <button className="btn-icon" onClick={() => handleResetPassword(u)} title="Сбросить пароль" data-testid={`reset-pass-${u.username}`}>
                        <Key size={14} />
                      </button>
                      {u.role !== 'main_admin' && (
                        <button className="btn-icon" onClick={() => handleDelete(u)} title="Удалить" data-testid={`delete-user-${u.username}`}
                          style={{color:'var(--danger)',borderColor:'rgba(239,68,68,0.3)'}}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reset password result */}
      {resetPass && (
        <div className="modal-overlay" onClick={() => setResetPass(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth:400}}>
            <h3 className="modal-title">Пароль сброшен</h3>
            <p style={{color:'var(--text-sec)',marginBottom:12}}>Новый пароль для <strong>{resetPass.user}</strong>:</p>
            <div style={{
              padding:'14px 20px',background:'var(--bg-surface)',border:'1px solid var(--purple)',
              borderRadius:'var(--radius-sm)',fontFamily:'monospace',fontSize:'1.1rem',fontWeight:700,
              color:'var(--accent)',textAlign:'center',letterSpacing:1
            }} data-testid="new-password-display">
              {resetPass.password}
            </div>
            <p style={{fontSize:'0.78rem',color:'var(--text-muted)',marginTop:10}}>
              Скопируйте и передайте сотруднику. Пароль больше не будет показан.
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setResetPass(null)}>Понятно</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} data-testid="employee-modal">
            <h3 className="modal-title">{editUser ? 'Редактировать' : 'Новый сотрудник'}</h3>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Имя / ФИО *</label>
                <input className="form-input" data-testid="employee-name" value={form.display_name}
                  onChange={e => setForm({...form, display_name: e.target.value})} required placeholder="Георгий Дарбинян" />
              </div>
              {!editUser && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Логин *</label>
                      <input className="form-input" data-testid="employee-username" value={form.username}
                        onChange={e => setForm({...form, username: e.target.value})} required placeholder="georgi" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Пароль *</label>
                      <input className="form-input" data-testid="employee-password" type="password" value={form.password}
                        onChange={e => setForm({...form, password: e.target.value})} required placeholder="мин. 6 символов" />
                    </div>
                  </div>
                </>
              )}
              <div className="form-group">
                <label className="form-label">Роль *</label>
                <select className="form-input" data-testid="employee-role" value={form.role}
                  onChange={e => setForm({...form, role: e.target.value})}>
                  {ALL_ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Телефон</label>
                  <input className="form-input" value={form.phone}
                    onChange={e => setForm({...form, phone: e.target.value})} placeholder="+374..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})} placeholder="email@example.com" />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary" data-testid="employee-submit">
                  <Check size={16} /> {editUser ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
