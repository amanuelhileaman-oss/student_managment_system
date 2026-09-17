import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { ShieldAlert, RefreshCw, Edit3, Trash2, AlertTriangle } from 'lucide-react';

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [editForm, setEditForm] = useState({
    action: '',
    entityType: '',
    entityId: '',
    details: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Single Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [logToDelete, setLogToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Clear All Modal State
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const url = actionFilter ? `/audit?action=${actionFilter}` : '/audit';
      const res = await api.get(url);
      setLogs(res.data.data);
      setTotalCount(res.data.totalCount);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const handleOpenEdit = (record) => {
    setEditingLog(record);
    setEditForm({
      action: record.action || '',
      entityType: record.entity_type || '',
      entityId: record.entity_id || '',
      details: typeof record.details === 'object' ? JSON.stringify(record.details, null, 2) : String(record.details || ''),
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingLog) return;
    setSavingEdit(true);
    setError('');

    let parsedDetails = editForm.details;
    try {
      parsedDetails = JSON.parse(editForm.details);
    } catch {
      parsedDetails = { note: editForm.details };
    }

    try {
      const res = await api.put(`/audit/${editingLog.id}`, {
        action: editForm.action,
        entityType: editForm.entityType,
        entityId: editForm.entityId,
        details: parsedDetails,
      });
      setSuccessMsg(res.data.message || 'Audit record updated successfully.');
      setEditModalOpen(false);
      setEditingLog(null);
      fetchLogs();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update audit log.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenDelete = (record) => {
    setLogToDelete(record);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!logToDelete) return;
    setDeleting(true);
    setError('');

    try {
      const res = await api.delete(`/audit/${logToDelete.id}`);
      setSuccessMsg(res.data.message || 'Audit record deleted successfully.');
      setDeleteModalOpen(false);
      setLogToDelete(null);
      fetchLogs();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete audit log.');
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmClearAll = async () => {
    setClearing(true);
    setError('');

    try {
      const res = await api.delete('/audit/clear-all');
      setSuccessMsg(res.data.message || 'All audit logs cleared.');
      setClearModalOpen(false);
      fetchLogs();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clear audit logs.');
    } finally {
      setClearing(false);
    }
  };

  const columns = [
    {
      header: 'Timestamp',
      render: (r) => (
        <span className="font-mono text-xs text-slate-500 whitespace-nowrap">
          {new Date(r.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Action',
      render: (r) => (
        <span className="font-mono font-semibold text-xs text-slate-800 dark:text-slate-200">
          {r.action}
        </span>
      ),
    },
    {
      header: 'User / Actor',
      render: (r) => (
        <div>
          <span className="font-medium text-slate-900 dark:text-slate-100 block text-xs">
            {r.first_name ? `${r.first_name} ${r.last_name}` : 'System'}
          </span>
          <span className="text-[11px] font-mono text-slate-400">{r.email || 'N/A'}</span>
        </div>
      ),
    },
    {
      header: 'Entity',
      render: (r) => (
        <Badge variant="neutral" size="sm">
          {r.entity_type} {r.entity_id ? `#${r.entity_id}` : ''}
        </Badge>
      ),
    },
    {
      header: 'Details',
      render: (r) => (
        <span className="text-xs font-mono text-slate-500 truncate max-w-xs block" title={typeof r.details === 'object' ? JSON.stringify(r.details) : String(r.details || '')}>
          {typeof r.details === 'object' ? JSON.stringify(r.details) : String(r.details || '')}
        </span>
      ),
    },
    {
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenEdit(r)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition"
            title="Edit Audit Record"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleOpenDelete(r)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
            title="Delete Audit Record"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  if (loading && logs.length === 0) {
    return <LoadingSpinner message="Loading chronological audit trails..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-purple-600" />
            Security & Academic Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Chronological system log tracking user logins, enrollments, capacity changes, and faculty actions.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setClearModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All Logs
          </button>
          <button
            onClick={fetchLogs}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Refresh Logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <Alert type="error" title="Audit Log Error" message={error} onClose={() => setError('')} />}
      {successMsg && <Alert type="success" title="Success" message={successMsg} onClose={() => setSuccessMsg('')} />}

      <DataTable
        columns={columns}
        data={logs}
        searchPlaceholder="Filter audit records by action, user, or entity..."
      />

      {/* Edit Audit Record Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingLog(null);
        }}
        title="Edit Audit Record"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Action Name
            </label>
            <input
              type="text"
              required
              value={editForm.action}
              onChange={(e) => setEditForm({ ...editForm, action: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Entity Type
              </label>
              <input
                type="text"
                required
                value={editForm.entityType}
                onChange={(e) => setEditForm({ ...editForm, entityType: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Entity ID
              </label>
              <input
                type="text"
                value={editForm.entityId}
                onChange={(e) => setEditForm({ ...editForm, entityId: e.target.value })}
                placeholder="Optional"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Details / Payload (JSON or Notes)
            </label>
            <textarea
              rows={4}
              value={editForm.details}
              onChange={(e) => setEditForm({ ...editForm, details: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditModalOpen(false);
                setEditingLog(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50 transition shadow-sm"
            >
              {savingEdit ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Single Audit Record Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setLogToDelete(null);
        }}
        title="Delete Audit Record"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-200 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold">Confirm Audit Entry Deletion</p>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                Are you sure you want to delete audit entry #{logToDelete?.id} ({logToDelete?.action})?
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setDeleteModalOpen(false);
                setLogToDelete(null);
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
              {deleting ? 'Deleting...' : 'Delete Record'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Clear All Audit Logs Modal */}
      <Modal
        isOpen={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        title="Clear All Audit Logs"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-200 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold">Irreversible Action: Clear Entire Audit Log</p>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                This will permanently delete all {totalCount} chronological audit records. Are you sure?
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setClearModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClearAll}
              disabled={clearing}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50 transition shadow-sm"
            >
              {clearing ? 'Clearing...' : 'Yes, Clear All Logs'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AuditLogsPage;
