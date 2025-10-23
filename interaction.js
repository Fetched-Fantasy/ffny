// interaction.js
'use strict';

// Load persisted camera settings (if any)
var cameraInertia = parseFloat(localStorage.getItem('ffny.inertia')) || 0.02;
var cameraAngularSensibility = parseInt(localStorage.getItem('ffny.angularSensibility')) || 800;

// Create and insert canvas
var canvas = document.createElement('canvas');
canvas.className = 'game-canvas';
var gameRoot = document.getElementById('game-root');
if (gameRoot) {
  gameRoot.appendChild(canvas);
}

// Create mobile controls
var mobileControls = document.createElement('div');
mobileControls.className = 'mobile-controls';
mobileControls.innerHTML = `
  <div class="mobile-controls-wrapper">
    <button class="mobile-button up">⬆</button>
    <button class="mobile-button left">⬅</button>
    <button class="mobile-button down">⬇</button>
    <button class="mobile-button right">➡</button>
  </div>
`;
document.body.appendChild(mobileControls);

// Mobile controls state
var mobileButtonStates = {
    up: false,
    down: false,
    left: false,
    right: false
};

// Babylon engine and scene
var engine = new BABYLON.Engine(canvas, true);

var camera; // exposed for settings to modify
var createScene = function () {
    var scene = new BABYLON.Scene(engine);
    scene.gravity = new BABYLON.Vector3(0, -0.9, 0);
    scene.collisionsEnabled = true;
    camera = new BABYLON.FreeCamera('camera1', new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new BABYLON.Vector3(1, 1, 1);
    camera.speed = 0.2;

    // Apply persisted/default settings
    camera.inertia = cameraInertia;
    if (typeof camera.angularSensibility !== 'undefined') {
        camera.angularSensibility = cameraAngularSensibility;
    }

    // WASD controls
    camera.keysUp = [87]; // W
    camera.keysDown = [83]; // S
    camera.keysLeft = [65]; // A
    camera.keysRight = [68]; // D

    // Setup mobile controls
    var mobileButtons = mobileControls.querySelectorAll('.mobile-button');
    mobileButtons.forEach(function(button) {
        var direction = button.className.split(' ')[1]; // up, down, left, or right
        
        // Touch events
        button.addEventListener('touchstart', function(e) {
            e.preventDefault();
            mobileButtonStates[direction] = true;
            switch(direction) {
                case 'up': camera._keys[87] = true; break; // W
                case 'down': camera._keys[83] = true; break; // S
                case 'left': camera._keys[65] = true; break; // A
                case 'right': camera._keys[68] = true; break; // D
            }
        }, false);
        
        button.addEventListener('touchend', function(e) {
            e.preventDefault();
            mobileButtonStates[direction] = false;
            switch(direction) {
                case 'up': camera._keys[87] = false; break;
                case 'down': camera._keys[83] = false; break;
                case 'left': camera._keys[65] = false; break;
                case 'right': camera._keys[68] = false; break;
            }
        }, false);

        // Mouse events for testing on desktop
        button.addEventListener('mousedown', function(e) {
            e.preventDefault();
            mobileButtonStates[direction] = true;
            switch(direction) {
                case 'up': camera._keys[87] = true; break;
                case 'down': camera._keys[83] = true; break;
                case 'left': camera._keys[65] = true; break;
                case 'right': camera._keys[68] = true; break;
            }
        });
        
        button.addEventListener('mouseup', function(e) {
            e.preventDefault();
            mobileButtonStates[direction] = false;
            switch(direction) {
                case 'up': camera._keys[87] = false; break;
                case 'down': camera._keys[83] = false; break;
                case 'left': camera._keys[65] = false; break;
                case 'right': camera._keys[68] = false; break;
            }
        });
    });

    var light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    var material = new BABYLON.StandardMaterial('groundMaterial', scene);
    material.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    material.specularColor = new BABYLON.Color3(0, 0, 0);
    var ground = BABYLON.MeshBuilder.CreateGround('ground1', { width: 20, height: 20, subdivisions: 2 }, scene);
    ground.material = material;
    ground.checkCollisions = true;

    return scene;
};

var scene = createScene();

engine.runRenderLoop(function () {
    // Update remote players (interpolation/extrapolation)
    try { updateRemotePlayers(); } catch (e) { /* ignore until networking initialized */ }
    scene.render();
});

window.addEventListener('resize', function () {
    try { engine.resize(); } catch (e) {}
});

// --------------------
// Networking: Ably signalling + WebRTC DataChannels
// - Uses Ably for signalling (offer/answer/ICE) and optional low-rate relay fallback.
// - DataChannels carry live position updates (JSON) at ~10Hz.
// Paste your Ably API key below.
// --------------------

// Ably configuration
var ABLY_API_KEY = 'XRHh7Q.AYC1KA:pl1HM7BjoJeiHQh1xF2kSShs5Tfy1OKjb1spOnQIQKQ'; // Replace with your Ably API key

var USE_FIRESTORE_FALLBACK = true; // allow low-rate relay via Firestore when DataChannel unavailable
var ROOM_ID = (function(){
    // derive a room id from pathname so pages in same site connect together; change if you want separate rooms
    return 'ffny_room_' + (location.pathname.replace(/\W+/g,'_') || 'default');
})();

// runtime state
var username = localStorage.getItem('ffny.username') || '';
var clientId = null; // Will be set after login
var peers = {}; // remoteId => { pc, dc, buffer: [{t,pos,rot}], mesh }
var ably = null;
var signalChannel = null;
var stateChannel = null;
var joined = false;
var STATE_TTL_MS = 30000; // 30 seconds (used for cleanup)
// HUD / presence UI
var hud = null;

// Login handling
var loginOverlay = document.getElementById('loginOverlay');
var usernameInput = document.getElementById('usernameInput');
var loginButton = document.getElementById('loginButton');
var loginError = document.getElementById('loginError');

function handleLogin() {
    var newUsername = usernameInput.value.trim();
    if (!newUsername) {
        loginError.textContent = 'Please enter a username';
        return;
    }
    if (newUsername.length < 3) {
        loginError.textContent = 'Username must be at least 3 characters';
        return;
    }
    if (newUsername.length > 20) {
        loginError.textContent = 'Username must be less than 20 characters';
        return;
    }
    
    // Clean up any existing connections before changing ID
    if (joined) {
        cleanupOnUnload();
        Object.keys(peers).forEach(function(peerId) {
            removePeer(peerId);
        });
        if (firestore) {
            try {
                signalsRef.add({ type: 'leave', from: clientId, t: Date.now(), to: null }).catch(function(){});
            } catch(e){}
        }
    }
    
    // Store username
    localStorage.setItem('ffny.username', newUsername);
    username = newUsername;
    clientId = username;
    
    // Reset networking state
    joined = false;
    peers = {};
    
    // Hide login
    loginOverlay.style.display = 'none';
    
    // Start game networking
    startNetworking();
}

if (loginButton) {
    loginButton.addEventListener('click', handleLogin);
}

if (usernameInput) {
    usernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
    // Pre-fill username if available
    if (username) {
        usernameInput.value = username;
    }
}

// Don't auto-start networking, wait for login
var shouldAutoStart = !!username;
if (shouldAutoStart) {
    loginOverlay.style.display = 'none';
}

// helper: small random id
function hex8(){
    var a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// Load Ably SDK and initialize connection
function loadAblyAndInit(cb) {
    if (window.Ably) { initAbly(); if (cb) cb(); return; }
    var script = document.createElement('script');
    script.src = 'https://cdn.ably.io/lib/ably.min-1.js';
    script.onload = function() { initAbly(); if (cb) cb(); };
    script.onerror = function() { console.warn('Failed to load Ably script'); if (cb) cb(new Error('ably load failed')); };
    document.head.appendChild(script);
}

function initAbly() {
    try {
        ably = new Ably.Realtime({ key: ABLY_API_KEY, clientId: clientId });
        ably.connection.on('connected', function() {
            console.log('Ably connected');
            signalChannel = ably.channels.get('game:' + ROOM_ID + ':signals');
            stateChannel = ably.channels.get('game:' + ROOM_ID + ':states');
            
            // Subscribe to presence for peer discovery
            signalChannel.presence.subscribe('enter', function(member) {
                if (member.clientId !== clientId) {
                    handlePresence('join', member.clientId);
                }
            });
            
            signalChannel.presence.subscribe('leave', function(member) {
                if (member.clientId !== clientId) {
                    handlePresence('leave', member.clientId);
                }
            });

            // Subscribe to signals
            signalChannel.subscribe(function(msg) {
                // Handle messages addressed to us or broadcast
                if (!msg.data.to || msg.data.to === clientId) {
                    handleSignal(msg.data);
                }
            });

            // Subscribe to state updates
            stateChannel.subscribe(function(msg) {
                if (msg.data.id !== clientId) {
                    handleRemoteState(msg.data, msg.data.id);
                }
            });

            // Enter presence
            signalChannel.presence.enter();
            console.log('Ably initialized for room', ROOM_ID);
            startSignalling();
        });

        ably.connection.on('failed', function() {
            console.warn('Ably connection failed');
        });

    } catch (e) {
        console.warn('Ably init failed', e);
    }
}

// Handle presence events (join/leave)
function handlePresence(type, fromId) {
    if (type === 'join') {
        // Create offer to joining peer if we're the 'greater' ID
        if (clientId > fromId) {
            createOfferTo(fromId);
        }
    } else if (type === 'leave') {
        removePeer(fromId);
    }
}

// Signalling: start presence and handle incoming messages
function startSignalling() {
    if (!signalChannel) return;
    joined = true;
    // We don't need to announce presence as it's handled by Ably presence system
    startStateLoop();
}

function handleSignal(msg){
    if (!msg || !msg.type) return;
    var from = msg.from;
    switch(msg.type){
        case 'join':
            // create an offer to the joining peer (we are the older peer)
            if (from === clientId) return;
            // avoid double-offer: only create offer if our id is lexicographically greater to pick initiator consistently
            if (clientId > from) {
                createOfferTo(from);
            }
            break;
        case 'offer':
            if (msg.to && msg.to !== clientId) return;
            // set remote desc and create answer
            ensurePeer(from, false).then(function(peer){
                var pc = peer.pc;
                pc.setRemoteDescription(new RTCSessionDescription(msg.sdp)).then(function(){
                    return pc.createAnswer();
                }).then(function(answer){
                    return pc.setLocalDescription(answer);
                }).then(function(){
                    // send answer
                    signalsRef.add({ type: 'answer', from: clientId, to: from, sdp: pc.localDescription, t: Date.now() }).catch(()=>{});
                }).catch(function(err){ console.warn('handle offer err', err); });
            });
            break;
        case 'answer':
            if (msg.to && msg.to !== clientId) return;
            if (!peers[from]) return;
            peers[from].pc.setRemoteDescription(new RTCSessionDescription(msg.sdp)).catch(function(e){ console.warn('setRemoteAnswer err', e); });
            break;
        case 'ice':
            if (msg.to && msg.to !== clientId) return;
            if (!peers[from]) {
                // create peer to add candidate after pc created
                ensurePeer(from, false).then(function(){
                    addIceToPeer(from, msg.candidate);
                });
            } else {
                addIceToPeer(from, msg.candidate);
            }
            break;
        case 'relay-state':
            // fallback: other client's state relayed via Firestore
            if (msg.to && msg.to !== clientId) return;
            handleRemoteState(msg.state, msg.from);
            break;
    }
}

function addIceToPeer(from, cand){
    try {
        if (cand && peers[from] && peers[from].pc) peers[from].pc.addIceCandidate(new RTCIceCandidate(cand)).catch(()=>{});
    } catch(e){}
}

function createOfferTo(remoteId){
    return ensurePeer(remoteId, true).then(function(peer){
        var pc = peer.pc;
        pc.createOffer().then(function(offer){
            return pc.setLocalDescription(offer);
        }).then(function(){
            // send offer via Firestore
            signalsRef.add({ type: 'offer', from: clientId, to: remoteId, sdp: pc.localDescription, t: Date.now() }).catch(()=>{});
        }).catch(function(err){ console.warn('createOffer err', err); });
    });
}

function ensurePeer(remoteId, initiator){
    if (peers[remoteId]) return Promise.resolve(peers[remoteId]);
    var pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    var peer = { pc: pc, dc: null, buffer: [], mesh: null };
    peers[remoteId] = peer;

    pc.onicecandidate = function(ev){
        if (ev.candidate) {
            // send candidate via Ably
            signalChannel.publish('signal', { 
                type: 'ice', 
                from: clientId, 
                to: remoteId, 
                candidate: ev.candidate.toJSON(), 
                t: Date.now() 
            });
        }
    };

    pc.onconnectionstatechange = function(){
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed'){
            removePeer(remoteId);
        }
    };

    pc.ondatachannel = function(ev){
        setupDataChannel(remoteId, ev.channel);
    };

    // create datachannel if initiator
    if (initiator){
        var dc = pc.createDataChannel('game');
        setupDataChannel(remoteId, dc);
    }

    return Promise.resolve(peer);
}

function setupDataChannel(remoteId, dc){
    var peer = peers[remoteId];
    if (!peer) return;
    peer.dc = dc;
    dc.binaryType = 'arraybuffer';
    dc.onopen = function(){ console.log('DataChannel open to', remoteId); };
    dc.onclose = function(){ console.log('DataChannel closed to', remoteId); };
    dc.onmessage = function(ev){
        try {
            var msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : JSON.parse(new TextDecoder().decode(ev.data));
            if (msg && msg.type === 'state') handleRemoteState(msg, remoteId);
        } catch(e){ console.warn('dc msg parse err', e); }
    };
}

function removePeer(remoteId){
    var p = peers[remoteId];
    if (!p) return;
    try { if (p.dc) p.dc.close(); } catch(e){}
    try { if (p.pc) p.pc.close(); } catch(e){}
    if (p.mesh) {
        try { p.mesh.dispose(); } catch(e){}
        // remove label DOM if present
        try { if (p.mesh._ffnyLabel && p.mesh._ffnyLabel.parentNode) p.mesh._ffnyLabel.parentNode.removeChild(p.mesh._ffnyLabel); } catch(e){}
    }
    delete peers[remoteId];
}

// Attempt to clean up our state doc and notify peers when the page is closed or hidden
function cleanupOnUnload(){
    try {
        if (statesRef) {
            statesRef.doc(clientId).delete().catch(function(){});
        }
        if (signalsRef) {
            signalsRef.add({ type: 'leave', from: clientId, t: Date.now(), to: null }).catch(function(){});
        }
    } catch(e){}
}

window.addEventListener('beforeunload', function(){ cleanupOnUnload(); });
// visibilitychange can help when tab is closed in some browsers
document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'hidden') cleanupOnUnload(); });

