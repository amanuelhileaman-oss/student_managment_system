import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Layers, Plus, Edit2, CheckCircle2, AlertTriangle, Users, Trash2, Pencil, MapPin } from 'lucide-react';

const SectionsManagement = () => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [selectedGrade, setSelectedGrade] = useState('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);

  // New section form
  const [createForm, setCreateForm] = useState({
    gradeLevel: 9,
    streamId: 1, // General
    sectionName: '',
    capacity: 50,
  });

  // Edit section form
  const [editForm, setEditForm] = useState({
    sectionName: '',
    capacity: 50,
    gradeLevel: 9,
    streamId: 1,
  });

  // Delete section state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [saving, setSaving] = useState(false);

  const fetchSections = async () => {
    try {
      setLoading(true);
      const res = await api.get('/academic/sections');
      setSections(res.data.data || res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch sections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  // Dynamically calculate assigned room number strictly ordered by grade and section sequence
  const generateAutoRoom = (sec) => {
    if (!sec || !sections || sections.length === 0) return 'Room 01';
    const activeSecs = sections.filter(
      (s) => s.is_active !== false && !String(s.section_name || '').startsWith('T-')
    );
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

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.post('/admin/sections', createForm);
      setSuccessMsg(res.data.message || 'Section created successfully.');
      setIsCreateModalOpen(false);
      setCreateForm({ gradeLevel: 9, streamId: 1, sectionName: '', capacity: 50 });
      fetchSections();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create section.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (sec) => {
    setEditingSection(sec);
    setEditForm({
      sectionName: sec.section_name,
      capacity: sec.capacity,
      gradeLevel: sec.grade_level,
      streamId: sec.stream_id,
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingSection) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.put(`/admin/sections/${editingSection.id}`, editForm);
      setSuccessMsg(res.data.message || 'Section updated successfully.');
      setIsEditModalOpen(false);
      fetchSections();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update section.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (sec) => {
    setSectionToDelete(sec);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!sectionToDelete) return;
    try {
      setDeleting(true);
      setError('');
      const res = await api.delete(`/admin/sections/${sectionToDelete.id}`);
      setSuccessMsg(res.data.message || 'Section deleted successfully.');
      setIsDeleteModalOpen(false);
      setSectionToDelete(null);
      fetchSections();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete section.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredSections = sections.filter((sec) => {
    if (selectedGrade === 'ALL') return true;
    return sec.grade_level === parseInt(selectedGrade, 10);
  });

  if (loading) return <LoadingSpinner message="Loading school sections and live seat counts..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Section Capacities & Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Real-time monitoring of enrolled students, remaining seats, and dynamic addition/editing of sections.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          + Create Other Section
        </button>
      </div>

      {error && <Alert type="error" title="Error" message={error} onClose={() => setError('')} />}
      {successMsg && <Alert type="success" title="Success" message={successMsg} onClose={() => setSuccessMsg('')} />}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {['ALL', '9', '10', '11', '12'].map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setSelectedGrade(g)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${selectedGrade === g
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
          >
            {g === 'ALL' ? 'All Grades' : `Grade ${g}`}
          </button>
        ))}
      </div>

      {/* Sections Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSections.map((sec) => {
          const isFull = sec.is_full || sec.remaining_seats <= 0;
          const pct = Math.min(Math.round((sec.enrolled_count / sec.capacity) * 100), 100);

          return (
            <div
              key={sec.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Grade {sec.grade_level} • {sec.stream_name}
                  </span>
                  {isFull ? (
                    <Badge variant="danger" size="sm">
                      FULL (50/50)
                    </Badge>
                  ) : (
                    <Badge variant="success" size="sm">
                      {sec.remaining_seats} Seats Open
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                      Section {sec.section_name}
                    </h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-primary-50 dark:bg-primary-950/60 border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 flex items-center gap-1 shadow-xs">
                      <MapPin className="w-3 h-3 text-primary-500" />
                      {generateAutoRoom(sec)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(sec)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit Section Details"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDelete(sec)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Delete Section"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Capacity Meter */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <span>Enrolled: {sec.enrolled_count} students</span>
                    <span>Max: {sec.capacity}</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isFull
                        ? 'bg-rose-500'
                        : pct > 80
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                        }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {pct}% Utilization
                </span>
                <span className="font-mono text-[11px]">ID: sec-{sec.id}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create Other Section */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Other Section"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            When standard sections are filled to capacity, school administrators can spawn additional sections (e.g. E, F, G).
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Grade Level
            </label>
            <select
              value={createForm.gradeLevel}
              onChange={(e) => {
                const g = parseInt(e.target.value, 10);
                setCreateForm({
                  ...createForm,
                  gradeLevel: g,
                  streamId: g <= 10 ? 1 : createForm.streamId === 1 ? 2 : createForm.streamId,
                });
              }}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            >
              {[9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Curriculum Stream
            </label>
            <select
              value={createForm.streamId}
              onChange={(e) => setCreateForm({ ...createForm, streamId: parseInt(e.target.value, 10) })}
              disabled={createForm.gradeLevel <= 10}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm disabled:opacity-60"
            >
              {createForm.gradeLevel <= 10 ? (
                <option value={1}>General Stream (Grades 9-10 Standard)</option>
              ) : (
                <>
                  <option value={2}>Natural Stream (Sciences)</option>
                  <option value={3}>Social Stream (Humanities)</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Section Identifier (Letter)
            </label>
            <input
              type="text"
              maxLength="3"
              required
              placeholder="e.g. E, F, G"
              value={createForm.sectionName}
              onChange={(e) => setCreateForm({ ...createForm, sectionName: e.target.value.toUpperCase() })}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm uppercase font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Maximum Student Capacity
            </label>
            <input
              type="number"
              min="1"
              max="100"
              required
              value={createForm.capacity}
              onChange={(e) => setCreateForm({ ...createForm, capacity: parseInt(e.target.value, 10) })}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Section'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Section Details */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Section ${editingSection?.section_name || ''}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Section Identifier
            </label>
            <input
              type="text"
              maxLength="3"
              required
              value={editForm.sectionName}
              onChange={(e) => setEditForm({ ...editForm, sectionName: e.target.value.toUpperCase() })}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm uppercase font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Maximum Student Capacity
            </label>
            <input
              type="number"
              min="1"
              max="100"
              required
              value={editForm.capacity}
              onChange={(e) => setEditForm({ ...editForm, capacity: parseInt(e.target.value, 10) })}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Curriculum Stream
            </label>
            <select
              value={editForm.streamId}
              onChange={(e) => setEditForm({ ...editForm, streamId: parseInt(e.target.value, 10) })}
              disabled={editForm.gradeLevel <= 10}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm disabled:opacity-60"
            >
              {editForm.gradeLevel <= 10 ? (
                <option value={1}>General Stream</option>
              ) : (
                <>
                  <option value={2}>Natural Stream</option>
                  <option value={3}>Social Stream</option>
                </>
              )}
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Section Confirmation */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Section"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-rose-700 dark:text-rose-300 mb-1">
                Confirm Section Removal
              </p>
              <p>
                Are you sure you want to remove <strong>Grade {sectionToDelete?.grade_level} — Section {sectionToDelete?.section_name}</strong>?
              </p>
              {sectionToDelete?.enrolled_count > 0 && (
                <p className="mt-1 font-bold text-rose-600">
                  Warning: This section currently has {sectionToDelete.enrolled_count} student(s) enrolled! You must reassign students before deleting.
                </p>
              )}
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
              {deleting ? 'Deleting...' : 'Confirm Delete Section'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SectionsManagement;
