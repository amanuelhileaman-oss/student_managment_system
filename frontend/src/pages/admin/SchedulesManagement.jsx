import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Alert from '../../components/common/Alert';
import Modal from '../../components/common/Modal';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  ShieldCheck,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Sparkles,
  Layers,
  Filter,
  Info,
  X,
  RefreshCw,
  GraduationCap,
  Pencil,
  ArrowRight,
  HelpCircle,
  School,
} from 'lucide-react';

const STANDARD_PERIODS = [
  { period: 1, start: '08:30', end: '09:15', label: 'Period 1 (08:30 - 09:15)' },
  { period: 2, start: '09:20', end: '10:05', label: 'Period 2 (09:20 - 10:05)' },
  { period: 'break1', label: 'Morning Break (10:05 - 10:20)', isBreak: true },
  { period: 3, start: '10:20', end: '11:05', label: 'Period 3 (10:20 - 11:05)' },
  { period: 4, start: '11:10', end: '11:55', label: 'Period 4 (11:10 - 11:55)' },
  { period: 'lunch', label: 'Lunch Break (11:55 - 13:00)', isBreak: true },
  { period: 5, start: '13:00', end: '13:45', label: 'Period 5 (13:00 - 13:45)' },
  { period: 6, start: '13:50', end: '14:35', label: 'Period 6 (13:50 - 14:35)' },
  { period: 7, start: '14:40', end: '15:25', label: 'Period 7 (14:40 - 15:25)' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const SUBJECT_COLORS = {
  Mathematics: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200',
  'Advanced Mathematics': 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200',
  'General Mathematics': 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200',
  English: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200',
  Physics: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200',
  Chemistry: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200',
  Biology: 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200',
  History: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200',
  Geography: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200',
  Civics: 'bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-200',
  Economics: 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200',
};

const SchedulesManagement = () => {
  const [schedules, setSchedules] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [streams, setStreams] = useState([]);
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // View mode: 'section' | 'teacher' | 'overview' | 'audit'
  const [viewMode, setViewMode] = useState('section');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('ALL');
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);

  // Cascading Add / Edit Modal State
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);

  const [formGrade, setFormGrade] = useState(9);
  const [formStream, setFormStream] = useState(1);
  const [formSectionId, setFormSectionId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formDay, setFormDay] = useState('Monday');
  const [formPeriod, setFormPeriod] = useState(1);
  const [formRoom, setFormRoom] = useState('');

  // Live validation
  const [validating, setValidating] = useState(false);
  const [conflictWarning, setConflictWarning] = useState(null);
  const [validationSuccess, setValidationSuccess] = useState('');
  const [savingSlot, setSavingSlot] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Clear schedules confirmation modals
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [isClearSectionOpen, setIsClearSectionOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Audit state
  const [auditData, setAuditData] = useState(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [schRes, secRes, subRes, taRes, tUsersRes, strRes] = await Promise.all([
        api.get('/admin/schedules'),
        api.get('/academic/sections'),
        api.get('/academic/subjects'),
        api.get('/admin/teacher-assignments'),
        api.get('/admin/users?role=teacher'),
        api.get('/academic/streams'),
      ]);

      setSchedules(schRes.data.data || []);
      const allSecs = secRes.data.data || secRes.data || [];
      setSections(allSecs);
      setSubjects(subRes.data.data || subRes.data || []);
      setTeacherAssignments(taRes.data.data || []);
      setStreams(strRes.data.data || strRes.data || []);

      const tList = tUsersRes.data.data || [];
      setTeachers(tList);

      if (allSecs.length > 0 && !selectedSectionId) {
        setSelectedSectionId(allSecs[0].id);
      }
      if (tList.length > 0 && !selectedTeacherId) {
        const schList = schRes.data.data || [];
        const teacherWithSlots = tList.find((t) => {
          const tid = t.teacher_record_id || t.id;
          return schList.some((s) => s.teacher_id === tid || s.teacher_user_id === t.id);
        });
        setSelectedTeacherId(teacherWithSlots ? (teacherWithSlots.teacher_record_id || teacherWithSlots.id) : (tList[0].teacher_record_id || tList[0].id));
      }
    } catch (err) {
      console.error('Failed to load scheduling data:', err);
      setActionError('Failed to load scheduling data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const refreshSchedules = async () => {
    try {
      const res = await api.get('/admin/schedules');
      setSchedules(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Run audit when tab switched
  useEffect(() => {
    if (viewMode === 'audit') {
      setLoadingAudit(true);
      api
        .get('/admin/schedules/conflicts')
        .then((res) => setAuditData(res.data))
        .catch(console.error)
        .finally(() => setLoadingAudit(false));
    }
  }, [viewMode]);

  // Synchronize stream dropdown with grade
  useEffect(() => {
    if (formGrade <= 10) {
      setFormStream(1); // General stream
    } else {
      if (formStream === 1) setFormStream(2); // Natural by default for 11/12
    }
  }, [formGrade]);

  // Synchronize available sections for chosen grade and stream
  const modalAvailableSections = sections.filter(
    (sec) => sec.grade_level === parseInt(formGrade, 10) && sec.stream_id === parseInt(formStream, 10)
  );

  useEffect(() => {
    if (modalAvailableSections.length > 0) {
      const exists = modalAvailableSections.some((s) => s.id === parseInt(formSectionId, 10));
      if (!exists) {
        setFormSectionId(modalAvailableSections[0].id);
      }
    } else {
      setFormSectionId('');
    }
  }, [formGrade, formStream, sections]);

  // Synchronize available subjects for chosen grade and stream
  const modalAvailableSubjects = subjects.filter((sub) => {
    if (sub.grade_level !== parseInt(formGrade, 10)) return false;
    if (formGrade <= 10) return true;
    return !sub.stream_id || sub.stream_id === parseInt(formStream, 10);
  });

  useEffect(() => {
    if (modalAvailableSubjects.length > 0) {
      const exists = modalAvailableSubjects.some((s) => s.id === parseInt(formSubjectId, 10));
      if (!exists) {
        setFormSubjectId(modalAvailableSubjects[0].id);
      }
    } else {
      setFormSubjectId('');
    }
  }, [formGrade, formStream, subjects]);

  // Helper to auto-generate interchangeable classroom identifier based on Grade and Section hierarchy (starting from Room 01)
  const generateAutoRoom = (sec) => {
    if (!sec || !sections || sections.length === 0) return 'Room 01';

    // Only consider active sections and exclude test artifacts
    const activeSecs = sections.filter(
      (s) => s.is_active !== false && !String(s.section_name || '').startsWith('T-')
    );

    // Sort strictly by Grade Level ASC, Stream ASC, Section Name (alphanumeric) ASC, ID ASC
    const sorted = [...activeSecs].sort((a, b) => {
      const gA = parseInt(a.grade_level, 10) || 0;
      const gB = parseInt(b.grade_level, 10) || 0;
      if (gA !== gB) return gA - gB;

      const sA = parseInt(a.stream_id, 10) || 1;
      const sB = parseInt(b.stream_id, 10) || 1;
      if (sA !== sB) return sA - sB;

      const cmp = String(a.section_name || '').localeCompare(String(b.section_name || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (cmp !== 0) return cmp;

      return (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0);
    });

    const idx = sorted.findIndex((s) => s.id === sec.id);
    const roomNum = idx >= 0 ? idx + 1 : 1;
    return `Room ${String(roomNum).padStart(2, '0')}`;
  };

  // Helper to get dynamic room for a schedule slot
  const getSlotRoom = (slot) => {
    if (!slot) return 'Room 01';
    const sec = sections.find((s) => s.id === slot.section_id);
    if (sec) return generateAutoRoom(sec);
    return slot.room_number || 'Room 01';
  };

  // Auto-generate room whenever section changes
  useEffect(() => {
    const sec = sections.find((s) => s.id === parseInt(formSectionId, 10));
    if (sec) {
      setFormRoom(generateAutoRoom(sec));
    }
  }, [formSectionId, sections]);

  // Selected subject details
  const currentSelectedSubject = subjects.find((s) => s.id === parseInt(formSubjectId, 10));

  // Filter teachers matching subject specialization or already assigned, prioritizing officially designated faculty
  const modalAvailableTeachers = teachers
    .filter((t) => {
      if (!currentSelectedSubject) return true;
      const subName = currentSelectedSubject.name.toLowerCase();
      const spec = (t.qualification || t.specialization || '').toLowerCase();
      // Prioritize direct match
      if (spec.includes(subName) || subName.includes(spec)) return true;
      // Common subject keywords
      if (subName.includes('math') && (spec.includes('math') || spec.includes('science'))) return true;
      if (subName.includes('physics') && (spec.includes('physic') || spec.includes('science'))) return true;
      if (subName.includes('chem') && (spec.includes('chem') || spec.includes('science'))) return true;
      if (subName.includes('bio') && (spec.includes('bio') || spec.includes('science'))) return true;
      if (subName.includes('history') && (spec.includes('histor') || spec.includes('social'))) return true;
      if (subName.includes('geo') && (spec.includes('geo') || spec.includes('social'))) return true;
      if (subName.includes('english') && spec.includes('english')) return true;
      return true;
    })
    .sort((a, b) => {
      const isDesA = teacherAssignments.some(
        (ta) =>
          ta.section_id === parseInt(formSectionId, 10) &&
          ta.subject_id === parseInt(formSubjectId, 10) &&
          (ta.teacher_id === a.teacher_record_id || ta.teacher_id === a.id)
      );
      const isDesB = teacherAssignments.some(
        (ta) =>
          ta.section_id === parseInt(formSectionId, 10) &&
          ta.subject_id === parseInt(formSubjectId, 10) &&
          (ta.teacher_id === b.teacher_record_id || ta.teacher_id === b.id)
      );
      if (isDesA && !isDesB) return -1;
      if (!isDesA && isDesB) return 1;
      return (a.first_name || '').localeCompare(b.first_name || '');
    });

  useEffect(() => {
    if (!isSlotModalOpen) return;

    if (modalAvailableTeachers.length > 0) {
      // If editing an existing slot, do not overwrite the teacher
      if (editingSlot) {
        return;
      }

      // Check if current formTeacherId is already a valid teacher for this subject
      const currentTeacherValid = modalAvailableTeachers.some(
        (t) => (t.teacher_record_id || t.id) === parseInt(formTeacherId, 10)
      );

      // If the admin has already chosen a valid teacher (or opened for a specific teacher), PRESERVE IT
      if (currentTeacherValid) {
        return;
      }

      // Only default if no valid teacher is selected for the subject
      const matchingTas = teacherAssignments.filter(
        (ta) =>
          ta.section_id === parseInt(formSectionId, 10) &&
          ta.subject_id === parseInt(formSubjectId, 10)
      );

      if (matchingTas.length > 0) {
        const assignedTa = matchingTas[0];
        const officialTeacher = modalAvailableTeachers.find(
          (t) => (t.teacher_record_id || t.id) === assignedTa.teacher_id
        );
        if (officialTeacher) {
          setFormTeacherId(officialTeacher.teacher_record_id || officialTeacher.id);
          return;
        }
      }

      setFormTeacherId(modalAvailableTeachers[0].teacher_record_id || modalAvailableTeachers[0].id);
    }
  }, [formSubjectId, formSectionId, isSlotModalOpen, editingSlot, teachers, teacherAssignments]);

  // Live conflict validation engine
  useEffect(() => {
    if (!isSlotModalOpen || !formTeacherId || !formSectionId || !formDay || !formPeriod) {
      setConflictWarning(null);
      setValidationSuccess('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setValidating(true);
        const res = await api.post('/admin/schedules/validate', {
          teacherId: parseInt(formTeacherId, 10),
          sectionId: parseInt(formSectionId, 10),
          subjectId: formSubjectId ? parseInt(formSubjectId, 10) : null,
          dayOfWeek: formDay,
          periodNumber: parseInt(formPeriod, 10),
          roomNumber: formRoom,
          excludeId: editingSlot ? editingSlot.id : null,
        });

        if (!res.data.valid) {
          setConflictWarning({
            type: res.data.type,
            message: res.data.message,
          });
          setValidationSuccess('');
        } else {
          setConflictWarning(null);
          setValidationSuccess(res.data.message || 'Valid time slot: No collisions detected.');
        }
      } catch (err) {
        // Handled
      } finally {
        setValidating(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [formTeacherId, formSectionId, formSubjectId, formDay, formPeriod, formRoom, isSlotModalOpen, editingSlot]);

  // Open Add Slot modal
  const handleOpenAddSlot = (day = 'Monday', period = 1) => {
    setEditingSlot(null);
    setActionError('');
    setConflictWarning(null);
    setValidationSuccess('');

    const currentSec = sections.find((s) => s.id === selectedSectionId) || sections[0];
    if (currentSec) {
      setFormGrade(currentSec.grade_level);
      setFormStream(currentSec.stream_id);
      setFormSectionId(currentSec.id);
      setFormRoom(generateAutoRoom(currentSec));
    }

    setFormDay(day);
    setFormPeriod(period);
    setIsSlotModalOpen(true);
  };

  // Open Edit Slot modal
  const handleOpenEditSlot = (slot) => {
    setEditingSlot(slot);
    setActionError('');
    setConflictWarning(null);
    setValidationSuccess('');

    const sec = sections.find((s) => s.id === slot.section_id);
    setFormGrade(slot.grade_level);
    setFormStream(slot.stream_id || 1);
    setFormSectionId(slot.section_id);
    setFormSubjectId(slot.subject_id);
    setFormTeacherId(slot.teacher_id);
    setFormDay(slot.day_of_week);
    setFormPeriod(slot.period_number);
    setFormRoom(getSlotRoom(slot));
    setIsSlotModalOpen(true);
  };

  // Save Slot handler
  const handleSaveSlot = async (e) => {
    e.preventDefault();
    if (!formSectionId || !formSubjectId || !formTeacherId) {
      setActionError('Grade, Section, Subject, and Teacher must all be selected.');
      return;
    }
    if (conflictWarning) {
      setActionError('Please resolve schedule conflicts before saving.');
      return;
    }

    try {
      setSavingSlot(true);
      setActionError('');

      const payload = {
        teacherId: parseInt(formTeacherId, 10),
        subjectId: parseInt(formSubjectId, 10),
        sectionId: parseInt(formSectionId, 10),
        dayOfWeek: formDay,
        periodNumber: parseInt(formPeriod, 10),
        roomNumber: formRoom,
      };

      if (editingSlot) {
        await api.put(`/admin/schedules/${editingSlot.id}`, payload);
        setActionSuccess('Schedule period slot updated successfully.');
      } else {
        await api.post('/admin/schedules', payload);
        setActionSuccess('New schedule period successfully scheduled.');
      }

      setIsSlotModalOpen(false);
      await refreshSchedules();
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to save schedule slot.');
    } finally {
      setSavingSlot(false);
    }
  };

  // Delete single slot
  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('Are you sure you want to remove this class period from the schedule?')) return;
    try {
      await api.delete(`/admin/schedules/${slotId}`);
      await refreshSchedules();
      setActionSuccess('Period removed from schedule.');
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err) {
      alert('Failed to delete slot: ' + (err.response?.data?.message || err.message));
    }
  };

  // Reset all schedules
  const handleClearAllSchedules = async () => {
    try {
      setClearing(true);
      setActionError('');
      const res = await api.delete('/admin/schedules/all');
      setIsClearAllOpen(false);
      await refreshSchedules();
      setActionSuccess(res.data.message || 'All school schedules cleared.');
      setTimeout(() => setActionSuccess(''), 5000);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to clear schedules.');
    } finally {
      setClearing(false);
    }
  };

  // Clear section schedules
  const handleClearSectionSchedules = async () => {
    if (!selectedSectionId) return;
    try {
      setClearing(true);
      setActionError('');
      const res = await api.delete(`/admin/schedules/section/${selectedSectionId}`);
      setIsClearSectionOpen(false);
      await refreshSchedules();
      setActionSuccess(res.data.message || 'Section schedules cleared.');
      setTimeout(() => setActionSuccess(''), 5000);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to clear section schedules.');
    } finally {
      setClearing(false);
    }
  };

  // Filter sections by grade filter
  const filteredSections = sections.filter((sec) => {
    if (selectedGradeFilter === 'ALL') return true;
    return sec.grade_level === parseInt(selectedGradeFilter, 10);
  });

  const selectedSection = sections.find((s) => s.id === selectedSectionId);
  const selectedTeacher = teachers.find(
    (t) =>
      (t.teacher_record_id && t.teacher_record_id === selectedTeacherId) ||
      t.id === selectedTeacherId ||
      (t.teacher_record_id || t.id) === selectedTeacherId
  );

  // Filtered schedules according to viewMode
  const displayedSchedules = schedules.filter((s) => {
    if (viewMode === 'section') {
      return s.section_id === selectedSectionId;
    }
    if (viewMode === 'teacher') {
      const matchTeacher = selectedTeacher;
      const targetTeacherRecordId = matchTeacher ? matchTeacher.teacher_record_id : null;
      const targetUserId = matchTeacher ? matchTeacher.id : null;
      return (
        s.teacher_id === selectedTeacherId ||
        s.teacher_user_id === selectedTeacherId ||
        (targetTeacherRecordId && s.teacher_id === targetTeacherRecordId) ||
        (targetUserId && s.teacher_user_id === targetUserId)
      );
    }
    return true;
  });

  // Calculate teacher's total weekly scheduled periods
  const getTeacherTotalScheduledPeriods = (t) => {
    if (!t) return 0;
    const tid = t.teacher_record_id;
    const uid = t.id;
    return schedules.filter(
      (s) =>
        (tid && s.teacher_id === tid) ||
        (uid && s.teacher_user_id === uid) ||
        s.teacher_id === uid
    ).length;
  };

  // Sorted teachers list for dropdown (teachers with active schedules first, then alphabetical)
  const sortedTeachers = [...teachers].sort((a, b) => {
    const loadA = getTeacherTotalScheduledPeriods(a);
    const loadB = getTeacherTotalScheduledPeriods(b);
    if (loadB !== loadA) return loadB - loadA;
    return (a.first_name || '').localeCompare(b.first_name || '');
  });

  // Automatically select an instructor who has active scheduled periods when viewing by teacher
  useEffect(() => {
    if (viewMode === 'teacher' && teachers.length > 0) {
      const currentLoad = selectedTeacher ? getTeacherTotalScheduledPeriods(selectedTeacher) : 0;
      if (currentLoad === 0 && schedules.length > 0) {
        const activeTeacher = sortedTeachers.find((t) => getTeacherTotalScheduledPeriods(t) > 0);
        if (activeTeacher) {
          setSelectedTeacherId(activeTeacher.teacher_record_id || activeTeacher.id);
        }
      }
    }
  }, [viewMode, schedules]);

  // Open Add Slot modal pre-filled for a specific teacher
  const handleOpenAddSlotForTeacher = (teacher, day = 'Monday', period = 1) => {
    setEditingSlot(null);
    setActionError('');
    setConflictWarning(null);
    setValidationSuccess('');

    if (teacher) {
      setFormTeacherId(teacher.teacher_record_id || teacher.id);
    }
    const currentSec = sections.find((s) => s.id === selectedSectionId) || sections[0];
    if (currentSec) {
      setFormGrade(currentSec.grade_level);
      setFormStream(currentSec.stream_id);
      setFormSectionId(currentSec.id);
      setFormRoom(generateAutoRoom(currentSec));
    }
    setFormDay(day);
    setFormPeriod(period);
    setIsSlotModalOpen(true);
  };

  // Calculate teacher's scheduled periods for a day
  const getTeacherPeriodsForDay = (tId, day) => {
    return schedules.filter((s) => (s.teacher_id === tId || s.teacher_user_id === tId) && s.day_of_week === day).length;
  };

  if (loading) return <LoadingSpinner message="Loading school schedules and timetable matrices..." />;

  return (
    <div className="space-y-6">
      {/* Workflow Navigation Banner */}
      <div className="p-3.5 bg-gradient-to-r from-primary-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-indigo-950/40 dark:to-purple-950/40 rounded-2xl border border-primary-200 dark:border-primary-900/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            2
          </div>
          <div>
            <div className="text-xs font-bold text-primary-900 dark:text-primary-200 flex items-center gap-1.5">
              <span>Admin Scheduling Workflow</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 font-mono">
                Manual Mode
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Admin builds timetables manually with real-time conflict validation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/admin/teachers"
            className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>Step 1: Faculty Course Assignments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <Calendar className="w-7 h-7 text-primary-600" />
            School Timetable & Master Schedules
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manual schedule builder: Select Grade, Stream, Section, and Teacher. Guaranteed zero teacher or section time collisions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Create Slot Button */}
          <button
            onClick={() => handleOpenAddSlot('Monday', 1)}
            className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Schedule Slot</span>
          </button>

          {/* Clear Current Section */}
          {viewMode === 'section' && selectedSection && (
            <button
              onClick={() => setIsClearSectionOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Section Timetable</span>
            </button>
          )}

          {/* Reset All Schedules */}
          <button
            onClick={() => setIsClearAllOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm transition-colors flex items-center gap-1.5"
            title="Permanently wipe all schedules from the school system"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset All Schedules</span>
          </button>
        </div>
      </div>

      {actionError && <Alert type="error" title="Action Error" message={actionError} onClose={() => setActionError('')} />}
      {actionSuccess && <Alert type="success" title="Success" message={actionSuccess} onClose={() => setActionSuccess('')} />}

      {/* View Mode Switcher */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'section', label: 'By Section Timetable', icon: School },
            { id: 'teacher', label: 'By Teacher Weekly Schedule', icon: User },
            { id: 'overview', label: 'School-Wide Overview', icon: Layers },
            { id: 'audit', label: 'Conflict Engine Audit', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  viewMode === tab.id
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs font-mono text-slate-500">
          Total Scheduled Slots: <strong className="text-slate-900 dark:text-slate-100">{schedules.length}</strong>
        </div>
      </div>

      {/* -------------------- VIEW MODE 1: BY SECTION -------------------- */}
      {viewMode === 'section' && (
        <div className="space-y-5">
          {/* Grade & Section Selectors */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 uppercase">Grade:</span>
              {['ALL', '9', '10', '11', '12'].map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGradeFilter(g)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    selectedGradeFilter === g
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {g === 'ALL' ? 'All Grades' : `Grade ${g}`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Select Section:</label>
              <select
                value={selectedSectionId || ''}
                onChange={(e) => setSelectedSectionId(parseInt(e.target.value, 10))}
                className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                {filteredSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    Grade {s.grade_level} — Section {s.section_name} ({s.stream_name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedSection ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Grade {selectedSection.grade_level} — Section {selectedSection.section_name}</span>
                    <Badge variant="primary" size="sm">{selectedSection.stream_name}</Badge>
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">
                    {displayedSchedules.length} of 35 weekly period slots scheduled
                  </p>
                </div>

                <button
                  onClick={() => handleOpenAddSlot('Monday', 1)}
                  className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Period</span>
                </button>
              </div>

              {/* Timetable Grid */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3 px-4 text-left w-36 border-r border-slate-200 dark:border-slate-700">Period / Time</th>
                      {DAYS.map((day) => (
                        <th key={day} className="py-3 px-4 text-center border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {STANDARD_PERIODS.map((periodItem) => {
                      if (periodItem.isBreak) {
                        return (
                          <tr key={periodItem.period} className="bg-amber-50/60 dark:bg-amber-950/20 text-center text-xs font-semibold text-amber-800 dark:text-amber-300">
                            <td colSpan={6} className="py-2 px-4 tracking-wider">
                              ☕ {periodItem.label}
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={periodItem.period} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 align-top">
                            <div className="font-bold text-xs text-slate-800 dark:text-slate-200">Period {periodItem.period}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{periodItem.start} - {periodItem.end}</div>
                          </td>

                          {DAYS.map((day) => {
                            const slot = displayedSchedules.find(
                              (s) => s.day_of_week === day && s.period_number === periodItem.period
                            );

                            return (
                              <td key={day} className="p-2 border-r border-slate-200 dark:border-slate-800 last:border-r-0 align-top">
                                {slot ? (
                                  <div className={`p-2.5 rounded-xl border text-xs relative group transition-all shadow-sm ${SUBJECT_COLORS[slot.subject_name] || 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                    <div className="font-bold text-sm mb-0.5">{slot.subject_name}</div>
                                    <div className="text-[11px] font-medium opacity-90 flex items-center gap-1">
                                      <User className="w-3 h-3 shrink-0" />
                                      <span className="truncate">
                                        {slot.first_name || slot.teacher_first_name || 'Faculty Member'} {slot.last_name || slot.teacher_last_name || ''}
                                      </span>
                                    </div>
                                    <div className="text-[10px] opacity-75 flex items-center gap-1 mt-0.5">
                                      <MapPin className="w-2.5 h-2.5" />
                                      <span>{getSlotRoom(slot)}</span>
                                    </div>

                                    {/* Action Buttons on Hover */}
                                    <div className="mt-2 pt-1.5 border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => handleOpenEditSlot(slot)}
                                        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                                        title="Edit Period Slot"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSlot(slot.id)}
                                        className="p-1 rounded text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-colors"
                                        title="Delete Period Slot"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleOpenAddSlot(day, periodItem.period)}
                                    className="w-full h-16 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-primary-400 dark:hover:border-primary-600 text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 transition-all flex flex-col items-center justify-center gap-1"
                                    title={`Add class for ${day} Period ${periodItem.period}`}
                                  >
                                    <Plus className="w-4 h-4" />
                                    <span className="text-[10px] font-semibold">Assign</span>
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400">No section selected.</div>
          )}
        </div>
      )}

      {/* -------------------- VIEW MODE 2: BY TEACHER -------------------- */}
      {viewMode === 'teacher' && (
        <div className="space-y-5">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Select Instructor:</label>
              <select
                value={selectedTeacherId || ''}
                onChange={(e) => setSelectedTeacherId(parseInt(e.target.value, 10))}
                className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100"
              >
                {sortedTeachers.map((t) => {
                  const tId = t.teacher_record_id || t.id;
                  const count = getTeacherTotalScheduledPeriods(t);
                  return (
                    <option key={t.id} value={tId}>
                      {t.first_name} {t.last_name} ({t.qualification || t.specialization || 'Teacher'}) • {count} period(s) scheduled
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedTeacher && (
              <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
                <span>Weekly Teaching Load:</span>
                <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${
                  displayedSchedules.length > 0
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {displayedSchedules.length} periods
                </span>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Instructor: {selectedTeacher ? `${selectedTeacher.first_name} ${selectedTeacher.last_name}` : ''}</span>
                  {selectedTeacher && (
                    <Badge variant={displayedSchedules.length > 0 ? 'success' : 'neutral'} size="sm">
                      {selectedTeacher.qualification || selectedTeacher.specialization || 'Faculty'}
                    </Badge>
                  )}
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Multi-section teaching schedule. Notice how one instructor teaches multiple sections across different periods without time collisions.
                </p>
              </div>
              {selectedTeacher && (
                <button
                  onClick={() => handleOpenAddSlotForTeacher(selectedTeacher)}
                  className="px-3.5 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-sm inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Period for {selectedTeacher.first_name}</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-4 text-left w-36 border-r border-slate-200 dark:border-slate-700">Period</th>
                    {DAYS.map((day) => (
                      <th key={day} className="py-3 px-4 text-center border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {STANDARD_PERIODS.map((periodItem) => {
                    if (periodItem.isBreak) {
                      return (
                        <tr key={periodItem.period} className="bg-amber-50/60 dark:bg-amber-950/20 text-center text-xs font-semibold text-amber-800 dark:text-amber-300">
                          <td colSpan={6} className="py-2 px-4">
                            ☕ {periodItem.label}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={periodItem.period} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 align-top">
                          <div className="font-bold text-xs text-slate-800 dark:text-slate-200">Period {periodItem.period}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{periodItem.start} - {periodItem.end}</div>
                        </td>

                        {DAYS.map((day) => {
                          const slot = displayedSchedules.find(
                            (s) => s.day_of_week === day && s.period_number === periodItem.period
                          );

                          return (
                            <td key={day} className="p-2 border-r border-slate-200 dark:border-slate-800 last:border-r-0 align-top">
                              {slot ? (
                                <div className={`p-2.5 rounded-xl border text-xs shadow-sm ${SUBJECT_COLORS[slot.subject_name] || 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                  <div className="font-bold text-sm mb-0.5">{slot.subject_name}</div>
                                  <Badge variant="primary" size="sm" className="mb-1">
                                    Grade {slot.grade_level} — Sec {slot.section_name}
                                  </Badge>
                                    <div className="text-[10px] opacity-75 flex items-center gap-1">
                                      <MapPin className="w-2.5 h-2.5" />
                                      <span>{getSlotRoom(slot)}</span>
                                    </div>
                                  <div className="mt-2 pt-1 border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => handleOpenEditSlot(slot)}
                                      className="p-1 rounded hover:bg-black/10"
                                      title="Edit Slot"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSlot(slot.id)}
                                      className="p-1 rounded text-rose-600 hover:bg-rose-100"
                                      title="Delete Slot"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleOpenAddSlotForTeacher(selectedTeacher, day, periodItem.period)}
                                  className="w-full h-16 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 hover:border-primary-400 hover:bg-primary-50/30 dark:hover:bg-primary-950/20 flex flex-col items-center justify-center gap-0.5 text-slate-400 hover:text-primary-600 transition-all group"
                                  title={`Assign class to ${selectedTeacher ? selectedTeacher.first_name : 'Teacher'} on ${day} Period ${periodItem.period}`}
                                >
                                  <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                  <span className="text-[10px] font-semibold">Assign</span>
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- VIEW MODE 3: SCHOOL-WIDE OVERVIEW -------------------- */}
      {viewMode === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[9, 10, 11, 12].map((lvl) => {
              const secList = sections.filter((s) => s.grade_level === lvl);
              const slotsCount = schedules.filter((s) => s.grade_level === lvl).length;
              return (
                <div key={lvl} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-base text-slate-900 dark:text-slate-100">Grade {lvl}</span>
                    <Badge variant="primary" size="sm">{secList.length} Sections</Badge>
                  </div>
                  <div className="text-2xl font-black text-primary-600 mb-1">{slotsCount}</div>
                  <div className="text-xs text-slate-500 font-mono">Scheduled Periods</div>
                </div>
              );
            })}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-3">All Section Coverage Summary</h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {sections.map((sec) => {
                const sCount = schedules.filter((s) => s.section_id === sec.id).length;
                return (
                  <div key={sec.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        Grade {sec.grade_level} — Section {sec.section_name}
                      </span>
                      <span className="text-slate-400 ml-2 font-mono">({sec.stream_name})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{sCount} / 35 Periods</span>
                      <button
                        onClick={() => {
                          setSelectedSectionId(sec.id);
                          setViewMode('section');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                      >
                        View Timetable
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* -------------------- VIEW MODE 4: AUDIT -------------------- */}
      {viewMode === 'audit' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                Timetable Conflict & Integrity Scanner
              </h2>
              <p className="text-xs text-slate-500">
                Audits all scheduled periods in database for teacher double-booking, section collisions, and room overlaps.
              </p>
            </div>
            {loadingAudit && <div className="text-xs text-slate-400">Scanning...</div>}
          </div>

          {auditData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-500">Teacher Conflicts</div>
                  <div className={`text-xl font-bold ${auditData.conflicts?.teacherConflicts?.length === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {auditData.conflicts?.teacherConflicts?.length || 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-500">Section Conflicts</div>
                  <div className={`text-xl font-bold ${auditData.conflicts?.sectionConflicts?.length === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {auditData.conflicts?.sectionConflicts?.length || 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-500">Room Conflicts</div>
                  <div className={`text-xl font-bold ${auditData.conflicts?.roomConflicts?.length === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {auditData.conflicts?.roomConflicts?.length || 0}
                  </div>
                </div>
              </div>

              {auditData.healthy ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Timetable is 100% healthy! Zero teacher collisions or section double-bookings exist.</span>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs">
                  Conflicts were detected in the timetable. Please review and edit the flagged period slots.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* -------------------- CASCADING MANUAL SCHEDULE CREATOR MODAL -------------------- */}
      <Modal
        isOpen={isSlotModalOpen}
        onClose={() => setIsSlotModalOpen(false)}
        title={editingSlot ? 'Edit Schedule Period Slot' : 'Create Schedule Period (Cascading Form)'}
      >
        <form onSubmit={handleSaveSlot} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* 1. Grade Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Grade Level
              </label>
              <select
                value={formGrade}
                onChange={(e) => setFormGrade(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                {[9, 10, 11, 12].map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Stream Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Curriculum Stream
              </label>
              <select
                value={formStream}
                onChange={(e) => setFormStream(parseInt(e.target.value, 10))}
                disabled={formGrade <= 10}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold disabled:opacity-60"
              >
                {formGrade <= 10 ? (
                  <option value={1}>General Stream (Grades 9-10)</option>
                ) : (
                  <>
                    <option value={2}>Natural Stream (Sciences)</option>
                    <option value={3}>Social Stream (Humanities)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* 3. Section Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Section
              </label>
              <select
                value={formSectionId}
                onChange={(e) => setFormSectionId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                {modalAvailableSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Section {sec.section_name} ({sec.stream_name})
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Subject Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject Course
              </label>
              <select
                value={formSubjectId}
                onChange={(e) => setFormSubjectId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                {modalAvailableSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 5. Teacher Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span>Assigned Instructor</span>
              <span className="text-[10px] text-slate-400 font-normal">
                Shows faculty specialization & period load
              </span>
            </label>
            <select
              value={formTeacherId}
              onChange={(e) => setFormTeacherId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
            >
              {modalAvailableTeachers.map((t) => {
                const tId = t.teacher_record_id || t.id;
                const load = getTeacherPeriodsForDay(tId, formDay);
                const isDesignated = teacherAssignments.some(
                  (ta) =>
                    ta.section_id === parseInt(formSectionId, 10) &&
                    ta.subject_id === parseInt(formSubjectId, 10) &&
                    (ta.teacher_id === t.teacher_record_id || ta.teacher_id === t.id)
                );
                return (
                  <option key={t.id} value={tId}>
                    {isDesignated ? '★ ' : ''}
                    {t.first_name} {t.last_name} ({t.qualification || t.specialization || 'Teacher'})
                    {isDesignated ? ' • Designated Section Teacher' : ''} • {load} period(s) on {formDay}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* 6. Day of Week */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Day
              </label>
              <select
                value={formDay}
                onChange={(e) => setFormDay(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* 7. Period */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Period
              </label>
              <select
                value={formPeriod}
                onChange={(e) => setFormPeriod(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((p) => {
                  const pInfo = STANDARD_PERIODS.find((sp) => sp.period === p);
                  return (
                    <option key={p} value={p}>
                      Period {p} ({pInfo ? `${pInfo.start}-${pInfo.end}` : ''})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 8. Auto-Generated Classroom */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>Classroom</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Auto-Generated
                </span>
              </label>
              <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between shadow-inner">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                  <span className="truncate">{formRoom || 'Auto-Assigned Room'}</span>
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-sans font-bold uppercase tracking-wider shrink-0">
                  Auto
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Collision Diagnostics Box */}
          {validating && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-500 flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span>Verifying teacher and section availability...</span>
            </div>
          )}

          {conflictWarning && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Collision Detected ({conflictWarning.type})</span>
              </div>
              <p className="text-[11px] leading-relaxed">{conflictWarning.message}</p>
            </div>
          )}

          {validationSuccess && !conflictWarning && !validating && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{validationSuccess}</span>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsSlotModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingSlot || Boolean(conflictWarning) || validating}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {savingSlot ? 'Saving Period...' : editingSlot ? 'Update Period Slot' : 'Confirm & Schedule Period'}
            </button>
          </div>
        </form>
      </Modal>

      {/* -------------------- RESET ALL CONFIRMATION MODAL -------------------- */}
      <Modal
        isOpen={isClearAllOpen}
        onClose={() => setIsClearAllOpen(false)}
        title="Reset All School Schedules"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-rose-700 dark:text-rose-300 mb-1">
                Permanent Purge Warning
              </p>
              <p>
                This action will permanently delete all <strong>{schedules.length}</strong> scheduled class periods from the database across all grades and sections.
              </p>
              <p className="mt-1">
                Your sections, faculty, and student enrollments will NOT be harmed.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={() => setIsClearAllOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAllSchedules}
              disabled={clearing}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
            >
              {clearing ? 'Purging Schedules...' : 'Confirm Reset All Schedules'}
            </button>
          </div>
        </div>
      </Modal>

      {/* -------------------- CLEAR SECTION CONFIRMATION MODAL -------------------- */}
      <Modal
        isOpen={isClearSectionOpen}
        onClose={() => setIsClearSectionOpen(false)}
        title="Clear Section Timetable"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Are you sure you want to remove all scheduled class periods for{' '}
            <strong>
              Grade {selectedSection?.grade_level} — Section {selectedSection?.section_name}
            </strong>
            ?
          </p>
          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={() => setIsClearSectionOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleClearSectionSchedules}
              disabled={clearing}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {clearing ? 'Clearing...' : 'Confirm Clear Section'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SchedulesManagement;