// handle incoming remote state (from DataChannel or Firestore fallback)
function handleRemoteState(state, fromId){
    if (!state || !fromId) return;
    var p = peers[fromId];
    if (!p) {
        // create a placeholder peer so we can store buffer and create mesh
        ensurePeer(fromId, false).then(function(){ /* continue */ });
        p = peers[fromId];
    }
    if (!p.buffer) p.buffer = [];
    // normalize numbers
    var entry = { t: state.t || Date.now(), pos: { x: +state.pos.x, y: +state.pos.y, z: +state.pos.z }, rot: { yaw: +state.rot.yaw, pitch: +state.rot.pitch } };
    p.buffer.push(entry);
    // keep last few
    while (p.buffer.length > 20) p.buffer.shift();
    // ensure mesh exists
    if (!p.mesh) p.mesh = createRemoteAvatarMesh(fromId);
}

function createRemoteAvatarMesh(id){
    var m = BABYLON.MeshBuilder.CreateSphere('remote_' + id, { diameter: 0.6 }, scene);
    var mat = new BABYLON.StandardMaterial('m_' + id, scene);
    // color by id hash
    var color = colorFromId(id);
    mat.diffuseColor = new BABYLON.Color3(color.r/255, color.g/255, color.b/255);
    m.material = mat;
    // create a DOM label for the avatar
    var label = document.createElement('div');
    label.className = 'ffny-remote-label';
    // Use id as username since we're now storing usernames as clientId
    label.textContent = id;
    label.style.position = 'fixed';
    label.style.transform = 'translate(-50%, -120%)';
    label.style.pointerEvents = 'none';
    label.style.padding = '2px 6px';
    label.style.background = 'rgba(0,0,0,0.6)';
    label.style.color = 'white';
    label.style.fontSize = '11px';
    label.style.borderRadius = '4px';
    label.style.zIndex = '9998';
    document.body.appendChild(label);
    m._ffnyLabel = label;
    updatePeerUI();
    return m;
}

