import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../../components/common/ThemeToggle';
import {
  GraduationCap,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Building2,
  BookOpen,
  UserCheck,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('error') || '';
    }
    return '';
  });
  const [fieldErrors, setFieldErrors] = useState({});

  // If already logged in, automatically forward to user's authorized role dashboard
  useEffect(() => {
    if (user && user.role) {
      navigate(`/${user.role}/dashboard`, { replace: true });
    }
  }, [user, navigate]);

  // Subtle real-time detection hint as user enters their identifier
  const getRoleHint = () => {
    const val = email.toLowerCase().trim();
    if (!val) return { label: 'Universal Single Sign-On', icon: Sparkles, color: 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40 border-primary-200 dark:border-primary-800/50' };
    if (val.includes('superadmin')) {
      return { label: 'Platform Super Admin Access', icon: ShieldCheck, color: 'text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/50' };
    }
    if (val.includes('admin') || val.includes('principal')) {
      return { label: 'School Admin / Principal Portal', icon: Building2, color: 'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50' };
    }
    if (val.includes('teacher') || val.includes('faculty')) {
      return { label: 'Faculty & Teacher Portal', icon: BookOpen, color: 'text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50' };
    }
    if (val.includes('student') || val.includes('stu-') || /^\d+$/.test(val)) {
      return { label: 'Student Academic Portal', icon: UserCheck, color: 'text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/50' };
    }
    return { label: 'Institutional Single Sign-On', icon: Sparkles, color: 'text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/50' };
  };

  const detectedHint = getRoleHint();
  const HintIcon = detectedHint.icon;

  const validateForm = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = 'Email, Username, or Student/Teacher ID is required.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!validateForm()) return;
    setLoading(true);

    try {
      const data = await login(email.trim(), password);
      const role = data.user.role;
      if (role === 'superadmin') navigate('/superadmin/dashboard');
      else if (role === 'admin') navigate('/admin/dashboard');
      else if (role === 'teacher') navigate('/teacher/dashboard');
      else if (role === 'student') navigate('/student/dashboard');
      else navigate('/');
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      setErrorMessage(
        serverMsg || 'Invalid credentials. Please verify your email, ID, or password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-500">
      
      {/* Professional Students Campus Simulation Background Layer - Bold, Crisp & Vivid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        <img
          src="/students_simulation_campus.jpg"
          alt="Professional Students Academic Simulation Campus"
          className="w-full h-full object-cover object-center opacity-85 dark:opacity-85 filter brightness-95 contrast-110 saturate-105"
        />

        {/* Clean Vignette Overlays that Keep the Image Bold & Clear */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/35 to-slate-950/75" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/80" />

        {/* Subtle Geometric Dot Grid Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      </div>

      {/* Top Floating Glass Navigation Bar */}
      <header className="relative z-20 w-full px-4 sm:px-8 py-5 flex items-center justify-between">
        <Link
          to="/"
          className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-500/40 shadow-sm hover:shadow transition-all duration-300"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Home</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 dark:bg-emerald-400/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>SaaS Cloud Live</span>
          </div>
          <div className="p-1 rounded-full bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area - Split Showcase on Desktop */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-12 py-6 sm:py-10">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: SaaS Branding Showcase & Visual Feature Highlights (Hidden on small mobile, visible lg+) */}
          <div className="hidden lg:flex lg:col-span-6 flex-col justify-center space-y-6 pr-4 animate-fadeIn">
            <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/65 dark:bg-slate-950/70 backdrop-blur-xl border border-white/10 shadow-2xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-primary-500/20 text-primary-300 border border-primary-500/40 backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next-Gen High School Management</span>
              </div>
              
              <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.15] text-white drop-shadow-md">
                Empowering Ethiopian High Schools with{' '}
                <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-300 bg-clip-text text-transparent">
                  Intelligent Cloud Systems.
                </span>
              </h1>
              
              <p className="text-base text-slate-200 leading-relaxed max-w-lg drop-shadow-sm">
                A unified multi-tenant academic platform connecting School Principals, Teachers, Students, and Regional Directors through real-time gradebooks, automated admissions, and secure portals.
              </p>
            </div>

            {/* Three Glassmorphic Floating Feature Cards */}
            <div className="space-y-3 max-w-lg">
              <div className="group p-3.5 rounded-2xl bg-slate-900/70 dark:bg-slate-950/75 backdrop-blur-xl border border-white/10 hover:border-primary-500/50 shadow-xl transition-all duration-300 flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Multi-School Federation
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Isolated databases and customized academic years for every registered high school.
                  </p>
                </div>
              </div>

              <div className="group p-3.5 rounded-2xl bg-slate-900/70 dark:bg-slate-950/75 backdrop-blur-xl border border-white/10 hover:border-indigo-500/50 shadow-xl transition-all duration-300 flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Automated Grading & Transcripts
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Real-time assessment calculation, rank distribution, and one-click report card exports.
                  </p>
                </div>
              </div>

              <div className="group p-3.5 rounded-2xl bg-slate-900/70 dark:bg-slate-950/75 backdrop-blur-xl border border-white/10 hover:border-violet-500/50 shadow-xl transition-all duration-300 flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-violet-500/20 text-violet-400 shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Zero-Friction Role Routing
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Single universal login automatically discovers your school and directs you to your authorized dashboard.
                  </p>
                </div>
              </div>
            </div>

            {/* Platform Stats Counter */}
            <div className="pt-2 flex items-center gap-8 border-t border-white/15 max-w-lg">
              <div>
                <p className="text-2xl font-black text-white drop-shadow-sm">100%</p>
                <p className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">Cloud Native</p>
              </div>
              <div className="h-8 w-px bg-white/20" />
              <div>
                <p className="text-2xl font-black text-white drop-shadow-sm">Role-Based</p>
                <p className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">Automated SSO</p>
              </div>
              <div className="h-8 w-px bg-white/20" />
              <div>
                <p className="text-2xl font-black text-emerald-400 drop-shadow-sm">Secure</p>
                <p className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">Multi-Tenant</p>
              </div>
            </div>
          </div>

          {/* Right Column: Centered Glassmorphic Sign-In Card */}
          <div className="w-full lg:col-span-6 flex justify-center">
            <div className="w-full max-w-md relative group">
              
              {/* Radiant Ambient Card Aura */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl blur-xl opacity-30 dark:opacity-40 group-hover:opacity-50 transition duration-700 pointer-events-none" />

              {/* Elevated Glassmorphic Card Container */}
              <div className="relative bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl rounded-3xl border border-white/60 dark:border-slate-800/90 shadow-2xl p-6 sm:p-9 space-y-6">
                
                {/* Header with Animated Icon */}
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-500/25 mb-3.5 transform transition-transform duration-500 hover:rotate-6 hover:scale-105">
                    <GraduationCap className="w-7 h-7" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Sign In to EthioHighHub
                  </h2>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Enter your institutional credentials to access your dashboard
                  </p>

                  {/* Real-Time Intelligent Portal Indicator Badge */}
                  <div className="mt-3.5 flex justify-center">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-300 ${detectedHint.color}`}>
                      <HintIcon className="w-3.5 h-3.5 animate-pulse" />
                      <span>{detectedHint.label}</span>
                    </div>
                  </div>
                </div>

                {/* Server Error Alert Banner */}
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="flex-1 font-medium">{errorMessage}</span>
                  </div>
                )}

                {/* Form Fields */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Identifier Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Institutional Email, ID, or Username
                    </label>
                    <div className="relative rounded-xl shadow-xs group/input">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-primary-600 dark:group-focus-within/input:text-primary-400 transition-colors">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                        }}
                        placeholder="e.g. name@school.edu or ID"
                        autoComplete="username"
                        className={`block w-full pl-10 pr-3.5 py-3 text-sm bg-slate-50/80 dark:bg-slate-800/60 border rounded-xl focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 focus:outline-none text-slate-900 dark:text-slate-100 transition-all duration-200 ${
                          fieldErrors.email
                            ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                            : 'border-slate-200 dark:border-slate-700/80'
                        }`}
                      />
                    </div>
                    {fieldErrors.email && (
                      <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.email}</p>
                    )}
                  </div>

                  {/* Password Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Password
                      </label>
                    </div>
                    <div className="relative rounded-xl shadow-xs group/input">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-primary-600 dark:group-focus-within/input:text-primary-400 transition-colors">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: '' });
                        }}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className={`block w-full pl-10 pr-10 py-3 text-sm bg-slate-50/80 dark:bg-slate-800/60 border rounded-xl focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 focus:outline-none text-slate-900 dark:text-slate-100 transition-all duration-200 ${
                          fieldErrors.password
                            ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                            : 'border-slate-200 dark:border-slate-700/80'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">{fieldErrors.password}</p>
                    )}
                  </div>

                  {/* Radiant Sign In Button with Shimmer Sweep */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="group/btn relative w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden disabled:opacity-60 cursor-pointer"
                    >
                      {/* Shimmer Light Reflection Sweep */}
                      <div className="absolute inset-0 -translate-x-full group-hover/btn:animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="tracking-wide">Sign In to Portal</span>
                          <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Registration Services Divider & Links */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>New student applicant?</span>
                    <Link
                      to="/register/student"
                      className="font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline transition-colors inline-flex items-center gap-1"
                    >
                      <span>Register for Admission</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>Faculty or instructor?</span>
                    <Link
                      to="/register/teacher"
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline transition-colors inline-flex items-center gap-1"
                    >
                      <span>Register as Teacher</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer Notice */}
      <footer className="relative z-10 w-full py-4 text-center text-xs text-slate-400 dark:text-slate-500">
        <p>© {new Date().getFullYear()} EthioHighHub Education Cloud. Secured with Multi-Tenant Isolation & Role-Based Access Control.</p>
      </footer>

    </div>
  );
};

export default LoginPage;
