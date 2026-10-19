/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ClockIcon,
  CommandLineIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  MicrophoneIcon,
  PlayIcon,
  ShieldCheckIcon,
  SparklesIcon,
  VideoCameraIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { API_BASE_URL, authAPI, buildFileUrl, candidateAPI, openBlobResponse, openPreparedPreviewWindow, testAPI } from '../services/api';
import { ConfirmDialog, PageSkeleton, ProfileAvatar } from '../components/UXKit';

const STAGE_SEQUENCE = ['profile', 'screening', 'aptitude', 'technical', 'coding', 'interview', 'completed'];
const ASSESSMENT_UNLOCK_STATUSES = ['approved', 'shortlisted', 'interview', 'offer', 'hired'];

function getStageIndex(stage) {
  const index = STAGE_SEQUENCE.indexOf(stage);
  return index === -1 ? 0 : index;
}

function formatTimer(totalSeconds) {
  const safeValue = Math.max(0, Number(totalSeconds) || 0);
  const hours = String(Math.floor(safeValue / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((safeValue % 3600) / 60)).padStart(2, '0');
  const seconds = String(safeValue % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function splitText(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildAnswerPayload(questions, selectedAnswers) {
  return (questions || []).map((question) => {
    const picked = selectedAnswers?.[question.id];
    return typeof picked === 'number' ? picked : -1;
  });
}

function createDrafts(workflow) {
  return {
    aptitude: {},
    technical: {},
    coding: workflow?.coding?.questions?.map(() => '') || ['', ''],
  };
}

function isWorkflowStageEnabled(workflow, stage) {
  if (stage === 'interview') return true;
  return Boolean(workflow?.[stage]?.enabled ?? workflow?.assessment?.[stage]?.enabled ?? true);
}

function getFirstEnabledStage(workflow) {
  return ['aptitude', 'technical', 'coding', 'interview'].find((stage) => isWorkflowStageEnabled(workflow, stage)) || 'interview';
}

function useLocalStorageLock(applicationId) {
  const lockKey = applicationId ? `invenia-terminal-lock:${applicationId}` : '';

  const readLock = () => {
    if (!lockKey) return null;
    try {
      const raw = localStorage.getItem(lockKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  };

  const writeLock = (reason) => {
    if (!lockKey) return;
    try {
      localStorage.setItem(lockKey, JSON.stringify({
        reason,
        at: new Date().toISOString(),
      }));
    } catch (error) {
      // Ignore storage failures.
    }
  };

  const clearLock = () => {
    if (!lockKey) return;
    try {
      localStorage.removeItem(lockKey);
    } catch (error) {
      // Ignore storage failures.
    }
  };

  return { readLock, writeLock, clearLock };
}

function TerminalMetric({ label, value, tone = 'text-slate-50' }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function StagePill({ active, done, label, index }) {
  return (
    <div
      className={`rounded-3xl border px-4 py-4 transition ${
        active
          ? 'border-blue-300 bg-blue-50 text-blue-900 shadow-[0_0_0_1px_rgba(59,130,246,0.12)]'
          : done
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-slate-200 bg-slate-50 text-slate-700'
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-70">Stage {index}</p>
      <p className="mt-2 text-sm font-semibold">{label}</p>
    </div>
  );
}

function QuestionCard({ question, answer, onChange }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-blue-900">{question.prompt || 'Question'}</p>
      {question.focus && (
        <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">Focus: {question.focus}</p>
      )}
      <div className="mt-4 grid gap-2">
        {(question.options || []).map((option, optionIndex) => (
          <label
            key={option}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800"
          >
            <input
              type="radio"
              name={question.id}
              checked={answer === optionIndex}
              onChange={() => onChange(optionIndex)}
              className="accent-blue-800"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ScoreBar({ label, score, note, tone = 'bg-blue-700' }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <span className="text-sm font-semibold text-blue-800">{safeScore}%</span>
      </div>
      <div className="mt-3 h-3 rounded-full bg-slate-100">
        <div className={`h-3 rounded-full ${tone}`} style={{ width: `${safeScore}%` }} />
      </div>
      {note && <p className="mt-3 text-xs leading-5 text-slate-500">{note}</p>}
    </div>
  );
}

function RequirementList({ title, items, emptyText, tone = 'bg-slate-50 text-slate-700 border-slate-200' }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(items || []).length > 0 ? (
          items.map((item) => (
            <span key={item} className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
              {item}
            </span>
          ))
        ) : (
          <p className="text-sm text-slate-500">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

function ScreeningScanPanel({ scan, jobAts, score }) {
  const steps = scan.steps || [];
  const activeStep = steps[scan.currentStep] || steps[0] || {};
  const complete = Boolean(scan.complete);
  const active = Boolean(scan.active);
  const progress = Math.max(0, Math.min(100, Number(scan.progress) || 0));
  const matchedCount = jobAts?.requirement_match?.matched || 0;
  const partialCount = jobAts?.requirement_match?.partial || 0;
  const missingCount = jobAts?.requirement_match?.missing || 0;

  return (
    <div id="screening-scan-panel" className={`mt-6 overflow-hidden rounded-[32px] border p-5 shadow-sm ${
      active
        ? 'border-blue-200 bg-gradient-to-br from-blue-50 via-white to-slate-50'
        : complete
          ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50'
          : 'border-slate-200 bg-slate-50'
    }`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Invenia AI Analysis</p>
          <h4 className="mt-2 text-xl font-semibold text-slate-900">
            {complete ? 'CV scan completed for this job' : active ? 'Your CV is scanning according to the applied job' : 'CV scan will start after submission'}
          </h4>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
            {complete
              ? 'The screening report below compares your CV with this job description, requirements, responsibilities, and key skills.'
              : active
                ? activeStep.message || 'The system is comparing your CV against the job details.'
                : 'Submit the application to run the job-specific screening report before recruiter verification.'}
          </p>
        </div>
        <div className="rounded-[26px] border border-white bg-white px-5 py-4 text-center shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Scan progress</p>
          <p className={`mt-2 text-4xl font-semibold ${complete ? 'text-emerald-700' : 'text-blue-900'}`}>
            {complete ? `${score || 0}%` : `${progress}%`}
          </p>
        </div>
      </div>

      <div className="mt-5 h-3 rounded-full bg-white shadow-inner">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${complete ? 'bg-emerald-600' : 'bg-blue-800'}`}
          style={{ width: `${complete ? 100 : progress}%` }}
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {steps.map((step, index) => {
          const isDone = complete || index < scan.currentStep;
          const isActive = !complete && index === scan.currentStep;
          return (
            <div
              key={step.title}
              className={`rounded-2xl border p-3 text-sm transition ${
                isActive
                  ? 'border-blue-300 bg-blue-50 text-blue-900'
                  : isDone
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-70">Step {index + 1}</p>
              <p className="mt-2 font-semibold">{step.title}</p>
            </div>
          );
        })}
      </div>

      {(active || complete) && (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Currently compared</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {complete
                ? 'Final score, matched requirements, partial evidence, missing requirements, and recruiter-ready notes.'
                : activeStep.comparing || 'CV evidence is being compared with job details.'}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Advantages found</p>
            <p className="mt-3 text-sm leading-6 text-emerald-900/80">
              {complete
                ? `${matchedCount} strong requirement matches and ${partialCount} partial evidence points were found.`
                : activeStep.advantage || 'The system is identifying resume strengths for this job.'}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Disadvantages checked</p>
            <p className="mt-3 text-sm leading-6 text-amber-900/80">
              {complete
                ? `${missingCount} missing or weak requirement areas need recruiter review.`
                : activeStep.disadvantage || 'The system is checking for missing job evidence.'}
            </p>
          </div>
        </div>
      )}

      {scan.error && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {scan.error}
        </div>
      )}
    </div>
  );
}

function TerminalNoticeModal({ notice, onClose }) {
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
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4" role="dialog" aria-modal="true">
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
          {notice.label || 'Secure terminal'}
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

function TerminalBlockingLoader({ active, title, message }) {
  if (!active || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4" role="status" aria-live="polite">
      <div className="w-full max-w-md rounded-[32px] border border-blue-100 bg-white p-7 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-blue-100 bg-blue-50">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-900" />
        </div>
        <h3 className="mt-5 text-2xl font-semibold text-slate-900">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-600">{message}</p>
      </div>
    </div>,
    document.body,
  );
}

export default function CandidateSecureTerminal() {
  const navigate = useNavigate();
  const { jobId } = useParams();

  const terminalShellRef = useRef(null);
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
  const faceScanIntervalRef = useRef(null);
  const micTestRecognitionRef = useRef(null);
  const micTestRecorderRef = useRef(null);
  const micTestChunksRef = useRef([]);
  const interviewAutoSubmitTimerRef = useRef(null);
  const interviewAutoSubmitInFlightRef = useRef(false);
  const exitHandledRef = useRef(false);
  const resumeInputRef = useRef(null);
  const screeningScanTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const micLevelFrameRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [workflowSession, setWorkflowSession] = useState(null);
  const lockHelpers = useLocalStorageLock(workflowSession?.applicationId);
  const [activeStage, setActiveStage] = useState('profile');
  const [workflowDraft, setWorkflowDraft] = useState(createDrafts(null));
  const [workflowTimers, setWorkflowTimers] = useState({
    aptitude: 3600,
    technical: 3600,
    interview: 600,
  });
  const [coverLetter, setCoverLetter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionLocked, setSessionLocked] = useState(false);
  const [exitWarning, setExitWarning] = useState('');
  const [cameraGranted, setCameraGranted] = useState(false);
  const [cameraAudioEnabled, setCameraAudioEnabled] = useState(false);
  const [proctoring, setProctoring] = useState({ warnings: 0, events: [] });
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewRecordingActive, setInterviewRecordingActive] = useState(false);
  const [interviewReadyToFinish, setInterviewReadyToFinish] = useState(false);
  const [interviewAnswerDraft, setInterviewAnswerDraft] = useState('');
  const [interviewTranscribing, setInterviewTranscribing] = useState(false);
  const [interviewSpeaking, setInterviewSpeaking] = useState(false);
  const [interviewUploading, setInterviewUploading] = useState(false);
  const [interviewSnapshotUrl, setInterviewSnapshotUrl] = useState('');
  const [interviewRecordingUrl, setInterviewRecordingUrl] = useState('');
  const [interviewReport, setInterviewReport] = useState(null);
  const [faceScanReady, setFaceScanReady] = useState(false);
  const [faceScanProgress, setFaceScanProgress] = useState(0);
  const [faceScanMessage, setFaceScanMessage] = useState('Start camera to scan your face.');
  const [micTestStatus, setMicTestStatus] = useState('idle');
  const [micTestTranscript, setMicTestTranscript] = useState('');
  const [micTestAudioUrl, setMicTestAudioUrl] = useState('');
  const [micTestPassed, setMicTestPassed] = useState(false);
  const [micInputLevel, setMicInputLevel] = useState(0);
  const [speakerTestStatus, setSpeakerTestStatus] = useState('idle');
  const [connectionCheck, setConnectionCheck] = useState({ status: 'idle', latency: null, message: 'Not checked' });
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [reconnectMessage, setReconnectMessage] = useState('');
  const [interviewAutoMessage, setInterviewAutoMessage] = useState('');
  const [uploadingResume, setUploadingResume] = useState(false);
  const [noticeModal, setNoticeModal] = useState(null);
  const [exitConfirmation, setExitConfirmation] = useState(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [screeningScan, setScreeningScan] = useState({
    active: false,
    complete: false,
    progress: 0,
    currentStep: 0,
    steps: [],
    error: '',
  });

  const workflow = workflowSession?.workflow || null;
  const browserCompatibility = {
    camera: Boolean(navigator.mediaDevices?.getUserMedia),
    recording: typeof MediaRecorder !== 'undefined',
    speech: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    fullscreen: Boolean(document.documentElement.requestFullscreen),
    desktopRecommended: window.matchMedia('(min-width: 900px)').matches,
  };
  const interviewCompatible = browserCompatibility.camera && browserCompatibility.recording && browserCompatibility.speech && browserCompatibility.fullscreen;
  const currentStageIndex = getStageIndex(activeStage);
  const isCompleted = activeStage === 'completed' || (workflow?.currentStage === 'completed' && !interviewReadyToFinish);
  const lockInfo = workflowSession?.applicationId ? lockHelpers.readLock() : null;
  const updateInterviewAnswerDraft = (value) => {
    const nextValue = value || '';
    interviewAnswerDraftRef.current = nextValue;
    setInterviewAnswerDraft(nextValue);
  };

  const showTerminalNotice = (notice) => {
    setNoticeModal(notice);
  };

  const closeTerminalNotice = () => {
    const afterClose = noticeModal?.onAfterClose;
    setNoticeModal(null);
    if (typeof afterClose === 'function') {
      afterClose();
    }
  };

  const queueDashboardNotice = (notice) => {
    try {
      sessionStorage.setItem('invenia_candidate_notice', JSON.stringify(notice));
    } catch (error) {
      // Ignore storage failures; the terminal notice still confirms the action.
    }
  };

  const clearScreeningScanTimer = () => {
    if (screeningScanTimerRef.current) {
      window.clearInterval(screeningScanTimerRef.current);
      screeningScanTimerRef.current = null;
    }
  };

  const buildScreeningScanSteps = () => {
    const job = workflowSession?.workflow?.job || {};
    const requirements = (job.requirements || []).slice(0, 3).join(', ') || 'the listed job requirements';
    const responsibilities = (job.responsibilities || []).slice(0, 3).join(', ') || 'the role responsibilities';
    const skills = (workflowSession?.workflow?.profile?.skills || profile?.skills || []).slice(0, 5).join(', ') || 'your profile skills';
    return [
      {
        title: 'CV intake',
        message: 'The system is reading your uploaded CV and profile evidence for this exact job.',
        comparing: `CV text, profile headline, experience, and ${skills}.`,
        advantage: 'Clear role keywords and project evidence are marked as strengths.',
        disadvantage: 'Missing or unclear CV evidence is tracked for recruiter review.',
      },
      {
        title: 'Requirement match',
        message: 'The system is comparing your CV against the job requirements.',
        comparing: `Candidate evidence compared with ${requirements}.`,
        advantage: 'Direct requirement matches increase the role-fit score.',
        disadvantage: 'Requirements not visible in the CV reduce the score.',
      },
      {
        title: 'Responsibility fit',
        message: 'The system is checking whether your CV shows evidence for day-to-day responsibilities.',
        comparing: `Resume projects and experience compared with ${responsibilities}.`,
        advantage: 'Relevant projects and measurable ownership improve readiness.',
        disadvantage: 'Responsibilities with no proof remain marked as gaps.',
      },
      {
        title: 'Skill evidence',
        message: 'The system is validating hard skills, tools, domain terms, and role keywords.',
        comparing: 'Skills in the CV/profile are matched against recruiter-provided skills and job context.',
        advantage: 'Repeated, practical skill evidence improves confidence.',
        disadvantage: 'Generic skill claims without supporting work examples are treated as weaker evidence.',
      },
      {
        title: 'Score report',
        message: 'The system is preparing the final job-specific ATS score and screening report.',
        comparing: 'Matched, partial, and missing requirement evidence is converted into the final screening score.',
        advantage: 'Strong matches are summarized for the recruiter.',
        disadvantage: 'Weak areas are converted into readable gaps instead of style or grammar feedback.',
      },
    ];
  };

  const startScreeningScanProgress = () => {
    const steps = buildScreeningScanSteps();
    clearScreeningScanTimer();
    setScreeningScan({
      active: true,
      complete: false,
      progress: 4,
      currentStep: 0,
      steps,
      error: '',
    });
    window.setTimeout(() => {
      document.getElementById('screening-scan-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    screeningScanTimerRef.current = window.setInterval(() => {
      setScreeningScan((prev) => {
        if (!prev.active || prev.complete) return prev;
        const nextProgress = Math.min(94, (Number(prev.progress) || 0) + (prev.progress < 35 ? 7 : prev.progress < 70 ? 5 : 3));
        const nextStep = Math.min(steps.length - 1, Math.floor((nextProgress / 100) * steps.length));
        return {
          ...prev,
          progress: nextProgress,
          currentStep: nextStep,
        };
      });
    }, 850);
  };

  const completeScreeningScanProgress = () => {
    clearScreeningScanTimer();
    setScreeningScan((prev) => ({
      ...prev,
      active: false,
      complete: true,
      progress: 100,
      currentStep: Math.max(0, (prev.steps || []).length - 1),
      error: '',
    }));
  };

  const failScreeningScanProgress = (message) => {
    clearScreeningScanTimer();
    setScreeningScan((prev) => ({
      ...prev,
      active: false,
      complete: false,
      error: message || 'The screening scan could not be completed. Please try again.',
    }));
  };

  const handleOpenSubmittedResume = async () => {
    const previewWindow = openPreparedPreviewWindow('Candidate CV preview');
    try {
      const response = workflowSession?.applicationId
        ? await candidateAPI.getApplicationResume(workflowSession.applicationId)
        : await candidateAPI.getResume();
      openBlobResponse(response, previewWindow);
    } catch (requestError) {
      previewWindow?.close?.();
      window.alert(requestError.response?.data?.detail || 'Unable to open submitted CV');
    }
  };

  const clearInterviewTranscriptionRestart = () => {
    if (interviewRecognitionRestartRef.current) {
      window.clearTimeout(interviewRecognitionRestartRef.current);
      interviewRecognitionRestartRef.current = null;
    }
  };

  const clearInterviewAutoSubmitTimer = () => {
    if (interviewAutoSubmitTimerRef.current) {
      window.clearTimeout(interviewAutoSubmitTimerRef.current);
      interviewAutoSubmitTimerRef.current = null;
    }
  };

  const stopFaceScanLoop = () => {
    if (faceScanIntervalRef.current) {
      window.clearInterval(faceScanIntervalRef.current);
      faceScanIntervalRef.current = null;
    }
  };

  const stopMicTest = () => {
    if (micTestRecognitionRef.current) {
      try {
        micTestRecognitionRef.current.stop();
      } catch (error) {
        // Ignore shutdown errors.
      }
      micTestRecognitionRef.current = null;
    }
    if (micTestRecorderRef.current && micTestRecorderRef.current.state !== 'inactive') {
      try {
        micTestRecorderRef.current.stop();
      } catch (error) {
        // Ignore shutdown errors.
      }
    }
  };

  const stopMicLevel = () => {
    if (micLevelFrameRef.current) cancelAnimationFrame(micLevelFrameRef.current);
    micLevelFrameRef.current = null;
    audioContextRef.current?.close?.().catch?.(() => {});
    audioContextRef.current = null;
    setMicInputLevel(0);
  };

  const startMicLevel = (audioStream) => {
    stopMicLevel();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || !audioStream?.getAudioTracks?.().length) return;
    const context = new AudioContextClass();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(new MediaStream(audioStream.getAudioTracks())).connect(analyser);
    const values = new Uint8Array(analyser.frequencyBinCount);
    audioContextRef.current = context;
    const update = () => {
      analyser.getByteFrequencyData(values);
      const average = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
      setMicInputLevel(Math.min(100, Math.round((average / 128) * 100)));
      micLevelFrameRef.current = requestAnimationFrame(update);
    };
    update();
  };

  const pushProctoringEvent = (message) => {
    setProctoring((prev) => ({
      warnings: prev.warnings + 1,
      events: [...prev.events, `${message} ${new Date().toLocaleTimeString()}`].slice(-8),
    }));
  };

  const stopInterviewSnapshotLoop = () => {
    if (interviewSnapshotIntervalRef.current) {
      window.clearInterval(interviewSnapshotIntervalRef.current);
      interviewSnapshotIntervalRef.current = null;
    }
  };

  const stopCameraPreview = () => {
    stopFaceScanLoop();
    cameraStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraGranted(false);
    setCameraAudioEnabled(false);
    setFaceScanReady(false);
    setFaceScanMessage('Start camera to scan your face.');
    stopMicLevel();
  };

  const stopInterviewTranscription = () => {
    interviewTranscribingRef.current = false;
    clearInterviewTranscriptionRestart();
    clearInterviewAutoSubmitTimer();
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

  const requestCameraAccess = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      window.alert('Camera access is not available in this browser.');
      return;
    }
    try {
      const previousAudioTracks = cameraStreamRef.current?.getAudioTracks?.() || [];
      cameraStreamRef.current?.getVideoTracks?.().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });
      const combinedStream = new MediaStream([...stream.getVideoTracks(), ...previousAudioTracks]);
      cameraStreamRef.current = combinedStream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = combinedStream;
      }
      setCameraGranted(true);
      setCameraAudioEnabled(previousAudioTracks.length > 0);
    } catch (requestError) {
      setCameraGranted(false);
      window.alert('Camera access is required for the interview. Check browser site permissions, then retry.');
    }
  };

  const requestMicrophoneAccess = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      const videoTracks = cameraStreamRef.current?.getVideoTracks?.() || [];
      cameraStreamRef.current?.getAudioTracks?.().forEach((track) => track.stop());
      const combinedStream = new MediaStream([...videoTracks, ...audioStream.getAudioTracks()]);
      cameraStreamRef.current = combinedStream;
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = combinedStream;
      setCameraAudioEnabled(true);
      startMicLevel(combinedStream);
    } catch (requestError) {
      setCameraAudioEnabled(false);
      stopMicLevel();
      window.alert('Microphone access was blocked. Open browser site permissions, allow microphone access, and retry.');
    }
  };

  const handleSpeakerTest = () => {
    setSpeakerTestStatus('testing');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('Speaker test successful. You are ready to hear interview questions.');
      utterance.onend = () => setSpeakerTestStatus('passed');
      utterance.onerror = () => setSpeakerTestStatus('failed');
      window.speechSynthesis.speak(utterance);
      return;
    }
    setSpeakerTestStatus('failed');
  };

  const handleConnectionCheck = async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      setConnectionCheck({ status: 'failed', latency: null, message: 'No internet connection' });
      return;
    }
    setConnectionCheck({ status: 'checking', latency: null, message: 'Checking server connection...' });
    const startedAt = performance.now();
    let timeoutId = null;
    try {
      await Promise.race([
        testAPI.healthCheck(),
        new Promise((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error('Connection check timed out')), 8000);
        }),
      ]);
      const latency = Math.max(1, Math.round(performance.now() - startedAt));
      const quality = latency <= 350 ? 'Excellent' : latency <= 900 ? 'Good' : 'Slow but connected';
      setIsOnline(true);
      setConnectionCheck({ status: 'passed', latency, message: `${quality} (${latency} ms)` });
      setReconnectMessage('');
    } catch (requestError) {
      setConnectionCheck({ status: 'failed', latency: null, message: 'Server could not be reached' });
      setReconnectMessage('Connection check failed. Verify your internet connection and retry.');
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  };

  const startFaceScanLoop = () => {
    stopFaceScanLoop();
    setFaceScanReady(false);
    setFaceScanProgress(10);
    setFaceScanMessage('Camera connected. Align one face inside the scanner frame.');

    let fallbackTicks = 0;
    let stableFaceTicks = 0;
    faceScanIntervalRef.current = window.setInterval(async () => {
      const video = cameraVideoRef.current;
      if (!video || !cameraStreamRef.current || video.readyState < 2) {
        return;
      }

      if ('FaceDetector' in window) {
        try {
          const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
          const faces = await detector.detect(video);
          if (faces.length === 1) {
            stableFaceTicks += 1;
            const progress = Math.min(100, 25 + (stableFaceTicks * 25));
            setFaceScanProgress(progress);
            setFaceScanMessage(progress >= 100 ? 'Face verified. Camera check is complete.' : 'Face detected. Hold still while identity framing is verified.');
            setFaceScanReady(progress >= 100);
            if (recordingConsent) captureInterviewSnapshot();
          } else {
            stableFaceTicks = 0;
            setFaceScanReady(false);
            setFaceScanProgress(20);
            setFaceScanMessage(faces.length > 1 ? 'More than one face detected. Only the candidate should be visible.' : 'Face not detected. Move closer and face the camera.');
          }
          return;
        } catch (error) {
          // Continue with fallback scanner below.
        }
      }

      fallbackTicks += 1;
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 64;
      sampleCanvas.height = 48;
      const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
      sampleContext?.drawImage(video, 0, 0, 64, 48);
      const pixels = sampleContext?.getImageData(0, 0, 64, 48).data || [];
      let brightness = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        brightness += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
      }
      brightness /= Math.max(1, pixels.length / 4);
      if (brightness < 35) {
        fallbackTicks = 0;
        setFaceScanReady(false);
        setFaceScanProgress(25);
        setFaceScanMessage('Lighting is too low. Face a light source and keep your face in the frame.');
        return;
      }
      const progress = Math.min(100, 20 + (fallbackTicks * 20));
      setFaceScanProgress(progress);
      setFaceScanMessage(progress >= 100 ? 'Camera framing and lighting verified. Keep your face centered.' : 'Checking lighting and stable face framing. Hold still.');
      if (progress >= 100) {
        setFaceScanReady(true);
        if (recordingConsent) captureInterviewSnapshot();
      }
    }, 1000);
  };

  const handleStartCameraCheck = async () => {
    await requestCameraAccess();
    if (!cameraStreamRef.current?.getVideoTracks?.().length) return;
    startFaceScanLoop();
    window.setTimeout(() => {
      if (recordingConsent) captureInterviewSnapshot();
    }, 900);
  };

  const startInterviewSnapshotLoop = () => {
    stopInterviewSnapshotLoop();
    interviewSnapshotIntervalRef.current = window.setInterval(() => {
      captureInterviewSnapshot();
    }, 15000);
  };

  const handleMicTest = async () => {
    if (!faceScanReady) {
      setFaceScanMessage('Complete the camera and face scan before testing the microphone.');
      return;
    }
    if (!cameraAudioEnabled || !cameraStreamRef.current) {
      await requestMicrophoneAccess();
    }
    const audioTracks = cameraStreamRef.current?.getAudioTracks?.() || [];
    if (audioTracks.length === 0) {
      window.alert('Microphone access is required before the interview.');
      return;
    }

    stopMicTest();
    setMicTestStatus('recording');
    setMicTestTranscript('');
    setMicTestPassed(false);
    if (micTestAudioUrl) {
      URL.revokeObjectURL(micTestAudioUrl);
      setMicTestAudioUrl('');
    }

    const audioStream = new MediaStream(audioTracks);
    micTestChunksRef.current = [];
    let recorder = null;
    if (window.MediaRecorder) {
      try {
        recorder = new MediaRecorder(audioStream);
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            micTestChunksRef.current.push(event.data);
          }
        };
        recorder.onstop = () => {
          const blob = micTestChunksRef.current.length > 0
            ? new Blob(micTestChunksRef.current, { type: 'audio/webm' })
            : null;
          micTestChunksRef.current = [];
          if (blob) {
            setMicTestAudioUrl(URL.createObjectURL(blob));
          }
          setMicTestPassed(true);
          setMicTestStatus('complete');
        };
        micTestRecorderRef.current = recorder;
        recorder.start();
      } catch (error) {
        recorder = null;
      }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      recognition.lang = navigator.language || 'en-IN';
      recognition.onresult = (event) => {
        let captured = '';
        for (let index = 0; index < event.results.length; index += 1) {
          captured += `${event.results[index][0]?.transcript || ''} `;
        }
        setMicTestTranscript(captured.trim());
      };
      recognition.onerror = () => {
        micTestRecognitionRef.current = null;
      };
      recognition.onend = () => {
        micTestRecognitionRef.current = null;
      };
      micTestRecognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (error) {
        micTestRecognitionRef.current = null;
      }
    }

    window.setTimeout(() => {
      if (micTestRecognitionRef.current) {
        try {
          micTestRecognitionRef.current.stop();
        } catch (error) {
          // Ignore shutdown errors.
        }
      }
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch (error) {
          setMicTestPassed(true);
          setMicTestStatus('complete');
        }
      } else {
        setMicTestPassed(true);
        setMicTestStatus('complete');
      }
    }, 10000);
  };

  const toggleFullscreen = async () => {
    if (!terminalShellRef.current) return;
    try {
      if (!document.fullscreenElement && terminalShellRef.current.requestFullscreen) {
        await terminalShellRef.current.requestFullscreen();
      }
    } catch (requestError) {
      pushProctoringEvent('Fullscreen request was blocked by the browser.');
    }
  };

  const startInterviewRecording = async () => {
    if (!cameraStreamRef.current || interviewRecorderRef.current) return;
    if (!window.MediaRecorder) {
      pushProctoringEvent('MediaRecorder is unavailable in this browser.');
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
    setInterviewRecordingActive(true);
  };

  const stopInterviewRecording = () =>
    new Promise((resolve) => {
      const recorder = interviewRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        interviewChunksRef.current = [];
        interviewRecorderRef.current = null;
        setInterviewRecordingActive(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const blob = interviewChunksRef.current.length > 0
          ? new Blob(interviewChunksRef.current, { type: 'video/webm' })
          : null;
        interviewChunksRef.current = [];
        interviewRecorderRef.current = null;
        setInterviewRecordingActive(false);
        resolve(blob);
      };

      try {
        recorder.stop();
      } catch (error) {
        interviewChunksRef.current = [];
        interviewRecorderRef.current = null;
        setInterviewRecordingActive(false);
        resolve(null);
      }
    });

  const scheduleInterviewAutoSubmit = (delayMs = 5000) => {
    clearInterviewAutoSubmitTimer();
    if (!interviewStarted || interviewReadyToFinish || interviewSpeaking || interviewAutoSubmitInFlightRef.current) {
      return;
    }
    const latestAnswer = interviewAnswerDraftRef.current.trim();
    if (latestAnswer.length < 12) {
      setInterviewAutoMessage('Listening for a fuller answer...');
      return;
    }

    setInterviewAutoMessage('Answer captured. Next AI question will load after 5 seconds of silence.');
    interviewAutoSubmitTimerRef.current = window.setTimeout(async () => {
      const answerToSubmit = interviewAnswerDraftRef.current.trim();
      if (answerToSubmit.length < 12 || interviewAutoSubmitInFlightRef.current) {
        return;
      }
      interviewAutoSubmitInFlightRef.current = true;
      try {
        await handleStageSubmit('interview', { auto: true });
      } finally {
        interviewAutoSubmitInFlightRef.current = false;
      }
    }, delayMs);
  };

  const startInterviewTranscription = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      pushProctoringEvent('Browser speech recognition is unavailable.');
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
    recognition.maxAlternatives = 3;
    recognition.lang = navigator.language || 'en-IN';

    recognition.onresult = (event) => {
      let finalTranscript = interviewFinalTranscriptRef.current || '';
      let interimTranscript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
        } else {
          interimTranscript += transcript;
        }
      }
      interviewFinalTranscriptRef.current = finalTranscript;
      const nextTranscript = `${finalTranscript} ${interimTranscript}`.trim();
      updateInterviewAnswerDraft(nextTranscript);
      if (nextTranscript && !interviewSpeaking) {
        scheduleInterviewAutoSubmit(5000);
      }
    };

    recognition.onend = () => {
      speechRecognitionRef.current = null;
      if (!interviewTranscribingRef.current) {
        return;
      }
      try {
        recognition.start();
      } catch (error) {
        interviewRecognitionRestartRef.current = window.setTimeout(() => {
          if (interviewTranscribingRef.current) {
            startInterviewTranscription();
          }
        }, 350);
      }
    };

    recognition.onerror = (event) => {
      speechRecognitionRef.current = null;
      if (!interviewTranscribingRef.current) {
        return;
      }
      if (event?.error && !['no-speech', 'aborted'].includes(event.error)) {
        setInterviewAutoMessage(`Speech capture paused: ${event.error}. Restarting...`);
      }
      interviewRecognitionRestartRef.current = window.setTimeout(() => {
        if (interviewTranscribingRef.current) {
          startInterviewTranscription();
        }
      }, 500);
    };

    try {
      recognition.start();
      speechRecognitionRef.current = recognition;
      setInterviewTranscribing(true);
    } catch (error) {
      interviewTranscribingRef.current = false;
      pushProctoringEvent('Speech recognition could not start.');
    }
  };

  const speakCurrentInterviewQuestion = (afterSpeech = null) => {
    clearInterviewAutoSubmitTimer();
    const question = workflow?.interview?.currentQuestion?.audioUrl
      ? null
      : workflow?.interview?.currentQuestion?.prompt;
    const audioUrl = workflow?.interview?.currentQuestion?.audioUrl;
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

    if (!question || !window.speechSynthesis) {
      if (typeof afterSpeech === 'function') {
        afterSpeech();
      }
      return;
    }
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

  const resetTerminalSession = (workflowState) => {
    setWorkflowDraft(createDrafts(workflowState));
    setWorkflowTimers({
      aptitude: (workflowState?.aptitude?.durationMinutes || 60) * 60,
      technical: (workflowState?.technical?.durationMinutes || 60) * 60,
      interview: (workflowState?.interview?.durationMinutes || 10) * 60,
    });
    setProctoring({ warnings: 0, events: [] });
    setInterviewStarted(false);
    setInterviewRecordingActive(false);
    setInterviewReadyToFinish(false);
    updateInterviewAnswerDraft('');
    interviewFinalTranscriptRef.current = '';
    setInterviewTranscribing(false);
    setInterviewSpeaking(false);
    setInterviewUploading(false);
    setInterviewSnapshotUrl('');
    setInterviewRecordingUrl('');
    setInterviewReport(workflowState?.interview?.report || null);
    setFaceScanReady(false);
    setFaceScanProgress(0);
    setFaceScanMessage('Start camera to scan your face.');
    setMicTestStatus('idle');
    setMicTestTranscript('');
    setMicTestPassed(false);
    setSpeakerTestStatus('idle');
    setConnectionCheck({ status: 'idle', latency: null, message: 'Not checked' });
    setInterviewAutoMessage('');
    if (micTestAudioUrl) {
      URL.revokeObjectURL(micTestAudioUrl);
      setMicTestAudioUrl('');
    }
    interviewChunksRef.current = [];
    interviewSnapshotRef.current = null;
    stopInterviewSnapshotLoop();
    stopFaceScanLoop();
    stopMicTest();
    clearInterviewTranscriptionRestart();
    clearInterviewAutoSubmitTimer();
    window.speechSynthesis?.cancel?.();
    interviewTranscribingRef.current = false;
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (error) {
        // Ignore shutdown errors.
      }
      speechRecognitionRef.current = null;
    }
  };

  const hydrateSession = (session) => {
    const nextWorkflow = session?.workflow || {};
    setWorkflowSession(session);
    const nextStage = nextWorkflow.currentStage === 'screening' && ASSESSMENT_UNLOCK_STATUSES.includes(session?.status)
      ? getFirstEnabledStage(nextWorkflow)
      : nextWorkflow.currentStage || 'profile';
    setActiveStage(nextStage);
    setCoverLetter(nextWorkflow.coverLetter || '');
    setError('');
    resetTerminalSession(nextWorkflow);
  };

  const submitWorkflowStage = async (payload, { keepalive = false } = {}) => {
    const applicationId = workflowSession?.applicationId;
    if (!applicationId) return null;

    if (keepalive) {
      const token = localStorage.getItem('access_token');
      if (!token) return null;
      const response = await fetch(`${API_BASE_URL}/dashboard/candidate/applications/${applicationId}/workflow-stage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      if (!response.ok) return null;
      return response.json().catch(() => null);
    }

    return candidateAPI.submitWorkflowStage(applicationId, payload);
  };

  const buildCurrentStagePayload = () => {
    if (!workflow?.currentStage && activeStage === 'profile') return null;
    const stage = activeStage;
    let payload = { stage };

    if (stage === 'aptitude') {
      payload = {
        stage,
        skipped: false,
        answers: buildAnswerPayload(workflow?.aptitude?.questions, workflowDraft.aptitude),
      };
    }

    if (stage === 'technical') {
      payload = {
        stage,
        skipped: false,
        answers: buildAnswerPayload(workflow?.technical?.questions, workflowDraft.technical),
      };
    }

    if (stage === 'coding') {
      payload = {
        stage,
        skipped: false,
        coding_answers: workflowDraft.coding,
      };
    }

    if (stage === 'interview') {
      const transcript = interviewAnswerDraftRef.current.trim() || interviewAnswerDraft.trim()
        || 'Candidate exited the secure terminal before completing the interview answer.';
      payload = {
        stage,
        interview_answer: transcript,
        interview_transcript: transcript,
        interview_notes: `Candidate completed the secure interview with ${proctoring.warnings} proctoring warnings.`,
        proctoring,
      };
    }

    return payload;
  };

  const persistTerminalLock = (reason) => {
    if (!workflowSession?.applicationId) return;
    lockHelpers.writeLock(reason);
  };

  const clearTerminalLock = () => {
    if (!workflowSession?.applicationId) return;
    lockHelpers.clearLock();
  };

  const finalizeAttempt = async ({ reason, keepalive = false } = {}) => {
    if (exitHandledRef.current) return;
    exitHandledRef.current = true;

    const payload = buildCurrentStagePayload();
    if (payload && activeStage !== 'profile' && activeStage !== 'completed') {
      try {
        const response = await submitWorkflowStage(payload, { keepalive });
        if (response?.workflow) {
          setWorkflowSession((prev) => ({
            ...(prev || {}),
            applicationId: response.applicationId || prev?.applicationId,
            workflow: response.workflow,
          }));
          if (response.workflow.currentStage === 'completed') {
            setActiveStage('completed');
            setSessionLocked(false);
            clearTerminalLock();
            await uploadInterviewArtifacts(response.workflow.interview?.report || null, {
              applicationId: response.applicationId || workflowSession?.applicationId,
              interview: response.workflow?.interview || {},
            });
            stopInterviewTranscription();
            stopInterviewSnapshotLoop();
            stopCameraPreview();
            return;
          }
        }
      } catch (requestError) {
        // We still lock the browser session even if the network is unavailable.
      }
    }

    persistTerminalLock(reason);
    setExitWarning(reason || 'You left the secure terminal. This attempt is now locked.');
    setSessionLocked(true);
    stopInterviewTranscription();
    stopInterviewSnapshotLoop();
    stopCameraPreview();
  };

  const requestFullscreenAndStart = async () => {
    setSessionStarted(true);
    await toggleFullscreen();
  };

  const handleTerminalResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingResume(true);
    try {
      const response = await candidateAPI.uploadResume(file);
      if (response.profile) {
        setProfile(response.profile);
        setWorkflowSession((prev) => ({
          ...(prev || {}),
          workflow: {
            ...(prev?.workflow || {}),
            profile: {
              ...((prev?.workflow || {}).profile || {}),
              resume_url: response.profile.resume_url,
              resume_name: response.profile.resume_name,
            },
            profileAtsScore: response.profile.ats_score,
          },
        }));
        showTerminalNotice({
          label: 'CV updated',
          title: 'Resume uploaded and stored',
          message: 'Your CV is attached for this job application and ready for recruiter-side analysis.',
          details: `Latest ATS score: ${response.profile.ats_score || 0}%`,
          tone: 'green',
          actionLabel: 'Continue',
        });
      }
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to upload resume');
    } finally {
      setUploadingResume(false);
      event.target.value = '';
    }
  };

  const handleBeginSecureSession = async () => {
    if (!workflowSession) return;
    if (sessionLocked) return;
    if (submitting) return;

    setSubmitting(true);
    try {
      let nextSession = workflowSession;
      const hasResume = Boolean(profile?.resume_url || workflowSession.workflow?.profile?.resume_url);

      if (!workflowSession.applicationId) {
        if (!hasResume) {
          window.alert('Upload your CV in Stage 1 before submitting the application for recruiter verification.');
          return;
        }
        startScreeningScanProgress();
        const response = await candidateAPI.applyToJob(Number(jobId), coverLetter);
        nextSession = {
          applicationId: response.application_id,
          canApply: false,
          alreadyApplied: true,
          status: response.status || 'pending',
          workflow: response.workflow,
        };
        hydrateSession(nextSession);
        completeScreeningScanProgress();
        if (response.already_applied) {
          setActiveStage('screening');
          setExitWarning('You have already applied for this job. Please check your Applied tab for the current status.');
          showTerminalNotice({
            label: 'Already applied',
            title: 'Application already exists',
            message: `Your application for ${selectedJob.title || 'this role'} is already submitted.`,
            details: 'No duplicate application was created. You can track the latest status in your Applied tab.',
            tone: 'amber',
            actionLabel: 'View applied jobs',
            onAfterClose: () => navigate('/dashboard/candidate'),
          });
          return;
        }
        const profileResponse = await candidateAPI.getProfile();
        if (profileResponse?.profile) {
          setProfile(profileResponse.profile);
        }
        setActiveStage('screening');
        setExitWarning('Your application is sent to the recruiter for verification. Please wait for approval before starting the next round.');
        clearTerminalLock();
        queueDashboardNotice({
          label: 'Application submitted',
          title: 'Application sent for recruiter approval',
          message: `Your application for ${selectedJob.title || 'this role'} has been sent to the recruiter for verification.`,
          details: 'Please wait for recruiter approval. If selected, the enabled assessment rounds will unlock in your Applied tab.',
          tone: 'green',
          actionLabel: 'View jobs',
          redirectTab: 'jobs',
        });
        showTerminalNotice({
          label: 'Application submitted',
          title: 'Application sent for recruiter approval',
          message: `Your application for ${selectedJob.title || 'this role'} has been sent to the recruiter for verification.`,
          details: 'The system screening score is now visible in this terminal and has been sent to the recruiter for review.',
          tone: 'green',
          actionLabel: 'Review screening score',
        });
        return;
      }

      const currentWorkflowStage = nextSession.workflow?.currentStage || 'profile';
      const waitingForApproval = currentWorkflowStage === 'screening' || nextSession.status === 'pending';
      if (waitingForApproval && !ASSESSMENT_UNLOCK_STATUSES.includes(nextSession.status)) {
        setActiveStage('screening');
        setExitWarning('Recruiter verification is still pending. The assessment rounds will unlock after approval.');
        return;
      }

      const nextStage = ['profile', 'screening'].includes(currentWorkflowStage)
        ? getFirstEnabledStage(nextSession.workflow)
        : currentWorkflowStage || getFirstEnabledStage(nextSession.workflow);
      setActiveStage(nextStage);
      exitHandledRef.current = false;
      setExitWarning('');
      setSessionLocked(false);
      await requestFullscreenAndStart();
    } catch (requestError) {
      failScreeningScanProgress(requestError.response?.data?.detail || 'Unable to complete the job-specific CV scan.');
      window.alert(requestError.response?.data?.detail || 'Unable to start the secure terminal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStageSubmit = async (stage, options = {}) => {
    if (!workflowSession?.applicationId || !workflow) return;
    const payload = { stage };

    if (options.skip) {
      payload.skipped = true;
    }

    if (stage === 'aptitude') {
      payload.answers = buildAnswerPayload(workflow.aptitude?.questions, workflowDraft.aptitude);
    }

    if (stage === 'technical') {
      payload.answers = buildAnswerPayload(workflow.technical?.questions, workflowDraft.technical);
    }

    if (stage === 'coding') {
      payload.coding_answers = workflowDraft.coding;
    }

    if (stage === 'interview') {
      if (!interviewStarted) {
        if (!options.auto) {
          window.alert('Begin the full-screen interview session before submitting an answer.');
        }
        return;
      }
      const transcript = interviewAnswerDraftRef.current.trim() || interviewAnswerDraft.trim();
      if (transcript.length < 5) {
        if (!options.auto) {
          window.alert('Please answer the current interview question before continuing.');
        }
        return;
      }
      payload.interview_answer = transcript;
      payload.interview_transcript = transcript;
      payload.interview_notes = `Candidate completed the AI interview with ${proctoring.warnings} proctoring warnings.`;
      payload.proctoring = proctoring;
      clearInterviewAutoSubmitTimer();
      stopInterviewTranscription();
      setInterviewAutoMessage(options.auto ? 'Submitting answer and preparing the next question...' : 'Submitting answer...');
    }

    setSubmitting(true);
    try {
      const response = await submitWorkflowStage(payload);
      if (response?.workflow) {
        setWorkflowSession((prev) => ({
          ...(prev || {}),
          applicationId: response.applicationId || prev?.applicationId,
          workflow: response.workflow,
        }));
        if (stage === 'interview') {
          if (response.workflow.currentStage === 'completed') {
            setActiveStage('interview');
            setInterviewReport(response.workflow.interview?.report || null);
            stopInterviewTranscription();
            clearTerminalLock();
            setInterviewReadyToFinish(true);
            setInterviewAutoMessage('All three questions are completed. Click End Interview to stop recording and save the session.');
          } else {
            setActiveStage('interview');
            updateInterviewAnswerDraft('');
            interviewFinalTranscriptRef.current = '';
            setInterviewReport(response.workflow.interview?.report || null);
            setInterviewAutoMessage('Next question is ready. Listen to the AI interviewer.');
          }
        } else if (response.workflow.currentStage === 'completed') {
          setActiveStage('completed');
          showTerminalNotice({
            label: 'Assessment submitted',
            title: 'Assessment journey completed',
            message: 'Your completed assessment workflow has been submitted to the recruiter dashboard.',
            details: 'The recruiter can now review your ATS, test scores, interview analysis, and secure session report.',
            tone: 'green',
            actionLabel: 'View result',
          });
        } else {
          setActiveStage(response.workflow.currentStage);
          const stageNames = {
            aptitude: 'Aptitude test',
            technical: 'Technical MCQ',
            coding: 'Coding round',
          };
          if (stageNames[stage]) {
            showTerminalNotice({
              label: options.skip ? 'Stage skipped' : 'Stage submitted',
              title: `${stageNames[stage]} ${options.skip ? 'skipped' : 'submitted'}`,
              message: options.skip
                ? `${stageNames[stage]} was skipped because this round is optional for the job.`
                : `${stageNames[stage]} has been saved successfully.`,
              details: 'Your progress is stored and visible in the recruiter-side analysis report.',
              tone: options.skip ? 'amber' : 'green',
              actionLabel: 'Continue',
            });
          }
        }
      }
    } catch (requestError) {
      window.alert(requestError.response?.data?.detail || 'Unable to submit this stage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInterviewPromptPlayback = () => {
    speakCurrentInterviewQuestion();
  };

  const handleBeginInterviewSession = async () => {
    if (!cameraGranted || !cameraStreamRef.current) {
      await handleStartCameraCheck();
    }
    if (!cameraAudioEnabled) await requestMicrophoneAccess();
    if (!cameraStreamRef.current) return;
    if (!faceScanReady) {
      window.alert('Complete the face scan first. Keep your face centered in the green scanner.');
      return;
    }
    if (!micTestPassed) {
      window.alert('Complete the voice mic test first by reading the sample line.');
      return;
    }
    if (speakerTestStatus !== 'passed') {
      window.alert('Complete the speaker test so you can hear each interview question.');
      return;
    }
    if (connectionCheck.status !== 'passed') {
      setReconnectMessage('Run the internet connection check before starting the interview.');
      return;
    }
    if (!recordingConsent) {
      window.alert('Read the recording notice and provide consent before the interview begins.');
      return;
    }
    if (!isOnline) {
      setReconnectMessage('You are offline. Reconnect before starting the interview.');
      return;
    }
    if (!interviewSnapshotRef.current) captureInterviewSnapshot();

    clearInterviewAutoSubmitTimer();
    updateInterviewAnswerDraft('');
    interviewFinalTranscriptRef.current = '';
    setInterviewAutoMessage('AI interviewer is starting...');
    setInterviewReadyToFinish(false);
    if (!interviewRecordingActive) {
      await startInterviewRecording();
      startInterviewSnapshotLoop();
    }
    await toggleFullscreen();
    setSessionStarted(true);
    setInterviewStarted(true);
  };

  const handleEndInterviewSession = async () => {
    clearInterviewAutoSubmitTimer();
    stopInterviewTranscription();
    stopInterviewSnapshotLoop();
    setInterviewAutoMessage('Saving interview recording and report...');
    await uploadInterviewArtifacts(workflow?.interview?.report || interviewReport || null, {
      applicationId: workflowSession?.applicationId,
      interview: workflow?.interview || {},
    });
    setInterviewStarted(false);
    setInterviewReadyToFinish(false);
    setInterviewAutoMessage('');
    stopCameraPreview();
    clearTerminalLock();
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (error) {
        // Ignore browser fullscreen exit failures.
      }
    }
    setActiveStage('completed');
    showTerminalNotice({
      label: 'Interview submitted',
      title: 'Interview recording saved',
      message: 'Your AI interview recording, verification photo, transcript, and analysis report have been sent to the recruiter dashboard.',
      details: 'You can exit the secure terminal and return to your candidate dashboard.',
      tone: 'green',
      actionLabel: 'View result',
    });
  };

  const handleExitAttempt = async () => {
    setExitConfirmation({ title: 'Leave secure terminal?', message: 'Your current work will be submitted and this browser attempt will be locked. You will not be able to resume it.', confirmLabel: 'Submit and leave', danger: true });
  };

  const confirmExitAttempt = async () => {
    setExitConfirmation(null);
    await finalizeAttempt({
      reason: 'You left the secure terminal. The current work was submitted and the attempt is locked.',
      keepalive: false,
    });
    navigate('/dashboard/candidate');
  };

  const handleLoad = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await authAPI.getCurrentUser();
      if (user.role !== 'candidate') {
        navigate(user.role === 'recruiter' ? '/dashboard/recruiter' : '/');
        return;
      }
      setCurrentUser(user);

      const [profileResponse, previewResponse] = await Promise.all([
        candidateAPI.getProfile(),
        candidateAPI.getJobWorkflowPreview(Number(jobId)),
      ]);

      if (previewResponse?.assessmentClosed) {
        setError(previewResponse.availabilityMessage || 'This role is closed and no further assessment activity is available.');
        return;
      }

      if (profileResponse?.profile) {
        setProfile(profileResponse.profile);
      }

      let nextSession = previewResponse;
      if (previewResponse?.applicationId) {
        try {
          const workflowResponse = await candidateAPI.getApplicationWorkflow(previewResponse.applicationId);
          nextSession = {
            ...previewResponse,
            ...workflowResponse,
            workflow: workflowResponse.workflow || previewResponse.workflow,
          };
        } catch (workflowError) {
          // Fallback to preview data if the live workflow lookup fails.
        }
      }

      hydrateSession(nextSession);
      try {
        const recoveryKey = `invenia-assessment-recovery:${nextSession?.applicationId || jobId}`;
        const recovered = JSON.parse(localStorage.getItem(recoveryKey) || 'null');
        if (recovered?.workflowDraft) setWorkflowDraft((current) => ({ ...current, ...recovered.workflowDraft }));
        if (recovered?.interviewAnswerDraft) updateInterviewAnswerDraft(recovered.interviewAnswerDraft);
        if (recovered?.savedAt) setReconnectMessage(`Recovered locally saved work from ${new Date(recovered.savedAt).toLocaleTimeString()}.`);
      } catch (storageError) {
        // Continue with the server state when local recovery data is unavailable.
      }
      if (nextSession?.workflow?.currentStage === 'completed') {
        clearTerminalLock();
      } else if (nextSession?.applicationId) {
        const existingLock = lockHelpers.readLock();
        if (existingLock) {
          setSessionLocked(true);
          setExitWarning(existingLock.reason || 'This attempt has been locked after leaving the secure terminal.');
        }
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Failed to load the secure terminal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleLoad();
    return () => {
      stopInterviewSnapshotLoop();
      stopFaceScanLoop();
      stopMicTest();
      stopMicLevel();
      clearInterviewTranscriptionRestart();
      clearInterviewAutoSubmitTimer();
      clearScreeningScanTimer();
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
    };
  }, [jobId]);

  useEffect(() => {
    const updateNetwork = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    return () => {
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
    };
  }, []);

  useEffect(() => {
    if (!workflowSession?.applicationId) return undefined;
    const recoveryKey = `invenia-assessment-recovery:${workflowSession.applicationId}`;
    if (isCompleted) {
      localStorage.removeItem(recoveryKey);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      localStorage.setItem(recoveryKey, JSON.stringify({ workflowDraft, interviewAnswerDraft, activeStage, savedAt: new Date().toISOString() }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeStage, interviewAnswerDraft, isCompleted, workflowDraft, workflowSession?.applicationId]);

  useEffect(() => {
    if (isOnline) {
      setReconnectMessage((current) => current.includes('offline') || current.includes('Connection lost') ? 'Connection restored. Your locally saved answers are ready.' : current);
    } else {
      setConnectionCheck({ status: 'failed', latency: null, message: 'No internet connection' });
      setReconnectMessage('Connection lost. Current answers are saved on this device. Reconnect before submitting.');
    }
  }, [isOnline]);

  const handleReconnect = async () => {
    if (!navigator.onLine) {
      setReconnectMessage('Still offline. Check Wi-Fi or your network cable and retry.');
      return;
    }
    setReconnectMessage('Checking server connection...');
    try {
      if (workflowSession?.applicationId) {
        const response = await candidateAPI.getApplicationWorkflow(workflowSession.applicationId);
        setWorkflowSession((current) => ({ ...current, ...response, workflow: response.workflow || current?.workflow }));
      }
      setReconnectMessage('Connected. Server progress is synchronized and local answers are preserved.');
    } catch (requestError) {
      setReconnectMessage('The server is not reachable yet. Your answers remain saved on this device; retry shortly.');
    }
  };

  useEffect(() => {
    if (!sessionStarted || sessionLocked || isCompleted) return undefined;

    const interval = window.setInterval(() => {
      if (!['aptitude', 'technical', 'interview'].includes(activeStage)) return;
      setWorkflowTimers((prev) => ({
        ...prev,
        [activeStage]: Math.max(0, (prev[activeStage] || 0) - 1),
      }));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [sessionStarted, sessionLocked, activeStage, isCompleted]);

  useEffect(() => {
    if (!sessionStarted || sessionLocked || isCompleted) return undefined;

    const handleVisibilityChange = () => {
      if (document.hidden && ['aptitude', 'technical', 'interview'].includes(activeStage)) {
        pushProctoringEvent('Tab switch detected during the secure terminal');
      }
    };

    const handleBlur = () => {
      if (['aptitude', 'technical', 'interview'].includes(activeStage)) {
        pushProctoringEvent('Window focus was lost');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [sessionStarted, sessionLocked, activeStage, isCompleted]);

  useEffect(() => {
    if (!sessionStarted || sessionLocked || isCompleted) return undefined;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        if (interviewReadyToFinish || workflowSession?.workflow?.currentStage === 'completed') {
          return;
        }
        finalizeAttempt({
          reason: 'Fullscreen mode was exited. This secure attempt is now locked.',
          keepalive: false,
        });
      }
    };

    const handleBeforeUnload = (event) => {
      if (!workflowSession?.applicationId || activeStage === 'profile' || activeStage === 'completed') {
        return undefined;
      }
      event.preventDefault();
      event.returnValue = 'Leaving will submit your current work and lock this attempt.';
      return event.returnValue;
    };

    const handlePageHide = () => {
      if (!workflowSession?.applicationId || activeStage === 'profile' || activeStage === 'completed') {
        return;
      }
      if (!exitHandledRef.current) {
        finalizeAttempt({
          reason: 'You left the secure terminal. The current work was submitted and the attempt is locked.',
          keepalive: true,
        });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [sessionStarted, sessionLocked, isCompleted, activeStage, workflowSession?.applicationId, workflowSession?.workflow?.currentStage, interviewReadyToFinish]);

  useEffect(() => {
    if (activeStage !== 'interview' || !interviewStarted || interviewReadyToFinish || sessionLocked || isCompleted) {
      return undefined;
    }

    speakCurrentInterviewQuestion(() => {
      if (!interviewTranscribingRef.current) {
        startInterviewTranscription();
      }
    });

    return undefined;
  }, [activeStage, interviewStarted, interviewReadyToFinish, workflowSession?.workflow?.interview?.currentQuestion?.id, sessionLocked, isCompleted]);

  useEffect(() => {
    if (activeStage !== 'interview' || sessionLocked || isCompleted) {
      stopInterviewTranscription();
      stopInterviewSnapshotLoop();
      return undefined;
    }

    if (!cameraGranted || !cameraAudioEnabled) {
      return undefined;
    }

    return undefined;
  }, [activeStage, cameraGranted, cameraAudioEnabled, sessionLocked, isCompleted]);

  useEffect(() => {
    if (!workflowSession?.applicationId || activeStage === 'completed') {
      return undefined;
    }
    if (lockInfo && !sessionLocked && workflow?.currentStage !== 'completed') {
      setSessionLocked(true);
      setExitWarning(lockInfo.reason || 'This secure terminal was locked after exit.');
    }
    return undefined;
  }, [workflowSession?.applicationId, workflow?.currentStage]);

  useEffect(() => {
    if (!sessionLocked) return undefined;
    if (interviewRecorderRef.current && interviewRecorderRef.current.state !== 'inactive') {
      try {
        interviewRecorderRef.current.stop();
      } catch (error) {
        // Ignore shutdown errors.
      }
    }
    stopInterviewSnapshotLoop();
    stopFaceScanLoop();
    stopMicTest();
    clearInterviewAutoSubmitTimer();
    stopInterviewTranscription();
    stopCameraPreview();
    return undefined;
  }, [sessionLocked]);

  const selectedJob = workflow?.job || {};
  const currentQuestion = workflow?.interview?.currentQuestion || null;
  const interviewTurns = workflow?.interview?.turns || [];
  const interviewMaxQuestions = workflow?.interview?.maxQuestions || 3;
  const isScreeningLocked = Boolean(
    workflowSession?.applicationId
    && !isCompleted
    && (activeStage === 'screening' || workflow?.currentStage === 'screening' || workflowSession?.status === 'pending')
    && !ASSESSMENT_UNLOCK_STATUSES.includes(workflowSession?.status)
  );
  const accessibleStageIndex = Math.max(currentStageIndex, workflow?.currentStage === 'completed' ? STAGE_SEQUENCE.length - 1 : currentStageIndex);
  const jobAts = workflow?.jobAts || {};
  const requirementMatch = jobAts?.requirement_match || {};
  const jobAtsScore = Number(jobAts?.score ?? workflow?.jobAtsScore ?? workflow?.atsScore ?? 0) || 0;
  const profileAtsScore = Number(workflow?.profileAtsScore ?? profile?.ats_score ?? workflow?.atsScore ?? 0) || 0;
  const atsScore = jobAtsScore || profileAtsScore || 0;
  const overallScore = workflow?.overallScore || interviewReport?.overall_score || 0;
  const voiceState = interviewSpeaking ? 'Speaking' : interviewTranscribing ? 'Listening' : submitting ? 'Thinking' : interviewStarted ? 'Ready for answer' : 'Preflight';
  const estimatedInterviewMinutes = workflow?.interview?.durationMinutes || 10;
  const setupSteps = [
    { key: 'camera', label: 'Camera and face scan', complete: cameraGranted && faceScanReady },
    { key: 'microphone', label: 'Microphone practice', complete: micTestPassed },
    { key: 'speaker', label: 'Speaker check', complete: speakerTestStatus === 'passed' },
    { key: 'connection', label: 'Internet connection', complete: connectionCheck.status === 'passed' },
    { key: 'consent', label: 'Recording consent', complete: recordingConsent },
  ];
  const nextSetupStep = setupSteps.find((step) => !step.complete);
  const setupReady = !nextSetupStep && interviewCompatible && isOnline;
  const nextStepGuidance = !cameraGranted || !faceScanReady
    ? { number: 1, title: 'Start with the camera check', detail: 'Allow camera access, center one face inside the frame, and hold still until scanning reaches 100%.' }
    : !micTestPassed
      ? { number: 2, title: 'Test your microphone', detail: 'Read the sample sentence naturally for 10 seconds. Permission will be requested when you start.' }
      : speakerTestStatus !== 'passed'
        ? { number: 3, title: 'Check your speaker', detail: 'Play the sample and confirm that interview questions can be heard clearly.' }
        : connectionCheck.status !== 'passed'
          ? { number: 4, title: 'Check your internet connection', detail: 'Run the server connection test and confirm a successful latency result.' }
          : !recordingConsent
            ? { number: 5, title: 'Review and provide consent', detail: 'Read the recording notice, then select the consent checkbox.' }
            : { number: 6, title: 'Everything is ready', detail: 'Select Begin interview. The first question will appear and play only after the secure session starts.' };
  const terminalLoaderActive = (submitting && !screeningScan.active) || uploadingResume || interviewUploading;
  const terminalLoaderTitle = interviewUploading
    ? 'Saving interview package'
    : uploadingResume
      ? 'Uploading and scanning CV'
      : 'Submitting application';
  const terminalLoaderMessage = interviewUploading
    ? 'Your recording, verification photo, transcript, and AI report are being stored for recruiter review.'
    : uploadingResume
      ? 'Please wait while your CV is uploaded and linked to this secure application.'
      : 'Please wait while your application is sent once. The button is locked to prevent duplicate submissions.';

  if (loading) {
    return <PageSkeleton label="Preparing assessment centre" />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
        <div className="max-w-xl rounded-[32px] border border-rose-200 bg-white p-8 text-center shadow-sm">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-rose-500" />
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Assessment centre unavailable</h1>
          <p className="mt-3 text-sm text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard/candidate')}
            className="mt-6 rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (sessionLocked && !isCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-10">
          <div className="rounded-[36px] border border-rose-200 bg-white p-8 shadow-[0_30px_90px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">
                <LockClosedIcon className="h-4 w-4" />
                Attempt locked
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
                Application #{workflowSession?.applicationId || 'N/A'}
              </span>
            </div>

            <h1 className="mt-6 text-4xl font-semibold text-slate-900">You left the secure terminal</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
              This attempt is locked on this browser session. The current work has been finalized as far as the secure terminal could capture it.
              {exitWarning ? ` ${exitWarning}` : ''}
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <TerminalMetric label="Current stage" value={activeStage} tone="text-blue-800" />
              <TerminalMetric label="Warnings" value={String(proctoring.warnings)} tone="text-amber-700" />
              <TerminalMetric label="Job ATS score" value={`${atsScore}%`} tone="text-emerald-700" />
            </div>

            {(workflow?.interview?.report || interviewReport) && (
              <div className="mt-6 rounded-[28px] border border-emerald-200 bg-emerald-50 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Latest report</p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-900">
                  {(workflow?.interview?.report || interviewReport)?.decision || 'Review'}
                </h2>
                <p className="mt-3 text-sm leading-7 text-emerald-900/80">
                  {(workflow?.interview?.report || interviewReport)?.summary || 'The final report is ready to review.'}
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard/candidate')}
                className="rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white"
              >
                Return to dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isScreeningLocked) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[40px] border border-blue-100 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.08)] lg:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                  <LockClosedIcon className="h-4 w-4" />
                  Screening locked
                </span>
                <h1 className="mt-5 text-4xl font-semibold text-slate-900">Application sent to recruiter verification</h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                  Your application for {selectedJob.title || 'this role'} has been submitted successfully. Kindly wait for recruiter verification and approval before starting the next round.
                </p>
              </div>
              <div className="rounded-[28px] border border-blue-100 bg-blue-50 px-5 py-4 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Application</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">#{workflowSession?.applicationId}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <TerminalMetric label="Status" value="Pending approval" tone="text-amber-700" />
              <TerminalMetric label="Job ATS" value={`${atsScore}%`} tone="text-blue-800" />
              <TerminalMetric label="Profile ATS" value={`${profileAtsScore || 0}%`} tone="text-emerald-700" />
              <TerminalMetric label="Match score" value={`${workflow?.matchScore || 0}%`} tone="text-violet-700" />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
              <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">What happens next</p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-900">Recruiter screening round</h2>
                <div className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
                  <p>- Recruiter will compare your CV with the job requirements using AI analytics.</p>
                  <p>- If selected, your dashboard and this terminal will unlock the enabled rounds.</p>
                  <p>- If the recruiter only enabled AI Interview, you will directly enter the interview stage.</p>
                </div>
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Submitted CV</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-900">
                  {workflow?.profile?.resume_name || profile?.resume_name || 'Candidate resume'}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  This CV is attached to the recruiter-side job analysis and candidate comparison report.
                </p>
                {(workflow?.profile?.resume_url || profile?.resume_url) && (
                  <button
                    type="button"
                    onClick={handleOpenSubmittedResume}
                    className="mt-5 inline-flex rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white"
                  >
                    Preview submitted CV
                  </button>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleLoad}
                className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-800"
              >
                Refresh approval status
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/candidate')}
                className="rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white"
              >
                Exit secure terminal
              </button>
            </div>
          </div>
        </div>
        <TerminalNoticeModal notice={noticeModal} onClose={closeTerminalNotice} />
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-4 lg:grid-cols-[300px,1fr] lg:px-6">
          <aside className="rounded-[36px] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.08)]">
            <div className="rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Invenia AI</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">Secure terminal</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Final assessment result and report summary.</p>
            </div>
            <div className="mt-6 space-y-3">
              <StagePill active={false} done label="Profile Review" index={1} />
              <StagePill active={false} done label="Aptitude Test" index={2} />
              <StagePill active={false} done label="Technical MCQ" index={3} />
              <StagePill active={false} done label="Coding Round" index={4} />
              <StagePill active={false} done label="AI Interview" index={5} />
              <StagePill active label="Result Ready" index={6} />
            </div>
          </aside>

          <main className="rounded-[36px] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.08)] lg:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-700">Assessment complete</p>
                <h1 className="mt-2 text-4xl font-semibold text-slate-900">Your result report is ready</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  The secure journey for {selectedJob.title || 'this role'} has finished. Below is the generated summary from the application workflow.
                </p>
              </div>
              <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Overall score</p>
                <p className="mt-2 text-4xl font-semibold text-slate-900">{overallScore}%</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <TerminalMetric label="Job ATS score" value={`${atsScore}%`} tone="text-blue-800" />
              <TerminalMetric label="Match score" value={`${workflow?.matchScore || 0}%`} tone="text-emerald-700" />
              <TerminalMetric label="Coding score" value={`${workflow?.coding?.score || 0}%`} tone="text-violet-700" />
              <TerminalMetric label="Interview score" value={`${workflow?.interview?.score || 0}%`} tone="text-amber-700" />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
              <div className="space-y-6">
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
                  <h2 className="text-xl font-semibold text-slate-900">Generated report</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {(workflow?.interview?.report || interviewReport)?.summary || 'The interview analysis will appear here after the secure session is completed.'}
                  </p>
                </div>

                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
                  <h2 className="text-xl font-semibold text-slate-900">Stage breakdown</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                      ['Aptitude', `${workflow?.aptitude?.score || 0}/${workflow?.aptitude?.questions?.length || 0}`],
                      ['Technical', `${workflow?.technical?.score || 0}/${workflow?.technical?.questions?.length || 0}`],
                      ['Coding', workflow?.coding?.feedback || 'Awaiting recruiter review'],
                      ['Interview', workflow?.interview?.feedback || 'Awaiting recruiter review'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-800">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
                  <h2 className="text-xl font-semibold text-slate-900">Security log</h2>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <p>Full-screen status: {sessionStarted ? 'Enabled' : 'Not used'}</p>
                    <p>Camera access: {cameraGranted ? 'Granted' : 'Not active'}</p>
                    <p>Mic capture: {cameraAudioEnabled ? 'Enabled' : 'Not active'}</p>
                    <p>Proctoring warnings: {proctoring.warnings}</p>
                  </div>
                </div>

                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-6">
                  <h2 className="text-xl font-semibold text-slate-900">Session snapshot</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    The secure terminal stored the last camera snapshot and recording reference for recruiter-side review.
                  </p>
                  {interviewSnapshotUrl && (
                    <img src={interviewSnapshotUrl} alt="Interview snapshot" className="mt-4 h-56 w-full rounded-3xl object-cover" />
                  )}
                  {interviewRecordingUrl && (
                    <a
                      href={buildFileUrl(interviewRecordingUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800"
                    >
                      Open recording
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard/candidate')}
                className="rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white"
              >
                Back to dashboard
              </button>
              <button
                type="button"
                onClick={() => clearTerminalLock()}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Clear lock for this browser
              </button>
            </div>
          </main>
        </div>
        <TerminalNoticeModal notice={noticeModal} onClose={closeTerminalNotice} />
      </div>
    );
  }

  const stageLabelMap = {
    profile: 'Profile Review',
    screening: 'Recruiter Verification',
    aptitude: 'Aptitude Test',
    technical: 'Technical MCQ',
    coding: 'Coding Round',
    interview: 'AI Interview',
  };
  const liveInterviewMode = activeStage === 'interview' && interviewStarted && !interviewReadyToFinish;

  return (
    <div ref={terminalShellRef} className="min-h-screen bg-slate-50 text-slate-900 lg:h-screen lg:overflow-hidden">
      <div className={`mx-auto grid min-h-screen max-w-[1800px] gap-6 px-4 py-4 lg:h-full lg:min-h-0 lg:px-6 ${liveInterviewMode ? 'lg:grid-cols-1' : 'lg:grid-cols-[318px,1fr]'}`}>
        <aside className={`${liveInterviewMode ? 'hidden' : 'flex'} min-h-0 flex-col overflow-y-auto rounded-[36px] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.08)] lg:h-full`}>
          <div className="rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-900/10 text-blue-900">
                <ShieldCheckIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Invenia AI</p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">Secure Terminal</h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              One isolated screen for the full assessment journey. Full-screen mode, camera verification, timed tests, and AI interview capture are all handled here.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {STAGE_SEQUENCE.map((stage, index) => {
              if (stage === 'completed' || stage === 'screening') return null;
              if (!workflowSession?.applicationId && stage !== 'profile') return null;
              if (['aptitude', 'technical', 'coding'].includes(stage) && !isWorkflowStageEnabled(workflow, stage)) return null;
              const done = currentStageIndex > index;
              const active = activeStage === stage;
              const stageQuestions = workflow?.[stage]?.questions?.length || (stage === 'coding' ? 2 : 0);
              const required = stage === 'interview' ? true : Boolean(workflow?.[stage]?.required ?? true);
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => {
                    if (index <= accessibleStageIndex || done) {
                      setActiveStage(stage);
                    }
                  }}
                  className={`w-full text-left transition ${index <= accessibleStageIndex || done ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                >
                  <StagePill
                    active={active}
                    done={done}
                    label={`${stageLabelMap[stage]}${stageQuestions ? ` | ${stageQuestions} items` : ''}${required ? ' | Required' : ' | Optional'}`}
                    index={index + 1}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-[30px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <SparklesIcon className="h-4 w-4" />
              Security status
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
                <span className="text-slate-500">Mode</span>
                <span className="font-semibold text-slate-900">Secure terminal</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
                <span className="text-slate-500">Warnings</span>
                <span className="font-semibold text-amber-700">{proctoring.warnings}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
                <span className="text-slate-500">Application</span>
                <span className="font-semibold text-slate-900">#{workflowSession?.applicationId || 'Pending'}</span>
              </div>
            </div>
          </div>
        </aside>

        <main className={`flex min-h-0 flex-col overflow-y-auto rounded-[36px] border border-slate-200 bg-white p-5 shadow-[0_30px_90px_rgba(15,23,42,0.08)] lg:h-full ${liveInterviewMode ? 'lg:p-5' : 'lg:p-8'}`}>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">
                  <LockClosedIcon className="h-4 w-4" />
                  Protected assessment
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                  <ClockIcon className="h-4 w-4" />
                  {workflow?.[activeStage]?.durationMinutes ? `${workflow[activeStage].durationMinutes} min` : 'Timed session'}
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold text-slate-900 lg:text-4xl">
                {selectedJob.title || 'Assessment journey'}
              </h2>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
                {selectedJob.company || 'Invenia AI'} | {selectedJob.location || 'Remote/Hybrid'} | {selectedJob.salary || 'Competitive'}
              </p>
              {exitWarning && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {exitWarning}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleBeginSecureSession}
                disabled={submitting || !isOnline}
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <PlayIcon className="h-4 w-4" />
                )}
                {submitting
                  ? 'Processing...'
                  : workflowSession?.applicationId
                    ? 'Begin approved rounds'
                    : 'Submit application for verification'}
              </button>
              <button
                type="button"
                onClick={handleExitAttempt}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Leave secure terminal
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TerminalMetric label="Job ATS score" value={`${atsScore}%`} tone="text-blue-800" />
            <TerminalMetric label="Match score" value={`${workflow?.matchScore || 0}%`} tone="text-emerald-700" />
            <TerminalMetric label="Overall score" value={`${overallScore}%`} tone="text-violet-700" />
            <TerminalMetric label="Proctoring warnings" value={String(proctoring.warnings)} tone="text-amber-700" />
          </div>

          <div className="mt-6 rounded-[30px] border border-blue-100 bg-blue-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-900/10 text-blue-900">
                  <CommandLineIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Current stage</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">{stageLabelMap[activeStage] || activeStage}</h3>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-800 shadow-sm">
                <ShieldCheckIcon className="h-4 w-4" />
                {sessionStarted ? 'Secure mode active' : 'Ready to begin'}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.12fr,0.88fr]">
            <div className="space-y-6">
              {activeStage === 'profile' && (
                <section className="rounded-[32px] border border-slate-200 bg-white p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">Stage 1</p>
                      <h3 className="mt-3 text-2xl font-semibold text-slate-900">Profile review and application gate</h3>
                      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                        Review your profile and resume before the secure assessment begins. This is the last screen before the terminal locks into timed stages.
                      </p>
                    </div>
                    <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-4 text-right shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">AI Match Score</p>
                      <p className="mt-2 text-4xl font-semibold text-slate-900">{workflow?.matchScore || 0}%</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                      <ProfileAvatar src={buildFileUrl(workflow?.profile?.photo_url || profile?.photo_url)} name={workflow?.profile?.full_name || profile?.full_name || currentUser?.full_name || 'Candidate'} className="h-11 w-11" />
                      <div><p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Candidate</p><p className="mt-2 text-sm text-slate-900">{workflow?.profile?.full_name || profile?.full_name || currentUser?.full_name || 'Candidate'}</p></div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Email</p>
                      <p className="mt-2 text-sm text-slate-900">{workflow?.profile?.email || profile?.email || currentUser?.email || 'Not added'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Resume</p>
                      <p className="mt-2 text-sm text-slate-900">{workflow?.profile?.resume_url ? 'Uploaded' : 'Not uploaded'}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Job ATS</p>
                      <p className="mt-2 text-sm text-slate-900">{atsScore}%</p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[30px] border border-blue-100 bg-blue-50 p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Stage 1 CV submission</p>
                        <h4 className="mt-2 text-xl font-semibold text-slate-900">
                          {workflow?.profile?.resume_url || profile?.resume_url ? 'CV attached for this application' : 'Upload your CV to apply'}
                        </h4>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Candidates can upload a CV here even if it was not added in the profile earlier. The recruiter will see this CV in job-wise analysis.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {(workflow?.profile?.resume_url || profile?.resume_url) && (
                          <button
                            type="button"
                            onClick={handleOpenSubmittedResume}
                            className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-800"
                          >
                            Preview CV
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => resumeInputRef.current?.click()}
                          disabled={uploadingResume || Boolean(workflowSession?.applicationId)}
                          className="rounded-2xl bg-blue-900 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
                        >
                          {uploadingResume ? 'Uploading and scanning...' : workflowSession?.applicationId ? 'CV submitted' : 'Upload / replace CV'}
                        </button>
                        <input
                          ref={resumeInputRef}
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleTerminalResumeUpload}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>

                  <ScreeningScanPanel scan={screeningScan} jobAts={jobAts} score={atsScore} />

                  <div className="mt-6 rounded-[30px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Role-fit ATS analysis</p>
                        <h4 className="mt-2 text-xl font-semibold text-slate-900">CV match against this job</h4>
                        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                          {jobAts?.summary || 'The job-specific ATS report compares your resume only against this job description, requirements, skills, and responsibilities.'}
                        </p>
                      </div>
                      <div className="rounded-[28px] border border-blue-100 bg-white px-6 py-5 text-center shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Job ATS</p>
                        <p className="mt-2 text-5xl font-semibold text-blue-900">{atsScore}%</p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">Profile ATS: {profileAtsScore || 0}%</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <ScoreBar
                        label="Requirement coverage"
                        score={requirementMatch?.percentage ?? atsScore}
                        note={`${requirementMatch?.matched || 0} matched, ${requirementMatch?.partial || 0} partial, ${requirementMatch?.missing || 0} missing`}
                        tone="bg-blue-800"
                      />
                      <ScoreBar
                        label="AI match score"
                        score={workflow?.matchScore || 0}
                        note="Profile skill overlap with recruiter requirements."
                        tone="bg-emerald-600"
                      />
                      <ScoreBar
                        label="Role readiness"
                        score={atsScore}
                        note={jobAts?.recommendation || 'Generated from resume-to-job evidence.'}
                        tone="bg-slate-900"
                      />
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                      {(jobAts?.category_scores || []).length > 0 ? (
                        <div className="grid gap-3">
                          {jobAts.category_scores.map((item) => (
                            <ScoreBar
                              key={item.label}
                              label={item.label}
                              score={Math.round(((Number(item.score) || 0) / Math.max(1, Number(item.maxScore) || 100)) * 100)}
                              note={item.note}
                              tone="bg-blue-700"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                          Job-specific ATS categories will appear after the AI scan finishes.
                        </div>
                      )}

                      <div className="grid gap-3">
                        <RequirementList
                          title="Matched requirements"
                          items={jobAts?.matched_requirements || []}
                          emptyText="No direct requirement matches detected yet."
                          tone="border-emerald-200 bg-emerald-50 text-emerald-700"
                        />
                        <RequirementList
                          title="Partial evidence"
                          items={jobAts?.partial_requirements || []}
                          emptyText="No partial requirements detected."
                          tone="border-amber-200 bg-amber-50 text-amber-700"
                        />
                        <RequirementList
                          title="Missing requirements"
                          items={jobAts?.missing_requirements || []}
                          emptyText="No missing requirements detected from the scan."
                          tone="border-rose-200 bg-rose-50 text-rose-700"
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <RequirementList
                        title="Role-fit strengths"
                        items={jobAts?.strengths || []}
                        emptyText="Strengths will appear once the role-fit scan has enough evidence."
                        tone="border-blue-100 bg-blue-50 text-blue-800"
                      />
                      <RequirementList
                        title="Role-fit gaps"
                        items={jobAts?.gaps || []}
                        emptyText="No role-fit gaps detected yet."
                        tone="border-slate-200 bg-slate-50 text-slate-700"
                      />
                    </div>

                    <p className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-6 text-slate-500 shadow-sm">
                      This score ignores grammar, formatting, section order, template quality, and resume style. It checks only whether the job requirements are visible in your CV/profile.
                    </p>
                  </div>

                  {(workflow?.profile?.resume_url || profile?.resume_url) && (
                    <button
                      type="button"
                      onClick={handleOpenSubmittedResume}
                      className="mt-6 inline-flex rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800"
                    >
                      Preview submitted resume
                    </button>
                  )}

                  <div className="mt-6 rounded-[28px] border border-amber-200 bg-amber-50 p-5">
                    <p className="text-sm font-semibold text-amber-800">Assessment rules</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
                        Aptitude, technical, and coding stages follow recruiter settings and can be optional or compulsory.
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
                        The AI interview remains compulsory and will activate the camera and voice assistant.
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {activeStage === 'aptitude' && (
                <section className="rounded-[32px] border border-slate-200 bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">Stage 2</p>
                      <h3 className="mt-3 text-2xl font-semibold text-slate-900">Aptitude test</h3>
                      <p className="mt-2 text-sm text-slate-600">
                        {workflow?.aptitude?.required ? 'Compulsory' : 'Optional'} screening with {workflow?.aptitude?.questions?.length || 0} questions.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 shadow-sm">
                      Time left: {formatTimer(workflowTimers.aptitude)}
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {(workflow?.aptitude?.questions || []).map((question) => (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        answer={workflowDraft.aptitude[question.id]}
                        onChange={(value) => setWorkflowDraft((prev) => ({
                          ...prev,
                          aptitude: { ...prev.aptitude, [question.id]: value },
                        }))}
                      />
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleStageSubmit('aptitude')}
                      disabled={submitting || !isOnline}
                      className="rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {submitting ? 'Submitting...' : 'Submit aptitude and continue'}
                    </button>
                    {!workflow?.aptitude?.required && (
                      <button
                        type="button"
                        onClick={() => handleStageSubmit('aptitude', { skip: true })}
                        disabled={submitting || !isOnline}
                        className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                      >
                        Skip aptitude for now
                      </button>
                    )}
                  </div>
                </section>
              )}

              {activeStage === 'technical' && (
                <section className="rounded-[32px] border border-slate-200 bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">Stage 3</p>
                      <h3 className="mt-3 text-2xl font-semibold text-slate-900">Technical MCQ test</h3>
                      <p className="mt-2 text-sm text-slate-600">
                        {workflow?.technical?.required ? 'Compulsory' : 'Optional'} role-based screening with {workflow?.technical?.questions?.length || 0} questions.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 shadow-sm">
                      Time left: {formatTimer(workflowTimers.technical)}
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {(workflow?.technical?.questions || []).map((question) => (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        answer={workflowDraft.technical[question.id]}
                        onChange={(value) => setWorkflowDraft((prev) => ({
                          ...prev,
                          technical: { ...prev.technical, [question.id]: value },
                        }))}
                      />
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleStageSubmit('technical')}
                      disabled={submitting || !isOnline}
                      className="rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {submitting ? 'Submitting...' : 'Submit technical test'}
                    </button>
                    {!workflow?.technical?.required && (
                      <button
                        type="button"
                        onClick={() => handleStageSubmit('technical', { skip: true })}
                        disabled={submitting || !isOnline}
                        className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                      >
                        Skip technical for now
                      </button>
                    )}
                  </div>
                </section>
              )}

              {activeStage === 'coding' && (
                <section className="rounded-[32px] border border-slate-200 bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">Stage 4</p>
                      <h3 className="mt-3 text-2xl font-semibold text-slate-900">Coding round</h3>
                      <p className="mt-2 text-sm text-slate-600">
                        Two coding prompts with a focused answer space and recruiter-defined evaluation.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                      <CommandLineIcon className="h-4 w-4 text-blue-700" />
                      {workflow?.coding?.required ? 'Compulsory' : 'Optional'}
                    </div>
                  </div>

                  <div className="mt-6 space-y-5">
                    {(workflow?.coding?.questions || []).map((question, index) => (
                      <div key={question.id} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
                        <p className="text-sm font-semibold text-blue-900">{question.title || `Prompt ${index + 1}`}</p>
                        <p className="mt-3 text-sm leading-7 text-slate-700">{question.prompt}</p>
                        {question.guidance && (
                          <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">{question.guidance}</p>
                        )}
                        <textarea
                          rows={10}
                          value={workflowDraft.coding[index] || ''}
                          onChange={(event) => setWorkflowDraft((prev) => {
                            const nextCoding = [...prev.coding];
                            nextCoding[index] = event.target.value;
                            return { ...prev, coding: nextCoding };
                          })}
                          className="mt-4 w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300"
                          placeholder="Write your answer here..."
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleStageSubmit('coding')}
                      disabled={submitting || !isOnline}
                      className="rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {submitting ? 'Submitting...' : 'Submit coding round'}
                    </button>
                    {!workflow?.coding?.required && (
                      <button
                        type="button"
                        onClick={() => handleStageSubmit('coding', { skip: true })}
                        disabled={submitting || !isOnline}
                        className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                      >
                        Skip coding for now
                      </button>
                    )}
                  </div>
                </section>
              )}

              {activeStage === 'interview' && (
                <section ref={interviewPanelRef} className="rounded-[32px] border border-slate-200 bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">Stage 5</p>
                      <h3 className="mt-3 text-2xl font-semibold text-slate-900">AI interview</h3>
                      <p className="mt-2 text-sm text-slate-600">
                        Compulsory three-question voice interview with camera verification and live transcript capture.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 shadow-sm">
                      Time left: {formatTimer(workflowTimers.interview)}
                    </div>
                  </div>

                  {!interviewStarted && (
                    <div className="mt-5 rounded-[28px] border border-blue-200 bg-gradient-to-r from-blue-950 to-blue-800 p-5 text-white shadow-lg">
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold">{nextStepGuidance.number}</div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">What to do next</p>
                          <h4 className="mt-1 text-xl font-semibold">{nextStepGuidance.title}</h4>
                          <p className="mt-2 text-sm leading-6 text-blue-100">{nextStepGuidance.detail}</p>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-2 sm:grid-cols-5">
                        {setupSteps.map((step, index) => (
                          <div key={step.key} className={`rounded-xl px-3 py-2 text-xs font-semibold ${step.complete ? 'bg-emerald-400/20 text-emerald-100' : nextSetupStep?.key === step.key ? 'bg-white text-blue-950' : 'bg-white/10 text-blue-200'}`}>
                            {step.complete ? 'Done' : `Step ${index + 1}`}<span className="mt-1 block font-medium">{step.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={`mt-5 rounded-[24px] border p-5 ${interviewCompatible && isOnline ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-950">Interview compatibility check</p><p className="mt-1 text-xs text-slate-600">Chrome or Edge on a laptop/desktop is recommended for reliable proctoring and speech capture.</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${interviewCompatible && isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{interviewCompatible && isOnline ? 'Ready' : 'Action needed'}</span></div>
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{[['Camera', browserCompatibility.camera], ['Recording', browserCompatibility.recording], ['Speech', browserCompatibility.speech], ['Fullscreen', browserCompatibility.fullscreen], ['Network', isOnline]].map(([label, ready]) => <div key={label} className={`rounded-xl bg-white px-3 py-2 text-xs font-semibold ${ready ? 'text-emerald-700' : 'text-rose-700'}`}>{ready ? 'Ready' : 'Missing'}: {label}</div>)}</div>
                    {!browserCompatibility.desktopRecommended && <p className="mt-3 text-xs font-semibold text-amber-800">Mobile devices may interrupt fullscreen, camera, or speech recognition. Use a laptop or desktop before beginning.</p>}
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-2">
                    <div className="rounded-[24px] border border-blue-100 bg-blue-50/60 p-5">
                      <p className="text-sm font-semibold text-slate-950">Before you begin</p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {[
                          ['Stable internet connection', connectionCheck.status === 'passed'],
                          ['Quiet, well-lit place', null],
                          ['Charged device or power connected', null],
                          ['Chrome or Edge browser', browserCompatibility.speech && browserCompatibility.recording],
                          ['Microphone and camera allowed', cameraGranted && cameraAudioEnabled],
                          [`Allow about ${estimatedInterviewMinutes + 5} minutes`, null],
                        ].map(([label, ready]) => <div key={label} className={`rounded-xl bg-white px-3 py-2 text-xs font-medium ${ready === false ? 'text-rose-700' : ready === true ? 'text-emerald-700' : 'text-slate-700'}`}>{ready === true ? 'Ready: ' : ready === false ? 'Check: ' : ''}{label}</div>)}
                      </div>
                      <p className="mt-4 text-xs font-semibold leading-5 text-blue-950">Camera and microphone are mandatory for the interview because identity, answers, and proctoring evidence are recorded. Pause is not available after the timed interview begins.</p>
                    </div>

                    <div id="permission-help" className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <div><p className="text-sm font-semibold text-slate-950">Complete these checks in order</p><p className="mt-1 text-xs text-slate-500">Each check unlocks the next one.</p></div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <button type="button" onClick={handleStartCameraCheck} disabled={interviewStarted} className={`rounded-xl border px-3 py-3 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${faceScanReady ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-blue-200 bg-white text-blue-900'}`}>1. Camera: {faceScanReady ? 'face scan complete' : cameraGranted ? `scanning ${faceScanProgress}%` : 'start face scan'}</button>
                        <button type="button" onClick={handleMicTest} disabled={!faceScanReady || micTestStatus === 'recording' || interviewStarted} className={`rounded-xl border px-3 py-3 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${micTestPassed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'}`}>2. Microphone: {micTestStatus === 'recording' ? 'recording 10 seconds...' : micTestPassed ? 'practice passed' : 'start practice'}</button>
                        <button type="button" onClick={handleSpeakerTest} disabled={!micTestPassed || speakerTestStatus === 'testing' || interviewStarted} className={`rounded-xl border px-3 py-3 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${speakerTestStatus === 'passed' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'}`}>3. Speaker: {speakerTestStatus === 'testing' ? 'playing...' : speakerTestStatus === 'passed' ? 'test passed' : 'play test'}</button>
                        <button type="button" onClick={handleConnectionCheck} disabled={speakerTestStatus !== 'passed' || connectionCheck.status === 'checking' || interviewStarted} className={`rounded-xl border px-3 py-3 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${connectionCheck.status === 'passed' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : connectionCheck.status === 'failed' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-700'}`}>4. Internet: {connectionCheck.message}</button>
                      </div>
                      <div className="mt-4"><div className="flex justify-between text-xs text-slate-600"><span>Live microphone input</span><span>{micInputLevel}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${micInputLevel}%` }} /></div></div>
                      <p className="mt-4 text-xs leading-5 text-slate-600">
                        Permission blocked? Select the lock icon beside the browser address, allow camera and microphone for this site, then retry.{' '}
                        <a href="https://support.google.com/chrome/answer/2693767" target="_blank" rel="noreferrer" className="font-semibold text-blue-800 underline underline-offset-2">Open permission troubleshooting</a>
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                    <p className="text-sm font-semibold text-slate-950">Recording, analysis, and consent</p>
                    <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-700 sm:grid-cols-2"><p><strong>Captured:</strong> interview video/audio, verification photo, answers/transcript, timestamps, and security events.</p><p><strong>Purpose:</strong> verify participation and provide job-related interview evidence.</p><p><strong>Reviewers:</strong> the hiring recruiter and authorized Invenia administrators.</p><p><strong>Invenia AI Analysis:</strong> transcribes and summarizes evidence; the recruiter makes the hiring decision.</p><p><strong>Retention:</strong> records remain under the recruiting organization&apos;s data-retention policy until an authorized administrator removes them.</p><p><strong>Support:</strong> contact your recruitment coordinator using your registered email if you need help or an accommodation.</p></div>
                    <label className={`mt-4 flex items-start gap-3 rounded-2xl bg-white p-4 text-sm font-medium text-slate-800 ${connectionCheck.status !== 'passed' ? 'cursor-not-allowed opacity-55' : ''}`}><input type="checkbox" checked={recordingConsent} disabled={connectionCheck.status !== 'passed' || interviewStarted} onChange={(event) => setRecordingConsent(event.target.checked)} className="mt-1 h-4 w-4" /><span>5. I have read this notice and consent to the required interview recording and analysis.</span></label>
                    <p className="mt-3 text-xs leading-5 text-slate-700">If your connection drops, answers and current progress are autosaved in this browser where possible. Reconnect, select <strong>Reconnect and sync</strong>, and resume from the saved stage. The timed interview cannot be paused intentionally.</p>
                  </div>

                  {reconnectMessage && <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${isOnline ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-rose-200 bg-rose-50 text-rose-800'}`}><span>{reconnectMessage}</span><button type="button" onClick={handleReconnect} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold shadow-sm">Reconnect and sync</button></div>}

                  {!interviewStarted && (
                    <div className="mt-5 flex flex-col items-center rounded-[24px] border border-blue-100 bg-blue-50/60 p-5 text-center">
                      <button type="button" onClick={handleBeginInterviewSession} disabled={!setupReady || !cameraAudioEnabled} className="inline-flex items-center gap-2 rounded-2xl bg-blue-900 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                        <VideoCameraIcon className="h-4 w-4" />
                        {setupReady ? 'Begin secure interview' : `Complete ${nextSetupStep?.label || 'browser checks'} first`}
                      </button>
                      <p className="mt-2 text-xs text-blue-800">The first question and answering tools unlock only after you select this button.</p>
                    </div>
                  )}

                  <div className={`mt-6 grid gap-6 ${interviewStarted ? (liveInterviewMode ? 'xl:grid-cols-[1.15fr,0.85fr]' : 'xl:grid-cols-[0.98fr,1.02fr]') : 'xl:grid-cols-1'}`}>
                    {interviewStarted && <div className="space-y-4">
                      <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Question</p>
                            <h4 className="mt-2 text-lg font-semibold text-slate-900">
                              {currentQuestion?.prompt || 'Preparing your first question...'}
                            </h4>
                          </div>
                          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${voiceState === 'Listening' ? 'bg-emerald-50 text-emerald-800' : voiceState === 'Speaking' ? 'bg-blue-50 text-blue-800' : voiceState === 'Thinking' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                            {voiceState}
                          </div>
                        </div>
                        {currentQuestion?.focus && (
                          <p className="mt-3 text-sm text-blue-900/80">Focus: {currentQuestion.focus}</p>
                        )}
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button type="button" onClick={handleInterviewPromptPlayback} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                            <PlayIcon className="h-4 w-4" />
                            Replay question
                          </button>
                        </div>
                      </div>

                      <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Transcript</p>
                        <textarea
                          rows={9}
                          value={interviewAnswerDraft}
                          onChange={(event) => updateInterviewAnswerDraft(event.target.value)}
                          placeholder="Speech-to-text will type here in real time..."
                          className="mt-4 w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-300"
                        />
                        <p className="mt-2 text-xs leading-5 text-slate-600">Answer naturally and watch the live caption here. You may replay the question and correct transcription text before it is submitted. After about five seconds of silence, the answer may submit automatically and the next question will be prepared.</p>
                        {interviewAutoMessage && (
                          <p className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                            {interviewAutoMessage}
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (interviewTranscribing) {
                                stopInterviewTranscription();
                              } else {
                                startInterviewTranscription();
                              }
                            }}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
                          >
                            <MicrophoneIcon className="h-4 w-4" />
                            {interviewTranscribing ? 'Stop voice capture' : 'Start voice capture'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              clearInterviewAutoSubmitTimer();
                              interviewFinalTranscriptRef.current = '';
                              updateInterviewAnswerDraft('');
                              setInterviewAutoMessage('');
                            }}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
                          >
                            <ArrowPathIcon className="h-4 w-4" />
                            Clear answer
                          </button>
                        </div>
                      </div>
                    </div>}

                    <div className="space-y-4">
                      <div className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-slate-100 shadow-sm">
                        <video ref={cameraVideoRef} autoPlay muted playsInline className={`${liveInterviewMode ? 'h-[62vh]' : 'h-[340px]'} w-full object-cover`} />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className={`h-52 w-40 rounded-[42%] border-4 ${faceScanReady ? 'border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.55)]' : 'border-amber-300 shadow-[0_0_35px_rgba(245,158,11,0.45)]'}`} />
                        </div>
                        <div className="absolute left-4 top-4 rounded-2xl border border-white/30 bg-slate-950/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                          {faceScanReady ? 'Face verified' : 'Face scan pending'}
                        </div>
                        {interviewSnapshotUrl && (
                          <div className="absolute right-4 top-4 h-20 w-20 overflow-hidden rounded-full border-4 border-amber-300 bg-white shadow-xl">
                            <img src={interviewSnapshotUrl} alt="Captured verification" className="h-full w-full object-cover" />
                          </div>
                        )}
                        <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-slate-950/75 px-4 py-3 text-sm text-white">
                          <div className="flex items-center justify-between gap-3"><span>{faceScanMessage}</span><span className="shrink-0 font-semibold">{faceScanProgress}%</span></div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${faceScanProgress}%` }} /></div>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                        <TerminalMetric label="Camera" value={cameraGranted ? 'Active' : 'Pending'} tone={cameraGranted ? 'text-emerald-700' : 'text-amber-700'} />
                        <TerminalMetric label="Mic test" value={micTestPassed ? 'Passed' : micTestStatus === 'recording' ? 'Testing' : 'Pending'} tone={micTestPassed ? 'text-emerald-700' : 'text-amber-700'} />
                        <TerminalMetric label="Recording" value={interviewUploading ? 'Uploading' : interviewRecordingActive ? 'Live' : 'Idle'} tone="text-blue-800" />
                        <TerminalMetric label="Warnings" value={String(proctoring.warnings)} tone="text-amber-700" />
                      </div>

                      <div className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Non-scored practice audio check</p>
                        <p className="mt-2 text-sm text-slate-600">This sample is not scored. You have 10 seconds. Read: "Hi, my name is your name, and I am ready for the interview." Check the transcript and playback, then retry if words were missed.</p>
                        <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {micTestTranscript || 'Mic transcript will appear here after the test.'}
                        </p>
                        {micTestAudioUrl && (
                          <audio src={micTestAudioUrl} controls className="mt-3 w-full" />
                        )}
                        <button type="button" onClick={handleMicTest} disabled={!faceScanReady || micTestStatus === 'recording' || interviewStarted} className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{micTestPassed ? 'Retry practice audio' : 'Start 10-second microphone test'}</button>
                      </div>

                      {interviewSnapshotUrl && (
                        <div className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Verification photo</p>
                          <img src={interviewSnapshotUrl} alt="Interview snapshot" className="mt-4 h-52 w-full rounded-[24px] object-cover" />
                        </div>
                      )}

                      <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Proctor log</p>
                        <div className="mt-4 space-y-2 text-sm text-slate-700">
                          {(proctoring.events || []).length > 0 ? (
                            proctoring.events.map((item) => (
                              <p key={item}>{item}</p>
                            ))
                          ) : (
                            <p>No security warnings recorded yet.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {interviewReadyToFinish ? (
                      <button
                        type="button"
                        onClick={handleEndInterviewSession}
                        disabled={interviewUploading}
                        className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {interviewUploading ? 'Saving...' : 'End interview'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStageSubmit('interview')}
                        disabled={submitting || !interviewStarted || !isOnline}
                        className="rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {submitting ? 'Submitting...' : 'Submit answer now'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await finalizeAttempt({
                          reason: 'Leaving interview stage locks the current attempt.',
                          keepalive: false,
                        });
                      }}
                      className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
                    >
                      Lock and exit
                    </button>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {interviewTurns.map((turn, index) => (
                      <div key={`${turn.turn || index}-${turn.question_id || index}`} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Turn {index + 1}</p>
                        <p className="mt-3 text-sm font-semibold text-slate-900">{turn.question}</p>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{turn.answer}</p>
                      </div>
                    ))}
                  </div>

                  {(workflow?.interview?.report || interviewReport) && (
                    <div className="mt-6 rounded-[30px] border border-emerald-200 bg-emerald-50 p-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Invenia AI Analysis: Interview report</p>
                      <h4 className="mt-3 text-2xl font-semibold text-slate-900">
                        {(workflow?.interview?.report || interviewReport)?.decision || 'Review'}
                      </h4>
                      <p className="mt-3 text-sm leading-7 text-emerald-900/80">
                        {(workflow?.interview?.report || interviewReport)?.summary || 'The interview analysis will appear here after the final answer is submitted.'}
                      </p>
                    </div>
                  )}
                </section>
              )}

              {activeStage === 'completed' && (
                <section className="rounded-[32px] border border-emerald-200 bg-emerald-50 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Result ready</p>
                      <h3 className="mt-3 text-3xl font-semibold text-slate-900">Assessment completed successfully</h3>
                    </div>
                    <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 text-right shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Overall score</p>
                      <p className="mt-2 text-4xl font-semibold text-slate-900">{overallScore}%</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <TerminalMetric label="Job ATS" value={`${atsScore}%`} tone="text-blue-800" />
                    <TerminalMetric label="Match" value={`${workflow?.matchScore || 0}%`} tone="text-emerald-700" />
                    <TerminalMetric label="Coding" value={`${workflow?.coding?.score || 0}%`} tone="text-violet-700" />
                    <TerminalMetric label="Interview" value={`${workflow?.interview?.score || 0}%`} tone="text-amber-700" />
                  </div>

                  <div className="mt-6 grid gap-4 xl:grid-cols-[1.08fr,0.92fr]">
                    <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
                      <h4 className="text-xl font-semibold text-slate-900">Generated report</h4>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        {(workflow?.interview?.report || interviewReport)?.summary || 'The report is ready for recruiter-side review.'}
                      </p>
                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {[
                          ['Aptitude', `${workflow?.aptitude?.score || 0}/${workflow?.aptitude?.questions?.length || 0}`],
                          ['Technical', `${workflow?.technical?.score || 0}/${workflow?.technical?.questions?.length || 0}`],
                          ['Coding', workflow?.coding?.feedback || 'Awaiting recruiter review'],
                          ['Interview', workflow?.interview?.feedback || 'Awaiting recruiter review'],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
                            <p className="mt-2 text-sm text-slate-800">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
                      <h4 className="text-xl font-semibold text-slate-900">Secure session log</h4>
                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <p>Application ID: #{workflowSession?.applicationId}</p>
                        <p>Full-screen: {sessionStarted ? 'Enabled' : 'Not used'}</p>
                        <p>Camera access: {cameraGranted ? 'Granted' : 'Not active'}</p>
                        <p>Mic capture: {cameraAudioEnabled ? 'Enabled' : 'Not active'}</p>
                        <p>Proctoring warnings: {proctoring.warnings}</p>
                      </div>

                      {interviewRecordingUrl && (
                        <a
                          href={buildFileUrl(interviewRecordingUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-5 inline-flex rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800"
                        >
                          Open recording
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard/candidate')}
                      className="rounded-2xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white"
                    >
                      Back to dashboard
                    </button>
                    <button
                      type="button"
                      onClick={() => clearTerminalLock()}
                      className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
                    >
                      Clear local lock
                    </button>
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-6">
              <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Live summary</h3>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Stage</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{stageLabelMap[activeStage] || activeStage}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Candidate</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{workflow?.profile?.full_name || profile?.full_name || currentUser?.full_name || 'Candidate'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Current score</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{overallScore ? `${overallScore}%` : 'In progress'}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Assessment monitoring</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  The terminal tracks camera access, tab switching, and fullscreen focus while timed stages are active.
                </p>
                <div className="relative mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 shadow-sm">
                  <video ref={cameraVideoRef} autoPlay muted playsInline className="h-56 w-full object-cover" />
                  {interviewSnapshotUrl && (
                    <div className="absolute right-4 top-4 h-16 w-16 overflow-hidden rounded-full border-4 border-amber-300 bg-white shadow-xl">
                      <img src={interviewSnapshotUrl} alt="Captured verification" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                  <TerminalMetric label="Camera" value={cameraGranted ? 'Active' : 'Pending'} tone={cameraGranted ? 'text-emerald-700' : 'text-amber-700'} />
                  <TerminalMetric label="Mic" value={cameraAudioEnabled ? 'Active' : 'Pending'} tone={cameraAudioEnabled ? 'text-emerald-700' : 'text-amber-700'} />
                </div>
                <div className="mt-5 rounded-[26px] border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    <ExclamationTriangleIcon className="h-4 w-4 text-amber-600" />
                    Security notice
                  </div>
                  <p className="mt-3 leading-7">
                    Leaving fullscreen or closing this terminal will submit the current text and lock the browser attempt.
                  </p>
                </div>
              </section>

              <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">What happens next</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                    1. Profile review and cover letter gate
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                    2. Aptitude, technical, and coding stages follow recruiter settings
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                    3. AI interview asks three voice-driven questions with camera capture
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
      <TerminalBlockingLoader active={terminalLoaderActive} title={terminalLoaderTitle} message={terminalLoaderMessage} />
      <TerminalNoticeModal notice={noticeModal} onClose={closeTerminalNotice} />
      <ConfirmDialog confirmation={exitConfirmation} onCancel={() => setExitConfirmation(null)} onConfirm={confirmExitAttempt} />
    </div>
  );
}
