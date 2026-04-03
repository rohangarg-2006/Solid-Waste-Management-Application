const User = require('../models/User');

// @desc    Get all users
// @route   GET /api/v1/users
// @access  Private (Manager only)
const getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Update user role
// @route   PUT /api/v1/users/:id/role
// @access  Private (Manager only)
const updateUserRole = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.role = req.body.role || (user.role === 'manager' ? 'citizen' : 'manager');
        await user.save();

        res.status(200).json({ success: true, data: { _id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = { getUsers, updateUserRole };
