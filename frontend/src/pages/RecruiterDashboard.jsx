import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  ArrowRightOnRectangleIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  DocumentIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  InformationCircleIcon,
  LifebuoyIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PlusIcon,
  PowerIcon,
  SparklesIcon,
  TrashIcon,
  UserCircleIcon,
  UserGroupIcon,
  UserMinusIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { authAPI, buildFileUrl, downloadBlobResponse, openBlobResponse, openPreparedPreviewWindow, recruiterAPI } from '../services/api';
import { ConfirmDialog, JobIdChip, KpiStrip, PageSkeleton, ProductTour, ProfileAvatar, ScoreGlossary, ScoreHelp } from '../components/UXKit';

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
  aptitude_enabled: true,
  aptitude_mode: 'ai',
  aptitude_required: true,
  aptitude_cutoff: 3,
  aptitude_duration_minutes: 60,
  aptitude_manual_questions_text: '',
  technical_enabled: true,
  technical_mode: 'ai',
  technical_required: true,
  technical_cutoff: 3,
  technical_duration_minutes: 60,
  technical_manual_questions_text: '',
  coding_enabled: true,
  coding_required: true,
  coding_manual_questions_text: '',
  interview_duration_minutes: 10,
};

const emptyRecruiterForm = {
  full_name: '',
  email: '',
  password: '',
  company_name: 'Invenia AI',
  company_description: '',
  company_website: '',
  company_size: '',
  industry: '',
  job_title: 'Recruiter',
  phone: '',
  linkedin_url: '',
};

const emptyProfileForm = {
  full_name: '',
  company_name: '',
  company_description: '',
  company_website: '',
  company_size: '',
  industry: '',
  job_title: '',
  phone: '',
  linkedin_url: '',
};

const statusStyles = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  reviewed: 'bg-blue-100 text-blue-700',
  shortlisted: 'bg-violet-100 text-violet-700',
  interview: 'bg-sky-100 text-sky-700',
  offer: 'bg-emerald-100 text-emerald-700',
  hired: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  active: 'bg-emerald-500 text-white',
  inactive: 'bg-slate-200 text-slate-700',
  available: 'bg-emerald-100 text-emerald-700',
  new: 'bg-slate-200 text-slate-700',
};

const sidebarGradient = 'bg-gradient-to-b from-[#04193b] via-[#04193b] to-[#3f88ff]';

