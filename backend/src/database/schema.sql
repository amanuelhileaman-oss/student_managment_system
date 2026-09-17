-- ==============================================================================
-- PRODUCTION HIGH SCHOOL MANAGEMENT SYSTEM SCHEMA (PERN STACK)
-- ==============================================================================

-- Clean start (for initialization)
DROP TABLE IF EXISTS study_materials CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS grade_records CASCADE;
DROP TABLE IF EXISTS assignment_group_members CASCADE;
DROP TABLE IF EXISTS assignment_groups CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS teacher_assignments CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS stream_criteria CASCADE;
DROP TABLE IF EXISTS streams CASCADE;
DROP TABLE IF EXISTS grades CASCADE;
DROP TABLE IF EXISTS academic_years CASCADE;
DROP TABLE IF EXISTS prerequisites CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. USERS & AUTHENTICATION
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'student', 'teacher')),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(50),
    bio TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial Unique Index enforcing EXACTLY ONE Admin account
CREATE UNIQUE INDEX single_admin_idx ON users ((role = 'admin')) WHERE role = 'admin';

-- Trigger function enforcing Single Admin rule at the database level
CREATE OR REPLACE FUNCTION enforce_single_admin()
RETURNS TRIGGER AS $$
DECLARE
    admin_count INT;
BEGIN
    IF NEW.role = 'admin' THEN
        SELECT COUNT(*) INTO admin_count FROM users WHERE role = 'admin' AND id != COALESCE(NEW.id, -1);
        IF admin_count >= 1 THEN
            RAISE EXCEPTION 'A system administrator account already exists. Only exactly one Admin account is permitted.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_single_admin
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION enforce_single_admin();

