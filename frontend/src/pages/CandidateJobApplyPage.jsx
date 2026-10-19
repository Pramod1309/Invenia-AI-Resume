import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  DocumentMagnifyingGlassIcon,
  LockClosedIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { authAPI, buildFileUrl, candidateAPI } from '../services/api';
import ActionNoticeModal from '../components/ActionNoticeModal';
import { JobIdChip, ProfileAvatar } from '../components/UXKit';

function ResultModal({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <div className="relative w-full max-w-lg rounded-[32px] border border-blue-100 bg-white p-7 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 rounded-full border border-slate-200 p-2 text-slate-500">
          <XMarkIcon className="h-5 w-5" />
        </button>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${notice.tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {notice.label}
        </span>
        <h2 className="mt-4 text-2xl font-semibold text-slate-900">{notice.title}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{notice.message}</p>
        <button type="button" onClick={onClose} className="mt-6 w-full rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white">
          Back to jobs
        </button>
      </div>
    </div>
  );
}

export default function CandidateJobApplyPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [profile, setProfile] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scanPhase, setScanPhase] = useState('loading');
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const user = await authAPI.getCurrentUser();
        if (user.role !== 'candidate') {
          navigate(user.role === 'recruiter' ? '/dashboard/recruiter' : '/');
          return;
        }
        const [jobData, profileData] = await Promise.all([
          candidateAPI.getJob(jobId),
          candidateAPI.getProfile(),
        ]);
        setJob(jobData.job);
        setProfile(profileData.profile);
        setScanPhase('comparing');
        const workflowData = await candidateAPI.getJobWorkflowPreview(jobId);
        setWorkflow(workflowData.workflow);
        setScanPhase('complete');
      } catch (requestError) {
        setError(requestError.response?.data?.detail || 'Unable to prepare application');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [jobId, navigate]);

  const scanProgress = scanPhase === 'complete' ? 100 : scanPhase === 'comparing' ? 66 : 33;

  const jobAts = workflow?.jobAts || {};
  const scanSteps = [
    {
      title: 'CV and job profile loaded',
      text: profile?.resumeName || profile?.resume_url ? 'Your uploaded CV is ready for job-specific screening.' : 'Upload your CV before submitting this application.',
      complete: Boolean(profile?.resumeName || profile?.resume_url || resumeFile),
    },
    {
      title: 'Requirements compared',
      text: jobAts.summary || 'System is comparing your CV against role requirements, skills, and experience needs.',
      complete: scanProgress >= 70,
    },
    {
      title: 'Screening score prepared',
      text: jobAts.recommendation || 'Recruiter will receive the score and matched/missing requirements after submission.',
      complete: scanProgress >= 100,
    },
  ];

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!job || submitting) return;
    setSubmitting(true);
    try {
      if (resumeFile) {
        const uploadResult = await candidateAPI.uploadResume(resumeFile);
        setProfile(uploadResult.profile);
      }
      const response = await candidateAPI.applyToJob(job.id, coverLetter);
      if (response.already_applied) {
        setNotice({
          tone: response.status === 'revoked' ? 'amber' : 'amber',
          label: response.status === 'revoked' ? 'Application revoked' : 'Already applied',
          title: response.status === 'revoked' ? 'You cannot apply again for this job' : 'Application already submitted',
          message: response.status === 'revoked'
            ? 'This application was revoked earlier. Re-applying to the same job is disabled.'
            : 'No duplicate entry was created. You can track this job from the Applied tab.',
        });
        return;
      }
      setNotice({
        tone: 'green',
        label: 'Application sent',
        title: 'Application sent to recruiter',
        message: 'Your CV and job-specific screening report were sent to the recruiter for verification. Please wait for approval before starting the next round.',
      });
      window.setTimeout(() => navigate('/dashboard/candidate?tab=jobs'), 1800);
    } catch (requestError) {
      setNotice({ tone: 'amber', label: 'Submission issue', title: 'Application could not be submitted', message: requestError.response?.data?.detail || 'Unable to submit application. Please check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    const loadingMessage = scanPhase === 'loading'
      ? 'Loading your CV and the selected job profile'
      : scanPhase === 'comparing'
        ? 'Comparing requirements, skills, tools, and experience evidence'
        : 'Validating evidence and calculating the job-specific score';
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-white via-blue-50 to-slate-100 p-5">
        <section className="w-full max-w-2xl rounded-[36px] border border-blue-100 bg-white p-8 shadow-[0_24px_70px_rgba(15,42,74,0.15)]">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-950 text-white">
              <DocumentMagnifyingGlassIcon className="h-8 w-8" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Job-specific CV screening</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">Your CV is being analysed</h1>
            </div>
          </div>
          <p className="mt-7 text-sm leading-7 text-slate-600">{loadingMessage}. Please keep this page open while the system completes evidence validation.</p>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-blue-100">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-800 to-emerald-500 transition-all duration-500" style={{ width: `${scanProgress}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm font-semibold">
            <span className="text-slate-500">Current screening phase</span>
            <span className="text-blue-900">{scanPhase === 'loading' ? '1 of 3' : scanPhase === 'comparing' ? '2 of 3' : '3 of 3'}</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['CV loaded', 35],
              ['Evidence compared', 70],
              ['Score validated', 93],
            ].map(([label, threshold]) => (
              <div key={label} className={`rounded-2xl border p-4 text-xs font-semibold ${scanProgress >= threshold ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                {scanProgress >= threshold ? 'Complete' : scanProgress + 34 >= threshold ? 'Processing' : 'Waiting'}: {label}
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <button type="button" onClick={() => navigate('/dashboard/candidate?tab=jobs')} className="rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white">Back to jobs</button>
        <div className="mt-8 rounded-[28px] border border-rose-100 bg-white p-8 text-rose-700">{error || 'Job not found'}</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-slate-100">
      <ActionNoticeModal notice={notice} onClose={() => notice?.tone === 'green' ? navigate('/dashboard/candidate?tab=jobs') : setNotice(null)} />
      <section className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <button type="button" onClick={() => navigate(`/dashboard/candidate/jobs/${job.id}`)} className="inline-flex items-center gap-2 rounded-2xl border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to job details
        </button>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr,1.15fr]">
          <aside className="rounded-[36px] bg-[#04193b] p-7 text-white shadow-[0_24px_70px_rgba(4,25,59,0.22)]">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-200">Normal application window</p>
            <JobIdChip value={job.publicJobId} className="mt-3 border-white/20 bg-white/10 text-blue-50 hover:bg-white/20" />
            <h1 className="mt-3 text-3xl font-semibold">{job.title}</h1>
            <div className="mt-3 flex items-center gap-3 text-sm leading-7 text-blue-50/90"><ProfileAvatar src={buildFileUrl(job.recruiterPhotoUrl)} name={job.company || 'Recruiter'} className="h-9 w-9 border-2 border-white/20" />{job.company || 'Invenia AI'} | {job.location}</div>
            <div className="mt-7 rounded-[28px] bg-white/10 p-5">
              <div className="flex items-center gap-3">
                <DocumentMagnifyingGlassIcon className="h-8 w-8 text-emerald-300" />
                <div>
                  <p className="text-sm font-semibold">CV screening progress</p>
                  <p className="text-xs text-blue-100">System is checking job requirement alignment.</p>
                </div>
              </div>
              <div className="mt-5 h-3 rounded-full bg-white/15">
                <div className="h-3 rounded-full bg-emerald-400 transition-all" style={{ width: `${scanProgress}%` }} />
              </div>
              <p className="mt-2 text-right text-sm font-semibold">{scanProgress}%</p>
            </div>
            <div className="mt-5 space-y-3">
              {scanSteps.map((step) => (
                <div key={step.title} className="rounded-2xl bg-white/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {step.complete ? <CheckCircleIcon className="h-5 w-5 text-emerald-300" /> : <LockClosedIcon className="h-5 w-5 text-blue-200" />}
                    {step.title}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-blue-50/85">{step.text}</p>
                </div>
              ))}
            </div>
          </aside>

          <form onSubmit={handleSubmit} className="rounded-[36px] border border-blue-100 bg-white p-7 shadow-[0_16px_45px_rgba(37,99,235,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">Application submission</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Submit profile for recruiter verification</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">Tests and interview are locked until the recruiter approves your screening round.</p>
              </div>
              <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">CV evidence match {jobAts.score ?? workflow?.matchScore ?? job.matchScore ?? 0}%</span>
            </div>

            <details className="mt-7 rounded-[26px] border border-blue-100 bg-blue-50/40 p-5">
              <summary className="cursor-pointer text-sm font-semibold text-blue-900">Why this CV evidence match?</summary>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {[
                ['Matched', jobAts.requirement_match?.matched ?? 0],
                ['Partial', jobAts.requirement_match?.partial ?? 0],
                ['Missing', jobAts.requirement_match?.missing ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            {(jobAts.calculation?.components || []).length > 0 && (
              <div className="mt-6 rounded-[26px] border border-blue-100 bg-blue-50/60 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-blue-950">Transparent job ATS calculation</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">Only job requirement evidence is scored. Grammar, layout, and CV styling are excluded.</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-blue-800">Confidence {jobAts.confidence || 'low'} {jobAts.confidence_score ?? 0}%</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {jobAts.calculation.components.map((component) => (
                    <div key={component.key} className="rounded-2xl bg-white p-4">
                      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
                        <span>{component.label}</span>
                        <span>{component.score}% x {component.weight}%</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-blue-700" style={{ width: `${component.score}%` }} />
                      </div>
                      <p className="mt-2 text-right text-xs text-slate-500">Contribution {component.contribution} points</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </details>

            <label className="mt-7 block text-sm font-semibold text-slate-700">
              Upload CV if not already uploaded
              <div className="mt-2 flex flex-col items-center justify-center rounded-[28px] border border-dashed border-blue-200 bg-blue-50/60 p-6 text-center">
                <CloudArrowUpIcon className="h-9 w-9 text-blue-700" />
                <p className="mt-2 text-sm text-slate-600">{resumeFile?.name || profile?.resumeName || profile?.resume_url || 'PDF, DOC, or DOCX supported'}</p>
                <input type="file" accept=".pdf,.doc,.docx" onChange={(event) => setResumeFile(event.target.files?.[0] || null)} className="mt-4 text-sm" />
              </div>
            </label>

            <label className="mt-6 block text-sm font-semibold text-slate-700">
              Cover letter or note to recruiter
              <textarea
                rows={6}
                value={coverLetter}
                onChange={(event) => setCoverLetter(event.target.value)}
                placeholder="Share why you are interested in this role."
                className="mt-2 w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-300"
              />
            </label>

            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate('/dashboard/candidate?tab=jobs')} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">
                Cancel
              </button>
              <button type="submit" disabled={submitting || (!profile?.resumeName && !profile?.resume_url && !resumeFile)} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-400">
                {submitting ? 'Submitting...' : 'Submit for recruiter approval'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
