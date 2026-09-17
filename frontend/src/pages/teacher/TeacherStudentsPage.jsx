import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import DataTable from '../../components/common/DataTable';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Alert from '../../components/common/Alert';
import Badge from '../../components/common/Badge';
import { Users, BookOpen, ArrowLeft, RefreshCw } from 'lucide-react';

const TeacherStudentsPage = () => {
  const [classes, setClasses] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [error, setError] = useState('');

  // Single-pass data loader
  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/teachers/classes');
      const classList = res.data?.data || [];
      setClasses(classList);

      if (classList.length === 0) {
        setStudents([]);
        setSelectedSectionId('');
        return;
      }

      const initialSecId = String(classList[0].section_id);
      setSelectedSectionId(initialSecId);

      // Immediately fetch students for this section without re-render delay
      const stuRes = await api.get(`/teachers/classes/${initialSecId}/students`);
      setStudents(stuRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load class roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSectionChange = async (secId) => {
    setSelectedSectionId(secId);
    try {
      setStudentsLoading(true);
      setError('');
      const res = await api.get(`/teachers/classes/${secId}/students`);
      setStudents(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load students for section.');
    } finally {
      setStudentsLoading(false);
    }
  };

  const columns = [
    {
      header: 'Student Name',
      render: (s) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100 block">
            {s.first_name} {s.last_name}
          </span>
          <span className="text-xs text-slate-400 font-mono">{s.email}</span>
        </div>
      ),
    },
    {
      header: 'Student ID',
      render: (s) => <span className="font-mono text-xs">{s.student_code}</span>,
    },
    { header: 'Gender', accessor: 'gender' },
    { header: 'Phone', accessor: 'phone' },
    {
      header: 'Enrollment Status',
      render: () => <Badge variant="success" size="sm">ENROLLED</Badge>,
    },
  ];

  if (loading) return <LoadingSpinner message="Loading assigned student rosters..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Assigned Student Rosters
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            View student directory for your assigned classes and sections.
          </p>
        </div>

        {classes.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedSectionId}
              onChange={(e) => handleSectionChange(e.target.value)}
              disabled={studentsLoading}
              className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold"
            >
              {classes.map((c) => (
                <option key={c.assignment_id} value={c.section_id}>
                  Grade {c.grade_level} — Section {c.section_name} ({c.subject_name})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleSectionChange(selectedSectionId)}
              disabled={studentsLoading}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Refresh Roster"
            >
              <RefreshCw className={`w-4 h-4 ${studentsLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {error && <Alert type="error" title="Error" message={error} onClose={() => setError('')} />}

      {classes.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-sm max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            No Teaching Class Assignments Found
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Your faculty account currently does not have any assigned classes or sections allocated. Once School Administration assigns you to classes, your enrolled student rosters will appear here immediately.
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
              onClick={loadData}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Check for Assignments
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          {studentsLoading && (
            <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-10 rounded-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Updating student roster...
              </div>
            </div>
          )}
          <DataTable
            columns={columns}
            data={students}
            searchPlaceholder="Search student name or ID..."
          />
        </div>
      )}
    </div>
  );
};

export default TeacherStudentsPage;
