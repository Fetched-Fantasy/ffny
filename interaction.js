// interaction.js
'use strict';

// Create and insert canvas
var canvas = document.createElement('canvas');
canvas.className = 'game-canvas';
var gameRoot = document.getElementById('game-root');
if (gameRoot) {
  gameRoot.appendChild(canvas);
}

// Babylon engine and scene
var engine = new BABYLON.Engine(canvas, true);

var createScene = function () {
    var scene = new BABYLON.Scene(engine);
    scene.gravity = new BABYLON.Vector3(0, -0.9, 0);
    scene.collisionsEnabled = true;
    var camera = new BABYLON.FreeCamera('camera1', new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new BABYLON.Vector3(1, 1, 1);
    camera.speed = 0.2;

    // Tweak inertia and angular sensitivity for snappier, faster turning
    // Lower inertia reduces smoothing; lower angularSensibility increases rotation speed.
    camera.inertia = 0.02; // less smoothing

    if (typeof camera.angularSensibility !== 'undefined') {
        camera.angularSensibility = 800; // lower = more sensitive (faster turns)
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
    scene.render();
});

window.addEventListener('resize', function () {
    try { engine.resize(); } catch (e) {}
});

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
        alert('Settings are not implemented yet.');
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
