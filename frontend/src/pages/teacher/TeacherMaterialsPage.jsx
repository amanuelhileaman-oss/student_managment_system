import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  BookOpen,
  Library,
  Plus,
  Search,
  Download,
  Trash2,
  Edit3,
  Eye,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Filter,
  Layers,
  Calendar,
  Sparkles,
  ExternalLink,
  BookMarked,
  FileCheck,
  GraduationCap,
} from 'lucide-react';

const MATERIAL_TYPES = [
  { value: 'TEXTBOOK', label: 'Curriculum Textbook', icon: BookOpen, color: 'indigo' },
  { value: 'REFERENCE_BOOK', label: 'Reference Book', icon: Library, color: 'purple' },
  { value: 'LITERATURE_BOOK', label: 'Literature & Fiction', icon: BookMarked, color: 'pink' },
  { value: 'EXAM_PREP', label: 'Exam Preparation / Past Papers', icon: GraduationCap, color: 'rose' },
  { value: 'LECTURE_NOTES', label: 'Lecture Notes & Summaries', icon: FileText, color: 'emerald' },
  { value: 'WORKSHEET', label: 'Worksheet / Problem Set', icon: FileCheck, color: 'amber' },
  { value: 'OTHER', label: 'Other Document', icon: Layers, color: 'slate' },
];

