const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/db');

async function seedBooks() {
  console.log('--- Seeding Realistic Textbooks and Study Materials ---');
  try {
    const teacherRes = await query("SELECT t.id, t.user_id, u.first_name, u.last_name FROM teachers t JOIN users u ON t.user_id = u.id LIMIT 3");
    if (teacherRes.rows.length === 0) {
      console.log('No teachers found to associate materials with.');
      return;
    }

    const teachers = teacherRes.rows;
    const tMath = teachers[0];
    const tPhysics = teachers[1] || teachers[0];

    // Ensure uploads/materials directory exists
    const materialsDir = path.join(__dirname, '../uploads/materials');
    if (!fs.existsSync(materialsDir)) {
      fs.mkdirSync(materialsDir, { recursive: true });
    }

    const sampleBooks = [
      {
        teacherId: tMath.id,
        subjectCode: 'MATH10',
        gradeLevel: 10,
        title: 'Grade 10 Mathematics Official Student Textbook',
        author: 'Ministry of Education',
        edition: '2026 Revised Edition',
        materialType: 'TEXTBOOK',
        description: 'Official Ministry textbook covering Polynomials, Exponential and Logarithmic Functions, Trigonometric Functions, and Coordinate Geometry.',
        fileName: 'Grade10_Mathematics_Textbook.pdf',
        fileContent: '%PDF-1.4 Ministry of Education Grade 10 Mathematics Official Textbook',
      },
      {
        teacherId: tPhysics.id,
        subjectCode: 'PHYS10',
        gradeLevel: 10,
        title: 'Halliday & Resnick Fundamentals of Physics - High School Edition',
        author: 'Halliday, Resnick & Walker',
        edition: '11th International Edition',
        materialType: 'REFERENCE_BOOK',
        description: 'Comprehensive physics reference companion covering Mechanics, Gravitation, Wave Motion, and Thermodynamics with worked examples.',
        fileName: 'Fundamentals_of_Physics_Reference.pdf',
        fileContent: '%PDF-1.4 High School Reference: Fundamentals of Physics by Halliday & Resnick',
      },
      {
        teacherId: tMath.id,
        subjectCode: 'MATH10',
        gradeLevel: 10,
        title: 'Grade 10 Trigonometry & Quadratic Functions Master Worksheet',
        author: `${tMath.first_name} ${tMath.last_name}`,
        edition: 'Semester 1 Problem Set',
        materialType: 'WORKSHEET',
        description: '35 challenging practice questions on quadratic graphs, sine/cosine formulas, and real-world geometry application problems with answer hints.',
        fileName: 'Grade10_Math_Trig_Worksheet.pdf',
        fileContent: '%PDF-1.4 Grade 10 Mathematics Problem Set and Worksheet',
      },
      {
        teacherId: tPhysics.id,
        subjectCode: 'PHYS10',
        gradeLevel: 10,
        title: 'Physics Unit 1-3 Summary & Important Formulas Cheat Sheet',
        author: `${tPhysics.first_name} ${tPhysics.last_name}`,
        edition: '2026 Lecture Notes',
        materialType: 'LECTURE_NOTES',
        description: 'Compact revision notes summarizing Kinematics, Newton’s Laws of Motion, and Conservation of Energy for quick exam review.',
        fileName: 'Physics_Formulas_Lecture_Notes.pdf',
        fileContent: '%PDF-1.4 Physics Lecture Notes and Formula Sheet',
      },
      {
        teacherId: tMath.id,
        subjectCode: 'ENG10',
        gradeLevel: null, // General School Library for all grades!
        title: 'Classic World Literature & Essay Writing Anthology',
        author: 'Oxford Readers & Ministry Literary Circle',
        edition: 'Anthology Volume 2',
        materialType: 'LITERATURE_BOOK',
        description: 'General school library edition featuring curated short stories, poetry analysis, and grammar/composition guidelines available to all high school students.',
        fileName: 'World_Literature_Anthology.pdf',
        fileContent: '%PDF-1.4 World Literature and Essay Writing Anthology',
      },
      {
        teacherId: tMath.id,
        subjectCode: 'MATH12',
        gradeLevel: null, // School Library
        title: 'National Examination (EUEE) Past Questions & Detailed Solutions',
        author: 'National Educational Assessment & Examinations Agency',
        edition: '2019-2025 Multi-Year Booklet',
        materialType: 'EXAM_PREP',
        description: 'Compilation of previous national university entrance exam questions with step-by-step mathematical proofs and explanatory remarks.',
        fileName: 'EUEE_Exam_Prep_Booklet.pdf',
        fileContent: '%PDF-1.4 Ethiopian National Examination Past Papers and Solution Guide',
      },
    ];

    for (const book of sampleBooks) {
      // Find subject
      let subjRes = await query('SELECT id FROM subjects WHERE code = $1 LIMIT 1', [book.subjectCode]);
      if (subjRes.rows.length === 0) {
        subjRes = await query('SELECT id FROM subjects WHERE grade_level = $1 LIMIT 1', [book.gradeLevel || 9]);
      }
      const subjectId = subjRes.rows[0]?.id;
      if (!subjectId) continue;

      // Create dummy file on disk
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
      const ext = path.extname(book.fileName);
      const baseName = path.basename(book.fileName, ext);
      const diskFileName = `${baseName}-${uniqueSuffix}${ext}`;
      const filePath = path.join(materialsDir, diskFileName);
      fs.writeFileSync(filePath, book.fileContent);

      const fileUrl = `/uploads/materials/${diskFileName}`;
      const fileSize = Buffer.byteLength(book.fileContent);

      // Check if already seeded
      const checkRes = await query('SELECT id FROM study_materials WHERE title = $1', [book.title]);
      if (checkRes.rows.length === 0) {
        await query(
          `INSERT INTO study_materials
            (teacher_id, subject_id, grade_level, section_id, title, author, edition, description, material_type, file_url, file_name, file_size, file_type, download_count)
           VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, 'application/pdf', $12)`,
          [
            book.teacherId,
            subjectId,
            book.gradeLevel,
            book.title,
            book.author,
            book.edition,
            book.description,
            book.materialType,
            fileUrl,
            book.fileName,
            fileSize,
            Math.floor(Math.random() * 15) + 3, // Initial realistic downloads
          ]
        );
        console.log(`✓ Seeded: "${book.title}" (${book.materialType})`);
      }
    }

    console.log('✅ Realistic study materials and textbooks successfully seeded!');
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedBooks();
}
