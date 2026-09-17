import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import StatCard from '../../components/common/StatCard';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Alert from '../../components/common/Alert';
import { BookOpen, Users, CheckSquare, Calendar, ArrowRight, Clock, MapPin, RefreshCw, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const PERIOD_TIMINGS = {
  1: '08:30 - 09:15',
  2: '09:20 - 10:05',
  3: '10:20 - 11:05',
  4: '11:10 - 11:55',
  5: '13:00 - 13:45',
  6: '13:50 - 14:35',
  7: '14:40 - 15:25',
};

const formatSlotTime = (slot) => {
  if (!slot) return '';
  if (slot.start_time && slot.end_time) {
    const s = String(slot.start_time).slice(0, 5);
    const e = String(slot.end_time).slice(0, 5);
    return `${s} - ${e}`;
  }
  return PERIOD_TIMINGS[slot.period_number] || '';
};

const TeacherDashboard = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);
      const [clsRes, schRes] = await Promise.all([
        api.get('/teachers/classes'),
        api.get('/teachers/schedule'),
      ]);
      setClasses(clsRes.data.data);
      setSchedule(schRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load teacher dashboard.');
    } finally {
      if (!silent) setLoading(false);
      else setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Listen to stude:refresh global event
  useEffect(() => {
    const handleGlobalRefresh = () => {
      fetchData(true);
    };
    window.addEventListener('stude:refresh', handleGlobalRefresh);
    return () => window.removeEventListener('stude:refresh', handleGlobalRefresh);
  }, []);

  if (loading) return <LoadingSpinner message="Loading assigned classes and teaching schedule..." />;

  const totalStudents = classes.reduce((sum, c) => sum + parseInt(c.student_count || 0, 10), 0);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                Faculty Portal
              </span>
              <button
                type="button"
                onClick={() => fetchData(true)}
                disabled={isRefreshing}
                className="px-2 py-0.5 rounded-lg bg-emerald-800/50 hover:bg-emerald-800 text-white text-[11px] font-semibold inline-flex items-center gap-1 border border-emerald-500/30 transition-all"
                title="Refresh faculty dashboard data"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
              </button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
              Welcome, {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 mt-1">
              {user?.teacher?.qualification || 'Faculty Member'} • Specialization: {user?.teacher?.specialization || 'Academic'}
            </p>
          </div>
          <div className="flex flex-col sm:items-end gap-2.5 shrink-0">
            <div className="text-right">
              <span className="text-xs text-emerald-200 block">Official Faculty ID</span>
              <span className="font-mono font-bold text-sm bg-black/20 px-2.5 py-1 rounded-lg inline-block mt-0.5">
                {user?.teacher?.teacher_id || 'TCH-2026-001'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/teacher/attendance"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold shadow-sm transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Take Attendance</span>
              </Link>
              <Link
                to="/teacher/materials"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-800/60 hover:bg-emerald-800 text-white text-xs font-bold border border-emerald-500/30 shadow-sm transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Study Materials</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {error && <Alert type="error" title="Error" message={error} onClose={() => setError('')} />}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <StatCard
          title="Assigned Classes"
          value={classes.length}
          icon={BookOpen}
          color="emerald"
          description="Designated subjects & sections"
        />
        <StatCard
          title="Enrolled Students"
          value={totalStudents}
          icon={Users}
          color="blue"
          description="Across all assigned rosters"
        />
        <StatCard
          title="Weekly Timetable Slots"
          value={schedule.length}
          icon={Calendar}
          color="purple"
          description="Scheduled class periods"
        />
      </div>

      {/* Teaching Timetable Highlights & Today's Schedule */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Teaching Schedule & Timetable Highlights
            </h2>
            <p className="text-xs text-slate-500">
              Assigned master periods, timings, and rooms for your weekly curriculum
            </p>
          </div>
          <Link
            to="/teacher/schedule"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100 transition-colors shrink-0 self-start sm:self-auto"
          >
            Full Weekly Timetable <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {schedule.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No Timetable Periods Scheduled Yet
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              You have {classes.length} assigned subject/section course(s), but timetable periods have not yet been assigned by the administrator in Master Schedules. Contact School Administration to schedule your class periods.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Days Overview Tabs / Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => {
                const daySlots = schedule.filter((s) => s.day_of_week === day);
                const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;

                return (
                  <div
                    key={day}
                    className={`p-4 rounded-2xl border transition-all ${
                      isToday
                        ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{day}</span>
                        {isToday && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500 text-white uppercase tracking-wider">
                            Today
                          </span>
                        )}
                      </div>
                      <Badge variant={daySlots.length > 0 ? 'success' : 'neutral'} size="sm">
                        {daySlots.length} {daySlots.length === 1 ? 'Period' : 'Periods'}
                      </Badge>
                    </div>

                    {daySlots.length > 0 ? (
                      <div className="space-y-1.5">
                        {daySlots.map((slot) => (
                          <div
                            key={slot.id}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs shadow-2xs"
                          >
                            <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
                              <span className="truncate">{slot.subject_name}</span>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  Period {slot.period_number}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5 text-emerald-500/80 shrink-0" />
                                  {formatSlotTime(slot)}
                                </span>
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                              <span className="truncate">
                                Grade {slot.section_grade_level || slot.grade_level} — Section {slot.section_name}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 flex items-center gap-1 shrink-0 ml-2">
                                <MapPin className="w-2.5 h-2.5 text-slate-400" />
                                {slot.room_number || 'Room TBD'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 py-3 text-center italic">
                        No periods scheduled
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Assigned Classes Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            My Official Teaching Assignments
          </h2>
          <Link
            to="/teacher/grades"
            className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
          >
            Open Grade Book <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {classes.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No Teaching Class Assignments Yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              You currently do not have any teaching class assignments allocated to your faculty account. Once School Administration assigns you to classes in Teacher Assignments, your subjects and student rosters will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {classes.map((c) => (
              <div
                key={c.assignment_id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="primary" size="sm">
                      Grade {c.grade_level} — Section {c.section_name}
                    </Badge>
                    <span className="text-[11px] font-mono text-slate-400">{c.stream_code}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                    {c.subject_name}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    {c.stream_name} • Academic Year {c.year_name}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    <strong className="text-slate-900 dark:text-slate-100">{c.student_count}</strong> students enrolled
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Link
                      to="/teacher/attendance"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>Attendance</span>
                    </Link>
                    <Link
                      to={`/teacher/grades?subjectId=${c.subject_id}&sectionId=${c.section_id}`}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                    >
                      Enter Grades
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
