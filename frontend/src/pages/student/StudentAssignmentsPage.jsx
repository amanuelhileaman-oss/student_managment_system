import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { resolveFileUrl, triggerFileDownload, triggerFilePreview, getViewFileUrl, getAssignmentViewUrl, getSubmissionViewUrl } from '../../utils/fileUrl';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Alert from '../../components/common/Alert';
import {
  FileText,
  Calendar,
  Users,
  Award,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit3,
  Copy,
  Check,
  FileCheck,
  Paperclip,
  UploadCloud,
  Download,
  Trash2,
  ArrowLeft,
} from 'lucide-react';

const StudentAssignmentsPage = () => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Submission Modal state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedAssignForSubmit, setSelectedAssignForSubmit] = useState(null);
  const [submissionContent, setSubmissionContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [inputGroupCode, setInputGroupCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Download Progress State
  const [downloadProgress, setDownloadProgress] = useState({});
  const [downloadingId, setDownloadingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);

  const handleViewAttachment = async (viewEndpoint, downloadEndpoint, fileName, idKey) => {
    try {
      setViewingId(idKey);
      setError('');
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

  // View Submission Modal state
  const [viewingSubmission, setViewingSubmission] = useState(null);

  // Copy feedback state
  const [copiedCode, setCopiedCode] = useState(null);

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

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/students/assignments');
      setAssignments(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
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
    setError('');

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
      setSuccessMsg(succMsg);

      // Trigger global refresh so Student Dashboard state updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('stude:refresh'));
      }

      await fetchAssignments();

      // Automatically return to student dashboard after 1.5 seconds
      setTimeout(() => {
        setIsSubmitModalOpen(false);
        setSelectedAssignForSubmit(null);
        setSubmissionContent('');
        setSelectedFile(null);
        setInputGroupCode('');
        setUploadProgress(0);
        setModalSuccess('');
        navigate('/student');
      }, 1500);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit assignment. Please try again.';
      setModalError(msg);
      setUploadProgress(0);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDueDate = (dateStr) => {
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
    const total = Date.parse(dueDateStr) - Date.now();
    if (total <= 0) return { expired: true, text: 'Deadline passed' };
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    if (days > 0) return { expired: false, text: `${days}d ${hours}h left` };
    const minutes = Math.floor((total / 1000 / 60) % 60);
    return { expired: false, text: `${hours}h ${minutes}m left` };
  };

  if (loading) return <LoadingSpinner message="Loading course assignments and group codes..." />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" />
            My Class Assignments & Group Projects
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Collaborate with your team using standardized Group Codes, track deadlines, and submit group assignments.
          </p>
        </div>
        <Link
          to="/student"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-xs transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
          <span>Return to Dashboard</span>
        </Link>
      </div>

      {error && <Alert type="error" title="Notice" message={error} onClose={() => setError('')} />}
      {successMsg && <Alert type="success" title="Success" message={successMsg} onClose={() => setSuccessMsg('')} />}

      {/* Assignment Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {assignments.length > 0 ? (
          assignments.map((a) => {
            const isGroup = a.assignment_type === 'GROUP';
            const remaining = getTimeRemaining(a.due_date);
            const isSubmitted = a.group_status === 'SUBMITTED';
            const isGraded = a.group_status === 'GRADED';
            const isPastDue = a.is_past_due || remaining.expired;

            return (
              <div
                key={a.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div>
                  {/* Top Bar: Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <Badge variant={isGroup ? 'primary' : 'neutral'} size="sm">
                      {isGroup ? 'Collaborative Group' : 'Individual'}
                    </Badge>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Max: <strong className="text-slate-800 dark:text-slate-200">{a.max_score}</strong> pts
                    </span>
                  </div>

                  {/* Title & Subject */}
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mb-1 leading-snug">
                    {a.title}
                  </h3>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2.5">
                    {a.subject_name} • Instructor: {a.teacher_first_name} {a.teacher_last_name}
                  </p>

                  {/* Instructions / Description */}
                  {(a.instructions || a.description) && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 mb-3.5 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      {a.instructions || a.description}
                    </p>
                  )}

                  {/* Teacher Attached Question Document / File */}
                  {a.file_url && (
                    <div className="mb-3.5 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/40 flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center shrink-0">
                          <Paperclip className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={a.file_name}>
                            {a.file_name || 'Question Document'}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            {a.file_size ? formatFileSize(a.file_size) : 'Question Document'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleViewAttachment(`/students/assignments/${a.id}/view`, `/students/assignments/${a.id}/download`, a.file_name, `assign-view-${a.id}`)}
                          disabled={viewingId === `assign-view-${a.id}`}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 shadow-xs disabled:opacity-50"
                          title="View Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{viewingId === `assign-view-${a.id}` ? 'Opening...' : 'View'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const target = `/students/assignments/${a.id}/download`;
                            handleDownloadFile(target, a.file_name || 'assignment-document', `assign-${a.id}`);
                          }}
                          disabled={downloadingId === `assign-${a.id}`}
                          className={`relative overflow-hidden px-2.5 py-1 text-xs font-semibold rounded-lg text-white transition-all flex items-center gap-1 shadow-xs ${
                            downloadingId === `assign-${a.id}` ? 'bg-blue-700 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                          title="Download Document"
                        >
                          {downloadingId === `assign-${a.id}` && downloadProgress[`assign-${a.id}`] !== undefined && (
                            <div
                              className="absolute inset-0 bg-blue-400/30 transition-all duration-150"
                              style={{ width: `${downloadProgress[`assign-${a.id}`]}%` }}
                            />
                          )}
                          <span className="relative z-10 flex items-center gap-1">
                            <Download className={`w-3.5 h-3.5 ${downloadingId === `assign-${a.id}` ? 'animate-bounce' : ''}`} />
                            <span>
                              {downloadingId === `assign-${a.id}`
                                ? (downloadProgress[`assign-${a.id}`] !== undefined
                                    ? `${downloadProgress[`assign-${a.id}`]}%`
                                    : 'Downloading...')
                                : 'Download'}
                            </span>
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Group Code Banner if assigned */}
                  {isGroup && (
                    <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 text-xs mb-3.5 space-y-2">
                      {a.group_code ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                              {a.group_name}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(a.group_code)}
                              className="inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-800/80 transition-colors"
                              title="Click to copy Group Code"
                            >
                              {copiedCode === a.group_code ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>{a.group_code}</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Teammates List */}
                          {a.teammates && a.teammates.length > 0 && (
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-emerald-200/50 dark:border-emerald-800/30 flex items-start gap-1">
                              <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span>
                                <strong>Team:</strong> {a.teammates.map((m) => `${m.first_name} ${m.last_name}`).join(', ')}
                              </span>
                            </div>
                          )}

                          {/* Submission Status Indicator */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              Status:
                            </span>
                            {isGraded ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                                Graded: {a.group_score} / {a.max_score} pts
                              </span>
                            ) : isSubmitted ? (
                              <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold text-[11px]">
                                Submitted
                              </span>
                            ) : isPastDue ? (
                              <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold text-[11px]">
                                Overdue - No Submission
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
                                Awaiting Submission
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="text-slate-500 dark:text-slate-400 italic text-center py-1">
                          Group assignment pending. Your teacher will assign you to a team code shortly.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status Banner for Individual Assignments */}
                  {!isGroup && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/50 text-xs mb-3.5 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Status:
                      </span>
                      {isGraded ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                          Graded: {a.group_score} / {a.max_score} pts
                        </span>
                      ) : isSubmitted ? (
                        <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold text-[11px]">
                          Submitted
                        </span>
                      ) : isPastDue ? (
                        <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold text-[11px]">
                          Overdue - No Submission
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
                          Awaiting Submission
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer: Due Date & Action Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDueDate(a.due_date)}
                    </span>
                    <span
                      className={`font-semibold flex items-center gap-1 text-[11px] ${
                        isPastDue
                          ? 'text-rose-600 dark:text-rose-400'
                          : remaining.text.includes('h left') || remaining.text.includes('m left')
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {remaining.text}
                    </span>
                  </div>

                  {/* Submission Buttons for All Assignments (Group & Individual) */}
                  <div className="pt-1 flex items-center justify-end gap-2">
                    {/* View submission if submitted or graded */}
                    {(isSubmitted || isGraded) && (a.submission_content || a.submission_file_url) && (
                      <button
                        type="button"
                        onClick={() => setViewingSubmission(a)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        View Work
                      </button>
                    )}

                    {/* Turn In / Edit work if before due date */}
                    {!isPastDue && (
                      <button
                        type="button"
                        onClick={() => openSubmitModal(a)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-all hover:shadow-md"
                      >
                        {isSubmitted ? (
                          <>
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Submission
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            Turn In Work
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-16 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            No active assignments or project groups assigned to your section at this time.
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: SUBMIT GROUP ASSIGNMENT WORK BEFORE DEADLINE                       */}
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
            ? `Submit Group Work: ${selectedAssignForSubmit?.title || ''}`
            : `Submit Assignment: ${selectedAssignForSubmit?.title || ''}`
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
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold">{modalSuccess}</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Returning to Student Dashboard...
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSubmitModalOpen(false);
                  navigate('/student');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 shadow-sm transition-all"
              >
                Return to Dashboard Now
              </button>
            </div>
          )}

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              {selectedAssignForSubmit?.assignment_type === 'GROUP' ? (
                <>
                  <Users className="w-4 h-4 text-emerald-600" />
                  {selectedAssignForSubmit?.group_code ? (
                    <span>Submitting for {selectedAssignForSubmit?.group_name} ({selectedAssignForSubmit?.group_code})</span>
                  ) : (
                    <span>Collaborative Group Submission</span>
                  )}
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
                ? `Any member of your group can upload or update the team's solution before the deadline (${formatDueDate(selectedAssignForSubmit?.due_date)}).`
                : `Upload your completed document or write your solutions below before the deadline (${formatDueDate(selectedAssignForSubmit?.due_date)}).`}
            </p>
          </div>

          {/* Teacher Attached Question File Reference in Modal */}
          {selectedAssignForSubmit?.file_url && (
            <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/40 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                    {selectedAssignForSubmit.file_name || 'Teacher Question Document'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatFileSize(selectedAssignForSubmit.file_size)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleViewAttachment(`/students/assignments/${selectedAssignForSubmit.id}/view`, `/students/assignments/${selectedAssignForSubmit.id}/download`, selectedAssignForSubmit.file_name, `modal-view-${selectedAssignForSubmit.id}`)}
                  disabled={viewingId === `modal-view-${selectedAssignForSubmit.id}`}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 shadow-xs disabled:opacity-50"
                >
                  <Eye className="w-3 h-3" />
                  <span>{viewingId === `modal-view-${selectedAssignForSubmit.id}` ? 'Opening...' : 'View'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = `/students/assignments/${selectedAssignForSubmit.id}/download`;
                    handleDownloadFile(target, selectedAssignForSubmit.file_name || 'assignment-document', `modal-prompt-${selectedAssignForSubmit.id}`);
                  }}
                  disabled={downloadingId === `modal-prompt-${selectedAssignForSubmit.id}`}
                  className={`relative overflow-hidden px-2.5 py-1 text-xs font-semibold rounded-lg text-white transition-all flex items-center gap-1 shadow-xs ${
                    downloadingId === `modal-prompt-${selectedAssignForSubmit.id}` ? 'bg-blue-700 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  title="Download Document"
                >
                  {downloadingId === `modal-prompt-${selectedAssignForSubmit.id}` && downloadProgress[`modal-prompt-${selectedAssignForSubmit.id}`] !== undefined && (
                    <div
                      className="absolute inset-0 bg-blue-400/30 transition-all duration-150"
                      style={{ width: `${downloadProgress[`modal-prompt-${selectedAssignForSubmit.id}`]}%` }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1">
                    <Download className={`w-3.5 h-3.5 ${downloadingId === `modal-prompt-${selectedAssignForSubmit.id}` ? 'animate-bounce' : ''}`} />
                    <span>
                      {downloadingId === `modal-prompt-${selectedAssignForSubmit.id}`
                        ? (downloadProgress[`modal-prompt-${selectedAssignForSubmit.id}`] !== undefined
                            ? `${downloadProgress[`modal-prompt-${selectedAssignForSubmit.id}`]}%`
                            : 'Downloading...')
                        : 'Download'}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Group Code Input if not pre-linked and it is a GROUP assignment */}
          {selectedAssignForSubmit?.assignment_type === 'GROUP' && !selectedAssignForSubmit?.group_code && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Group Code <span className="text-emerald-600 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. GROUP-MATH9-A-001"
                value={inputGroupCode}
                onChange={(e) => setInputGroupCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono uppercase text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Enter your team's Group Code provided by your instructor or teammates.
              </p>
            </div>
          )}

          {/* Document File Attachment Section */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Attach Assignment Document <span className="text-slate-400 font-normal">(Word .docx/.doc, PDF, Docs, etc.)</span>
            </label>
            <div className="p-4 border-2 border-dashed border-emerald-400/60 dark:border-emerald-600/40 rounded-2xl bg-emerald-50/30 dark:bg-emerald-950/20 text-center hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 transition-colors relative">
              <input
                type="file"
                id="assignment-file-input"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
                accept=".doc,.docx,.pdf,.txt,.rtf,.odt,.xls,.xlsx,.ppt,.pptx,.zip"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {selectedFile ? (
                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-xs">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Paperclip className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {selectedFile.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      ({formatFileSize(selectedFile.size)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors shrink-0"
                    title="Remove file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <UploadCloud className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Click to choose file from your device (phone, tablet, or PC)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Supports Word (.docx, .doc), PDF (.pdf), Excel, and document files up to 25MB
                  </p>
                </div>
              )}
            </div>
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

          {/* Solution Description / Text Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Solution Description & Submission Notes <span className="text-slate-400 font-normal">(Optional if document attached)</span>
            </label>
            <textarea
              rows={4}
              placeholder="Add methodology notes, executive summary, or answers..."
              value={submissionContent}
              onChange={(e) => setSubmissionContent(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y"
            />
          </div>

          {/* Real-time Upload Progress Bar */}
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
                  ? 'Streaming file directly to Cloudinary CDN from your device...'
                  : 'Securing submission and registering coursework for teacher evaluation...'}
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
                  <span>
                    {selectedAssignForSubmit?.assignment_type === 'GROUP'
                      ? 'Turn In Group Assignment'
                      : 'Turn In Assignment'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: VIEW SUBMISSION DETAILS                                            */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!viewingSubmission}
        onClose={() => setViewingSubmission(null)}
        title={
          viewingSubmission?.assignment_type === 'GROUP'
            ? `Group Submission: ${viewingSubmission?.title || ''}`
            : `Assignment Submission: ${viewingSubmission?.title || ''}`
        }
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <div>
              <div className="font-bold text-slate-900 dark:text-slate-100">
                {viewingSubmission?.group_name} ({viewingSubmission?.group_code})
              </div>
              {viewingSubmission?.submitted_at && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Submitted by {viewingSubmission?.submitter_first_name} {viewingSubmission?.submitter_last_name} on{' '}
                  {new Date(viewingSubmission?.submitted_at).toLocaleString()}
                </div>
              )}
            </div>
            {viewingSubmission?.group_score !== null && (
              <div className="text-right">
                <span className="px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                  Score: {viewingSubmission?.group_score} / {viewingSubmission?.max_score}
                </span>
              </div>
            )}
          </div>

          {/* If document file is attached */}
          {viewingSubmission?.submission_file_url && (
            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Paperclip className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {viewingSubmission.submission_file_name || 'Submitted Document'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {formatFileSize(viewingSubmission.submission_file_size)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleViewAttachment(`/students/assignments/submissions/${viewingSubmission.id}/view`, `/students/assignments/submissions/${viewingSubmission.id}/download`, viewingSubmission.submission_file_name, `sub-view-${viewingSubmission.id}`)}
                  disabled={viewingId === `sub-view-${viewingSubmission.id}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{viewingId === `sub-view-${viewingSubmission.id}` ? 'Opening...' : 'View'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = `/students/assignments/submissions/${viewingSubmission.id}/download`;
                    handleDownloadFile(target, viewingSubmission.submission_file_name || 'submission-document', `sub-${viewingSubmission.id}`);
                  }}
                  disabled={downloadingId === `sub-${viewingSubmission.id}`}
                  className={`relative overflow-hidden inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-sm transition-all ${
                    downloadingId === `sub-${viewingSubmission.id}` ? 'bg-emerald-700 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {downloadingId === `sub-${viewingSubmission.id}` && downloadProgress[`sub-${viewingSubmission.id}`] !== undefined && (
                    <div
                      className="absolute inset-0 bg-emerald-400/30 transition-all duration-150"
                      style={{ width: `${downloadProgress[`sub-${viewingSubmission.id}`]}%` }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1">
                    <Download className={`w-3.5 h-3.5 ${downloadingId === `sub-${viewingSubmission.id}` ? 'animate-bounce' : ''}`} />
                    <span>
                      {downloadingId === `sub-${viewingSubmission.id}`
                        ? (downloadProgress[`sub-${viewingSubmission.id}`] !== undefined
                            ? `${downloadProgress[`sub-${viewingSubmission.id}`]}%`
                            : 'Downloading...')
                        : 'Download'}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {viewingSubmission?.submission_content && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                Submitted Notes & Answers:
              </label>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto font-sans">
                {viewingSubmission?.submission_content}
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setViewingSubmission(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StudentAssignmentsPage;
