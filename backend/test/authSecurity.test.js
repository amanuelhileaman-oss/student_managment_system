const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Unit Test: Authentication, Password Hashing & Security Tokens', () => {
  const samplePassword = 'StrongPassword2026!';
  const jwtSecret = 'test-unit-secret-key-32-bytes-long';

  it('correctly hashes passwords with bcrypt and verifies matching hashes', async () => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(samplePassword, salt);

    assert.notStrictEqual(hash, samplePassword);
    const isMatch = await bcrypt.compare(samplePassword, hash);
    assert.strictEqual(isMatch, true);
  });

  it('rejects incorrect passwords during bcrypt comparison', async () => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(samplePassword, salt);

    const isMatch = await bcrypt.compare('WrongPassword123!', hash);
    assert.strictEqual(isMatch, false);
  });

  it('generates signed JWT tokens containing expected user claims and expiration', () => {
    const payload = { id: 101, email: 'teacher@highschool.edu', role: 'teacher' };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });

    const decoded = jwt.verify(token, jwtSecret);
    assert.strictEqual(decoded.id, 101);
    assert.strictEqual(decoded.email, 'teacher@highschool.edu');
    assert.strictEqual(decoded.role, 'teacher');
    assert.ok(decoded.exp > decoded.iat);
  });

  it('rejects tampered or improperly signed JWT tokens', () => {
    const payload = { id: 1, email: 'admin@highschool.edu', role: 'admin' };
    const forgedToken = jwt.sign(payload, 'wrong-secret-key');

    assert.throws(() => {
      jwt.verify(forgedToken, jwtSecret);
    }, /invalid signature/i);
  });
});
