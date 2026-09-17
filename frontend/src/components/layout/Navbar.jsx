import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../common/ThemeToggle';
import {
  GraduationCap,
  Bell,
  LogOut,
  Menu,
  MessageSquare,
  Shield,
  BookOpen,
  Award,
  CheckCheck,
  Trash2,
  Megaphone,
  Calendar,
  FileText,
  X,
  ExternalLink,
  RefreshCw,
  Search,
  Command,
} from 'lucide-react';
import api from '../../services/api';
import ProfileDropdown from './ProfileDropdown';

const formatRelativeTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 30) return 'Just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getNotificationBadgeConfig = (type) => {
  switch (type) {
    case 'ANNOUNCEMENT':
      return {
        icon: Megaphone,
        bg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      };
    case 'MESSAGE':
      return {
        icon: MessageSquare,
        bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      };
    case 'DOCUMENT_APPROVED':
    case 'DOCUMENT_REVIEW':
      return {
        icon: FileText,
        bg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    case 'SCHEDULE':
      return {
        icon: Calendar,
        bg: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
      };
    case 'RESULT':
    case 'GRADE':
      return {
        icon: Award,
        bg: 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      };
    case 'ENROLLMENT':
      return {
        icon: GraduationCap,
        bg: 'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      };
    default:
      return {
        icon: Bell,
        bg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      };
  }
};

const Navbar = ({ onMobileMenuToggle }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notifFilter, setNotifFilter] = useState('all'); // 'all' | 'unread'

  const notifDropdownRef = useRef(null);
  const [isGlobalRefreshing, setIsGlobalRefreshing] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleGlobalRefresh = async () => {
    setIsGlobalRefreshing(true);
    try {
      window.dispatchEvent(new CustomEvent('stude:refresh'));
      await fetchNotifications(true);
    } catch (e) {
      console.warn('Global refresh error:', e);
    } finally {
      setTimeout(() => {
        setIsGlobalRefreshing(false);
      }, 700);
    }
  };

  const fetchNotifications = async (showLoading = false) => {
    if (showLoading) setLoadingNotifs(true);
    try {
      const res = await api.get('/communications/notifications');
      if (res.data) {
        setNotifications(res.data.data || []);
        if (res.data.unreadCount !== undefined) {
          setUnreadCount(res.data.unreadCount);
        }
      }
    } catch (e) {
      // quiet fail on background polling
    } finally {
      if (showLoading) setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 20000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Click outside and escape key handling
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleNotifDropdown = () => {
    const nextState = !isNotifOpen;
    setIsNotifOpen(nextState);
    if (nextState) {
      fetchNotifications(true);
    }
  };

  const handleMarkAsRead = async (notifId, e) => {
    e?.stopPropagation();
    try {
      await api.patch(`/communications/notifications/${notifId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/communications/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  const handleDelete = async (notifId, e) => {
    e?.stopPropagation();
    try {
      await api.delete(`/communications/notifications/${notifId}`);
      const target = notifications.find((n) => n.id === notifId);
      if (target && !target.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      await api.delete('/communications/notifications/clear-all');
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      handleMarkAsRead(notif.id);
    }
    setIsNotifOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const roleConfig = {
    admin: {
      label: 'Administrator',
      icon: Shield,
      style: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      messagesPath: '/admin/messages',
    },
    teacher: {
      label: 'Faculty Member',
      icon: BookOpen,
      style: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      messagesPath: '/teacher/messages',
    },
    student: {
      label: 'Student',
      icon: Award,
      style: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      messagesPath: '/student/messages',
    },
  };

  const currentRole = roleConfig[user?.role] || roleConfig.student;
  const RoleIcon = currentRole.icon;

  const filteredNotifications = notifications.filter((n) => {
    if (notifFilter === 'unread') return !n.is_read;
    return true;
  });

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="flex items-center justify-between h-full px-4 sm:px-6">
        {/* Left side brand & mobile toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMobileMenuToggle}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-primary-500/30">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-slate-100">
                EthioHigh<span className="text-primary-600 dark:text-primary-400">Hub</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                PERN
              </span>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Quick Messages Link */}
          {user && (
            <Link
              to={currentRole.messagesPath}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
              title="Direct Messages"
            >
              <MessageSquare className="w-5 h-5" />
            </Link>
          )}

          {/* Interactive Notifications Center */}
          {user && (
            <div className="relative" ref={notifDropdownRef}>
              <button
                type="button"
                onClick={toggleNotifDropdown}
                className={`p-2 rounded-lg transition-colors relative ${
                  isNotifOpen
                    ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Notifications"
                aria-expanded={isNotifOpen}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-white text-[10px] font-bold items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  </span>
                )}
              </button>

              {/* Dropdown Panel */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2.5 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 transition-all">
                  {/* Header */}
                  <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                        Notifications
                      </h3>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllAsRead}
                          className="px-2 py-1 text-[11px] font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-md transition-colors inline-flex items-center gap-1"
                          title="Mark all as read"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Mark all read</span>
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                          title="Clear all notifications"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex border-b border-slate-100 dark:border-slate-800/60 px-3 pt-2 bg-slate-50/50 dark:bg-slate-950/20">
                    <button
                      type="button"
                      onClick={() => setNotifFilter('all')}
                      className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all ${
                        notifFilter === 'all'
                          ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                          : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      All ({notifications.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifFilter('unread')}
                      className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all ${
                        notifFilter === 'unread'
                          ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                          : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Unread ({unreadCount})
                    </button>
                  </div>

                  {/* Notification List */}
                  <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 custom-scrollbar">
                    {loadingNotifs && notifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-primary-500" />
                        <span className="text-xs">Loading notifications...</span>
                      </div>
                    ) : filteredNotifications.length === 0 ? (
                      <div className="py-10 text-center px-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-2.5">
                          <Bell className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {notifFilter === 'unread'
                            ? 'No unread notifications'
                            : "You're all caught up!"}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {notifFilter === 'unread'
                            ? 'Great job, all notifications have been read.'
                            : 'No new updates or alerts at the moment.'}
                        </p>
                      </div>
                    ) : (
                      filteredNotifications.map((notif) => {
                        const { icon: TypeIcon, bg } = getNotificationBadgeConfig(notif.type);
                        return (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-3.5 transition-colors cursor-pointer group flex items-start gap-3 relative ${
                              !notif.is_read
                                ? 'bg-primary-50/40 dark:bg-primary-950/20 hover:bg-primary-50/70 dark:hover:bg-primary-950/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            {/* Icon badge */}
                            <div
                              className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center border ${bg}`}
                            >
                              <TypeIcon className="w-4 h-4" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pr-6">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <h4
                                  className={`text-xs font-bold truncate ${
                                    !notif.is_read
                                      ? 'text-slate-900 dark:text-slate-100'
                                      : 'text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {notif.title}
                                </h4>
                                <span className="text-[10px] text-slate-400 flex-shrink-0">
                                  {formatRelativeTime(notif.created_at)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                {notif.message}
                              </p>
                              {notif.link && (
                                <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-primary-600 dark:text-primary-400 opacity-80 group-hover:opacity-100">
                                  <span>View details</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </div>
                              )}
                            </div>

                            {/* Unread indicator / Actions */}
                            <div className="absolute right-3 top-3.5 flex flex-col items-end gap-1">
                              {!notif.is_read && (
                                <span
                                  className="w-2 h-2 rounded-full bg-primary-500 ring-2 ring-white dark:ring-slate-900"
                                  title="Unread"
                                />
                              )}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                {!notif.is_read && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleMarkAsRead(notif.id, e)}
                                    className="p-1 rounded text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    title="Mark as read"
                                  >
                                    <CheckCheck className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => handleDelete(notif.id, e)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  title="Delete"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="p-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNotifOpen(false);
                        const announcementsPath =
                          user.role === 'admin'
                            ? '/admin/announcements'
                            : user.role === 'teacher'
                            ? '/teacher/dashboard'
                            : '/student/dashboard';
                        navigate(announcementsPath);
                      }}
                      className="text-[11px] font-semibold text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      View Board &amp; Announcements &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Universal System Refresh Button */}
          <button
            type="button"
            onClick={handleGlobalRefresh}
            disabled={isGlobalRefreshing}
            className="p-2 rounded-xl text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all active:scale-95"
            title="Refresh application data & views"
            id="navbar-refresh-btn"
          >
            <RefreshCw
              className={`w-4 h-4 ${isGlobalRefreshing ? 'animate-spin text-primary-600 dark:text-primary-400' : ''}`}
            />
          </button>

          <ThemeToggle />

          {/* User profile & Dropdown Form */}
          {user && (
            <div className="relative flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsProfileOpen((prev) => !prev)}
                className={`flex items-center gap-2.5 p-1 rounded-xl transition-all group ${
                  isProfileOpen
                    ? 'bg-slate-100 dark:bg-slate-800 ring-2 ring-primary-500/40'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/80'
                }`}
                title="Update Profile"
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 ring-1 ring-slate-300 dark:ring-slate-700 group-hover:ring-primary-500 transition-all shrink-0">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user.firstName?.[0] || 'U'
                  )}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {user.firstName} {user.lastName}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border inline-flex items-center gap-1 ${currentRole.style}`}
                    >
                      <RoleIcon className="w-2.5 h-2.5" />
                      <span>{currentRole.label}</span>
                    </span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={logout}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* Profile Dropdown Form */}
              <ProfileDropdown
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