-- 2. ACADEMIC YEARS
CREATE TABLE academic_years (
    id SERIAL PRIMARY KEY,
    year_name VARCHAR(50) UNIQUE NOT NULL, -- e.g. "2026-2027"
    is_current BOOLEAN DEFAULT FALSE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. GRADES (High School strictly Grades 9, 10, 11, 12. Grade 8 is NOT present)
CREATE TABLE grades (
    id SERIAL PRIMARY KEY,
    level INT UNIQUE NOT NULL CHECK (level IN (9, 10, 11, 12)),
    name VARCHAR(50) NOT NULL
);

-- 4. STREAMS (General, Natural, Social)
CREATE TABLE streams (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL, -- 'GENERAL', 'NATURAL', 'SOCIAL'
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- 5. STREAM CRITERIA (Admin Configurable Rules)
CREATE TABLE stream_criteria (
    id SERIAL PRIMARY KEY,
    stream_id INT NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    target_grade_level INT NOT NULL CHECK (target_grade_level IN (11, 12)),
    min_overall_average NUMERIC(5,2) NOT NULL DEFAULT 70.00,
    required_subjects_config JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SUBJECTS
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    grade_level INT NOT NULL CHECK (grade_level IN (9, 10, 11, 12)),
    stream_id INT REFERENCES streams(id) ON DELETE SET NULL,
    credit_hours INT DEFAULT 3
);

-- 7. SECTIONS
CREATE TABLE sections (
    id SERIAL PRIMARY KEY,
    grade_level INT NOT NULL CHECK (grade_level IN (9, 10, 11, 12)),
    stream_id INT NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    section_name VARCHAR(20) NOT NULL, -- 'A', 'B', 'C', 'D', 'E', ...
    capacity INT NOT NULL DEFAULT 50 CHECK (capacity > 0),
    academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_section_grade_stream_name_year UNIQUE(grade_level, stream_id, section_name, academic_year_id)
);

-- 8. STUDENTS
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(20),
    phone VARCHAR(50),
    address TEXT,
    guardian_name VARCHAR(150),
    guardian_phone VARCHAR(50),
    national_id VARCHAR(50),
    current_grade_level INT CHECK (current_grade_level IN (9, 10, 11, 12)),
    current_stream_id INT REFERENCES streams(id) ON DELETE SET NULL,
    current_section_id INT REFERENCES sections(id) ON DELETE SET NULL,
    prerequisite_verified BOOLEAN DEFAULT FALSE,
    promotion_status VARCHAR(50) DEFAULT 'PENDING',
    grade8_document_name VARCHAR(255),
    grade8_document_data TEXT,
    grade8_document_type VARCHAR(100),
    document_status VARCHAR(50) DEFAULT 'PENDING_ADMIN_VERIFICATION' CHECK (document_status IN ('PENDING_ADMIN_VERIFICATION', 'APPROVED', 'REJECTED')),
    document_submitted_at TIMESTAMPTZ DEFAULT NOW(),
    admin_review_notes TEXT,
    admin_reviewed_at TIMESTAMPTZ,
    admin_reviewer_id INT REFERENCES users(id) ON DELETE SET NULL
);

-- 9. TEACHERS
CREATE TABLE teachers (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_id VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(50),
    qualification VARCHAR(200),
    specialization VARCHAR(200),
    years_of_experience INT DEFAULT 0,
    is_approved BOOLEAN DEFAULT TRUE
);

-- 10. PREREQUISITES (Grade 8 Official Ministry Records)
CREATE TABLE prerequisites (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    previous_school VARCHAR(200) NOT NULL,
    completion_year INT NOT NULL,
    total_score NUMERIC(5,2) NOT NULL,
    average_score NUMERIC(5,2) NOT NULL, -- min 50% required
    status VARCHAR(20) NOT NULL CHECK (status IN ('PASSED', 'FAILED')),
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ENROLLMENTS
CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    grade_level INT NOT NULL CHECK (grade_level IN (9, 10, 11, 12)),
    stream_id INT NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'ENROLLED' CHECK (status IN ('ENROLLED', 'COMPLETED', 'DROPPED')),
    CONSTRAINT uq_student_year_enrollment UNIQUE(student_id, academic_year_id, grade_level)
);

-- 12. TEACHER ASSIGNMENTS
CREATE TABLE teacher_assignments (
    id SERIAL PRIMARY KEY,
    teacher_id INT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    academic_year_id INT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_teacher_assignment UNIQUE(teacher_id, subject_id, section_id, academic_year_id)
);

-- 13. SCHEDULES (Timetable)
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    teacher_assignment_id INT NOT NULL REFERENCES teacher_assignments(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    period_number INT NOT NULL CHECK (period_number BETWEEN 1 AND 8),
    room_number VARCHAR(50),
    CONSTRAINT uq_schedule_section_slot UNIQUE(teacher_assignment_id, day_of_week, period_number)
);

-- Real-World Schedule Conflict Validation Trigger: Prevents teacher double-booking, section double-booking, and room collisions
CREATE OR REPLACE FUNCTION check_schedule_conflicts()
RETURNS TRIGGER AS $$
DECLARE
    v_teacher_id INT;
    v_section_id INT;
    v_teacher_conflict RECORD;
    v_section_conflict RECORD;
    v_room_conflict RECORD;
BEGIN
    SELECT teacher_id, section_id INTO v_teacher_id, v_section_id
    FROM teacher_assignments
    WHERE id = NEW.teacher_assignment_id;

    -- 1. Check teacher conflict: A teacher cannot have more than one section at the same period
    SELECT sch.id, sec.section_name, s.name as subject_name, u.first_name, u.last_name
    INTO v_teacher_conflict
    FROM schedules sch
    JOIN teacher_assignments ta ON sch.teacher_assignment_id = ta.id
    JOIN sections sec ON ta.section_id = sec.id
    JOIN subjects s ON ta.subject_id = s.id
    JOIN teachers t ON ta.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE ta.teacher_id = v_teacher_id
      AND sch.day_of_week = NEW.day_of_week
      AND sch.period_number = NEW.period_number
      AND (TG_OP = 'INSERT' OR sch.id <> NEW.id)
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'TEACHER_CONFLICT: Teacher % % is already scheduled to teach % in Section % on % at Period %.',
            v_teacher_conflict.first_name, v_teacher_conflict.last_name, v_teacher_conflict.subject_name,
            v_teacher_conflict.section_name, NEW.day_of_week, NEW.period_number;
    END IF;

    -- 2. Check section conflict: A section cannot have more than one class at the same period
    SELECT sch.id, s.name as subject_name, u.first_name, u.last_name
    INTO v_section_conflict
    FROM schedules sch
    JOIN teacher_assignments ta ON sch.teacher_assignment_id = ta.id
    JOIN subjects s ON ta.subject_id = s.id
    JOIN teachers t ON ta.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE ta.section_id = v_section_id
      AND sch.day_of_week = NEW.day_of_week
      AND sch.period_number = NEW.period_number
      AND (TG_OP = 'INSERT' OR sch.id <> NEW.id)
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'SECTION_CONFLICT: Section already has % with Teacher % % on % at Period %.',
            v_section_conflict.subject_name, v_section_conflict.first_name, v_section_conflict.last_name,
            NEW.day_of_week, NEW.period_number;
    END IF;

    -- 3. Check room conflict: A classroom/lab cannot be double-booked
    IF NEW.room_number IS NOT NULL AND TRIM(NEW.room_number) <> '' THEN
        SELECT sch.id, sec.section_name, s.name as subject_name
        INTO v_room_conflict
        FROM schedules sch
        JOIN teacher_assignments ta ON sch.teacher_assignment_id = ta.id
        JOIN sections sec ON ta.section_id = sec.id
        JOIN subjects s ON ta.subject_id = s.id
        WHERE LOWER(TRIM(sch.room_number)) = LOWER(TRIM(NEW.room_number))
          AND sch.day_of_week = NEW.day_of_week
          AND sch.period_number = NEW.period_number
          AND (TG_OP = 'INSERT' OR sch.id <> NEW.id)
        LIMIT 1;

        IF FOUND THEN
            RAISE EXCEPTION 'ROOM_CONFLICT: Room % is already booked for % in Section % on % at Period %.',
                NEW.room_number, v_room_conflict.subject_name, v_room_conflict.section_name,
                NEW.day_of_week, NEW.period_number;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_schedule_conflict ON schedules;
CREATE TRIGGER trg_validate_schedule_conflict
BEFORE INSERT OR UPDATE ON schedules
FOR EACH ROW
EXECUTE FUNCTION check_schedule_conflicts();

-- 14. ASSIGNMENTS
CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    teacher_assignment_id INT NOT NULL REFERENCES teacher_assignments(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    assignment_type VARCHAR(20) NOT NULL CHECK (assignment_type IN ('INDIVIDUAL', 'GROUP')),
    max_score NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    due_date TIMESTAMPTZ NOT NULL,
    instructions TEXT,
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    file_size BIGINT DEFAULT 0,
    file_type VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. ASSIGNMENT GROUPS
CREATE TABLE assignment_groups (
    id SERIAL PRIMARY KEY,
    assignment_id INT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    group_code VARCHAR(100) UNIQUE NOT NULL, -- e.g. 'GROUP-MATH9-A-001'
    group_name VARCHAR(150) NOT NULL,
    group_score NUMERIC(5,2) CHECK (group_score >= 0),
    submission_content TEXT,
    submitted_at TIMESTAMPTZ,
    submitted_by INT REFERENCES students(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. ASSIGNMENT GROUP MEMBERS
CREATE TABLE assignment_group_members (
    id SERIAL PRIMARY KEY,
    group_id INT NOT NULL REFERENCES assignment_groups(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    individual_score_override NUMERIC(5,2),
    CONSTRAINT uq_group_member UNIQUE(group_id, student_id)
);

-- 17. GRADE RECORDS (Student Results)
CREATE TABLE grade_records (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    quiz_score NUMERIC(5,2) DEFAULT 0.00 CHECK (quiz_score >= 0 AND quiz_score <= 100),
    midterm_score NUMERIC(5,2) DEFAULT 0.00 CHECK (midterm_score >= 0 AND midterm_score <= 100),
    assignment_score NUMERIC(5,2) DEFAULT 0.00 CHECK (assignment_score >= 0 AND assignment_score <= 100),
    final_score NUMERIC(5,2) DEFAULT 0.00 CHECK (final_score >= 0 AND final_score <= 100),
    total_score NUMERIC(5,2) DEFAULT 0.00 CHECK (total_score >= 0 AND total_score <= 100),
    letter_grade VARCHAR(5),
    remarks TEXT,
    updated_by INT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_student_subject_year_grade UNIQUE(student_id, subject_id, academic_year_id)
);

-- 18. ANNOUNCEMENTS
CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    target_audience VARCHAR(50) NOT NULL CHECK (target_audience IN ('ALL', 'STUDENTS', 'TEACHERS', 'GRADE', 'STREAM', 'SECTION')),
    target_grade_level INT CHECK (target_grade_level IN (9, 10, 11, 12)),
    target_stream_id INT REFERENCES streams(id) ON DELETE SET NULL,
    target_section_id INT REFERENCES sections(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. CONVERSATIONS & MESSAGING
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user1_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_conversation_pair UNIQUE(user1_id, user2_id),
    CONSTRAINT chk_conversation_users CHECK (user1_id < user2_id)
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. NOTIFICATIONS
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'RESULT', 'ENROLLMENT', 'ASSIGNMENT', 'ANNOUNCEMENT', 'MESSAGE', 'SYSTEM', 'DOCUMENT_REVIEW'
    link VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. AUDIT LOGS
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. SYSTEM SETTINGS
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. STUDY MATERIALS & DIGITAL LIBRARY (Textbooks, Reference Books, Notes, Worksheets)
CREATE TABLE study_materials (
    id SERIAL PRIMARY KEY,
    teacher_id INT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    grade_level INT CHECK (grade_level IS NULL OR grade_level IN (9, 10, 11, 12)),
    section_id INT REFERENCES sections(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(150),
    edition VARCHAR(50),
    description TEXT,
    material_type VARCHAR(50) NOT NULL DEFAULT 'TEXTBOOK' 
      CHECK (material_type IN ('TEXTBOOK', 'REFERENCE_BOOK', 'LITERATURE_BOOK', 'EXAM_PREP', 'LECTURE_NOTES', 'WORKSHEET', 'OTHER')),
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT DEFAULT 0,
    file_type VARCHAR(100),
    download_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance & rapid query execution
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_students_current_grade ON students(current_grade_level);
CREATE INDEX idx_teachers_user_id ON teachers(user_id);
CREATE INDEX idx_enrollments_section_id ON enrollments(section_id);
CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_teacher_assignments_teacher ON teacher_assignments(teacher_id);
CREATE INDEX idx_teacher_assignments_section ON teacher_assignments(section_id);
CREATE INDEX idx_schedules_assignment ON schedules(teacher_assignment_id);
CREATE INDEX idx_grade_records_student ON grade_records(student_id);
CREATE INDEX idx_grade_records_section ON grade_records(section_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_materials_grade_level ON study_materials(grade_level);
CREATE INDEX idx_materials_subject_id ON study_materials(subject_id);
CREATE INDEX idx_materials_section_id ON study_materials(section_id);
CREATE INDEX idx_materials_teacher_id ON study_materials(teacher_id);
CREATE INDEX idx_materials_type ON study_materials(material_type);

-- 24. ATTENDANCE (Daily & Period-Level Student Attendance Tracking)
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    subject_id INT NULL REFERENCES subjects(id) ON DELETE SET NULL,
    teacher_id INT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_student_section_subject_date
ON attendance (student_id, section_id, COALESCE(subject_id, -1), date);

CREATE INDEX IF NOT EXISTS idx_attendance_section_date ON attendance(section_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_teacher_id ON attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

