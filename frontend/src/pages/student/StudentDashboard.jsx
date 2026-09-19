import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Badge from '../../components/common/Badge';
import StatCard from '../../components/common/StatCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import Alert from '../../components/common/Alert';
import { triggerFileDownload, triggerFilePreview } from '../../utils/fileUrl';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  MapPin,
  RefreshCw,
  UserCheck,
  FileText,
  Send,
  Paperclip,
  UploadCloud,
  Download,
  Eye,
  Edit3,
  Trash2,
  Users,
  FileCheck,
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
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Coursework Submission Modal State
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedAssignForSubmit, setSelectedAssignForSubmit] = useState(null);
  const [submissionContent, setSubmissionContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [inputGroupCode, setInputGroupCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // File Preview & Download State
  const [downloadProgress, setDownloadProgress] = useState({});
  const [downloadingId, setDownloadingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [viewingSubmission, setViewingSubmission] = useState(null);

  const fetchDashboard = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);
      const [rRes, schRes, annRes, preRes, attRes, assignRes] = await Promise.all([
        api.get('/students/results'),
        api.get('/students/schedule'),
        api.get('/communications/announcements'),
        api.get('/students/prerequisite-status'),
        api.get('/students/attendance').catch(() => ({ data: { data: null } })),
        api.get('/students/assignments').catch(() => ({ data: { data: [] } })),
        refreshUser(),
      ]);
      setResultsData(rRes.data.data);
      setSchedule(schRes.data.data);
      setAnnouncements(annRes.data.data || annRes.data);
      setPrereq(preRes.data.data);
      setAttendance(attRes.data?.data || null);
      setAssignments(assignRes.data?.data || []);
    } catch (err) {
      setError('Failed to load student dashboard.');
    } finally {
      if (!silent) setLoading(false);
      else setIsRefreshing(false);
    }
  };

  const formatDueDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeRemaining = (dueDateStr) => {
    if (!dueDateStr) return { expired: false, text: '' };
    const total = Date.parse(dueDateStr) - Date.now();
    if (total <= 0) return { expired: true, text: 'Deadline passed' };
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    if (days > 0) return { expired: false, text: `${days}d ${hours}h left` };
    const minutes = Math.floor((total / 1000 / 60) % 60);
    return { expired: false, text: `${hours}h ${minutes}m left` };
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleViewAttachment = async (viewEndpoint, downloadEndpoint, fileName, idKey) => {
    try {
      setViewingId(idKey);
      const isPdf = (fileName || '').toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        return await handleDownloadFile(downloadEndpoint, fileName, idKey);
      }
      await triggerFilePreview(viewEndpoint, downloadEndpoint, fileName);
    } catch (err) {
      console.error('View attachment error:', err);
      setError(err.message || 'Could not open document for online viewing.');
    } finally {
      setViewingId(null);
    }
  };

  const handleDownloadFile = async (target, fileName, key) => {
    try {
      setDownloadingId(key);
      setDownloadProgress((prev) => ({ ...prev, [key]: 0 }));
      await triggerFileDownload(target, fileName, (percent) => {
        setDownloadProgress((prev) => ({ ...prev, [key]: percent }));
      });
    } catch (err) {
      setError(err.message || 'Failed to download file.');
    } finally {
      setDownloadingId(null);
      setTimeout(() => {
        setDownloadProgress((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 1500);
    }
  };

  const openSubmitModal = (assignment) => {
    setSelectedAssignForSubmit(assignment);
    setSubmissionContent(assignment.submission_content || '');
    setSelectedFile(null);
    setInputGroupCode(assignment.group_code || '');
    setModalError('');
    setModalSuccess('');
    setUploadProgress(0);
    setIsSubmitModalOpen(true);
  };

  const handleSubmitWork = async (e) => {
    e.preventDefault();
    if (!selectedAssignForSubmit) return;
    setModalError('');
    setModalSuccess('');

    if (!submissionContent.trim() && !selectedFile) {
      setModalError('Please attach an assignment document (Word, PDF, Docs) or write your solution notes.');
      return;
    }

    const finalCode = (selectedAssignForSubmit.group_code || inputGroupCode || '').trim();
    if (selectedAssignForSubmit.assignment_type === 'GROUP' && !finalCode) {
      setModalError('Please provide a Group Code to submit your group assignment.');
      return;
    }

    setSubmitting(true);
    setUploadProgress(10);
    try {
      const formData = new FormData();
      if (finalCode) {
        formData.append('groupCode', finalCode);
      }
      formData.append('assignmentId', selectedAssignForSubmit.id);
      if (submissionContent.trim()) {
        formData.append('submissionContent', submissionContent.trim());
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const res = await api.post('/students/assignments/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(Math.min(percent, 95));
          }
        },
      });

      setUploadProgress(100);
      const succMsg = res.data.message || 'Assignment document submitted successfully!';
      setModalSuccess(succMsg);

      await fetchDashboard(true);

      setTimeout(() => {
        setIsSubmitModalOpen(false);
        setSelectedAssignForSubmit(null);
        setSubmissionContent('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setInputGroupCode('');
        setUploadProgress(0);
        setModalSuccess('');
      }, 1400);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit assignment. Please try again.';
      setModalError(msg);
      setUploadProgress(0);
    } finally {
      setSubmitting(false);
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

      {/* Active Class Assignments & Coursework Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Active Class Assignments &amp; Projects
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Assignments delivered by your subject teachers. View attached question files, collaborate, and submit your solutions before the deadline.
            </p>
          </div>
          <Link
            to="/student/assignments"
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 shrink-0"
          >
            <span>All Assignments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {assignments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignments.map((a) => {
              const isGroup = a.assignment_type === 'GROUP';
              const remaining = getTimeRemaining(a.due_date);
              const isSubmitted = a.group_status === 'SUBMITTED';
              const isGraded = a.group_status === 'GRADED';
              const isPastDue = a.is_past_due || remaining.expired;

              return (
                <div
                  key={a.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-900 transition-all flex flex-col justify-between gap-3 shadow-xs hover:shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                        {a.subject_name || a.subject_code}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Max: <strong className="text-slate-800 dark:text-slate-200">{a.max_score}</strong> pts
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                        {a.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                        <span>Teacher: {a.teacher_first_name} {a.teacher_last_name}</span>
                        <span>•</span>
                        <span className="italic">{isGroup ? 'Group Project' : 'Individual Work'}</span>
                      </p>
                    </div>

                    {/* Due Date & Countdown */}
                    <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Due {formatDueDate(a.due_date)}</span>
                      </span>
                      <span
                        className={`font-semibold ${
                          isPastDue
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {remaining.text}
                      </span>
                    </div>

                    {/* Teacher Attached Question File */}
                    {a.file_url && (
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Paperclip className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">
                            {a.file_name || 'Question Document'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleViewAttachment(`/students/assignments/${a.id}/view`, `/students/assignments/${a.id}/download`, a.file_name, `dash-view-${a.id}`)}
                            disabled={viewingId === `dash-view-${a.id}`}
                            className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                          >
                            {viewingId === `dash-view-${a.id}` ? 'Opening...' : 'View'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(`/students/assignments/${a.id}/download`, a.file_name || 'assignment', `dash-dl-${a.id}`)}
                            disabled={downloadingId === `dash-dl-${a.id}`}
                            className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1"
                          >
                            <Download className="w-2.5 h-2.5" />
                            <span>
                              {downloadingId === `dash-dl-${a.id}` && downloadProgress[`dash-dl-${a.id}`] !== undefined
                                ? `${downloadProgress[`dash-dl-${a.id}`]}%`
                                : 'Download'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom: Status Badge & Submit Action */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div>
                      {isGraded ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Graded: {a.group_score}/{a.max_score} pts</span>
                        </span>
                      ) : isSubmitted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Submitted</span>
                        </span>
                      ) : isPastDue ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Deadline Passed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          <Clock className="w-3 h-3" />
                          <span>Pending Submission</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isSubmitted && (
                        <button
                          type="button"
                          onClick={() => setViewingSubmission(a)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          View Work
                        </button>
                      )}

                      {!isPastDue && (
                        <button
                          type="button"
                          onClick={() => openSubmitModal(a)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-all"
                        >
                          {isSubmitted ? (
                            <>
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3" />
                              <span>Turn In</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
            No active assignments or project groups assigned to your section at this time.
          </div>
        )}
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
                      className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                        isPres
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

      {/* ========================================================================= */}
      {/* SUBMISSION MODAL ON STUDENT DASHBOARD                                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => {
          setIsSubmitModalOpen(false);
          setModalError('');
          setModalSuccess('');
        }}
        title={
          selectedAssignForSubmit?.assignment_type === 'GROUP'
            ? `Turn In Group Work: ${selectedAssignForSubmit?.title || ''}`
            : `Turn In Assignment: ${selectedAssignForSubmit?.title || ''}`
        }
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmitWork} className="space-y-4">
          {modalError && (
            <Alert
              type="error"
              title="Submission Notice"
              message={modalError}
              onClose={() => setModalError('')}
            />
          )}

          {modalSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 text-xs flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold">{modalSuccess}</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Your coursework has been recorded and dashboard updated.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 shadow-sm transition-all"
              >
                Close
              </button>
            </div>
          )}

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              {selectedAssignForSubmit?.assignment_type === 'GROUP' ? (
                <>
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>
                    {selectedAssignForSubmit?.group_code
                      ? `Submitting for ${selectedAssignForSubmit?.group_name} (${selectedAssignForSubmit?.group_code})`
                      : 'Collaborative Group Submission'}
                  </span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span>Individual Coursework Submission</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
              {selectedAssignForSubmit?.assignment_type === 'GROUP'
                ? `Upload your team's solution before the deadline (${formatDueDate(selectedAssignForSubmit?.due_date)}).`
                : `Upload your completed document or write your solutions below before the deadline (${formatDueDate(selectedAssignForSubmit?.due_date)}).`}
            </p>
          </div>

          {/* Teacher Attached Question Document */}
          {selectedAssignForSubmit?.file_url && (
            <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/40 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                    {selectedAssignForSubmit.file_name || 'Question Document'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatFileSize(selectedAssignForSubmit.file_size)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleViewAttachment(`/students/assignments/${selectedAssignForSubmit.id}/view`, `/students/assignments/${selectedAssignForSubmit.id}/download`, selectedAssignForSubmit.file_name, `dash-modal-view-${selectedAssignForSubmit.id}`)}
                  disabled={viewingId === `dash-modal-view-${selectedAssignForSubmit.id}`}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-50 transition-colors flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  <span>{viewingId === `dash-modal-view-${selectedAssignForSubmit.id}` ? 'Opening...' : 'View'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadFile(`/students/assignments/${selectedAssignForSubmit.id}/download`, selectedAssignForSubmit.file_name || 'assignment', `dash-modal-dl-${selectedAssignForSubmit.id}`)}
                  disabled={downloadingId === `dash-modal-dl-${selectedAssignForSubmit.id}`}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          )}

          {/* Group Code Input if not pre-linked */}
          {selectedAssignForSubmit?.assignment_type === 'GROUP' && !selectedAssignForSubmit?.group_code && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Group Code <span className="text-emerald-600 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. GROUP-MAT03-A-001"
                value={inputGroupCode}
                onChange={(e) => setInputGroupCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono uppercase text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Enter your team's Group Code provided by your instructor or teammates.
              </p>
            </div>
          )}

          {/* Document Attachment Section */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Attach Assignment Document <span className="text-slate-400 font-normal">(Word .docx/.doc, PDF, Docs, etc.)</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              id="dash-assignment-file-input"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedFile(e.target.files[0]);
                }
              }}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf,.odt,.ods,.odp,.zip,.rar,.7z,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,image/*"
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-4 border-2 border-dashed border-emerald-400/60 dark:border-emerald-600/40 rounded-2xl bg-emerald-50/30 dark:bg-emerald-950/20 text-center hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer select-none"
              >
                <div className="space-y-1">
                  <UploadCloud className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Click to choose file from your device (phone, tablet, or PC)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Supports Word (.docx, .doc), PDF (.pdf), PowerPoint, Excel, and documents up to 25MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-xs shadow-sm">
                <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                    <Paperclip className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                      {selectedFile.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 block">
                      {formatFileSize(selectedFile.size)} • Ready to submit
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-lg transition-colors"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            {selectedAssignForSubmit?.submission_file_name && !selectedFile && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-1">
                <Paperclip className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Previously submitted document:</span>
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                  {selectedAssignForSubmit.submission_file_name}
                </span>
                <span className="text-slate-400">(Upload a new file above to replace it).</span>
              </div>
            )}
          </div>

          {/* Solution Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Solution Description &amp; Submission Notes <span className="text-slate-400 font-normal">(Optional if document attached)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Add methodology notes, executive summary, or answers..."
              value={submissionContent}
              onChange={(e) => setSubmissionContent(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y"
            />
          </div>

          {/* Upload Progress Bar */}
          {submitting && selectedFile && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-200">
                <span className="flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <span>Uploading Document to Cloud Storage...</span>
                </span>
                <span className="font-mono text-sm">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-emerald-200 dark:bg-emerald-900/60 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-2.5 rounded-full transition-all duration-150 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300">
                {uploadProgress < 100
                  ? 'Streaming file directly to Cloudinary CDN...'
                  : 'Securing submission and updating dashboard status...'}
              </p>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsSubmitModalOpen(false);
                setModalError('');
                setModalSuccess('');
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (!submissionContent.trim() && !selectedFile)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{uploadProgress > 0 ? `Uploading ${uploadProgress}%...` : 'Submitting...'}</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Turn In Work</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* VIEW SUBMISSION DETAILS MODAL                                             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!viewingSubmission}
        onClose={() => setViewingSubmission(null)}
        title={`Coursework Submission: ${viewingSubmission?.title || ''}`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 block">Status</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {viewingSubmission?.group_status === 'GRADED'
                  ? `Evaluated: ${viewingSubmission?.group_score} / ${viewingSubmission?.max_score} pts`
                  : 'Submitted • Awaiting Teacher Evaluation'}
              </span>
            </div>
            {viewingSubmission?.group_code && (
              <div className="text-right">
                <span className="text-slate-400 block font-mono text-[10px]">Group Code</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {viewingSubmission.group_code}
                </span>
              </div>
            )}
          </div>

          {viewingSubmission?.submission_file_name && (
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                    {viewingSubmission.submission_file_name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatFileSize(viewingSubmission.submission_file_size)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleViewAttachment(`/students/assignments/submissions/${viewingSubmission.group_id}/view`, `/students/assignments/submissions/${viewingSubmission.group_id}/download`, viewingSubmission.submission_file_name, `sub-view-${viewingSubmission.group_id}`)}
                  disabled={viewingId === `sub-view-${viewingSubmission.group_id}`}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  {viewingId === `sub-view-${viewingSubmission.group_id}` ? 'Opening...' : 'View'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadFile(`/students/assignments/submissions/${viewingSubmission.group_id}/download`, viewingSubmission.submission_file_name, `sub-dl-${viewingSubmission.group_id}`)}
                  disabled={downloadingId === `sub-dl-${viewingSubmission.group_id}`}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          )}

          {viewingSubmission?.submission_content && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Submitted Solution Notes:
              </span>
              <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {viewingSubmission.submission_content}
              </p>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setViewingSubmission(null)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StudentDashboard;
