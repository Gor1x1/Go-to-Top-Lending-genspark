import React, { useState, useEffect } from 'react';
import { apiFetch } from '../App';
import { Footprints, Save } from 'lucide-react';

export default function FooterPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => { const r = await apiFetch('/api/footer'); if (r?.ok) setData(await r.json()); setLoading(false); };
  const save = async () => { setSaving(true); await apiFetch('/api/footer',{method:'PUT',body:JSON.stringify(data)}); setSaving(false); alert('Футер сохранён!'); };
  const set = (k, v) => setData(prev => ({...prev, [k]: v}));

  if (loading || !data) return <div className="page"><div className="loading-spinner" style={{margin:'60px auto'}} /></div>;

  return (
    <div className="page" data-testid="footer-page">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div><h1 className="page-title">Футер сайта</h1><p className="page-desc">Контакты, соцсети, копирайт</p></div>
        <button className="btn btn-primary" onClick={save} disabled={saving} data-testid="footer-save-btn"><Save size={16}/> {saving?'Сохранение...':'Сохранить'}</button>
      </div>

      <div className="card" style={{marginBottom:12}}>
        <h3 style={{fontWeight:700,marginBottom:12,color:'var(--accent)',fontSize:'0.95rem'}}>Бренд текст</h3>
        <div className="form-row">
          <div className="form-group"><label className="form-label">RU</label><textarea className="form-input" value={data.brand_text_ru||''} onChange={e=>set('brand_text_ru',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">AM</label><textarea className="form-input" value={data.brand_text_am||''} onChange={e=>set('brand_text_am',e.target.value)}/></div>
        </div>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <h3 style={{fontWeight:700,marginBottom:12,color:'var(--accent)',fontSize:'0.95rem'}}>Копирайт и локация</h3>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Copyright (RU)</label><input className="form-input" value={data.copyright_ru||''} onChange={e=>set('copyright_ru',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Copyright (AM)</label><input className="form-input" value={data.copyright_am||''} onChange={e=>set('copyright_am',e.target.value)}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Локация (RU)</label><input className="form-input" value={data.location_ru||''} onChange={e=>set('location_ru',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Локация (AM)</label><input className="form-input" value={data.location_am||''} onChange={e=>set('location_am',e.target.value)}/></div>
        </div>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <h3 style={{fontWeight:700,marginBottom:12,color:'var(--accent)',fontSize:'0.95rem'}}>Контакты (JSON)</h3>
        <div className="form-group"><textarea className="form-input" style={{minHeight:100,fontFamily:'monospace',fontSize:'0.82rem'}} value={data.contacts_json||'[]'} onChange={e=>set('contacts_json',e.target.value)} placeholder='[{"type":"phone","value":"+374..."}]'/></div>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <h3 style={{fontWeight:700,marginBottom:12,color:'var(--accent)',fontSize:'0.95rem'}}>Соцсети (JSON)</h3>
        <div className="form-group"><textarea className="form-input" style={{minHeight:100,fontFamily:'monospace',fontSize:'0.82rem'}} value={data.socials_json||'[]'} onChange={e=>set('socials_json',e.target.value)} placeholder='[{"platform":"telegram","url":"https://t.me/..."}]'/></div>
      </div>
      <div className="card">
        <h3 style={{fontWeight:700,marginBottom:12,color:'var(--accent)',fontSize:'0.95rem'}}>Кастомный HTML</h3>
        <div className="form-group"><textarea className="form-input" style={{minHeight:100,fontFamily:'monospace',fontSize:'0.82rem'}} value={data.custom_html||''} onChange={e=>set('custom_html',e.target.value)}/></div>
      </div>
    </div>
  );
}
