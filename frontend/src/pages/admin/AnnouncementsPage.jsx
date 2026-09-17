import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Megaphone, Plus, Calendar, Edit3, Trash2, AlertTriangle } from 'lucide-react';

const AnnouncementsPage = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    targetAudience: 'ALL',
    targetGradeLevel: 9,
  });
  const [saving, setSaving] = useState(false);

  // Delete Confirmation State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await api.get('/communications/announcements');
      setAnnouncements(res.data.data || res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      title: '',
      content: '',
      targetAudience: 'ALL',
      targetGradeLevel: 9,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (a) => {
    setEditingId(a.id);
    setForm({
      title: a.title || '',
      content: a.content || '',
      targetAudience: a.target_audience || 'ALL',
      targetGradeLevel: a.target_grade_level || 9,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingId) {
        // Update existing announcement
        const res = await api.put(`/communications/announcements/${editingId}`, form);
        setSuccessMsg(res.data.message || 'Announcement updated successfully.');
      } else {
        // Create new announcement
        const res = await api.post('/communications/announcements', form);
        setSuccessMsg(res.data.message || 'Announcement published successfully.');
      }
      setIsModalOpen(false);
      setEditingId(null);
      setForm({ title: '', content: '', targetAudience: 'ALL', targetGradeLevel: 9 });
      fetchAnnouncements();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save announcement.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (a) => {
    setItemToDelete(a);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    setError('');

    try {
      const res = await api.delete(`/communications/announcements/${itemToDelete.id}`);
      setSuccessMsg(res.data.message || 'Announcement deleted successfully.');
      setDeleteModalOpen(false);
      setItemToDelete(null);
      fetchAnnouncements();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete announcement.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && announcements.length === 0) {
    return <LoadingSpinner message="Loading school broadcasts..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary-600" />
            Institutional Announcements & Broadcasts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Publish, edit, and manage school notices targeted to all members, faculty, or designated grades.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Announcement
        </button>
      </div>

      {error && <Alert type="error" title="Error" message={error} onClose={() => setError('')} />}
      {successMsg && <Alert type="success" title="Success" message={successMsg} onClose={() => setSuccessMsg('')} />}

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Megaphone className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">No Announcements Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Create school broadcasts to notify students, teachers, or specific grades about important dates.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-xl text-xs font-semibold hover:bg-primary-700 transition"
            >
              + Create First Announcement
            </button>
          </div>
        ) : (
          announcements.map((a) => (
            <div
              key={a.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(a.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <Badge variant="primary" size="sm">
                    Audience: {a.target_audience} {a.target_grade_level ? `(Grade ${a.target_grade_level})` : ''}
                  </Badge>
                  {a.author_first_name && (
                    <span className="text-xs text-slate-400">
                      by {a.author_first_name} {a.author_last_name}
                    </span>
                  )}
                </div>

                {/* Edit & Delete Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenEdit(a)}
                    className="p-2 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition"
                    title="Edit Announcement"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenDelete(a)}
                    className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    title="Delete Announcement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{a.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {a.content}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        title={editingId ? 'Edit Institutional Announcement' : 'New School Announcement'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. End of Term Examination Schedule"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Target Audience
            </label>
            <select
              value={form.targetAudience}
              onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="ALL">Everyone (All School)</option>
              <option value="STUDENTS">Students Only</option>
              <option value="TEACHERS">Faculty Instructors Only</option>
              <option value="GRADE">Specific Grade Level</option>
            </select>
          </div>

          {form.targetAudience === 'GRADE' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Grade Level
              </label>
              <select
                value={form.targetGradeLevel}
                onChange={(e) => setForm({ ...form, targetGradeLevel: parseInt(e.target.value, 10) })}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value={9}>Grade 9</option>
                <option value={10}>Grade 10</option>
                <option value={11}>Grade 11</option>
                <option value={12}>Grade 12</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Content Message
            </label>
            <textarea
              required
              rows={4}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Detailed announcement content..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingId(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50 transition shadow-sm"
            >
              {saving ? 'Saving...' : editingId ? 'Update Announcement' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        title="Delete Announcement"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-200 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold">Confirm Announcement Deletion</p>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                Are you sure you want to permanently delete "{itemToDelete?.title}"? This action cannot be reversed.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setDeleteModalOpen(false);
                setItemToDelete(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50 transition shadow-sm"
            >
              {deleting ? 'Deleting...' : 'Delete Announcement'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AnnouncementsPage;