function colorFromId(id){
    var h = 0; for(var i=0;i<id.length;i++){ h = (h<<5)-h + id.charCodeAt(i); h |= 0; }
    var r = (h & 0xFF0000) >> 16; var g = (h & 0x00FF00) >> 8; var b = (h & 0x0000FF);
    return { r: Math.abs(r)%256, g: Math.abs(g)%256, b: Math.abs(b)%256 };
}

// Create HUD container for presence/debug info
function ensureHud(){
    if (hud) return hud;
    hud = document.createElement('div');
    hud.id = 'ffnyHud';
    hud.style.position = 'fixed';
    hud.style.right = '12px';
    hud.style.top = '12px';
    hud.style.zIndex = '9999';
    hud.style.background = 'rgba(0,0,0,0.5)';
    hud.style.color = 'white';
    hud.style.fontSize = '12px';
    hud.style.padding = '8px';
    hud.style.borderRadius = '6px';
    hud.innerHTML = '<div><strong>Me:</strong> <span id="ffnyMyId">' + clientId + '</span></div><div><strong>Peers:</strong><ul id="ffnyPeerList" style="margin:4px 0 0 0;padding:0 0 0 16px;"></ul></div>';
    document.body.appendChild(hud);
    return hud;
}

function updatePeerUI(){
    ensureHud();
    var list = document.getElementById('ffnyPeerList');
    if (!list) return;
    // clear
    while(list.firstChild) list.removeChild(list.firstChild);
    Object.keys(peers).forEach(function(id){
        var li = document.createElement('li');
        li.textContent = id + (peers[id] && peers[id].dc && peers[id].dc.readyState ? ' ('+peers[id].dc.readyState+')' : '');
        list.appendChild(li);
    });
}

