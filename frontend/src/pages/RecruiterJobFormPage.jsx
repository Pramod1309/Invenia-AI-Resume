import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CloudArrowUpIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { authAPI, recruiterAPI } from '../services/api';
import { PageSkeleton } from '../components/UXKit';

const emptyJobForm = {
  title: '',
  description: '',
  location: '',
  job_type: 'Full-time',
  experience_level: '',
  salary_min: '',
  salary_max: '',
  salary_currency: '',
  salary_period: 'monthly',
  requirements: '',
  responsibilities: '',
  benefits: '',
  is_remote: false,
  aptitude_enabled: false,
  aptitude_required: false,
  technical_enabled: false,
  technical_required: false,
  coding_enabled: false,
  coding_required: false,
  interview_duration_minutes: 10,
};

const splitText = (value) =>
  String(value || '')
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const stringifyAutoValue = (value) => {
  if (Array.isArray(value)) return value.join('\n');
  if (value == null) return '';
  return String(value);
};

const buildPayload = (jobForm) => ({
  title: jobForm.title || 'NA',
  description: jobForm.description || 'NA',
  location: jobForm.location || null,
  job_type: jobForm.job_type || 'Full-time',
  experience_level: jobForm.experience_level || null,
  salary_min: jobForm.salary_min ? Number(jobForm.salary_min) : null,
  salary_max: jobForm.salary_max ? Number(jobForm.salary_max) : null,
  salary_currency: jobForm.salary_currency || null,
  salary_period: jobForm.salary_period || null,
  requirements: JSON.stringify(splitText(jobForm.requirements)),
  responsibilities: jobForm.responsibilities || null,
  benefits: jobForm.benefits || null,
  is_remote: Boolean(jobForm.is_remote),
  assessment_config: {
    aptitude: {
      enabled: Boolean(jobForm.aptitude_enabled),
      mode: 'ai',
      required: Boolean(jobForm.aptitude_required),
      cutoff: 3,
      duration_minutes: 60,
      question_count: 5,
      manual_questions_text: '',
    },
    technical: {
      enabled: Boolean(jobForm.technical_enabled),
      mode: 'ai',
      required: Boolean(jobForm.technical_required),
      cutoff: 3,
      duration_minutes: 60,
      question_count: 5,
      manual_questions_text: '',
    },
    coding: {
      enabled: Boolean(jobForm.coding_enabled),
      required: Boolean(jobForm.coding_required),
      manual_questions_text: '',
      question_count: 2,
    },
    interview: {
      duration_minutes: Number(jobForm.interview_duration_minutes) || 10,
    },
  },
});

