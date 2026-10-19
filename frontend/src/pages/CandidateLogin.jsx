import React, { useState, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { authAPI } from '../services/api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
  || '130212797010-1537g33b5i3qjb3jru5v9c40qhod083c.apps.googleusercontent.com';

let googleIdentityPromise;

const loadGoogleIdentity = () => {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (googleIdentityPromise) return googleIdentityPromise;

  googleIdentityPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-invenia-google-identity]');
    const script = existingScript || document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.inveniaGoogleIdentity = 'true';
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Google sign-in could not be loaded'));
    if (!existingScript) document.head.appendChild(script);
  });

  return googleIdentityPromise;
};

export default function CandidateLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRecoveryHelp, setShowRecoveryHelp] = useState(false);
  const passwordInput = useRef(null);
  const emailInput = useRef(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await authAPI.login({ email, password }, 'candidate');
      
      if (response.access_token) {
        localStorage.setItem('access_token', response.access_token);
        navigate('/dashboard/candidate');
      } else {
        setError(response.message || 'Invalid email or password');
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      const google = await loadGoogleIdentity();
      if (!google?.accounts?.oauth2) throw new Error('Google sign-in is unavailable');

      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: async (tokenResponse) => {
          if (!tokenResponse?.access_token) {
            setError('Google did not return a valid sign-in session. Please try again.');
            setGoogleLoading(false);
            return;
          }

          try {
            const response = await authAPI.googleLogin(tokenResponse.access_token);
            localStorage.setItem('access_token', response.access_token);
            navigate('/dashboard/candidate');
          } catch (requestError) {
            setError(requestError.response?.data?.detail || 'Google sign-in failed. Please try again.');
            setGoogleLoading(false);
          }
        },
        error_callback: () => {
          setError('Google sign-in was cancelled or blocked. Allow pop-ups and try again.');
          setGoogleLoading(false);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (loadError) {
      setError(loadError.message || 'Google sign-in is unavailable. Please use email and password.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col md:items-center md:justify-center md:py-10">
      {/* Header */}
      <div className="pt-16 px-5 pb-5 max-w-md mx-auto w-full md:pt-0 md:px-0 md:pb-4">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">Candidate portal</p>
        <h1 className="mt-2 text-3xl font-bold text-white text-center">Welcome back</h1>
      </div>

      {/* Form */}
      <div className="flex-1 bg-white rounded-t-[30px] rounded-t-none px-[30px] pt-10 pb-5 max-w-md mx-auto w-full md:flex-none md:rounded-3xl md:shadow-2xl md:shadow-black/20 md:border md:border-black/5">
        <form onSubmit={handleLogin} className="space-y-6">
          {location.state?.accountCreated && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Account created successfully. Sign in to continue.</div>}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-4 text-base font-semibold text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
              <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z" />
              <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.38l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.77-5.61-4.14H3.04v2.61A10 10 0 0 0 12 22Z" />
              <path fill="#FBBC05" d="M6.39 13.91A6.02 6.02 0 0 1 6.07 12c0-.66.11-1.3.32-1.91V7.48H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.52l3.35-2.61Z" />
              <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.48l3.35 2.61C7.18 7.72 9.39 5.95 12 5.95Z" />
            </svg>
            {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-4 py-1">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">or use email</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Email Input */}
          <div className="mb-6">
            <label className="block text-base font-semibold text-gray-800 mb-2">
              Email
            </label>
            <input
              ref={emailInput}
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  passwordInput?.current?.focus();
                }
              }}
              className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Password Input */}
          <div className="mb-6">
            <label className="block text-base font-semibold text-gray-800 mb-2">
              Password
            </label>
            <div className="relative"><input
              ref={passwordInput}
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-4 pr-12 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100">{showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}</button></div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {typeof error === 'string' ? error : 'An error occurred. Please try again.'}
            </div>
          )}

          {/* Forgot Password */}
          <div className="text-center mb-8">
            <button
              type="button"
              onClick={() => setShowRecoveryHelp((value) => !value)}
              className="text-gray-800 text-sm font-medium hover:text-gray-600"
            >
              Forgot Password?
            </button>
            {showRecoveryHelp && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">Password reset is managed by the Invenia administrator. Contact your recruitment coordinator using your registered email address.</p>}
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading || googleLoading}
            className={`w-full bg-gray-800 py-[18px] rounded-xl text-white text-lg font-bold shadow-lg transition-all duration-200 ${
              loading ? 'opacity-60' : 'hover:bg-gray-700 active:scale-[0.98]'
            }`}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          {/* Sign Up Link */}
          <div className="text-center">
            <span className="text-gray-600 text-sm">
              Don't have an account?{' '}
              <Link 
                to="/signup/candidate"
                className="text-gray-800 font-bold hover:text-gray-600"
              >
                Sign Up
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
