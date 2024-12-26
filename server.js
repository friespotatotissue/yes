const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const path = require('path');

// Serve static files
app.use(express.static(path.join(__dirname)));

// Global state
const rooms = new Map();
const participants = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Initialize participant
    participants.set(socket.id, {
        id: socket.id,
        name: 'Anonymous',
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
        x: 50,
        y: 50
    });

    // Send initial hi message
    socket.emit('hi', {
        t: Date.now(),
        u: participants.get(socket.id)
    });

    // Handle timing
    socket.on('t1', () => {
        socket.emit('t2', Date.now());
    });

    // Handle channel join
    socket.on('ch', (msg) => {
        // Leave previous room if any
        if (socket.room) {
            socket.leave(socket.room);
            io.to(socket.room).emit('bye', socket.id);
        }

        // Join new room
        socket.room = msg._id;
        socket.join(msg._id);

        // Create room if doesn't exist
        if (!rooms.has(msg._id)) {
            rooms.set(msg._id, {
                _id: msg._id,
                settings: msg.set || {
                    visible: true,
                    chat: true,
                    crownsolo: false
                },
                crown: null,
                ppl: []
            });
        }

        const room = rooms.get(msg._id);
        const participant = participants.get(socket.id);

        // Add participant to room
        if (!room.ppl.find(p => p.id === socket.id)) {
            room.ppl.push(participant);
        }

        // Set crown if room is empty
        if (room.ppl.length === 1 && !room.crown) {
            room.crown = {
                participantId: socket.id,
                userId: socket.id,
                time: Date.now()
            };
        }

        // Send room info to participant
        socket.emit('ch', {
            ch: room,
            ppl: room.ppl,
            p: socket.id
        });

        // Notify others
        socket.to(msg._id).emit('p', participant);

        // Update participant count
        io.to(msg._id).emit('count', room.ppl.length);
    });

    // Handle notes
    socket.on('n', (msg) => {
        if (!socket.room) return;
        
        socket.to(socket.room).emit('n', {
            n: msg.n,
            p: socket.id,
            t: msg.t
        });
    });

    // Handle cursor movement
    socket.on('m', (msg) => {
        if (!socket.room) return;
        
        const participant = participants.get(socket.id);
        if (participant) {
            participant.x = msg.x;
            participant.y = msg.y;
            socket.to(socket.room).emit('m', {
                id: socket.id,
                x: msg.x,
                y: msg.y
            });
        }
    });

    // Handle chat
    socket.on('a', (msg) => {
        if (!socket.room) return;
        
        const participant = participants.get(socket.id);
        io.to(socket.room).emit('a', {
            a: msg.message,
            p: participant,
            t: Date.now()
        });
    });

    // Handle user settings
    socket.on('userset', (msg) => {
        if (!msg.set) return;
        
        const participant = participants.get(socket.id);
        if (participant) {
            if (msg.set.name) participant.name = msg.set.name;
            if (msg.set.color) participant.color = msg.set.color;
            
            if (socket.room) {
                io.to(socket.room).emit('p', participant);
            }
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        if (socket.room) {
            const room = rooms.get(socket.room);
            if (room) {
                // Remove from room
                room.ppl = room.ppl.filter(p => p.id !== socket.id);
                
                // Remove crown if user was owner
                if (room.crown && room.crown.participantId === socket.id) {
                    room.crown = null;
                }
                
                // Delete room if empty
                if (room.ppl.length === 0) {
                    rooms.delete(socket.room);
                }
                
                // Notify others
                io.to(socket.room).emit('bye', socket.id);
                io.to(socket.room).emit('count', room.ppl.length);
            }
        }
        
        // Remove participant
        participants.delete(socket.id);
    });
});

// Start server
const port = process.env.PORT || 3000;
http.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 