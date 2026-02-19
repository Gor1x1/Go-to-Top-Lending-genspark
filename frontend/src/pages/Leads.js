import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, useAuth } from '../App';
import { Search, Trash2, Edit3, Download, Plus, ChevronDown, ChevronUp, Calculator, BarChart3, X, Save, FileText, ExternalLink, User, Check, FileDown, RefreshCw } from 'lucide-react';

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
const SOURCES = [
  { value: 'all', label: 'Все источники' },
  { value: 'form', label: 'Форма' },
  { value: 'popup', label: 'Попап' },
  { value: 'calculator_pdf', label: 'Калькулятор' },
  { value: 'manual', label: 'Вручную' },
  { value: 'telegram', label: 'Telegram' },
];
const SOURCE_MAP = Object.fromEntries(SOURCES.map(s => [s.value, s]));

function parseCalcData(str) {
  if (!str) return null;
  try { const d = JSON.parse(str); return d; } catch { return null; }
}

function formatAmount(amt) {
  if (!amt && amt !== 0) return '—';
  return Number(amt).toLocaleString('ru-RU') + ' ֏';
}

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [expandedLead, setExpandedLead] = useState(null);
  const [editLead, setEditLead] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [createForm, setCreateForm] = useState({ name: '', contact: '', product: '', service: '', message: '', source: 'manual', lang: 'ru', total_amount: 0, calc_data: '', referral_code: '', custom_fields: '' });
  const [calcItems, setCalcItems] = useState([{ name: '', qty: 1, price: 0 }]);
  
  // Calculator modal state
  const [showCalcModal, setShowCalcModal] = useState(null); // lead object or null
  const [calcServices, setCalcServices] = useState([]);
  const [calcTabs, setCalcTabs] = useState([]);
  const [selectedTab, setSelectedTab] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadLeads(); loadUsers(); }, [filter, sourceFilter]);

  const loadLeads = async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: filter, limit: '200' });
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    const res = await apiFetch(`/api/leads?${params}`);
    if (res?.ok) { const d = await res.json(); setLeads(d.leads || []); setTotal(d.total || 0); }
    setLoading(false);
  };

  const loadUsers = async () => { const res = await apiFetch('/api/users'); if (res?.ok) setUsers(await res.json()); };
  
  const loadCalcServices = async () => {
    const res = await apiFetch('/api/calc-services-public');
    if (res?.ok) {
      const data = await res.json();
      setCalcTabs(data.tabs || []);
      setCalcServices(data.services || []);
      if (data.tabs?.length > 0) setSelectedTab(data.tabs[0].id);
    }
  };

  const loadAnalytics = async () => {
    const res = await apiFetch('/api/leads/analytics');
    if (res?.ok) { setAnalytics(await res.json()); setShowAnalytics(true); }
  };

  const openEdit = (lead) => {
    setEditLead(lead);
    setEditForm({
      name: lead.name || '', contact: lead.contact || '', product: lead.product || '',
      service: lead.service || '', message: lead.message || '', status: lead.status || 'new',
      notes: lead.notes || '', assigned_to: lead.assigned_to || '',
      total_amount: lead.total_amount || 0, referral_code: lead.referral_code || '',
      custom_fields: lead.custom_fields || '',
    });
  };

  const saveEdit = async () => {
    if (!editLead) return;
    await apiFetch(`/api/leads/${editLead.id}`, { method: 'PUT', body: JSON.stringify(editForm) });
    setEditLead(null); loadLeads();
  };

  const quickStatus = async (leadId, status) => {
    await apiFetch(`/api/leads/${leadId}`, { method: 'PUT', body: JSON.stringify({ status }) });
    loadLeads();
  };

  const deleteLead = async (id) => { if (!window.confirm('Удалить лид?')) return; await apiFetch(`/api/leads/${id}`, { method: 'DELETE' }); loadLeads(); };

  const calcTotal = useMemo(() => calcItems.reduce((s, i) => s + (i.qty * i.price), 0), [calcItems]);

  const createLead = async () => {
    const calcData = calcItems.some(i => i.name) ? JSON.stringify({ items: calcItems.filter(i => i.name).map(i => ({ ...i, sum: i.qty * i.price })), total: calcTotal }) : '';
    const body = { ...createForm, total_amount: calcTotal || createForm.total_amount, calc_data: calcData };
    await apiFetch('/api/leads', { method: 'POST', body: JSON.stringify(body) });
    setShowCreate(false); setCreateForm({ name: '', contact: '', product: '', service: '', message: '', source: 'manual', lang: 'ru', total_amount: 0, calc_data: '', referral_code: '', custom_fields: '' });
    setCalcItems([{ name: '', qty: 1, price: 0 }]);
    loadLeads(); loadAnalytics();
  };

  // Open calculator modal for a lead
  const openCalcModal = async (lead) => {
    setShowCalcModal(lead);
    setSelectedServices([]);
    await loadCalcServices();
  };
  
  // Add service to calculation
  const toggleService = (service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, { ...service, qty: 1 }];
      }
    });
  };
  
  const updateServiceQty = (serviceId, qty) => {
    setSelectedServices(prev => prev.map(s => s.id === serviceId ? { ...s, qty: Math.max(1, qty) } : s));
  };
  
  const calcModalTotal = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.qty * (s.price || 0)), 0);
  }, [selectedServices]);
  
  // Generate PDF and save to lead
  const generateAndSavePDF = async () => {
    if (!showCalcModal || selectedServices.length === 0) return;
    setGenerating(true);
    
    const items = selectedServices.map(s => ({
      name: s.name_ru,
      qty: s.qty,
      price: s.price || 0,
      sum: s.qty * (s.price || 0)
    }));
    
    const res = await apiFetch('/api/generate-pdf', {
      method: 'POST',
      body: JSON.stringify({
        lead_id: showCalcModal.id,
        items,
        total: calcModalTotal,
        client_name: showCalcModal.name || '',
        lang: showCalcModal.lang || 'ru'
      })
    });
    
    if (res?.ok) {
      const data = await res.json();
      setShowCalcModal(null);
      setSelectedServices([]);
      loadLeads();
      // Open PDF in new tab
      if (data.pdf_url) {
        window.open(process.env.REACT_APP_BACKEND_URL + data.pdf_url, '_blank');
      }
    }
    setGenerating(false);
  };

  const filteredServices = useMemo(() => {
    if (!selectedTab) return calcServices;
    return calcServices.filter(s => s.tab_id === selectedTab);
  }, [calcServices, selectedTab]);

  return (
    <div className="page" data-testid="leads-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div><h1 className="page-title">Лиды / CRM</h1><p className="page-desc">Всего: {total} заявок</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={loadAnalytics} data-testid="analytics-btn"><BarChart3 size={16} /> Аналитика</button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} data-testid="create-lead-btn"><Plus size={16} /> Новый лид</button>
        </div>
      </div>

      {/* Analytics Panel */}
      {showAnalytics && analytics && (
        <div className="card" style={{ marginBottom: 20 }} data-testid="analytics-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={18} style={{ color: 'var(--purple)' }} /> Аналитика лидов</h3>
            <button className="btn-icon" onClick={() => setShowAnalytics(false)}><X size={14} /></button>
          </div>
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
            <div className="stat-card purple"><div className="stat-value">{analytics.total}</div><div className="stat-label">Всего лидов</div></div>
            <div className="stat-card green"><div className="stat-value">{formatAmount(analytics.total_amount)}</div><div className="stat-label">Общая стоимость</div></div>
            <div className="stat-card blue"><div className="stat-value">{analytics.today_count}</div><div className="stat-label">Сегодня</div></div>
            <div className="stat-card amber"><div className="stat-value">{formatAmount(analytics.today_amount)}</div><div className="stat-label">Сумма за сегодня</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', marginBottom: 8 }}>По статусам</div>
              {Object.entries(analytics.by_status || {}).map(([st, data]) => {
                const s = STATUS_MAP[st] || { label: st, color: 'gray' };
                return (<div key={st} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                  <span className={`badge badge-${s.color}`}>{s.label}</span>
                  <span><strong>{data.count}</strong> шт — <strong>{formatAmount(data.amount)}</strong></span>
                </div>);
              })}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', marginBottom: 8 }}>По источникам</div>
              {Object.entries(analytics.by_source || {}).map(([src, data]) => (
                <div key={src} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                  <span className="badge badge-purple">{SOURCE_MAP[src]?.label || src}</span>
                  <span><strong>{data.count}</strong> шт — <strong>{formatAmount(data.amount)}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-sm btn-outline" onClick={() => { window.open(`${process.env.REACT_APP_BACKEND_URL}/api/leads/export`, '_blank'); }} data-testid="export-csv-btn"><Download size={14} /> CSV</button>
        <select className="form-input" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.82rem' }} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} data-testid="source-filter">
          {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div className="spacer" />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button key={s.value} className={`btn btn-sm ${filter === s.value ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(s.value)} data-testid={`filter-${s.value}`}>{s.label}</button>
        ))}
      </div>

      {/* Lead Cards */}
      {loading ? <div className="loading-spinner" style={{ margin: '40px auto' }} /> :
        leads.length === 0 ? <div className="empty-state"><Search size={48} /><p style={{ marginTop: 12 }}>Нет заявок</p></div> :
          <div style={{ display: 'grid', gap: 8 }}>
            {leads.map((lead, i) => {
              const st = STATUS_MAP[lead.status] || STATUS_MAP['new'];
              const calcData = parseCalcData(lead.calc_data);
              const isExpanded = expandedLead === lead.id;
              const amt = lead.total_amount || (calcData?.total) || 0;
              const hasPDF = calcData?.pdf_url;

              return (
                <div key={lead.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `3px solid var(--${st.color === 'green' ? 'success' : st.color === 'amber' ? 'warning' : st.color === 'red' ? 'danger' : st.color === 'purple' ? 'purple' : 'info'})` }} data-testid={`lead-card-${i}`}>
                  {/* Lead header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }} onClick={() => setExpandedLead(isExpanded ? null : lead.id)}>
                    <span style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.82rem', minWidth: 36 }}>#{lead.lead_number || i + 1}</span>
                    <span className={`badge badge-${lead.source === 'calculator_pdf' ? 'purple' : lead.source === 'form' ? 'blue' : lead.source === 'telegram' ? 'blue' : 'gray'}`} style={{ fontSize: '0.7rem' }}>
                      {SOURCE_MAP[lead.source]?.label || lead.source}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>{lead.name || '—'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{lead.contact || '—'}</div>
                    </div>
                    {hasPDF && (
                      <button className="btn btn-sm btn-outline" style={{ padding: '4px 8px' }} onClick={(e) => { e.stopPropagation(); window.open(process.env.REACT_APP_BACKEND_URL + calcData.pdf_url, '_blank'); }} title="Скачать PDF">
                        <FileDown size={14} />
                      </button>
                    )}
                    {amt > 0 && <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--success)', whiteSpace: 'nowrap' }}>{formatAmount(amt)}</div>}
                    <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.78rem', background: 'var(--bg-surface)' }}
                      value={lead.status} onClick={e => e.stopPropagation()} onChange={e => quickStatus(lead.id, e.target.value)} data-testid={`status-select-${i}`}>
                      {STATUSES.filter(s => s.value !== 'all').map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button className="btn-icon" onClick={() => openEdit(lead)} title="Редактировать" data-testid={`edit-lead-${i}`}><Edit3 size={14} /></button>
                      <button className="btn-icon" style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => deleteLead(lead.id)}><Trash2 size={14} /></button>
                    </div>
                    {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: '14px 0', fontSize: '0.85rem' }}>
                        <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Продукт</span>{lead.product || '—'}</div>
                        <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Услуга</span>{lead.service || '—'}</div>
                        <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Ответственный</span>{lead.assigned_name || '—'}</div>
                        <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Реф. код</span>{lead.referral_code || '—'}</div>
                        <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Язык</span>{lead.lang || '—'}</div>
                        <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Дата</span>{lead.created_at ? new Date(lead.created_at).toLocaleString('ru-RU') : '—'}</div>
                      </div>
                      {lead.message && <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-sec)', marginBottom: 10 }}>{lead.message}</div>}
                      {lead.notes && <div style={{ padding: '10px 14px', background: 'rgba(139,92,246,0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(139,92,246,0.15)', fontSize: '0.85rem', color: 'var(--accent)', marginBottom: 10 }}><strong>Заметки:</strong> {lead.notes}</div>}

                      {/* Calc data — services table */}
                      {calcData && calcData.items && calcData.items.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)' }}>Выбранные услуги:</div>
                            {calcData.pdf_url && (
                              <a href={process.env.REACT_APP_BACKEND_URL + calcData.pdf_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline" style={{ gap: 4 }}>
                                <FileDown size={14} /> Скачать PDF
                              </a>
                            )}
                          </div>
                          <div className="table-wrap">
                            <table>
                              <thead><tr><th>Услуга</th><th style={{ textAlign: 'right' }}>Кол-во</th><th style={{ textAlign: 'right' }}>Цена</th><th style={{ textAlign: 'right' }}>Сумма</th></tr></thead>
                              <tbody>
                                {calcData.items.map((item, ii) => (
                                  <tr key={ii}>
                                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{item.name}</td>
                                    <td style={{ textAlign: 'right' }}>{item.qty}</td>
                                    <td style={{ textAlign: 'right' }}>{formatAmount(item.price)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{formatAmount(item.sum || item.qty * item.price)}</td>
                                  </tr>
                                ))}
                                <tr><td colSpan={3} style={{ fontWeight: 800, textAlign: 'right' }}>Итого:</td><td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1.05rem', color: 'var(--success)' }}>{formatAmount(calcData.total)}</td></tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Custom fields */}
                      {lead.custom_fields && (() => { try { const cf = JSON.parse(lead.custom_fields); return cf && Object.keys(cf).length > 0 ? (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>Доп. данные:</div>
                          {Object.entries(cf).map(([k, v]) => (
                            <div key={k} style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-muted)' }}>{k}:</span>{' '}
                              {String(v).startsWith('http') ? <a href={String(v)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{String(v)} <ExternalLink size={12} style={{ verticalAlign: 'middle' }} /></a> : String(v)}
                            </div>
                          ))}
                        </div>
                      ) : null; } catch { return null; } })()}

                      {/* Calculator button for form leads without calc data */}
                      {(!calcData || !calcData.items || calcData.items.length === 0) && lead.source !== 'calculator_pdf' && (
                        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => openCalcModal(lead)} data-testid="calc-cost-btn">
                          <Calculator size={16} /> Рассчитать стоимость
                        </button>
                      )}
                      
                      {/* Recalculate button for leads with existing calc */}
                      {calcData && calcData.items && calcData.items.length > 0 && (
                        <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={() => openCalcModal(lead)}>
                          <RefreshCw size={14} /> Пересчитать
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      }

      {/* Calculator Modal */}
      {showCalcModal && (
        <div className="modal-overlay" onClick={() => { setShowCalcModal(null); setSelectedServices([]); }}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }} data-testid="calc-modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="modal-title" style={{ margin: 0 }}>
                <Calculator size={20} style={{ marginRight: 8, color: 'var(--purple)' }} />
                Калькулятор для #{showCalcModal.lead_number}
              </h3>
              <button className="btn-icon" onClick={() => { setShowCalcModal(null); setSelectedServices([]); }}><X size={16} /></button>
            </div>
            
            <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.85rem' }}><strong>Клиент:</strong> {showCalcModal.name || '—'}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{showCalcModal.contact || '—'}</div>
            </div>
            
            {/* Tabs */}
            {calcTabs.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {calcTabs.map(tab => (
                  <button key={tab.id} className={`btn btn-sm ${selectedTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setSelectedTab(tab.id)}>{tab.name_ru}</button>
                ))}
              </div>
            )}
            
            {/* Services list */}
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              {filteredServices.map(service => {
                const isSelected = selectedServices.some(s => s.id === service.id);
                const selectedItem = selectedServices.find(s => s.id === service.id);
                return (
                  <div key={service.id} 
                    style={{ 
                      padding: '12px 16px', 
                      background: isSelected ? 'rgba(139,92,246,0.1)' : 'var(--bg-card)', 
                      border: `1px solid ${isSelected ? 'var(--purple)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}
                    onClick={() => toggleService(service)}
                  >
                    <div style={{ 
                      width: 24, height: 24, borderRadius: 4, 
                      border: `2px solid ${isSelected ? 'var(--purple)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--purple)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {isSelected && <Check size={14} color="white" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{service.name_ru}</div>
                      {service.name_am && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{service.name_am}</div>}
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--purple)' }}>{formatAmount(service.price)}</div>
                    {isSelected && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                        <button className="btn-icon" style={{ padding: '4px 8px' }} onClick={() => updateServiceQty(service.id, selectedItem.qty - 1)}>−</button>
                        <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{selectedItem.qty}</span>
                        <button className="btn-icon" style={{ padding: '4px 8px' }} onClick={() => updateServiceQty(service.id, selectedItem.qty + 1)}>+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Selected services summary */}
            {selectedServices.length > 0 && (
              <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', border: '1px solid var(--purple)', marginBottom: 16 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>Выбранные услуги:</div>
                {selectedServices.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <span>{s.name_ru} × {s.qty}</span>
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>{formatAmount(s.qty * s.price)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '2px solid var(--purple)' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Итого:</span>
                  <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--success)' }}>{formatAmount(calcModalTotal)}</span>
                </div>
              </div>
            )}
            
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => { setShowCalcModal(null); setSelectedServices([]); }}>Отмена</button>
              <button className="btn btn-primary" onClick={generateAndSavePDF} disabled={selectedServices.length === 0 || generating} data-testid="generate-pdf-btn">
                {generating ? <RefreshCw size={16} className="spin" /> : <FileText size={16} />}
                {generating ? 'Генерация...' : 'Сохранить и создать PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {editLead && (
        <div className="modal-overlay" onClick={() => setEditLead(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }} data-testid="lead-edit-modal">
            <h3 className="modal-title">Редактировать лид #{editLead.lead_number || ''}</h3>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Имя</label><input className="form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} data-testid="edit-lead-name" /></div>
              <div className="form-group"><label className="form-label">Контакт</label><input className="form-input" value={editForm.contact} onChange={e => setEditForm({ ...editForm, contact: e.target.value })} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Продукт</label><input className="form-input" value={editForm.product} onChange={e => setEditForm({ ...editForm, product: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Услуга</label><input className="form-input" value={editForm.service} onChange={e => setEditForm({ ...editForm, service: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">Сообщение</label><textarea className="form-input" value={editForm.message} onChange={e => setEditForm({ ...editForm, message: e.target.value })} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Статус</label><select className="form-input" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} data-testid="edit-lead-status">
                {STATUSES.filter(s => s.value !== 'all').map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select></div>
              <div className="form-group"><label className="form-label">Ответственный</label><select className="form-input" value={editForm.assigned_to} onChange={e => setEditForm({ ...editForm, assigned_to: e.target.value })}>
                <option value="">Не назначен</option>{users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
              </select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Стоимость (֏)</label><input className="form-input" type="number" value={editForm.total_amount} onChange={e => setEditForm({ ...editForm, total_amount: Number(e.target.value) })} /></div>
              <div className="form-group"><label className="form-label">Реф. код</label><input className="form-input" value={editForm.referral_code} onChange={e => setEditForm({ ...editForm, referral_code: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">Заметки</label><textarea className="form-input" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} data-testid="edit-lead-notes" /></div>
            <div className="form-group"><label className="form-label">Доп. данные (JSON)</label><textarea className="form-input" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} value={editForm.custom_fields} onChange={e => setEditForm({ ...editForm, custom_fields: e.target.value })} placeholder='{"wb_link":"https://...","артикул":"12345"}' /></div>
            <div className="modal-actions"><button className="btn btn-outline" onClick={() => setEditLead(null)}>Отмена</button><button className="btn btn-primary" onClick={saveEdit} data-testid="lead-save-btn"><Save size={16} /> Сохранить</button></div>
          </div>
        </div>
      )}

      {/* Create Lead Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }} data-testid="create-lead-modal">
            <h3 className="modal-title">Новый лид</h3>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Имя клиента *</label><input className="form-input" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} data-testid="create-lead-name" /></div>
              <div className="form-group"><label className="form-label">Контакт *</label><input className="form-input" value={createForm.contact} onChange={e => setCreateForm({ ...createForm, contact: e.target.value })} placeholder="+374... или @telegram" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Источник</label><select className="form-input" value={createForm.source} onChange={e => setCreateForm({ ...createForm, source: e.target.value })}>
                {SOURCES.filter(s => s.value !== 'all').map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select></div>
              <div className="form-group"><label className="form-label">Продукт</label><input className="form-input" value={createForm.product} onChange={e => setCreateForm({ ...createForm, product: e.target.value })} /></div>
            </div>
            <div className="form-group"><label className="form-label">Сообщение</label><textarea className="form-input" value={createForm.message} onChange={e => setCreateForm({ ...createForm, message: e.target.value })} /></div>

            {/* Inline calculator */}
            <div style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--accent)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Calculator size={16} /> Расчёт стоимости</div>
              {calcItems.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 40px', gap: 6, marginBottom: 6 }}>
                  <input className="form-input" placeholder="Услуга" value={item.name} onChange={e => { const c = [...calcItems]; c[idx] = { ...c[idx], name: e.target.value }; setCalcItems(c); }} style={{ fontSize: '0.82rem' }} />
                  <input className="form-input" type="number" placeholder="Кол" value={item.qty} onChange={e => { const c = [...calcItems]; c[idx] = { ...c[idx], qty: Number(e.target.value) }; setCalcItems(c); }} style={{ fontSize: '0.82rem' }} />
                  <input className="form-input" type="number" placeholder="Цена" value={item.price} onChange={e => { const c = [...calcItems]; c[idx] = { ...c[idx], price: Number(e.target.value) }; setCalcItems(c); }} style={{ fontSize: '0.82rem' }} />
                  <button className="btn-icon" onClick={() => setCalcItems(calcItems.filter((_, ii) => ii !== idx))} style={{ color: 'var(--danger)' }}><Trash2 size={12} /></button>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <button className="btn btn-sm btn-outline" onClick={() => setCalcItems([...calcItems, { name: '', qty: 1, price: 0 }])}><Plus size={14} /> Строка</button>
                <div style={{ fontWeight: 800, color: 'var(--success)', fontSize: '1.1rem' }}>Итого: {formatAmount(calcTotal)}</div>
              </div>
            </div>

            <div className="modal-actions"><button className="btn btn-outline" onClick={() => setShowCreate(false)}>Отмена</button><button className="btn btn-primary" onClick={createLead} data-testid="create-lead-submit"><Plus size={16} /> Создать лид</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
