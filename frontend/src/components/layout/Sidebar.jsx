import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  UserCheck,
  CreditCard,
  Sliders,
  Zap,
  Landmark,
  Trash2,
  History,
  ChevronDown,
  X,
  Lock,
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();

  const isMoreRoute =
    location.pathname.startsWith('/superadmin/more') ||
    location.pathname.startsWith('/superadmin/billing');
  const isActionsRoute = location.pathname.startsWith('/superadmin/actions');

  const [moreExpanded, setMoreExpanded] = useState(isMoreRoute);
  const [actionsExpanded, setActionsExpanded] = useState(isActionsRoute);

  // Automatically expand when on route, collapse when navigating away
  useEffect(() => {
    if (isMoreRoute) {
      setMoreExpanded(true);
    } else {
      setMoreExpanded(false);
    }

    if (isActionsRoute) {
      setActionsExpanded(true);
    } else {
      setActionsExpanded(false);
    }
  }, [location.pathname]);

  const isPendingPayment =
    user?.role === 'admin' &&
    (user?.subscriptionStatus === 'PENDING_PAYMENT' || user?.isLocked === true);

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
    { name: 'Subscription & Chapa', path: '/admin/billing', icon: CreditCard },
    { name: 'System Settings', path: '/admin/settings', icon: Settings },
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
  ];

  const studentNav = [
    { name: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
    { name: 'Learning Materials', path: '/student/materials', icon: BookOpen },
    { name: 'Enrollment & Progression', path: '/student/enrollment', icon: Layers },
    { name: 'Academic Results', path: '/student/results', icon: Award },
    { name: 'Assignments & Projects', path: '/student/assignments', icon: FileText },
    { name: 'Class Timetable', path: '/student/schedule', icon: Calendar },
    { name: 'Messages', path: '/student/messages', icon: MessageSquare },
  ];

  const superadminNav = [
    { name: 'Platform Overview', path: '/superadmin/dashboard', icon: LayoutDashboard },
    {
      name: 'More Components',
      path: '/superadmin/more',
      icon: Sliders,
      subItems: [
        { name: 'License Renewal Plans', path: '/superadmin/more?tab=plans', icon: Zap },
        { name: 'Receiving Bank Accounts', path: '/superadmin/more?tab=banks', icon: Landmark },
      ],
    },
    {
      name: 'Actions',
      path: '/superadmin/actions',
      icon: ShieldAlert,
      subItems: [
        { name: 'Rule Violations & Deletion', path: '/superadmin/actions?tab=schools', icon: ShieldAlert },
        { name: 'System & Data Cleanup', path: '/superadmin/actions?tab=cleanup', icon: Trash2 },
        { name: 'Disciplinary Audit Logs', path: '/superadmin/actions?tab=logs', icon: History },
      ],
    },
  ];

  let currentNav = [];
  if (user?.role === 'superadmin') currentNav = superadminNav;
  else if (user?.role === 'admin') currentNav = adminNav;
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
            const isMoreItem = item.path === '/superadmin/more';
            const isActionsItem = item.path === '/superadmin/actions';
            const isItemExpanded = isMoreItem ? moreExpanded : isActionsItem ? actionsExpanded : false;

            return (
              <div key={item.path} className="space-y-1">
                <NavLink
                  to={item.path}
                  onClick={() => {
                    if (isMoreItem) {
                      setMoreExpanded((prev) => (isMoreRoute ? !prev : true));
                    } else if (isActionsItem) {
                      setActionsExpanded((prev) => (isActionsRoute ? !prev : true));
                    }
                    onClose();
                  }}
                  className={({ isActive }) => {
                    const hasTab = item.path.includes('?tab=');
                    const active = hasTab
                      ? location.search.includes('tab=GRADE8_DOCS')
                      : isMoreItem
                      ? isMoreRoute
                      : isActionsItem
                      ? isActionsRoute
                      : isActive && !location.search.includes('tab=GRADE8_DOCS');
                    return `flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400 font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`;
                  }}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {isPendingPayment && item.path === '/admin/billing' && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500 text-white animate-pulse shrink-0">
                      Pay Now
                    </span>
                  )}
                  {isPendingPayment && item.path !== '/admin/billing' && item.path !== '/admin/dashboard' && (
                    <Lock className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
                  )}
                  {item.subItems && (
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                        isItemExpanded ? 'rotate-180 text-primary-600 dark:text-primary-400' : ''
                      }`}
                    />
                  )}
                </NavLink>

                {/* Sub Items: NOT SEEN before clicking; ONLY SEEN after clicking */}
                {item.subItems && isItemExpanded && (
                  <div className="ml-5 pl-2.5 border-l-2 border-slate-200 dark:border-slate-800/80 space-y-1 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    {item.subItems.map((sub) => {
                      const SubIcon = sub.icon;
                      const subTab = sub.path.split('tab=')[1];
                      const isSubActive =
                        (isMoreItem && isMoreRoute && location.search.includes(`tab=${subTab}`)) ||
                        (isActionsItem && isActionsRoute && location.search.includes(`tab=${subTab}`));
                      return (
                        <NavLink
                          key={sub.path}
                          to={sub.path}
                          onClick={onClose}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isSubActive
                              ? 'bg-primary-100/90 text-primary-700 dark:bg-primary-950/80 dark:text-primary-300 font-bold'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <SubIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{sub.name}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer info */}
        <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">EthioHighHub</span>
          <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">v1.0.0</span>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
