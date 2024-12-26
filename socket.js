// Socket.IO implementation
var MPPClient = function() {
    this.serverTimeOffset = 0;
    this.channel = null;
    this.participantId = null;
    this.participants = {};
    this.connectionTime = null;
    this.pingInterval = null;
    this.canConnect = false;
    this.noteBuffer = [];
    this.noteBufferTime = 0;
    this.noteFlushInterval = null;
    this._events = {};
    
    var self = this;
    
    // Initialize socket with correct configuration
    this.socket = io(window.location.origin, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        forceNew: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 30000
    });

    this.bindEventListeners();

    // Initialize note flush interval
    this.noteFlushInterval = setInterval(function() {
        if(self.noteBuffer.length === 0) return;
        
        var timeDiff = Date.now() - self.noteBufferTime;
        if(timeDiff >= 200) { // Flush every 200ms
            self.socket.emit('n', {
                t: self.noteBufferTime,
                n: self.noteBuffer,
                room: self.channel
            });
            self.noteBuffer = [];
        }
    }, 200);
};

MPPClient.prototype.bindEventListeners = function() {
    var self = this;

    this.socket.on('connect', function() {
        console.log('Connected to server');
        self.connectionTime = Date.now();
        self.canConnect = true;
        self.participantId = self.socket.id;
        
        // Initialize own participant
        self.participants[self.participantId] = {
            id: self.participantId,
            name: "Anonymous",
            color: "#fff",
            x: 50,
            y: 50
        };
        
        // Start ping interval
        if(self.pingInterval) clearInterval(self.pingInterval);
        self.pingInterval = setInterval(function() {
            self.socket.emit('t1', Date.now());
        }, 20000);
        
        // Join channel if one is set
        if(self.channel) {
            self.setChannel(self.channel);
        }

        self.emit('connect');
    });

    this.socket.on('disconnect', function() {
        console.log('Disconnected from server');
        self.participantId = null;
        self.canConnect = false;
        if(self.pingInterval) clearInterval(self.pingInterval);
        if(self.noteFlushInterval) clearInterval(self.noteFlushInterval);
        self.emit('disconnect');
    });

    this.socket.on('t2', function(t1) {
        self.serverTimeOffset = Date.now() - t1;
    });

    this.socket.on('n', function(msg) {
        self.emit('n', msg);
    });

    this.socket.on('ch', function(msg) {
        self.channel = msg.ch;
        self.emit('ch', msg);
    });

    this.socket.on('p', function(msg) {
        self.participants[msg.id] = msg;
        self.emit('participant added', msg);
    });

    this.socket.on('bye', function(id) {
        var part = self.participants[id];
        if(part) {
            delete self.participants[id];
            self.emit('participant removed', part);
        }
    });

    // Handle status updates
    this.socket.on('status', function(msg) {
        self.emit('status', msg);
    });

    // Handle count updates
    this.socket.on('count', function(msg) {
        self.emit('count', msg);
    });

    // Handle chat messages
    this.socket.on('a', function(msg) {
        self.emit('a', msg);
    });

    // Handle errors
    this.socket.on('error', function(err) {
        console.error('Socket error:', err);
        self.emit('error', err);
    });
};

MPPClient.prototype.setChannel = function(channelId, callback) {
    if(!this.canConnect || !channelId) return;
    
    var self = this;
    this.channel = channelId;
    this.socket.emit('ch', {_id: channelId}, function(err, data) {
        if(err) {
            console.error(err);
            if(callback) callback(err);
            return;
        }
        self.participants = {};
        if(data.p) data.p.forEach(function(p) {
            self.participants[p.id] = p;
        });
        if(callback) callback(null, data);
    });
};

MPPClient.prototype.sendArray = function(arr) {
    if(!this.canConnect || !this.socket.connected) return;
    for(var i = 0; i < arr.length; i++) {
        this.socket.emit(arr[i].m, arr[i]);
    }
};

MPPClient.prototype.isOwner = function() {
    return this.channel && this.channel.crown && this.channel.crown.participantId === this.participantId;
};

MPPClient.prototype.preventsPlaying = function() {
    return !this.canConnect || !this.channel || !this.participantId;
};

