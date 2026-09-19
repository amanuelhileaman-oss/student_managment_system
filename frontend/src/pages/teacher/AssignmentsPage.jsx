import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  FileText,
  Plus,
  Users,
  Calendar,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Award,
  Search,
  Eye,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Paperclip,
  Download,
  Lock,
} from 'lucide-react';
import { resolveFileUrl, triggerFileDownload, triggerFilePreview } from '../../utils/fileUrl';

const AssignmentsPage = () => {
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
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

  const handleDownloadFile = async (target, fileName, key) => {
    try {
      setDownloadingId(key);
      setError('');
      await triggerFileDownload(target, fileName);
    } catch (err) {
      console.error('Download error:', err);
      setError(err.message || 'Failed to download file.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Helper to format file sizes
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Modals
  const [isCreateAssignOpen, setIsCreateAssignOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isViewGroupsOpen, setIsViewGroupsOpen] = useState(false);
  const [selectedAssignForGroup, setSelectedAssignForGroup] = useState(null);
  const [assignmentGroups, setAssignmentGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Section Students Roster for Group Creation
  const [sectionStudents, setSectionStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [onlyUnassignedFilter, setOnlyUnassignedFilter] = useState(false);
  const [expandedSubmissions, setExpandedSubmissions] = useState({});

  // Default due date helper: 7 days from now formatted for datetime-local
  const getDefaultDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [assignForm, setAssignForm] = useState({
    teacherAssignmentId: '',
    title: '',
    assignmentType: 'INDIVIDUAL',
    maxScore: 20,
    dueDate: '',
    instructions: '',
    semester: 1,
  });
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [assignmentFile, setAssignmentFile] = useState(null);
  const fileInputRef = useRef(null);

  const [formError, setFormError] = useState('');

  const [groupForm, setGroupForm] = useState({
    groupName: '',
  });

  const [scoreForm, setScoreForm] = useState({
    groupCode: '',
    groupScore: '',
  });

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [aRes, cRes] = await Promise.all([
        api.get('/teachers/assignments'),
        api.get('/teachers/classes'),
      ]);
      const fetchedAssignments = aRes.data.data || [];
      const fetchedClasses = cRes.data.data || [];
      setAssignments(fetchedAssignments);
      setClasses(fetchedClasses);

      if (fetchedClasses.length > 0) {
        setAssignForm((prev) => ({
          ...prev,
          teacherAssignmentId: prev.teacherAssignmentId || fetchedClasses[0].assignment_id,
        }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch assignments and classes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setFormError('');
    setAssignmentFile(null);
    // Find active or default semester from assignments or fallback to 1
    const defaultSem = assignments.find((a) => a.semester)?.semester || 1;
    setAssignForm({
      teacherAssignmentId: classes[0]?.assignment_id || '',
      title: '',
      assignmentType: 'INDIVIDUAL',
      maxScore: 20,
      dueDate: getDefaultDueDate(),
      instructions: '',
      semester: defaultSem,
    });
    setIsCreateAssignOpen(true);
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!assignForm.teacherAssignmentId) {
      setFormError('Please select a designated class from the list.');
      return;
    }
    if (!assignForm.title.trim()) {
      setFormError('Please enter a title for the assignment.');
      return;
    }
    if (!assignForm.dueDate) {
      setFormError('Please select a valid submission due date.');
      return;
    }
    if (Number(assignForm.maxScore) <= 0) {
      setFormError('Maximum score must be greater than zero.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('teacherAssignmentId', String(assignForm.teacherAssignmentId));
      formData.append('title', assignForm.title.trim());
      formData.append('description', assignForm.instructions.trim());
      formData.append('assignmentType', assignForm.assignmentType);
      formData.append('maxScore', String(assignForm.maxScore));
      formData.append('dueDate', assignForm.dueDate);
      formData.append('instructions', assignForm.instructions.trim());
      formData.append('semester', String(assignForm.semester || 1));
      if (assignmentFile) {
        formData.append('file', assignmentFile);
      }

      const res = await api.post('/teachers/assignments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccessMsg(res.data.message || 'Assignment created successfully.');
      setIsCreateAssignOpen(false);
      setAssignmentFile(null);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to create assignment.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssignment = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete assignment "${title}"?`)) return;
    setDeletingId(id);
    try {
      const res = await api.delete(`/teachers/assignments/${id}`);
      setSuccessMsg(res.data.message || 'Assignment deleted successfully.');
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete assignment.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenGroupsModal = async (assignment) => {
    setSelectedAssignForGroup(assignment);
    setIsViewGroupsOpen(true);
    setLoadingGroups(true);
    try {
      const res = await api.get(`/teachers/assignments/${assignment.id}/groups`);
      setAssignmentGroups(res.data.data || []);
    } catch (err) {
      setError('Failed to fetch groups for this assignment.');
    } finally {
      setLoadingGroups(false);
    }
  };

  const openCreateGroupModal = async (assignment) => {
    setSelectedAssignForGroup(assignment);
    setGroupForm({ groupName: '' });
    setSelectedStudentIds([]);
    setStudentSearch('');
    setOnlyUnassignedFilter(false);
    setIsCreateGroupOpen(true);
    setLoadingStudents(true);
    try {
      const res = await api.get(`/teachers/assignments/${assignment.id}/students`);
      setSectionStudents(res.data.data?.students || []);
    } catch (err) {
      setError('Failed to load enrolled students for this class.');
    } finally {
      setLoadingStudents(false);
    }
  };

  const toggleStudentSelection = (studentId) => {
    const student = sectionStudents.find((s) => s.student_id === studentId);
    if (student?.current_group_id) {
      setError(`Cannot select ${student.first_name} ${student.last_name}: already assigned to group "${student.current_group_name || student.current_group_code}".`);
      return;
    }
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSelectAllUnassigned = () => {
    const unassigned = sectionStudents
      .filter((s) => !s.current_group_id)
      .map((s) => s.student_id);
    setSelectedStudentIds(unassigned);
  };

  const toggleSubmissionExpand = (groupId) => {
    setExpandedSubmissions((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!selectedAssignForGroup) return;
    if (!groupForm.groupName.trim()) {
      setError('Please provide a team group name.');
      return;
    }

    // Filter to ensure only unassigned students can be submitted
    const cleanStudentIds = selectedStudentIds.filter((id) => {
      const st = sectionStudents.find((s) => s.student_id === id);
      return st && !st.current_group_id;
    });

    setSaving(true);
    setError('');

    try {
      const res = await api.post('/teachers/assignments/groups', {
        assignmentId: selectedAssignForGroup.id,
        groupName: groupForm.groupName.trim(),
        studentIds: cleanStudentIds,
      });
      setSuccessMsg(res.data.message || 'Project group created successfully.');
      setIsCreateGroupOpen(false);
      setGroupForm({ groupName: '' });
      setSelectedStudentIds([]);
      fetchData();
      if (isViewGroupsOpen) {
        handleOpenGroupsModal(selectedAssignForGroup);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create project group.');
    } finally {
      setSaving(false);
    }
  };

  const handleScoreGroup = async (e) => {
    e.preventDefault();
    if (!scoreForm.groupCode || scoreForm.groupScore === '') return;
    setSaving(true);
    try {
      const res = await api.post('/teachers/assignments/groups/score', {
        groupCode: scoreForm.groupCode,
        groupScore: Number(scoreForm.groupScore),
      });
      setSuccessMsg(res.data.message || 'Group score saved.');
      setScoreForm({ groupCode: '', groupScore: '' });
      if (selectedAssignForGroup) {
        handleOpenGroupsModal(selectedAssignForGroup);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit group score.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading course assignments and student groups..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" />
            Course Assignments & Group Projects
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Create homework, lab reports, and collaborative group assignments with standardized group codes.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold shadow-sm transition-all shrink-0 hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          Create New Assignment
        </button>
      </div>

      {/* Global Alerts */}
      {error && <Alert type="error" title="Error" message={error} onClose={() => setError('')} />}
      {successMsg && <Alert type="success" title="Success" message={successMsg} onClose={() => setSuccessMsg('')} />}

      {/* Semester Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSemesterFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            semesterFilter === 'ALL'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          All Assignments ({assignments.length})
        </button>
        <button
          type="button"
          onClick={() => setSemesterFilter('1')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            semesterFilter === '1'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
          }`}
        >
          <span>🍂 Semester 1</span>
          <span className="text-[11px] opacity-80">
            ({assignments.filter((a) => Number(a.semester) === 1).length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSemesterFilter('2')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            semesterFilter === '2'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40'
          }`}
        >
          <span>🌸 Semester 2</span>
          <span className="text-[11px] opacity-80">
            ({assignments.filter((a) => Number(a.semester) === 2).length})
          </span>
        </button>
      </div>

      {/* Notice if Teacher has no assigned classes */}
      {classes.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block mb-0.5">No Designated Classes Assigned Yet</strong>
            Your teacher account currently has no subject/section assignments in the database. Please contact an administrator to assign your courses in <strong>Admin &gt; Teacher Assignments</strong> so you can publish assignments to students.
          </div>
        </div>
      )}

      {/* Assignment Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {assignments
          .filter((a) => {
            if (semesterFilter === '1') return Number(a.semester) === 1;
            if (semesterFilter === '2') return Number(a.semester) === 2;
            return true;
          })
          .length > 0 ? (
          assignments
            .filter((a) => {
              if (semesterFilter === '1') return Number(a.semester) === 1;
              if (semesterFilter === '2') return Number(a.semester) === 2;
              return true;
            })
            .map((a) => (
            <div
              key={a.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant={a.assignment_type === 'GROUP' ? 'primary' : 'neutral'} size="sm">
                      {a.assignment_type === 'GROUP' ? 'Collaborative Group' : 'Individual'}
                    </Badge>
                    {Number(a.semester) === 2 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        🌸 Sem 2
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        🍂 Sem 1
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Max: <strong className="text-slate-800 dark:text-slate-200">{a.max_score}</strong> pts
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1 leading-snug">
                  {a.title}
                </h3>
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-3">
                  {a.subject_name} • Grade {a.grade_level} (Section {a.section_name})
                </p>

                {(a.instructions || a.description) && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 mb-3 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    {a.instructions || a.description}
                  </p>
                )}

                {/* Attached Question Document / File */}
                {a.file_url && (
                  <div className="mb-3 p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center shrink-0">
                        <Paperclip className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {a.file_name || 'Question Document'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {a.file_size ? formatFileSize(a.file_size) : 'Attached File'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleViewAttachment(`/teachers/assignments/${a.id}/view`, `/teachers/assignments/${a.id}/download`, a.file_name || 'document.pdf', `assign-view-${a.id}`)}
                        disabled={viewingId === `assign-view-${a.id}`}
                        className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/60 hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 shadow-xs disabled:opacity-50"
                        title="View Document"
                      >
                        <Eye className="w-3 h-3" />
                        <span>{viewingId === `assign-view-${a.id}` ? 'Opening...' : 'View'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(`/teachers/assignments/${a.id}/download`, a.file_name || 'assignment-document', `assign-dl-${a.id}`)}
                        disabled={downloadingId === `assign-dl-${a.id}`}
                        className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
                        title="Download Document"
                      >
                        <Download className={`w-3.5 h-3.5 ${downloadingId === `assign-dl-${a.id}` ? 'animate-bounce' : ''}`} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Due: <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(a.due_date).toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                {a.assignment_type === 'GROUP' ? (
                  <div className="flex items-center justify-between w-full">
                    <button
                      onClick={() => handleOpenGroupsModal(a)}
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Users className="w-3.5 h-3.5" />
                      {a.group_count || 0} groups
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openCreateGroupModal(a)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                      >
                        + Add Group Code
                      </button>
                      <button
                        onClick={() => handleDeleteAssignment(a.id, a.title)}
                        disabled={deletingId === a.id}
                        title="Delete Assignment"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs text-slate-400">Individual Submissions</span>
                    <button
                      onClick={() => handleDeleteAssignment(a.id, a.title)}
                      disabled={deletingId === a.id}
                      title="Delete Assignment"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-16 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40">
            <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">No Assignments Created Yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
              Get started by clicking the button below to publish your first coursework, homework, or collaborative group task.
            </p>
            <button
              onClick={openCreateModal}
              disabled={classes.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Create New Assignment
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREATE NEW ASSIGNMENT (Matches user reference UI screenshot)         */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCreateAssignOpen}
        onClose={() => setIsCreateAssignOpen(false)}
        title="Create New Assignment"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Field: Designated Class */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Designated Class
            </label>
            {classes.length > 0 ? (
              <div className="relative">
                <select
                  value={assignForm.teacherAssignmentId}
                  onChange={(e) => setAssignForm({ ...assignForm, teacherAssignmentId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none pr-9 cursor-pointer transition-colors"
                >
                  <option value="">Select a designated class...</option>
                  {classes.map((c) => (
                    <option key={c.assignment_id} value={c.assignment_id}>
                      {c.subject_name} — Grade {c.grade_level} (Section {c.section_name})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/30 text-xs text-amber-700 dark:text-amber-300">
                No classes assigned to your profile yet. Please ask an admin to assign your section first.
              </div>
            )}
          </div>

          {/* Field: Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Physics Thermodynamics Lab Report"
              value={assignForm.title}
              onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
            />
          </div>

          {/* Field: Academic Semester Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Target Academic Semester
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAssignForm({ ...assignForm, semester: 1 })}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  Number(assignForm.semester) === 1
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>🍂 Semester 1</span>
              </button>
              <button
                type="button"
                onClick={() => setAssignForm({ ...assignForm, semester: 2 })}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  Number(assignForm.semester) === 2
                    ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-500 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>🌸 Semester 2</span>
              </button>
            </div>
          </div>

          {/* Row: Assignment Type & Maximum Score */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Assignment Type
              </label>
              <div className="relative">
                <select
                  value={assignForm.assignmentType}
                  onChange={(e) => setAssignForm({ ...assignForm, assignmentType: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none pr-9 cursor-pointer transition-colors"
                >
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="GROUP">Collaborative Group</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Maximum Score
              </label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={assignForm.maxScore}
                onChange={(e) => setAssignForm({ ...assignForm, maxScore: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Field: Submission Due Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Submission Due Date
            </label>
            <input
              type="datetime-local"
              required
              value={assignForm.dueDate}
              onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
            />
          </div>

          {/* Field: Instructions */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Instructions
            </label>
            <textarea
              rows={3}
              value={assignForm.instructions}
              onChange={(e) => setAssignForm({ ...assignForm, instructions: e.target.value })}
              placeholder="Guidance for students..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors resize-none"
            />
          </div>

          {/* Field: Document / File Attachment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Attach Question Document / File (Optional)
              </span>
              <span className="text-[10px] text-slate-400 font-normal">PDF, Word, PPT, Worksheets up to 25MB</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf,.odt,.ods,.odp,.zip,.rar,.7z,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 25 * 1024 * 1024) {
                    setFormError('File size exceeds maximum allowed limit of 25MB.');
                    return;
                  }
                  setAssignmentFile(f);
                  setFormError('');
                }
              }}
            />

            {!assignmentFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-slate-50/50 dark:bg-slate-800/40 hover:bg-emerald-50/20 transition-all text-center group select-none"
              >
                <Paperclip className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Click to select or drag & drop question document
                </span>
                <span className="text-[11px] text-slate-400">
                  Supports Word (.docx, .doc), PDF (.pdf), PowerPoint, Excel, and documents up to 25MB
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {assignmentFile.name}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {formatFileSize(assignmentFile.size)} • Ready to upload
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-700"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignmentFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Remove attached file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions: Cancel and Create Assignment */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateAssignOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || classes.length === 0}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 hover:shadow-md flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                'Create Assignment'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: CREATE GROUP & GENERATE CODE WITH STUDENT ROSTER                   */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        title={`Add Project Group: ${selectedAssignForGroup?.title || ''}`}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Create a collaborative project group with a unique Group Code (e.g. <code>GROUP-MATH-A-XXXX</code>). Select the enrolled students in this section to include in the team.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Group Team Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Calculus Champions / Team Alpha"
              value={groupForm.groupName}
              onChange={(e) => setGroupForm({ ...groupForm, groupName: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* Section Student Selection Roster */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Select Section Students ({selectedStudentIds.length} selected)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllUnassigned}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                >
                  Select All Unassigned
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds([])}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search students by name or ID..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 shrink-0 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyUnassignedFilter}
                  onChange={(e) => setOnlyUnassignedFilter(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                />
                <span>Unassigned only</span>
              </label>
            </div>

            {/* Student List */}
            <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/60 p-1">
              {loadingStudents ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading section student roster...</div>
              ) : sectionStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No students enrolled in this section yet.</div>
              ) : (
                sectionStudents
                  .filter((s) => {
                    const matchesSearch =
                      `${s.first_name} ${s.last_name}`.toLowerCase().includes(studentSearch.toLowerCase()) ||
                      s.student_code.toLowerCase().includes(studentSearch.toLowerCase());
                    const matchesFilter = onlyUnassignedFilter ? !s.current_group_id : true;
                    return matchesSearch && matchesFilter;
                  })
                  .map((s) => {
                    const isSelected = selectedStudentIds.includes(s.student_id);
                    const isAlreadyInGroup = !!s.current_group_id;

                    return (
                      <div
                        key={s.student_id}
                        onClick={() => {
                          if (isAlreadyInGroup) {
                            setError(`Cannot select ${s.first_name} ${s.last_name}: already assigned to group "${s.current_group_name || s.current_group_code}".`);
                            return;
                          }
                          toggleStudentSelection(s.student_id);
                        }}
                        className={`p-2.5 rounded-lg flex items-center justify-between transition-colors ${
                          isAlreadyInGroup
                            ? 'opacity-60 cursor-not-allowed bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80 select-none'
                            : isSelected
                            ? 'cursor-pointer bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300/60 dark:border-emerald-800/60'
                            : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isAlreadyInGroup}
                            onChange={() => {}} // Handled by outer div
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 pointer-events-none disabled:opacity-40"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <span>{s.first_name} {s.last_name}</span>
                              {isAlreadyInGroup && (
                                <Lock className="w-3 h-3 text-amber-500 shrink-0" title="Already assigned to a group" />
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {s.student_code}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          {isAlreadyInGroup ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[11px] font-medium border border-amber-200 dark:border-amber-800/60">
                              <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>In {s.current_group_name || s.current_group_code}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium border border-emerald-200 dark:border-emerald-800/60">
                              Available
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateGroupOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !groupForm.groupName.trim()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
            >
              {saving ? 'Generating...' : `Create Group (${selectedStudentIds.length} Members)`}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: VIEW GROUPS & SCORE TEAM ASSIGNMENTS                               */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isViewGroupsOpen}
        onClose={() => setIsViewGroupsOpen(false)}
        title={`Project Groups for: ${selectedAssignForGroup?.title || ''}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Assigned project teams, member rosters, student submissions, and auto-propagated grading.
            </p>
            <button
              onClick={() => openCreateGroupModal(selectedAssignForGroup)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add New Group
            </button>
          </div>

          {loadingGroups ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading groups...</div>
          ) : assignmentGroups.length > 0 ? (
            <div className="space-y-3">
              {assignmentGroups.map((g) => {
                const isExpanded = !!expandedSubmissions[g.id];

                return (
                  <div
                    key={g.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex flex-col gap-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{g.group_name}</h4>
                          <span className="font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            {g.group_code?.includes('-S2-') ? (
                              <span className="text-[10px] px-1 rounded bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-bold">🌸 Sem 2</span>
                            ) : (
                              <span className="text-[10px] px-1 rounded bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 font-bold">🍂 Sem 1</span>
                            )}
                            <span>{g.group_code}</span>
                          </span>
                          {g.status === 'SUBMITTED' ? (
                            <Badge variant="success" size="sm">Submitted</Badge>
                          ) : g.status === 'GRADED' ? (
                            <Badge variant="primary" size="sm">Graded</Badge>
                          ) : g.is_overdue ? (
                            <Badge variant="danger" size="sm">Overdue</Badge>
                          ) : (
                            <Badge variant="warning" size="sm">Pending</Badge>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {g.members && g.members.length > 0 ? (
                            <span>
                              Members ({g.members.length}):{' '}
                              {g.members.map((m) => `${m.first_name} ${m.last_name}`).join(', ')}
                            </span>
                          ) : (
                            <span className="italic text-slate-400">No students assigned yet</span>
                          )}
                        </div>

                        {g.submitted_at && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Submitted by {g.submitter_first_name} {g.submitter_last_name} on {new Date(g.submitted_at).toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(g.submission_content || g.submission_file_url) && (
                          <button
                            type="button"
                            onClick={() => toggleSubmissionExpand(g.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 shadow-xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            {isExpanded ? 'Hide Work' : 'View Work'}
                            {g.submission_file_url && (
                              <Paperclip className="w-3 h-3 text-emerald-600" title="Document Attached" />
                            )}
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        {g.group_score !== null ? (
                          <span className="px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                            Score: {g.group_score} / {selectedAssignForGroup?.max_score}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Ungraded</span>
                        )}

                        <button
                          onClick={() =>
                            setScoreForm({
                              groupCode: g.group_code,
                              groupScore: g.group_score !== null ? g.group_score : '',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
                        >
                          Grade Group
                        </button>
                      </div>
                    </div>

                    {/* Expandable Submission Content & Document Viewer */}
                    {isExpanded && (g.submission_content || g.submission_file_url) && (
                      <div className="mt-1 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 space-y-3 text-xs">
                        {/* Document File Card if submitted */}
                        {g.submission_file_url && (
                          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                                <Paperclip className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {g.submission_file_name || 'Delivered Assignment Document'}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {formatFileSize(g.submission_file_size)} • {g.submission_file_type || 'Document'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleViewAttachment(`/teachers/assignments/submissions/${g.id}/view`, `/teachers/assignments/submissions/${g.id}/download`, g.submission_file_name || 'submission.pdf', `sub-view-${g.id}`)}
                                disabled={viewingId === `sub-view-${g.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-xs hover:bg-emerald-50 transition-all disabled:opacity-50"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{viewingId === `sub-view-${g.id}` ? 'Opening...' : 'View'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadFile(`/teachers/assignments/submissions/${g.id}/download`, g.submission_file_name || 'submission-document', `sub-dl-${g.id}`)}
                                disabled={downloadingId === `sub-dl-${g.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                              >
                                <Download className={`w-3.5 h-3.5 ${downloadingId === `sub-dl-${g.id}` ? 'animate-bounce' : ''}`} />
                                <span>{downloadingId === `sub-dl-${g.id}` ? 'Downloading...' : 'Download'}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Written Content / Notes */}
                        {g.submission_content && (
                          <div>
                            <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                              <FileCheck className="w-4 h-4 text-emerald-600" />
                              Student Submission Notes & Answers:
                            </div>
                            <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300 leading-relaxed font-sans p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                              {g.submission_content}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No groups created for this assignment yet. Click "+ Add New Group" to select section students and generate group codes.
            </div>
          )}

          {/* Quick Score Drawer/Form */}
          {scoreForm.groupCode && (
            <form onSubmit={handleScoreGroup} className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center gap-3">
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                Grade {scoreForm.groupCode}:
              </span>
              <input
                type="number"
                min="0"
                max={selectedAssignForGroup?.max_score || 50}
                step="0.5"
                required
                placeholder="Score"
                value={scoreForm.groupScore}
                onChange={(e) => setScoreForm({ ...scoreForm, groupScore: e.target.value })}
                className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Grade'}
              </button>
              <button
                type="button"
                onClick={() => setScoreForm({ groupCode: '', groupScore: '' })}
                className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </form>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setIsViewGroupsOpen(false)}
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

export default AssignmentsPage;

