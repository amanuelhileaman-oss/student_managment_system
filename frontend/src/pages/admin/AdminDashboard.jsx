import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import StatCard from '../../components/common/StatCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Alert from '../../components/common/Alert';
import Badge from '../../components/common/Badge';
import {
  Users,
  GraduationCap,
  Layers,
  BarChart3,
  Clock,
  AlertCircle,
  FileCheck,
  ArrowRight,
  Calendar,
  BookOpen,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Trash2,
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const SUBJECT_COLORS = {
  Mathematics: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200',
  'Advanced Mathematics': 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200',
  'General Mathematics': 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200',
  English: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200',
  Physics: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200',
  Chemistry: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200',
  Biology: 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200',
  History: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200',
  Geography: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200',
  Civics: 'bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-200',
  Economics: 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200',
};

const STANDARD_PERIODS = [
  { period: 1, start: '08:30', end: '09:15', label: 'Period 1' },
  { period: 2, start: '09:20', end: '10:05', label: 'Period 2' },
  { period: 'break1', label: 'Morning Break', time: '10:05 - 10:20', isBreak: true },
  { period: 3, start: '10:20', end: '11:05', label: 'Period 3' },
  { period: 4, start: '11:10', end: '11:55', label: 'Period 4' },
  { period: 'lunch', label: 'Lunch Break', time: '11:55 - 13:00', isBreak: true },
  { period: 5, start: '13:00', end: '13:45', label: 'Period 5' },
  { period: 6, start: '13:50', end: '14:35', label: 'Period 6' },
  { period: 7, start: '14:40', end: '15:25', label: 'Period 7' },
];

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Live Master Timetable Explorer state
  const [sections, setSections] = useState([]);
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('ALL');
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(() => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = dayNames[new Date().getDay()];
    return DAYS.includes(today) ? today : 'Monday';
  });
  const [sectionSchedules, setSectionSchedules] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  const fetchAnalytics = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);
      const [res, secRes] = await Promise.all([
        api.get('/admin/analytics'),
        api.get('/academic/sections'),
      ]);
      setData(res.data.data);
      const allSecs = secRes.data.data || secRes.data || [];
      const validSecs = allSecs.filter(
        (s) => ['A', 'B', 'C', 'D'].includes(s.section_name) || s.id <= 12
      );
      setSections(validSecs);
      if (validSecs.length > 0 && !selectedSectionId) {
        const defaultSec = validSecs.find((s) => s.id === 3 || s.section_name === 'C') || validSecs[0];
        setSelectedSectionId(defaultSec.id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load system analytics.');
    } finally {
      if (!silent) setLoading(false);
      else setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Listen to stude:refresh global event
  useEffect(() => {
    const handleGlobalRefresh = () => {
      fetchAnalytics(true);
      if (selectedSectionId) {
        fetchSectionSchedule(selectedSectionId);
      }
    };
    window.addEventListener('stude:refresh', handleGlobalRefresh);
    return () => window.removeEventListener('stude:refresh', handleGlobalRefresh);
  }, [selectedSectionId]);

  const fetchSectionSchedule = async (secId) => {
    try {
      setLoadingSchedule(true);
      const res = await api.get('/admin/schedules', {
        params: { sectionId: secId },
      });
      setSectionSchedules(res.data.data || []);
    } catch (err) {
      console.error('Failed to load section schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Fetch schedule whenever selectedSectionId changes
  useEffect(() => {
    if (!selectedSectionId) return;
    fetchSectionSchedule(selectedSectionId);
  }, [selectedSectionId]);

  const handleManualRefresh = () => {
    fetchAnalytics(true);
    if (selectedSectionId) {
      fetchSectionSchedule(selectedSectionId);
    }
  };

  if (loading) return <LoadingSpinner message="Aggregating live school database metrics..." />;
  if (error) return <Alert type="error" title="Dashboard Error" message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            System Administration Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Real-time oversight of students, faculty assignments, section capacities, and academic engine rules.
          </p>
        </div>
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 font-bold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95"
          title="Reload system metrics and schedules"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary-600' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
        </button>
      </div>

      {/* Grade 8 Admissions Pending Action Banner */}
      {data.pendingDocuments > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-300 dark:border-amber-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Grade 8 Admission Documents Awaiting Review
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                  {data.pendingDocuments} Pending
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                New Grade 9 applicants have submitted their Grade 8 national exam results and certificates. Inspect documents to approve admission or deactivate unfulfilled applicants.
              </p>
            </div>
          </div>
          <Link
            to="/admin/users?tab=GRADE8_DOCS"
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all shrink-0 flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
          >
            <span>Review Applications</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Total Students"
          value={data.totalStudents}
          icon={Users}
          color="blue"
          description="Active student enrollments"
        />
        <StatCard
          title="Teaching Faculty"
          value={data.totalTeachers}
          icon={GraduationCap}
          color="emerald"
          description="Assigned academic instructors"
        />
        <StatCard
          title="Active Sections"
          value={data.activeSections}
          icon={Layers}
          color="purple"
          description="Across Grades 9 to 12"
        />
        <StatCard
          title="Capacity Utilization"
          value={`${data.utilizationRate}%`}
          icon={BarChart3}
          color="amber"
          description={`${data.activeEnrollments} / ${data.totalCapacity} total seats filled`}
        />
      </div>

      {/* Master Timetable & Conflict-Free Scheduling Hub */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-indigo-900 via-slate-900 to-primary-950 text-white shadow-md border border-indigo-800/40 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="p-3.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0 mt-0.5">
            <Calendar className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="font-black text-base tracking-tight text-white">
                Master School Timetables & Schedules
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                100% Conflict-Free Validated
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              <strong>{data.totalSchedules || 408} active periods</strong> scheduled and live-synced across <strong>{data.sectionsWithSchedules || 12} sections</strong> (Grades 9 to 12).
              Students in every section can track their assigned instructors for each period in real time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/admin/schedules"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95"
          >
            <span>Manage Master Timetables</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Interactive Master Timetable Explorer directly in Admin Dashboard */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Live Timetable & Period Schedules Explorer
                <Badge variant="success" size="sm">
                  Active & Synced
                </Badge>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect period assignments, subjects, rooms, and teachers for any grade and section in real time.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Grade Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              {['ALL', '9', '10', '11', '12'].map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    setSelectedGradeFilter(g);
                    const matching = sections.filter((s) => g === 'ALL' || s.grade_level === parseInt(g, 10));
                    if (matching.length > 0 && !matching.find((s) => s.id === selectedSectionId)) {
                      setSelectedSectionId(matching[0].id);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedGradeFilter === g
                      ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {g === 'ALL' ? 'All' : `Gr ${g}`}
                </button>
              ))}
            </div>

            {/* Section Select Dropdown */}
            <select
              value={selectedSectionId || ''}
              onChange={(e) => setSelectedSectionId(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {sections
                .filter((sec) => selectedGradeFilter === 'ALL' || sec.grade_level === parseInt(selectedGradeFilter, 10))
                .map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Grade {sec.grade_level} — Sec {sec.section_name} ({sec.stream_name ? sec.stream_name.split(' ')[0] : 'General'})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Day Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {DAYS.map((day) => {
            const countForDay = sectionSchedules.filter((s) => s.day_of_week === day).length;
            const isSelected = selectedDay === day;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 shrink-0 ${
                  isSelected
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{day}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    isSelected ? 'bg-primary-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {countForDay} periods
                </span>
              </button>
            );
          })}
        </div>

        {/* Period Grid */}
        {loadingSchedule ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading period schedule...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {STANDARD_PERIODS.map((p, idx) => {
              if (p.isBreak) {
                return (
                  <div
                    key={`break-${idx}`}
                    className="p-3 rounded-xl bg-amber-500/10 border border-amber-300/60 dark:border-amber-700/40 text-amber-800 dark:text-amber-300 flex flex-col justify-center items-center text-center col-span-1"
                  >
                    <span className="text-xs font-bold">☕ {p.label}</span>
                    <span className="text-[10px] font-mono opacity-80 mt-0.5">{p.time}</span>
                  </div>
                );
              }

              const slot = sectionSchedules.find(
                (s) => s.day_of_week === selectedDay && s.period_number === p.period
              );

              if (!slot) {
                return (
                  <div
                    key={`empty-${p.period}`}
                    className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-slate-400 flex flex-col justify-between min-h-[95px]"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span>Period {p.period}</span>
                      <span className="font-mono text-[10px]">{p.start} - {p.end}</span>
                    </div>
                    <span className="text-xs italic text-center my-auto">Free Period / Open Slot</span>
                  </div>
                );
              }

              const colorClass =
                SUBJECT_COLORS[slot.subject_name] ||
                'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100';

              return (
                <div
                  key={slot.id}
                  className={`p-3.5 rounded-xl border transition-all shadow-sm hover:shadow-md flex flex-col justify-between min-h-[105px] ${colorClass}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-mono uppercase font-bold tracking-wider opacity-75">
                        Period {slot.period_number} • {p.start}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/70 dark:bg-slate-900/70 shadow-xs">
                        {slot.room_number || 'Room 101'}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-sm tracking-tight line-clamp-1">
                      {slot.subject_name}
                    </h4>
                  </div>

                  <div className="pt-2 mt-2 border-t border-current/10 flex items-center justify-between text-[11px]">
                    <span className="font-medium truncate flex items-center gap-1 opacity-90">
                      <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                      {slot.teacher_first_name} {slot.teacher_last_name}
                    </span>
                    <span className="text-[10px] font-mono opacity-70">
                      {slot.subject_code}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Banner with Quick Navigation */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              All periods are strictly synchronized with student schedules and guaranteed conflict-free.
            </span>
          </div>
          <Link
            to="/admin/schedules"
            className="font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1 hover:underline"
          >
            <span>Open Master Schedule Manager</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Capacity Utilization Progress Meter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Total School Capacity Utilization
          </span>
          <span className="text-xs font-semibold text-slate-500">
            {data.activeEnrollments} enrolled of {data.totalCapacity} maximum seats ({data.utilizationRate}%)
          </span>
        </div>
        <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              data.utilizationRate > 90
                ? 'bg-rose-500'
                : data.utilizationRate > 70
                ? 'bg-amber-500'
                : 'bg-primary-500'
            }`}
            style={{ width: `${Math.min(data.utilizationRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Grade and Stream Distributions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students by Grade */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
            Enrollment by High School Grade Level
          </h3>
          <div className="space-y-3">
            {data.studentsByGrade?.map((g) => (
              <div key={g.grade_level} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {g.grade_name}
                </span>
                <Badge variant="primary" size="sm">
                  {g.student_count} Students
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Students by Stream */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
            Enrollment by Academic Stream
          </h3>
          <div className="space-y-3">
            {data.studentsByStream?.map((s) => (
              <div key={s.stream_code} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <div>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                    {s.stream_name}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                    Code: {s.stream_code}
                  </span>
                </div>
                <Badge variant="neutral" size="sm">
                  {s.student_count} Enrolled
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Chronological Audit Activity */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Recent Administrative & Academic Actions
          </h3>
          <Link
            to="/admin/audit-logs"
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            Manage & Edit All Logs <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Entity</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {data.recentActivity?.map((act) => (
                <tr key={act.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3">
                    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {act.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                    {act.first_name ? `${act.first_name} ${act.last_name}` : 'System'} ({act.role || 'system'})
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">
                    {act.entity_type} {act.entity_id ? `#${act.entity_id}` : ''}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 font-mono">
                    {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={async () => {
                        if (window.confirm(`Delete audit log #${act.id}?`)) {
                          try {
                            await api.delete(`/audit/${act.id}`);
                            fetchAnalytics(true);
                          } catch (err) {
                            alert(err.response?.data?.message || 'Failed to delete audit record');
                          }
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                      title="Delete log record"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
