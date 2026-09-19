require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'uhohypxa';
const API_KEY = process.env.CLOUDINARY_API_KEY || '913549955642587';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || 'VlnMILCFQu6KhVqSZzgW_DKW4kU';

/**
 * Check if Cloudinary credentials are available
 */
const isConfigured = () => {
  return !!(
    process.env.CLOUDINARY_URL ||
    (CLOUD_NAME && API_KEY && API_SECRET)
  );
};

const ensureConfig = () => {
  if (isConfigured()) {
    if (process.env.CLOUDINARY_URL) {
      cloudinary.config({
        cloudinary_url: process.env.CLOUDINARY_URL,
        secure: true,
      });
    } else {
      cloudinary.config({
        cloud_name: CLOUD_NAME,
        api_key: API_KEY,
        api_secret: API_SECRET,
        secure: true,
      });
    }
  }
};

ensureConfig();

/**
 * MIME Type resolution helper
 */
const getMimeType = (fileName, fallbackType = 'application/octet-stream') => {
  const ext = path.extname(fileName || '').toLowerCase();
  const map = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.epub': 'application/epub+zip',
    '.zip': 'application/zip',
    '.rar': 'application/vnd.rar',
    '.7z': 'application/x-7z-compressed',
  };
  return map[ext] || fallbackType || 'application/octet-stream';
};

/**
 * Upload a file buffer directly to Cloudinary using upload_stream
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {Object} options - Options including folder, originalName, resourceType
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadBuffer = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    ensureConfig();
    if (!isConfigured()) {
      return reject(new Error('Persistent cloud storage (Cloudinary) is not configured in environment variables.'));
    }

    const { folder = 'ethio_highhub/general', originalName = 'document', resourceType = 'auto' } = options;
    const ext = path.extname(originalName).toLowerCase();
    
    // Cloudinary raw storage is best suited for document formats including PDF, PPTX, DOCX, XLSX
    const effectiveResourceType =
      resourceType === 'auto' && ['.ppt', '.pptx', '.doc', '.docx', '.xls', '.xlsx', '.epub', '.pdf', '.odt', '.ods', '.odp', '.txt', '.rtf', '.zip', '.rar', '.7z', '.csv'].includes(ext)
        ? 'raw'
        : resourceType;

    // Sanitize filename_override for Cloudinary: safe ASCII alphanumeric, dots, dashes, underscores
    const rawBase = path.basename(originalName, ext);
    const safeBase = rawBase.replace(/[^\w.-]/gi, '_').replace(/_+/g, '_').slice(0, 80) || 'document';
    const safeExt = ext || (effectiveResourceType === 'raw' ? '.bin' : '');
    const safeFilenameOverride = `${safeBase}${safeExt}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: effectiveResourceType,
        use_filename: true,
        unique_filename: true,
        filename_override: safeFilenameOverride,
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary] Upload stream error:', error);
          return reject(error);
        }
        resolve(result);
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
};

/**
 * Generate a signed Cloudinary download URL that guarantees HTTP 200 binary delivery across all devices
 */
const getSignedDownloadUrl = (fileUrlOrPublicId) => {
  if (!fileUrlOrPublicId) return '';
  ensureConfig();

  let publicId = fileUrlOrPublicId;
  let resourceType = 'raw';

  if (fileUrlOrPublicId.includes('res.cloudinary.com')) {
    if (fileUrlOrPublicId.includes('/image/upload/')) {
      resourceType = 'image';
      const match = fileUrlOrPublicId.match(/\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?(?:\?.*)?$/);
      if (match) publicId = match[1];
    } else {
      resourceType = 'raw';
      const match = fileUrlOrPublicId.match(/\/raw\/upload\/(?:v\d+\/)?(.+?)(?:\?.*)?$/);
      if (match) publicId = match[1];
    }
  }

  try {
    const ext = path.extname(fileUrlOrPublicId || '').replace('.', '').toLowerCase();
    // Do not force 'pdf' for images; let Cloudinary use original format or format if image extension
    const format = resourceType === 'image' && ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? ext : '';
    return cloudinary.utils.private_download_url(publicId, format, {
      resource_type: resourceType,
      type: 'upload',
    });
  } catch (err) {
    console.warn('[Cloudinary] private_download_url failed:', err.message);
    return fileUrlOrPublicId;
  }
};

/**
 * Stream binary file directly from Cloudinary or local storage to Express HTTP response
 * Sets Content-Type and Content-Disposition (inline or attachment)
 */
