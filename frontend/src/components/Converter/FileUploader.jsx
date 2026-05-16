import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileType2, X } from 'lucide-react';

const FileUploader = ({ onFileSelected }) => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles?.length > 0) {
      setFiles(prev => [...prev, ...acceptedFiles]);
      setError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 100 * 1024 * 1024, // 100MB max
    onDropRejected: () => {
      setError('File is too large or invalid. Max size is 100MB.');
    }
  });

  const supportedFormats = [
    'TXT', 'JSON', 'CSV', 'XML', 'LOG', 'HTML', 'MD',
    'XLSX', 'XLS', 'DOCX', 'PPTX',
    'JPG', 'JPEG', 'PNG', 'WEBP', 'GIF', 'BMP'
  ];

  const [mergeFiles, setMergeFiles] = useState(false);

  const handleConvert = () => {
    if (files.length > 0) {
      onFileSelected(files, mergeFiles); // Pass array of files and merge flag
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="glass-panel">
      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}
      
      {files.length === 0 ? (
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Selected Files ({files.length})</h3>
            <button className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }} {...getRootProps()}>
              <input {...getInputProps()} />
              + Add More
            </button>
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {files.map((f, index) => (
              <div key={index} className="file-preview">
                <div className="file-info">
                  <div className="file-icon">
                    <FileType2 size={24} />
                  </div>
                  <div className="file-details">
                    <h4 style={{ wordBreak: 'break-all' }}>{f.name}</h4>
                    <p>{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button className="btn-secondary" onClick={() => removeFile(index)} style={{ padding: '0.5rem', border: 'none' }}>
                  <X size={20} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
            <input 
              type="checkbox" 
              id="mergeFiles" 
              checked={mergeFiles} 
              onChange={(e) => setMergeFiles(e.target.checked)} 
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="mergeFiles" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 500 }}>
              Merge all files into a single PDF
            </label>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn-primary" onClick={handleConvert}>
              {mergeFiles ? 'Merge & Convert to PDF' : 'Convert All to PDF Individually'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
