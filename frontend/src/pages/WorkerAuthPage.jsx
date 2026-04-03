import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api.js';

export default function WorkerAuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'worker'
  });

  // Clear token on mount to ensure fresh auth
  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin
        ? '/api/v1/auth/login'
        : '/api/v1/auth/register';

      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : { ...formData, role: 'worker' };

      const response = await axios.post(endpoint, payload);

      // Prevent Cross-Portal Login
      if (isLogin && response.data.role !== 'worker') {
        setError('Access denied: Please use the Citizen portal to login.');
        setLoading(false);
        return;
      }
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('userName', response.data.name);
      localStorage.setItem('userRole', response.data.role);
      
      navigate('/worker-dashboard');
    } catch (err) {
      if (err.response && err.response.data && err.response.data.errors) {
        setError(err.response.data.errors[0].msg);
      } else if (err.response && err.response.data) {
        setError(err.response.data.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-4xl bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side: Branding / Imagry */}
        <div className="md:w-5/12 bg-gradient-to-br from-orange-600 to-orange-800 p-10 text-white flex flex-col justify-between relative overflow-hidden hidden md:flex">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-10 rounded-full blur-2xl -ml-10 -mb-10"></div>
          
          <div className="relative z-10">
            <h1 className="text-4xl font-extrabold tracking-tight mb-4">Worker Portal</h1>
            <p className="text-orange-100 text-lg leading-relaxed opacity-90">
              Oversee and coordinate waste management activities in your sector. Fast, reliable, and trackable.
            </p>
          </div>
          
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3 bg-white/10 p-3 rounded-lg backdrop-blur-sm border border-white/20">
              <span className="text-2xl">📊</span>
              <span className="font-semibold text-sm">Actionable Insights</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 p-3 rounded-lg backdrop-blur-sm border border-white/20">
              <span className="text-2xl">✅</span>
              <span className="font-semibold text-sm">Issue Resolution</span>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="md:w-7/12 p-8 md:p-12 lg:p-16 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto animate-slide-up">
            <div className="text-center md:text-left mb-8">
              <h2 className="text-3xl font-black text-gray-800 mb-2">
                Worker Login
              </h2>
              <p className="text-gray-500 font-medium">
                Enter your administrative credentials.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-md flex items-start gap-3">
                <span className="text-red-500">⚠️</span>
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">

              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-700">Official Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="admin@ecomanage.gov"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:bg-white outline-none transition-all duration-200 font-medium text-gray-800 shadow-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-700">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:bg-white outline-none transition-all duration-200 font-medium text-gray-800 shadow-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:-translate-y-0.5 transition-all duration-200 flex justify-center items-center gap-2 disabled:opacity-70 mt-4"
              >
                {loading ? 'Processing...' : 'Sign In as Worker'}
                {!loading && <span>→</span>}
              </button>
            </form>
            
          </div>
        </div>
      </div>
    </div>
  );
}
