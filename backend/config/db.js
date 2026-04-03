const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // This line connects to the URI we saved in the .env file
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected Successfully ✅`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1); // Stop the app if the database fails to connect
    }
};

module.exports = connectDB;
