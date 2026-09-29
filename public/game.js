// import * as THREE from '/modules/three/build/three.module.js';
// import { io } from '/modules/socket.io-client/dist/socket.io.js';

// import * as THREE from 'three';

const socket = io();
socket.on('connect_error', (error) => console.error('[socket] connection error:', error.message));
socket.on('error', (error) => console.error('[socket] server error:', error));
const storedUser = window.authSession?.getStoredUser ? window.authSession.getStoredUser() : null;
const playerName = storedUser?.username || 'Jugador';
const token = window.authSession?.getStoredToken ? window.authSession.getStoredToken() : null;
const muzzleFlashColor = 0xffd166;
const impactEffects = [];
let matchState = {
    roomId: localStorage.getItem('roomId') || 'default-room',
    isActive: true,
    players: [],
    stats: {
        kills: 0,
        deaths: 0
    }
};

const respawnDelayMs = 4000;
const spawnShieldMs = 3000;
let respawnAvailableAt = 0;
let shieldUntil = 0;
let isPlayerDead = false;
let respawnCountdownNode = null;
let respawnTimerId = null;
let currentTeam = 'red';
let pointerLocked = false;
let lastLookPoint = null;
let audioContext = null;

function ensureAudioContext() {
    if (!audioContext) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (AudioCtor) {
            audioContext = new AudioCtor();
        }
    }
    return audioContext;
}

function playTone(frequency = 180, duration = 0.08, volume = 0.03, type = 'square') {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.stop(ctx.currentTime + duration);
}

function playShotSound() {
    playTone(120, 0.06, 0.025, 'square');
}

function playHitSound() {
    playTone(70, 0.1, 0.035, 'sawtooth');
}

function playPickupSound() {
    playTone(640, 0.08, 0.04, 'triangle');
}

function updateRespawnCountdown() {
    const countdownNode = document.getElementById('respawnCountdown');
    if (!countdownNode) return;

    const remainingMs = Math.max(0, respawnAvailableAt - Date.now());
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    countdownNode.textContent = remainingSeconds > 0 ? `Respawn en ${remainingSeconds}s` : 'Listo para entrar';
}

function activateSpawnShield() {
    shieldUntil = Date.now() + spawnShieldMs;
    const overlay = document.getElementById('spawnShieldOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 250);
        }, 2000);
    }
}

function handlePlayerDeath() {
    if (isPlayerDead) return;
    isPlayerDead = true;
    isFiring = false;
    document.exitPointerLock?.();
    respawnAvailableAt = Date.now() + respawnDelayMs;
    health = 0;
    healthFill.style.width = '0%';
    healthFill.style.backgroundColor = '#f00';
    if (hudHealthValue) {
        hudHealthValue.textContent = '0';
    }

    const overlay = document.getElementById('respawnOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
    const respawnButton = document.getElementById('respawnButton');
    if (respawnButton) {
        respawnButton.disabled = true;
        respawnButton.textContent = 'ESPERA...';
    }

    updateRespawnCountdown();
    if (respawnTimerId) {
        clearInterval(respawnTimerId);
    }

    respawnTimerId = setInterval(() => {
        updateRespawnCountdown();
        if (Date.now() >= respawnAvailableAt) {
            clearInterval(respawnTimerId);
            respawnTimerId = null;
            if (overlay) {
                overlay.classList.add('respawn-ready');
            }
            const respawnButton = document.getElementById('respawnButton');
            if (respawnButton) {
                respawnButton.disabled = false;
                respawnButton.textContent = 'VOLVER A JUGAR';
            }
            updateRespawnCountdown();
        }
    }, 250);
}

function respawnPlayer() {
    if (!isPlayerDead || Date.now() < respawnAvailableAt) return;

    isPlayerDead = false;
    const overlay = document.getElementById('respawnOverlay');
    overlay?.classList.remove('respawn-ready');
    if (overlay) overlay.style.display = 'none';
    activateSpawnShield();
    egg.position.set(currentTeam === 'red' ? -18 : 18, 0, currentTeam === 'red' ? -18 : 18);
    camera.position.set(egg.position.x, 1.8, egg.position.z);
    updateKillFeed('Respawn ready');
}

function leaveArena() {
    document.exitPointerLock?.();
    window.location.replace('/menu.html');
}

function normalizePlayersList(players) {
    const uniquePlayers = new Map();
    for (const player of Array.isArray(players) ? players : []) {
        const key = player?.id || `${player?.username || 'player'}-${player?.team || 'unknown'}`;
        if (!uniquePlayers.has(key)) {
            uniquePlayers.set(key, { ...player, username: player?.username || 'alien' });
        }
    }
    return Array.from(uniquePlayers.values());
}

function renderPlayerList() {
    const list = document.getElementById('playerList');
    if (!list) return;

    const players = normalizePlayersList(Array.isArray(matchState.players) ? matchState.players : []);
    const displayPlayers = players.length ? players : [{ id: socket.id, username: playerName, kills: matchState.stats.kills || 0 }];

    list.innerHTML = displayPlayers.map((player) => {
        const isLocal = player.id === socket.id;
        const label = isLocal ? 'you' : (player.username || 'alien');
        const kills = Number(player.kills || 0);
        return `
            <div class="player-entry">
                <span>${label}</span>
                <span class="player-score">${kills}</span>
            </div>
        `;
    }).join('');
}

function dedupeRoomPlayers(players) {
    const unique = new Map();
    for (const player of Array.isArray(players) ? players : []) {
        const key = player?.id || `${player?.username || 'unknown'}-${player?.team || 'no-team'}`;
        if (!unique.has(key)) {
            unique.set(key, player);
        }
    }
    return Array.from(unique.values());
}

function updateTeamDisplay(team) {
    const teamValueElement = document.getElementById('hudTeamValue');
    const teamElement = document.getElementById('hudTeam');
    if (!teamValueElement || !teamElement) return;
    
    const teamLabel = team === 'red' ? 'RED' : 'BLUE';
    const teamColor = team === 'red' ? '#ff4444' : '#4488ff';
    
    teamValueElement.textContent = teamLabel;
    teamValueElement.style.color = teamColor;
}

const scene = new THREE.Scene();
const gameClock = new THREE.Clock();
scene.background = new THREE.Color(0x081a2d);
scene.fog = new THREE.Fog(0x081a2d, 15, 60);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

// Solo agregar el renderer al documento si no está en preview
function initializeGameRenderer() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x081a2d);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    
    const gameContainer = document.getElementById('gameContainer');
    if (gameContainer && !gameContainer.querySelector('canvas')) {
        gameContainer.insertBefore(renderer.domElement, gameContainer.firstChild);
    }
}

// Esperar a que el juego esté inicializado antes de renderizar
let gameInitialized = false;
window.addEventListener('load', () => {
    setTimeout(() => {
        if (!window.gameInitialized) {
            initializeGameRenderer();
        }
    }, 100);
});

const hud = document.createElement('div');
hud.className = 'game-hud';
hud.id = 'gameHUD';
hud.style.display = 'none';

const crosshair = document.createElement('div');
crosshair.className = 'crosshair';
crosshair.innerHTML = '<span></span><span></span><span></span><span></span>';

// Mostrar HUD cuando el juego inicia
const observer = new MutationObserver(() => {
    if (window.gameInitialized && hud.style.display === 'none') {
        hud.style.display = 'block';
        initializeGameRenderer();
    }
});

observer.observe(document.body, { attributes: true });

const hudTop = document.createElement('div');
hudTop.className = 'hud-top';

const hudLeft = document.createElement('div');
hudLeft.className = 'hud-panel hud-left';
hudLeft.innerHTML = `
    <div class="player-list-title"><span class="live-indicator"></span> PLAYERS</div>
    <div id="playerList" class="player-list"></div>
`;

const hudCenter = document.createElement('div');
hudCenter.className = 'hud-center';
hudCenter.innerHTML = `
    <div class="match-label"><span class="match-label-kicker">ALIEN ARENA</span><span class="match-label-name">LIVE MATCH</span></div>
`;

const hudRight = document.createElement('div');
hudRight.className = 'hud-panel hud-right';
hudRight.innerHTML = `
    <div id="hudTeam" class="team-token"><span>YOUR SQUAD</span><strong id="hudTeamValue">BLUE</strong></div>
    <div class="map-token"><span class="map-token-mark"></span><span>MAP</span><strong>METEOR YARD</strong></div>
`;

const hudBottomLeft = document.createElement('div');
hudBottomLeft.className = 'hud-health';
hudBottomLeft.innerHTML = `
    <div class="health-ring">
        <div id="hudHealthFill" class="health-fill"></div>
        <span id="hudHealthValue">100</span>
    </div>
`;

