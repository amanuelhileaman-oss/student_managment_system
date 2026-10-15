import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  CreditCard,
  Download,
  Calendar,
  Clock,
  FileSpreadsheet,
  Settings,
  Landmark,
  Sliders,
  Trash2,
  Edit3,
  Save,
  Check,
  ChevronDown,
  Zap,
} from 'lucide-react';

const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeMainTab, setActiveMainTab] = useState('schools'); // 'schools' | 'transactions'
  const [stats, setStats] = useState(null);
  const [paymentOverview, setPaymentOverview] = useState(null);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [txStatusFilter, setTxStatusFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBillingConfigOpen, setIsBillingConfigOpen] = useState(false);
  const [billingConfigTab, setBillingConfigTab] = useState('plans'); // 'plans' | 'banks'
  const [managedPlans, setManagedPlans] = useState([]);
  const [managedBanks, setManagedBanks] = useState([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState([]);
  const [selectedBankIds, setSelectedBankIds] = useState([]);
  const [publishingPlans, setPublishingPlans] = useState(false);
  const [publishingBanks, setPublishingBanks] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [editingPlanPrice, setEditingPlanPrice] = useState({});
  const [newBankModal, setNewBankModal] = useState({
    isOpen: false,
    bankName: '',
    bankCode: '',
    accountNumber: '',
    accountName: 'EthioHighHub SaaS Cloud Technologies',
    branch: '',
    isPrimary: false,
  });
  const [planModal, setPlanModal] = useState({
    isOpen: false,
    isEditing: false,
    id: '',
    name: '',
    durationMonths: 12,
    price: 35000,
    currency: 'ETB',
    description: '',
    featuresText: '',
    isPopular: false,
    isActive: true,
  });
  const [extendModal, setExtendModal] = useState({
    isOpen: false,
    school: null,
    months: 12,
    planName: 'ANNUAL',
    paymentMethod: 'CBE',
    amount: 35000,
    notes: '',
    submitting: false,
  });
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
    subscriptionStatus: 'PENDING_PAYMENT',
    adminEmail: '',
    adminPassword: 'Admin@123',
    adminFirstName: '',
    adminLastName: 'Principal',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [res, payRes, configRes] = await Promise.all([
        api.get('/superadmin/stats'),
        api.get('/subscriptions/superadmin/overview').catch(() => ({ data: { success: false } })),
        api.get('/subscriptions/superadmin/settings').catch(() => ({ data: { success: false } })),
      ]);
      if (res.data && res.data.success) {
        setStats(res.data.stats);
        setSchools(res.data.schools || []);
      }
      if (payRes.data && payRes.data.success) {
        setPaymentOverview(payRes.data.data);
      }
      if (configRes.data && configRes.data.success) {
        const plans = configRes.data.data.plans || [];
        const banks = configRes.data.data.bankAccounts || [];
        setManagedPlans(plans);
        setManagedBanks(banks);
        setSelectedPlanIds(plans.filter((p) => p.isActive).map((p) => p.id));
        setSelectedBankIds(banks.filter((b) => b.isActive).map((b) => b.id));
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

  const fetchBillingConfig = async () => {
    try {
      setLoadingConfig(true);
      const res = await api.get('/subscriptions/superadmin/settings');
      if (res.data?.success) {
        const plans = res.data.data.plans || [];
        const banks = res.data.data.bankAccounts || [];
        setManagedPlans(plans);
        setManagedBanks(banks);
        setSelectedPlanIds(plans.filter((p) => p.isActive).map((p) => p.id));
        setSelectedBankIds(banks.filter((b) => b.isActive).map((b) => b.id));
      }
    } catch (err) {
      console.error('Error loading billing settings:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleTogglePlanSelect = (planId) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
    );
  };

  const handleBatchPublishPlans = async () => {
    try {
      setPublishingPlans(true);
      const res = await api.post('/subscriptions/superadmin/publish-plans', {
        planIds: selectedPlanIds,
      });
      if (res.data?.success) {
        const updated = res.data.data || [];
        setManagedPlans(updated);
        setSelectedPlanIds(updated.filter((p) => p.isActive).map((p) => p.id));
        setFeedback({
          type: 'success',
          message: `SUCCESS! Exactly ${selectedPlanIds.length} renewal plan(s) published to all school admins!`,
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to publish plans.' });
    } finally {
      setPublishingPlans(false);
    }
  };

  const handleTogglePlan = async (planId, currentActive) => {
    try {
      const res = await api.patch(`/subscriptions/superadmin/plans/${planId}/toggle`, {
        isActive: !currentActive,
      });
      if (res.data?.success) {
        setManagedPlans((prev) =>
          prev.map((p) => (p.id === planId ? { ...p, isActive: !currentActive } : p))
        );
        setSelectedPlanIds((prev) =>
          !currentActive ? [...prev, planId] : prev.filter((id) => id !== planId)
        );
        setFeedback({
          type: 'success',
          message: `Plan ${planId} is now ${!currentActive ? 'ENABLED & visible to schools' : 'DISABLED & hidden from schools'}.`,
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to update plan status.' });
    }
  };

  const handleDeletePlan = async (planId, planName) => {
    if (!window.confirm(`Are you sure you want to delete plan "${planName}"? It will be removed from the platform.`)) return;
    try {
      const res = await api.delete(`/subscriptions/superadmin/plans/${planId}`);
      if (res.data?.success) {
        setManagedPlans((prev) => prev.filter((p) => p.id !== planId));
        setSelectedPlanIds((prev) => prev.filter((id) => id !== planId));
        setFeedback({ type: 'success', message: `Plan "${planName}" removed.` });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to delete plan.' });
    }
  };

  const handleOpenCreatePlan = () => {
    setPlanModal({
      isOpen: true,
      isEditing: false,
      id: '',
      name: '',
      durationMonths: 12,
      price: 35000,
      currency: 'ETB',
      description: '',
      featuresText: 'Unlimited student & teacher enrollment\nContinuous assessment & report cards\nSchool-isolated ChatHub channels\nDaily attendance tracking',
      isPopular: false,
      isActive: true,
    });
  };

  const handleOpenEditPlan = (plan) => {
    setPlanModal({
      isOpen: true,
      isEditing: true,
      id: plan.id,
      name: plan.name,
      durationMonths: plan.durationMonths,
      price: plan.price,
      currency: plan.currency || 'ETB',
      description: plan.description || '',
      featuresText: (plan.features || []).join('\n'),
      isPopular: plan.isPopular || false,
      isActive: plan.isActive !== false,
    });
  };

  const handleSavePlanSubmit = async (e) => {
    e.preventDefault();
    try {
      const features = planModal.featuresText
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);

      const payload = {
        id: planModal.id.toUpperCase().trim(),
        name: planModal.name,
        durationMonths: parseInt(planModal.durationMonths, 10),
        price: parseFloat(planModal.price),
        currency: planModal.currency || 'ETB',
        description: planModal.description,
        features,
        isPopular: planModal.isPopular,
        isActive: planModal.isActive,
      };

      const res = await api.post('/subscriptions/superadmin/plans', payload);
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Saved plan "${planModal.name}"! Resources and pricing updated.`,
        });
        setPlanModal((prev) => ({ ...prev, isOpen: false }));
        fetchBillingConfig();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to save plan.' });
    }
  };

  const handleSavePlanPrice = async (plan) => {
    const newPrice = editingPlanPrice[plan.id];
    if (newPrice === undefined || isNaN(newPrice)) return;
    try {
      const res = await api.post('/subscriptions/superadmin/plans', {
        ...plan,
        price: parseFloat(newPrice),
      });
      if (res.data?.success) {
        setManagedPlans((prev) =>
          prev.map((p) => (p.id === plan.id ? { ...p, price: parseFloat(newPrice) } : p))
        );
        setEditingPlanPrice((prev) => {
          const c = { ...prev };
          delete c[plan.id];
          return c;
        });
        setFeedback({
          type: 'success',
          message: `Saved: ${plan.name} price updated to ${parseFloat(newPrice).toLocaleString()} ETB!`,
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to save plan price.' });
    }
  };

  const handleSelectPlanPreset = (preset) => {
    if (preset === 'ANNUAL_ONLY') {
      setSelectedPlanIds(['ANNUAL']);
    } else if (preset === 'TERM_ANNUAL') {
      setSelectedPlanIds(['TERM', 'ANNUAL']);
    } else if (preset === 'ALL_THREE') {
      setSelectedPlanIds(['TERM', 'ANNUAL', 'ENTERPRISE']);
    }
  };

  const handleSelectAllBanks = () => {
    setSelectedBankIds(managedBanks.map((b) => b.id));
  };

  const handleDeselectAllBanks = () => {
    setSelectedBankIds([]);
  };

  const handleToggleBankSelect = (bankId) => {
    setSelectedBankIds((prev) =>
      prev.includes(bankId) ? prev.filter((id) => id !== bankId) : [...prev, bankId]
    );
  };

  const handleBatchPublishBanks = async () => {
    try {
      setPublishingBanks(true);
      const res = await api.post('/subscriptions/superadmin/publish-banks', {
        bankIds: selectedBankIds,
      });
      if (res.data?.success) {
        const updated = res.data.data || [];
        setManagedBanks(updated);
        setSelectedBankIds(updated.filter((b) => b.isActive).map((b) => b.id));
        setFeedback({
          type: 'success',
          message: `SUCCESS! Exactly ${selectedBankIds.length} bank account(s) published to all school admins at once!`,
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to publish bank accounts.' });
    } finally {
      setPublishingBanks(false);
    }
  };

  const handleToggleBank = async (bankId, currentActive) => {
    try {
      const res = await api.patch(`/subscriptions/superadmin/bank-accounts/${bankId}/toggle`, {
        isActive: !currentActive,
      });
      if (res.data?.success) {
        setManagedBanks((prev) =>
          prev.map((b) => (b.id === bankId ? { ...b, isActive: !currentActive } : b))
        );
        setSelectedBankIds((prev) =>
          !currentActive ? [...prev, bankId] : prev.filter((id) => id !== bankId)
        );
        setFeedback({
          type: 'success',
          message: `Bank account is now ${!currentActive ? 'VISIBLE to all schools' : 'HIDDEN from all schools'}.`,
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to update bank account status.' });
    }
  };

  const handleAddBank = async (e) => {
    e.preventDefault();
    if (!newBankModal.bankName || !newBankModal.accountNumber) {
      setFeedback({ type: 'error', message: 'Bank name and account number are required.' });
      return;
    }
    try {
      const res = await api.post('/subscriptions/superadmin/bank-accounts', newBankModal);
      if (res.data?.success) {
        setFeedback({ type: 'success', message: `Added ${newBankModal.bankName} to official platform accounts!` });
        setNewBankModal({
          isOpen: false,
          bankName: '',
          bankCode: '',
          accountNumber: '',
          accountName: 'EthioHighHub SaaS Cloud Technologies',
          branch: '',
          isPrimary: false,
        });
        fetchBillingConfig();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to add bank account.' });
    }
  };

  const handleDeleteBank = async (bankId, bankName) => {
    if (!window.confirm(`Are you sure you want to remove ${bankName}?`)) return;
    try {
      const res = await api.delete(`/subscriptions/superadmin/bank-accounts/${bankId}`);
      if (res.data?.success) {
        setManagedBanks((prev) => prev.filter((b) => b.id !== bankId));
        setSelectedBankIds((prev) => prev.filter((id) => id !== bankId));
        setFeedback({ type: 'success', message: 'Bank account removed.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to delete bank account.' });
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
          subscriptionStatus: 'PENDING_PAYMENT',
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

  const handleExtendSubscription = async (e) => {
    e.preventDefault();
    if (!extendModal.school) return;
    try {
      setExtendModal((prev) => ({ ...prev, submitting: true }));
      const res = await api.post(`/superadmin/schools/${extendModal.school.id}/extend-subscription`, {
        months: extendModal.months,
        planName: extendModal.planName,
        paymentMethod: extendModal.paymentMethod,
        amount: extendModal.amount,
        notes: extendModal.notes,
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: res.data.message || 'School license successfully extended!',
        });
        setExtendModal({
          isOpen: false,
          school: null,
          months: 12,
          planName: 'ANNUAL',
          paymentMethod: 'OFFLINE_BANK_WIRE',
          amount: 35000,
          notes: '',
          submitting: false,
        });
        fetchData();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to extend subscription.',
      });
      setExtendModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const exportTransactionsCSV = () => {
    const payments = paymentOverview?.payments || [];
    if (payments.length === 0) {
      setFeedback({ type: 'error', message: 'No transactions recorded to export.' });
      return;
    }

    const headers = ['Date', 'School Name', 'School Code', 'Plan', 'Amount', 'Currency', 'Tx Reference', 'Payment Method', 'Status'];
    const rows = payments.map((p) => [
      `"${new Date(p.created_at).toISOString()}"`,
      `"${(p.school_name || '').replace(/"/g, '""')}"`,
      `"${p.school_code || ''}"`,
      `"${p.plan_name || ''}"`,
      p.amount,
      `"${p.currency || 'ETB'}"`,
      `"${p.tx_ref || ''}"`,
      `"${p.payment_method || 'Chapa'}"`,
      `"${p.payment_status || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EthioHighHub_SaaS_Revenue_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const filteredPayments = (paymentOverview?.payments || []).filter((p) => {
    const matchesStatus = txStatusFilter === 'ALL' || p.payment_status === txStatusFilter;
    const q = txSearchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (p.school_name && p.school_name.toLowerCase().includes(q)) ||
      (p.school_code && p.school_code.toLowerCase().includes(q)) ||
      (p.tx_ref && p.tx_ref.toLowerCase().includes(q)) ||
      (p.plan_name && p.plan_name.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
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
            onClick={() => navigate('/superadmin/more')}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm backdrop-blur-md transition-all hover:scale-105 active:scale-95 border border-white/20"
            title="Configure Subscription Plans & Official Bank Accounts in More Components"
          >
            <Sliders className="w-4 h-4 text-purple-300" />
            <span>More Components (License & Banks)</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
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

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-teal-300 dark:hover:border-teal-700 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                School Subscriptions Revenue
              </p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
                {(paymentOverview?.metrics?.totalRevenue || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ETB</span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <span className="text-teal-600 dark:text-teal-400">
              Chapa Online: {(paymentOverview?.metrics?.chapaRevenue || 0).toLocaleString()} ETB
            </span>
            <span>•</span>
            <span className="text-purple-600 dark:text-purple-400">
              Bank Direct: {(paymentOverview?.metrics?.bankDirectRevenue || 0).toLocaleString()} ETB
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            *Sum of actual completed payments from school admins only. Creating plans/banks is an alternative option rule, not a transaction.
          </p>
        </div>
      </div>

      {/* More Components Suite Quick Showcase Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 border border-purple-500/30 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-purple-300 text-xs font-bold uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>Dedicated Super Admin Big Component</span>
          </div>
          <h2 className="text-xl font-black text-white">
            More Components: SaaS License Plans & Official Receiving Banks
          </h2>
          <p className="text-xs text-purple-200 leading-relaxed max-w-2xl">
            Configure which renewal plans (1, 2, or 3 plans) and official bank accounts (CBE, Awash, Abyssinia, Dashen, Telebirr) are delivered to school administrators. Each module is structured into its own clean sub-component.
          </p>
        </div>
        <Link
          to="/superadmin/more"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/40 transition-all shrink-0 self-start sm:self-auto"
        >
          <Sliders className="w-4 h-4 text-purple-200" />
          <span>Open More Components</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Primary Dashboard Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMainTab('schools')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all ${
              activeMainTab === 'schools'
                ? 'bg-purple-600 text-white shadow-purple-500/25 scale-[1.01]'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Registered High Schools Directory</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono">
              {schools.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('transactions')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all ${
              activeMainTab === 'transactions'
                ? 'bg-purple-600 text-white shadow-purple-500/25 scale-[1.01]'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Platform Transactions Audit</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono">
              {paymentOverview?.payments?.length || 0}
            </span>
          </button>
        </div>

        <Link
          to="/superadmin/more"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-all border border-purple-200 dark:border-purple-800"
        >
          <Sliders className="w-4 h-4 text-purple-500" />
          <span>More Components Suite</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Direct redirection banner if billing tab is ever accessed on overview */}
      {activeMainTab === "billing" && (
        <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center mx-auto">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              License Plans & Receiving Banks Moved to "More Components"
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              SaaS License Renewal Plans and Official Receiving Bank Accounts are now organized as dedicated sub-components inside the <strong>More Components</strong> suite.
            </p>
          </div>
          <Link
            to="/superadmin/more"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 transition-all"
          >
            <span>Open More Components Suite</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* TAB 2: REGISTERED HIGH SCHOOLS DIRECTORY */}
      {activeMainTab === 'schools' && (
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
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                            {s.subscriptionPlan || 'STANDARD'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.subscriptionStatus === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : s.subscriptionStatus === 'TRIAL'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}
                          >
                            {s.subscriptionStatus === 'ACTIVE' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            )}
                            {s.subscriptionStatus}
                          </span>
                        </div>

                        {s.subscriptionExpiresAt && (
                          <div className="text-[10px] flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span
                              className={
                                s.daysRemaining <= 7
                                  ? 'text-rose-600 font-bold'
                                  : s.daysRemaining <= 30
                                  ? 'text-amber-600 font-semibold'
                                  : 'text-emerald-600 font-semibold'
                              }
                            >
                              {s.isExpired ? 'Expired' : `${s.daysRemaining} days left`}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExtendModal({
                              isOpen: true,
                              school: s,
                              months: 12,
                              planName: s.subscriptionPlan || 'ANNUAL',
                              paymentMethod: 'OFFLINE_BANK_WIRE',
                              amount: 35000,
                              notes: '',
                              submitting: false,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 dark:text-purple-300 transition-colors shadow-sm"
                          title="Extend School License (Offline / Grant)"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Extend</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleStatus(s.id, s.subscriptionStatus, s.isActive)
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* TAB 3: PLATFORM SAAS TRANSACTIONS AUDIT */}
      {activeMainTab === 'transactions' && (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Chapa B2B SaaS Transactions & Renewals
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time financial audit of all school subscription payments and renewals
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search school or reference..."
                value={txSearchQuery}
                onChange={(e) => setTxSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 w-52"
              />
            </div>

            {/* Filter by Status */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              {['ALL', 'SUCCESS', 'PENDING', 'FAILED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setTxStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] transition-all ${
                    txStatusFilter === st
                      ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={exportTransactionsCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 dark:text-teal-300 transition-colors border border-teal-200 dark:border-teal-800"
              title="Download CSV Spreadsheet for Accounting"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">School</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Tx Reference</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPayments && filteredPayments.length > 0 ? (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {new Date(p.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                      {p.school_name} ({p.school_code})
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {p.plan_name}
                    </td>
                    <td className="py-3 px-4 font-black text-emerald-600 dark:text-emerald-400">
                      {parseFloat(p.amount).toLocaleString()} {p.currency}
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-500">
                      {p.tx_ref}
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-600 dark:text-slate-400">
                      {p.payment_method || 'Chapa (Telebirr/CBE)'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          p.payment_status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : p.payment_status === 'FAILED'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {p.payment_status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No transactions matching your search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

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
                      <option value="PENDING_PAYMENT">PENDING PAYMENT (Locked until School Pays License)</option>
                      <option value="ACTIVE">ACTIVE (Pre-Paid / Super Admin Grant)</option>
                      <option value="TRIAL">TRIAL (14-Day Free Access)</option>
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

      {/* Extend School License Modal */}
      {extendModal.isOpen && extendModal.school && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100">
                    Extend License: {extendModal.school.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Grant offline bank wire, cash renewal, or official subscription extension
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExtendModal((prev) => ({ ...prev, isOpen: false, school: null }))}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExtendSubscription} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Extension Plan & Duration *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Single Term', months: 4, plan: 'STANDARD', price: 15000 },
                    { label: 'Full Year', months: 12, plan: 'ANNUAL', price: 35000 },
                    { label: 'Two Years', months: 24, plan: 'ENTERPRISE', price: 60000 },
                  ].map((opt) => (
                    <button
                      key={opt.months}
                      type="button"
                      onClick={() =>
                        setExtendModal((prev) => ({
                          ...prev,
                          months: opt.months,
                          planName: opt.plan,
                          amount: opt.price,
                        }))
                      }
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        extendModal.months === opt.months
                          ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <p className="text-xs font-bold">{opt.label}</p>
                      <p className="text-[11px] text-slate-500">{opt.months} Months</p>
                      <p className="text-[11px] font-mono mt-1 text-purple-600 dark:text-purple-400 font-bold">
                        {opt.price.toLocaleString()} ETB
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment / Authorization Method *
                  </label>
                  <select
                    value={extendModal.paymentMethod}
                    onChange={(e) => setExtendModal((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <optgroup label="Major Ethiopian Banks">
                      <option value="CBE">Commercial Bank of Ethiopia (CBE)</option>
                      <option value="AWASH">Awash Bank (Awash Birr)</option>
                      <option value="ABYSSINIA">Bank of Abyssinia (BoA)</option>
                      <option value="DASHEN">Dashen Bank (Amole)</option>
                      <option value="COOP">Cooperative Bank of Oromia (CoopPay)</option>
                      <option value="TELEBIRR">Telebirr Direct Transfer</option>
                      <option value="HIBRET">Hibret Bank</option>
                      <option value="WEGAGEN">Wegagen Bank</option>
                      <option value="ZEMEN">Zemen Bank</option>
                      <option value="OROMIA">Oromia Bank</option>
                      <option value="AMHARA">Amhara Bank</option>
                    </optgroup>
                    <optgroup label="Other Authorization Methods">
                      <option value="CHEQUE">Certified Bank Cheque (CPO)</option>
                      <option value="CASH">Cash In-Person Deposit</option>
                      <option value="GRANT">Free Grant / Education Bureau Voucher</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Amount Paid (ETB)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={extendModal.amount}
                    onChange={(e) => setExtendModal((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Reference / Receipt Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. CBE Slip #TRX-94821 or Grant Letter #42"
                  value={extendModal.notes}
                  onChange={(e) => setExtendModal((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-900/60 text-purple-900 dark:text-purple-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                <span>
                  This immediately activates <strong>{extendModal.school.name}</strong>, sets status to ACTIVE, and generates an official receipt in both Super Admin and School Admin portals.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setExtendModal((prev) => ({ ...prev, isOpen: false, school: null }))}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={extendModal.submitting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-purple-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {extendModal.submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Confirm & Extend License</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SaaS Pricing & Official Bank Accounts Governance Modal */}
      {isBillingConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100">
                    SaaS Pricing & Official Bank Accounts Governance
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Control exactly what plans and receiving bank accounts are displayed to all school administrators.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBillingConfigOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-navigation tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50 dark:bg-slate-850">
              <button
                type="button"
                onClick={() => setBillingConfigTab('plans')}
                className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
                  billingConfigTab === 'plans'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>Subscription Plans ({managedPlans.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setBillingConfigTab('banks')}
                className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
                  billingConfigTab === 'banks'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Landmark className="w-4 h-4" />
                <span>Official Receiving Bank Accounts ({managedBanks.length})</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* TAB 1: PLANS */}
              {billingConfigTab === 'plans' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 text-purple-950 dark:text-purple-200 text-xs leading-relaxed space-y-1.5">
                    <p className="font-extrabold flex items-center gap-1.5 text-purple-800 dark:text-purple-300">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>Super Admin Resource Allocation & Renewal License Options</span>
                    </p>
                    <p>
                      Each license renewal plan promises tangible resources provided directly by your team — such as <strong>custom branding</strong>, <strong>guaranteed pricing</strong>, <strong>multi-year student records archives</strong>, and <strong>direct WhatsApp VIP technical support</strong>.
                    </p>
                    <p className="text-[11px] text-purple-700 dark:text-purple-300/80">
                      You can create and offer only <strong>1 plan</strong> (e.g., Full Academic Year), <strong>2 plans</strong>, or <strong>all 3 plans</strong> as alternative renewal choices for schools. School billing portals will strictly display <strong>ONLY the plans you activate</strong>.
                    </p>
                    <div className="pt-2 border-t border-purple-200/60 dark:border-purple-800/60 text-[11px] text-purple-900 dark:text-purple-200 flex items-start gap-1.5">
                      <span className="font-bold shrink-0">💡 Important:</span>
                      <span>Setting or creating a plan or bank account is simply delivering an <strong>alternative pricing rule</strong> to schools. It is <strong>NOT a transaction or payment</strong> (the Super Admin is not buying anything). It will <strong>never add to Total Revenue</strong>; Total Revenue is strictly the sum of actual completed payments paid by School Admins.</span>
                    </div>
                  </div>

                  {/* Batch Plan Selection & Publish Bar */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-purple-200 dark:border-purple-900 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                          <span>Select Plans to Offer to School Administrators ({selectedPlanIds.length} Selected)</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Check the plans below that you currently have the resources to fulfill.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleOpenCreatePlan}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create New Plan</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleBatchPublishPlans}
                          disabled={publishingPlans}
                          className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {publishingPlans ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>Publish Selection to All Schools</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Selection Checkbox Pills */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {managedPlans.map((plan) => {
                        const isChecked = selectedPlanIds.includes(plan.id);
                        return (
                          <div
                            key={plan.id}
                            onClick={() => handleTogglePlanSelect(plan.id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                              isChecked
                                ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 shadow-sm'
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // Handled by parent div onClick
                              className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 pointer-events-none"
                            />
                            <div className="text-xs">
                              <p className="font-bold text-slate-900 dark:text-slate-100 leading-snug">
                                {plan.name}
                              </p>
                              <p className="font-mono text-[11px] text-purple-600 dark:text-purple-400 font-bold mt-0.5">
                                {plan.price.toLocaleString()} {plan.currency} ({plan.durationMonths}m)
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detailed Plans List with Resources */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      License Plan Specifications & Deliverables
                    </h4>

                    {managedPlans.map((plan) => {
                      const isPublished = plan.isActive;
                      return (
                        <div
                          key={plan.id}
                          className={`p-5 rounded-2xl border transition-all space-y-4 ${
                            isPublished
                              ? 'bg-white dark:bg-slate-800 border-purple-300 dark:border-purple-800 shadow-sm'
                              : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-75'
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  {plan.id}
                                </span>
                                <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                                  {plan.name}
                                </h4>
                                {plan.isPopular && (
                                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                    Most Popular
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isPublished
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                  }`}
                                >
                                  {isPublished ? '● ACTIVE ON SCHOOL BILLING' : '○ HIDDEN FROM SCHOOLS'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Duration: <strong>{plan.durationMonths} Months</strong> · {plan.description}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                              {/* Price Edit */}
                              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl">
                                <input
                                  type="number"
                                  min="0"
                                  value={
                                    editingPlanPrice[plan.id] !== undefined
                                      ? editingPlanPrice[plan.id]
                                      : plan.price
                                  }
                                  onChange={(e) =>
                                    setEditingPlanPrice((prev) => ({
                                      ...prev,
                                      [plan.id]: e.target.value,
                                    }))
                                  }
                                  className="w-24 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                                <span className="text-xs font-bold text-slate-500 px-1">ETB</span>
                                {editingPlanPrice[plan.id] !== undefined && (
                                  <button
                                    type="button"
                                    onClick={() => handleSavePlanPrice(plan)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                  >
                                    Save
                                  </button>
                                )}
                              </div>

                              {/* Toggle Active Button */}
                              <button
                                type="button"
                                onClick={() => handleTogglePlan(plan.id, plan.isActive)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                  isPublished
                                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isPublished ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                  }`}
                                />
                                <span>{isPublished ? 'Active' : 'Enable'}</span>
                              </button>

                              {/* Edit Resources Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditPlan(plan)}
                                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title="Edit Plan Details & Resources"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {/* Delete Plan Button */}
                              <button
                                type="button"
                                onClick={() => handleDeletePlan(plan.id, plan.name)}
                                className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                title="Delete Plan"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Super Admin Deliverable Resources List */}
                          <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                              Super Admin Promised Deliverables & Resources ({plan.features?.length || 0}):
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {plan.features?.map((feat, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start gap-1.5 text-slate-700 dark:text-slate-300"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                  <span>{feat}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: BANK ACCOUNTS */}
              {billingConfigTab === 'banks' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 text-purple-950 dark:text-purple-200 text-xs leading-relaxed space-y-1">
                    <p className="font-extrabold flex items-center gap-1.5 text-purple-800 dark:text-purple-300">
                      <Landmark className="w-4 h-4 text-purple-600" />
                      <span>Multi-Bank Batch Activation Form</span>
                    </p>
                    <p>
                      Select all the receiving bank accounts (e.g. <strong>CBE</strong>, <strong>Awash Bank</strong>, <strong>Bank of Abyssinia</strong>, <strong>Dashen</strong>) that you want to set at once for all school administrators.
                    </p>
                  </div>

                  {/* Multi-Bank Selection & Batch Publish Bar */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-purple-200 dark:border-purple-900 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                          <span>Select Receiving Accounts ({selectedBankIds.length} Selected)</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Check all banks to be displayed on every school's billing and deposit page.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setNewBankModal((prev) => ({ ...prev, isOpen: true }))}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add New Bank</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleBatchPublishBanks}
                          disabled={publishingBanks}
                          className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {publishingBanks ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>Set & Publish Selected Banks to Schools</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Bank Selection Checkbox Pills */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {managedBanks.map((acc) => {
                        const isChecked = selectedBankIds.includes(acc.id);
                        return (
                          <div
                            key={acc.id}
                            onClick={() => handleToggleBankSelect(acc.id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                              isChecked
                                ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 shadow-sm'
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // Handled by parent div onClick
                              className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 pointer-events-none"
                            />
                            <div className="text-xs">
                              <p className="font-bold text-slate-900 dark:text-slate-100 leading-snug">
                                {acc.bank}
                              </p>
                              <p className="font-mono text-[11px] text-purple-600 dark:text-purple-400 font-bold mt-0.5">
                                {acc.accountNumber}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bank Accounts Detailed Cards */}
                  <div className="space-y-3">
                    {managedBanks.map((acc) => {
                      const isPublished = acc.isActive;
                      return (
                        <div
                          key={acc.id}
                          className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
                            isPublished
                              ? 'bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-800 shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                                {acc.bank}
                              </h4>
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {acc.code}
                              </span>
                              {acc.isPrimary && (
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                  Primary
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isPublished
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                }`}
                              >
                                {isPublished ? '● ACTIVE ON SCHOOL BILLING' : '○ HIDDEN'}
                              </span>
                            </div>
                            <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                              Account Number: {acc.accountNumber}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Holder Name: {acc.accountName} {acc.branch && `· Branch: ${acc.branch}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Toggle Active Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleBank(acc.id, acc.isActive)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                isPublished
                                  ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isPublished ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                }`}
                              />
                              <span>{isPublished ? 'Shown to Schools' : 'Hidden'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteBank(acc.id, acc.bank)}
                              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                              title="Remove Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsBillingConfigOpen(false)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Plan Modal */}
      {planModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-600" />
                <span>{planModal.isEditing ? `Edit Plan: ${planModal.name}` : 'Create New License Renewal Plan'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setPlanModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlanSubmit} className="space-y-3 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Plan Identifier Code (Unique) *
                </label>
                <input
                  type="text"
                  required
                  disabled={planModal.isEditing}
                  placeholder="e.g. ANNUAL, ENTERPRISE, TERM_2026"
                  value={planModal.id}
                  onChange={(e) => setPlanModal((prev) => ({ ...prev, id: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Plan Display Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Full Academic Year (12 Months)"
                  value={planModal.name}
                  onChange={(e) => setPlanModal((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Duration (Months) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={planModal.durationMonths}
                    onChange={(e) => setPlanModal((prev) => ({ ...prev, durationMonths: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Price (ETB) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={planModal.price}
                    onChange={(e) => setPlanModal((prev) => ({ ...prev, price: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Best value for standard annual operations."
                  value={planModal.description}
                  onChange={(e) => setPlanModal((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Super Admin Deliverables & Resources (One per line)
                </label>
                <textarea
                  rows={4}
                  placeholder={`Everything in the Annual Plan\nCustom school branding and domain support\nMulti-year historical student records archive\nGuaranteed pricing protection for 2 full years\nDirect WhatsApp & phone VIP technical support`}
                  value={planModal.featuresText}
                  onChange={(e) => setPlanModal((prev) => ({ ...prev, featuresText: e.target.value }))}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={planModal.isPopular}
                    onChange={(e) => setPlanModal((prev) => ({ ...prev, isPopular: e.target.checked }))}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Mark as "Most Popular"</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={planModal.isActive}
                    onChange={(e) => setPlanModal((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Active (Visible on School Billing)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPlanModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-1.5 rounded-xl border text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 shadow-md"
                >
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Bank Account Sub-modal */}
      {newBankModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-purple-600" />
                <span>Add Platform Bank Account</span>
              </h4>
              <button
                type="button"
                onClick={() => setNewBankModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBank} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bank of Abyssinia or Awash Bank"
                  value={newBankModal.bankName}
                  onChange={(e) =>
                    setNewBankModal((prev) => ({
                      ...prev,
                      bankName: e.target.value,
                      bankCode: e.target.value.substring(0, 5).toUpperCase(),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Account Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 100012345678"
                  value={newBankModal.accountNumber}
                  onChange={(e) => setNewBankModal((prev) => ({ ...prev, accountNumber: e.target.value }))}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  value={newBankModal.accountName}
                  onChange={(e) => setNewBankModal((prev) => ({ ...prev, accountName: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Branch
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bole Medhanialem Branch"
                  value={newBankModal.branch}
                  onChange={(e) => setNewBankModal((prev) => ({ ...prev, branch: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewBankModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-3 py-1.5 rounded-xl border text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700"
                >
                  Save Account
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
