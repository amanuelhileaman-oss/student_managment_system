const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Roster KPI and statistics calculator matching attendanceController logic
const calculateAttendanceKPIs = (attendanceRecords) => {
  const total = attendanceRecords.length;
  if (total === 0) {
    return { total: 0, present: 0, late: 0, absent: 0, excused: 0, rate: 0 };
  }

  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;

  for (const record of attendanceRecords) {
    const status = (record.status || '').toUpperCase();
    if (status === 'PRESENT') present++;
    else if (status === 'LATE') late++;
    else if (status === 'ABSENT') absent++;
    else if (status === 'EXCUSED') excused++;
  }

  // Official attendance rate: (Present + Late) / Total
  const rate = Math.round(((present + late) / total) * 100);
  const isAtRisk = rate < 75;

  return { total, present, late, absent, excused, rate, isAtRisk };
};

describe('Unit Test: Student Attendance Calculations & KPI Metrics', () => {
  it('returns 100% attendance rate when all students are marked present', () => {
    const roster = [
      { student_id: 1, status: 'PRESENT' },
      { student_id: 2, status: 'PRESENT' },
      { student_id: 3, status: 'PRESENT' },
      { student_id: 4, status: 'PRESENT' },
    ];
    const stats = calculateAttendanceKPIs(roster);
    assert.strictEqual(stats.total, 4);
    assert.strictEqual(stats.present, 4);
    assert.strictEqual(stats.rate, 100);
    assert.strictEqual(stats.isAtRisk, false);
  });

  it('correctly credits LATE status towards attendance presence', () => {
    const roster = [
      { student_id: 1, status: 'PRESENT' },
      { student_id: 2, status: 'LATE' },
      { student_id: 3, status: 'PRESENT' },
      { student_id: 4, status: 'ABSENT' },
    ];
    const stats = calculateAttendanceKPIs(roster);
    assert.strictEqual(stats.total, 4);
    assert.strictEqual(stats.present, 2);
    assert.strictEqual(stats.late, 1);
    assert.strictEqual(stats.absent, 1);
    assert.strictEqual(stats.rate, 75); // (2 present + 1 late) / 4 = 75%
    assert.strictEqual(stats.isAtRisk, false);
  });

  it('triggers isAtRisk warning when attendance rate drops below 75%', () => {
    const roster = [
      { student_id: 1, status: 'PRESENT' },
      { student_id: 2, status: 'ABSENT' },
      { student_id: 3, status: 'ABSENT' },
      { student_id: 4, status: 'ABSENT' },
    ];
    const stats = calculateAttendanceKPIs(roster);
    assert.strictEqual(stats.rate, 25);
    assert.strictEqual(stats.isAtRisk, true);
  });

  it('handles empty class roster gracefully without division by zero', () => {
    const stats = calculateAttendanceKPIs([]);
    assert.strictEqual(stats.total, 0);
    assert.strictEqual(stats.rate, 0);
  });
});