// Periodic local state send over DataChannels or Firestore fallback
var stateSendInterval = null;
function startStateLoop(){
    if (stateSendInterval) return;
    stateSendInterval = setInterval(function(){
        if (!camera) return;
        var state = { type: 'state', id: clientId, t: Date.now(), pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z }, rot: { yaw: camera.rotation.y, pitch: camera.rotation.x } };
        // send over datachannels
        Object.keys(peers).forEach(function(remoteId){
            var p = peers[remoteId];
            if (p && p.dc && p.dc.readyState === 'open'){
                try { p.dc.send(JSON.stringify(state)); } catch(e){}
            }
        });
        // fallback relay via Ably at low rate
        if (USE_FIRESTORE_FALLBACK && stateChannel) {
            try {
                stateChannel.publish('state', state);
            } catch(e){ console.warn('state publish err', e); }
        }
    }, 100); // 10Hz
}

// interpolation/render update called each frame
function updateRemotePlayers(){
    var now = Date.now();
    var renderTime = now - 120; // interpolation delay
    Object.keys(peers).forEach(function(id){
        var p = peers[id];
        if (!p || !p.buffer || p.buffer.length === 0) return;
        var buf = p.buffer;
        // drop old
        while (buf.length >= 2 && buf[1].t <= renderTime) buf.shift();
        if (buf.length >= 2){
            var a = buf[0], b = buf[1];
            var alpha = (renderTime - a.t) / (b.t - a.t);
            alpha = Math.max(0, Math.min(1, alpha));
            var x = a.pos.x + (b.pos.x - a.pos.x) * alpha;
            var y = a.pos.y + (b.pos.y - a.pos.y) * alpha;
            var z = a.pos.z + (b.pos.z - a.pos.z) * alpha;
            if (p.mesh) p.mesh.position = new BABYLON.Vector3(x,y,z);
            var yaw = a.rot.yaw + (b.rot.yaw - a.rot.yaw) * alpha;
            if (p.mesh) p.mesh.rotation.y = yaw;
        } else if (buf.length === 1){
            var a = buf[0];
            if (p.mesh) p.mesh.position = new BABYLON.Vector3(a.pos.x, a.pos.y, a.pos.z);
            if (p.mesh) p.mesh.rotation.y = a.rot.yaw;
        }
        // update label position if exists
        if (p.mesh && p.mesh._ffnyLabel) {
            try {
                var pos = p.mesh.getBoundingInfo().boundingSphere.centerWorld;
                var screen = worldToScreen(pos, scene, camera, engine);
                if (screen) {
                    p.mesh._ffnyLabel.style.left = screen.x + 'px';
                    p.mesh._ffnyLabel.style.top = screen.y + 'px';
                    p.mesh._ffnyLabel.style.display = 'block';
                } else {
                    p.mesh._ffnyLabel.style.display = 'none';
                }
            } catch(e){}
        }
    });
    // update HUD peer list occasionally
    try { updatePeerUI(); } catch(e){}
}

