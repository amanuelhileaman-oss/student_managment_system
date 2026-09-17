import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Badge from '../../components/common/Badge';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  BookOpen,
  Printer,
  Sparkles,
  Layers,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';

const STANDARD_PERIODS = [
  { period: 1, start: '08:30', end: '09:15', label: 'Period 1 (08:30 - 09:15)' },
  { period: 2, start: '09:20', end: '10:05', label: 'Period 2 (09:20 - 10:05)' },
  { period: 'break1', label: 'Morning Break (10:05 - 10:20)', isBreak: true },
  { period: 3, start: '10:20', end: '11:05', label: 'Period 3 (10:20 - 11:05)' },
  { period: 4, start: '11:10', end: '11:55', label: 'Period 4 (11:10 - 11:55)' },
  { period: 'lunch', label: 'Lunch Break (11:55 - 13:00)', isBreak: true },
  { period: 5, start: '13:00', end: '13:45', label: 'Period 5 (13:00 - 13:45)' },
  { period: 6, start: '13:50', end: '14:35', label: 'Period 6 (13:50 - 14:35)' },
  { period: 7, start: '14:40', end: '15:25', label: 'Period 7 (14:40 - 15:25)' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const SUBJECT_COLORS = {
  Mathematics: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200',
  English: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200',
  Physics: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200',
  Chemistry: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200',
  Biology: 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200',
  History: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200',
  Geography: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200',
  Civics: 'bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-200',
};

const formatSlotTime = (slot) => {
  if (!slot) return '';
  if (slot.start_time && slot.end_time) {
    const s = String(slot.start_time).slice(0, 5);
    const e = String(slot.end_time).slice(0, 5);
    return `${s} - ${e}`;
  }
  const p = STANDARD_PERIODS.find((sp) => sp.period === slot.period_number);
  return p ? `${p.start} - ${p.end}` : '';
};

const StudentSchedulePage = () => {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'cards'

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        setLoading(true);
        const res = await api.get('/students/schedule');
        setSchedule(res.data.data || []);
      } catch (err) {
        console.error('Failed to load student schedule:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, []);

  const sectionMeta = schedule.length > 0 ? schedule[0] : null;

  // Determine current active period
  const getCurrentPeriodInfo = () => {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = dayNames[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const p of STANDARD_PERIODS) {
      if (p.isBreak) continue;
      const [startH, startM] = p.start.split(':').map(Number);
      const [endH, endM] = p.end.split(':').map(Number);
      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;

      if (currentMinutes >= startTotal && currentMinutes <= endTotal) {
        return { currentDay, currentPeriod: p.period };
      }
    }
    return null;
  };

  const currentActive = getCurrentPeriodInfo();

  if (loading) return <LoadingSpinner message="Loading your official section timetable..." />;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="primary" size="sm">
              {sectionMeta ? `Grade ${sectionMeta.grade_level} — Section ${sectionMeta.section_name}` : 'Section Timetable'}
            </Badge>
            {sectionMeta?.stream_name && (
              <Badge variant="neutral" size="sm">
                {sectionMeta.stream_name}
              </Badge>
            )}
            <Badge variant="success" size="sm">
              Delivered by Administration
            </Badge>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary-600" />
            Official Class Timetable
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Track your weekly course periods, assigned teachers, and classrooms. Synchronized in real time with the master timetable.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Weekly Grid
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Daily Cards
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Timetable
          </button>
        </div>
      </div>

      {schedule.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            No Schedule Delivered Yet
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Your section has been registered, but the administration has not yet published the timetable. Please check back shortly.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* WEEKLY MATRIX GRID */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 w-36">Period & Time</th>
                  {DAYS.map((day) => (
                    <th key={day} className="py-3 px-4 text-center">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {STANDARD_PERIODS.map((p, pIdx) => {
                  if (p.isBreak) {
                    return (
                      <tr key={`break-${pIdx}`} className="bg-amber-50/40 dark:bg-amber-950/20 text-center">
                        <td colSpan={6} className="py-2 px-4 text-xs font-bold text-amber-800 dark:text-amber-300">
                          ☕ {p.label}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={`period-${p.period}`} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Period Time Column */}
                      <td className="py-3 px-4 align-middle bg-slate-50/30 dark:bg-slate-800/20 border-r border-slate-100 dark:border-slate-800">
                        <div className="font-black text-xs text-slate-800 dark:text-slate-200">
                          Period {p.period}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {p.start} - {p.end}
                        </div>
                      </td>

                      {/* Day Columns */}
                      {DAYS.map((day) => {
                        const slot = schedule.find(
                          (s) => s.day_of_week === day && s.period_number === p.period
                        );

                        const isLive =
                          currentActive &&
                          currentActive.currentDay === day &&
                          currentActive.currentPeriod === p.period;

                        if (slot) {
                          const colorClass =
                            SUBJECT_COLORS[slot.subject_name] ||
                            'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200';

                          return (
                            <td key={day} className="py-2.5 px-3 align-top">
                              <div
                                className={`p-3 rounded-xl border transition-all relative group shadow-sm ${colorClass} ${
                                  isLive ? 'ring-2 ring-emerald-500 ring-offset-2' : ''
                                }`}
                              >
                                {isLive && (
                                  <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider animate-pulse shadow-sm">
                                    Now Active
                                  </span>
                                )}

                                <div className="font-extrabold text-xs tracking-tight mb-1">
                                  {slot.subject_name}
                                </div>

                                <div className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 font-medium mb-1.5">
                                  <User className="w-3.5 h-3.5 shrink-0 text-primary-600" />
                                  <span className="truncate">
                                    {slot.teacher_first_name} {slot.teacher_last_name}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50">
                                  <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                                    <Clock className="w-3 h-3 text-primary-500 shrink-0" />
                                    {p.start} - {p.end}
                                  </span>
                                  <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                                    <MapPin className="w-3 h-3 shrink-0 text-emerald-500" />
                                    {slot.room_number || 'Section Room'}
                                  </span>
                                </div>
                              </div>
                            </td>
                          );
                        }

                        // Empty
                        return (
                          <td key={day} className="py-2.5 px-3 align-middle text-center">
                            <div className="h-14 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/50 flex items-center justify-center text-[10px] text-slate-400 font-mono">
                              Study Period
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* DAILY CARD ACCORDION VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DAYS.map((day) => {
            const daySlots = schedule.filter((s) => s.day_of_week === day);

            return (
              <div
                key={day}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-extrabold text-base text-slate-900 dark:text-slate-100">{day}</span>
                  <Badge variant={daySlots.length > 0 ? 'primary' : 'neutral'} size="sm">
                    {daySlots.length} Classes
                  </Badge>
                </div>

                {daySlots.length > 0 ? (
                  <div className="space-y-2.5">
                    {daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 hover:border-primary-300 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {slot.subject_name}
                          </span>
                          <Badge variant="neutral" size="sm">
                            Period {slot.period_number}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mb-2">
                          <User className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                          <span>
                            Instructor: {slot.teacher_first_name} {slot.teacher_last_name}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1.5 border-t border-slate-200/40 dark:border-slate-700/40">
                          <span className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                            <Clock className="w-3 h-3 text-primary-500" />
                            {formatSlotTime(slot)}
                          </span>
                          {slot.room_number && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {slot.room_number}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-6 text-center">No scheduled periods on {day}.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentSchedulePage;
