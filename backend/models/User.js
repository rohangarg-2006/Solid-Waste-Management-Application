const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true // Ensures no two users can register with the same email
    },
    password: { 
        type: String, 
        required: true 
    },
    role: {
        type: String,
        enum: ['citizen', 'manager', 'worker'],
        default: 'citizen'
    }
}, { 
    timestamps: true // Automatically adds createdAt and updatedAt fields
});

module.exports = mongoose.model('User', userSchema);