// Convert a BABYLON.Vector3 world position to screen coordinates
function worldToScreen(worldPos, scene, camera, engine) {
    if (!camera || !scene) return null;
    var transform = BABYLON.Vector3.Project(worldPos, BABYLON.Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    if (!transform) return null;
    // transform.x/y are in pixels
    return { x: transform.x, y: transform.y };
}

// start everything (load Ably then start networking)
function startNetworking(){
    if (!ABLY_API_KEY) {
        console.warn('Ably API key missing: paste your Ably API key into interaction.js ABLY_API_KEY');
        startStateLoop();
        return;
    }
    loadAblyAndInit(function(err){
        if (err) { console.warn('Ably load failed, starting state loop only'); startStateLoop(); return; }
    });
}

// Initialize game with stored username or show login
if (username) {
    clientId = username;
    loginOverlay.style.display = 'none';
    setTimeout(startNetworking, 1000);
} else {
    loginOverlay.style.display = 'flex';
}


// Pause menu logic
var isPaused = false;
var pauseOverlay = document.getElementById('pauseOverlay');
var resumeBtn = document.getElementById('resumeBtn');
var settingsBtn = document.getElementById('settingsBtn');
// Pointer lock state
var isPointerLocked = false;

// Request pointer lock when the canvas is clicked
if (canvas) {
    canvas.addEventListener('click', function () {
        if (!isPointerLocked) {
            // Request pointer lock
            if (canvas.requestPointerLock) canvas.requestPointerLock();
            else if (canvas.mozRequestPointerLock) canvas.mozRequestPointerLock();
            else if (canvas.webkitRequestPointerLock) canvas.webkitRequestPointerLock();
        }
    });
}

// Listen for pointer lock change
document.addEventListener('pointerlockchange', lockChange, false);
document.addEventListener('mozpointerlockchange', lockChange, false);
document.addEventListener('webkitpointerlockchange', lockChange, false);

function lockChange() {
    var lockedElement = document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement;
    isPointerLocked = (lockedElement === canvas);
    updateLockHint();
}

function showPause() {
    if (isPaused) return;
    isPaused = true;
    if (pauseOverlay) {
        pauseOverlay.style.display = 'flex';
        pauseOverlay.setAttribute('aria-hidden', 'false');
    }
    try { engine.stopRenderLoop(); } catch (e) {}
}

function hidePause() {
    if (!isPaused) return;
    isPaused = false;
    if (pauseOverlay) {
        pauseOverlay.style.display = 'none';
        pauseOverlay.setAttribute('aria-hidden', 'true');
    }
    try { engine.runRenderLoop(function () { scene.render(); }); } catch (e) {}
    updateLockHint();
}

// Toggle on Escape
window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        // If pointer is locked, unlock first (user expects Escape to release pointer)
        if (isPointerLocked) {
            if (document.exitPointerLock) document.exitPointerLock();
            else if (document.mozExitPointerLock) document.mozExitPointerLock();
            else if (document.webkitExitPointerLock) document.webkitExitPointerLock();
            // don't toggle pause immediately; user released pointer
            return;
        }

        if (isPaused) hidePause(); else showPause();
    }
});

