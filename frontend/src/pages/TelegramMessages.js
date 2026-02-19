import React, { useState, useEffect } from 'react';
import { apiFetch } from '../App';
import { Send, Plus, Trash2, Edit3, Check, Save } from 'lucide-react';

export default function TelegramMessages() {
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({button_key:'',button_label_ru:'',button_label_am:'',telegram_url:'',message_template_ru:'',message_template_am:'',description:''});
  const [editMsg, setEditMsg] = useState(null);

  useEffect(() => { load(); }, []);
  const load = async () => { const r = await apiFetch('/api/telegram'); if (r?.ok) setMsgs(await r.json()); setLoading(false); };
  const add = async () => { await apiFetch('/api/telegram',{method:'POST',body:JSON.stringify(form)}); setShowAdd(false); setForm({button_key:'',button_label_ru:'',button_label_am:'',telegram_url:'',message_template_ru:'',message_template_am:'',description:''}); load(); };
  const save = async () => { if(!editMsg)return; await apiFetch(`/api/telegram/${editMsg.id}`,{method:'PUT',body:JSON.stringify(editMsg)}); setEditMsg(null); load(); };
  const del = async (id) => { if(!window.confirm('Удалить?'))return; await apiFetch(`/api/telegram/${id}`,{method:'DELETE'}); load(); };

  if (loading) return <div className="page"><div className="loading-spinner" style={{margin:'60px auto'}} /></div>;

  return (
    <div className="page" data-testid="telegram-page">
      <div className="page-header"><h1 className="page-title">TG сообщения</h1><p className="page-desc">Шаблоны сообщений для кнопок на сайте</p></div>
      <div className="actions-bar"><button className="btn btn-primary" onClick={()=>setShowAdd(true)} data-testid="add-tgmsg-btn"><Plus size={16}/> Новое сообщение</button></div>

      <div style={{display:'grid',gap:12}}>
        {msgs.map(msg => (
          <div key={msg.id} className="card" style={{display:'flex',gap:16,alignItems:'flex-start'}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
                <span style={{fontWeight:700}}>{msg.button_label_ru||msg.button_key}</span>
                <span className="badge badge-purple" style={{fontSize:'0.7rem'}}>{msg.button_key}</span>
                <span className={`badge ${msg.is_active?'badge-green':'badge-red'}`} style={{fontSize:'0.7rem'}}>{msg.is_active?'Активен':'Неактивен'}</span>
              </div>
              {msg.description && <div style={{fontSize:'0.82rem',color:'var(--text-muted)',marginBottom:4}}>{msg.description}</div>}
              <div style={{fontSize:'0.82rem',color:'var(--text-sec)'}}>URL: {msg.telegram_url||'—'}</div>
              {msg.message_template_ru && <div style={{fontSize:'0.82rem',color:'var(--text-sec)',marginTop:4,padding:'6px 10px',background:'var(--bg-surface)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}>{msg.message_template_ru}</div>}
            </div>
            <div style={{display:'flex',gap:4}}>
              <button className="btn-icon" onClick={()=>setEditMsg({...msg})}><Edit3 size={14}/></button>
              <button className="btn-icon" style={{color:'var(--danger)'}} onClick={()=>del(msg.id)}><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && <div className="modal-overlay" onClick={()=>setShowAdd(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}>
        <h3 className="modal-title">Новое TG сообщение</h3>
        <div className="form-group"><label className="form-label">Ключ кнопки</label><input className="form-input" value={form.button_key} onChange={e=>setForm({...form,button_key:e.target.value})} placeholder="btn_contact"/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Лейбл (RU)</label><input className="form-input" value={form.button_label_ru} onChange={e=>setForm({...form,button_label_ru:e.target.value})}/></div>
          <div className="form-group"><label className="form-label">Лейбл (AM)</label><input className="form-input" value={form.button_label_am} onChange={e=>setForm({...form,button_label_am:e.target.value})}/></div>
        </div>
        <div className="form-group"><label className="form-label">Telegram URL</label><input className="form-input" value={form.telegram_url} onChange={e=>setForm({...form,telegram_url:e.target.value})} placeholder="https://t.me/goo_to_top"/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Шаблон (RU)</label><textarea className="form-input" value={form.message_template_ru} onChange={e=>setForm({...form,message_template_ru:e.target.value})}/></div>
          <div className="form-group"><label className="form-label">Шаблон (AM)</label><textarea className="form-input" value={form.message_template_am} onChange={e=>setForm({...form,message_template_am:e.target.value})}/></div>
        </div>
        <div className="form-group"><label className="form-label">Описание</label><input className="form-input" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
        <div className="modal-actions"><button className="btn btn-outline" onClick={()=>setShowAdd(false)}>Отмена</button><button className="btn btn-primary" onClick={add}><Check size={16}/> Создать</button></div>
      </div></div>}

      {editMsg && <div className="modal-overlay" onClick={()=>setEditMsg(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}>
        <h3 className="modal-title">Редактировать сообщение</h3>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Лейбл (RU)</label><input className="form-input" value={editMsg.button_label_ru||''} onChange={e=>setEditMsg({...editMsg,button_label_ru:e.target.value})}/></div>
          <div className="form-group"><label className="form-label">Лейбл (AM)</label><input className="form-input" value={editMsg.button_label_am||''} onChange={e=>setEditMsg({...editMsg,button_label_am:e.target.value})}/></div>
        </div>
        <div className="form-group"><label className="form-label">Telegram URL</label><input className="form-input" value={editMsg.telegram_url||''} onChange={e=>setEditMsg({...editMsg,telegram_url:e.target.value})}/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Шаблон (RU)</label><textarea className="form-input" value={editMsg.message_template_ru||''} onChange={e=>setEditMsg({...editMsg,message_template_ru:e.target.value})}/></div>
          <div className="form-group"><label className="form-label">Шаблон (AM)</label><textarea className="form-input" value={editMsg.message_template_am||''} onChange={e=>setEditMsg({...editMsg,message_template_am:e.target.value})}/></div>
        </div>
        <div className="modal-actions"><button className="btn btn-outline" onClick={()=>setEditMsg(null)}>Отмена</button><button className="btn btn-primary" onClick={save}><Save size={16}/> Сохранить</button></div>
      </div></div>}
    </div>
  );
}
