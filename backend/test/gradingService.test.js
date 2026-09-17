const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateLetterGrade } = require('../src/services/gradingService');

describe('Unit Test: Academic Grading Scale & Letter Grade Evaluation', () => {
  it('correctly maps scores >= 90 to A+', () => {
    assert.strictEqual(calculateLetterGrade(100), 'A+');
    assert.strictEqual(calculateLetterGrade(95.5), 'A+');
    assert.strictEqual(calculateLetterGrade(90), 'A+');
  });

  it('correctly maps scores between 85 and 89.9 to A', () => {
    assert.strictEqual(calculateLetterGrade(89.9), 'A');
    assert.strictEqual(calculateLetterGrade(87), 'A');
    assert.strictEqual(calculateLetterGrade(85), 'A');
  });

  it('correctly maps scores between 80 and 84.9 to A-', () => {
    assert.strictEqual(calculateLetterGrade(84.5), 'A-');
    assert.strictEqual(calculateLetterGrade(80), 'A-');
  });

  it('correctly maps scores between 75 and 79.9 to B+', () => {
    assert.strictEqual(calculateLetterGrade(79), 'B+');
    assert.strictEqual(calculateLetterGrade(75), 'B+');
  });

  it('correctly maps scores between 70 and 74.9 to B', () => {
    assert.strictEqual(calculateLetterGrade(74), 'B');
    assert.strictEqual(calculateLetterGrade(70), 'B');
  });

  it('correctly maps scores between 65 and 69.9 to B-', () => {
    assert.strictEqual(calculateLetterGrade(69), 'B-');
    assert.strictEqual(calculateLetterGrade(65), 'B-');
  });

  it('correctly maps scores between 60 and 64.9 to C+', () => {
    assert.strictEqual(calculateLetterGrade(64), 'C+');
    assert.strictEqual(calculateLetterGrade(60), 'C+');
  });

  it('correctly maps scores between 50 and 59.9 to C (Passing minimum)', () => {
    assert.strictEqual(calculateLetterGrade(59), 'C');
    assert.strictEqual(calculateLetterGrade(50), 'C');
  });

  it('correctly maps scores below 50 to F (Failing)', () => {
    assert.strictEqual(calculateLetterGrade(49.9), 'F');
    assert.strictEqual(calculateLetterGrade(41.42), 'F');
    assert.strictEqual(calculateLetterGrade(25), 'F');
    assert.strictEqual(calculateLetterGrade(0), 'F');
  });
});
