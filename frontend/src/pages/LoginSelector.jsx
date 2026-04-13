import React from 'react';
import { Link } from 'react-router-dom';
import { UserGroupIcon, BriefcaseIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const LoginSelector = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-blue to-invenia-blue flex items-center justify-center px-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">Welcome to Invenia AI</h1>
          <p className="text-xl text-gray-300">Choose your login path</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Candidate Login Card */}
          <Link 
            to="/login/candidate"
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105 block group"
          >
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="bg-blue-500 p-4 rounded-full group-hover:bg-blue-600 transition-colors duration-300">
                  <UserGroupIcon className="h-12 w-12 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Candidate</h2>
              <p className="text-gray-300 mb-6">
                Apply for jobs, track applications, and manage your profile
              </p>
              <div className="flex items-center justify-center text-white group-hover:text-blue-200 transition-colors duration-300">
                <span>Go to Candidate Login</span>
                <ArrowRightIcon className="h-5 w-5 ml-2" />
              </div>
            </div>
          </Link>

          {/* Recruiter Login Card */}
          <Link 
            to="/login/recruiter"
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105 block group"
          >
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="bg-purple-600 p-4 rounded-full group-hover:bg-purple-700 transition-colors duration-300">
                  <BriefcaseIcon className="h-12 w-12 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Recruiter</h2>
              <p className="text-gray-300 mb-6">
                Post jobs, screen candidates, and manage hiring process
              </p>
              <div className="flex items-center justify-center text-white group-hover:text-purple-200 transition-colors duration-300">
                <span>Go to Recruiter Login</span>
                <ArrowRightIcon className="h-5 w-5 ml-2" />
              </div>
            </div>
          </Link>
        </div>

        
      </div>
    </div>
  );
};

export default LoginSelector;
