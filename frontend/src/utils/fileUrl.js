import api from '../services/api';

/**
 * Utility to resolve backend and file URLs across environments (Vercel, Render, Localhost, Cloudinary)
 */

export const getBackendHost = () => {
  const envUrl = import.meta.env.VITE_API_URL || '';
  if (envUrl) {
    return envUrl.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5000';
  }
  // Production Render backend
  return 'https://stu-ma-gx4v.onrender.com';
};

/**
 * Resolves a file URL to a fully-qualified URL
 * @param {string} url - Raw URL or path
 * @returns {string} Fully qualified URL
 */
export const resolveFileUrl = (url) => {
  if (!url || typeof url !== 'string') return '';

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const backendHost = getBackendHost();
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${backendHost}${cleanPath}`;
};

/**
 * Resolves a viewable URL for browser preview.
 * - For PDFs and images: returns the authenticated backend streaming view endpoint with token
 * - For Office docs (PPTX, DOCX, XLSX): wraps in Microsoft Office Web Viewer
 * @param {Object|string} material - The material object or raw URL string
 * @param {string} role - 'student' or 'teacher'
 * @returns {string} View URL
 */
export const getViewFileUrl = (material, role = 'student') => {
  if (!material) return '';

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const backendHost = getBackendHost();

  // If passed as a material object
  if (typeof material === 'object' && material.id) {
    const fileName = (material.file_name || '').toLowerCase();
    const fileUrl = material.file_url || '';
    const ext = (fileName.split('.').pop() || fileUrl.split('.').pop() || '').toLowerCase().split('?')[0];

    // Office formats use Microsoft Office Viewer if public cloud URL
    if (['docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls'].includes(ext)) {
      if (fileUrl.startsWith('https://res.cloudinary.com')) {
        return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
      }
    }

    // PDFs, images, and other formats use direct authenticated backend stream
    const roleSegment = role === 'teacher' ? 'teachers' : 'students';
    const queryParam = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${backendHost}/api/${roleSegment}/materials/${material.id}/view${queryParam}`;
  }

  // If passed as a raw URL string
  const url = typeof material === 'string' ? material : material.file_url || '';
  if (!url) return '';

  const resolved = resolveFileUrl(url);
  const ext = (resolved.split('.').pop() || '').toLowerCase().split('?')[0];

  if (
    ['docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls'].includes(ext) &&
    (resolved.startsWith('http://') || resolved.startsWith('https://'))
  ) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(resolved)}`;
  }

  return resolved;
};

/**
 * Resolves a viewable URL for an assignment document
 */
export const getAssignmentViewUrl = (assignmentId, fileUrl, fileName, role = 'student') => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const backendHost = getBackendHost();
  const ext = ((fileName || '').split('.').pop() || (fileUrl || '').split('.').pop() || '').toLowerCase().split('?')[0];

  if (['docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls'].includes(ext) && fileUrl && fileUrl.startsWith('https://res.cloudinary.com')) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
  }

  const roleSeg = role === 'teacher' ? 'teachers' : 'students';
  const queryParam = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${backendHost}/api/${roleSeg}/assignments/${assignmentId}/view${queryParam}`;
};

/**
 * Resolves a viewable URL for a submission document
 */
