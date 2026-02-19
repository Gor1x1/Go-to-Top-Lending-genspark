import React, { useState, useEffect } from 'react';
import { apiFetch } from '../App';
import { Blocks, Plus, Save, Eye, EyeOff, ChevronUp, ChevronDown, Trash2, Copy, Edit3 } from 'lucide-react';

export default function BlockConstructor() {
  const [sections, setSections] = useState([]);
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [secRes, conRes] = await Promise.all([apiFetch('/api/section-order'), apiFetch('/api/content')]);
    if (secRes?.ok) setSections(await secRes.json());
    if (conRes?.ok) setContent(await conRes.json());
    setLoading(false);
  };

  const getContent = (sectionId) => content.find(c => c.section_key === sectionId);

  const toggleExpand = (id) => setExpanded(prev => ({...prev, [id]: !prev[id]}));

  const toggleVisible = async (idx) => {
    const sec = [...sections];
    sec[idx] = {...sec[idx], is_visible: !sec[idx].is_visible};
    setSections(sec);
  };

  const moveSection = (idx, dir) => {
    const sec = [...sections];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sec.length) return;
    [sec[idx], sec[newIdx]] = [sec[newIdx], sec[idx]];
    sec.forEach((s, i) => s.sort_order = i);
    setSections(sec);
  };

  const saveOrder = async () => {
    const payload = sections.map((s, i) => ({section_id: s.section_id, sort_order: i, is_visible: s.is_visible, label_ru: s.label_ru || '', label_am: s.label_am || ''}));
    await apiFetch('/api/section-order', {method: 'POST', body: JSON.stringify({sections: payload})});
    alert('Порядок блоков сохранён!');
  };

  const saveTexts = async (sectionKey) => {
    const c = content.find(x => x.section_key === sectionKey);
    if (!c) return;
    await apiFetch(`/api/content/${sectionKey}`, {method: 'PUT', body: JSON.stringify({content_json: c.content_json, section_name: c.section_name})});
    alert('Тексты сохранены!');
  };

  const updateTextItem = (sectionKey, idx, lang, value) => {
    setContent(prev => prev.map(c => {
      if (c.section_key !== sectionKey) return c;
      const items = [...(c.content_json || [])];
      items[idx] = {...items[idx], [lang]: value};
      return {...c, content_json: items};
    }));
  };

  const addTextItem = (sectionKey) => {
    setContent(prev => prev.map(c => {
      if (c.section_key !== sectionKey) return c;
      return {...c, content_json: [...(c.content_json || []), {ru: '', am: ''}]};
    }));
  };

  const removeTextItem = (sectionKey, idx) => {
    setContent(prev => prev.map(c => {
      if (c.section_key !== sectionKey) return c;
      const items = [...(c.content_json || [])];
      items.splice(idx, 1);
      return {...c, content_json: items};
    }));
  };

  const deleteBlock = async (idx) => {
    const sec = sections[idx];
    if (!window.confirm(`Удалить блок "${sec.label_ru || sec.section_id}"?`)) return;
    await apiFetch(`/api/content/${sec.section_id}`, {method: 'DELETE'});
    setSections(prev => prev.filter((_, i) => i !== idx));
    setContent(prev => prev.filter(c => c.section_key !== sec.section_id));
  };

  if (loading) return <div className="page"><div className="loading-spinner" style={{margin:'60px auto'}} /></div>;

  return (
    <div className="page" data-testid="blocks-page">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h1 className="page-title">Конструктор блоков</h1>
          <p className="page-desc">Порядок, тексты, фото и видимость секций сайта</p>
        </div>
        <button className="btn btn-success" onClick={saveOrder} data-testid="save-order-btn"><Save size={16} /> Сохранить порядок</button>
      </div>

      {sections.length === 0 ? (
        <div className="card empty-state"><Blocks size={48} /><p style={{marginTop:12}}>Блоки ещё не настроены</p></div>
      ) : sections.map((sec, idx) => {
        const con = getContent(sec.section_id);
        const items = con?.content_json || [];
        const isExp = expanded[sec.section_id];

        return (
          <div key={sec.section_id || idx} className="card" style={{marginBottom:8,padding:0,overflow:'hidden',opacity:sec.is_visible?1:0.5,borderColor:sec.is_visible?'var(--border)':'rgba(239,68,68,0.3)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',cursor:'pointer',background:'var(--bg-card)'}} onClick={() => toggleExpand(sec.section_id)}>
              <div style={{display:'flex',flexDirection:'column',gap:2}} onClick={e=>e.stopPropagation()}>
                <button className="btn-icon" style={{padding:'2px 4px'}} onClick={()=>moveSection(idx,-1)} disabled={idx===0}><ChevronUp size={12}/></button>
                <button className="btn-icon" style={{padding:'2px 4px'}} onClick={()=>moveSection(idx,1)} disabled={idx===sections.length-1}><ChevronDown size={12}/></button>
              </div>
              <span style={{color:'var(--text-muted)',fontSize:'0.8rem',fontWeight:700,minWidth:28}}>#{idx+1}</span>
              <div style={{flex:1,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <span style={{fontWeight:700,color:sec.is_visible?'var(--text)':'#f87171'}}>{sec.label_ru || sec.section_id}</span>
                <span className="badge badge-purple" style={{fontSize:'0.7rem'}}>{sec.section_id}</span>
                {items.length > 0 && <span className="badge badge-green" style={{fontSize:'0.7rem'}}>{items.length} текст</span>}
              </div>
              <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                <button className={`btn btn-sm ${sec.is_visible?'btn-success':'btn-danger'}`} style={{padding:'4px 8px'}} onClick={()=>toggleVisible(idx)}>
                  {sec.is_visible ? <Eye size={14}/> : <EyeOff size={14}/>}
                </button>
                <button className="btn btn-sm btn-danger" style={{padding:'4px 8px'}} onClick={()=>deleteBlock(idx)}><Trash2 size={14}/></button>
              </div>
              {isExp ? <ChevronUp size={16} style={{color:'var(--text-muted)'}}/> : <ChevronDown size={16} style={{color:'var(--text-muted)'}}/>}
            </div>

            {isExp && (
              <div style={{padding:'16px',borderTop:'1px solid var(--border)',background:'var(--bg-surface)'}}>
                <div className="form-row" style={{marginBottom:12}}>
                  <div className="form-group">
                    <label className="form-label" style={{color:'var(--purple)'}}>Название (RU)</label>
                    <input className="form-input" value={sec.label_ru||''} onChange={e => {const s=[...sections]; s[idx]={...s[idx],label_ru:e.target.value}; setSections(s);}} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{color:'var(--warning)'}}>Название (AM)</label>
                    <input className="form-input" value={sec.label_am||''} onChange={e => {const s=[...sections]; s[idx]={...s[idx],label_am:e.target.value}; setSections(s);}} />
                  </div>
                </div>

                {items.length > 0 && (
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:'0.8rem',fontWeight:700,color:'var(--accent)',marginBottom:8}}>Тексты блока ({items.length})</div>
                    {items.map((item, ti) => (
                      <div key={ti} style={{display:'grid',gridTemplateColumns:'28px 1fr 1fr 28px',gap:8,marginBottom:6,padding:'8px',background:'var(--bg-card)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}>
                        <span style={{color:'var(--text-muted)',fontSize:'0.75rem',paddingTop:8,textAlign:'center'}}>{ti+1}</span>
                        <div>
                          <label style={{fontSize:'0.65rem',color:'var(--purple)',fontWeight:600}}>RU</label>
                          <textarea className="form-input" style={{minHeight:36,fontSize:'0.85rem'}} value={item.ru||''} onChange={e=>updateTextItem(sec.section_id,ti,'ru',e.target.value)} />
                        </div>
                        <div>
                          <label style={{fontSize:'0.65rem',color:'var(--warning)',fontWeight:600}}>AM</label>
                          <textarea className="form-input" style={{minHeight:36,fontSize:'0.85rem'}} value={item.am||''} onChange={e=>updateTextItem(sec.section_id,ti,'am',e.target.value)} />
                        </div>
                        <button className="btn-icon" style={{marginTop:14,color:'var(--danger)'}} onClick={()=>removeTextItem(sec.section_id,ti)}><Trash2 size={12}/></button>
                      </div>
                    ))}
                    <div style={{display:'flex',gap:8,marginTop:6}}>
                      <button className="btn btn-sm btn-outline" onClick={()=>addTextItem(sec.section_id)}><Plus size={14}/> Добавить текст</button>
                      <button className="btn btn-sm btn-success" onClick={()=>saveTexts(sec.section_id)}><Save size={14}/> Сохранить тексты</button>
                    </div>
                  </div>
                )}
                {!con && <button className="btn btn-sm btn-primary" onClick={async()=>{await apiFetch('/api/content',{method:'POST',body:JSON.stringify({section_key:sec.section_id,section_name:sec.label_ru,content_json:[{ru:'',am:''}]})}); load();}}><Plus size={14}/> Создать тексты</button>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
