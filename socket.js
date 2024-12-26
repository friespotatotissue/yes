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
    
    // Initialize socket with correct configuration
    this.socket = io(window.location.origin, {
        transports: ['websocket'],
        upgrade: false,
        forceNew: true,
        reconnection: true,
        reconnectionDelay: 1000,
        timeout: 30000
    });

    this.bindEventListeners();
};

MPPClient.prototype.bindEventListeners = function() {
    var self = this;

    this.socket.on('connect', function() {
        console.log('Connected to server');
        self.connectionTime = Date.now();
        self.canConnect = true;
        self.participantId = self.socket.id;
        
        // Start ping interval
        if(self.pingInterval) clearInterval(self.pingInterval);
        self.pingInterval = setInterval(function() {
            self.socket.emit('t1', Date.now());
        }, 20000);
        
        // Join channel
        if(self.channel) {
            self.socket.emit('ch', {_id: self.channel._id});
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

MPPClient.prototype.setChannel = function(id, settings) {
    if(!this.canConnect) return;
    if(typeof id !== 'string') return;
    if(!settings) settings = {};
    var channel = {_id: id, settings: settings};
    this.channel = channel;
    if(this.socket && this.socket.connected) {
        this.socket.emit('ch', {_id: id, set: settings});
    }
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
    return this.channel && this.channel.settings.crownsolo && !this.isOwner();
};

MPPClient.prototype.startNote = function(note, vel) {
    if(!this.canConnect || !this.socket.connected) return;
    
    var msg = {
        n: note,
        v: vel
    };

    if(this.noteBufferTime && Date.now() - this.noteBufferTime > 1000) {
        this.noteBufferTime = 0;
        this.noteBuffer = [];
    }

    if(!this.noteBufferTime) {
        this.noteBufferTime = Date.now();
        this.noteBuffer.push(msg);
    } else {
        msg.d = Date.now() - this.noteBufferTime;
        this.noteBuffer.push(msg);
    }

    // Send note immediately
    this.socket.emit('n', {
        t: this.noteBufferTime,
        n: [msg]
    });
};

MPPClient.prototype.stopNote = function(note) {
    if(!this.canConnect || !this.socket.connected) return;
    
    var msg = {
        n: note,
        s: 1
    };

    if(this.noteBufferTime && Date.now() - this.noteBufferTime > 1000) {
        this.noteBufferTime = 0;
        this.noteBuffer = [];
    }

    if(!this.noteBufferTime) {
        this.noteBufferTime = Date.now();
        this.noteBuffer.push(msg);
    } else {
        msg.d = Date.now() - this.noteBufferTime;
        this.noteBuffer.push(msg);
    }

    // Send note immediately
    this.socket.emit('n', {
        t: this.noteBufferTime,
        n: [msg]
    });
};

// EventEmitter implementation
MPPClient.prototype.on = function(event, callback) {
    if(!this._events) this._events = {};
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
    if(!this._events) this._events = {};
    if(!this._events[event]) return;
    var args = Array.prototype.slice.call(arguments, 1);
    for(var i = 0; i < this._events[event].length; i++) {
        this._events[event][i].apply(this, args);
    }
}; 
