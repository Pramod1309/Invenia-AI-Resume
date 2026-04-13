import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BriefcaseIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function RecruiterLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const passwordInput = useRef(null);
  const emailInput = useRef(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    console.log('Login button clicked');
    console.log('Form data:', { email, password });
    
    if (!email.trim() || !password.trim()) {
      console.log('Validation failed: Missing fields');
      setError('Please fill in all fields');
      return;
    }

    console.log('Validation passed, starting API call');
    setLoading(true);
    setError('');
    
    try {
      console.log('Calling API: api.users.login');
      // TODO: Implement actual API call
      const response = { success: true, data: { email, role: 'recruiter' } };
      console.log('API Response:', response);
      
      if (response.success) {
        console.log('Login successful');
        // onLoginSuccess(response.data);
        navigate('/dashboard/recruiter');
      } else {
        console.log('Login failed:', response.message);
        setError(response.message || 'Invalid email or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Invalid email or password');
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
        <h1 className="text-3xl font-bold text-white text-center">Login</h1>
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
              placeholderTextColor="#B0C4DE"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onSubmitEditing={() => passwordInput?.current?.focus()}
              className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>

          {/* Password Input */}
          <div className="mb-6">
            <label className="block text-base font-semibold text-gray-800 mb-2">
              Password
            </label>
            <input
              ref={passwordInput}
              type="password"
              placeholder="Enter your password"
              placeholderTextColor="#B0C4DE"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onSubmitEditing={handleLogin}
              className="w-full border border-gray-300 rounded-xl px-4 py-4 text-base bg-gray-50 focus:outline-none focus:ring-2 focus:ring-navy-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Forgot Password */}
          <div className="text-center mb-8">
            <button
              type="button"
              className="text-gray-800 text-sm font-medium hover:text-gray-600"
            >
              Forgot Password?
            </button>
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
