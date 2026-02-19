import React, { useState, useEffect } from 'react';
import { apiFetch, useAuth } from '../App';
import { TrendingUp, Users, FileText, Clock, Activity } from 'lucide-react';

const STATUS_LABELS = {
  new: 'Новый',
  in_progress: 'В работе',
  contacted: 'Связались',
  paid: 'Оплачен',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const res = await apiFetch('/api/dashboard/stats');
    if (res && res.ok) setStats(await res.json());
    setLoading(false);
  };

  if (loading) return <div className="page"><div className="loading-spinner" style={{margin:'60px auto'}} /></div>;

  const ld = stats?.leads || {};
  const usr = stats?.users || {};

  return (
    <div className="page" data-testid="dashboard-page">
      <div className="page-header">
        <h1 className="page-title">Дашборд</h1>
        <p className="page-desc">Добро пожаловать, {user?.display_name || user?.username}</p>
      </div>

      {ld.new > 0 && (
        <div className="alert alert-danger" data-testid="new-leads-alert">
          <FileText size={18} />
          <strong>{ld.new} новых заявок!</strong>
          <span style={{color:'var(--text-muted)',fontSize:'0.82rem',marginLeft:4}}>Нажмите «Лиды» для просмотра</span>
        </div>
      )}

      <div className="stat-grid" data-testid="stats-grid">
        <div className="stat-card purple">
          <div className="stat-value">{ld.total || 0}</div>
          <div className="stat-label">Всего лидов</div>
        </div>
        <div className="stat-card green">
          <div className="stat-value">{ld.new || 0}</div>
          <div className="stat-label">Новых</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-value">{ld.in_progress || 0}</div>
          <div className="stat-label">В работе</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-value">{ld.today || 0}</div>
          <div className="stat-label">Сегодня</div>
        </div>
        <div className="stat-card red">
          <div className="stat-value">{usr.active || 0}</div>
          <div className="stat-label">Сотрудников</div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        {/* Recent Leads */}
        <div className="card">
          <h3 style={{fontWeight:700,marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
            <FileText size={18} style={{color:'var(--purple)'}} /> Последние заявки
          </h3>
          {(stats?.recent_leads || []).length === 0 ? (
            <p style={{color:'var(--text-muted)',fontSize:'0.85rem'}}>Пока нет заявок</p>
          ) : (
            <div>
              {stats.recent_leads.map((lead, i) => (
                <div key={lead.id || i} style={{
                  display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'10px 0',borderBottom: i < stats.recent_leads.length-1 ? '1px solid var(--border)' : 'none'
                }}>
                  <div>
                    <div style={{fontWeight:600,fontSize:'0.88rem'}}>{lead.name || '—'}</div>
                    <div style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>{lead.contact || '—'} | {lead.source}</div>
                  </div>
                  <span className={`badge badge-${lead.status === 'new' ? 'green' : lead.status === 'completed' ? 'blue' : 'amber'}`}>
                    {STATUS_LABELS[lead.status] || lead.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Log */}
        <div className="card">
          <h3 style={{fontWeight:700,marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
            <Activity size={18} style={{color:'var(--success)'}} /> Журнал действий
          </h3>
          {(stats?.recent_activity || []).length === 0 ? (
            <p style={{color:'var(--text-muted)',fontSize:'0.85rem'}}>Нет записей</p>
          ) : (
            <div>
              {stats.recent_activity.map((act, i) => (
                <div key={act.id || i} style={{
                  padding:'8px 0',borderBottom: i < stats.recent_activity.length-1 ? '1px solid var(--border)' : 'none',
                  fontSize:'0.82rem'
                }}>
                  <span style={{fontWeight:600,color:'var(--accent)'}}>{act.user_name}</span>{' '}
                  <span style={{color:'var(--text-sec)'}}>
                    {act.action === 'login' ? 'вошёл в систему' :
                     act.action === 'create_user' ? 'создал сотрудника' :
                     act.action === 'update_lead' ? 'обновил лид' :
                     act.action === 'create_lead' ? 'создал лид' :
                     act.action === 'change_password' ? 'сменил пароль' :
                     act.action === 'update_permissions' ? 'обновил доступы' :
                     act.action}
                  </span>
                  {act.details && <div style={{color:'var(--text-muted)',fontSize:'0.75rem',marginTop:2}}>{act.details}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lead Sources */}
      {Object.keys(ld.by_source || {}).length > 0 && (
        <div className="card" style={{marginTop:20}}>
          <h3 style={{fontWeight:700,marginBottom:14}}>Источники лидов</h3>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            {Object.entries(ld.by_source).map(([source, count]) => (
              <div key={source} style={{
                padding:'10px 18px',background:'var(--bg-surface)',border:'1px solid var(--border)',
                borderRadius:'var(--radius-sm)',display:'flex',alignItems:'center',gap:8
              }}>
                <span style={{fontWeight:700,color:'var(--purple)'}}>{count}</span>
                <span style={{color:'var(--text-sec)',fontSize:'0.85rem'}}>{source}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
