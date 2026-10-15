import React from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/common/ThemeToggle';
import {
  GraduationCap,
  ShieldCheck,
  BookOpen,
  Users,
  Layers,
  Award,
  ArrowRight,
  MessageSquare,
  Compass,
  FileCheck,
  Building2,
  LogIn,
  Sparkles,
  Activity,
} from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors relative overflow-hidden">
      {/* High-Tech Modern Campus Simulation Background Layer - Bold, Crisp & Vivid */}
      <div className="absolute top-0 left-0 right-0 h-[650px] sm:h-[800px] lg:h-[950px] overflow-hidden pointer-events-none select-none z-0">
        <img
          src="/modern_school_simulation.jpg"
          alt="Modern School Simulation Campus"
          className="w-full h-full object-cover object-top opacity-85 dark:opacity-85 scale-[1.01] filter brightness-95 contrast-110 saturate-105"
        />
        {/* Clean Vignette Overlays that Keep the Architecture Bold & Clear */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/30 to-slate-50 dark:to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(59,130,246,0.15),rgba(255,255,255,0))]" />
        
        {/* Digital Blueprint & Simulation Grid */}
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      </div>

      {/* Top Header */}
      <header className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl sticky top-0 z-30 transition-colors shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-primary-500/25">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight">
                EthioHigh<span className="text-primary-600 dark:text-primary-400">Hub</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                Institutional Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => navigate('/register/teacher')}
              className="hidden sm:inline-flex px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Faculty Portal
            </button>
            <button
              type="button"
              onClick={() => navigate('/register/student')}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
            >
              Student Admission
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-95 text-white shadow-sm shadow-primary-500/30 flex items-center gap-1.5 transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 lg:py-20 flex flex-col items-center text-center relative z-10">
        {/* Floating Campus Simulation Telemetry HUD Badges (Desktop) */}
        <div className="hidden xl:flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/75 dark:bg-slate-900/80 border border-cyan-500/30 dark:border-cyan-400/30 backdrop-blur-xl shadow-xl shadow-cyan-500/5 text-left text-xs absolute left-2 lg:left-6 top-16 animate-float">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </div>
          <div>
            <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <span>Campus Simulation</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-mono">ONLINE</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Classrooms, STEM Labs & Sections Synchronized</div>
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/75 dark:bg-slate-900/80 border border-indigo-500/30 dark:border-indigo-400/30 backdrop-blur-xl shadow-xl shadow-indigo-500/5 text-left text-xs absolute right-2 lg:right-6 top-24 animate-float-reverse">
          <div className="w-7 h-7 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <span>Academic Telemetry</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">99.4% Verified Attendance • Zero Overfill</div>
          </div>
        </div>

        {/* Top Status Badge */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-white/80 dark:bg-slate-900/80 text-primary-600 dark:text-primary-300 border border-primary-500/30 dark:border-primary-500/30 backdrop-blur-md mb-6 shadow-sm shadow-primary-500/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Building2 className="w-3.5 h-3.5 text-primary-500" />
          <span>Official Secondary School Management & Academic System</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight max-w-4xl text-slate-900 dark:text-slate-100 leading-[1.15] drop-shadow-sm">
          Excellence in Secondary Education & Academic Administration
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed drop-shadow-sm">
          Welcome to EthioHighHub. A secure institutional platform connecting students, faculty members, and administrators with strict role responsibilities and comprehensive academic tracking.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2 transition-all hover:shadow-primary-500/40"
          >
            <span>Access Portal (Sign In)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/register/student')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm shadow-md transition-all hover:border-primary-500/40"
          >
            Apply for Admission
          </button>
        </div>

        {/* Modern Simulation Live Campus Telemetry Bar */}
        <div className="mt-12 w-full max-w-4xl p-3 sm:p-4 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-900/5 grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Simulation</div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">99.4% Live Sync</div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Sections</div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">50/50 Strict Cap</div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Curriculum</div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Grades 9 - 12</div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Security</div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Isolated Tenants</div>
            </div>
          </div>
        </div>

        {/* Academic Structure Highlights */}
        <div className="mt-14 w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {/* Foundation: Grades 9 & 10 */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-md relative overflow-hidden hover:border-primary-500/40 hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-5">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 mb-3">
              Grades 9 & 10 • General Stream
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Comprehensive Foundation
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              All students in Grade 9 and Grade 10 undertake the mandatory General Stream curriculum. Admission strictly verifies official Grade 8 Ministry completion certificates before class placement.
            </p>
          </div>

          {/* Specialization: Grades 11 & 12 */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-md relative overflow-hidden hover:border-primary-500/40 hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5">
              <Compass className="w-6 h-6" />
            </div>
            <div className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 mb-3">
              Grades 11 & 12 • Stream Specialization
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Natural & Social Science Streams
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Upon completing Grade 10, students are evaluated by our academic engine for placement into either the Natural Sciences Stream (advanced Math, Physics, Chemistry, Biology) or Social Sciences Stream based on merit and prerequisites.
            </p>
          </div>
        </div>

        {/* Institutional Capabilities Grid */}
        <div className="mt-12 w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
          <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:border-primary-500/40 hover:shadow-lg transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm mb-1.5">Strict Role Isolation</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Isolated dashboards and verified permissions for administrators, faculty teachers, and students.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:border-primary-500/40 hover:shadow-lg transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3.5">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm mb-1.5">50/50 Section Capacity</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Atomic class registration preventing over-enrollment, with instant dynamic section creation by administrators.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:border-primary-500/40 hover:shadow-lg transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3.5">
              <Award className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm mb-1.5">Group Score Propagation</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Faculty submit scores using unified Group Codes, instantly distributing project marks to all group members.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:border-primary-500/40 hover:shadow-lg transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-3.5">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm mb-1.5">Multi-Role Live Chat</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Real-time communication between administrators, teachers, and students with in-app notifications.
            </p>
          </div>
        </div>

        {/* Admission & Faculty Registration Notice */}
        <div className="mt-14 w-full max-w-3xl p-6 rounded-3xl bg-gradient-to-r from-primary-500/10 via-indigo-500/10 to-purple-500/10 backdrop-blur-xl border border-primary-500/30 dark:border-primary-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-left shadow-lg">
          <div>
            <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">
              New Applicant or Faculty Member?
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Submit your admission documents or register your faculty credentials with administrative verification.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/register/student')}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition-all"
            >
              Student Admission
            </button>
            <button
              type="button"
              onClick={() => navigate('/register/teacher')}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-all"
            >
              Teacher Registration
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 py-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md">
        EthioHighHub • High School Academic Management System • All rights reserved &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default LandingPage;
