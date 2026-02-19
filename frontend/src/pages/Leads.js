import React, { useState, useEffect } from 'react';
import { apiFetch, useAuth } from '../App';
import { Search, ChevronDown, Trash2, Edit3, Plus, Download } from 'lucide-react';

const STATUSES = [
  { value: 'all', label: 'Все', color: 'gray' },
  { value: 'new', label: 'Новый', color: 'green' },
  { value: 'contacted', label: 'Связались', color: 'blue' },
  { value: 'in_progress', label: 'В работе', color: 'amber' },
  { value: 'paid', label: 'Оплачен', color: 'purple' },
  { value: 'completed', label: 'Завершён', color: 'blue' },
  { value: 'cancelled', label: 'Отменён', color: 'red' },
];

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s]));

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [editLead, setEditLead] = useState(null);
  const [editForm, setEditForm] = useState({ status: '', notes: '', assigned_to: '' });

  useEffect(() => { loadLeads(); loadUsers(); }, [filter]);

  const loadLeads = async () => {
    setLoading(true);
    const res = await apiFetch(`/api/leads?status=${filter}&limit=100`);
    if (res && res.ok) {
      const data = await res.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  };

  const loadUsers = async () => {
    const res = await apiFetch('/api/users');
    if (res && res.ok) setUsers(await res.json());
  };

  const openEdit = (lead) => {
    setEditLead(lead);
    setEditForm({ status: lead.status || 'new', notes: lead.notes || '', assigned_to: lead.assigned_to || '' });
  };

  const saveEdit = async () => {
    if (!editLead) return;
    await apiFetch(`/api/leads/${editLead.id}`, { method: 'PUT', body: JSON.stringify(editForm) });
    setEditLead(null);
    loadLeads();
  };

  const deleteLead = async (id) => {
    if (!window.confirm('Удалить этот лид?')) return;
    await apiFetch(`/api/leads/${id}`, { method: 'DELETE' });
    loadLeads();
  };

  return (
    <div className="page" data-testid="leads-page">
      <div className="page-header">
        <h1 className="page-title">Лиды / CRM</h1>
        <p className="page-desc">Всего: {total} заявок</p>
      </div>

      {/* Filters */}
      <div className="actions-bar" data-testid="leads-filters">
        {STATUSES.map(s => (
          <button key={s.value}
            className={`btn btn-sm ${filter === s.value ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(s.value)}
            data-testid={`filter-${s.value}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-spinner" style={{margin:'40px auto'}} />
      ) : leads.length === 0 ? (
        <div className="empty-state">
          <Search size={48} />
          <p style={{marginTop:12}}>Нет заявок{filter !== 'all' ? ` со статусом "${STATUS_MAP[filter]?.label}"` : ''}</p>
        </div>
      ) : (
        <div className="table-wrap" data-testid="leads-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Имя</th>
                <th>Контакт</th>
                <th>Источник</th>
                <th>Услуга</th>
                <th>Статус</th>
                <th>Ответственный</th>
                <th>Дата</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, i) => {
                const st = STATUS_MAP[lead.status] || STATUS_MAP['new'];
                return (
                  <tr key={lead.id}>
                    <td style={{color:'var(--text-muted)',fontSize:'0.8rem'}}>{i + 1}</td>
                    <td style={{fontWeight:600,color:'var(--text)'}}>{lead.name || '—'}</td>
                    <td>{lead.contact || '—'}</td>
                    <td><span className="badge badge-gray">{lead.source || '—'}</span></td>
                    <td style={{maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.service || lead.product || '—'}</td>
                    <td><span className={`badge badge-${st.color}`}>{st.label}</span></td>
                    <td style={{fontSize:'0.82rem'}}>{lead.assigned_name || <span style={{color:'var(--text-muted)'}}>—</span>}</td>
                    <td style={{fontSize:'0.78rem',color:'var(--text-muted)',whiteSpace:'nowrap'}}>
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString('ru-RU') : '—'}
                    </td>
                    <td>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn-icon" onClick={() => openEdit(lead)} title="Редактировать" data-testid={`edit-lead-${i}`}>
                          <Edit3 size={14} />
                        </button>
                        <button className="btn-icon" onClick={() => deleteLead(lead.id)} title="Удалить"
                          style={{color:'var(--danger)',borderColor:'rgba(239,68,68,0.3)'}}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editLead && (
        <div className="modal-overlay" onClick={() => setEditLead(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} data-testid="lead-edit-modal">
            <h3 className="modal-title">Редактировать лид</h3>
            <div style={{marginBottom:12,padding:'10px 14px',background:'var(--bg-surface)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}>
              <div style={{fontWeight:600}}>{editLead.name || '—'}</div>
              <div style={{fontSize:'0.82rem',color:'var(--text-muted)'}}>{editLead.contact} | {editLead.source}</div>
              {editLead.message && <div style={{fontSize:'0.82rem',color:'var(--text-sec)',marginTop:4}}>{editLead.message}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Статус</label>
              <select className="form-input" data-testid="lead-status-select" value={editForm.status}
                onChange={e => setEditForm({...editForm, status: e.target.value})}>
                {STATUSES.filter(s => s.value !== 'all').map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Ответственный</label>
              <select className="form-input" data-testid="lead-assign-select" value={editForm.assigned_to}
                onChange={e => setEditForm({...editForm, assigned_to: e.target.value})}>
                <option value="">Не назначен</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.display_name} ({u.role_label || u.role})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Заметки</label>
              <textarea className="form-input" data-testid="lead-notes" value={editForm.notes}
                onChange={e => setEditForm({...editForm, notes: e.target.value})} placeholder="Комментарии по лиду..." />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setEditLead(null)}>Отмена</button>
              <button className="btn btn-primary" onClick={saveEdit} data-testid="lead-save-btn">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
