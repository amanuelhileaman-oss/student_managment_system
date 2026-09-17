import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  User,
  Shield,
  GraduationCap,
  BookOpen,
  Camera,
  Check,
  X,
  LogOut,
  Settings,
  Upload,
  Sparkles,
  Info,
  Lock,
} from 'lucide-react';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
];

const ProfileDropdown = ({ isOpen, onClose }) => {
  const { user, logout, refreshUser } = useAuth();
  const dropdownRef = useRef(null);

  const [avatarUrl, setAvatarUrl] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state with current user when opening or user updates
  useEffect(() => {
    if (user) {
      setAvatarUrl(user.avatarUrl || '');
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setPhone(user.phone || user.teacher?.phone || user.student?.phone || '');
      setBio(user.bio || '');
      setSpecialization(user.teacher?.specialization || '');
      setSuccessMsg('');
      setErrorMsg('');
      setShowPicker(false);
    }
  }, [user, isOpen]);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const isStudent = user.role === 'student';

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg('Image size must be less than 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarUrl(reader.result);
      setErrorMsg('');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      if (isStudent) {
        // Students can update photo and bio
        await api.put('/auth/profile', {
          avatarUrl,
          bio,
        });
        setSuccessMsg('Profile updated successfully!');
      } else {
        // Non-students can update name, phone, bio, specialization, and photo
        await api.put('/auth/profile', {
          firstName,
          lastName,
          phone,
          bio,
          avatarUrl,
          specialization,
        });
        setSuccessMsg('Profile updated successfully!');
      }

      await refreshUser();
      setTimeout(() => {
        setSuccessMsg('');
      }, 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 mt-2.5 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2"
    >
      {/* Header Banner */}
      <div className="p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                isStudent
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : user.role === 'teacher'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {user.role}
            </span>
            <span className="text-[11px] font-mono text-slate-300">
              {user.studentId || user.teacherId || user.email}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center font-bold text-lg text-white ring-2 ring-white/20 shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                user.firstName?.[0] || 'U'
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-primary-600 hover:bg-primary-500 text-white shadow-md transition-transform active:scale-95"
              title="Pick or change photo"
            >
              <Camera className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-white truncate">
              {user.firstName} {user.lastName}
            </h4>
            <p className="text-xs text-slate-300 truncate">{user.email}</p>
            {isStudent && (
              <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                Grade {user.currentGradeLevel || '9'}
                {user.sectionName ? ` - Section ${user.sectionName}` : ''}
              </div>
            )}
            {!isStudent && user.role === 'teacher' && specialization && (
              <div className="text-[11px] text-blue-300 font-medium mt-0.5">
                {specialization}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form Content Area */}
      <form onSubmit={handleSubmit} className="p-4 space-y-3.5 max-h-[calc(80vh-120px)] overflow-y-auto">
        {/* Messages */}
        {successMsg && (
          <div className="p-2.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-2.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1.5">
            <X className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Avatar Selection Accordion */}
        {showPicker && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-primary-500" />
                Select Avatar Photo
              </span>
              <label className="cursor-pointer text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                <Upload className="w-3 h-3" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {PRESET_AVATARS.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatarUrl(url)}
                  className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${
                    avatarUrl === url
                      ? 'border-primary-600 ring-2 ring-primary-500/30'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            <div>
              <input
                type="url"
                placeholder="Or paste image URL (https://...)"
                value={avatarUrl.startsWith('data:') ? '' : avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        )}

        {/* Student Role Form View (Photo Only) */}
        {isStudent ? (
          <div className="space-y-3">
            <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                Official student records are managed by the school administration. You can update your <strong>profile photo and bio</strong>.
              </p>
            </div>

            {/* Read-only verified records */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-400 font-medium">Student Name</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  {user.firstName} {user.lastName}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-400 font-medium">Student ID</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  {user.studentId || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-400 font-medium">Academic Level</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  Grade {user.currentGradeLevel || '9'}
                  {user.sectionName ? ` - Section ${user.sectionName}` : ''}
                </span>
              </div>
            </div>

            {/* Editable Student Bio */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Student Bio / Personal Statement
              </label>
              <textarea
                rows="2"
                placeholder="Share your goals, academic interests, or hobbies..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-98 text-white text-xs font-bold shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
            >
              {saving ? 'Saving Profile...' : 'Save Profile (Photo & Bio)'}
            </button>
          </div>
        ) : (
          /* Non-Student Role Form View (Admin / Teacher: Full Profile Edit) */
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+251 9..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {user.role === 'teacher' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Department / Specialization
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mathematics, Physics"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Bio / Status Statement
              </label>
              <textarea
                rows="2"
                placeholder="A short note about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-98 text-white text-xs font-bold shadow-sm disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
            >
              {saving ? 'Saving Profile...' : 'Save Profile Changes'}
            </button>
          </div>
        )}
      </form>

      {/* Footer Links */}
      <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
        <Link
          to="/profile"
          onClick={onClose}
          className="font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Full Settings</span>
        </Link>
        <button
          type="button"
          onClick={logout}
          className="font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default ProfileDropdown;
