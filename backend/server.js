const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const compression = require('compression');
const connectDB = require('./config/db');
const { spawn } = require('child_process');
const path = require('path');

// Load the secret variables from the .env file
dotenv.config();

// Connect to the database
connectDB();

// Initialize the Express application
const app = express();

// Apply compression middleware to drastically reduce payload sizes (especially beneficial for base64 images)
app.use(compression());

// Middleware: Allow our app to accept JSON data and requests from other ports
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

// A simple test route to see if the server is alive
app.get('/', (req, res) => {
    res.send('Solid Waste Management API is running...');
});
// Mount the routes
app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/requests', require('./routes/requestRoutes'));
app.use('/api/v1/users', require('./routes/userRoutes')); 

// Determine the port (use the one from .env, or default to 5000)
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    
    // Start the Python prediction microservice only if an external one isn't provided
    if (!process.env.ML_SERVER_URL) {
        console.log('Starting local Python prediction server...');
        const pythonScriptPath = path.join(__dirname, 'ML_Model', 'prediction_server.py');
        const pythonCmd = process.platform === "win32" ? "python" : "python3";
        const pythonServer = spawn(pythonCmd, [pythonScriptPath, '5001']);

        pythonServer.stdout.on('data', (data) => {
            console.log(`[PyServer] ${data.toString().trim()}`);
        });
        
        pythonServer.stderr.on('data', (data) => {
            console.error(`[PyServer Error] ${data.toString().trim()}`);
        });

        pythonServer.on('error', (error) => {
            console.error(`Failed to start Python server process: ${error.message}`);
            console.error('Make sure Python is installed and accessible in the system path of your deployment environment.');
        });

        // Clean up the child process if the Node server shuts down
        process.on('exit', () => { if (pythonServer) pythonServer.kill(); });
        process.on('SIGINT', () => { if (pythonServer) pythonServer.kill(); process.exit(); });
        process.on('SIGTERM', () => { if (pythonServer) pythonServer.kill(); process.exit(); });
    } else {
        console.log(`Using external Python prediction server at: ${process.env.ML_SERVER_URL}`);
    }
});
