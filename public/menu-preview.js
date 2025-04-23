// Configuración de armas
const weapons = {
    pistol: {
        damage: 10,
        speed: 0.5,
        color: 0x333333,
        size: 0.3,
        position: { x: 0.7, y: 0.4, z: 0.7 }
    },
    shotgun: {
        damage: 15,
        speed: 0.3,
        color: 0x666666,
        size: 0.4,
        position: { x: 0.8, y: 0.4, z: 0.8 }
    },
    rifle: {
        damage: 20,
        speed: 0.7,
        color: 0x444444,
        size: 0.35,
        position: { x: 0.75, y: 0.4, z: 0.75 }
    }
};

// Configuración de la escena
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(200, 200);
document.getElementById('preview-container').appendChild(renderer.domElement);

// Luces
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

// Crear el huevo
const eggGeometry = new THREE.SphereGeometry(1, 32, 32);
eggGeometry.scale(1, 1.3, 1);
const eggMaterial = new THREE.MeshStandardMaterial({ color: 0xffffcc });
const egg = new THREE.Mesh(eggGeometry, eggMaterial);
scene.add(egg);

// Ojos
const eyeGeometry = new THREE.SphereGeometry(0.2, 16, 16);
const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);

leftEye.position.set(-0.3, 0.3, 0.9);
rightEye.position.set(0.3, 0.3, 0.9);
egg.add(leftEye);
egg.add(rightEye);

// Grupo para el arma
const gunGroup = new THREE.Group();
egg.add(gunGroup);

// Configurar la cámara
camera.position.set(0, 2, 4);
camera.lookAt(0, 0, 0);

// Variables para la animación
let rotationSpeed = 0.01;
let currentWeapon = 'pistol';
let mouseX = 0;
let mouseY = 0;
let cameraVerticalAngle = 0;
const maxCameraAngle = Math.PI / 4; // 45 grados
const minCameraAngle = -Math.PI / 4; // -45 grados

// Agregar evento de mousemove para la rotación
document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Actualizar el ángulo vertical
    cameraVerticalAngle = mouseY * maxCameraAngle;
    cameraVerticalAngle = Math.max(minCameraAngle, Math.min(maxCameraAngle, cameraVerticalAngle));
    
    // Rotar los ojos
    leftEye.rotation.x = cameraVerticalAngle;
    rightEye.rotation.x = cameraVerticalAngle;
    
    // Rotar el arma
    gunGroup.rotation.x = cameraVerticalAngle;
});

// Función para actualizar el arma
function updateWeapon(weaponType) {
    // Remover arma anterior
    while(gunGroup.children.length > 0) {
        gunGroup.remove(gunGroup.children[0]);
    }

    const weaponConfig = weapons[weaponType];
    
    // Crear nuevo arma
    const gunBodyGeometry = new THREE.BoxGeometry(weaponConfig.size, weaponConfig.size, 1);
    const gunBodyMaterial = new THREE.MeshStandardMaterial({ 
        color: weaponConfig.color,
        metalness: 0.8,
        roughness: 0.2
    });
    const gunBody = new THREE.Mesh(gunBodyGeometry, gunBodyMaterial);
    gunGroup.add(gunBody);

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

    gunGroup.position.set(
        weaponConfig.position.x,
        weaponConfig.position.y,
        weaponConfig.position.z
    );

    currentWeapon = weaponType;
}

// Inicializar con la pistola
updateWeapon('pistol');

// Función de animación
function animate() {
    requestAnimationFrame(animate);
    
    // Rotar el huevo basado en la posición del mouse
    egg.rotation.y = mouseX * 2;
    
    // Hacer que el huevo se mueva suavemente arriba y abajo
    egg.position.y = Math.sin(Date.now() * 0.001) * 0.1;
    
    renderer.render(scene, camera);
}

animate();

// Exportar función para cambiar el arma
window.updateWeapon = updateWeapon; 