const hudBottomRight = document.createElement('div');
hudBottomRight.className = 'hud-ammo';
hudBottomRight.innerHTML = `
    <div id="hudWeaponName" class="ammo-label">PISTOL</div>
    <div class="ammo-count"><span id="hudAmmoValue">12</span><span class="ammo-slash">/</span><span>12</span></div>
    <div class="grenade-count"><span>GRENADES</span><strong id="hudGrenadeValue">0/3</strong></div>
`;

const hudKillFeed = document.createElement('div');
hudKillFeed.className = 'hud-killfeed';
hudKillFeed.innerHTML = '<div class="kill-feed-item">you eliminated alienbot</div>';

const respawnOverlay = document.createElement('div');
respawnOverlay.id = 'respawnOverlay';
respawnOverlay.className = 'respawn-overlay';
respawnOverlay.innerHTML = `
    <div class="respawn-box">
        <div class="respawn-title">Has sido eliminado</div>
        <div id="respawnCountdown">Respawn en 5s</div>
        <div class="respawn-actions">
            <button id="respawnButton" disabled>ESPERA...</button>
            <button id="changeTeamButton">CAMBIAR EQUIPO</button>
            <button id="leaveArenaButton">SALIR</button>
        </div>
    </div>`;

const spawnShieldOverlay = document.createElement('div');
spawnShieldOverlay.id = 'spawnShieldOverlay';
spawnShieldOverlay.className = 'spawn-shield-overlay';
spawnShieldOverlay.textContent = 'Escudo activo';

const grenadeChargeIndicator = document.createElement('div');
grenadeChargeIndicator.className = 'grenade-charge';
grenadeChargeIndicator.innerHTML = '<span>GRENADE POWER</span><div><i></i></div>';

hudTop.appendChild(hudLeft);
hudTop.appendChild(hudCenter);
hudTop.appendChild(hudRight);
hud.appendChild(hudTop);
hud.appendChild(hudKillFeed);
hud.appendChild(hudBottomLeft);
hud.appendChild(hudBottomRight);
document.body.appendChild(hud);
document.body.appendChild(respawnOverlay);
document.body.appendChild(spawnShieldOverlay);
document.body.appendChild(crosshair);
document.body.appendChild(grenadeChargeIndicator);
document.getElementById('respawnButton')?.addEventListener('click', respawnPlayer);
document.getElementById('changeTeamButton')?.addEventListener('click', changeTeamWhileDead);
document.getElementById('leaveArenaButton')?.addEventListener('click', leaveArena);

const meteorHudCounter = document.createElement('div');
meteorHudCounter.className = 'meteor-hud-counter';
meteorHudCounter.innerHTML = '<span class="meteor-dot small"></span><span>Meteoritos</span><strong id="meteorHudValue">0</strong>';
hud.appendChild(meteorHudCounter);

const weaponPickupPrompt = document.createElement('div');
weaponPickupPrompt.className = 'weapon-pickup-prompt';
weaponPickupPrompt.setAttribute('aria-live', 'polite');
hud.appendChild(weaponPickupPrompt);

const chatPanel = document.createElement('div');
chatPanel.className = 'arena-chat';
chatPanel.innerHTML = `
    <div id="chatMessages" class="chat-messages" aria-live="polite"></div>
    <form id="chatForm" class="chat-form">
        <input id="chatInput" maxlength="120" autocomplete="off" placeholder="Escribe un mensaje..." />
        <button type="submit" aria-label="Enviar mensaje">ENVIAR</button>
    </form>`;
hud.appendChild(chatPanel);

function addChatMessage(message) {
    const messages = document.getElementById('chatMessages');
    if (!messages) return;
    const entry = document.createElement('div');
    entry.className = 'chat-message';
    entry.textContent = `${message.username}: ${message.text}`;
    messages.appendChild(entry);
    while (messages.children.length > 8) messages.firstElementChild.remove();
    messages.scrollTop = messages.scrollHeight;
}

document.getElementById('chatForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('chatInput');
    const text = input?.value.trim();
    if (!text || isPlayerDead) return;
    socket.emit('chatMessage', { text });
    input.value = '';
});

socket.on('chatMessage', addChatMessage);

function refreshMeteorHud() {
    const value = Number(localStorage.getItem('meteorCount') || 0);
    const hudValue = document.getElementById('meteorHudValue');
    if (hudValue) {
        hudValue.textContent = String(value);
    }
}

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Luces
const hemiLight = new THREE.HemisphereLight(0x9ac4ce, 0x182423, 0.52);
scene.add(hemiLight);

const light = new THREE.DirectionalLight(0xffe2b1, 0.9);
light.position.set(-8, 18, 10);
light.castShadow = true;
light.shadow.mapSize.set(1024, 1024);
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 50;
scene.add(light);

const ambientLight = new THREE.AmbientLight(0x80928d, 0.28);
scene.add(ambientLight);

// Crear el suelo
const arenaVisuals = window.createArenaVisuals(THREE);
const playerCollisionBoxes = window.ARENA_PHYSICS.createCollisionBoxes(window.ARENA_CONFIG);
const floorGeometry = new THREE.PlaneGeometry(64, 64);
const floorMaterial = arenaVisuals.materials.floor;
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

// Crear paredes
const wallMaterial = arenaVisuals.createWallMaterial();

// Pared frontal
const wallGeometry1 = new THREE.BoxGeometry(64, 5, 1);
const wallFront = new THREE.Mesh(wallGeometry1, wallMaterial);
wallFront.position.set(0, 2.5, -32);
wallFront.receiveShadow = true;
scene.add(wallFront);

// Pared trasera
const wallBack = new THREE.Mesh(wallGeometry1, wallMaterial);
wallBack.position.set(0, 2.5, 32);
wallBack.receiveShadow = true;
scene.add(wallBack);

// Pared izquierda
const wallGeometry2 = new THREE.BoxGeometry(1, 5, 64);
const wallLeft = new THREE.Mesh(wallGeometry2, wallMaterial);
wallLeft.position.set(-32, 2.5, 0);
wallLeft.receiveShadow = true;
scene.add(wallLeft);

// Pared derecha
const wallRight = new THREE.Mesh(wallGeometry2, wallMaterial);
wallRight.position.set(32, 2.5, 0);
wallRight.receiveShadow = true;
scene.add(wallRight);

const obstacles = [];

window.ARENA_CONFIG.obstacles.forEach((obstacle) => {
    const mesh = arenaVisuals.createObstacle(obstacle);
    if (!mesh) return;
    scene.add(mesh);
    obstacles.push(mesh);
});

window.ARENA_CONFIG.staircases.forEach((staircase) => {
    scene.add(arenaVisuals.createStairs(staircase));
});

// Función para obtener color de equipo
function getTeamColor(team) {
    if (team === 'red') return 0xff4444;
    if (team === 'blue') return 0x4488ff;
    return 0x42f0c4; // Default cyan
}

