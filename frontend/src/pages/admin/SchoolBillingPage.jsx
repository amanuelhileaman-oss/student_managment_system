import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Alert from '../../components/common/Alert';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Building,
  Zap,
  HelpCircle,
  AlertTriangle,
  History,
  Lock,
  Copy,
  Check,
  Landmark,
} from 'lucide-react';

const SchoolBillingPage = () => {
  const [loading, setLoading] = useState(true);
  const [subData, setSubData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [copiedAcc, setCopiedAcc] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('ANNUAL');
  const [initiating, setInitiating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleCopyAccount = (accNum) => {
    navigator.clipboard.writeText(accNum);
    setCopiedAcc(accNum);
    setTimeout(() => setCopiedAcc(''), 2500);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const [subRes, plansRes] = await Promise.all([
        api.get('/subscriptions/my-subscription'),
        api.get('/subscriptions/plans'),
      ]);

      if (subRes.data?.success) {
        setSubData(subRes.data.data);
      }
      if (plansRes.data?.success) {
        const loadedPlans = plansRes.data.data || [];
        setPlans(loadedPlans);
        if (plansRes.data.bankAccounts) {
          setBankAccounts(plansRes.data.bankAccounts);
        }
        if (loadedPlans.length > 0) {
          const exists = loadedPlans.some((p) => p.id === selectedPlanId);
          if (!exists) {
            setSelectedPlanId(loadedPlans[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching subscription details:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load subscription information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePayWithChapa = async () => {
    try {
      setInitiating(true);
      setErrorMsg('');

      // Create return URL that lands back on our frontend success page
      const returnUrl = `${window.location.origin}/admin/billing/success`;

      const res = await api.post('/subscriptions/initialize', {
        planId: selectedPlanId,
        returnUrl,
      });

      if (res.data?.success && res.data?.checkoutUrl) {
        if (res.data.txRef) {
          localStorage.setItem('pending_chapa_tx_ref', res.data.txRef);
        }
        // Redirect School Admin directly to Chapa hosted payment checkout
        window.location.href = res.data.checkoutUrl;
      } else {
        setErrorMsg(res.data?.message || 'Failed to initiate Chapa checkout.');
      }
    } catch (err) {
      console.error('Chapa initiation error:', err);
      setErrorMsg(err.response?.data?.message || 'Payment service error. Please try again.');
    } finally {
      setInitiating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner message="Loading subscription and billing data..." />
      </div>
    );
  }

  const school = subData?.school;
  const isSuspended = school?.subscription_status === 'SUSPENDED';
  const isExpired = school?.isExpired || school?.daysRemaining <= 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Subscription & Platform License
            </h1>
            <Badge variant="purple" size="sm">
              Chapa B2B Gateway
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your school SaaS license, view active days, and renew instantly with Telebirr, CBEBirr, or Bank Cards.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Status</span>
        </button>
      </div>

      {errorMsg && <Alert type="error" message={errorMsg} onClose={() => setErrorMsg('')} />}
      {successMsg && <Alert type="success" message={successMsg} onClose={() => setSuccessMsg('')} />}

      {/* Current License Status Banner */}
      <div className={`p-6 rounded-2xl border ${
        isSuspended || isExpired
          ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
          : 'bg-gradient-to-r from-primary-900/90 via-indigo-900/90 to-purple-900/90 text-white border-transparent shadow-xl'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Building className={`w-5 h-5 ${isSuspended || isExpired ? 'text-rose-600' : 'text-primary-300'}`} />
              <span className={`text-sm font-semibold tracking-wide uppercase ${isSuspended || isExpired ? 'text-rose-700 dark:text-rose-400' : 'text-primary-200'}`}>
                {school?.name || 'High School'} ({school?.code})
              </span>
            </div>

            <h2 className={`text-2xl font-extrabold ${isSuspended || isExpired ? 'text-rose-950 dark:text-rose-200' : 'text-white'}`}>
              {isSuspended ? 'Subscription Suspended' : isExpired ? 'Subscription Expired' : 'Active Institutional License'}
            </h2>

            <p className={`text-sm max-w-xl ${isSuspended || isExpired ? 'text-rose-700 dark:text-rose-300' : 'text-slate-200'}`}>
              {isSuspended || isExpired
                ? 'Your school license has lapsed. Renew your plan below using Chapa to maintain seamless classroom access.'
                : `Your school is running on the ${school?.subscription_plan || 'STANDARD'} plan with all academic modules and ChatHub enabled.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className={`px-5 py-3 rounded-xl border ${
              isSuspended || isExpired
                ? 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-800'
                : 'bg-white/10 backdrop-blur-md border-white/20 text-white'
            }`}>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Days Remaining</span>
              </div>
              <div className="text-2xl font-black">
                {school?.daysRemaining || 0} <span className="text-xs font-normal opacity-80">days</span>
              </div>
            </div>

            <div className={`px-5 py-3 rounded-xl border ${
              isSuspended || isExpired
                ? 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-800'
                : 'bg-white/10 backdrop-blur-md border-white/20 text-white'
            }`}>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Expires On</span>
              </div>
              <div className="text-sm font-bold">
                {school?.subscription_expires_at
                  ? new Date(school.subscription_expires_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Not set'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Available Plans Selection */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <span>Select License Renewal Plan</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select your term or annual duration. Payment is securely processed by Chapa.
            </p>
          </div>
        </div>

        {plans.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
            No license renewal plans are currently published by the Super Admin. Please contact platform administration.
          </div>
        ) : (
          <div className={`grid gap-6 ${plans.length === 1 ? 'grid-cols-1 max-w-lg mx-auto' : plans.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto' : 'grid-cols-1 md:grid-cols-3'}`}>
            {plans.map((p) => {
            const isSelected = selectedPlanId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPlanId(p.id)}
                className={`relative cursor-pointer rounded-2xl p-6 border-2 transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-primary-600 bg-primary-50/40 dark:bg-primary-950/30 shadow-lg scale-[1.01]'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                }`}
              >
                {p.isPopular && (
                  <span className="absolute -top-3 right-6 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm">
                    Most Popular
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">
                      {p.name}
                    </h4>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                    {p.description}
                  </p>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900 dark:text-slate-100">
                        {p.price.toLocaleString()}
                      </span>
                      <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                        {p.currency}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Full access for {p.durationMonths} months
                    </span>
                  </div>

                  <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                    {p.features?.map((f, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlanId(p.id);
                      handlePayWithChapa();
                    }}
                    disabled={initiating}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${
                      isSelected
                        ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-500/20 active:scale-95'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <span>Pay with Chapa</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Action checkout card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Official Chapa Payment Gateway
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Supports Telebirr, CBEBirr, Awash Birr, and Visa/Mastercard. Instant automatic activation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePayWithChapa}
            disabled={initiating}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
          >
            {initiating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Redirecting to Chapa...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>Proceed to Telebirr / CBEBirr Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Official Platform Bank Accounts for Direct Deposit / Wire */}
      <div className="p-6 rounded-3xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Direct Bank Transfer & Mobile App Deposit
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Prefer paying via CBE, Awash, Abyssinia, Dashen, or Telebirr app? Transfer directly to our official accounts below:
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-semibold border border-purple-200/60 dark:border-purple-800/60">
            <span>Deposit Reference:</span>
            <span className="font-mono font-bold">{school?.code || 'YOUR-SCHOOL-CODE'}</span>
          </div>
        </div>

        {bankAccounts.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            No direct bank transfer accounts are currently published by the Super Admin.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {bankAccounts.map((acc) => (
              <div
                key={acc.id}
                className={`p-4 rounded-2xl border transition-all relative ${
                  acc.isPrimary
                    ? 'bg-white dark:bg-slate-800 border-purple-300 dark:border-purple-700 shadow-sm'
                    : 'bg-white/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                }`}
              >
                {acc.isPrimary && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                    Primary
                  </span>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    {acc.bank}
                  </h4>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                      {acc.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyAccount(acc.accountNumber)}
                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      title="Copy Account Number"
                    >
                      {copiedAcc === acc.accountNumber ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 space-y-0.5">
                    <p className="truncate">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Name:</span> {acc.accountName}
                    </p>
                    {acc.branch && (
                      <p className="truncate">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">Branch:</span> {acc.branch}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Offline Payment Instructions:</p>
            <p className="text-[11px] leading-relaxed">
              1. Transfer the fee for your chosen plan ({plans.find((p) => p.id === selectedPlanId)?.name || 'Full Year'}) to any official account above.
              <br />
              2. Important: Always write your school code (<strong className="font-mono">{school?.code}</strong>) in the transaction reason or remark field.
              <br />
              3. Share your deposit slip or transaction reference with the Super Admin for immediate license activation.
            </p>
          </div>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <History className="w-5 h-5 text-slate-400" />
          <span>Payment History & Receipts</span>
        </h3>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Transaction Reference</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {subData?.payments && subData.payments.length > 0 ? (
                subData.payments.map((p) => (
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
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {p.plan_name}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                      {parseFloat(p.amount).toLocaleString()} {p.currency}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
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
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No payment history recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SchoolBillingPage;