MPPClient.prototype.startNote = function(note, vel) {
    if(this.noteBuffer.length === 0) {
        this.noteBufferTime = Date.now();
        this.noteBuffer.push({n: note, v: vel});
    }
};

MPPClient.prototype.stopNote = function(note) {
    if(!this.canConnect || !this.socket.connected) return;
    
    var msg = {
        n: note,
        s: 1,
        room: this.channel._id
    };

    // Send note immediately
    this.socket.emit('n', {
        t: Date.now(),
        n: [msg],
        room: this.channel._id
    });
};

// EventEmitter implementation
MPPClient.prototype.on = function(event, callback) {
    if(!this._events[event]) this._events[event] = [];
    this._events[event].push(callback);
};

MPPClient.prototype.off = function(event, callback) {
    if(!this._events) this._events = {};
    if(!this._events[event]) return;
    var i = this._events[event].indexOf(callback);
    if(i !== -1) this._events[event].splice(i, 1);
};

MPPClient.prototype.emit = function(event) {
    if(!this._events[event]) return;
    var args = Array.prototype.slice.call(arguments, 1);
    for(var i = 0; i < this._events[event].length; i++) {
        this._events[event][i].apply(this, args);
    }
};

MPPClient.prototype.getOwnParticipant = function() {
    return this.participants[this.participantId];
};

MPPClient.prototype.startNote = function(note, vel) {
    if(this.noteBuffer.length === 0) {
        this.noteBufferTime = Date.now();
        this.noteBuffer.push({n: note, v: vel});
    }
};

MPPClient.prototype.setChannel = function(channelId, callback) {
    if(!this.canConnect || !channelId) return;
    
    var self = this;
    this.channel = channelId;
    this.socket.emit('ch', {_id: channelId}, function(err, data) {
        if(err) {
            console.error(err);
            if(callback) callback(err);
            return;
        }
        self.participants = {};
        if(data.p) data.p.forEach(function(p) {
            self.participants[p.id] = p;
        });
        if(callback) callback(null, data);
    });
};

MPPClient.prototype.bindEventListeners = function() {
    var self = this;

    this.socket.on('connect', function() {
        console.log('Connected to server');
        self.connectionTime = Date.now();
        self.canConnect = true;
        self.participantId = self.socket.id;
        
        // Initialize own participant
        self.participants[self.participantId] = {
            id: self.participantId,
            name: "Anonymous",
            color: "#fff",
            x: 50,
            y: 50
        };
        
        // Start ping interval
        if(self.pingInterval) clearInterval(self.pingInterval);
        self.pingInterval = setInterval(function() {
            self.socket.emit('t1', Date.now());
        }, 20000);
        
        // Join channel if one is set
        if(self.channel) {
            self.setChannel(self.channel);
        }

        self.emit('connect');
    });

    this.socket.on('disconnect', function() {
        console.log('Disconnected from server');
        self.participantId = null;
        self.canConnect = false;
        if(self.pingInterval) clearInterval(self.pingInterval);
        if(self.noteFlushInterval) clearInterval(self.noteFlushInterval);
        self.emit('disconnect');
    });

    this.socket.on('t2', function(t1) {
        self.serverTimeOffset = Date.now() - t1;
    });

    this.socket.on('n', function(msg) {
        self.emit('n', msg);
    });

    this.socket.on('ch', function(msg) {
        self.channel = msg.ch;
        self.emit('ch', msg);
    });

    this.socket.on('p', function(msg) {
        self.participants[msg.id] = msg;
        self.emit('participant added', msg);
    });

    this.socket.on('bye', function(id) {
        var part = self.participants[id];
        if(part) {
            delete self.participants[id];
            self.emit('participant removed', part);
        }
    });

    // Handle status updates
    this.socket.on('status', function(msg) {
        self.emit('status', msg);
    });

    // Handle count updates
    this.socket.on('count', function(msg) {
        self.emit('count', msg);
    });

    // Handle chat messages
    this.socket.on('a', function(msg) {
        self.emit('a', msg);
    });

    // Handle errors
    this.socket.on('error', function(err) {
        console.error('Socket error:', err);
        self.emit('error', err);
    });
}; 
