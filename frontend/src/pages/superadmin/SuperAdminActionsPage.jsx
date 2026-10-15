import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  AlertOctagon,
  X,
  Check,
  RefreshCw,
  Search,
  Building2,
  Clock,
  Layers,
  FileText,
  UserX,
  Database,
  History,
  CheckCircle2,
  ChevronDown,
  ArrowRight,
  Sparkles,
  Info,
  Lock,
  Unlock,
  Sliders,
  Send,
  Calendar,
} from 'lucide-react';

const SuperAdminActionsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active sub-component tab: 'all' | 'schools' | 'cleanup' | 'logs'
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'all');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'schools' || tab === 'cleanup' || tab === 'logs' || tab === 'all') {
      setActiveTab(tab);
    } else {
      setActiveTab('all');
    }
  }, [searchParams]);

  // Data states
  const [schools, setSchools] = useState([]);
  const [actionLogs, setActionLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [warningModalSchool, setWarningModalSchool] = useState(null);
  const [warningForm, setWarningForm] = useState({
    category: 'POLICY_BREACH',
    reason: '',
    deadlineDays: 7,
  });
  const [submittingWarning, setSubmittingWarning] = useState(false);

  const [suspendModalSchool, setSuspendModalSchool] = useState(null);
  const [suspendForm, setSuspendForm] = useState({
    category: 'RULE_BREACH_SUSPENSION',
    reason: '',
  });
  const [submittingSuspend, setSubmittingSuspend] = useState(false);

  const [deleteModalSchool, setDeleteModalSchool] = useState(null);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // Cleanup state
  const [selectedCleanupSchoolId, setSelectedCleanupSchoolId] = useState('');
  const [runningCleanupType, setRunningCleanupType] = useState('');

  // Toast / feedback state
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Fetch all schools and logs for actions component
  const fetchActionsData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [schoolsRes, logsRes] = await Promise.all([
        api.get('/superadmin/actions/schools'),
        api.get('/superadmin/actions/logs'),
      ]);

      if (schoolsRes.data?.success) {
        setSchools(schoolsRes.data.data || []);
      }
      if (logsRes.data?.success) {
        setActionLogs(logsRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load actions data:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Could not load administrative actions data.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchActionsData();
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'all' ? {} : { tab });
  };

  // 1. Submit Official Warning
  const handleIssueWarning = async (e) => {
    e.preventDefault();
    if (!warningModalSchool) return;
    if (!warningForm.reason.trim()) {
      setFeedback({ type: 'error', message: 'Please specify the rule violation reason.' });
      return;
    }

    setSubmittingWarning(true);
    try {
      const res = await api.post(`/superadmin/actions/schools/${warningModalSchool.id}/warn`, {
        category: warningForm.category,
        reason: warningForm.reason,
        deadlineDays: warningForm.deadlineDays,
      });

      setFeedback({
        type: 'success',
        message: res.data?.message || `Warning issued to ${warningModalSchool.name}.`,
      });
      setWarningModalSchool(null);
      setWarningForm({ category: 'POLICY_BREACH', reason: '', deadlineDays: 7 });
      await fetchActionsData(true);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to issue rule breach warning.',
      });
    } finally {
      setSubmittingWarning(false);
    }
  };

  // 2. Submit School Suspension
  const handleSuspendSchool = async (e) => {
    e.preventDefault();
    if (!suspendModalSchool) return;

    setSubmittingSuspend(true);
    try {
      const res = await api.post(`/superadmin/actions/schools/${suspendModalSchool.id}/suspend`, {
        category: suspendForm.category,
        reason: suspendForm.reason,
      });

      setFeedback({
        type: 'success',
        message: res.data?.message || `School ${suspendModalSchool.name} has been suspended.`,
      });
      setSuspendModalSchool(null);
      setSuspendForm({ category: 'RULE_BREACH_SUSPENSION', reason: '' });
      await fetchActionsData(true);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to suspend school.',
      });
    } finally {
      setSubmittingSuspend(false);
    }
  };

  // 3. Restore School Good Standing
  const handleRestoreSchool = async (school) => {
    if (!window.confirm(`Are you sure you want to restore "${school.name}" to Active & Compliant standing?`)) {
      return;
    }

    try {
      const res = await api.post(`/superadmin/actions/schools/${school.id}/restore`, {
        notes: 'Compliance reviewed and confirmed by Super Admin. Standing restored.',
      });

      setFeedback({
        type: 'success',
        message: res.data?.message || `School "${school.name}" restored to Active standing!`,
      });
      await fetchActionsData(true);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to restore school standing.',
      });
    }
  };

  // 4. Safe Delete School
  const handleSafeDeleteSchool = async (e) => {
    e.preventDefault();
    if (!deleteModalSchool) return;

    if (deleteConfirmCode.trim().toUpperCase() !== deleteModalSchool.code.toUpperCase()) {
      setFeedback({
        type: 'error',
        message: `Confirmation code mismatch. You must type "${deleteModalSchool.code}" exactly.`,
      });
      return;
    }

    setSubmittingDelete(true);
    try {
      const res = await api.delete(`/superadmin/actions/schools/${deleteModalSchool.id}`, {
        data: {
          confirmCode: deleteConfirmCode.trim(),
          reason: deleteReason.trim() || 'Rule breach and permanent contract termination.',
        },
      });

      setFeedback({
        type: 'success',
        message: res.data?.message || `School "${deleteModalSchool.name}" successfully removed.`,
      });
      setDeleteModalSchool(null);
      setDeleteConfirmCode('');
      setDeleteReason('');
      await fetchActionsData(true);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to safely delete school.',
      });
    } finally {
      setSubmittingDelete(false);
    }
  };

  // 5. System Cleanup Actions
  const handleRunCleanup = async (cleanupType) => {
    if (cleanupType === 'SCHOOL_ACADEMIC_TEST_DATA' && !selectedCleanupSchoolId) {
      setFeedback({
        type: 'error',
        message: 'Please select a target school to clear academic test records.',
      });
      return;
    }

    const typeNames = {
      FAILED_PAYMENTS: 'purge all failed/stale payment records older than 3 days',
      ORPHAN_USERS: 'remove all orphaned accounts unattached to any registered school',
      SCHOOL_ACADEMIC_TEST_DATA: 'reset and clear attendance, grades, assignments & study materials for the selected school',
      STALE_AUDIT_LOGS: 'prune audit logs older than 60 days',
    };

    if (!window.confirm(`Are you sure you want to ${typeNames[cleanupType] || 'run this cleanup'}? This action cannot be reversed.`)) {
      return;
    }

    setRunningCleanupType(cleanupType);
    try {
      const res = await api.post('/superadmin/actions/cleanup', {
        cleanupType,
        schoolId: selectedCleanupSchoolId ? parseInt(selectedCleanupSchoolId, 10) : null,
      });

      setFeedback({
        type: 'success',
        message: res.data?.message || 'Cleanup completed successfully.',
      });
      await fetchActionsData(true);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to execute system cleanup.',
      });
    } finally {
      setRunningCleanupType('');
    }
  };

  // Filtered schools
  const filteredSchools = schools.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.city && s.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'COMPLIANT') return s.complianceStatus === 'COMPLIANT' && s.isActive;
    if (statusFilter === 'WARNING') return s.complianceStatus === 'WARNING_ISSUED';
    if (statusFilter === 'SUSPENDED') return s.complianceStatus === 'SUSPENDED' || !s.isActive;
    return true;
  });

  // KPI calculations
  const totalSchools = schools.length;
  const compliantCount = schools.filter((s) => s.complianceStatus === 'COMPLIANT' && s.isActive).length;
  const warningCount = schools.filter((s) => s.complianceStatus === 'WARNING_ISSUED').length;
  const suspendedCount = schools.filter((s) => s.complianceStatus === 'SUSPENDED' || !s.isActive).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Feedback Alert Toast */}
      {feedback.message && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between shadow-lg animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="text-sm font-semibold">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback({ type: '', message: '' })}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <ShieldAlert className="w-3.5 h-3.5" />
              Super Admin Disciplinary & Rule Enforcement
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Platform Actions & Compliance Control
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Enforce multi-tenant regulations between the Super Admin and subscribed schools. Penalize, freeze, or safely delete schools that violate operational agreements, and maintain platform hygiene by purging unnecessary or orphaned records.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => fetchActionsData(true)}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-98 text-white text-xs font-semibold backdrop-blur-sm border border-white/15 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Status'}</span>
            </button>
            <Link
              to="/superadmin/dashboard"
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold backdrop-blur-sm border border-white/15 transition-all flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Platform Overview</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Schools</span>
            <Building2 className="w-4 h-4 text-primary-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {totalSchools}
          </div>
          <span className="text-[11px] text-slate-400">Total high school tenants</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Compliant</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {compliantCount}
          </div>
          <span className="text-[11px] text-slate-400">In good regulatory standing</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Under Warning</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {warningCount}
          </div>
          <span className="text-[11px] text-slate-400">Active disciplinary notices</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Suspended</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {suspendedCount}
          </div>
          <span className="text-[11px] text-slate-400">Access frozen / Pending action</span>
        </div>
      </div>

      {/* Subcomponent Navigation Tabs (Similar to SuperAdminMorePage) */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl overflow-x-auto max-w-full">
          <button
            onClick={() => handleTabChange('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-primary-500" />
            <span>All Action Modules</span>
          </button>

          <button
            onClick={() => handleTabChange('schools')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'schools'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>School Violations & Deletion</span>
            {warningCount + suspendedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full text-[10px]">
                {warningCount + suspendedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('cleanup')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'cleanup'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>System & Data Cleanup</span>
          </button>

          <button
            onClick={() => handleTabChange('logs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-500" />
            <span>Enforcement Audit History</span>
            <span className="ml-1 px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-[10px]">
              {actionLogs.length}
            </span>
          </button>
        </div>

        <div className="hidden sm:flex items-center text-xs text-slate-400 gap-1.5">
          <Info className="w-3.5 h-3.5" />
          <span>All deletions require code authorization</span>
        </div>
      </div>

      {/* Loading Spinner */}
      {loading && (
        <div className="p-12 text-center">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Loading actions and compliance data...
          </p>
        </div>
      )}

      {!loading && (
        <div className="space-y-8">
          {/* ======================================================== */}
          {/* SUBCOMPONENT 1: SCHOOL RULE VIOLATIONS & DELETION        */}
          {/* ======================================================== */}
          {(activeTab === 'all' || activeTab === 'schools') && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-500" />
                    School Disciplinary & Deletion Center
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Oversee school compliance, issue warnings with deadlines, suspend rogue tenants, or delete non-compliant institutions.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search school name or code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white w-48 sm:w-60"
                    />
                  </div>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="ALL">All Standings</option>
                    <option value="COMPLIANT">Compliant Only</option>
                    <option value="WARNING">Under Warning</option>
                    <option value="SUSPENDED">Suspended / Frozen</option>
                  </select>
                </div>
              </div>

              {/* Schools List */}
              {filteredSchools.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <p className="text-sm text-slate-500">No schools matching your search criteria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSchools.map((s) => {
                    const isSuspended = s.complianceStatus === 'SUSPENDED' || !s.isActive;
                    const isWarning = s.complianceStatus === 'WARNING_ISSUED';
                    const isCompliant = !isSuspended && !isWarning;

                    return (
                      <div
                        key={s.id}
                        className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all shadow-sm flex flex-col justify-between ${
                          isSuspended
                            ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10'
                            : isWarning
                            ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div>
                          {/* Card Top: Name & Badges */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-700 dark:text-slate-300 shrink-0 border border-slate-200 dark:border-slate-700">
                                {s.logoUrl ? (
                                  <img src={s.logoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                                ) : (
                                  s.name.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                  {s.name}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                    {s.code}
                                  </span>
                                  <span className="text-[11px] text-slate-400 truncate">
                                    {s.city || 'Ethiopia'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Standing Badge */}
                            <div>
                              {s.subscriptionStatus === 'PENDING_PAYMENT' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  <Clock className="w-3 h-3" />
                                  Pending Payment
                                </span>
                              ) : isSuspended ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  <ShieldAlert className="w-3 h-3" />
                                  Suspended
                                </span>
                              ) : isWarning ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <AlertTriangle className="w-3 h-3" />
                                  Warning Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <ShieldCheck className="w-3 h-3" />
                                  Compliant
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Rule Violation Notice Banner if exists */}
                          {(isWarning || isSuspended) && s.violationReason && (
                            <div className="mb-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-bold text-rose-700 dark:text-rose-300">
                                <span>Reported Violation:</span>
                                {s.violationDate && (
                                  <span className="text-rose-500 font-normal">
                                    {new Date(s.violationDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <p className="text-rose-900 dark:text-rose-200 text-xs italic">
                                "{s.violationReason}"
                              </p>
                            </div>
                          )}

                          {/* Resource Metrics Counts */}
                          <div className="grid grid-cols-4 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center mb-4">
                            <div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {s.studentCount}
                              </div>
                              <div className="text-[10px] text-slate-400">Students</div>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {s.teacherCount}
                              </div>
                              <div className="text-[10px] text-slate-400">Teachers</div>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {s.sectionCount}
                              </div>
                              <div className="text-[10px] text-slate-400">Sections</div>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {s.paymentCount}
                              </div>
                              <div className="text-[10px] text-slate-400">Invoices</div>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons Toolbar */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {isSuspended ? (
                              <button
                                type="button"
                                onClick={() => handleRestoreSchool(s)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1 shadow-xs active:scale-95"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                <span>Restore Standing</span>
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setWarningModalSchool(s)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 transition-all flex items-center gap-1"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Issue Warning</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSuspendModalSchool(s)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-1"
                                >
                                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Suspend School</span>
                                </button>
                              </>
                            )}
                          </div>

                          {/* Delete School Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteModalSchool(s);
                              setDeleteConfirmCode('');
                              setDeleteReason('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-all flex items-center gap-1 border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
                            title="Safely delete school if non-compliant"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete School</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* SUBCOMPONENT 2: SYSTEM CLEANUP & UNNECESSARY THINGS     */}
          {/* ======================================================== */}
          {(activeTab === 'all' || activeTab === 'cleanup') && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-indigo-500" />
                      Platform Hygiene & Unnecessary Data Cleaner
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Purge redundant, obsolete, or orphaned records without affecting normal schools, user accounts, or active subscriptions.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-bold">
                    Safe Scoped Cleanup
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Stale Payment Records Cleaner */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="space-y-2 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                      <Clock className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Purge Stale & Incomplete Invoices
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Clears pending or failed school payment attempts older than 3 days. Useful when schools generate multiple abandoned test invoices.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={runningCleanupType === 'FAILED_PAYMENTS'}
                    onClick={() => handleRunCleanup('FAILED_PAYMENTS')}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {runningCleanupType === 'FAILED_PAYMENTS' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>
                      {runningCleanupType === 'FAILED_PAYMENTS' ? 'Purging Invoices...' : 'Purge Stale Invoices (> 3 days)'}
                    </span>
                  </button>
                </div>

                {/* 2. Orphaned Accounts Cleaner */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="space-y-2 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                      <UserX className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Remove Orphaned User Accounts
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Scans for and removes detached student/teacher user records that are no longer associated with any active school tenant.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={runningCleanupType === 'ORPHAN_USERS'}
                    onClick={() => handleRunCleanup('ORPHAN_USERS')}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {runningCleanupType === 'ORPHAN_USERS' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    <span>
                      {runningCleanupType === 'ORPHAN_USERS' ? 'Removing Accounts...' : 'Clean Orphaned Accounts'}
                    </span>
                  </button>
                </div>

                {/* 3. School Academic Test Data Reset */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="space-y-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                      <Database className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Reset School Academic Test Records
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Clears attendance entries, grades, assignments, and study materials for a specific school (e.g. at the start of a semester or after onboarding testing) without deleting accounts.
                    </p>

                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        Select Target School:
                      </label>
                      <select
                        value={selectedCleanupSchoolId}
                        onChange={(e) => setSelectedCleanupSchoolId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
                      >
                        <option value="">-- Choose school to reset --</option>
                        {schools.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code}) - {s.studentCount} students
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!selectedCleanupSchoolId || runningCleanupType === 'SCHOOL_ACADEMIC_TEST_DATA'}
                    onClick={() => handleRunCleanup('SCHOOL_ACADEMIC_TEST_DATA')}
                    className="w-full py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-98 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {runningCleanupType === 'SCHOOL_ACADEMIC_TEST_DATA' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {runningCleanupType === 'SCHOOL_ACADEMIC_TEST_DATA' ? 'Resetting Data...' : 'Reset School Academic Data'}
                    </span>
                  </button>
                </div>

                {/* 4. Expired Audit Logs Pruner */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="space-y-2 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Prune Expired Audit Logs
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Removes historical operational log records older than 60 days to keep the Neon PostgreSQL database responsive and reduce storage footprint.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={runningCleanupType === 'STALE_AUDIT_LOGS'}
                    onClick={() => handleRunCleanup('STALE_AUDIT_LOGS')}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {runningCleanupType === 'STALE_AUDIT_LOGS' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-emerald-500" />
                    )}
                    <span>
                      {runningCleanupType === 'STALE_AUDIT_LOGS' ? 'Pruning Logs...' : 'Prune Logs Older Than 60 Days'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SUBCOMPONENT 3: DISCIPLINARY & ACTIONS AUDIT LOGS       */}
          {/* ======================================================== */}
          {(activeTab === 'all' || activeTab === 'logs') && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-500" />
                    Enforcement & Disciplinary Audit Trail
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Immutable history of all Super Admin warnings, suspensions, deletions, and cleanup actions executed.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {actionLogs.length} events logged
                </span>
              </div>

              {actionLogs.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <p className="text-sm text-slate-500">No disciplinary enforcement records recorded yet.</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold">
                          <th className="py-3 px-4">Timestamp</th>
                          <th className="py-3 px-4">Action Taken</th>
                          <th className="py-3 px-4">Target School</th>
                          <th className="py-3 px-4">Category / Reason</th>
                          <th className="py-3 px-4">Executed By</th>
                          <th className="py-3 px-4 text-right">Deadline / Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {actionLogs.map((log) => {
                          const actionStyles = {
                            WARNING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                            SUSPEND: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
                            RESTORE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                            SAFE_DELETE: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
                            CLEANUP_DATA: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
                          };

                          return (
                            <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                                {new Date(log.created_at).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                    actionStyles[log.action_type] || 'bg-slate-100 text-slate-800'
                                  }`}
                                >
                                  {log.action_type.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                                {log.school_name}{' '}
                                {log.school_code && (
                                  <span className="font-mono text-[10px] text-slate-400">({log.school_code})</span>
                                )}
                              </td>
                              <td className="py-3 px-4 max-w-xs text-slate-600 dark:text-slate-400 truncate">
                                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                                  {log.violation_category}:
                                </span>
                                {log.violation_reason}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                                {log.executed_by_name || log.executed_by_email || 'Super Admin'}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-[11px] text-slate-500">
                                {log.resolution_deadline
                                  ? `Deadline: ${new Date(log.resolution_deadline).toLocaleDateString()}`
                                  : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ISSUE OFFICIAL WARNING                           */}
      {/* ======================================================== */}
      {warningModalSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm">Issue Official Rule Breach Warning</h3>
              </div>
              <button
                onClick={() => setWarningModalSchool(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleIssueWarning} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-500">Target School:</span>{' '}
                <strong className="text-slate-900 dark:text-white">
                  {warningModalSchool.name} ({warningModalSchool.code})
                </strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Violation Category
                </label>
                <select
                  value={warningForm.category}
                  onChange={(e) => setWarningForm({ ...warningForm, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white font-medium"
                >
                  <option value="POLICY_BREACH">General Platform Policy Breach</option>
                  <option value="UNPAID_LICENSE">License Expiration & Payment Evasion</option>
                  <option value="DATA_INTEGRITY_TAMPERING">Unauthorized Grade / Exam Record Alterations</option>
                  <option value="FRAUDULENT_ENROLLMENT">Fake or Unverified Student Registrations</option>
                  <option value="SLA_TERMS_VIOLATION">Terms of Service / SLA Non-Compliance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Detailed Violation Reason & Notice *
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Detail the specific rules breached and required corrective actions..."
                  value={warningForm.reason}
                  onChange={(e) => setWarningForm({ ...warningForm, reason: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Rectification Deadline (Days)
                </label>
                <select
                  value={warningForm.deadlineDays}
                  onChange={(e) => setWarningForm({ ...warningForm, deadlineDays: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white font-medium"
                >
                  <option value="3">3 Days (Urgent)</option>
                  <option value="7">7 Days (Standard)</option>
                  <option value="14">14 Days (Extended)</option>
                  <option value="30">30 Days (Final Notice)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setWarningModalSchool(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWarning}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingWarning ? 'Dispatching Warning...' : 'Dispatch Official Warning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: SUSPEND SCHOOL ACCESS                            */}
      {/* ======================================================== */}
      {suspendModalSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-rose-500/10 text-rose-900 dark:text-rose-200">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-sm">Freeze & Suspend School Tenant</h3>
              </div>
              <button
                onClick={() => setSuspendModalSchool(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSuspendSchool} className="p-5 space-y-4">
              <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                <strong>Attention Super Administrator:</strong>
                <p>
                  Suspending <strong>{suspendModalSchool.name}</strong> will immediately freeze all administrative and student portal logins for this school until you manually restore it.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Suspension Reason *
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Specify rule breach justification for audit records..."
                  value={suspendForm.reason}
                  onChange={(e) => setSuspendForm({ ...suspendForm, reason: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSuspendModalSchool(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSuspend}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingSuspend ? 'Suspending School...' : 'Confirm School Suspension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: HIGH-SECURITY SAFE DELETE CONFIRMATION           */}
      {/* ======================================================== */}
      {deleteModalSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-300 dark:border-rose-900 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-rose-100 dark:border-rose-900/60 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertOctagon className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-base">Permanent School Deletion</h3>
                  <p className="text-[11px] text-rose-100">Safe Multi-Tenant Database Purge</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteModalSchool(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSafeDeleteSchool} className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-900 dark:text-rose-200 space-y-2">
                <div className="font-bold flex items-center gap-1 text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Irreversible Administrative Destruction
                </div>
                <p>
                  You are about to delete <strong>{deleteModalSchool.name}</strong> ({deleteModalSchool.code}). All corresponding student records ({deleteModalSchool.studentCount}), teacher assignments ({deleteModalSchool.teacherCount}), sections ({deleteModalSchool.sectionCount}), and invoices will be purged.
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  ✓ Protected: Other schools and platform-wide databases are 100% unaffected.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Termination / Deletion
                </label>
                <input
                  type="text"
                  placeholder="e.g. Severe breach of contract & illegal activity"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Security Verification: Type{' '}
                  <span className="font-mono text-rose-600 dark:text-rose-400 select-all font-black">
                    {deleteModalSchool.code}
                  </span>{' '}
                  to authorize:
                </label>
                <input
                  type="text"
                  required
                  placeholder={`Type "${deleteModalSchool.code}" here`}
                  value={deleteConfirmCode}
                  onChange={(e) => setDeleteConfirmCode(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-mono font-bold tracking-wider bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteModalSchool(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Abort / Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    submittingDelete ||
                    deleteConfirmCode.trim().toUpperCase() !== deleteModalSchool.code.toUpperCase()
                  }
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-98 text-white shadow-md transition-all flex items-center gap-2 disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{submittingDelete ? 'Safely Purging School...' : 'Authorize & Permanently Delete'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminActionsPage;
