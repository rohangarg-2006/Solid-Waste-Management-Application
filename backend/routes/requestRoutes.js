const express = require('express');
const router = express.Router();
const {
    createRequest,
    getRequests,
    getRequest,
    updateRequestStatus,
    deleteRequest,
    verifyCleanImage
} = require('../controllers/requestController');

// Import our security middlewares and validators
const { protect, managerOnly, managerOrWorker } = require('../middleware/authMiddleware');
const { validateWasteRequest, handleValidationErrors } = require('../middleware/validators');

router.post('/verify-clean', protect, verifyCleanImage);

// Route to get requests and create a new request
// Notice how BOTH require the user to be logged in (protect)
router.route('/')
    .get(protect, getRequests)
    .post(protect, ...validateWasteRequest, handleValidationErrors, createRequest);

// Route to update and delete specific requests by ID
// Notice how update requires BOTH protect AND managerOrWorker, but delete requires only protect
router.route('/:id')
    .get(protect, getRequest)
    .put(protect, managerOrWorker, updateRequestStatus)
    .delete(protect, deleteRequest);

module.exports = router;
