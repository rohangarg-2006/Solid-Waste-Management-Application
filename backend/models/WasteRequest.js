const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String, 
        required: true 
    },
    wasteCategory: {
        type: String,
        enum: ['Municipal Solid Waste', 'Hazardous', 'Recyclable', 'Biomedical', 'E-Waste'],
        required: true
    },
    location: { 
        type: String, 
        required: true 
    },
    image: {
        type: String, // We will store the base64 encoded image or URL here
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Dispatched', 'Resolved'],
        default: 'Pending',
        index: true
    },
    resolvedImage: {
        type: String // Optional: Store the base64 encoded clean image
    },
    citizenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // This creates a relationship between the Request and the User
        required: true,
        index: true
    },
    dispatchedAt: {
        type: Date
    },
    resolvedAt: {
        type: Date
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('WasteRequest', requestSchema);
