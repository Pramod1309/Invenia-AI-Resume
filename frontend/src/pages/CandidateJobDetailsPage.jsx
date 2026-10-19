import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  MapPinIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { authAPI, buildFileUrl, candidateAPI } from '../services/api';
import { JobIdChip, PageSkeleton, ProfileAvatar, ScoreHelp, ScoreGlossary } from '../components/UXKit';

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/\n|,|•|-/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const formatSalary = (salary) => {
  if (!salary || salary === 'Not disclosed') return 'Not disclosed';
  return salary;
};

function DetailList({ title, items, empty }) {
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
        )) : <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{empty}</p>}
        </div>
      </div>
    </section>
  );
}

export default function CandidateJobDetailsPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showScoreGlossary, setShowScoreGlossary] = useState(false);

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
        const [jobData, viewData] = await Promise.all([
          candidateAPI.getJob(jobId),
          candidateAPI.trackJobView(jobId).catch(() => null),
        ]);
        setJob({
          ...jobData.job,
          views: viewData?.views ?? jobData.job?.views ?? 0,
        });
      } catch (requestError) {
        setError(requestError.response?.data?.detail || 'Unable to load job details');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [jobId, navigate]);

  if (loading) {
    return <PageSkeleton label="Loading job details" />;
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <button type="button" onClick={() => navigate('/dashboard/candidate?tab=jobs')} className="rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white">
          Back to jobs
        </button>
        <div className="mt-8 rounded-[28px] border border-rose-100 bg-white p-8 text-rose-700">{error || 'Job not found'}</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-white">
      <section className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <button type="button" onClick={() => navigate('/dashboard/candidate?tab=jobs')} className="inline-flex items-center gap-2 rounded-2xl border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to jobs
        </button>

        <div className="mt-6 overflow-hidden rounded-[36px] bg-[#04193b] text-white shadow-[0_24px_70px_rgba(4,25,59,0.22)]">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.35fr,0.65fr] lg:p-10">
            <div>
              <div className="flex items-center gap-3"><ProfileAvatar src={buildFileUrl(job.recruiterPhotoUrl)} name={job.company || 'Recruiter'} className="h-11 w-11 border-2 border-white/20" /><p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-200">{job.company || 'Invenia AI'}</p></div>
              <JobIdChip value={job.publicJobId} className="mt-3 border-white/20 bg-white/10 text-blue-50 hover:bg-white/20" />
              <h1 className="mt-3 text-4xl font-semibold leading-tight lg:text-5xl">{job.title}</h1>
              <p className="mt-5 max-w-4xl whitespace-pre-line text-base leading-8 text-blue-50/90">{job.description || 'No description added.'}</p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-blue-50">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2"><MapPinIcon className="h-4 w-4" />{job.location}</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2"><BriefcaseIcon className="h-4 w-4" />{job.type}</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2"><CalendarDaysIcon className="h-4 w-4" />Posted {job.postedDate ? new Date(job.postedDate).toLocaleDateString() : 'recently'}</span>
              </div>
            </div>
            <aside className="rounded-[30px] border border-white/10 bg-white/10 p-6 backdrop-blur">
              <p className="text-sm uppercase tracking-[0.2em] text-blue-100">Application status</p>
              <p className="mt-3 text-3xl font-semibold">{!job.isActive ? 'Closed' : job.isApplied ? 'Applied' : 'Open'}</p>
              <p className="mt-3 text-sm leading-6 text-blue-50/90">
                {!job.isActive ? job.availabilityMessage : job.isApplied ? 'Your application is already submitted. Track next steps from My applications.' : 'Review the details and submit your CV for recruiter screening.'}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/12 p-4">
                  <p className="text-xs text-blue-100">Views</p>
                  <p className="mt-1 text-2xl font-semibold">{job.views || 0}</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-4">
                  <p className="text-xs text-blue-100">Applicants</p>
                  <p className="mt-1 text-2xl font-semibold">{job.applicants || 0}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={job.isApplied || !job.isActive}
                onClick={() => navigate(`/dashboard/candidate/jobs/${job.id}/apply`)}
                className="mt-6 w-full rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:bg-slate-400"
              >
                {!job.isActive ? 'Applications closed' : job.isApplied ? 'Applied' : 'Apply Now'}
              </button>
            </aside>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {[
            ['Salary', formatSalary(job.salary)],
            ['Experience', job.experienceLevel || 'NA'],
            ['Salary Period', job.salaryPeriod || 'NA'],
            ['Remote', job.isRemote ? 'Yes' : 'No'],
            ['Profile match for this job', `${job.matchScore || 0}%`],
            ['Job Type', job.type || 'NA'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[24px] border border-blue-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <DetailList title="Requirements" items={job.requirements || job.skills} empty="No requirements added." />
          <DetailList title="Responsibilities" items={job.responsibilities} empty="No responsibilities added." />
          <DetailList title="Benefits" items={job.benefits} empty="No benefits added." />
          <section className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_14px_38px_rgba(37,99,235,0.07)]">
            <div className="flex items-center gap-2 text-blue-700">
              <SparklesIcon className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Invenia AI Analysis</h2>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              This score is only a quick profile indicator. A detailed CV-to-job screening score is generated when you submit the application.
            </p>
            <div className="mt-5 h-3 rounded-full bg-blue-100">
              <div className="h-3 rounded-full bg-blue-700" style={{ width: `${Math.min(100, Math.max(0, job.matchScore || 0))}%` }} />
            </div>
            <div className="mt-4"><ScoreHelp onClick={() => setShowScoreGlossary(true)} /></div>
          </section>
        </div>
      </section>
      <ScoreGlossary open={showScoreGlossary} onClose={() => setShowScoreGlossary(false)} />
    </main>
  );
}
