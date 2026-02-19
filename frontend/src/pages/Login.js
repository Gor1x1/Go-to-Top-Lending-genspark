import React, { useState } from 'react';
import { useAuth } from '../App';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(username, password);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="login-page" data-testid="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>Go to Top</h1>
          <p>Админ-платформа управления</p>
        </div>
        {error && <div className="login-error" data-testid="login-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Логин</label>
            <input
              className="form-input"
              data-testid="login-username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Пароль</label>
            <input
              className="form-input"
              data-testid="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Введите пароль"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            data-testid="login-submit"
            style={{ width: '100%', padding: '12px', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Логин: admin / Пароль: gototop2026
        </p>
      </div>
    </div>
  );
}
