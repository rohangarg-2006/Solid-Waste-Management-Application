import { indiaData } from '../utils/indiaData';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api.js';

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [filterStatus, setFilterStatus] = useState('All');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [seenNotificationsCount, setSeenNotificationsCount] = useState(() => {
    return parseInt(localStorage.getItem('seenCitizenNotifications') || '0');
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

  const [expandedImages, setExpandedImages] = useState({});
  const [imageUrls, setImageUrls] = useState({});
  const [resolvedImageUrls, setResolvedImageUrls] = useState({});
  const [loadingImages, setLoadingImages] = useState({});

  const toggleImage = async (req) => {
    const requestId = req._id;
    if (expandedImages[requestId]) {
      setExpandedImages(prev => ({ ...prev, [requestId]: false }));
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
    
    setExpandedImages(prev => ({ ...prev, [requestId]: !prev[requestId] }));
  };
  
  const userName = localStorage.getItem('userName') || 'User';
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, requestId: null });
  const [cleanImageAlert, setCleanImageAlert] = useState(false);

  const [formData, setFormData] = useState({
    title: '', description: '', wasteCategory: 'Municipal Solid Waste', state: '', district: '', area: '', image: null
  });
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    const fetchRequests = async () => {
      const token = localStorage.getItem('token');
      if (!token) { navigate('/'); return; }
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.get('/api/v1/requests', config);
        setRequests(response.data.data);
      } catch (err) {
        setError('Failed to fetch requests. Please log in again.');
        localStorage.removeItem('token');
        navigate('/');
      }
    };
    fetchRequests();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'state') setFormData({ ...formData, state: value, district: '' });
    else setFormData({ ...formData, [name]: value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { setError('Image size should be less than 5MB'); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setFormData({ ...formData, image: reader.result });
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null); setFormData({ ...formData, image: null });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!formData.state || !formData.district || !formData.area) { setError('Please fill out state, district, and area.'); return; }
    if (!formData.image) { setError('Please upload a photo of the waste.'); return; }

    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const fullLocation = `${formData.area}, ${formData.district}, ${formData.state}`;
      const payload = {
        title: formData.title, description: formData.description, wasteCategory: formData.wasteCategory,
        location: fullLocation, image: formData.image
      };

      const response = await axios.post('/api/v1/requests', payload, config);
      const newRequest = response.data.data;
      newRequest.hasImage = !!newRequest.image;
      if (newRequest.image) setImageUrls(prev => ({ ...prev, [newRequest._id]: newRequest.image }));
      
      setRequests([newRequest, ...requests]);
      setSuccess('Waste request submitted successfully!');
      setFormData({ title: '', description: '', wasteCategory: 'Municipal Solid Waste', state: '', district: '', area: '', image: null });
      setImagePreview(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      if (err.response?.data?.prediction === 'Clean') {
        setCleanImageAlert(true);
        setImagePreview(null);
        setFormData(prev => ({ ...prev, image: null }));
      } else {
        setError(err.response?.data?.message || 'Failed to submit request');
      }
    }
  };

  const confirmDelete = (id) => setDeleteConfirmation({ isOpen: true, requestId: id });
  
  const proceedWithDeletion = async () => {
    const id = deleteConfirmation.requestId;
    setDeleteConfirmation({ isOpen: false, requestId: null });
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`/api/v1/requests/${id}`, config);
      setRequests(requests.filter(req => req._id !== id));
      setSuccess('Request deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete request');
    }
  };

  const handleLogout = () => { localStorage.removeItem('token'); navigate('/'); };

  const notifications = [];
  requests.forEach(req => {
    if (req.status === "Dispatched") {
      notifications.push({ id: `disp-${req._id}`, type: 'dispatched', title: 'Request Dispatched', message: `Your request "${req.title}" is dispatched.`, time: req.updatedAt || req.createdAt });
    } else if (req.status === "Resolved") {
      notifications.push({ id: `res-${req._id}`, type: 'resolved', title: 'Request Resolved', message: `Your request "${req.title}" has been resolved!`, time: req.resolvedAt || req.updatedAt || req.createdAt });
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
      localStorage.setItem('seenCitizenNotifications', notifications.length.toString());
    }
  };

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === "Pending").length,
    dispatched: requests.filter(r => r.status === "Dispatched").length,
    resolved: requests.filter(r => r.status === "Resolved").length,
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {cleanImageAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 to-orange-500"></div>
            <div className="w-20 h-20 mx-auto bg-yellow-50 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl">🪴</span>
            </div>
            <h3 className="text-2xl font-black text-center text-gray-900 mb-3">Too Clean!</h3>
            <p className="text-center text-gray-600 mb-8 font-medium leading-relaxed">
              The picture uploaded appears to be clean and is invalid for a waste report. Please reupload a valid photo showing the waste clearly.
            </p>
            <button 
              onClick={() => setCleanImageAlert(false)} 
              className="w-full py-4 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Got it, I'll try again
            </button>
          </div>
        </div>
      )}

      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-black text-center text-gray-900 mb-2">Delete Request?</h3>
            <p className="text-center text-gray-500 mb-8">This action cannot be undone.</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirmation({ isOpen: false, requestId: null })} className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition-all">Cancel</button>
              <button onClick={proceedWithDeletion} className="flex-1 py-3.5 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white/90 backdrop-blur-xl border-b border-emerald-100 shadow-[0_4px_30px_rgba(16,185,129,0.06)] sticky top-0 z-[100] transition-all text-gray-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-emerald-200/50 transform hover:scale-105 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-700 to-green-500 tracking-tight">Citizen Portal</h1>
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
                <span className="px-2 py-0.5 text-[10px] rounded-md font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 uppercase tracking-wider">
                  Citizen
                </span>
              </div>
            </div>

            <div className="relative" ref={notificationRef}>
              <button onClick={handleOpenNotifications} className="relative p-2.5 text-gray-600 hover:bg-green-50 hover:text-green-700 rounded-xl transition-all border border-transparent hover:border-green-100">
                🔔
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-4 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                  <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-900">Notifications</h3>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto">
                    {displayNotifications.length === 0 ? (
                      <div className="py-10 text-center text-gray-400 font-medium">No recent updates</div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {displayNotifications.map(notif => (
                          <div key={notif.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex gap-3">
                              <div className="mt-1">{notif.type === 'resolved' ? '✅' : '🚚'}</div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">{notif.title}</p>
                                <p className="text-sm text-gray-600">{notif.message}</p>
                                <p className="text-xs text-gray-400 mt-1">{formatDate(notif.time)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleLogout} className="flex items-center gap-2 px-5 py-2.5 bg-red-50 hover:bg-red-500 text-red-600 hover:text-white font-bold rounded-xl transition-all shadow-sm border border-red-100 hover:border-transparent group">
              <span className="hidden sm:inline">Logout</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 mt-4 w-full">
        {error && <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 font-medium rounded-r-xl">{error}</div>}
        {success && <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 font-medium rounded-r-xl">{success}</div>}

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
                className={`p-6 rounded-3xl border cursor-pointer transition-all ${filterStatus === stat.filterKey ? 'ring-2 ring-green-500 shadow-md scale-[1.02]' : 'border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1'} ${stat.bg} group`}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 sticky top-28">
              <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">📸 New Report</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Title</label>
                  <input type="text" name="title" value={formData.title} onChange={handleChange} required className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all placeholder:text-gray-400 font-medium" placeholder="What's the issue?" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Category</label>
                    <select name="wasteCategory" value={formData.wasteCategory} onChange={handleChange} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-medium appearance-none">
                      <option value="Municipal Solid Waste">Municipal Solid Waste</option>
                      <option value="Hazardous">Hazardous</option>
                      <option value="Recyclable">Recyclable</option>
                      <option value="Biomedical">Biomedical</option>
                      <option value="E-Waste">E-Waste</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">State</label>
                    <select name="state" value={formData.state} onChange={handleChange} required className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-medium appearance-none">
                      <option value="" disabled>State</option>
                      {Object.keys(indiaData).sort().map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">District</label>
                    <select name="district" value={formData.district} onChange={handleChange} required disabled={!formData.state} className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-medium appearance-none disabled:opacity-50">
                      <option value="" disabled>District</option>
                      {formData.state && indiaData[formData.state]?.sort().map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Exact Location</label>
                  <input type="text" name="area" value={formData.area} onChange={handleChange} required className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-medium placeholder:text-gray-400" placeholder="Street, landmark..." />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Description</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} required rows="3" className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-medium resize-none placeholder:text-gray-400" placeholder="More details about the waste..."></textarea>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 pl-1">Photo Proof <span className="text-red-500">*</span></label>
                  <div className="relative group border-2 border-dashed border-gray-300 rounded-3xl hover:border-green-500 hover:bg-green-50/50 transition-all bg-gray-50 overflow-hidden">
                    {imagePreview ? (
                      <div className="relative">
                        <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <button type="button" onClick={() => { setImagePreview(null); setFormData({...formData, image: null}); }} className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold backdrop-blur-md hover:bg-red-600 transition-colors shadow-lg">Remove Photo</button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center py-8 cursor-pointer relative z-10 w-full">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-3xl mb-3 border border-gray-100">📷</div>
                        <span className="font-bold text-gray-700 text-base">Tap to Upload</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                      </label>
                    )}
                  </div>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-black text-lg py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all outline-none focus:ring-4 focus:ring-green-500/30 flex items-center justify-center gap-2">
                  Submit Report 🚀
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-gray-900">
                {filterStatus === 'All' ? 'All Reports' : `${filterStatus} Reports`}
              </h3>
              <span className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-full text-sm font-bold">
                {requests.filter(r => filterStatus === 'All' ? true : r.status === filterStatus).length} found
              </span>
            </div>

            <div className="grid gap-6">
              {requests.filter(r => filterStatus === 'All' ? true : r.status === filterStatus).length === 0 ? (
                <div className="bg-white/50 border border-dashed border-gray-300 rounded-3xl p-16 text-center">
                  <div className="text-6xl mb-4 opacity-50 grayscale">🍃</div>
                  <h3 className="text-xl font-bold text-gray-700">All clear here!</h3>
                  <p className="text-gray-500 mt-2">No {filterStatus.toLowerCase()} requests found.</p>
                </div>
              ) : (
                requests.filter(r => filterStatus === 'All' ? true : r.status === filterStatus).map((req, idx) => (
                  <div key={req._id} className="bg-white p-6 sm:p-7 rounded-3xl border border-gray-100 shadow-sm transition-all hover:shadow-md relative group overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 w-2 ${req.status === 'Resolved' ? 'bg-emerald-500' : req.status === 'Dispatched' ? 'bg-blue-500' : 'bg-amber-400'}`}></div>
                    
                    <div className="flex justify-between items-start gap-4 mb-4 pl-3">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg border ${req.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : req.status === 'Dispatched' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {req.status}
                          </span>
                          <span className="text-xs font-bold text-gray-400">{formatDate(req.createdAt)}</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 leading-tight">{req.title}</h3>
                      </div>
                      
                      <div className="flex gap-2">
                        {req.status === 'Pending' && (
                          <button onClick={() => confirmDelete(req._id)} className="w-10 h-10 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 border border-gray-100 hover:border-red-200 rounded-xl flex items-center justify-center transition-all">
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-gray-600 mb-6 pl-3 font-medium leading-relaxed">{req.description}</p>

                    {(req.hasImage || req.hasResolvedImage) && (
                      <div className="mb-6 pl-3">
                        <button onClick={() => toggleImage(req)} className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-sm rounded-xl border border-gray-200 transition-all">
                          <span>{loadingImages[req._id] ? '⏳ Loading...' : expandedImages[req._id] ? '🖼️ Hide Photos' : '🖼️ View Photos'}</span>
                        </button>
                        
                        {expandedImages[req._id] && (
                          <div className="mt-4 flex flex-col sm:flex-row gap-4">
                            {imageUrls[req._id] && (
                              <div className="flex-1 rounded-2xl overflow-hidden bg-gray-100 relative group/img border border-gray-200">
                                <div className="absolute top-2 left-2 z-10 bg-red-500/90 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded backdrop-blur-sm shadow-sm pointer-events-none">Before</div>
                                <img src={imageUrls[req._id]} alt="Issue Before" className="w-full h-[250px] object-cover" />
                              </div>
                            )}
                            {resolvedImageUrls[req._id] && (
                              <div className="flex-1 rounded-2xl overflow-hidden bg-gray-100 relative group/img border border-gray-200">
                                <div className="absolute top-2 left-2 z-10 bg-green-500/90 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded backdrop-blur-sm shadow-sm pointer-events-none">After</div>
                                <img src={resolvedImageUrls[req._id]} alt="Issue Resolved" className="w-full h-[250px] object-cover" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pl-3">
                      <div className="bg-gray-50 text-gray-700 text-sm font-bold px-4 py-3 rounded-2xl flex items-center gap-2 border border-gray-100">
                        <span>📍</span> <span className="truncate">{req.location}</span>
                      </div>
                      <div className="bg-emerald-50 text-emerald-800 text-sm font-bold px-4 py-3 rounded-2xl flex items-center gap-2 border border-emerald-100">
                        <span>♻️</span> <span className="truncate">{req.wasteCategory}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