const TeacherMaterialsPage = () => {
  const [materials, setMaterials] = useState([]);
  const [uploadOptions, setUploadOptions] = useState({
    assignedClasses: [],
    allSubjects: [],
    allSections: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMaterialForEdit, setSelectedMaterialForEdit] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [gradeFilter, setGradeFilter] = useState('ALL');

  // Upload Form State
  const [uploadForm, setUploadForm] = useState({
    title: '',
    author: '',
    edition: '',
    subjectId: '',
    gradeLevel: 'AUTO', // 'AUTO' = matches subject, 'ALL' = school library, or 9, 10, 11, 12
    sectionId: 'ALL',   // 'ALL' = all sections in grade, or specific section ID
    materialType: 'TEXTBOOK',
    description: '',
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFormError, setUploadFormError] = useState('');

  // Edit Form State
  const [editForm, setEditForm] = useState({
    title: '',
    author: '',
    edition: '',
    materialType: 'TEXTBOOK',
    gradeLevel: '10',
    sectionId: 'ALL',
    description: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFormError, setEditFormError] = useState('');

  // Helper to format file sizes
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper to get type label and color
  const getTypeMeta = (type) => {
    return (
      MATERIAL_TYPES.find((t) => t.value === type) || {
        label: type,
        color: 'slate',
        icon: FileText,
      }
    );
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [matRes, optRes] = await Promise.all([
        api.get('/teachers/materials'),
        api.get('/teachers/materials/options'),
      ]);
      setMaterials(matRes.data.data || []);
      setUploadOptions(optRes.data.data || { assignedClasses: [], allSubjects: [], allSections: [] });

      // Pre-select first assigned subject in upload form if available
      if (optRes.data.data?.assignedClasses?.length > 0) {
        setUploadForm((prev) => ({
          ...prev,
          subjectId: String(optRes.data.data.assignedClasses[0].subject_id),
        }));
      } else if (optRes.data.data?.allSubjects?.length > 0) {
        setUploadForm((prev) => ({
          ...prev,
          subjectId: String(optRes.data.data.allSubjects[0].id),
        }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load study materials and upload options.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle File Selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setUploadFormError('File size exceeds the maximum limit of 50 MB.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setUploadFormError('');
      // Autofill title if blank
      if (!uploadForm.title) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setUploadForm((prev) => ({ ...prev, title: cleanName }));
      }
    }
  };

  // Submit Upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadForm.title.trim()) {
      setUploadFormError('Please enter a title for the material or book.');
      return;
    }
    if (!uploadForm.subjectId) {
      setUploadFormError('Please select a subject.');
      return;
    }
    if (!selectedFile) {
      setUploadFormError('Please choose a file to upload (PDF, Word, Textbook, Notes).');
      return;
    }

    try {
      setIsUploading(true);
      setUploadFormError('');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', uploadForm.title.trim());
      formData.append('author', uploadForm.author.trim());
      formData.append('edition', uploadForm.edition.trim());
      formData.append('subjectId', uploadForm.subjectId);
      formData.append('materialType', uploadForm.materialType);
      formData.append('description', uploadForm.description.trim());

      // Grade Level resolution
      if (uploadForm.gradeLevel === 'ALL') {
        formData.append('gradeLevel', 'ALL');
      } else if (uploadForm.gradeLevel === 'AUTO') {
        // Find subject's grade
        const subj = uploadOptions.allSubjects.find((s) => String(s.id) === String(uploadForm.subjectId));
        formData.append('gradeLevel', subj ? subj.grade_level : 'ALL');
      } else {
        formData.append('gradeLevel', uploadForm.gradeLevel);
      }

      // Section ID
      if (uploadForm.sectionId && uploadForm.sectionId !== 'ALL') {
        formData.append('sectionId', uploadForm.sectionId);
      } else {
        formData.append('sectionId', 'ALL');
      }

      const res = await api.post('/teachers/materials', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccessMsg(res.data.message || 'Material uploaded successfully!');
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setUploadForm({
        title: '',
        author: '',
        edition: '',
        subjectId: uploadOptions.assignedClasses[0]?.subject_id || uploadOptions.allSubjects[0]?.id || '',
        gradeLevel: 'AUTO',
        sectionId: 'ALL',
        materialType: 'TEXTBOOK',
        description: '',
      });

      // Refresh data
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setUploadFormError(err.response?.data?.message || 'Failed to upload material.');
    } finally {
      setIsUploading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (material) => {
    setSelectedMaterialForEdit(material);
    setEditForm({
      title: material.title || '',
      author: material.author || '',
      edition: material.edition || '',
      materialType: material.material_type || 'TEXTBOOK',
      gradeLevel: material.grade_level ? String(material.grade_level) : 'ALL',
      sectionId: material.section_id ? String(material.section_id) : 'ALL',
      description: material.description || '',
    });
    setEditFormError('');
    setIsEditModalOpen(true);
  };

  // Submit Edit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.title.trim()) {
      setEditFormError('Title cannot be empty.');
      return;
    }

    try {
      setIsUpdating(true);
      setEditFormError('');

      await api.put(`/teachers/materials/${selectedMaterialForEdit.id}`, {
        title: editForm.title.trim(),
        author: editForm.author.trim(),
        edition: editForm.edition.trim(),
        materialType: editForm.materialType,
        gradeLevel: editForm.gradeLevel === 'ALL' ? null : parseInt(editForm.gradeLevel, 10),
        sectionId: editForm.sectionId === 'ALL' ? null : parseInt(editForm.sectionId, 10),
        description: editForm.description.trim(),
      });

      setSuccessMsg('Material details successfully updated!');
      setIsEditModalOpen(false);
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setEditFormError(err.response?.data?.message || 'Failed to update material.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${title}"? This will also remove the uploaded file from the server.`)) {
      return;
    }

    try {
      setDeletingId(id);
      await api.delete(`/teachers/materials/${id}`);
      setSuccessMsg(`"${title}" deleted successfully.`);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete material.');
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered Materials
  const filteredMaterials = materials.filter((m) => {
    const matchesSearch =
      searchQuery === '' ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.author && m.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.subject_name && m.subject_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = typeFilter === 'ALL' || m.material_type === typeFilter;
    const matchesSubject = subjectFilter === 'ALL' || String(m.subject_id) === String(subjectFilter);
    const matchesGrade =
      gradeFilter === 'ALL' ||
      (gradeFilter === 'GENERAL' && m.grade_level === null) ||
      String(m.grade_level) === String(gradeFilter);

    return matchesSearch && matchesType && matchesSubject && matchesGrade;
  });

  // Calculate stats
  const totalUploads = materials.length;
  const totalTextbooks = materials.filter((m) => m.material_type === 'TEXTBOOK' || m.material_type === 'REFERENCE_BOOK').length;
  const totalNotes = materials.filter((m) => m.material_type === 'LECTURE_NOTES' || m.material_type === 'WORKSHEET').length;
  const totalDownloads = materials.reduce((acc, m) => acc + (m.download_count || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-blue-100 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Teaching Resources & Book Management</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Study Materials & Digital Library
            </h1>
            <p className="text-sm md:text-base text-blue-100 max-w-2xl leading-relaxed">
              Upload curriculum textbooks, reference books, lecture notes, worksheets, and exam preparation packages. Students can instantly access and download materials for your classes.
            </p>
          </div>
          <button
            onClick={() => {
              setUploadFormError('');
              setIsUploadModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-indigo-700 font-bold shadow-lg hover:bg-blue-50 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="w-5 h-5" />
            <span>Upload Material / Book</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && <Alert type="success" message={successMsg} />}
      {error && <Alert type="error" message={error} />}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Uploads</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">{totalUploads}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            <Library className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Books & Textbooks</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">{totalTextbooks}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Notes & Worksheets</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">{totalNotes}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Student Downloads</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">{totalDownloads}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, author, topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Material Types</option>
              {MATERIAL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Subjects</option>
              {uploadOptions.allSubjects?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Grade {s.grade_level})
                </option>
              ))}
            </select>
          </div>

          {/* Grade Filter */}
          <div>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Grades</option>
              <option value="GENERAL">General School Library (All Grades)</option>
              <option value="9">Grade 9</option>
              <option value="10">Grade 10</option>
              <option value="11">Grade 11</option>
              <option value="12">Grade 12</option>
            </select>
          </div>
        </div>
      </div>

      {/* Materials List */}
      {loading ? (
        <LoadingSpinner message="Loading your teaching materials..." />
      ) : filteredMaterials.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            No Study Materials Found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-6">
            {materials.length === 0
              ? 'You have not uploaded any books or materials yet. Click the button below to upload your first textbook, PDF, or worksheet for your students!'
              : 'No materials match your current search or filter criteria. Try clearing the filters.'}
          </p>
          {materials.length === 0 && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Upload Material Now</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMaterials.map((mat) => {
            const typeMeta = getTypeMeta(mat.material_type);
            const IconComponent = typeMeta.icon;
            const isPdf = mat.file_name?.toLowerCase().endsWith('.pdf');

            return (
              <div
                key={mat.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Top Banner / Category Badge */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-2.5 rounded-xl bg-${typeMeta.color}-50 dark:bg-${typeMeta.color}-900/30 text-${typeMeta.color}-600 dark:text-${typeMeta.color}-400 ring-1 ring-${typeMeta.color}-500/20`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          {typeMeta.label}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                            {mat.subject_name}
                          </span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            {mat.grade_level ? `Grade ${mat.grade_level}` : 'General Library'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Download count pill */}
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-2.5 py-1 rounded-full">
                      <Download className="w-3.5 h-3.5 text-blue-500" />
                      <span>{mat.download_count || 0}</span>
                    </div>
                  </div>

                  {/* Title & Author */}
                  <div className="mt-4">
                    <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {mat.title}
                    </h3>
                    {(mat.author || mat.edition) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                        {mat.author && <span className="font-medium">By {mat.author}</span>}
                        {mat.edition && <span className="text-slate-400">• {mat.edition}</span>}
                      </p>
                    )}
                    {mat.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2 leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-2 rounded-lg">
                        {mat.description}
                      </p>
                    )}
                  </div>

                  {/* Target Section */}
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700/60 pt-2.5">
                    <span>
                      Audience:{' '}
                      <strong className="text-slate-700 dark:text-slate-300">
                        {mat.section_name ? `Section ${mat.section_name}` : 'All Sections'}
                      </strong>
                    </span>
                    <span>{formatFileSize(mat.file_size)}</span>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* View / Open in new tab */}
                    <a
                      href={mat.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                      title="Open file in browser"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isPdf ? 'Read PDF' : 'View'}</span>
                    </a>

                    {/* Download */}
                    <a
                      href={mat.file_url}
                      download={mat.file_name}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                      title="Download to computer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Edit Metadata */}
                    <button
                      onClick={() => openEditModal(mat)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Edit material details"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(mat.id, mat.title)}
                      disabled={deletingId === mat.id}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Delete material"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* UPLOAD MODAL */}
      {/* ======================================================== */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => !isUploading && setIsUploadModalOpen(false)}
        title="Upload Learning Material or Book"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          {uploadFormError && <Alert type="error" message={uploadFormError} />}

          {/* Material Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Material Category *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {MATERIAL_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = uploadForm.materialType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setUploadForm({ ...uploadForm, materialType: type.value })}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                    <span className="truncate">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Book / Material Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Grade 10 Biology Student Textbook (Unit 1-5)"
              value={uploadForm.title}
              onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Author & Edition */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Author / Publisher
              </label>
              <input
                type="text"
                placeholder="e.g. Ministry of Education / Cambridge"
                value={uploadForm.author}
                onChange={(e) => setUploadForm({ ...uploadForm, author: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Edition / Year
              </label>
              <input
                type="text"
                placeholder="e.g. 2nd Revised Edition, 2026"
                value={uploadForm.edition}
                onChange={(e) => setUploadForm({ ...uploadForm, edition: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Subject Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Subject *
            </label>
            <select
              required
              value={uploadForm.subjectId}
              onChange={(e) => setUploadForm({ ...uploadForm, subjectId: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">-- Choose Subject --</option>
              {uploadOptions.assignedClasses.length > 0 && (
                <optgroup label="My Assigned Teaching Subjects">
                  {uploadOptions.assignedClasses.map((c) => (
                    <option key={`assigned-${c.assignment_id}`} value={c.subject_id}>
                      {c.subject_name} (Grade {c.grade_level} - {c.section_name})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="All School Subjects">
                {uploadOptions.allSubjects.map((s) => (
                  <option key={`subj-${s.id}`} value={s.id}>
                    {s.name} (Grade {s.grade_level})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Target Grade & Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Grade Level
              </label>
              <select
                value={uploadForm.gradeLevel}
                onChange={(e) => setUploadForm({ ...uploadForm, gradeLevel: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="AUTO">Match Subject Grade Level</option>
                <option value="ALL">General School Library (All Students)</option>
                <option value="9">Grade 9 Only</option>
                <option value="10">Grade 10 Only</option>
                <option value="11">Grade 11 Only</option>
                <option value="12">Grade 12 Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Section
              </label>
              <select
                value={uploadForm.sectionId}
                onChange={(e) => setUploadForm({ ...uploadForm, sectionId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="ALL">All Sections in Target Grade</option>
                {uploadOptions.allSections.map((sec) => (
                  <option key={`sec-${sec.id}`} value={sec.id}>
                    Section {sec.section_name} (Grade {sec.grade_level})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description / Instructions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Description & Notes for Students
            </label>
            <textarea
              rows="2"
              placeholder="Instructions, reading chapters, or exam study tips..."
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* File Upload Dropzone */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              File Attachment * (PDF, Word, PPT, EPUB, Zip up to 50MB)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-blue-500 transition-colors bg-slate-50/50 dark:bg-slate-900/30">
              <div className="space-y-1 text-center">
                <UploadCloud className="mx-auto h-10 w-10 text-slate-400" />
                <div className="flex text-sm text-slate-600 dark:text-slate-400">
                  <label className="relative cursor-pointer bg-transparent rounded-md font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none">
                    <span>Choose a file from your computer</span>
                    <input
                      type="file"
                      required
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf,.epub,.zip,.rar"
                      className="sr-only"
                    />
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  Supports digital textbooks, scanned books, slide decks, worksheets
                </p>
                {selectedFile && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{selectedFile.name}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ({formatFileSize(selectedFile.size)})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => setIsUploadModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Uploading & Publishing...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Publish Material to Students</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* EDIT MODAL */}
      {/* ======================================================== */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isUpdating && setIsEditModalOpen(false)}
        title="Edit Material Details"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {editFormError && <Alert type="error" message={editFormError} />}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Author / Publisher
              </label>
              <input
                type="text"
                value={editForm.author}
                onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Edition / Year
              </label>
              <input
                type="text"
                value={editForm.edition}
                onChange={(e) => setEditForm({ ...editForm, edition: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Material Category
              </label>
              <select
                value={editForm.materialType}
                onChange={(e) => setEditForm({ ...editForm, materialType: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {MATERIAL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Grade Level
              </label>
              <select
                value={editForm.gradeLevel}
                onChange={(e) => setEditForm({ ...editForm, gradeLevel: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="ALL">General School Library (All Students)</option>
                <option value="9">Grade 9</option>
                <option value="10">Grade 10</option>
                <option value="11">Grade 11</option>
                <option value="12">Grade 12</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Description & Notes
            </label>
            <textarea
              rows="3"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TeacherMaterialsPage;
