// import * as THREE from '/modules/three/build/three.module.js';
// import { io } from '/modules/socket.io-client/dist/socket.io.js';

// import * as THREE from 'three';

const socket = io();
const storedUser = window.authSession?.getStoredUser ? window.authSession.getStoredUser() : null;
const playerName = storedUser?.username || 'Jugador';
const token = window.authSession?.getStoredToken ? window.authSession.getStoredToken() : null;
let matchState = {
    roomId: localStorage.getItem('roomId') || 'default-room',
    isActive: true,
    stats: {
        kills: 0,
        deaths: 0
    }
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x081a2d);
scene.fog = new THREE.Fog(0x081a2d, 15, 60);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x081a2d);
renderer.shadowMap.enabled = true;
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Luces
const hemiLight = new THREE.HemisphereLight(0x88b6ff, 0x161a30, 0.9);
scene.add(hemiLight);

const light = new THREE.DirectionalLight(0xffffff, 1.4);
light.position.set(10, 15, 10);
light.castShadow = true;
light.shadow.mapSize.set(1024, 1024);
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 50;
scene.add(light);

const ambientLight = new THREE.AmbientLight(0x7a8ca0, 0.8);
scene.add(ambientLight);

// Crear el suelo
const floorGeometry = new THREE.PlaneGeometry(40, 40);
const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2b5e49,
    roughness: 0.9,
    metalness: 0.05
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(40, 40, 0x3f9b7c, 0x2a5943);
grid.position.y = 0.01;
scene.add(grid);

// Crear paredes
const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x304458,
    roughness: 0.7,
    metalness: 0.05
});

// Pared frontal
const wallGeometry1 = new THREE.BoxGeometry(40, 5, 1);
const wallFront = new THREE.Mesh(wallGeometry1, wallMaterial);
wallFront.position.set(0, 2.5, -20);
wallFront.receiveShadow = true;
scene.add(wallFront);

// Pared trasera
const wallBack = new THREE.Mesh(wallGeometry1, wallMaterial);
wallBack.position.set(0, 2.5, 20);
wallBack.receiveShadow = true;
scene.add(wallBack);

// Pared izquierda
const wallGeometry2 = new THREE.BoxGeometry(1, 5, 40);
const wallLeft = new THREE.Mesh(wallGeometry2, wallMaterial);
wallLeft.position.set(-20, 2.5, 0);
wallLeft.receiveShadow = true;
scene.add(wallLeft);

// Pared derecha
const wallRight = new THREE.Mesh(wallGeometry2, wallMaterial);
wallRight.position.set(20, 2.5, 0);
wallRight.receiveShadow = true;
scene.add(wallRight);

// Obstáculos
const obstacleGeometry = new THREE.BoxGeometry(3, 3, 3);
const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x4f8c71, roughness: 0.7, metalness: 0.02 });

// Crear algunos obstáculos
const obstacles = [];
const obstaclePositions = [
    { x: -5, z: -5 },
    { x: 5, z: 5 },
    { x: -3, z: 3 },
    { x: 3, z: -3 }
];

obstaclePositions.forEach(pos => {
    const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
    obstacle.position.set(pos.x, 0.5, pos.z);
    scene.add(obstacle);
    obstacles.push(obstacle);
});

// Personaje (alien)
const alien = new THREE.Group();

const bodyGeometry = new THREE.SphereGeometry(1.2, 32, 32);
const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x42f0c4, roughness: 0.4, metalness: 0.1 });
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
leftEye.position.set(-0.35, 1.5, 0.75);
rightEye.position.set(0.35, 1.5, 0.75);
alien.add(leftEye);
alien.add(rightEye);

const armGeometry = new THREE.CylinderGeometry(0.18, 0.18, 1.8, 16);
const armMaterial = new THREE.MeshStandardMaterial({ color: 0x42f0c4, roughness: 0.4, metalness: 0.1 });
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

alien.position.y = 1.1;
const egg = alien;
scene.add(egg);

// Configurar la cámara
camera.position.set(0, 7, 13);
camera.lookAt(0, 1, 0);

let mouseX = 0;
let mouseY = 0;

