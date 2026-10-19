/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRightOnRectangleIcon,
  BookmarkIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  HeartIcon,
  LifebuoyIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  SparklesIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { authAPI, buildFileUrl, candidateAPI, openBlobResponse, openPreparedPreviewWindow } from '../services/api';
import { ConfirmDialog, JobIdChip, KpiStrip, PageSkeleton, ProductTour, ProfileAvatar, ScoreGlossary, ScoreHelp } from '../components/UXKit';

const emptyProfileForm = {
  full_name: '',
  phone: '',
  location: '',
  current_job_title: '',
  current_company: '',
  experience_years: '',
  salary_expectation: '',
  bio: '',
  skills: '',
  preferred_job_types: '',
  preferred_locations: '',
  linkedin_url: '',
  github_url: '',
  portfolio_url: '',
  is_available: true,
};

const statusClasses = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  reviewed: 'bg-blue-100 text-blue-700',
  shortlisted: 'bg-violet-100 text-violet-700',
  interview: 'bg-sky-100 text-sky-700',
  offer: 'bg-emerald-100 text-emerald-700',
  hired: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  revoked: 'bg-slate-100 text-slate-600',
};

const sidebarGradient = 'bg-gradient-to-b from-[#04193b] via-[#04193b] to-[#04193b]';

