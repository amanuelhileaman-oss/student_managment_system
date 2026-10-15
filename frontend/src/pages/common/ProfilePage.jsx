import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Alert from '../../components/common/Alert';
import {
  User,
  Shield,
  BookOpen,
  Award,
  Camera,
  Phone,
  Mail,
  Lock,
  Key,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Sliders,
  Check,
} from 'lucide-react';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
];

const ProfilePage = () => {
  const { user, refreshUser, updateUserSession } = useAuth();

  // Active view tab: 'all' | 'email' | 'password' | 'personal'
  const [activeTab, setActiveTab] = useState('all');

  // Email form state
  const [emailForm, setEmailForm] = useState({
    newEmail: '',
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    bio: '',
    avatarUrl: '',
    // Teacher fields
    qualification: '',
    specialization: '',
    // Student fields
    address: '',
    guardianName: '',
    guardianPhone: '',
  });

  // Loading & Feedback states
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    if (user) {
      setEmailForm({
        newEmail: user.email || '',
      });
      setProfileForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || user.teacher?.phone || user.student?.phone || '',
        bio: user.bio || '',
        avatarUrl: user.avatarUrl || '',
        qualification: user.teacher?.qualification || '',
        specialization: user.teacher?.specialization || '',
        address: user.student?.address || '',
        guardianName: user.student?.guardian_name || '',
        guardianPhone: user.student?.guardian_phone || '',
      });
    }
  }, [user]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg('Image file size must be less than 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm((prev) => ({ ...prev, avatarUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // 1. UPDATE EMAIL INDEPENDENTLY (No password change required)
  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const targetEmail = emailForm.newEmail.trim().toLowerCase();
    if (!targetEmail) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (targetEmail === (user?.email || '').toLowerCase()) {
      setErrorMsg('This is already your current email address.');
      return;
    }

    setSavingEmail(true);
    try {
      const res = await api.put('/auth/profile', {
        email: targetEmail,
      });

      if (res.data?.success) {
        setSuccessMsg(`Email address successfully updated to "${targetEmail}"! Your password and profile remain unchanged.`);
        if (updateUserSession) {
          updateUserSession(res.data.user, res.data.token);
        } else if (refreshUser) {
          await refreshUser();
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update email address.');
    } finally {
      setSavingEmail(false);
    }
  };

  // 2. UPDATE PASSWORD INDEPENDENTLY (No email change required)
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!passwordForm.currentPassword) {
      setErrorMsg('Current password is required to change your password.');
      return;
    }
    if (!passwordForm.newPassword) {
      setErrorMsg('Please enter a new password.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await api.put('/auth/profile', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      if (res.data?.success) {
        setSuccessMsg('Password changed successfully! Your email address remains unchanged.');
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        if (res.data.token && updateUserSession) {
          updateUserSession(res.data.user, res.data.token);
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  // 3. UPDATE PERSONAL PROFILE DETAILS INDEPENDENTLY (No email or password change required)
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const isStudent = user?.role === 'student';
    if (!isStudent && (!profileForm.firstName.trim() || !profileForm.lastName.trim())) {
      setErrorMsg('First name and last name are required.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await api.put('/auth/profile', {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        phone: profileForm.phone,
        bio: profileForm.bio,
        avatarUrl: profileForm.avatarUrl,
        qualification: profileForm.qualification,
        specialization: profileForm.specialization,
        address: profileForm.address,
        guardianName: profileForm.guardianName,
        guardianPhone: profileForm.guardianPhone,
      });

      if (res.data?.success) {
        setSuccessMsg('Profile details updated successfully! Your email and password remain unchanged.');
        if (updateUserSession) {
          updateUserSession(res.data.user, res.data.token);
        } else if (refreshUser) {
          await refreshUser();
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update profile details.');
    } finally {
      setSavingProfile(false);
    }
  };

  const roleConfig = {
    superadmin: {
      label: 'Platform Super Administrator',
      icon: Shield,
      style: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      tagline: 'Global Multi-Tenant Platform Controller & Master Administrator',
    },
    admin: {
      label: 'School Administrator',
      icon: Shield,
      style: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      tagline: 'Primary Administrative Overseer & School Tenant Controller',
    },
    teacher: {
      label: 'Academic Faculty Member',
      icon: BookOpen,
      style: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      tagline: `Department of ${user?.teacher?.specialization || 'Instruction'} • Faculty ID: ${user?.teacher?.teacher_id || 'TCH'}`,
    },
    student: {
      label: 'Enrolled High School Student',
      icon: Award,
      style: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      tagline: `Grade ${user?.student?.current_grade_level || user?.currentGradeLevel || '9'} • Section ${user?.student?.section_name || user?.sectionName || 'General'} • ID: ${user?.student?.student_id || user?.studentId || 'STU'}`,
    },
  };

  const currentRole = roleConfig[user?.role] || roleConfig.student;
  const RoleIcon = currentRole.icon;
  const isStudent = user?.role === 'student';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Notifications */}
      {successMsg && (
        <Alert
          type="success"
          title="Account Updated"
          message={successMsg}
          onClose={() => setSuccessMsg('')}
        />
      )}
      {errorMsg && (
        <Alert
          type="error"
          title="Update Error"
          message={errorMsg}
          onClose={() => setErrorMsg('')}
        />
      )}

      {/* Hero Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with custom trigger */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-500 p-1 shadow-2xl">
              <div className="w-full h-full rounded-2xl bg-slate-800 overflow-hidden flex items-center justify-center font-black text-3xl text-white">
                {profileForm.avatarUrl ? (
                  <img
                    src={profileForm.avatarUrl}
                    alt={user?.firstName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user?.firstName?.[0] || 'U'
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-md transition-all active:scale-95"
              title="Update profile picture"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* User Information */}
          <div className="text-center sm:text-left flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
              <span
                className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5 ${currentRole.style}`}
              >
                <RoleIcon className="w-3.5 h-3.5" />
                <span>{currentRole.label}</span>
              </span>
              <span className="text-xs text-purple-200 font-mono bg-white/10 px-2.5 py-0.5 rounded-full">
                {user?.email}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              {currentRole.tagline}
            </p>

            {profileForm.bio && (
              <p className="text-xs text-slate-300/90 italic mt-2 max-w-xl">
                "{profileForm.bio}"
              </p>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-purple-600" />
                <span>Choose Profile Picture</span>
              </h3>
              <p className="text-xs text-slate-500">
                Select from our high school avatars or upload your custom photo
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAvatarPicker(false)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {PRESET_AVATARS.map((url, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setProfileForm((prev) => ({ ...prev, avatarUrl: url }));
                  setShowAvatarPicker(false);
                }}
                className={`w-16 h-16 rounded-2xl overflow-hidden border-2 transition-all hover:scale-105 ${
                  profileForm.avatarUrl === url
                    ? 'border-purple-600 ring-2 ring-purple-500/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <label className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors text-center inline-flex items-center justify-center gap-1.5">
              <Camera className="w-4 h-4" />
              <span>Upload Custom Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {profileForm.avatarUrl && (
              <button
                type="button"
                onClick={() => {
                  setProfileForm((prev) => ({ ...prev, avatarUrl: '' }));
                  setShowAvatarPicker(false);
                }}
                className="text-xs text-rose-500 hover:underline"
              >
                Remove Custom Picture
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'all'
              ? 'bg-purple-600 text-white shadow-purple-500/25 shadow-md scale-[1.01]'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>All Settings</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'email'
              ? 'bg-purple-600 text-white shadow-purple-500/25 shadow-md scale-[1.01]'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
          }`}
        >
          <Mail className="w-3.5 h-3.5 text-blue-400" />
          <span>Update Email Alone</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('password')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'password'
              ? 'bg-purple-600 text-white shadow-purple-500/25 shadow-md scale-[1.01]'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>Change Password Alone</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('personal')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'personal'
              ? 'bg-purple-600 text-white shadow-purple-500/25 shadow-md scale-[1.01]'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
          }`}
        >
          <User className="w-3.5 h-3.5 text-emerald-400" />
          <span>Personal Details</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: ACCOUNT EMAIL SETTINGS (INDEPENDENT)                           */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'email') && (
        <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Account Email Address</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Update your sign-in email address independently without altering your password.
              </p>
            </div>
            <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              Independent Email Control
            </span>
          </div>

          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Current Active Email (Verified)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-600 dark:text-slate-300 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Sign-In Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-purple-500" />
                  <input
                    type="email"
                    required
                    placeholder="Enter your new email..."
                    value={emailForm.newEmail}
                    onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <p className="text-[11px] text-slate-400">
                *Does not require password change. Your existing password will remain active.
              </p>
              <button
                type="submit"
                disabled={savingEmail || emailForm.newEmail.trim().toLowerCase() === (user?.email || '').toLowerCase()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {savingEmail ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{savingEmail ? 'Updating Email...' : 'Update Email Address'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: ACCOUNT PASSWORD & SECURITY (INDEPENDENT)                       */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'password') && (
        <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-500" />
                <span>Account Password &amp; Security</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Change your sign-in password independently without altering your email address.
              </p>
            </div>
            <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <Key className="w-3.5 h-3.5 text-amber-600" />
              Independent Password Control
            </span>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password *
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    placeholder="Enter current password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Password * (Min 6 chars)
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    placeholder="Min 6 characters"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  placeholder="Repeat new password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <p className="text-[11px] text-slate-400">
                *Does not require email change. Your sign-in email address will remain unchanged.
              </p>
              <button
                type="submit"
                disabled={savingPassword || !passwordForm.currentPassword || !passwordForm.newPassword}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {savingPassword ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Key className="w-3.5 h-3.5" />
                )}
                <span>{savingPassword ? 'Changing Password...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: PERSONAL INFORMATION & DETAILS                                  */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'personal') && (
        <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                <span>Personal Profile Details</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Customize your bio, contact information, and role attributes.
              </p>
            </div>
            <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Role Profile Info
            </span>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            {/* Student Verified Records */}
            {isStudent && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                    Official student identity records (Full Name, Student ID, Grade Level, and Section) are verified and managed by school administration. <strong>You can update your Email above, Password above, and your Bio below.</strong>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Student Name
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-400" />
                      {user?.firstName} {user?.lastName}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Student ID
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-400" />
                      {user?.student?.student_id || user?.studentId || 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Academic Level
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-400" />
                      Grade {user?.student?.current_grade_level || user?.currentGradeLevel || '9'}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Section
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-400" />
                      {user?.student?.section_name || user?.sectionName || 'Assigned'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Non-Student Name inputs */}
            {!isStudent && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="+251-9XX-XXXXXX"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Teacher Specific Credentials */}
            {user?.role === 'teacher' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Department / Subject Specialization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mathematics, Physics, English"
                    value={profileForm.specialization}
                    onChange={(e) => setProfileForm({ ...profileForm, specialization: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Academic Qualification
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. B.Ed, M.Sc Mathematics"
                    value={profileForm.qualification}
                    onChange={(e) => setProfileForm({ ...profileForm, qualification: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Editable Bio */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Bio / Personal Statement
              </label>
              <textarea
                rows={3}
                placeholder="Share your goals, academic interests, or teaching philosophy..."
                value={profileForm.bio}
                onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {savingProfile ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{savingProfile ? 'Saving Details...' : 'Save Profile Details'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