if (resumeBtn) {
    resumeBtn.addEventListener('click', function () {
        hidePause();
    });
}

if (settingsBtn) {
    settingsBtn.addEventListener('click', function () {
        // Show settings panel inside pause menu
        var settingsPanel = document.getElementById('settingsPanel');
        if (settingsPanel) {
            settingsPanel.style.display = 'block';
            // populate controls with current values
            var inertiaRange = document.getElementById('inertiaRange');
            var sensitivityRange = document.getElementById('sensitivityRange');
            var inertiaValue = document.getElementById('inertiaValue');
            var sensitivityValue = document.getElementById('sensitivityValue');
            if (inertiaRange) { inertiaRange.value = camera.inertia; inertiaValue.textContent = camera.inertia; }
            if (sensitivityRange && typeof camera.angularSensibility !== 'undefined') { sensitivityRange.value = camera.angularSensibility; sensitivityValue.textContent = camera.angularSensibility; }
        }
    });
}

// Lock hint element
var lockHint = document.getElementById('lockHint');
function updateLockHint() {
    if (!lockHint) return;
    // Hide the hint while paused or when pointer is locked
    if (isPaused || isPointerLocked) {
        lockHint.style.display = 'none';
    } else {
        lockHint.style.display = 'block';
    }
}

// Initialize hint visibility
updateLockHint();

