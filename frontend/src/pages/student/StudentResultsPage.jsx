import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Alert from '../../components/common/Alert';
import { Award, Printer, CheckCircle2, ShieldCheck, BookOpen, Layers } from 'lucide-react';

const StudentResultsPage = () => {
  const [data, setData] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [viewTab, setViewTab] = useState('ANNUAL'); // 'ANNUAL', 'SEM1', 'SEM2'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        const res = await api.get('/students/results');
        setData(res.data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch academic results.');
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  if (loading) return <LoadingSpinner message="Calculating cumulative GPA and official grades..." />;

  const student = data?.student;
  const availableGrades = data?.availableGrades || [];
  const resultsByGrade = data?.resultsByGrade || {};

  // Resolve active grade level to view:
  const activeGradeLevel =
    selectedGrade ||
    (availableGrades.find((g) => g.isCurrent && g.subjectCount > 0)?.gradeLevel ||
      availableGrades.find((g) => g.subjectCount > 0)?.gradeLevel ||
      student?.currentGrade ||
      9);

  const activeReport = resultsByGrade[activeGradeLevel] || {
    gradeLevel: activeGradeLevel,
    sectionName: student?.section || 'A',
    streamName: student?.stream || 'General Stream',
    isCurrent: activeGradeLevel === student?.currentGrade,
    averageScore: null,
    sem1Average: null,
    sem2Average: null,
    totalScoreSum: 0,
    subjectCount: 0,
    formula: 'Awaiting teacher submissions',
    promotionStatus: 'EVALUATIONS_PENDING',
    isQualified: false,
    hasBothSemesters: false,
    grades: [],
  };

  const grades = activeReport.grades || [];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-primary-600" />
            Official Academic Results & Two-Semester Report Card
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Institutional breakdown of Semester 1, Semester 2, and Annual Composite marks with Year-End Promotion status.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors shrink-0"
        >
          <Printer className="w-4 h-4" />
          Print Report Card
        </button>
      </div>

      {error && <Alert type="error" title="Error" message={error} />}

      {/* Grade Level Selector Tabs */}
      {availableGrades.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl w-fit border border-slate-200 dark:border-slate-700/60">
          <div className="px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Academic Level:</span>
          </div>
          {availableGrades.map((ag) => {
            const isActive = activeGradeLevel === ag.gradeLevel;
            return (
              <button
                key={ag.gradeLevel}
                type="button"
                onClick={() => setSelectedGrade(ag.gradeLevel)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200/60 dark:border-slate-800'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <span>Grade {ag.gradeLevel}</span>
                {ag.isCurrent ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">
                    Current
                  </span>
                ) : ag.isQualified ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                    {ag.averageScore ? `${ag.averageScore}%` : 'Promoted'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    Completed
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Student Academic Standing Summary Card for Selected Grade Level */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Student Name</span>
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{student?.name}</span>
            <span className="font-mono text-[11px] text-slate-500 block">{student?.studentId}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Academic Level</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
              Grade {activeReport.gradeLevel} ({activeReport.sectionName})
            </span>
            <span className="text-[11px] text-slate-500 block">{activeReport.streamName || 'General Stream'}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">🍂 Sem 1 Average</span>
            <span className="font-bold text-base text-slate-900 dark:text-slate-100">
              {activeReport.sem1Average != null ? `${activeReport.sem1Average}%` : 'Pending'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">🌸 Sem 2 Average</span>
            <span className="font-bold text-base text-slate-900 dark:text-slate-100">
              {activeReport.sem2Average != null ? `${activeReport.sem2Average}%` : 'Pending'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
            <span className="text-emerald-700 dark:text-emerald-400 block mb-0.5 font-semibold">🏆 Annual Composite</span>
            <span className="font-extrabold text-lg text-emerald-600 dark:text-emerald-400">
              {activeReport.averageScore != null ? `${activeReport.averageScore}%` : 'Pending'}
            </span>
          </div>
        </div>

        {/* System Calculation Formula Display */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              Official Annual Calculation Formula:
            </span>
            <span className="text-[11px] text-slate-400">
              (Semester 1 Average + Semester 2 Average) ÷ 2
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200 overflow-x-auto">
            {activeReport.formula}
          </div>
        </div>

        {/* Promotion Status Banner */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="text-slate-500">
            Evaluated Subjects: <strong>{activeReport.subjectCount}</strong>
            {activeReport.failedCount > 0 && (
              <span className="ml-2 text-rose-600 dark:text-rose-400">
                (Failed Subjects: {activeReport.failedCount})
              </span>
            )}
          </span>
          <Badge
            variant={
              activeReport.promotionStatus === 'ELIGIBLE_FOR_PROMOTION' || activeReport.promotionStatus === 'PROMOTED'
                ? 'success'
                : activeReport.promotionStatus === 'BELOW_CRITERIA'
                ? 'danger'
                : activeReport.promotionStatus === 'SEMESTER_1_COMPLETED'
                ? 'primary'
                : 'warning'
            }
            size="sm"
          >
            {activeReport.promotionStatus === 'ELIGIBLE_FOR_PROMOTION'
              ? activeReport.isCurrent
                ? `QUALIFIED FOR PROMOTION TO GRADE ${activeReport.gradeLevel + 1}`
                : `CERTIFIED & PROMOTED TO GRADE ${activeReport.gradeLevel + 1}`
              : activeReport.promotionStatus === 'PROMOTED'
              ? `QUALIFIED & PROMOTED TO GRADE ${activeReport.gradeLevel + 1}`
              : activeReport.promotionStatus === 'SEMESTER_1_COMPLETED'
              ? 'SEMESTER 1 COMPLETED • SEMESTER 2 IN PROGRESS'
              : activeReport.promotionStatus === 'BELOW_CRITERIA'
              ? 'BELOW PROMOTION CRITERIA (< 50% AVERAGE OR > 2 FAILED SUBJECTS)'
              : 'EVALUATIONS IN PROGRESS / PENDING'}
          </Badge>
        </div>
      </div>

      {/* View Mode Tabs (Annual Composite vs Semester 1 vs Semester 2) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setViewTab('ANNUAL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewTab === 'ANNUAL'
                ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200/60 dark:border-slate-800'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            📊 Annual Composite Overview
          </button>
          <button
            type="button"
            onClick={() => setViewTab('SEM1')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewTab === 'SEM1'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm border border-slate-200/60 dark:border-slate-800'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            🍂 Semester 1 Breakdown
          </button>
          <button
            type="button"
            onClick={() => setViewTab('SEM2')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewTab === 'SEM2'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm border border-slate-200/60 dark:border-slate-800'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            🌸 Semester 2 Breakdown
          </button>
        </div>

        <span className="text-xs text-slate-500 dark:text-slate-400">
          Showing <strong>{grades.length}</strong> evaluated courses
        </span>
      </div>

      {/* Subjects Grade Breakdown Table for Selected Grade */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {viewTab === 'ANNUAL' ? (
            /* Annual Composite Table */
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-3">Instructor</th>
                  <th className="py-3 px-3 text-center">Semester 1 (100)</th>
                  <th className="py-3 px-3 text-center">Semester 2 (100)</th>
                  <th className="py-3 px-3 text-center font-bold text-slate-900 dark:text-slate-100">Annual Composite (100)</th>
                  <th className="py-3 px-3 text-center">Grade</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {grades.length > 0 ? (
                  grades.map((g) => (
                    <tr key={g.id || g.subject_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {g.subject_name}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500 font-medium">
                        {g.teacher_name || 'Subject Teacher'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-700 dark:text-slate-300">
                        {g.sem1?.total_score != null ? parseFloat(g.sem1.total_score).toFixed(1) : '—'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-700 dark:text-slate-300">
                        {g.sem2?.total_score != null ? parseFloat(g.sem2.total_score).toFixed(1) : '—'}
                      </td>
                      <td className="py-3 px-3 text-center font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-base">
                        {g.annual_total != null ? parseFloat(g.annual_total).toFixed(1) : '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant={
                            g.annual_letter?.startsWith('A')
                              ? 'success'
                              : g.annual_letter === 'F'
                              ? 'danger'
                              : 'primary'
                          }
                          size="sm"
                        >
                          {g.annual_letter || '—'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {g.annual_total != null ? (
                          g.is_passed ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                              Failed
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">Pending</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 italic truncate max-w-xs">
                        {g.remarks || 'Standard evaluation'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No academic records recorded yet for Grade {activeReport.gradeLevel}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            /* Detailed Breakdown Table for Semester 1 or Semester 2 */
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-3">Instructor</th>
                  <th className="py-3 px-3 text-center">Quiz (10)</th>
                  <th className="py-3 px-3 text-center">Midterm (30)</th>
                  <th className="py-3 px-3 text-center">Assignment / Group (20)</th>
                  <th className="py-3 px-3 text-center">Final (40)</th>
                  <th className="py-3 px-3 text-center font-bold text-slate-900 dark:text-slate-100">
                    {viewTab === 'SEM1' ? 'Sem 1 Total (100)' : 'Sem 2 Total (100)'}
                  </th>
                  <th className="py-3 px-3 text-center">Grade</th>
                  <th className="py-3 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {grades.length > 0 ? (
                  grades.map((g) => {
                    const semData = viewTab === 'SEM1' ? g.sem1 : g.sem2;
                    return (
                      <tr key={g.id || g.subject_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {g.subject_name}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-500 font-medium">
                          {semData?.teacher_name || g.teacher_name || 'Subject Teacher'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {semData?.quiz_score != null ? parseFloat(semData.quiz_score).toFixed(1) : '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {semData?.midterm_score != null ? parseFloat(semData.midterm_score).toFixed(1) : '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-emerald-600">
                          {semData?.assignment_score != null ? parseFloat(semData.assignment_score).toFixed(1) : '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {semData?.final_score != null ? parseFloat(semData.final_score).toFixed(1) : '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900 dark:text-slate-100 font-mono text-sm">
                          {semData?.total_score != null ? parseFloat(semData.total_score).toFixed(1) : '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge
                            variant={
                              semData?.letter_grade?.startsWith('A')
                                ? 'success'
                                : semData?.letter_grade === 'F'
                                ? 'danger'
                                : 'primary'
                            }
                            size="sm"
                          >
                            {semData?.letter_grade || '—'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 italic truncate max-w-xs">
                          {semData?.remarks || (semData ? 'Standard evaluation' : 'Pending submissions')}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No academic records recorded yet for {viewTab === 'SEM1' ? 'Semester 1' : 'Semester 2'}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentResultsPage;
