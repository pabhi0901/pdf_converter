import React, { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const currentPass = localStorage.getItem('app_password') || '123';
    
    if (password === currentPass) {
      onLogin();
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-panel auth-form">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '1rem', borderRadius: '50%' }}>
            <Lock size={32} color="var(--accent)" />
          </div>
        </div>
        
        <h1><span className="text-gradient">Secure</span> Access</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Enter your password to access the universal converter.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="input-group" style={{ gap: '1.5rem' }}>
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="Enter password (default: 123)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary">
            Unlock Converter <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
