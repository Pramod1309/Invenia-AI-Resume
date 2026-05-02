import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightOnRectangleIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  ClockIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  LifebuoyIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  UserCircleIcon,
  UserGroupIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { authAPI, buildFileUrl, recruiterAPI } from '../services/api';

const emptyJobForm = {
  title: '',
  description: '',
  location: '',
  job_type: 'Full-time',
  experience_level: '',
  salary_min: '',
  salary_max: '',
  requirements: '',
  responsibilities: '',
  benefits: '',
  is_remote: false,
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

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

function getJobRecommendations(job) {
  return [
    `Market Demand: ${job.applications > 10 ? 'High' : job.applications > 4 ? 'Medium' : 'Growing'}`,
    `Salary: ${job.salary || 'Competitive'}`,
    `Diversity Potential: ${job.diversityScore >= 70 ? 'High' : job.diversityScore >= 45 ? 'Medium' : 'Early stage'}`,
  ];
}

function RecruiterJobCard({ job, onViewDetails, onAIOptimize, onDelete }) {
  const recommendations = getJobRecommendations(job);

  return (
    <div className="rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-semibold text-slate-900">{job.title}</h3>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <span className="text-pink-500">📍</span>
              {job.experienceLevel || 'General'}
            </span>
            <span className="flex items-center gap-1">
              <span className="text-orange-500">💼</span>
              {job.type}
            </span>
            <span className="flex items-center gap-1">
              <span className="text-emerald-500">{job.isRemote ? '🌐' : '🏠'}</span>
              {job.isRemote ? 'Remote' : 'On-site'}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-lg font-semibold text-emerald-600">
            <span>💰</span>
            <span>{job.salary}</span>
          </div>
        </div>

        <div className={`rounded-2xl px-4 py-2 text-sm font-bold ${statusStyles[job.status] || 'bg-slate-200 text-slate-700'}`}>
          {job.status === 'active' ? 'OPEN READY' : 'INACTIVE'}
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-sky-200 bg-sky-50/90 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
          <span>🧠</span>
          AI Insights
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Match Score', `${job.matchScore}%`],
            ['Diversity', `${job.diversityScore}%`],
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
          {job.skills.length > 0 ? (
            job.skills.map((skill) => (
              <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {skill}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">No skills added yet.</span>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-amber-300 bg-amber-50 px-5 py-4">
        <h4 className="flex items-center gap-2 text-base font-semibold text-amber-700">
          <span>💡</span>
          AI Recommendations
        </h4>
        <ul className="mt-3 space-y-2 text-sm text-amber-800">
          {recommendations.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </div>

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
          AI Optimization
        </button>
        <button type="button" onClick={() => onDelete(job)} className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-600">
          Delete
        </button>
      </div>
    </div>
  );
}

function ProfileMenu({ profile, currentUser, isSuperRecruiter, onClose, onProfile, onAnalytics, onRecruiters, onSettings, onSupport, onLogout }) {
  const name = profile?.full_name || currentUser?.full_name || currentUser?.username || 'Recruiter';
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
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xl font-bold text-white">
          {initials || 'R'}
        </div>
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
  const profileMenuRef = useRef(null);

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [recruitersLoading, setRecruitersLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRecruiter, setSavingRecruiter] = useState(false);
  const [savingInterview, setSavingInterview] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isSuperRecruiter, setIsSuperRecruiter] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [overview, setOverview] = useState({
    analytics: {
      totalJobs: 0,
      activeJobs: 0,
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
  const [jobSearch, setJobSearch] = useState('');
  const [editingJob, setEditingJob] = useState(null);
  const [jobForm, setJobForm] = useState(emptyJobForm);
  const [showJobModal, setShowJobModal] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateStatus, setCandidateStatus] = useState('all');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [candidateStatusDraft, setCandidateStatusDraft] = useState('pending');
  const [interviewForm, setInterviewForm] = useState({
    interview_type: 'Technical',
    scheduled_at: '',
    duration_minutes: 60,
    location: '',
    notes: '',
  });
  const [analyticsPeriod, setAnalyticsPeriod] = useState('week');
  const [analytics, setAnalytics] = useState({
    conversionRate: 0,
    candidateQuality: 0,
    diversityScore: 0,
    avgTimeToHire: 0,
    hiringFunnel: [],
  });
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [recruiters, setRecruiters] = useState([]);
  const [showRecruiterModal, setShowRecruiterModal] = useState(false);
  const [recruiterForm, setRecruiterForm] = useState(emptyRecruiterForm);

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
          const data = await recruiterAPI.getJobs(jobSearch);
          setJobs(data.jobs || []);
        } finally {
          setJobsLoading(false);
        }
      }
      if (activeTab === 'candidates') {
        setCandidatesLoading(true);
        try {
          const data = await recruiterAPI.getCandidates(candidateSearch, candidateStatus);
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
  }, [activeTab, currentUser, jobSearch, candidateSearch, candidateStatus, analyticsPeriod, isSuperRecruiter]);

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
      const data = await recruiterAPI.getJobs(search);
      setJobs(data.jobs || []);
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
      requirements: JSON.stringify(splitText(jobForm.requirements)),
      responsibilities: jobForm.responsibilities || null,
      benefits: jobForm.benefits || null,
      is_remote: jobForm.is_remote,
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
    if (!window.confirm(`Delete "${job.title}" from active jobs?`)) {
      return;
    }
    try {
      await recruiterAPI.deleteJob(job.id);
      await Promise.all([loadJobs(jobSearch), refreshSummary()]);
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to delete job');
    }
  };

  const handleAIOptimize = (job) => {
    const suggestions = [
      `Match score is ${job.matchScore}% with current candidate pool.`,
      `${job.diversityScore}% diversity potential based on current applicants.`,
      `${job.applications} applications have arrived so far.`,
      job.skills.length > 0 ? `Highlight ${job.skills[0]} more clearly in the intro summary.` : 'Add clear must-have skills to improve matching.',
    ];
    window.alert(`AI Optimization for ${job.title}\n\n${suggestions.join('\n')}`);
  };

  const handleApplicationStatusUpdate = async (applicationId, status) => {
    try {
      await recruiterAPI.updateApplicationStatus(applicationId, status);
      await Promise.all([refreshSummary(), loadCandidates(candidateSearch, candidateStatus)]);
      if (activeTab === 'analytics') {
        await loadAnalytics(analyticsPeriod);
      }
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to update application');
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
      window.alert('Interview scheduled successfully.');
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-sm">
          Loading recruiter dashboard...
        </div>
      </div>
    );
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
  ];

  const name = profile?.full_name || currentUser?.full_name || currentUser?.username || 'Recruiter';
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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

        <main className="flex-1">
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

              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowProfileDropdown((prev) => !prev)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-lg shadow-indigo-200"
                >
                  {initials || 'R'}
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
                    onSupport={() => window.alert('Support is coming soon.')}
                    onLogout={handleLogout}
                  />
                )}
              </div>
            </div>
          </header>

          <div className="px-4 py-6 pb-28 lg:px-8 lg:pb-8">
            {error && (
              <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                { label: 'Active Jobs', value: overview.analytics.activeJobs, icon: BriefcaseIcon, tone: 'bg-blue-50 text-blue-600' },
                { label: 'New Applications', value: overview.analytics.newApplications, icon: UserGroupIcon, tone: 'bg-emerald-50 text-emerald-600' },
                { label: 'Interviews', value: overview.analytics.interviewsScheduled, icon: CalendarDaysIcon, tone: 'bg-violet-50 text-violet-600' },
                { label: 'Hires', value: overview.analytics.hires, icon: CheckBadgeIcon, tone: 'bg-amber-50 text-amber-600' },
                { label: 'Time To Hire', value: `${overview.analytics.avgTimeToHire}d`, icon: ClockIcon, tone: 'bg-cyan-50 text-cyan-600' },
              ].map((card) => (
                <div key={card.label} className="rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                  <div className={`inline-flex rounded-2xl p-3 ${card.tone}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-2xl font-semibold text-slate-900">{card.value}</p>
                  <p className="mt-1 text-sm text-slate-500">{card.label}</p>
                </div>
              ))}
            </section>

            {activeTab === 'overview' && (
              <section className="mt-8 space-y-6">
                <div className={`rounded-[32px] p-8 text-white shadow-xl shadow-blue-200 ${sidebarGradient}`}>
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.24em] text-blue-100">AI Summary</p>
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
                              <div>
                                <p className="text-lg font-semibold text-slate-900">{application.name}</p>
                                <p className="mt-1 text-sm text-slate-500">{application.position}</p>
                                <p className="mt-2 text-sm text-slate-500">Applied on {formatDate(application.appliedDate)}</p>
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
                                  <p className="font-semibold text-slate-900">{job.title}</p>
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
                <div className="flex flex-col gap-4 rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_12px_35px_rgba(37,99,235,0.06)] lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative max-w-xl flex-1">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={jobSearch}
                      onChange={(event) => setJobSearch(event.target.value)}
                      placeholder="Search jobs by title, location, or description"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-blue-300"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingJob(null);
                      setJobForm(emptyJobForm);
                      setShowJobModal(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Post New Job
                  </button>
                </div>

                <div className="grid gap-5">
                  {jobsLoading ? (
                    <div className="rounded-[28px] border border-blue-100 bg-white p-6 text-sm text-slate-500">Loading jobs...</div>
                  ) : jobs.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-blue-200 bg-white p-10 text-center text-sm text-slate-500">
                      No jobs found for the current search.
                    </div>
                  ) : (
                    jobs.map((job) => (
                      <RecruiterJobCard
                        key={job.id}
                        job={job}
                        onViewDetails={(item) => {
                          setEditingJob(item);
                          setJobForm({
                            title: item.title || '',
                            description: item.description || '',
                            location: item.location || '',
                            job_type: item.type || 'Full-time',
                            experience_level: item.experienceLevel || '',
                            salary_min: item.salaryMin || '',
                            salary_max: item.salaryMax || '',
                            requirements: item.requirementsText || '',
                            responsibilities: item.responsibilities || '',
                            benefits: item.benefits || '',
                            is_remote: Boolean(item.isRemote),
                          });
                          setShowJobModal(true);
                        }}
                        onAIOptimize={handleAIOptimize}
                        onDelete={handleDeleteJob}
                      />
                    ))
                  )}
                </div>
              </section>
            )}

            {activeTab === 'candidates' && (
              <section className="mt-8 space-y-6">
                <div className="flex flex-col gap-4 rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_12px_35px_rgba(37,99,235,0.06)] lg:flex-row lg:items-center lg:justify-between">
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
                    {['all', 'available', 'applied', 'new'].map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  {candidatesLoading ? (
                    <div className="rounded-[28px] border border-blue-100 bg-white p-6 text-sm text-slate-500">Loading candidates...</div>
                  ) : candidates.length === 0 ? (
                    <div className="xl:col-span-2 rounded-[28px] border border-dashed border-blue-200 bg-white p-10 text-center text-sm text-slate-500">
                      No candidates matched the current search or filter.
                    </div>
                  ) : (
                    candidates.map((candidate) => (
                      <div key={candidate.id} className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-semibold text-slate-900">{candidate.name}</h3>
                              <StatusBadge status={candidate.status} />
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
                          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Match</p>
                            <p className="mt-1 text-xl font-semibold text-emerald-700">{candidate.matchScore}%</p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-3">
                          {[
                            ['Experience', `${candidate.experienceYears || 0}y`],
                            ['Applications', candidate.applicationCount],
                            ['Registered', formatDate(candidate.registeredAt)],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-2xl bg-slate-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                              <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          {candidate.skills.slice(0, 5).map((skill) => (
                            <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                              {skill}
                            </span>
                          ))}
                        </div>

                        <div className="mt-6 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => {
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
                            }}
                            className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            View Details
                          </button>
                          {candidate.resumeUrl && (
                            <a href={buildFileUrl(candidate.resumeUrl)} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                              Open CV
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

            {activeTab === 'analytics' && (
              <section className="mt-8 space-y-6">
                <div className="flex flex-wrap gap-2">
                  {['week', 'month', 'year'].map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setAnalyticsPeriod(period)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        analyticsPeriod === period ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </button>
                  ))}
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
              </section>
            )}

            {activeTab === 'profile' && profile && (
              <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                <div className="space-y-6">
                  <div className={`rounded-[32px] p-8 text-white shadow-xl shadow-blue-200 ${sidebarGradient}`}>
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-blue-100">Recruiter Profile</p>
                        <h3 className="mt-3 text-3xl font-semibold">{profile.full_name}</h3>
                        <p className="mt-2 text-blue-50/90">{profile.job_title || 'Recruiter'}</p>
                        <p className="mt-1 text-sm text-blue-100">{profile.company_name}</p>
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

      {showCandidateModal && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[32px] bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-500">Candidate Profile</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedCandidate.name}</h3>
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
                    <p className="text-sm font-semibold text-emerald-600">Match {selectedCandidate.matchScore}%</p>
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
                    <a href={buildFileUrl(selectedCandidate.resumeUrl)} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                      <DocumentTextIcon className="h-5 w-5" />
                      Open Candidate CV
                    </a>
                  )}
                </div>

                {selectedCandidate.latestApplicationId && (
                  <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
                    <h4 className="text-lg font-semibold text-slate-900">Application Workflow</h4>
                    <p className="mt-2 text-sm text-slate-500">Latest application: {selectedCandidate.latestJobTitle || 'Current pipeline item'}</p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <select value={candidateStatusDraft} onChange={(event) => setCandidateStatusDraft(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        {['pending', 'reviewed', 'shortlisted', 'interview', 'offer', 'rejected', 'hired'].map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => handleApplicationStatusUpdate(selectedCandidate.latestApplicationId, candidateStatusDraft)} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">
                        Update Status
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[28px] border border-blue-100 bg-white p-6 shadow-sm">
                <h4 className="text-lg font-semibold text-slate-900">Schedule Interview</h4>
                <p className="mt-2 text-sm text-slate-500">Use the latest application to create an interview slot.</p>
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
                <select value={jobForm.job_type} onChange={(event) => setJobForm((prev) => ({ ...prev, job_type: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
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
              <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={jobForm.is_remote} onChange={(event) => setJobForm((prev) => ({ ...prev, is_remote: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                This is a remote role
              </label>
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
    </div>
  );
}
