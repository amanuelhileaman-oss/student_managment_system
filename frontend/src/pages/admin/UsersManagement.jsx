import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import {
  UserCheck,
  UserX,
  Eye,
  FileText,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ShieldCheck,
  Pencil,
  Trash2,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Layers,
  GraduationCap,
  Sparkles,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  User,
} from 'lucide-react';

const UsersManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [users, setUsers] = useState([]);
  const [sections, setSections] = useState([]);
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState(tabParam === 'GRADE8_DOCS' ? 'GRADE8_DOCS' : 'ALL');

  // Filters State
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [streamFilter, setStreamFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [teacherSpecializationFilter, setTeacherSpecializationFilter] = useState('ALL');
  const [teacherGradeFilter, setTeacherGradeFilter] = useState('ALL');

  // Modals State
  const [viewUser, setViewUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: '',
    qualification: '',
    specialization: '',
    address: '',
    currentGradeLevel: '',
    currentSectionId: '',
    currentStreamId: '',
  });

  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab === 'ALL') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: newTab });
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, secRes, strRes, docsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/academic/sections'),
        api.get('/academic/streams'),
        api.get('/admin/documents'),
      ]);
      setUsers(usersRes.data.data || []);
      setSections(secRes.data.data || []);
      setStreams(strRes.data.data || strRes.data || []);
      setDocuments(docsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch directory data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleStatus = async (user) => {
    try {
      const res = await api.patch(`/admin/users/${user.id}/toggle-status`);
      setSuccessMsg(res.data.message);
      const updated = await api.get('/admin/users');
      setUsers(updated.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user status.');
    }
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setEditFormData({
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      email: user.email || '',
      phone: user.phone || user.teacher_phone || user.student_phone || '',
      bio: user.bio || '',
      qualification: user.qualification || '',
      specialization: user.specialization || '',
      address: user.student_address || '',
      currentGradeLevel: user.current_grade_level || '',
      currentSectionId: user.current_section_id || '',
      currentStreamId: user.current_stream_id || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setActionLoading(true);
      setError('');
      const res = await api.put(`/admin/users/${editingUser.id}`, editFormData);
      setSuccessMsg(res.data.message || 'User updated successfully.');
      setEditingUser(null);
      const updated = await api.get('/admin/users');
      setUsers(updated.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDelete = (u) => {
    setUserToDelete(u);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      setDeletingUser(true);
      setError('');
      const res = await api.delete(`/admin/users/${userToDelete.id}`);
      setSuccessMsg(res.data.message || 'User deleted successfully.');
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      const updated = await api.get('/admin/users');
      setUsers(updated.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user.');
    } finally {
      setDeletingUser(false);
    }
  };

  const handleReviewDocument = async (studentId, action) => {
    setActionLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/admin/documents/${studentId}/review`, {
        action,
        notes: reviewNotes,
      });
      setSuccessMsg(res.data.message);
      setSelectedDoc(null);
      setReviewNotes('');
      const [uRes, dRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/documents'),
      ]);
      setUsers(uRes.data.data || []);
      setDocuments(dRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process document review.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reset all filters to default
  const handleResetFilters = () => {
    setGradeFilter('ALL');
    setSectionFilter('ALL');
    setStreamFilter('ALL');
    setStatusFilter('ALL');
    setTeacherSpecializationFilter('ALL');
    setTeacherGradeFilter('ALL');
  };

  const hasActiveFilters =
    gradeFilter !== 'ALL' ||
    sectionFilter !== 'ALL' ||
    streamFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    teacherSpecializationFilter !== 'ALL' ||
    teacherGradeFilter !== 'ALL';

  // Extract distinct specializations from teachers
  const availableSpecializations = Array.from(
    new Set(
      users
        .filter((u) => u.role === 'teacher' && u.specialization)
        .map((u) => u.specialization.trim())
    )
  ).sort();

  // Extract distinct section names
  const availableSectionNames = Array.from(
    new Set(sections.map((s) => s.section_name).filter(Boolean))
  ).sort();

  // Filtering Logic
  const filteredUsers = users.filter((u) => {
    // 1. Tab Role Filtering
    if (activeTab === 'STUDENTS' && u.role !== 'student') return false;
    if (activeTab === 'TEACHERS' && u.role !== 'teacher') return false;

    // 2. Status Filter
    if (statusFilter !== 'ALL') {
      const wantActive = statusFilter === 'ACTIVE';
      if (Boolean(u.is_active) !== wantActive) return false;
    }

    // 3. Student Specific Filters (or applied when user is a student)
    if (u.role === 'student') {
      if (gradeFilter !== 'ALL') {
        if (String(u.current_grade_level) !== String(gradeFilter)) return false;
      }
      if (sectionFilter !== 'ALL') {
        const uSec = String(u.section_name || '').toUpperCase();
        const fSec = String(sectionFilter).toUpperCase();
        if (uSec !== fSec && String(u.current_section_id) !== String(sectionFilter)) return false;
      }
      if (streamFilter !== 'ALL') {
        const code = String(u.stream_code || '').toUpperCase();
        const name = String(u.stream_name || '').toUpperCase();
        const fStr = String(streamFilter).toUpperCase();
        if (!code.includes(fStr) && !name.includes(fStr)) return false;
      }
    }

    // 4. Teacher Specific Filters
    if (u.role === 'teacher') {
      // Specialization filter
      if (teacherSpecializationFilter !== 'ALL') {
        const spec = String(u.specialization || '').toLowerCase();
        if (!spec.includes(teacherSpecializationFilter.toLowerCase())) return false;
      }

      // Teacher Grade filter (check if teacher teaches this grade)
      if (teacherGradeFilter !== 'ALL') {
        const tGrades = u.teacher_grades || [];
        const tClasses = String(u.assigned_classes || '');
        const targetGradeNum = parseInt(teacherGradeFilter, 10);
        const teachesGrade =
          tGrades.includes(targetGradeNum) ||
          tClasses.includes(`Grade ${teacherGradeFilter}`);
        if (!teachesGrade) return false;
      }

      // When gradeFilter is selected on 'ALL' tab, match teachers teaching that grade
      if (activeTab === 'ALL' && gradeFilter !== 'ALL') {
        const tGrades = u.teacher_grades || [];
        const tClasses = String(u.assigned_classes || '');
        const targetGradeNum = parseInt(gradeFilter, 10);
        const teachesGrade =
          tGrades.includes(targetGradeNum) ||
          tClasses.includes(`Grade ${gradeFilter}`);
        if (!teachesGrade) return false;
      }

      // When sectionFilter is selected on 'ALL' tab, match teachers assigned to that section
      if (activeTab === 'ALL' && sectionFilter !== 'ALL') {
        const tClasses = String(u.assigned_classes || '').toUpperCase();
        if (!tClasses.includes(`(${sectionFilter.toUpperCase()})`) && !tClasses.includes(`-${sectionFilter.toUpperCase()}`)) {
          return false;
        }
      }
    }

    return true;
  });

  // Dynamic filter toolbar based on active tab
  const extraFilters = (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 1. When on STUDENTS or ALL tab: Grade, Section, Stream filters */}
      {activeTab !== 'TEACHERS' && (
        <>
          {/* Grade Selector */}
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
          >
            <option value="ALL">All Grades</option>
            <option value="9">Grade 9</option>
            <option value="10">Grade 10</option>
            <option value="11">Grade 11</option>
            <option value="12">Grade 12</option>
          </select>

          {/* Section Selector */}
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
          >
            <option value="ALL">All Sections</option>
            {availableSectionNames.map((secName) => (
              <option key={secName} value={secName}>
                Section {secName}
              </option>
            ))}
          </select>

          {/* Stream Selector */}
          <select
            value={streamFilter}
            onChange={(e) => setStreamFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
          >
            <option value="ALL">All Streams</option>
            <option value="GENERAL">General Stream</option>
            <option value="NATURAL">Natural Science</option>
            <option value="SOCIAL">Social Science</option>
          </select>
        </>
      )}

      {/* 2. When on TEACHERS tab: Department & Grade Taught filters */}
      {activeTab === 'TEACHERS' && (
        <>
          {/* Department / Specialization Selector */}
          <select
            value={teacherSpecializationFilter}
            onChange={(e) => setTeacherSpecializationFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
          >
            <option value="ALL">All Departments</option>
            {availableSpecializations.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>

          {/* Grades Taught Selector */}
          <select
            value={teacherGradeFilter}
            onChange={(e) => setTeacherGradeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
          >
            <option value="ALL">All Grades Taught</option>
            <option value="9">Teaches Grade 9</option>
            <option value="10">Teaches Grade 10</option>
            <option value="11">Teaches Grade 11</option>
            <option value="12">Teaches Grade 12</option>
          </select>
        </>
      )}

      {/* 3. Status Filter (Available across all tabs) */}
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
      >
        <option value="ALL">All Status</option>
        <option value="ACTIVE">Active Only</option>
        <option value="INACTIVE">Deactivated Only</option>
      </select>

      {/* 4. Reset Filters Button */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleResetFilters}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl transition-colors border border-rose-200 dark:border-rose-900/60"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Filters</span>
        </button>
      )}
    </div>
  );

  const columns = [
    {
      header: 'User Identity',
      render: (u) => (
        <div className="flex items-center gap-2.5">
          {u.avatar_url ? (
            <img
              src={u.avatar_url}
              alt={u.first_name}
              className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {u.first_name?.[0]}{u.last_name?.[0]}
            </div>
          )}
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>{u.first_name} {u.last_name}</span>
            </div>
            <div className="text-xs text-slate-500 font-mono">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Role',
      render: (u) => (
        <Badge variant={u.role === 'teacher' ? 'success' : 'primary'} size="sm">
          {u.role.toUpperCase()}
        </Badge>
      ),
    },
    {
      header: 'Academic Placement / Specialization',
      render: (u) => (
        <div>
          <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
            {u.student_id || u.teacher_id || 'N/A'}
          </div>
          {u.role === 'student' && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                Grade {u.current_grade_level || '9'}{u.section_name ? ` - Sec ${u.section_name}` : ''}
              </span>
              {u.stream_name && (
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  {u.stream_code || u.stream_name}
                </span>
              )}
            </div>
          )}
          {u.role === 'teacher' && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                {u.specialization || 'General Faculty'}
              </span>
              {u.assigned_subjects && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]" title={u.assigned_subjects}>
                  Teaches: {u.assigned_subjects}
                </span>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Account Status',
      render: (u) => (
        <Badge variant={u.is_active ? 'success' : 'danger'} size="sm">
          {u.is_active ? 'ACTIVE' : 'DEACTIVATED'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      render: (u) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewUser(u)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleOpenEdit(u)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Edit User Details"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleStatus(u)}
            className={`p-1.5 rounded-lg transition-colors ${
              u.is_active
                ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
            title={u.is_active ? 'Deactivate Account' : 'Activate Account'}
          >
            {u.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
          </button>
          {u.role !== 'admin' && (
            <button
              type="button"
              onClick={() => handleOpenDelete(u)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Delete Account"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSpinner message="Loading registered student and teacher directories..." />;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          User Directory & Institutional Registry
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Search, filter by grade, section, stream, department, and monitor registered student and faculty accounts.
        </p>
      </div>

      {error && <Alert type="error" title="Error" message={error} onClose={() => setError('')} />}
      {successMsg && <Alert type="success" title="Success" message={successMsg} onClose={() => setSuccessMsg('')} />}

      {/* Directory Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => handleTabChange('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ALL'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          All Users ({users.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('STUDENTS')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'STUDENTS'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Students ({users.filter((u) => u.role === 'student').length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('TEACHERS')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'TEACHERS'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Teachers ({users.filter((u) => u.role === 'teacher').length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('GRADE8_DOCS')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'GRADE8_DOCS'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Grade 8 Admissions & Documents ({documents.length})</span>
          {documents.filter((d) => d.document_status === 'PENDING_ADMIN_VERIFICATION').length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 text-amber-950 font-extrabold">
              {documents.filter((d) => d.document_status === 'PENDING_ADMIN_VERIFICATION').length}
            </span>
          )}
        </button>
      </div>

      {activeTab !== 'GRADE8_DOCS' ? (
        <DataTable
          columns={columns}
          data={filteredUsers}
          searchPlaceholder="Search by ID, name, grade (9-12), section (A-D), stream, department..."
          extraFilters={extraFilters}
        />
      ) : (
        <DataTable
          columns={[
            {
              header: 'Applicant',
              render: (doc) => (
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>{doc.first_name} {doc.last_name}</span>
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        doc.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      title={doc.is_active ? 'Active Account' : 'Deactivated Account'}
                    />
                  </div>
                  <div className="text-xs text-slate-500 font-mono">{doc.email}</div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <span>ID: {doc.student_id}</span>
                    <span>•</span>
                    <span className={doc.is_active ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                      {doc.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </div>
                </div>
              ),
            },
            {
              header: 'Ministry Exam Record',
              render: (doc) => (
                <div className="text-xs">
                  <div className="font-medium text-slate-800 dark:text-slate-200">
                    {doc.previous_school || 'Ministry Examination Record'}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Score: {doc.prereq_total_score || 'N/A'} ({doc.prereq_average_score || 'N/A'}%) •{' '}
                    <span className={doc.prereq_status === 'PASSED' ? 'text-emerald-600 font-semibold' : 'text-rose-500'}>
                      {doc.prereq_status || 'VERIFIED'}
                    </span>
                  </div>
                </div>
              ),
            },
            {
              header: 'Submitted Document',
              render: (doc) => (
                <div className="text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                    <FileText className="w-3.5 h-3.5 text-amber-600" />
                    <span className="truncate max-w-[160px]">{doc.grade8_document_name || 'Grade8_Certificate.pdf'}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {doc.grade8_document_type || 'application/pdf'}
                  </div>
                </div>
              ),
            },
            {
              header: 'Review Status',
              render: (doc) => {
                const status = doc.document_status || 'PENDING_ADMIN_VERIFICATION';
                if (status === 'APPROVED') {
                  return (
                    <div>
                      <Badge variant="success">APPROVED</Badge>
                      <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Cleared for Grade 9</div>
                    </div>
                  );
                }
                if (status === 'REJECTED') {
                  return (
                    <div>
                      <Badge variant="danger">REJECTED</Badge>
                      <div className="text-[10px] text-rose-600 font-bold mt-0.5">Account Deactivated</div>
                    </div>
                  );
                }
                return (
                  <div>
                    <Badge variant="warning">PENDING REVIEW</Badge>
                    <div className="text-[10px] text-amber-600 mt-0.5">Awaiting Decision</div>
                  </div>
                );
              },
            },
            {
              header: 'Actions',
              render: (doc) => (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDoc(doc);
                      setReviewNotes(doc.admin_review_notes || '');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View & Review</span>
                  </button>
                  {doc.document_status !== 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => handleReviewDocument(doc.id, 'APPROVE')}
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      title="Quick Approve"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  {doc.document_status !== 'REJECTED' && (
                    <button
                      type="button"
                      onClick={() => handleReviewDocument(doc.id, 'REJECT')}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Quick Reject"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          data={documents}
          searchPlaceholder="Search submitted documents..."
        />
      )}

      {/* View User Modal */}
      <Modal isOpen={!!viewUser} onClose={() => setViewUser(null)} title="User Account Details">
        {viewUser && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                {viewUser.avatar_url ? (
                  <img
                    src={viewUser.avatar_url}
                    alt={viewUser.first_name}
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center font-bold text-base shadow-sm">
                    {viewUser.first_name?.[0]}{viewUser.last_name?.[0]}
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {viewUser.first_name} {viewUser.last_name}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">{viewUser.email}</p>
                </div>
              </div>
              <Badge variant={viewUser.is_active ? 'success' : 'danger'}>
                {viewUser.is_active ? 'ACTIVE' : 'DEACTIVATED'}
              </Badge>
            </div>

            {viewUser.bio && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Biography & Statement
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                  "{viewUser.bio}"
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">System Role</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                  {viewUser.role}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Official ID</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {viewUser.student_id || viewUser.teacher_id || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Phone Contact</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {viewUser.phone || viewUser.student_phone || viewUser.teacher_phone || 'Not provided'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Account Status</span>
                <span className={`font-semibold ${viewUser.is_active ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {viewUser.is_active ? 'Active Account' : 'Deactivated Account'}
                </span>
              </div>

              {viewUser.role === 'student' && (
                <>
                  <div>
                    <span className="text-slate-400 block">Current Grade & Section</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {viewUser.current_grade_level
                        ? `Grade ${viewUser.current_grade_level}${viewUser.section_name ? ` (Section ${viewUser.section_name})` : ''}`
                        : 'Registration in Progress'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Academic Stream</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {viewUser.stream_name || (viewUser.current_grade_level <= 10 ? 'General Stream' : 'Not assigned')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Grade 8 Document Clearance</span>
                    <span className={`font-semibold ${
                      viewUser.document_status === 'APPROVED' || viewUser.prerequisite_verified
                        ? 'text-emerald-600'
                        : viewUser.document_status === 'REJECTED'
                        ? 'text-rose-600'
                        : 'text-amber-600'
                    }`}>
                      {viewUser.document_status || (viewUser.prerequisite_verified ? 'APPROVED' : 'PENDING REVIEW')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Residential Address</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {viewUser.student_address || 'Addis Ababa, Ethiopia'}
                    </span>
                  </div>
                </>
              )}

              {viewUser.role === 'teacher' && (
                <>
                  <div>
                    <span className="text-slate-400 block">Department / Specialization</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {viewUser.specialization || 'General High School Faculty'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Qualification</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {viewUser.qualification || 'B.Sc. / B.Ed.'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Assigned Subjects</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {viewUser.assigned_subjects || 'No subjects currently assigned in timetable'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Assigned Sections & Classes</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {viewUser.assigned_classes || 'No classes assigned'}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setViewUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Grade 8 Document Inspection & Review Modal */}
      <Modal isOpen={!!selectedDoc} onClose={() => setSelectedDoc(null)} title="Grade 8 Official Document Review">
        {selectedDoc && (
          <div className="space-y-4 text-sm max-w-xl">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>{selectedDoc.first_name} {selectedDoc.last_name}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      selectedDoc.is_active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    }`}>
                      {selectedDoc.is_active ? 'Active Account' : 'Deactivated Account'}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    ID: {selectedDoc.student_id} • {selectedDoc.email}
                  </p>
                </div>
                <Badge
                  variant={
                    selectedDoc.document_status === 'APPROVED'
                      ? 'success'
                      : selectedDoc.document_status === 'REJECTED'
                      ? 'danger'
                      : 'warning'
                  }
                >
                  {selectedDoc.document_status === 'APPROVED'
                    ? 'APPROVED'
                    : selectedDoc.document_status === 'REJECTED'
                    ? 'REJECTED (DEACTIVATED)'
                    : 'PENDING REVIEW'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 block">Primary School:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedDoc.previous_school || 'Verified Examination Center'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Grade 8 Result:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedDoc.prereq_average_score ? `${selectedDoc.prereq_average_score}% (${parseFloat(selectedDoc.prereq_average_score) >= 50 ? 'PASSED' : 'FAILED'})` : 'Awaiting Review'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Phone / Contact:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedDoc.phone || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Guardian:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedDoc.guardian_name || 'N/A'} {selectedDoc.guardian_phone ? `(${selectedDoc.guardian_phone})` : ''}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Attached Certificate: {selectedDoc.grade8_document_name || 'Certificate.pdf'}
                </label>
                {selectedDoc.grade8_document_data && (
                  <a
                    href={selectedDoc.grade8_document_data}
                    target="_blank"
                    rel="noreferrer"
                    download={selectedDoc.grade8_document_name || 'Grade8_Certificate.pdf'}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open / Download
                  </a>
                )}
              </div>

              {selectedDoc.grade8_document_data && selectedDoc.grade8_document_data.startsWith('data:image') ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-2 flex flex-col items-center justify-center">
                  <img
                    src={selectedDoc.grade8_document_data}
                    alt="Grade 8 Certificate"
                    className="max-h-72 object-contain rounded"
                  />
                  <div className="pt-2 text-center">
                    <a
                      href={selectedDoc.grade8_document_data}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary-400 hover:text-primary-300 font-semibold inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Full Size Certificate Image
                    </a>
                  </div>
                </div>
              ) : selectedDoc.grade8_document_data && selectedDoc.grade8_document_data.startsWith('data:application/pdf') ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-900">
                  <iframe
                    src={selectedDoc.grade8_document_data}
                    title="Grade 8 Official Document"
                    className="w-full h-72 border-0 bg-white"
                  />
                  <div className="p-3 bg-slate-800 flex items-center justify-between text-white text-xs">
                    <span className="font-semibold truncate max-w-xs">{selectedDoc.grade8_document_name || 'Official Grade 8 National Certificate.pdf'}</span>
                    <a
                      href={selectedDoc.grade8_document_data}
                      download={selectedDoc.grade8_document_name || 'Grade8_Certificate.pdf'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Download PDF
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-center">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {selectedDoc.grade8_document_name || 'Grade 8 Completion Document'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Official Grade 8 completion document recorded in admissions registry
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Administrator Remarks / Verification Notes
              </label>
              <textarea
                rows={2}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="e.g. Verified official Ministry stamp and minimum 50% passing threshold satisfied. Cleared for Grade 9 admission."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="pt-3 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleReviewDocument(selectedDoc.id, 'REJECT')}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-all"
                  title="Reject document, fail prerequisite, and permanently deactivate student account"
                >
                  <UserX className="w-4 h-4" />
                  <span>Reject & Deactivate Student</span>
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleReviewDocument(selectedDoc.id, 'APPROVE')}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-all"
                  title="Approve document, pass prerequisite, and activate student for Grade 9 section enrollment"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Authorize Admission</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Edit User Profile: ${editingUser?.first_name || ''} ${editingUser?.last_name || ''}`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={editFormData.firstName}
                onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={editFormData.lastName}
                onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+251 9..."
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Personal Bio / Statement
            </label>
            <textarea
              rows={2}
              placeholder="Tell something about this user..."
              value={editFormData.bio}
              onChange={(e) => setEditFormData({ ...editFormData, bio: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {editingUser?.role === 'teacher' && (
            <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40 space-y-3">
              <div className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                Teacher Department & Qualification
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Department / Specialization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mathematics, Physics, Chemistry"
                    value={editFormData.specialization}
                    onChange={(e) => setEditFormData({ ...editFormData, specialization: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Highest Qualification
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. B.Sc., M.Sc., B.Ed., M.Ed."
                    value={editFormData.qualification}
                    onChange={(e) => setEditFormData({ ...editFormData, qualification: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          )}

          {editingUser?.role === 'student' && (
            <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40 space-y-3">
              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" />
                Student Academic Placement
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Grade Level
                  </label>
                  <select
                    value={editFormData.currentGradeLevel || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, currentGradeLevel: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">-- Grade --</option>
                    <option value="9">Grade 9</option>
                    <option value="10">Grade 10</option>
                    <option value="11">Grade 11</option>
                    <option value="12">Grade 12</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Enrolled Section
                  </label>
                  <select
                    value={editFormData.currentSectionId || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, currentSectionId: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">-- Section --</option>
                    {sections
                      .filter((sec) => !editFormData.currentGradeLevel || String(sec.grade_level) === String(editFormData.currentGradeLevel))
                      .map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          Sec {sec.section_name} ({sec.stream_code || sec.stream_name})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Stream
                  </label>
                  <select
                    value={editFormData.currentStreamId || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, currentStreamId: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">-- Stream --</option>
                    {streams.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Addis Ababa, Bole Subcity"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 transition-all"
            >
              {actionLoading ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete User Account"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-rose-700 dark:text-rose-300 mb-1">
                Permanent Account Deletion
              </p>
              <p>
                Are you sure you want to permanently delete{' '}
                <strong>{userToDelete?.first_name} {userToDelete?.last_name}</strong> ({userToDelete?.email})?
              </p>
              <p className="mt-1 text-[11px] opacity-80">
                This will remove their profile and all associated enrollment and academic records.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deletingUser}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {deletingUser ? 'Deleting...' : 'Confirm Delete Account'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UsersManagement;
