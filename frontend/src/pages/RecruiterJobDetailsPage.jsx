import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { authAPI, buildFileUrl, downloadBlobResponse, openBlobResponse, openPreparedPreviewWindow, recruiterAPI } from '../services/api';
import { ConfirmDialog, JobIdChip, PageSkeleton, ProfileAvatar, ScoreGlossary, ScoreHelp } from '../components/UXKit';
import ActionNoticeModal from '../components/ActionNoticeModal';

const normalizeList = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(/\n|,|•|-/)
    .map((item) => item.trim())
    .filter(Boolean);
};

function StatusBadge({ status }) {
  const styles = {
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
    pending: 'bg-amber-100 text-amber-700',
    reviewed: 'bg-blue-100 text-blue-700',
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status] || 'bg-slate-100 text-slate-700'}`}>{status || 'pending'}</span>;
}

function DetailList({ title, items }) {
  const normalized = normalizeList(items);
  return (
    <section className="rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_14px_38px_rgba(37,99,235,0.07)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          {normalized.length || 0} points
        </span>
      </div>
      <div className="mt-4 max-h-72 overflow-y-auto pr-2">
        <div className="grid gap-2 sm:grid-cols-2">
        {normalized.length > 0 ? normalized.map((item) => (
          <div key={item} className="flex gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
            <CheckCircleIcon className="mt-1 h-4 w-4 flex-none text-emerald-500" />
            <span>{item}</span>
          </div>
        )) : <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">NA</p>}
        </div>
      </div>
    </section>
  );
}

function CandidateResultAnalysis({ candidate }) {
  const analysis = candidate.decisionAnalysis || {};
  const jobAts = candidate.jobAts || {};
  const strongSignals = analysis.strongSignals || jobAts.strengths || [];
  const validationPoints = analysis.validationPoints || jobAts.gaps || [];
  const interview = analysis.interviewAnalysis || {};

  return (
    <article id={`candidate-analysis-${candidate.applicationId}`} className="scroll-mt-6 rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_14px_38px_rgba(37,99,235,0.07)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <ProfileAvatar src={buildFileUrl(candidate.candidatePhotoUrl)} name={candidate.candidateName} className="h-14 w-14" />
          <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Invenia AI Analysis</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">{candidate.candidateName}</h3>
          <p className="mt-1 text-sm text-slate-500">{analysis.decisionBand || candidate.recruiterDecision || 'Evidence review'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">CV evidence match {candidate.jobAtsScore || 0}%</span>
          <span className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Overall assessment {candidate.finalScore == null ? 'Awaiting assessment' : `${candidate.finalScore}%`}</span>
          <span className="rounded-xl bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800">Confidence {analysis.decisionConfidence ?? 0}%</span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-700">{analysis.executiveSummary || jobAts.summary || 'Candidate analysis is pending.'}</p>
      <p className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-blue-950">
        Recommendation: {analysis.recommendation || jobAts.recommendation || 'Review submitted evidence before making a decision.'}
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-emerald-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Strong signals</p>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            {strongSignals.length > 0 ? strongSignals.map((item, index) => <p key={`strong-${index}`}>- {item}</p>) : <p>- No validated strong signal is available yet.</p>}
          </div>
        </div>
        <div className="rounded-2xl bg-amber-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Validation points</p>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            {validationPoints.length > 0 ? validationPoints.map((item, index) => <p key={`validation-${index}`}>- {item}</p>) : <p>- No material validation gap was detected.</p>}
          </div>
        </div>
      </div>

      {(analysis.stageAnalysis || []).length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Stage-by-stage result</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {analysis.stageAnalysis.map((stage) => (
              <div key={stage.key} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex justify-between gap-2 text-sm"><span className="font-semibold text-slate-900">{stage.label}</span><span className="font-semibold text-blue-800">{stage.score == null ? stage.status : `${stage.score}%`}</span></div>
                <p className="mt-2 text-xs leading-5 text-slate-600">{stage.insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(analysis.requirementEvidence || []).length > 0 && (
        <details className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Requirement-by-requirement CV evidence</summary>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {analysis.requirementEvidence.map((item, index) => (
              <div key={`evidence-${index}`} className="rounded-2xl bg-white p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{item.item}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.status === 'matched' ? 'bg-emerald-100 text-emerald-700' : item.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{item.status}</span>
                </div>
                {item.evidence_quote && <p className="mt-2 leading-6 text-slate-700">Evidence: "{item.evidence_quote}"</p>}
                <p className="mt-2 text-xs leading-5 text-slate-500">{item.rationale || 'Evidence classification recorded by Invenia AI Analysis.'}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {(interview.score != null || (interview.questionAnalysis || []).length > 0) && (
        <details className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-emerald-900">Invenia AI Analysis: Interview result</summary>
          {interview.isProvisional && (
            <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <p className="font-bold">Provisional result: human review required</p>
              <p className="mt-1">This fallback checks answer completeness only. It does not validate technical correctness, job relevance, or candidate claims.</p>
            </div>
          )}
          <p className="mt-3 text-sm leading-6 text-slate-700">{interview.summary || 'Interview report pending.'}</p>
          {(interview.competencyScores || []).length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {interview.competencyScores.map((item, index) => (
                <div key={`${item.competency}-${index}`} className="rounded-2xl bg-white p-4 text-sm">
                  <div className="flex justify-between gap-3"><span className="font-semibold text-slate-900">{item.competency}</span><span className="font-semibold text-emerald-700">{item.score}%</span></div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{item.evidence || 'No supporting note supplied.'}</p>
                </div>
              ))}
            </div>
          )}
          {(interview.questionAnalysis || []).map((item, index) => (
            <div key={`question-${index}`} className="mt-3 rounded-2xl bg-white p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-slate-900">Q{index + 1}: {item.question}</p><span className="font-semibold text-emerald-700">{item.score ?? 0}%</span></div>
              <p className="mt-2 leading-6 text-slate-700">{item.notes || 'No detailed note available.'}</p>
              {item.evidence && <p className="mt-2 text-xs leading-5 text-slate-500">Evidence: {item.evidence}</p>}
            </div>
          ))}
        </details>
      )}

      {(analysis.scoreRationale || []).length > 0 && (
        <details className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Score calculation and limiting factors</summary>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            {analysis.scoreRationale.map((item, index) => <p key={`rationale-${index}`}>- {item}</p>)}
          </div>
        </details>
      )}
    </article>
  );
}

export default function RecruiterJobDetailsPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [jobReport, setJobReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState({ applicationId: null, status: '' });
  const [error, setError] = useState('');
  const [showScoreGlossary, setShowScoreGlossary] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const user = await authAPI.getCurrentUser();
      if (user.role !== 'recruiter') {
        navigate(user.role === 'candidate' ? '/dashboard/candidate' : '/');
        return;
      }
      const [jobData, analyticsData] = await Promise.all([
        recruiterAPI.getJob(jobId),
        recruiterAPI.getAnalytics('all').catch(() => ({ jobAnalysis: [] })),
      ]);
      setJob(jobData.job);
      setJobReport(jobData.jobAnalysis || (analyticsData.jobAnalysis || []).find((item) => Number(item.jobId) === Number(jobId)) || null);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to load job details');
    } finally {
      setLoading(false);
    }
  }, [jobId, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenResume = async (candidate) => {
    const previewWindow = openPreparedPreviewWindow('Candidate CV preview');
    try {
      const response = await recruiterAPI.getApplicationResume(candidate.applicationId);
      openBlobResponse(response, previewWindow);
    } catch (requestError) {
      previewWindow?.close?.();
      window.alert(requestError.response?.data?.detail || 'Unable to open CV');
    }
  };

  const handleDecision = async (candidate, status) => {
    if (!candidate?.applicationId || ['approved', 'rejected'].includes(candidate.status)) return;
    setConfirmation({ title: status === 'approved' ? 'Approve candidate?' : 'Reject candidate?', message: `${candidate.candidateName || 'This candidate'} will be ${status}. This decision cannot be reversed.`, confirmLabel: status === 'approved' ? 'Approve candidate' : 'Reject candidate', danger: status === 'rejected', action: () => executeDecision(candidate, status) });
  };

  const executeDecision = async (candidate, status) => {
    setConfirmation(null);
    setAction({ applicationId: candidate.applicationId, status });
    try {
      await recruiterAPI.updateApplicationStatus(candidate.applicationId, status);
      await load();
      setNotice({ label: 'Decision sent', title: `Candidate ${status}`, message: `${candidate.candidateName || 'Candidate'} was ${status} successfully. The candidate will see this decision and it cannot be reversed.`, tone: status === 'approved' ? 'green' : 'rose' });
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to update application');
    } finally {
      setAction({ applicationId: null, status: '' });
    }
  };

  const handleExport = async () => {
    const response = await recruiterAPI.downloadExport('applications');
    downloadBlobResponse(response, 'invenia-applications.csv');
  };

  if (loading) {
    return <PageSkeleton label="Loading recruiter job details" />;
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <button type="button" onClick={() => navigate('/dashboard/recruiter?tab=jobs')} className="rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white">Back to jobs</button>
        <div className="mt-8 rounded-[28px] border border-rose-100 bg-white p-8 text-rose-700">{error || 'Job not found'}</div>
      </div>
    );
  }

  const candidates = jobReport?.candidateComparison || [];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-white">
      <section className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => navigate('/dashboard/recruiter?tab=jobs')} className="inline-flex items-center gap-2 rounded-2xl border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to recruiter jobs
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleExport} className="inline-flex items-center gap-2 rounded-2xl border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export applications
            </button>
            <button type="button" onClick={() => navigate(`/dashboard/recruiter/jobs/${job.id}/edit`)} className="inline-flex items-center gap-2 rounded-2xl bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              <PencilSquareIcon className="h-4 w-4" />
              Edit job
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-[36px] bg-[#04193b] p-8 text-white shadow-[0_24px_70px_rgba(4,25,59,0.22)] lg:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-200">Full job page</p>
          <JobIdChip value={job.publicJobId} className="mt-3 border-white/20 bg-white/10 text-blue-50 hover:bg-white/20" />
          <h1 className="mt-3 text-4xl font-semibold leading-tight lg:text-5xl">{job.title}</h1>
          <p className="mt-5 max-w-5xl text-base leading-8 text-blue-50/90">{job.description || 'No description added.'}</p>
          <div className="mt-6 grid gap-3 md:grid-cols-5">
            {[
              ['Views', job.views || 0],
              ['Applied', job.appliedCount || job.applications || 0],
              ['Avg ATS', `${jobReport?.avgJobAtsScore || 0}%`],
              ['Salary', job.salary || 'NA'],
              ['Status', job.status || 'active'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-blue-100">{label}</p>
                <p className="mt-2 text-lg font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4"><ScoreHelp label="Understand ATS and final scores" onClick={() => setShowScoreGlossary(true)} /></div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <DetailList title="Requirements" items={job.requirementsText || job.requirements || job.skills} />
          <DetailList title="Responsibilities" items={job.responsibilities} />
          <DetailList title="Benefits" items={job.benefits} />
          <section className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_14px_38px_rgba(37,99,235,0.07)]">
            <h2 className="text-lg font-semibold text-slate-900">Assessment configuration</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {['aptitude', 'technical', 'coding', 'interview'].map((stage) => {
                const config = job.assessmentConfig?.[stage] || {};
                return (
                  <div key={stage} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold capitalize text-slate-900">{stage}</p>
                    <p className="mt-1 text-xs text-slate-500">{stage === 'interview' ? 'Mandatory' : config.enabled === false ? 'Not needed' : config.required ? 'Compulsory' : 'Optional'}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-[32px] border border-blue-100 bg-white p-6 shadow-[0_14px_38px_rgba(37,99,235,0.07)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Applied candidate analysis</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">{jobReport?.fitSummary || 'Candidate analysis will appear when applications are submitted.'}</p>
            </div>
            <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">{candidates.length} candidates</span>
          </div>
          <div className="mt-6 grid gap-4 md:hidden">
            {candidates.length > 0 ? candidates.map((candidate) => {
              const finalDecision = ['approved', 'rejected'].includes(candidate.status);
              return <article key={candidate.applicationId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><ProfileAvatar src={buildFileUrl(candidate.candidatePhotoUrl)} name={candidate.candidateName} className="h-11 w-11" /><div><p className="font-semibold text-slate-950">{candidate.candidateName}</p><p className="mt-1 text-xs text-slate-500">{candidate.candidateEmail}</p></div></div><StatusBadge status={candidate.status} /></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white p-3 text-sm"><span className="text-slate-500">CV evidence match</span><p className="font-semibold text-blue-800">{candidate.jobAtsScore || 0}%</p></div><div className="rounded-xl bg-white p-3 text-sm"><span className="text-slate-500">Overall assessment</span><p className="font-semibold text-emerald-800">{candidate.finalScore == null ? 'Awaiting' : `${candidate.finalScore}%`}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{candidate.resumeUrl && <button type="button" onClick={() => handleOpenResume(candidate)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold">Open CV</button>}<button type="button" onClick={() => document.getElementById(`candidate-analysis-${candidate.applicationId}`)?.scrollIntoView({ behavior: 'smooth' })} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Analysis</button><button type="button" disabled={finalDecision || action.applicationId === candidate.applicationId} onClick={() => handleDecision(candidate, 'approved')} className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:bg-slate-300">Approve</button><button type="button" disabled={finalDecision || action.applicationId === candidate.applicationId} onClick={() => handleDecision(candidate, 'rejected')} className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 disabled:text-slate-400">Reject</button></div></article>;
            }) : <p className="py-8 text-center text-sm text-slate-500">No candidates have applied yet.</p>}
          </div>
          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">CV evidence match</th>
                  <th className="px-4 py-3">Overall assessment</th>
                  <th className="px-4 py-3">Invenia AI Analysis</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length > 0 ? candidates.map((candidate) => {
                  const finalDecision = ['approved', 'rejected'].includes(candidate.status);
                  return (
                    <tr key={candidate.applicationId} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3"><ProfileAvatar src={buildFileUrl(candidate.candidatePhotoUrl)} name={candidate.candidateName} className="h-10 w-10" /><div><p className="font-semibold text-slate-900">{candidate.candidateName}</p><p className="text-xs text-slate-500">{candidate.candidateEmail}</p></div></div>
                      </td>
                      <td className="px-4 py-4"><StatusBadge status={candidate.status} /></td>
                      <td className="px-4 py-4 font-semibold text-blue-700">{candidate.jobAtsScore || 0}%</td>
                      <td className="px-4 py-4 font-semibold text-emerald-700">{candidate.finalScore == null ? 'Awaiting' : `${candidate.finalScore}%`}</td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => document.getElementById(`candidate-analysis-${candidate.applicationId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                          className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                        >
                          See detailed analysis
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {candidate.resumeUrl && (
                            <button type="button" onClick={() => handleOpenResume(candidate)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">CV</button>
                          )}
                          <button
                            type="button"
                            disabled={finalDecision || action.applicationId === candidate.applicationId}
                            onClick={() => handleDecision(candidate, 'approved')}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:bg-slate-300"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            {candidate.status === 'approved' ? 'Approved' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            disabled={finalDecision || action.applicationId === candidate.applicationId}
                            onClick={() => handleDecision(candidate, 'rejected')}
                            className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <XCircleIcon className="h-4 w-4" />
                            {candidate.status === 'rejected' ? 'Rejected' : 'Reject'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-10 text-center text-slate-500">No candidates have applied yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {candidates.length > 0 && (
            <div className="mt-10 border-t border-blue-100 pt-8">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Invenia AI Analysis</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Candidate decision reports for this job</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">Each report combines CV evidence, Job ATS components, enabled assessments, interview answers, and progress status.</p>
              </div>
              <div className="space-y-5">
                {candidates.map((candidate) => <CandidateResultAnalysis key={candidate.applicationId} candidate={candidate} />)}
              </div>
            </div>
          )}
        </section>
      </section>
      <ScoreGlossary open={showScoreGlossary} onClose={() => setShowScoreGlossary(false)} />
      <ConfirmDialog confirmation={confirmation} onCancel={() => setConfirmation(null)} onConfirm={() => confirmation?.action?.()} />
      <ActionNoticeModal notice={notice} onClose={() => setNotice(null)} />
    </main>
  );
}
