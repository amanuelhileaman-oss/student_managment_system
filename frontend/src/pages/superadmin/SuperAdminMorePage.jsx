import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  Sliders,
  Landmark,
  Zap,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Edit3,
  Copy,
  Check,
  ChevronDown,
  Layers,
  ArrowLeft,
  Building2,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

const SuperAdminMorePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active sub-component tab: 'all' | 'plans' | 'banks'
  // When super admin clicks "More Components" (/superadmin/more), default to 'all' to show BOTH subcomponents together
  const tabFromUrl = searchParams.get('tab');
  const [activeSubTab, setActiveSubTab] = useState(tabFromUrl || 'all');

  // Reactively sync activeSubTab when URL search params change
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'plans' || tab === 'banks' || tab === 'all') {
      setActiveSubTab(tab);
    } else {
      setActiveSubTab('all'); // Show BOTH subcomponents by default
    }
  }, [searchParams]);

  const [managedPlans, setManagedPlans] = useState([]);
  const [managedBanks, setManagedBanks] = useState([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState([]);
  const [selectedBankIds, setSelectedBankIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publishingPlans, setPublishingPlans] = useState(false);
  const [publishingBanks, setPublishingBanks] = useState(false);
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const [editingPlanPrice, setEditingPlanPrice] = useState({});
  const [copiedAcc, setCopiedAcc] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Plan creation / editing modal
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

  // Bank creation modal
  const [newBankModal, setNewBankModal] = useState({
    isOpen: false,
    bankName: '',
    bankCode: '',
    accountNumber: '',
    accountName: 'EthioHighHub SaaS Cloud Technologies',
    branch: '',
    isPrimary: false,
  });

  // Sync tab with URL search params
  const handleTabChange = (tab) => {
    setActiveSubTab(tab);
    if (tab === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
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
      console.error('Failed to load settings:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load configuration settings.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Update activeSubTab when URL parameter changes
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && tabFromUrl !== activeSubTab) {
      setActiveSubTab(tabFromUrl);
    }
  }, [searchParams]);

  // Copy account number helper
  const handleCopyAccount = (accNum) => {
    navigator.clipboard.writeText(accNum);
    setCopiedAcc(accNum);
    setTimeout(() => setCopiedAcc(''), 2500);
  };

  // Preset Selection for Plans
  const handleSelectPlanPreset = (preset) => {
    if (preset === 'ANNUAL_ONLY') {
      setSelectedPlanIds(['ANNUAL']);
    } else if (preset === 'TERM_ANNUAL') {
      setSelectedPlanIds(['TERM', 'ANNUAL']);
    } else if (preset === 'ALL_THREE') {
      setSelectedPlanIds(['TERM', 'ANNUAL', 'ENTERPRISE']);
    }
  };

  // Plan Checkbox Toggle
  const handleTogglePlanSelect = (planId) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
    );
  };

  // Publish Selected Plans to All Schools
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
          message: `SUCCESS! Exactly ${selectedPlanIds.length} renewal plan(s) published to all school portals!`,
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to publish renewal plans.',
      });
    } finally {
      setPublishingPlans(false);
    }
  };

  // Toggle Single Plan
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
          message: `Plan ${planId} is now ${!currentActive ? 'PUBLISHED & visible to schools' : 'HIDDEN from schools'}.`,
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to update plan status.' });
    }
  };

  // Save Inline Plan Price
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
          message: `Price for "${plan.name}" updated to ${parseFloat(newPrice).toLocaleString()} ETB!`,
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to save plan price.' });
    }
  };

  // Delete Plan
  const handleDeletePlan = async (planId, planName) => {
    if (!window.confirm(`Are you sure you want to delete plan "${planName}"?`)) return;
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

  // Plan Modal Helpers
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
          message: `Saved plan "${planModal.name}"!`,
        });
        setPlanModal((prev) => ({ ...prev, isOpen: false }));
        fetchSettings();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to save plan.' });
    }
  };

  // Multi-Bank Helpers
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
          message: `Bank account is now ${!currentActive ? 'PUBLISHED & visible' : 'HIDDEN from schools'}.`,
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to update bank account status.' });
    }
  };

  const handleDeleteBank = async (bankId, bankName) => {
    if (!window.confirm(`Delete bank account "${bankName}"?`)) return;
    try {
      const res = await api.delete(`/subscriptions/superadmin/bank-accounts/${bankId}`);
      if (res.data?.success) {
        setManagedBanks((prev) => prev.filter((b) => b.id !== bankId));
        setSelectedBankIds((prev) => prev.filter((id) => id !== bankId));
        setFeedback({ type: 'success', message: `Bank account "${bankName}" deleted.` });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to delete bank account.' });
    }
  };

  const handleCreateBankSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/subscriptions/superadmin/bank-accounts', {
        bankName: newBankModal.bankName,
        bankCode: newBankModal.bankCode.toUpperCase().trim(),
        accountNumber: newBankModal.accountNumber,
        accountName: newBankModal.accountName,
        branch: newBankModal.branch,
        isPrimary: newBankModal.isPrimary,
      });
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Added bank "${newBankModal.bankName}"!`,
        });
        setNewBankModal({
          isOpen: false,
          bankName: '',
          bankCode: '',
          accountNumber: '',
          accountName: 'EthioHighHub SaaS Cloud Technologies',
          branch: '',
          isPrimary: false,
        });
        fetchSettings();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to add bank account.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Big Component Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/superadmin/dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-purple-200 text-xs font-semibold tracking-wide transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Platform Overview</span>
            </button>
            <span className="text-white/40">•</span>
            <span className="text-purple-300 text-xs font-bold uppercase tracking-wider">
              More Components Suite
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            More Components: SaaS License & Receiving Banks
          </h1>
          <p className="text-purple-200 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Centralized governance over school subscription renewal rules and official receiving payment accounts.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            type="button"
            onClick={fetchSettings}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
            title="Refresh Settings"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
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

      {/* Super Admin Capacity & Alternative Rules Banner */}
      <div className="p-5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-purple-950 dark:text-purple-200 text-xs leading-relaxed space-y-2">
        <p className="font-extrabold flex items-center gap-1.5 text-purple-900 dark:text-purple-300 text-sm">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>Super Admin Resource Allocation & Alternative Rule Delivery</span>
        </p>
        <p>
          Each renewal tier requires concrete deliverables provided directly by your team — such as <strong>custom branding</strong>, <strong>multi-year historical records archive</strong>, <strong>guaranteed pricing protection</strong>, and <strong>direct WhatsApp & phone VIP technical support</strong>.
        </p>
        <div className="pt-2 border-t border-purple-200/60 dark:border-purple-800/60 flex flex-wrap items-center gap-4 text-[11px] text-purple-800 dark:text-purple-300 font-medium">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Publishing sets alternative options for schools
          </span>
          <span>•</span>
          <span>
            Not a transaction/payment (Super Admin is not buying anything) — never added to Platform Revenue.
          </span>
        </div>
      </div>

      {/* Sub-Component Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all ${
            activeSubTab === 'all'
              ? 'bg-purple-600 text-white shadow-purple-500/25 shadow-md scale-[1.01]'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Both Sub-Components (All in One)</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-mono">
            {managedPlans.filter((p) => p.isActive).length} Plans · {managedBanks.filter((b) => b.isActive).length} Banks
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('plans')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all ${
            activeSubTab === 'plans'
              ? 'bg-purple-600 text-white shadow-purple-500/25 shadow-md scale-[1.01]'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Sub-Component 1: License Renewal Plans ({managedPlans.length})</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-mono">
            {managedPlans.filter((p) => p.isActive).length} Published
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('banks')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition-all ${
            activeSubTab === 'banks'
              ? 'bg-purple-600 text-white shadow-purple-500/25 shadow-md scale-[1.01]'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Sub-Component 2: Receiving Bank Accounts ({managedBanks.length})</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-mono">
            {managedBanks.filter((b) => b.isActive).length} Published
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-COMPONENT 1: LICENSE RENEWAL PLANS (IMAGE 2)                          */}
      {/* ========================================================================= */}
      {(activeSubTab === 'plans' || activeSubTab === 'all') && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <span>License Renewal Plans Allocation (Offer 1, 2, or 3 Plans)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Publish 1 plan (Full Academic Year), 2 plans, or all 3 plans based strictly on the resources you can guarantee to schools.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleOpenCreatePlan}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
              >
                <Plus className="w-4 h-4" />
                <span>Create Custom Plan</span>
              </button>

              <button
                type="button"
                onClick={handleBatchPublishPlans}
                disabled={publishingPlans}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {publishingPlans ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Publish Selected Plans to All Schools</span>
              </button>
            </div>
          </div>

          {/* Quick Selection Presets */}
          <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300">
              Quick Selection Presets (Select 1, 2, or 3 Plans):
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectPlanPreset('ANNUAL_ONLY')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedPlanIds.length === 1 && selectedPlanIds.includes('ANNUAL')
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-purple-200 dark:border-purple-800 hover:bg-purple-100'
                }`}
              >
                Offer 1 Plan Only (Full Academic Year 35,000 ETB)
              </button>

              <button
                type="button"
                onClick={() => handleSelectPlanPreset('TERM_ANNUAL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedPlanIds.length === 2 && selectedPlanIds.includes('TERM') && selectedPlanIds.includes('ANNUAL')
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-purple-200 dark:border-purple-800 hover:bg-purple-100'
                }`}
              >
                Offer 2 Plans (Term 15k + Full Year 35k)
              </button>

              <button
                type="button"
                onClick={() => handleSelectPlanPreset('ALL_THREE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedPlanIds.length >= 3
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-purple-200 dark:border-purple-800 hover:bg-purple-100'
                }`}
              >
                Offer All 3 Plans (Term + Full Year + 2-Year Institutional)
              </button>
            </div>
          </div>

          {/* Detailed Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {managedPlans.map((plan) => {
              const isSelected = selectedPlanIds.includes(plan.id);
              const isPublished = plan.isActive;
              const isEnterprise = plan.id === 'ENTERPRISE';

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50/20 dark:bg-purple-950/20 shadow-md'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-60'
                  }`}
                >
                  <div>
                    {/* Header & Checkbox */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleTogglePlanSelect(plan.id)}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                          {plan.name}
                        </h4>
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                          isPublished
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        }`}
                      >
                        {isPublished ? '● Published' : '○ Hidden'}
                      </span>
                    </div>

                    {plan.isPopular && (
                      <div className="mb-2">
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          Most Popular Choice
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      {plan.description}
                    </p>

                    {/* Price & Duration */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
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
                          className="w-24 px-2 py-1 text-xs font-bold font-mono bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                        <span className="text-xs font-bold text-slate-500 px-1">
                          {plan.currency}
                        </span>
                        {editingPlanPrice[plan.id] !== undefined && (
                          <button
                            type="button"
                            onClick={() => handleSavePlanPrice(plan)}
                            className="px-2 py-1 rounded bg-purple-600 text-white text-[10px] font-bold"
                            title="Save New Price"
                          >
                            Save
                          </button>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        ({plan.durationMonths}m access)
                      </span>
                    </div>

                    {/* 2-Year Resource Callout */}
                    {isEnterprise && (
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 mb-3 text-[11px] text-amber-900 dark:text-amber-200">
                        <p className="font-bold flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                          <span>Super Admin Deliverables Check:</span>
                        </p>
                        <p className="mt-0.5 text-[10px] text-amber-800 dark:text-amber-300">
                          Requires dedicated infrastructure for custom branding, 2-year transcripts, and direct WhatsApp VIP technical support.
                        </p>
                      </div>
                    )}

                    {/* Promised Features */}
                    <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Promised Resources ({plan.features?.length || 0}):
                      </p>
                      {plan.features?.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleTogglePlan(plan.id, plan.isActive)}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-all ${
                        isPublished
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {isPublished ? 'Hide from Schools' : 'Show to Schools'}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditPlan(plan)}
                        className="p-1.5 text-slate-400 hover:text-purple-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Edit Plan"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(plan.id, plan.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Delete Plan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-COMPONENT 2: OFFICIAL RECEIVING BANKS (IMAGE 1)                       */}
      {/* ========================================================================= */}
      {(activeSubTab === 'banks' || activeSubTab === 'all') && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span>Official Receiving Bank Accounts (Multi-Bank Dropdown Form)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select one or multiple banks (CBE, Awash, Abyssinia, Dashen, Telebirr) in the dropdown form and set them to all schools at once.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNewBankModal((prev) => ({ ...prev, isOpen: true }))}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Bank</span>
              </button>
            </div>
          </div>

          {/* Dropdown Form Row */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Dropdown Container */}
            <div className="relative flex-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Select Receiving Banks for School Portals:
              </label>
              <button
                type="button"
                onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-purple-200 dark:border-purple-800 hover:border-purple-500 text-left transition-all shadow-sm"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {selectedBankIds.length === 0
                        ? 'No banks selected (schools will have no direct bank deposit)'
                        : managedBanks
                            .filter((b) => selectedBankIds.includes(b.id))
                            .map((b) => b.code || b.bank)
                            .join(', ')}
                    </p>
                    <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                      {selectedBankIds.length} of {managedBanks.length} Banks Selected
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 transition-transform ${
                    isBankDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu Popup */}
              {isBankDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 z-30 p-3 rounded-2xl bg-white dark:bg-slate-900 border-2 border-purple-300 dark:border-purple-700 shadow-2xl space-y-2 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 px-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Check banks to deliver to schools:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllBanks}
                        className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllBanks}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1.5 p-1">
                    {managedBanks.map((acc) => {
                      const isChecked = selectedBankIds.includes(acc.id);
                      return (
                        <div
                          key={acc.id}
                          onClick={() => handleToggleBankSelect(acc.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            isChecked
                              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded text-purple-600 focus:ring-purple-500 pointer-events-none"
                            />
                            <div>
                              <p className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                {acc.bank}
                              </p>
                              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                Acc: {acc.accountNumber} {acc.branch ? `· ${acc.branch}` : ''}
                              </p>
                            </div>
                          </div>
                          {acc.isPrimary && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                              Primary
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsBankDropdownOpen(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-sm"
                    >
                      Done Selecting
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Set Banks Button */}
            <div className="lg:w-auto shrink-0 flex flex-col justify-end pt-5">
              <button
                type="button"
                onClick={handleBatchPublishBanks}
                disabled={publishingBanks}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-purple-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {publishingBanks ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Set & Publish Selected Banks to All Schools Admin</span>
              </button>
            </div>
          </div>

          {/* Currently Published Bank Accounts Grid */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Currently Registered Accounts ({managedBanks.length}):
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {managedBanks.map((acc) => {
                const isPublished = acc.isActive;
                return (
                  <div
                    key={acc.id}
                    className={`p-4 rounded-2xl border transition-all relative space-y-2 ${
                      isPublished
                        ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800 shadow-sm'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isPublished
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        }`}
                      >
                        {isPublished ? '● ACTIVE ON SCHOOL BILLING' : '○ HIDDEN'}
                      </span>
                      {acc.isPrimary && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                          Primary
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        {acc.bank}
                      </h4>
                      <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg mt-1">
                        <span className="font-mono font-bold text-xs text-purple-600 dark:text-purple-400">
                          {acc.accountNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyAccount(acc.accountNumber)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title="Copy Account Number"
                        >
                          {copiedAcc === acc.accountNumber ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1">
                        {acc.accountName} {acc.branch ? `(${acc.branch})` : ''}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleBank(acc.id, acc.isActive)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-lg ${
                          isPublished
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {isPublished ? 'Hide from Schools' : 'Show to Schools'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteBank(acc.id, acc.bank)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Delete Bank Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Plan Creation / Edit Modal */}
      {planModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100">
                    {planModal.isEditing ? `Edit Plan ${planModal.id}` : 'Create License Renewal Plan'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define the duration, fee, and promised resources for schools.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPlanModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlanSubmit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Plan Identifier Code (Unique uppercase ID)
                </label>
                <input
                  type="text"
                  required
                  disabled={planModal.isEditing}
                  placeholder="e.g. ANNUAL, TERM, ENTERPRISE"
                  value={planModal.id}
                  onChange={(e) => setPlanModal((prev) => ({ ...prev, id: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Display Plan Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Full Academic Year (12 Months)"
                  value={planModal.name}
                  onChange={(e) => setPlanModal((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    required
                    value={planModal.durationMonths}
                    onChange={(e) =>
                      setPlanModal((prev) => ({ ...prev, durationMonths: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Price (ETB)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={planModal.price}
                    onChange={(e) => setPlanModal((prev) => ({ ...prev, price: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Short Description
                </label>
                <textarea
                  rows="2"
                  value={planModal.description}
                  onChange={(e) =>
                    setPlanModal((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Summary for school administrators..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Promised Deliverables (One feature per line)
                </label>
                <textarea
                  rows="4"
                  value={planModal.featuresText}
                  onChange={(e) =>
                    setPlanModal((prev) => ({ ...prev, featuresText: e.target.value }))
                  }
                  placeholder="Unlimited student & teacher enrollment&#10;Continuous assessment & report cards&#10;School-isolated ChatHub channels"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={planModal.isPopular}
                    onChange={(e) =>
                      setPlanModal((prev) => ({ ...prev, isPopular: e.target.checked }))
                    }
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Mark as "Most Popular" Badge</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPlanModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20"
                >
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Bank Modal */}
      {newBankModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                    Add Receiving Bank Account
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Schools will deposit directly to this account.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNewBankModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBankSubmit} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dashen Bank, Awash Bank, CBE"
                  value={newBankModal.bankName}
                  onChange={(e) =>
                    setNewBankModal((prev) => ({ ...prev, bankName: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Short Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DASHEN, AWASH, CBE"
                  value={newBankModal.bankCode}
                  onChange={(e) =>
                    setNewBankModal((prev) => ({ ...prev, bankCode: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1000293847561"
                  value={newBankModal.accountNumber}
                  onChange={(e) =>
                    setNewBankModal((prev) => ({ ...prev, accountNumber: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Beneficiary Account Name
                </label>
                <input
                  type="text"
                  required
                  value={newBankModal.accountName}
                  onChange={(e) =>
                    setNewBankModal((prev) => ({ ...prev, accountName: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bole Medhanialem Branch"
                  value={newBankModal.branch}
                  onChange={(e) =>
                    setNewBankModal((prev) => ({ ...prev, branch: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={newBankModal.isPrimary}
                    onChange={(e) =>
                      setNewBankModal((prev) => ({ ...prev, isPrimary: e.target.checked }))
                    }
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Set as Primary Receiving Bank Account</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewBankModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20"
                >
                  Add Bank Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminMorePage;
