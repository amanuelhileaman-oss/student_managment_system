const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Pure validation logic helpers
const validateAnnouncementPayload = ({ title, content, targetAudience }) => {
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return { valid: false, error: 'Title is required' };
  }
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return { valid: false, error: 'Content is required' };
  }
  const validAudiences = ['ALL', 'STUDENTS', 'TEACHERS', 'GRADE', 'STREAM', 'SECTION'];
  if (targetAudience && !validAudiences.includes(targetAudience)) {
    return { valid: false, error: 'Invalid target audience' };
  }
  return { valid: true };
};

const sanitizeAuditDetails = (rawDetails) => {
  if (!rawDetails) return null;
  if (typeof rawDetails === 'object') return rawDetails;
  try {
    return JSON.parse(rawDetails);
  } catch {
    return { note: String(rawDetails) };
  }
};

describe('Unit Test: Announcement & Audit Management Business Rules', () => {
  it('validates required fields for creating or editing announcements', () => {
    assert.strictEqual(validateAnnouncementPayload({ title: '', content: 'Valid' }).valid, false);
    assert.strictEqual(validateAnnouncementPayload({ title: 'Valid', content: '' }).valid, false);
    assert.strictEqual(validateAnnouncementPayload({ title: 'Exam Notice', content: 'Starts Monday', targetAudience: 'INVALID' }).valid, false);
    assert.strictEqual(validateAnnouncementPayload({ title: 'Exam Notice', content: 'Starts Monday', targetAudience: 'ALL' }).valid, true);
  });

  it('sanitizes audit details payload correctly from raw text or JSON', () => {
    const obj = { change: 'promoted', grade: 10 };
    assert.deepStrictEqual(sanitizeAuditDetails(obj), obj);

    const jsonStr = '{"user": "Dawit", "status": "active"}';
    assert.deepStrictEqual(sanitizeAuditDetails(jsonStr), { user: 'Dawit', status: 'active' });

    const plainText = 'Manual note by administrator';
    assert.deepStrictEqual(sanitizeAuditDetails(plainText), { note: 'Manual note by administrator' });

    assert.strictEqual(sanitizeAuditDetails(null), null);
  });
});
