import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { triggerFileDownload, triggerFilePreview, resolveFileUrl } from '../../utils/fileUrl';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  BookOpen,
  Library,
  Search,
  Download,
  Eye,
  FileText,
  Filter,
  Layers,
  Sparkles,
  BookMarked,
  FileCheck,
  GraduationCap,
  ExternalLink,
  User,
  CheckCircle2,
  Calendar,
  FolderDown,
} from 'lucide-react';

const CATEGORY_TABS = [
  { id: 'ALL', label: 'All Resources', icon: Layers },
  { id: 'TEXTBOOK', label: 'Curriculum Textbooks', icon: BookOpen },
  { id: 'REFERENCE_BOOK', label: 'Reference Books', icon: Library },
  { id: 'LITERATURE_BOOK', label: 'Literature & Fiction', icon: BookMarked },
  { id: 'EXAM_PREP', label: 'Exam Prep & Past Papers', icon: GraduationCap },
  { id: 'LECTURE_NOTES', label: 'Lecture Notes', icon: FileText },
  { id: 'WORKSHEET', label: 'Worksheets', icon: FileCheck },
];

const StudentMaterialsPage = () => {
  const [materials, setMaterials] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [stats, setStats] = useState({
    totalAvailable: 0,
    textbooks: 0,
    referenceBooks: 0,
    lectureNotes: 0,
    worksheets: 0,
    examPrep: 0,
  });
  const [studentInfo, setStudentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({});

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Helper to format file sizes
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/students/materials');
      const data = res.data.data || {};
      setMaterials(data.materials || []);
      setSubjects(data.subjects || []);
      setStats(data.stats || {});
      setStudentInfo(data.studentInfo || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load study materials and books.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  // Handle Download action via authenticated binary stream
  const handleDownload = async (mat) => {
    try {
      setDownloadingId(mat.id);
      setDownloadProgress((prev) => ({ ...prev, [mat.id]: 0 }));
      setError('');

      // Track download on server
      try {
        await api.post(`/students/materials/${mat.id}/download`);
        setMaterials((prev) =>
          prev.map((m) => (m.id === mat.id ? { ...m, download_count: (m.download_count || 0) + 1 } : m))
        );
      } catch {
        // Non-blocking tracking
      }

      // If mat.file_url is already a full external URL (e.g. Cloudinary), use it directly;
      // otherwise use authenticated backend download endpoint
      const target = (mat.file_url && mat.file_url.startsWith('http'))
        ? mat.file_url
        : `/students/materials/${mat.id}/download`;

      await triggerFileDownload(target, mat.file_name || `${mat.title || 'study-material'}.pdf`, (percent) => {
        setDownloadProgress((prev) => ({ ...prev, [mat.id]: percent }));
      });
    } catch (err) {
      console.error('Download error:', err);
      setError(err.message || 'Failed to download document.');
    } finally {
      setDownloadingId(null);
      setTimeout(() => {
        setDownloadProgress((prev) => {
          const next = { ...prev };
          delete next[mat.id];
          return next;
        });
      }, 1500);
    }
  };

  // Handle View / Read Online action
  const handleView = async (mat) => {
    try {
      setViewingId(mat.id);
      setError('');
      const ext = (mat.file_name || '').split('.').pop().toLowerCase();
      const isPdf = ext === 'pdf' || mat.file_type === 'application/pdf';

      if (!isPdf) {
        return await handleDownload(mat);
      }

      const viewEndpoint = (mat.file_url && mat.file_url.startsWith('http'))
        ? mat.file_url
        : `/students/materials/${mat.id}/view`;
      const downloadEndpoint = (mat.file_url && mat.file_url.startsWith('http'))
        ? mat.file_url
        : `/students/materials/${mat.id}/download`;

      await triggerFilePreview(viewEndpoint, downloadEndpoint, mat.file_name || 'document.pdf');
    } catch (err) {
      console.error('View error:', err);
      setError(err.message || 'Could not open document for online viewing.');
    } finally {
      setViewingId(null);
    }
  };

  // Get Category Badge styling
  const getCategoryMeta = (type) => {
    switch (type) {
      case 'TEXTBOOK':
        return {
          label: 'Curriculum Textbook',
          badgeClass: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
          icon: BookOpen,
        };
      case 'REFERENCE_BOOK':
        return {
          label: 'Reference Book',
          badgeClass: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          icon: Library,
        };
      case 'LITERATURE_BOOK':
        return {
          label: 'Literature & Fiction',
          badgeClass: 'bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800',
          icon: BookMarked,
        };
      case 'EXAM_PREP':
        return {
          label: 'Exam Prep / Past Paper',
          badgeClass: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
          icon: GraduationCap,
        };
      case 'LECTURE_NOTES':
        return {
          label: 'Lecture Notes',
          badgeClass: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          icon: FileText,
        };
      case 'WORKSHEET':
        return {
          label: 'Worksheet',
          badgeClass: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          icon: FileCheck,
        };
      default:
        return {
          label: 'Document',
          badgeClass: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          icon: Layers,
        };
    }
  };

  // Filter materials based on search and selected tabs
  const filteredMaterials = materials.filter((m) => {
    const matchesCategory = selectedCategory === 'ALL' || m.material_type === selectedCategory;
    const matchesSubject = selectedSubject === 'ALL' || String(m.subject_id) === String(selectedSubject);
    const matchesSearch =
      searchQuery === '' ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.author && m.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.subject_name && m.subject_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSubject && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-800 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-teal-100 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>
                {studentInfo?.gradeLevel ? `Grade ${studentInfo.gradeLevel}` : 'High School'} Digital Library & Study Materials
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Learning Materials & Books
            </h1>
            <p className="text-sm md:text-base text-teal-100 max-w-2xl leading-relaxed">
              Find official student textbooks, reference guides, lecture summaries, worksheets, and practice exams uploaded directly by your teachers. Read online or download to study anytime!
            </p>
          </div>

          {/* Student Class Badge */}
          {studentInfo && (
            <div className="flex-shrink-0 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 text-center">
              <p className="text-xs text-teal-200 font-medium">Your Enrolled Class</p>
              <p className="text-lg font-bold text-white">
                Grade {studentInfo.gradeLevel || '9'}
                {studentInfo.sectionName ? ` • Section ${studentInfo.sectionName}` : ''}
              </p>
              <p className="text-[11px] text-teal-200 mt-0.5">
                {materials.length} resources available
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && <Alert type="error" message={error} />}

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Resources</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">{stats.totalAvailable || 0}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            <Library className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Curriculum Textbooks</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">{stats.textbooks || 0}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            <BookMarked className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Reference Books</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">{stats.referenceBooks || 0}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Notes & Worksheets</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">
              {(stats.lectureNotes || 0) + (stats.worksheets || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Subject Filter Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search books by title, author, subject, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Subject Filter */}
        <div className="w-full md:w-64">
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Resources Grid */}
      {loading ? (
        <LoadingSpinner message="Fetching digital library materials..." />
      ) : filteredMaterials.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            No Materials Found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            {materials.length === 0
              ? 'Your teachers have not uploaded materials for your enrolled classes yet. Check back soon!'
              : 'No materials match your current category, search, or subject filter. Try selecting "All Resources" or clearing search.'}
          </p>
          {(selectedCategory !== 'ALL' || selectedSubject !== 'ALL' || searchQuery !== '') && (
            <button
              onClick={() => {
                setSelectedCategory('ALL');
                setSelectedSubject('ALL');
                setSearchQuery('');
              }}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors"
            >
              <span>Reset All Filters</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMaterials.map((mat) => {
            const catMeta = getCategoryMeta(mat.material_type);
            const Icon = catMeta.icon;
            const isPdf = mat.file_name?.toLowerCase().endsWith('.pdf');

            return (
              <div
                key={mat.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group hover:border-teal-500/50"
              >
                {/* Book Card Top Content */}
                <div className="p-5 pb-3">
                  {/* Category & Subject Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 ring-1 ring-teal-500/20">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-800">
                          {mat.subject_name}
                        </span>
                        <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                          {catMeta.label}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {mat.grade_level ? `Grade ${mat.grade_level}` : 'School Library'}
                    </span>
                  </div>

                  {/* Title & Author */}
                  <div className="mt-4">
                    <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 line-clamp-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {mat.title}
                    </h3>
                    {(mat.author || mat.edition) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-1.5">
                        {mat.author && (
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            By {mat.author}
                          </span>
                        )}
                        {mat.edition && (
                          <span className="text-slate-400">({mat.edition})</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  {mat.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 line-clamp-2 leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      {mat.description}
                    </p>
                  )}

                  {/* Teacher & File details */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">
                        {mat.teacher_first_name} {mat.teacher_last_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-medium">
                      <span>{formatFileSize(mat.file_size)}</span>
                      <span>•</span>
                      <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {mat.file_name?.split('.').pop() || 'FILE'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between gap-2">
                  {/* Read / Preview in browser */}
                  <button
                    type="button"
                    onClick={() => handleView(mat)}
                    disabled={viewingId === mat.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{viewingId === mat.id ? 'Opening...' : isPdf ? 'Read Online' : 'View File'}</span>
                  </button>

                  {/* Download button */}
                  <button
                    type="button"
                    onClick={() => handleDownload(mat)}
                    disabled={downloadingId === mat.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {downloadingId === mat.id
                        ? downloadProgress[mat.id]
                          ? `${downloadProgress[mat.id]}%`
                          : 'Downloading...'
                        : 'Download'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentMaterialsPage;
