import React, { useState, useEffect } from 'react';
import { apiFetch } from '../App';
import { Bot, Plus, Trash2, Edit3, Check, Save, Zap } from 'lucide-react';

export default function TgBot() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({bot_token:'',chat_id:'',chat_name:'',notify_leads:true,notify_calc:false});
  const [editBot, setEditBot] = useState(null);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => { load(); }, []);
  const load = async () => { const r = await apiFetch('/api/telegram-bot'); if (r?.ok) setBots(await r.json()); setLoading(false); };
  const add = async () => { await apiFetch('/api/telegram-bot',{method:'POST',body:JSON.stringify(form)}); setShowAdd(false); setForm({bot_token:'',chat_id:'',chat_name:'',notify_leads:true,notify_calc:false}); load(); };
  const save = async () => { if(!editBot)return; await apiFetch(`/api/telegram-bot/${editBot.id}`,{method:'PUT',body:JSON.stringify(editBot)}); setEditBot(null); load(); };
  const del = async (id) => { if(!window.confirm('Удалить?'))return; await apiFetch(`/api/telegram-bot/${id}`,{method:'DELETE'}); load(); };
  const testBot = async (bot) => {
    setTestResult(null);
    const r = await apiFetch('/api/telegram-bot/test', {method:'POST', body:JSON.stringify({bot_token:bot.bot_token, chat_id:bot.chat_id, message:'Test from Go to Top admin panel'})});
    if (r?.ok) { const d = await r.json(); setTestResult(d.success ? 'Отправлено!' : `Ошибка: ${d.error}`); }
    else setTestResult('Ошибка сети');
  };

  if (loading) return <div className="page"><div className="loading-spinner" style={{margin:'60px auto'}} /></div>;

  return (
    <div className="page" data-testid="tgbot-page">
      <div className="page-header"><h1 className="page-title">TG Бот / Уведомления</h1><p className="page-desc">Настройка автоматических уведомлений в Telegram</p></div>
      <div className="actions-bar">
        <button className="btn btn-primary" onClick={()=>setShowAdd(true)} data-testid="add-bot-btn"><Plus size={16}/> Добавить бота</button>
        {testResult && <span style={{fontSize:'0.85rem',color:testResult.includes('Ошибка')?'var(--danger)':'var(--success)',fontWeight:600}}>{testResult}</span>}
      </div>

      <div style={{display:'grid',gap:12}}>
        {bots.map(bot => (
          <div key={bot.id} className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <h3 style={{fontWeight:700}}>{bot.chat_name || 'Бот'}</h3>
                <span className={`badge ${bot.is_active?'badge-green':'badge-red'}`}>{bot.is_active?'Активен':'Неактивен'}</span>
              </div>
              <div style={{display:'flex',gap:4}}>
                <button className="btn btn-sm btn-outline" onClick={()=>testBot(bot)}><Zap size={14}/> Тест</button>
                <button className="btn-icon" onClick={()=>setEditBot({...bot})}><Edit3 size={14}/></button>
                <button className="btn-icon" style={{color:'var(--danger)'}} onClick={()=>del(bot.id)}><Trash2 size={14}/></button>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:'0.82rem'}}>
              <div><span style={{color:'var(--text-muted)'}}>Bot Token:</span> <span style={{fontFamily:'monospace',fontSize:'0.78rem'}}>{bot.bot_token ? '***' + bot.bot_token.slice(-8) : '—'}</span></div>
              <div><span style={{color:'var(--text-muted)'}}>Chat ID:</span> <span style={{fontFamily:'monospace'}}>{bot.chat_id || '—'}</span></div>
              <div><span style={{color:'var(--text-muted)'}}>Уведомления о лидах:</span> <span className={`badge ${bot.notify_leads?'badge-green':'badge-gray'}`}>{bot.notify_leads?'Да':'Нет'}</span></div>
              <div><span style={{color:'var(--text-muted)'}}>Уведомления о калькуляторе:</span> <span className={`badge ${bot.notify_calc?'badge-green':'badge-gray'}`}>{bot.notify_calc?'Да':'Нет'}</span></div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && <div className="modal-overlay" onClick={()=>setShowAdd(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}>
        <h3 className="modal-title">Новый бот</h3>
        <div className="form-group"><label className="form-label">Bot Token *</label><input className="form-input" value={form.bot_token} onChange={e=>setForm({...form,bot_token:e.target.value})} placeholder="123456:ABC-DEF..."/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Chat ID *</label><input className="form-input" value={form.chat_id} onChange={e=>setForm({...form,chat_id:e.target.value})} placeholder="-100..."/></div>
          <div className="form-group"><label className="form-label">Название чата</label><input className="form-input" value={form.chat_name} onChange={e=>setForm({...form,chat_name:e.target.value})}/></div>
        </div>
        <div style={{display:'flex',gap:16,marginTop:8,marginBottom:16}}>
          <label style={{display:'flex',gap:6,alignItems:'center',fontSize:'0.85rem',cursor:'pointer'}}><input type="checkbox" checked={form.notify_leads} onChange={e=>setForm({...form,notify_leads:e.target.checked})} style={{accentColor:'var(--purple)'}}/> Уведомления о лидах</label>
          <label style={{display:'flex',gap:6,alignItems:'center',fontSize:'0.85rem',cursor:'pointer'}}><input type="checkbox" checked={form.notify_calc} onChange={e=>setForm({...form,notify_calc:e.target.checked})} style={{accentColor:'var(--purple)'}}/> Уведомления о калькуляторе</label>
        </div>
        <div className="modal-actions"><button className="btn btn-outline" onClick={()=>setShowAdd(false)}>Отмена</button><button className="btn btn-primary" onClick={add}><Check size={16}/> Добавить</button></div>
      </div></div>}

      {editBot && <div className="modal-overlay" onClick={()=>setEditBot(null)}><div className="modal-card" onClick={e=>e.stopPropagation()}>
        <h3 className="modal-title">Редактировать бота</h3>
        <div className="form-group"><label className="form-label">Bot Token</label><input className="form-input" value={editBot.bot_token||''} onChange={e=>setEditBot({...editBot,bot_token:e.target.value})}/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Chat ID</label><input className="form-input" value={editBot.chat_id||''} onChange={e=>setEditBot({...editBot,chat_id:e.target.value})}/></div>
          <div className="form-group"><label className="form-label">Название</label><input className="form-input" value={editBot.chat_name||''} onChange={e=>setEditBot({...editBot,chat_name:e.target.value})}/></div>
        </div>
        <div style={{display:'flex',gap:16,marginTop:8,marginBottom:16}}>
          <label style={{display:'flex',gap:6,alignItems:'center',fontSize:'0.85rem',cursor:'pointer'}}><input type="checkbox" checked={editBot.notify_leads} onChange={e=>setEditBot({...editBot,notify_leads:e.target.checked})} style={{accentColor:'var(--purple)'}}/> Лиды</label>
          <label style={{display:'flex',gap:6,alignItems:'center',fontSize:'0.85rem',cursor:'pointer'}}><input type="checkbox" checked={editBot.notify_calc} onChange={e=>setEditBot({...editBot,notify_calc:e.target.checked})} style={{accentColor:'var(--purple)'}}/> Калькулятор</label>
          <label style={{display:'flex',gap:6,alignItems:'center',fontSize:'0.85rem',cursor:'pointer'}}><input type="checkbox" checked={editBot.is_active} onChange={e=>setEditBot({...editBot,is_active:e.target.checked})} style={{accentColor:'var(--purple)'}}/> Активен</label>
        </div>
        <div className="modal-actions"><button className="btn btn-outline" onClick={()=>setEditBot(null)}>Отмена</button><button className="btn btn-primary" onClick={save}><Save size={16}/> Сохранить</button></div>
      </div></div>}
    </div>
  );
}
