const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { checkGradeProgression } = require('../src/services/eligibilityEngine');

describe('Unit Test: Linear Grade Progression & Prevention of Grade Jumping', () => {
  it('allows a brand new student with no previous grade to enroll in Grade 9', () => {
    const result = checkGradeProgression(null, 9);
    assert.strictEqual(result.allowed, true);
  });

  it('rejects a brand new student attempting to enter directly into Grade 10', () => {
    const result = checkGradeProgression(null, 10);
    assert.strictEqual(result.allowed, false);
    assert.match(result.message, /must enroll in Grade 9/i);
  });

  it('allows a Grade 9 student to progress linearly to Grade 10', () => {
    const result = checkGradeProgression(9, 10);
    assert.strictEqual(result.allowed, true);
  });

  it('strictly prohibits a Grade 9 student from jumping directly to Grade 11', () => {
    const result = checkGradeProgression(9, 11);
    assert.strictEqual(result.allowed, false);
    assert.match(result.message, /Grade jumping is strictly prohibited/i);
    assert.match(result.message, /You must complete Grade 10 first/i);
  });

  it('strictly prohibits a Grade 9 student from jumping directly to Grade 12', () => {
    const result = checkGradeProgression(9, 12);
    assert.strictEqual(result.allowed, false);
    assert.match(result.message, /Grade jumping is strictly prohibited/i);
  });

  it('allows a Grade 10 student to progress linearly to Grade 11', () => {
    const result = checkGradeProgression(10, 11);
    assert.strictEqual(result.allowed, true);
  });

  it('strictly prohibits a Grade 10 student from jumping directly to Grade 12', () => {
    const result = checkGradeProgression(10, 12);
    assert.strictEqual(result.allowed, false);
    assert.match(result.message, /Grade jumping is strictly prohibited/i);
    assert.match(result.message, /You must complete Grade 11 first/i);
  });

  it('allows a Grade 11 student to progress linearly to Grade 12', () => {
    const result = checkGradeProgression(11, 12);
    assert.strictEqual(result.allowed, true);
  });

  it('strictly prevents backwards re-enrollment into a lower grade level (Grade 10 -> Grade 9)', () => {
    const result = checkGradeProgression(10, 9);
    assert.strictEqual(result.allowed, false);
    assert.match(result.message, /already enrolled or completed Grade 10/i);
  });

  it('strictly prevents backwards re-enrollment into a lower grade level (Grade 12 -> Grade 11)', () => {
    const result = checkGradeProgression(12, 11);
    assert.strictEqual(result.allowed, false);
    assert.match(result.message, /already enrolled or completed Grade 12/i);
  });
});
