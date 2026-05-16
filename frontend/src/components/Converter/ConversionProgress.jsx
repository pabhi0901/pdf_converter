import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, RefreshCcw } from 'lucide-react';

const ConversionProgress = ({ status, error, onReset, message }) => {
  return (
    <div className="glass-panel converting-state">
      {status === 'converting' && (
        <>
          <Loader2 size={64} className="spinner" />
          <div>
            <h3>Converting to PDF...</h3>
            <p>{message || 'Please wait while we process your files...'}</p>
          </div>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle2 size={64} color="var(--success)" />
          <div>
            <h3>Conversion Complete!</h3>
            <p>Your PDF has been successfully generated and downloaded.</p>
          </div>
          <button className="btn-secondary" onClick={onReset} style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCcw size={18} /> Convert Another File
          </button>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle size={64} color="var(--danger)" />
          <div>
            <h3>Conversion Failed</h3>
            <p style={{ color: 'var(--danger)', marginTop: '0.5rem' }}>{error}</p>
          </div>
          <button className="btn-secondary" onClick={onReset} style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCcw size={18} /> Try Again
          </button>
        </>
      )}
    </div>
  );
};

export default ConversionProgress;
