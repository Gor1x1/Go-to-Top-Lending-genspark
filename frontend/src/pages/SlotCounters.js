import React, { useState, useEffect } from 'react';
import { apiFetch } from '../App';
import { Clock, Plus, Trash2, Edit3, Save, Check } from 'lucide-react';

export default function SlotCounters() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({counter_name:'',total_slots:10,booked_slots:0,label_ru:'',label_am:'',show_timer:true,reset_day:'monday',position:'after-hero'});
  const [editSlot, setEditSlot] = useState(null);

  useEffect(() => { load(); }, []);
  const load = async () => { const r = await apiFetch('/api/slot-counter'); if (r?.ok) { const d = await r.json(); setSlots(d.counters||[]); } setLoading(false); };

  const add = async () => { await apiFetch('/api/slot-counter',{method:'POST',body:JSON.stringify(form)}); setShowAdd(false); setForm({counter_name:'',total_slots:10,booked_slots:0,label_ru:'',label_am:'',show_timer:true,reset_day:'monday',position:'after-hero'}); load(); };
  const save = async () => { if(!editSlot)return; await apiFetch(`/api/slot-counter/${editSlot.id}`,{method:'PUT',body:JSON.stringify(editSlot)}); setEditSlot(null); load(); };
  const del = async (id) => { if(!window.confirm('Удалить?'))return; await apiFetch(`/api/slot-counter/${id}`,{method:'DELETE'}); load(); };

  if (loading) return <div className="page"><div className="loading-spinner" style={{margin:'60px auto'}} /></div>;

  return (
    <div className="page" data-testid="slots-page">
      <div className="page-header"><h1 className="page-title">Счётчики слотов</h1><p className="page-desc">Создание ощущения срочности на сайте</p></div>
      <div className="actions-bar"><button className="btn btn-primary" onClick={()=>setShowAdd(true)} data-testid="add-slot-btn"><Plus size={16}/> Новый счётчик</button></div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:16}}>
        {slots.map(slot => {
          const free = Math.max(0, (slot.total_slots||10)-(slot.booked_slots||0));
          return (
            <div key={slot.id} className="card">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <h3 style={{fontWeight:700}}>{slot.counter_name}</h3>
                <div style={{display:'flex',gap:4}}>
                  <button className="btn-icon" onClick={()=>setEditSlot({...slot})}><Edit3 size={14}/></button>
                  <button className="btn-icon" style={{color:'var(--danger)'}} onClick={()=>del(slot.id)}><Trash2 size={14}/></button>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:8}}>
                <div style={{fontSize:'2rem',fontWeight:800,color:'var(--success)'}}>{free}</div>
                <div style={{color:'var(--text-sec)',fontSize:'0.88rem'}}>из {slot.total_slots} свободно</div>
              </div>
              <div style={{height:8,background:'var(--bg-surface)',borderRadius:4,overflow:'hidden',marginBottom:8}}>
                <div style={{height:'100%',width:`${((slot.booked_slots||0)/(slot.total_slots||10))*100}%`,background:'var(--success)',borderRadius:4,transition:'width 0.3s'}} />
              </div>
              <div style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>
                Позиция: {slot.position} | Сброс: {slot.reset_day} | {slot.show_timer ? 'Таймер виден' : 'Таймер скрыт'}
              </div>
              {slot.label_ru && <div style={{fontSize:'0.82rem',color:'var(--text-sec)',marginTop:4}}>RU: {slot.label_ru}</div>}
            </div>
          );
        })}
      </div>

      {showAdd && <div className="modal-overlay" onClick={()=>setShowAdd(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}>
        <h3 className="modal-title">Новый счётчик</h3>
        <div className="form-group"><label className="form-label">Название</label><input className="form-input" value={form.counter_name} onChange={e=>setForm({...form,counter_name:e.target.value})}/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Всего слотов</label><input className="form-input" type="number" value={form.total_slots} onChange={e=>setForm({...form,total_slots:Number(e.target.value)})}/></div>
          <div className="form-group"><label className="form-label">Забронировано</label><input className="form-input" type="number" value={form.booked_slots} onChange={e=>setForm({...form,booked_slots:Number(e.target.value)})}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Лейбл (RU)</label><input className="form-input" value={form.label_ru} onChange={e=>setForm({...form,label_ru:e.target.value})}/></div>
          <div className="form-group"><label className="form-label">Лейбл (AM)</label><input className="form-input" value={form.label_am} onChange={e=>setForm({...form,label_am:e.target.value})}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Позиция</label><input className="form-input" value={form.position} onChange={e=>setForm({...form,position:e.target.value})}/></div>
          <div className="form-group"><label className="form-label">День сброса</label><select className="form-input" value={form.reset_day} onChange={e=>setForm({...form,reset_day:e.target.value})}><option value="monday">Понедельник</option><option value="tuesday">Вторник</option><option value="wednesday">Среда</option><option value="thursday">Четверг</option><option value="friday">Пятница</option><option value="saturday">Суббота</option><option value="sunday">Воскресенье</option></select></div>
        </div>
        <div className="modal-actions"><button className="btn btn-outline" onClick={()=>setShowAdd(false)}>Отмена</button><button className="btn btn-primary" onClick={add}><Check size={16}/> Создать</button></div>
      </div></div>}

      {editSlot && <div className="modal-overlay" onClick={()=>setEditSlot(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}>
        <h3 className="modal-title">Редактировать счётчик</h3>
        <div className="form-group"><label className="form-label">Название</label><input className="form-input" value={editSlot.counter_name} onChange={e=>setEditSlot({...editSlot,counter_name:e.target.value})}/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Всего слотов</label><input className="form-input" type="number" value={editSlot.total_slots} onChange={e=>setEditSlot({...editSlot,total_slots:Number(e.target.value)})}/></div>
          <div className="form-group"><label className="form-label">Забронировано</label><input className="form-input" type="number" value={editSlot.booked_slots} onChange={e=>setEditSlot({...editSlot,booked_slots:Number(e.target.value)})}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Лейбл (RU)</label><input className="form-input" value={editSlot.label_ru||''} onChange={e=>setEditSlot({...editSlot,label_ru:e.target.value})}/></div>
          <div className="form-group"><label className="form-label">Позиция</label><input className="form-input" value={editSlot.position||''} onChange={e=>setEditSlot({...editSlot,position:e.target.value})}/></div>
        </div>
        <div className="modal-actions"><button className="btn btn-outline" onClick={()=>setEditSlot(null)}>Отмена</button><button className="btn btn-primary" onClick={save}><Save size={16}/> Сохранить</button></div>
      </div></div>}
    </div>
  );
}
