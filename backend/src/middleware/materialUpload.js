const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const materialsDir = path.join(__dirname, '../../uploads/materials');
if (!fs.existsSync(materialsDir)) {
  fs.mkdirSync(materialsDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, materialsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

// File filter accepting PDF, Word, PowerPoint, Excel, Ebooks, Text, Archives, and Media across all devices
const allowedExtensions = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|rtf|odt|ods|odp|epub|mobi|zip|rar|7z|csv|png|jpg|jpeg|webp)$/i;

const allowedMimePrefixes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats',
  'application/vnd.ms-',
  'application/vnd.oasis.opendocument',
  'application/epub',
  'application/zip',
  'application/x-zip',
  'application/x-rar',
  'application/x-7z',
  'application/rtf',
  'text/',
  'image/',
  'application/octet-stream', // Device fallback
];

const fileFilter = (req, file, cb) => {
  const originalName = file.originalname || 'textbook.pdf';
  const ext = path.extname(originalName).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  const isExtAllowed = ext ? allowedExtensions.test(ext) : false;
  const isMimeAllowed = allowedMimePrefixes.some((prefix) => mime.startsWith(prefix));

  if (isExtAllowed || isMimeAllowed) {
    if (!ext) {
      if (mime.includes('pdf')) file.originalname = `${originalName}.pdf`;
      else if (mime.includes('word') || mime.includes('officedocument.wordprocessingml')) file.originalname = `${originalName}.docx`;
      else if (mime.includes('presentation') || mime.includes('powerpoint')) file.originalname = `${originalName}.pptx`;
      else if (mime.includes('sheet') || mime.includes('excel')) file.originalname = `${originalName}.xlsx`;
      else if (mime.includes('epub')) file.originalname = `${originalName}.epub`;
      else if (mime.startsWith('image/')) file.originalname = `${originalName}.jpg`;
      else file.originalname = `${originalName}.pdf`;
    }
    return cb(null, true);
  }

  cb(
    new Error(
      `File format "${ext || mime}" is not supported. Supported formats include PDF, Word (.doc, .docx), PowerPoint (.ppt, .pptx), Excel, E-Books (.epub), Text, and ZIP archives.`
    )
  );
};

const materialUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB limit for textbooks and large documents
  },
});

module.exports = materialUpload;