// Variables para el salto y la gravedad
let isJumping = false;
let verticalVelocity = 0;
const gravity = 0.015;
const jumpForce = 0.3;
const maxJumpHeight = 3;

// Variables para el movimiento de la cámara
let cameraVerticalAngle = 0;
const maxCameraAngle = Math.PI / 4; // 45 grados
const minCameraAngle = -Math.PI / 4; // -45 grados
const mouseSensitivity = 0.15;

// Configuración de armas
const weapons = {
    pistol: {
        damage: 10,
        speed: 0.5,
        color: 0x333333,
        size: 0.3
    },
    shotgun: {
        damage: 15,
        speed: 0.3,
        color: 0x666666,
        size: 0.4
    },
    rifle: {
        damage: 20,
        speed: 0.7,
        color: 0x444444,
        size: 0.35
    }
};

// Obtener el arma seleccionada
const selectedWeapon = localStorage.getItem('selectedWeapon') || 'pistol';
const weaponConfig = weapons[selectedWeapon];

// Crear el arma
const gunGroup = new THREE.Group();
egg.add(gunGroup);

// Cuerpo del arma (más grande y visible)
const gunBodyGeometry = new THREE.BoxGeometry(weaponConfig.size * 1.2, weaponConfig.size * 0.8, 1.2);
const gunBodyMaterial = new THREE.MeshStandardMaterial({ 
    color: weaponConfig.color,
    metalness: 0.9,
    roughness: 0.25
});
const gunBody = new THREE.Mesh(gunBodyGeometry, gunBodyMaterial);
gunBody.position.set(0, 0, -0.4);
gunGroup.add(gunBody);

// Cañón del arma (más visible)
const gunBarrelGeometry = new THREE.CylinderGeometry(weaponConfig.size * 0.18, weaponConfig.size * 0.18, 1.5, 12);
const gunBarrelMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x222222,
    metalness: 0.85,
    roughness: 0.15
});
const gunBarrel = new THREE.Mesh(gunBarrelGeometry, gunBarrelMaterial);
gunBarrel.rotation.x = Math.PI / 2;
gunBarrel.position.set(0, 0, -1.1);
gunGroup.add(gunBarrel);

const gunGripGeometry = new THREE.BoxGeometry(weaponConfig.size * 0.5, weaponConfig.size * 0.7, 0.3);
const gunGripMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.25, metalness: 0.9 });
const gunGrip = new THREE.Mesh(gunGripGeometry, gunGripMaterial);
gunGrip.position.set(0, -0.5, -0.2);
gunGroup.add(gunGrip);

// Posición inicial del arma (más visible)
gunGroup.position.set(0.9, 0.4, 0.7);

// Crear un grupo para los ojos
const eyesGroup = new THREE.Group();
egg.add(eyesGroup);

// Mover los ojos al grupo y ajustar su posición
leftEye.position.set(-0.3, 0.3, 0.9);
rightEye.position.set(0.3, 0.3, 0.9);
eyesGroup.add(leftEye);
eyesGroup.add(rightEye);

// Modificar el evento de mousemove para incluir el movimiento vertical
document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Actualizar el ángulo vertical de la cámara (invertir el mouseY)
    cameraVerticalAngle -= mouseY * mouseSensitivity;
    cameraVerticalAngle = Math.max(minCameraAngle, Math.min(maxCameraAngle, cameraVerticalAngle));
    
    // Rotar el grupo de ojos y el arma
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

document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        keys.space = true;
    } else if (keys.hasOwnProperty(event.key.toLowerCase())) {
        keys[event.key.toLowerCase()] = true;
    }
});

document.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
        keys.space = false;
    } else if (keys.hasOwnProperty(event.key.toLowerCase())) {
        keys[event.key.toLowerCase()] = false;
    }
});

const moveSpeed = 0.2;

// Almacenar otros jugadores
const otherPlayers = new Map();

socket.on('roomJoined', ({ roomId, state }) => {
    matchState.roomId = roomId;
    if (state?.players) {
        matchState.players = state.players;
    }
    console.log('Unido a la sala', roomId, state);
});

socket.on('roomState', (state) => {
    if (!state) return;
    matchState.roomId = state.roomId;
    matchState.players = state.players;
    document.getElementById('roomLabel').textContent = `Sala: ${state.roomId}`;
});

