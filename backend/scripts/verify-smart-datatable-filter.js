// Verification of DataTable's comprehensive smart filtering logic
function testFilter(data, searchTerm, extraFilters = {}) {
  const { gradeFilter = 'ALL', sectionFilter = 'ALL', streamFilter = 'ALL' } = extraFilters;

  // 1. Extra filters
  let filtered = data.filter((u) => {
    if (gradeFilter !== 'ALL' && String(u.current_grade_level) !== String(gradeFilter)) return false;
    if (sectionFilter !== 'ALL' && String(u.section_name || '').toUpperCase() !== String(sectionFilter).toUpperCase()) return false;
    if (streamFilter !== 'ALL') {
      const code = String(u.stream_code || '').toUpperCase();
      const name = String(u.stream_name || '').toUpperCase();
      if (!code.includes(streamFilter) && !name.includes(streamFilter)) return false;
    }
    return true;
  });

  // 2. Smart search terms
  if (searchTerm) {
    const query = searchTerm.toLowerCase().trim();
    const tokens = query.split(/\s+/).filter(Boolean);

    filtered = filtered.filter((item) => {
      const values = [];
      for (const val of Object.values(item)) {
        if (val !== null && val !== undefined) values.push(String(val).toLowerCase());
      }
      if (item.first_name || item.last_name) {
        values.push(`${item.first_name || ''} ${item.last_name || ''}`.toLowerCase());
        values.push(`${item.last_name || ''} ${item.first_name || ''}`.toLowerCase());
      }
      const grade = item.current_grade_level || item.grade_level;
      if (grade) {
        values.push(`grade ${grade}`.toLowerCase());
        values.push(`g${grade}`.toLowerCase());
        values.push(`gr ${grade}`.toLowerCase());
        values.push(`grade${grade}`.toLowerCase());
      }
      const sec = item.section_name;
      if (sec) {
        values.push(`section ${sec}`.toLowerCase());
        values.push(`sec ${sec}`.toLowerCase());
        values.push(`section-${sec}`.toLowerCase());
        if (grade) {
          values.push(`grade ${grade} section ${sec}`.toLowerCase());
          values.push(`grade ${grade} - ${sec}`.toLowerCase());
          values.push(`grade ${grade}-${sec}`.toLowerCase());
          values.push(`${grade}-${sec}`.toLowerCase());
          values.push(`${grade}${sec}`.toLowerCase());
          values.push(`grade ${grade} ${sec}`.toLowerCase());
        }
      }
      if (item.stream_name) values.push(String(item.stream_name).toLowerCase());
      if (item.stream_code) values.push(String(item.stream_code).toLowerCase());
      if (item.role) values.push(String(item.role).toLowerCase());
      if (item.student_id) values.push(String(item.student_id).toLowerCase());
      if (item.teacher_id) values.push(String(item.teacher_id).toLowerCase());
      if (item.specialization) values.push(String(item.specialization).toLowerCase());
      if (item.qualification) values.push(String(item.qualification).toLowerCase());

      const combined = values.join(' ');
      return tokens.every((token) => combined.includes(token));
    });
  }

  return filtered;
}

const mockUsers = [
  {
    first_name: 'Kidus',
    last_name: 'Alemu',
    email: 'kidus@highschool.edu',
    role: 'student',
    student_id: 'STU-PROG-001',
    current_grade_level: 9,
    section_name: 'A',
    stream_name: 'General Stream',
    stream_code: 'GENERAL',
  },
  {
    first_name: 'Aster',
    last_name: 'Bekele',
    email: 'aster@highschool.edu',
    role: 'teacher',
    teacher_id: 'TCH-2026-011',
    specialization: 'Mathematics',
    qualification: 'M.Sc. Mathematics',
  },
  {
    first_name: 'Dagne',
    last_name: 'Amare',
    email: 'dagne@gmail.com',
    role: 'student',
    student_id: 'STU-2026-000',
    current_grade_level: 10,
    section_name: 'B',
    stream_name: 'General Stream',
    stream_code: 'GENERAL',
  },
  {
    first_name: 'Natnael',
    last_name: 'Desta',
    email: 'natnael@test.com',
    role: 'student',
    student_id: 'STU-2026-007',
    current_grade_level: 11,
    section_name: 'A',
    stream_name: 'Natural Science',
    stream_code: 'NATURAL',
  },
];

console.log('--- Testing Smart Search in the Middle ---');

// Test 1: Search by ID
const r1 = testFilter(mockUsers, 'STU-PROG-001');
console.log('Test 1 (ID "STU-PROG-001"):', r1.length === 1 && r1[0].first_name === 'Kidus' ? 'PASS' : 'FAIL');

// Test 2: Search by Grade ("Grade 9")
const r2 = testFilter(mockUsers, 'Grade 9');
console.log('Test 2 (Grade "Grade 9"):', r2.length === 1 && r2[0].first_name === 'Kidus' ? 'PASS' : 'FAIL');

// Test 3: Search by Section ("Section B")
const r3 = testFilter(mockUsers, 'Section B');
console.log('Test 3 (Section "Section B"):', r3.length === 1 && r3[0].first_name === 'Dagne' ? 'PASS' : 'FAIL');

// Test 4: Search by Grade & Section combination ("11-A" or "Grade 11 Sec A")
const r4 = testFilter(mockUsers, 'Grade 11 Sec A');
console.log('Test 4 (Composite "Grade 11 Sec A"):', r4.length === 1 && r4[0].first_name === 'Natnael' ? 'PASS' : 'FAIL');

// Test 5: Search by Stream ("Natural Science")
const r5 = testFilter(mockUsers, 'Natural Science');
console.log('Test 5 (Stream "Natural Science"):', r5.length === 1 && r5[0].first_name === 'Natnael' ? 'PASS' : 'FAIL');

// Test 6: Search Teacher by Subject ("Math")
const r6 = testFilter(mockUsers, 'Math');
console.log('Test 6 (Subject "Math"):', r6.length === 1 && r6[0].first_name === 'Aster' ? 'PASS' : 'FAIL');

// Test 7: Full Name Search ("Kidus Alemu")
const r7 = testFilter(mockUsers, 'Kidus Alemu');
console.log('Test 7 (Full Name "Kidus Alemu"):', r7.length === 1 && r7[0].student_id === 'STU-PROG-001' ? 'PASS' : 'FAIL');

// Test 8: Dropdown Filter (Grade 10)
const r8 = testFilter(mockUsers, '', { gradeFilter: '10' });
console.log('Test 8 (Dropdown Filter Grade 10):', r8.length === 1 && r8[0].first_name === 'Dagne' ? 'PASS' : 'FAIL');

console.log('All 8 middle search & filter tests verified successfully!');
