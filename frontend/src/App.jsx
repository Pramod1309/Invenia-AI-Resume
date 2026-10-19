import React, { lazy, Suspense, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SplashScreen from './components/SplashScreen';
import { GlobalNetworkIndicator, PageSkeleton } from './components/UXKit';
import CandidateLogin from './pages/CandidateLogin';
import RecruiterLogin from './pages/RecruiterLogin';

const CandidateSignUp = lazy(() => import('./pages/CandidateSignUp'));
const CandidateDashboard = lazy(() => import('./pages/CandidateDashboard'));
const CandidateJobApplyPage = lazy(() => import('./pages/CandidateJobApplyPage'));
const CandidateJobDetailsPage = lazy(() => import('./pages/CandidateJobDetailsPage'));
const CandidateSecureTerminal = lazy(() => import('./pages/CandidateSecureTerminal'));
const RecruiterDashboard = lazy(() => import('./pages/RecruiterDashboard'));
const RecruiterJobDetailsPage = lazy(() => import('./pages/RecruiterJobDetailsPage'));
const RecruiterJobFormPage = lazy(() => import('./pages/RecruiterJobFormPage'));

function App() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  return (
    <Router>
      <div className="App">
        <GlobalNetworkIndicator />
        {showSplash ? (
          <SplashScreen onComplete={handleSplashComplete} />
        ) : (
          <Suspense fallback={<PageSkeleton />}><Routes>
            <Route path="/" element={<CandidateLogin />} />
            <Route path="/login" element={<Navigate to="/login/candidate" replace />} />
            <Route path="/login/candidate" element={<CandidateLogin />} />
            <Route path="/login/recruiter" element={<RecruiterLogin />} />
            <Route path="/signup/candidate" element={<CandidateSignUp />} />
            <Route path="/dashboard/candidate" element={<CandidateDashboard />} />
            <Route path="/dashboard/candidate/jobs/:jobId" element={<CandidateJobDetailsPage />} />
            <Route path="/dashboard/candidate/jobs/:jobId/apply" element={<CandidateJobApplyPage />} />
            <Route path="/dashboard/candidate/secure-terminal/:jobId" element={<CandidateSecureTerminal />} />
            <Route path="/dashboard/recruiter" element={<RecruiterDashboard />} />
            <Route path="/dashboard/recruiter/jobs/new" element={<RecruiterJobFormPage />} />
            <Route path="/dashboard/recruiter/jobs/:jobId" element={<RecruiterJobDetailsPage />} />
            <Route path="/dashboard/recruiter/jobs/:jobId/edit" element={<RecruiterJobFormPage />} />
          </Routes></Suspense>
        )}
      </div>
    </Router>
  );
}

export default App;
