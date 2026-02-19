import React, { useState, useEffect } from 'react';
import { apiFetch } from '../App';
import { FileDown, Save } from 'lucide-react';

export default function PdfTemplate() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const res = await apiFetch('/api/pdf-template');
    if (res?.ok) setData(await res.json());
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    await apiFetch('/api/pdf-template', {method:'PUT', body:JSON.stringify(data)});
    setSaving(false);
    alert('PDF шаблон сохранён!');
  };

  const set = (k, v) => setData(prev => ({...prev, [k]: v}));

  if (loading || !data) return <div className="page"><div className="loading-spinner" style={{margin:'60px auto'}} /></div>;

  const fields = [
    {section: 'Заголовки', items: [{k:'header_ru',l:'Заголовок (RU)'},{k:'header_am',l:'Заголовок (AM)'}]},
    {section: 'Введение', items: [{k:'intro_ru',l:'Введение (RU)'},{k:'intro_am',l:'Введение (AM)'}]},
    {section: 'Заключение', items: [{k:'outro_ru',l:'Заключение (RU)'},{k:'outro_am',l:'Заключение (AM)'}]},
    {section: 'Подвал', items: [{k:'footer_ru',l:'Подвал (RU)'},{k:'footer_am',l:'Подвал (AM)'}]},
    {section: 'Компания', items: [{k:'company_name',l:'Название'},{k:'company_phone',l:'Телефон'},{k:'company_email',l:'Email'},{k:'company_address',l:'Адрес'}]},
    {section: 'Кнопки', items: [{k:'btn_order_ru',l:'Заказать (RU)'},{k:'btn_order_am',l:'Заказать (AM)'},{k:'btn_download_ru',l:'Скачать (RU)'},{k:'btn_download_am',l:'Скачать (AM)'}]},
    {section: 'Ссылки', items: [{k:'order_telegram_url',l:'Telegram URL заказа'}]},
  ];

  return (
    <div className="page" data-testid="pdf-page">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div><h1 className="page-title">PDF шаблон</h1><p className="page-desc">Настройка коммерческого предложения</p></div>
        <button className="btn btn-primary" onClick={save} disabled={saving} data-testid="pdf-save-btn"><Save size={16}/> {saving?'Сохранение...':'Сохранить'}</button>
      </div>
      {fields.map(group => (
        <div key={group.section} className="card" style={{marginBottom:12}}>
          <h3 style={{fontWeight:700,marginBottom:12,color:'var(--accent)',fontSize:'0.95rem'}}>{group.section}</h3>
          <div style={{display:'grid',gridTemplateColumns:group.items.length > 2 ? '1fr 1fr' : '1fr 1fr', gap:12}}>
            {group.items.map(f => (
              <div key={f.k} className="form-group" style={{marginBottom:0}}>
                <label className="form-label">{f.l}</label>
                {f.k.includes('intro') || f.k.includes('outro') || f.k.includes('footer_') || f.k.includes('header_') ?
                  <textarea className="form-input" value={data[f.k]||''} onChange={e=>set(f.k,e.target.value)} /> :
                  <input className="form-input" value={data[f.k]||''} onChange={e=>set(f.k,e.target.value)} />
                }
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
