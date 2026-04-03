import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');
    if (token && role) {
      setIsLoggedIn(true);
      setUserRole(role);
    }
  }, []);

  const handleDashboardRedirect = () => {
    if (userRole === 'manager') navigate('/admin-dashboard');
    else if (userRole === 'worker') navigate('/worker-dashboard');
    else navigate('/dashboard');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in relative z-10 w-full max-w-7xl mx-auto">
      
      {/* Hero Section */}
      <div className="text-center max-w-3xl mb-12 mt-8">
        <div className="inline-block bg-green-100 text-green-800 text-sm font-bold px-3 py-1 rounded-full mb-4 shadow-sm border border-green-200">
          Smart City Initiative
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 tracking-tight">
          Smarter Waste Management for a <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-green-700">Greener Tomorrow</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 leading-relaxed">
          Report, track, and resolve solid waste issues systematically. Join our platform to make your community cleaner and healthier.
        </p>

        {/* Login Role Selection Buttons or Dashboard Redirect */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {isLoggedIn ? (
            <button
              onClick={handleDashboardRedirect}
              className="w-full sm:w-auto px-10 py-5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3 text-lg"
            >
              <span className="text-2xl">🚀</span>
              Go to Dashboard
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/login/citizen')}
                className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-green-500 text-green-700 hover:bg-green-50 font-bold rounded-xl shadow-sm hover:shadow-md transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
              >
                <span className="text-xl">👤</span>
                Login as Citizen
              </button>

              <button
                onClick={() => navigate('/login/manager')}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-xl shadow-[0_4px_14px_0_rgba(34,197,94,0.39)] hover:shadow-[0_6px_20px_rgba(34,197,94,0.23)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
              >
                <span className="text-xl">🛡️</span>
                Login as Manager
              </button>

              <button
                onClick={() => navigate('/login/worker')}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-[0_4px_14px_0_rgba(249,115,22,0.39)] hover:shadow-[0_6px_20px_rgba(249,115,22,0.23)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
              >
                <span className="text-xl">👷</span>
                Login as Worker
              </button>
            </>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 mb-16">
        
        {/* Feature 1 */}
        <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-3xl mb-6">
            📍
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-3">Live Reporting</h3>
          <p className="text-gray-600">
            Easily report a waste issue with precise locations and detailed categories. It's instantly forwarded to the local management authorities.
          </p>
        </div>

        {/* Feature 2 */}
        <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="w-14 h-14 bg-green-100 text-green-600 rounded-xl flex items-center justify-center text-3xl mb-6">
            ⚡
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-3">Real-Time Tracking</h3>
          <p className="text-gray-600">
            Watch the status of your reported requests change from Pending to Dispatched and Resolved in real-time.
          </p>
        </div>

        {/* Feature 3 */}
        <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-3xl mb-6">
            📊
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-3">Manager Dashboard</h3>
          <p className="text-gray-600">
            Dedicated portal for managers to oversee requests, update service status, and ensure the community is kept clean systematically.
          </p>
        </div>

      </div>

    </div>
  );
}