const streamFileToResponse = async ({ fileUrl, publicId, fileName, mimeType, isInline = false, res }) => {
  try {
    ensureConfig();
    const effectiveMime = mimeType || getMimeType(fileName);
    const targetRef = publicId || fileUrl;

    // 1. If it's a Cloudinary asset
    if (targetRef && (targetRef.includes('res.cloudinary.com') || !targetRef.startsWith('/'))) {
      const signedUrl = getSignedDownloadUrl(targetRef);

      const upstreamRes = await fetch(signedUrl);
      if (upstreamRes.ok) {
        return pipeToExpress(upstreamRes, res, fileName, effectiveMime, isInline);
      }

      // If signed URL failed, try original direct URL
      if (fileUrl && fileUrl !== signedUrl) {
        const directRes = await fetch(fileUrl);
        if (directRes.ok) {
          return pipeToExpress(directRes, res, fileName, effectiveMime, isInline);
        }
      }

      console.error('[Storage Stream] Upstream status:', upstreamRes.status);
      return res.status(upstreamRes.status || 502).json({
        success: false,
        message: 'Could not retrieve file from persistent cloud storage. Please contact the administrator.',
      });
    }

    // 2. Local disk file fallback (development only)
    const diskFileName = path.basename(fileUrl);
    const candidateDirs = [
      path.join(__dirname, '../../uploads/materials'),
      path.join(__dirname, '../../uploads/assignments'),
      path.join(__dirname, '../../uploads/submissions'),
      path.join(__dirname, '../../uploads'),
    ];
    let filePath = null;
    for (const dir of candidateDirs) {
      const candidate = path.join(dir, diskFileName);
      if (fs.existsSync(candidate)) {
        filePath = candidate;
        break;
      }
    }

    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: 'Document file not found on server storage. Please re-upload.',
      });
    }

    const dispositionType = isInline ? 'inline' : 'attachment';
    const cleanName = (fileName || diskFileName).replace(/[^\w\s.-]/gi, '_');
    res.setHeader('Content-Type', effectiveMime);
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${cleanName}"`);
    return fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('[Stream Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'An error occurred while streaming the requested document.',
      });
    }
  }
};

const pipeToExpress = async (upstreamRes, res, fileName, mimeType, isInline) => {
  const dispositionType = isInline ? 'inline' : 'attachment';
  const cleanName = (fileName || 'document').replace(/"/g, '');
  const encodedName = encodeURIComponent(cleanName);

  res.setHeader('Content-Type', mimeType || upstreamRes.headers.get('content-type') || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${dispositionType}; filename="${cleanName}"; filename*=UTF-8''${encodedName}`);

  const contentLength = upstreamRes.headers.get('content-length');
  if (contentLength && contentLength !== '0') {
    res.setHeader('Content-Length', contentLength);
  }

  if (upstreamRes.body) {
    if (typeof upstreamRes.body.pipe === 'function') {
      upstreamRes.body.pipe(res);
    } else if (Readable && typeof Readable.fromWeb === 'function') {
      Readable.fromWeb(upstreamRes.body).pipe(res);
    } else {
      const arrayBuffer = await upstreamRes.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
    }
  } else {
    res.end();
  }
};

/**
 * Permanently delete asset from Cloudinary
 */
const deleteFile = async (fileUrlOrPublicId) => {
  if (!fileUrlOrPublicId || !isConfigured()) return;
  try {
    ensureConfig();
    let publicId = fileUrlOrPublicId;
    let resourceType = 'raw';

    if (fileUrlOrPublicId.includes('res.cloudinary.com')) {
      if (fileUrlOrPublicId.includes('/image/upload/')) {
        resourceType = 'image';
        const match = fileUrlOrPublicId.match(/\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?(?:\?.*)?$/);
        if (match) publicId = match[1];
      } else {
        resourceType = 'raw';
        const match = fileUrlOrPublicId.match(/\/raw\/upload\/(?:v\d+\/)?(.+?)(?:\?.*)?$/);
        if (match) publicId = match[1];
      }
    }

    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    console.log(`[Cloudinary] Successfully deleted asset: ${publicId}`);
  } catch (err) {
    console.warn('[Cloudinary] Delete failed:', err.message);
  }
};

/**
 * Process uploaded file from multer:
 * Uploads to Cloudinary; fails gracefully if cloud storage is unreachable.
 */
const processUploadedFile = async (file, options = {}) => {
  if (!file) return null;
  const { folder = 'ethio_highhub/general', localDir = 'materials' } = options;

  if (isConfigured() && file.buffer) {
    try {
      const result = await uploadBuffer(file.buffer, {
        folder,
        originalName: file.originalname,
        resourceType: 'auto',
      });
      return {
        fileUrl: result.secure_url,
        fileName: file.originalname,
        fileSize: result.bytes || file.size,
        fileType: file.mimetype,
        mimeType: getMimeType(file.originalname, file.mimetype),
        storageProvider: 'cloudinary',
        storagePath: result.public_id || result.secure_url,
        isCloud: true,
      };
    } catch (err) {
      console.error('[Storage] Cloudinary upload failed:', err.message);
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Cloud storage upload failed: ${err.message}. Please verify Cloudinary credentials.`);
      }
      // In local development only, fall back to local disk
    }
  }

  // Fallback to local disk storage (development only)
  const targetDir = path.join(__dirname, '../../uploads', localDir);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const baseName = path
    .basename(file.originalname, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 50);
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
  const diskFileName = `${baseName}-${uniqueSuffix}${ext}`;
  const filePath = path.join(targetDir, diskFileName);

  if (file.buffer) {
    fs.writeFileSync(filePath, file.buffer);
  }

  return {
    fileUrl: `/uploads/${localDir}/${diskFileName}`,
    fileName: file.originalname,
    fileSize: file.size,
    fileType: file.mimetype,
    mimeType: getMimeType(file.originalname, file.mimetype),
    storageProvider: 'local',
    storagePath: filePath,
    isCloud: false,
  };
};

module.exports = {
  isConfigured,
  uploadBuffer,
  getSignedDownloadUrl,
  streamFileToResponse,
  deleteFile,
  processUploadedFile,
  getMimeType,
  cloudinary,
};
