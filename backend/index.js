const express = require('express');
const cors = require('cors');
const multer = require('multer');
// Removed top-level puppeteer require due to ESM error
const libre = require('libreoffice-convert');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

libre.convertAsync = require('util').promisify(libre.convert);

const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:3000', 
    'https://pdf-converter-sage-eta.vercel.app'
  ]
}));

// Configure Multer for disk storage to handle large files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Helper: Convert using Puppeteer (HTML/Text/Images)
async function convertWithPuppeteer(htmlContent) {
  // Use dynamic import for ESM compatibility
  const puppeteerModule = await import('puppeteer-core');
  const puppeteer = puppeteerModule.default || puppeteerModule;

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
  page.setDefaultTimeout(0); // Disable timeouts
  await page.setContent(htmlContent, { waitUntil: 'load', timeout: 0 });
  const pdfBuffer = await page.pdf({ 
    format: 'A4', 
    printBackground: true, 
    margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
    timeout: 0 
  });
  await browser.close();
  return pdfBuffer;
}

// Convert route
app.post('/api/convert', upload.single('file'), async (req, res) => {
  let uploadedFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    uploadedFilePath = req.file.path;
    const { originalname, mimetype } = req.file;
    const ext = path.extname(originalname).toLowerCase();
    
    console.log(`Processing file: ${originalname} (ext: ${ext}, mimetype: ${mimetype})`);

    const textExtensions = ['.txt', '.json', '.csv', '.xml', '.log', '.md', '.html'];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const officeExtensions = ['.docx', '.pptx', '.xlsx', '.doc', '.ppt', '.xls'];

    if (!textExtensions.includes(ext) && !imageExtensions.includes(ext) && !officeExtensions.includes(ext)) {
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    // Read file buffer for processing (avoids storing the entire file in RAM repeatedly during upload)
    const buffer = await fs.promises.readFile(uploadedFilePath);
    let pdfBuffer;

    const performConversion = async () => {
      if (textExtensions.includes(ext)) {
        let htmlContent = buffer.toString('utf-8');
        
        if (ext !== '.html') {
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
        return await convertWithPuppeteer(htmlContent);

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
        return await convertWithPuppeteer(htmlContent);

      } else if (officeExtensions.includes(ext)) {
        return await libre.convertAsync(buffer, '.pdf', undefined);
      }
    };

    // Retry mechanism
    try {
      pdfBuffer = await performConversion();
    } catch (firstError) {
      console.warn(`[Retry 1/1] First conversion attempt failed for ${originalname}: ${firstError.message}. Retrying...`);
      try {
        pdfBuffer = await performConversion();
      } catch (secondError) {
        throw new Error(`Conversion failed after retry: ${secondError.message}`);
      }
    }

    // Send the resulting PDF back
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(originalname, ext)}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Conversion Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to convert file', details: error.message });
    }
  } finally {
    // Clean up uploaded file from disk to prevent storage leaks
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch (cleanupError) {
        console.error('Failed to clean up file:', cleanupError.message);
      }
    }
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
