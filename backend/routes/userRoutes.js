const express = require('express');
const router = express.Router();
const { getUsers, updateUserRole } = require('../controllers/userController');
const { protect, managerOnly } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, managerOnly, getUsers);

router.route('/:id/role')
    .put(protect, managerOnly, updateUserRole);

module.exports = router;
