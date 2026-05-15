import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileType2, X } from 'lucide-react';

const FileUploader = ({ onFileSelected }) => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles?.length > 0) {
      setFile(acceptedFiles[0]);
      setError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: 50 * 1024 * 1024, // 50MB max
    onDropRejected: () => {
      setError('File is too large or invalid. Max size is 50MB.');
    }
  });

  const supportedFormats = [
    'TXT', 'JSON', 'CSV', 'XML', 'LOG', 'HTML', 'MD',
    'XLSX', 'XLS', 'DOCX', 'PPTX',
    'JPG', 'PNG', 'WEBP', 'GIF', 'BMP'
  ];

  const handleConvert = () => {
    if (file) {
      onFileSelected(file);
    }
  };

  return (
    <div className="glass-panel">
      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}
      
      {!file ? (
        <div {...getRootProps()} className={`upload-zone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <UploadCloud className="upload-icon" />
          <h3>Drag & Drop your file here</h3>
          <p>or click to browse from your computer</p>
          
          <div className="format-badges">
            {supportedFormats.map(fmt => (
              <span key={fmt} className="badge">{fmt}</span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="file-preview">
            <div className="file-info">
              <div className="file-icon">
                <FileType2 size={24} />
              </div>
              <div className="file-details">
                <h4>{file.name}</h4>
                <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button className="btn-secondary" onClick={() => setFile(null)} style={{ padding: '0.5rem', border: 'none' }}>
              <X size={20} />
            </button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={handleConvert}>
              Convert to PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
