import React, { useState, useEffect } from 'react';
import { apiFetch } from '../App';
import { Calculator, Plus, Trash2, Edit3, Save, Check, X } from 'lucide-react';

export default function CalculatorPage() {
  const [tabs, setTabs] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editSvc, setEditSvc] = useState(null);
  const [showAddTab, setShowAddTab] = useState(false);
  const [newTab, setNewTab] = useState({tab_key:'',name_ru:'',name_am:''});
  const [showAddSvc, setShowAddSvc] = useState(false);
  const [newSvc, setNewSvc] = useState({tab_id:'',name_ru:'',name_am:'',price:0,price_type:'fixed',price_tiers_json:'',tier_desc_ru:'',tier_desc_am:''});

  useEffect(() => { load(); }, []);
  const load = async () => {
    const [t, s] = await Promise.all([apiFetch('/api/calc-tabs'), apiFetch('/api/calc-services')]);
    if (t?.ok) setTabs(await t.json());
    if (s?.ok) setServices(await s.json());
    setLoading(false);
  };

  const addTab = async () => {
    if (!newTab.tab_key || !newTab.name_ru) return;
    await apiFetch('/api/calc-tabs', {method:'POST', body:JSON.stringify(newTab)});
    setShowAddTab(false); setNewTab({tab_key:'',name_ru:'',name_am:''}); load();
  };

  const deleteTab = async (id) => {
    if (!window.confirm('Удалить вкладку и все её услуги?')) return;
    await apiFetch(`/api/calc-tabs/${id}`, {method:'DELETE'}); load();
  };

  const addService = async () => {
    if (!newSvc.tab_id || !newSvc.name_ru) return;
    await apiFetch('/api/calc-services', {method:'POST', body:JSON.stringify(newSvc)});
    setShowAddSvc(false); setNewSvc({tab_id:'',name_ru:'',name_am:'',price:0,price_type:'fixed',price_tiers_json:'',tier_desc_ru:'',tier_desc_am:''}); load();
  };

  const saveSvc = async () => {
    if (!editSvc) return;
    await apiFetch(`/api/calc-services/${editSvc.id}`, {method:'PUT', body:JSON.stringify(editSvc)});
    setEditSvc(null); load();
  };

  const deleteSvc = async (id) => {
    if (!window.confirm('Удалить услугу?')) return;
    await apiFetch(`/api/calc-services/${id}`, {method:'DELETE'}); load();
  };

  if (loading) return <div className="page"><div className="loading-spinner" style={{margin:'60px auto'}} /></div>;

  return (
    <div className="page" data-testid="calculator-page">
      <div className="page-header">
        <h1 className="page-title">Калькулятор</h1>
        <p className="page-desc">Управление вкладками и услугами калькулятора</p>
      </div>

      <div style={{display:'flex',gap:10,marginBottom:20}}>
        <button className="btn btn-primary" onClick={()=>setShowAddTab(true)} data-testid="add-tab-btn"><Plus size={16}/> Новая вкладка</button>
        <button className="btn btn-outline" onClick={()=>setShowAddSvc(true)} data-testid="add-service-btn"><Plus size={16}/> Новая услуга</button>
      </div>

      {/* Tabs list */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>
        {tabs.map(tab => (
          <div key={tab.id} style={{padding:'10px 16px',background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontWeight:700}}>{tab.name_ru}</span>
            <span style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{tab.tab_key}</span>
            <button className="btn-icon" onClick={()=>deleteTab(tab.id)} style={{color:'var(--danger)'}}><Trash2 size={12}/></button>
          </div>
        ))}
      </div>

      {/* Services table */}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Услуга</th><th>Вкладка</th><th>Цена</th><th>Тип</th><th>Действия</th></tr></thead>
          <tbody>
            {services.map(svc => (
              <tr key={svc.id}>
                <td><div style={{fontWeight:600,color:'var(--text)'}}>{svc.name_ru}</div><div style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>{svc.name_am}</div></td>
                <td><span className="badge badge-purple">{svc.tab_name_ru || svc.tab_id}</span></td>
                <td style={{fontWeight:600}}>{svc.price || '—'}</td>
                <td><span className="badge badge-blue">{svc.price_type}</span></td>
                <td>
                  <div style={{display:'flex',gap:4}}>
                    <button className="btn-icon" onClick={()=>setEditSvc({...svc})}><Edit3 size={14}/></button>
                    <button className="btn-icon" onClick={()=>deleteSvc(svc.id)} style={{color:'var(--danger)'}}><Trash2 size={14}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Tab Modal */}
      {showAddTab && (
        <div className="modal-overlay" onClick={()=>setShowAddTab(false)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <h3 className="modal-title">Новая вкладка</h3>
            <div className="form-group"><label className="form-label">Ключ (англ)</label><input className="form-input" value={newTab.tab_key} onChange={e=>setNewTab({...newTab,tab_key:e.target.value})} placeholder="tab_key"/></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Название (RU)</label><input className="form-input" value={newTab.name_ru} onChange={e=>setNewTab({...newTab,name_ru:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">Название (AM)</label><input className="form-input" value={newTab.name_am} onChange={e=>setNewTab({...newTab,name_am:e.target.value})}/></div>
            </div>
            <div className="modal-actions"><button className="btn btn-outline" onClick={()=>setShowAddTab(false)}>Отмена</button><button className="btn btn-primary" onClick={addTab}><Check size={16}/> Создать</button></div>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {showAddSvc && (
        <div className="modal-overlay" onClick={()=>setShowAddSvc(false)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <h3 className="modal-title">Новая услуга</h3>
            <div className="form-group"><label className="form-label">Вкладка</label><select className="form-input" value={newSvc.tab_id} onChange={e=>setNewSvc({...newSvc,tab_id:e.target.value})}><option value="">Выберите</option>{tabs.map(t=><option key={t.id} value={t.id}>{t.name_ru}</option>)}</select></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Название (RU)</label><input className="form-input" value={newSvc.name_ru} onChange={e=>setNewSvc({...newSvc,name_ru:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">Название (AM)</label><input className="form-input" value={newSvc.name_am} onChange={e=>setNewSvc({...newSvc,name_am:e.target.value})}/></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Цена</label><input className="form-input" type="number" value={newSvc.price} onChange={e=>setNewSvc({...newSvc,price:Number(e.target.value)})}/></div>
              <div className="form-group"><label className="form-label">Тип цены</label><select className="form-input" value={newSvc.price_type} onChange={e=>setNewSvc({...newSvc,price_type:e.target.value})}><option value="fixed">Фикс</option><option value="tiered">Уровневая</option></select></div>
            </div>
            {newSvc.price_type === 'tiered' && <div className="form-group"><label className="form-label">Уровни (JSON)</label><textarea className="form-input" value={newSvc.price_tiers_json} onChange={e=>setNewSvc({...newSvc,price_tiers_json:e.target.value})} placeholder='[{"from":1,"to":50,"price":500}]'/></div>}
            <div className="modal-actions"><button className="btn btn-outline" onClick={()=>setShowAddSvc(false)}>Отмена</button><button className="btn btn-primary" onClick={addService}><Check size={16}/> Создать</button></div>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editSvc && (
        <div className="modal-overlay" onClick={()=>setEditSvc(null)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <h3 className="modal-title">Редактировать услугу</h3>
            <div className="form-group"><label className="form-label">Вкладка</label><select className="form-input" value={editSvc.tab_id} onChange={e=>setEditSvc({...editSvc,tab_id:e.target.value})}>{tabs.map(t=><option key={t.id} value={t.id}>{t.name_ru}</option>)}</select></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Название (RU)</label><input className="form-input" value={editSvc.name_ru} onChange={e=>setEditSvc({...editSvc,name_ru:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">Название (AM)</label><input className="form-input" value={editSvc.name_am||''} onChange={e=>setEditSvc({...editSvc,name_am:e.target.value})}/></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Цена</label><input className="form-input" type="number" value={editSvc.price||0} onChange={e=>setEditSvc({...editSvc,price:Number(e.target.value)})}/></div>
              <div className="form-group"><label className="form-label">Тип</label><select className="form-input" value={editSvc.price_type||'fixed'} onChange={e=>setEditSvc({...editSvc,price_type:e.target.value})}><option value="fixed">Фикс</option><option value="tiered">Уровневая</option></select></div>
            </div>
            <div className="modal-actions"><button className="btn btn-outline" onClick={()=>setEditSvc(null)}>Отмена</button><button className="btn btn-primary" onClick={saveSvc}><Save size={16}/> Сохранить</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
