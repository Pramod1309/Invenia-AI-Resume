import React, { useEffect, useState } from 'react';
import inveniaLogo from '../assets/Invenia India Logo.png';

const SplashScreen = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onComplete();
      }, 350);
    }, 2600);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 bg-navy-blue flex items-center justify-center z-50 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="text-center">
        <div className="animate-fade-in">
          <img
            src={inveniaLogo}
            alt="Invenia India Logo"
            className="w-32 h-32 md:w-48 md:h-48 mx-auto mb-6 animate-fade-in object-contain"
            style={{ animationDelay: '200ms' }}
          />
          <h1 className="text-6xl md:text-8xl font-bold text-white mb-4 animate-pulse-slow">
            Invenia
          </h1>
          <h2 className="text-4xl md:text-6xl font-bold text-white animate-slide-up">
            AI
          </h2>
        </div>
        <div className="mt-8 flex justify-center space-x-2">
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
