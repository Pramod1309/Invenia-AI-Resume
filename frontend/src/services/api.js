import axios from 'axios';

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
export const API_BASE_URL = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
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

  getProfile: async () => {
    const response = await api.get('/dashboard/candidate/profile');
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

  getCandidates: async (search = '', status = 'all') => {
    const response = await api.get('/dashboard/recruiter/candidates', {
      params: {
        search: search || undefined,
        status,
      },
    });
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

  getProfile: async () => {
    const response = await api.get('/dashboard/recruiter/profile');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/dashboard/recruiter/profile', profileData);
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
