import React from 'react';
import { Link } from 'react-router-dom';
import {
  Lock,
  CreditCard,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Clock,
  Building2,
  CheckCircle2,
  Layers,
  Users,
  GraduationCap,
  Calendar,
} from 'lucide-react';

const SubscriptionLockedCard = ({ moduleName = 'This feature' }) => {
  return (
    <div className="max-w-3xl mx-auto my-8 p-6 sm:p-10 rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-500/30 dark:border-amber-500/20 shadow-xl relative overflow-hidden animate-in fade-in duration-200">
      {/* Decorative background glow */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center space-y-6">
        {/* Lock Icon Emblem */}
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-rose-500 p-0.5 shadow-xl shadow-amber-500/20">
            <div className="w-full h-full rounded-[22px] bg-slate-900 flex items-center justify-center text-amber-400">
              <Lock className="w-9 h-9" />
            </div>
          </div>
          <span className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-amber-500 text-white shadow-md">
            <Clock className="w-4 h-4" />
          </span>
        </div>

        {/* Header Texts */}
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>School Activation Pending</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Complete License Payment to Unlock {moduleName}
          </h2>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Your high school tenant was provisioned by the Super Administrator. To activate your school and unlock complete management features, please select an annual license plan and complete payment.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Users className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Official Student Admissions & Directory</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <GraduationCap className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Teacher Faculty & Subject Assignments</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Layers className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Sections, Capacity & Stream Allocation</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Class Timetables, Attendance & Grading</span>
          </div>
        </div>

        {/* Direct Action Button to Billing */}
        <div className="pt-2 w-full sm:w-auto">
          <Link
            to="/admin/billing"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 active:scale-98 text-white font-bold text-sm shadow-xl shadow-amber-600/25 transition-all flex items-center justify-center gap-2.5 group"
          >
            <CreditCard className="w-4 h-4" />
            <span>Select License Plan & Pay</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
            Supports Chapa online payment & verified bank wire transfers (CBE, Awash, Abyssinia).
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionLockedCard;