// Settings panel controls
var backFromSettingsBtn = document.getElementById('backFromSettingsBtn');
var saveSettingsBtn = document.getElementById('saveSettingsBtn');
var inertiaRange = document.getElementById('inertiaRange');
var sensitivityRange = document.getElementById('sensitivityRange');
var inertiaValue = document.getElementById('inertiaValue');
var sensitivityValue = document.getElementById('sensitivityValue');

function applySettings(inertiaVal, sensVal) {
    if (camera) {
        camera.inertia = parseFloat(inertiaVal);
        if (typeof camera.angularSensibility !== 'undefined') camera.angularSensibility = parseInt(sensVal, 10);
    }
}

if (inertiaRange) {
    inertiaRange.addEventListener('input', function () { inertiaValue.textContent = inertiaRange.value; applySettings(inertiaRange.value, sensitivityRange ? sensitivityRange.value : camera.angularSensibility); });
}
if (sensitivityRange) {
    sensitivityRange.addEventListener('input', function () { sensitivityValue.textContent = sensitivityRange.value; applySettings(inertiaRange ? inertiaRange.value : camera.inertia, sensitivityRange.value); });
}

if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', function () {
        var iVal = inertiaRange ? inertiaRange.value : camera.inertia;
        var sVal = sensitivityRange ? sensitivityRange.value : (typeof camera.angularSensibility !== 'undefined' ? camera.angularSensibility : 800);
        localStorage.setItem('ffny.inertia', iVal);
        localStorage.setItem('ffny.angularSensibility', sVal);
        // hide settings
        var settingsPanel = document.getElementById('settingsPanel');
        if (settingsPanel) settingsPanel.style.display = 'none';
    });
}

if (backFromSettingsBtn) {
    backFromSettingsBtn.addEventListener('click', function () {
        var settingsPanel = document.getElementById('settingsPanel');
        if (settingsPanel) settingsPanel.style.display = 'none';
    });
}
