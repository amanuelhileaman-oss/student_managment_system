import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertTriangle,
  Building,
  Calendar,
  Users,
  Award,
  Sparkles,
  RefreshCw,
  Sliders,
} from 'lucide-react';

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    schoolName: '',
    academicYear: '',
    defaultSectionCapacity: 50,
    minGrade8Gpa: 50.0,
    quizWeight: 10,
    midtermWeight: 30,
    assignmentWeight: 20,
    finalWeight: 40,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch persisted settings from backend
  const fetchSettings = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.get('/admin/settings');
      if (res.data?.success && res.data?.data) {
        setSettings({
          schoolName: res.data.data.schoolName || '',
          academicYear: res.data.data.academicYear || '',
          defaultSectionCapacity: res.data.data.defaultSectionCapacity ?? 50,
          minGrade8Gpa: res.data.data.minGrade8Gpa ?? 50.0,
          quizWeight: res.data.data.quizWeight ?? 10,
          midtermWeight: res.data.data.midtermWeight ?? 30,
          assignmentWeight: res.data.data.assignmentWeight ?? 20,
          finalWeight: res.data.data.finalWeight ?? 40,
        });
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to load system settings from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Compute live assessment weights total
  const qW = parseFloat(settings.quizWeight) || 0;
  const mW = parseFloat(settings.midtermWeight) || 0;
  const aW = parseFloat(settings.assignmentWeight) || 0;
  const fW = parseFloat(settings.finalWeight) || 0;
  const totalWeight = Math.round((qW + mW + aW + fW) * 100) / 100;
  const isWeightValid = totalWeight === 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!settings.schoolName.trim()) {
      setErrorMsg('Please provide an official school name.');
      return;
    }
    if (!settings.academicYear.trim()) {
      setErrorMsg('Please specify the active academic calendar year (e.g. 2026-2027).');
      return;
    }
    if (settings.defaultSectionCapacity < 10 || settings.defaultSectionCapacity > 150) {
      setErrorMsg('Section capacity must be between 10 and 150 students.');
      return;
    }
    if (settings.minGrade8Gpa < 0 || settings.minGrade8Gpa > 100) {
      setErrorMsg('Minimum prerequisite GPA must be between 0% and 100%.');
      return;
    }
    if (!isWeightValid) {
      setErrorMsg(`The academic assessment weights must total exactly 100%. Currently they sum to ${totalWeight}%.`);
      return;
    }

    setSaving(true);
    try {
      const res = await api.put('/admin/settings', settings);
      setSuccessMsg(res.data?.message || 'System settings saved and applied successfully.');
      if (res.data?.data) {
        setSettings(res.data.data);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save system settings.');
    } finally {
      setSaving(false);
    }
  };

  // Preset helper
  const applyPreset = (quiz, midterm, assignment, final) => {
    setSettings((prev) => ({
      ...prev,
      quizWeight: quiz,
      midtermWeight: midterm,
      assignmentWeight: assignment,
      finalWeight: final,
    }));
  };

  if (loading) {
    return <LoadingSpinner message="Loading institutional configuration & parameters..." />;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            System Configuration & Policies
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Institutional parameters, academic calendar, section capacity standards, and grading formulas.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSettings}
          disabled={loading || saving}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors self-start sm:self-auto"
          title="Reload settings from database"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reload</span>
        </button>
      </div>

      {successMsg && (
        <Alert
          type="success"
          title="Configuration Saved"
          message={successMsg}
          onClose={() => setSuccessMsg('')}
        />
      )}

      {errorMsg && (
        <Alert
          type="error"
          title="Configuration Error"
          message={errorMsg}
          onClose={() => setErrorMsg('')}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ========================================================================= */}
        {/* CARD 1: GENERAL SCHOOL PARAMETERS                                         */}
        {/* ========================================================================= */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              General School Parameters
            </h3>
            <span className="text-[11px] text-slate-400">Institutional Baseline</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Field: Official School Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Official School Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={settings.schoolName}
                onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                placeholder="e.g. Addis International High School"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors"
              />
            </div>

            {/* Field: Active Academic Year */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Active Academic Year <span className="text-rose-500">*</span></span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Editable Calendar</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={settings.academicYear}
                  onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
                  placeholder="e.g. 2026-2027"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Field: Standard Section Capacity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Standard Section Capacity</span>
                <span className="text-[10px] text-slate-400 font-normal">Range: 10 - 150 students</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="10"
                  max="150"
                  required
                  value={settings.defaultSectionCapacity}
                  onChange={(e) => setSettings({ ...settings, defaultSectionCapacity: parseInt(e.target.value, 10) || '' })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors font-medium"
                />
                <Users className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Default seat quota assigned when generating new classroom sections.
              </p>
            </div>

            {/* Field: Minimum Grade 8 GPA */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Minimum Grade 8 Prerequisite GPA (%)</span>
                <span className="text-[10px] text-slate-400 font-normal">Admission threshold</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  required
                  value={settings.minGrade8Gpa}
                  onChange={(e) => setSettings({ ...settings, minGrade8Gpa: parseFloat(e.target.value) || '' })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors font-medium"
                />
                <Award className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Minimum certified 8th Grade result required to register for Grade 9.
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 2: ACADEMIC ASSESSMENT WEIGHTS (TOTAL 100%)                          */}
        {/* ========================================================================= */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                Academic Assessment Weights (Total 100%)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Configure institutional grade breakdown across continuous assessments and exams.
              </p>
            </div>

            {/* Total Balance Badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs ${
                isWeightValid
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
              }`}
            >
              {isWeightValid ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Total: 100% (Balanced)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>
                    Total: {totalWeight}% ({totalWeight < 100 ? `Need +${(100 - totalWeight).toFixed(1)}%` : `Excess ${(totalWeight - 100).toFixed(1)}%`})
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Presets:
            </span>
            <button
              type="button"
              onClick={() => applyPreset(10, 30, 20, 40)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition-colors"
            >
              Standard (10 / 30 / 20 / 40)
            </button>
            <button
              type="button"
              onClick={() => applyPreset(15, 25, 20, 40)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition-colors"
            >
              Balanced (15 / 25 / 20 / 40)
            </button>
            <button
              type="button"
              onClick={() => applyPreset(20, 20, 20, 40)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition-colors"
            >
              Continuous (20 / 20 / 20 / 40)
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Field: Quiz Weight */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Quiz Weight (%) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                required
                value={settings.quizWeight}
                onChange={(e) => setSettings({ ...settings, quizWeight: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-center text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors"
              />
              <span className="text-[10px] text-slate-400 block text-center mt-1">Short quizzes & tests</span>
            </div>

            {/* Field: Midterm Weight */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Midterm (%) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                required
                value={settings.midtermWeight}
                onChange={(e) => setSettings({ ...settings, midtermWeight: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-center text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors"
              />
              <span className="text-[10px] text-slate-400 block text-center mt-1">Midterm semester exam</span>
            </div>

            {/* Field: Assignment Weight */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Assignment (%) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                required
                value={settings.assignmentWeight}
                onChange={(e) => setSettings({ ...settings, assignmentWeight: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-center text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors"
              />
              <span className="text-[10px] text-slate-400 block text-center mt-1">Projects & group work</span>
            </div>

            {/* Field: Final Exam Weight */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Final Exam (%) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                required
                value={settings.finalWeight}
                onChange={(e) => setSettings({ ...settings, finalWeight: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-center text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors"
              />
              <span className="text-[10px] text-slate-400 block text-center mt-1">End of semester final</span>
            </div>
          </div>

          {/* Visual Percentage Progress Bar */}
          <div className="space-y-1.5 pt-2">
            <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
              <div
                style={{ width: `${Math.min(qW, 100)}%` }}
                className="bg-indigo-500 h-full transition-all"
                title={`Quiz: ${qW}%`}
              />
              <div
                style={{ width: `${Math.min(mW, 100)}%` }}
                className="bg-blue-500 h-full transition-all"
                title={`Midterm: ${mW}%`}
              />
              <div
                style={{ width: `${Math.min(aW, 100)}%` }}
                className="bg-emerald-500 h-full transition-all"
                title={`Assignment: ${aW}%`}
              />
              <div
                style={{ width: `${Math.min(fW, 100)}%` }}
                className="bg-purple-600 h-full transition-all"
                title={`Final Exam: ${fW}%`}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> Quiz {qW}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Midterm {mW}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Assignment {aW}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-600 inline-block" /> Final {fW}%</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !isWeightValid}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm transition-all hover:shadow-md"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving Parameters...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Institutional Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;