function createAlienCharacter(color = 0x42f0c4) {
    const alien = new THREE.Group();

    const bodyGeometry = new THREE.SphereGeometry(1.2, 32, 32);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.scale.set(1, 1.2, 1);
    alien.add(bodyMesh);

    const headGeometry = new THREE.SphereGeometry(0.8, 32, 32);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0x35d1b2, roughness: 0.35, metalness: 0.1 });
    const headMesh = new THREE.Mesh(headGeometry, headMaterial);
    headMesh.position.set(0, 1.4, 0);
    alien.add(headMesh);

    const eyeGeometry = new THREE.SphereGeometry(0.18, 16, 16);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x66ffcc, emissiveIntensity: 0.4 });
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.35, 1.5, -0.75);
    rightEye.position.set(0.35, 1.5, -0.75);
    alien.add(leftEye);
    alien.add(rightEye);

    const armGeometry = new THREE.CylinderGeometry(0.18, 0.18, 1.8, 16);
    const armMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-1.15, 0.2, 0);
    leftArm.rotation.z = Math.PI / 3;
    rightArm.position.set(1.15, 0.2, 0);
    rightArm.rotation.z = -Math.PI / 3;
    alien.add(leftArm);
    alien.add(rightArm);

    const legGeometry = new THREE.CylinderGeometry(0.22, 0.22, 1.6, 16);
    const leftLeg = new THREE.Mesh(legGeometry, armMaterial);
    const rightLeg = new THREE.Mesh(legGeometry, armMaterial);
    leftLeg.position.set(-0.45, -1.25, 0);
    rightLeg.position.set(0.45, -1.25, 0);
    alien.add(leftLeg);
    alien.add(rightLeg);

    const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8);
    const antennaMaterial = new THREE.MeshStandardMaterial({ color: 0x72f7d7, metalness: 0.3 });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.set(0, 2.3, 0);
    alien.add(antenna);

    const antennaTipGeometry = new THREE.SphereGeometry(0.14, 12, 12);
    const antennaTipMaterial = new THREE.MeshStandardMaterial({ color: 0x72f7d7, emissive: 0x88ffff, emissiveIntensity: 0.5 });
    const antennaTip = new THREE.Mesh(antennaTipGeometry, antennaTipMaterial);
    antennaTip.position.set(0, 0.6, 0);
    antenna.add(antennaTip);

    const armorMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.34 });
    const armorEdgeMaterial = new THREE.MeshStandardMaterial({ color: 0x26363a, roughness: 0.62, metalness: 0.3 });
    const visorFrame = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.065, 8, 28),
        armorEdgeMaterial
    );
    visorFrame.position.set(0, 1.52, -0.74);
    alien.add(visorFrame);

    const chestPlate = new THREE.Mesh(
        new THREE.SphereGeometry(0.68, 20, 14),
        armorMaterial
    );
    chestPlate.scale.set(1, 0.65, 0.25);
    chestPlate.position.set(0, 0.04, -0.98);
    alien.add(chestPlate);

    for (const side of [-1, 1]) {
        const shoulderGuard = new THREE.Mesh(
            new THREE.SphereGeometry(0.33, 14, 10),
            armorMaterial
        );
        shoulderGuard.scale.set(1.15, 0.72, 0.86);
        shoulderGuard.position.set(side * 1.03, 0.42, -0.12);
        alien.add(shoulderGuard);

        const kneeGuard = new THREE.Mesh(
            new THREE.BoxGeometry(0.38, 0.25, 0.18),
            armorEdgeMaterial
        );
        kneeGuard.position.set(side * 0.45, -1.14, -0.22);
        alien.add(kneeGuard);
    }

    const backpack = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.82, 0.38),
        armorEdgeMaterial
    );
    backpack.position.set(0, 0.08, 0.88);
    alien.add(backpack);

    const packBeacon = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.12, 0.045),
        new THREE.MeshStandardMaterial({ color: 0xf3b84e, emissive: 0x9b541a, emissiveIntensity: 0.2 })
    );
    packBeacon.position.set(0, 0.28, 1.09);
    alien.add(packBeacon);

    alien.position.y = 1.1;
    return alien;
}

function setRemotePlayerHealth(player, healthValue) {
    const health = Math.max(0, Math.min(100, Number(healthValue) || 0));
    player.userData.health = health;
    let bar = player.userData.healthBar;
    if (!bar) {
        bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x22c55e }));
        bar.scale.set(1.4, 0.12, 1);
        bar.position.set(0, 3.2, 0);
        player.add(bar);
        player.userData.healthBar = bar;
    }
    bar.visible = health > 0;
    bar.material.color.setHex(health > 50 ? 0x22c55e : health > 25 ? 0xfacc15 : 0xef4444);
    bar.scale.x = Math.max(0.02, health / 100 * 1.4);
}

// Personaje (alien)
const alien = createAlienCharacter(0x42f0c4);
const egg = alien;
scene.add(egg);
egg.position.set(-18, 0, -18);

// Configurar la cámara en primera persona (en la cabeza del alien)
camera.position.set(0, 1.8, 0);
camera.lookAt(0, 1.8, -1);

let mouseX = 0;
let mouseY = 0;
let yawAngle = 0;

// Variables para el salto y la gravedad
let isJumping = false;
let verticalVelocity = 0;
const gravity = 0.016;
const jumpForce = 0.36;
const maxJumpHeight = 4;

// Variables para el movimiento de la cámara
let cameraVerticalAngle = 0;
const maxCameraAngle = Math.PI / 4; // 45 grados
const minCameraAngle = -Math.PI / 4; // -45 grados
const mouseSensitivity = 0.15;
let isAiming = false;

// Configuración de armas
const weapons = {
    pistol: {
        damage: 10,
        speed: 0.5,
        color: 0x637378,
        size: 0.3,
        accent: 0xffd166,
        length: 1.5,
        fireIntervalMs: 350
    },
    shotgun: {
        damage: 15,
        speed: 0.3,
        color: 0x76684f,
        size: 0.4,
        accent: 0xff8c42,
        length: 1.8,
        fireIntervalMs: 850
    },
    rifle: {
        damage: 20,
        speed: 0.7,
        color: 0x526b6a,
        size: 0.35,
        accent: 0x5eead4,
        length: 2.2,
        fireIntervalMs: 120
    },
    smg: {
        damage: 7,
        speed: 25,
        color: 0x526b6a,
        size: 0.3,
        accent: 0x5eead4,
        length: 1.65,
        fireIntervalMs: 85,
        autoFire: true
    },
    double_barrel: {
        damage: 28,
        speed: 17,
        color: 0x76684f,
        size: 0.48,
        accent: 0xff8c42,
        length: 1.8,
        fireIntervalMs: 720,
        hitRadius: 1.75
    }
};

// Obtener el arma seleccionada
let selectedWeapon = localStorage.getItem('selectedWeapon') || 'pistol';
let weaponConfig = weapons[selectedWeapon] || weapons.pistol;
const maxAmmoByWeapon = {
    pistol: 12,
    shotgun: 5,
    rifle: 30,
    smg: 36,
    double_barrel: 2
};
const ammoState = {
    pistol: maxAmmoByWeapon.pistol,
    shotgun: maxAmmoByWeapon.shotgun,
    rifle: maxAmmoByWeapon.rifle,
    smg: maxAmmoByWeapon.smg,
    double_barrel: maxAmmoByWeapon.double_barrel
};
let isReloading = false;
let isFiring = false;
let grenadeChargeStartedAt = 0;
let gunBarrel;
let gunMagazine;
let gunBolt;
let nextShotAt = 0;
let gunRestPosition;
let gunRecoil = 0;
let reloadStartedAt = 0;
let reloadDurationMs = 0;
let magazineRestPosition;
let boltRestPosition;

function selectArenaWeapon(weaponType) {
    if (!weapons[weaponType] || weaponType === selectedWeapon) return;
    selectedWeapon = weaponType;
    weaponConfig = weapons[selectedWeapon];
    localStorage.setItem('selectedWeapon', selectedWeapon);
    gunGroup.clear();
    buildGunModel();
    updateAmmoHud();
    updateKillFeed(`Weapon: ${selectedWeapon.toUpperCase()}`);
}

function setAiming(aiming) {
    isAiming = aiming && pointerLocked && !isPlayerDead;
    camera.fov = isAiming ? 54 : 75;
    camera.updateProjectionMatrix();
    gunRestPosition.set(isAiming ? 0.22 : 0.3, isAiming ? 0.9 : 1.08, isAiming ? -0.62 : -0.68);
    gunGroup.position.copy(gunRestPosition);
    gunGroup.scale.setScalar(isAiming ? 0.72 : 0.82);
    crosshair.classList.toggle('crosshair-aiming', isAiming);
}

function collectNearestAmmo() {
    let nearest = null;
    let pickupType = 'ammo';
    let nearestDistance = 2.6;

    for (const pickup of ammoPickups) {
        if (!pickup.active) continue;
        const distance = egg.position.distanceTo(pickup.mesh.position);
        if (distance < nearestDistance) {
            nearest = pickup;
            nearestDistance = distance;
            pickupType = 'ammo';
        }
    }

    for (const pickup of grenadePickups) {
        if (!pickup.active) continue;
        const distance = egg.position.distanceTo(pickup.mesh.position);
        if (distance < nearestDistance) {
            nearest = pickup;
            nearestDistance = distance;
            pickupType = 'grenade';
        }
    }

        if (!nearest) return false;

        if (pickupType === 'grenade') {
            if (grenadeCount >= maxGrenades) {
                updateKillFeed('Grenades full');
                return true;
            }
            grenadeCount += 1;
            nearest.active = false;
            nearest.mesh.visible = false;
            updateKillFeed(`Grenade collected ${grenadeCount}/${maxGrenades}`);
            playPickupSound();
            respawnPickup(nearest);
            return true;
        }
    const maxAmmo = maxAmmoByWeapon[selectedWeapon] ?? 12;
    if (ammoState[selectedWeapon] >= maxAmmo) {
        updateKillFeed('Ammo full');
        return true;
    }

    ammoState[selectedWeapon] = Math.min(maxAmmo, ammoState[selectedWeapon] + nearest.amount);
    updateAmmoHud();
    updateKillFeed('Ammo collected');
    playPickupSound();
    nearest.mesh.visible = false;
    nearest.active = false;
    respawnPickup(nearest);
    return true;
}

