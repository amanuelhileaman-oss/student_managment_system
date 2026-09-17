import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Alert from '../../components/common/Alert';
import { Award, Printer, CheckCircle2, ShieldCheck, BookOpen, Layers } from 'lucide-react';

const StudentResultsPage = () => {
  const [data, setData] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState(null);
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
  // If user selected a grade tab, use it.
  // Otherwise, default to the grade with completed evaluations, or current grade.
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
    totalScoreSum: 0,
    subjectCount: 0,
    formula: 'Awaiting teacher submissions',
    promotionStatus: 'EVALUATIONS_PENDING',
    isQualified: false,
    grades: [],
  };

  const grades = activeReport.grades || [];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-primary-600" />
            Official Academic Results & Report Card
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Certified institutional breakdown of quizzes, midterms, group projects, and final exam marks.
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

      {/* Grade Level Selector Tabs (e.g. Grade 9 Completed vs Grade 10 Current) */}
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
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Student Name</span>
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{student?.name}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Student ID</span>
            <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">{student?.studentId}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Report Academic Level</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Grade {activeReport.gradeLevel} ({activeReport.sectionName})
              {activeReport.isCurrent ? (
                <span className="ml-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded">
                  Current
                </span>
              ) : (
                <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                  Certified
                </span>
              )}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Cumulative Average</span>
            <span className="font-extrabold text-lg text-primary-600 dark:text-primary-400">
              {activeReport.averageScore ? `${activeReport.averageScore}%` : 'Pending'}
            </span>
          </div>
        </div>

        {/* System Calculation Formula Display */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              System Calculation Formula:
            </span>
            <span className="text-[11px] text-slate-400">
              {activeReport.subjectCount > 0
                ? `(Sum of ${activeReport.subjectCount} Subject Scores) ÷ ${activeReport.subjectCount} Subjects`
                : 'Awaiting teacher submissions'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200 overflow-x-auto">
            {activeReport.formula}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="text-slate-500">
            Stream: <strong>{activeReport.streamName || student?.stream || 'General Stream'}</strong> • Evaluated Subjects: <strong>{activeReport.subjectCount}</strong>
          </span>
          <Badge
            variant={
              activeReport.promotionStatus === 'ELIGIBLE_FOR_PROMOTION'
                ? 'success'
                : activeReport.promotionStatus === 'BELOW_CRITERIA'
                ? 'danger'
                : 'warning'
            }
            size="sm"
          >
            {activeReport.promotionStatus === 'ELIGIBLE_FOR_PROMOTION'
              ? activeReport.isCurrent
                ? 'QUALIFIED FOR PROMOTION'
                : `QUALIFIED & PROMOTED TO GRADE ${activeReport.gradeLevel + 1}`
              : activeReport.promotionStatus === 'BELOW_CRITERIA'
              ? 'BELOW PROMOTION CRITERIA'
              : 'EVALUATIONS IN PROGRESS / PENDING'}
          </Badge>
        </div>
      </div>

      {/* Subjects Grade Breakdown Table for Selected Grade */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-3">Instructor</th>
                <th className="py-3 px-3 text-center">Quiz (10)</th>
                <th className="py-3 px-3 text-center">Midterm (30)</th>
                <th className="py-3 px-3 text-center">Assignment / Group (20)</th>
                <th className="py-3 px-3 text-center">Final (40)</th>
                <th className="py-3 px-3 text-center">Total (100)</th>
                <th className="py-3 px-3 text-center">Letter Grade</th>
                <th className="py-3 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {grades.length > 0 ? (
                grades.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {g.subject_name}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-500 font-medium">
                      {g.teacher_name || 'Subject Teacher'}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">{parseFloat(g.quiz_score || 0).toFixed(1)}</td>
                    <td className="py-3 px-3 text-center font-mono">{parseFloat(g.midterm_score || 0).toFixed(1)}</td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-emerald-600">
                      {parseFloat(g.assignment_score || 0).toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">{parseFloat(g.final_score || 0).toFixed(1)}</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {parseFloat(g.total_score || 0).toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge
                        variant={g.letter_grade?.startsWith('A') ? 'success' : g.letter_grade === 'F' ? 'danger' : 'primary'}
                        size="sm"
                      >
                        {g.letter_grade || '—'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 italic truncate max-w-xs">
                      {g.remarks || 'Standard evaluation'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No academic records recorded yet for Grade {activeReport.gradeLevel}.
                    {activeReport.isCurrent && (
                      <span className="block mt-1 text-xs text-slate-500">
                        Marks will appear here once Grade {activeReport.gradeLevel} teachers submit quiz, midterm, or final evaluations.
                      </span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StudentResultsPage;