// Manejar nuevos jugadores
socket.on('newPlayer', (playerInfo) => {
    const otherPlayer = new THREE.Mesh(eggGeometry, eggMaterial);
    otherPlayer.position.set(
        playerInfo.position.x,
        playerInfo.position.y,
        playerInfo.position.z
    );
    otherPlayer.rotation.y = playerInfo.rotation.y;
    scene.add(otherPlayer);
    otherPlayers.set(playerInfo.id, otherPlayer);
});

// Manejar jugadores existentes
socket.on('currentPlayers', (players) => {
    players.forEach(([id, playerInfo]) => {
        if (id !== socket.id) {
            const otherPlayer = new THREE.Mesh(eggGeometry, eggMaterial);
            otherPlayer.position.set(
                playerInfo.position.x,
                playerInfo.position.y,
                playerInfo.position.z
            );
            otherPlayer.rotation.y = playerInfo.rotation.y;
            scene.add(otherPlayer);
            otherPlayers.set(id, otherPlayer);
        }
    });
});

// Manejar actualizaciones de posición de otros jugadores
socket.on('updatePlayer', (playerInfo) => {
    const otherPlayer = otherPlayers.get(playerInfo.id);
    if (otherPlayer) {
        otherPlayer.position.set(
            playerInfo.position.x,
            playerInfo.position.y,
            playerInfo.position.z
        );
        otherPlayer.rotation.y = playerInfo.rotation.y;
    }
});

// Manejar desconexión de jugadores
socket.on('playerDisconnected', (playerId) => {
    const otherPlayer = otherPlayers.get(playerId);
    if (otherPlayer) {
        scene.remove(otherPlayer);
        otherPlayers.delete(playerId);
    }
});

// Manejar disparos de otros jugadores
socket.on('bulletFired', (bulletInfo) => {
    if (bulletInfo.playerId !== socket.id) {
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        bullet.position.copy(bulletInfo.position);
        bullet.userData = {
            direction: new THREE.Vector3(
                bulletInfo.direction.x,
                bulletInfo.direction.y,
                bulletInfo.direction.z
            ),
            speed: 0.5,
            damage: 10,
            playerId: bulletInfo.playerId
        };
        scene.add(bullet);
        bullets.push(bullet);
    }
});

// Manejar daño recibido
socket.on('playerDamaged', (data) => {
    if (data.id === socket.id) {
        matchState.stats.deaths += 1;
        updateHealth(10);
    }
});

// Manejar respawn
socket.on('playerRespawn', (data) => {
    if (data.id === socket.id) {
        egg.position.set(0, 0, 0);
        health = 100;
        healthFill.style.width = '100%';
        healthFill.style.backgroundColor = '#0f0';
    }
});


// Sistema de disparos
const bullets = [];
const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

// Función para manejar el salto y la gravedad
function handleJump() {
    if (keys.space && !isJumping && egg.position.y <= 0) {
        verticalVelocity = jumpForce;
        isJumping = true;
    }
    
    // Aplicar gravedad
    verticalVelocity -= gravity;
    egg.position.y += verticalVelocity;
    
    // Detener en el suelo
    if (egg.position.y <= 0) {
        egg.position.y = 0;
        verticalVelocity = 0;
        isJumping = false;
    }
}

// Modificar la función shoot para usar la configuración del arma
function shoot() {
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    
    // Calcular la posición del disparo desde el cañón del arma
    const gunWorldPosition = new THREE.Vector3();
    gunBarrel.getWorldPosition(gunWorldPosition);
    bullet.position.copy(gunWorldPosition);
    
    // Calcular dirección del disparo basado en la rotación del arma
    const direction = new THREE.Vector3(0, Math.sin(cameraVerticalAngle), -1);
    direction.applyQuaternion(egg.quaternion);
    
    bullet.userData = {
        direction: direction,
        speed: weaponConfig.speed,
        damage: weaponConfig.damage
    };
    
    scene.add(bullet);
    bullets.push(bullet);
    
    // Enviar información del disparo al servidor
    socket.emit('playerShoot', {
        position: bullet.position,
        direction: direction,
        weaponType: selectedWeapon
    });
}

