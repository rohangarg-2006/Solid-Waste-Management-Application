const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to protect routes (Requires a valid JWT)
const protect = async (req, res, next) => {
    let token;

    // 1. Check if the authorization header exists and starts with 'Bearer'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 2. Extract the token from the header (Format: "Bearer <token>")
            token = req.headers.authorization.split(' ')[1];

            // 3. Verify the token using your secret key
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 4. Find the user in the database using the ID embedded in the token
            // .select('-password') ensures we don't accidentally pass the password hash along
            req.user = await User.findById(decoded.id).select('-password');

            // 5. Move on to the next piece of middleware or the controller
            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ success: false, message: 'Not authorized, token failed' });
        }
    }

    // If no token was found at all
    if (!token) {
        res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
    }
};

// Middleware to restrict access to managers (admins) only
const managerOnly = (req, res, next) => {
    // Check if a user exists on the request AND their role is 'manager'
    if (req.user && req.user.role === 'manager') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Access denied. Manager role required.' });
    }
};

const managerOrWorker = (req, res, next) => {
    if (req.user && (req.user.role === 'manager' || req.user.role === 'worker')) {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Access denied. Manager or Worker role required.' });
    }
};

module.exports = { protect, managerOnly, managerOrWorker };
