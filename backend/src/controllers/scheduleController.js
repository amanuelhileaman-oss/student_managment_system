const { query, withTransaction } = require('../config/db');
const { logAudit } = require('../services/auditService');

/**
 * Standard High School Period Schedule (Real-world curriculum)
 */
const STANDARD_PERIODS = {
  1: { period_number: 1, start_time: '08:30:00', end_time: '09:15:00', label: 'Period 1 (08:30 - 09:15)' },
  2: { period_number: 2, start_time: '09:20:00', end_time: '10:05:00', label: 'Period 2 (09:20 - 10:05)' },
  3: { period_number: 3, start_time: '10:20:00', end_time: '11:05:00', label: 'Period 3 (10:20 - 11:05)' },
  4: { period_number: 4, start_time: '11:10:00', end_time: '11:55:00', label: 'Period 4 (11:10 - 11:55)' },
  5: { period_number: 5, start_time: '13:00:00', end_time: '13:45:00', label: 'Period 5 (13:00 - 13:45)' },
  6: { period_number: 6, start_time: '13:50:00', end_time: '14:35:00', label: 'Period 6 (13:50 - 14:35)' },
  7: { period_number: 7, start_time: '14:40:00', end_time: '15:25:00', label: 'Period 7 (14:40 - 15:25)' },
};

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/**
 * Dynamically resolve the grade-ordered room number for a section.
 * Ordered strictly by:
 * 1. grade_level ASC (Grade 9 -> Grade 10 -> Grade 11 -> Grade 12)
 * 2. COALESCE(stream_id, 1) ASC (General -> Natural -> Social)
 * 3. section_name ASC (A -> B -> C -> ...)
 * 4. id ASC
 * Produces: Grade 9 Section A = 'Room 01', B = 'Room 02', ..., jumping to Grade 10, 11, 12.
 */
const resolveAutoRoomForSection = async (sectionId) => {
  if (!sectionId) return 'Room 01';
  try {
    const res = await query(
      `WITH ordered_sections AS (
         SELECT id,
                ROW_NUMBER() OVER (
                  ORDER BY grade_level ASC,
                           COALESCE(stream_id, 1) ASC,
                           section_name ASC,
                           id ASC
                ) as row_num
         FROM sections
         WHERE is_active = TRUE AND section_name NOT LIKE 'T-%'
       )
       SELECT 'Room ' || LPAD(row_num::text, 2, '0') as auto_room
       FROM ordered_sections
       WHERE id = $1`,
      [sectionId]
    );
    if (res.rows.length > 0 && res.rows[0].auto_room) {
      return res.rows[0].auto_room;
    }
  } catch (err) {
    console.error('Error resolving auto room for section:', err.message);
  }
  return 'Room 01';
};

/**
 * Re-sequence and synchronize all schedule room numbers across the entire database
 * when sections are added, updated, or removed.
 */
const syncScheduleRoomNumbers = async () => {
  try {
    // 1. Temporarily clear room numbers to avoid transient uniqueness collision trigger
    await query('UPDATE schedules SET room_number = NULL');

    // 2. Set all schedules to the current dynamic room number of their section
    await query(`
      WITH ordered_sections AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 ORDER BY grade_level ASC, 
                          COALESCE(stream_id, 1) ASC, 
                          section_name ASC, 
                          id ASC
               ) as row_num
        FROM sections
        WHERE is_active = TRUE AND section_name NOT LIKE 'T-%'
      )
      UPDATE schedules sch
      SET room_number = 'Room ' || LPAD(os.row_num::text, 2, '0')
      FROM teacher_assignments ta
      JOIN ordered_sections os ON ta.section_id = os.id
      WHERE sch.teacher_assignment_id = ta.id
    `);
    console.log('[ScheduleController] Successfully synced schedule room numbers.');
  } catch (err) {
    console.error('Error syncing schedule room numbers:', err.message);
  }
};

/**
 * Check schedule conflict helper
 * Supports resolution from existing teacherAssignmentId OR direct teacherId/sectionId/subjectId
 */
