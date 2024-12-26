const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const Server = require('./structures/Server');

// Serve static files
app.use(express.static(path.join(__dirname)));

// Initialize WebSocket server
const server = new Server(io);

const port = process.env.PORT || 8080;
http.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 