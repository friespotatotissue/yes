const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files
app.use(express.static(path.join(__dirname)));

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle channel join
    socket.on('ch', (msg) => {
        socket.join(msg._id);
        socket.emit('ch', { ch: { _id: msg._id, settings: {} } });
    });

    // Handle notes
    socket.on('n', (msg) => {
        socket.to(msg.room).emit('n', {
            n: msg.n,
            p: socket.id,
            t: msg.t
        });
    });

    // Handle chat
    socket.on('a', (msg) => {
        io.to(msg.room).emit('a', {
            a: msg.message,
            p: { name: socket.id, color: '#000000' },
            t: Date.now()
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start server
const port = process.env.PORT || 3000;
http.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 