function updateAmmoHud() {
    const ammoNode = document.getElementById('hudAmmoValue');
    if (ammoNode) {
        ammoNode.textContent = String(ammoState[selectedWeapon] ?? 0);
    }
    const weaponNameNode = document.getElementById('hudWeaponName');
    if (weaponNameNode) weaponNameNode.textContent = selectedWeapon.replace('_', ' ').toUpperCase();
    const magazineNode = ammoNode?.nextElementSibling?.nextElementSibling;
    if (magazineNode) magazineNode.textContent = String(maxAmmoByWeapon[selectedWeapon] ?? 0);
    const grenadeNode = document.getElementById('hudGrenadeValue');
    if (grenadeNode) grenadeNode.textContent = `${grenadeCount}/${maxGrenades}`;
}

function updateKillFeed(message) {
    const feed = document.querySelector('.hud-killfeed');
    if (!feed) return;
    feed.innerHTML = `<div class="kill-feed-item">${message}</div>`;
}

function reloadWeapon() {
    if (isReloading) return;
    if (ammoState[selectedWeapon] >= maxAmmoByWeapon[selectedWeapon]) {
        updateKillFeed('Ammo full');
        return;
    }

    isReloading = true;
    reloadStartedAt = Date.now();
    reloadDurationMs = selectedWeapon === 'shotgun' ? 1250 : selectedWeapon === 'rifle' ? 1050 : 900;
    updateKillFeed(`Reloading ${selectedWeapon.toUpperCase()}...`);

    setTimeout(() => {
        if (!isReloading) return;
        socket.emit('reloadWeapon');
        updateKillFeed('Weapon ready');
        isReloading = false;
    }, reloadDurationMs);
}

// Crear el arma
const gunGroup = new THREE.Group();
egg.add(gunGroup);
gunRestPosition = new THREE.Vector3(0.3, 1.08, -0.68);

function buildGunModel() {
    gunMagazine = null;
    gunBolt = null;
    const metalMaterial = new THREE.MeshStandardMaterial({ color: weaponConfig.color, metalness: 0.62, roughness: 0.34 });
    const darkMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x344246, metalness: 0.68, roughness: 0.32 });
    const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x273235, roughness: 0.78, metalness: 0.08 });
    const accentMaterial = new THREE.MeshStandardMaterial({
        color: weaponConfig.accent,
        emissive: weaponConfig.accent,
        emissiveIntensity: 0.12,
        metalness: 0.18,
        roughness: 0.38
    });
    const gunBody = new THREE.Mesh(
        new THREE.BoxGeometry(weaponConfig.size * 1.35, weaponConfig.size * 0.7, 1.1),
        metalMaterial
    );
    gunBody.position.set(0, 0, -0.3);
    gunGroup.add(gunBody);

    const barrelCount = selectedWeapon === 'double_barrel' ? 2 : 1;
    const barrelOffset = selectedWeapon === 'double_barrel' ? weaponConfig.size * 0.28 : 0;
    for (let index = 0; index < barrelCount; index += 1) {
        const offsetX = barrelCount === 1 ? 0 : (index - 0.5) * 2 * barrelOffset;
        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(weaponConfig.size * 0.22, weaponConfig.size * 0.22, weaponConfig.length, 12),
            new THREE.MeshStandardMaterial({ color: 0x9ca9a8, metalness: 0.76, roughness: 0.25 })
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(offsetX, 0, -0.98);
        gunGroup.add(barrel);
        if (index === 0) gunBarrel = barrel;
    }

    const muzzle = new THREE.Mesh(
        new THREE.CylinderGeometry(weaponConfig.size * 0.3, weaponConfig.size * 0.24, 0.18, 12),
        darkMetalMaterial
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0, -weaponConfig.length / 2 - 0.94);
    gunGroup.add(muzzle);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(weaponConfig.size * 0.48, 0.07, 0.72), darkMetalMaterial);
    rail.position.set(0, weaponConfig.size * 0.42, -0.4);
    gunGroup.add(rail);

    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.07), accentMaterial);
    frontSight.position.set(0, weaponConfig.size * 0.42 + 0.08, -0.82);
    gunGroup.add(frontSight);

    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.09), darkMetalMaterial);
    rearSight.position.set(0, weaponConfig.size * 0.42 + 0.07, -0.08);
    gunGroup.add(rearSight);

    const gunGrip = new THREE.Mesh(
        new THREE.BoxGeometry(weaponConfig.size * 0.46, weaponConfig.size * 0.68, 0.25),
        gripMaterial
    );
    gunGrip.rotation.x = -0.18;
    gunGrip.position.set(0, -0.39, -0.08);
    gunGroup.add(gunGrip);

    gunMagazine = new THREE.Mesh(
        new THREE.BoxGeometry(weaponConfig.size * 0.58, weaponConfig.size * 0.56, 0.32),
        darkMetalMaterial
    );
    gunMagazine.position.set(0, -weaponConfig.size * 0.42, -0.56);
    gunMagazine.rotation.x = -0.1;
    gunGroup.add(gunMagazine);
    magazineRestPosition = gunMagazine.position.clone();

    gunBolt = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.24), darkMetalMaterial);
    gunBolt.position.set(-weaponConfig.size * 0.55, 0.03, -0.38);
    gunGroup.add(gunBolt);
    boltRestPosition = gunBolt.position.clone();

    const sidePlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, weaponConfig.size * 0.32, 0.48),
        accentMaterial
    );
    sidePlate.position.set(weaponConfig.size * 0.69, 0.015, -0.25);
    gunGroup.add(sidePlate);
}

buildGunModel();

    gunGroup.position.copy(gunRestPosition);
gunGroup.scale.setScalar(0.82);
egg.children.forEach((child) => {
    if (child !== gunGroup) child.visible = false;
});

function spawnMuzzleFlash(position, color = muzzleFlashColor) {
    const flashGroup = new THREE.Group();
    const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff4ce })
    );
    const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 12, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    halo.scale.set(1, 0.7, 1.8);
    const streak = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.48, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff0c2, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    streak.rotation.x = -Math.PI / 2;
    streak.position.z = -0.28;
    flashGroup.add(core, halo, streak);
    flashGroup.position.copy(position);
    scene.add(flashGroup);
    impactEffects.push({ mesh: flashGroup, life: 0.11, maxLife: 0.11, growth: 2.5 });
}

function spawnImpactEffect(position, color = 0xffd166, shielded = false, surface = null) {
    const group = new THREE.Group();
    const sparkMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const sparkGeometry = new THREE.SphereGeometry(0.045, 6, 5);
    const sparks = [];
    const sparkCount = shielded ? 7 : surface === 'ground' ? 18 : 12;
    for (let index = 0; index < sparkCount; index += 1) {
        const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
        const angle = index * Math.PI * 2 / sparkCount;
        spark.position.set(Math.cos(angle) * 0.09, surface === 'ground' ? 0.12 : Math.sin(angle) * 0.09, surface === 'ground' ? Math.sin(angle) * 0.09 : 0);
        const velocity = surface === 'ground'
            ? new THREE.Vector3(Math.cos(angle) * 0.75, 0.65 + (index % 3) * 0.2, Math.sin(angle) * 0.75)
            : new THREE.Vector3(Math.cos(angle), Math.sin(angle), (index % 2 ? 0.7 : -0.7));
        spark.userData.velocity = velocity.normalize().multiplyScalar(2.4 + (index % 3));
        group.add(spark);
        sparks.push(spark);
    }
    if (surface === 'ground') {
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.2, 0.035, 6, 20),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.08;
        group.add(ring);
    }
    const flash = new THREE.Mesh(
        new THREE.SphereGeometry(shielded ? 0.2 : 0.14, 10, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    group.add(flash);
    group.position.set(position.x, surface === 'ground' ? 0.035 : position.y, position.z);
    scene.add(group);
    const life = shielded ? 0.22 : surface === 'ground' ? 0.48 : 0.32;
    impactEffects.push({ mesh: group, life, maxLife: life, sparks });
}

function createProjectileVisual(projectile) {
    const color = weapons[projectile.weaponType]?.accent || muzzleFlashColor;
    const group = new THREE.Group();
    const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff4cc })
    );
    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const trailGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0.7)
    ]);
    const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    }));
    group.add(trail, glow, core);
    group.position.set(projectile.position.x, projectile.position.y, projectile.position.z);
    group.userData = {
        projectileId: projectile.id,
        direction: new THREE.Vector3(projectile.direction.x, projectile.direction.y, projectile.direction.z),
        speed: projectile.speed,
        traveled: 0,
        range: projectile.range,
        age: 0,
        color,
        serverPosition: new THREE.Vector3(projectile.position.x, projectile.position.y, projectile.position.z)
    };
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), group.userData.direction);
    scene.add(group);
    bullets.push(group);
}

