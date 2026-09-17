import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  User,
  Shield,
  BookOpen,
  Award,
  Camera,
  Phone,
  Mail,
  MapPin,
  Lock,
  CheckCircle2,
  Calendar,
  Sparkles,
  Layers,
  Save,
  RefreshCw,
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
  const { user, refreshUser } = useAuth();

  const [formData, setFormData] = useState({
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
    // Security fields
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
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
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }, [user]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 3MB for avatar)
    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg('Image file size must be less than 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, avatarUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setErrorMsg('First name and last name are required.');
      return;
    }

    if (formData.newPassword) {
      if (!formData.currentPassword) {
        setErrorMsg('Please enter your current password to set a new password.');
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setErrorMsg('New password and confirmation do not match.');
        return;
      }
      if (formData.newPassword.length < 6) {
        setErrorMsg('New password must be at least 6 characters long.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = user?.role === 'student'
        ? { avatarUrl: formData.avatarUrl, bio: formData.bio }
        : {
            firstName: formData.firstName,
            lastName: formData.lastName,
            phone: formData.phone,
            bio: formData.bio,
            avatarUrl: formData.avatarUrl,
            qualification: formData.qualification,
            specialization: formData.specialization,
            address: formData.address,
            guardianName: formData.guardianName,
            guardianPhone: formData.guardianPhone,
            currentPassword: formData.currentPassword || undefined,
            newPassword: formData.newPassword || undefined,
          };

      const res = await api.put('/auth/profile', payload);

      setSuccessMsg(res.data?.message || 'Profile updated successfully!');
      // Clear password fields
      setFormData((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      // Refresh AuthContext user state across entire app
      await refreshUser();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const roleConfig = {
    admin: {
      label: 'System Administrator',
      icon: Shield,
      style: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      tagline: 'Primary Administrative Overseer & School Database Controller',
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
      tagline: `Grade ${user?.student?.current_grade_level || 'N/A'} • Section ${user?.student?.section_name || 'General'} • ID: ${user?.student?.student_id || 'STU'}`,
    },
  };

  const currentRole = roleConfig[user?.role] || roleConfig.student;
  const RoleIcon = currentRole.icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Notifications */}
      {successMsg && (
        <Alert
          type="success"
          title="Profile Updated"
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

      {/* Profile Header Hero Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with change button */}
          <div className="relative group">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-primary-600 to-indigo-500 p-1 shadow-xl">
              <div className="w-full h-full rounded-2xl bg-slate-800 overflow-hidden flex items-center justify-center font-extrabold text-3xl text-white">
                {formData.avatarUrl ? (
                  <img
                    src={formData.avatarUrl}
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
              className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white shadow-md transition-all active:scale-95"
              title="Update profile picture"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* User Info Header */}
          <div className="text-center sm:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${currentRole.style}`}
              >
                <RoleIcon className="w-3 h-3" />
                <span>{currentRole.label}</span>
              </span>
              <span className="text-[11px] text-slate-300 font-mono">
                {user?.email}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              {currentRole.tagline}
            </p>

            {formData.bio && (
              <p className="text-xs text-slate-300/80 italic mt-2 max-w-xl">
                "{formData.bio}"
              </p>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Avatar Picker Modal/Drawer if open */}
      {showAvatarPicker && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Choose Profile Picture
              </h3>
              <p className="text-xs text-slate-500">
                Select from our official high school avatars or upload your own photo
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
                  setFormData((prev) => ({ ...prev, avatarUrl: url }));
                  setShowAvatarPicker(false);
                }}
                className={`w-16 h-16 rounded-2xl overflow-hidden border-2 transition-all hover:scale-105 ${
                  formData.avatarUrl === url
                    ? 'border-primary-600 ring-2 ring-primary-500/30'
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
              <span>Upload Custom Photo from Device</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {formData.avatarUrl && (
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, avatarUrl: '' }));
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

      {/* Main Form Form Body */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {user?.role === 'student' ? (
          /* Student: Locked Official Records Notice and Details */
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Shield className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Official Student Record (Verified by School Administration)
              </h2>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                Official student identity details (Full Name, Student ID, Academic Level, and Section) are verified and managed strictly by the school administration. <strong>Students can update and customize their profile photo above.</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Full Name
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  {user.firstName} {user.lastName}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Student ID
                </span>
                <span className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  {user.studentId || user.student?.student_id || 'STU-PROG-001'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Academic Level
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Grade {user.currentGradeLevel || user.student?.current_grade_level || '9'}
                  {user.sectionName ? ` - Section ${user.sectionName}` : ''}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Assigned Stream
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  {user.streamName || user.student?.stream_name || 'General Stream'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 sm:col-span-2">
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Official Email
                </span>
                <span className="text-sm font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  {user.email}
                </span>
              </div>
            </div>

            {/* Editable Student Bio */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Student Bio / Personal Statement
              </label>
              <textarea
                rows={3}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Share your goals, academic interests, or hobbies..."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100 resize-none"
              />
            </div>
          </div>
        ) : (
          /* Non-Student: Teacher / Admin Editable Form */
          <>
            {/* Section 1: Personal Details */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <User className="w-4 h-4 text-primary-600" />
                <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Personal Information
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Official School Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+251-9XX-XXXXXX"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Short Bio / Statement
                </label>
                <textarea
                  rows={2}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="A brief introduction about your academic goals or teaching philosophy..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100 resize-none"
                />
              </div>
            </div>

            {/* Section 2: Teacher Specific Attributes */}
            {user?.role === 'teacher' && (
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Faculty &amp; Teaching Credentials
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Department / Subject Specialization
                    </label>
                    <input
                      type="text"
                      value={formData.specialization}
                      onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                      placeholder="e.g. Mathematics, Physics, Chemistry"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Academic Qualification
                    </label>
                    <input
                      type="text"
                      value={formData.qualification}
                      onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                      placeholder="e.g. B.Ed, M.Sc Mathematics, Ph.D."
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Security & Password Update */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Lock className="w-4 h-4 text-amber-600" />
                <div>
                  <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Security &amp; Password
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Leave blank if you do not wish to change your password
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={formData.currentPassword}
                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    placeholder="Min 6 characters"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Repeat new password"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 active:scale-95 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>
              {saving
                ? 'Saving...'
                : user?.role === 'student'
                ? 'Save Profile (Photo & Bio)'
                : 'Save Profile Changes'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;
