import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  GraduationCap,
  Calendar,
  Clock,
  Save,
  Check,
  Compass,
  FlaskConical,
  Building2,
  Sparkles,
} from 'lucide-react';

const EnrollmentPage = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [prereq, setPrereq] = useState(null);
  const [progressionData, setProgressionData] = useState(null);
  const [targetGrade, setTargetGrade] = useState(9);
  const [targetStreamId, setTargetStreamId] = useState(1);
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const currentGrade = user?.student?.current_grade_level;
  const currentSectionName = user?.student?.section_name;
  const currentStreamName = user?.student?.stream_name;
  const currentStreamId = user?.student?.current_stream_id;

  // Initialize target grade and stream based on student's current grade progression
  useEffect(() => {
    if (currentGrade === 9) {
      setTargetGrade(10);
      setTargetStreamId(1); // General Stream standard for Grade 10
    } else if (currentGrade === 10) {
      setTargetGrade(11);
      setTargetStreamId(2); // Default to Natural Science for Grade 11 (user can toggle to Social)
    } else if (currentGrade === 11) {
      setTargetGrade(12);
      setTargetStreamId(currentStreamId || 2); // Continue same stream into Grade 12
    } else if (currentGrade === 12) {
      setTargetGrade(12);
      setTargetStreamId(currentStreamId || 2);
    } else {
      setTargetGrade(9);
      setTargetStreamId(1);
    }
  }, [currentGrade, currentStreamId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [preRes, progRes, secRes] = await Promise.all([
        api.get('/students/prerequisite-status').catch(() => ({ data: { data: null } })),
        api.get(`/students/progression-eligibility?targetGradeLevel=${targetGrade}`).catch(() => ({ data: { data: null } })),
        api.get(`/students/available-sections?gradeLevel=${targetGrade}&streamId=${targetStreamId}`).catch(() => ({ data: { data: [] } })),
        refreshUser(),
      ]);

      setPrereq(preRes.data.data);
      setProgressionData(progRes.data.data);
      setSections(secRes.data.data || secRes.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch enrollment and progression information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [targetGrade, targetStreamId]);

  const handleEnroll = async () => {
    if (!selectedSectionId) {
      setError('Please select an available section.');
      return;
    }

    const currentEval = progressionData?.evaluation;
    if (currentGrade && currentEval && !currentEval.eligible) {
      setError(
        currentEval.message ||
          `Grade ${currentGrade} results do not meet promotion criteria. Please satisfy academic requirements before proceeding.`
      );
      return;
    }

    setEnrolling(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.post('/students/enroll', {
        sectionId: selectedSectionId,
        targetGradeLevel: targetGrade,
        targetStreamId,
      });

      const chosenStream = targetStreamId === 2 ? 'Natural Science' : targetStreamId === 3 ? 'Social Science' : 'General';
      const msg =
        targetGrade > 9
          ? `Congratulations! You have fulfilled Grade ${currentGrade} academic criteria and officially enrolled into Grade ${targetGrade} (${chosenStream} Stream, Section ${res.data.data?.section?.name || ''})!`
          : res.data.message || 'Enrollment successful.';

      setSuccessMsg(msg);
      await refreshUser();
      fetchData();
    } catch (err) {
      const apiMsg = err.response?.data?.message || 'Enrollment failed. Please check criteria or select another section.';
      setError(apiMsg);
    } finally {
      setEnrolling(false);
    }
  };

  if (loading && sections.length === 0) {
    return <LoadingSpinner message="Evaluating academic records and section capacities..." />;
  }

  const isGrade9To10Progression = currentGrade === 9 && targetGrade === 10;
  const isGrade10To11Progression = currentGrade === 10 && targetGrade === 11;
  const isGrade11To12Progression = currentGrade === 11 && targetGrade === 12;
  const isSeniorEnrolled = currentGrade === 12;

  const currentEval = progressionData?.evaluation;

  return (
    <div className="max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>High School Academic Progression Engine (Grades 9 - 12)</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Layers className="w-6 h-6 text-primary-600" />
          {isSeniorEnrolled
            ? 'Grade 12 Senior Active Enrollment'
            : isGrade11To12Progression
            ? 'Grade 12 Senior Progression & Section Selection'
            : isGrade10To11Progression
            ? 'Grade 11 Academic Progression & Stream Selection'
            : isGrade9To10Progression
            ? 'Grade 10 Academic Progression & Section Selection'
            : 'Grade 9 Admission & Section Enrollment'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          {isSeniorEnrolled
            ? 'You are actively enrolled in your final senior year. Focus on national entrance examination preparations.'
            : isGrade11To12Progression
            ? 'Verify Grade 11 database evaluations and select your Grade 12 senior section in your declared stream.'
            : isGrade10To11Progression
            ? 'Verify Grade 10 results, choose your academic specialization stream (Natural or Social Science), and allocate your seat.'
            : isGrade9To10Progression
            ? 'Official progression to Grade 10 based on recorded Grade 9 academic evaluations. Re-registration is not required.'
            : 'Official Grade 8 prerequisite qualification, administrative document verification, and Grade 9 seat allocation.'}
        </p>
      </div>

      {error && <Alert type="error" title="Progression Alert" message={error} onClose={() => setError('')} />}
      {successMsg && <Alert type="success" title="Progression Confirmed" message={successMsg} onClose={() => setSuccessMsg('')} />}

      {/* ========================================================================= */}
      {/* CASE A: GRADE 12 SENIOR (ALREADY ENROLLED IN GRADE 12) */}
      {/* ========================================================================= */}
      {isSeniorEnrolled && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-500/10 via-primary-500/10 to-indigo-500/10 border border-purple-200 dark:border-purple-800/60 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                You are Enrolled in Grade 12 (Senior Year)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Current Section: <span className="font-bold text-purple-600 dark:text-purple-400">Section {currentSectionName || 'Assigned'}</span> • Stream: <span className="font-bold text-indigo-600 dark:text-indigo-400">{currentStreamName || 'Specialized Stream'}</span>
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            All progression milestones from Grade 9 through Grade 11 have been successfully completed. You are in your final graduating year. Access your timetable, academic results, and university entrance exam prep books below.
          </p>
          <div className="pt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/student/schedule')}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
            >
              <Calendar className="w-4 h-4" />
              <span>View Grade 12 Timetable</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/student/results')}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Award className="w-4 h-4" />
              <span>View Academic Report Card</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/student/materials')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
            >
              <BookOpen className="w-4 h-4" />
              <span>EUEE Exam Prep Materials</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASE B: RESULTS EVALUATION CARD (FOR CONTINUING STUDENTS IN GRADES 9, 10, 11) */}
      {/* ========================================================================= */}
      {currentGrade && !isSeniorEnrolled && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary-600" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Grade {currentGrade} Academic Evaluation &amp; Progression Criteria
              </h3>
            </div>
            <div>
              {currentEval?.eligible ? (
                <Badge variant="success" size="md">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />
                  QUALIFIED FOR GRADE {targetGrade} PROMOTION
                </Badge>
              ) : currentEval?.reason === 'BELOW_CRITERIA' ? (
                <Badge variant="danger" size="md">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 inline" />
                  BELOW CRITERIA - PROMOTION BLOCKED
                </Badge>
              ) : (
                <Badge variant="warning" size="md">
                  <Clock className="w-3.5 h-3.5 mr-1 inline" />
                  GRADE {currentGrade} EVALUATION PENDING
                </Badge>
              )}
            </div>
          </div>

          {/* GPA & Status Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
            <div>
              <span className="text-slate-400 block">Grade {currentGrade} Average Score</span>
              <span
                className={`text-base font-extrabold ${
                  currentEval?.average >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {currentEval?.average !== undefined ? `${currentEval.average}%` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Required Promotion Threshold</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-base">50.0% Minimum</span>
            </div>
            <div>
              <span className="text-slate-400 block">Progression Decision</span>
              <span
                className={`font-bold text-sm ${
                  currentEval?.eligible ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {currentEval?.eligible
                  ? `PASSED (Eligible for Grade ${targetGrade})`
                  : 'FAILED / QUALIFICATION NEEDED'}
              </span>
            </div>
          </div>

          {/* Below Criteria Alert */}
          {currentEval?.reason === 'BELOW_CRITERIA' && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-rose-950 dark:text-rose-100">
                  Grade {currentGrade} result is below the criteria. Please perform your qualification before proceed.
                </h4>
                <p className="mt-0.5 leading-relaxed text-rose-800 dark:text-rose-300">
                  Your recorded Grade {currentGrade} cumulative average is <strong>{currentEval.average}%</strong>, which is below the 50.0% requirement. You cannot jump or advance to Grade {targetGrade} until academic requirements are met.
                </p>
              </div>
            </div>
          )}

          {/* Pending Results Alert */}
          {currentEval?.reason === 'NO_RESULTS' && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-amber-950 dark:text-amber-100">
                  Grade {currentGrade} Academic Evaluations Pending
                </h4>
                <p className="mt-0.5 leading-relaxed text-amber-800 dark:text-amber-300">
                  Your Grade {currentGrade} final assessment marks have not yet been recorded by your teachers. Grade {targetGrade} enrollment will unlock once your grades are published.
                </p>
              </div>
            </div>
          )}

          {/* Stored Subjects Table */}
          {currentEval?.subjects && currentEval.subjects.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2 px-3">Grade {currentGrade} Subject</th>
                    <th className="py-2 px-3">Continuous Assessment</th>
                    <th className="py-2 px-3">Final Exam</th>
                    <th className="py-2 px-3">Total Score</th>
                    <th className="py-2 px-3">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {currentEval.subjects.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {s.subject_name}
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                        {(parseFloat(s.quiz_score || 0) + parseFloat(s.midterm_score || 0) + parseFloat(s.assignment_score || 0)).toFixed(1)} / 60
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                        {s.final_score ? `${parseFloat(s.final_score).toFixed(1)} / 40` : '-'}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                        {s.total_score ? `${parseFloat(s.total_score).toFixed(1)}%` : '-'}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            s.letter_grade === 'F'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          }`}
                        >
                          {s.letter_grade || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASE C: NEW APPLICANT ENTERING GRADE 9 (GRADE 8 DOCUMENTS) */}
      {/* ========================================================================= */}
      {!currentGrade && (
        <>
          {(user?.student?.document_status === 'APPROVED' || user?.student?.prerequisite_verified) && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 text-xs flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                  Grade 8 Prerequisite &amp; Document Approved!
                </h4>
                <p className="mt-0.5 leading-relaxed text-emerald-800 dark:text-emerald-300">
                  Your official credentials have been approved by School Administration. Please select an available Grade 9 section below to complete your admission enrollment.
                </p>
              </div>
            </div>
          )}

          {user?.student?.document_status === 'PENDING_ADMIN_VERIFICATION' && !user?.student?.prerequisite_verified && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-amber-950 dark:text-amber-100">
                  Grade 8 Official Document: Awaiting Administrative Review
                </h4>
                <p className="mt-0.5 leading-relaxed text-amber-800 dark:text-amber-300">
                  Your Grade 8 certificate was successfully submitted and is under review by School Administration. Section selection will unlock once approved.
                </p>
              </div>
            </div>
          )}

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Grade 8 Ministry Prerequisite Record
                </h3>
              </div>
              <Badge variant={prereq?.eligible ? 'success' : 'danger'}>
                {prereq?.eligible ? 'VERIFIED PASSED' : 'UNFULFILLED'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{prereq?.message}</p>
            {prereq?.record && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                <div>
                  <span className="text-slate-400 block">Primary School</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{prereq.record.previous_school}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Year Completed</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{prereq.record.completion_year}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Ministry Score</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{prereq.record.total_score} pts</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Average GPA</span>
                  <span className="font-bold text-emerald-600">{prereq.record.average_score}%</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* STREAM SELECTION MODULE (SPECIFICALLY FOR GRADE 10 -> GRADE 11 PROGRESSION) */}
      {/* ========================================================================= */}
      {isGrade10To11Progression && currentEval?.eligible && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Compass className="w-5 h-5 text-indigo-600" />
              <span>Step 1: Choose Your Academic Specialization Stream</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              High school bifurcates in Grade 11. Select between <strong>Natural Science</strong> or <strong>Social Science</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Natural Science Stream Card */}
            <div
              onClick={() => {
                setTargetStreamId(2);
                setSelectedSectionId(null);
              }}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative ${
                targetStreamId === 2
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20 shadow-md'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {targetStreamId === 2 && (
                <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                  <Check className="w-4 h-4" />
                </span>
              )}

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                    <FlaskConical className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                      Natural Science Stream
                    </h4>
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                      STEM &amp; Health Sciences Focus
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
                  Prepares students for university degrees in Medicine, Health Sciences, Computer Science, Engineering, Architecture, and Natural Sciences.
                </p>

                <div className="mt-3 pt-2.5 border-t border-indigo-100 dark:border-indigo-900/40 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                  <p>
                    <strong className="text-slate-700 dark:text-slate-300">Core Subjects:</strong> Physics, Chemistry, Biology, Advanced Math, Technical Drawing.
                  </p>
                  <p>
                    <strong className="text-slate-700 dark:text-slate-300">Recommended GPA:</strong> 70.0% or above in Grade 10.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTargetStreamId(2);
                    setSelectedSectionId(null);
                  }}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-colors ${
                    targetStreamId === 2
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {targetStreamId === 2 ? 'Selected Stream' : 'Select Natural Science'}
                </button>
              </div>
            </div>

            {/* Social Science Stream Card */}
            <div
              onClick={() => {
                setTargetStreamId(3);
                setSelectedSectionId(null);
              }}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative ${
                targetStreamId === 3
                  ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 ring-2 ring-purple-500/20 shadow-md'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {targetStreamId === 3 && (
                <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">
                  <Check className="w-4 h-4" />
                </span>
              )}

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                      Social Science Stream
                    </h4>
                    <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                      Humanities &amp; Business Focus
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
                  Prepares students for university degrees in Law, Economics, Business Administration, Accounting, Journalism, International Relations, and Social Sciences.
                </p>

                <div className="mt-3 pt-2.5 border-t border-purple-100 dark:border-purple-900/40 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                  <p>
                    <strong className="text-slate-700 dark:text-slate-300">Core Subjects:</strong> Economics, Geography, History, Civics, Business Studies, Math.
                  </p>
                  <p>
                    <strong className="text-slate-700 dark:text-slate-300">Recommended GPA:</strong> 65.0% or above in Grade 10.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTargetStreamId(3);
                    setSelectedSectionId(null);
                  }}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-colors ${
                    targetStreamId === 3
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {targetStreamId === 3 ? 'Selected Stream' : 'Select Social Science'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION SELECTION & SAVING WORKFLOW (FOR ACTIVE PROGRESSION) */}
      {/* ========================================================================= */}
      {!isSeniorEnrolled && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {isGrade10To11Progression ? 'Step 2: ' : ''}Select Section for Grade {targetGrade}
                {targetGrade >= 11 && (
                  <span className="ml-2 font-normal text-xs text-primary-600 dark:text-primary-400">
                    ({targetStreamId === 2 ? 'Natural Science' : 'Social Science'} Stream)
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Sections accommodate up to 50 students. Full sections are strictly locked.
              </p>
            </div>
            <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
              {sections.length} section{sections.length === 1 ? '' : 's'} available
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sections.length === 0 ? (
              <div className="col-span-2 py-8 text-center text-slate-400 text-xs">
                No active sections found for Grade {targetGrade}{' '}
                {targetGrade >= 11 ? `in ${targetStreamId === 2 ? 'Natural Science' : 'Social Science'} Stream` : ''}. Please contact the administrator.
              </div>
            ) : (
              sections.map((sec) => {
                const isFull = sec.is_full || sec.remaining_seats <= 0;
                const isSelected = selectedSectionId === sec.id;

                return (
                  <button
                    key={sec.id}
                    type="button"
                    disabled={isFull}
                    onClick={() => setSelectedSectionId(sec.id)}
                    className={`p-4 rounded-xl border text-left transition-all relative ${
                      isFull
                        ? 'opacity-60 bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                        : isSelected
                        ? 'border-primary-600 dark:border-primary-500 bg-primary-50/50 dark:bg-primary-950/40 ring-2 ring-primary-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-slate-900 dark:text-slate-100">
                          Section {sec.section_name}
                        </span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center text-[10px]">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      {isFull ? (
                        <Badge variant="danger" size="sm">
                          FULL (50/50)
                        </Badge>
                      ) : (
                        <Badge variant="success" size="sm">
                          {sec.remaining_seats} Seats Available
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-xs text-slate-500">
                      <div className="flex justify-between">
                        <span>Capacity: {sec.enrolled_count} / {sec.capacity} seats</span>
                        <span>{Math.round((sec.enrolled_count / sec.capacity) * 100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isFull ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min((sec.enrolled_count / sec.capacity) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Save Selection Action */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {selectedSectionId ? (
                <span>
                  Selected section:{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    Grade {targetGrade} • Section {sections.find((s) => s.id === selectedSectionId)?.section_name}{' '}
                    {targetGrade >= 11 ? `(${targetStreamId === 2 ? 'Natural Science' : 'Social Science'})` : ''}
                  </strong>
                </span>
              ) : (
                <span>Please choose a section from the options above.</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleEnroll}
              disabled={
                !selectedSectionId ||
                enrolling ||
                (currentGrade && currentEval && !currentEval.eligible) ||
                (!currentGrade && user?.student?.document_status === 'PENDING_ADMIN_VERIFICATION' && !user?.student?.prerequisite_verified)
              }
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold shadow-md shadow-primary-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enrolling ? (
                <span>Saving &amp; Validating Progression...</span>
              ) : isGrade11To12Progression ? (
                <>
                  <Save className="w-4 h-4" />
                  <span>Confirm Grade 12 Senior Enrollment</span>
                </>
              ) : isGrade10To11Progression ? (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Selection &amp; Proceed to Grade 11</span>
                </>
              ) : isGrade9To10Progression ? (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Selection &amp; Proceed to Grade 10</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  <span>Confirm Official Enrollment</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrollmentPage;
