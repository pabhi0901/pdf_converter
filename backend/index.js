const express = require('express');
const cors = require('cors');
const multer = require('multer');
// Removed top-level puppeteer require due to ESM error
const libre = require('libreoffice-convert');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { PDFDocument } = require('pdf-lib');

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
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

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
        // Use pdf-lib for images (huge performance/size improvement over Puppeteer)
        const pdfDoc = await PDFDocument.create();
        let image;
        if (ext === '.jpg' || ext === '.jpeg') {
          image = await pdfDoc.embedJpg(buffer);
        } else if (ext === '.png') {
          image = await pdfDoc.embedPng(buffer);
        } else {
          // Fallback to Puppeteer for other formats like webp/gif/bmp
          const base64Image = buffer.toString('base64');
          return await convertWithPuppeteer(`<html><body style="margin:0;"><img src="data:${mimetype};base64,${base64Image}" style="max-width:100%;" /></body></html>`);
        }
        
        const dims = image.scale(1);
        const page = pdfDoc.addPage([dims.width, dims.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: dims.width,
          height: dims.height,
        });
        
        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);

      } else if (officeExtensions.includes(ext)) {
        return await libre.convertAsync(buffer, '.pdf', undefined);
      }
    };

    // Retry mechanism
    try {
      pdfBuffer = await performConversion();
    } catch (firstError) {
      console.warn(`[Retry 1/1] First conversion attempt failed for ${originalname}: ${firstError.message}. Retrying...`);
      console.error(firstError);
      try {
        pdfBuffer = await performConversion();
      } catch (secondError) {
        console.error("Second attempt failed:", secondError);
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
const server = app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

// Avoid "Request aborted" error on large file uploads by increasing the Node timeouts
server.keepAliveTimeout = 600000; // 10 minutes
server.headersTimeout = 600000;   // 10 minutes
server.setTimeout(600000);        // 10 minutes