const checkConflict = async ({
  teacherAssignmentId = null,
  teacherId = null,
  sectionId = null,
  subjectId = null,
  dayOfWeek,
  periodNumber,
  roomNumber = null,
  excludeId = null,
}) => {
  let ta = null;

  // 1. Resolve teacher_id and section_id
  if (teacherAssignmentId) {
    const taRes = await query(
      `SELECT ta.id, ta.teacher_id, ta.section_id, ta.subject_id,
              u.first_name, u.last_name,
              sub.name as subject_name,
              sec.section_name, sec.grade_level
       FROM teacher_assignments ta
       JOIN teachers t ON ta.teacher_id = t.id
       JOIN users u ON t.user_id = u.id
       JOIN subjects sub ON ta.subject_id = sub.id
       JOIN sections sec ON ta.section_id = sec.id
       WHERE ta.id = $1`,
      [teacherAssignmentId]
    );

    if (taRes.rows.length === 0) {
      return { hasConflict: true, type: 'NOT_FOUND', message: 'Teacher assignment not found.' };
    }
    ta = taRes.rows[0];
  } else if (teacherId && sectionId) {
    let tRes = await query(
      `SELECT t.id as teacher_id, u.first_name, u.last_name, t.specialization
       FROM teachers t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = $1`,
      [teacherId]
    );
    if (tRes.rows.length === 0) {
      tRes = await query(
        `SELECT t.id as teacher_id, u.first_name, u.last_name, t.specialization
         FROM teachers t
         JOIN users u ON t.user_id = u.id
         WHERE t.user_id = $1`,
        [teacherId]
      );
    }
    const secRes = await query(
      `SELECT sec.id as section_id, sec.section_name, sec.grade_level
       FROM sections sec
       WHERE sec.id = $1`,
      [sectionId]
    );

    if (tRes.rows.length === 0 || secRes.rows.length === 0) {
      return { hasConflict: true, type: 'NOT_FOUND', message: 'Teacher or Section record not found.' };
    }

    let subName = 'Assigned Course';
    if (subjectId) {
      const subRes = await query('SELECT name FROM subjects WHERE id = $1', [subjectId]);
      if (subRes.rows.length > 0) subName = subRes.rows[0].name;
    }

    ta = {
      teacher_id: tRes.rows[0].teacher_id,
      section_id: secRes.rows[0].section_id,
      subject_id: subjectId ? parseInt(subjectId, 10) : null,
      first_name: tRes.rows[0].first_name,
      last_name: tRes.rows[0].last_name,
      subject_name: subName,
      section_name: secRes.rows[0].section_name,
      grade_level: secRes.rows[0].grade_level,
    };
  } else {
    return { hasConflict: true, type: 'BAD_REQUEST', message: 'Please provide teacherAssignmentId or teacherId and sectionId.' };
  }

  // 2. Check Teacher Conflict: Does this teacher already have another section scheduled at this day and period?
  const teacherConflictQuery = `
    SELECT sch.id, sch.day_of_week, sch.period_number,
           sec.section_name, sec.grade_level,
           sub.name as subject_name,
           u.first_name, u.last_name
    FROM schedules sch
    JOIN teacher_assignments other_ta ON sch.teacher_assignment_id = other_ta.id
    JOIN sections sec ON other_ta.section_id = sec.id
    JOIN subjects sub ON other_ta.subject_id = sub.id
    JOIN teachers t ON other_ta.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE other_ta.teacher_id = $1
      AND sch.day_of_week = $2
      AND sch.period_number = $3
      ${excludeId ? 'AND sch.id <> $4' : ''}
    LIMIT 1
  `;
  const teacherParams = excludeId
    ? [ta.teacher_id, dayOfWeek, periodNumber, excludeId]
    : [ta.teacher_id, dayOfWeek, periodNumber];

  const teacherConfRes = await query(teacherConflictQuery, teacherParams);
  if (teacherConfRes.rows.length > 0) {
    const c = teacherConfRes.rows[0];
    return {
      hasConflict: true,
      type: 'TEACHER_CONFLICT',
      message: `Teacher Conflict: ${c.first_name} ${c.last_name} is already scheduled to teach ${c.subject_name} in Grade ${c.grade_level} Section ${c.section_name} on ${dayOfWeek} at Period ${periodNumber}. A teacher cannot teach more than one section at the same period.`,
      conflictData: c,
    };
  }

  // 3. Check Section Conflict: Does this section already have another class scheduled at this day and period?
  const sectionConflictQuery = `
    SELECT sch.id, sch.day_of_week, sch.period_number,
           sub.name as subject_name,
           u.first_name, u.last_name,
           sec.section_name, sec.grade_level
    FROM schedules sch
    JOIN teacher_assignments other_ta ON sch.teacher_assignment_id = other_ta.id
    JOIN sections sec ON other_ta.section_id = sec.id
    JOIN subjects sub ON other_ta.subject_id = sub.id
    JOIN teachers t ON other_ta.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE other_ta.section_id = $1
      AND sch.day_of_week = $2
      AND sch.period_number = $3
      ${excludeId ? 'AND sch.id <> $4' : ''}
    LIMIT 1
  `;
  const sectionParams = excludeId
    ? [ta.section_id, dayOfWeek, periodNumber, excludeId]
    : [ta.section_id, dayOfWeek, periodNumber];

  const sectionConfRes = await query(sectionConflictQuery, sectionParams);
  if (sectionConfRes.rows.length > 0) {
    const c = sectionConfRes.rows[0];
    return {
      hasConflict: true,
      type: 'SECTION_CONFLICT',
      message: `Section Conflict: Grade ${c.grade_level} Section ${c.section_name} already has ${c.subject_name} with teacher ${c.first_name} ${c.last_name} on ${dayOfWeek} at Period ${periodNumber}. A section cannot have more than one class at the same period.`,
      conflictData: c,
    };
  }

  // 4. Check Room Conflict (if room provided)
  if (roomNumber && roomNumber.trim()) {
    const roomConflictQuery = `
      SELECT sch.id, sch.day_of_week, sch.period_number, sch.room_number,
             sec.section_name, sec.grade_level,
             sub.name as subject_name
      FROM schedules sch
      JOIN teacher_assignments other_ta ON sch.teacher_assignment_id = other_ta.id
      JOIN sections sec ON other_ta.section_id = sec.id
      JOIN subjects sub ON other_ta.subject_id = sub.id
      WHERE LOWER(TRIM(sch.room_number)) = LOWER(TRIM($1))
        AND sch.day_of_week = $2
        AND sch.period_number = $3
        ${excludeId ? 'AND sch.id <> $4' : ''}
      LIMIT 1
    `;
    const roomParams = excludeId
      ? [roomNumber.trim(), dayOfWeek, periodNumber, excludeId]
      : [roomNumber.trim(), dayOfWeek, periodNumber];

    const roomConfRes = await query(roomConflictQuery, roomParams);
    if (roomConfRes.rows.length > 0) {
      const c = roomConfRes.rows[0];
      return {
        hasConflict: true,
        type: 'ROOM_CONFLICT',
        message: `Room Conflict: ${roomNumber.trim()} is already occupied by Grade ${c.grade_level} Section ${c.section_name} (${c.subject_name}) on ${dayOfWeek} at Period ${periodNumber}.`,
        conflictData: c,
      };
    }
  }

  return { hasConflict: false, targetAssignment: ta };
};

