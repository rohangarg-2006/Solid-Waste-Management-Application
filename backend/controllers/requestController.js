const WasteRequest = require('../models/WasteRequest');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// @desc    Create a new waste request
// @route   POST /api/v1/requests
// @access  Private (Citizen or Manager)
const createRequest = async (req, res) => {
    try {
        const { title, description, wasteCategory, location, image } = req.body;

        if (image) {
            // Predict if image is Clean or Dirty
            const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
            const os = require('os');
            const tempDir = path.join(os.tmpdir(), 'waste_management_temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const tempImagePath = path.join(tempDir, `temp_${Date.now()}.png`);
            fs.writeFileSync(tempImagePath, base64Data, { encoding: 'base64' });

            try {
                // Call our local Python prediction server
                const mlServerUrl = process.env.ML_SERVER_URL || 'http://127.0.0.1:5001';
                const response = await axios.post(`${mlServerUrl}/predict`, {
                    image_base64: base64Data
                });
                
                const finalOutput = response.data.prediction;

                // Delete temp image
                if (fs.existsSync(tempImagePath)) {
                    fs.unlinkSync(tempImagePath);
                }
                
                if (finalOutput === 'Clean') {
                    // Prevent submission
                    return res.status(400).json({ success: false, message: 'Image uploaded is Clean. Request cannot be submitted.', prediction: 'Clean' });
                } else if (finalOutput === 'Dirty') {
                    // Continue saving
                    const newRequest = await WasteRequest.create({
                        title,
                        description,
                        wasteCategory,
                        location,
                        image,
                        citizenId: req.user._id
                    });

                    return res.status(201).json({ success: true, prediction: 'Dirty', data: newRequest });
                } else {
                    return res.status(500).json({ success: false, message: 'Prediction gave an unknown result', error: finalOutput });
                }
            } catch (pyError) {
                // Delete temp image if error occurs
                if (fs.existsSync(tempImagePath)) {
                    fs.unlinkSync(tempImagePath);
                }
                console.error("Prediction Server Error:", pyError.message);
                return res.status(500).json({ success: false, message: 'Prediction server failed. Ensure python server is running.', error: pyError.message });
            }
        } else {
            // No image logic
            const newRequest = await WasteRequest.create({
                title,
                description,
                wasteCategory,
                location,
                image,
                citizenId: req.user._id
            });
            return res.status(201).json({ success: true, data: newRequest });
        }
    } catch (error) {
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Server Error', error: error.message });
        }
    }
};

// @desc    Verify if an uploaded image is clean or dirty for the worker
// @route   POST /api/v1/requests/verify-clean
// @access  Private
const verifyCleanImage = async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ success: false, message: 'No image provided' });
        }

        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const os = require('os');
        const tempDir = path.join(os.tmpdir(), 'waste_management_temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const tempImagePath = path.join(tempDir, `temp_worker_${Date.now()}.png`);
        fs.writeFileSync(tempImagePath, base64Data, { encoding: 'base64' });

        try {
            const mlServerUrl = process.env.ML_SERVER_URL || 'http://127.0.0.1:5001';
            const response = await axios.post(`${mlServerUrl}/predict`, {
                image_base64: base64Data
            });
            const finalOutput = response.data.prediction;

            if (fs.existsSync(tempImagePath)) {
                fs.unlinkSync(tempImagePath);
            }

            return res.status(200).json({ success: true, prediction: finalOutput });
        } catch (pyError) {
            if (fs.existsSync(tempImagePath)) {
                fs.unlinkSync(tempImagePath);
            }
            console.error("Prediction Server Error:", pyError.message);
            return res.status(500).json({ success: false, message: 'Prediction server failed.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get waste requests (Citizens see their own, Managers see all)
// @route   GET /api/v1/requests
// @access  Private
const getRequests = async (req, res) => {
    try {
        let requests;

        if (req.user.role === 'manager' || req.user.role === 'worker') {
            // Managers (and workers) see everything. Use .lean() for faster execution and sorting by latest
            requests = await WasteRequest.find()
                .select('-image -resolvedImage')
                .populate('citizenId', 'name email')
                .sort({ createdAt: -1 })
                .lean();
        } else {
            // Citizens only see their own requests. Use .lean() for performance
            requests = await WasteRequest.find({ citizenId: req.user._id })
                .select('-image -resolvedImage')
                .sort({ createdAt: -1 })
                .lean();
        }

        // Fast way to determine which requests have images without loading the massive string
        const reqsWithImages = await WasteRequest.find({ image: { $exists: true, $ne: null } }).select('_id').lean();
        const idsWithImages = new Set(reqsWithImages.map(r => r._id.toString()));

        const reqsWithResolvedImages = await WasteRequest.find({ resolvedImage: { $exists: true, $ne: null } }).select('_id').lean();
        const idsWithResolvedImages = new Set(reqsWithResolvedImages.map(r => r._id.toString()));

        requests = requests.map(req => ({
            ...req,
            hasImage: idsWithImages.has(req._id.toString()),
            hasResolvedImage: idsWithResolvedImages.has(req._id.toString())
        }));

        res.status(200).json({ success: true, count: requests.length, data: requests });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Update request status
// @route   PUT /api/v1/requests/:id
// @access  Private (Manager Only)
const updateRequestStatus = async (req, res) => {
    try {
        const { status, resolvedImage } = req.body;

        // Ensure the status is valid
        if (!['Pending', 'Dispatched', 'Resolved'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const updateData = { status };
        if (status === 'Dispatched') {
            updateData.dispatchedAt = Date.now();
        } else if (status === 'Resolved') {
            updateData.resolvedAt = Date.now();
            if (resolvedImage) {
                updateData.resolvedImage = resolvedImage;
            }
        }

        const request = await WasteRequest.findByIdAndUpdate(
            req.params.id,
            updateData,
            { returnDocument: 'after', runValidators: true }
        );

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        res.status(200).json({ success: true, data: request });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Delete a waste request
// @route   DELETE /api/v1/requests/:id
// @access  Private (Citizen or Manager)
const deleteRequest = async (req, res) => {
    try {
        const request = await WasteRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Make sure user owns the request or is a manager
        if (request.citizenId.toString() !== req.user.id && req.user.role !== 'manager') {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this request' });
        }

        await request.deleteOne();

        res.status(200).json({ success: true, message: 'Request deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get single waste request
// @route   GET /api/v1/requests/:id
// @access  Private
const getRequest = async (req, res) => {
    try {
        const request = await WasteRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Make sure user owns the request or is a manager/worker
        if (request.citizenId.toString() !== req.user.id && req.user.role !== 'manager' && req.user.role !== 'worker') {
            return res.status(403).json({ success: false, message: 'Not authorized to view this request' });
        }

        res.status(200).json({ success: true, data: request });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = {
    createRequest,
    getRequests,
    getRequest,
    updateRequestStatus,
    deleteRequest,
    verifyCleanImage
};
