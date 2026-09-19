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
  Shield,
  BookOpen,
  UserCheck,
} from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();

  const [selectedRole, setSelectedRole] = useState('student');
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

  const rolePortals = [
    {
      role: 'admin',
      label: 'Admin',
      sublabel: 'Administration',
      icon: Shield,
      placeholder: 'Admin email or username',
      color: 'from-amber-500/10 to-orange-500/10 border-amber-300 dark:border-amber-700/60 text-amber-700 dark:text-amber-300 hover:border-amber-400',
      activeRing: 'ring-2 ring-amber-500 shadow-sm bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600',
    },
    {
      role: 'teacher',
      label: 'Teacher',
      sublabel: 'Faculty Portal',
      icon: BookOpen,
      placeholder: 'Faculty email or Teacher ID',
      color: 'from-emerald-500/10 to-teal-500/10 border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300 hover:border-emerald-400',
      activeRing: 'ring-2 ring-emerald-500 shadow-sm bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600',
    },
    {
      role: 'student',
      label: 'Student',
      sublabel: 'Student Portal',
      icon: UserCheck,
      placeholder: 'Student email or Student ID (e.g. STU-2026-001)',
      color: 'from-blue-500/10 to-indigo-500/10 border-blue-300 dark:border-blue-700/60 text-blue-700 dark:text-blue-300 hover:border-blue-400',
      activeRing: 'ring-2 ring-blue-500 shadow-sm bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600',
    },
  ];

  const currentPortal = rolePortals.find((p) => p.role === selectedRole) || rolePortals[2];

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
      if (role === 'admin') navigate('/admin/dashboard');
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors relative">
      <div className="absolute top-4 sm:top-6 left-4 sm:left-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </Link>
      </div>

      <div className="absolute top-4 sm:top-6 right-4 sm:right-6">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white shadow-lg shadow-primary-500/30 mb-4">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          Sign In to EthioHighHub
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Access your institutional portal using your Email, Student/Teacher ID, or Username
        </p>
      </div>

      <div className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-3 sm:px-0">
        <div className="bg-white dark:bg-slate-900 py-6 sm:py-8 px-4 sm:px-10 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 sm:space-y-6">

          {/* Three Role Portal Buttons (Admin, Teacher, Student) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Institutional Portals
              </span>
              <span className="text-[10px] text-slate-400">Select Role</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {rolePortals.map((portal) => {
                const Icon = portal.icon;
                const isSelected = selectedRole === portal.role;
                return (
                  <button
                    key={portal.role}
                    type="button"
                    onClick={() => {
                      setSelectedRole(portal.role);
                      if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                    }}
                    className={`p-2 rounded-xl border text-left transition-all flex flex-col items-start gap-0.5 bg-gradient-to-b ${portal.color} ${
                      isSelected ? portal.activeRing : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 w-full">
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs font-bold">{portal.label}</span>
                    </div>
                    <span className="text-[10px] opacity-75 truncate w-full">{portal.sublabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Institutional Email, ID, or Username
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                  }}
                  placeholder={currentPortal.placeholder}
                  autoComplete="username"
                  className={`block w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border rounded-xl focus:ring-2 focus:outline-none text-slate-900 dark:text-slate-100 ${
                    fieldErrors.email
                      ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500 focus:border-primary-500'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                  className={`block w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border rounded-xl focus:ring-2 focus:outline-none text-slate-900 dark:text-slate-100 ${
                    fieldErrors.password
                      ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500 focus:border-primary-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-primary-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Registration Links */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-col gap-2 text-center text-xs text-slate-500 dark:text-slate-400">
            <div>
              New student applicant?{' '}
              <Link
                to="/register/student"
                className="font-semibold text-primary-600 dark:text-primary-400 hover:underline"
              >
                Register for Admission
              </Link>
            </div>
            <div>
              Faculty member?{' '}
              <Link
                to="/register/teacher"
                className="font-semibold text-primary-600 dark:text-primary-400 hover:underline"
              >
                Register as Teacher
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
