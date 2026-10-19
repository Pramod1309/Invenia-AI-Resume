import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { authAPI } from '../services/api';

export default function RecruiterLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
      const response = await authAPI.login({ email, password }, 'recruiter');
      
      if (response.access_token) {
        localStorage.setItem('access_token', response.access_token);
        navigate('/dashboard/recruiter');
      } else {
        setError(response.message || 'Invalid email or password');
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col md:items-center md:justify-center md:py-10">
      {/* Header */}
      <div className="pt-16 px-5 pb-5 max-w-md mx-auto w-full md:pt-0 md:px-0 md:pb-4">
        <button 
          onClick={() => navigate('/')} 
          className="mb-2.5 text-white text-base font-medium hover:text-purple-200 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 inline mr-2" />
          Back
        </button>
        <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">Recruiter workspace</p>
        <h1 className="mt-2 text-3xl font-bold text-white text-center">Welcome back</h1>
      </div>

      {/* Form */}
      <div className="flex-1 bg-white rounded-t-[30px] rounded-t-none px-[30px] pt-10 pb-5 max-w-md mx-auto w-full md:flex-none md:rounded-3xl md:shadow-2xl md:shadow-black/20 md:border md:border-black/5">
        <form onSubmit={handleLogin} className="space-y-6">
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
              className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
            {showRecoveryHelp && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">Password reset is managed by your organisation administrator. Contact them using your registered work email.</p>}
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-gray-800 py-[18px] rounded-xl text-white text-lg font-bold shadow-lg transition-all duration-200 ${
              loading ? 'opacity-60' : 'hover:bg-gray-700 active:scale-[0.98]'
            }`}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          {/* Divider */}
          <div className="flex items-center my-8">
            <div className="flex-1 h-px bg-gray-300"></div>
            <span className="px-4 text-gray-500 text-sm"></span>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>

          
        </form>
      </div>
    </div>
  );
}