function ToggleCard({ title, enabled, required, onEnabled, onRequired }) {
  return (
    <div className="rounded-[24px] border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-500">Choose whether this stage is needed and optional/compulsory.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={enabled} onChange={(event) => onEnabled(event.target.checked)} />
          Needed
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" disabled={!enabled} onClick={() => onRequired(false)} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${enabled && !required ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
          Optional
        </button>
        <button type="button" disabled={!enabled} onClick={() => onRequired(true)} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${enabled && required ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
          Compulsory
        </button>
      </div>
    </div>
  );
}

export default function RecruiterJobFormPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(jobId);
  const [jobForm, setJobForm] = useState(emptyJobForm);
  const [autofillText, setAutofillText] = useState('');
  const [autofillFile, setAutofillFile] = useState(null);
  const [autofillReport, setAutofillReport] = useState(null);
  const [autofilling, setAutofilling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState('');

  const applyAssessmentTemplate = (template) => {
    const templates = {
      interview: { aptitude_enabled: false, aptitude_required: false, technical_enabled: false, technical_required: false, coding_enabled: false, coding_required: false },
      technical: { aptitude_enabled: false, aptitude_required: false, technical_enabled: true, technical_required: true, coding_enabled: true, coding_required: false },
      full: { aptitude_enabled: true, aptitude_required: true, technical_enabled: true, technical_required: true, coding_enabled: true, coding_required: true },
    };
    setJobForm((current) => ({ ...current, ...templates[template] }));
  };

  useEffect(() => {
    const run = async () => {
      try {
        const user = await authAPI.getCurrentUser();
        if (user.role !== 'recruiter') {
          navigate(user.role === 'candidate' ? '/dashboard/candidate' : '/');
          return;
        }
        if (!isEdit) {
          try {
            const savedDraft = JSON.parse(localStorage.getItem('invenia-recruiter-job-draft') || 'null');
            if (savedDraft?.form) {
              setJobForm((current) => ({ ...current, ...savedDraft.form }));
              setAutofillText(savedDraft.autofillText || '');
              setDraftSavedAt(savedDraft.savedAt || '');
            }
          } catch { /* Ignore invalid local draft data. */ }
          setDraftReady(true);
          return;
        }
        setLoading(true);
        const data = await recruiterAPI.getJob(jobId);
        const item = data.job;
        setJobForm({
          ...emptyJobForm,
          title: item.title || '',
          description: item.description || '',
          location: item.location || '',
          job_type: item.type || 'Full-time',
          experience_level: item.experienceLevel || '',
          salary_min: item.salaryMin || '',
          salary_max: item.salaryMax || '',
          salary_currency: item.salaryCurrency || '',
          salary_period: item.salaryPeriod || 'monthly',
          requirements: item.requirementsText || stringifyAutoValue(item.requirements || item.skills),
          responsibilities: stringifyAutoValue(item.responsibilities),
          benefits: stringifyAutoValue(item.benefits),
          is_remote: Boolean(item.isRemote),
          aptitude_enabled: item.assessmentConfig?.aptitude?.enabled ?? true,
          aptitude_required: item.assessmentConfig?.aptitude?.required ?? true,
          technical_enabled: item.assessmentConfig?.technical?.enabled ?? true,
          technical_required: item.assessmentConfig?.technical?.required ?? true,
          coding_enabled: item.assessmentConfig?.coding?.enabled ?? true,
          coding_required: item.assessmentConfig?.coding?.required ?? true,
          interview_duration_minutes: item.assessmentConfig?.interview?.duration_minutes || 10,
        });
        setDraftReady(true);
      } catch (requestError) {
        setError(requestError.response?.data?.detail || 'Unable to load job form');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [isEdit, jobId, navigate]);

  useEffect(() => {
    if (isEdit || !draftReady) return undefined;
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      localStorage.setItem('invenia-recruiter-job-draft', JSON.stringify({ form: jobForm, autofillText, savedAt }));
      setDraftSavedAt(savedAt);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [autofillText, draftReady, isEdit, jobForm]);

  const updateField = (field, value) => {
    setJobForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAutofill = async () => {
    if (!autofillText.trim() && !autofillFile) {
      window.alert('Paste job details or upload a file first.');
      return;
    }
    setAutofilling(true);
    setAutofillReport(null);
    try {
      const response = await recruiterAPI.autofillJob({ text: autofillText, file: autofillFile });
      const data = response.job || {};
      setAutofillReport(response.extraction || { qualityScore: 0, warnings: ['Extraction quality was not reported. Review every field.'] });
      setJobForm((prev) => ({
        ...prev,
        title: data.title && data.title !== 'NA' ? data.title : prev.title,
        description: data.description && data.description !== 'NA' ? data.description : prev.description,
        location: data.location && data.location !== 'NA' ? data.location : prev.location,
        job_type: data.job_type && data.job_type !== 'NA' ? data.job_type : prev.job_type,
        experience_level: data.experience_level && data.experience_level !== 'NA' ? data.experience_level : prev.experience_level,
        salary_min: data.salary_min || prev.salary_min,
        salary_max: data.salary_max || prev.salary_max,
        salary_currency: data.salary_currency && data.salary_currency !== 'NA' ? data.salary_currency : prev.salary_currency,
        salary_period: data.salary_period && data.salary_period !== 'NA' ? data.salary_period : prev.salary_period,
        requirements: data.requirements && data.requirements !== 'NA' ? stringifyAutoValue(data.requirements) : prev.requirements,
        responsibilities: data.responsibilities && data.responsibilities !== 'NA' ? stringifyAutoValue(data.responsibilities) : prev.responsibilities,
        benefits: data.benefits && data.benefits !== 'NA' ? stringifyAutoValue(data.benefits) : prev.benefits,
        is_remote: Boolean(data.is_remote),
      }));
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to auto-fill job details');
    } finally {
      setAutofilling(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload(jobForm);
      if (isEdit) {
        await recruiterAPI.updateJob(jobId, payload);
      } else {
        await recruiterAPI.createJob(payload);
        localStorage.removeItem('invenia-recruiter-job-draft');
      }
      navigate('/dashboard/recruiter?tab=jobs');
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to save job');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageSkeleton label="Loading job editor" />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <button type="button" onClick={() => navigate('/dashboard/recruiter?tab=jobs')} className="rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white">Back to jobs</button>
        <div className="mt-8 rounded-[28px] border border-rose-100 bg-white p-8 text-rose-700">{error}</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-slate-100">
      <section className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <button type="button" onClick={() => navigate('/dashboard/recruiter?tab=jobs')} className="inline-flex items-center gap-2 rounded-2xl border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to jobs
        </button>

        <div className="mt-6 rounded-[36px] bg-[#04193b] p-8 text-white shadow-[0_24px_70px_rgba(4,25,59,0.22)]">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-200">{isEdit ? 'Edit opportunity' : 'Post new job'}</p>
          <h1 className="mt-3 text-4xl font-semibold">{isEdit ? 'Update the job in full page mode' : 'Create a structured job with smart autofill'}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-blue-50/90">Paste or upload the job details, review the auto-filled fields, then submit only after you confirm everything.</p>
          {!isEdit && <p className="mt-4 text-xs text-blue-200">Draft autosave: {draftSavedAt ? `saved ${new Date(draftSavedAt).toLocaleTimeString()}` : 'ready'}</p>}
        </div>

        <nav aria-label="Job creation sections" className="sticky top-3 z-20 mt-5 flex snap-x gap-2 overflow-x-auto rounded-2xl border border-blue-100 bg-white/95 p-2 shadow-lg backdrop-blur scrollbar-hidden">
          {[['source', '1. Import'], ['role-details', '2. Role details'], ['assessment-plan', '3. Assessment'], ['review-submit', '4. Review']].map(([id, label]) => <button key={id} type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="min-w-max rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100">{label}</button>)}
        </nav>

        <section id="source" className="mt-8 scroll-mt-24 rounded-[32px] border border-blue-100 bg-white p-6 shadow-[0_14px_38px_rgba(37,99,235,0.07)]">
          <div className="flex items-center gap-3">
            <SparklesIcon className="h-7 w-7 text-blue-700" />
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Auto-fill job details</h2>
              <p className="text-sm text-slate-500">Paste job text or upload PDF/Word/image text content. The system fills the form only, it does not submit.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
            <textarea value={autofillText} onChange={(event) => setAutofillText(event.target.value)} rows={7} placeholder="Paste complete job description here..." className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-300" />
            <div className="rounded-[24px] border border-dashed border-blue-200 bg-blue-50/60 p-5">
              <CloudArrowUpIcon className="h-9 w-9 text-blue-700" />
              <p className="mt-2 text-sm text-slate-600">{autofillFile?.name || 'Upload job details file'}</p>
              <input type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" onChange={(event) => setAutofillFile(event.target.files?.[0] || null)} className="mt-4 text-sm" />
              <button type="button" disabled={autofilling} onClick={handleAutofill} className="mt-5 w-full rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-400">
                {autofilling ? 'Auto-filling...' : 'Auto-fill fields'}
              </button>
            </div>
          </div>
          {autofillReport && (
            <div className="mt-5 rounded-[24px] border border-blue-100 bg-blue-50/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Extraction review</p>
                  <p className="mt-1 text-sm text-slate-600">Fields were filled but not published. Confirm uncertain values before saving.</p>
                </div>
                <span className={`rounded-full px-4 py-2 text-sm font-semibold ${autofillReport.qualityScore >= 80 ? 'bg-emerald-100 text-emerald-800' : autofillReport.qualityScore >= 55 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                  Source quality {autofillReport.qualityScore || 0}%
                </span>
              </div>
              {(autofillReport.warnings || []).length > 0 ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {autofillReport.warnings.map((warning, index) => (
                    <p key={`${warning}-${index}`} className="rounded-2xl bg-white px-4 py-3 text-xs leading-5 text-amber-800">Review: {warning}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-emerald-700">No source ambiguity was reported. A recruiter review is still required.</p>
              )}
              {(autofillReport.fieldConfidence || []).length > 0 && (
                <details className="mt-4 rounded-2xl bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">Field-by-field extraction confidence</summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{autofillReport.fieldConfidence.map((item, index) => <div key={`${item.field || index}`} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><span className="font-semibold text-slate-900">{item.field || 'Field'}:</span> {item.confidence ?? item.score ?? 'Review'}{typeof (item.confidence ?? item.score) === 'number' ? '%' : ''}</div>)}</div>
                </details>
              )}
            </div>
          )}
        </section>

        <form id="role-details" onSubmit={handleSubmit} className="mt-8 grid scroll-mt-24 gap-5 rounded-[32px] border border-blue-100 bg-white p-6 shadow-[0_14px_38px_rgba(37,99,235,0.07)] md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Job title
            <input value={jobForm.title} onChange={(event) => updateField('title', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" required />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Location
            <input value={jobForm.location} onChange={(event) => updateField('location', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
          </label>
          <label className="md:col-span-2 text-sm font-semibold text-slate-700">
            Description
            <textarea rows={6} value={jobForm.description} onChange={(event) => updateField('description', event.target.value)} className="mt-2 w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm" required />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Job type
            <select value={jobForm.job_type} onChange={(event) => updateField('job_type', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              {['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Experience level
            <input value={jobForm.experience_level} onChange={(event) => updateField('experience_level', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Salary min
            <input type="number" value={jobForm.salary_min} onChange={(event) => updateField('salary_min', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Salary max
            <input type="number" value={jobForm.salary_max} onChange={(event) => updateField('salary_max', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Currency
            <input value={jobForm.salary_currency} onChange={(event) => updateField('salary_currency', event.target.value)} placeholder="EUR, INR, USD" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Salary period
            <select value={jobForm.salary_period} onChange={(event) => updateField('salary_period', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              {['per day', 'monthly', 'annually'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="md:col-span-2 text-sm font-semibold text-slate-700">
            Requirements
            <textarea rows={5} value={jobForm.requirements} onChange={(event) => updateField('requirements', event.target.value)} className="mt-2 w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
          </label>
          <label className="md:col-span-2 text-sm font-semibold text-slate-700">
            Responsibilities
            <textarea rows={5} value={jobForm.responsibilities} onChange={(event) => updateField('responsibilities', event.target.value)} className="mt-2 w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
          </label>
          <label className="md:col-span-2 text-sm font-semibold text-slate-700">
            Benefits
            <textarea rows={4} value={jobForm.benefits} onChange={(event) => updateField('benefits', event.target.value)} className="mt-2 w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
          </label>
          <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={jobForm.is_remote} onChange={(event) => updateField('is_remote', event.target.checked)} />
            Remote job
          </label>

          <div id="assessment-plan" className="scroll-mt-24 md:col-span-2 grid gap-4 lg:grid-cols-4">
            <div className="lg:col-span-4 rounded-[24px] border border-blue-100 bg-blue-50/60 p-5">
              <p className="text-sm font-semibold text-slate-900">Start with an assessment template</p>
              <p className="mt-1 text-xs text-slate-600">Templates only update the choices below. Review every stage before publishing.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => applyAssessmentTemplate('interview')} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm">Interview only</button>
                <button type="button" onClick={() => applyAssessmentTemplate('technical')} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm">Standard technical</button>
                <button type="button" onClick={() => applyAssessmentTemplate('full')} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm">Full assessment</button>
              </div>
            </div>
            <ToggleCard title="Aptitude" enabled={jobForm.aptitude_enabled} required={jobForm.aptitude_required} onEnabled={(value) => updateField('aptitude_enabled', value)} onRequired={(value) => updateField('aptitude_required', value)} />
            <ToggleCard title="Technical MCQ" enabled={jobForm.technical_enabled} required={jobForm.technical_required} onEnabled={(value) => updateField('technical_enabled', value)} onRequired={(value) => updateField('technical_required', value)} />
            <ToggleCard title="Coding" enabled={jobForm.coding_enabled} required={jobForm.coding_required} onEnabled={(value) => updateField('coding_enabled', value)} onRequired={(value) => updateField('coding_required', value)} />
            <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-lg font-semibold text-slate-900">Interview</p>
              <p className="mt-1 text-xs text-slate-600">Always mandatory</p>
              <label className="mt-4 block text-sm font-semibold text-slate-700">
                Duration minutes
                <input type="number" min="3" value={jobForm.interview_duration_minutes} onChange={(event) => updateField('interview_duration_minutes', event.target.value)} className="mt-2 w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm" />
              </label>
            </div>
          </div>

          <div id="review-submit" className="scroll-mt-24 md:col-span-2 rounded-[24px] border border-blue-100 bg-blue-50/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Review before publishing</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4"><p><strong>Role:</strong> {jobForm.title || 'Missing'}</p><p><strong>Location:</strong> {jobForm.is_remote ? 'Remote' : jobForm.location || 'Missing'}</p><p><strong>Requirements:</strong> {splitText(jobForm.requirements).length} points</p><p><strong>Interview:</strong> Mandatory</p></div>
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
            <button type="button" onClick={() => navigate('/dashboard/recruiter?tab=jobs')} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-400">
              {saving ? 'Saving...' : isEdit ? 'Update job' : 'Post job'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