// Crear un grupo para los ojos
const eyesGroup = new THREE.Group();
egg.add(eyesGroup);
eyesGroup.visible = false;

const eyeGeometry = new THREE.SphereGeometry(0.18, 16, 16);
const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a,
    emissive: 0x66ffcc,
    emissiveIntensity: 0.4
});
const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
leftEye.position.set(-0.3, 0.3, 0.9);
rightEye.position.set(0.3, 0.3, 0.9);
eyesGroup.add(leftEye);
eyesGroup.add(rightEye);

document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === renderer.domElement || document.pointerLockElement === document.body;
    if (!pointerLocked) {
        setAiming(false);
        lastLookPoint = null;
    }
});

document.addEventListener('pointerlockerror', () => {
    pointerLocked = false;
    lastLookPoint = null;
});

document.addEventListener('mousedown', (event) => {
    if (event.target !== renderer.domElement || !window.gameInitialized) return;

    if (event.button === 2) {
        if (!isPlayerDead && grenadeCount > 0) {
            grenadeChargeStartedAt = Date.now();
            grenadeChargeIndicator.classList.add('charging');
            updateKillFeed('HOLD TO CHARGE GRENADE');
        }
        return;
    }
    if (event.button !== 0) return;
    isFiring = true;
    if (!pointerLocked) {
        const lockRequest = renderer.domElement.requestPointerLock?.();
        if (lockRequest && typeof lockRequest.catch === 'function') {
            lockRequest.catch(() => {
                pointerLocked = false;
            });
        }
        lastLookPoint = { x: event.clientX, y: event.clientY };
        shoot(true);
        return;
    }
    shoot();
});

document.addEventListener('mouseup', (event) => {
    if (event.button === 0) isFiring = false;
    if (event.button === 2 && grenadeChargeStartedAt) {
        const charge = Math.min(1, (Date.now() - grenadeChargeStartedAt) / 1200);
        grenadeChargeStartedAt = 0;
        grenadeChargeIndicator.classList.remove('charging');
        throwGrenade(charge);
    }
});

window.addEventListener('blur', () => {
    isFiring = false;
    grenadeChargeStartedAt = 0;
    grenadeChargeIndicator.classList.remove('charging');
});

document.addEventListener('contextmenu', (event) => event.preventDefault());

document.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
        document.exitPointerLock?.();
        pointerLocked = false;
    }

    if (event.key.toLowerCase() === 't') {
        changeTeam();
    }

    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        setAiming(true);
    }

});

document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === renderer.domElement || document.pointerLockElement === document.body) {
        yawAngle -= event.movementX * 0.0022;
        cameraVerticalAngle -= event.movementY * 0.0018;
        cameraVerticalAngle = Math.max(minCameraAngle, Math.min(maxCameraAngle, cameraVerticalAngle));
        egg.rotation.y = yawAngle;
    } else if (window.gameInitialized && event.target === renderer.domElement) {
        if (lastLookPoint) {
            yawAngle -= (event.clientX - lastLookPoint.x) * 0.0022;
            cameraVerticalAngle -= (event.clientY - lastLookPoint.y) * 0.0018;
            cameraVerticalAngle = Math.max(minCameraAngle, Math.min(maxCameraAngle, cameraVerticalAngle));
            egg.rotation.y = yawAngle;
        }
        lastLookPoint = { x: event.clientX, y: event.clientY };
    } else {
        lastLookPoint = null;
    }

    eyesGroup.rotation.x = cameraVerticalAngle;
    gunGroup.rotation.x = cameraVerticalAngle;
});

// Modificar las teclas para incluir el salto
const keys = {
    w: false,
    s: false,
    a: false,
    d: false,
    space: false
};
let jumpRequested = false;

document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !event.repeat) {
        jumpRequested = true;
    } else if (event.key.toLowerCase() === 'r') {
        reloadWeapon();
    } else if (event.key.toLowerCase() === 'g') {
        throwGrenade(0.35);
    } else if (event.key.toLowerCase() === 'f') {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
        requestNearestWeaponPickup();
    } else if (keys.hasOwnProperty(event.key.toLowerCase())) {
        keys[event.key.toLowerCase()] = true;
    }
});

function changeTeam() {
    const nextTeam = currentTeam === 'red' ? 'blue' : 'red';
    currentTeam = nextTeam;
    updateTeamDisplay(nextTeam);
    socket.emit('changeTeam', {
        roomId: matchState.roomId,
        team: nextTeam
    });
    updateKillFeed(`Team: ${nextTeam.toUpperCase()}`);
}

function changeTeamWhileDead() {
    changeTeam();
}

document.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key.toLowerCase())) {
        keys[event.key.toLowerCase()] = false;
    }

    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        setAiming(false);
    }
});

const moveSpeed = 0.2;

// Almacenar otros jugadores
const otherPlayers = new Map();

socket.on('roomJoined', ({ roomId, state, player }) => {
    matchState.roomId = roomId;
    if (player) {
        if (weapons[player.weapon]) {
            selectedWeapon = player.weapon;
            weaponConfig = weapons[player.weapon];
            if (player.ammo) Object.assign(ammoState, player.ammo);
            if (Number.isInteger(player.grenades)) grenadeCount = player.grenades;
            gunGroup.clear();
            buildGunModel();
            updateAmmoHud();
        }
        currentTeam = player.team || currentTeam;
        egg.position.set(player.position.x, player.position.y, player.position.z);
        yawAngle = player.rotation.y;
        egg.rotation.y = yawAngle;
        updateTeamDisplay(currentTeam);
    }
    if (state?.players) {
        matchState.players = dedupeRoomPlayers(state.players);
        const currentPlayer = matchState.players.find((p) => p.id === socket.id);
        if (currentPlayer && currentPlayer.team) {
            currentTeam = currentPlayer.team;
            updateTeamDisplay(currentPlayer.team);
        }
    }
    if (!player) {
        yawAngle = currentTeam === 'red' ? -2.05 : 1.09;
    }
    egg.rotation.y = yawAngle;
    renderPlayerList();
    console.log('Unido a la sala', roomId, state);
});

socket.on('teamChanged', ({ team }) => {
    if (!team) return;
    currentTeam = team;
    updateTeamDisplay(team);
    updateKillFeed(`Team: ${team.toUpperCase()}`);
});

socket.on('roomState', (state) => {
    if (!state) return;
    matchState.roomId = state.roomId;
    matchState.players = dedupeRoomPlayers(Array.isArray(state.players) ? state.players : []);
    document.getElementById('roomLabel').textContent = `Sala: ${state.roomId}`;
    renderPlayerList();
});

// Manejar nuevos jugadores
socket.on('newPlayer', (playerInfo) => {
    if (!playerInfo || playerInfo.id === socket.id) return;

    if (otherPlayers.has(playerInfo.id)) {
        return;
    }

    const teamColor = getTeamColor(playerInfo.team);
    const otherPlayer = createAlienCharacter(teamColor);
    otherPlayer.position.set(
        playerInfo.position?.x || 0,
        playerInfo.position?.y || 0,
        playerInfo.position?.z || 0
    );
    otherPlayer.rotation.y = playerInfo.rotation?.y || 0;
    scene.add(otherPlayer);
    otherPlayers.set(playerInfo.id, otherPlayer);
});

// Manejar jugadores existentes
socket.on('currentPlayers', (players) => {
    if (!Array.isArray(players)) return;

    players.forEach(([id, playerInfo]) => {
        if (!id || id === socket.id) return;

        if (otherPlayers.has(id)) {
            const existing = otherPlayers.get(id);
            if (existing && playerInfo?.position) {
                existing.position.set(
                    playerInfo.position.x || 0,
                    playerInfo.position.y || 0,
                    playerInfo.position.z || 0
                );
                existing.rotation.y = playerInfo.rotation?.y || 0;
            }
            return;
        }

        const teamColor = getTeamColor(playerInfo?.team);
        const otherPlayer = createAlienCharacter(teamColor);
        otherPlayer.position.set(
            playerInfo?.position?.x || 0,
            playerInfo?.position?.y || 0,
            playerInfo?.position?.z || 0
        );
        otherPlayer.rotation.y = playerInfo?.rotation?.y || 0;
        scene.add(otherPlayer);
        otherPlayers.set(id, otherPlayer);
    });
});

