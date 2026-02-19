import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../App';
import { Blocks, Plus, Save, Eye, EyeOff, ChevronUp, ChevronDown, Trash2, Copy, Edit3, Download, Upload, GripVertical, Image, Link, X, Check, RefreshCw, Globe, ExternalLink } from 'lucide-react';

export default function BlockConstructor() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editBlock, setEditBlock] = useState(null);
  const [showFetchModal, setShowFetchModal] = useState(false);
  const [fetchUrl, setFetchUrl] = useState('https://gototop.win');
  const [fetchedBlocks, setFetchedBlocks] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const res = await apiFetch('/api/site-blocks');
    if (res?.ok) {
      const data = await res.json();
      setBlocks(data.blocks || []);
    }
    setLoading(false);
  };

  const toggleExpand = (id) => setExpanded(prev => ({...prev, [id]: !prev[id]}));

  const toggleVisible = async (idx) => {
    const block = blocks[idx];
    await apiFetch(`/api/site-blocks/${block.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_visible: !block.is_visible })
    });
    setBlocks(prev => prev.map((b, i) => i === idx ? {...b, is_visible: !b.is_visible} : b));
  };

  // Drag and drop handlers
  const handleDragStart = (idx) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    
    const newBlocks = [...blocks];
    const dragged = newBlocks[draggedIdx];
    newBlocks.splice(draggedIdx, 1);
    newBlocks.splice(idx, 0, dragged);
    
    setBlocks(newBlocks);
    setDraggedIdx(idx);
  };

  const handleDragEnd = async () => {
    if (draggedIdx === null) return;
    
    // Save new order
    const orders = blocks.map((b, i) => ({ id: b.id, sort_order: i }));
    await apiFetch('/api/site-blocks/reorder', {
      method: 'POST',
      body: JSON.stringify({ orders })
    });
    
    setDraggedIdx(null);
  };

  // Fetch blocks from site
  const fetchFromSite = async () => {
    setFetching(true);
    const res = await apiFetch('/api/site-blocks/fetch-from-site', {
      method: 'POST',
      body: JSON.stringify({ url: fetchUrl })
    });
    if (res?.ok) {
      const data = await res.json();
      setFetchedBlocks(data.blocks || []);
    }
    setFetching(false);
  };

  const importBlocks = async () => {
    if (fetchedBlocks.length === 0) return;
    setImporting(true);
    await apiFetch('/api/site-blocks/import', {
      method: 'POST',
      body: JSON.stringify({ blocks: fetchedBlocks })
    });
    setShowFetchModal(false);
    setFetchedBlocks([]);
    load();
    setImporting(false);
  };

  // Block CRUD
  const saveBlock = async () => {
    if (!editBlock) return;
    if (editBlock.id) {
      await apiFetch(`/api/site-blocks/${editBlock.id}`, {
        method: 'PUT',
        body: JSON.stringify(editBlock)
      });
    } else {
      await apiFetch('/api/site-blocks', {
        method: 'POST',
        body: JSON.stringify(editBlock)
      });
    }
    setEditBlock(null);
    load();
  };

  const deleteBlock = async (idx) => {
    const block = blocks[idx];
    if (!window.confirm(`Удалить блок "${block.title_ru || block.block_key}"?`)) return;
    await apiFetch(`/api/site-blocks/${block.id}`, { method: 'DELETE' });
    load();
  };

  const duplicateBlock = async (idx) => {
    const block = blocks[idx];
    const res = await apiFetch(`/api/site-blocks/duplicate/${block.id}`, { method: 'POST' });
    if (res?.ok) load();
  };

  const createNewBlock = () => {
    setEditBlock({
      block_key: `block_${Date.now()}`,
      block_type: 'section',
      title_ru: 'Новый блок',
      title_am: '',
      texts_ru: [''],
      texts_am: [''],
      images: [],
      buttons: [],
      is_visible: true,
      custom_css: '',
      custom_html: ''
    });
  };

  // Image upload
  const uploadImage = async (file) => {
    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('gtt_token');
    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    
    if (res.ok) {
      const data = await res.json();
      setUploadingImage(false);
      return data.url;
    }
    setUploadingImage(false);
    return null;
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editBlock) return;
    
    const url = await uploadImage(file);
    if (url) {
      setEditBlock(prev => ({
        ...prev,
        images: [...(prev.images || []), { url, alt: file.name }]
      }));
    }
  };

  // Edit helpers
  const updateTextField = (lang, idx, value) => {
    const key = `texts_${lang}`;
    setEditBlock(prev => {
      const texts = [...(prev[key] || [])];
      texts[idx] = value;
      return { ...prev, [key]: texts };
    });
  };

  const addTextField = (lang) => {
    const key = `texts_${lang}`;
    setEditBlock(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), '']
    }));
  };

  const removeTextField = (lang, idx) => {
    const key = `texts_${lang}`;
    setEditBlock(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter((_, i) => i !== idx)
    }));
  };

  const updateButton = (idx, field, value) => {
    setEditBlock(prev => {
      const buttons = [...(prev.buttons || [])];
      buttons[idx] = { ...buttons[idx], [field]: value };
      return { ...prev, buttons };
    });
  };

  const addButton = () => {
    setEditBlock(prev => ({
      ...prev,
      buttons: [...(prev.buttons || []), { text_ru: '', text_am: '', url: '' }]
    }));
  };

  const removeButton = (idx) => {
    setEditBlock(prev => ({
      ...prev,
      buttons: (prev.buttons || []).filter((_, i) => i !== idx)
    }));
  };

  const removeImage = (idx) => {
    setEditBlock(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== idx)
    }));
  };

  if (loading) return <div className="page"><div className="loading-spinner" style={{margin:'60px auto'}} /></div>;

  return (
    <div className="page" data-testid="blocks-page">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 className="page-title">Конструктор блоков</h1>
          <p className="page-desc">Визуальное редактирование секций сайта</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-outline" onClick={() => setShowFetchModal(true)} data-testid="fetch-site-btn">
            <Globe size={16} /> Загрузить с сайта
          </button>
          <button className="btn btn-primary" onClick={createNewBlock} data-testid="add-block-btn">
            <Plus size={16} /> Новый блок
          </button>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className="card empty-state">
          <Blocks size={48} />
          <p style={{marginTop:12}}>Блоки ещё не добавлены</p>
          <p style={{fontSize:'0.85rem',color:'var(--text-muted)',marginTop:8}}>
            Нажмите "Загрузить с сайта" чтобы импортировать блоки с вашего сайта
          </p>
        </div>
      ) : (
        <div style={{display:'grid',gap:8}}>
          {blocks.map((block, idx) => {
            const isExp = expanded[block.id];
            const textsCount = (block.texts_ru?.length || 0) + (block.texts_am?.length || 0);
            const imagesCount = block.images?.length || 0;
            const buttonsCount = block.buttons?.length || 0;

            return (
              <div 
                key={block.id} 
                className="card" 
                style={{
                  padding:0, overflow:'hidden',
                  opacity: block.is_visible ? 1 : 0.5,
                  borderColor: block.is_visible ? 'var(--border)' : 'rgba(239,68,68,0.3)',
                  borderLeft: `3px solid ${block.is_visible ? 'var(--purple)' : 'var(--danger)'}`
                }}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
              >
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 16px',cursor:'pointer',background:'var(--bg-card)'}} onClick={() => toggleExpand(block.id)}>
                  <div 
                    style={{cursor:'grab',color:'var(--text-muted)',padding:'4px'}}
                    onClick={e => e.stopPropagation()}
                  >
                    <GripVertical size={16} />
                  </div>
                  <span style={{color:'var(--text-muted)',fontSize:'0.8rem',fontWeight:700,minWidth:28}}>#{idx+1}</span>
                  <div style={{flex:1,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <span style={{fontWeight:700,color:block.is_visible?'var(--text)':'#f87171'}}>{block.title_ru || block.block_key}</span>
                    <span className="badge badge-purple" style={{fontSize:'0.7rem'}}>{block.block_key}</span>
                    {textsCount > 0 && <span className="badge badge-blue" style={{fontSize:'0.68rem'}}>{textsCount} текст</span>}
                    {imagesCount > 0 && <span className="badge badge-green" style={{fontSize:'0.68rem'}}>{imagesCount} фото</span>}
                    {buttonsCount > 0 && <span className="badge badge-amber" style={{fontSize:'0.68rem'}}>{buttonsCount} кнопок</span>}
                  </div>
                  <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                    <button className="btn btn-sm btn-outline" style={{padding:'4px 8px'}} onClick={() => setEditBlock({...block})} title="Редактировать">
                      <Edit3 size={14}/>
                    </button>
                    <button className="btn btn-sm btn-outline" style={{padding:'4px 8px'}} onClick={() => duplicateBlock(idx)} title="Дублировать">
                      <Copy size={14}/>
                    </button>
                    <button className={`btn btn-sm ${block.is_visible?'btn-success':'btn-danger'}`} style={{padding:'4px 8px'}} onClick={()=>toggleVisible(idx)}>
                      {block.is_visible ? <Eye size={14}/> : <EyeOff size={14}/>}
                    </button>
                    <button className="btn btn-sm btn-danger" style={{padding:'4px 8px'}} onClick={()=>deleteBlock(idx)}><Trash2 size={14}/></button>
                  </div>
                  {isExp ? <ChevronUp size={16} style={{color:'var(--text-muted)'}}/> : <ChevronDown size={16} style={{color:'var(--text-muted)'}}/>}
                </div>

                {isExp && (
                  <div style={{padding:'16px',borderTop:'1px solid var(--border)',background:'var(--bg-surface)'}}>
                    {/* Preview */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                      <div>
                        <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--purple)',marginBottom:6}}>Тексты (RU)</div>
                        {(block.texts_ru || []).map((t, i) => (
                          <div key={i} style={{fontSize:'0.85rem',color:'var(--text)',marginBottom:4,padding:'6px 10px',background:'var(--bg-card)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}>
                            {t || <span style={{color:'var(--text-muted)'}}>пусто</span>}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--warning)',marginBottom:6}}>Тексты (AM)</div>
                        {(block.texts_am || []).map((t, i) => (
                          <div key={i} style={{fontSize:'0.85rem',color:'var(--text)',marginBottom:4,padding:'6px 10px',background:'var(--bg-card)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}>
                            {t || <span style={{color:'var(--text-muted)'}}>пусто</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Images preview */}
                    {(block.images || []).length > 0 && (
                      <div style={{marginBottom:16}}>
                        <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--accent)',marginBottom:6}}>Изображения</div>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                          {block.images.map((img, i) => (
                            <div key={i} style={{width:80,height:80,borderRadius:'var(--radius-sm)',overflow:'hidden',border:'1px solid var(--border)'}}>
                              <img src={img.url.startsWith('/') ? process.env.REACT_APP_BACKEND_URL + img.url : img.url} alt={img.alt} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Buttons preview */}
                    {(block.buttons || []).length > 0 && (
                      <div>
                        <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--accent)',marginBottom:6}}>Кнопки</div>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                          {block.buttons.map((btn, i) => (
                            <div key={i} style={{padding:'6px 12px',background:'var(--purple)',color:'white',borderRadius:'var(--radius-sm)',fontSize:'0.82rem',display:'flex',alignItems:'center',gap:6}}>
                              {btn.text_ru}
                              {btn.url && <ExternalLink size={12} />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fetch from site modal */}
      {showFetchModal && (
        <div className="modal-overlay" onClick={() => { if (!fetching && !importing) { setShowFetchModal(false); setFetchedBlocks([]); }}}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth:700,maxHeight:'90vh',overflow:'auto'}} data-testid="fetch-modal">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 className="modal-title" style={{margin:0}}>
                <Globe size={20} style={{marginRight:8,color:'var(--purple)'}} />
                Загрузить блоки с сайта
              </h3>
              <button className="btn-icon" onClick={() => { setShowFetchModal(false); setFetchedBlocks([]); }} disabled={fetching || importing}><X size={16}/></button>
            </div>

            <div style={{display:'flex',gap:8,marginBottom:16}}>
              <input 
                className="form-input" 
                value={fetchUrl} 
                onChange={e => setFetchUrl(e.target.value)}
                placeholder="https://gototop.win"
                style={{flex:1}}
                data-testid="fetch-url-input"
              />
              <button className="btn btn-primary" onClick={fetchFromSite} disabled={fetching || !fetchUrl} data-testid="fetch-btn">
                {fetching ? <RefreshCw size={16} className="spin" /> : <Download size={16} />}
                {fetching ? 'Загрузка...' : 'Загрузить'}
              </button>
            </div>

            {fetchedBlocks.length > 0 && (
              <>
                <div style={{fontSize:'0.85rem',color:'var(--text-muted)',marginBottom:12}}>
                  Найдено блоков: <strong>{fetchedBlocks.length}</strong>
                </div>
                <div style={{maxHeight:400,overflow:'auto',marginBottom:16}}>
                  {fetchedBlocks.map((block, idx) => (
                    <div key={idx} style={{padding:'12px',background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',marginBottom:8}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <div style={{fontWeight:700,color:'var(--text)'}}>{block.title_ru || block.block_key}</div>
                          <div style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>{block.block_key}</div>
                        </div>
                        <div style={{display:'flex',gap:6}}>
                          {(block.texts_ru?.length || 0) > 0 && <span className="badge badge-blue" style={{fontSize:'0.68rem'}}>{block.texts_ru.length} текст</span>}
                          {(block.images?.length || 0) > 0 && <span className="badge badge-green" style={{fontSize:'0.68rem'}}>{block.images.length} фото</span>}
                          {(block.buttons?.length || 0) > 0 && <span className="badge badge-amber" style={{fontSize:'0.68rem'}}>{block.buttons.length} кнопок</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn btn-success" onClick={importBlocks} disabled={importing} style={{width:'100%'}} data-testid="import-btn">
                  {importing ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}
                  {importing ? 'Импорт...' : `Импортировать ${fetchedBlocks.length} блоков`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit block modal */}
      {editBlock && (
        <div className="modal-overlay" onClick={() => setEditBlock(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth:800,maxHeight:'90vh',overflow:'auto'}} data-testid="edit-block-modal">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 className="modal-title" style={{margin:0}}>
                {editBlock.id ? 'Редактировать блок' : 'Новый блок'}
              </h3>
              <button className="btn-icon" onClick={() => setEditBlock(null)}><X size={16}/></button>
            </div>

            {/* Basic info */}
            <div className="form-row" style={{marginBottom:16}}>
              <div className="form-group">
                <label className="form-label">Ключ блока</label>
                <input className="form-input" value={editBlock.block_key || ''} onChange={e => setEditBlock({...editBlock, block_key: e.target.value})} data-testid="block-key-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Тип</label>
                <select className="form-input" value={editBlock.block_type || 'section'} onChange={e => setEditBlock({...editBlock, block_type: e.target.value})}>
                  <option value="section">Секция</option>
                  <option value="hero">Hero</option>
                  <option value="features">Features</option>
                  <option value="cta">CTA</option>
                  <option value="custom">Кастомный</option>
                </select>
              </div>
            </div>

            <div className="form-row" style={{marginBottom:16}}>
              <div className="form-group">
                <label className="form-label" style={{color:'var(--purple)'}}>Заголовок (RU)</label>
                <input className="form-input" value={editBlock.title_ru || ''} onChange={e => setEditBlock({...editBlock, title_ru: e.target.value})} data-testid="title-ru-input" />
              </div>
              <div className="form-group">
                <label className="form-label" style={{color:'var(--warning)'}}>Заголовок (AM)</label>
                <input className="form-input" value={editBlock.title_am || ''} onChange={e => setEditBlock({...editBlock, title_am: e.target.value})} />
              </div>
            </div>

            {/* Texts */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <label className="form-label" style={{color:'var(--purple)',margin:0}}>Тексты (RU)</label>
                  <button className="btn btn-sm btn-outline" onClick={() => addTextField('ru')}><Plus size={12}/></button>
                </div>
                {(editBlock.texts_ru || []).map((text, idx) => (
                  <div key={idx} style={{display:'flex',gap:6,marginBottom:6}}>
                    <textarea className="form-input" style={{minHeight:60,fontSize:'0.85rem'}} value={text} onChange={e => updateTextField('ru', idx, e.target.value)} />
                    <button className="btn-icon" style={{color:'var(--danger)'}} onClick={() => removeTextField('ru', idx)}><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <label className="form-label" style={{color:'var(--warning)',margin:0}}>Тексты (AM)</label>
                  <button className="btn btn-sm btn-outline" onClick={() => addTextField('am')}><Plus size={12}/></button>
                </div>
                {(editBlock.texts_am || []).map((text, idx) => (
                  <div key={idx} style={{display:'flex',gap:6,marginBottom:6}}>
                    <textarea className="form-input" style={{minHeight:60,fontSize:'0.85rem'}} value={text} onChange={e => updateTextField('am', idx, e.target.value)} />
                    <button className="btn-icon" style={{color:'var(--danger)'}} onClick={() => removeTextField('am', idx)}><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Images */}
            <div style={{marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <label className="form-label" style={{margin:0}}>Изображения</label>
                <input type="file" ref={fileInputRef} style={{display:'none'}} accept="image/*" onChange={handleImageUpload} />
                <button className="btn btn-sm btn-outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                  {uploadingImage ? <RefreshCw size={12} className="spin"/> : <Upload size={12}/>} Загрузить
                </button>
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {(editBlock.images || []).map((img, idx) => (
                  <div key={idx} style={{position:'relative',width:100,height:100}}>
                    <img src={img.url.startsWith('/') ? process.env.REACT_APP_BACKEND_URL + img.url : img.url} alt={img.alt} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}} />
                    <button className="btn-icon" style={{position:'absolute',top:4,right:4,background:'var(--danger)',color:'white',borderRadius:'50%',padding:4}} onClick={() => removeImage(idx)}>
                      <X size={10}/>
                    </button>
                  </div>
                ))}
                {(editBlock.images || []).length === 0 && (
                  <div style={{padding:'20px',background:'var(--bg-surface)',border:'2px dashed var(--border)',borderRadius:'var(--radius-sm)',color:'var(--text-muted)',fontSize:'0.85rem',textAlign:'center',width:'100%'}}>
                    <Image size={24} style={{marginBottom:8,opacity:0.5}} /><br/>
                    Нет изображений
                  </div>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div style={{marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <label className="form-label" style={{margin:0}}>Кнопки</label>
                <button className="btn btn-sm btn-outline" onClick={addButton}><Plus size={12}/> Кнопка</button>
              </div>
              {(editBlock.buttons || []).map((btn, idx) => (
                <div key={idx} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 32px',gap:8,marginBottom:8,padding:'10px',background:'var(--bg-surface)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}>
                  <div>
                    <label style={{fontSize:'0.7rem',color:'var(--purple)'}}>Текст (RU)</label>
                    <input className="form-input" style={{fontSize:'0.85rem'}} value={btn.text_ru || ''} onChange={e => updateButton(idx, 'text_ru', e.target.value)} />
                  </div>
                  <div>
                    <label style={{fontSize:'0.7rem',color:'var(--warning)'}}>Текст (AM)</label>
                    <input className="form-input" style={{fontSize:'0.85rem'}} value={btn.text_am || ''} onChange={e => updateButton(idx, 'text_am', e.target.value)} />
                  </div>
                  <div>
                    <label style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>URL</label>
                    <input className="form-input" style={{fontSize:'0.85rem'}} value={btn.url || ''} onChange={e => updateButton(idx, 'url', e.target.value)} placeholder="https://..." />
                  </div>
                  <button className="btn-icon" style={{color:'var(--danger)',alignSelf:'end',marginBottom:4}} onClick={() => removeButton(idx)}><Trash2 size={14}/></button>
                </div>
              ))}
            </div>

            {/* Custom HTML/CSS */}
            <details style={{marginBottom:16}}>
              <summary style={{cursor:'pointer',fontWeight:700,fontSize:'0.85rem',color:'var(--text-muted)',marginBottom:8}}>Дополнительно (HTML/CSS)</summary>
              <div className="form-group">
                <label className="form-label">Custom CSS</label>
                <textarea className="form-input" style={{fontFamily:'monospace',fontSize:'0.82rem',minHeight:80}} value={editBlock.custom_css || ''} onChange={e => setEditBlock({...editBlock, custom_css: e.target.value})} placeholder=".my-class { color: red; }" />
              </div>
              <div className="form-group">
                <label className="form-label">Custom HTML</label>
                <textarea className="form-input" style={{fontFamily:'monospace',fontSize:'0.82rem',minHeight:80}} value={editBlock.custom_html || ''} onChange={e => setEditBlock({...editBlock, custom_html: e.target.value})} placeholder="<div>...</div>" />
              </div>
            </details>

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setEditBlock(null)}>Отмена</button>
              <button className="btn btn-primary" onClick={saveBlock} data-testid="save-block-btn">
                <Save size={16}/> Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
