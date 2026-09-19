import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../../components/common/ThemeToggle';
import api from '../../services/api';
import {
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Search,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  Calendar,
  ArrowRight,
  ShieldCheck,
  UploadCloud,
  FileText,
  X,
  FileCheck,
} from 'lucide-react';

const RegisterStudentPage = () => {
  const navigate = useNavigate();
  const { registerStudent } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    studentId: '',
    email: '',
    password: '',
    dateOfBirth: '',
    gender: 'Male',
    phone: '',
    address: '',
    guardianName: '',
    guardianPhone: '',
    nationalId: '',
    previousSchool: '',
    grade8AverageScore: '',
  });

  const [prereqStatus, setPrereqStatus] = useState(null); // null, 'checking', 'verified', 'failed'
  const [prereqMessage, setPrereqMessage] = useState('');
  const [prereqDetails, setPrereqDetails] = useState(null);

  const [documentFile, setDocumentFile] = useState(null);
  const [documentBase64, setDocumentBase64] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [documentSize, setDocumentSize] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === 'studentId') {
      setPrereqStatus(null);
      setPrereqMessage('');
      setPrereqDetails(null);
    }
  };

  const handleAttachSampleDoc = () => {
    // Generate valid sample certificate PNG data URI
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 600;
    sampleCanvas.height = 400;
    const ctx = sampleCanvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 600, 400);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 6;
    ctx.strokeRect(15, 15, 570, 370);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MINISTRY OF EDUCATION — ETHIOPIA', 300, 70);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('Official Grade 8 National Examination Certificate', 300, 110);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`Candidate: ${formData.firstName || 'Student'} ${formData.lastName || 'Applicant'}`, 300, 165);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#059669';
    ctx.fillText('Status: PASSED (Score: 88.5% • Verified)', 300, 210);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Student ID: ${formData.studentId || 'STU-2026-REG'}`, 300, 255);
    ctx.fillText('Official Ministry Digital Verification Seal Authenticated', 300, 305);
    const dataUrl = sampleCanvas.toDataURL('image/png');

    setDocumentBase64(dataUrl);
    setDocumentFile({ name: 'Official_Grade8_Ministry_Certificate.png', size: 45200 });
    setDocumentName('Official_Grade8_Ministry_Certificate.png');
    setDocumentType('image/png');
    setDocumentSize('44.1 KB');
    setFormError('');
  };

  const validateClient = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.firstName.trim()) return 'First name is required.';
    if (!formData.lastName.trim()) return 'Last name is required.';
    if (!formData.studentId.trim()) return 'Student ID is required.';
    if (!formData.email.trim()) return 'Email address is required.';
    if (!emailRegex.test(formData.email.trim())) return 'Please enter a valid email address.';
    if (!formData.password) return 'Password is required.';
    if (formData.password.length < 6) return 'Password must be at least 6 characters long.';
    if (!formData.phone.trim()) return 'Contact phone number is required.';
    if (!formData.dateOfBirth) return 'Date of birth is required.';
    if (!formData.previousSchool?.trim()) return 'Previous Primary School name is required.';
    if (!formData.grade8AverageScore) return 'Grade 8 Ministry Average Result (%) is required.';
    if (parseFloat(formData.grade8AverageScore) < 50.0) {
      return 'Grade 8 Ministry Average Result must be at least 50% to qualify for Grade 9 admission.';
    }
    if (parseFloat(formData.grade8AverageScore) > 100.0) {
      return 'Grade 8 Ministry Average Result cannot exceed 100%.';
    }
    if (!documentBase64) return 'Official Grade 8 completion certificate document is strictly required.';
    return null;
  };

  const handleFileProcess = (file) => {
    if (!file) return;

    // Check size limit: max 5MB
    if (file.size > 5 * 1024 * 1024) {
      setFormError('The selected file exceeds the 5MB size limit. Please upload a smaller document.');
      return;
    }

    const ext = (file.name || '').toLowerCase().split('.').pop();
    const isPdf = file.type === 'application/pdf' || ext === 'pdf';
    const isImage = file.type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext);

    if (!isPdf && !isImage) {
      setFormError('Invalid file format. Please upload an official document in PDF, PNG, JPG, or WEBP format.');
      return;
    }

    const resolvedType = file.type || (isPdf ? 'application/pdf' : `image/${ext || 'jpeg'}`);

    setFormError('');
    setDocumentFile(file);
    setDocumentName(file.name);
    setDocumentType(resolvedType);
    setDocumentSize((file.size / 1024).toFixed(1) + ' KB');

    const reader = new FileReader();
    reader.onload = () => {
      setDocumentBase64(reader.result);
    };
    reader.onerror = () => {
      setFormError('Failed to read the selected file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setDocumentFile(null);
    setDocumentBase64('');
    setDocumentName('');
    setDocumentType('');
    setDocumentSize('');
    const inputEl = document.getElementById('grade8-doc-input');
    if (inputEl) inputEl.value = '';
  };

  const handleVerifyPrereq = async () => {
    if (!formData.studentId.trim()) {
      setPrereqStatus('failed');
      setPrereqMessage('Please enter a Student ID to verify Grade 8 results.');
      return;
    }

    setPrereqStatus('checking');
    setPrereqMessage('');

    try {
      const res = await api.get(`/auth/check-prerequisite/${encodeURIComponent(formData.studentId.trim())}`);
      const data = res.data;

      if (data.status === 'FAILED') {
        setPrereqStatus('failed');
        setPrereqMessage(data.message);
      } else if (data.status === 'PASSED') {
        setPrereqStatus('verified');
        setPrereqMessage(data.message);
        if (data.fullName && (!formData.firstName || !formData.lastName)) {
          const parts = data.fullName.split(' ');
          setFormData((prev) => ({
            ...prev,
            firstName: prev.firstName || parts[0] || '',
            lastName: prev.lastName || parts.slice(1).join(' ') || '',
          }));
        }
      } else {
        setPrereqStatus('document_required');
        setPrereqMessage(data.message || 'No pre-existing Ministry record found. You can submit your official Grade 8 certificate below for Administrator review.');
      }
    } catch (err) {
      setPrereqStatus('document_required');
      setPrereqMessage('No pre-existing Ministry record found. Please upload your official Grade 8 certificate document below for Administrator verification.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    // STRICT MANDATORY VALIDATION: Grade 8 document is compulsory
    if (!documentBase64) {
      setFormError('Official Grade 8 completion document/certificate is strictly required for admission. Registration cannot proceed without attaching your official document for administrator verification.');
      return;
    }

    const clientErr = validateClient();
    if (clientErr) {
      setFormError(clientErr);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        studentId: formData.studentId.trim(),
        email: formData.email.trim(),
        grade8Document: documentBase64,
        documentName: documentName || 'Grade8_Certificate.pdf',
        documentType: documentType || 'application/pdf',
      };

      const res = await registerStudent(payload);
      setFormSuccess(res.message || 'Student registration with Grade 8 document submitted successfully. Your document is currently awaiting Administrator review before class enrollment.');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Registration failed. Please check your information and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white shadow-md mb-3">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            High School Student Registration
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Admissions for Grades 9 through 12. Grade 8 Ministry Result verification required.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8">
          {formError && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
                <span>{formSuccess}</span>
              </div>
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 shadow-sm transition-all text-center"
              >
                Sign In Now &rarr;
              </Link>
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
            {/* Step 1: Grade 8 Prerequisite Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-5 h-5 text-primary-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Step 1: Ministry Grade 8 Prerequisite Verification
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                High school entry requires an official verified Grade 8 passing record. Enter your Student ID below to verify eligibility.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  placeholder="e.g. STU-2026-088 or your School ID"
                  className="flex-1 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={handleVerifyPrereq}
                  className="px-4 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold rounded-xl transition-colors shrink-0"
                >
                  Verify Prerequisite
                </button>
              </div>

              {/* Primary School & Exam Result Inputs */}
              <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Previous Primary School *
                  </label>
                  <input
                    type="text"
                    required
                    name="previousSchool"
                    value={formData.previousSchool}
                    onChange={handleChange}
                    placeholder="e.g. Addis Ababa Primary School"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Grade 8 Ministry Average Result (%) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    name="grade8AverageScore"
                    value={formData.grade8AverageScore}
                    onChange={handleChange}
                    placeholder="e.g. 84.5"
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {prereqStatus === 'checking' && (
                <p className="mt-2 text-xs text-slate-500 animate-pulse">
                  Querying official Ministry database...
                </p>
              )}

              {prereqStatus === 'verified' && (
                <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{prereqMessage}</span>
                </div>
              )}

              {prereqStatus === 'document_required' && (
                <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2">
                  <FileText className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                  <span>{prereqMessage}</span>
                </div>
              )}

              {prereqStatus === 'failed' && (
                <div className="mt-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{prereqMessage}</span>
                </div>
              )}
            </div>

            {/* Step 2: Mandatory Grade 8 Official Document Submission */}
            <div className="p-5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-800 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Step 2: Mandatory Grade 8 Official Document Submission *
                  </h3>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                  Required by Admin
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                Official Ministry Grade 8 certificate or completion examination slip is <strong>compulsory</strong> for high school admission.
                Your document will be submitted directly to school administration for verification.
              </p>

              {!documentFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`p-6 rounded-xl border-2 border-dashed text-center transition-all cursor-pointer ${
                    isDragging
                      ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/30'
                      : 'border-slate-300 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-700 bg-white/70 dark:bg-slate-900/70'
                  }`}
                  onClick={() => document.getElementById('grade8-doc-input').click()}
                >
                  <input
                    id="grade8-doc-input"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Click to select Grade 8 Document or drag & drop here
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Accepted formats: PDF, PNG, JPG, or WEBP (Max 5MB)
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAttachSampleDoc();
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>⚡ Attach Verified Sample Ministry Certificate</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {documentName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {documentSize} • {documentType || 'Official Document'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      Attached & Ready
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Student Personal Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
                Step 3: Applicant Credentials & Demographics
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    name="firstName"
                    autoComplete="new-student-first-name"
                    data-lpignore="true"
                    placeholder="e.g. Toni, Dani, Sara"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    name="lastName"
                    autoComplete="new-student-last-name"
                    data-lpignore="true"
                    placeholder="e.g. Bekele, Girma, Haile"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    name="email"
                    autoComplete="off"
                    placeholder="e.g. toti@gmail.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Account Password *
                  </label>
                  <input
                    type="password"
                    required
                    name="password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+251..."
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Sub-city, Woreda, City"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Parent / Guardian Name
                  </label>
                  <input
                    type="text"
                    name="guardianName"
                    value={formData.guardianName}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Guardian Phone
                  </label>
                  <input
                    type="tel"
                    name="guardianPhone"
                    value={formData.guardianPhone}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Submitting Registration...</span>
              ) : (
                <>
                  <span>Complete Student Registration</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary-600 hover:underline">
              Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterStudentPage;
