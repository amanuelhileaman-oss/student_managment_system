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

// File filter accepting PDF, Word, PowerPoint, Excel, Ebooks, Text, Archives
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|rtf|epub|mobi|zip|rar|7z|png|jpg|jpeg)$/i;
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.test(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `File format ${ext} is not supported. Supported formats include PDF, Word (.doc, .docx), PowerPoint (.ppt, .pptx), Excel, E-Books (.epub), Text, and ZIP archives.`
      )
    );
  }
};

const materialUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB limit for textbooks and large documents
  },
});

module.exports = materialUpload;
