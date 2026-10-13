import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  Building2,
  Users,
  GraduationCap,
  Plus,
  Search,
  ShieldCheck,
  ShieldAlert,
  Power,
  RefreshCw,
  ExternalLink,
  MapPin,
  Mail,
  Phone,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Provisioning form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    city: 'Addis Ababa',
    phone: '',
    email: '',
    address: '',
    subscriptionStatus: 'ACTIVE',
    adminEmail: '',
    adminPassword: 'Admin@123',
    adminFirstName: '',
    adminLastName: 'Principal',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/superadmin/stats');
      if (res.data && res.data.success) {
        setStats(res.data.stats);
        setSchools(res.data.schools || []);
      }
    } catch (err) {
      console.error('Error loading platform metrics:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load platform data.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleNameChange = (e) => {
    const val = e.target.value;
    const autoCode = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');
    setFormData((prev) => ({
      ...prev,
      name: val,
      code: autoCode,
    }));
  };

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.adminEmail.trim()) {
      setFeedback({ type: 'error', message: 'School Name and Admin Email are required.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/superadmin/schools', formData);
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `School "${res.data.data.school.name}" and Admin account successfully created!`,
        });
        setIsModalOpen(false);
        setFormData({
          name: '',
          code: '',
          city: 'Addis Ababa',
          phone: '',
          email: '',
          address: '',
          subscriptionStatus: 'ACTIVE',
          adminEmail: '',
          adminPassword: 'Admin@123',
          adminFirstName: '',
          adminLastName: 'Principal',
        });
        fetchData();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Error creating new school tenant.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (schoolId, currentStatus, currentActive) => {
    const newStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    const newActive = currentStatus === 'SUSPENDED';

    try {
      await api.patch(`/superadmin/schools/${schoolId}/status`, {
        subscriptionStatus: newStatus,
        isActive: newActive,
      });
      setSchools((prev) =>
        prev.map((s) =>
          s.id === schoolId
            ? { ...s, subscriptionStatus: newStatus, isActive: newActive }
            : s
        )
      );
      setFeedback({
        type: 'success',
        message: `School status updated to ${newStatus}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update school status.',
      });
    }
  };

  const filteredSchools = schools.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.city && s.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.admin?.email && s.admin.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchStatus =
      statusFilter === 'ALL' ||
      s.subscriptionStatus === statusFilter;

    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-purple-200 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>Platform Owner Master Control</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            EthioHighHub SaaS Cloud
          </h1>
          <p className="text-purple-200 text-sm max-w-xl">
            Central governance over all registered high schools across Ethiopia. Each school runs on 100% independent tenant boundaries.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            type="button"
            onClick={fetchData}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-sm shadow-lg shadow-purple-500/30 transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Provision New High School</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {feedback.message && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback({ type: '', message: '' })}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-purple-300 dark:hover:border-purple-700 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total High Schools
              </p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
                {stats?.totalSchools || 0}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{stats?.activeSchools || 0} active operating schools</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-blue-300 dark:hover:border-blue-700 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Enrolled Students
              </p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
                {stats?.totalStudents || 0}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>Across all {stats?.totalSchools || 0} high schools</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-700 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Faculty (Teachers)
              </p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
                {stats?.totalTeachers || 0}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>All certified department teachers</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-300 dark:hover:border-amber-700 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Active Subscriptions
              </p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
                {stats?.activeSubscriptions || 0}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
            <span>{stats?.suspendedSubscriptions || 0} suspended accounts</span>
          </div>
        </div>
      </div>

      {/* Schools Directory & Filtering */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Registered High Schools Directory
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Manage school tenants, assign principals, and control active status
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search school name, code, or principal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 w-64"
              />
            </div>

            {/* Filter by Status */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              {['ALL', 'ACTIVE', 'SUSPENDED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    statusFilter === st
                      ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Schools Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-6">School Tenant</th>
                <th className="py-3.5 px-6">Location</th>
                <th className="py-3.5 px-6">Assigned Principal (Admin)</th>
                <th className="py-3.5 px-6 text-center">Students</th>
                <th className="py-3.5 px-6 text-center">Faculty</th>
                <th className="py-3.5 px-6 text-center">Subscription</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 dark:text-slate-500">
                    No schools matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredSchools.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {s.name}
                          </p>
                          <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded">
                            {s.code}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{s.city || 'Addis Ababa'}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      {s.admin ? (
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {s.admin.name || 'Principal'}
                          </p>
                          <p className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                            {s.admin.email}
                          </p>
                        </div>
                      ) : (
                        <span className="text-amber-500 italic">No admin assigned</span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-center font-bold text-slate-800 dark:text-slate-200">
                      {s.studentCount}
                    </td>

                    <td className="py-4 px-6 text-center font-bold text-slate-800 dark:text-slate-200">
                      {s.teacherCount}
                    </td>

                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          s.subscriptionStatus === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : s.subscriptionStatus === 'TRIAL'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                      >
                        {s.subscriptionStatus === 'ACTIVE' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        )}
                        {s.subscriptionStatus}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleStatus(s.id, s.subscriptionStatus, s.isActive)
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all ${
                          s.subscriptionStatus === 'SUSPENDED'
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 dark:text-emerald-300'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 dark:text-rose-300'
                        }`}
                        title={
                          s.subscriptionStatus === 'SUSPENDED'
                            ? 'Activate School Access'
                            : 'Suspend School Access'
                        }
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>
                          {s.subscriptionStatus === 'SUSPENDED' ? 'Activate' : 'Suspend'}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision New School Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100">
                    Provision New High School
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Creates an isolated tenant and assigns its unique School Principal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSchool} className="p-6 overflow-y-auto space-y-5">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>1. School Information</span>
                </h4>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    School Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hawassa Comprehensive High School"
                    value={formData.name}
                    onChange={handleNameChange}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      School Slug / Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. hawassa-high"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, code: e.target.value.toLowerCase() }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      City / Region
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Hawassa"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, city: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
                <h4 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>2. School Administrator (Single Admin Rule)</span>
                </h4>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Principal Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. principal@hawassa.edu"
                    value={formData.adminEmail}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, adminEmail: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Temporary Password *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.adminPassword}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, adminPassword: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Subscription Plan
                    </label>
                    <select
                      value={formData.subscriptionStatus}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, subscriptionStatus: e.target.value }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                      <option value="ACTIVE">ACTIVE (Full License)</option>
                      <option value="TRIAL">TRIAL (14-Day Free)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-purple-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Provision School</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
