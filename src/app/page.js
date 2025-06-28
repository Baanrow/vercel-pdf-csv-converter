'use client';

import { useState, useRef } from 'react';

export default function Home() {
  const [file, setFile] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setPdfData(null);
    
    const formData = new FormData();
    formData.append('pdfFile', file);

    try {
      // Use the CSV conversion endpoint
      const endpoint = '/api/convert-csv-simple';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      
      // For CSV, trigger a download
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${file.name.replace('.pdf', '')}_converted.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        // Set success message
        setPdfData({
          text: `Successfully converted ${file.name} to CSV. The download should have started automatically.`,
          info: {
            fileName: file.name,
            fileSize: file.size,
            conversionType: 'CSV'
          }
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to convert PDF to CSV');
      }
      
      // Reset the file input and state after successful extraction
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFile(null);
      
    } catch (error) {
      setError(error.message || 'An error occurred while processing the file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: '#000000',
      padding: '20px'
    }}>
      <div style={{ 
        padding: '50px', 
        backgroundColor: '#222', 
        borderRadius: '12px', 
        boxShadow: '0 10px 20px rgba(0, 0, 0, 0.3)', 
        textAlign: 'center', 
        maxWidth: '800px', 
        width: '100%' 
      }}>
        <h1 style={{ color: 'white', marginBottom: '20px' }}>PDF to CSV Converter</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: '#aaa', marginTop: '10px', fontSize: '14px' }}>
            Convert PDF to structured CSV data (optimized for healthcare claims)
          </p>
        </div>
        
        <form onSubmit={handleSubmit} encType="multipart/form-data">
          <div style={{
            border: '2px dashed #555',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <input 
              ref={fileInputRef}
              type="file" 
              name="pdfFile" 
              accept="application/pdf" 
              required 
              onChange={(e) => {
                const selectedFile = e.target.files[0];
                if (selectedFile && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
                  setError('Please select a valid PDF file');
                  setFile(null);
                } else {
                  setError(null);
                  setFile(selectedFile);
                }
              }}
              style={{
                color: 'white'
              }}
            />
            {file && <p style={{ color: '#aaa', marginTop: '10px' }}>Selected: {file.name} ({Math.round(file.size / 1024)} KB)</p>}
          </div>
          <button 
            type="submit" 
            style={{ 
              padding: '12px 24px', 
              backgroundColor: '#4CAF50', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: file ? 'pointer' : 'not-allowed', 
              fontSize: '16px', 
              transition: 'background-color 0.3s ease',
              opacity: file ? 1 : 0.7
            }}
            disabled={loading || !file}
            onMouseOver={e => e.target.style.backgroundColor = file ? '#45a049' : '#4CAF50'}
            onMouseOut={e => e.target.style.backgroundColor = '#4CAF50'}
          >
            {loading ? 'Processing...' : 'Convert to CSV'}
          </button>
        </form>

        {error && (
          <div style={{ 
            marginTop: '20px', 
            color: '#ff6b6b', 
            backgroundColor: 'rgba(255, 107, 107, 0.1)', 
            padding: '15px', 
            borderRadius: '6px',
            textAlign: 'left'
          }}>
            <strong>Error: </strong>{error}
          </div>
        )}

        {pdfData && pdfData.text && (
          <div style={{ marginTop: '30px', color: 'white', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>
                Conversion Complete
              </h2>
            </div>
            
            {pdfData.info && (
              <div style={{ 
                backgroundColor: '#333', 
                padding: '10px', 
                borderRadius: '6px', 
                marginBottom: '15px',
                fontSize: '14px'
              }}>
                <p style={{ margin: '5px 0' }}>File: {pdfData.info.fileName}</p>
                <p style={{ margin: '5px 0' }}>Size: {Math.round(pdfData.info.fileSize / 1024)} KB</p>
              </div>
            )}
            
            <div style={{ 
              backgroundColor: '#333',
              padding: '15px',
              borderRadius: '6px',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              {pdfData.text}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}