/**
 * GET /api/admin/schedules
 * Fetch master schedules with optional filters (sectionId, teacherId, gradeLevel)
 */
const getSchedules = async (req, res, next) => {
  try {
    const { sectionId, teacherId, gradeLevel, dayOfWeek } = req.query;

    let sql = `
      WITH ordered_sections AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 ORDER BY grade_level ASC, 
                          COALESCE(stream_id, 1) ASC, 
                          section_name ASC, 
                          id ASC
               ) as row_num
        FROM sections
        WHERE is_active = TRUE AND section_name NOT LIKE 'T-%'
      )
      SELECT sch.id, sch.day_of_week, sch.start_time, sch.end_time, sch.period_number,
             COALESCE('Room ' || LPAD(os.row_num::text, 2, '0'), sch.room_number) as room_number,
             ta.id as teacher_assignment_id, ta.teacher_id, ta.subject_id, ta.section_id, ta.academic_year_id,
             u.first_name, u.last_name,
             u.first_name as teacher_first_name, u.last_name as teacher_last_name, u.email as teacher_email,
             t.teacher_id as teacher_code, t.user_id as teacher_user_id,
             s.name as subject_name, s.code as subject_code, s.grade_level as subject_grade_level,
             sec.section_name, sec.grade_level,
             st.name as stream_name,
             ay.year_name
      FROM schedules sch
      JOIN teacher_assignments ta ON sch.teacher_assignment_id = ta.id
      JOIN teachers t ON ta.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      JOIN subjects s ON ta.subject_id = s.id
      JOIN sections sec ON ta.section_id = sec.id
      LEFT JOIN ordered_sections os ON os.id = sec.id
      LEFT JOIN streams st ON sec.stream_id = st.id
      JOIN academic_years ay ON ta.academic_year_id = ay.id
      WHERE 1=1
    `;
    const params = [];

    if (sectionId) {
      params.push(parseInt(sectionId, 10));
      sql += ` AND ta.section_id = $${params.length}`;
    }
    if (teacherId) {
      params.push(parseInt(teacherId, 10));
      sql += ` AND (ta.teacher_id = $${params.length} OR t.user_id = $${params.length})`;
    }
    if (gradeLevel) {
      params.push(parseInt(gradeLevel, 10));
      sql += ` AND sec.grade_level = $${params.length}`;
    }
    if (dayOfWeek) {
      params.push(dayOfWeek);
      sql += ` AND sch.day_of_week = $${params.length}`;
    }

    sql += `
      ORDER BY
        sec.grade_level ASC,
        sec.section_name ASC,
        CASE sch.day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
        END,
        sch.period_number ASC
    `;

    const result = await query(sql, params);

    res.json({
      success: true,
      count: result.rows.length,
      standardPeriods: Object.values(STANDARD_PERIODS),
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/schedules/standard-periods
 */
const getStandardPeriods = async (req, res) => {
  res.json({
    success: true,
    data: Object.values(STANDARD_PERIODS),
    days: DAYS_OF_WEEK,
  });
};

/**
 * POST /api/admin/schedules/validate
 * Real-time pre-flight conflict checker for frontend UI
 * Supports checking by teacherAssignmentId OR direct teacherId/sectionId/subjectId
 */
const validateSlot = async (req, res, next) => {
  try {
    const { teacherAssignmentId, teacherId, sectionId, subjectId, dayOfWeek, periodNumber, roomNumber, excludeId } = req.body;

    if ((!teacherAssignmentId && (!teacherId || !sectionId)) || !dayOfWeek || !periodNumber) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Assignment (or Teacher + Section), dayOfWeek, and periodNumber are required.',
      });
    }

    const check = await checkConflict({
      teacherAssignmentId: teacherAssignmentId ? parseInt(teacherAssignmentId, 10) : null,
      teacherId: teacherId ? parseInt(teacherId, 10) : null,
      sectionId: sectionId ? parseInt(sectionId, 10) : null,
      subjectId: subjectId ? parseInt(subjectId, 10) : null,
      dayOfWeek,
      periodNumber: parseInt(periodNumber, 10),
      roomNumber,
      excludeId: excludeId ? parseInt(excludeId, 10) : null,
    });

    if (check.hasConflict) {
      return res.json({
        success: true,
        valid: false,
        type: check.type,
        message: check.message,
        conflictData: check.conflictData,
      });
    }

    res.json({
      success: true,
      valid: true,
      message: 'Time slot is completely available without any teacher, section, or room conflicts.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/schedules
 * Add a new schedule slot with strict conflict validation
 * Supports existing teacherAssignmentId OR cascading { teacherId, subjectId, sectionId }
 */
const createScheduleSlot = async (req, res, next) => {
  try {
    const {
      teacherAssignmentId,
      teacherId,
      subjectId,
      sectionId,
      dayOfWeek,
      periodNumber,
      startTime,
      endTime,
      roomNumber,
    } = req.body;

    if (!dayOfWeek || !periodNumber) {
      return res.status(400).json({
        success: false,
        message: 'dayOfWeek and periodNumber are required.',
      });
    }

    let resolvedTaId = teacherAssignmentId ? parseInt(teacherAssignmentId, 10) : null;

    // If teacherAssignmentId is not provided, resolve or create it from teacherId, subjectId, sectionId
    if (!resolvedTaId) {
      if (!teacherId || !subjectId || !sectionId) {
        return res.status(400).json({
          success: false,
          message: 'Please provide teacherAssignmentId OR teacherId, subjectId, and sectionId.',
        });
      }

      // 1. Resolve teacher record ID (check teachers.id first to avoid collision with users.id)
      let tCheck = await query(
        `SELECT id, specialization FROM teachers WHERE id = $1 LIMIT 1`,
        [teacherId]
      );
      if (tCheck.rows.length === 0) {
        tCheck = await query(
          `SELECT id, specialization FROM teachers WHERE user_id = $1 LIMIT 1`,
          [teacherId]
        );
      }
      if (tCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Teacher record not found in faculty registry.' });
      }
      const resolvedTeacherId = tCheck.rows[0].id;

      // 2. Resolve current academic year
      const yRes = await query('SELECT id FROM academic_years WHERE is_current = TRUE LIMIT 1');
      const yearId = yRes.rows.length > 0 ? yRes.rows[0].id : 1;

      // 3. Find or auto-create teacher assignment
      let taRecord = await query(
        `SELECT id FROM teacher_assignments 
         WHERE teacher_id = $1 AND subject_id = $2 AND section_id = $3 AND academic_year_id = $4`,
        [resolvedTeacherId, parseInt(subjectId, 10), parseInt(sectionId, 10), yearId]
      );

      if (taRecord.rows.length === 0) {
        const insTa = await query(
          `INSERT INTO teacher_assignments (teacher_id, subject_id, section_id, academic_year_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (teacher_id, subject_id, section_id, academic_year_id) 
           DO UPDATE SET assigned_at = NOW()
           RETURNING id`,
          [resolvedTeacherId, parseInt(subjectId, 10), parseInt(sectionId, 10), yearId]
        );
        resolvedTaId = insTa.rows[0].id;
      } else {
        resolvedTaId = taRecord.rows[0].id;
        await query('UPDATE teacher_assignments SET assigned_at = NOW() WHERE id = $1', [resolvedTaId]);
      }
    }

    const pNum = parseInt(periodNumber, 10);
    const stdPeriod = STANDARD_PERIODS[pNum];
    const finalStartTime = startTime || (stdPeriod ? stdPeriod.start_time : '08:30:00');
    const finalEndTime = endTime || (stdPeriod ? stdPeriod.end_time : '09:15:00');

    // Auto-generate standard classroom number for the section based on dynamic grade ordering
    let finalRoomNumber = roomNumber ? roomNumber.trim() : null;
    const secInfo = await query(
      `SELECT sec.id, sec.section_name, sec.grade_level, sec.stream_id
       FROM teacher_assignments ta
       JOIN sections sec ON ta.section_id = sec.id
       WHERE ta.id = $1`,
      [resolvedTaId]
    );
    const targetSecId = secInfo.rows.length > 0 ? secInfo.rows[0].id : null;
    if (!finalRoomNumber || finalRoomNumber.startsWith('Room ')) {
      finalRoomNumber = await resolveAutoRoomForSection(targetSecId);
    }

    // 1. Strict Conflict Verification
    const conflictCheck = await checkConflict({
      teacherAssignmentId: resolvedTaId,
      dayOfWeek,
      periodNumber: pNum,
      roomNumber: finalRoomNumber,
    });

    if (conflictCheck.hasConflict) {
      return res.status(400).json({
        success: false,
        conflictType: conflictCheck.type,
        message: conflictCheck.message,
        conflictData: conflictCheck.conflictData,
      });
    }

    // 2. Insert into schedules
    const insRes = await query(
      `INSERT INTO schedules (teacher_assignment_id, day_of_week, start_time, end_time, period_number, room_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        resolvedTaId,
        dayOfWeek,
        finalStartTime,
        finalEndTime,
        pNum,
        finalRoomNumber,
      ]
    );

    const newSlot = insRes.rows[0];

    await logAudit({
      userId: req.user.id,
      action: 'SCHEDULE_SLOT_CREATED',
      entityType: 'SCHEDULE',
      entityId: newSlot.id,
      details: {
        teacherAssignmentId: resolvedTaId,
        dayOfWeek,
        periodNumber: pNum,
        roomNumber,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Schedule slot created successfully and published to timetable.',
      data: newSlot,
    });
  } catch (error) {
    if (error.message && error.message.includes('TEACHER_CONFLICT')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message && error.message.includes('SECTION_CONFLICT')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * DELETE /api/admin/schedules/all
 * Reset / delete all schedules created across the school
 */
const deleteAllSchedules = async (req, res, next) => {
  try {
    const delRes = await query('DELETE FROM schedules RETURNING id');

    await logAudit({
      userId: req.user.id,
      action: 'ALL_SCHEDULES_DELETED',
      entityType: 'SCHEDULE',
      entityId: 'ALL',
      details: { deletedCount: delRes.rowCount },
    });

    res.json({
      success: true,
      message: `All ${delRes.rowCount} schedule periods have been cleared from the system.`,
      deletedCount: delRes.rowCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/schedules/section/:sectionId
 * Clear all schedule slots for a specific section
 */
const deleteSectionSchedules = async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const secId = parseInt(sectionId, 10);

    const delRes = await query(
      `DELETE FROM schedules
       WHERE teacher_assignment_id IN (
         SELECT id FROM teacher_assignments WHERE section_id = $1
       )
       RETURNING id`,
      [secId]
    );

    await logAudit({
      userId: req.user.id,
      action: 'SECTION_SCHEDULES_DELETED',
      entityType: 'SECTION',
      entityId: String(secId),
      details: { sectionId: secId, deletedCount: delRes.rowCount },
    });

    res.json({
      success: true,
      message: `Cleared ${delRes.rowCount} schedule period(s) for this section.`,
      deletedCount: delRes.rowCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/schedules/:id
 * Update an existing schedule slot
 */
const updateScheduleSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      teacherAssignmentId,
      teacherId,
      subjectId,
      sectionId,
      dayOfWeek,
      periodNumber,
      startTime,
      endTime,
      roomNumber,
    } = req.body;

    const existingRes = await query('SELECT * FROM schedules WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Schedule slot not found.' });
    }

    const curr = existingRes.rows[0];
    let taId = teacherAssignmentId ? parseInt(teacherAssignmentId, 10) : null;

    if (!taId && (teacherId || subjectId || sectionId)) {
      const currTaRes = await query(
        'SELECT teacher_id, subject_id, section_id, academic_year_id FROM teacher_assignments WHERE id = $1',
        [curr.teacher_assignment_id]
      );
      const currTa = currTaRes.rows[0] || {};

      let targetTeacherId = currTa.teacher_id;
      if (teacherId) {
        let tCheck = await query(
          `SELECT id FROM teachers WHERE id = $1 LIMIT 1`,
          [teacherId]
        );
        if (tCheck.rows.length === 0) {
          tCheck = await query(
            `SELECT id FROM teachers WHERE user_id = $1 LIMIT 1`,
            [teacherId]
          );
        }
        if (tCheck.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Teacher record not found in faculty registry.' });
        }
        targetTeacherId = tCheck.rows[0].id;
      }

      const targetSubjectId = subjectId ? parseInt(subjectId, 10) : currTa.subject_id;
      const targetSectionId = sectionId ? parseInt(sectionId, 10) : currTa.section_id;
      const targetYearId = currTa.academic_year_id || 1;

      // Find or auto-create teacher assignment for the selected teacher, subject, and section
      const taRecord = await query(
        `SELECT id FROM teacher_assignments 
         WHERE teacher_id = $1 AND subject_id = $2 AND section_id = $3 AND academic_year_id = $4`,
        [targetTeacherId, targetSubjectId, targetSectionId, targetYearId]
      );

      if (taRecord.rows.length === 0) {
        const insTa = await query(
          `INSERT INTO teacher_assignments (teacher_id, subject_id, section_id, academic_year_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (teacher_id, subject_id, section_id, academic_year_id) 
           DO UPDATE SET assigned_at = NOW()
           RETURNING id`,
          [targetTeacherId, targetSubjectId, targetSectionId, targetYearId]
        );
        taId = insTa.rows[0].id;
      } else {
        taId = taRecord.rows[0].id;
        await query('UPDATE teacher_assignments SET assigned_at = NOW() WHERE id = $1', [taId]);
      }
    }

    if (!taId) {
      taId = curr.teacher_assignment_id;
    }
    const targetDay = dayOfWeek || curr.day_of_week;
    const targetPeriod = periodNumber ? parseInt(periodNumber, 10) : curr.period_number;
    let targetRoom = roomNumber !== undefined ? (roomNumber ? roomNumber.trim() : null) : curr.room_number;
    const secInfo = await query(
      `SELECT sec.id, sec.section_name, sec.grade_level, sec.stream_id
       FROM teacher_assignments ta
       JOIN sections sec ON ta.section_id = sec.id
       WHERE ta.id = $1`,
      [taId]
    );
    const targetSecId = secInfo.rows.length > 0 ? secInfo.rows[0].id : null;
    if (!targetRoom || targetRoom.startsWith('Room ')) {
      targetRoom = await resolveAutoRoomForSection(targetSecId);
    }

    const stdPeriod = STANDARD_PERIODS[targetPeriod];
    const finalStart = startTime || (stdPeriod ? stdPeriod.start_time : curr.start_time);
    const finalEnd = endTime || (stdPeriod ? stdPeriod.end_time : curr.end_time);

    // Conflict check excluding this slot
    const conflictCheck = await checkConflict({
      teacherAssignmentId: taId,
      dayOfWeek: targetDay,
      periodNumber: targetPeriod,
      roomNumber: targetRoom,
      excludeId: curr.id,
    });

    if (conflictCheck.hasConflict) {
      return res.status(400).json({
        success: false,
        conflictType: conflictCheck.type,
        message: conflictCheck.message,
        conflictData: conflictCheck.conflictData,
      });
    }

    const updRes = await query(
      `UPDATE schedules
       SET teacher_assignment_id = $1,
           day_of_week = $2,
           start_time = $3,
           end_time = $4,
           period_number = $5,
           room_number = $6
       WHERE id = $7
       RETURNING *`,
      [taId, targetDay, finalStart, finalEnd, targetPeriod, targetRoom, curr.id]
    );

    await logAudit({
      userId: req.user.id,
      action: 'SCHEDULE_SLOT_UPDATED',
      entityType: 'SCHEDULE',
      entityId: curr.id,
      details: {
        teacherAssignmentId: taId,
        dayOfWeek: targetDay,
        periodNumber: targetPeriod,
        roomNumber: targetRoom,
      },
    });

    res.json({
      success: true,
      message: 'Schedule slot updated successfully.',
      data: updRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/schedules/:id
 * Remove a schedule slot
 */
const deleteScheduleSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const delRes = await query('DELETE FROM schedules WHERE id = $1 RETURNING *', [id]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Schedule slot not found.' });
    }

    await logAudit({
      userId: req.user.id,
      action: 'SCHEDULE_SLOT_DELETED',
      entityType: 'SCHEDULE',
      entityId: id,
      details: delRes.rows[0],
    });

    res.json({ success: true, message: 'Schedule slot removed successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/schedules/generate-section
 * Automatically generates a balanced, conflict-free 5-day timetable for a section
 */
const generateSectionSchedule = async (req, res, next) => {
  try {
    const { sectionId, clearExisting = false, defaultRoom = null } = req.body;

    if (!sectionId) {
      return res.status(400).json({ success: false, message: 'sectionId is required.' });
    }

    // 1. Verify section
    const secRes = await query('SELECT * FROM sections WHERE id = $1', [sectionId]);
    if (secRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }
    const section = secRes.rows[0];

    // 2. Fetch all teacher assignments for this section
    const assignmentsRes = await query(
      `SELECT ta.id as teacher_assignment_id, ta.teacher_id, ta.subject_id,
              s.name as subject_name, s.credit_hours,
              u.first_name as teacher_first_name, u.last_name as teacher_last_name
       FROM teacher_assignments ta
       JOIN subjects s ON ta.subject_id = s.id
       JOIN teachers t ON ta.teacher_id = t.id
       JOIN users u ON t.user_id = u.id
       WHERE ta.section_id = $1
       ORDER BY s.id ASC`,
      [sectionId]
    );

    if (assignmentsRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Section ${section.section_name} has no assigned teachers or subjects. Please assign teachers to this section first.`,
      });
    }

    const assignments = assignmentsRes.rows;

    // Auto-resolve dynamic grade-ordered room
    const room = defaultRoom ? defaultRoom.trim() : await resolveAutoRoomForSection(sectionId);

    const createdSlots = await withTransaction(async (client) => {
      // If requested, clear existing slots for this section
      if (clearExisting) {
        await client.query(
          `DELETE FROM schedules
           WHERE teacher_assignment_id IN (SELECT id FROM teacher_assignments WHERE section_id = $1)`,
          [sectionId]
        );
      }

      // Fetch all busy slots across the school for the teachers assigned to this section
      const teacherIds = assignments.map((a) => a.teacher_id);
      const busyRes = await client.query(
        `SELECT other_ta.teacher_id, sch.day_of_week, sch.period_number
         FROM schedules sch
         JOIN teacher_assignments other_ta ON sch.teacher_assignment_id = other_ta.id
         WHERE other_ta.teacher_id = ANY($1::int[])`,
        [teacherIds]
      );

      // Build a lookup map of teacher conflicts: `${teacher_id}_${day}_${period}`
      const teacherBusy = new Set(
        busyRes.rows.map((b) => `${b.teacher_id}_${b.day_of_week}_${b.period_number}`)
      );

      // Fetch occupied slots for this section itself
      const sectionBusyRes = await client.query(
        `SELECT sch.day_of_week, sch.period_number
         FROM schedules sch
         JOIN teacher_assignments ta ON sch.teacher_assignment_id = ta.id
         WHERE ta.section_id = $1`,
        [sectionId]
      );
      const sectionBusy = new Set(
        sectionBusyRes.rows.map((b) => `${b.day_of_week}_${b.period_number}`)
      );

      // Target periods per week: 5 days x 7 periods = 35 total slots
      // Distribute assignments evenly across the week
      // e.g. 8 subjects -> 4 or 5 periods each
      const slotsToSchedule = [];
      let assignmentIndex = 0;

      for (const day of DAYS_OF_WEEK) {
        for (let period = 1; period <= 7; period++) {
          const sectionSlotKey = `${day}_${period}`;
          if (sectionBusy.has(sectionSlotKey)) {
            continue; // Already occupied
          }

          // Try to find an assignment whose teacher is not busy at this day & period
          let candidate = null;
          for (let attempt = 0; attempt < assignments.length; attempt++) {
            const idx = (assignmentIndex + attempt) % assignments.length;
            const a = assignments[idx];
            const teacherSlotKey = `${a.teacher_id}_${day}_${period}`;

            if (!teacherBusy.has(teacherSlotKey)) {
              candidate = a;
              assignmentIndex = (idx + 1) % assignments.length;
              break;
            }
          }

          if (candidate) {
            const stdPeriod = STANDARD_PERIODS[period];
            const teacherSlotKey = `${candidate.teacher_id}_${day}_${period}`;

            // Mark busy
            teacherBusy.add(teacherSlotKey);
            sectionBusy.add(sectionSlotKey);

            slotsToSchedule.push({
              teacher_assignment_id: candidate.teacher_assignment_id,
              day_of_week: day,
              start_time: stdPeriod.start_time,
              end_time: stdPeriod.end_time,
              period_number: period,
              room_number: room,
              subject_name: candidate.subject_name,
              teacher_name: `${candidate.teacher_first_name} ${candidate.teacher_last_name}`,
            });
          }
        }
      }

      if (slotsToSchedule.length === 0) {
        throw new Error('No available conflict-free slots found for this section with currently assigned teachers.');
      }

      // Bulk insert the conflict-free slots
      const inserted = [];
      for (const slot of slotsToSchedule) {
        const ins = await client.query(
          `INSERT INTO schedules (teacher_assignment_id, day_of_week, start_time, end_time, period_number, room_number)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            slot.teacher_assignment_id,
            slot.day_of_week,
            slot.start_time,
            slot.end_time,
            slot.period_number,
            slot.room_number,
          ]
        );
        inserted.push({ ...ins.rows[0], subject_name: slot.subject_name, teacher_name: slot.teacher_name });
      }

      return inserted;
    });

    await logAudit({
      userId: req.user.id,
      action: 'SMOOTH_SECTION_SCHEDULE_GENERATED',
      entityType: 'SECTION',
      entityId: sectionId,
      details: {
        sectionId,
        slotsGenerated: createdSlots.length,
        room,
      },
    });

    res.status(201).json({
      success: true,
      message: `Smooth schedule successfully generated! ${createdSlots.length} conflict-free class periods have been scheduled and delivered to Grade ${section.grade_level} Section ${section.section_name}.`,
      count: createdSlots.length,
      data: createdSlots,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/schedules/conflicts
 * Audit check across the entire school to verify 0 teacher and 0 section collisions
 */
const getScheduleAudit = async (req, res, next) => {
  try {
    // 1. Check for any duplicate teacher slots (same teacher, day, period in different schedules)
    const teacherCollisions = await query(`
      SELECT sch1.id as slot1_id, sch2.id as slot2_id,
             sch1.day_of_week, sch1.period_number,
             u.first_name, u.last_name,
             sec1.section_name as section1, sec2.section_name as section2,
             sub1.name as subject1, sub2.name as subject2
      FROM schedules sch1
      JOIN teacher_assignments ta1 ON sch1.teacher_assignment_id = ta1.id
      JOIN teachers t ON ta1.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      JOIN sections sec1 ON ta1.section_id = sec1.id
      JOIN subjects sub1 ON ta1.subject_id = sub1.id
      JOIN schedules sch2 ON sch1.id < sch2.id
                         AND sch1.day_of_week = sch2.day_of_week
                         AND sch1.period_number = sch2.period_number
      JOIN teacher_assignments ta2 ON sch2.teacher_assignment_id = ta2.id AND ta1.teacher_id = ta2.teacher_id
      JOIN sections sec2 ON ta2.section_id = sec2.id
      JOIN subjects sub2 ON ta2.subject_id = sub2.id
    `);

    // 2. Check for duplicate section slots (same section, day, period with different teachers/subjects)
    const sectionCollisions = await query(`
      SELECT sch1.id as slot1_id, sch2.id as slot2_id,
             sch1.day_of_week, sch1.period_number,
             sec.section_name, sec.grade_level,
             sub1.name as subject1, sub2.name as subject2,
             u1.first_name as teacher1_first, u1.last_name as teacher1_last,
             u2.first_name as teacher2_first, u2.last_name as teacher2_last
      FROM schedules sch1
      JOIN teacher_assignments ta1 ON sch1.teacher_assignment_id = ta1.id
      JOIN sections sec ON ta1.section_id = sec.id
      JOIN subjects sub1 ON ta1.subject_id = sub1.id
      JOIN teachers t1 ON ta1.teacher_id = t1.id
      JOIN users u1 ON t1.user_id = u1.id
      JOIN schedules sch2 ON sch1.id < sch2.id
                         AND sch1.day_of_week = sch2.day_of_week
                         AND sch1.period_number = sch2.period_number
      JOIN teacher_assignments ta2 ON sch2.teacher_assignment_id = ta2.id AND ta1.section_id = ta2.section_id
      JOIN subjects sub2 ON ta2.subject_id = sub2.id
      JOIN teachers t2 ON ta2.teacher_id = t2.id
      JOIN users u2 ON t2.user_id = u2.id
    `);

    const totalSlotsRes = await query('SELECT COUNT(*) FROM schedules');

    res.json({
      success: true,
      totalSlots: parseInt(totalSlotsRes.rows[0].count, 10),
      isConflictFree: teacherCollisions.rows.length === 0 && sectionCollisions.rows.length === 0,
      teacherConflictsCount: teacherCollisions.rows.length,
      teacherConflicts: teacherCollisions.rows,
      sectionConflictsCount: sectionCollisions.rows.length,
      sectionConflicts: sectionCollisions.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/schedules/generate-master
 * Automatically generates conflict-free schedules for ALL sections across ALL grades (or a specific grade)
 */
const generateMasterSchedule = async (req, res, next) => {
  try {
    const { gradeLevel = null, clearExisting = true } = req.body;

    // 1. Fetch sections to schedule
    let sectionQuery = `
      SELECT id, grade_level, section_name, stream_id
      FROM sections
      WHERE section_name IN ('A', 'B', 'C', 'D')
    `;
    const sectionParams = [];
    if (gradeLevel) {
      sectionParams.push(parseInt(gradeLevel, 10));
      sectionQuery += ` AND grade_level = $1`;
    }
    sectionQuery += ` ORDER BY grade_level ASC, section_name ASC`;

    const secRes = await query(sectionQuery, sectionParams);
    const sections = secRes.rows;

    if (sections.length === 0) {
      return res.status(400).json({ success: false, message: 'No standard sections found to schedule.' });
    }

    const sectionIds = sections.map((s) => s.id);

    // 2. Clear existing schedules if requested
    if (clearExisting) {
      await query(
        `DELETE FROM schedules
         WHERE teacher_assignment_id IN (SELECT id FROM teacher_assignments WHERE section_id = ANY($1::int[]))`,
        [sectionIds]
      );
    }

    // 3. Track busy slots across the school
    const busyRes = await query(`
      SELECT other_ta.teacher_id, sch.day_of_week, sch.period_number, sch.room_number
      FROM schedules sch
      JOIN teacher_assignments other_ta ON sch.teacher_assignment_id = other_ta.id
    `);

    const teacherBusy = new Set(
      busyRes.rows.map((b) => `${b.teacher_id}_${b.day_of_week}_${b.period_number}`)
    );
    const sectionBusy = new Set();
    const roomBusy = new Set(
      busyRes.rows.filter((b) => b.room_number).map((b) => `${b.room_number.toLowerCase().trim()}_${b.day_of_week}_${b.period_number}`)
    );

    const allSlotsToInsert = [];
    const sectionSummaries = [];

    for (const sec of sections) {
      const room = await resolveAutoRoomForSection(sec.id);
      const taRes = await query(
        `SELECT ta.id as teacher_assignment_id, ta.teacher_id, ta.subject_id, s.name as subject_name
         FROM teacher_assignments ta
         JOIN subjects s ON ta.subject_id = s.id
         WHERE ta.section_id = $1
         ORDER BY s.id ASC`,
        [sec.id]
      );

      const assignments = taRes.rows;
      if (assignments.length === 0) continue;

      let sectionSlotsCount = 0;
      let aIdx = 0;

      for (const day of DAYS_OF_WEEK) {
        for (let period = 1; period <= 7; period++) {
          const sKey = `${sec.id}_${day}_${period}`;
          const rKey = `${room.toLowerCase().trim()}_${day}_${period}`;

          if (sectionBusy.has(sKey) || roomBusy.has(rKey)) continue;

          let chosen = null;
          for (let attempt = 0; attempt < assignments.length; attempt++) {
            const idx = (aIdx + attempt) % assignments.length;
            const cand = assignments[idx];
            const tKey = `${cand.teacher_id}_${day}_${period}`;

            if (!teacherBusy.has(tKey)) {
              chosen = cand;
              aIdx = (idx + 1) % assignments.length;
              break;
            }
          }

          if (chosen) {
            const tKey = `${chosen.teacher_id}_${day}_${period}`;
            teacherBusy.add(tKey);
            sectionBusy.add(sKey);
            roomBusy.add(rKey);

            allSlotsToInsert.push({
              teacher_assignment_id: chosen.teacher_assignment_id,
              day_of_week: day,
              start_time: STANDARD_PERIODS[period].start_time,
              end_time: STANDARD_PERIODS[period].end_time,
              period_number: period,
              room_number: room,
            });
            sectionSlotsCount++;
          }
        }
      }

      sectionSummaries.push({
        sectionId: sec.id,
        gradeLevel: sec.grade_level,
        sectionName: sec.section_name,
        roomNumber: room,
        scheduledPeriods: sectionSlotsCount,
      });
    }

    // 4. Batch insert slots in chunks of 40 for speed
    const batchSize = 40;
    for (let i = 0; i < allSlotsToInsert.length; i += batchSize) {
      const batch = allSlotsToInsert.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];
      batch.forEach((s, bIdx) => {
        const offset = bIdx * 6;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
        values.push(s.teacher_assignment_id, s.day_of_week, s.start_time, s.end_time, s.period_number, s.room_number);
      });

      await query(
        `INSERT INTO schedules (teacher_assignment_id, day_of_week, start_time, end_time, period_number, room_number)
         VALUES ${placeholders.join(', ')}`,
        values
      );
    }

    await logAudit({
      userId: req.user.id,
      action: 'MASTER_SCHEDULE_GENERATED',
      entityType: 'MASTER_SCHEDULE',
      entityId: gradeLevel ? `GRADE_${gradeLevel}` : 'ALL_GRADES',
      details: {
        gradeLevel: gradeLevel || 'ALL',
        totalSlots: allSlotsToInsert.length,
        sectionsCovered: sectionSummaries.length,
      },
    });

    res.status(201).json({
      success: true,
      message: `Master schedule generated successfully! ${allSlotsToInsert.length} conflict-free class periods delivered across ${sectionSummaries.length} sections.`,
      totalSlots: allSlotsToInsert.length,
      sectionsCovered: sectionSummaries.length,
      sections: sectionSummaries,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  STANDARD_PERIODS,
  DAYS_OF_WEEK,
  checkConflict,
  resolveAutoRoomForSection,
  syncScheduleRoomNumbers,
  getSchedules,
  getStandardPeriods,
  validateSlot,
  createScheduleSlot,
  updateScheduleSlot,
  deleteScheduleSlot,
  deleteAllSchedules,
  deleteSectionSchedules,
  generateSectionSchedule,
  generateMasterSchedule,
  getScheduleAudit,
};

