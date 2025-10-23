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
// Networking: Firestore signalling + WebRTC DataChannels
// - Uses Firestore only for signalling (offer/answer/ICE) and optional low-rate relay fallback.
// - DataChannels carry live position updates (JSON) at ~10Hz.
// Paste your Firebase config into `FIREBASE_CONFIG` below.
// --------------------

// Minimal configuration: replace with your Firebase project's config
var FIREBASE_CONFIG = {
    apiKey: "AIzaSyBvx38TEpit57pNU8dHkx39Til872x2kC4",
    authDomain: "ffny-interact.firebaseapp.com",
    projectId: "ffny-interact",
    storageBucket: "ffny-interact.firebasestorage.app",
    messagingSenderId: "693923451215",
    appId: "1:693923451215:web:f40eaa29ad63198776353a",
};

var USE_FIRESTORE_FALLBACK = true; // allow low-rate relay via Firestore when DataChannel unavailable
var ROOM_ID = (function(){
    // derive a room id from pathname so pages in same site connect together; change if you want separate rooms
    return 'ffny_room_' + (location.pathname.replace(/\W+/g,'_') || 'default');
})();

// runtime state
var clientId = hex8();
var peers = {}; // remoteId => { pc, dc, buffer: [{t,pos,rot}], mesh }
var firestore = null;
var signalsRef = null;
var statesRef = null;
var joined = false;
// State TTL (milliseconds) - used to set expiresAt for Firestore TTL policy and stale cleanup
var STATE_TTL_MS = 30000; // 30 seconds
// HUD / presence UI
var hud = null;

// helper: small random id
function hex8(){
    var a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// lightweight dynamic load of firebase compat scripts then init firestore
function loadFirebaseAndInit(cb){
    if (window.firebase && window.firebase.firestore) { initFirestore(); if (cb) cb(); return; }
    var s1 = document.createElement('script');
    s1.src = 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js';
    s1.onload = function(){
        var s2 = document.createElement('script');
        s2.src = 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore-compat.js';
        s2.onload = function(){ initFirestore(); if (cb) cb(); };
        s2.onerror = function(){ console.warn('Failed to load firebase-firestore script'); if (cb) cb(new Error('firestore load failed')); };
        document.head.appendChild(s2);
    };
    s1.onerror = function(){ console.warn('Failed to load firebase-app script'); if (cb) cb(new Error('firebase load failed')); };
    document.head.appendChild(s1);
}

function initFirestore(){
    try {
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        firestore = firebase.firestore();
        signalsRef = firestore.collection('rooms').doc(ROOM_ID).collection('signals');
        statesRef = firestore.collection('rooms').doc(ROOM_ID).collection('states');
        console.log('Firestore initialized for room', ROOM_ID);
        startSignalling();
    } catch (e) {
        console.warn('Firestore init failed', e);
    }
}

// Signalling: listen to signals addressed to us (to==clientId or to==null for broadcast)
function startSignalling(){
    if (!signalsRef) return;
    signalsRef.where('to','in',[clientId,null]).onSnapshot(function(snapshot){
        snapshot.docChanges().forEach(function(change){
            if (change.type === 'added'){
                var msg = change.doc.data();
                // ignore our own messages
                if (msg.from === clientId) return;
                handleSignal(msg);
                // cleanup one-off messages to keep collection small
                // keep candidate messages for debugging; remove offers/answers after handled
                if (msg.type === 'offer' || msg.type === 'answer' || msg.type === 'join') {
                    change.doc.ref.delete().catch(()=>{});
                }
            }
        });
    });
    // announce presence
    signalsRef.add({ type: 'join', from: clientId, t: Date.now(), to: null }).catch(()=>{});
    joined = true;
    // listen for low-rate state updates from other peers (per-client documents)
    if (statesRef) {
        statesRef.onSnapshot(function(snap){
            snap.docChanges().forEach(function(change){
                var id = change.doc.id;
                if (id === clientId) return; // ignore our own
                if (change.type === 'added' || change.type === 'modified'){
                    var data = change.doc.data();
                    if (data && data.state) handleRemoteState(data.state, id);
                } else if (change.type === 'removed'){
                    removePeer(id);
                }
            });
        }, function(err){ console.warn('statesRef snapshot err', err); });
    }
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
            // send candidate via firestore
            signalsRef.add({ type: 'ice', from: clientId, to: remoteId, candidate: ev.candidate.toJSON(), t: Date.now() }).catch(()=>{});
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
        // fallback relay via Firestore at low rate: update a per-client doc instead of adding many small documents
        if (USE_FIRESTORE_FALLBACK && statesRef) {
            try {
                var expiresAt = new Date(Date.now() + STATE_TTL_MS);
                statesRef.doc(clientId).set({ state: state, t: Date.now(), expiresAt: expiresAt }).catch(function(err){
                    console.warn('Failed to write state doc', err);
                });
            } catch(e){ console.warn('statesRef set err', e); }
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

// start everything (load firebase then start state loop)
function startNetworking(){
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.projectId) {
        console.warn('Firebase config missing: paste your Firebase config into interaction.js FIREBASE_CONFIG');
        // still start state loop so local sends can be used if DataChannels exist via direct peer connections (unlikely without signalling)
        startStateLoop();
        return;
    }
    loadFirebaseAndInit(function(err){
        if (err) { console.warn('Firebase load failed, starting state loop only'); startStateLoop(); return; }
        startStateLoop();
    });
}

// start networking after a short delay so the scene is ready
setTimeout(startNetworking, 1000);


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
