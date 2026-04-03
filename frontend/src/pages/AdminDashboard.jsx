import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api.js';
import { indiaData } from '../utils/indiaData';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit'
  });
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [currentView, setCurrentView] = useState('requests'); // 'requests', 'location', 'category', 'users'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotificationsModal, setShowAllNotificationsModal] = useState(false);
  const [seenNotificationsCount, setSeenNotificationsCount] = useState(() => {
    return parseInt(localStorage.getItem('seenNotificationsCount') || '0');
  });

  const notificationRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Chart filter states
  const [chartFilter, setChartFilter] = useState({ type: null, value: null });

  // Location view states
  const [locationState, setLocationState] = useState('');
  const [locationDistricts, setLocationDistricts] = useState(['ALL']);

  const handleLocationStateChange = (e) => {
    setLocationState(e.target.value);
    setLocationDistricts(['ALL']);
  };

  const handleLocationDistrictChange = (e) => {
    const options = e.target.options;
    const selected = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selected.push(options[i].value);
      }
    }
    
    if (selected.includes('ALL') && !locationDistricts.includes('ALL')) {
      setLocationDistricts(['ALL']);
    } else if (selected.includes('ALL') && selected.length > 1) {
      setLocationDistricts(selected.filter(val => val !== 'ALL'));
    } else {
      setLocationDistricts(selected.length === 0 ? ['ALL'] : selected);
    }
  };

  // Filter requests based on location view choices
  const filteredLocationRequests = requests.filter(req => {
    if (!locationState) return false;
    const parts = req.location ? req.location.split(',').map(p => p.trim()) : [];
    const reqState = parts.length >= 3 ? parts[parts.length - 1] : '';
    const reqDistrict = parts.length >= 3 ? parts[parts.length - 2] : '';
    
    if (reqState !== locationState) return false;
    if (locationDistricts.includes('ALL')) return true;
    return locationDistricts.includes(reqDistrict);
  });
  
  // Track which requests have their images expanded
  const [expandedImages, setExpandedImages] = useState({});
  const [imageUrls, setImageUrls] = useState({});
  const [resolvedImageUrls, setResolvedImageUrls] = useState({});
  const [loadingImages, setLoadingImages] = useState({});

  // Toggle image visibility for a specific request
  const toggleImage = async (req) => {
    const requestId = req._id;
    if (expandedImages[requestId]) {
      setExpandedImages(prev => ({
        ...prev,
        [requestId]: false
      }));
      return;
    }

    if ((!imageUrls[requestId] && req.hasImage) || (!resolvedImageUrls[requestId] && req.hasResolvedImage)) {
      try {
        setLoadingImages(prev => ({ ...prev, [requestId]: true }));
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const res = await axios.get(`/api/v1/requests/${requestId}`, config);
        
        if (res.data.data.image) {
          setImageUrls(prev => ({ ...prev, [requestId]: res.data.data.image }));
        }
        if (res.data.data.resolvedImage) {
          setResolvedImageUrls(prev => ({ ...prev, [requestId]: res.data.data.resolvedImage }));
        }
      } catch (err) {
        console.error("Failed to load image");
      } finally {
        setLoadingImages(prev => ({ ...prev, [requestId]: false }));
      }
    }
    
    setExpandedImages(prev => ({
      ...prev,
      [requestId]: !prev[requestId]
    }));
  };
  
  // Get user details from localStorage
  const userName = localStorage.getItem('userName') || 'User';

  // For stylish delete confirmation popup
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, requestId: null });

  // Fetch data as soon as the dashboard loads
  useEffect(() => {
    const fetchRequests = async () => {
      const token = localStorage.getItem('token');
      const userRole = localStorage.getItem('userRole');

      // If no token or not an admin/manager, kick back
      if (!token || userRole !== 'manager') {
        navigate(userRole === 'citizen' ? '/dashboard' : '/');
        return;
      }

      try {
        const config = {
          headers: { Authorization: `Bearer ${token}` }
        };
        
        const response = await axios.get('/api/v1/requests', config);
        setRequests(response.data.data);
          
          const userResponse = await axios.get('/api/v1/users', config);
          setUsers(userResponse.data.data);
      } catch (err) {
        setError('Failed to fetch requests. Please log in again.');
        localStorage.removeItem('token');
        navigate('/');
      }
    };

    fetchRequests();
  }, [navigate]);

  // Update a Waste Request Status (Manager Only)
  const updateStatus = async (id, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      await axios.put(`/api/v1/requests/${id}`, { status: newStatus }, config);
      
      // Update the local state to match the new status
      setRequests(requests.map(req => req._id === id ? { ...req, status: newStatus } : req));
      setSuccess('Request status updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  // Delete a Waste Request (Citizen or Manager)
  const confirmDelete = (id) => {
    setDeleteConfirmation({ isOpen: true, requestId: id });
  };
  
  const proceedWithDeletion = async () => {
    const id = deleteConfirmation.requestId;
    setDeleteConfirmation({ isOpen: false, requestId: null });
    
    try {
      const token = localStorage.getItem('token');
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      await axios.delete(`/api/v1/requests/${id}`, config);
      
      // Remove the deleted request from the local state
      setRequests(requests.filter(req => req._id !== id));
      setSuccess('Request deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete request');
    }
  };

  // Toggle user role between manager and citizen
const toggleUserRole = async (userId, newRole) => {
    try {
      const token = localStorage.getItem('token');
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      const response = await axios.put(
        `/api/v1/users/${userId}/role`,
        { role: newRole },
        config
      );
      
      // Update local state
      setUsers(users.map(user => 
        user._id === userId ? { ...user, role: response.data.data.role } : user
      ));
      
      setSuccess(`User role updated to ${response.data.data.role}!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user role');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Logout User
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    navigate('/');
  };

  // Derive notifications from requests
  const notifications = [];
  const now = new Date().getTime();
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  const ONE_DAY = 24 * 60 * 60 * 1000;

  requests.forEach(req => {
    const createdTime = new Date(req.createdAt).getTime();
    const timeDiff = now - createdTime;

    if (req.status === 'Pending' && timeDiff > TWO_DAYS) {
      notifications.push({
        id: `urgent-${req._id}`,
        type: 'urgent',
        title: 'Action Required',
        message: `Request in ${req.location || 'unknown location'} has been pending for over 2 days.`,
        time: req.createdAt,
      });
    } else if (timeDiff < ONE_DAY) {
      notifications.push({
        id: `new-${req._id}`,
        type: 'new',
        title: 'New Request',
        message: `New request submitted by ${req.citizenId?.name || 'a citizen'}.`,
        time: req.createdAt,
      });
    }
  });

  notifications.sort((a, b) => new Date(b.time) - new Date(a.time));
  
  const unreadCount = Math.max(0, notifications.length - seenNotificationsCount);
  const displayNotifications = notifications.slice(0, 5);

  const handleOpenNotifications = () => {
    const newShow = !showNotifications;
    setShowNotifications(newShow);
    if (newShow) {
      setSeenNotificationsCount(notifications.length);
      localStorage.setItem('seenNotificationsCount', notifications.length.toString());
    }
  };

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === "Pending").length,
    dispatched: requests.filter(r => r.status === "Dispatched").length,
    resolved: requests.filter(r => r.status === "Resolved").length,
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] font-sans">
      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5 text-red-500 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">Delete Request?</h3>
            <p className="text-center text-gray-500 mb-8 font-medium">This action cannot be undone. All data related to this waste report will be permanently removed.</p>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setDeleteConfirmation({ isOpen: false, requestId: null })}
                className="flex-1 px-5 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-bold hover:bg-gray-50 hover:border-gray-300 transition-all font-sans"
              >
                Cancel
              </button>
              <button 
                onClick={proceedWithDeletion}
                className="flex-1 px-5 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-[0_4px_14px_0_rgba(239,68,68,0.39)] transition-all font-sans"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Notifications Modal */}
      {showAllNotificationsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-xl shadow-sm">
                  🔔
                </div>
                <h3 className="text-xl font-bold text-gray-800">All Notifications</h3>
              </div>
              <button 
                onClick={() => setShowAllNotificationsModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="overflow-y-auto p-2 flex-1 custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                  <span className="text-5xl mb-4 opacity-30">📭</span>
                  <p className="text-lg font-bold text-gray-700">No notifications history</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map(notif => (
                    <div key={notif.id} className="p-5 hover:bg-gray-50 transition-colors cursor-default rounded-xl mx-2 my-1">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 mt-1">
                          {notif.type === 'urgent' ? (
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shadow-sm border border-red-200">⚠️</div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm border border-blue-200">🆕</div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <p className={`text-base font-bold ${notif.type === 'urgent' ? 'text-red-700' : 'text-gray-900'}`}>
                              {notif.title}
                            </p>
                            <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">
                              {formatDate(notif.time)}
                            </span>
                          </div>
                          <p className="text-gray-600 leading-relaxed text-sm">{notif.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-end">
               <button 
                onClick={() => setShowAllNotificationsModal(false)}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-sm"
               >
                 Close
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Sleek Navigation Bar */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-indigo-100 shadow-[0_4px_30px_rgba(79,70,229,0.06)] sticky top-0 z-[100] transition-all text-gray-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 w-12 h-12 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-indigo-200/50 transform hover:scale-105 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-800 to-indigo-500 tracking-tight">Admin Portal</h1>
              <p className="text-sm font-bold text-gray-400 capitalize flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                EcoManage System
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden sm:block text-right">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-500">Welcome,</p>
                <p className="text-base font-bold text-gray-800 capitalize">{userName}</p>
                <span className="px-2 py-0.5 text-[10px] rounded-md font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 uppercase tracking-wider">
                  Admin
                </span>
              </div>
            </div>
            
            {/* Notifications Dropdown */}
            <div className="relative" ref={notificationRef}>
            <button 
              onClick={handleOpenNotifications}
              className="relative p-2.5 text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl shadow-sm transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 transform translate-x-1/3 -translate-y-1/3 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-gray-100 z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-bold text-gray-800">Notifications</h3>
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount} New</span>
                </div>
                <div className="max-h-[350px] overflow-y-auto w-full">
                  {displayNotifications.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-sm">
                      <span className="block text-3xl mb-2 opacity-50">📭</span>
                      No new notifications
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {displayNotifications.map(notif => (
                        <div key={notif.id} className="p-4 hover:bg-gray-50 transition-colors cursor-default">
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {notif.type === 'urgent' ? (
                                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-sm">⚠️</div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm">🆕</div>
                              )}
                            </div>
                            <div>
                              <p className={`text-sm font-bold ${notif.type === 'urgent' ? 'text-red-700' : 'text-gray-800'}`}>
                                {notif.title}
                              </p>
                              <p className="text-sm text-gray-600 mt-0.5 leading-snug">{notif.message}</p>
                              <p className="text-xs text-gray-400 mt-2 font-medium">{formatDate(notif.time)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {notifications.length > 5 && (
                  <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
                    <button 
                      onClick={() => {
                        setShowNotifications(false);
                        setShowAllNotificationsModal(true);
                      }}
                      className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      View all {notifications.length} notifications →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={handleLogout} className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold px-5 py-2.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-sm border border-transparent hover:border-red-200 group">
            <span className="hidden sm:inline">Logout</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 lg:p-10 relative overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-300/10 rounded-full blur-[120px] -mr-[200px] -mt-[200px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-200/10 rounded-full blur-[100px] -ml-[150px] -mb-[150px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10 w-full animate-fade-in">
          {/* Notifications */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 rounded-r-2xl flex items-center shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <p className="text-red-700 font-medium">{error}</p>
                <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-8 rounded-r-2xl flex items-center shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-green-700 font-medium">{success}</p>
                <button onClick={() => setSuccess('')} className="ml-auto text-green-400 hover:text-green-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-8 w-full">
        {/* Sidebar */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-24">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-3">Menu</h3>
            <ul className="space-y-2">
              <li>
                <button 
                  onClick={() => setCurrentView('requests')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${currentView === 'requests' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <span className="text-xl">📋</span> All Requests
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setCurrentView('location')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${currentView === 'location' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <span className="text-xl">📍</span> By Location
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setCurrentView('category')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${currentView === 'category' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <span className="text-xl">♻️</span> By Category
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setCurrentView('users')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${currentView === 'users' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <span className="text-xl">👥</span> Users
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {currentView === 'requests' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total Reports', filterKey: 'All', value: stats.total, color: 'text-gray-900', bg: 'bg-white', icon: '📝', iconColor: 'bg-gray-100' },
                  { label: 'Pending', filterKey: 'Pending', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50', icon: '⏳', iconColor: 'bg-amber-100' },
                  { label: 'Dispatched', filterKey: 'Dispatched', value: stats.dispatched, color: 'text-blue-600', bg: 'bg-blue-50', icon: '🚚', iconColor: 'bg-blue-100' },
                  { label: 'Resolved', filterKey: 'Resolved', value: stats.resolved, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: '✨', iconColor: 'bg-emerald-100' }
                ].map((stat, i) => (
                  <div 
                      key={i} 
                      onClick={() => setFilterStatus(stat.filterKey)}
                      className={`p-6 rounded-3xl border cursor-pointer transition-all ${filterStatus === stat.filterKey ? 'ring-2 ring-indigo-500 shadow-md scale-[1.02]' : 'border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1'} ${stat.bg} group`}
                  >
                      <div className="flex justify-between items-start">
                        <div>
                            <p className="text-gray-500 text-sm font-bold mb-1">{stat.label}</p>
                            <h4 className={`text-4xl font-black ${stat.color}`}>{stat.value}</h4>
                        </div>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${stat.iconColor} group-hover:scale-110 transition-transform`}>
                            {stat.icon}
                        </div>
                      </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-gray-900">
                  {filterStatus === 'All' ? 'All Reports' : `${filterStatus} Reports`}
                </h3>
                <span className="bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-bold">
                  {requests.filter(r => filterStatus === 'All' ? true : r.status === filterStatus).length} found
                </span>
              </div>

              {requests.filter(r => filterStatus === 'All' ? true : r.status === filterStatus).length === 0 ? (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center">        
                  <span className="text-5xl mb-4 opacity-50">🍃</span>
                  <h3 className="text-xl font-bold text-gray-700">No {filterStatus.toLowerCase()} requests found</h3>
                  <p className="text-gray-500 mt-2 max-w-sm">When the community reports waste issues, they will securely appear here.</p>
                </div>
              ) : (
                <div className="grid gap-5">
                  {requests.filter(r => filterStatus === 'All' ? true : r.status === filterStatus).map((req) => (
                    <div key={req._id} className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${
                        req.status === 'Resolved' ? 'bg-green-500' : 
                        req.status === 'Dispatched' ? 'bg-blue-500' : 
                        'bg-yellow-400'
                      }`}></div>
                      
                      <div>
                        <div className="flex justify-between items-start mb-3 pl-2">
                          <h3 className="font-extrabold text-lg text-gray-900 leading-tight pr-4">{req.title}</h3>
                          <div className="flex items-center gap-2 shrink-0 relative z-10">
                            {/* Action Buttons for Managers */}
                            {req.status === 'Pending' && (
                              <span className="px-4 py-1.5 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800 shadow-sm cursor-default">
                                Pending
                              </span>
                            )}
                            {req.status === 'Dispatched' && (
                              <span className="px-4 py-1.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 shadow-sm cursor-default">
                                Dispatched
                              </span>
                            )}
                            {req.status === 'Resolved' && (
                              <span className="px-4 py-1.5 text-xs font-bold rounded-full bg-gray-100 text-gray-500 shadow-sm cursor-default">
                                Resolved
                              </span>
                            )}
                            
                            {/* Delete Button for Managers */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                confirmDelete(req._id);
                              }}
                              className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-xl transition-all duration-200 shadow-sm border border-red-100 flex items-center justify-center transform active:scale-95 relative z-10 cursor-pointer"
                              title="Delete Request"
                            >
                              <svg className="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                            </button>
                          </div>
                        </div>
                        <p className="text-gray-600 mb-4 pl-2 leading-relaxed text-sm md:text-base">{req.description}</p>
                        
                        {/* Optional Image */}
                        {(req.hasImage || req.hasResolvedImage) && (
                          <div className="pl-2 mb-4">
                            <button
                              onClick={() => toggleImage(req)}
                              className="flex items-center gap-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors border border-blue-100"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                              </svg>
                              {loadingImages[req._id] ? 'Loading...' : expandedImages[req._id] ? 'Hide Images' : 'Show Images'}
                            </button>

                            {expandedImages[req._id] && (
                              <div className="mt-3 flex flex-col sm:flex-row gap-4">
                                {imageUrls[req._id] && (
                                  <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex flex-col justify-center shadow-sm relative group/img">
                                    <div className="absolute top-2 left-2 z-10 bg-red-500/90 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded backdrop-blur-sm shadow-sm pointer-events-none">
                                      Before
                                    </div>
                                    <img src={imageUrls[req._id]} alt="Waste issue before" className="object-contain max-h-80 w-full" />
                                    <button
                                      onClick={() => toggleImage(req)}
                                      className="absolute top-2 right-2 bg-gray-900/50 hover:bg-gray-900/80 text-white rounded-full p-1.5 backdrop-blur-sm transition-all"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                      </svg>
                                    </button>
                                  </div>
                                )}
                                {resolvedImageUrls[req._id] && (
                                  <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex flex-col justify-center shadow-sm relative group/img">
                                    <div className="absolute top-2 left-2 z-10 bg-green-500/90 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded backdrop-blur-sm shadow-sm pointer-events-none">
                                      After
                                    </div>
                                    <img src={resolvedImageUrls[req._id]} alt="Waste issue resolved" className="object-contain max-h-80 w-full" />
                                    <button
                                      onClick={() => toggleImage(req)}
                                      className="absolute top-2 right-2 bg-gray-900/50 hover:bg-gray-900/80 text-white rounded-full p-1.5 backdrop-blur-sm transition-all"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Timestamp Grid */}
                        <div className="pl-2 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px] mb-0.5">Created</span>
                            <span className="text-gray-700 font-medium">{formatDate(req.createdAt)}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px] mb-0.5">Resolved</span>
                            <span className={`font-medium ${req.resolvedAt ? 'text-green-600' : 'text-gray-400'}`}>
                              {req.resolvedAt ? formatDate(req.resolvedAt) : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 pl-2 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                          <span className="text-base">📍</span> {req.location}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                          <span className="text-base">♻️</span> {req.wasteCategory}
                        </div>
                        {req.status === 'Pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus(req._id, 'Dispatched');
                            }}
                            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm ml-2"
                          >
                            Mark as Dispatched
                          </button>
                        )}
                        {req.citizenId?.name && (
                           <div className="ml-auto flex items-center gap-2 text-xs font-medium text-gray-500">
                             <span className="w-5 h-5 bg-purple-100 text-purple-600 flex justify-center items-center rounded-full font-bold lowercase">
                               {req.citizenId.name.charAt(0)}
                             </span>
                             Reported by <span className="font-bold text-gray-700">{req.citizenId.name}</span>
                           </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentView === 'location' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">📍</div>
                <h2 className="text-xl font-bold text-gray-800">Requests by Location</h2>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select State</label>
                    <select 
                      value={locationState} 
                      onChange={handleLocationStateChange}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">-- Select State --</option>
                      {Object.keys(indiaData).map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select District(s)</label>
                    <select 
                      multiple 
                      value={locationDistricts} 
                      onChange={handleLocationDistrictChange}
                      disabled={!locationState}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px]"
                    >
                      <option value="ALL" className="font-bold text-indigo-700 mb-1">ALL (All Districts)</option>
                      {locationState && indiaData[locationState]?.map(district => (
                        <option key={district} value={district} className="py-1">{district}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-2">Hold Ctrl (Windows) or Cmd (Mac) to select multiple districts.</p>
                  </div>
                </div>
              </div>

              {!locationState ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                  <span className="text-5xl mb-4 opacity-50">🗺️</span>
                  <h3 className="text-xl font-bold text-gray-700">Select a Location</h3>
                  <p className="text-gray-500 mt-2">Pick a state to view community requests from that region.</p>
                </div>
              ) : filteredLocationRequests.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                  <span className="text-5xl mb-4 opacity-50">📭</span>
                  <h3 className="text-xl font-bold text-gray-700">No requests found</h3>
                  <p className="text-gray-500 mt-2">There are no reported requests for the selected locations.</p>
                </div>
              ) : (
                <div className="grid gap-5">
                  {filteredLocationRequests.map((req) => (
                    <div key={req._id} className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${
                        req.status === 'Resolved' ? 'bg-green-500' : 
                        req.status === 'Dispatched' ? 'bg-blue-500' : 
                        'bg-yellow-400'
                      }`}></div>
                      
                      <div>
                        <div className="flex justify-between items-start mb-3 pl-2">
                          <h3 className="font-extrabold text-lg text-gray-900 leading-tight pr-4">{req.title}</h3>
                          <div className="flex items-center gap-2 shrink-0 relative z-50">
                            {/* Action Buttons for Managers */}
                            {req.status === 'Pending' && (
                              <span className="px-4 py-1.5 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800 shadow-sm cursor-default">
                                Pending
                              </span>
                            )}
                            {req.status === 'Dispatched' && (
                              <span className="px-4 py-1.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 shadow-sm cursor-default">
                                Dispatched
                              </span>
                            )}
                            {req.status === 'Resolved' && (
                              <span className="px-4 py-1.5 text-xs font-bold rounded-full bg-gray-100 text-gray-500 shadow-sm cursor-default">
                                Resolved
                              </span>
                            )}
                            
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                confirmDelete(req._id);
                              }}
                              className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-xl transition-all duration-200 shadow-sm border border-red-100 flex items-center justify-center transform active:scale-95 cursor-pointer relative z-50"
                              title="Delete Request"
                            >
                              <svg className="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                            </button>
                          </div>
                        </div>
                        <p className="text-gray-600 mb-4 pl-2 leading-relaxed text-sm md:text-base">{req.description}</p>
                        
{req.hasImage && (
                          <div className="pl-2 mb-4">
                            <button
                              onClick={() => toggleImage(req)}
                              className="flex items-center gap-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors border border-blue-100"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                              </svg>
                              {loadingImages[req._id] ? 'Loading...' : expandedImages[req._id] ? 'Hide Image' : 'Show Image'}
                            </button>

                            {expandedImages[req._id] && imageUrls[req._id] && (
                              <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex justify-center shadow-sm relative">
                                <img src={imageUrls[req._id]} alt="Waste issue" className="object-contain max-h-80 w-full" />
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="pl-2 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px] mb-0.5">Created</span>
                            <span className="text-gray-700 font-medium">{formatDate(req.createdAt)}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px] mb-0.5">Resolved</span>
                            <span className={`font-medium ${req.resolvedAt ? 'text-green-600' : 'text-gray-400'}`}>
                              {req.resolvedAt ? formatDate(req.resolvedAt) : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 pl-2 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                          <span className="text-base">📍</span> {req.location}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                          <span className="text-base">♻️</span> {req.wasteCategory}
                        </div>
                        {req.status === 'Pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStatus(req._id, 'Dispatched');
                            }}
                            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm ml-2"
                          >
                            Mark as Dispatched
                          </button>
                        )}
                        {req.citizenId?.name && (
                           <div className="ml-auto flex items-center gap-2 text-xs font-medium text-gray-500">
                             <span className="w-5 h-5 bg-purple-100 text-purple-600 flex justify-center items-center rounded-full font-bold lowercase">
                               {req.citizenId.name.charAt(0)}
                             </span>
                             Reported by <span className="font-bold text-gray-700">{req.citizenId.name}</span>
                           </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

{currentView === 'category' && (() => {
              const categoryCounts = requests.reduce((acc, req) => {
                const cat = req.wasteCategory || 'Other';
                acc[cat] = (acc[cat] || 0) + 1;
                return acc;
              }, {});

              const categoryData = Object.keys(categoryCounts).map(key => ({
                name: key,
                value: categoryCounts[key]
              }));

              const statusCounts = requests.reduce((acc, req) => {
                const stat = req.status || 'Unknown';
                acc[stat] = (acc[stat] || 0) + 1;
                return acc;
              }, {});

              const statusData = Object.keys(statusCounts).map(key => ({
                name: key,
                value: statusCounts[key]
              }));

              const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#F43F5E', '#3B82F6', '#8B5CF6'];

              return (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">📊</div>
                    <h2 className="text-xl font-bold text-gray-800">Requests by Category & Status</h2>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                    {/* Waste Category Pie Chart */}
                    <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col justify-center min-h-[400px]">
                      <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">Distribution by Waste Type</h3>
                      <p className="text-sm text-gray-500 text-center mb-6">Total reports logged per category</p>
                      
                      {categoryData.length > 0 ? (
                        <div className="w-full h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                              <Pie                                  cursor="pointer"
                                  onClick={(data) => setChartFilter({ type: 'category', value: data.name })}                                data={categoryData}
                                cx="50%"
                                cy="50%"
                                labelLine={true}
                                outerRadius={110}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent, x, y, cx, textAnchor }) => (
                                  <text x={x} y={y} cx={cx} textAnchor={textAnchor} fill="#4B5563" fontSize={12} fontWeight={500}>
                                    {`${name} (${(percent * 100).toFixed(0)}%)`}
                                  </text>
                                )}
                              >
                                {categoryData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                formatter={(value, name) => [`${value} requests`, name]} 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                          <span className="text-4xl mb-3 opacity-30">📭</span>
                          <p>No data available to display.</p>
                        </div>
                      )}
                    </div>

                    {/* Status Bar Chart */}
                    <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col justify-center min-h-[400px]">
                      <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">Requests by Status</h3>
                      <p className="text-sm text-gray-500 text-center mb-6">Current progress of all requests</p>
                      
                      {statusData.length > 0 ? (
                        <div className="w-full h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={statusData}
                              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12, fontWeight: 600}} dy={10} />
                              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
                              <RechartsTooltip 
                                cursor={{fill: '#F3F4F6'}} 
                                formatter={(value, name) => [`${value} requests`, name === 'value' ? 'Total' : name]} 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60} cursor="pointer" onClick={(data) => setChartFilter({ type: 'status', value: data.name })}>
                                {statusData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={
                                    entry.name === 'Resolved' ? '#10B981' :
                                    entry.name === 'Dispatched' ? '#3B82F6' :
                                    '#F59E0B'
                                  } />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                          <span className="text-4xl mb-3 opacity-30">📭</span>
                          <p>No data available to display.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Filtered Data Section */}
                  {chartFilter.value && (
                    <div className="mt-8 bg-gray-50/50 border border-gray-100 shadow-sm rounded-3xl p-6 lg:p-8 animate-fade-in relative">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                          <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">Filtered Results</p>
                          <h3 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                            {chartFilter.type === 'category' ? '♻️ Category:' : '📊 Status:'} 
                            <span className="text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                              {chartFilter.value}
                            </span>
                          </h3>
                        </div>
                        <button 
                          onClick={() => setChartFilter({ type: null, value: null })}
                          className="px-4 py-2.5 bg-white text-gray-600 rounded-xl hover:bg-gray-100 hover:text-gray-900 transition-all font-bold text-sm flex items-center gap-2 border border-gray-200 shadow-sm flex-shrink-0"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          Clear Filter
                        </button>
                      </div>
                      
                      {(() => {
                         const filteredChartRequests = requests.filter(req => 
                           chartFilter.type === 'category' ? req.wasteCategory === chartFilter.value : req.status === chartFilter.value
                         );
                         
                         if (filteredChartRequests.length === 0) {
                           return (
                             <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
                               <span className="text-5xl block mb-3 opacity-30">📭</span>
                               <h4 className="text-lg font-bold text-gray-700">No requests found</h4>
                               <p className="text-gray-500 mt-1">There are no reports matching this filter.</p>
                             </div>
                           );
                         }
                         
                         return (
                           <div className="grid gap-5">
                             {filteredChartRequests.map((req) => (
                               <div key={req._id} className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md hover:border-indigo-200 transition-all duration-300 relative overflow-hidden">
                                 <div className={`absolute top-0 left-0 w-1.5 h-full ${
                                   req.status === 'Resolved' ? 'bg-green-500' : req.status === 'Dispatched' ? 'bg-blue-500' : 'bg-yellow-400'
                                 }`}></div>
                                 <div>
                                   <div className="flex justify-between items-start mb-3 pl-2">
                                     <h3 className="font-extrabold text-lg text-gray-900 leading-tight pr-4">{req.title}</h3>
                                     <span className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-full ${
                                       req.status === 'Resolved' ? 'bg-green-100 text-green-800' : req.status === 'Dispatched' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                                     }`}>
                                       {req.status}
                                     </span>
                                   </div>
                                   <p className="text-gray-600 mb-5 leading-relaxed text-sm pl-2">{req.description}</p>
                                 </div>
                                 <div className="flex flex-wrap flex-col sm:flex-row items-start sm:items-center gap-3 pt-4 border-t border-gray-100 pl-2 text-sm text-gray-500 font-medium">
                                   <div className="flex items-center gap-2">
                                     <span>📍</span> {req.location}
                                   </div>
                                   <span className="hidden sm:inline text-gray-300">•</span>
                                   <div className="flex items-center gap-2">
                                       <span>👤</span> {req.citizenId?.name || 'Unknown User'}
                                   </div>
                                   <span className="hidden sm:inline text-gray-300">•</span>
                                   <div className="flex items-center gap-2">
                                     <span>📅</span> {new Date(req.createdAt).toLocaleDateString()}
                                   </div>
                                 </div>
                               </div>
                             ))}
                           </div>
                         );
                      })()}
                    </div>
                  )}
                </div>
              );
            })()}

          {currentView === 'users' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">👥</div>
                <h2 className="text-xl font-bold text-gray-800">User Management</h2>
              </div>
              
              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="p-4 font-bold">Name</th>
                        <th className="p-4 font-bold">Email</th>
                        <th className="p-4 font-bold text-center">Role</th>
                        <th className="p-4 font-bold text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[...users].sort((a, b) => {
                        const roleOrder = { manager: 1, worker: 2, citizen: 3 };
                        const roleDiff = (roleOrder[a.role] || 4) - (roleOrder[b.role] || 4);
                        if (roleDiff !== 0) return roleDiff;
                        return a.name.localeCompare(b.name);
                      }).map(user => (
                        <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            {user.role === 'citizen' ? (
                              <button 
                                onClick={() => setSelectedUserId(selectedUserId === user._id ? null : user._id)}
                                className="font-bold text-gray-900 hover:text-blue-600 transition-colors flex items-center gap-2 text-left"
                              >
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                {user.name}
                              </button>
                            ) : (
                              <div className="font-bold text-gray-900 flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                  user.role === 'manager' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                {user.name}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-sm text-gray-600">{user.email}</td>
                          <td className="p-4 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                              user.role === 'manager' ? 'bg-purple-100 text-purple-800' : 
                              user.role === 'worker' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="p-4 text-center flex items-center justify-center gap-2">
                            {user.role === 'citizen' && (
                              <button 
                                onClick={() => setSelectedUserId(selectedUserId === user._id ? null : user._id)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                                  selectedUserId === user._id 
                                    ? 'bg-indigo-600 text-white border-indigo-600' 
                                    : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-600'
                                }`}
                              >
                                {selectedUserId === user._id ? 'Hide Requests' : 'View Requests'}
                              </button>
                            )}
                            <select value={user.role} onChange={(e) => toggleUserRole(user._id, e.target.value)} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-600 transition-all outline-none bg-white"><option value="citizen">Citizen</option><option value="worker">Worker</option><option value="manager">Manager</option></select>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr>
                          <td colSpan="4" className="p-8 text-center text-gray-500">
                            No users found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* User Requests Section */}
              {selectedUserId && (
                <div className="mt-8 bg-gray-50/50 border border-gray-100 shadow-sm rounded-3xl p-6 lg:p-8 animate-fade-in relative">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">User Activity</p>
                      <h3 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                        Requests by:
                        <span className="text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                          {users.find(u => u._id === selectedUserId)?.name || 'Unknown'}
                        </span>
                      </h3>
                    </div>
                    <button 
                      onClick={() => setSelectedUserId(null)}
                      className="px-4 py-2.5 bg-white text-gray-600 rounded-xl hover:bg-gray-100 hover:text-gray-900 transition-all font-bold text-sm flex items-center gap-2 border border-gray-200 shadow-sm flex-shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      Close
                    </button>
                  </div>
                  
                  {(() => {
                     const userRequests = requests.filter(req => 
                       req.citizenId && (req.citizenId._id === selectedUserId || req.citizenId === selectedUserId)
                     );
                     
                     if (userRequests.length === 0) {
                       return (
                         <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
                           <span className="text-5xl block mb-3 opacity-30">📭</span>
                           <h4 className="text-lg font-bold text-gray-700">No requests found</h4>
                           <p className="text-gray-500 mt-1">This user hasn't made any requests.</p>
                         </div>
                       );
                     }
                     
                     return (
                       <div className="grid gap-5">
                         {userRequests.map((req) => (
                           <div key={req._id} className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md hover:border-indigo-200 transition-all duration-300 relative overflow-hidden">
                             <div className={`absolute top-0 left-0 w-1.5 h-full ${
                               req.status === 'Resolved' ? 'bg-green-500' : req.status === 'Dispatched' ? 'bg-blue-500' : 'bg-yellow-400'
                             }`}></div>
                             <div>
                               <div className="flex justify-between items-start mb-3 pl-2">
                                 <h3 className="font-extrabold text-lg text-gray-900 leading-tight pr-4">{req.title}</h3>
                                 <span className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-full ${
                                   req.status === 'Resolved' ? 'bg-green-100 text-green-800' : req.status === 'Dispatched' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                                 }`}>
                                   {req.status}
                                 </span>
                               </div>
                               <p className="text-gray-600 mb-5 leading-relaxed text-sm pl-2">{req.description}</p>
                             </div>
                             <div className="flex flex-wrap flex-col sm:flex-row items-start sm:items-center gap-3 pt-4 border-t border-gray-100 pl-2 text-sm text-gray-500 font-medium">
                               <div className="flex items-center gap-2">
                                 <span>📍</span> {req.location}
                               </div>
                               <span className="hidden sm:inline text-gray-300">•</span>
                               <div className="flex items-center gap-2">
                                 <span>♻️</span> {req.wasteCategory}
                               </div>
                               <span className="hidden sm:inline text-gray-300">•</span>
                               <div className="flex items-center gap-2">
                                 <span>📅</span> {new Date(req.createdAt).toLocaleDateString()}
                               </div>
                             </div>
                           </div>
                         ))}
                       </div>
                     );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
        </div>
      </main>
    </div>
  );
}
