import axios from 'axios';

const envBackendUrl = (import.meta.env.VITE_BACKEND_URL || '').trim().replace(/\/+$/, '');
const defaultBackendUrl = import.meta.env.PROD ? window.location.origin : 'http://localhost:8000';

export const BACKEND_URL = envBackendUrl || defaultBackendUrl;
export const API_BASE_URL = envBackendUrl
  ? `${envBackendUrl}/api`
  : import.meta.env.PROD
    ? '/api'
    : `${defaultBackendUrl}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let trackedRequestCount = 0;
const reportNetworkActivity = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('invenia:network-activity', { detail: { count: trackedRequestCount } }));
  }
};

const finishTrackedRequest = (config) => {
  if (!config?.inveniaTrackedRequest) return;
  config.inveniaTrackedRequest = false;
  trackedRequestCount = Math.max(0, trackedRequestCount - 1);
  reportNetworkActivity();
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.showGlobalLoader !== false) {
      config.inveniaTrackedRequest = true;
      trackedRequestCount += 1;
      reportNetworkActivity();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    finishTrackedRequest(response.config);
    return response;
  },
  (error) => {
    finishTrackedRequest(error.config);
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const buildFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${BACKEND_URL}${path}`;
};

export const openPreparedPreviewWindow = (title = 'Opening preview...') => {
  const previewWindow = window.open('', '_blank');
  if (previewWindow) {
    previewWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background: #f8fafc;
              color: #0f172a;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            .card {
              border: 1px solid #dbeafe;
              border-radius: 24px;
              padding: 24px 28px;
              background: white;
              box-shadow: 0 20px 60px rgba(15, 23, 42, 0.10);
            }
          </style>
        </head>
        <body><div class="card">Preparing secure preview...</div></body>
      </html>
    `);
    previewWindow.document.close();
  }
  return previewWindow;
};

export const openBlobResponse = (response, preparedWindow = null) => {
  const blobUrl = URL.createObjectURL(response.data);
  const opened = preparedWindow && !preparedWindow.closed
    ? preparedWindow
    : window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (opened && preparedWindow) {
    opened.location.href = blobUrl;
    opened.focus?.();
  }
  if (!opened) {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};

export const downloadBlobResponse = (response, filename = 'invenia-file') => {
  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};

export const authAPI = {
  login: async (credentials, userType) => {
    const params = new URLSearchParams();
    params.append('username', credentials.email);
    params.append('password', credentials.password);
    params.append('user_type', userType);

    const response = await api.post('/auth/login', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  register: async (userData, userType) => {
    const response = await api.post('/auth/register', {
      email: userData.email,
      username: userData.username || userData.email,
      full_name: userData.full_name || userData.name,
      password: userData.password,
      role: userType,
    });
    return response.data;
  },

  googleLogin: async (accessToken) => {
    const response = await api.post('/auth/oauth/google', {
      provider: 'google',
      access_token: accessToken,
    });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export const candidateAPI = {
  getOverview: async () => {
    const response = await api.get('/dashboard/candidate/overview');
    return response.data;
  },

  getJobs: async (search = '', filterType = 'all') => {
    const response = await api.get('/dashboard/candidate/jobs', {
      params: {
        search: search || undefined,
        filter_type: filterType,
      },
    });
    return response.data;
  },

  getJob: async (jobId) => {
    const response = await api.get(`/dashboard/candidate/jobs/${jobId}`);
    return response.data;
  },

  getJobWorkflowPreview: async (jobId) => {
    const response = await api.get(`/dashboard/candidate/jobs/${jobId}/application-workflow`);
    return response.data;
  },

  trackJobView: async (jobId) => {
    const response = await api.post(`/dashboard/candidate/jobs/${jobId}/view`);
    return response.data;
  },

  applyToJob: async (jobId, coverLetter = '') => {
    const response = await api.post('/dashboard/candidate/apply', {
      job_id: jobId,
      cover_letter: coverLetter,
    });
    return response.data;
  },

  saveJob: async (jobId) => {
    const response = await api.post('/dashboard/candidate/save-job', {
      job_id: jobId,
    });
    return response.data;
  },

  getApplications: async () => {
    const response = await api.get('/dashboard/candidate/applications');
    return response.data;
  },

  revokeApplication: async (applicationId) => {
    const response = await api.post(`/dashboard/candidate/applications/${applicationId}/revoke`);
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/dashboard/candidate/profile');
    return response.data;
  },

  checkATSScore: async () => {
    const response = await api.post('/dashboard/candidate/profile/ats');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/dashboard/candidate/profile', profileData);
    return response.data;
  },

  uploadResume: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/dashboard/candidate/upload-resume', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  uploadPhoto: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/dashboard/candidate/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  autofillProfile: async ({ file, text = '' }) => {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    if (text) {
      formData.append('text', text);
    }
    const response = await api.post('/dashboard/candidate/profile/autofill', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getResume: async () => {
    const response = await api.get('/dashboard/candidate/resume', {
      responseType: 'blob',
      validateStatus: (status) => status < 500,
    });
    return response;
  },

  getApplicationResume: async (applicationId) => {
    const response = await api.get(`/dashboard/candidate/applications/${applicationId}/resume`, {
      responseType: 'blob',
      validateStatus: (status) => status < 500,
    });
    return response;
  },

  getApplicationWorkflow: async (applicationId) => {
    const response = await api.get(`/dashboard/candidate/applications/${applicationId}/workflow`);
    return response.data;
  },

  submitWorkflowStage: async (applicationId, payload) => {
    const response = await api.post(`/dashboard/candidate/applications/${applicationId}/workflow-stage`, payload);
    return response.data;
  },

  uploadInterviewRecording: async (applicationId, formData) => {
    const response = await api.post(`/dashboard/candidate/applications/${applicationId}/interview-recording`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export const recruiterAPI = {
  getOverview: async () => {
    const response = await api.get('/dashboard/recruiter/overview');
    return response.data;
  },

  getJobs: async (search = '') => {
    const response = await api.get('/dashboard/recruiter/jobs', {
      params: {
        search: search || undefined,
      },
    });
    return response.data;
  },

  getJob: async (jobId) => {
    const response = await api.get(`/dashboard/recruiter/jobs/${jobId}`);
    return response.data;
  },

  autofillJob: async ({ file, text = '' }) => {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    if (text) {
      formData.append('text', text);
    }
    const response = await api.post('/dashboard/recruiter/jobs/autofill', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  createJob: async (jobData) => {
    const response = await api.post('/dashboard/recruiter/jobs', jobData);
    return response.data;
  },

  updateJob: async (jobId, jobData) => {
    const response = await api.put(`/dashboard/recruiter/jobs/${jobId}`, jobData);
    return response.data;
  },

  deleteJob: async (jobId) => {
    const response = await api.delete(`/dashboard/recruiter/jobs/${jobId}`);
    return response.data;
  },

  getApplications: async () => {
    const response = await api.get('/dashboard/recruiter/applications');
    return response.data;
  },

  updateApplicationStatus: async (applicationId, status) => {
    const response = await api.put(`/dashboard/recruiter/applications/${applicationId}`, {
      status,
    });
    return response.data;
  },

  getApplicationResume: async (applicationId) => {
    const response = await api.get(`/dashboard/recruiter/applications/${applicationId}/resume`, {
      responseType: 'blob',
      validateStatus: (status) => status < 500,
    });
    return response;
  },

  getCandidateResume: async (candidateId) => {
    const response = await api.get(`/dashboard/recruiter/candidates/${candidateId}/resume`, {
      responseType: 'blob',
      validateStatus: (status) => status < 500,
    });
    return response;
  },

  getInterviewRecording: async (applicationId) => {
    const response = await api.get(`/dashboard/recruiter/applications/${applicationId}/interview-recording`, {
      responseType: 'blob',
      validateStatus: (status) => status < 500,
    });
    return response;
  },

  getInterviewSnapshot: async (applicationId) => {
    const response = await api.get(`/dashboard/recruiter/applications/${applicationId}/interview-snapshot`, {
      responseType: 'blob',
      validateStatus: (status) => status < 500,
    });
    return response;
  },

  getCandidates: async (search = '', status = 'all') => {
    const response = await api.get('/dashboard/recruiter/candidates', {
      params: {
        search: search || undefined,
        status,
      },
    });
    return response.data;
  },

  updateCandidateAccess: async (candidateId, isActive) => {
    const response = await api.patch(`/dashboard/recruiter/candidates/${candidateId}/access`, {
      is_active: isActive,
    });
    return response.data;
  },

  deleteCandidate: async (candidateId) => {
    const response = await api.delete(`/dashboard/recruiter/candidates/${candidateId}`);
    return response.data;
  },

  getInterviews: async () => {
    const response = await api.get('/dashboard/recruiter/interviews');
    return response.data;
  },

  scheduleInterview: async (interviewData) => {
    const response = await api.post('/dashboard/recruiter/interviews', interviewData);
    return response.data;
  },

  updateInterview: async (interviewId, interviewData) => {
    const response = await api.put(`/dashboard/recruiter/interviews/${interviewId}`, interviewData);
    return response.data;
  },

  getAnalytics: async (period = 'week') => {
    const response = await api.get('/dashboard/recruiter/analytics', {
      params: { period },
    });
    return response.data;
  },

  downloadExport: async (exportType) => {
    const response = await api.get(`/dashboard/recruiter/export/${exportType}`, {
      responseType: 'blob',
    });
    return response;
  },

  getProfile: async () => {
    const response = await api.get('/dashboard/recruiter/profile');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/dashboard/recruiter/profile', profileData);
    return response.data;
  },

  uploadPhoto: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/dashboard/recruiter/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getRecruiters: async () => {
    const response = await api.get('/recruiters/manage/list');
    return response.data;
  },

  createRecruiter: async (recruiterData) => {
    const response = await api.post('/recruiters/manage', recruiterData);
    return response.data;
  },

  updateRecruiterAccess: async (userId, isActive) => {
    const response = await api.patch(`/recruiters/manage/${userId}/access`, {
      is_active: isActive,
    });
    return response.data;
  },
};

export const testAPI = {
  healthCheck: async () => {
    const response = await axios.get(`${BACKEND_URL}/health`);
    return response.data;
  },

  initDatabase: async () => {
    const response = await api.post('/init-db');
    return response.data;
  },
};

export default api;
