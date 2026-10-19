import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { authAPI } from '../services/api';

export default function CandidateSignUp() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordInput = useRef(null);
  const confirmPasswordInput = useRef(null);
  const emailInput = useRef(null);

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await authAPI.register({ name, email, password }, 'candidate');
      
      if (response.id) {
        navigate('/login/candidate', { state: { accountCreated: true } });
      } else {
        setError(response.message || 'Failed to create account');
      }
    } catch (error) {
      setError(error.response?.data?.detail || error.message || 'Failed to create account');
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
          className="mb-2.5 text-white text-base font-medium hover:text-gray-200 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 inline mr-2" />
          Back
        </button>
        <h1 className="text-3xl font-bold text-white text-center">Sign Up</h1>
      </div>

      {/* Form */}
      <div className="flex-1 bg-white rounded-t-[30px] rounded-t-none px-[30px] pt-10 pb-5 max-w-md mx-auto w-full md:flex-none md:rounded-3xl md:shadow-2xl md:shadow-black/20 md:border md:border-black/5">
        <form onSubmit={handleSignUp} className="space-y-6">
          {/* Name Input */}
          <div className="mb-4">
            <label className="block text-base font-semibold text-gray-800 mb-2">
              Name
            </label>
            <input
              type="text"
              placeholder="Enter your name"
              placeholderTextColor="#B0C4DE"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onSubmitEditing={() => emailInput?.current?.focus()}
              className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Email Input */}
          <div className="mb-4">
            <label className="block text-base font-semibold text-gray-800 mb-2">
              Email
            </label>
            <input
              ref={emailInput}
              type="email"
              placeholder="Enter your email"
              placeholderTextColor="#B0C4DE"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onSubmitEditing={() => passwordInput?.current?.focus()}
              className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Password Input */}
          <div className="mb-4">
            <label className="block text-base font-semibold text-gray-800 mb-2">
              Password
            </label>
            <div className="relative"><input
              ref={passwordInput}
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              placeholderTextColor="#B0C4DE"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onSubmitEditing={() => confirmPasswordInput?.current?.focus()}
              className="w-full border border-gray-300 rounded-xl px-4 py-4 pr-12 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide passwords' : 'Show passwords'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100">{showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}</button></div>
            <p className="mt-2 text-xs text-slate-500">Use at least 6 characters. A longer unique password is recommended.</p>
          </div>

          {/* Confirm Password Input */}
          <div className="mb-4">
            <label className="block text-base font-semibold text-gray-800 mb-2">
              Confirm Password
            </label>
            <input
              ref={confirmPasswordInput}
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              placeholderTextColor="#B0C4DE"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onSubmitEditing={handleSignUp}
              className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Sign Up Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-gray-800 py-[18px] rounded-xl text-white text-lg font-bold shadow-lg transition-all duration-200 ${
              loading ? 'opacity-60' : 'hover:bg-gray-700 active:scale-[0.98]'
            }`}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>

          {/* Login Link */}
          <div className="text-center mt-4">
            <span className="text-gray-600 text-sm">
              Already have an account?{' '}
              <Link 
                to="/login/candidate"
                className="text-gray-800 font-bold hover:text-gray-600"
              >
                Login
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