// Manejar actualizaciones de posición de otros jugadores
socket.on('updatePlayer', (playerInfo) => {
    if (!playerInfo || !playerInfo.id) return;

    let otherPlayer = otherPlayers.get(playerInfo.id);
    if (!otherPlayer) {
        const teamColor = getTeamColor(playerInfo?.team);
        otherPlayer = createAlienCharacter(teamColor);
        otherPlayer.position.set(
            playerInfo.position?.x || 0,
            playerInfo.position?.y || 0,
            playerInfo.position?.z || 0
        );
        scene.add(otherPlayer);
        otherPlayers.set(playerInfo.id, otherPlayer);
    }

    otherPlayer.position.set(
        playerInfo.position?.x ?? otherPlayer.position.x,
        playerInfo.position?.y ?? otherPlayer.position.y,
        playerInfo.position?.z ?? otherPlayer.position.z
    );
    otherPlayer.rotation.y = playerInfo.rotation?.y ?? otherPlayer.rotation.y;
});

socket.on('playerPositionCorrected', (playerInfo) => {
    if (!playerInfo?.position) return;
    egg.position.set(playerInfo.position.x, playerInfo.position.y, playerInfo.position.z);
});

// Manejar desconexión de jugadores
socket.on('playerDisconnected', (playerId) => {
    const otherPlayer = otherPlayers.get(playerId);
    if (otherPlayer) {
        scene.remove(otherPlayer);
        otherPlayers.delete(playerId);
    }

    if (Array.isArray(matchState.players)) {
        matchState.players = matchState.players.filter((player) => player.id !== playerId);
        renderPlayerList();
    }
});

socket.on('projectileSpawned', (projectile) => {
    if (!projectile || bullets.some((bullet) => bullet.userData.projectileId === projectile.id)) return;
    createProjectileVisual(projectile);
    if (projectile.playerId !== socket.id) {
        playShotSound();
    } else {
        updateKillFeed(`${projectile.weaponType.toUpperCase()} FIRED`);
    }
});

socket.on('shotRejected', ({ weaponType, ammo } = {}) => {
    if (ammo) {
        Object.assign(ammoState, ammo);
    } else if (weaponType && Object.hasOwn(ammoState, weaponType)) {
        ammoState[weaponType] = Math.min(maxAmmoByWeapon[weaponType], ammoState[weaponType] + 1);
    }
    updateAmmoHud();
    updateKillFeed('Shot not accepted');
});

socket.on('projectileUpdate', (projectiles) => {
    if (!Array.isArray(projectiles)) return;
    for (const update of projectiles) {
        const visual = bullets.find((bullet) => bullet.userData.projectileId === update.id);
        if (visual) {
            visual.userData.serverPosition.set(update.position.x, update.position.y, update.position.z);
        }
    }
});

socket.on('projectileImpact', (impact) => {
    if (!impact) return;
    const bulletIndex = bullets.findIndex((bullet) => bullet.userData.projectileId === impact.id);
    if (bulletIndex !== -1) {
        scene.remove(bullets[bulletIndex]);
        bullets.splice(bulletIndex, 1);
    }

    const surfaceColors = { wood: 0xff9b54, foliage: 0x9fe870, metal: 0x9eeaff };
    const impactColor = impact.shielded ? 0x64e6ff : impact.targetId ? 0x76f7b0 : (surfaceColors[impact.surface] || 0xffbd69);
    spawnImpactEffect(impact.position, impactColor, impact.shielded, impact.surface);
    if (impact.playerId === socket.id) {
        if (impact.shielded) {
            updateKillFeed('IMPACT BLOCKED BY SHIELD');
        } else if (!impact.targetId) {
            const surfaceNames = { wood: 'WOOD', metal: 'METAL', foliage: 'FOLIAGE', ground: 'GROUND' };
            updateKillFeed(`IMPACT: ${surfaceNames[impact.surface] || 'ARENA'}`);
        }
    }
    if (impact.targetId === socket.id && !impact.shielded) {
        playHitSound();
        updateKillFeed('YOU WERE HIT');
    }
    if (impact.playerId === socket.id && impact.targetId && !impact.shielded) {
        playHitSound();
        updateKillFeed('DIRECT HIT');
    }
});

// Manejar daño recibido
socket.on('playerDamaged', (data) => {
    if (data.id === socket.id) {
        const damage = Math.max(0, health - Number(data.health));
        updateHealth(damage);
        updateKillFeed('You were hit!');
        return;
    }

    const otherPlayer = otherPlayers.get(data.id);
    if (otherPlayer) {
        setRemotePlayerHealth(otherPlayer, data.health);
    }
});

socket.on('playerKilled', (data) => {
    if (data.id === socket.id) {
        handlePlayerDeath();
        return;
    }

    const otherPlayer = otherPlayers.get(data.id);
    if (otherPlayer) {
        setRemotePlayerHealth(otherPlayer, 0);
        otherPlayer.visible = false;
    }
    if (data.killerId === socket.id) {
        awardKill();
        updateKillFeed('You eliminated an alien');
    }
});

// Manejar respawn
socket.on('playerRespawn', (data) => {
    if (data.id === socket.id) {
        isPlayerDead = false;
        respawnAvailableAt = 0;
        egg.position.set(data.position.x, data.position.y, data.position.z);
        if (Number.isInteger(data.grenades)) grenadeCount = data.grenades;
        activateSpawnShield();
        health = 100;
        updateHealth(0);
    } else {
        const otherPlayer = otherPlayers.get(data.id);
        if (otherPlayer) {
            setRemotePlayerHealth(otherPlayer, 0);
            otherPlayer.visible = false;
        }
    }
});


// Sistema de disparos
const bullets = [];
const ammoPickups = [];
const weaponPickupMeshes = new Map();

function createWeaponPickupVisual(pickup) {
    const group = new THREE.Group();
    const accent = pickup.weaponType === 'smg' ? 0x5eead4 : 0xff8c42;
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x46585a, metalness: 0.62, roughness: 0.34 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.22 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(pickup.weaponType === 'smg' ? 0.34 : 0.48, 0.22, 0.86), bodyMaterial);
    group.add(body);

    const barrelCount = pickup.weaponType === 'double_barrel' ? 2 : 1;
    for (let index = 0; index < barrelCount; index += 1) {
        const offset = barrelCount === 1 ? 0 : (index - 0.5) * 0.18;
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.52, 10), bodyMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(offset, 0.025, -0.55);
        group.add(barrel);
    }

    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.32), accentMaterial);
    marker.position.set(0, 0.14, -0.12);
    group.add(marker);
    const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.66, 0.035, 8, 32),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.55 })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.25;
    group.add(halo);
    group.position.set(pickup.position.x, pickup.position.y, pickup.position.z);
    group.userData = { pickupId: pickup.id, weaponType: pickup.weaponType, baseY: pickup.position.y, phase: pickup.id.length };
    scene.add(group);
    weaponPickupMeshes.set(pickup.id, group);
}

function syncWeaponPickups(pickups) {
    const activeIds = new Set();
    for (const pickup of pickups || []) {
        if (!pickup.active) continue;
        activeIds.add(pickup.id);
        if (!weaponPickupMeshes.has(pickup.id)) createWeaponPickupVisual(pickup);
    }

    for (const [pickupId, mesh] of weaponPickupMeshes) {
        if (activeIds.has(pickupId)) continue;
        scene.remove(mesh);
        mesh.traverse((child) => {
            child.geometry?.dispose();
            child.material?.dispose?.();
        });
        weaponPickupMeshes.delete(pickupId);
    }
}

function requestNearestWeaponPickup() {
    if (isPlayerDead || !socket.connected) return;
    let nearest = null;
    let nearestDistance = 3.4;
    for (const [pickupId, mesh] of weaponPickupMeshes) {
        const distance = Math.hypot(egg.position.x - mesh.position.x, egg.position.z - mesh.position.z);
        if (distance < nearestDistance) {
            nearest = pickupId;
            nearestDistance = distance;
        }
    }
    if (nearest) socket.emit('pickupWeapon', { pickupId: nearest });
}

function updateWeaponPickupPrompt() {
    let nearest = null;
    let nearestDistance = 3.4;
    for (const [pickupId, mesh] of weaponPickupMeshes) {
        const distance = Math.hypot(egg.position.x - mesh.position.x, egg.position.z - mesh.position.z);
        if (distance < nearestDistance) {
            nearest = { pickupId, mesh };
            nearestDistance = distance;
        }
    }
    weaponPickupPrompt.textContent = nearest ? `F  PICK UP ${nearest.mesh.userData.weaponType.replace('_', ' ').toUpperCase()}` : '';
}

socket.on('weaponPickups', syncWeaponPickups);
socket.on('weaponEquipped', ({ weaponType, ammo } = {}) => {
    if (!weapons[weaponType]) return;
    if (ammo) Object.assign(ammoState, ammo);
    selectedWeapon = weaponType;
    weaponConfig = weapons[weaponType];
    localStorage.setItem('selectedWeapon', weaponType);
    gunGroup.clear();
    buildGunModel();
    updateAmmoHud();
    playPickupSound();
    updateKillFeed(`EQUIPPED ${weaponType.replace('_', ' ').toUpperCase()}`);
});
socket.on('weaponAmmo', (ammo) => {
    if (!ammo || typeof ammo !== 'object') return;
    Object.assign(ammoState, ammo);
    updateAmmoHud();
});
socket.on('grenadeAmmo', (count) => {
    if (!Number.isInteger(count)) return;
    grenadeCount = count;
    updateAmmoHud();
});

