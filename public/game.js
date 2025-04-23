// import * as THREE from '/modules/three/build/three.module.js';
// import { io } from '/modules/socket.io-client/dist/socket.io.js';

// import * as THREE from 'three';

const socket = io(); // Ahora se importa automáticamente desde el HTML

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Luces
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

// Crear el suelo
const floorGeometry = new THREE.PlaneGeometry(20, 20);
const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x808080,
    roughness: 0.8,
    metalness: 0.2
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2;
scene.add(floor);

// Crear paredes
const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x4a4a4a,
    roughness: 0.7,
    metalness: 0.3
});

// Pared frontal
const wallGeometry1 = new THREE.BoxGeometry(20, 5, 1);
const wallFront = new THREE.Mesh(wallGeometry1, wallMaterial);
wallFront.position.set(0, 0.5, -10);
scene.add(wallFront);

// Pared trasera
const wallBack = new THREE.Mesh(wallGeometry1, wallMaterial);
wallBack.position.set(0, 0.5, 10);
scene.add(wallBack);

// Pared izquierda
const wallGeometry2 = new THREE.BoxGeometry(1, 5, 20);
const wallLeft = new THREE.Mesh(wallGeometry2, wallMaterial);
wallLeft.position.set(-10, 0.5, 0);
scene.add(wallLeft);

// Pared derecha
const wallRight = new THREE.Mesh(wallGeometry2, wallMaterial);
wallRight.position.set(10, 0.5, 0);
scene.add(wallRight);

// Obstáculos
const obstacleGeometry = new THREE.BoxGeometry(2, 3, 2);
const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x6a6a });

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

// Personaje (huevo)
const eggGeometry = new THREE.SphereGeometry(1, 32, 32);
eggGeometry.scale(1, 1.3, 1);
const eggMaterial = new THREE.MeshStandardMaterial({ color: 0xffffcc });
const egg = new THREE.Mesh(eggGeometry, eggMaterial);
egg.position.y = 0; // Colocar el huevo sobre el suelo
scene.add(egg);

// Ojos
const eyeGeometry = new THREE.SphereGeometry(0.2, 16, 16);
const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);

// Configurar la cámara
camera.position.set(0, 10, 15);
camera.lookAt(0, 0, 0);

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
const gunBodyGeometry = new THREE.BoxGeometry(weaponConfig.size, weaponConfig.size, 1);
const gunBodyMaterial = new THREE.MeshStandardMaterial({ 
    color: weaponConfig.color,
    metalness: 0.8,
    roughness: 0.2
});
const gunBody = new THREE.Mesh(gunBodyGeometry, gunBodyMaterial);
gunGroup.add(gunBody);

// Cañón del arma (más largo y visible)
const gunBarrelGeometry = new THREE.CylinderGeometry(weaponConfig.size * 0.3, weaponConfig.size * 0.3, 1, 8);
const gunBarrelMaterial = new THREE.MeshStandardMaterial({ 
    color: weaponConfig.color,
    metalness: 0.8,
    roughness: 0.2
});
const gunBarrel = new THREE.Mesh(gunBarrelGeometry, gunBarrelMaterial);
gunBarrel.rotation.x = Math.PI / 2;
gunBarrel.position.z = -1;
gunGroup.add(gunBarrel);

// Posición inicial del arma (más visible)
gunGroup.position.set(0.7, 0.4, 0.7);

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
        // Game over
        alert('¡Has perdido!');
        health = 100;
        egg.position.set(0, 0, 0);
    }
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
