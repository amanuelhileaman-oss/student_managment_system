import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Badge from '../../components/common/Badge';
import { Calendar, Clock, MapPin } from 'lucide-react';

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

const TeacherSchedulePage = () => {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        setLoading(true);
        const res = await api.get('/teachers/schedule');
        setSchedule(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, []);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (loading) return <LoadingSpinner message="Loading your teaching timetable..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Calendar className="w-6 h-6 text-emerald-600" />
          Weekly Teaching Timetable
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Official periods, assigned classrooms, and sections.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {days.map((day) => {
          const daySlots = schedule.filter((s) => s.day_of_week === day);

          return (
            <div
              key={day}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                <span className="font-bold text-base text-slate-900 dark:text-slate-100">{day}</span>
                <Badge variant={daySlots.length > 0 ? 'success' : 'neutral'} size="sm">
                  {daySlots.length} Classes
                </Badge>
              </div>

              {daySlots.length > 0 ? (
                <div className="space-y-3">
                  {daySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {slot.subject_name}
                        </span>
                        <Badge variant="primary" size="sm">
                          Period {slot.period_number}
                        </Badge>
                      </div>

                      <div className="text-xs text-slate-500 mb-2">
                        Grade {slot.grade_level} — Section {slot.section_name} ({slot.stream_name})
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                          <Clock className="w-3 h-3 text-emerald-500" />
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
                <p className="text-xs text-slate-400 py-6 text-center">No assigned periods on {day}.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeacherSchedulePage;
