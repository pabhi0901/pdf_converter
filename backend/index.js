const express = require('express');
const cors = require('cors');
const multer = require('multer');
const puppeteer = require('puppeteer-core');
const libre = require('libreoffice-convert');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

libre.convertAsync = require('util').promisify(libre.convert);

const app = express();
app.use(cors());

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Helper: Convert using Puppeteer (HTML/Text/Images)
async function convertWithPuppeteer(htmlContent) {
  // Use environment variable, default to Windows Edge for local testing, or Linux Chromium for Docker
  let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!executablePath) {
    if (process.platform === 'win32') {
      executablePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    } else {
      executablePath = '/usr/bin/chromium';
    }
  }
  
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } });
  await browser.close();
  return pdfBuffer;
}

// Convert route
app.post('/api/convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, buffer, mimetype } = req.file;
    const ext = path.extname(originalname).toLowerCase();
    
    let pdfBuffer;

    console.log(`Processing file: ${originalname} (ext: ${ext}, mimetype: ${mimetype})`);

    // 1. Types to process with Puppeteer (Text, Code, Images)
    const textExtensions = ['.txt', '.json', '.csv', '.xml', '.log', '.md', '.html'];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];

    if (textExtensions.includes(ext)) {
      // Very basic Markdown to HTML conversion (you could add 'marked' for better MD)
      let htmlContent = buffer.toString('utf-8');
      
      if (ext !== '.html') {
         // Wrap plain text in a pre tag for monospace rendering
         htmlContent = `
         <!DOCTYPE html>
         <html>
         <head>
            <style>
               body { font-family: monospace; white-space: pre-wrap; word-wrap: break-word; }
            </style>
         </head>
         <body>${htmlContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body>
         </html>`;
      }
      pdfBuffer = await convertWithPuppeteer(htmlContent);

    } else if (imageExtensions.includes(ext)) {
      const base64Image = buffer.toString('base64');
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            img { max-width: 100%; max-height: 100%; object-fit: contain; }
          </style>
        </head>
        <body>
          <img src="data:${mimetype};base64,${base64Image}" />
        </body>
        </html>
      `;
      pdfBuffer = await convertWithPuppeteer(htmlContent);

    } 
    // 2. Types to process with LibreOffice (Office documents)
    const officeExtensions = ['.docx', '.pptx', '.xlsx', '.doc', '.ppt', '.xls'];
    
    if (officeExtensions.includes(ext)) {
      try {
        pdfBuffer = await libre.convertAsync(buffer, '.pdf', undefined);
      } catch (libreErr) {
        console.error("LibreOffice Conversion Error:", libreErr);
        return res.status(500).json({ 
          error: 'Office conversion failed. Ensure LibreOffice is installed on the server.',
          details: libreErr.message 
        });
      }
    } 
    else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    // Send the resulting PDF back
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(originalname, ext)}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Conversion Error:', error);
    res.status(500).json({ error: 'Failed to convert file', details: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