// Evento de clic para disparar
document.addEventListener('click', shoot);

// Sistema de vidas
let health = 100;
const healthBar = document.createElement('div');
healthBar.style.position = 'absolute';
healthBar.style.top = '10px';
healthBar.style.left = '10px';
healthBar.style.width = '200px';
healthBar.style.height = '20px';
healthBar.style.backgroundColor = '#333';
healthBar.style.border = '2px solid #fff';
document.body.appendChild(healthBar);

const healthFill = document.createElement('div');
healthFill.style.width = '100%';
healthFill.style.height = '100%';
healthFill.style.backgroundColor = '#0f0';
healthBar.appendChild(healthFill);

function updateHealth(damage) {
    health -= damage;
    if (health < 0) health = 0;
    healthFill.style.width = `${health}%`;
    healthFill.style.backgroundColor = health > 50 ? '#0f0' : health > 25 ? '#ff0' : '#f00';
    
    if (health <= 0) {
        health = 100;
        egg.position.set(0, 0, 0);
        if (matchState.isActive) {
            finishMatch(false);
        }
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
}

// Colisiones
function checkCollisions() {
    // Colisiones con obstáculos
    for (const obstacle of obstacles) {
        if (egg.position.distanceTo(obstacle.position) < 2) {
            // Empujar al jugador fuera del obstáculo
            const pushDirection = new THREE.Vector3()
                .subVectors(egg.position, obstacle.position)
                .normalize()
                .multiplyScalar(0.1);
            egg.position.add(pushDirection);
        }
    }
    
    // Colisiones con paredes
    const wallBounds = 9;
    if (Math.abs(egg.position.x) > wallBounds) {
        egg.position.x = Math.sign(egg.position.x) * wallBounds;
    }
    if (Math.abs(egg.position.z) > wallBounds) {
        egg.position.z = Math.sign(egg.position.z) * wallBounds;
    }
    
    // Actualizar balas y sus colisiones
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.position.add(bullet.userData.direction.multiplyScalar(bullet.userData.speed));
        
        // Eliminar balas que salen del mapa
        if (Math.abs(bullet.position.x) > 20 || Math.abs(bullet.position.z) > 20) {
            scene.remove(bullet);
            bullets.splice(i, 1);
            continue;
        }
        
        // Colisiones con obstáculos
        for (const obstacle of obstacles) {
            if (bullet.position.distanceTo(obstacle.position) < 1.5) {
                scene.remove(bullet);
                bullets.splice(i, 1);
                break;
            }
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
    
    // Colisiones de balas con otros jugadores
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        // Verificar colisiones con otros jugadores
        for (const [id, otherPlayer] of otherPlayers) {
            if (bullet.position.distanceTo(otherPlayer.position) < 1) {
                // Notificar al servidor sobre el impacto
                socket.emit('playerHit', {
                    targetId: id,
                    damage: bullet.userData.damage
                });
                awardKill();
                
                scene.remove(bullet);
                bullets.splice(i, 1);
                break;
            }
        }
    }
}

// Modificar la función animate para incluir la rotación del personaje
function animate() {
    requestAnimationFrame(animate);
    updatePlayerPosition();
    checkCollisions();
    
    // Rotar el personaje horizontalmente
    egg.rotation.y = mouseX * 2;
    
    // Aplicar la rotación vertical al grupo de ojos y el arma
    eyesGroup.rotation.x = cameraVerticalAngle;
    gunGroup.rotation.x = cameraVerticalAngle;
    
    renderer.render(scene, camera);
}

animate();

// Modificar la función updatePlayerPosition para mantener la cámara fija
function updatePlayerPosition() {
    if (keys.w) egg.position.z -= moveSpeed;
    if (keys.s) egg.position.z += moveSpeed;
    if (keys.a) egg.position.x -= moveSpeed;
    if (keys.d) egg.position.x += moveSpeed;
    
    handleJump();

    // Actualizar la posición de la cámara para seguir al jugador
    camera.position.x = egg.position.x;
    camera.position.y = egg.position.y + 10;
    camera.position.z = egg.position.z + 15;
    
    // Mantener la cámara mirando al jugador
    camera.lookAt(egg.position);
    
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
