import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, LogOut, FileText } from 'lucide-react';
import Login from './components/Auth/Login';
import ChangePassword from './components/Auth/ChangePassword';
import FileUploader from './components/Converter/FileUploader';
import ConversionProgress from './components/Converter/ConversionProgress';
import { saveAs } from 'file-saver';
import './index.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [conversionState, setConversionState] = useState('idle'); // 'idle', 'converting', 'success', 'error'
  const [errorMsg, setErrorMsg] = useState('');

  // Check auth on load
  useEffect(() => {
    const sessionAuth = sessionStorage.getItem('is_auth');
    if (sessionAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('is_auth', 'true');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('is_auth');
  };

  const handleConvert = async (file) => {
    setConversionState('converting');
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:5000/api/convert', formData, {
        responseType: 'blob', // Important for receiving binary PDF
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const originalName = file.name || 'document';
      const lastDot = originalName.lastIndexOf('.');
      const baseName = lastDot !== -1 ? originalName.substring(0, lastDot) : originalName;
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      saveAs(blob, `${baseName}.pdf`);

      setConversionState('success');
    } catch (err) {
      console.error(err);
      let message = 'An unexpected error occurred.';
      if (err.response && err.response.data instanceof Blob) {
         // Attempt to read blob error message
         const text = await err.response.data.text();
         try {
            const jsonError = JSON.parse(text);
            message = jsonError.error || jsonError.details || message;
         } catch(e) {
            message = "Server returned an error.";
         }
      } else if (err.message) {
         message = err.message;
      }
      setErrorMsg(message);
      setConversionState('error');
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <div className="navbar-brand">
          <FileText color="var(--accent)" />
          <span>Universal <span className="text-gradient">Converter</span></span>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-secondary" onClick={() => setShowSettings(true)} style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={18} /> Settings
          </button>
          <button className="btn-secondary" onClick={handleLogout} style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </nav>

      <main className="main-content">
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Convert Any File to <span className="text-gradient">PDF</span></h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Secure, high-fidelity conversion running on our powerful backend engine.</p>
        </div>

        {conversionState === 'idle' ? (
          <FileUploader onFileSelected={handleConvert} />
        ) : (
          <ConversionProgress 
            status={conversionState} 
            error={errorMsg} 
            onReset={() => setConversionState('idle')} 
          />
        )}
      </main>

      {showSettings && <ChangePassword onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
