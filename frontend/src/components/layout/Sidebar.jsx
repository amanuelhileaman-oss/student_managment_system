import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Layers,
  BookOpen,
  GraduationCap,
  Calendar,
  BarChart3,
  Megaphone,
  MessageSquare,
  ShieldAlert,
  Settings,
  CheckSquare,
  FileText,
  FileCheck,
  Award,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import ThemeToggle from '../common/ThemeToggle';

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  const adminNav = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Sections & Capacity', path: '/admin/sections', icon: Layers },
    { name: 'User Directory', path: '/admin/users', icon: Users },
    { name: 'Grade 8 Admissions', path: '/admin/users?tab=GRADE8_DOCS', icon: FileCheck },
    { name: 'Academic & Streams', path: '/admin/academic', icon: BookOpen },
    { name: 'Teacher Assignments', path: '/admin/teachers', icon: GraduationCap },
    { name: 'Master Schedules', path: '/admin/schedules', icon: Calendar },
    { name: 'Reports & CSV', path: '/admin/reports', icon: BarChart3 },
    { name: 'Announcements', path: '/admin/announcements', icon: Megaphone },
    { name: 'Direct Messages', path: '/admin/messages', icon: MessageSquare },
    { name: 'Audit Logs', path: '/admin/audit-logs', icon: ShieldAlert },
    { name: 'System Settings', path: '/admin/settings', icon: Settings },
    { name: 'My Profile', path: '/admin/profile', icon: User },
  ];

  const teacherNav = [
    { name: 'Dashboard', path: '/teacher/dashboard', icon: LayoutDashboard },
    { name: 'Attendance', path: '/teacher/attendance', icon: UserCheck },
    { name: 'Study Materials', path: '/teacher/materials', icon: BookOpen },
    { name: 'Grade Book', path: '/teacher/grades', icon: CheckSquare },
    { name: 'Assignments & Groups', path: '/teacher/assignments', icon: FileText },
    { name: 'Teaching Schedule', path: '/teacher/schedule', icon: Calendar },
    { name: 'Assigned Students', path: '/teacher/students', icon: Users },
    { name: 'Messages', path: '/teacher/messages', icon: MessageSquare },
    { name: 'My Profile', path: '/teacher/profile', icon: User },
  ];

  const studentNav = [
    { name: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
    { name: 'Learning Materials', path: '/student/materials', icon: BookOpen },
    { name: 'Enrollment & Progression', path: '/student/enrollment', icon: Layers },
    { name: 'Academic Results', path: '/student/results', icon: Award },
    { name: 'Assignments & Projects', path: '/student/assignments', icon: FileText },
    { name: 'Class Timetable', path: '/student/schedule', icon: Calendar },
    { name: 'Messages', path: '/student/messages', icon: MessageSquare },
    { name: 'My Profile', path: '/student/profile', icon: User },
  ];

  let currentNav = [];
  if (user?.role === 'admin') currentNav = adminNav;
  else if (user?.role === 'teacher') currentNav = teacherNav;
  else if (user?.role === 'student') currentNav = studentNav;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar sidebar */}
      <aside
        className={`fixed md:sticky top-0 md:top-16 z-40 h-full md:h-[calc(100vh-4rem)] w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Mobile Header with close button */}
        <div className="flex items-center justify-between p-4 md:hidden border-b border-slate-100 dark:border-slate-800">
          <span className="font-bold text-slate-800 dark:text-slate-200">Menu</span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {currentNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => {
                  const hasTab = item.path.includes('?tab=');
                  const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
                  const active = hasTab
                    ? currentSearch.includes('tab=GRADE8_DOCS')
                    : isActive && !currentSearch.includes('tab=GRADE8_DOCS');
                  return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400 font-semibold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`;
                }}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Sidebar Footer info */}
        <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThemeToggle className="p-1.5" showLabel={true} />
            </div>
            <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">v1.0.0</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
