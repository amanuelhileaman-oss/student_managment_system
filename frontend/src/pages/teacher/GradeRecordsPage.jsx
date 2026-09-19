import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { CheckSquare, Users, Edit3, Save, Sparkles, CheckCircle2, RefreshCw, BookOpen, AlertCircle, ArrowLeft, Download, Check } from 'lucide-react';

const GradeRecordsPage = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const [classes, setClasses] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(queryParams.get('subjectId') || '');
  const [selectedSectionId, setSelectedSectionId] = useState(queryParams.get('sectionId') || '');
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [activeSemester, setActiveSemester] = useState(1);

  const [grades, setGrades] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [savingRow, setSavingRow] = useState(null);
  const [syncingScores, setSyncingScores] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Group score distribution modal
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupCodeInput, setGroupCodeInput] = useState('');
  const [groupScoreInput, setGroupScoreInput] = useState(18);
  const [groupSubmitting, setGroupSubmitting] = useState(false);

  // Edit single grade modal
  const [editingStudent, setEditingStudent] = useState(null);
  const [scoresForm, setScoresForm] = useState({
    quizScore: 0,
    midtermScore: 0,
    assignmentScore: 0,
    finalScore: 0,
    remarks: '',
  });
  const [customGroupCodeInput, setCustomGroupCodeInput] = useState('');
  const [importingGroup, setImportingGroup] = useState(false);
  const [groupImportMsg, setGroupImportMsg] = useState({ type: '', text: '' });
  const [quickImportingId, setQuickImportingId] = useState(null);

  // Helper to compute letter grade
  const calculateGradeBadge = (total) => {
    const score = parseFloat(total);
    if (isNaN(score)) return '—';
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'B-';
    if (score >= 60) return 'C+';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  };

  // Open Enter Marks modal for a student
  const openEnterMarksModal = (row) => {
    setEditingStudent(row);
    // Pre-fill assignment score: if row has assignment_score, use it;
    // else if row has evaluated_group_score, pre-fill it!
    const defaultAssignment =
      row.assignment_score !== null && row.assignment_score !== undefined
        ? row.assignment_score
        : row.evaluated_group_score !== null && row.evaluated_group_score !== undefined
        ? row.evaluated_group_score
        : 0;

    setScoresForm({
      quizScore: row.quiz_score !== null && row.quiz_score !== undefined ? row.quiz_score : 0,
      midtermScore: row.midterm_score !== null && row.midterm_score !== undefined ? row.midterm_score : 0,
      assignmentScore: defaultAssignment,
      finalScore: row.final_score !== null && row.final_score !== undefined ? row.final_score : 0,
      remarks: row.remarks || '',
    });
    setCustomGroupCodeInput(row.group_code || '');
    if (row.evaluated_group_score !== null && row.evaluated_group_score !== undefined) {
      setGroupImportMsg({
        type: 'info',
        text: `Group Code "${row.group_code}" has evaluated score of ${row.evaluated_group_score} pts. Click "Import Group Code" to automatically receive and calculate it.`,
      });
    } else {
      setGroupImportMsg({ type: '', text: '' });
    }
  };

  // Single-pass data loader: loads classes and initial roster in 1 fast flow
  const loadGradeBook = async (preferredSubId = null, preferredSecId = null) => {
    try {
      setPageLoading(true);
      setError('');

      const res = await api.get('/teachers/classes');
      const classList = res.data?.data || [];
      setClasses(classList);

      if (classList.length === 0) {
        setGrades([]);
        setSelectedSubjectId('');
        setSelectedSectionId('');
        setPageLoading(false);
        return;
      }

      // Determine target subject & section
      const targetSub = preferredSubId || queryParams.get('subjectId') || selectedSubjectId;
      const targetSec = preferredSecId || queryParams.get('sectionId') || selectedSectionId;

      let matchedClass = classList.find(
        (c) => String(c.subject_id) === String(targetSub) && String(c.section_id) === String(targetSec)
      );

      if (!matchedClass) {
        matchedClass = classList[0];
      }

      const finalSubId = String(matchedClass.subject_id);
      const finalSecId = String(matchedClass.section_id);
      setSelectedSubjectId(finalSubId);
      setSelectedSectionId(finalSecId);

      // Fetch grades for this class and semester immediately
      const gradesRes = await api.get(`/teachers/grades?subjectId=${finalSubId}&sectionId=${finalSecId}&semester=${selectedSemester}`);
      setGrades(gradesRes.data?.data || []);
      if (gradesRes.data?.activeSemester) setActiveSemester(gradesRes.data.activeSemester);
      if (gradesRes.data?.selectedSemester) setSelectedSemester(gradesRes.data.selectedSemester);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve grade book records.');
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadGradeBook();
  }, []);

  // Handle instant class switching without full page reload
  const handleClassChange = async (newSubjectId, newSectionId) => {
    setSelectedSubjectId(newSubjectId);
    setSelectedSectionId(newSectionId);
    try {
      setGradesLoading(true);
      setError('');
      const res = await api.get(`/teachers/grades?subjectId=${newSubjectId}&sectionId=${newSectionId}&semester=${selectedSemester}`);
      setGrades(res.data?.data || []);
      if (res.data?.activeSemester) setActiveSemester(res.data.activeSemester);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load grade records for the selected class.');
    } finally {
      setGradesLoading(false);
    }
  };

  // Switch semester view (Semester 1 <-> Semester 2)
  const handleSemesterChange = async (newSem) => {
    if (newSem === selectedSemester) return;
    setSelectedSemester(newSem);
    if (!selectedSubjectId || !selectedSectionId) return;
    try {
      setGradesLoading(true);
      setError('');
      const res = await api.get(`/teachers/grades?subjectId=${selectedSubjectId}&sectionId=${selectedSectionId}&semester=${newSem}`);
      setGrades(res.data?.data || []);
      if (res.data?.activeSemester) setActiveSemester(res.data.activeSemester);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to switch semester grade records.');
    } finally {
      setGradesLoading(false);
    }
  };

  // Reload current roster and grades (e.g. after editing)
  const refreshCurrentGrades = async () => {
    if (!selectedSubjectId || !selectedSectionId) return;
    try {
      setGradesLoading(true);
      setError('');
      const res = await api.get(`/teachers/grades?subjectId=${selectedSubjectId}&sectionId=${selectedSectionId}&semester=${selectedSemester}`);
      setGrades(res.data?.data || []);
      if (res.data?.activeSemester) setActiveSemester(res.data.activeSemester);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to refresh grade records.');
    } finally {
      setGradesLoading(false);
    }
  };

  // Handle single grade update
  const handleSaveGrade = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;
    setError('');
    setSavingRow(editingStudent.student_id);

    try {
      await api.post('/teachers/grades', {
        studentId: editingStudent.student_id,
        subjectId: parseInt(selectedSubjectId, 10),
        sectionId: parseInt(selectedSectionId, 10),
        semester: selectedSemester,
        ...scoresForm,
      });
      setSuccessMsg(`Grade successfully recorded for ${editingStudent.first_name} ${editingStudent.last_name} (Semester ${selectedSemester}).`);
      setEditingStudent(null);
      await refreshCurrentGrades();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record grade.');
    } finally {
      setSavingRow(null);
    }
  };

  // Import group score into the Enter Marks modal form automatically
  const handleImportGroupCode = async (codeToUse) => {
    const code = (codeToUse || customGroupCodeInput || editingStudent?.group_code || '').trim().toUpperCase();
    if (!code) {
      setGroupImportMsg({
        type: 'error',
        text: 'Please enter a valid Group Code (e.g. GROUP-MATH9-A-001).',
      });
      return;
    }

    setImportingGroup(true);
    setGroupImportMsg({ type: '', text: '' });

    try {
      // 1. If editingStudent belongs to this group code and evaluated_group_score is available
      if (
        editingStudent?.group_code &&
        editingStudent.group_code.toUpperCase() === code &&
        editingStudent.evaluated_group_score !== null &&
        editingStudent.evaluated_group_score !== undefined
      ) {
        const score = parseFloat(editingStudent.evaluated_group_score);
        setScoresForm((prev) => ({
          ...prev,
          assignmentScore: score,
        }));
        setGroupImportMsg({
          type: 'success',
          text: `✓ Successfully received evaluated assignment score of ${score} pts from Group Code "${code}"! Added automatically to Midterm and Final.`,
        });
        setImportingGroup(false);
        return;
      }

      // 2. Fetch the group from the backend API
      const res = await api.get(`/teachers/assignments/groups/by-code/${encodeURIComponent(code)}`);
      const groupData = res.data?.data;

      if (!groupData) {
        setGroupImportMsg({
          type: 'error',
          text: `Group Code "${code}" not found for this teacher's classes.`,
        });
        return;
      }

      if (groupData.group_score === null || groupData.group_score === undefined) {
        setGroupImportMsg({
          type: 'error',
          text: `Group Code "${code}" found (${groupData.group_name}), but its worked assignment has not been evaluated/graded by the teacher yet in Course Assignments.`,
        });
        return;
      }

      const score = parseFloat(groupData.group_score);
      setScoresForm((prev) => ({
        ...prev,
        assignmentScore: score,
      }));
      setGroupImportMsg({
        type: 'success',
        text: `✓ Successfully received evaluated assignment score of ${score} pts from Group Code "${code}" (${groupData.group_name})! Added automatically to Midterm and Final.`,
      });
    } catch (err) {
      setGroupImportMsg({
        type: 'error',
        text: err.response?.data?.message || `Failed to receive group result for "${code}".`,
      });
    } finally {
      setImportingGroup(false);
    }
  };

  // Quick 1-click import directly from the table row
  const handleQuickImportRow = async (row) => {
    if (!row.group_code) return;
    setQuickImportingId(row.student_id);
    setError('');
    setSuccessMsg('');

    try {
      let score = null;
      if (row.evaluated_group_score !== null && row.evaluated_group_score !== undefined) {
        score = parseFloat(row.evaluated_group_score);
      } else {
        const res = await api.get(`/teachers/assignments/groups/by-code/${encodeURIComponent(row.group_code)}`);
        if (res.data?.data?.group_score !== null && res.data?.data?.group_score !== undefined) {
          score = parseFloat(res.data.data.group_score);
        } else {
          setError(`Group ${row.group_code} has not been evaluated yet in Course Assignments.`);
          setQuickImportingId(null);
          return;
        }
      }

      await api.post('/teachers/grades', {
        studentId: row.student_id,
        subjectId: parseInt(selectedSubjectId, 10),
        sectionId: parseInt(selectedSectionId, 10),
        semester: selectedSemester,
        quizScore: row.quiz_score !== null && row.quiz_score !== undefined ? row.quiz_score : 0,
        midtermScore: row.midterm_score !== null && row.midterm_score !== undefined ? row.midterm_score : 0,
        assignmentScore: score,
        finalScore: row.final_score !== null && row.final_score !== undefined ? row.final_score : 0,
        remarks: row.remarks || `Imported score from group ${row.group_code} (Sem ${selectedSemester})`,
      });

      setSuccessMsg(`✓ Imported group score (${score} pts) from ${row.group_code} for ${row.first_name} ${row.last_name} (Semester ${selectedSemester})!`);
      await refreshCurrentGrades();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to import group score for student.');
    } finally {
      setQuickImportingId(null);
    }
  };

  // Handle Group Score Propagation
  const handleGroupScoreSubmit = async (e) => {
    e.preventDefault();
    if (!groupCodeInput.trim()) return;
    setGroupSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.post('/teachers/assignments/groups/score', {
        groupCode: groupCodeInput.trim(),
        groupScore: parseFloat(groupScoreInput),
      });
      setSuccessMsg(res.data?.message || 'Group score propagated successfully to all members.');
      setIsGroupModalOpen(false);
      setGroupCodeInput('');
      await refreshCurrentGrades();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to propagate group score.');
    } finally {
      setGroupSubmitting(false);
    }
  };

  // Handle Sync All Section Group Scores
  const handleSyncAllGroups = async () => {
    if (!selectedSubjectId || !selectedSectionId) return;
    setSyncingScores(true);
    setError('');
    try {
      const res = await api.post('/teachers/grades/sync-groups', {
        subjectId: parseInt(selectedSubjectId, 10),
        sectionId: parseInt(selectedSectionId, 10),
        semester: parseInt(selectedSemester, 10) || 1,
      });
      setSuccessMsg(res.data.message || 'Group scores synchronized successfully into grade records.');
      await refreshCurrentGrades();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to sync group scores.');
    } finally {
      setSyncingScores(false);
    }
  };

  const selectedClassInfo = classes.find(
    (c) => String(c.subject_id) === String(selectedSubjectId) && String(c.section_id) === String(selectedSectionId)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-emerald-600" />
            Faculty Grade Book & Assessments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Record quiz, midterm, final marks, and automatically propagate group project scores by Group Code.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Semester Selector Pill */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleSemesterChange(1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedSemester === 1
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm border border-slate-200/80 dark:border-slate-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <span>🍂 Semester 1</span>
              {activeSemester === 1 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Active Institutional Semester" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSemesterChange(2)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedSemester === 2
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm border border-slate-200/80 dark:border-slate-800'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <span>🌸 Semester 2</span>
              {activeSemester === 2 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Active Institutional Semester" />
              )}
            </button>
          </div>

          {classes.length > 0 && (
            <button
              type="button"
              onClick={refreshCurrentGrades}
              disabled={gradesLoading || pageLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50"
              title="Refresh Grade Book"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${gradesLoading ? 'animate-spin text-emerald-600' : ''}`} />
              <span>Refresh</span>
            </button>
          )}

          {selectedSubjectId && selectedSectionId && (
            <button
              type="button"
              onClick={handleSyncAllGroups}
              disabled={syncingScores || gradesLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors disabled:opacity-50"
              title="Import and sync all evaluated group scores for this class into the grade book"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingScores ? 'animate-spin' : ''}`} />
              <span>{syncingScores ? 'Syncing...' : 'Sync Group Scores'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsGroupModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            Auto-Propagate Group Score
          </button>
        </div>
      </div>

      {error && <Alert type="error" title="Error" message={error} onClose={() => setError('')} />}
      {successMsg && <Alert type="success" title="Success" message={successMsg} onClose={() => setSuccessMsg('')} />}

      {pageLoading ? (
        <LoadingSpinner message="Retrieving class roster and recorded grades..." />
      ) : classes.length === 0 ? (
        /* Empty State: Faculty with No Teaching Class Assignments */
        <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-sm max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            No Teaching Class Assignments Found
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Your faculty account currently does not have any assigned subjects or sections allocated. Once School Administration assigns you to classes in Teacher Assignments, your class roster and grade records will appear here immediately.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/teacher/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Faculty Dashboard
            </Link>
            <button
              type="button"
              onClick={() => loadGradeBook()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-600/20"
            >
              <RefreshCw className="w-4 h-4" />
              Check for Assignments
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Selectors Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-1/2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Choose Assigned Subject & Class
              </label>
              <select
                value={`${selectedSubjectId}-${selectedSectionId}`}
                onChange={(e) => {
                  const [subId, secId] = e.target.value.split('-');
                  handleClassChange(subId, secId);
                }}
                disabled={gradesLoading}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 transition-colors"
              >
                {classes.map((c) => (
                  <option key={c.assignment_id} value={`${c.subject_id}-${c.section_id}`}>
                    {c.subject_name} — Grade {c.grade_level} (Section {c.section_name})
                  </option>
                ))}
              </select>
            </div>

            {selectedClassInfo && (
              <div className="w-full sm:w-1/2 flex items-center justify-between sm:justify-end gap-4 text-xs text-slate-500">
                <span className="bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  Stream: <strong className="text-slate-800 dark:text-slate-200">{selectedClassInfo.stream_name}</strong>
                </span>
                <span className="bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  Enrolled Students: <strong className="text-slate-800 dark:text-slate-200">{grades.length}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Grade Book Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm relative">
            {gradesLoading && (
              <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Updating grade roster...
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-3 text-center">Quiz (10)</th>
                    <th className="py-3 px-3 text-center">Midterm (30)</th>
                    <th className="py-3 px-3 text-center">Assignment (20)</th>
                    <th className="py-3 px-3 text-center">Final (40)</th>
                    <th className="py-3 px-3 text-center">Total (100)</th>
                    <th className="py-3 px-3 text-center">Grade</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {grades.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                        <p className="font-semibold text-slate-700 dark:text-slate-300">No Students Enrolled in This Section</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {selectedClassInfo
                            ? `No students are registered in Grade ${selectedClassInfo.grade_level} (${selectedClassInfo.section_name}) yet.`
                            : 'Students will appear here once registered or enrolled by administration.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    grades.map((row) => (
                      <tr key={row.student_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                            {row.first_name} {row.last_name}
                          </span>
                          <span className="text-xs font-mono text-slate-400">{row.student_code}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {row.quiz_score !== null && row.quiz_score !== undefined ? parseFloat(row.quiz_score).toFixed(1) : '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {row.midterm_score !== null && row.midterm_score !== undefined ? parseFloat(row.midterm_score).toFixed(1) : '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 block">
                            {row.assignment_score !== null && row.assignment_score !== undefined ? parseFloat(row.assignment_score).toFixed(1) : '—'}
                          </span>
                          {row.group_code && (
                            <div className="flex flex-col items-center gap-1 mt-1">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                                  row.group_code.includes('-S2-')
                                    ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/60'
                                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60'
                                }`}
                                title={`Group Code: ${row.group_code} (${row.group_name || 'Group Project'})`}
                              >
                                {row.group_code}
                              </span>
                              {row.evaluated_group_score !== null && row.evaluated_group_score !== undefined && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickImportRow(row)}
                                  disabled={quickImportingId === row.student_id}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 transition-colors"
                                  title={`Click to automatically import evaluated score of ${row.evaluated_group_score} pts from ${row.group_code}`}
                                >
                                  <Download className="w-2.5 h-2.5" />
                                  {quickImportingId === row.student_id ? 'Importing...' : `Import (${row.evaluated_group_score})`}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {row.final_score !== null && row.final_score !== undefined ? parseFloat(row.final_score).toFixed(1) : '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {row.total_score !== null && row.total_score !== undefined ? parseFloat(row.total_score).toFixed(1) : '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {row.letter_grade ? (
                            <Badge
                              variant={row.letter_grade.startsWith('A') ? 'success' : row.letter_grade === 'F' ? 'danger' : 'primary'}
                              size="sm"
                            >
                              {row.letter_grade}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openEnterMarksModal(row)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Enter Marks</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal: Group Score Importer */}
      <Modal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        title="Auto-Propagate Group Assignment Score"
      >
        <form onSubmit={handleGroupScoreSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs leading-relaxed">
            Enter the unique <strong>Group Code</strong> (e.g. <code>GROUP-MATH9-A-001</code>). The score will be automatically assigned to all registered members of this team in PostgreSQL.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Standardized Group Code
            </label>
            <input
              type="text"
              required
              placeholder="e.g. GROUP-MATH9-A-001"
              value={groupCodeInput}
              onChange={(e) => setGroupCodeInput(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Group Project Score (Max 20)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="20"
              required
              value={groupScoreInput}
              onChange={(e) => setGroupScoreInput(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsGroupModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={groupSubmitting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              {groupSubmitting ? 'Propagating...' : 'Propagate Score to Members'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Single Grade Record Editor */}
      <Modal
        isOpen={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title={`Enter Assessment Marks: ${editingStudent?.first_name} ${editingStudent?.last_name} (Semester ${selectedSemester})`}
      >
        <form onSubmit={handleSaveGrade} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {editingStudent?.first_name} {editingStudent?.last_name}
                </span>{' '}
                <span className="font-mono text-slate-400">({editingStudent?.student_code})</span>
              </div>
              {editingStudent?.group_code && (
                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-mono text-[11px] font-semibold border border-emerald-300 dark:border-emerald-800">
                  Group: {editingStudent.group_code}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Enter <strong>Midterm</strong> and <strong>Final</strong> marks manually. For the group assignment result, click <strong>"Import Group Code"</strong> to automatically receive the score given to this group code and add them together automatically.
            </p>
          </div>

          {/* Manual Marks Inputs: Midterm & Final (and Quiz) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Midterm Exam (Max 30) <span className="text-amber-600 dark:text-amber-400 font-normal">(Manual Entry)</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="30"
                required
                value={scoresForm.midtermScore}
                onChange={(e) => setScoresForm({ ...scoresForm, midtermScore: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-medium focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Final Exam (Max 40) <span className="text-amber-600 dark:text-amber-400 font-normal">(Manual Entry)</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="40"
                required
                value={scoresForm.finalScore}
                onChange={(e) => setScoresForm({ ...scoresForm, finalScore: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-medium focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quiz (Max 10) <span className="text-slate-400 font-normal">(Manual Entry)</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="10"
                value={scoresForm.quizScore}
                onChange={(e) => setScoresForm({ ...scoresForm, quizScore: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono"
              />
            </div>

            {/* Assignment Score Input (Filled automatically on Import) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assignment / Group (Max 20)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="20"
                value={scoresForm.assignmentScore}
                onChange={(e) => setScoresForm({ ...scoresForm, assignmentScore: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>
          </div>

          {/* Group Assignment Auto-Import Panel */}
          <div className="p-3.5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Import Group Code (System Auto-Receives Result)
              </span>
              {editingStudent?.group_code && (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                  {editingStudent.group_code}
                </span>
              )}
            </div>

            {/* Quick 1-click import button for the student's assigned group code */}
            {editingStudent?.group_code && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleImportGroupCode(editingStudent.group_code)}
                  disabled={importingGroup}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {importingGroup ? 'Importing Result...' : `Import Group Code: ${editingStudent.group_code}`}
                  </span>
                </button>
              </div>
            )}

            {/* Custom group code input and import button */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Or enter Group Code (e.g. GROUP-MATH9-A-001)"
                value={customGroupCodeInput}
                onChange={(e) => setCustomGroupCodeInput(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-1.5 text-xs font-mono uppercase bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleImportGroupCode(customGroupCodeInput)}
                disabled={importingGroup || !customGroupCodeInput.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-50 transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Import Code</span>
              </button>
            </div>

            {/* Status messages for group import */}
            {groupImportMsg.text && (
              <div
                className={`p-2 rounded-lg text-xs leading-tight ${
                  groupImportMsg.type === 'success'
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 border border-emerald-300 dark:border-emerald-700 font-semibold flex items-center gap-1.5'
                    : groupImportMsg.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {groupImportMsg.type === 'success' && <Check className="w-3.5 h-3.5 shrink-0" />}
                {groupImportMsg.text}
              </div>
            )}
          </div>

          {/* Real-time Total Score Calculator breakdown */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Composite Score Breakdown:</span>
              <span className="font-mono text-[11px]">
                Midterm ({scoresForm.midtermScore || 0}) + Final ({scoresForm.finalScore || 0}) + Assignment ({scoresForm.assignmentScore || 0}) + Quiz ({scoresForm.quizScore || 0})
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Calculated Total:</span>
                <span className="text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  {(
                    parseFloat(scoresForm.quizScore || 0) +
                    parseFloat(scoresForm.midtermScore || 0) +
                    parseFloat(scoresForm.assignmentScore || 0) +
                    parseFloat(scoresForm.finalScore || 0)
                  ).toFixed(1)}
                  <span className="text-xs text-slate-400 font-normal"> / 100</span>
                </span>
              </div>
              <div>
                <Badge
                  variant={
                    (parseFloat(scoresForm.quizScore || 0) +
                      parseFloat(scoresForm.midtermScore || 0) +
                      parseFloat(scoresForm.assignmentScore || 0) +
                      parseFloat(scoresForm.finalScore || 0)) >= 85
                      ? 'success'
                      : (parseFloat(scoresForm.quizScore || 0) +
                          parseFloat(scoresForm.midtermScore || 0) +
                          parseFloat(scoresForm.assignmentScore || 0) +
                          parseFloat(scoresForm.finalScore || 0)) < 50
                      ? 'danger'
                      : 'primary'
                  }
                  size="md"
                >
                  Grade:{' '}
                  {calculateGradeBadge(
                    parseFloat(scoresForm.quizScore || 0) +
                      parseFloat(scoresForm.midtermScore || 0) +
                      parseFloat(scoresForm.assignmentScore || 0) +
                      parseFloat(scoresForm.finalScore || 0)
                  )}
                </Badge>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Remarks & Comments
            </label>
            <input
              type="text"
              value={scoresForm.remarks}
              onChange={(e) => setScoresForm({ ...scoresForm, remarks: e.target.value })}
              placeholder="e.g. Excellent active participation and team solution"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingStudent(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingRow !== null}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 shadow-md shadow-emerald-600/20 transition-all"
            >
              {savingRow !== null ? 'Saving...' : 'Save Assessment Record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default GradeRecordsPage;
