import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Alert from '../../components/common/Alert';
import Badge from '../../components/common/Badge';
import {
  UserCheck,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  AlertTriangle,
  Search,
  Save,
  RotateCcw,
  Sparkles,
  BarChart3,
  History,
  UserX,
  FileCheck,
  Check,
  RefreshCw,
} from 'lucide-react';

const STATUS_CONFIG = {
  PRESENT: {
    label: 'Present',
    code: 'P',
    color: 'emerald',
    activeBg: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30',
    idleBg: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-900/60',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  },
  LATE: {
    label: 'Late',
    code: 'L',
    color: 'amber',
    activeBg: 'bg-amber-600 text-white shadow-md shadow-amber-600/30',
    idleBg: 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-900/60',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  },
  ABSENT: {
    label: 'Absent',
    code: 'A',
    color: 'rose',
    activeBg: 'bg-rose-600 text-white shadow-md shadow-rose-600/30',
    idleBg: 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
  },
  EXCUSED: {
    label: 'Excused',
    code: 'E',
    color: 'blue',
    activeBg: 'bg-blue-600 text-white shadow-md shadow-blue-600/30',
    idleBg: 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/60',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
};

const TeacherAttendancePage = () => {
  // Class selection state
  const [classes, setClasses] = useState([]);
  const [selectedClassIndex, setSelectedClassIndex] = useState(0);

  // Date selection (default today YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Active view tab: 'sheet' | 'history' | 'atRisk'
  const [activeTab, setActiveTab] = useState('sheet');

  // Attendance state
  const [attendanceData, setAttendanceData] = useState(null);
  const [roster, setRoster] = useState([]); // array of { studentId, studentInfo, status, remarks, originalStatus }
  const [searchTerm, setSearchTerm] = useState('');

  // History state
  const [historyLogs, setHistoryLogs] = useState([]);
  const [atRiskStudents, setAtRiskStudents] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Loading & feedback
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Initial Load: Fetch teacher assigned classes
  useEffect(() => {
    const fetchAssignedClasses = async () => {
      try {
        setLoading(true);
        setErrorMsg('');
        const res = await api.get('/teachers/classes');
        const classList = res.data?.data || [];
        setClasses(classList);

        if (classList.length > 0) {
          setSelectedClassIndex(0);
          await loadAttendanceRoster(classList[0], selectedDate);
        }
      } catch (err) {
        setErrorMsg(err.response?.data?.message || 'Failed to load assigned classes.');
      } finally {
        setLoading(false);
      }
    };

    fetchAssignedClasses();
  }, []);

  // 2. Load attendance roster for specific class & date
  const loadAttendanceRoster = async (cls, dateStr) => {
    if (!cls) return;
    try {
      setRosterLoading(true);
      setErrorMsg('');
      const res = await api.get('/teachers/attendance', {
        params: {
          sectionId: cls.section_id,
          subjectId: cls.subject_id,
          date: dateStr,
        },
      });

      const data = res.data?.data;
      setAttendanceData(data);

      // Map students into editable roster state
      const mapped = (data?.students || []).map((s) => ({
        studentId: s.student_id,
        studentCode: s.student_code,
        firstName: s.first_name,
        lastName: s.last_name,
        email: s.email,
        gender: s.gender,
        pastAttendanceRate: s.past_attendance_rate,
        pastAbsenceCount: s.past_absence_count,
        status: s.status || 'PRESENT', // default to PRESENT for seamless taking
        remarks: s.remarks || '',
        isSaved: Boolean(s.status),
      }));

      setRoster(mapped);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to load attendance roster.');
    } finally {
      setRosterLoading(false);
    }
  };

  // 3. Load attendance history & at-risk analytics
  const loadAttendanceHistory = async (cls) => {
    if (!cls) return;
    try {
      setHistoryLoading(true);
      const res = await api.get('/teachers/attendance/history', {
        params: {
          sectionId: cls.section_id,
          subjectId: cls.subject_id,
        },
      });
      setHistoryLogs(res.data?.data?.history || []);
      setAtRiskStudents(res.data?.data?.atRiskStudents || []);
    } catch (err) {
      console.error('Failed to load attendance history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Switch class
  const handleClassChange = async (idx) => {
    const nextIndex = parseInt(idx, 10);
    setSelectedClassIndex(nextIndex);
    const cls = classes[nextIndex];
    if (cls) {
      await loadAttendanceRoster(cls, selectedDate);
      if (activeTab !== 'sheet') {
        await loadAttendanceHistory(cls);
      }
    }
  };

  // Switch date
  const handleDateChange = async (newDate) => {
    setSelectedDate(newDate);
    const cls = classes[selectedClassIndex];
    if (cls) {
      await loadAttendanceRoster(cls, newDate);
    }
  };

  // Quick date shortcuts
  const handleSetQuickDate = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    const dateStr = d.toISOString().slice(0, 10);
    handleDateChange(dateStr);
  };

  // Switch tabs
  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    if ((tab === 'history' || tab === 'atRisk') && classes[selectedClassIndex]) {
      await loadAttendanceHistory(classes[selectedClassIndex]);
    }
  };

  // Update individual student status
  const handleSetStatus = (studentId, newStatus) => {
    setRoster((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status: newStatus } : s))
    );
  };

  // Update individual student remarks
  const handleSetRemarks = (studentId, remarks) => {
    setRoster((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, remarks } : s))
    );
  };

  // Bulk action: Mark All Present
  const handleMarkAll = (status) => {
    setRoster((prev) => prev.map((s) => ({ ...s, status })));
  };

  // Save attendance sheet
  const handleSaveAttendance = async () => {
    const cls = classes[selectedClassIndex];
    if (!cls) return;

    try {
      setSaving(true);
      setErrorMsg('');
      setSuccessMsg('');

      const records = roster.map((s) => ({
        studentId: s.studentId,
        status: s.status,
        remarks: s.remarks,
      }));

      const res = await api.post('/teachers/attendance', {
        sectionId: cls.section_id,
        subjectId: cls.subject_id,
        date: selectedDate,
        records,
      });

      setSuccessMsg(res.data?.message || 'Attendance records saved successfully.');
      // Re-fetch to synchronize saved states
      await loadAttendanceRoster(cls, selectedDate);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save attendance records.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading assigned classes & attendance rosters..." />;
  }

  const currentClass = classes[selectedClassIndex];

  // Filter roster by search
  const filteredRoster = roster.filter((s) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
    const code = (s.studentCode || '').toLowerCase();
    return fullName.includes(q) || code.includes(q);
  });

  // Dynamic live counters from current roster state
  const liveStats = {
    total: roster.length,
    present: roster.filter((s) => s.status === 'PRESENT').length,
    late: roster.filter((s) => s.status === 'LATE').length,
    absent: roster.filter((s) => s.status === 'ABSENT').length,
    excused: roster.filter((s) => s.status === 'EXCUSED').length,
  };

  const validDenominator = liveStats.total - liveStats.excused;
  const liveRate =
    validDenominator > 0 ? Math.round((liveStats.present / validDenominator) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ========================================================================= */}
      {/* PAGE HEADER                                                               */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              Official Faculty Portal
            </span>
            {attendanceData?.isRecorded && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                <Check className="w-3 h-3" /> Saved on Record
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Student Attendance Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track daily student attendance, record tardiness and absences, and monitor attendance trends.
          </p>
        </div>

        {/* Top Control Bar: Class Selector & Date */}
        {classes.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm self-start lg:self-auto">
            {/* Class Dropdown */}
            <div className="relative">
              <select
                value={selectedClassIndex}
                onChange={(e) => handleClassChange(e.target.value)}
                className="text-xs sm:text-sm font-semibold py-2 pl-3 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {classes.map((c, i) => (
                  <option key={i} value={i}>
                    Grade {c.grade_level}-{c.section_name} • {c.subject_name} ({c.student_count || 0} students)
                  </option>
                ))}
              </select>
            </div>

            {/* Date Input */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-xl px-2.5 py-1 border border-slate-200 dark:border-slate-700">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="text-xs sm:text-sm font-semibold bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Quick Date Pills */}
            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSetQuickDate(0)}
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all ${
                  selectedDate === new Date().toISOString().slice(0, 10)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate(1)}
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all"
              >
                Yesterday
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notifications */}
      {successMsg && (
        <Alert
          type="success"
          title="Attendance Recorded"
          message={successMsg}
          onClose={() => setSuccessMsg('')}
        />
      )}

      {errorMsg && (
        <Alert
          type="error"
          title="Attendance Error"
          message={errorMsg}
          onClose={() => setErrorMsg('')}
        />
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => handleTabChange('sheet')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'sheet'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Daily Attendance Sheet</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('history')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Attendance History & Logs</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('atRisk')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            activeTab === 'atRisk'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>At-Risk Students</span>
          {atRiskStudents.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-500 text-white">
              {atRiskStudents.length}
            </span>
          )}
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Assigned Classes Found</h3>
          <p className="text-xs text-slate-400 mt-1">
            You currently do not have any teaching sections assigned. Contact the school administrator.
          </p>
        </div>
      ) : activeTab === 'sheet' ? (
        /* ========================================================================= */
        /* TAB 1: DAILY ATTENDANCE SHEET                                             */
        /* ========================================================================= */
        <div className="space-y-5">
          {/* Live KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* Overall Rate */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Attendance Rate
                </span>
                <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  {liveRate}%
                </span>
              </div>
            </div>

            {/* Present */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Present
                </span>
                <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {liveStats.present}
                  <span className="text-xs font-normal text-slate-400 ml-1">/ {liveStats.total}</span>
                </span>
              </div>
            </div>

            {/* Late */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Late (Tardy)
                </span>
                <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                  {liveStats.late}
                </span>
              </div>
            </div>

            {/* Absent */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Absent
                </span>
                <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                  {liveStats.absent}
                </span>
              </div>
            </div>

            {/* Excused */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5 col-span-2 sm:col-span-1">
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Excused
                </span>
                <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
                  {liveStats.excused}
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar: Search + Bulk Controls + Save */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search student by name or ID..."
                className="w-full text-xs sm:text-sm pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Bulk Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleMarkAll('PRESENT')}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800/60 transition-all active:scale-95"
                title="Set all students to Present"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark All Present</span>
              </button>

              <button
                type="button"
                onClick={() => handleMarkAll('ABSENT')}
                className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-1.5 border border-rose-200 dark:border-rose-800/60 transition-all active:scale-95"
                title="Set all students to Absent"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Mark All Absent</span>
              </button>

              <button
                type="button"
                onClick={() => loadAttendanceRoster(currentClass, selectedDate)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all"
                title="Reset to saved state"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Primary Save Button */}
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={saving || rosterLoading || roster.length === 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95 shrink-0"
              >
                <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                <span>{saving ? 'Saving Records...' : 'Save Attendance Sheet'}</span>
              </button>
            </div>
          </div>

          {/* Student Roster Table */}
          {rosterLoading ? (
            <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <LoadingSpinner message="Loading student roster..." />
            </div>
          ) : filteredRoster.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400">
              No students found matching "{searchTerm}".
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12 text-center">#</th>
                      <th className="py-3.5 px-4">Student</th>
                      <th className="py-3.5 px-4">Student ID</th>
                      <th className="py-3.5 px-4">Past Attendance</th>
                      <th className="py-3.5 px-4 text-center">Status Selection</th>
                      <th className="py-3.5 px-4">Remarks / Excuse Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {filteredRoster.map((student, idx) => {
                      const isAtRisk = student.pastAttendanceRate !== null && student.pastAttendanceRate < 75;

                      return (
                        <tr
                          key={student.studentId}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          {/* Row Index */}
                          <td className="py-3 px-4 text-center font-mono text-xs text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Student Info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-extrabold flex items-center justify-center text-xs shrink-0">
                                {student.firstName.charAt(0)}
                                {student.lastName.charAt(0)}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-900 dark:text-slate-100 block leading-snug">
                                  {student.firstName} {student.lastName}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono block">
                                  {student.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Student ID */}
                          <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                            {student.studentCode}
                          </td>

                          {/* Past Attendance Stat */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-bold ${
                                  isAtRisk
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {student.pastAttendanceRate !== null ? `${student.pastAttendanceRate}%` : 'New'}
                              </span>
                              {student.pastAbsenceCount > 0 && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  ({student.pastAbsenceCount} abs)
                                </span>
                              )}
                              {isAtRisk && (
                                <AlertTriangle
                                  className="w-3.5 h-3.5 text-rose-500"
                                  title="Chronic absenteeism risk (<75%)"
                                />
                              )}
                            </div>
                          </td>

                          {/* Status Selector Buttons */}
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-fit mx-auto border border-slate-200 dark:border-slate-700">
                              {Object.entries(STATUS_CONFIG).map(([stKey, cfg]) => {
                                const isSelected = student.status === stKey;

                                return (
                                  <button
                                    key={stKey}
                                    type="button"
                                    onClick={() => handleSetStatus(student.studentId, stKey)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                      isSelected ? cfg.activeBg : cfg.idleBg
                                    }`}
                                    title={cfg.label}
                                  >
                                    {cfg.label}
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          {/* Remarks */}
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={student.remarks}
                              onChange={(e) => handleSetRemarks(student.studentId, e.target.value)}
                              placeholder="Optional note (e.g. medical, late reason)..."
                              className="w-full text-xs px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Footer Save Banner */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Showing <strong>{filteredRoster.length}</strong> enrolled students in Grade {currentClass?.grade_level}-{currentClass?.section_name}
                </span>

                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={saving || rosterLoading || roster.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95"
                >
                  <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                  <span>{saving ? 'Saving...' : 'Save & Publish Attendance'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'history' ? (
        /* ========================================================================= */
        /* TAB 2: ATTENDANCE HISTORY LOGS                                            */
        /* ========================================================================= */
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Historical Attendance Log: Grade {currentClass?.grade_level}-{currentClass?.section_name} • {currentClass?.subject_name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Past recorded attendance sessions with rate calculations and absence breakdowns.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadAttendanceHistory(currentClass)}
              disabled={historyLoading}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Logs</span>
            </button>
          </div>

          {historyLoading ? (
            <LoadingSpinner message="Loading historical logs..." />
          ) : historyLogs.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400">
              No historical attendance sessions recorded yet for this section.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Enrolled</th>
                    <th className="py-3 px-4 text-emerald-600">Present</th>
                    <th className="py-3 px-4 text-amber-600">Late</th>
                    <th className="py-3 px-4 text-rose-600">Absent</th>
                    <th className="py-3 px-4 text-blue-600">Excused</th>
                    <th className="py-3 px-4">Attendance Rate</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {historyLogs.map((log, i) => {
                    const cleanDate = typeof log.date === 'string' ? log.date.slice(0, 10) : '';
                    return (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {cleanDate}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{log.total_students}</td>
                        <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">{log.present_count}</td>
                        <td className="py-3 px-4 font-bold text-amber-600 dark:text-amber-400">{log.late_count}</td>
                        <td className="py-3 px-4 font-bold text-rose-600 dark:text-rose-400">{log.absent_count}</td>
                        <td className="py-3 px-4 font-bold text-blue-600 dark:text-blue-400">{log.excused_count}</td>
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {log.attendance_rate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              handleDateChange(cleanDate);
                              setActiveTab('sheet');
                            }}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                          >
                            Inspect / Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* TAB 3: AT-RISK STUDENTS                                                   */
        /* ========================================================================= */
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-300 dark:border-amber-700/60 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Chronic Absenteeism Early Warning System
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Students below <strong>75% attendance</strong> or with <strong>3 or more absences</strong> are flagged for faculty outreach, parental notification, or academic counseling.
              </p>
            </div>
          </div>

          {historyLoading ? (
            <LoadingSpinner message="Analyzing attendance risk patterns..." />
          ) : atRiskStudents.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h4 className="font-bold text-slate-800 dark:text-slate-200">No At-Risk Students Detected</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                All enrolled students in this section maintain healthy attendance rates above 75%.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {atRiskStudents.map((s) => (
                <div
                  key={s.student_id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100">
                        {s.first_name} {s.last_name}
                      </h4>
                      <span className="text-xs font-mono text-slate-400">{s.student_code}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200">
                      {s.attendance_percentage}% Rate
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Recorded</span>
                      <strong className="text-slate-700 dark:text-slate-300">{s.total_recorded_days} days</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Absent</span>
                      <strong className="text-rose-600 dark:text-rose-400">{s.absent_days}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Late</span>
                      <strong className="text-amber-600 dark:text-amber-400">{s.late_days}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherAttendancePage;