const ColorJobsIcon = ({ className = 'h-6 w-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="16" rx="4" fill="#13B981" />
    <rect x="8" y="3" width="8" height="4" rx="2" fill="#0EA5E9" />
    <rect x="7" y="10" width="10" height="2" rx="1" fill="white" />
    <rect x="7" y="14" width="6" height="2" rx="1" fill="#D1FAE5" />
  </svg>
);

const ColorApplicationsIcon = ({ className = 'h-6 w-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="#F59E0B" />
    <path d="M14 3v5h5" fill="#FCD34D" />
    <rect x="8" y="11" width="8" height="2" rx="1" fill="white" />
    <rect x="8" y="15" width="6" height="2" rx="1" fill="#FEF3C7" />
  </svg>
);

const ColorSavedIcon = ({ className = 'h-6 w-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M12 20.5 4.4 13.4a4.9 4.9 0 0 1 6.9-7l.7.7.7-.7a4.9 4.9 0 1 1 6.9 7L12 20.5Z" fill="#EF4444" />
    <circle cx="17.4" cy="7.2" r="1.7" fill="#FCA5A5" />
  </svg>
);

const ColorProfileIcon = ({ className = 'h-6 w-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" fill="#8B5CF6" />
    <path d="M5 20a7 7 0 0 1 14 0" fill="#C4B5FD" />
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

function formatDate(value) {
  if (!value) return 'Recently';
  return new Date(value).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function splitText(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeStringList(value, limit = 6) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, limit);
}

function formatScanTimestamp(value) {
  if (!value) return 'Not scanned yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getAtsTone(score) {
  if (score >= 85) {
    return {
      label: 'ATS ready',
      badge: 'bg-emerald-100 text-emerald-700',
      bar: 'bg-emerald-500',
      panel: 'border-emerald-200 bg-emerald-50/90',
    };
  }
  if (score >= 70) {
    return {
      label: 'Almost there',
      badge: 'bg-sky-100 text-sky-700',
      bar: 'bg-sky-500',
      panel: 'border-sky-200 bg-sky-50/90',
    };
  }
  if (score >= 50) {
    return {
      label: 'Needs polish',
      badge: 'bg-amber-100 text-amber-700',
      bar: 'bg-amber-500',
      panel: 'border-amber-200 bg-amber-50/90',
    };
  }
  return {
    label: 'Needs work',
    badge: 'bg-rose-100 text-rose-700',
    bar: 'bg-rose-500',
    panel: 'border-rose-200 bg-rose-50/90',
  };
}

const workflowStages = [
  { id: 'profile', label: 'Candidate Profile' },
  { id: 'aptitude', label: 'Aptitude Test' },
  { id: 'technical', label: 'Technical Test' },
  { id: 'coding', label: 'Coding Round' },
  { id: 'interview', label: 'AI Interview' },
];

function formatTimer(totalSeconds) {
  const safeValue = Math.max(0, Number(totalSeconds) || 0);
  const hours = String(Math.floor(safeValue / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((safeValue % 3600) / 60)).padStart(2, '0');
  const seconds = String(safeValue % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function formatSalaryText(value) {
  return String(value || 'Competitive').replace(/\$/g, '').replace(/\s+/g, ' ').trim();
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

function normalizeDetailList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/\n|,|•|-/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getActionableSuggestions(job) {
  const notes = [];
  if (job.matchScore >= 80) {
    notes.push('Your skills align strongly with this opening.');
  } else if (job.matchScore >= 60) {
    notes.push('A few more aligned skills could improve your shortlist chances.');
  } else {
    notes.push('This role may need stronger skill alignment before applying.');
  }

  notes.push(job.isRemote ? 'Remote work flexibility is available for this job.' : 'This role expects regular on-site collaboration.');
  notes.push(job.applicants > 10 ? 'Competition is building, so applying early will help.' : 'This role still has an early applicant pool.');
  return notes;
}

function CandidateJobCard({ job, onView, onSave }) {
  const insights = getActionableSuggestions(job);
  const visibleSkills = (job.skills || []).slice(0, 3);

  return (
    <div className="rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <JobIdChip value={job.publicJobId} className="mb-2" />
          <button type="button" onClick={() => onView(job)} className="block text-left text-2xl font-semibold text-slate-900 transition hover:text-blue-700 hover:underline" aria-label={`View details for ${job.title}`}>{job.title}</button>
          <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-600"><ProfileAvatar src={buildFileUrl(job.recruiterPhotoUrl)} name={job.company} className="h-7 w-7" textClassName="text-[10px]" />{job.company}</div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <BriefcaseIcon className="h-4 w-4 text-violet-500" />
              {job.type}
            </span>
            <span className="flex items-center gap-1">
              <MapPinIcon className="h-4 w-4 text-rose-500" />
              {job.location}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDaysIcon className="h-4 w-4 text-blue-500" />
              {formatDate(job.postedDate)}
            </span>
            {job.experienceLevel && <span className="flex items-center gap-1"><ChartBarIcon className="h-4 w-4 text-cyan-600" />{job.experienceLevel}</span>}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className={`rounded-2xl px-3 py-1 text-xs font-bold ${job.isApplied ? 'bg-blue-100 text-blue-700' : 'bg-emerald-500 text-white'}`}>
            {job.isApplied ? 'APPLIED' : 'OPEN'}
          </div>
          <button
            type="button"
            onClick={() => onSave(job.id)}
            className={`rounded-full border p-2 transition ${
              job.isSaved
                ? 'border-amber-300 bg-amber-50 text-amber-600'
                : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <HeartIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-4 text-lg font-semibold text-emerald-600">
        {formatSalaryText(job.salary)}
      </div>

      <div className="mt-4 rounded-3xl border border-sky-200 bg-sky-50/90 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
          <SparklesIcon className="h-4 w-4" />
          Profile match for this job
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Profile match', `${job.matchScore}%`],
            ['Resume Ready', job.isApplied ? 'Used' : 'Ready'],
            ['Applicants', String(job.applicants)],
            ['Saved', job.isSaved ? 'Yes' : 'No'],
          ].map(([label, value]) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <h4 className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <span className="text-pink-500">🎯</span>
          Required Skills
        </h4>
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleSkills.length > 0 ? (
            <>
              {visibleSkills.map((skill) => (
                <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{skill}</span>
              ))}
              {(job.skills || []).length > visibleSkills.length && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">+{job.skills.length - visibleSkills.length} more</span>}
            </>
          ) : (
            <span className="text-sm text-slate-500">No skills listed yet.</span>
          )}
        </div>
      </div>

      <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{insights[0]}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr,auto]">
        <button
          type="button"
          onClick={() => onView(job)}
          className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          View job
        </button>
        <button
          type="button"
          onClick={() => onSave(job.id)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
        >
          {job.isSaved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function ApplicationTimeline({ application }) {
  const stages = ['Applied', 'Screening', 'Assessments', 'Interview', 'Decision'];
  const workflowStage = application.workflowStage || 'profile';
  let activeIndex = 1;
  if (['aptitude', 'technical', 'coding'].includes(workflowStage)) activeIndex = 2;
  if (workflowStage === 'interview' || application.status === 'interview') activeIndex = 3;
  if (['offer', 'hired', 'rejected'].includes(application.status) || workflowStage === 'completed') activeIndex = 4;
  if (application.status === 'pending') activeIndex = 1;
  return <div className="mt-4 grid grid-cols-5 gap-1" aria-label={`Application progress: ${stages[activeIndex]}`}>
    {stages.map((stage, index) => <div key={stage} className="text-center"><div className={`mx-auto h-1.5 rounded-full ${index <= activeIndex ? 'bg-blue-700' : 'bg-slate-200'}`} /><p className={`mt-1 text-[9px] font-semibold ${index === activeIndex ? 'text-blue-800' : 'text-slate-400'}`}>{stage}</p></div>)}
  </div>;
}

function NoticeModal({ notice, onClose }) {
  if (!notice) return null;
  const tone = notice.tone || 'blue';
  const toneClasses = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
  };

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-lg rounded-[32px] border border-blue-100 bg-white p-7 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
          aria-label="Close notification"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${toneClasses[tone] || toneClasses.blue}`}>
          {notice.label || 'Invenia AI update'}
        </div>
        <h3 className="mt-4 text-2xl font-semibold text-slate-900">{notice.title}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-600">{notice.message}</p>
        {notice.details && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {notice.details}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white"
        >
          {notice.actionLabel || 'Continue'}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function ProfileMenu({ profile, currentUser, onClose, onProfile, onSaved, onSettings, onSupport, onLogout }) {
  const name = profile?.full_name || currentUser?.full_name || currentUser?.username || 'Candidate';
  const email = profile?.email || currentUser?.email || '';
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
        <button type="button" onClick={() => { onSaved(); onClose(); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-slate-700 hover:bg-slate-50">
          <ColorSavedIcon className="h-5 w-5" />
          <span className="text-lg">Saved Jobs</span>
        </button>
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

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const resumeInputRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const profileMenuRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const interviewPanelRef = useRef(null);
  const interviewRecorderRef = useRef(null);
  const interviewChunksRef = useRef([]);
  const interviewSnapshotIntervalRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const interviewSnapshotRef = useRef(null);
  const interviewAnswerDraftRef = useRef('');
  const interviewFinalTranscriptRef = useRef('');
  const interviewRecognitionRestartRef = useRef(null);
  const interviewTranscribingRef = useRef(false);

  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(location.search).get('tab') || 'jobs');
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [jobFilters, setJobFilters] = useState({ location: '', workMode: 'all', jobType: 'all', experience: 'all', date: 'all' });
  const [currentUser, setCurrentUser] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [stats, setStats] = useState({
    applicationsSubmitted: 0,
    interviewsScheduled: 0,
    offersReceived: 0,
    savedJobs: 0,
    profileCompletion: 0,
    averageMatchScore: 0,
  });
  const [jobs, setJobs] = useState([]);
  const [jobViewMode, setJobViewMode] = useState('grid');
  const [applicationViewMode, setApplicationViewMode] = useState('list');
  const [applications, setApplications] = useState([]);
  const [applicationSearch, setApplicationSearch] = useState('');
  const [applicationStatus, setApplicationStatus] = useState('all');
  const [showScoreGlossary, setShowScoreGlossary] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [noticeModal, setNoticeModal] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileAutofillText, setProfileAutofillText] = useState('');
  const [profileAutofillFile, setProfileAutofillFile] = useState(null);
  const [profileAutofilling, setProfileAutofilling] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [atsLoading, setAtsLoading] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowSubmitting, setWorkflowSubmitting] = useState(false);
  const [workflowSession, setWorkflowSession] = useState(null);
  const [activeWorkflowStage, setActiveWorkflowStage] = useState('profile');
  const [workflowDraft, setWorkflowDraft] = useState({
    aptitude: {},
    technical: {},
    coding: ['', ''],
    interview: {},
  });
  const [workflowTimers, setWorkflowTimers] = useState({
    aptitude: 3600,
    technical: 3600,
    interview: 600,
  });
  const [cameraGranted, setCameraGranted] = useState(false);
  const [cameraAudioEnabled, setCameraAudioEnabled] = useState(false);
  const [proctoring, setProctoring] = useState({
    warnings: 0,
    events: [],
  });
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewAnswerDraft, setInterviewAnswerDraft] = useState('');
  const [interviewTranscribing, setInterviewTranscribing] = useState(false);
  const [interviewSpeaking, setInterviewSpeaking] = useState(false);
  const [interviewUploading, setInterviewUploading] = useState(false);
  const [interviewSnapshotUrl, setInterviewSnapshotUrl] = useState('');
  const [interviewRecordingUrl, setInterviewRecordingUrl] = useState('');
  const [interviewReport, setInterviewReport] = useState(null);

  const effectiveFilter = activeTab === 'saved' ? 'saved' : selectedFilter;

  const updateInterviewAnswerDraft = (value) => {
    const nextValue = value || '';
    interviewAnswerDraftRef.current = nextValue;
    setInterviewAnswerDraft(nextValue);
  };

  const showCandidateNotice = (notice) => {
    setNoticeModal(notice);
  };

  useEffect(() => {
    const requestedTab = new URLSearchParams(location.search).get('tab');
    if (requestedTab) {
      setActiveTab(requestedTab);
    }
  }, [location.search]);

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
    const params = new URLSearchParams(location.search);
    if (params.get('tab') !== activeTab) {
      params.set('tab', activeTab);
      navigate({ search: params.toString() }, { replace: true });
    }
  }, [activeTab, location.search, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getSeenDecisionMap = (userId) => {
    try {
      return JSON.parse(localStorage.getItem(`invenia_seen_candidate_decisions_${userId}`) || '{}');
    } catch (error) {
      return {};
    }
  };

  const setSeenDecisionMap = (userId, value) => {
    localStorage.setItem(`invenia_seen_candidate_decisions_${userId}`, JSON.stringify(value));
  };

  const showQueuedCandidateNotices = (user, applicationItems) => {
    const queuedNotice = sessionStorage.getItem('invenia_candidate_notice');
    if (queuedNotice) {
      sessionStorage.removeItem('invenia_candidate_notice');
      try {
        const parsedNotice = JSON.parse(queuedNotice);
        if (parsedNotice.redirectTab) {
          setActiveTab(parsedNotice.redirectTab);
        }
        showCandidateNotice({
          ...parsedNotice,
          onAfterClose: () => {
            if (parsedNotice.redirectTab) {
              setActiveTab(parsedNotice.redirectTab);
            }
          },
        });
        return;
      } catch (error) {
        // Ignore malformed one-time notices.
      }
    }

    const decision = (applicationItems || []).find((application) => ['approved', 'rejected'].includes(application.status));
    if (!decision || !user?.id) {
      return;
    }
    const seenMap = getSeenDecisionMap(user.id);
    const key = `${decision.id}:${decision.status}:${decision.updatedAt || decision.workflowStage || decision.appliedDate || ''}`;
    if (seenMap[key]) {
      return;
    }
    seenMap[key] = true;
    setSeenDecisionMap(user.id, seenMap);
    showCandidateNotice({
      label: decision.status === 'approved' ? 'Recruiter approval' : 'Recruiter decision',
      title: decision.status === 'approved' ? 'You are selected for the next round' : 'Application update',
      message: decision.status === 'approved'
        ? `Recruiter approved your application for ${decision.jobTitle}. You can now start the enabled assessment rounds from the Applied tab.`
        : `Recruiter rejected your application for ${decision.jobTitle}. You can still review the status in the Applied tab.`,
      details: decision.nextStep,
      tone: decision.status === 'approved' ? 'green' : 'rose',
      actionLabel: decision.status === 'approved' ? 'Go to Applied tab' : 'View Applied tab',
      onAfterClose: () => setActiveTab('applications'),
    });
  };

  const clearInterviewTranscriptionRestart = () => {
    if (interviewRecognitionRestartRef.current) {
      window.clearTimeout(interviewRecognitionRestartRef.current);
      interviewRecognitionRestartRef.current = null;
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  };

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
        setCurrentUser(user);

        const [overviewData, applicationsData, profileData] = await Promise.all([
          candidateAPI.getOverview(),
          candidateAPI.getApplications(),
          candidateAPI.getProfile(),
        ]);

        setStats(overviewData.stats);
        setApplications(applicationsData.applications || []);
        applyProfile(profileData.profile);
        showQueuedCandidateNotices(user, applicationsData.applications || []);
        await loadJobs('', 'all');
      } catch (requestError) {
        setError(requestError.response?.data?.detail || 'Failed to load candidate dashboard');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [navigate]);

  useEffect(() => {
    if (currentUser && (activeTab === 'jobs' || activeTab === 'saved')) {
      const filter = activeTab === 'saved' ? 'saved' : selectedFilter;
      loadJobs(debouncedSearchQuery, filter);
    }
  }, [activeTab, currentUser, debouncedSearchQuery, selectedFilter]);

  useEffect(() => {
    const onClick = (event) => {
      if (showProfileDropdown && profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showProfileDropdown]);

  useEffect(() => {
    if (!showApplyModal || !['aptitude', 'technical', 'interview'].includes(activeWorkflowStage)) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setWorkflowTimers((prev) => ({
        ...prev,
        [activeWorkflowStage]: Math.max(0, (prev[activeWorkflowStage] || 0) - 1),
      }));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [showApplyModal, activeWorkflowStage]);

  useEffect(() => {
    if (!showApplyModal || !['aptitude', 'technical', 'interview'].includes(activeWorkflowStage)) {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setProctoring((prev) => ({
          warnings: prev.warnings + 1,
          events: [
            ...prev.events,
            `${activeWorkflowStage} tab switch at ${new Date().toLocaleTimeString()}`,
          ].slice(-8),
        }));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [showApplyModal, activeWorkflowStage]);

  useEffect(() => {
    if (!showApplyModal || activeWorkflowStage !== 'interview') {
      return undefined;
    }

    const handleBlur = () => {
      setProctoring((prev) => ({
        warnings: prev.warnings + 1,
        events: [...prev.events, 'Window focus was lost during the interview.'].slice(-8),
      }));
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setProctoring((prev) => ({
          warnings: prev.warnings + 1,
          events: [...prev.events, 'Exited fullscreen during the interview.'].slice(-8),
        }));
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [showApplyModal, activeWorkflowStage]);

  useEffect(() => {
    if (!showApplyModal || activeWorkflowStage !== 'interview' || !interviewStarted) {
      return undefined;
    }
    speakCurrentInterviewQuestion(() => {
      if (!interviewTranscribingRef.current) {
        startInterviewTranscription();
      }
    });
    return undefined;
  }, [showApplyModal, activeWorkflowStage, interviewStarted, workflowSession?.workflow?.interview?.currentQuestion?.id]);

  useEffect(() => () => {
    stopInterviewSnapshotLoop();
    clearInterviewTranscriptionRestart();
    interviewTranscribingRef.current = false;
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (error) {
        // Ignore shutdown errors.
      }
      speechRecognitionRef.current = null;
    }
    if (interviewRecorderRef.current && interviewRecorderRef.current.state !== 'inactive') {
      try {
        interviewRecorderRef.current.stop();
      } catch (error) {
        // Ignore shutdown errors.
      }
    }
    cameraStreamRef.current?.getTracks?.().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (
      showApplyModal
      && ['aptitude', 'technical', 'interview'].includes(activeWorkflowStage)
      && (!cameraGranted || (activeWorkflowStage === 'interview' && !cameraAudioEnabled))
    ) {
      requestCameraAccess(activeWorkflowStage === 'interview');
    }
  }, [showApplyModal, activeWorkflowStage, cameraGranted, cameraAudioEnabled]);

  const loadJobs = async (search = '', filter = 'all') => {
    setJobsLoading(true);
    try {
      const jobsData = await candidateAPI.getJobs(search, filter);
      setJobs(jobsData.jobs || []);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Failed to load jobs');
    } finally {
      setJobsLoading(false);
    }
  };

  const refreshCandidateData = async () => {
    const [overviewData, applicationsData, profileData] = await Promise.all([
      candidateAPI.getOverview(),
      candidateAPI.getApplications(),
      candidateAPI.getProfile(),
    ]);
    setStats(overviewData.stats);
    setApplications(applicationsData.applications || []);
    applyProfile(profileData.profile);
    if (currentUser) {
      showQueuedCandidateNotices(currentUser, applicationsData.applications || []);
    }
    await loadJobs(searchQuery, effectiveFilter);
  };

  const applyProfile = (profileData) => {
    setProfile(profileData);
    setProfileForm({
      full_name: profileData.full_name || '',
      phone: profileData.phone || '',
      location: profileData.location || '',
      current_job_title: profileData.current_job_title || '',
      current_company: profileData.current_company || '',
      experience_years: profileData.experience_years || '',
      salary_expectation: profileData.salary_expectation || '',
      bio: profileData.bio || '',
      skills: (profileData.skills || []).join(', '),
      preferred_job_types: (profileData.preferred_job_types || []).join(', '),
      preferred_locations: (profileData.preferred_locations || []).join(', '),
      linkedin_url: profileData.linkedin_url || '',
      github_url: profileData.github_url || '',
      portfolio_url: profileData.portfolio_url || '',
      is_available: profileData.is_available,
    });
  };

  const stopCameraPreview = () => {
    cameraStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraGranted(false);
    setCameraAudioEnabled(false);
  };

  const dataUrlToFile = async (dataUrl, filename) => {
    if (!dataUrl) return null;
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type || 'image/png' });
  };

  const captureInterviewSnapshot = () => {
    if (!cameraVideoRef.current) return null;
    const video = cameraVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const snapshotUrl = canvas.toDataURL('image/png');
    setInterviewSnapshotUrl(snapshotUrl);
    interviewSnapshotRef.current = snapshotUrl;
    return snapshotUrl;
  };

  const stopInterviewSnapshotLoop = () => {
    if (interviewSnapshotIntervalRef.current) {
      window.clearInterval(interviewSnapshotIntervalRef.current);
      interviewSnapshotIntervalRef.current = null;
    }
  };

  const startInterviewSnapshotLoop = () => {
    stopInterviewSnapshotLoop();
    interviewSnapshotIntervalRef.current = window.setInterval(() => {
      captureInterviewSnapshot();
    }, 15000);
  };

  const toggleFullscreen = async () => {
    if (!interviewPanelRef.current) return;
    try {
      if (!document.fullscreenElement && interviewPanelRef.current.requestFullscreen) {
        await interviewPanelRef.current.requestFullscreen();
      }
    } catch (error) {
      setProctoring((prev) => ({
        warnings: prev.warnings + 1,
        events: [...prev.events, 'Fullscreen request was blocked by the browser.'].slice(-8),
      }));
    }
  };

  const startInterviewTranscription = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setProctoring((prev) => ({
        warnings: prev.warnings + 1,
        events: [...prev.events, 'Browser speech recognition is unavailable.'].slice(-8),
      }));
      return;
    }

    if (speechRecognitionRef.current) {
      return;
    }

    clearInterviewTranscriptionRestart();
    interviewTranscribingRef.current = true;
    interviewFinalTranscriptRef.current = interviewAnswerDraftRef.current.trim();

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-IN';
    recognition.onresult = (event) => {
      let finalTranscript = interviewFinalTranscriptRef.current || '';
      let interimTranscript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
      }
      interviewFinalTranscriptRef.current = finalTranscript;
      updateInterviewAnswerDraft([finalTranscript, interimTranscript].filter(Boolean).join(' ').trim());
    };
    recognition.onerror = (event) => {
      if (!interviewTranscribingRef.current) {
        return;
      }

      const recoverableErrors = new Set(['aborted', 'audio-capture', 'network', 'no-speech']);
      if (recoverableErrors.has(event.error)) {
        speechRecognitionRef.current = null;
        clearInterviewTranscriptionRestart();
        interviewRecognitionRestartRef.current = window.setTimeout(() => {
          if (interviewTranscribingRef.current) {
            startInterviewTranscription();
          }
        }, 350);
        return;
      }

      interviewTranscribingRef.current = false;
      setInterviewTranscribing(false);
      speechRecognitionRef.current = null;
    };
    recognition.onend = () => {
      speechRecognitionRef.current = null;
      if (!interviewTranscribingRef.current) {
        setInterviewTranscribing(false);
        return;
      }

      clearInterviewTranscriptionRestart();
      interviewRecognitionRestartRef.current = window.setTimeout(() => {
        if (interviewTranscribingRef.current) {
          startInterviewTranscription();
        }
      }, 300);
    };
    speechRecognitionRef.current = recognition;
    setInterviewTranscribing(true);
    try {
      recognition.start();
    } catch (error) {
      interviewTranscribingRef.current = false;
      speechRecognitionRef.current = null;
      setInterviewTranscribing(false);
      setProctoring((prev) => ({
        warnings: prev.warnings + 1,
        events: [...prev.events, 'Voice capture could not be started. Please try again.'].slice(-8),
      }));
    }
  };

  const stopInterviewTranscription = () => {
    interviewTranscribingRef.current = false;
    clearInterviewTranscriptionRestart();
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (error) {
        // Ignore.
      }
      speechRecognitionRef.current = null;
    }
    setInterviewTranscribing(false);
  };

  const speakCurrentInterviewQuestion = (afterSpeech = null) => {
    const question = workflowSession?.workflow?.interview?.currentQuestion?.audioUrl
      ? null
      : workflowSession?.workflow?.interview?.currentQuestion?.prompt;
    const audioUrl = workflowSession?.workflow?.interview?.currentQuestion?.audioUrl;
    if (audioUrl) {
      const audio = new Audio(buildFileUrl(audioUrl));
      setInterviewSpeaking(true);
      audio.onended = () => {
        setInterviewSpeaking(false);
        if (typeof afterSpeech === 'function') {
          afterSpeech();
        }
      };
      audio.onerror = () => {
        setInterviewSpeaking(false);
        if (typeof afterSpeech === 'function') {
          afterSpeech();
        }
      };
      audio.play().catch(() => {
        setInterviewSpeaking(false);
        if (typeof afterSpeech === 'function') {
          afterSpeech();
        }
      });
      return;
    }

    if (!question || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question);
    utterance.rate = 0.96;
    utterance.onstart = () => setInterviewSpeaking(true);
    utterance.onend = () => {
      setInterviewSpeaking(false);
      if (typeof afterSpeech === 'function') {
        afterSpeech();
      }
    };
    utterance.onerror = () => {
      setInterviewSpeaking(false);
      if (typeof afterSpeech === 'function') {
        afterSpeech();
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  const startInterviewRecording = async () => {
    if (!cameraStreamRef.current || interviewRecorderRef.current) return;
    if (!window.MediaRecorder) {
      setProctoring((prev) => ({
        warnings: prev.warnings + 1,
        events: [...prev.events, 'MediaRecorder is unavailable in this browser.'].slice(-8),
      }));
      return;
    }

    interviewChunksRef.current = [];
    let recorder;
    const recorderOptions = {
      videoBitsPerSecond: 450000,
      audioBitsPerSecond: 64000,
    };
    if (MediaRecorder.isTypeSupported?.('video/webm;codecs=vp8,opus')) {
      recorderOptions.mimeType = 'video/webm;codecs=vp8,opus';
    }
    try {
      recorder = new MediaRecorder(cameraStreamRef.current, recorderOptions);
    } catch (error) {
      recorder = new MediaRecorder(cameraStreamRef.current);
    }
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        interviewChunksRef.current.push(event.data);
      }
    };
    interviewRecorderRef.current = recorder;
    recorder.start(1000);
    setInterviewStarted(true);
  };

  const stopInterviewRecording = () =>
    new Promise((resolve) => {
      const recorder = interviewRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        interviewChunksRef.current = [];
        interviewRecorderRef.current = null;
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const blob = interviewChunksRef.current.length > 0
          ? new Blob(interviewChunksRef.current, { type: 'video/webm' })
          : null;
        interviewChunksRef.current = [];
        interviewRecorderRef.current = null;
        resolve(blob);
      };

      try {
        recorder.stop();
      } catch (error) {
        interviewChunksRef.current = [];
        interviewRecorderRef.current = null;
        resolve(null);
      }
    });

  const uploadInterviewArtifacts = async (report, workflowSnapshot = null) => {
    const applicationId = workflowSnapshot?.applicationId || workflowSession?.applicationId;
    if (!applicationId) return;
    const recordingBlob = await stopInterviewRecording();
    const snapshotFile = await dataUrlToFile(interviewSnapshotRef.current || interviewSnapshotUrl, `interview-snapshot-${applicationId}.png`);
    if (!recordingBlob && !snapshotFile && !report) return;

    const transcript = (workflowSnapshot?.interview?.turns || [])
      .map((turn, index) => `Q${index + 1}: ${turn.question}\nA${index + 1}: ${turn.answer}`)
      .join('\n\n');
    const formData = new FormData();
    if (recordingBlob) {
      formData.append('recording', new File([recordingBlob], `interview-${applicationId}.webm`, { type: 'video/webm' }));
    }
    if (snapshotFile) {
      formData.append('snapshot', snapshotFile);
    }
    formData.append('transcript', transcript || interviewAnswerDraftRef.current || interviewAnswerDraft || '');
    formData.append('proctoring', JSON.stringify(proctoring));
    if (report) {
      formData.append('report', JSON.stringify(report));
    }

    setInterviewUploading(true);
    try {
      const response = await candidateAPI.uploadInterviewRecording(applicationId, formData);
      if (response.workflow) {
        setWorkflowSession((prev) => ({
          ...(prev || {}),
          applicationId: response.applicationId || prev?.applicationId,
          workflow: response.workflow,
        }));
        setInterviewRecordingUrl(response.workflow?.interview?.recordingUrl || '');
        setInterviewReport(response.workflow?.interview?.report || report || null);
      }
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to upload interview recording');
    } finally {
      setInterviewUploading(false);
    }
  };

  const beginInterviewSession = async () => {
    if (!workflowSession?.workflow?.interview?.currentQuestion || interviewStarted) return;
    if (!cameraGranted || !cameraAudioEnabled) {
      await requestCameraAccess(true);
    }
    if (!cameraStreamRef.current) {
      return;
    }
    await toggleFullscreen();
    captureInterviewSnapshot();
    await startInterviewRecording();
    if (interviewRecorderRef.current) {
      startInterviewSnapshotLoop();
    }
  };

  const handleInterviewPromptPlayback = () => {
    speakCurrentInterviewQuestion();
  };

  const resetWorkflowDrafts = (workflow) => {
    setWorkflowDraft({
      aptitude: {},
      technical: {},
      coding: workflow?.coding?.questions?.map(() => '') || ['', ''],
      interview: {},
    });
    setWorkflowTimers({
      aptitude: (workflow?.aptitude?.durationMinutes || 60) * 60,
      technical: (workflow?.technical?.durationMinutes || 60) * 60,
      interview: (workflow?.interview?.durationMinutes || 10) * 60,
    });
    setProctoring({ warnings: 0, events: [] });
    setInterviewStarted(false);
    updateInterviewAnswerDraft('');
    interviewFinalTranscriptRef.current = '';
    setInterviewTranscribing(false);
    setInterviewSpeaking(false);
    setInterviewUploading(false);
    setInterviewSnapshotUrl('');
    setInterviewRecordingUrl('');
    setInterviewReport(null);
    interviewChunksRef.current = [];
    interviewSnapshotRef.current = null;
    stopInterviewSnapshotLoop();
    clearInterviewTranscriptionRestart();
    window.speechSynthesis?.cancel?.();
    interviewTranscribingRef.current = false;
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (error) {
        // Ignore speech recognition shutdown errors.
      }
      speechRecognitionRef.current = null;
    }
  };

  const openWorkflowModal = (job) => {
    if (job.isApplied) {
      setActiveTab('applications');
      navigate('/dashboard/candidate?tab=applications');
      return;
    }
    navigate(`/dashboard/candidate/jobs/${job.id}/apply`);
  };

  const closeWorkflowModal = () => {
    window.speechSynthesis?.cancel?.();
    stopInterviewSnapshotLoop();
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (error) {
        // Ignore shutdown errors.
      }
      speechRecognitionRef.current = null;
    }
    if (interviewRecorderRef.current && interviewRecorderRef.current.state !== 'inactive') {
      try {
        interviewRecorderRef.current.stop();
      } catch (error) {
        // Ignore shutdown errors.
      }
    }
    stopCameraPreview();
    setShowApplyModal(false);
    setWorkflowSession(null);
    setActiveWorkflowStage('profile');
    setWorkflowDraft({
      aptitude: {},
      technical: {},
      coding: ['', ''],
      interview: {},
    });
    setCoverLetter('');
    updateInterviewAnswerDraft('');
    interviewFinalTranscriptRef.current = '';
    setInterviewStarted(false);
    setInterviewReport(null);
    setInterviewRecordingUrl('');
    setInterviewSnapshotUrl('');
    setCameraAudioEnabled(false);
    interviewTranscribingRef.current = false;
  };

  const requestCameraAccess = async (withAudio = false) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      window.alert('Camera access is not available in this browser.');
      return;
    }
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: withAudio,
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
      setCameraGranted(true);
      setCameraAudioEnabled(Boolean(withAudio && stream.getAudioTracks().length > 0));
    } catch (requestError) {
      setCameraGranted(false);
      setCameraAudioEnabled(false);
      window.alert('Camera permission is required for the assessment experience.');
    }
  };

  const handleCheckATSScore = async () => {
    setAtsLoading(true);
    try {
      const response = await candidateAPI.checkATSScore();
      if (response.profile) {
        applyProfile(response.profile);
      }
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to calculate ATS score');
    } finally {
      setAtsLoading(false);
    }
  };

  const buildAnswerPayload = (questions, selectedAnswers) =>
    (questions || []).map((question) => {
      const picked = selectedAnswers?.[question.id];
      return typeof picked === 'number' ? picked : -1;
    });

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    navigate('/login/candidate');
  };

  const handleSaveJob = async (jobId) => {
    try {
      await candidateAPI.saveJob(jobId);
      await refreshCandidateData();
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to update saved jobs');
    }
  };

  const handleViewJob = async (job) => {
    navigate(`/dashboard/candidate/jobs/${job.id}`);
  };

  const handleRevokeApplication = async (application) => {
    if (!application?.id || application.status === 'revoked') return;
    setConfirmation({
      title: 'Revoke application?',
      message: `Your application for "${application.jobTitle}" will be withdrawn permanently and you cannot apply to this job again.`,
      confirmLabel: 'Revoke application',
      danger: true,
      action: () => executeRevokeApplication(application),
    });
  };

  const executeRevokeApplication = async (application) => {
    setConfirmation(null);
    try {
      await candidateAPI.revokeApplication(application.id);
      showCandidateNotice({
        label: 'Application revoked',
        title: 'Application revoked successfully',
        message: `Your application for ${application.jobTitle} has been revoked. Re-applying to this job is disabled.`,
        tone: 'amber',
        actionLabel: 'View jobs',
        onAfterClose: () => setActiveTab('jobs'),
      });
      await refreshCandidateData();
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to revoke application');
    }
  };

  const handleProfileAutofill = async () => {
    if (!profileAutofillText.trim() && !profileAutofillFile) {
      window.alert('Paste CV content or upload a CV first.');
      return;
    }
    setProfileAutofilling(true);
    try {
      const response = await candidateAPI.autofillProfile({ text: profileAutofillText, file: profileAutofillFile });
      setProfileForm((prev) => ({ ...prev, ...(response.profile || {}) }));
      showCandidateNotice({
        label: 'Profile auto-filled',
        title: 'Profile fields are ready for review',
        message: 'The system extracted profile details from your CV. Please review the fields and click Save Profile.',
        tone: 'green',
      });
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to auto-fill profile');
    } finally {
      setProfileAutofilling(false);
    }
  };

  const handleOpenProfileResume = async () => {
    const previewWindow = openPreparedPreviewWindow('My CV preview');
    try {
      const response = await candidateAPI.getResume();
      openBlobResponse(response, previewWindow);
    } catch (requestError) {
      previewWindow?.close?.();
      window.alert(requestError.response?.data?.detail || 'Unable to open your CV');
    }
  };

  const handleOpenApplicationResume = async (applicationId) => {
    const previewWindow = openPreparedPreviewWindow('Submitted CV preview');
    try {
      const response = await candidateAPI.getApplicationResume(applicationId);
      openBlobResponse(response, previewWindow);
    } catch (requestError) {
      previewWindow?.close?.();
      window.alert(requestError.response?.data?.detail || 'Unable to open submitted CV');
    }
  };

  const handleSubmitApplication = async () => {
    if (!selectedJob || !workflowSession) return;
    if (workflowSubmitting) return;
    setWorkflowSubmitting(true);
    try {
      let nextSession = workflowSession;
      let submittedNewApplication = false;
      if (!workflowSession.applicationId) {
        const response = await candidateAPI.applyToJob(selectedJob.id, coverLetter);
        submittedNewApplication = !response.already_applied;
        nextSession = {
          applicationId: response.application_id,
          canApply: false,
          alreadyApplied: true,
          status: response.status || 'pending',
          workflow: response.workflow,
        };
        setWorkflowSession(nextSession);
        resetWorkflowDrafts(response.workflow);
        if (response.already_applied) {
          setShowApplyModal(false);
          setSelectedJob(null);
          setCoverLetter('');
          setActiveTab('applications');
          showCandidateNotice({
            label: 'Already applied',
            title: 'Application already exists',
            message: `Your application for ${selectedJob.title} is already submitted.`,
            details: 'No duplicate application was created. Please track the current status from the Applied tab.',
            tone: 'amber',
            actionLabel: 'View applied jobs',
            onAfterClose: () => setActiveTab('applications'),
          });
          await refreshCandidateData();
          return;
        }
      }
      if (!submittedNewApplication) {
        setActiveWorkflowStage(nextSession.workflow.currentStage === 'profile' ? 'aptitude' : nextSession.workflow.currentStage);
        await refreshCandidateData();
        return;
      }
      setShowApplyModal(false);
      setSelectedJob(null);
      setCoverLetter('');
      setActiveTab('jobs');
      showCandidateNotice({
        label: 'Application submitted',
        title: 'Application sent for recruiter approval',
        message: `Your application for ${selectedJob.title} has been sent to the recruiter for verification.`,
        details: 'You will receive a one-time dashboard notification when the recruiter approves or rejects the next round.',
        tone: 'green',
        actionLabel: 'Back to jobs',
        onAfterClose: () => setActiveTab('jobs'),
      });
      await refreshCandidateData();
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to submit application');
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  const handleWorkflowStageSubmit = async (stage, options = {}) => {
    if (!workflowSession?.applicationId || !workflowSession?.workflow) return;
    const workflow = workflowSession.workflow;
    let payload = { stage };
    if (options.skip) {
      payload.skipped = true;
    }

    if (stage === 'aptitude') {
      payload = {
        stage,
        skipped: Boolean(options.skip),
        answers: buildAnswerPayload(workflow.aptitude.questions, workflowDraft.aptitude),
      };
    }

    if (stage === 'technical') {
      payload = {
        stage,
        skipped: Boolean(options.skip),
        answers: buildAnswerPayload(workflow.technical.questions, workflowDraft.technical),
      };
    }

    if (stage === 'coding') {
      payload = {
        stage,
        skipped: Boolean(options.skip),
        coding_answers: workflowDraft.coding,
      };
    }

    if (stage === 'interview') {
      if (!interviewStarted) {
        window.alert('Start the interview session before submitting an answer.');
        return;
      }
      const transcript = interviewAnswerDraftRef.current.trim() || interviewAnswerDraft.trim();
      payload = {
        stage,
        interview_answer: transcript,
        interview_transcript: transcript,
        interview_notes: `Candidate completed AI interview simulation with ${proctoring.warnings} proctoring warnings.`,
        proctoring,
      };
    }

    setWorkflowSubmitting(true);
    try {
      const response = await candidateAPI.submitWorkflowStage(workflowSession.applicationId, payload);
      setWorkflowSession((prev) => ({
        ...(prev || {}),
        applicationId: response.applicationId,
        workflow: response.workflow,
      }));
      if (stage === 'interview') {
        if (response.workflow.currentStage === 'completed') {
          setActiveWorkflowStage('completed');
          setInterviewReport(response.workflow.interview?.report || null);
          stopInterviewTranscription();
          stopInterviewSnapshotLoop();
          setInterviewStarted(false);
          await uploadInterviewArtifacts(response.workflow.interview?.report || null, {
            applicationId: response.applicationId,
            interview: response.workflow?.interview || {},
          });
          showCandidateNotice({
            label: 'Interview submitted',
            title: 'Interview recording saved',
            message: 'Your interview recording, transcript, and AI report were submitted to the recruiter.',
            tone: 'green',
            actionLabel: 'View result',
          });
        } else {
          setActiveWorkflowStage('interview');
          updateInterviewAnswerDraft('');
          interviewFinalTranscriptRef.current = '';
          setInterviewReport(response.workflow.interview?.report || null);
        }
      } else {
        if (response.workflow.currentStage === 'completed') {
          setActiveWorkflowStage('completed');
        } else {
          setActiveWorkflowStage(response.workflow.currentStage);
        }
        const stageNames = {
          aptitude: 'Aptitude test',
          technical: 'Technical MCQ',
          coding: 'Coding round',
        };
        if (stageNames[stage]) {
          showCandidateNotice({
            label: options.skip ? 'Stage skipped' : 'Stage submitted',
            title: `${stageNames[stage]} ${options.skip ? 'skipped' : 'submitted'}`,
            message: options.skip
              ? `${stageNames[stage]} was skipped because it is optional for this job.`
              : `${stageNames[stage]} has been submitted successfully.`,
            details: 'Your progress is saved and will be visible to the recruiter.',
            tone: options.skip ? 'amber' : 'green',
            actionLabel: 'Continue',
          });
        }
      }
      await refreshCandidateData();
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to submit this stage');
    } finally {
      setWorkflowSubmitting(false);
    }
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const payload = {
        full_name: profileForm.full_name,
        phone: profileForm.phone || null,
        location: profileForm.location || null,
        current_job_title: profileForm.current_job_title || null,
        current_company: profileForm.current_company || null,
        experience_years: profileForm.experience_years ? Number(profileForm.experience_years) : null,
        salary_expectation: profileForm.salary_expectation || null,
        bio: profileForm.bio || null,
        skills: JSON.stringify(splitText(profileForm.skills)),
        preferred_job_types: JSON.stringify(splitText(profileForm.preferred_job_types)),
        preferred_locations: JSON.stringify(splitText(profileForm.preferred_locations)),
        linkedin_url: profileForm.linkedin_url || null,
        github_url: profileForm.github_url || null,
        portfolio_url: profileForm.portfolio_url || null,
        is_available: profileForm.is_available,
      };
      await candidateAPI.updateProfile(payload);
      setShowProfileModal(false);
      await refreshCandidateData();
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
      const response = await candidateAPI.uploadPhoto(file);
      if (response.profile) applyProfile(response.profile);
      showCandidateNotice({ label: 'Photo updated', title: 'Profile photo saved', message: 'Your new photo is now visible on your profile and to recruiters reviewing your applications.', tone: 'green' });
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to upload profile photo');
    } finally {
      setUploadingPhoto(false);
      event.target.value = '';
    }
  };

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingResume(true);
    try {
      const response = await candidateAPI.uploadResume(file);
      if (response.profile) {
        applyProfile(response.profile);
      }
      showCandidateNotice({
        label: 'CV updated',
        title: 'Resume uploaded and stored',
        message: 'Your CV was uploaded successfully and is now available for candidate and recruiter preview.',
        details: `Latest ATS score: ${response.profile?.ats_score || 0}%`,
        tone: 'green',
        actionLabel: 'Continue',
      });
      await refreshCandidateData();
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to upload resume');
    } finally {
      setUploadingResume(false);
      event.target.value = '';
    }
  };

  if (loading) {
    return <PageSkeleton label="Loading candidate dashboard" />;
  }

  const navItems = [
    { id: 'jobs', label: 'Jobs', icon: ColorJobsIcon },
    { id: 'applications', label: 'My applications', icon: ColorApplicationsIcon },
    { id: 'saved', label: 'Saved', icon: ColorSavedIcon },
    { id: 'profile', label: 'Profile', icon: ColorProfileIcon },
  ];

  const name = profile?.full_name || currentUser?.full_name || currentUser?.username || 'Candidate';
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const workflowData = workflowSession?.workflow;
  const atsScore = profile?.ats_score || 0;
  const atsTone = getAtsTone(atsScore);
  const atsBreakdown = Array.isArray(profile?.ats_breakdown) ? profile.ats_breakdown.slice(0, 5) : [];
  const atsStrengths = normalizeStringList(profile?.ats_strengths, 5);
  const atsFoundKeywords = normalizeStringList(profile?.ats_keywords_found, 6);
  const atsMissingKeywords = normalizeStringList(profile?.ats_keywords_missing, 6);
  const atsTips = normalizeStringList(profile?.ats_optimization_tips?.length ? profile.ats_optimization_tips : profile?.ats_suggestions, 5);
  const atsSourceLabel = profile?.ats_source
    ? `${profile.ats_source}${profile.ats_model ? ` · ${profile.ats_model}` : ''}`
    : 'Invenia AI Analysis';
  const atsLastScan = formatScanTimestamp(profile?.ats_last_checked_at);
  const interviewData = workflowData?.interview || {};
  const interviewCurrentQuestion = interviewData.currentQuestion || (Array.isArray(interviewData.questions) && interviewData.questions.length > 0 ? interviewData.questions[interviewData.questions.length - 1] : null);
  const interviewTurns = interviewData.turns || [];
  const interviewMaxQuestions = interviewData.maxQuestions || 3;
  const currentWorkflowIndex = activeWorkflowStage === 'completed'
    ? workflowStages.length
    : workflowStages.findIndex((stage) => stage.id === activeWorkflowStage);
  const normalizedApplicationSearch = applicationSearch.trim().toLowerCase();
  const filteredApplications = applications.filter((application) => {
    const matchesSearch = !normalizedApplicationSearch || [application.jobTitle, application.company, application.publicJobId]
      .some((value) => String(value || '').toLowerCase().includes(normalizedApplicationSearch));
    const matchesStatus = applicationStatus === 'all' || application.status === applicationStatus;
    return matchesSearch && matchesStatus;
  });
  const visibleJobs = jobs.filter((job) => {
    const location = String(job.location || '').toLowerCase();
    const experience = String(job.experienceLevel || '').toLowerCase();
    const matchesLocation = !jobFilters.location.trim() || location.includes(jobFilters.location.trim().toLowerCase());
    const matchesWorkMode = jobFilters.workMode === 'all'
      || (jobFilters.workMode === 'remote' && job.isRemote)
      || (jobFilters.workMode === 'onsite' && !job.isRemote && !location.includes('hybrid'))
      || (jobFilters.workMode === 'hybrid' && location.includes('hybrid'));
    const matchesType = jobFilters.jobType === 'all' || String(job.type || '').toLowerCase() === jobFilters.jobType;
    const matchesExperience = jobFilters.experience === 'all'
      || (jobFilters.experience === 'entry' && /entry|junior|0\s*-?\s*2/.test(experience))
      || (jobFilters.experience === 'mid' && /mid|3\s*-?\s*5|4\s*-?\s*6/.test(experience))
      || (jobFilters.experience === 'senior' && /senior|lead|principal|[6-9]\+?\s*year/.test(experience));
    const postedAt = job.postedDate ? new Date(job.postedDate).getTime() : 0;
    const maxAge = jobFilters.date === 'week' ? 7 : jobFilters.date === 'month' ? 30 : null;
    const matchesDate = !maxAge || (postedAt && Date.now() - postedAt <= maxAge * 86400000);
    return matchesLocation && matchesWorkMode && matchesType && matchesExperience && matchesDate;
  });
  const clearJobFilters = () => {
    setSearchQuery('');
    setSelectedFilter('all');
    setJobFilters({ location: '', workMode: 'all', jobType: 'all', experience: 'all', date: 'all' });
  };
  const nextActionApplication = applications.find((application) => application.canStartAssessment)
    || applications.find((application) => application.status === 'pending');
  const profileChecklist = [
    ['Profile photo', Boolean(profile?.photo_url)],
    ['Resume uploaded', Boolean(profile?.resume_url || profile?.resumeName)],
    ['Contact details', Boolean(profile?.phone && profile?.location)],
    ['Professional headline', Boolean(profile?.current_job_title)],
    ['Skills added', Boolean(profile?.skills?.length)],
    ['Professional summary', Boolean(profile?.bio)],
  ];
  const candidateTourSteps = [
    { target: '#candidate-job-tools', title: 'Discover suitable jobs', message: 'Search by role, location, skill, or Job ID. Select a job title to open its complete details.', onEnter: () => setActiveTab('jobs') },
    { target: '#candidate-job-tools', title: 'Search and filter quickly', message: 'Use filters to switch between all, saved, and applied jobs. Grid and list views are available on larger screens.', onEnter: () => setActiveTab('jobs') },
    { target: '#candidate-applications-panel', title: 'Track every application', message: 'Applied shows recruiter decisions, your next action, CV access, stage progress, and the Final Score after interview.', onEnter: () => setActiveTab('applications') },
    { target: '#candidate-profile-panel', title: 'Keep your profile ready', message: 'Upload your actual CV, use profile autofill, check ATS readiness, and complete the profile checklist.', onEnter: () => setActiveTab('profile') },
    { target: '#candidate-tour-button', title: 'Replay this tour anytime', message: 'The tour is optional. Use this button whenever you need a quick reminder.' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-cyan-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className={`hidden w-72 shrink-0 px-6 py-8 text-white lg:block ${sidebarGradient}`}>
          <div className="rounded-[28px] border border-white/20 bg-white/10 p-5 shadow-lg backdrop-blur">
            <p className="text-sm uppercase tracking-[0.24em] text-blue-100">Invenia AI</p>
            <h1 className="mt-3 text-2xl font-semibold">Candidate Dashboard</h1>
            <p className="mt-2 text-sm text-blue-50/90">
              Discover jobs, save roles, and manage your candidate story in one place.
            </p>
          </div>

          <nav className="mt-8 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                id={`candidate-nav-${item.id}`}
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
                <p className="text-sm font-semibold text-white">Profile strength</p>
                <p className="text-xs text-blue-100">{stats.profileCompletion}% complete</p>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-white/20">
              <div className="h-2 rounded-full bg-yellow-300" style={{ width: `${stats.profileCompletion}%` }} />
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

        <main className="flex-1">
          <header className="sticky top-0 z-20 border-b border-blue-100 bg-white/90 px-4 py-4 backdrop-blur lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-500">Welcome back</p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {activeTab === 'jobs' && 'Find Your Next Opportunity'}
                  {activeTab === 'applications' && 'Track Your Applications'}
                  {activeTab === 'saved' && 'Saved Jobs'}
                  {activeTab === 'profile' && 'My Profile'}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button id="candidate-tour-button" type="button" onClick={() => setTourOpen(true)} className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100">Quick tour</button>
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
                    onClose={() => setShowProfileDropdown(false)}
                    onProfile={() => setActiveTab('profile')}
                    onSaved={() => setActiveTab('saved')}
                    onSettings={() => setShowProfileModal(true)}
                    onSupport={() => showCandidateNotice({ label: 'Support', title: 'Need help?', message: 'Contact your recruitment coordinator or Invenia administrator using your registered email address.', tone: 'blue' })}
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

            {activeTab === 'jobs' && (
              <section className="mb-6 flex flex-col gap-4 rounded-[28px] border border-blue-200 bg-gradient-to-r from-[#071b3b] to-[#123f78] p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Your next action</p>
                  <h3 className="mt-2 text-xl font-semibold">{nextActionApplication?.canStartAssessment ? `Continue ${nextActionApplication.jobTitle}` : nextActionApplication ? 'Recruiter screening in progress' : 'Find your next opportunity'}</h3>
                  <p className="mt-2 text-sm text-blue-100">{nextActionApplication?.canStartAssessment ? 'An assessment round is ready in your assessment centre.' : nextActionApplication ? `${nextActionApplication.jobTitle} is waiting for recruiter review.` : 'Use the structured filters below to find a suitable role.'}</p>
                </div>
                <button type="button" onClick={() => nextActionApplication?.canStartAssessment ? navigate(`/dashboard/candidate/secure-terminal/${nextActionApplication.jobId}`) : setActiveTab(nextActionApplication ? 'applications' : 'jobs')} className="shrink-0 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-blue-900 hover:bg-blue-50">
                  {nextActionApplication?.canStartAssessment ? 'Open assessment centre' : nextActionApplication ? 'View application' : 'Explore jobs'}
                </button>
              </section>
            )}

            <section>
              <KpiStrip items={[
                { label: 'Applications', value: stats.applicationsSubmitted, icon: CheckCircleIcon, tone: 'bg-blue-50 text-blue-600' },
                { label: 'Interviews', value: stats.interviewsScheduled, icon: CalendarDaysIcon, tone: 'bg-violet-50 text-violet-600' },
                { label: 'Offers', value: stats.offersReceived, icon: SparklesIcon, tone: 'bg-emerald-50 text-emerald-600' },
                { label: 'Saved Jobs', value: stats.savedJobs, icon: BookmarkIcon, tone: 'bg-amber-50 text-amber-600' },
                { label: 'Profile', value: `${stats.profileCompletion}%`, icon: ChartBarIcon, tone: 'bg-cyan-50 text-cyan-600' },
                { label: 'Avg Match', value: `${stats.averageMatchScore}%`, icon: BriefcaseIcon, tone: 'bg-rose-50 text-rose-600' },
              ]} />
              <div className="mt-2 text-right"><ScoreHelp onClick={() => setShowScoreGlossary(true)} /></div>
            </section>

            {(activeTab === 'jobs' || activeTab === 'saved') && (
              <section className="mt-8">
                <div id="candidate-job-tools" className="rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative max-w-xl flex-1">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search title, location, skill, or Job ID"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-300"
                    />
                  </div>

                  {activeTab === 'jobs' && (
                    <div className="flex flex-wrap gap-2">
                      {['all', 'saved', 'applied'].map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setSelectedFilter(filter)}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                            selectedFilter === filter
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="hidden md:block"><ViewToggle value={jobViewMode} onChange={setJobViewMode} /></div>
                  </div>
                  <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-6">
                    <input value={jobFilters.location} onChange={(event) => setJobFilters((current) => ({ ...current, location: event.target.value }))} placeholder="Location" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm" />
                    <select value={jobFilters.workMode} onChange={(event) => setJobFilters((current) => ({ ...current, workMode: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"><option value="all">All work modes</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select>
                    <select value={jobFilters.jobType} onChange={(event) => setJobFilters((current) => ({ ...current, jobType: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"><option value="all">All employment types</option><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option></select>
                    <select value={jobFilters.experience} onChange={(event) => setJobFilters((current) => ({ ...current, experience: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"><option value="all">All experience</option><option value="entry">Entry / junior</option><option value="mid">Mid-level</option><option value="senior">Senior / lead</option></select>
                    <select value={jobFilters.date} onChange={(event) => setJobFilters((current) => ({ ...current, date: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"><option value="all">Any posting date</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option></select>
                    <button type="button" onClick={clearJobFilters} className="rounded-xl border border-blue-200 px-3 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">Clear filters</button>
                  </div>
                  <p className="mt-3 text-xs font-medium text-slate-500">Showing {visibleJobs.length} of {jobs.length} jobs</p>
                </div>

                {jobsLoading ? (
                  <div className="mt-6 rounded-[28px] border border-blue-100 bg-white p-6 text-sm text-slate-500">
                    Loading jobs...
                  </div>
                ) : visibleJobs.length === 0 ? (
                  <div className="mt-6 rounded-[28px] border border-dashed border-blue-200 bg-white p-10 text-center text-sm text-slate-500">
                    {activeTab === 'saved' && !searchQuery && jobs.length === 0 ? "You haven't saved any jobs yet. Explore available jobs and use Save Job to build your shortlist." : 'No jobs matched the current search and structured filters. Clear filters to see more roles.'}
                  </div>
                ) : jobViewMode === 'grid' ? (
                  <div className="mt-6 grid gap-5 xl:grid-cols-2">
                    {visibleJobs.map((job) => (
                      <CandidateJobCard
                        key={job.id}
                        job={job}
                        onView={handleViewJob}
                        onApply={openWorkflowModal}
                        onSave={handleSaveJob}
                      />
                    ))}
                  </div>
                ) : (
                  <>
                  <div className="mt-6 grid gap-4 md:hidden">
                    {visibleJobs.map((job) => <CandidateJobCard key={job.id} job={job} onView={handleViewJob} onApply={openWorkflowModal} onSave={handleSaveJob} />)}
                  </div>
                  <div className="mt-6 hidden overflow-x-auto rounded-[28px] border border-blue-100 bg-white shadow-[0_12px_35px_rgba(37,99,235,0.06)] md:block">
                    <table className="min-w-[980px] w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                        <tr>
                          <th className="px-5 py-4">Job</th>
                          <th className="px-5 py-4">Location</th>
                          <th className="px-5 py-4">Type</th>
                          <th className="px-5 py-4">Salary</th>
                          <th className="px-5 py-4">Match</th>
                          <th className="px-5 py-4">Applicants</th>
                          <th className="px-5 py-4">Status</th>
                          <th className="px-5 py-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleJobs.map((job) => (
                          <tr key={job.id} className="border-t border-slate-100 align-top">
                            <td className="px-5 py-4">
                              <JobIdChip value={job.publicJobId} className="mb-2" />
                              <button type="button" onClick={() => handleViewJob(job)} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline">{job.title}</button>
                              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><ProfileAvatar src={buildFileUrl(job.recruiterPhotoUrl)} name={job.company} className="h-7 w-7" textClassName="text-[10px]" />{job.company}</div>
                            </td>
                            <td className="px-5 py-4 text-slate-600">{job.location}</td>
                            <td className="px-5 py-4 text-slate-600">{job.type}</td>
                            <td className="px-5 py-4 font-semibold text-emerald-700">{formatSalaryText(job.salary)}</td>
                            <td className="px-5 py-4 font-semibold text-blue-700">{job.matchScore}%</td>
                            <td className="px-5 py-4 text-slate-600">{job.applicants || 0}</td>
                            <td className="px-5 py-4">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${job.isApplied ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {job.isApplied ? 'Applied' : 'Open'}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => handleViewJob(job)} className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                                  Details
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openWorkflowModal(job)}
                                  className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${job.isApplied ? 'bg-slate-500' : 'bg-emerald-600'}`}
                                >
                                  {job.isApplied ? 'Applied' : 'Apply'}
                                </button>
                                <button type="button" onClick={() => handleSaveJob(job.id)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                  {job.isSaved ? 'Saved' : 'Save'}
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

            {activeTab === 'applications' && (
              <section id="candidate-applications-panel" className="mt-8 rounded-[28px] border border-blue-100 bg-white shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                <div className="flex flex-col gap-4 border-b border-blue-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">My Applications</h3>
                    <p className="mt-1 text-sm text-slate-500">Every role you applied for appears here with live status.</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative"><MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={applicationSearch} onChange={(event) => setApplicationSearch(event.target.value)} placeholder="Search job or Job ID" className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm" /></div>
                    <select value={applicationStatus} onChange={(event) => setApplicationStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"><option value="all">All statuses</option>{Object.keys(statusClasses).map((status) => <option key={status} value={status}>{status}</option>)}</select>
                    <div className="hidden md:block"><ViewToggle value={applicationViewMode} onChange={setApplicationViewMode} /></div>
                  </div>
                </div>
                {filteredApplications.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-slate-500">
                    You have not applied to any jobs yet.
                  </div>
                ) : applicationViewMode === 'grid' ? (
                  <div className="grid gap-4 p-6 xl:grid-cols-2">
                    {filteredApplications.map((application) => (
                      <div key={application.id} className="rounded-3xl border border-blue-100 bg-slate-50 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <JobIdChip value={application.publicJobId} className="mb-2" />
                            <button type="button" onClick={() => handleViewJob({ id: application.jobId, title: application.jobTitle, publicJobId: application.publicJobId })} className="text-left text-lg font-semibold text-slate-900 transition hover:text-blue-700 hover:underline">{application.jobTitle}</button>
                            <p className="mt-1 text-sm text-slate-500">{application.company}</p>
                            <p className="mt-2 text-sm text-slate-500">Applied on {formatDate(application.appliedDate)}</p>
                          </div>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[application.status] || 'bg-slate-100 text-slate-600'}`}>
                            {application.status}
                          </span>
                        </div>
                        <p className="mt-4 text-sm text-slate-600">{application.nextStep}</p>
                        <ApplicationTimeline application={application} />
                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                          Workflow Stage: {application.workflowStage || 'profile'}
                          {application.finalScoreStatus === 'available' ? ` | Overall assessment score ${application.finalScore}%` : ' | Awaiting assessment'}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          {application.resumeUrl && (
                            <button type="button" onClick={() => handleOpenApplicationResume(application.id)} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                              Open CV
                            </button>
                          )}
                          {application.canStartAssessment && (
                            <button type="button" onClick={() => navigate(`/dashboard/candidate/secure-terminal/${application.jobId}`)} className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                              Start round
                            </button>
                          )}
                          {application.canViewResult && (
                            <button type="button" onClick={() => navigate(`/dashboard/candidate/secure-terminal/${application.jobId}`)} className="rounded-full bg-blue-900 px-3 py-1 text-xs font-semibold text-white">
                              View result
                            </button>
                          )}
                          {application.canWithdraw && (
                            <button type="button" onClick={() => handleRevokeApplication(application)} className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                              Withdraw application
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : applicationViewMode === 'list' ? (
                  <div className="divide-y divide-blue-50">
                    {filteredApplications.map((application) => (
                      <div key={application.id} className="px-6 py-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <JobIdChip value={application.publicJobId} className="mb-2" />
                            <button type="button" onClick={() => handleViewJob({ id: application.jobId, title: application.jobTitle, publicJobId: application.publicJobId })} className="text-left text-lg font-semibold text-slate-900 hover:text-blue-700 hover:underline">{application.jobTitle}</button>
                            <p className="mt-1 text-sm text-slate-500">{application.company}</p>
                            <p className="mt-2 text-sm text-slate-500">Applied on {formatDate(application.appliedDate)}</p>
                          </div>
                          <div className="lg:text-right">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[application.status] || 'bg-slate-100 text-slate-600'}`}>
                              {application.status}
                            </span>
                            <p className="mt-3 text-sm text-slate-600">{application.nextStep}</p>
                            <ApplicationTimeline application={application} />
                            <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                              Workflow Stage: {application.workflowStage || 'profile'}
                              {application.finalScoreStatus === 'available' ? ` | Overall assessment score ${application.finalScore}%` : ' | Awaiting assessment'}
                            </p>
                            {application.resumeUrl && (
                              <button
                                type="button"
                                onClick={() => handleOpenApplicationResume(application.id)}
                                className="mt-3 inline-flex text-sm font-medium text-blue-700 underline"
                              >
                                Open submitted CV
                              </button>
                            )}
                            {application.canStartAssessment && (
                              <button
                                type="button"
                                onClick={() => navigate(`/dashboard/candidate/secure-terminal/${application.jobId}`)}
                                className="mt-3 ml-0 inline-flex rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white lg:ml-3"
                              >
                                Start next round
                              </button>
                            )}
                            {application.canViewResult && (
                              <button type="button" onClick={() => navigate(`/dashboard/candidate/secure-terminal/${application.jobId}`)} className="mt-3 ml-0 inline-flex rounded-2xl bg-blue-900 px-4 py-2 text-sm font-semibold text-white lg:ml-3">
                                View result
                              </button>
                            )}
                            {application.canWithdraw && (
                              <button
                                type="button"
                                onClick={() => handleRevokeApplication(application)}
                                className="mt-3 ml-0 inline-flex rounded-2xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 lg:ml-3"
                              >
                                Withdraw application
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            )}

            {activeTab === 'profile' && profile && (
              <section id="candidate-profile-panel" className="mt-8 grid gap-6 xl:grid-cols-[1.25fr,0.85fr]">
                <div className="space-y-6">
                  <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Profile readiness</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Complete these items to improve recruiter confidence</h3></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">{profileChecklist.filter(([, done]) => done).length}/{profileChecklist.length}</span></div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">This checklist covers essential details. Profile strength also includes optional enrichment such as links, preferences, and detailed work history.</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">{profileChecklist.map(([label, done]) => <div key={label} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${done ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}><CheckCircleIcon className="h-4 w-4" />{label}</div>)}</div>
                  </div>
                  <div className={`rounded-[32px] p-8 text-white shadow-xl shadow-blue-200 ${sidebarGradient}`}>
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-5">
                        <ProfileAvatar src={buildFileUrl(profile.photo_url)} name={profile.full_name} className="h-24 w-24 border-4 border-white/30" textClassName="text-2xl" />
                        <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-blue-100">Candidate Profile</p>
                        <h3 className="mt-3 text-3xl font-semibold">{profile.full_name}</h3>
                        <p className="mt-2 text-blue-50/90">{profile.current_job_title || 'Candidate'}</p>
                        <p className="mt-1 text-sm text-blue-100">{profile.location || 'Location not added yet'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowProfileModal(true)}
                        className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
                      >
                        Edit Profile
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                    <h4 className="text-lg font-semibold text-slate-900">Professional Summary</h4>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {profile.bio || 'Add a short professional summary to help recruiters understand your background faster.'}
                    </p>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      {[
                        ['Current Role', profile.current_job_title || 'Not specified'],
                        ['Experience', profile.experience_years ? `${profile.experience_years} years` : 'Not specified'],
                        ['Preferred Job Types', (profile.preferred_job_types || []).join(', ') || 'Not specified'],
                        ['Salary Expectation', profile.salary_expectation || 'Not specified'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                          <p className="mt-2 text-sm text-slate-800">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                    <h4 className="text-lg font-semibold text-slate-900">Skills Snapshot</h4>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(profile.skills || []).length === 0 ? (
                        <p className="text-sm text-slate-500">Add your top skills so match scores improve across jobs.</p>
                      ) : (
                        profile.skills.map((skill) => (
                          <span key={skill} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                            {skill}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900">Resume & Links</h4>
                        <p className="mt-1 text-sm text-slate-500">Keep your CV and portfolio ready for every application.</p>
                      </div>
                      <DocumentTextIcon className="h-6 w-6 text-blue-400" />
                    </div>

                    <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                      <p className="text-sm font-medium text-slate-700">
                        {profile.resume_url ? `Resume uploaded${profile.resume_name ? `: ${profile.resume_name}` : ''}` : 'No resume uploaded yet'}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Every upload triggers a live Invenia AI Analysis so your ATS score and optimization tips update immediately.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        {profile.resume_url && (
                          <button
                            type="button"
                            onClick={handleOpenProfileResume}
                            className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                          >
                            Preview CV
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => resumeInputRef.current?.click()}
                          className="rounded-2xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700"
                        >
                          {uploadingResume ? 'Uploading and scanning...' : 'Upload and scan CV'}
                        </button>
                        <input
                          ref={resumeInputRef}
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleResumeUpload}
                          className="hidden"
                        />
                      </div>
                    </div>

                    <div className="mt-5 space-y-3 text-sm text-slate-600">
                      <p>Email: {profile.email}</p>
                      <p>Phone: {profile.phone || 'Not added'}</p>
                      <p>LinkedIn: {profile.linkedin_url || 'Not added'}</p>
                      <p>GitHub: {profile.github_url || 'Not added'}</p>
                      <p>Portfolio: {profile.portfolio_url || 'Not added'}</p>
                    </div>
                  </div>

                  <div className={`rounded-[28px] border p-6 shadow-sm ${atsTone.panel}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${atsTone.badge}`}>
                          Live ATS scan
                        </span>
                        <h4 className="mt-3 text-lg font-semibold text-slate-900">Check Your ATS Score</h4>
                        <p className="mt-1 text-sm text-slate-600">
                          Invenia AI Analysis scans your uploaded resume in real time and writes the score back to your profile.
                        </p>
                        <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{atsSourceLabel}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={handleCheckATSScore}
                          disabled={atsLoading || !profile.resume_url}
                          className="rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                        >
                          {atsLoading ? 'Scanning...' : profile.ats_score ? 'Re-scan with AI' : 'Scan resume'}
                        </button>
                        <span className="text-xs text-slate-500">Last scan: {atsLastScan}</span>
                      </div>
                    </div>
                    <div className="mt-5 rounded-3xl bg-white/90 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-500">Current ATS Score</p>
                          <p className="mt-2 text-3xl font-semibold text-slate-900">{profile.ats_score || 0}%</p>
                        </div>
                        <div className="h-16 w-16 rounded-full border-4 border-violet-200 p-1">
                          <div className="flex h-full items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">
                            ATS
                          </div>
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-700">
                        {profile.ats_summary || 'Upload your latest CV and run ATS scoring to unlock detailed feedback.'}
                      </p>
                      {(profile.ats_suggestions || []).length > 0 && (
                        <div className="mt-4 space-y-2 text-sm text-slate-700">
                          {profile.ats_suggestions.slice(0, 4).map((item) => (
                            <p key={item}>• {item}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-sky-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium uppercase tracking-[0.18em] text-sky-500">Resume optimization</p>
                        <h4 className="mt-2 text-lg font-semibold text-slate-900">Invenia AI Analysis details</h4>
                        <p className="mt-2 text-sm text-slate-600">
                          These are the signals Invenia AI Analysis detected in your uploaded resume and the quickest fixes to improve your ATS score.
                        </p>
                      </div>
                      <div className="rounded-2xl bg-sky-50 px-4 py-3 text-right">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">Last scan</p>
                        <p className="mt-1 text-sm font-medium text-slate-700">{atsLastScan}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Strengths</p>
                        {atsStrengths.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {atsStrengths.map((item) => (
                              <span key={item} className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                                {item}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">Run a scan to surface the strongest parts of the resume.</p>
                        )}
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Keyword gaps</p>
                        {atsMissingKeywords.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {atsMissingKeywords.map((item) => (
                              <span key={item} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                                {item}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">Invenia AI Analysis did not flag missing keywords on the latest scan.</p>
                        )}
                      </div>
                    </div>

                    {atsTips.length > 0 && (
                      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Optimization tips</p>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                          {atsTips.map((item) => (
                            <li key={item}>- {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {atsBreakdown.length > 0 ? (
                        atsBreakdown.map((item) => {
                          const maxScore = item.maxScore || 1;
                          const width = Math.min(100, Math.max(0, ((item.score || 0) / maxScore) * 100));
                          return (
                            <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                                <p className="text-xs font-semibold text-slate-500">
                                  {item.score || 0}/{maxScore}
                                </p>
                              </div>
                              <div className="mt-3 h-2 rounded-full bg-slate-200">
                                <div className={`h-2 rounded-full ${atsTone.bar}`} style={{ width: `${width}%` }} />
                              </div>
                              <p className="mt-3 text-xs leading-5 text-slate-600">{item.note}</p>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500 md:col-span-2">
                          Run a scan to see the ATS breakdown by section.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                    <h4 className="text-lg font-semibold text-slate-900">Invenia AI Analysis Guidance</h4>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                      <li>Your average job match is currently {stats.averageMatchScore}%.</li>
                      <li>Your latest ATS score is {profile.ats_score || 0}%.</li>
                      <li>Completing your profile to 100% makes you easier for recruiters to shortlist.</li>
                      <li>Uploading an updated CV ensures every recruiter sees the newest version in your candidate record.</li>
                    </ul>
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-blue-100 bg-white/95 px-4 py-2 backdrop-blur lg:hidden">
        <div className="flex items-center justify-around">
          {navItems.map((item) => (
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

      <NoticeModal
        notice={noticeModal}
        onClose={() => {
          const afterClose = noticeModal?.onAfterClose;
          setNoticeModal(null);
          if (typeof afterClose === 'function') {
            afterClose();
          }
        }}
      />

      {showJobModal && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[32px] bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-500">{selectedJob.company}</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedJob.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowJobModal(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-500">
              <span>{selectedJob.location}</span>
              <span>{formatSalaryText(selectedJob.salary)}</span>
              <span>{selectedJob.type}</span>
              {selectedJob.salaryPeriod && <span>{selectedJob.salaryPeriod}</span>}
              <span>Posted {formatDate(selectedJob.postedDate)}</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ['Viewed', selectedJob.views || 0],
                ['Applied', selectedJob.applicants || 0],
                ['Match', `${selectedJob.matchScore || 0}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Role Overview</h4>
                <p className="mt-3 text-sm leading-7 text-slate-600">{selectedJob.description}</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Requirements & Key Skills</h4>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedJob.skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <h4 className="text-lg font-semibold text-slate-900">Responsibilities</h4>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    {normalizeDetailList(selectedJob.responsibilities).length > 0 ? (
                      normalizeDetailList(selectedJob.responsibilities).map((item) => <p key={item}>- {item}</p>)
                    ) : (
                      <p>Responsibilities are not specified yet.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <h4 className="text-lg font-semibold text-slate-900">Benefits</h4>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    {normalizeDetailList(selectedJob.benefits).length > 0 ? (
                      normalizeDetailList(selectedJob.benefits).map((item) => <p key={item}>- {item}</p>)
                    ) : (
                      <p>Benefits are not specified yet.</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-3xl bg-blue-50 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-600">AI match score</span>
                  <span className="font-semibold text-emerald-600">{selectedJob.matchScore}%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${selectedJob.matchScore}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowJobModal(false);
                  openWorkflowModal(selectedJob);
                }}
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                {selectedJob.isApplied ? 'Open assessment centre' : 'Apply / Submit for Verification'}
              </button>
              <button
                type="button"
                onClick={() => handleSaveJob(selectedJob.id)}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
              >
                {selectedJob.isSaved ? 'Remove Bookmark' : 'Save Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApplyModal && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-[32px] bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-500">{selectedJob.company}</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Application Journey for {selectedJob.title}</h3>
              </div>
              <button
                type="button"
                onClick={closeWorkflowModal}
                className="rounded-full border border-slate-200 p-2 text-slate-500"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {workflowLoading || !workflowData ? (
              <div className="mt-8 rounded-[28px] border border-blue-100 bg-slate-50 p-10 text-center text-sm text-slate-500">
                Loading application workflow...
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-3 md:grid-cols-6">
                  {workflowStages.map((stage, index) => {
                    const isActive = activeWorkflowStage === stage.id;
                    const isComplete = currentWorkflowIndex > index;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => {
                          if (stage.id === 'profile' || workflowSession?.applicationId) {
                            setActiveWorkflowStage(stage.id);
                          }
                        }}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          isActive
                            ? 'border-blue-300 bg-blue-50 text-blue-700'
                            : isComplete
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.18em]">Stage {index + 1}</p>
                        <p className="mt-2 font-semibold">{stage.label}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 grid gap-6 xl:grid-cols-[1.18fr,0.82fr]">
                  <div className="space-y-6">
                    {activeWorkflowStage === 'profile' && (
                      <>
                        <div className="rounded-[28px] border border-blue-100 bg-slate-50 p-6">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium text-blue-500">Stage 1</p>
                              <h4 className="mt-2 text-xl font-semibold text-slate-900">Candidate profile review</h4>
                              <p className="mt-2 text-sm text-slate-600">
                                Review your profile, resume, ATS score, and job match before the assessment journey starts.
                              </p>
                            </div>
                            <div className="rounded-3xl bg-white px-5 py-4 text-right shadow-sm">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profile match</p>
                              <p className="mt-2 text-3xl font-semibold text-emerald-600">{workflowData.matchScore || selectedJob.matchScore}%</p>
                            </div>
                          </div>
                          <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {[
                              ['Candidate', workflowData.profile.full_name || profile?.full_name || name],
                              ['Email', workflowData.profile.email || profile?.email || currentUser?.email],
                              ['Current Role', workflowData.profile.current_job_title || profile?.current_job_title || 'Not added'],
                              ['Location', workflowData.profile.location || profile?.location || 'Not added'],
                              ['Experience', workflowData.profile.experience_years ? `${workflowData.profile.experience_years} years` : 'Not added'],
                              ['ATS Score', `${workflowData.atsScore || profile?.ats_score || 0}%`],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-2xl bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                                <p className="mt-2 text-sm text-slate-800">{value}</p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-5 flex flex-wrap gap-2">
                            {(workflowData.profile.skills || profile?.skills || []).map((skill) => (
                              <span key={skill} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                                {skill}
                              </span>
                            ))}
                          </div>
                          {workflowData.profile.resume_url && (
                            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-slate-700">
                              <span>Your uploaded CV is attached and ready.</span>
                              <button
                                type="button"
                                onClick={handleOpenProfileResume}
                                className="rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white"
                              >
                                Preview Resume
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
                          <h4 className="text-lg font-semibold text-slate-900">Cover Letter</h4>
                          <textarea
                            rows={6}
                            value={coverLetter}
                            onChange={(event) => setCoverLetter(event.target.value)}
                            className="mt-4 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-300"
                            placeholder="Share why you are a strong fit for this role before the assessment begins."
                          />
                        </div>

                        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                          <h4 className="text-lg font-semibold text-slate-900">What happens next</h4>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            {[
                              `Aptitude test: ${workflowData.aptitude.questionCount || workflowData.aptitude.questions?.length || 5} questions in ${workflowData.aptitude.durationMinutes} minutes (${workflowData.aptitude.required ? 'Compulsory' : 'Optional'})`,
                              `Technical test: ${workflowData.technical.questionCount || workflowData.technical.questions?.length || 5} questions in ${workflowData.technical.durationMinutes} minutes (${workflowData.technical.required ? 'Compulsory' : 'Optional'})`,
                              `Coding round: ${workflowData.coding.questionCount || 2} prompts (${workflowData.coding.required ? 'Compulsory' : 'Optional'})`,
                              `AI interview: ${workflowData.interview.maxQuestions || 3} voice-assisted questions with camera recording (${workflowData.interview.required ? 'Compulsory' : 'Optional'})`,
                            ].map((item) => (
                              <div key={item} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {activeWorkflowStage === 'aptitude' && (
                      <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-blue-500">Stage 2</p>
                            <h4 className="mt-2 text-xl font-semibold text-slate-900">Aptitude test</h4>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {workflowData.aptitude.required ? 'Compulsory' : 'Optional'} AI screening
                            </p>
                          </div>
                          <div className="rounded-2xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                            Time Left: {formatTimer(workflowTimers.aptitude)}
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                          Recruiter-selected aptitude screening. Cutoff: {workflowData.aptitude.cutoff}/{workflowData.aptitude.questions.length}.
                        </p>
                        {workflowData.aptitude.score !== null && (
                          <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${workflowData.aptitude.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            Score: {workflowData.aptitude.score}/{workflowData.aptitude.questions.length} ({workflowData.aptitude.percentage}%)
                          </div>
                        )}
                        <div className="mt-6 space-y-4">
                          {workflowData.aptitude.questions.map((question, index) => (
                            <div key={question.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                              <p className="text-sm font-semibold text-slate-900">{index + 1}. {question.prompt}</p>
                              <div className="mt-4 grid gap-2">
                                {question.options.map((option, optionIndex) => (
                                  <label key={option} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                                    <input
                                      type="radio"
                                      name={question.id}
                                      checked={workflowDraft.aptitude[question.id] === optionIndex}
                                      onChange={() => setWorkflowDraft((prev) => ({
                                        ...prev,
                                        aptitude: { ...prev.aptitude, [question.id]: optionIndex },
                                      }))}
                                    />
                                    <span>{option}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeWorkflowStage === 'technical' && (
                      <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-blue-500">Stage 3</p>
                            <h4 className="mt-2 text-xl font-semibold text-slate-900">Technical aptitude test</h4>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {workflowData.technical.required ? 'Compulsory' : 'Optional'} AI screening
                            </p>
                          </div>
                          <div className="rounded-2xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                            Time Left: {formatTimer(workflowTimers.technical)}
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                          Role-based screening derived from recruiter setup and job requirements. Cutoff: {workflowData.technical.cutoff}/{workflowData.technical.questions.length}.
                        </p>
                        {workflowData.technical.score !== null && (
                          <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${workflowData.technical.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            Score: {workflowData.technical.score}/{workflowData.technical.questions.length} ({workflowData.technical.percentage}%)
                          </div>
                        )}
                        <div className="mt-6 space-y-4">
                          {workflowData.technical.questions.map((question, index) => (
                            <div key={question.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                              <p className="text-sm font-semibold text-slate-900">{index + 1}. {question.prompt}</p>
                              <div className="mt-4 grid gap-2">
                                {question.options.map((option, optionIndex) => (
                                  <label key={option} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                                    <input
                                      type="radio"
                                      name={question.id}
                                      checked={workflowDraft.technical[question.id] === optionIndex}
                                      onChange={() => setWorkflowDraft((prev) => ({
                                        ...prev,
                                        technical: { ...prev.technical, [question.id]: optionIndex },
                                      }))}
                                    />
                                    <span>{option}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeWorkflowStage === 'coding' && (
                      <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
                        <p className="text-sm font-medium text-blue-500">Stage 4</p>
                        <h4 className="mt-2 text-xl font-semibold text-slate-900">Coding round</h4>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {workflowData.coding.required ? 'Compulsory' : 'Optional'} Invenia AI Analysis prompts
                        </p>
                        <p className="mt-3 text-sm text-slate-600">
                          Two coding prompts with a clean editor-style workspace. Focus on logic, structure, and edge cases.
                        </p>
                        <div className="mt-6 space-y-5">
                          {workflowData.coding.questions.map((question, index) => (
                            <div key={question.id} className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white">
                              <p className="text-sm font-semibold text-cyan-300">{question.title}</p>
                              <p className="mt-3 text-sm leading-7 text-slate-200">{question.prompt}</p>
                              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">{question.guidance}</p>
                              <textarea
                                rows={12}
                                value={workflowDraft.coding[index] || ''}
                                onChange={(event) => setWorkflowDraft((prev) => {
                                  const nextCoding = [...prev.coding];
                                  nextCoding[index] = event.target.value;
                                  return { ...prev, coding: nextCoding };
                                })}
                                className="mt-4 w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-sm text-white outline-none focus:border-cyan-400"
                                placeholder="Write your solution here..."
                              />
                            </div>
                          ))}
                        </div>
                        {workflowData.coding.score !== null && (
                          <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            Coding score: {workflowData.coding.score}% • {workflowData.coding.feedback}
                          </div>
                        )}
                      </div>
                    )}

                    {activeWorkflowStage === 'interview' && (
                      <div ref={interviewPanelRef} className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-blue-500">Stage 5</p>
                            <h4 className="mt-2 text-xl font-semibold text-slate-900">AI interview simulation</h4>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Compulsory 3-question voice interview
                            </p>
                          </div>
                          <div className="rounded-2xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                            Time Left: {formatTimer(workflowTimers.interview)}
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                          Click begin interview to capture a verification photo, go fullscreen, and start the live camera recording. Invenia AI Analysis will ask three questions and the voice assistant will speak them aloud.
                        </p>

                        <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
                          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-4 text-white">
                            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black">
                              <video ref={cameraVideoRef} autoPlay muted playsInline className="h-72 w-full object-cover" />
                            </div>
                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={beginInterviewSession}
                                disabled={interviewStarted || workflowSubmitting}
                                className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-500"
                              >
                                {interviewStarted ? 'Interview Started' : 'Begin Full-Screen Interview'}
                              </button>
                              <button
                                type="button"
                                onClick={() => requestCameraAccess(true)}
                                className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white"
                              >
                                Refresh Camera
                              </button>
                              <button
                                type="button"
                                onClick={handleInterviewPromptPlayback}
                                className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white"
                              >
                                Play AI Voice
                              </button>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                              <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Recording</p>
                                <p className="mt-1 font-semibold">{interviewStarted ? 'Live' : 'Not started'}</p>
                              </div>
                              <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Snapshot</p>
                                <p className="mt-1 font-semibold">{interviewSnapshotUrl ? 'Captured' : 'Pending'}</p>
                              </div>
                              <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Voice</p>
                                <p className="mt-1 font-semibold">{interviewSpeaking ? 'Speaking' : 'Idle'}</p>
                              </div>
                            </div>

                            {interviewSnapshotUrl && (
                              <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
                                <img src={interviewSnapshotUrl} alt="Interview snapshot" className="h-48 w-full object-cover" />
                              </div>
                            )}

                            {interviewRecordingUrl && (
                              <div className="mt-4 rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">
                                Recording uploaded successfully.
                              </div>
                            )}
                          </div>

                          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-blue-500">Current question</p>
                                <h5 className="mt-2 text-lg font-semibold text-slate-900">
                                  {interviewCurrentQuestion?.prompt || 'Your first question will appear after the interview starts.'}
                                </h5>
                                {interviewCurrentQuestion?.focus && (
                                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Focus: {interviewCurrentQuestion.focus}
                                  </p>
                                )}
                              </div>
                              <div className="rounded-2xl bg-white px-4 py-3 text-right">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Progress</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                  {Math.min(interviewTurns.length + (interviewStarted ? 1 : 0), interviewMaxQuestions)}/{interviewMaxQuestions}
                                </p>
                              </div>
                            </div>

                            <textarea
                              rows={7}
                              value={interviewAnswerDraft}
                              onChange={(event) => updateInterviewAnswerDraft(event.target.value)}
                              className="mt-5 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                              placeholder="Type your answer here or let voice capture fill it in..."
                            />

                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={startInterviewTranscription}
                                disabled={interviewTranscribing}
                                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:bg-slate-100"
                              >
                                {interviewTranscribing ? 'Voice Capture Active' : 'Start Voice Capture'}
                              </button>
                              <button
                                type="button"
                                onClick={stopInterviewTranscription}
                                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                              >
                                Stop Voice Capture
                              </button>
                              <button
                                type="button"
                                onClick={handleInterviewPromptPlayback}
                                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                              >
                                Replay Question
                              </button>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Proctoring warnings</p>
                                <p className="mt-2 text-lg font-semibold text-slate-900">{proctoring.warnings}</p>
                              </div>
                              <div className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recording state</p>
                                <p className="mt-2 text-lg font-semibold text-slate-900">
                                  {interviewUploading ? 'Uploading' : interviewStarted ? 'Live' : 'Idle'}
                                </p>
                              </div>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => handleWorkflowStageSubmit('interview')}
                                disabled={workflowSubmitting || !interviewStarted || !interviewAnswerDraft.trim()}
                                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
                              >
                                {workflowSubmitting
                                  ? 'Submitting...'
                                  : interviewTurns.length + 1 >= interviewMaxQuestions
                                    ? 'Finish Interview'
                                    : 'Submit Answer & Next'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  interviewFinalTranscriptRef.current = '';
                                  updateInterviewAnswerDraft('');
                                }}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
                              >
                                Clear Answer
                              </button>
                            </div>

                            <div className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm text-slate-700">
                              <p className="font-semibold text-slate-900">Interview notes</p>
                              <p className="mt-2 text-xs leading-6 text-slate-500">
                                Full-screen mode, camera monitoring, mic capture, and transcript typing stay active until the interview is submitted.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-3">
                          {interviewTurns.map((turn, index) => (
                            <div key={`${turn.turn || index}-${turn.question_id || index}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Turn {index + 1}</p>
                              <p className="mt-3 text-sm font-semibold text-slate-900">{turn.question}</p>
                              <p className="mt-3 text-sm text-slate-600">{turn.answer}</p>
                            </div>
                          ))}
                        </div>

                        {(interviewReport || interviewData.report) && (
                          <div className="mt-6 rounded-[28px] border border-emerald-200 bg-emerald-50 p-6">
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Invenia AI Analysis: Interview report</p>
                            <h5 className="mt-2 text-xl font-semibold text-slate-900">
                              {(interviewReport || interviewData.report)?.decision || 'Review'}
                            </h5>
                            <p className="mt-3 text-sm leading-7 text-slate-700">
                              {(interviewReport || interviewData.report)?.summary || 'The interview analysis will appear here after the third answer is submitted.'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeWorkflowStage === 'completed' && (
                      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                        <p className="text-sm font-medium text-emerald-700">Application completed</p>
                        <h4 className="mt-2 text-2xl font-semibold text-slate-900">Your end-to-end assessment result is ready</h4>
                        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          {[
                            ['ATS', `${workflowData.atsScore || 0}%`],
                            ['Job Match', `${workflowData.matchScore || 0}%`],
                            ['Coding', `${workflowData.coding.score || 0}%`],
                            ['Overall', `${workflowData.overallScore || 0}%`],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl bg-white p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                              <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl bg-white p-5 text-sm text-slate-700">
                            Aptitude: {workflowData.aptitude.score}/{workflowData.aptitude.questions.length} ({workflowData.aptitude.percentage}%)
                          </div>
                          <div className="rounded-2xl bg-white p-5 text-sm text-slate-700">
                            Technical: {workflowData.technical.score}/{workflowData.technical.questions.length} ({workflowData.technical.percentage}%)
                          </div>
                          <div className="rounded-2xl bg-white p-5 text-sm text-slate-700">
                            Coding feedback: {workflowData.coding.feedback || 'Awaiting recruiter review'}
                          </div>
                          <div className="rounded-2xl bg-white p-5 text-sm text-slate-700">
                            Interview feedback: {workflowData.interview.feedback || 'Awaiting recruiter review'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-[28px] border border-blue-100 bg-slate-50 p-6">
                      <p className="text-sm font-medium text-blue-500">Live Summary</p>
                      <h4 className="mt-2 text-lg font-semibold text-slate-900">{selectedJob.title}</h4>
                      <div className="mt-5 grid gap-3">
                        {[
                          ['ATS Score', `${workflowData.atsScore || profile?.ats_score || 0}%`],
                          ['Profile match', `${workflowData.matchScore || selectedJob.matchScore || 0}%`],
                          ['Current Stage', activeWorkflowStage === 'completed' ? 'Result Ready' : (workflowStages.find((stage) => stage.id === activeWorkflowStage)?.label || activeWorkflowStage)],
                          ['Final Score', `${workflowData.overallScore || 0}%${workflowData.interview?.score == null ? ' (updates after interview)' : ''}`],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-2xl bg-white px-4 py-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                            <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900">Assessment Monitoring</h4>
                          <p className="mt-1 text-sm text-slate-500">Camera access, proxy warnings, and timing are tracked here.</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cameraGranted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {cameraGranted ? (cameraAudioEnabled ? 'Camera + Mic Active' : 'Camera Active') : 'Camera Pending'}
                        </span>
                      </div>
                      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-slate-950">
                        <video ref={cameraVideoRef} autoPlay muted playsInline className="h-56 w-full object-cover" />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => requestCameraAccess(activeWorkflowStage === 'interview')}
                          className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Refresh Camera Access
                        </button>
                        <button
                          type="button"
                          onClick={stopCameraPreview}
                          className="rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600"
                        >
                          Stop Preview
                        </button>
                      </div>
                      <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">Proctoring warnings: {proctoring.warnings}</p>
                        {(proctoring.events || []).length > 0 ? (
                          <div className="mt-3 space-y-2 text-xs text-slate-500">
                            {proctoring.events.map((item) => (
                              <p key={item}>{item}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-slate-500">No proxy or tab-switch events recorded yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                      <h4 className="text-lg font-semibold text-slate-900">Stage Actions</h4>
                      <div className="mt-5 flex flex-col gap-3">
                        {activeWorkflowStage === 'profile' && (
                          <button
                            type="button"
                            disabled={workflowSubmitting}
                            onClick={handleSubmitApplication}
                            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
                          >
                            {workflowSubmitting ? 'Preparing...' : workflowSession?.applicationId ? 'Continue to Assessments' : 'Apply to Get Started'}
                          </button>
                        )}
                        {activeWorkflowStage === 'aptitude' && (
                          <>
                            <button
                              type="button"
                              disabled={workflowSubmitting}
                              onClick={() => handleWorkflowStageSubmit('aptitude')}
                              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
                            >
                              {workflowSubmitting ? 'Submitting...' : 'Submit Aptitude Test'}
                            </button>
                            {!workflowData.aptitude.required && (
                              <button
                                type="button"
                                disabled={workflowSubmitting}
                                onClick={() => handleWorkflowStageSubmit('aptitude', { skip: true })}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 disabled:bg-slate-100"
                              >
                                Skip Aptitude for Now
                              </button>
                            )}
                          </>
                        )}
                        {activeWorkflowStage === 'technical' && (
                          <>
                            <button
                              type="button"
                              disabled={workflowSubmitting}
                              onClick={() => handleWorkflowStageSubmit('technical')}
                              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
                            >
                              {workflowSubmitting ? 'Submitting...' : 'Submit Technical Test'}
                            </button>
                            {!workflowData.technical.required && (
                              <button
                                type="button"
                                disabled={workflowSubmitting}
                                onClick={() => handleWorkflowStageSubmit('technical', { skip: true })}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 disabled:bg-slate-100"
                              >
                                Skip Technical for Now
                              </button>
                            )}
                          </>
                        )}
                        {activeWorkflowStage === 'coding' && (
                          <>
                            <button
                              type="button"
                              disabled={workflowSubmitting}
                              onClick={() => handleWorkflowStageSubmit('coding')}
                              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
                            >
                              {workflowSubmitting ? 'Submitting...' : 'Submit Coding Round'}
                            </button>
                            {!workflowData.coding.required && (
                              <button
                                type="button"
                                disabled={workflowSubmitting}
                                onClick={() => handleWorkflowStageSubmit('coding', { skip: true })}
                                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 disabled:bg-slate-100"
                              >
                                Skip Coding for Now
                              </button>
                            )}
                          </>
                        )}
                        {activeWorkflowStage === 'interview' && (
                          <>
                            <button
                              type="button"
                              disabled={workflowSubmitting || !interviewStarted}
                              onClick={() => handleWorkflowStageSubmit('interview')}
                              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
                            >
                              {workflowSubmitting ? 'Submitting...' : 'Submit Interview Answer'}
                            </button>
                            <button
                              type="button"
                              disabled={interviewStarted}
                              onClick={beginInterviewSession}
                              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 disabled:bg-slate-100"
                            >
                              {interviewStarted ? 'Interview Running' : 'Begin Interview Session'}
                            </button>
                          </>
                        )}
                        {activeWorkflowStage === 'completed' && (
                          <button
                            type="button"
                            onClick={closeWorkflowModal}
                            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white"
                          >
                            Close Result
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={closeWorkflowModal}
                          className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
                        >
                          Exit Workflow
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[32px] bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-500">Update Candidate Profile</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Keep your profile recruiter-ready</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-8 rounded-[28px] border border-blue-100 bg-blue-50/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-blue-800">Auto-fill from CV</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Upload a CV or paste CV content. The system fills fields only after extraction, then you can review and save.</p>
                </div>
                <button
                  type="button"
                  disabled={profileAutofilling}
                  onClick={handleProfileAutofill}
                  className="rounded-2xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                >
                  {profileAutofilling ? 'Extracting...' : 'Auto-fill profile'}
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr,0.8fr]">
                <textarea
                  rows={4}
                  value={profileAutofillText}
                  onChange={(event) => setProfileAutofillText(event.target.value)}
                  placeholder="Paste CV text here..."
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm outline-none focus:border-blue-300"
                />
                <label className="rounded-2xl border border-dashed border-blue-200 bg-white px-4 py-4 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Upload CV for extraction</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(event) => setProfileAutofillFile(event.target.files?.[0] || null)}
                    className="mt-3 block w-full text-sm"
                  />
                  <span className="mt-2 block text-xs text-slate-500">{profileAutofillFile?.name || 'PDF, DOC, DOCX supported'}</span>
                </label>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2 flex flex-col gap-4 rounded-[24px] border border-blue-100 bg-blue-50/60 p-5 sm:flex-row sm:items-center">
                <ProfileAvatar src={buildFileUrl(profile?.photo_url)} name={profileForm.full_name || name} className="h-20 w-20" textClassName="text-xl" />
                <div className="flex-1"><p className="text-sm font-semibold text-slate-900">Candidate profile photo</p><p className="mt-1 text-xs text-slate-600">Use a clear head-and-shoulders JPG, PNG, or WebP image up to 5 MB.</p></div>
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
                Phone
                <input value={profileForm.phone} onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Location
                <input value={profileForm.location} onChange={(event) => setProfileForm((prev) => ({ ...prev, location: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Current job title
                <input value={profileForm.current_job_title} onChange={(event) => setProfileForm((prev) => ({ ...prev, current_job_title: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Current company
                <input value={profileForm.current_company} onChange={(event) => setProfileForm((prev) => ({ ...prev, current_company: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Experience (years)
                <input type="number" min="0" value={profileForm.experience_years} onChange={(event) => setProfileForm((prev) => ({ ...prev, experience_years: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="md:col-span-2 text-sm font-medium text-slate-700">
                Skills
                <input value={profileForm.skills} onChange={(event) => setProfileForm((prev) => ({ ...prev, skills: event.target.value }))} placeholder="React, Python, SQL, Product Design" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="md:col-span-2 text-sm font-medium text-slate-700">
                Professional summary
                <textarea rows={5} value={profileForm.bio} onChange={(event) => setProfileForm((prev) => ({ ...prev, bio: event.target.value }))} className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Preferred job types
                <input value={profileForm.preferred_job_types} onChange={(event) => setProfileForm((prev) => ({ ...prev, preferred_job_types: event.target.value }))} placeholder="Full-time, Contract" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Preferred locations
                <input value={profileForm.preferred_locations} onChange={(event) => setProfileForm((prev) => ({ ...prev, preferred_locations: event.target.value }))} placeholder="Remote, Pune, Bengaluru" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Salary expectation
                <input value={profileForm.salary_expectation} onChange={(event) => setProfileForm((prev) => ({ ...prev, salary_expectation: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                LinkedIn URL
                <input value={profileForm.linkedin_url} onChange={(event) => setProfileForm((prev) => ({ ...prev, linkedin_url: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                GitHub URL
                <input value={profileForm.github_url} onChange={(event) => setProfileForm((prev) => ({ ...prev, github_url: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Portfolio URL
                <input value={profileForm.portfolio_url} onChange={(event) => setProfileForm((prev) => ({ ...prev, portfolio_url: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
              </label>
              <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={profileForm.is_available} onChange={(event) => setProfileForm((prev) => ({ ...prev, is_available: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                I am actively available for new opportunities
              </label>

              <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
                <button type="button" onClick={() => setShowProfileModal(false)} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">
                  Cancel
                </button>
                <button type="submit" disabled={savingProfile} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400">
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ScoreGlossary open={showScoreGlossary} onClose={() => setShowScoreGlossary(false)} />
      <ConfirmDialog confirmation={confirmation} onCancel={() => setConfirmation(null)} onConfirm={() => confirmation?.action?.()} />
      <ProductTour open={tourOpen} steps={candidateTourSteps} onClose={() => setTourOpen(false)} />
      
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
