const { body, validationResult } = require('express-validator');

// Validation middleware for user registration
const validateRegister = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email')
        .trim()
        .isEmail().withMessage('Please provide a valid email address'),
    body('password')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone')
        .optional()
        .trim()
        .matches(/^\d{10}$/).withMessage('Phone number must be 10 digits')
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }
    next();
};

// Validation middleware for waste requests
const validateWasteRequest = [
    body('title')
        .trim()
        .notEmpty().withMessage('Title is required')
        .isLength({ max: 100 }).withMessage('Title must be less than 100 characters'),
    body('description')
        .trim()
        .notEmpty().withMessage('Description is required'),
    body('wasteCategory')
        .notEmpty().withMessage('Waste category is required')
        .isIn(['Municipal Solid Waste', 'Hazardous', 'Recyclable', 'Biomedical', 'E-Waste'])
        .withMessage('Invalid waste category'),
    body('location')
        .trim()
        .notEmpty().withMessage('Location is required')
];

module.exports = {
    validateRegister,
    validateWasteRequest,
    handleValidationErrors
};
