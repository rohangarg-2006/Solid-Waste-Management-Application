import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api.js';
import { indiaData } from '../utils/indiaData';

export default function WorkerDashboard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [visibleImages, setVisibleImages] = useState({});
  const [imageUrls, setImageUrls] = useState({});
  const [resolvedImageUrls, setResolvedImageUrls] = useState({});
  const [loadingImages, setLoadingImages] = useState({});
  const [activeTab, setActiveTab] = useState('Dispatched');

  const [verifyModalId, setVerifyModalId] = useState(null);
  const [uploadingVerify, setUploadingVerify] = useState(false);
  const [dirtyImageAlert, setDirtyImageAlert] = useState(false);
  const [verifiedCleanRequests, setVerifiedCleanRequests] = useState({});

  const toggleImage = async (req) => {
    const id = req._id;
    if (visibleImages[id]) {
      setVisibleImages(prev => ({ ...prev, [id]: false }));
      return;
    }

    if ((!imageUrls[id] && req.hasImage) || (!resolvedImageUrls[id] && req.hasResolvedImage)) {
      try {
        setLoadingImages(prev => ({ ...prev, [id]: true }));
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const res = await axios.get(`/api/v1/requests/${id}`, config);
        
        if (res.data.data.image) {
          setImageUrls(prev => ({ ...prev, [id]: res.data.data.image }));
        }
        if (res.data.data.resolvedImage) {
          setResolvedImageUrls(prev => ({ ...prev, [id]: res.data.data.resolvedImage }));
        }
      } catch (err) {
        console.error("Failed to load image");
      } finally {
        setLoadingImages(prev => ({ ...prev, [id]: false }));
      }
    }
    
    setVisibleImages(prev => ({ ...prev, [id]: true }));
  };

  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'Worker';

  useEffect(() => {
    const fetchRequests = async () => {
      const token = localStorage.getItem('token');
      const userRole = localStorage.getItem('userRole');

      if (!token || userRole !== 'worker') {
        navigate('/');
        return;
      }

      try {
        const config = {
          headers: { Authorization: `Bearer ${token}` }
        };
        
        const response = await axios.get('/api/v1/requests', config);
        // Keep dispatched and resolved requests
        const workerRequests = response.data.data.filter(r => r.status === 'Dispatched' || r.status === 'Resolved');
        setRequests(workerRequests);
      } catch (err) {
        setError('Failed to fetch requests.');
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [navigate]);

  const updateStatus = async (id, newStatus, resolvedImage = null) => {
    try {
      const token = localStorage.getItem('token');
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      const payload = { status: newStatus };
      if (resolvedImage) {
        payload.resolvedImage = resolvedImage;
      }

      await axios.put(`/api/v1/requests/${id}`, payload, config);
      
      setRequests(requests.map(req => req._id === id ? { ...req, status: newStatus, resolvedImage: resolvedImage || req.resolvedImage } : req));
      setSuccess('Waste marked as Resolved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleVerifyCleanAndComplete = async (e, id) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { 
      setError('Image size should be less than 5MB'); 
      return; 
    }

    setUploadingVerify(true);
    setVerifyModalId(id);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Image = reader.result;
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        
        const response = await axios.post('/api/v1/requests/verify-clean', { image: base64Image }, config);
        
        if (response.data.prediction === 'Clean') {
          // If clean, mark it as verified clean so the worker can submit
          setVerifyModalId(null);
          setVerifiedCleanRequests(prev => ({
            ...prev,
            [id]: base64Image
          }));
        } else {
          // if Dirty
          setVerifyModalId(null);
          setDirtyImageAlert(true);
        }
      } catch (err) {
        setVerifyModalId(null);
        setError(err.response?.data?.message || 'Failed to verify image');
        setTimeout(() => setError(''), 4000);
      } finally {
        setUploadingVerify(false);
        // Clear the file input
        e.target.value = null;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStateChange = (e) => {
    setSelectedState(e.target.value);
    setSelectedDistrict('');
  };

  // Filter the already dispatched requests by state and district and active tab
  const filteredRequests = requests.filter(req => {
    if (req.status !== activeTab) return false;
    if (!req.location) return false;
    const parts = req.location.split(',').map(p => p.trim());
    const reqState = parts.length >= 3 ? parts[parts.length - 1] : '';
    const reqDistrict = parts.length >= 3 ? parts[parts.length - 2] : '';
    
    const stateMatch = selectedState ? reqState === selectedState : true;
    const districtMatch = selectedDistrict ? reqDistrict === selectedDistrict : true;
    
    return stateMatch && districtMatch;
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    navigate('/');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] font-sans">
      {dirtyImageAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-400 to-orange-500"></div>
            <div className="w-20 h-20 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl">🧹</span>
            </div>
            <h3 className="text-2xl font-black text-center text-gray-900 mb-3">Area Still Dirty!</h3>
            <p className="text-center text-gray-600 mb-8 font-medium leading-relaxed">
              The picture uploaded shows the area is still dirty. Please clear the waste properly and try re-uploading the image of the clean area.
            </p>
            <button 
              onClick={() => setDirtyImageAlert(false)} 
              className="w-full py-4 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Got it, I'll clean it up
            </button>
          </div>
        </div>
      )}

      {/* Sleek Navigation Bar */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-orange-100 shadow-[0_4px_30px_rgba(249,115,22,0.06)] sticky top-0 z-[100] transition-all text-gray-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-orange-400 to-orange-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-200/50 transform hover:scale-105 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-700 to-orange-500 tracking-tight">Worker Portal</h1>
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
                <span className="px-2 py-0.5 text-[10px] rounded-md font-bold bg-orange-50 border border-orange-200 text-orange-700 uppercase tracking-wider">
                  Field Staff
                </span>
              </div>
            </div>
            
            <button onClick={handleLogout} className="bg-red-50 hover:bg-red-500 text-red-600 hover:text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm border border-red-100 hover:border-transparent flex items-center gap-2 group">
              <span className="hidden sm:inline">Logout</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 p-6 lg:p-10 relative overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-300/10 rounded-full blur-[120px] -mr-[200px] -mt-[200px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-200/10 rounded-full blur-[100px] -ml-[150px] -mb-[150px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10 w-full animate-fade-in">
          
          <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 gap-6">
            <div>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-800 mb-2">Your Tasks</h2>
              <div className="flex gap-4 mt-4">
                <button 
                  onClick={() => setActiveTab('Dispatched')}
                  className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'Dispatched' ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Assigned
                </button>
                <button 
                  onClick={() => setActiveTab('Resolved')}
                  className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'Resolved' ? 'bg-emerald-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Resolved
                </button>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <div className="relative flex-1 min-w-[200px]">
                <select 
                  value={selectedState} 
                  onChange={handleStateChange}
                  className="block w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm outline-none appearance-none cursor-pointer font-semibold"
                >
                  <option value="">Select State</option>
                  {Object.keys(indiaData).map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                  <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
              
              <div className="relative flex-1 min-w-[200px]">
                <select 
                  value={selectedDistrict} 
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  disabled={!selectedState}
                  className="block w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm outline-none appearance-none cursor-pointer font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select District / Area</option>
                  {selectedState && indiaData[selectedState].map(dist => (
                    <option key={dist} value={dist}>{dist}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                  <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>
          </div>

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
          
          {loading ? (
             <div className="flex justify-center items-center py-24">
                <svg className="animate-spin h-10 w-10 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
             </div>
          ) : !selectedState || !selectedDistrict ? (
            <div className="col-span-full flex flex-col items-center justify-center py-24 px-6 bg-white/50 backdrop-blur-sm rounded-[3rem] border border-gray-200 shadow-sm mt-8">
               <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-orange-50 rounded-3xl flex items-center justify-center mb-6 shadow-inner rotate-3">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-orange-400 opacity-80 border-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
               </div>
               <h3 className="text-2xl font-bold text-gray-700 mb-2">Select your territory</h3>
               <p className="text-gray-500 text-center font-medium max-w-sm">Please select a State and District to view dispatched waste clearance requests in your jurisdiction.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredRequests.length > 0 ? (
                filteredRequests.map(req => (
                  <div key={req._id} className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden hover:shadow-[0_20px_40px_rgba(249,115,22,0.12)] hover:-translate-y-2 transition-all duration-300 group flex flex-col">
                    {/* Image Area */}
                    <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden border-b border-gray-100 group-hover:opacity-95 p-4 flex flex-col justify-center">
                      {!req.hasImage && !req.hasResolvedImage ? (
                        <div className="w-full h-full bg-gray-100/50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200">
                           <span className="text-gray-400 font-bold text-sm">No Image</span>
                        </div>
                      ) : visibleImages[req._id] ? (
                        <div className="relative w-full h-full flex gap-2 rounded-2xl overflow-hidden shadow-sm animate-fade-in bg-gray-900 p-1">
                          {imageUrls[req._id] && (
                            <div className="flex-1 relative group/img bg-black/20 rounded-xl overflow-hidden">
                              <img src={imageUrls[req._id]} alt="Before" className="w-full h-full object-contain" />
                              <div className="absolute top-2 left-2 z-10 bg-red-500/90 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded backdrop-blur-sm shadow-sm pointer-events-none">Before</div>
                            </div>
                          )}
                          {resolvedImageUrls[req._id] && (
                            <div className="flex-1 relative group/img bg-black/20 rounded-xl overflow-hidden">
                              <img src={resolvedImageUrls[req._id]} alt="After" className="w-full h-full object-contain" />
                              <div className="absolute top-2 left-2 z-10 bg-green-500/90 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded backdrop-blur-sm shadow-sm pointer-events-none">After</div>
                            </div>
                          )}
                          <button
                            onClick={() => toggleImage(req)}
                            className="absolute top-3 right-3 bg-red-500/90 text-white rounded-full p-2 hover:bg-red-600 backdrop-blur-sm shadow-lg transition-all z-20"
                            title="Hide Images"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          </button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => toggleImage(req)}
                          className="w-full h-full bg-orange-50/50 flex flex-col items-center justify-center rounded-2xl cursor-pointer hover:bg-orange-100/60 transition-all border-2 border-dashed border-orange-200/60 group-hover:border-orange-300"
                        >
                          <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 text-orange-500">
                            {loadingImages[req._id] ? (
                               <svg className="animate-spin h-6 w-6 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            )}
                          </div>
                          <span className="text-orange-600 font-bold text-sm">
                            {loadingImages[req._id] ? 'Loading Image...' : 'Review Image Evidence'}
                          </span>
                        </div>
                      )}
                      
                      <div className="absolute top-6 left-6 z-10">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-sm backdrop-blur-md bg-blue-100/90 text-blue-700 border border-blue-200 pointer-events-none">
                              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                              {req.status}
                          </span>
                      </div>
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="font-black text-gray-800 text-xl leading-snug line-clamp-2 mb-2">{req.title}</h3>
                      <p className="text-gray-500 mb-6 line-clamp-2 leading-relaxed flex-1 font-medium">{req.description}</p>
                      
                      <div className="space-y-3 mt-auto mb-6">
                        <div className="flex items-center gap-3 text-gray-700 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm text-emerald-500 border border-gray-50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                          </div>
                          <div className="flex flex-col justify-center">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Category</span>
                            <span className="font-bold text-sm truncate">{req.wasteCategory}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-gray-700 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm text-blue-500 border border-gray-50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </div>
                          <div className="flex flex-col justify-center overflow-hidden">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Exact Location</span>
                            <span className="font-bold text-sm truncate whitespace-normal leading-tight" title={req.location}>{req.location}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="relative w-full">
                        {req.status === 'Resolved' ? (
                          <div className="w-full bg-emerald-50 text-emerald-700 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-emerald-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Task Completed
                          </div>
                        ) : verifiedCleanRequests[req._id] ? (
                          <div className="flex flex-col gap-4 w-full">

                            <div className="relative w-full h-48 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-sm">
                              <img 
                                src={verifiedCleanRequests[req._id]} 
                                alt="Verified Clean Area" 
                                className="w-full h-full object-cover" 
                              />
                              <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded backdrop-blur-sm shadow-sm pointer-events-none flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Verified Clean
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                              <button
                                onClick={() => {
                                  setVerifiedCleanRequests(prev => {
                                    const newState = { ...prev };
                                    delete newState[req._id];
                                    return newState;
                                  });
                                }}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 border border-gray-200 whitespace-nowrap"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Retake
                              </button>

                              <button
                                onClick={() => {
                                  updateStatus(req._id, 'Resolved', verifiedCleanRequests[req._id]);
                                }}
                                className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-[0_4px_14px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2 whitespace-nowrap"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Mark as Resolved
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <input 
                              type="file" 
                              id={`upload-${req._id}`} 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => handleVerifyCleanAndComplete(e, req._id)} 
                              disabled={uploadingVerify && verifyModalId === req._id}
                            />
                            <label 
                              htmlFor={`upload-${req._id}`}
                              className={`w-full ${uploadingVerify && verifyModalId === req._id ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 cursor-pointer'} text-white font-bold py-3 rounded-xl transition-all shadow-[0_4px_14px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2`}
                            >
                              {uploadingVerify && verifyModalId === req._id ? (
                                <>
                                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  Verifying...
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                  Upload Image to Verify
                                </>
                              )}
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center py-24 px-6 bg-white/50 backdrop-blur-sm rounded-[3rem] border border-gray-200 shadow-sm mt-4">
                   <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-green-50 rounded-3xl flex items-center justify-center mb-6 shadow-inner rotate-3">
                     <span className="text-5xl opacity-80">🎉</span>
                   </div>
                   <h3 className="text-2xl font-bold text-gray-700 mb-2">No pending tasks!</h3>
                   <p className="text-gray-500 text-center font-medium max-w-sm">There are currently no active waste dispatch orders for this region. Great job!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
