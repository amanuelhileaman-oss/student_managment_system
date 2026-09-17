import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  User,
  GraduationCap,
  Layers,
  BookOpen,
  MessageSquare,
  ArrowRight,
  Shield,
  Clock,
  Sparkles,
  Command,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const GlobalSearchModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL'); // 'ALL' | 'STUDENTS' | 'TEACHERS' | 'SECTIONS' | 'MATERIALS'
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({
    students: [],
    teachers: [],
    sections: [],
    materials: [],
    totalMatches: 0,
  });

  const inputRef = useRef(null);

  // Auto focus input on modal open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      performSearch('');
    } else {
      setQuery('');
      setActiveCategory('ALL');
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      performSearch(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const performSearch = async (searchTerm) => {
    setLoading(true);
    try {
      const res = await api.get('/search', { params: { q: searchTerm } });
      if (res.data?.data) {
        setResults(res.data.data);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSelectStudent = (s) => {
    onClose();
    if (user?.role === 'admin') {
      navigate(`/admin/users?tab=STUDENTS&search=${encodeURIComponent(s.student_id || s.first_name)}`);
    } else if (user?.role === 'teacher') {
      navigate(`/teacher/students?search=${encodeURIComponent(s.student_id || s.first_name)}`);
    } else {
      navigate('/student/dashboard');
    }
  };

  const handleSelectTeacher = (t) => {
    onClose();
    if (user?.role === 'admin') {
      navigate(`/admin/teachers?search=${encodeURIComponent(t.teacher_id || t.first_name)}`);
    } else if (user?.role === 'student') {
      navigate('/student/messages');
    } else {
      navigate('/teacher/dashboard');
    }
  };

  const handleSelectSection = (sec) => {
    onClose();
    if (user?.role === 'admin') {
      navigate(`/admin/sections?grade=${sec.grade_level}`);
    } else if (user?.role === 'teacher') {
      navigate('/teacher/schedule');
    } else {
      navigate('/student/schedule');
    }
  };

  const handleSelectMaterial = (m) => {
    onClose();
    if (user?.role === 'teacher') {
      navigate('/teacher/materials');
    } else {
      navigate('/student/materials');
    }
  };

  const filteredStudents = results.students || [];
  const filteredTeachers = results.teachers || [];
  const filteredSections = results.sections || [];
  const filteredMaterials = results.materials || [];

  const totalFilteredCount =
    (activeCategory === 'ALL' || activeCategory === 'STUDENTS' ? filteredStudents.length : 0) +
    (activeCategory === 'ALL' || activeCategory === 'TEACHERS' ? filteredTeachers.length : 0) +
    (activeCategory === 'ALL' || activeCategory === 'SECTIONS' ? filteredSections.length : 0) +
    (activeCategory === 'ALL' || activeCategory === 'MATERIALS' ? filteredMaterials.length : 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden mt-6 sm:mt-12 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-950/40">
          <Search className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Student ID, name, teacher, Grade (9-12), Section (A-D)..."
            className="flex-1 bg-transparent border-none outline-none text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-500">
            ESC to close
          </span>
          <button
            type="button"
            onClick={onClose}
            className="sm:hidden p-1 rounded-lg text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { key: 'ALL', label: 'All Results' },
            { key: 'STUDENTS', label: `Students (${filteredStudents.length})` },
            { key: 'TEACHERS', label: `Teachers (${filteredTeachers.length})` },
            { key: 'SECTIONS', label: `Grades & Sections (${filteredSections.length})` },
            { key: 'MATERIALS', label: `Books & Materials (${filteredMaterials.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveCategory(tab.key)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                activeCategory === tab.key
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-400">
              Searching high school databases...
            </div>
          )}

          {!loading && query && totalFilteredCount === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-slate-600 dark:text-slate-300 text-sm">
                No matching results found for "{query}"
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Try searching by Student ID (e.g. STU-), Teacher ID (e.g. TCH-), Grade Level (e.g. Grade 10), or Department.
              </p>
            </div>
          )}

          {/* Quick Suggestions when empty */}
          {!loading && !query && (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Quick Access &amp; High School Sections</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {filteredSections.slice(0, 6).map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => handleSelectSection(sec)}
                    className="p-3 text-left rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary-500/50 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-primary-50/40 dark:hover:bg-primary-950/20 transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Grade {sec.grade_level} - Section {sec.section_name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-0.5 block">
                        {sec.stream_name} • {sec.student_count || 0}/{sec.capacity} Enrolled
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Students Section */}
          {(activeCategory === 'ALL' || activeCategory === 'STUDENTS') && filteredStudents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                <span>Students ({filteredStudents.length})</span>
                <span className="text-[10px] text-blue-600 font-semibold">By ID, Name, Grade &amp; Section</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                {filteredStudents.map((s) => (
                  <div
                    key={s.student_record_id}
                    onClick={() => handleSelectStudent(s)}
                    className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          s.first_name?.[0] || 'S'
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {s.first_name} {s.last_name}
                          </span>
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
                            ID: {s.student_id}
                          </span>
                          {s.current_grade_level && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">
                              Grade {s.current_grade_level} {s.section_name ? `(${s.section_name})` : ''}
                            </span>
                          )}
                          {s.stream_name && (
                            <span className="text-[10px] font-medium text-slate-500">
                              • {s.stream_name}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                          {s.email} {s.phone ? `• ${s.phone}` : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-950/40 text-slate-600 dark:text-slate-300 hover:text-primary-600 text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0"
                    >
                      <span>Select</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teachers Section */}
          {(activeCategory === 'ALL' || activeCategory === 'TEACHERS') && filteredTeachers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                <span>Faculty Teachers ({filteredTeachers.length})</span>
                <span className="text-[10px] text-emerald-600 font-semibold">By Department &amp; Subject</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                {filteredTeachers.map((t) => (
                  <div
                    key={t.teacher_record_id}
                    onClick={() => handleSelectTeacher(t)}
                    className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                        {t.avatar_url ? (
                          <img src={t.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          t.first_name?.[0] || 'T'
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {t.first_name} {t.last_name}
                          </span>
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">
                            ID: {t.teacher_id}
                          </span>
                          {t.specialization && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800">
                              Dept: {t.specialization}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                          {t.email} {t.qualification ? `• ${t.qualification}` : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 hover:text-emerald-600 text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0"
                    >
                      <span>Select</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sections Section */}
          {(activeCategory === 'ALL' || activeCategory === 'SECTIONS') && query && filteredSections.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                Grades &amp; Sections ({filteredSections.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredSections.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => handleSelectSection(sec)}
                    className="p-3 text-left rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary-500 bg-white dark:bg-slate-900 transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-primary-600" />
                        <span>Grade {sec.grade_level} - Section {sec.section_name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-0.5 block">
                        {sec.stream_name} • Capacity: {sec.student_count || 0}/{sec.capacity}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Study Materials Section */}
          {(activeCategory === 'ALL' || activeCategory === 'MATERIALS') && filteredMaterials.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                Study Materials &amp; Books ({filteredMaterials.length})
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                {filteredMaterials.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleSelectMaterial(m)}
                    className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {m.title}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800">
                            {m.material_type}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                          Author: {m.author || 'Academic Faculty'} {m.subject_name ? `• ${m.subject_name}` : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-medium">Direct Search:</span>
            <span className="font-mono text-[11px] text-primary-600 dark:text-primary-400">
              Students • Teachers • Grades 9-12 • Sections A-D
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {totalFilteredCount} matching results
          </span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchModal;