const ColorHomeIcon = ({ className = 'h-6 w-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9.5Z" fill="#4F46E5" />
    <path d="M9 22v-7h6v7" fill="#A78BFA" />
  </svg>
);

const ColorJobsIcon = ({ className = 'h-6 w-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="16" rx="4" fill="#10B981" />
    <rect x="8" y="3" width="8" height="4" rx="2" fill="#0EA5E9" />
    <rect x="7" y="10" width="10" height="2" rx="1" fill="white" />
    <rect x="7" y="14" width="6" height="2" rx="1" fill="#D1FAE5" />
  </svg>
);

const ColorCandidatesIcon = ({ className = 'h-6 w-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <circle cx="9" cy="8" r="4" fill="#F59E0B" />
    <path d="M2 20a7 7 0 0 1 14 0" fill="#FCD34D" />
    <circle cx="18" cy="10" r="3" fill="#FB7185" />
    <path d="M15.5 20a5.5 5.5 0 0 1 6.5-4.8V20h-6.5Z" fill="#FDA4AF" />
  </svg>
);

const ColorAnalyticsIcon = ({ className = 'h-6 w-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <rect x="4" y="4" width="16" height="16" rx="4" fill="#8B5CF6" />
    <rect x="7" y="12" width="3" height="5" rx="1.5" fill="#DDD6FE" />
    <rect x="11" y="9" width="3" height="8" rx="1.5" fill="#C4B5FD" />
    <rect x="15" y="7" width="3" height="10" rx="1.5" fill="white" />
  </svg>
);

const ColorRecruitersIcon = ({ className = 'h-6 w-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" fill="#EF4444" />
    <path d="M4 20a8 8 0 0 1 16 0" fill="#FCA5A5" />
  </svg>
);

const ColorProfileIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" fill="#8B5CF6" />
    <path d="M5 20a7 7 0 0 1 14 0" fill="#DDD6FE" />
  </svg>
);

const ColorSettingsIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M12 4.5 13.8 5a1.8 1.8 0 0 0 2-.8l1-1 2.2 2.2-1 1a1.8 1.8 0 0 0-.4 2l.5 1.7 1.4.7v3.2l-1.4.7-.5 1.7a1.8 1.8 0 0 0 .4 2l1 1-2.2 2.2-1-1a1.8 1.8 0 0 0-2-.4l-1.7.5-.7 1.4H10.6l-.7-1.4-1.7-.5a1.8 1.8 0 0 0-2 .4l-1 1L3 19.6l1-1a1.8 1.8 0 0 0 .4-2L4 14.9l-1.4-.7V11l1.4-.7.5-1.7a1.8 1.8 0 0 0-.4-2l-1-1L5.3 3.4l1 1a1.8 1.8 0 0 0 2 .4l1.7-.5.7-1.4h2.6L12 4.5Z" fill="#C4B5FD" />
    <circle cx="12" cy="12" r="3" fill="#8B5CF6" />
  </svg>
);

const ColorSupportIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M12 4C7 4 3 7 3 11c0 2.1 1.1 4 3 5.3V20l3.6-2.1c.8.1 1.6.1 2.4.1 5 0 9-3 9-7s-4-7-9-7Z" fill="#DDD6FE" />
    <circle cx="9" cy="11" r="1" fill="#8B5CF6" />
    <circle cx="12" cy="11" r="1" fill="#A78BFA" />
    <circle cx="15" cy="11" r="1" fill="#C4B5FD" />
  </svg>
);

const ColorLogoutIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <rect x="4" y="4" width="9" height="16" rx="3" fill="#FDBA74" />
    <path d="M13 12h7" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
    <path d="m17 8 4 4-4 4" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function splitText(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDetailList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/\n|,|•|-/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isFinalApplicationDecision(status) {
  return ['approved', 'rejected'].includes(status);
}

function formatDate(value) {
  if (!value) return 'Recently';
  return new Date(value).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSalaryText(value) {
  return String(value || 'Competitive').replace(/\$/g, '').replace(/\s+/g, ' ').trim();
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

function ViewToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
      {[
        ['grid', 'Grid'],
        ['list', 'List'],
      ].map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            value === mode ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CandidateAIAnalysis({ candidate }) {
  const jobAts = candidate.jobAts || {};
  const jobCalculation = jobAts.calculation || {};
  const finalCalculation = candidate.workflowSummary?.scoreCalculation || {};
  const analysis = candidate.decisionAnalysis || {};
  const strongSignals = analysis.strongSignals || [...(jobAts.matched_requirements || []), ...(jobAts.strengths || [])];
  const validationPoints = analysis.validationPoints || [...(jobAts.missing_requirements || []), ...(jobAts.gaps || [])];
  const interview = analysis.interviewAnalysis || {};

  return (
    <div className="w-full rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Invenia AI Analysis</p>
          <h4 className="mt-2 text-xl font-semibold text-slate-950">{analysis.decisionBand || candidate.recruiterDecision || 'Evidence review'}</h4>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${analysis.status === 'final' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {analysis.status === 'final' ? 'Final analysis' : 'Provisional analysis'}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        {analysis.executiveSummary || jobAts.summary || candidate.recommendation || 'Invenia AI Analysis is being prepared from the candidate CV and job requirements.'}
      </p>
      <p className="mt-2 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold leading-6 text-blue-950">
        Recommendation: {analysis.recommendation || jobAts.recommendation || 'Review candidate evidence before approval.'}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Job ATS</p>
          <p className="mt-1 text-2xl font-semibold text-blue-900">{jobAts.score ?? candidate.jobAtsScore ?? 0}%</p>
          <p className="mt-1 text-xs text-slate-500">CV evidence against this job only</p>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Final score</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-800">{finalCalculation.score ?? candidate.finalScore ?? 0}%</p>
          <p className="mt-1 text-xs text-slate-500">{finalCalculation.status === 'final' ? 'All enabled rounds included' : 'Provisional until rounds finish'}</p>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Evidence confidence</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{jobAts.confidence_score ?? 0}%</p>
          <p className="mt-1 text-xs capitalize text-slate-500">{jobAts.confidence || 'low'} confidence</p>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Decision confidence</p>
          <p className="mt-1 text-2xl font-semibold text-violet-800">{analysis.decisionConfidence ?? 0}%</p>
          <p className="mt-1 text-xs text-slate-500">Evidence and completed-stage coverage</p>
        </div>
      </div>
      {(jobCalculation.components || []).length > 0 && (
        <div className="mt-3 rounded-xl bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">Job ATS calculation</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {jobCalculation.components.map((component) => (
              <div key={component.key} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                <div className="flex justify-between gap-3"><span className="font-semibold text-slate-800">{component.label}</span><span>{component.score}% x {component.weight}%</span></div>
                <p className="mt-1 text-right">{component.contribution} points</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {(finalCalculation.components || []).length > 0 && (
        <div className="mt-3 rounded-xl bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Final score calculation</p>
          <div className="mt-3 space-y-2">
            {finalCalculation.components.map((component) => (
              <div key={component.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{component.label}</span>
                <span>{component.score}% x {component.effective_weight}% = {component.contribution} points</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Strong signals</p>
          <div className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
            {strongSignals.slice(0, 10).map((item, index) => <p key={`${candidate.applicationId}-strength-${index}`}>- {item}</p>)}
            {strongSignals.length === 0 && <p>- No strong requirement evidence listed yet.</p>}
          </div>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">Validation points</p>
          <div className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
            {validationPoints.slice(0, 10).map((item, index) => <p key={`${candidate.applicationId}-gap-${index}`}>- {item}</p>)}
            {validationPoints.length === 0 && <p>- No material missing requirement or validation risk was detected.</p>}
          </div>
        </div>
      </div>
      {(analysis.stageAnalysis || []).length > 0 && (
        <div className="mt-3 rounded-xl bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700">Assessment and interview progress</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {analysis.stageAnalysis.map((stage) => (
              <div key={stage.key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-900">{stage.label}</span>
                  <span className="font-semibold text-blue-800">{stage.score == null ? stage.status : `${stage.score}%`}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">{stage.insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {(analysis.requirementEvidence || []).length > 0 && (
        <div className="mt-3 rounded-xl bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">Requirement-by-requirement evidence</p>
          <div className="mt-3 space-y-2">
            {analysis.requirementEvidence.map((item, index) => (
              <div key={`${candidate.applicationId}-evidence-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{item.item}</p>
                  <span className={`rounded-full px-2 py-1 font-semibold ${item.status === 'matched' ? 'bg-emerald-100 text-emerald-700' : item.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{item.status}</span>
                </div>
                {item.evidence_quote && <p className="mt-2 leading-5 text-slate-700">Evidence: "{item.evidence_quote}"</p>}
                <p className="mt-1 leading-5 text-slate-500">{item.rationale || 'Evidence classification recorded by Invenia AI Analysis.'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {(analysis.scoreRationale || []).length > 0 && (
        <details className="mt-3 rounded-xl bg-white p-4">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Why these scores were produced</summary>
          <div className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
            {analysis.scoreRationale.map((item, index) => <p key={`${candidate.applicationId}-reason-${index}`}>- {item}</p>)}
          </div>
        </details>
      )}
      {(interview.score != null || (interview.questionAnalysis || []).length > 0) && (
        <div className="mt-3 rounded-xl border border-emerald-100 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Invenia AI Analysis: Interview</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{interview.decision || 'Review'}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{interview.summary}</p>
            </div>
            <span className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{interview.score ?? 0}%</span>
          </div>
          {(interview.competencyScores || []).length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {interview.competencyScores.map((item, index) => (
                <div key={`${item.competency}-${index}`} className="rounded-xl bg-slate-50 p-3 text-xs">
                  <div className="flex justify-between gap-3"><span className="font-semibold text-slate-900">{item.competency}</span><span className="font-semibold text-emerald-700">{item.score}%</span></div>
                  <p className="mt-2 leading-5 text-slate-600">{item.evidence || 'No supporting note supplied.'}</p>
                </div>
              ))}
            </div>
          )}
          {(interview.questionAnalysis || []).length > 0 && (
            <div className="mt-3 space-y-2">
              {interview.questionAnalysis.map((item, index) => (
                <details key={`${candidate.applicationId}-question-${index}`} className="rounded-xl bg-slate-50 p-3 text-xs">
                  <summary className="cursor-pointer font-semibold text-slate-900">Q{index + 1}: {item.score ?? 0}% - {item.answer_quality || 'Review'}</summary>
                  <p className="mt-2 leading-5 text-slate-700">{item.notes || 'No detailed note available.'}</p>
                  {item.evidence && <p className="mt-2 leading-5 text-slate-500">Evidence: {item.evidence}</p>}
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecruiterActionModal({ notice, onClose }) {
  if (!notice) return null;
  const tone = notice.tone || 'green';
  const toneClasses = {
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
  };

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-xl rounded-[34px] border border-blue-100 bg-white p-7 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
          aria-label="Close notification"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${toneClasses[tone] || toneClasses.green}`}>
          {notice.label || 'Recruiter update'}
        </div>
        <h3 className="mt-4 text-2xl font-semibold text-slate-900">{notice.title}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-600">{notice.message}</p>
        <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
          <p><span className="font-semibold text-slate-900">Candidate:</span> {notice.candidateName}</p>
          <p><span className="font-semibold text-slate-900">Email:</span> {notice.candidateEmail || 'Not provided'}</p>
          <p><span className="font-semibold text-slate-900">Job:</span> {notice.jobTitle || 'Applied role'}</p>
          <p><span className="font-semibold text-slate-900">Status:</span> {notice.status}</p>
        </div>
        <p className="mt-4 text-xs leading-6 text-slate-500">
          The candidate will see this decision once on login and can review the final status in the Applied tab.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white"
        >
          Continue
        </button>
      </div>
    </div>,
    document.body,
  );
}

function ScoreBadge({ label, value, tone = 'bg-blue-50 text-blue-700 border-blue-100' }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value ?? 0}%</p>
    </div>
  );
}

function DistributionBars({ title, items }) {
  return (
    <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
      <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
      <div className="mt-5 space-y-4">
        {(items || []).length > 0 ? (
          items.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>{item.label}</span>
                <span>{item.count} candidates ({item.percentage}%)</span>
              </div>
              <div className="mt-2 h-3 rounded-full bg-slate-100">
                <div className="h-3 rounded-full bg-blue-700" style={{ width: `${item.percentage || 0}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No score distribution available yet.</p>
        )}
      </div>
    </div>
  );
}

function getJobRecommendations(job) {
  return [
    `Market Demand: ${job.applications > 10 ? 'High' : job.applications > 4 ? 'Medium' : 'Growing'}`,
    `Salary: ${formatSalaryText(job.salary)}`,
    `Applicant location spread: ${job.diversityScore}% (geographic variety only; not a demographic diversity measure).`,
  ];
}

function RecruiterJobCard({ job, onViewDetails, onAIOptimize, onDelete }) {
  const recommendations = getJobRecommendations(job);
  const visibleSkills = (job.skills || []).slice(0, 5);

  return (
    <div className="rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <JobIdChip value={job.publicJobId} className="mb-2" />
          <button type="button" onClick={() => onViewDetails(job)} className="text-left text-2xl font-semibold text-slate-900 transition hover:text-blue-700 hover:underline">{job.title}</button>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <MapPinIcon className="h-4 w-4 text-pink-500" />
              {job.location || 'Location not specified'}
            </span>
            <span className="flex items-center gap-1">
              <span className="text-orange-500">💼</span>
              {job.type}
            </span>
            <span className="flex items-center gap-1">
              <span className="text-emerald-500">{job.isRemote ? '🌐' : '🏠'}</span>
              {job.isRemote ? 'Remote' : 'On-site'}
            </span>
            <span className="flex items-center gap-1"><ChartBarIcon className="h-4 w-4 text-cyan-600" />{job.experienceLevel || 'Experience not specified'}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-lg font-semibold text-emerald-600">
            <span>{formatSalaryText(job.salary)}</span>
          </div>
        </div>

        <div className={`rounded-2xl px-4 py-2 text-sm font-bold ${statusStyles[job.status] || 'bg-slate-200 text-slate-700'}`}>
          {job.status === 'active' ? 'OPEN READY' : 'INACTIVE'}
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-sky-200 bg-sky-50/90 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
          <span>🧠</span>
          Invenia AI Analysis
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Average evidence match', `${job.matchScore}%`],
            ['Location spread', `${job.diversityScore}%`],
            ['Views', String(job.views)],
            ['Applications', String(job.applications)],
          ].map(([label, value]) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <h4 className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <span className="text-rose-500">🎯</span>
          Required Skills
        </h4>
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleSkills.length > 0 ? (
            <>
            {visibleSkills.map((skill) => (
              <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {skill}
              </span>
            ))}
            {(job.skills || []).length > visibleSkills.length && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">+{job.skills.length - visibleSkills.length} more</span>}
            </>
          ) : (
            <span className="text-sm text-slate-500">No skills added yet.</span>
          )}
        </div>
      </div>

      <details className="mt-5 rounded-3xl border border-amber-300 bg-amber-50 px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold text-amber-800">Demand and optimization guidance</summary>
        <h4 className="flex items-center gap-2 text-base font-semibold text-amber-700">
          <span>💡</span>
          Invenia AI Analysis Recommendations
        </h4>
        <ul className="mt-3 space-y-2 text-sm text-amber-800">
          {recommendations.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </details>

      <div className="mt-5 grid grid-cols-3 gap-4 rounded-3xl bg-slate-100 p-4">
        {[
          ['Shortlisted', job.shortlistedCount || 0],
          ['Interviewed', job.interviewedCount || 0],
          ['Time to Fill', `${job.timeToFillDays || 0}d`],
        ].map(([label, value]) => (
          <div key={label} className="text-center">
            <p className="text-3xl font-bold text-slate-800">{value}</p>
            <p className="mt-1 text-sm text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => onViewDetails(job)} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
          View Details
        </button>
        <button type="button" onClick={() => onAIOptimize(job)} className="rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-600">
          Improve job description
        </button>
        <button type="button" onClick={() => onDelete(job)} className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-50">
          Archive job
        </button>
      </div>
    </div>
  );
}

function ProfileMenu({ profile, currentUser, isSuperRecruiter, onClose, onProfile, onAnalytics, onRecruiters, onSettings, onSupport, onLogout }) {
  const name = profile?.full_name || currentUser?.full_name || currentUser?.username || 'Recruiter';
  const email = profile?.email || currentUser?.email || '';

  return (
    <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.15)]">
      <div className="flex items-center gap-4 px-5 py-5">
        <ProfileAvatar src={buildFileUrl(profile?.photo_url)} name={name} className="h-14 w-14" textClassName="text-xl" />
        <div>
          <p className="text-xl font-semibold text-slate-800">{name}</p>
          <p className="text-sm text-slate-500">{email}</p>
        </div>
      </div>

      <div className="border-t border-slate-200 px-3 py-3">
        <button type="button" onClick={() => { onProfile(); onClose(); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-slate-700 hover:bg-slate-50">
          <ColorProfileIcon className="h-5 w-5" />
          <span className="text-lg">View Profile</span>
        </button>
        <button type="button" onClick={() => { onAnalytics(); onClose(); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-slate-700 hover:bg-slate-50">
          <ColorAnalyticsIcon className="h-5 w-5" />
          <span className="text-lg">Analytics</span>
        </button>
        {isSuperRecruiter && (
          <button type="button" onClick={() => { onRecruiters(); onClose(); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-slate-700 hover:bg-slate-50">
            <ColorRecruitersIcon className="h-5 w-5" />
            <span className="text-lg">Manage Recruiters</span>
          </button>
        )}
        <button type="button" onClick={() => { onSettings(); onClose(); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-slate-700 hover:bg-slate-50">
          <ColorSettingsIcon className="h-5 w-5" />
          <span className="text-lg">Settings</span>
        </button>
        <button type="button" onClick={() => { onSupport(); onClose(); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-slate-700 hover:bg-slate-50">
          <ColorSupportIcon className="h-5 w-5" />
          <span className="text-lg">Support</span>
        </button>
      </div>

      <div className="border-t border-slate-200 px-3 py-3">
        <button type="button" onClick={onLogout} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-red-500 hover:bg-red-50">
          <ColorLogoutIcon className="h-5 w-5" />
          <span className="text-lg">Logout</span>
        </button>
      </div>
    </div>
  );
}

export default function RecruiterDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const profileMenuRef = useRef(null);

  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(location.search).get('tab') || 'overview');
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [applicationAction, setApplicationAction] = useState({ applicationId: null, status: '' });
  const [actionModal, setActionModal] = useState(null);
  const [candidateAction, setCandidateAction] = useState({ candidateId: null, action: '' });
  const [recruitersLoading, setRecruitersLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingRecruiter, setSavingRecruiter] = useState(false);
  const [savingInterview, setSavingInterview] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isSuperRecruiter, setIsSuperRecruiter] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [overview, setOverview] = useState({
    analytics: {
      totalJobs: 0,
      activeJobs: 0,
      totalCandidates: 0,
      totalApplications: 0,
      newApplications: 0,
      interviewsScheduled: 0,
      offersSent: 0,
      hires: 0,
      avgTimeToHire: 0,
      conversionRate: 0,
      candidateQuality: 0,
      diversityScore: 0,
    },
    recentApplications: [],
    activeJobs: [],
    upcomingInterviews: [],
  });
  const [jobs, setJobs] = useState([]);
  const [jobViewMode, setJobViewMode] = useState('grid');
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [debouncedJobSearch, setDebouncedJobSearch] = useState('');
  const [editingJob, setEditingJob] = useState(null);
  const [jobForm, setJobForm] = useState(emptyJobForm);
  const [showJobModal, setShowJobModal] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [candidateViewMode, setCandidateViewMode] = useState('grid');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [debouncedCandidateSearch, setDebouncedCandidateSearch] = useState('');
  const [candidateStatus, setCandidateStatus] = useState('all');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [analysisCandidate, setAnalysisCandidate] = useState(null);
  const [candidateStatusDraft, setCandidateStatusDraft] = useState('pending');
  const [interviewForm, setInterviewForm] = useState({
    interview_type: 'Technical',
    scheduled_at: '',
    duration_minutes: 60,
    location: '',
    notes: '',
  });
  const [analyticsPeriod, setAnalyticsPeriod] = useState('all');
  const [analyticsJobFilter, setAnalyticsJobFilter] = useState('all');
  const [analyticsCandidateStatus, setAnalyticsCandidateStatus] = useState('all');
  const [showScoreGlossary, setShowScoreGlossary] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [analytics, setAnalytics] = useState({
    conversionRate: 0,
    candidateQuality: 0,
    diversityScore: 0,
    avgTimeToHire: 0,
    averageJobAtsScore: 0,
    averageFinalScore: 0,
    totalJobsAnalyzed: 0,
    totalCandidateReports: 0,
    hiringFunnel: [],
  });
  const [jobAnalysis, setJobAnalysis] = useState([]);
  const [candidateComparison, setCandidateComparison] = useState([]);
  const [comparisonLimit, setComparisonLimit] = useState(10);
  const [scoreDistributions, setScoreDistributions] = useState({ jobAts: [], final: [] });
  const [aiInsights, setAiInsights] = useState({ summary: '', recommendations: [], riskFlags: [] });
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [recruiters, setRecruiters] = useState([]);
  const [showRecruiterModal, setShowRecruiterModal] = useState(false);
  const [recruiterForm, setRecruiterForm] = useState(emptyRecruiterForm);

  useEffect(() => {
    const requestedTab = new URLSearchParams(location.search).get('tab');
    if (requestedTab) {
      setActiveTab(requestedTab);
    }
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') !== activeTab) {
      params.set('tab', activeTab);
      navigate({ search: params.toString() }, { replace: true });
    }
  }, [activeTab, location.search, navigate]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      setShowScrollBottom(window.scrollY < scrollHeight - 300);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedJobSearch(jobSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [jobSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCandidateSearch(candidateSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [candidateSearch]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const user = await authAPI.getCurrentUser();
        if (user.role !== 'recruiter') {
          navigate(user.role === 'candidate' ? '/dashboard/candidate' : '/');
          return;
        }

        setCurrentUser(user);
        setIsSuperRecruiter(Boolean(user.email === 'pramodjadhav1876@gmail.com'));

        const [overviewData, profileData] = await Promise.all([
          recruiterAPI.getOverview(),
          recruiterAPI.getProfile(),
        ]);

        setOverview(overviewData);
        applyProfile(profileData.profile);
      } catch (requestError) {
        setError(requestError.response?.data?.detail || 'Failed to load recruiter dashboard');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [navigate]);

  useEffect(() => {
    if (!currentUser) return;
    const run = async () => {
      if (activeTab === 'jobs') {
        setJobsLoading(true);
        try {
          const [jobsData, analyticsData] = await Promise.all([
            recruiterAPI.getJobs(debouncedJobSearch),
            recruiterAPI.getAnalytics('all'),
          ]);
          setJobs(jobsData.jobs || []);
          setJobAnalysis(analyticsData.jobAnalysis || []);
          setCandidateComparison(analyticsData.candidateComparison || []);
          setScoreDistributions(analyticsData.scoreDistributions || { jobAts: [], final: [] });
          setAiInsights(analyticsData.aiInsights || { summary: '', recommendations: [], riskFlags: [] });
        } finally {
          setJobsLoading(false);
        }
      }
      if (activeTab === 'candidates') {
        setCandidatesLoading(true);
        try {
          const data = await recruiterAPI.getCandidates(debouncedCandidateSearch, candidateStatus);
          setCandidates(data.candidates || []);
        } finally {
          setCandidatesLoading(false);
        }
      }
      if (activeTab === 'analytics') {
        setAnalyticsLoading(true);
        try {
          const data = await recruiterAPI.getAnalytics(analyticsPeriod);
          setAnalytics((prev) => data.analytics || prev);
          setJobAnalysis(data.jobAnalysis || []);
          setCandidateComparison(data.candidateComparison || []);
          setScoreDistributions(data.scoreDistributions || { jobAts: [], final: [] });
          setAiInsights(data.aiInsights || { summary: '', recommendations: [], riskFlags: [] });
        } finally {
          setAnalyticsLoading(false);
        }
      }
      if (activeTab === 'recruiters' && isSuperRecruiter) {
        setRecruitersLoading(true);
        try {
          const data = await recruiterAPI.getRecruiters();
          setRecruiters(data.recruiters || []);
        } finally {
          setRecruitersLoading(false);
        }
      }
    };
    run();
  }, [activeTab, currentUser, debouncedJobSearch, debouncedCandidateSearch, candidateStatus, analyticsPeriod, isSuperRecruiter]);

  useEffect(() => {
    const onClick = (event) => {
      if (showProfileDropdown && profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showProfileDropdown]);

  const loadOverview = async () => {
    const data = await recruiterAPI.getOverview();
    setOverview(data);
  };

  const loadJobs = async (search = '') => {
    setJobsLoading(true);
    try {
      const [jobsData, analyticsData] = await Promise.all([
        recruiterAPI.getJobs(search),
        recruiterAPI.getAnalytics('all'),
      ]);
      setJobs(jobsData.jobs || []);
      setJobAnalysis(analyticsData.jobAnalysis || []);
      setCandidateComparison(analyticsData.candidateComparison || []);
      setScoreDistributions(analyticsData.scoreDistributions || { jobAts: [], final: [] });
      setAiInsights(analyticsData.aiInsights || { summary: '', recommendations: [], riskFlags: [] });
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Failed to load jobs');
    } finally {
      setJobsLoading(false);
    }
  };

  const loadCandidates = async (search = '', status = 'all') => {
    setCandidatesLoading(true);
    try {
      const data = await recruiterAPI.getCandidates(search, status);
      setCandidates(data.candidates || []);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Failed to load candidates');
    } finally {
      setCandidatesLoading(false);
    }
  };

  const loadAnalytics = async (period = 'week') => {
    setAnalyticsLoading(true);
    try {
      const data = await recruiterAPI.getAnalytics(period);
      setAnalytics((prev) => data.analytics || prev);
      setJobAnalysis(data.jobAnalysis || []);
      setCandidateComparison(data.candidateComparison || []);
      setScoreDistributions(data.scoreDistributions || { jobAts: [], final: [] });
      setAiInsights(data.aiInsights || { summary: '', recommendations: [], riskFlags: [] });
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadRecruiters = async () => {
    if (!isSuperRecruiter) return;
    setRecruitersLoading(true);
    try {
      const data = await recruiterAPI.getRecruiters();
      setRecruiters(data.recruiters || []);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Failed to load recruiters');
    } finally {
      setRecruitersLoading(false);
    }
  };

  const refreshSummary = async () => {
    await Promise.all([
      loadOverview(),
      recruiterAPI.getProfile().then((data) => applyProfile(data.profile)),
    ]);
  };

  const applyProfile = (profileData) => {
    setProfile(profileData);
    setProfileForm({
      full_name: profileData.full_name || '',
      company_name: profileData.company_name || '',
      company_description: profileData.company_description || '',
      company_website: profileData.company_website || '',
      company_size: profileData.company_size || '',
      industry: profileData.industry || '',
      job_title: profileData.job_title || '',
      phone: profileData.phone || '',
      linkedin_url: profileData.linkedin_url || '',
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    navigate('/login/recruiter');
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  };

  const handleJobSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      title: jobForm.title,
      description: jobForm.description,
      location: jobForm.location || null,
      job_type: jobForm.job_type,
      experience_level: jobForm.experience_level || null,
      salary_min: jobForm.salary_min ? Number(jobForm.salary_min) : null,
      salary_max: jobForm.salary_max ? Number(jobForm.salary_max) : null,
      salary_currency: jobForm.salary_currency || null,
      salary_period: jobForm.salary_period || null,
      requirements: JSON.stringify(splitText(jobForm.requirements)),
      responsibilities: jobForm.responsibilities || null,
      benefits: jobForm.benefits || null,
      is_remote: jobForm.is_remote,
      assessment_config: {
        aptitude: {
          enabled: jobForm.aptitude_enabled,
          mode: jobForm.aptitude_mode,
          required: jobForm.aptitude_required,
          cutoff: Number(jobForm.aptitude_cutoff) || 18,
          duration_minutes: Number(jobForm.aptitude_duration_minutes) || 60,
          question_count: 5,
          manual_questions_text: jobForm.aptitude_manual_questions_text,
        },
        technical: {
          enabled: jobForm.technical_enabled,
          mode: jobForm.technical_mode,
          required: jobForm.technical_required,
          cutoff: Number(jobForm.technical_cutoff) || 18,
          duration_minutes: Number(jobForm.technical_duration_minutes) || 60,
          question_count: 5,
          manual_questions_text: jobForm.technical_manual_questions_text,
        },
        coding: {
          enabled: jobForm.coding_enabled,
          required: jobForm.coding_required,
          manual_questions_text: jobForm.coding_manual_questions_text,
          question_count: 2,
        },
        interview: {
          duration_minutes: Number(jobForm.interview_duration_minutes) || 10,
        },
      },
    };

    try {
      if (editingJob) {
        await recruiterAPI.updateJob(editingJob.id, payload);
      } else {
        await recruiterAPI.createJob(payload);
      }
      setShowJobModal(false);
      setEditingJob(null);
      setJobForm(emptyJobForm);
      await Promise.all([loadJobs(jobSearch), refreshSummary()]);
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to save job');
    }
  };

  const handleDeleteJob = async (job) => {
    setConfirmation({ title: 'Delete job?', message: `Delete "${job.title}" from active jobs? Existing application records may be affected.`, confirmLabel: 'Delete job', danger: true, action: () => executeDeleteJob(job) });
  };

  const executeDeleteJob = async (job) => {
    setConfirmation(null);
    try {
      await recruiterAPI.deleteJob(job.id);
      await Promise.all([loadJobs(jobSearch), refreshSummary()]);
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to delete job');
    }
  };

  const openJobDetails = (item) => {
    navigate(`/dashboard/recruiter/jobs/${item.id}`);
  };

  const handleExportData = async (type) => {
    try {
      const response = await recruiterAPI.downloadExport(type);
      downloadBlobResponse(response, `invenia-${type}.csv`);
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to export data');
    }
  };

  const handleAIOptimize = (job) => {
    const suggestions = [
      `Average CV evidence match is ${job.matchScore}% across the current candidate pool.`,
      `Applicant location spread is ${job.diversityScore}%. This describes geography only, not demographic diversity.`,
      `${job.applications} applications have arrived so far.`,
      job.skills.length > 0 ? `Highlight ${job.skills[0]} more clearly in the intro summary.` : 'Add clear must-have skills to improve matching.',
    ];
    setActionModal({ label: 'Job description review', title: `Suggested improvements for ${job.title}`, message: suggestions.join(' '), tone: 'blue', jobTitle: job.title, details: 'No job content was changed automatically. Open the job editor to review and apply any useful suggestion.' });
  };

  const handleOpenResume = async (candidate) => {
    const applicationId = candidate?.applicationId || candidate?.latestApplicationId || (
      (candidate?.position || candidate?.jobTitle || candidate?.coverLetter) ? candidate?.id : null
    );
    const candidateId = candidate?.candidateId || candidate?.id;
    if (!applicationId && !candidateId) {
      return;
    }

    const previewWindow = openPreparedPreviewWindow('Candidate CV preview');
    try {
      const response = applicationId
        ? await recruiterAPI.getApplicationResume(applicationId)
        : await recruiterAPI.getCandidateResume(candidateId);
      openBlobResponse(response, previewWindow);
    } catch (requestError) {
      previewWindow?.close?.();
      window.alert(requestError.response?.data?.detail || 'Unable to open candidate CV');
    }
  };

  const handleOpenInterviewMedia = async (candidate, type = 'recording') => {
    const applicationId = candidate?.applicationId || candidate?.latestApplicationId;
    if (!applicationId) return;
    const previewWindow = openPreparedPreviewWindow(type === 'snapshot' ? 'Interview snapshot' : 'Interview recording');
    try {
      const response = type === 'snapshot'
        ? await recruiterAPI.getInterviewSnapshot(applicationId)
        : await recruiterAPI.getInterviewRecording(applicationId);
      openBlobResponse(response, previewWindow);
    } catch (requestError) {
      previewWindow?.close?.();
      window.alert(requestError.response?.data?.detail || 'Unable to open interview media');
    }
  };

  const handleDownloadInterviewRecording = async (candidate) => {
    const applicationId = candidate?.applicationId || candidate?.latestApplicationId;
    if (!applicationId) return;
    try {
      const response = await recruiterAPI.getInterviewRecording(applicationId);
      const safeName = String(candidate?.candidateName || candidate?.name || 'candidate')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'candidate';
      downloadBlobResponse(response, `${safeName}-interview-${applicationId}.webm`);
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to download interview recording');
    }
  };

  const patchApplicationStatusLocally = (applicationId, status) => {
    setCandidateComparison((prev) => prev.map((candidate) => (
      candidate.applicationId === applicationId ? { ...candidate, status } : candidate
    )));
    setJobAnalysis((prev) => prev.map((job) => ({
      ...job,
      topCandidates: (job.topCandidates || []).map((candidate) => (
        candidate.applicationId === applicationId ? { ...candidate, status } : candidate
      )),
      candidateComparison: (job.candidateComparison || []).map((candidate) => (
        candidate.applicationId === applicationId ? { ...candidate, status } : candidate
      )),
    })));
    setAnalysisCandidate((prev) => (
      prev?.applicationId === applicationId ? { ...prev, status } : prev
    ));
    setSelectedCandidate((prev) => (
      prev?.latestApplicationId === applicationId ? { ...prev, status } : prev
    ));
  };

  const findApplicationCandidate = (applicationId) => {
    const pools = [
      ...candidateComparison,
      ...candidates,
      ...(overview.recentApplications || []),
      ...(jobAnalysis || []).flatMap((job) => [
        ...(job.topCandidates || []),
        ...(job.candidateComparison || []),
      ]),
    ];
    return pools.find((candidate) => (
      candidate.applicationId === applicationId
      || candidate.latestApplicationId === applicationId
      || candidate.id === applicationId
    ));
  };

  const handleApplicationStatusUpdate = async (applicationId, status, confirmed = false) => {
    if (!applicationId) {
      return;
    }
    const candidate = findApplicationCandidate(applicationId) || selectedCandidate || analysisCandidate || {};
    const candidateName = candidate.candidateName || candidate.name || candidate.fullName || 'Selected candidate';
    if (!confirmed && ['approved', 'rejected'].includes(status) && !isFinalApplicationDecision(candidate.status)) {
      setConfirmation({
        title: status === 'approved' ? 'Approve candidate?' : 'Reject candidate?',
        message: `${candidateName} will be marked ${status} for this job. This final decision cannot be reversed.`,
        confirmLabel: status === 'approved' ? 'Approve candidate' : 'Reject candidate',
        danger: status === 'rejected',
        action: () => { setConfirmation(null); handleApplicationStatusUpdate(applicationId, status, true); },
      });
      return;
    }
    setApplicationAction({ applicationId, status });
    try {
      const candidateEmail = candidate.candidateEmail || candidate.email || '';
      const jobTitle = candidate.jobTitle || candidate.position || selectedCandidate?.position || analysisCandidate?.jobTitle || 'the selected job';
      if (isFinalApplicationDecision(candidate.status) && candidate.status !== status) {
        setActionModal({
          label: 'Decision locked',
          title: 'Final decision cannot be reversed',
          message: `${candidateName} is already ${candidate.status}. Approval and rejection decisions are final for this application.`,
          candidateName,
          candidateEmail,
          jobTitle,
          status: candidate.status,
          tone: 'amber',
        });
        return;
      }
      await recruiterAPI.updateApplicationStatus(applicationId, status);
      patchApplicationStatusLocally(applicationId, status);
      const isApproved = status === 'approved';
      const isRejected = status === 'rejected';
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      setActionModal({
        label: isApproved ? 'Approval sent' : isRejected ? 'Rejection sent' : 'Status update sent',
        title: isApproved ? 'Candidate approved successfully' : isRejected ? 'Candidate rejected successfully' : 'Candidate status updated',
        message: isApproved
          ? `${candidateName} has been approved for the next assessment rounds.`
          : isRejected
            ? `${candidateName} has been rejected for this application.`
            : `${candidateName} has been moved to ${statusLabel}.`,
        candidateName,
        candidateEmail,
        jobTitle,
        status,
        tone: isApproved ? 'green' : isRejected ? 'rose' : 'blue',
      });
      await Promise.all([refreshSummary(), loadCandidates(candidateSearch, candidateStatus)]);
      if (activeTab === 'analytics') {
        await loadAnalytics(analyticsPeriod);
      }
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to update application');
    } finally {
      setApplicationAction({ applicationId: null, status: '' });
    }
  };

  const openCandidateDetails = (candidate) => {
    setSelectedCandidate(candidate);
    setCandidateStatusDraft(candidate.status || 'pending');
    setInterviewForm({
      interview_type: 'Technical',
      scheduled_at: '',
      duration_minutes: 60,
      location: '',
      notes: '',
    });
    setShowCandidateModal(true);
  };

  const patchCandidateAccessLocally = (candidateId, isActive) => {
    setCandidates((prev) => prev.map((candidate) => (
      candidate.id === candidateId ? { ...candidate, isActive } : candidate
    )));
    setSelectedCandidate((prev) => (
      prev?.id === candidateId ? { ...prev, isActive } : prev
    ));
  };

  const handleCandidateAccessUpdate = async (candidate, isActive) => {
    if (!candidate?.id) return;
    setCandidateAction({ candidateId: candidate.id, action: isActive ? 'activate' : 'deactivate' });
    try {
      await recruiterAPI.updateCandidateAccess(candidate.id, isActive);
      patchCandidateAccessLocally(candidate.id, isActive);
      setActionModal({
        label: isActive ? 'Candidate activated' : 'Candidate deactivated',
        title: isActive ? 'Candidate account activated' : 'Candidate account deactivated',
        message: isActive
          ? `${candidate.name} can now log in to the candidate portal again.`
          : `${candidate.name} can no longer log in until the account is activated again.`,
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        jobTitle: 'Candidate account',
        status: isActive ? 'Active' : 'Inactive',
        tone: isActive ? 'green' : 'rose',
      });
      await Promise.all([refreshSummary(), loadCandidates(candidateSearch, candidateStatus)]);
      if (activeTab === 'analytics') {
        await loadAnalytics(analyticsPeriod);
      }
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to update candidate account');
    } finally {
      setCandidateAction({ candidateId: null, action: '' });
    }
  };

  const handleDeleteCandidate = async (candidate) => {
    if (!candidate?.id) return;
    setConfirmation({ title: 'Delete candidate account?', message: `Permanently delete ${candidate.name}'s profile, applications, saved jobs, and interview records? This cannot be undone.`, confirmLabel: 'Delete permanently', danger: true, action: () => executeDeleteCandidate(candidate) });
  };

  const executeDeleteCandidate = async (candidate) => {
    setConfirmation(null);
    setCandidateAction({ candidateId: candidate.id, action: 'delete' });
    try {
      await recruiterAPI.deleteCandidate(candidate.id);
      setCandidates((prev) => prev.filter((item) => item.id !== candidate.id));
      if (selectedCandidate?.id === candidate.id) {
        setSelectedCandidate(null);
        setShowCandidateModal(false);
      }
      setActionModal({
        label: 'Candidate deleted',
        title: 'Candidate account deleted',
        message: `${candidate.name}'s candidate account and related records have been deleted.`,
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        jobTitle: 'Candidate account',
        status: 'Deleted',
        tone: 'rose',
      });
      await Promise.all([refreshSummary(), loadCandidates(candidateSearch, candidateStatus)]);
      if (activeTab === 'analytics') {
        await loadAnalytics(analyticsPeriod);
      }
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to delete candidate account');
    } finally {
      setCandidateAction({ candidateId: null, action: '' });
    }
  };

  const handleScheduleInterview = async () => {
    if (!selectedCandidate?.latestApplicationId || !interviewForm.scheduled_at) {
      window.alert('Choose an interview date and time first.');
      return;
    }

    setSavingInterview(true);
    try {
      await recruiterAPI.scheduleInterview({
        application_id: selectedCandidate.latestApplicationId,
        interview_type: interviewForm.interview_type,
        scheduled_at: new Date(interviewForm.scheduled_at).toISOString(),
        duration_minutes: Number(interviewForm.duration_minutes) || 60,
        location: interviewForm.location || null,
        notes: interviewForm.notes || null,
      });
      await Promise.all([refreshSummary(), loadCandidates(candidateSearch, candidateStatus)]);
      setInterviewForm({
        interview_type: 'Technical',
        scheduled_at: '',
        duration_minutes: 60,
        location: '',
        notes: '',
      });
      setActionModal({
        label: 'Interview scheduled',
        title: 'Interview scheduled successfully',
        message: `${selectedCandidate?.name || 'The candidate'} now has an interview slot for ${selectedCandidate?.position || 'the selected role'}.`,
        candidateName: selectedCandidate?.name || 'Candidate',
        candidateEmail: selectedCandidate?.email || '',
        jobTitle: selectedCandidate?.position || 'Selected role',
        status: 'Scheduled',
        tone: 'green',
      });
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to schedule interview');
    } finally {
      setSavingInterview(false);
    }
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await recruiterAPI.updateProfile({
        full_name: profileForm.full_name,
        company_name: profileForm.company_name || null,
        company_description: profileForm.company_description || null,
        company_website: profileForm.company_website || null,
        company_size: profileForm.company_size || null,
        industry: profileForm.industry || null,
        job_title: profileForm.job_title || null,
        phone: profileForm.phone || null,
        linkedin_url: profileForm.linkedin_url || null,
      });
      setShowProfileModal(false);
      await refreshSummary();
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const response = await recruiterAPI.uploadPhoto(file);
      if (response.profile) applyProfile(response.profile);
      setActionModal({ label: 'Photo updated', title: 'Recruiter photo saved', message: 'Your new profile photo is now visible throughout the recruiter and candidate experience.', candidateName: response.profile?.full_name || 'Recruiter', candidateEmail: response.profile?.email || '', jobTitle: response.profile?.company_name || 'Recruiter profile', status: 'Updated', tone: 'green' });
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to upload profile photo');
    } finally {
      setUploadingPhoto(false);
      event.target.value = '';
    }
  };

  const handleCreateRecruiter = async (event) => {
    event.preventDefault();
    setSavingRecruiter(true);
    try {
      await recruiterAPI.createRecruiter(recruiterForm);
      setShowRecruiterModal(false);
      setRecruiterForm(emptyRecruiterForm);
      await loadRecruiters();
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to create recruiter');
    } finally {
      setSavingRecruiter(false);
    }
  };

  const handleRecruiterAccessToggle = async (recruiter) => {
    try {
      await recruiterAPI.updateRecruiterAccess(recruiter.id, !recruiter.is_active);
      await loadRecruiters();
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to update recruiter access');
    }
  };

  if (loading) {
    return <PageSkeleton label="Loading recruiter dashboard" />;
  }

  const navItems = [
    { id: 'overview', label: 'Overview', icon: ColorHomeIcon },
    { id: 'jobs', label: 'Jobs', icon: ColorJobsIcon },
    { id: 'candidates', label: 'Candidates', icon: ColorCandidatesIcon },
    { id: 'analytics', label: 'Analytics', icon: ColorAnalyticsIcon },
    { id: 'profile', label: 'Profile', icon: ColorProfileIcon },
    ...(isSuperRecruiter ? [{ id: 'recruiters', label: 'Recruiters', icon: ColorRecruitersIcon }] : []),
  ];

  const mobileNavItems = [
    { id: 'overview', label: 'Overview', icon: ColorHomeIcon },
    { id: 'jobs', label: 'Jobs', icon: ColorJobsIcon },
    { id: 'candidates', label: 'Candidates', icon: ColorCandidatesIcon },
    { id: 'analytics', label: 'Analytics', icon: ColorAnalyticsIcon },
    { id: 'profile', label: 'Profile', icon: ColorProfileIcon },
  ];

  const name = profile?.full_name || currentUser?.full_name || currentUser?.username || 'Recruiter';
  const editingJobReport = editingJob
    ? (jobAnalysis || []).find((report) => Number(report.jobId) === Number(editingJob.id))
    : null;
  const visibleJobs = jobs.filter((job) => jobStatusFilter === 'all' || job.status === jobStatusFilter);
  const visibleJobAnalysis = jobAnalysis.filter((job) => analyticsJobFilter === 'all' || String(job.jobId) === String(analyticsJobFilter));
  const visibleCandidateComparison = candidateComparison.filter((candidate) => {
    const matchesJob = analyticsJobFilter === 'all' || String(candidate.jobId) === String(analyticsJobFilter);
    const matchesStatus = analyticsCandidateStatus === 'all' || candidate.status === analyticsCandidateStatus;
    return matchesJob && matchesStatus;
  });
  const recruiterTourSteps = [
    { target: '#recruiter-action-required', title: 'Start with action required', message: 'Overview highlights applications awaiting screening, active roles, and decision-support reports.', onEnter: () => setActiveTab('overview') },
    { target: '#recruiter-jobs-tools', title: 'Create and manage jobs', message: 'Post structured jobs, use document autofill, search by Job ID, export data, and review application counts.', onEnter: () => setActiveTab('jobs') },
    { target: '#recruiter-candidates-tools', title: 'Manage the candidate pipeline', message: 'Search candidates, preview actual CVs, review application stages, and manage account access.', onEnter: () => setActiveTab('candidates') },
    { target: '#recruiter-analytics-tools', title: 'Compare evidence before deciding', message: 'Filter by job and status, compare Job ATS and assessment evidence, then approve or reject once.', onEnter: () => setActiveTab('analytics') },
    { target: '#recruiter-tour-button', title: 'Replay this tour anytime', message: 'The tour is optional and can be reopened from this button whenever needed.' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-cyan-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className={`hidden w-72 shrink-0 px-6 py-8 text-white lg:block ${sidebarGradient}`}>
          <div className="rounded-[28px] border border-white/20 bg-white/10 p-5 shadow-lg backdrop-blur">
            <p className="text-sm uppercase tracking-[0.24em] text-blue-100">Invenia AI</p>
            <h1 className="mt-3 text-2xl font-semibold">Recruiter Dashboard</h1>
            <p className="mt-2 text-sm text-blue-50/90">
              Manage jobs, review candidate flow, and control recruiter access from one clean workspace.
            </p>
          </div>

          <nav className="mt-8 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                id={`recruiter-nav-${item.id}`}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                  activeTab === item.id
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-blue-50 hover:bg-white/15'
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-8 rounded-[28px] border border-white/20 bg-white/10 p-5">
            <div className="flex items-center gap-3">
              <SparklesIcon className="h-6 w-6 text-yellow-200" />
              <div>
                <p className="text-sm font-semibold text-white">
                  {isSuperRecruiter ? 'Super Recruiter Access' : 'Recruiter Access'}
                </p>
                <p className="text-xs text-blue-100">{profile?.job_title || 'Recruiter'} at {profile?.company_name || 'Invenia AI'}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 px-4 py-3 text-sm font-medium text-blue-50 transition hover:bg-white/15"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            Logout
          </button>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-blue-100 bg-white/90 px-4 py-4 backdrop-blur lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-500">Hiring workspace</p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {activeTab === 'overview' && 'Recruitment Overview'}
                  {activeTab === 'jobs' && 'Jobs Management'}
                  {activeTab === 'candidates' && 'Candidates Pipeline'}
                  {activeTab === 'analytics' && 'Analytics & Insights'}
                  {activeTab === 'profile' && 'Recruiter Profile'}
                  {activeTab === 'recruiters' && 'Manage Recruiters'}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button id="recruiter-tour-button" type="button" onClick={() => setTourOpen(true)} className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100">Quick tour</button>
              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowProfileDropdown((prev) => !prev)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-lg shadow-indigo-200"
                >
                  <ProfileAvatar src={buildFileUrl(profile?.photo_url)} name={name} className="h-11 w-11" />
                </button>

                {showProfileDropdown && (
                  <ProfileMenu
                    profile={profile}
                    currentUser={currentUser}
                    isSuperRecruiter={isSuperRecruiter}
                    onClose={() => setShowProfileDropdown(false)}
                    onProfile={() => setActiveTab('profile')}
                    onAnalytics={() => setActiveTab('analytics')}
                    onRecruiters={() => setActiveTab('recruiters')}
                    onSettings={() => setShowProfileModal(true)}
                    onSupport={() => setActionModal({ label: 'Support', title: 'Need help?', message: 'Contact your Invenia administrator using your registered work email.', candidateName: name, candidateEmail: currentUser?.email, jobTitle: 'Recruiter workspace', status: 'Support guidance', tone: 'blue' })}
                    onLogout={handleLogout}
                  />
                )}
              </div>
              </div>
            </div>
          </header>

          <div className="px-4 py-6 pb-28 lg:px-8 lg:pb-8">
            {error && (
              <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <section>
              <KpiStrip items={[
                { label: 'Active Jobs', value: overview.analytics.activeJobs, icon: BriefcaseIcon, tone: 'bg-blue-50 text-blue-600' },
                { label: 'Total Candidates', value: overview.analytics.totalCandidates || 0, icon: UserGroupIcon, tone: 'bg-sky-50 text-sky-600' },
                { label: 'New Applications', value: overview.analytics.newApplications, icon: UserGroupIcon, tone: 'bg-emerald-50 text-emerald-600' },
                { label: 'Interviews', value: overview.analytics.interviewsScheduled, icon: CalendarDaysIcon, tone: 'bg-violet-50 text-violet-600' },
                { label: 'Hires', value: overview.analytics.hires, icon: CheckBadgeIcon, tone: 'bg-amber-50 text-amber-600' },
                { label: 'Time To Hire', value: `${overview.analytics.avgTimeToHire}d`, icon: ClockIcon, tone: 'bg-cyan-50 text-cyan-600' },
              ]} />
              <div className="mt-2 text-right"><ScoreHelp onClick={() => setShowScoreGlossary(true)} /></div>
            </section>

            {activeTab === 'overview' && (
              <section className="mt-8 space-y-6">
                <div id="recruiter-action-required" className="grid gap-4 sm:grid-cols-3">
                  <button type="button" onClick={() => { setCandidateStatus('screening'); setActiveTab('candidates'); }} className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-left"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Needs screening</p><p className="mt-2 text-3xl font-semibold text-slate-950">{overview.analytics.newApplications || 0}</p><p className="mt-1 text-sm text-slate-600">Open the exact pending application queue</p></button>
                  <button type="button" onClick={() => setActiveTab('analytics')} className="rounded-[24px] border border-blue-200 bg-blue-50 p-5 text-left"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Decision support</p><p className="mt-2 text-3xl font-semibold text-slate-950">{overview.analytics.totalApplications || 0}</p><p className="mt-1 text-sm text-slate-600">Open candidate reports</p></button>
                  <button type="button" onClick={() => setActiveTab('jobs')} className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-left"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Active hiring</p><p className="mt-2 text-3xl font-semibold text-slate-950">{overview.analytics.activeJobs || 0}</p><p className="mt-1 text-sm text-slate-600">Roles currently accepting candidates</p></button>
                </div>
                <div className={`rounded-[32px] p-8 text-white shadow-xl shadow-blue-200 ${sidebarGradient}`}>
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.24em] text-blue-100">Invenia AI Analysis Summary</p>
                      <h3 className="mt-3 text-3xl font-semibold">
                        {overview.analytics.totalApplications} applications across {overview.analytics.totalJobs} roles
                      </h3>
                      <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-50/90">
                        Candidate quality is averaging {overview.analytics.candidateQuality}% and your current hiring conversion is {overview.analytics.conversionRate}%.
                      </p>
                    </div>
                    <button type="button" onClick={() => setActiveTab('jobs')} className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50">
                      Manage Jobs
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                  <div className="rounded-[28px] border border-blue-100 bg-white shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                    <div className="border-b border-blue-100 px-6 py-5">
                      <h4 className="text-lg font-semibold text-slate-900">Recent Applications</h4>
                      <p className="mt-1 text-sm text-slate-500">Review the latest pipeline updates at a glance.</p>
                    </div>
                    <div className="divide-y divide-blue-50">
                      {overview.recentApplications.length === 0 ? (
                        <div className="px-6 py-10 text-center text-sm text-slate-500">No applications yet.</div>
                      ) : (
                        overview.recentApplications.map((application) => (
                          <div key={application.id} className="px-6 py-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div className="flex items-center gap-3">
                                <ProfileAvatar src={buildFileUrl(application.photoUrl)} name={application.name} className="h-12 w-12" />
                                <div><p className="text-lg font-semibold text-slate-900">{application.name}</p><p className="mt-1 text-sm text-slate-500">{application.position}</p><p className="mt-2 text-sm text-slate-500">Applied on {formatDate(application.appliedDate)}</p></div>
                              </div>
                              <div className="flex flex-col gap-3 lg:items-end">
                                <p className="text-sm font-semibold text-emerald-600">Match {application.matchScore}%</p>
                                <StatusBadge status={application.status} />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-[28px] border border-blue-100 bg-white shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                      <div className="border-b border-blue-100 px-6 py-5">
                        <h4 className="text-lg font-semibold text-slate-900">Active Jobs Snapshot</h4>
                      </div>
                      <div className="divide-y divide-blue-50">
                        {overview.activeJobs.length === 0 ? (
                          <div className="px-6 py-10 text-center text-sm text-slate-500">No active jobs yet.</div>
                        ) : (
                          overview.activeJobs.map((job) => (
                            <div key={job.id} className="px-6 py-5">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <button type="button" onClick={() => openJobDetails(job)} className="text-left font-semibold text-slate-900 transition hover:text-blue-700 hover:underline">{job.title}</button>
                                  <p className="mt-1 text-sm text-slate-500">{job.location}</p>
                                </div>
                                <p className="text-sm font-semibold text-blue-600">{job.applications} apps</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-blue-100 bg-white shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                      <div className="border-b border-blue-100 px-6 py-5">
                        <h4 className="text-lg font-semibold text-slate-900">Upcoming Interviews</h4>
                      </div>
                      <div className="divide-y divide-blue-50">
                        {overview.upcomingInterviews.length === 0 ? (
                          <div className="px-6 py-10 text-center text-sm text-slate-500">No upcoming interviews scheduled.</div>
                        ) : (
                          overview.upcomingInterviews.map((interview) => (
                            <div key={interview.id} className="px-6 py-5">
                              <p className="font-semibold text-slate-900">{interview.candidate}</p>
                              <p className="mt-1 text-sm text-slate-500">{interview.position}</p>
                              <p className="mt-2 text-sm text-slate-500">{formatDateTime(interview.time)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'jobs' && (
              <section className="mt-8 space-y-6">
                <div id="recruiter-jobs-tools" className="flex flex-col gap-4 rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_12px_35px_rgba(37,99,235,0.06)] lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative max-w-xl flex-1">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={jobSearch}
                      onChange={(event) => setJobSearch(event.target.value)}
                      placeholder="Search title, location, description, or Job ID"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-300"
                    />
                  </div>
                  <select value={jobStatusFilter} onChange={(event) => setJobStatusFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="all">All job statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/recruiter/jobs/new')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Post New Job
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportData('jobs')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    Export Jobs
                  </button>
                  <div className="hidden md:block"><ViewToggle value={jobViewMode} onChange={setJobViewMode} /></div>
                </div>

                {jobsLoading ? (
                  <div className="rounded-[28px] border border-blue-100 bg-white p-6 text-sm text-slate-500">Loading jobs...</div>
                ) : visibleJobs.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-blue-200 bg-white p-10 text-center text-sm text-slate-500">
                    No jobs found for the current search.
                  </div>
                ) : jobViewMode === 'grid' ? (
                  <div className="grid gap-5 xl:grid-cols-2">
                    {visibleJobs.map((job) => (
                      <RecruiterJobCard
                        key={job.id}
                        job={job}
                        onViewDetails={openJobDetails}
                        onAIOptimize={handleAIOptimize}
                        onDelete={handleDeleteJob}
                      />
                    ))}
                  </div>
                ) : (
                  <>
                  <div className="grid gap-5 md:hidden">{visibleJobs.map((job) => <RecruiterJobCard key={job.id} job={job} onViewDetails={openJobDetails} onAIOptimize={handleAIOptimize} onDelete={handleDeleteJob} />)}</div>
                  <div className="hidden overflow-x-auto rounded-[28px] border border-blue-100 bg-white shadow-[0_12px_35px_rgba(37,99,235,0.06)] md:block">
                    <table className="min-w-[1100px] w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                        <tr>
                          <th className="px-5 py-4">Job</th>
                          <th className="px-5 py-4">Location</th>
                          <th className="px-5 py-4">Type</th>
                          <th className="px-5 py-4">Salary</th>
                          <th className="px-5 py-4">Views</th>
                          <th className="px-5 py-4">Applied</th>
                          <th className="px-5 py-4">Match</th>
                          <th className="px-5 py-4">Status</th>
                          <th className="px-5 py-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleJobs.map((job) => (
                          <tr key={job.id} className="border-t border-slate-100 align-top">
                            <td className="px-5 py-4">
                              <JobIdChip value={job.publicJobId} className="mb-2" />
                              <button type="button" onClick={() => openJobDetails(job)} className="text-left font-semibold text-slate-900 hover:text-blue-700 hover:underline">{job.title}</button>
                              <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{job.experienceLevel || 'General role'}</p>
                            </td>
                            <td className="px-5 py-4 text-slate-600">{job.location}</td>
                            <td className="px-5 py-4 text-slate-600">{job.type}</td>
                            <td className="px-5 py-4 font-semibold text-emerald-700">{formatSalaryText(job.salary)}</td>
                            <td className="px-5 py-4 text-slate-600">{job.views || 0}</td>
                            <td className="px-5 py-4 text-slate-600">{job.appliedCount || job.applications || 0}</td>
                            <td className="px-5 py-4 font-semibold text-blue-700">{job.matchScore || 0}%</td>
                            <td className="px-5 py-4"><StatusBadge status={job.status} /></td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openJobDetails(job)}
                                  className="group relative rounded-full bg-blue-600 p-2 text-white hover:bg-blue-700"
                                  title="Details"
                                >
                                  <InformationCircleIcon className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAIOptimize(job)}
                                  className="group relative rounded-full bg-violet-500 p-2 text-white hover:bg-violet-600"
                                  title="Optimize"
                                >
                                  <SparklesIcon className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteJob(job)}
                                  className="group relative rounded-full bg-rose-500 p-2 text-white hover:bg-rose-600"
                                  title="Delete"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </section>
            )}

            {activeTab === 'candidates' && (
              <section className="mt-8 space-y-6">
                <div id="recruiter-candidates-tools" className="flex flex-col gap-4 rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_12px_35px_rgba(37,99,235,0.06)] lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative max-w-xl flex-1">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={candidateSearch}
                      onChange={(event) => setCandidateSearch(event.target.value)}
                      placeholder="Search by candidate name, email, location, or skills"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-300"
                    />
                  </div>
                  <select value={candidateStatus} onChange={(event) => setCandidateStatus(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    {['all', 'screening', 'available', 'applied', 'new', 'inactive'].map((status) => (
                      <option key={status} value={status}>
                        {status === 'screening' ? 'Needs screening' : status === 'new' ? 'No applications yet' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleExportData('candidates')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    Export Candidates
                  </button>
                  <div className="hidden md:block"><ViewToggle value={candidateViewMode} onChange={setCandidateViewMode} /></div>
                </div>

                {candidatesLoading ? (
                  <div className="rounded-[28px] border border-blue-100 bg-white p-6 text-sm text-slate-500">Loading candidates...</div>
                ) : candidates.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-blue-200 bg-white p-10 text-center text-sm text-slate-500">
                    No candidates matched the current search or filter.
                  </div>
                ) : candidateViewMode === 'grid' ? (
                  <div className="grid gap-5 xl:grid-cols-2">
                    {candidates.map((candidate) => (
                      <div key={candidate.id} className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <ProfileAvatar src={buildFileUrl(candidate.photoUrl)} name={candidate.name} className="h-14 w-14" />
                            <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button type="button" onClick={() => openCandidateDetails(candidate)} className="text-left text-xl font-semibold text-slate-900 transition hover:text-blue-700 hover:underline">{candidate.name}</button>
                              <StatusBadge status={candidate.status} />
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${candidate.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {candidate.isActive ? 'Account active' : 'Account inactive'}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">{candidate.title || 'Candidate'}</p>
                            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
                              <span className="flex items-center gap-1">
                                <EnvelopeIcon className="h-4 w-4 text-blue-500" />
                                {candidate.email}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPinIcon className="h-4 w-4 text-rose-500" />
                                {candidate.location || 'Location not added'}
                              </span>
                            </div>
                            </div>
                          </div>
                          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Match</p>
                            <p className="mt-1 text-xl font-semibold text-emerald-700">{candidate.matchScore}%</p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-3">
                          {[
                            ['Experience', `${candidate.experienceYears || 0}y`],
                            ['Job ATS', candidate.jobAtsScore ? `${candidate.jobAtsScore}%` : 'Pending'],
                            ['Stage', candidate.workflowStage || 'profile'],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                              <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          {(candidate.skills || []).slice(0, 5).map((skill) => (
                            <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                              {skill}
                            </span>
                          ))}
                        </div>

                        <div className="mt-6 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => openCandidateDetails(candidate)}
                            className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            View Details
                          </button>
                          {candidate.resumeUrl && (
                            <button type="button" onClick={() => handleOpenResume(candidate)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                              Preview CV
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={candidateAction.candidateId === candidate.id}
                            onClick={() => handleCandidateAccessUpdate(candidate, !candidate.isActive)}
                            className={`rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                              candidate.isActive
                                ? 'border border-amber-200 bg-amber-50 text-amber-700'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {candidateAction.candidateId === candidate.id && ['activate', 'deactivate'].includes(candidateAction.action)
                              ? 'Updating...'
                              : candidate.isActive
                                ? 'Deactivate'
                                : 'Activate'}
                          </button>
                          <button
                            type="button"
                            disabled={candidateAction.candidateId === candidate.id}
                            onClick={() => handleDeleteCandidate(candidate)}
                            className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {candidateAction.candidateId === candidate.id && candidateAction.action === 'delete' ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-[28px] border border-blue-100 bg-white shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                    <table className="min-w-[1150px] w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                        <tr>
                          <th className="px-5 py-4">Candidate</th>
                          <th className="px-5 py-4">Contact</th>
                          <th className="px-5 py-4">Status</th>
                          <th className="px-5 py-4">Account</th>
                          <th className="px-5 py-4">Match</th>
                          <th className="px-5 py-4">ATS</th>
                          <th className="px-5 py-4">Applications</th>
                          <th className="px-5 py-4">Stage</th>
                          <th className="px-5 py-4">Invenia AI Analysis</th>
                          <th className="px-5 py-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((candidate) => (
                          <tr key={candidate.id} className="border-t border-slate-100">
                            <td className="px-5 py-4">
                              <div className="flex items-start gap-3"><ProfileAvatar src={buildFileUrl(candidate.photoUrl)} name={candidate.name} className="h-11 w-11" /><div><button type="button" onClick={() => openCandidateDetails(candidate)} className="text-left font-semibold text-slate-900 hover:text-blue-700 hover:underline">{candidate.name}</button><p className="mt-1 text-xs text-slate-500">{candidate.title || 'Candidate'}</p></div></div>
                            </td>
                            <td className="px-5 py-4 text-slate-600">
                              <p>{candidate.email}</p>
                              <p className="mt-1 text-xs text-slate-500">{candidate.location || 'Location not added'}</p>
                            </td>
                            <td className="px-5 py-4"><StatusBadge status={candidate.status} /></td>
                            <td className="px-5 py-4">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${candidate.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {candidate.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-5 py-4 font-semibold text-emerald-700">{candidate.matchScore || 0}%</td>
                            <td className="px-5 py-4 text-slate-600">{candidate.jobAtsScore ? `${candidate.jobAtsScore}%` : candidate.profileAtsScore ? `${candidate.profileAtsScore}%` : 'Pending'}</td>
                            <td className="px-5 py-4 text-slate-600">{candidate.applicationCount || 0}</td>
                            <td className="px-5 py-4 text-slate-600">{candidate.workflowStage || 'profile'}</td>
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() => setAnalysisCandidate(candidate)}
                                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                See analysis
                              </button>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openCandidateDetails(candidate)}
                                  className="group relative rounded-full bg-blue-600 p-2 text-white hover:bg-blue-700"
                                  title="Details"
                                >
                                  <InformationCircleIcon className="h-4 w-4" />
                                </button>
                                {candidate.resumeUrl && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenResume(candidate)}
                                    className="group relative rounded-full border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                                    title="CV"
                                  >
                                    <DocumentIcon className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={candidateAction.candidateId === candidate.id}
                                  onClick={() => handleCandidateAccessUpdate(candidate, !candidate.isActive)}
                                  className={`group relative rounded-full p-2 text-white disabled:opacity-60 ${
                                    candidate.isActive
                                      ? 'bg-amber-500 hover:bg-amber-600'
                                      : 'bg-emerald-600 hover:bg-emerald-700'
                                  }`}
                                  title={candidate.isActive ? 'Deactivate' : 'Activate'}
                                >
                                  {candidate.isActive ? <PowerIcon className="h-4 w-4" /> : <UserPlusIcon className="h-4 w-4" />}
                                </button>
                                <button
                                  type="button"
                                  disabled={candidateAction.candidateId === candidate.id}
                                  onClick={() => handleDeleteCandidate(candidate)}
                                  className="group relative rounded-full bg-rose-600 p-2 text-white disabled:opacity-60 hover:bg-rose-700"
                                  title="Delete"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'analytics' && (
              <section className="mt-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                  {[
                    ['all', 'All History'],
                    ['week', 'Week'],
                    ['month', 'Month'],
                    ['year', 'Year'],
                  ].map(([period, label]) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setAnalyticsPeriod(period)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        analyticsPeriod === period ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleExportData('analytics')} className="inline-flex items-center gap-2 rounded-2xl border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700">
                      <ArrowDownTrayIcon className="h-5 w-5" />
                      Export Analytics
                    </button>
                    <button type="button" onClick={() => handleExportData('applications')} className="inline-flex items-center gap-2 rounded-2xl border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700">
                      <ArrowDownTrayIcon className="h-5 w-5" />
                      Export Applications
                    </button>
                  </div>
                </div>

                <div id="recruiter-analytics-tools" className="grid gap-3 rounded-[24px] border border-blue-100 bg-white p-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Job<select value={analyticsJobFilter} onChange={(event) => setAnalyticsJobFilter(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal normal-case tracking-normal text-slate-800"><option value="all">All jobs</option>{jobAnalysis.map((job) => <option key={job.jobId} value={job.jobId}>{job.publicJobId ? `${job.publicJobId} - ` : ''}{job.title}</option>)}</select></label>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Candidate status<select value={analyticsCandidateStatus} onChange={(event) => setAnalyticsCandidateStatus(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal normal-case tracking-normal text-slate-800"><option value="all">All statuses</option>{['pending', 'approved', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: 'Conversion Rate', value: `${analytics.conversionRate}%`, icon: SparklesIcon },
                    { label: 'Candidate Quality', value: `${analytics.candidateQuality}%`, icon: UserGroupIcon },
                    { label: 'Diversity Score', value: `${analytics.diversityScore}%`, icon: BuildingOfficeIcon },
                    { label: 'Time To Hire', value: `${analytics.avgTimeToHire} days`, icon: ClockIcon },
                  ].map((card) => (
                    <div key={card.label} className="rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                      <div className="inline-flex rounded-2xl bg-slate-100 p-3 text-slate-700">
                        <card.icon className="h-5 w-5" />
                      </div>
                      <p className="mt-4 text-2xl font-semibold text-slate-900">{analyticsLoading ? '...' : card.value}</p>
                      <p className="mt-1 text-sm text-slate-500">{card.label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <ScoreBadge label="Avg Job ATS" value={analyticsLoading ? '...' : analytics.averageJobAtsScore} tone="border-blue-100 bg-blue-50 text-blue-800" />
                  <ScoreBadge label="Avg Final Score" value={analyticsLoading ? '...' : analytics.averageFinalScore} tone="border-emerald-100 bg-emerald-50 text-emerald-700" />
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Jobs analyzed</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{analyticsLoading ? '...' : analytics.totalJobsAnalyzed || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Candidate reports</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{analyticsLoading ? '...' : analytics.totalCandidateReports || 0}</p>
                  </div>
                </div>

                <div className="rounded-[32px] border border-blue-100 bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-6 text-white shadow-[0_22px_55px_rgba(15,23,42,0.18)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Invenia AI Analysis</p>
                      <h4 className="mt-3 text-2xl font-semibold">Job-wise hiring command center</h4>
                      <p className="mt-3 max-w-4xl text-sm leading-7 text-blue-50/85">
                        {aiInsights.summary || 'ATS, test, coding, and interview reports will appear here as candidates complete applications.'}
                      </p>
                    </div>
                    <ChartBarIcon className="h-12 w-12 text-blue-200" />
                  </div>
                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                      <p className="text-sm font-semibold text-blue-100">Recommended actions</p>
                      <div className="mt-3 space-y-2 text-sm text-blue-50">
                        {(aiInsights.recommendations || []).length > 0 ? (
                          aiInsights.recommendations.map((item) => <p key={item}>- {item}</p>)
                        ) : (
                          <p>- Wait for candidate reports to generate recommendations.</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                      <p className="text-sm font-semibold text-blue-100">Risk flags</p>
                      <div className="mt-3 space-y-2 text-sm text-blue-50">
                        {(aiInsights.riskFlags || []).length > 0 ? (
                          aiInsights.riskFlags.map((item) => <p key={item}>- {item}</p>)
                        ) : (
                          <p>- No major hiring risks detected from current data.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                  <h4 className="text-lg font-semibold text-slate-900">Hiring Funnel</h4>
                  <div className="mt-6 space-y-5">
                    {(analytics.hiringFunnel || []).map((stage) => (
                      <div key={stage.stage}>
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span>{stage.stage}</span>
                          <span>{stage.count} ({stage.percentage}%)</span>
                        </div>
                        <div className="mt-2 h-3 rounded-full bg-slate-100">
                          <div className="h-3 rounded-full bg-blue-600" style={{ width: `${stage.percentage}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <DistributionBars title="CV Evidence Match Distribution" items={scoreDistributions.jobAts} />
                  <DistributionBars title="Overall Assessment Score Distribution" items={scoreDistributions.final} />
                </div>

                <div className="rounded-[32px] border border-blue-100 bg-white p-6 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">Job analysis</p>
                      <h4 className="mt-2 text-2xl font-semibold text-slate-900">Every job, every candidate signal</h4>
                      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
                        CV evidence match measures evidence for this exact role: 50% requirements, 20% skills/tools, 20% relevant experience, and 10% responsibility readiness. Overall assessment score remains awaiting until the compulsory interview is complete, then combines CV evidence and enabled rounds using base weights of 30%, 10%, 15%, 20%, and 25% for CV evidence, aptitude, technical, coding, and interview. Grammar and formatting are excluded.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-5 xl:grid-cols-2">
                    {visibleJobAnalysis.length > 0 ? (
                      visibleJobAnalysis.map((job) => (
                        <div key={job.jobId} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <JobIdChip value={job.publicJobId} className="mb-2" />
                              <button type="button" onClick={() => openJobDetails(job)} className="text-left text-xl font-semibold text-slate-900 transition hover:text-blue-700 hover:underline">{job.title}</button>
                              <p className="mt-1 text-sm text-slate-500">{job.location} | {job.type} | {job.experienceLevel || 'General'}</p>
                            </div>
                            <StatusBadge status={job.status} />
                          </div>
                          <p className="mt-4 text-sm leading-6 text-slate-600">{job.fitSummary}</p>
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <ScoreBadge label="Avg ATS" value={job.avgJobAtsScore} tone="border-blue-100 bg-white text-blue-800" />
                            <ScoreBadge label="Avg final" value={job.avgFinalScore} tone="border-emerald-100 bg-white text-emerald-700" />
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Applicants</p>
                              <p className="mt-1 text-xl font-semibold text-slate-900">{job.applicantCount}</p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Common matches</p>
                              <div className="mt-3 space-y-2 text-sm text-slate-600">
                                {(job.commonMatchedRequirements || []).length > 0 ? (
                                  job.commonMatchedRequirements.map((item) => <p key={item.text}>- {item.text} ({item.count})</p>)
                                ) : (
                                  <p>No matched requirement trend yet.</p>
                                )}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-rose-100 bg-white p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Common gaps</p>
                              <div className="mt-3 space-y-2 text-sm text-slate-600">
                                {(job.commonMissingRequirements || []).length > 0 ? (
                                  job.commonMissingRequirements.map((item) => <p key={item.text}>- {item.text} ({item.count})</p>)
                                ) : (
                                  <p>No repeated missing requirement yet.</p>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Top candidates</p>
                            <div className="mt-3 space-y-3">
                              {(job.topCandidates || []).length > 0 ? (
                                job.topCandidates.map((candidate) => (
                                  <div key={candidate.applicationId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                                    <div className="flex items-center gap-3">
                                      <ProfileAvatar src={buildFileUrl(candidate.candidatePhotoUrl)} name={candidate.candidateName} className="h-10 w-10" />
                                      <div>
                                      <p className="font-semibold text-slate-900">{candidate.candidateName}</p>
                                      <p className="text-slate-500">{candidate.recruiterDecision}</p>
                                      <div className="mt-2">
                                        <StatusBadge status={candidate.status || 'pending'} />
                                      </div>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">ATS {candidate.jobAtsScore}%</span>
                                      <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">Final {candidate.finalScore}%</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {candidate.resumeUrl && (
                                        <button type="button" onClick={() => handleOpenResume(candidate)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                          Preview CV
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        disabled={applicationAction.applicationId === candidate.applicationId || isFinalApplicationDecision(candidate.status)}
                                        onClick={() => handleApplicationStatusUpdate(candidate.applicationId, 'approved')}
                                        className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:bg-slate-300"
                                      >
                                        {applicationAction.applicationId === candidate.applicationId ? 'Updating...' : candidate.status === 'approved' ? 'Approved' : candidate.status === 'rejected' ? 'Rejected' : 'Approve'}
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-slate-500">No candidates for this job in the selected period.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                        No job analysis is available yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[32px] border border-blue-100 bg-white p-6 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h4 className="text-2xl font-semibold text-slate-900">Candidate comparison</h4>
                      <p className="mt-2 text-sm leading-7 text-slate-500">
                        Compare candidates within their applied jobs using job ATS, assessment average, interview score, and final score.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[5, 10, 20].map((limit) => (
                        <button
                          key={limit}
                          type="button"
                          onClick={() => setComparisonLimit(limit)}
                          className={`rounded-full px-4 py-2 text-sm font-semibold ${
                            comparisonLimit === limit ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          Top {limit}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Candidate</th>
                          <th className="px-4 py-3">Job</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">CV evidence match</th>
                          <th className="px-4 py-3">Tests</th>
                          <th className="px-4 py-3">Interview</th>
                          <th className="px-4 py-3">Overall assessment</th>
                          <th className="px-4 py-3">Invenia AI Analysis</th>
                          <th className="px-4 py-3">Decision</th>
                          <th className="px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCandidateComparison.length > 0 ? (
                          visibleCandidateComparison.slice(0, comparisonLimit).map((candidate) => (
                            <tr key={candidate.applicationId} className="border-t border-slate-100">
                              <td className="px-4 py-4">
                                <div className="flex items-start gap-3"><ProfileAvatar src={buildFileUrl(candidate.candidatePhotoUrl)} name={candidate.candidateName} className="h-11 w-11" /><div><p className="font-semibold text-slate-900">{candidate.candidateName}</p><p className="text-xs text-slate-500">{candidate.candidateEmail}</p><p className="mt-1 text-xs text-slate-500">{candidate.candidateTitle || 'Candidate'} {candidate.candidateExperienceYears ? `| ${candidate.candidateExperienceYears}y` : ''}</p></div></div>
                              </td>
                              <td className="px-4 py-4 text-slate-600">{candidate.jobTitle}</td>
                              <td className="px-4 py-4"><StatusBadge status={candidate.status || 'pending'} /></td>
                              <td className="px-4 py-4 font-semibold text-blue-700">{candidate.jobAtsScore}%</td>
                              <td className="px-4 py-4 text-slate-600">{candidate.assessmentAverage || 0}%</td>
                              <td className="px-4 py-4 text-slate-600">{candidate.interviewScore != null ? `${candidate.interviewScore}%` : 'Pending'}</td>
                              <td className="px-4 py-4 font-semibold text-emerald-700">{candidate.finalScore == null ? 'Awaiting assessment' : `${candidate.finalScore}%`}</td>
                              <td className="px-4 py-4">
                                <button
                                  type="button"
                                  onClick={() => setAnalysisCandidate(candidate)}
                                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                >
                                  See analysis
                                </button>
                              </td>
                              <td className="px-4 py-4">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{candidate.recruiterDecision}</span>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-2">
                                  {candidate.resumeUrl && (
                                    <button type="button" onClick={() => handleOpenResume(candidate)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                      CV
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={applicationAction.applicationId === candidate.applicationId || isFinalApplicationDecision(candidate.status)}
                                    onClick={() => handleApplicationStatusUpdate(candidate.applicationId, 'approved')}
                                    className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:bg-slate-300"
                                  >
                                    {applicationAction.applicationId === candidate.applicationId && applicationAction.status === 'approved'
                                      ? 'Approving...'
                                      : candidate.status === 'approved'
                                        ? 'Approved'
                                        : 'Approve'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={applicationAction.applicationId === candidate.applicationId || isFinalApplicationDecision(candidate.status)}
                                    onClick={() => handleApplicationStatusUpdate(candidate.applicationId, 'rejected')}
                                    className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 disabled:bg-slate-100 disabled:text-slate-400"
                                  >
                                    {applicationAction.applicationId === candidate.applicationId && applicationAction.status === 'rejected'
                                      ? 'Rejecting...'
                                      : candidate.status === 'rejected'
                                        ? 'Rejected'
                                        : 'Reject'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="10" className="px-4 py-8 text-center text-slate-500">No candidate comparisons available yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'profile' && profile && (
              <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                <div className="space-y-6">
                  <div className={`rounded-[32px] p-8 text-white shadow-xl shadow-blue-200 ${sidebarGradient}`}>
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-5">
                        <ProfileAvatar src={buildFileUrl(profile.photo_url)} name={profile.full_name} className="h-24 w-24 border-4 border-white/30" textClassName="text-2xl" />
                        <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-blue-100">Recruiter Profile</p>
                        <h3 className="mt-3 text-3xl font-semibold">{profile.full_name}</h3>
                        <p className="mt-2 text-blue-50/90">{profile.job_title || 'Recruiter'}</p>
                        <p className="mt-1 text-sm text-blue-100">{profile.company_name}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setShowProfileModal(true)} className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50">
                        Edit Profile
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                    <h4 className="text-lg font-semibold text-slate-900">Company Snapshot</h4>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {profile.company_description || 'Add your company story so candidates understand the team behind each role.'}
                    </p>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      {[
                        ['Website', profile.company_website || 'Not added'],
                        ['Industry', profile.industry || 'Not added'],
                        ['Company Size', profile.company_size || 'Not added'],
                        ['Phone', profile.phone || 'Not added'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                          <p className="mt-2 text-sm text-slate-800">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                    <h4 className="text-lg font-semibold text-slate-900">Recruiter Metrics</h4>
                    <div className="mt-5 space-y-4">
                      {[
                        ['Jobs Posted', profile.stats?.jobs_posted || 0],
                        ['Active Jobs', profile.stats?.active_jobs || 0],
                        ['Applications Received', profile.stats?.applications_received || 0],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-blue-200 bg-blue-50 p-6 shadow-sm">
                    <h4 className="text-lg font-semibold text-slate-900">Access Level</h4>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {profile.is_super_recruiter
                        ? 'This account can create recruiters, enable or disable access, and manage the full recruiting workspace.'
                        : 'This account can manage jobs, candidates, analytics, and its own recruiter profile.'}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'recruiters' && isSuperRecruiter && (
              <section className="mt-8 space-y-6">
                <div className="flex flex-col gap-4 rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_12px_35px_rgba(37,99,235,0.06)] lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">Recruiter Access Management</h3>
                    <p className="mt-1 text-sm text-slate-500">Create recruiter accounts and control who can sign in to the recruiter dashboard.</p>
                  </div>
                  <button type="button" onClick={() => setShowRecruiterModal(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
                    <UserPlusIcon className="h-5 w-5" />
                    Add Recruiter
                  </button>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  {recruitersLoading ? (
                    <div className="rounded-[28px] border border-blue-100 bg-white p-6 text-sm text-slate-500">Loading recruiters...</div>
                  ) : recruiters.length === 0 ? (
                    <div className="xl:col-span-2 rounded-[28px] border border-dashed border-blue-200 bg-white p-10 text-center text-sm text-slate-500">
                      No recruiters created yet.
                    </div>
                  ) : (
                    recruiters.map((recruiter) => (
                      <div key={recruiter.id} className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-semibold text-slate-900">{recruiter.full_name || recruiter.username}</h3>
                              {recruiter.is_super_recruiter && (
                                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                                  Super Recruiter
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-slate-500">{recruiter.email}</p>
                            <p className="mt-1 text-sm text-slate-500">{recruiter.profile.job_title} at {recruiter.profile.company_name}</p>
                          </div>
                          <StatusBadge status={recruiter.is_active ? 'active' : 'inactive'} />
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Jobs Posted</p>
                            <p className="mt-2 text-lg font-semibold text-slate-900">{recruiter.stats.jobs_posted}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Applications</p>
                            <p className="mt-2 text-lg font-semibold text-slate-900">{recruiter.stats.applications_received}</p>
                          </div>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={recruiter.is_super_recruiter}
                            onClick={() => handleRecruiterAccessToggle(recruiter)}
                            className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                              recruiter.is_super_recruiter
                                ? 'cursor-not-allowed border border-slate-200 text-slate-400'
                                : recruiter.is_active
                                  ? 'bg-rose-500 text-white hover:bg-rose-600'
                                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
                            }`}
                          >
                            {recruiter.is_super_recruiter ? 'Protected Account' : recruiter.is_active ? 'Disable Access' : 'Enable Access'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-blue-100 bg-white/95 px-4 py-2 backdrop-blur lg:hidden">
        <div className="flex items-center justify-around">
          {mobileNavItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex min-w-[68px] flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                activeTab === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-400'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <RecruiterActionModal notice={actionModal} onClose={() => setActionModal(null)} />

      {showCandidateModal && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[32px] bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <ProfileAvatar src={buildFileUrl(selectedCandidate.photoUrl)} name={selectedCandidate.name} className="h-16 w-16" textClassName="text-lg" />
                <div>
                <p className="text-sm font-medium text-blue-500">Candidate Profile</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedCandidate.name}</h3>
                </div>
              </div>
              <button type="button" onClick={() => setShowCandidateModal(false)} className="rounded-full border border-slate-200 p-2 text-slate-500">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
              <div className="space-y-6">
                  <div className="rounded-[28px] border border-blue-100 bg-slate-50 p-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge status={selectedCandidate.status} />
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedCandidate.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {selectedCandidate.isActive ? 'Account active' : 'Account inactive'}
                      </span>
                      <p className="text-sm font-semibold text-emerald-600">Profile match {selectedCandidate.matchScore}%</p>
                      <p className="text-sm font-semibold text-blue-600">CV evidence match {selectedCandidate.jobAtsScore ? `${selectedCandidate.jobAtsScore}%` : 'Pending'}</p>
                      <p className="text-sm font-semibold text-violet-600">Resume readiness {selectedCandidate.atsScore ? `${selectedCandidate.atsScore}%` : 'Pending'}</p>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-600">
                      {selectedCandidate.bio || 'This candidate has not added a professional summary yet.'}
                    </p>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {[
                        ['Current Title', selectedCandidate.title || 'Not provided'],
                        ['Experience', `${selectedCandidate.experienceYears || 0} years`],
                        ['Email', selectedCandidate.email],
                        ['Location', selectedCandidate.location || 'Not provided'],
                        ['Workflow Stage', selectedCandidate.workflowStage || 'profile'],
                        ['CV Evidence Match', selectedCandidate.jobAtsScore ? `${selectedCandidate.jobAtsScore}%` : 'Pending'],
                        ['Overall Assessment', selectedCandidate.latestApplicationWorkflow?.interview?.score == null ? 'Awaiting interview' : `${selectedCandidate.finalScore || 0}%`],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                          <p className="mt-2 text-sm text-slate-800">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {selectedCandidate.skills.map((skill) => (
                      <span key={skill} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                  {selectedCandidate.resumeUrl && (
                    <button type="button" onClick={() => handleOpenResume(selectedCandidate)} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                      <DocumentTextIcon className="h-5 w-5" />
                      Preview Candidate CV
                    </button>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={candidateAction.candidateId === selectedCandidate.id}
                      onClick={() => handleCandidateAccessUpdate(selectedCandidate, !selectedCandidate.isActive)}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                        selectedCandidate.isActive
                          ? 'border border-amber-200 bg-amber-50 text-amber-700'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {candidateAction.candidateId === selectedCandidate.id && ['activate', 'deactivate'].includes(candidateAction.action)
                        ? 'Updating...'
                        : selectedCandidate.isActive
                          ? 'Deactivate account'
                          : 'Activate account'}
                    </button>
                    <button
                      type="button"
                      disabled={candidateAction.candidateId === selectedCandidate.id}
                      onClick={() => handleDeleteCandidate(selectedCandidate)}
                      className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {candidateAction.candidateId === selectedCandidate.id && candidateAction.action === 'delete' ? 'Deleting...' : 'Delete account'}
                    </button>
                  </div>
                </div>

                {selectedCandidate.latestApplicationId && (
                  <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
                    <h4 className="text-lg font-semibold text-slate-900">Application Workflow</h4>
                    <p className="mt-2 text-sm text-slate-500">Latest application: {selectedCandidate.latestJobTitle || 'Current pipeline item'}</p>
                    {selectedCandidate.latestApplicationWorkflow && (
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {[
                          ['Job ATS', selectedCandidate.latestApplicationWorkflow.jobAtsScore ? `${selectedCandidate.latestApplicationWorkflow.jobAtsScore}%` : 'Pending'],
                          ['Aptitude', selectedCandidate.latestApplicationWorkflow.aptitude?.percentage ? `${selectedCandidate.latestApplicationWorkflow.aptitude.percentage}%` : 'Pending'],
                          ['Technical', selectedCandidate.latestApplicationWorkflow.technical?.percentage ? `${selectedCandidate.latestApplicationWorkflow.technical.percentage}%` : 'Pending'],
                          ['Coding', selectedCandidate.latestApplicationWorkflow.coding?.score ? `${selectedCandidate.latestApplicationWorkflow.coding.score}%` : 'Pending'],
                          ['Interview', selectedCandidate.latestApplicationWorkflow.interview?.score ? `${selectedCandidate.latestApplicationWorkflow.interview.score}%` : 'Pending'],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                            <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedCandidate.latestApplicationWorkflow?.jobAts && (
                      <div className="mt-5 rounded-[28px] border border-blue-200 bg-blue-50/80 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Job-specific ATS report</p>
                            <h5 className="mt-2 text-lg font-semibold text-slate-900">
                              {selectedCandidate.latestApplicationWorkflow.jobAts?.recommendation || 'Role-fit analysis'}
                            </h5>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {selectedCandidate.latestApplicationWorkflow.jobAts?.summary || 'This report compares the CV against the job requirements only.'}
                            </p>
                          </div>
                          <span className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-blue-700">
                            ATS {selectedCandidate.latestApplicationWorkflow.jobAtsScore || selectedCandidate.latestApplicationWorkflow.jobAts?.score || 0}%
                          </span>
                        </div>
                        <div className="mt-5 grid gap-4 md:grid-cols-3">
                          {[
                            ['Matched', selectedCandidate.latestApplicationWorkflow.jobAts?.requirement_match?.matched || 0],
                            ['Partial', selectedCandidate.latestApplicationWorkflow.jobAts?.requirement_match?.partial || 0],
                            ['Missing', selectedCandidate.latestApplicationWorkflow.jobAts?.requirement_match?.missing || 0],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl bg-white p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                              <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Matched requirements</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                              {(selectedCandidate.latestApplicationWorkflow.jobAts?.matched_requirements || []).length > 0 ? (
                                selectedCandidate.latestApplicationWorkflow.jobAts.matched_requirements.map((item) => <p key={item}>- {item}</p>)
                              ) : (
                                <p>No direct matches listed.</p>
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Missing requirements</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                              {(selectedCandidate.latestApplicationWorkflow.jobAts?.missing_requirements || []).length > 0 ? (
                                selectedCandidate.latestApplicationWorkflow.jobAts.missing_requirements.map((item) => <p key={item}>- {item}</p>)
                              ) : (
                                <p>No missing requirements listed.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="mt-5 flex flex-wrap gap-3">
                      <select
                        value={candidateStatusDraft}
                        disabled={isFinalApplicationDecision(selectedCandidate.status)}
                        onChange={(event) => setCandidateStatusDraft(event.target.value)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {['pending', 'approved', 'reviewed', 'shortlisted', 'interview', 'offer', 'rejected', 'hired'].map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={isFinalApplicationDecision(selectedCandidate.status)}
                        onClick={() => handleApplicationStatusUpdate(selectedCandidate.latestApplicationId, candidateStatusDraft)}
                        className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
                      >
                        {isFinalApplicationDecision(selectedCandidate.status) ? 'Final decision locked' : 'Update Status'}
                      </button>
                    </div>
                    {selectedCandidate.latestApplicationWorkflow?.interview && (
                      <div className="mt-5 rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Invenia AI Analysis: Interview Report</p>
                            <h5 className="mt-2 text-lg font-semibold text-slate-900">
                              {selectedCandidate.latestApplicationWorkflow.interview?.report?.decision || 'Review'}
                            </h5>
                            <p className="mt-1 text-sm text-slate-600">
                              {selectedCandidate.latestApplicationWorkflow.interview?.report?.summary || 'The interview report will appear once the candidate completes the three-question session.'}
                            </p>
                          </div>
                          <span className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-emerald-700">
                            Score {selectedCandidate.latestApplicationWorkflow.interview?.report?.overall_score ?? selectedCandidate.latestApplicationWorkflow.interview?.score ?? 0}%
                          </span>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Strengths</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                              {(selectedCandidate.latestApplicationWorkflow.interview?.report?.strengths || []).length > 0 ? (
                                selectedCandidate.latestApplicationWorkflow.interview.report.strengths.map((item) => (
                                  <p key={item}>• {item}</p>
                                ))
                              ) : (
                                <p>No strengths recorded yet.</p>
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Gaps</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                              {(selectedCandidate.latestApplicationWorkflow.interview?.report?.gaps || []).length > 0 ? (
                                selectedCandidate.latestApplicationWorkflow.interview.report.gaps.map((item) => (
                                  <p key={item}>• {item}</p>
                                ))
                              ) : (
                                <p>No gaps recorded yet.</p>
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Risk Flags</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                              {(selectedCandidate.latestApplicationWorkflow.interview?.report?.risk_flags || []).length > 0 ? (
                                selectedCandidate.latestApplicationWorkflow.interview.report.risk_flags.map((item) => (
                                  <p key={item}>• {item}</p>
                                ))
                              ) : (
                                <p>No risk flags recorded yet.</p>
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Proctoring</p>
                            <p className="mt-3 text-sm text-slate-700">
                              {selectedCandidate.latestApplicationWorkflow.interview?.report?.proctoring_summary
                                || `Warnings: ${selectedCandidate.latestApplicationWorkflow.interview?.proctoring?.warnings || 0}`}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recommendations</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-700">
                              {(selectedCandidate.latestApplicationWorkflow.interview?.report?.recommendations || []).length > 0 ? (
                                selectedCandidate.latestApplicationWorkflow.interview.report.recommendations.map((item) => (
                                  <p key={item}>• {item}</p>
                                ))
                              ) : (
                                <p>No recommendations captured yet.</p>
                              )}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Question Analysis</p>
                            <div className="mt-3 space-y-3 text-sm text-slate-700">
                              {(selectedCandidate.latestApplicationWorkflow.interview?.report?.question_analysis || []).length > 0 ? (
                                selectedCandidate.latestApplicationWorkflow.interview.report.question_analysis.map((item, index) => (
                                  <div key={`${item.question || index}-${index}`} className="rounded-2xl bg-slate-50 p-3">
                                    <p className="font-semibold text-slate-900">Q{index + 1}: {item.question || 'Question analysis'}</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                                      Score {item.score ?? 'N/A'} | {item.answer_quality || 'Review'}
                                    </p>
                                    <p className="mt-2 text-sm text-slate-700">{item.notes || 'No extra notes provided.'}</p>
                                  </div>
                                ))
                              ) : (
                                <p>No per-question analysis captured yet.</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {((selectedCandidate.latestApplicationWorkflow.interview?.turns || []).length > 0
                          || selectedCandidate.latestApplicationWorkflow.interview?.transcript) && (
                          <div className="mt-5 rounded-2xl bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Captured Q&A / Transcript</p>
                            <div className="mt-3 space-y-3 text-sm text-slate-700">
                              {(selectedCandidate.latestApplicationWorkflow.interview?.turns || []).length > 0 ? (
                                selectedCandidate.latestApplicationWorkflow.interview.turns.map((turn, index) => (
                                  <div key={`${selectedCandidate.latestApplicationId || selectedCandidate.id}-${index}`} className="rounded-2xl bg-slate-50 p-3">
                                    <p className="font-semibold text-slate-900">Q{index + 1}: {turn.question || 'Interview question'}</p>
                                    <p className="mt-2 leading-6">A{index + 1}: {turn.answer || 'No answer text captured.'}</p>
                                  </div>
                                ))
                              ) : (
                                <p className="leading-6">{selectedCandidate.latestApplicationWorkflow.interview.transcript}</p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Interview media</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {selectedCandidate.latestApplicationWorkflow.interview?.recordingUrl || selectedCandidate.latestApplicationWorkflow.interview?.snapshotUrl
                              ? 'Recording and verification files are available from the stored Railway application data.'
                              : 'Media was not uploaded for this interview attempt. The transcript/Q&A is available above, and future completed interviews will enable these buttons automatically.'}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={!selectedCandidate.latestApplicationWorkflow.interview?.recordingUrl}
                              onClick={() => handleOpenInterviewMedia(selectedCandidate, 'recording')}
                              className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                                selectedCandidate.latestApplicationWorkflow.interview?.recordingUrl
                                  ? 'bg-slate-950 text-white'
                                  : 'cursor-not-allowed bg-slate-200 text-slate-500'
                              }`}
                            >
                              Open Recording
                            </button>
                            <button
                              type="button"
                              disabled={!selectedCandidate.latestApplicationWorkflow.interview?.recordingUrl}
                              onClick={() => handleDownloadInterviewRecording(selectedCandidate)}
                              className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
                                selectedCandidate.latestApplicationWorkflow.interview?.recordingUrl
                                  ? 'border-blue-200 bg-blue-50 text-blue-800'
                                  : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                              }`}
                            >
                              Download Recording
                            </button>
                            <button
                              type="button"
                              disabled={!selectedCandidate.latestApplicationWorkflow.interview?.snapshotUrl}
                              onClick={() => handleOpenInterviewMedia(selectedCandidate, 'snapshot')}
                              className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
                                selectedCandidate.latestApplicationWorkflow.interview?.snapshotUrl
                                  ? 'border-slate-300 bg-white text-slate-700'
                                  : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                              }`}
                            >
                              Open verification photo
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
                <h4 className="text-lg font-semibold text-slate-900">Schedule Interview</h4>
                <p className="mt-2 text-sm text-slate-500">Scheduling for <strong>{selectedCandidate.latestJobTitle || 'the latest application'}</strong>.</p>
                <p className="mt-1 text-xs font-semibold text-blue-700">Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Interview type
                    <select value={interviewForm.interview_type} onChange={(event) => setInterviewForm((prev) => ({ ...prev, interview_type: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      {['Technical', 'HR', 'Manager', 'Final'].map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Date and time
                    <input type="datetime-local" value={interviewForm.scheduled_at} onChange={(event) => setInterviewForm((prev) => ({ ...prev, scheduled_at: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Duration (minutes)
                    <input type="number" min="15" value={interviewForm.duration_minutes} onChange={(event) => setInterviewForm((prev) => ({ ...prev, duration_minutes: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Location / meeting link
                    <input value={interviewForm.location} onChange={(event) => setInterviewForm((prev) => ({ ...prev, location: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Notes
                    <textarea rows={4} value={interviewForm.notes} onChange={(event) => setInterviewForm((prev) => ({ ...prev, notes: event.target.value }))} className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
                  </label>

                  <button type="button" disabled={!selectedCandidate.latestApplicationId || savingInterview} onClick={handleScheduleInterview} className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300">
                    {savingInterview ? 'Scheduling...' : 'Schedule Interview'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {analysisCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[32px] bg-white p-8 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <ProfileAvatar src={buildFileUrl(analysisCandidate.candidatePhotoUrl)} name={analysisCandidate.candidateName} className="h-16 w-16" textClassName="text-lg" />
                <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Invenia AI Analysis</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{analysisCandidate.candidateName}</h3>
                <p className="mt-1 text-sm text-slate-500">{analysisCandidate.jobTitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAnalysisCandidate(null)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <ScoreBadge label="Job ATS" value={analysisCandidate.jobAtsScore} tone="border-blue-100 bg-blue-50 text-blue-800" />
              <ScoreBadge label="Final" value={analysisCandidate.finalScore} tone="border-emerald-100 bg-emerald-50 text-emerald-700" />
              <ScoreBadge label="Tests" value={analysisCandidate.assessmentAverage || 0} tone="border-violet-100 bg-violet-50 text-violet-700" />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
                <div className="mt-2"><StatusBadge status={analysisCandidate.status || 'pending'} /></div>
              </div>
            </div>

            <div className="mt-6">
              <CandidateAIAnalysis candidate={analysisCandidate} />
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recruiter decision helper</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Candidate profile</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <p>Email: {analysisCandidate.candidateEmail || 'Not provided'}</p>
                    <p>Title: {analysisCandidate.candidateTitle || 'Not provided'}</p>
                    <p>Experience: {analysisCandidate.candidateExperienceYears || 0} years</p>
                    <p>Location: {analysisCandidate.candidateLocation || 'Not provided'}</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Stage scores</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                    {[
                      ['Aptitude', analysisCandidate.stageScores?.aptitude ?? 'Pending'],
                      ['Technical', analysisCandidate.stageScores?.technical ?? 'Pending'],
                      ['Coding', analysisCandidate.stageScores?.coding ?? 'Pending'],
                      ['Interview', analysisCandidate.stageScores?.interview ?? 'Pending'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="font-semibold text-slate-900">{typeof value === 'number' ? `${value}%` : value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {analysisCandidate.resumeUrl && (
                <button type="button" onClick={() => handleOpenResume(analysisCandidate)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  Preview CV
                </button>
              )}
              <button
                type="button"
                disabled={applicationAction.applicationId === analysisCandidate.applicationId || isFinalApplicationDecision(analysisCandidate.status)}
                onClick={() => handleApplicationStatusUpdate(analysisCandidate.applicationId, 'approved')}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
              >
                {applicationAction.applicationId === analysisCandidate.applicationId && applicationAction.status === 'approved'
                  ? 'Approving...'
                  : analysisCandidate.status === 'approved'
                    ? 'Approved'
                    : 'Approve next round'}
              </button>
              <button
                type="button"
                disabled={applicationAction.applicationId === analysisCandidate.applicationId || isFinalApplicationDecision(analysisCandidate.status)}
                onClick={() => handleApplicationStatusUpdate(analysisCandidate.applicationId, 'rejected')}
                className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {applicationAction.applicationId === analysisCandidate.applicationId && applicationAction.status === 'rejected'
                  ? 'Rejecting...'
                  : analysisCandidate.status === 'rejected'
                    ? 'Rejected'
                    : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[32px] bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-500">{editingJob ? 'Job Details' : 'Create Job'}</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{editingJob ? editingJob.title : 'Post a new opportunity'}</h3>
              </div>
              <button type="button" onClick={() => { setShowJobModal(false); setEditingJob(null); setJobForm(emptyJobForm); }} className="rounded-full border border-slate-200 p-2 text-slate-500">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {editingJob && (
              <div className="mt-8 rounded-[32px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Structured job view</p>
                    <h4 className="mt-2 text-2xl font-semibold text-slate-900">{editingJob.title}</h4>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{editingJob.description || 'No description added.'}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-5 py-4 text-right shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Salary</p>
                    <p className="mt-2 text-lg font-semibold text-emerald-700">{formatSalaryText(editingJob.salary)}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  {[
                    ['Viewed', editingJob.views || 0],
                    ['Applied', editingJob.applications || editingJob.appliedCount || 0],
                    ['Shortlisted', editingJob.shortlistedCount || 0],
                    ['Interviewed', editingJob.interviewedCount || 0],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-3">
                  {[
                    ['Requirements', normalizeDetailList(editingJob.requirements?.length ? editingJob.requirements : editingJob.requirementsText)],
                    ['Responsibilities', normalizeDetailList(editingJob.responsibilitiesList?.length ? editingJob.responsibilitiesList : editingJob.responsibilities)],
                    ['Benefits', normalizeDetailList(editingJob.benefitsList?.length ? editingJob.benefitsList : editingJob.benefits)],
                  ].map(([title, items]) => (
                    <div key={title} className="rounded-3xl border border-slate-200 bg-white p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
                      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                        {items.length > 0 ? items.map((item) => <p key={item}>- {item}</p>) : <p>Not specified.</p>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  {[
                    ['Aptitude', editingJob.assessmentConfig?.aptitude?.enabled === false ? 'Not needed' : editingJob.assessmentConfig?.aptitude?.required ? 'Compulsory' : 'Optional'],
                    ['Technical', editingJob.assessmentConfig?.technical?.enabled === false ? 'Not needed' : editingJob.assessmentConfig?.technical?.required ? 'Compulsory' : 'Optional'],
                    ['Coding', editingJob.assessmentConfig?.coding?.enabled === false ? 'Not needed' : editingJob.assessmentConfig?.coding?.required ? 'Compulsory' : 'Optional'],
                    ['AI Interview', 'Compulsory'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-blue-100 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">{label}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleJobSubmit} className="mt-8 grid gap-5 md:grid-cols-2">
              <label className="md:col-span-2 text-sm font-medium text-slate-700">
                Job title
                <input value={jobForm.title} onChange={(event) => setJobForm((prev) => ({ ...prev, title: event.target.value }))} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Location
                <input value={jobForm.location} onChange={(event) => setJobForm((prev) => ({ ...prev, location: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Job type
                <select
                  value={jobForm.job_type}
                  onChange={(event) => setJobForm((prev) => ({
                    ...prev,
                    job_type: event.target.value,
                    salary_period: event.target.value === 'Contract' && !prev.salary_period ? 'per day' : prev.salary_period,
                  }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                >
                  {['Full-time', 'Part-time', 'Contract', 'Internship'].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Salary min
                <input type="number" value={jobForm.salary_min} onChange={(event) => setJobForm((prev) => ({ ...prev, salary_min: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Salary max
                <input type="number" value={jobForm.salary_max} onChange={(event) => setJobForm((prev) => ({ ...prev, salary_max: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Currency
                <input value={jobForm.salary_currency} onChange={(event) => setJobForm((prev) => ({ ...prev, salary_currency: event.target.value }))} placeholder="INR, USD, EUR, ₹" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Salary period
                <select value={jobForm.salary_period} onChange={(event) => setJobForm((prev) => ({ ...prev, salary_period: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  {['per day', 'monthly', 'annually'].map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
              </label>
              <label className="md:col-span-2 text-sm font-medium text-slate-700">
                Experience / Category
                <input value={jobForm.experience_level} onChange={(event) => setJobForm((prev) => ({ ...prev, experience_level: event.target.value }))} placeholder="UI, Engineering, Senior, Entry" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="md:col-span-2 text-sm font-medium text-slate-700">
                Key skills
                <input value={jobForm.requirements} onChange={(event) => setJobForm((prev) => ({ ...prev, requirements: event.target.value }))} placeholder="React, Node.js, SQL, Communication" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="md:col-span-2 text-sm font-medium text-slate-700">
                Job description
                <textarea rows={5} value={jobForm.description} onChange={(event) => setJobForm((prev) => ({ ...prev, description: event.target.value }))} required className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="md:col-span-2 text-sm font-medium text-slate-700">
                Responsibilities
                <textarea rows={4} value={jobForm.responsibilities} onChange={(event) => setJobForm((prev) => ({ ...prev, responsibilities: event.target.value }))} className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="md:col-span-2 text-sm font-medium text-slate-700">
                Benefits
                <textarea rows={3} value={jobForm.benefits} onChange={(event) => setJobForm((prev) => ({ ...prev, benefits: event.target.value }))} className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>

              <div className="md:col-span-2 rounded-[28px] border border-violet-200 bg-violet-50/70 p-6">
                <h4 className="text-lg font-semibold text-slate-900">Stage 2: Aptitude Test Setup</h4>
                <p className="mt-2 text-sm text-slate-600">
                  Invenia AI Analysis generates 5 aptitude questions from the job context. Mark this round as required or optional for candidates.
                </p>
                <div className="mt-5 grid gap-5 md:grid-cols-4">
                  <label className="text-sm font-medium text-slate-700">
                    Candidate rule
                    <select
                      value={!jobForm.aptitude_enabled ? 'disabled' : jobForm.aptitude_required ? 'required' : 'optional'}
                      onChange={(event) => setJobForm((prev) => ({
                        ...prev,
                        aptitude_enabled: event.target.value !== 'disabled',
                        aptitude_required: event.target.value === 'required',
                      }))}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      <option value="required">Compulsory</option>
                      <option value="optional">Optional</option>
                      <option value="disabled">Not needed</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Question source
                    <select value={jobForm.aptitude_mode} onChange={(event) => setJobForm((prev) => ({ ...prev, aptitude_mode: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      <option value="ai">AI Generated</option>
                      <option value="manual">Manual MCQs</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Cutoff
                    <input type="number" min="1" max="30" value={jobForm.aptitude_cutoff} onChange={(event) => setJobForm((prev) => ({ ...prev, aptitude_cutoff: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Duration (minutes)
                    <input type="number" min="15" max="120" value={jobForm.aptitude_duration_minutes} onChange={(event) => setJobForm((prev) => ({ ...prev, aptitude_duration_minutes: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  </label>
                </div>
                {jobForm.aptitude_mode === 'manual' && (
                  <label className="mt-5 block text-sm font-medium text-slate-700">
                    Manual questions
                    <textarea rows={6} value={jobForm.aptitude_manual_questions_text} onChange={(event) => setJobForm((prev) => ({ ...prev, aptitude_manual_questions_text: event.target.value }))} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="One question per line: Question?|Option A|Option B|Option C|Option D|1" />
                    <p className="mt-2 text-xs text-slate-500">If you provide fewer than 5 questions, Invenia AI Analysis will complete the set automatically.</p>
                  </label>
                )}
              </div>

              <div className="md:col-span-2 rounded-[28px] border border-cyan-200 bg-cyan-50/70 p-6">
                <h4 className="text-lg font-semibold text-slate-900">Stage 3: Technical Test Setup</h4>
                <p className="mt-2 text-sm text-slate-600">
                  Invenia AI Analysis generates 5 technical MCQs from the job description and skill requirements. You can keep this round optional or compulsory.
                </p>
                <div className="mt-5 grid gap-5 md:grid-cols-4">
                  <label className="text-sm font-medium text-slate-700">
                    Candidate rule
                    <select
                      value={!jobForm.technical_enabled ? 'disabled' : jobForm.technical_required ? 'required' : 'optional'}
                      onChange={(event) => setJobForm((prev) => ({
                        ...prev,
                        technical_enabled: event.target.value !== 'disabled',
                        technical_required: event.target.value === 'required',
                      }))}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      <option value="required">Compulsory</option>
                      <option value="optional">Optional</option>
                      <option value="disabled">Not needed</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Question source
                    <select value={jobForm.technical_mode} onChange={(event) => setJobForm((prev) => ({ ...prev, technical_mode: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      <option value="ai">AI Generated</option>
                      <option value="manual">Manual MCQs</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Cutoff
                    <input type="number" min="1" max="30" value={jobForm.technical_cutoff} onChange={(event) => setJobForm((prev) => ({ ...prev, technical_cutoff: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Duration (minutes)
                    <input type="number" min="15" max="120" value={jobForm.technical_duration_minutes} onChange={(event) => setJobForm((prev) => ({ ...prev, technical_duration_minutes: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" />
                  </label>
                </div>
                {jobForm.technical_mode === 'manual' && (
                  <label className="mt-5 block text-sm font-medium text-slate-700">
                    Manual questions
                    <textarea rows={6} value={jobForm.technical_manual_questions_text} onChange={(event) => setJobForm((prev) => ({ ...prev, technical_manual_questions_text: event.target.value }))} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="One question per line: Question?|Option A|Option B|Option C|Option D|1" />
                    <p className="mt-2 text-xs text-slate-500">Any missing questions are filled automatically from the job description and required skills.</p>
                  </label>
                )}
              </div>

              <div className="md:col-span-2 rounded-[28px] border border-emerald-200 bg-emerald-50/70 p-6">
                <h4 className="text-lg font-semibold text-slate-900">Stages 4 & 5: Coding + Interview</h4>
                <p className="mt-2 text-sm text-slate-600">
                  Add two coding prompts manually if you want full control; otherwise Invenia AI Analysis generates them from the role. The interview stage is always compulsory and uses a 3-question voice flow.
                </p>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">
                    Candidate rule
                    <select
                      value={!jobForm.coding_enabled ? 'disabled' : jobForm.coding_required ? 'required' : 'optional'}
                      onChange={(event) => setJobForm((prev) => ({
                        ...prev,
                        coding_enabled: event.target.value !== 'disabled',
                        coding_required: event.target.value === 'required',
                      }))}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      <option value="required">Compulsory</option>
                      <option value="optional">Optional</option>
                      <option value="disabled">Not needed</option>
                    </select>
                  </label>
                  <div className="rounded-2xl border border-emerald-200 bg-white/80 p-4 text-sm text-slate-700">
                    AI interview is compulsory and always runs after the selected screening stages.
                  </div>
                </div>
                <label className="mt-5 block text-sm font-medium text-slate-700">
                  Manual coding prompts
                  <textarea rows={5} value={jobForm.coding_manual_questions_text} onChange={(event) => setJobForm((prev) => ({ ...prev, coding_manual_questions_text: event.target.value }))} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="One question per line: Title|Prompt|Guidance" />
                </label>
                <label className="mt-5 block text-sm font-medium text-slate-700">
                  Interview duration (minutes)
                  <input type="number" min="5" max="30" value={jobForm.interview_duration_minutes} onChange={(event) => setJobForm((prev) => ({ ...prev, interview_duration_minutes: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm md:max-w-xs" />
                </label>
              </div>

              <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={jobForm.is_remote} onChange={(event) => setJobForm((prev) => ({ ...prev, is_remote: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                This is a remote role
              </label>

              {editingJob && (
                <div className="md:col-span-2 rounded-[30px] border border-blue-200 bg-blue-50/70 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Candidate result reports</p>
                      <h4 className="mt-2 text-xl font-semibold text-slate-900">Applications for this job</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {editingJobReport?.fitSummary || 'Candidate reports will appear here after applications are submitted.'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Avg ATS</p>
                      <p className="mt-1 text-2xl font-semibold text-blue-800">{editingJobReport?.avgJobAtsScore || 0}%</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {(editingJobReport?.candidateComparison || []).length > 0 ? (
                      editingJobReport.candidateComparison.map((candidate) => (
                        <div key={candidate.applicationId} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <ProfileAvatar src={buildFileUrl(candidate.candidatePhotoUrl)} name={candidate.candidateName} className="h-12 w-12" />
                              <div><h5 className="text-lg font-semibold text-slate-900">{candidate.candidateName}</h5><p className="mt-1 text-sm text-slate-500">{candidate.candidateEmail}</p><p className="mt-2 text-sm font-semibold text-slate-700">{candidate.recruiterDecision}</p></div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">ATS {candidate.jobAtsScore || 0}%</span>
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Final {candidate.finalScore || 0}%</span>
                              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Interview {candidate.interviewScore ?? 'Pending'}</span>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-3">
                            {candidate.resumeUrl && (
                              <button type="button" onClick={() => handleOpenResume(candidate)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                                Preview CV
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isFinalApplicationDecision(candidate.status)}
                              onClick={() => handleApplicationStatusUpdate(candidate.applicationId, 'approved')}
                              className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                            >
                              {candidate.status === 'approved' ? 'Approved' : candidate.status === 'rejected' ? 'Rejected' : 'Approve next round'}
                            </button>
                            <button
                              type="button"
                              disabled={isFinalApplicationDecision(candidate.status)}
                              onClick={() => handleApplicationStatusUpdate(candidate.applicationId, 'rejected')}
                              className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              {candidate.status === 'rejected' ? 'Rejected' : 'Reject'}
                            </button>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-4">
                            {[
                              ['Aptitude', candidate.stageScores?.aptitude ?? 'Pending'],
                              ['Technical', candidate.stageScores?.technical ?? 'Pending'],
                              ['Coding', candidate.stageScores?.coding ?? 'Pending'],
                              ['Interview', candidate.stageScores?.interview ?? 'Pending'],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-2xl bg-slate-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{typeof value === 'number' ? `${value}%` : value}</p>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Invenia AI Analysis: Job ATS</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{candidate.jobAts?.summary || 'ATS summary pending.'}</p>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Matched</p>
                                <div className="mt-2 space-y-1 text-sm text-slate-600">
                                  {(candidate.jobAts?.matched_requirements || []).slice(0, 4).map((item) => <p key={item}>- {item}</p>)}
                                  {(candidate.jobAts?.matched_requirements || []).length === 0 && <p>No matched requirements listed.</p>}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Missing</p>
                                <div className="mt-2 space-y-1 text-sm text-slate-600">
                                  {(candidate.jobAts?.missing_requirements || []).slice(0, 4).map((item) => <p key={item}>- {item}</p>)}
                                  {(candidate.jobAts?.missing_requirements || []).length === 0 && <p>No missing requirements listed.</p>}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Interview questions and answers</p>
                            <div className="mt-3 space-y-3">
                              {(candidate.interviewTurns || []).length > 0 ? (
                                candidate.interviewTurns.map((turn, index) => (
                                  <div key={`${candidate.applicationId}-${index}`} className="rounded-2xl bg-white p-3">
                                    <p className="text-sm font-semibold text-slate-900">Q{index + 1}: {turn.question}</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-700">A{index + 1}: {turn.answer}</p>
                                  </div>
                                ))
                              ) : candidate.interviewTranscript ? (
                                <div className="rounded-2xl bg-white p-3">
                                  <p className="text-sm font-semibold text-slate-900">Captured transcript</p>
                                  <p className="mt-2 text-sm leading-6 text-slate-700">{candidate.interviewTranscript}</p>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500">Interview answers are not submitted yet.</p>
                              )}
                            </div>
                            {candidate.interviewReport?.summary && (
                              <p className="mt-3 rounded-2xl bg-white p-3 text-sm leading-6 text-slate-700">{candidate.interviewReport.summary}</p>
                            )}
                            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Interview media</p>
                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                {candidate.interviewRecordingUrl || candidate.interviewSnapshotUrl
                                  ? 'Stored video/audio and verification files are ready for recruiter review.'
                                  : 'Media was not uploaded for this interview attempt. Transcript and typed answers remain available above.'}
                              </p>
                              <div className="mt-4 flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  disabled={!candidate.interviewRecordingUrl}
                                  onClick={() => handleOpenInterviewMedia(candidate, 'recording')}
                                  className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                                    candidate.interviewRecordingUrl
                                      ? 'bg-slate-950 text-white'
                                      : 'cursor-not-allowed bg-slate-200 text-slate-500'
                                  }`}
                                >
                                  Open recording
                                </button>
                                <button
                                  type="button"
                                  disabled={!candidate.interviewRecordingUrl}
                                  onClick={() => handleDownloadInterviewRecording(candidate)}
                                  className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
                                    candidate.interviewRecordingUrl
                                      ? 'border-blue-200 bg-blue-50 text-blue-800'
                                      : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  Download recording
                                </button>
                                <button
                                  type="button"
                                  disabled={!candidate.interviewSnapshotUrl}
                                  onClick={() => handleOpenInterviewMedia(candidate, 'snapshot')}
                                  className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
                                    candidate.interviewSnapshotUrl
                                      ? 'border-slate-300 bg-white text-slate-700'
                                      : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  Open verification photo
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-blue-200 bg-white p-6 text-center text-sm text-slate-500">
                        No candidate reports are available for this job yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
                <button type="button" onClick={() => { setShowJobModal(false); setEditingJob(null); setJobForm(emptyJobForm); }} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">
                  Cancel
                </button>
                <button type="submit" className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
                  {editingJob ? 'Save Changes' : 'Publish Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[32px] bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-500">Update Recruiter Profile</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Keep your recruiter identity current</h3>
              </div>
              <button type="button" onClick={() => setShowProfileModal(false)} className="rounded-full border border-slate-200 p-2 text-slate-500">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleProfileSubmit} className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2 flex flex-col gap-4 rounded-[24px] border border-blue-100 bg-blue-50/60 p-5 sm:flex-row sm:items-center">
                <ProfileAvatar src={buildFileUrl(profile?.photo_url)} name={profileForm.full_name || name} className="h-20 w-20" textClassName="text-xl" />
                <div className="flex-1"><p className="text-sm font-semibold text-slate-900">Recruiter profile photo</p><p className="mt-1 text-xs text-slate-600">Use a professional JPG, PNG, or WebP image up to 5 MB.</p></div>
                <label className="cursor-pointer rounded-2xl bg-blue-700 px-4 py-3 text-center text-sm font-semibold text-white">
                  {uploadingPhoto ? 'Uploading...' : 'Upload photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingPhoto} onChange={handlePhotoUpload} className="hidden" />
                </label>
              </div>
              <label className="text-sm font-medium text-slate-700">
                Full name
                <input value={profileForm.full_name} onChange={(event) => setProfileForm((prev) => ({ ...prev, full_name: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Job title
                <input value={profileForm.job_title} onChange={(event) => setProfileForm((prev) => ({ ...prev, job_title: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Company name
                <input value={profileForm.company_name} onChange={(event) => setProfileForm((prev) => ({ ...prev, company_name: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Company website
                <input value={profileForm.company_website} onChange={(event) => setProfileForm((prev) => ({ ...prev, company_website: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Company size
                <input value={profileForm.company_size} onChange={(event) => setProfileForm((prev) => ({ ...prev, company_size: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Industry
                <input value={profileForm.industry} onChange={(event) => setProfileForm((prev) => ({ ...prev, industry: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Phone
                <input value={profileForm.phone} onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                LinkedIn URL
                <input value={profileForm.linkedin_url} onChange={(event) => setProfileForm((prev) => ({ ...prev, linkedin_url: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="md:col-span-2 text-sm font-medium text-slate-700">
                Company description
                <textarea rows={5} value={profileForm.company_description} onChange={(event) => setProfileForm((prev) => ({ ...prev, company_description: event.target.value }))} className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
                <button type="button" onClick={() => setShowProfileModal(false)} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">
                  Cancel
                </button>
                <button type="submit" disabled={savingProfile} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-400">
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRecruiterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[32px] bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-500">Create Recruiter Account</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Grant recruiter dashboard access</h3>
              </div>
              <button type="button" onClick={() => setShowRecruiterModal(false)} className="rounded-full border border-slate-200 p-2 text-slate-500">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRecruiter} className="mt-8 grid gap-5 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Full name
                <input value={recruiterForm.full_name} onChange={(event) => setRecruiterForm((prev) => ({ ...prev, full_name: event.target.value }))} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Email
                <input type="email" value={recruiterForm.email} onChange={(event) => setRecruiterForm((prev) => ({ ...prev, email: event.target.value }))} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Password
                <input type="password" value={recruiterForm.password} onChange={(event) => setRecruiterForm((prev) => ({ ...prev, password: event.target.value }))} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Job title
                <input value={recruiterForm.job_title} onChange={(event) => setRecruiterForm((prev) => ({ ...prev, job_title: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Company name
                <input value={recruiterForm.company_name} onChange={(event) => setRecruiterForm((prev) => ({ ...prev, company_name: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Phone
                <input value={recruiterForm.phone} onChange={(event) => setRecruiterForm((prev) => ({ ...prev, phone: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Company website
                <input value={recruiterForm.company_website} onChange={(event) => setRecruiterForm((prev) => ({ ...prev, company_website: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                LinkedIn URL
                <input value={recruiterForm.linkedin_url} onChange={(event) => setRecruiterForm((prev) => ({ ...prev, linkedin_url: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Company size
                <input value={recruiterForm.company_size} onChange={(event) => setRecruiterForm((prev) => ({ ...prev, company_size: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Industry
                <input value={recruiterForm.industry} onChange={(event) => setRecruiterForm((prev) => ({ ...prev, industry: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="md:col-span-2 text-sm font-medium text-slate-700">
                Company description
                <textarea rows={4} value={recruiterForm.company_description} onChange={(event) => setRecruiterForm((prev) => ({ ...prev, company_description: event.target.value }))} className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
                <button type="button" onClick={() => setShowRecruiterModal(false)} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">
                  Cancel
                </button>
                <button type="submit" disabled={savingRecruiter} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-400">
                  {savingRecruiter ? 'Creating...' : 'Create Recruiter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ScoreGlossary open={showScoreGlossary} onClose={() => setShowScoreGlossary(false)} />
      <ConfirmDialog confirmation={confirmation} onCancel={() => setConfirmation(null)} onConfirm={() => confirmation?.action?.()} />
      <ProductTour open={tourOpen} steps={recruiterTourSteps} onClose={() => setTourOpen(false)} />
      
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 rounded-full bg-blue-600 p-3 text-white shadow-lg hover:bg-blue-700 transition"
          title="Scroll to top"
        >
          <ChevronUpIcon className="h-6 w-6" />
        </button>
      )}
      
      {showScrollBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="fixed bottom-6 right-16 z-50 rounded-full bg-blue-600 p-3 text-white shadow-lg hover:bg-blue-700 transition"
          title="Scroll to bottom"
        >
          <ChevronDownIcon className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
