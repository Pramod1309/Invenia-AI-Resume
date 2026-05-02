import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightOnRectangleIcon,
  BookmarkIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  CurrencyRupeeIcon,
  DocumentTextIcon,
  HeartIcon,
  LifebuoyIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  SparklesIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { authAPI, buildFileUrl, candidateAPI } from '../services/api';

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
  reviewed: 'bg-blue-100 text-blue-700',
  shortlisted: 'bg-violet-100 text-violet-700',
  interview: 'bg-sky-100 text-sky-700',
  offer: 'bg-emerald-100 text-emerald-700',
  hired: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
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

function CandidateJobCard({ job, onView, onApply, onSave }) {
  const insights = getActionableSuggestions(job);

  return (
    <div className="rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-semibold text-slate-900">{job.title}</h3>
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

      <div className="mt-4 flex items-center gap-2 text-lg font-semibold text-emerald-600">
        <CurrencyRupeeIcon className="h-5 w-5" />
        <span>{job.salary}</span>
      </div>

      <div className="mt-5 rounded-3xl border border-sky-200 bg-sky-50/90 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
          <SparklesIcon className="h-4 w-4" />
          AI Insights
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Match Score', `${job.matchScore}%`],
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

      <div className="mt-5">
        <h4 className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <span className="text-pink-500">🎯</span>
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
            <span className="text-sm text-slate-500">No skills listed yet.</span>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-amber-300 bg-amber-50 px-5 py-4">
        <h4 className="flex items-center gap-2 text-base font-semibold text-amber-700">
          <span>💡</span>
          Smart Recommendations
        </h4>
        <ul className="mt-3 space-y-2 text-sm text-amber-800">
          {insights.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onView(job)}
          className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          View Details
        </button>
        <button
          type="button"
          onClick={() => onApply(job)}
          disabled={job.isApplied}
          className={`rounded-2xl px-4 py-3 text-sm font-semibold text-white ${
            job.isApplied ? 'bg-slate-300' : 'bg-emerald-500 hover:bg-emerald-600'
          }`}
        >
          {job.isApplied ? 'Already Applied' : 'Apply Now'}
        </button>
        <button
          type="button"
          onClick={() => onSave(job.id)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
        >
          {job.isSaved ? 'Saved Job' : 'Save Job'}
        </button>
      </div>
    </div>
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
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xl font-bold text-white">
          {initials || 'C'}
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
  const resumeInputRef = useRef(null);
  const profileMenuRef = useRef(null);

  const [activeTab, setActiveTab] = useState('jobs');
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
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
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');

  const effectiveFilter = activeTab === 'saved' ? 'saved' : selectedFilter;

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
      loadJobs(searchQuery, filter);
    }
  }, [activeTab, currentUser, searchQuery, selectedFilter]);

  useEffect(() => {
    const onClick = (event) => {
      if (showProfileDropdown && profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showProfileDropdown]);

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

  const handleSubmitApplication = async () => {
    if (!selectedJob) return;
    try {
      await candidateAPI.applyToJob(selectedJob.id, coverLetter);
      setCoverLetter('');
      setShowApplyModal(false);
      await refreshCandidateData();
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to submit application');
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

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingResume(true);
    try {
      await candidateAPI.uploadResume(file);
      await refreshCandidateData();
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to upload resume');
    } finally {
      setUploadingResume(false);
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-sm">
          Loading candidate dashboard...
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'jobs', label: 'Jobs', icon: ColorJobsIcon },
    { id: 'applications', label: 'Applied', icon: ColorApplicationsIcon },
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

              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowProfileDropdown((prev) => !prev)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-lg shadow-indigo-200"
                >
                  {initials || 'C'}
                </button>

                {showProfileDropdown && (
                  <ProfileMenu
                    profile={profile}
                    currentUser={currentUser}
                    onClose={() => setShowProfileDropdown(false)}
                    onProfile={() => setActiveTab('profile')}
                    onSaved={() => setActiveTab('saved')}
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

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {[
                { label: 'Applications', value: stats.applicationsSubmitted, icon: CheckCircleIcon, tone: 'bg-blue-50 text-blue-600' },
                { label: 'Interviews', value: stats.interviewsScheduled, icon: CalendarDaysIcon, tone: 'bg-violet-50 text-violet-600' },
                { label: 'Offers', value: stats.offersReceived, icon: SparklesIcon, tone: 'bg-emerald-50 text-emerald-600' },
                { label: 'Saved Jobs', value: stats.savedJobs, icon: BookmarkIcon, tone: 'bg-amber-50 text-amber-600' },
                { label: 'Profile', value: `${stats.profileCompletion}%`, icon: ChartBarIcon, tone: 'bg-cyan-50 text-cyan-600' },
                { label: 'Avg Match', value: `${stats.averageMatchScore}%`, icon: BriefcaseIcon, tone: 'bg-rose-50 text-rose-600' },
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

            {(activeTab === 'jobs' || activeTab === 'saved') && (
              <section className="mt-8">
                <div className="flex flex-col gap-4 rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_12px_35px_rgba(37,99,235,0.06)] lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative max-w-xl flex-1">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search jobs by title, location, or keywords"
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
                </div>

                <div className="mt-6 grid gap-5 xl:grid-cols-2">
                  {jobsLoading ? (
                    <div className="rounded-[28px] border border-blue-100 bg-white p-6 text-sm text-slate-500">
                      Loading jobs...
                    </div>
                  ) : jobs.length === 0 ? (
                    <div className="xl:col-span-2 rounded-[28px] border border-dashed border-blue-200 bg-white p-10 text-center text-sm text-slate-500">
                      No jobs matched your current search or filter.
                    </div>
                  ) : (
                    jobs.map((job) => (
                      <CandidateJobCard
                        key={job.id}
                        job={job}
                        onView={(item) => {
                          setSelectedJob(item);
                          setShowJobModal(true);
                        }}
                        onApply={(item) => {
                          setSelectedJob(item);
                          setCoverLetter('');
                          setShowApplyModal(true);
                        }}
                        onSave={handleSaveJob}
                      />
                    ))
                  )}
                </div>
              </section>
            )}

            {activeTab === 'applications' && (
              <section className="mt-8 rounded-[28px] border border-blue-100 bg-white shadow-[0_12px_35px_rgba(37,99,235,0.06)]">
                <div className="border-b border-blue-100 px-6 py-5">
                  <h3 className="text-lg font-semibold text-slate-900">My Applications</h3>
                  <p className="mt-1 text-sm text-slate-500">Every role you applied for appears here with live status.</p>
                </div>
                <div className="divide-y divide-blue-50">
                  {applications.length === 0 ? (
                    <div className="px-6 py-10 text-center text-sm text-slate-500">
                      You have not applied to any jobs yet.
                    </div>
                  ) : (
                    applications.map((application) => (
                      <div key={application.id} className="px-6 py-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-lg font-semibold text-slate-900">{application.jobTitle}</p>
                            <p className="mt-1 text-sm text-slate-500">{application.company}</p>
                            <p className="mt-2 text-sm text-slate-500">Applied on {formatDate(application.appliedDate)}</p>
                          </div>
                          <div className="lg:text-right">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[application.status] || 'bg-slate-100 text-slate-600'}`}>
                              {application.status}
                            </span>
                            <p className="mt-3 text-sm text-slate-600">{application.nextStep}</p>
                            {application.resumeUrl && (
                              <a
                                href={buildFileUrl(application.resumeUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex text-sm font-medium text-blue-700 underline"
                              >
                                Open submitted CV
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

            {activeTab === 'profile' && profile && (
              <section className="mt-8 grid gap-6 xl:grid-cols-[1.25fr,0.85fr]">
                <div className="space-y-6">
                  <div className={`rounded-[32px] p-8 text-white shadow-xl shadow-blue-200 ${sidebarGradient}`}>
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-blue-100">Candidate Profile</p>
                        <h3 className="mt-3 text-3xl font-semibold">{profile.full_name}</h3>
                        <p className="mt-2 text-blue-50/90">{profile.current_job_title || 'Candidate'}</p>
                        <p className="mt-1 text-sm text-blue-100">{profile.location || 'Location not added yet'}</p>
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
                        {profile.resume_url ? 'Resume uploaded' : 'No resume uploaded yet'}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        {profile.resume_url && (
                          <a
                            href={buildFileUrl(profile.resume_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                          >
                            Open CV
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => resumeInputRef.current?.click()}
                          className="rounded-2xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700"
                        >
                          {uploadingResume ? 'Uploading...' : 'Upload CV'}
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

                  <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                    <h4 className="text-lg font-semibold text-slate-900">AI Guidance</h4>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                      <li>Your average job match is currently {stats.averageMatchScore}%.</li>
                      <li>Completing your profile to 100% makes you easier for recruiters to shortlist.</li>
                      <li>Uploading an updated CV ensures every new application carries the latest version automatically.</li>
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
              <span>{selectedJob.salary}</span>
              <span>{selectedJob.type}</span>
              <span>Posted {formatDate(selectedJob.postedDate)}</span>
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Role Overview</h4>
                <p className="mt-3 text-sm leading-7 text-slate-600">{selectedJob.description}</p>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Key Skills</h4>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedJob.skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                      {skill}
                    </span>
                  ))}
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
                  setShowApplyModal(true);
                }}
                disabled={selectedJob.isApplied}
                className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white ${
                  selectedJob.isApplied ? 'bg-slate-300' : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                {selectedJob.isApplied ? 'Already Applied' : 'Apply to this Role'}
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
          <div className="w-full max-w-2xl rounded-[32px] bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-500">{selectedJob.company}</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Apply for {selectedJob.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-slate-700">
              Your current CV from the profile will be attached automatically to this application.
            </div>

            <label className="mt-6 block text-sm font-medium text-slate-700">
              Cover letter
              <textarea
                rows={6}
                value={coverLetter}
                onChange={(event) => setCoverLetter(event.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-300"
                placeholder="Share why you are a good fit for this role."
              />
            </label>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitApplication}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Submit Application
              </button>
            </div>
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

            <form onSubmit={handleProfileSubmit} className="mt-8 grid gap-5 md:grid-cols-2">
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
    </div>
  );
}
