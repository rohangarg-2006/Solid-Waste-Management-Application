import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CitizenAuthPage from './pages/CitizenAuthPage';
import ManagerAuthPage from './pages/ManagerAuthPage';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import WorkerAuthPage from './pages/WorkerAuthPage';
import WorkerDashboard from './pages/WorkerDashboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen font-sans text-gray-800 bg-eco-bg flex flex-col relative overflow-hidden">
        
        {/* Decorative background blobs */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-eco-200 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob pointer-events-none z-0"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-earth-100 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob animation-delay-2000 pointer-events-none z-0"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-eco-100 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob animation-delay-4000 pointer-events-none z-0"></div>

        {/* Global Navigation */}
        <nav className="relative z-50 bg-gradient-to-r from-emerald-950 via-green-900 to-teal-950 text-white sticky top-0 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.5)] border-b border-emerald-800/50 transition-all py-3">
          <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
            <Link to="/" className="flex items-center gap-3 cursor-pointer transition-transform hover:opacity-90 active:scale-95 group">
              <div className="bg-gradient-to-br from-emerald-400 to-green-500 w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/20 text-xl group-hover:rotate-12 transition-all duration-300">
                ♻️
              </div>
              <span className="text-2xl font-black tracking-tight text-white drop-shadow-sm">
                EcoManage
              </span>
            </Link>
            <div className="hidden sm:flex items-center gap-3 bg-emerald-950/40 backdrop-blur-sm px-5 py-2 rounded-xl border border-emerald-700/50 shadow-inner">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
              </span>
              <span className="text-xs font-black uppercase tracking-[0.15em] text-emerald-50">
                Solid Waste Management System
              </span>
            </div>
          </div>
        </nav>

        {/* Main Routed Content */}
        <main className="flex-1 relative z-10 w-full flex flex-col">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login/citizen" element={<CitizenAuthPage />} />
            <Route path="/login/manager" element={<ManagerAuthPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/login/worker" element={<WorkerAuthPage />} />
            <Route path="/worker-dashboard" element={<WorkerDashboard />} />
          </Routes>
        </main>
        
        {/* Subtle global footer */}
        <footer className="relative z-10 text-center py-6 text-sm text-gray-400 font-medium">
          &copy; {new Date().getFullYear()} EcoManage Platform. All rights reserved.
        </footer>
      </div>
    </Router>
  );
}

export default App;