socket.on('grenadeSpawned', (grenade) => {
    if (!grenade || grenades.some((item) => item.id === grenade.id)) return;
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 14, 10),
        new THREE.MeshStandardMaterial({ color: 0x87d987, metalness: 0.45, roughness: 0.32, emissive: 0x1c512a, emissiveIntensity: 0.25 })
    );
    mesh.position.set(grenade.position.x, grenade.position.y, grenade.position.z);
    mesh.userData.grenadeId = grenade.id;
    scene.add(mesh);
    grenades.push({ id: grenade.id, mesh, velocity: new THREE.Vector3(grenade.velocity.x, grenade.velocity.y, grenade.velocity.z) });
});

socket.on('grenadeUpdate', (updates) => {
    if (!Array.isArray(updates)) return;
    for (const update of updates) {
        const grenade = grenades.find((item) => item.id === update.id);
        if (!grenade) continue;
        grenade.mesh.position.set(update.position.x, update.position.y, update.position.z);
        grenade.velocity.set(update.velocity.x, update.velocity.y, update.velocity.z);
    }
});

socket.on('grenadeDetonated', (data) => {
    const grenadeIndex = grenades.findIndex((item) => item.id === data.id);
    if (grenadeIndex !== -1) {
        scene.remove(grenades[grenadeIndex].mesh);
        grenades.splice(grenadeIndex, 1);
    }
    const explosion = new THREE.Mesh(
        new THREE.SphereGeometry(1, 18, 12),
        new THREE.MeshBasicMaterial({ color: 0xff873d, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    explosion.position.set(data.position.x, data.position.y, data.position.z);
    scene.add(explosion);
    impactEffects.push({ mesh: explosion, life: 0.42, maxLife: 0.42, growth: 7 });
    playHitSound();
});

socket.on('grenadeRejected', ({ grenades: count } = {}) => {
    if (Number.isInteger(count)) grenadeCount = count;
    updateAmmoHud();
    updateKillFeed('GRENADE NOT ACCEPTED');
});

function createAmmoPickup(position, amount = 12) {
    const pickup = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.2, 1.2),
        new THREE.MeshStandardMaterial({
            color: 0xfcd34d,
            emissive: 0xfbbf24,
            emissiveIntensity: 0.45,
            metalness: 0.4,
            roughness: 0.3
        })
    );
    pickup.position.copy(position);
    pickup.userData = { ammo: amount };
    scene.add(pickup);
    ammoPickups.push({ mesh: pickup, amount, active: true });
    return pickup;
}

const maxGrenades = 3;
let grenadeCount = 3;
const grenadePickups = [];
const grenades = [];

function randomPickupPosition() {
    return new THREE.Vector3(
        THREE.MathUtils.randFloat(-16, 16),
        0.65,
        THREE.MathUtils.randFloat(-16, 16)
    );
}

function createGrenadePickup(position) {
    const pickup = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x166534, emissiveIntensity: 0.5 })
    );
    pickup.position.copy(position);
    scene.add(pickup);
    grenadePickups.push({ mesh: pickup, active: true });
}

function respawnPickup(pickup) {
    setTimeout(() => {
        pickup.mesh.position.copy(randomPickupPosition());
        pickup.active = true;
        pickup.mesh.visible = true;
        if (!pickup.mesh.parent) scene.add(pickup.mesh);
    }, 8000);
}

function throwGrenade(charge = 0.35) {
    if ((!pointerLocked && !window.gameInitialized) || isPlayerDead || grenadeCount <= 0 || !socket.connected) return;

    const direction = new THREE.Vector3(0, 0, -1)
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), cameraVerticalAngle)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle)
        .normalize();
    const position = camera.position.clone().add(direction.clone().multiplyScalar(0.8));
    socket.emit('grenadeThrown', {
        position: { x: position.x, y: position.y, z: position.z },
        direction: { x: direction.x, y: direction.y, z: direction.z },
        charge: Math.max(0, Math.min(1, charge))
    });
    playShotSound();
    updateKillFeed(`GRENADE ${Math.round(charge * 100)}%`);
}

createAmmoPickup(new THREE.Vector3(-8, 1.2, 8), 12);
createAmmoPickup(new THREE.Vector3(8, 1.2, -8), 12);
createAmmoPickup(new THREE.Vector3(0, 1.2, 12), 10);
createGrenadePickup(new THREE.Vector3(-4, 0.65, 8));
createGrenadePickup(new THREE.Vector3(5, 0.65, -8));

// Función para manejar el salto y la gravedad
function handleJump() {
    if (jumpRequested && !isJumping) {
        verticalVelocity = jumpForce;
        isJumping = true;
    }

    jumpRequested = false;
    const previousY = egg.position.y;
    verticalVelocity -= gravity;
    const nextY = egg.position.y + verticalVelocity;
    const landingY = window.ARENA_PHYSICS.findLandingSurface(
        previousY,
        nextY,
        egg.position.x,
        egg.position.z,
        playerCollisionBoxes
    );

    if (landingY !== null) {
        egg.position.y = landingY;
        verticalVelocity = 0;
        isJumping = false;
    } else {
        egg.position.y = Math.max(0, nextY);
    }
}

// Modificar la función shoot para usar la configuración del arma
function shoot(allowUnlocked = false) {
    if ((!pointerLocked && !allowUnlocked) || !window.gameInitialized || isPlayerDead || Date.now() < shieldUntil) {
        return;
    }

    const now = Date.now();
    if (now < nextShotAt) return;

    if (isReloading || ammoState[selectedWeapon] <= 0) {
        if (!isReloading) {
            updateKillFeed('Out of ammo');
        }
        return;
    }

    nextShotAt = now + weaponConfig.fireIntervalMs + (weaponConfig.autoFire ? 0 : 20);
    gunRecoil = 1;
    ammoState[selectedWeapon] -= 1;
    updateAmmoHud();
    playShotSound();

    const gunWorldPosition = new THREE.Vector3();
    gunBarrel.getWorldPosition(gunWorldPosition);

    const direction = new THREE.Vector3(0, 0, -1)
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), cameraVerticalAngle)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), egg.rotation.y)
        .normalize();

    spawnMuzzleFlash(gunWorldPosition, weaponConfig.accent || muzzleFlashColor);

    socket.emit('playerShoot', {
        position: gunWorldPosition,
        direction: direction,
        weaponType: selectedWeapon
    });

}


// Sistema de vidas
let health = 100;
const healthBar = document.createElement('div');
healthBar.className = 'legacy-health';
document.body.appendChild(healthBar);

const healthFill = document.createElement('div');
healthFill.className = 'legacy-health-fill';
healthBar.appendChild(healthFill);

const hudHealthFill = document.getElementById('hudHealthFill');
const hudHealthValue = document.getElementById('hudHealthValue');

function updateHealth(damage) {
    health -= damage;
    if (health < 0) health = 0;
    const normalized = Math.max(0, Math.min(100, health));
    healthFill.style.width = `${normalized}%`;
    healthFill.style.backgroundColor = normalized > 50 ? '#0f0' : normalized > 25 ? '#ff0' : '#f00';

    if (hudHealthFill) {
        hudHealthFill.style.width = `${normalized}%`;
    }
    if (hudHealthValue) {
        hudHealthValue.textContent = String(Math.round(normalized));
    }

    if (health <= 0) {
        handlePlayerDeath();
    }
}

async function finishMatch(isWinner = false) {
    if (!matchState.isActive) return;

    matchState.isActive = false;
    const payload = {
        roomId: matchState.roomId,
        winnerId: isWinner ? socket.id : null
    };

    try {
        const response = await fetch('/api/matches/finish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('No se pudo guardar la partida');
        }

        const result = await response.json();
        if (isWinner) {
            alert(`¡Victoria! ${playerName}`);
        } else {
            alert(`Partida finalizada. Ganador: ${result.match.winner || 'Sin ganador'}`);
        }
    } catch (error) {
        console.error(error);
    }
}

function awardKill() {
    matchState.stats.kills += 1;
    const currentMeteorValue = Number(localStorage.getItem('meteorCount') || 0);
    const nextValue = currentMeteorValue + 1;
    localStorage.setItem('meteorCount', String(nextValue));

    const meteorCounter = document.getElementById('meteorCount');
    if (meteorCounter) {
        meteorCounter.textContent = String(nextValue);
    }

    refreshMeteorHud();
}