export const getSubmissionViewUrl = (groupId, fileUrl, fileName, role = 'student') => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const backendHost = getBackendHost();
  const ext = ((fileName || '').split('.').pop() || (fileUrl || '').split('.').pop() || '').toLowerCase().split('?')[0];

  if (['docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls'].includes(ext) && fileUrl && fileUrl.startsWith('https://res.cloudinary.com')) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
  }

  const roleSeg = role === 'teacher' ? 'teachers' : 'students';
  const queryParam = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${backendHost}/api/${roleSeg}/assignments/submissions/${groupId}/view${queryParam}`;
};

/**
 * Safely trigger a browser file download with accurate filename, binary format, and real-time progress
 * @param {string} endpointOrUrl - Dedicated backend download route (e.g. /students/materials/16/download) or direct URL
 * @param {string} fileName - Desired file name with extension
 * @param {Function} onProgress - Optional callback receiving progress percentage (0-100)
 */
export const triggerFileDownload = async (endpointOrUrl, fileName = 'document', onProgress = null) => {
  if (!endpointOrUrl) return;

  try {
    if (onProgress) onProgress(10);
    let blob;

    // 1. If it's a backend relative endpoint (e.g. /students/materials/16/download or /api/...)
    // Call via authenticated Axios client
    if (!endpointOrUrl.startsWith('http://') && !endpointOrUrl.startsWith('https://')) {
      const cleanEndpoint = endpointOrUrl.startsWith('/api')
        ? endpointOrUrl.replace(/^\/api/, '')
        : endpointOrUrl;

      const res = await api.get(cleanEndpoint, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(Math.min(99, percent));
          }
        },
      });

      blob = new Blob([res.data], {
        type: res.headers['content-type'] || 'application/octet-stream',
      });
      if (onProgress) onProgress(100);
    } else {
      // 2. If it's a fully-qualified URL
      const resolved = endpointOrUrl;

      // If pointing to our backend host, use authenticated Axios client
      const backendHost = getBackendHost();
      if (resolved.startsWith(backendHost) || resolved.includes('/api/')) {
        const urlObj = new URL(resolved);
        const pathAndQuery = urlObj.pathname.replace(/^\/api/, '') + urlObj.search;

        const res = await api.get(pathAndQuery, {
          responseType: 'blob',
          onDownloadProgress: (progressEvent) => {
            if (progressEvent.total && onProgress) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              onProgress(Math.min(99, percent));
            }
          },
        });

        blob = new Blob([res.data], {
          type: res.headers['content-type'] || 'application/octet-stream',
        });
        if (onProgress) onProgress(100);
      } else {
        // Direct public CDN download (e.g. Cloudinary)
        const res = await fetch(resolved);
        if (!res.ok) {
          throw new Error(`File download failed with status ${res.status}.`);
        }

        const contentLength = res.headers.get('content-length');
        if (contentLength && res.body && onProgress) {
          const total = parseInt(contentLength, 10);
          let loaded = 0;
          const reader = res.body.getReader();
          const chunks = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            const percent = Math.min(99, Math.round((loaded / total) * 100));
            onProgress(percent);
          }
          blob = new Blob(chunks, {
            type: res.headers.get('content-type') || 'application/octet-stream',
          });
          onProgress(100);
        } else {
          blob = await res.blob();
          if (onProgress) onProgress(100);
        }
      }
    }

    // Safety check: verify response is not an HTML error or SPA fallback (e.g. 1837 bytes index.html)
    if (blob) {
      const isHtmlType = blob.type && blob.type.toLowerCase().includes('text/html');
      let isHtmlContent = false;
      if (blob.size < 50000) {
        try {
          const headerSnippet = (await blob.slice(0, 300).text()).toLowerCase();
          if (headerSnippet.includes('<!doctype html') || headerSnippet.includes('<html')) {
            isHtmlContent = true;
          }
        } catch {
          // Ignore text slice parse error
        }
      }

      if (isHtmlType || isHtmlContent) {
        throw new Error('The requested document is not available. Please notify your instructor.');
      }
    }

    // Trigger native browser file download with the original filename
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', fileName || 'document');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Defer revocation so mobile browsers (iOS Safari, Android Chrome) finish saving to disk
    setTimeout(() => {
      try {
        window.URL.revokeObjectURL(blobUrl);
      } catch {
        // Ignore revocation error
      }
    }, 1500);
  } catch (err) {
    console.error('[Download Error]:', err);
    throw new Error(err.response?.data?.message || err.message || 'Could not download the requested file.');
  }
};

/**
 * Safely preview a document in the browser.
 * - If PDF: fetches binary stream via authenticated Axios call, verifies it's not HTML,
 *   creates an Object URL, and opens it in a new window tab.
 * - If mobile browser blocks the new window tab (popup blocker), automatically falls back to direct download.
 * - If Office doc or presentation: invokes triggerFileDownload directly so the user gets the real file on their device.
 * @param {string} viewEndpoint - The backend view endpoint (e.g. `/students/materials/${mat.id}/view`)
 * @param {string} downloadEndpoint - The backend download endpoint (e.g. `/students/materials/${mat.id}/download`)
 * @param {string} fileName - Document filename with extension
 * @param {Function} onProgress - Optional progress callback
 */
export const triggerFilePreview = async (viewEndpoint, downloadEndpoint = '', fileName = 'document', onProgress = null) => {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  const isPdf = ext === 'pdf';

  if (!isPdf) {
    // Presentations and office docs cannot be previewed natively in HTML tabs; download directly
    return triggerFileDownload(downloadEndpoint || viewEndpoint, fileName, onProgress);
  }

  if (onProgress) onProgress(20);

  const cleanEndpoint = viewEndpoint.startsWith('/api')
    ? viewEndpoint.replace(/^\/api/, '')
    : viewEndpoint;

  const res = await api.get(cleanEndpoint, {
    responseType: 'blob',
    onDownloadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(Math.min(99, percent));
      }
    },
  });

  const blob = new Blob([res.data], {
    type: res.headers['content-type'] || 'application/pdf',
  });

  // Check for HTML fallback or error responses
  if (blob.type.includes('text/html') || blob.size < 5000) {
    try {
      const headerSnippet = (await blob.slice(0, 300).text()).toLowerCase();
      if (headerSnippet.includes('<!doctype html') || headerSnippet.includes('<html')) {
        throw new Error('The requested document is not currently available for online viewing.');
      }
    } catch (e) {
      if (e.message.includes('not currently available')) throw e;
    }
  }

  if (onProgress) onProgress(100);
  const blobUrl = window.URL.createObjectURL(blob);
  const previewTab = window.open(blobUrl, '_blank');

  // If mobile popup blocker prevented opening the tab, fall back to downloading directly
  if (!previewTab || previewTab.closed || typeof previewTab.closed === 'undefined') {
    return triggerFileDownload(downloadEndpoint || viewEndpoint, fileName);
  }

  // Defer revocation for opened tab to load
  setTimeout(() => {
    try {
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // Ignore
    }
  }, 60000);
};
