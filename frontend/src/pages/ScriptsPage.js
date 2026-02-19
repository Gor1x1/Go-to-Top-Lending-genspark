import React, { useState, useEffect } from 'react';
import { apiFetch } from '../App';
import { Code2, Plus, Trash2, Edit3, Check, Save } from 'lucide-react';

export default function ScriptsPage() {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({name:'',description:'',script_type:'js',placement:'head',code:''});
  const [editScript, setEditScript] = useState(null);

  useEffect(() => { load(); }, []);
  const load = async () => { const r = await apiFetch('/api/scripts'); if (r?.ok) setScripts(await r.json()); setLoading(false); };
  const add = async () => { if(!form.name)return; await apiFetch('/api/scripts',{method:'POST',body:JSON.stringify(form)}); setShowAdd(false); setForm({name:'',description:'',script_type:'js',placement:'head',code:''}); load(); };
  const save = async () => { if(!editScript)return; await apiFetch(`/api/scripts/${editScript.id}`,{method:'PUT',body:JSON.stringify(editScript)}); setEditScript(null); load(); };
  const del = async (id) => { if(!window.confirm('Удалить?'))return; await apiFetch(`/api/scripts/${id}`,{method:'DELETE'}); load(); };
  const toggle = async (s) => { await apiFetch(`/api/scripts/${s.id}`,{method:'PUT',body:JSON.stringify({is_active:!s.is_active})}); load(); };

  if (loading) return <div className="page"><div className="loading-spinner" style={{margin:'60px auto'}} /></div>;

  return (
    <div className="page" data-testid="scripts-page">
      <div className="page-header"><h1 className="page-title">Скрипты</h1><p className="page-desc">Аналитика, пиксели, meta-теги</p></div>
      <div className="actions-bar"><button className="btn btn-primary" onClick={()=>setShowAdd(true)} data-testid="add-script-btn"><Plus size={16}/> Новый скрипт</button></div>

      <div style={{display:'grid',gap:12}}>
        {scripts.map(s => (
          <div key={s.id} className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontWeight:700}}>{s.name}</span>
                <span className="badge badge-purple">{s.script_type}</span>
                <span className="badge badge-blue">{s.placement}</span>
                <span className={`badge ${s.is_active?'badge-green':'badge-red'}`} style={{cursor:'pointer'}} onClick={()=>toggle(s)}>{s.is_active?'Активен':'Выключен'}</span>
              </div>
              <div style={{display:'flex',gap:4}}>
                <button className="btn-icon" onClick={()=>setEditScript({...s})}><Edit3 size={14}/></button>
                <button className="btn-icon" style={{color:'var(--danger)'}} onClick={()=>del(s.id)}><Trash2 size={14}/></button>
              </div>
            </div>
            {s.description && <div style={{fontSize:'0.82rem',color:'var(--text-muted)',marginBottom:6}}>{s.description}</div>}
            <pre style={{fontSize:'0.78rem',color:'var(--text-sec)',background:'var(--bg-surface)',padding:'10px',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',maxHeight:120,overflow:'auto',whiteSpace:'pre-wrap'}}>{s.code || '—'}</pre>
          </div>
        ))}
      </div>

      {showAdd && <div className="modal-overlay" onClick={()=>setShowAdd(false)}><div className="modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:600}}>
        <h3 className="modal-title">Новый скрипт</h3>
        <div className="form-group"><label className="form-label">Название *</label><input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Google Analytics"/></div>
        <div className="form-group"><label className="form-label">Описание</label><input className="form-input" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Тип</label><select className="form-input" value={form.script_type} onChange={e=>setForm({...form,script_type:e.target.value})}><option value="js">JavaScript</option><option value="css">CSS</option><option value="meta">Meta</option><option value="html">HTML</option></select></div>
          <div className="form-group"><label className="form-label">Размещение</label><select className="form-input" value={form.placement} onChange={e=>setForm({...form,placement:e.target.value})}><option value="head">Head</option><option value="body_start">Body start</option><option value="body_end">Body end</option></select></div>
        </div>
        <div className="form-group"><label className="form-label">Код</label><textarea className="form-input" style={{minHeight:120,fontFamily:'monospace',fontSize:'0.82rem'}} value={form.code} onChange={e=>setForm({...form,code:e.target.value})} placeholder="<script>..."/></div>
        <div className="modal-actions"><button className="btn btn-outline" onClick={()=>setShowAdd(false)}>Отмена</button><button className="btn btn-primary" onClick={add}><Check size={16}/> Создать</button></div>
      </div></div>}

      {editScript && <div className="modal-overlay" onClick={()=>setEditScript(null)}><div className="modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:600}}>
        <h3 className="modal-title">Редактировать скрипт</h3>
        <div className="form-group"><label className="form-label">Название</label><input className="form-input" value={editScript.name} onChange={e=>setEditScript({...editScript,name:e.target.value})}/></div>
        <div className="form-group"><label className="form-label">Описание</label><input className="form-input" value={editScript.description||''} onChange={e=>setEditScript({...editScript,description:e.target.value})}/></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Тип</label><select className="form-input" value={editScript.script_type} onChange={e=>setEditScript({...editScript,script_type:e.target.value})}><option value="js">JavaScript</option><option value="css">CSS</option><option value="meta">Meta</option><option value="html">HTML</option></select></div>
          <div className="form-group"><label className="form-label">Размещение</label><select className="form-input" value={editScript.placement} onChange={e=>setEditScript({...editScript,placement:e.target.value})}><option value="head">Head</option><option value="body_start">Body start</option><option value="body_end">Body end</option></select></div>
        </div>
        <div className="form-group"><label className="form-label">Код</label><textarea className="form-input" style={{minHeight:120,fontFamily:'monospace',fontSize:'0.82rem'}} value={editScript.code||''} onChange={e=>setEditScript({...editScript,code:e.target.value})}/></div>
        <div className="modal-actions"><button className="btn btn-outline" onClick={()=>setEditScript(null)}>Отмена</button><button className="btn btn-primary" onClick={save}><Save size={16}/> Сохранить</button></div>
      </div></div>}
    </div>
  );
}
