import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SplashScreen from './components/SplashScreen';
import LoginSelector from './pages/LoginSelector';
import CandidateLogin from './pages/CandidateLogin';
import RecruiterLogin from './pages/RecruiterLogin';
import CandidateSignUp from './pages/CandidateSignUp';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  return (
    <Router>
      <div className="App">
        {showSplash ? (
          <SplashScreen onComplete={handleSplashComplete} />
        ) : (
          <Routes>
            <Route path="/" element={<LoginSelector />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/login/candidate" element={<CandidateLogin />} />
            <Route path="/login/recruiter" element={<RecruiterLogin />} />
            <Route path="/signup/candidate" element={<CandidateSignUp />} />
            <Route path="/dashboard/candidate" element={<div>Candidate Dashboard</div>} />
            <Route path="/dashboard/recruiter" element={<div>Recruiter Dashboard</div>} />
          </Routes>
        )}
      </div>
    </Router>
  );
}

export default App;
