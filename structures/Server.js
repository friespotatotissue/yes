const WebSocket = require('ws');
const Participant = require('./Participant');
const Room = require('./Room');
const Socket = require('./Socket');

class Server {
  constructor(io) {
    this.io = io;
    this.sockets = new Set();
    this.participants = new Map();
    this.rooms = new Map();
    this.bindEventListeners();
    console.log('Server Launched');
  }

  bindEventListeners() {
    this.io.on('connection', (socket) => {
      console.log('New connection:', socket.id);
      this.sockets.add(socket);
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        this.sockets.delete(socket);
        this.handleDisconnect(socket);
      });

      // Bind all message handlers
      socket.on('hi', () => this.handleHi(socket));
      socket.on('ch', (msg) => this.handleChannel(socket, msg));
      socket.on('a', (msg) => this.handleChat(socket, msg));
      socket.on('n', (msg) => this.handleNote(socket, msg));
      socket.on('m', (msg) => this.handleMove(socket, msg));
      socket.on('t', (msg) => this.handleTiming(socket, msg));
      socket.on('userset', (msg) => this.handleUserSet(socket, msg));
    });
  }

  handleHi(socket) {
    const p = this.newParticipant(socket);
    socket.emit('hi', {
      m: 'hi',
      u: p.generateJSON(),
      t: Date.now()
    });
  }

  handleChannel(socket, data) {
    const p = this.getParticipant(socket);
    if (!p) return;
    
    // Leave old room
    if (socket.room) {
      socket.leave(socket.room);
      this.io.to(socket.room).emit('bye', socket.id);
    }

    // Join new room
    socket.room = data._id;
    socket.join(data._id);

    let r = this.getRoom(data._id);
    if (!r) r = this.newRoom(data, p);
    
    let pR = r.findParticipant(p._id);
    if (!pR) pR = r.newParticipant(p);
    
    socket.emit('ch', {
      ch: r.generateJSON(),
      p: pR.id,
      ppl: r.ppl
    });
  }

  handleChat(socket, data) {
    const p = this.getParticipant(socket);
    if (!p || !socket.room) return;
    
    const r = this.getRoom(socket.room);
    if (!r) return;
    
    const pR = r.findParticipant(p._id);
    if (!pR) return;

    const msg = {
      m: 'a',
      a: this.removeTextHell(data.message),
      p: pR.generateJSON(),
      t: Date.now()
    };
    
    this.io.to(socket.room).emit('a', msg);
  }

  handleNote(socket, data) {
    const p = this.getParticipant(socket);
    if (!p || !socket.room) return;
    
    const r = this.getRoom(socket.room);
    if (!r) return;
    
    const pR = r.findParticipant(p._id);
    if (!pR) return;

    socket.to(socket.room).emit('n', {
      n: data.n,
      p: pR.id,
      t: data.t
    });
  }

  handleMove(socket, data) {
    const p = this.getParticipant(socket);
    if (!p || !socket.room) return;
    
    const r = this.getRoom(socket.room);
    if (!r) return;
    
    const pR = r.findParticipant(p._id);
    if (!pR) return;

    socket.to(socket.room).emit('m', {
      id: pR.id,
      x: data.x,
      y: data.y
    });
  }

  handleTiming(socket, data) {
    socket.emit('t', {
      m: 't',
      t: Date.now(),
      e: data.e
    });
  }

  handleUserSet(socket, data) {
    if (!data.set) return;
    
    const p = this.getParticipant(socket);
    if (!p) return;
    
    if (data.set.name) {
      p.updateUser(this.removeTextHell(data.set.name));
    }
    
    const r = this.getRoom(socket.room);
    if (!r) return;
    
    const pR = r.findParticipant(p._id);
    if (!pR) return;
    
    this.io.to(socket.room).emit('p', {
      id: pR.id,
      name: p.name,
      color: p.color,
      _id: p._id
    });
  }

  handleDisconnect(socket) {
    const p = this.getParticipant(socket);
    if (p) {
      this.participants.delete(socket.id);
    }
    
    if (socket.room) {
      const r = this.getRoom(socket.room);
      if (r) {
        r.removeParticipant(p._id);
        if (r.count <= 0) {
          this.rooms.delete(socket.room);
        }
        this.io.to(socket.room).emit('bye', socket.id);
      }
    }
  }

  removeTextHell(text) {
    return text.replace(/[^\w\s`1234567890\-=~!@#$%^&*()_+,.\/<>?\[\]\\\{}|;':"]/g, '');
  }

  // ... rest of your existing methods (newParticipant, getParticipant, newRoom, getRoom) ...
}

module.exports = Server;