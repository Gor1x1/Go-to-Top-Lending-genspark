import React, { useState, useEffect } from 'react';
import { apiFetch } from '../App';
import { Gift, Plus, Trash2, Edit3, Check } from 'lucide-react';

export default function Referrals() {
  const [refs, setRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({code:'',description:'',discount_percent:0,free_reviews:0});
  const [editRef, setEditRef] = useState(null);

  useEffect(() => { load(); }, []);
  const load = async () => { const r = await apiFetch('/api/referrals'); if (r?.ok) setRefs(await r.json()); setLoading(false); };

  const add = async () => {
    if (!form.code) return;
    await apiFetch('/api/referrals', {method:'POST', body:JSON.stringify(form)});
    setShowAdd(false); setForm({code:'',description:'',discount_percent:0,free_reviews:0}); load();
  };

  const save = async () => {
    if (!editRef) return;
    await apiFetch(`/api/referrals/${editRef.id}`, {method:'PUT', body:JSON.stringify(editRef)});
    setEditRef(null); load();
  };

  const del = async (id) => { if(!window.confirm('Удалить код?'))return; await apiFetch(`/api/referrals/${id}`,{method:'DELETE'}); load(); };
  const toggle = async (ref) => { await apiFetch(`/api/referrals/${ref.id}`,{method:'PUT',body:JSON.stringify({is_active:!ref.is_active})}); load(); };

  if (loading) return <div className="page"><div className="loading-spinner" style={{margin:'60px auto'}} /></div>;

  return (
    <div className="page" data-testid="referrals-page">
      <div className="page-header"><h1 className="page-title">Реферальные коды</h1><p className="page-desc">Промокоды для скидок и бесплатных отзывов</p></div>
      <div className="actions-bar"><button className="btn btn-primary" onClick={()=>setShowAdd(true)} data-testid="add-ref-btn"><Plus size={16}/> Новый код</button></div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Код</th><th>Описание</th><th>Скидка %</th><th>Бесп. отзывы</th><th>Статус</th><th>Действия</th></tr></thead>
          <tbody>
            {refs.map(ref => (
              <tr key={ref.id}>
                <td style={{fontWeight:700,fontFamily:'monospace',color:'var(--accent)'}}>{ref.code}</td>
                <td>{ref.description||'—'}</td>
                <td>{ref.discount_percent||0}%</td>
                <td>{ref.free_reviews||0}</td>
                <td><span className={`badge ${ref.is_active?'badge-green':'badge-red'}`} style={{cursor:'pointer'}} onClick={()=>toggle(ref)}>{ref.is_active?'Активен':'Неактивен'}</span></td>
                <td><div style={{display:'flex',gap:4}}><button className="btn-icon" onClick={()=>setEditRef({...ref})}><Edit3 size={14}/></button><button className="btn-icon" style={{color:'var(--danger)'}} onClick={()=>del(ref.id)}><Trash2 size={14}/></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && <div className="modal-overlay" onClick={()=>setShowAdd(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}>
        <h3 className="modal-title">Новый реферальный код</h3>
        <div className="form-group"><label className="form-label">Код *</label><input className="form-input" value={form.code} onChange={e=>setForm({...form,code:e.target.value})} placeholder="PROMO2026" style={{textTransform:'uppercase'}}/></div>
        <div className="form-group"><label className="form-label">Описание</label><input className="form-input" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Скидка %</label><input className="form-input" type="number" value={form.discount_percent} onChange={e=>setForm({...form,discount_percent:Number(e.target.value)})}/></div>
          <div className="form-group"><label className="form-label">Бесплатных отзывов</label><input className="form-input" type="number" value={form.free_reviews} onChange={e=>setForm({...form,free_reviews:Number(e.target.value)})}/></div>
        </div>
        <div className="modal-actions"><button className="btn btn-outline" onClick={()=>setShowAdd(false)}>Отмена</button><button className="btn btn-primary" onClick={add}><Check size={16}/> Создать</button></div>
      </div></div>}

      {editRef && <div className="modal-overlay" onClick={()=>setEditRef(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}>
        <h3 className="modal-title">Редактировать код</h3>
        <div className="form-group"><label className="form-label">Код</label><input className="form-input" value={editRef.code} onChange={e=>setEditRef({...editRef,code:e.target.value})}/></div>
        <div className="form-group"><label className="form-label">Описание</label><input className="form-input" value={editRef.description||''} onChange={e=>setEditRef({...editRef,description:e.target.value})}/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Скидка %</label><input className="form-input" type="number" value={editRef.discount_percent||0} onChange={e=>setEditRef({...editRef,discount_percent:Number(e.target.value)})}/></div>
          <div className="form-group"><label className="form-label">Бесп. отзывов</label><input className="form-input" type="number" value={editRef.free_reviews||0} onChange={e=>setEditRef({...editRef,free_reviews:Number(e.target.value)})}/></div>
        </div>
        <div className="modal-actions"><button className="btn btn-outline" onClick={()=>setEditRef(null)}>Отмена</button><button className="btn btn-primary" onClick={save}><Check size={16}/> Сохранить</button></div>
      </div></div>}
    </div>
  );
}
