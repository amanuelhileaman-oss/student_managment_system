import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building,
  Calendar,
  CreditCard,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

const PaymentSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [verifyData, setVerifyData] = useState(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const verifyTransaction = async () => {
    let resolvedTxRef =
      searchParams.get('tx_ref') ||
      searchParams.get('trx_ref') ||
      localStorage.getItem('pending_chapa_tx_ref');

    // If still not found, fetch latest transaction for this school from backend
    if (!resolvedTxRef) {
      try {
        const subRes = await api.get('/subscriptions/my-subscription');
        const latestPayment = subRes.data?.data?.payments?.[0];
        if (latestPayment) {
          resolvedTxRef = latestPayment.tx_ref;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!resolvedTxRef) {
      setErrorMsg('No active transaction reference found to verify. If you recently paid, please check your billing history.');
      setVerifying(false);
      return;
    }

    try {
      setVerifying(true);
      setErrorMsg('');
      setIsCancelled(false);

      const res = await api.get(`/subscriptions/verify/${resolvedTxRef}`);
      if (res.data?.success) {
        setVerifyData(res.data);
        localStorage.removeItem('pending_chapa_tx_ref');
      } else {
        const msg = res.data?.message || 'Payment has not been completed on Chapa.';
        if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('fail')) {
          setIsCancelled(true);
        }
        setErrorMsg(msg);
      }
    } catch (err) {
      console.error('Verification error:', err);
      const msg = err.response?.data?.message || 'Payment could not be verified.';
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('fail')) {
        setIsCancelled(true);
      }
      setErrorMsg(msg);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    verifyTransaction();
  }, [searchParams]);

  if (verifying) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <LoadingSpinner message="Verifying payment with Chapa..." />
        <p className="text-xs text-slate-400 mt-2">
          Contacting the Chapa payment gateway to confirm your Telebirr / CBEBirr transaction.
        </p>
      </div>
    );
  }

  const payment = verifyData?.payment;
  const school = verifyData?.school;

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center">
        {errorMsg ? (
          <div className="space-y-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${
              isCancelled
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
            }`}>
              {isCancelled ? (
                <AlertTriangle className="w-8 h-8" />
              ) : (
                <XCircle className="w-8 h-8" />
              )}
            </div>

            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
              {isCancelled ? 'Payment Incomplete or Cancelled' : 'Payment Verification Incomplete'}
            </h2>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              {isCancelled
                ? 'The checkout session was cancelled on Chapa before completing payment. No money was deducted from your account. You can return to billing and try again whenever you are ready.'
                : errorMsg}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link
                to="/admin/billing"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Return to Billing & Try Again</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <button
                type="button"
                onClick={verifyTransaction}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-check Status</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Chapa Transaction Approved
              </span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                License Activated Successfully!
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your school’s SaaS platform subscription has been credited and is active.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400">School</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {school?.name || 'High School'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400">Plan</span>
                <span className="font-bold text-primary-600 dark:text-primary-400">
                  {payment?.plan_name || school?.subscription_plan}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400">Amount Paid</span>
                <span className="font-black text-slate-900 dark:text-slate-100">
                  {parseFloat(payment?.amount || 0).toLocaleString()} {payment?.currency || 'ETB'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400">Transaction Ref</span>
                <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300">
                  {payment?.tx_ref}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">New Expiration Date</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {school?.subscription_expires_at
                    ? new Date(school.subscription_expires_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Active'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/admin/dashboard"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span>Go to Admin Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <Link
                to="/admin/billing"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span>View Billing History</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