// Colisiones
function checkCollisions() {
    // Colisiones con paredes
    const wallBounds = 30;
    if (Math.abs(egg.position.x) > wallBounds) {
        egg.position.x = Math.sign(egg.position.x) * wallBounds;
    }
    if (Math.abs(egg.position.z) > wallBounds) {
        egg.position.z = Math.sign(egg.position.z) * wallBounds;
    }

    // Projectile and grenade positions are simulated and replicated by the server.
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
        const projectile = bullets[i];
        const data = projectile.userData;
        const stepDistance = Math.min(data.speed * 0.016, data.range - data.traveled);
        projectile.position.addScaledVector(data.direction, stepDistance);
        projectile.position.lerp(data.serverPosition, 0.22);
        data.traveled += stepDistance;
        data.age += 0.016;

        const trail = projectile.children[0];
        trail.material.opacity = Math.max(0.22, 0.82 - data.age * 0.12);
        if (data.traveled >= data.range || data.age > data.range / data.speed + 0.35) {
            scene.remove(projectile);
            bullets.splice(i, 1);
        }
    }
    
    // Colisiones con otros jugadores
    for (const [id, otherPlayer] of otherPlayers) {
        if (egg.position.distanceTo(otherPlayer.position) < 2) {
            // Empujar al jugador fuera del otro jugador
            const pushDirection = new THREE.Vector3()
                .subVectors(egg.position, otherPlayer.position)
                .normalize()
                .multiplyScalar(0.1);
            egg.position.add(pushDirection);
        }
    }

    for (let i = impactEffects.length - 1; i >= 0; i--) {
        const effect = impactEffects[i];
        effect.life -= 0.016;
        const progress = 1 - Math.max(0, effect.life / effect.maxLife);
        effect.mesh.scale.setScalar(1 + progress * (effect.growth || 4));
        if (effect.sparks) {
            for (const spark of effect.sparks) {
                spark.position.addScaledVector(spark.userData.velocity, 0.016);
                spark.scale.setScalar(Math.max(0.05, 1 - progress));
            }
            const flash = effect.mesh.children[effect.mesh.children.length - 1];
            flash.material.opacity = Math.max(0, 0.85 * (1 - progress));
        }
        if (effect.life <= 0) {
            effect.mesh.traverse((child) => {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
                else child.material?.dispose();
            });
            scene.remove(effect.mesh);
            impactEffects.splice(i, 1);
        }
    }
}

// Modificar la función animate para incluir la rotación del personaje
function animate() {
    requestAnimationFrame(animate);
    
    // Solo renderizar si el juego está inicializado
    if (!window.gameInitialized) {
        return;
    }

    if (Date.now() < shieldUntil && isPlayerDead === false) {
        const pulse = 0.45 + Math.sin(Date.now() * 0.02) * 0.1;
        egg.scale.setScalar(pulse);
    } else {
        egg.scale.setScalar(1);
    }
    
    updatePlayerPosition();
    checkCollisions();
    
    // Rotar el personaje horizontalmente
    egg.rotation.y = yawAngle;
    
    // Aplicar la rotación vertical al grupo de ojos y el arma
    eyesGroup.rotation.x = cameraVerticalAngle;
    gunGroup.rotation.x = cameraVerticalAngle;
    const frameDelta = Math.min(gameClock.getDelta(), 0.05);
    const moving = keys.w || keys.a || keys.s || keys.d;
    const motionTime = performance.now();
    const sway = moving ? 0.018 : 0.006;
    const bob = moving ? 0.026 : 0.008;
    gunRecoil *= Math.exp(-frameDelta * (selectedWeapon === 'shotgun' ? 7 : 12));
    if (isFiring && weapons[selectedWeapon].autoFire) shoot(true);
    gunGroup.position.x = gunRestPosition.x + Math.sin(motionTime * (moving ? 0.012 : 0.002)) * sway;
    gunGroup.position.y = gunRestPosition.y + Math.sin(motionTime * (moving ? 0.024 : 0.003)) * bob - gunRecoil * (selectedWeapon === 'shotgun' ? 0.16 : 0.085);
    gunGroup.position.z = gunRestPosition.z + gunRecoil * (selectedWeapon === 'shotgun' ? 0.24 : 0.13);
    gunGroup.rotation.x = cameraVerticalAngle - gunRecoil * (selectedWeapon === 'shotgun' ? 0.13 : 0.055);
    gunGroup.rotation.z = Math.sin(motionTime * (moving ? 0.012 : 0.002)) * (moving ? 0.012 : 0.004) - gunRecoil * 0.035;

    if (isReloading && gunMagazine && gunBolt) {
        const progress = Math.min(1, (Date.now() - reloadStartedAt) / reloadDurationMs);
        const magazineDip = Math.sin(progress * Math.PI) * 0.34;
        gunMagazine.position.y = magazineRestPosition.y - magazineDip;
        gunMagazine.rotation.x = -0.1 - magazineDip * 0.65;
        const boltProgress = Math.max(0, Math.min(1, (progress - 0.58) / 0.24));
        gunBolt.position.z = boltRestPosition.z + Math.sin(boltProgress * Math.PI) * 0.18;
    } else if (gunMagazine && gunBolt) {
        gunMagazine.position.copy(magazineRestPosition);
        gunMagazine.rotation.x = -0.1;
        gunBolt.position.copy(boltRestPosition);
    }

    for (const pickup of weaponPickupMeshes.values()) {
        pickup.position.y = pickup.userData.baseY + Math.sin(motionTime * 0.002 + pickup.userData.phase) * 0.12;
        pickup.rotation.y += frameDelta * 0.45;
    }
    updateWeaponPickupPrompt();
    for (const grenade of grenades) {
        grenade.mesh.rotation.x += frameDelta * 2.2;
        grenade.mesh.rotation.z += frameDelta * 1.4;
    }
    if (grenadeChargeStartedAt) {
        const charge = Math.min(1, (Date.now() - grenadeChargeStartedAt) / 1200);
        grenadeChargeIndicator.querySelector('i').style.width = `${Math.round(charge * 100)}%`;
    }
    
    renderer.render(scene, camera);
}

updateAmmoHud();
refreshMeteorHud();
renderPlayerList();
updateKillFeed('Fight in the arena');

// Inicializar solo cuando el juego esté listo
const gameStartObserver = new MutationObserver(() => {
    if (window.gameInitialized && !window.gameRendererInitialized) {
        window.gameRendererInitialized = true;
        hud.style.display = 'block';
        initializeGameRenderer();
        animate();
    }
});

gameStartObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
animate();

// Modificar la función updatePlayerPosition para mantener la cámara en primera persona
function updatePlayerPosition() {
    if (isPlayerDead) {
        return;
    }

    const movement = new THREE.Vector3();
    if (keys.w) movement.z -= 1;
    if (keys.s) movement.z += 1;
    if (keys.a) movement.x -= 1;
    if (keys.d) movement.x += 1;

    if (movement.lengthSq() > 0) {
        movement.normalize();
        const forwardX = Math.sin(yawAngle);
        const forwardZ = Math.cos(yawAngle);
        const rightX = Math.cos(yawAngle);
        const rightZ = -Math.sin(yawAngle);

        const moveX = movement.x * rightX + movement.z * forwardX;
        const moveZ = movement.x * rightZ + movement.z * forwardZ;

        const nextPosition = egg.position.clone();
        nextPosition.x += moveX * moveSpeed;
        nextPosition.z += moveZ * moveSpeed;
        resolveObstacleCollision(nextPosition);
        egg.position.x = nextPosition.x;
        egg.position.y = nextPosition.y;
        egg.position.z = nextPosition.z;
    }

    collectNearestAmmo();
    
    handleJump();

    // Actualizar la posición de la cámara para seguir al jugador en primera persona
    camera.position.x = egg.position.x;
    camera.position.y = egg.position.y + 1.8;
    camera.position.z = egg.position.z;
    
    // Aplicar la rotación vertical de la cámara
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyAxisAngle(new THREE.Vector3(1, 0, 0), cameraVerticalAngle);
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle);
    direction.normalize();
    camera.lookAt(camera.position.clone().add(direction));
    
    // Enviar la posición actual al servidor
    socket.emit('playerMove', {
        position: {
            x: egg.position.x,
            y: egg.position.y,
            z: egg.position.z
        },
        rotation: {
            y: egg.rotation.y,
            x: cameraVerticalAngle
        }
    });
}

function resolveObstacleCollision(nextPosition) {
    const resolved = window.ARENA_PHYSICS.resolvePlayerMove(egg.position, nextPosition, playerCollisionBoxes);
    nextPosition.set(resolved.x, resolved.y, resolved.z);
}
