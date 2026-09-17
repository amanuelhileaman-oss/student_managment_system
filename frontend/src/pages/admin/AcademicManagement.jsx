import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  BookOpen,
  Sliders,
  CheckCircle2,
  Edit2,
  Trash2,
  PlusCircle,
  Search,
  Filter,
  Users,
  Clock,
  AlertTriangle,
  Sparkles,
  Layers,
  GraduationCap,
} from 'lucide-react';

const AcademicManagement = () => {
  const [grades, setGrades] = useState([]);
  const [streams, setStreams] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Criteria Editing
  const [editingCriteria, setEditingCriteria] = useState(null);
  const [editMinGpa, setEditMinGpa] = useState(70);
  const [savingCriteria, setSavingCriteria] = useState(false);

  // Subject Management States
  const [subjectSearch, setSubjectSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [streamFilter, setStreamFilter] = useState('ALL');

  // Modals for Subjects
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isEditSubjectOpen, setIsEditSubjectOpen] = useState(false);
  const [isDeleteSubjectOpen, setIsDeleteSubjectOpen] = useState(false);
  const [subjectToEdit, setSubjectToEdit] = useState(null);
  const [subjectToDelete, setSubjectToDelete] = useState(null);

  // Subject Form State
  const initialFormState = {
    name: '',
    code: '',
    gradeLevel: 9,
    streamId: '',
    creditHours: 3,
  };
  const [subjectForm, setSubjectForm] = useState(initialFormState);
  const [savingSubject, setSavingSubject] = useState(false);
  const [subjectModalError, setSubjectModalError] = useState('');

  const fetchAcademicData = async () => {
    try {
      setLoading(true);
      const [gRes, stRes, crRes, subRes] = await Promise.all([
        api.get('/academic/grades'),
        api.get('/academic/streams'),
        api.get('/academic/stream-criteria'),
        api.get('/academic/subjects'),
      ]);
      setGrades(gRes.data.data || gRes.data);
      setStreams(stRes.data.data || stRes.data);
      setCriteria(crRes.data.data || crRes.data);
      setSubjects(subRes.data.data || subRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch academic data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcademicData();
  }, []);

  // Update Criteria Handler
  const handleUpdateCriteria = async (e) => {
    e.preventDefault();
    if (!editingCriteria) return;
    setSavingCriteria(true);
    setError('');

    try {
      await api.patch(`/admin/stream-criteria/${editingCriteria.id}`, {
        minOverallAverage: parseFloat(editMinGpa),
      });
      setSuccessMsg('Stream criteria updated successfully.');
      setEditingCriteria(null);
      fetchAcademicData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update stream criteria.');
    } finally {
      setSavingCriteria(false);
    }
  };

  // Open "Add Other Subject" Modal
  const openAddSubjectModal = () => {
    const defaultStream = streams.find((s) => s.code === 'GENERAL') || streams[0];
    setSubjectForm({
      name: '',
      code: '',
      gradeLevel: 9,
      streamId: defaultStream ? defaultStream.id : '',
      creditHours: 3,
    });
    setSubjectModalError('');
    setIsAddSubjectOpen(true);
  };

  // Auto-generate suggested code
  const autoGenerateCode = () => {
    if (!subjectForm.name) return;
    const cleanName = subjectForm.name.trim().toUpperCase();
    let prefix = '';
    const words = cleanName.split(/\s+/);
    if (words.length === 1) {
      prefix = words[0].substring(0, 4);
    } else {
      prefix = words.map((w) => w[0]).join('');
    }
    const gLevel = subjectForm.gradeLevel;
    let streamSuffix = '';
    const selStream = streams.find((s) => String(s.id) === String(subjectForm.streamId));
    if (gLevel >= 11 && selStream) {
      if (selStream.code === 'NATURAL') streamSuffix = '-NAT';
      else if (selStream.code === 'SOCIAL') streamSuffix = '-SOC';
    }
    setSubjectForm((prev) => ({
      ...prev,
      code: `${prefix}-${gLevel}${streamSuffix}`,
    }));
  };

  // Handle Grade Level Change in Subject Form
  const handleFormGradeChange = (newGrade) => {
    const gNum = parseInt(newGrade, 10);
    let newStreamId = subjectForm.streamId;

    if (gNum <= 10) {
      const gen = streams.find((s) => s.code === 'GENERAL');
      newStreamId = gen ? gen.id : newStreamId;
    } else {
      // If was General, switch to Natural by default for senior grade
      const currentStream = streams.find((s) => String(s.id) === String(subjectForm.streamId));
      if (!currentStream || currentStream.code === 'GENERAL') {
        const nat = streams.find((s) => s.code === 'NATURAL');
        newStreamId = nat ? nat.id : newStreamId;
      }
    }

    setSubjectForm((prev) => ({
      ...prev,
      gradeLevel: gNum,
      streamId: newStreamId,
    }));
  };

  // Create Subject Submission
  const handleCreateSubject = async (e) => {
    e.preventDefault();
    setSavingSubject(true);
    setSubjectModalError('');

    try {
      const payload = {
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim().toUpperCase(),
        gradeLevel: parseInt(subjectForm.gradeLevel, 10),
        streamId: parseInt(subjectForm.streamId, 10),
        creditHours: parseInt(subjectForm.creditHours, 10) || 3,
      };

      const res = await api.post('/admin/subjects', payload);
      setSuccessMsg(res.data.message || `Subject "${payload.name}" added successfully.`);
      setIsAddSubjectOpen(false);
      fetchAcademicData();
    } catch (err) {
      setSubjectModalError(err.response?.data?.message || 'Failed to create subject. Please check inputs.');
    } finally {
      setSavingSubject(false);
    }
  };

  // Open Edit Subject Modal
  const openEditSubjectModal = (sub) => {
    setSubjectToEdit(sub);
    setSubjectForm({
      name: sub.name,
      code: sub.code,
      gradeLevel: sub.grade_level,
      streamId: sub.stream_id,
      creditHours: sub.credit_hours || 3,
    });
    setSubjectModalError('');
    setIsEditSubjectOpen(true);
  };

  // Update Subject Submission
  const handleUpdateSubject = async (e) => {
    e.preventDefault();
    if (!subjectToEdit) return;
    setSavingSubject(true);
    setSubjectModalError('');

    try {
      const payload = {
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim().toUpperCase(),
        gradeLevel: parseInt(subjectForm.gradeLevel, 10),
        streamId: parseInt(subjectForm.streamId, 10),
        creditHours: parseInt(subjectForm.creditHours, 10) || 3,
      };

      const res = await api.put(`/admin/subjects/${subjectToEdit.id}`, payload);
      setSuccessMsg(res.data.message || `Subject "${payload.name}" updated successfully.`);
      setIsEditSubjectOpen(false);
      setSubjectToEdit(null);
      fetchAcademicData();
    } catch (err) {
      setSubjectModalError(err.response?.data?.message || 'Failed to update subject.');
    } finally {
      setSavingSubject(false);
    }
  };

  // Open Delete Subject Modal
  const openDeleteSubjectModal = (sub) => {
    setSubjectToDelete(sub);
    setIsDeleteSubjectOpen(true);
  };

  // Delete Subject Submission
  const handleDeleteSubject = async () => {
    if (!subjectToDelete) return;
    setSavingSubject(true);
    setError('');

    try {
      const res = await api.delete(`/admin/subjects/${subjectToDelete.id}`);
      setSuccessMsg(res.data.message || `Subject "${subjectToDelete.name}" deleted successfully.`);
      setIsDeleteSubjectOpen(false);
      setSubjectToDelete(null);
      fetchAcademicData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete subject. It may have active teacher assignments or grades.');
      setIsDeleteSubjectOpen(false);
    } finally {
      setSavingSubject(false);
    }
  };

  // Filtered Subjects List
  const filteredSubjects = subjects.filter((sub) => {
    const matchesSearch =
      sub.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
      sub.code.toLowerCase().includes(subjectSearch.toLowerCase());

    const matchesGrade =
      gradeFilter === 'ALL' || sub.grade_level === parseInt(gradeFilter, 10);

    const matchesStream =
      streamFilter === 'ALL' || String(sub.stream_id) === String(streamFilter);

    return matchesSearch && matchesGrade && matchesStream;
  });

  // Calculate subject counts per grade
  const gradeCounts = {
    all: subjects.length,
    g9: subjects.filter((s) => s.grade_level === 9).length,
    g10: subjects.filter((s) => s.grade_level === 10).length,
    g11: subjects.filter((s) => s.grade_level === 11).length,
    g12: subjects.filter((s) => s.grade_level === 12).length,
  };

  if (loading) return <LoadingSpinner message="Loading curriculum, streams, and criteria engine rules..." />;

  return (
    <div className="space-y-8 pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-primary-600 dark:text-primary-400" />
            Curriculum & Academic Standards
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Create and manage curriculum subjects, stream eligibility criteria, and academic parameters.
          </p>
        </div>

        {/* Primary Action: Add Other Subject Button */}
        <button
          type="button"
          onClick={openAddSubjectModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-primary-500/20 hover:shadow-lg hover:shadow-primary-500/30 transition-all active:scale-[0.98]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add Other Subject</span>
        </button>
      </div>

      {error && <Alert type="error" title="Action Failed" message={error} onClose={() => setError('')} />}
      {successMsg && <Alert type="success" title="Success" message={successMsg} onClose={() => setSuccessMsg('')} />}

      {/* 1. CURRICULUM & SUBJECTS SECTION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Curriculum Subjects ({filteredSubjects.length} of {subjects.length})
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Active high school subjects taught across Grades 9–12. Newly created subjects become available for teacher assignments, timetable schedules, and grade books immediately.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddSubjectModal}
            className="self-start md:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/60 text-xs font-bold border border-primary-200 dark:border-primary-800 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add Other Subject
          </button>
        </div>

        {/* Grade Breakdown Stat Pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => setGradeFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              gradeFilter === 'ALL'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All Grades ({gradeCounts.all})
          </button>
          <button
            type="button"
            onClick={() => setGradeFilter('9')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              gradeFilter === '9'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Grade 9 ({gradeCounts.g9})
          </button>
          <button
            type="button"
            onClick={() => setGradeFilter('10')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              gradeFilter === '10'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Grade 10 ({gradeCounts.g10})
          </button>
          <button
            type="button"
            onClick={() => setGradeFilter('11')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              gradeFilter === '11'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Grade 11 ({gradeCounts.g11})
          </button>
          <button
            type="button"
            onClick={() => setGradeFilter('12')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              gradeFilter === '12'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Grade 12 ({gradeCounts.g12})
          </button>
        </div>

        {/* Search & Stream Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search subjects by name or course code (e.g., Mathematics, IT-10, Chemistry)..."
              value={subjectSearch}
              onChange={(e) => setSubjectSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          <div>
            <select
              value={streamFilter}
              onChange={(e) => setStreamFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            >
              <option value="ALL">All Streams</option>
              {streams.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Subjects Grid */}
        {filteredSubjects.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-60" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No subjects found matching your filters
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Try adjusting your search query or grade filter, or click below to add a new subject to the curriculum.
            </p>
            <button
              type="button"
              onClick={openAddSubjectModal}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Add Other Subject
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSubjects.map((sub) => {
              const streamCode = sub.stream_code || 'GENERAL';
              const isNatural = streamCode === 'NATURAL';
              const isSocial = streamCode === 'SOCIAL';

              return (
                <div
                  key={sub.id}
                  className="bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group"
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                        {sub.code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="primary" size="sm">
                          Grade {sub.grade_level}
                        </Badge>
                        <Badge
                          variant={isNatural ? 'success' : isSocial ? 'warning' : 'neutral'}
                          size="sm"
                        >
                          {sub.stream_name ? sub.stream_name.replace(' Stream', '') : 'General'}
                        </Badge>
                      </div>
                    </div>

                    {/* Subject Name */}
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-2 line-clamp-1">
                      {sub.name}
                    </h3>

                    {/* Metadata: Credits and Teacher Count */}
                    <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{sub.credit_hours || 3} Credits/wk</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className={sub.teacher_count > 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                          {sub.teacher_count > 0 ? `${sub.teacher_count} Assigned` : 'No Teachers'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      ID #{sub.id}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditSubjectModal(sub)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/50 transition-colors"
                        title="Edit Subject"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteSubjectModal(sub)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        title="Delete Subject"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. STREAM PROGRESSION RULES SECTION */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Stream Progression Rules (Grade 10 $\rightarrow$ Grade 11)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {criteria.map((crit) => {
            const reqSubjects = crit.required_subjects_config?.subjects || {};

            return (
              <div
                key={crit.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-base text-slate-900 dark:text-slate-100">
                      {crit.stream_name} Criteria
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCriteria(crit);
                        setEditMinGpa(crit.min_overall_average);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit Minimum Average"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Minimum Overall Grade 10 GPA:</span>
                      <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                        &ge; {crit.min_overall_average}%
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Mandatory Subject Thresholds:
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(reqSubjects).map(([sub, minScore]) => (
                      <div
                        key={sub}
                        className="p-2 rounded-lg bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex justify-between"
                      >
                        <span className="text-slate-700 dark:text-slate-300">{sub}:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">&ge; {minScore}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                  Target: Grade {crit.target_grade_level} Admission Evaluation
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. ACTIVE GRADES & STREAMS INFO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Grades Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary-600" />
            Active High School Grades
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Notice: Grade 8 is strictly excluded as an active class. High school comprises Grades 9 through 12.
          </p>
          <div className="space-y-2">
            {grades.map((g) => (
              <div key={g.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 flex justify-between items-center text-sm">
                <span className="font-semibold">{g.name}</span>
                <Badge variant="primary" size="sm">Level {g.level}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Streams Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Academic Streams
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            General Stream serves Grades 9 and 10. Natural and Social streams bifurcate at Grade 11.
          </p>
          <div className="space-y-2">
            {streams.map((s) => (
              <div key={s.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold">{s.name}</span>
                  <Badge variant="neutral" size="sm">{s.code}</Badge>
                </div>
                <p className="text-xs text-slate-500">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL: Add Other Subject */}
      <Modal
        isOpen={isAddSubjectOpen}
        onClose={() => setIsAddSubjectOpen(false)}
        title="Add Other Subject to Curriculum"
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <p className="text-xs text-slate-500">
            Define a new subject for the high school curriculum. Once added, teachers can be assigned to teach it, and it will appear in timetables and academic records.
          </p>

          {subjectModalError && (
            <Alert type="error" message={subjectModalError} onClose={() => setSubjectModalError('')} />
          )}

          {/* Subject Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subject Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Information Technology, Technical Drawing, Economics..."
              value={subjectForm.name}
              onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
            />
          </div>

          {/* Grade Level and Stream */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Grade Level *
              </label>
              <select
                value={subjectForm.gradeLevel}
                onChange={(e) => handleFormGradeChange(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold"
              >
                <option value={9}>Grade 9</option>
                <option value={10}>Grade 10</option>
                <option value={11}>Grade 11</option>
                <option value={12}>Grade 12</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Academic Stream *
              </label>
              {parseInt(subjectForm.gradeLevel, 10) <= 10 ? (
                <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 font-medium">
                  General Stream (Fixed for Grades 9-10)
                </div>
              ) : (
                <select
                  value={subjectForm.streamId}
                  onChange={(e) => setSubjectForm({ ...subjectForm, streamId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold"
                  required
                >
                  {streams.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Subject Code with Auto-Gen */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Course Code * (Unique)
              </label>
              <button
                type="button"
                onClick={autoGenerateCode}
                className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Auto-Generate Code
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="e.g., IT-10, ECON-11-SOC, TD-12-NAT"
              value={subjectForm.code}
              onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
              className="w-full px-3.5 py-2 font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Course code must be distinct across the school (e.g. IT-10, MATH-11-NAT).
            </p>
          </div>

          {/* Credit Hours */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Weekly Credit Hours / Periods
            </label>
            <input
              type="number"
              min="1"
              max="10"
              required
              value={subjectForm.creditHours}
              onChange={(e) => setSubjectForm({ ...subjectForm, creditHours: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddSubjectOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingSubject}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              {savingSubject ? 'Creating...' : 'Create & Add Subject'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Edit Subject */}
      <Modal
        isOpen={isEditSubjectOpen}
        onClose={() => {
          setIsEditSubjectOpen(false);
          setSubjectToEdit(null);
        }}
        title={`Edit Subject: ${subjectToEdit?.name || ''}`}
      >
        <form onSubmit={handleUpdateSubject} className="space-y-4">
          {subjectModalError && (
            <Alert type="error" message={subjectModalError} onClose={() => setSubjectModalError('')} />
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subject Name *
            </label>
            <input
              type="text"
              required
              value={subjectForm.name}
              onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Grade Level *
              </label>
              <select
                value={subjectForm.gradeLevel}
                onChange={(e) => handleFormGradeChange(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold"
              >
                <option value={9}>Grade 9</option>
                <option value={10}>Grade 10</option>
                <option value={11}>Grade 11</option>
                <option value={12}>Grade 12</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Academic Stream *
              </label>
              {parseInt(subjectForm.gradeLevel, 10) <= 10 ? (
                <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 font-medium">
                  General Stream
                </div>
              ) : (
                <select
                  value={subjectForm.streamId}
                  onChange={(e) => setSubjectForm({ ...subjectForm, streamId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold"
                  required
                >
                  {streams.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Course Code * (Unique)
            </label>
            <input
              type="text"
              required
              value={subjectForm.code}
              onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
              className="w-full px-3.5 py-2 font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Weekly Credit Hours / Periods
            </label>
            <input
              type="number"
              min="1"
              max="10"
              required
              value={subjectForm.creditHours}
              onChange={(e) => setSubjectForm({ ...subjectForm, creditHours: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsEditSubjectOpen(false);
                setSubjectToEdit(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingSubject}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
            >
              {savingSubject ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Delete Subject Confirmation */}
      <Modal
        isOpen={isDeleteSubjectOpen}
        onClose={() => {
          setIsDeleteSubjectOpen(false);
          setSubjectToDelete(null);
        }}
        title="Confirm Subject Deletion"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold text-sm text-rose-700 dark:text-rose-300 mb-1">
                Remove Subject from Curriculum?
              </p>
              <p>
                Are you sure you want to delete <strong>{subjectToDelete?.name}</strong> ({subjectToDelete?.code})?
              </p>
              <p className="mt-1.5 text-[11px] opacity-85">
                Note: A subject can only be deleted if there are no active teacher assignments, student grades, or study materials attached to it.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsDeleteSubjectOpen(false);
                setSubjectToDelete(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingSubject}
              onClick={handleDeleteSubject}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {savingSubject ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Edit Criteria */}
      <Modal
        isOpen={!!editingCriteria}
        onClose={() => setEditingCriteria(null)}
        title={`Edit ${editingCriteria?.stream_name} Cutoff GPA`}
      >
        <form onSubmit={handleUpdateCriteria} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Minimum Overall GPA (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="40"
              max="100"
              required
              value={editMinGpa}
              onChange={(e) => setEditMinGpa(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingCriteria(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingCriteria}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50"
            >
              {savingCriteria ? 'Updating...' : 'Update Criteria'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AcademicManagement;
