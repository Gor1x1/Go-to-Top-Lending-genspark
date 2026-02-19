import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import {
  LayoutDashboard, Users, Shield, FileText, Settings, LogOut, ExternalLink,
  Blocks, Calculator, FileDown, Gift, Clock, Footprints, Send, Bot, Code2
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Дашборд', icon: LayoutDashboard, section: 'dashboard' },
  { path: '/leads', label: 'Лиды / CRM', icon: FileText, section: 'leads' },
  { path: '/blocks', label: 'Конструктор блоков', icon: Blocks, section: 'blocks' },
  { path: '/calculator', label: 'Калькулятор', icon: Calculator, section: 'calculator' },
  { path: '/pdf', label: 'PDF шаблон', icon: FileDown, section: 'pdf' },
  { path: '/referrals', label: 'Реферальные коды', icon: Gift, section: 'referrals' },
  { path: '/slots', label: 'Счётчики слотов', icon: Clock, section: 'slots' },
  { path: '/footer', label: 'Футер сайта', icon: Footprints, section: 'footer' },
  { path: '/telegram', label: 'TG сообщения', icon: Send, section: 'telegram' },
  { path: '/tgbot', label: 'TG Бот / Уведомления', icon: Bot, section: 'tgbot' },
  { path: '/scripts', label: 'Скрипты', icon: Code2, section: 'scripts' },
  { divider: true },
  { path: '/employees', label: 'Сотрудники', icon: Users, section: 'employees' },
  { path: '/permissions', label: 'Доступы', icon: Shield, section: 'permissions' },
  { path: '/settings', label: 'Настройки', icon: Settings, section: 'settings' },
];

export default function Sidebar() {
  const { user, permissions, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;
  const initials = (user.display_name || user.username || 'U').slice(0, 2).toUpperCase();

  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">Go to Top</div>
        <div className="sidebar-sub">Админ-панель</div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item, i) => {
          if (item.divider) return <div key={i} style={{height:1,background:'var(--border)',margin:'6px 16px'}} />;
          if (item.section !== 'settings' && !permissions.includes(item.section)) return null;
          const active = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <div key={item.path} className={`nav-item${active ? ' active' : ''}`}
              onClick={() => navigate(item.path)} data-testid={`nav-${item.section}`}>
              <Icon size={18} /> <span>{item.label}</span>
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <a href="https://gototop.win" target="_blank" rel="noopener noreferrer" className="nav-item" style={{color:'var(--success)'}}>
          <ExternalLink size={18} /> <span>Открыть сайт</span>
        </a>
        <div className="nav-item" onClick={logout} data-testid="logout-btn" style={{color:'#f87171'}}>
          <LogOut size={18} /> <span>Выйти</span>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user.display_name || user.username}</div>
            <div className="sidebar-user-role">{user.role_label || user.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
