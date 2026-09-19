import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Badge from '../../components/common/Badge';
import StatCard from '../../components/common/StatCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Alert from '../../components/common/Alert';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Layers,
  ArrowRight,
  AlertTriangle,
  Clock,
  MapPin,
  RefreshCw,
  UserCheck,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PERIOD_TIMINGS = {
  1: '08:30 - 09:15',
  2: '09:20 - 10:05',
  3: '10:20 - 11:05',
  4: '11:10 - 11:55',
  5: '13:00 - 13:45',
  6: '13:50 - 14:35',
  7: '14:40 - 15:25',
};

const formatSlotTime = (slot) => {
  if (!slot) return '';
  if (slot.start_time && slot.end_time) {
    const s = String(slot.start_time).slice(0, 5);
    const e = String(slot.end_time).slice(0, 5);
    return `${s} - ${e}`;
  }
  return PERIOD_TIMINGS[slot.period_number] || '';
};

const StudentDashboard = () => {
  const { user, refreshUser } = useAuth();
  const [resultsData, setResultsData] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [prereq, setPrereq] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchDashboard = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);
      const [rRes, schRes, annRes, preRes, attRes] = await Promise.all([
        api.get('/students/results'),
        api.get('/students/schedule'),
        api.get('/communications/announcements'),
        api.get('/students/prerequisite-status'),
        api.get('/students/attendance').catch(() => ({ data: { data: null } })),
        refreshUser(),
      ]);
      setResultsData(rRes.data.data);
      setSchedule(schRes.data.data);
      setAnnouncements(annRes.data.data || annRes.data);
      setPrereq(preRes.data.data);
      setAttendance(attRes.data?.data || null);
    } catch (err) {
      setError('Failed to load student dashboard.');
    } finally {
      if (!silent) setLoading(false);
      else setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Listen to stude:refresh global event
  useEffect(() => {
    const handleGlobalRefresh = () => {
      fetchDashboard(true);
    };
    window.addEventListener('stude:refresh', handleGlobalRefresh);
    return () => window.removeEventListener('stude:refresh', handleGlobalRefresh);
  }, []);

  if (loading) return <LoadingSpinner message="Loading your academic profile..." />;

  const student = resultsData?.student || user?.student;
  const effectiveDocStatus = resultsData?.student?.documentStatus || user?.student?.document_status;

  const currentSummary = resultsData?.currentGradeSummary || {
    gradeLevel: student?.currentGrade,
    sectionName: student?.section,
    averageScore: student?.averageScore,
    subjectCount: student?.subjectCount || 0,
    calculationFormula: student?.calculationFormula,
    promotionStatus: student?.promotionStatus,
    isQualified: student?.isQualifiedForPromotion,
  };
  const prevGrade9 = resultsData?.resultsByGrade?.[9];

  return (
    <div className="space-y-6">
      {/* Student Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-primary-700 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold backdrop-blur-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                {effectiveDocStatus === 'APPROVED' ? 'Grade 8 Prerequisite Verified: APPROVED' : 'Grade 8 Admission Status'}
              </div>
              <button
                type="button"
                onClick={() => fetchDashboard(true)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold backdrop-blur-sm transition-all active:scale-95"
                title="Refresh student dashboard"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
              </button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Hello, {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 mt-1">
              Student ID: <span className="font-mono font-bold">{student?.studentId || user?.student?.student_id}</span> •{' '}
              {student?.currentGrade ? `Grade ${student.currentGrade} (${student.section || 'General'})` : 'Registration Approved • Section Enrollment Pending'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/student/assignments"
              className="flex-1 sm:flex-initial justify-center inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold backdrop-blur-sm transition-colors shrink-0"
            >
              <FileText className="w-4 h-4" />
              <span>Assignments & Projects</span>
            </Link>
            <Link
              to="/student/materials"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold backdrop-blur-sm transition-colors shrink-0"
            >
              <BookOpen className="w-4 h-4" />
              <span>Learning Materials</span>
            </Link>
            <Link
              to="/student/results"
              className="px-4 py-2.5 rounded-xl bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold shadow-sm transition-colors shrink-0"
            >
              View Report Card
            </Link>
          </div>
        </div>
      </div>

      {error && <Alert type="error" title="Error" message={error} onClose={() => setError('')} />}

      {/* Grade 9 Certified Completion Banner (for promoted students in Grade 10+) */}
      {prevGrade9 && prevGrade9.isQualified && student?.currentGrade > 9 && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold text-emerald-900 dark:text-emerald-100">
                Grade 9 Official Results: Certified Average {prevGrade9.averageScore}%
              </span>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                Formula: {prevGrade9.formula} • Successfully completed &amp; promoted to Grade 10!
              </p>
            </div>
          </div>
          <Link
            to="/student/results"
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shrink-0 shadow-sm"
          >
            View Grade 9 Report Card
          </Link>
        </div>
      )}

      {/* Grade 8 Document Approved - Ready for Section Selection Banner */}
      {effectiveDocStatus === 'APPROVED' && !student?.currentGrade && (
        <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                Official Grade 8 Prerequisite Approved!
              </h4>
              <p className="mt-0.5 leading-relaxed text-emerald-800 dark:text-emerald-300">
                Your admission documents have been reviewed and approved by School Administration.
                Please choose your Grade 9 section to complete enrollment and finalize your class schedule.
              </p>
            </div>
          </div>
          <Link
            to="/student/enrollment"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shrink-0 flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>Proceed to Section Enrollment</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Grade 8 Document Status Banner (Pending Review) */}
      {effectiveDocStatus === 'PENDING_ADMIN_VERIFICATION' && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm text-amber-950 dark:text-amber-100">
              Grade 8 Official Document Submitted — Awaiting Administrator Approval
            </h4>
            <p className="mt-0.5 leading-relaxed text-amber-800 dark:text-amber-300">
              Your official Grade 8 completion certificate ({user?.student?.grade8_document_name || 'Attached'}) was securely submitted.
              School Administration is currently reviewing your document. You will be able to enroll into your section once approved.
            </p>
          </div>
        </div>
      )}

      {/* Grade 8 Document Rejected Banner */}
      {effectiveDocStatus === 'REJECTED' && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm text-rose-950 dark:text-rose-100">
              Grade 8 Document Verification Rejected
            </h4>
            <p className="mt-0.5 leading-relaxed text-rose-800 dark:text-rose-300">
              Reason: {user?.student?.admin_review_notes || 'Documentation could not be verified'}.
              Please contact the school administration office.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Current Placement"
          value={student?.currentGrade ? `Grade ${student.currentGrade}` : 'Not Enrolled'}
          icon={Layers}
          color="blue"
          description={student?.section ? `Section ${student.section} • ${student.stream || 'General Stream'}` : 'Select section'}
        />
        <StatCard
          title="Cumulative Average"
          value={currentSummary?.averageScore ? `${currentSummary.averageScore}%` : 'Pending'}
          icon={Award}
          color={currentSummary?.averageScore >= 50 ? 'emerald' : currentSummary?.averageScore ? 'rose' : 'emerald'}
          description={
            currentSummary?.averageScore
              ? `${currentSummary.subjectCount} subjects evaluated for Grade ${student?.currentGrade}`
              : `Awaiting teacher submissions for Grade ${student?.currentGrade || ''}`
          }
        />
        <StatCard
          title="Class Periods"
          value={schedule.length}
          icon={Calendar}
          color="purple"
          description="Weekly timetable slots"
        />
        <StatCard
          title="Attendance Rate"
          value={attendance?.stats?.totalSessions > 0 ? `${attendance.stats.overallAttendanceRate}%` : '100%'}
          icon={UserCheck}
          color={
            (attendance?.stats?.overallAttendanceRate ?? 100) >= 85
              ? 'emerald'
              : (attendance?.stats?.overallAttendanceRate ?? 100) >= 75
                ? 'amber'
                : 'rose'
          }
          description={
            attendance?.stats?.totalSessions > 0
              ? `${attendance.stats.presentCount} present, ${attendance.stats.absentCount} absent`
              : 'No absences recorded'
          }
        />
      </div>


      {/* Official Multi-Subject Evaluations & System-Calculated Average Banner */}
      {student?.currentGrade && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Official Multi-Subject Academic Evaluations &amp; System Average (Grade {student.currentGrade})
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Each subject teacher submits their evaluation. The system automatically computes your cumulative average to determine progression to the next grade.
              </p>
            </div>
            <div>
              {currentSummary?.averageScore >= 50 ? (
                <Badge variant="success" size="md">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />
                  QUALIFIED TO ADVANCE TO NEXT GRADE
                </Badge>
              ) : currentSummary?.averageScore ? (
                <Badge variant="danger" size="md">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 inline" />
                  BELOW PROMOTION CRITERIA (&lt; 50%)
                </Badge>
              ) : (
                <Badge variant="warning" size="md">
                  EVALUATIONS PENDING
                </Badge>
              )}
            </div>
          </div>

          {/* System Calculation Formula Display */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <span>System Calculation Formula:</span>
                <span className="text-[11px] font-normal text-slate-400">
                  (Sum of All Subject Results) ÷ (Total Evaluated Subjects)
                </span>
              </span>
              <span className="font-extrabold text-sm text-primary-600 dark:text-primary-400">
                Average: {currentSummary?.averageScore ? `${currentSummary.averageScore}%` : 'Pending'}
              </span>
            </div>

            {currentSummary?.calculationFormula && currentSummary?.averageScore ? (
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 font-mono text-[11px] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 overflow-x-auto">
                {currentSummary.calculationFormula}
              </div>
            ) : (
              <div className="text-slate-400 italic">
                Awaiting subject teacher submissions for Grade {student.currentGrade} to calculate cumulative average.
              </div>
            )}

            {/* Progression eligibility alert for Grade 9 */}
            {currentSummary?.averageScore >= 50 && student?.currentGrade === 9 && (
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300">
                <span className="font-medium">
                  Grade 9 criteria fulfilled ({currentSummary.averageScore}%). You are eligible to proceed to Grade 10!
                </span>
                <Link
                  to="/student/enrollment"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm inline-flex items-center gap-1.5 shrink-0"
                >
                  <span>Select Grade 10 Section</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {currentSummary?.averageScore && currentSummary?.averageScore < 50 && student?.currentGrade === 9 && (
              <div className="pt-2 text-rose-700 dark:text-rose-400 font-medium">
                Grade 9 result is below the criteria ({currentSummary.averageScore}% / 50% required). Please perform your qualification before proceed. You cannot advance to Grade 10 until academic standing is resolved.
              </div>
            )}
          </div>

          {/* Teacher-Submitted Subjects Grid */}
          {resultsData?.grades && resultsData.grades.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Delivered Subject Evaluations by Teachers:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {resultsData.grades.map((g) => (
                  <div
                    key={g.id}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                          {g.subject_name}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {g.teacher_name || 'Subject Teacher'}
                        </span>
                      </div>
                      <Badge
                        variant={
                          parseFloat(g.total_score || 0) >= 50 ? 'success' : 'danger'
                        }
                        size="sm"
                      >
                        {parseFloat(g.total_score || 0).toFixed(1)}%
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800/60 text-slate-500">
                      <span>Letter: <strong>{g.letter_grade || '-'}</strong></span>
                      <span className="truncate max-w-[120px] italic">{g.remarks || 'Recorded'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Announcements & Timetable Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Announcements */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Recent Announcements
            </h3>
            <span className="text-xs text-slate-400">School Notices</span>
          </div>

          <div className="space-y-3">
            {announcements.slice(0, 3).map((a) => (
              <div key={a.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{a.title}</h4>
                  <Badge variant="primary" size="sm">{a.target_audience}</Badge>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{a.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Timetable preview */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Timetable Highlights
            </h3>
            <Link to="/student/schedule" className="text-xs font-semibold text-primary-600 hover:underline">
              Full Schedule
            </Link>
          </div>

          {schedule.length > 0 ? (
            <div className="space-y-2.5">
              {schedule.slice(0, 5).map((s) => (
                <div key={s.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{s.subject_name}</span>
                      <span className="text-[10px] font-mono font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/60 px-1.5 py-0.5 rounded border border-primary-200 dark:border-primary-800">
                        Period {s.period_number}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-slate-400">
                      <span>{s.day_of_week}</span>
                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-semibold">
                        <Clock className="w-3 h-3 text-primary-500" />
                        {formatSlotTime(s)}
                      </span>
                      {s.room_number && (
                        <span className="flex items-center gap-0.5 text-slate-400">
                          <MapPin className="w-2.5 h-2.5" />
                          {s.room_number}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-slate-600 dark:text-slate-300 font-medium block">
                      {s.teacher_first_name} {s.teacher_last_name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{s.subject_code}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">
              No class schedule found. Please complete section enrollment.
            </div>
          )}
        </div>
      </div>

      {/* Student Attendance & Class Presence Card */}
      {attendance?.stats?.totalSessions > 0 && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Official Class Attendance &amp; Presence Record
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Attendance marked by subject instructors for scheduled classes and periods.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {attendance.stats.presentCount} Present
              </span>
              {attendance.stats.lateCount > 0 && (
                <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {attendance.stats.lateCount} Late
                </span>
              )}
              {attendance.stats.absentCount > 0 && (
                <span className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  {attendance.stats.absentCount} Absent
                </span>
              )}
              {attendance.stats.excusedCount > 0 && (
                <span className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {attendance.stats.excusedCount} Excused
                </span>
              )}
            </div>
          </div>

          {/* Recent Attendance Logs */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {attendance.records?.slice(0, 5).map((rec) => {
              const cleanDate = typeof rec.date === 'string' ? rec.date.slice(0, 10) : '';
              const isPres = rec.status === 'PRESENT';
              const isLate = rec.status === 'LATE';
              const isAbs = rec.status === 'ABSENT';

              return (
                <div key={rec.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-400">{cleanDate}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {rec.subject_name}
                    </span>
                    <span className="text-slate-400 hidden sm:inline">
                      • Instructor: {rec.teacher_first_name} {rec.teacher_last_name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {rec.remarks && (
                      <span className="text-[11px] text-slate-500 italic max-w-xs truncate hidden md:inline">
                        "{rec.remarks}"
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${isPres
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                        : isLate
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                          : isAbs
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                        }`}
                    >
                      {rec.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
