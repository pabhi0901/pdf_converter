import  { useState, useEffect } from 'react';
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
  const [progressMsg, setProgressMsg] = useState('');

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

  const handleConvert = async (files) => {
    setConversionState('converting');
    setErrorMsg('');
    
    let failedFiles = [];

    // Use deployed URL or local if not defined
    const API_URL = import.meta.env.VITE_API_URL || 'https://pdf-converter-3mmy.onrender.com/api/convert';

    for (let i = 0; i < files.length; i++) {
       const file = files[i];
       let isSuccess = false;
       
       const isLastFile = i === files.length - 1;
       const maxRetriesThisFile = isLastFile ? 5 : 2; // Give the last file up to 5 tries, others 2

       for (let attempt = 1; attempt <= maxRetriesThisFile; attempt++) {
         setProgressMsg(`Converting file ${i + 1} of ${files.length}: ${file.name} ${attempt > 1 ? `(Retry ${attempt}/${maxRetriesThisFile}...)` : ''}`);
         
         const formData = new FormData();
         formData.append('file', file);

         try {
           const response = await axios.post(API_URL, formData, {
             responseType: 'blob', // Important for receiving binary PDF
             headers: { 'Content-Type': 'multipart/form-data' },
             timeout: 600000 // Ensure axios doesn't abort early (10 minutes)
           });

           const originalName = file.name || 'document';
           const lastDot = originalName.lastIndexOf('.');
           const baseName = lastDot !== -1 ? originalName.substring(0, lastDot) : originalName;
           
           const blob = new Blob([response.data], { type: 'application/pdf' });
           saveAs(blob, `${baseName}.pdf`);
           isSuccess = true;
           break; // If successful, exit the retry loop
         } catch (err) {
           console.error(`Attempt ${attempt} failed for ${file.name}:`, err);
           if (attempt < maxRetriesThisFile) {
             // Wait for 2 seconds before retrying
             await new Promise(resolve => setTimeout(resolve, 2000));
           }
         }
       }

       if (!isSuccess) {
         failedFiles.push(file.name);
       }

       // Smart Server Cooldown: Wait 2 seconds before throwing the next file at the server (except very last upload)
       if (i < files.length - 1) {
         setProgressMsg(`Waiting 2 sec to free server memory before next file...`);
         await new Promise(resolve => setTimeout(resolve, 2000));
       }
    }

    if (failedFiles.length > 0) {
       setErrorMsg(`Following files failed after retries: ${failedFiles.join(', ')}.`);
       setConversionState('error');
    } else {
       setConversionState('success');
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
            message={progressMsg}
            onReset={() => setConversionState('idle')} 
          />
        )}
      </main>

      {showSettings && <ChangePassword onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
