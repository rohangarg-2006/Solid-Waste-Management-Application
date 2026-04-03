const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController');
const { validateRegister, handleValidationErrors } = require('../middleware/validators');

// Route for User Registration (Includes validation)
router.post('/register', ...validateRegister, handleValidationErrors, registerUser);

// Route for User Login (We can add login validation later, keeping it simple for now)
router.post('/login', loginUser);

module.exports = router;
