import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  Plus,
  GraduationCap,
  CheckCircle2,
  Pencil,
  Trash2,
  ArrowRight,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';

const TeacherAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [assignForm, setAssignForm] = useState({
    teacherId: '',
    subjectId: '',
    sectionId: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [taRes, tRes, sRes, secRes] = await Promise.all([
        api.get('/admin/teacher-assignments'),
        api.get('/admin/users?role=teacher'),
        api.get('/academic/subjects'),
        api.get('/academic/sections'),
      ]);
      setAssignments(taRes.data.data);
      setTeachers(tRes.data.data);
      setSubjects(sRes.data.data);
      setSections(secRes.data.data);

      if (tRes.data.data.length > 0 && sRes.data.data.length > 0 && secRes.data.data.length > 0) {
        setAssignForm({
          teacherId: tRes.data.data[0].teacher_record_id || tRes.data.data[0].id,
          subjectId: sRes.data.data[0].id,
          sectionId: secRes.data.data[0].id,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load teacher assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setEditingAssignment(null);
    if (teachers.length > 0 && subjects.length > 0 && sections.length > 0) {
      setAssignForm({
        teacherId: teachers[0].teacher_record_id || teachers[0].id,
        subjectId: subjects[0].id,
        sectionId: sections[0].id,
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenEdit = (assignment) => {
    setEditingAssignment(assignment);
    setAssignForm({
      teacherId: assignment.teacher_id,
      subjectId: assignment.subject_id,
      sectionId: assignment.section_id,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingAssignment) {
        const res = await api.put(`/admin/teacher-assignments/${editingAssignment.id}`, assignForm);
        setSuccessMsg(res.data.message || 'Teacher assignment updated.');
      } else {
        const res = await api.post('/admin/teacher-assignments', assignForm);
        setSuccessMsg(res.data.message || 'Teacher assignment created.');
      }
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save teacher assignment.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (assignment) => {
    setAssignmentToDelete(assignment);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!assignmentToDelete) return;
    setDeleting(true);
    setError('');

    try {
      const res = await api.delete(`/admin/teacher-assignments/${assignmentToDelete.id}`);
      setSuccessMsg(res.data.message || 'Teacher assignment removed.');
      setIsDeleteModalOpen(false);
      setAssignmentToDelete(null);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete teacher assignment.');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      header: 'Instructor',
      accessor: 'first_name',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {row.first_name} {row.last_name}
          </span>
          <span className="block text-[11px] text-slate-400">{row.email}</span>
        </div>
      ),
    },
    {
      header: 'Subject & Code',
      accessor: 'subject_name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Badge variant="primary" size="sm">
            {row.subject_code}
          </Badge>
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {row.subject_name}
          </span>
        </div>
      ),
    },
    {
      header: 'Grade Level',
      accessor: 'grade_level',
      render: (row) => (
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          Grade {row.grade_level}
        </span>
      ),
    },
    {
      header: 'Stream',
      accessor: 'stream_name',
      render: (row) => {
        const isNat = row.stream_code === 'NATURAL';
        const isSoc = row.stream_code === 'SOCIAL';
        return (
          <Badge
            variant={isNat ? 'success' : isSoc ? 'warning' : 'neutral'}
            size="sm"
          >
            {row.stream_name ? row.stream_name.replace(' Stream', '') : 'General'}
          </Badge>
        );
      },
    },
    {
      header: 'Assigned Section',
      accessor: 'section_name',
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
          Section {row.section_name}
        </span>
      ),
    },
    {
      header: 'Scheduled Periods',
      accessor: 'scheduled_periods_count',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-xs text-slate-600 dark:text-slate-400">
            {row.scheduled_periods_count || 0} / 5
          </span>
          {row.scheduled_periods_count >= 5 && (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" title="Timetable fully populated" />
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
            title="Edit Assignment"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenDelete(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            title="Remove Assignment"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSpinner message="Loading faculty course assignments..." />;

  return (
    <div className="space-y-6">
      {/* Workflow Navigation Banner */}
      <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-slate-900 dark:via-teal-950/40 dark:to-cyan-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            1
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
              <span>Step 1: Faculty Course Assignments</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-mono">
                Prerequisite
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Assign teachers to subjects and sections first. Then proceed to Step 2 to build the weekly timetable.
            </p>
          </div>
        </div>

        <Link
          to="/admin/schedules"
          className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
        >
          <span>Step 2: Build Master Timetable</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-emerald-600" />
            Teacher Class & Subject Assignments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Assign instructors to designated grades, subjects, and sections. Instructors can teach multiple sections across different periods.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Assign Teacher
        </button>
      </div>

      {error && <Alert type="error" title="Error" message={error} onClose={() => setError('')} />}
      {successMsg && <Alert type="success" title="Success" message={successMsg} onClose={() => setSuccessMsg('')} />}

      <DataTable
        columns={columns}
        data={assignments}
        searchPlaceholder="Search teacher, subject, section..."
      />

      {/* Assign Teacher Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAssignment ? 'Edit Teacher Assignment' : 'Assign Faculty Instructor to Class'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Instructor
            </label>
            <select
              value={assignForm.teacherId}
              onChange={(e) => setAssignForm({ ...assignForm, teacherId: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.teacher_record_id || t.id}>
                  {t.first_name} {t.last_name} ({t.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Subject
            </label>
            <select
              value={assignForm.subjectId}
              onChange={(e) => setAssignForm({ ...assignForm, subjectId: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Grade {s.grade_level}{s.stream_name ? ` • ${s.stream_name}` : ''} • {s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Section
            </label>
            <select
              value={assignForm.sectionId}
              onChange={(e) => setAssignForm({ ...assignForm, sectionId: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
            >
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  Grade {sec.grade_level} — Section {sec.section_name} ({sec.stream_name})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingAssignment ? 'Update Assignment' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Teacher Assignment"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold text-sm text-rose-700 dark:text-rose-300 mb-1">
                Confirm Assignment Removal
              </p>
              <p>
                Are you sure you want to remove <strong>{assignmentToDelete?.first_name} {assignmentToDelete?.last_name}</strong> from teaching <strong>{assignmentToDelete?.subject_name}</strong> in <strong>Grade {assignmentToDelete?.grade_level} Section {assignmentToDelete?.section_name}</strong>?
              </p>
              <p className="mt-1 text-[11px] opacity-80">
                Note: Any scheduled timetable periods tied to this assignment will also be removed cleanly.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TeacherAssignments;
