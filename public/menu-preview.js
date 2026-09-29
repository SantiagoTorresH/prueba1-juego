// Configuración de armas
const weapons = {
    pistol: {
        damage: 10,
        speed: 0.5,
        color: 0x333333,
        size: 0.35,
        position: { x: 0.7, y: 0.4, z: 0.7 }
    },
    shotgun: {
        damage: 15,
        speed: 0.3,
        color: 0x996633,
        size: 0.45,
        position: { x: 0.8, y: 0.4, z: 0.8 }
    },
    rifle: {
        damage: 20,
        speed: 0.7,
        color: 0x444444,
        size: 0.4,
        position: { x: 0.75, y: 0.4, z: 0.75 }
    }
};

// Configuración de la escena
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141b2c);
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(200, 200);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.getElementById('preview-container').appendChild(renderer.domElement);

// Luces
const hemiLight = new THREE.HemisphereLight(0x99ccff, 0x202040, 0.8);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
keyLight.position.set(5, 5, 5);
scene.add(keyLight);

const ambientLight = new THREE.AmbientLight(0x444444, 0.8);
scene.add(ambientLight);

const previewFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshStandardMaterial({ color: 0x1f3c2f, roughness: 0.9, metalness: 0.1 })
);
previewFloor.rotation.x = -Math.PI / 2;
previewFloor.position.y = -1;
previewFloor.receiveShadow = true;
scene.add(previewFloor);

// Personaje de vista previa
const previewAlien = new THREE.Group();
const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x4ffee0, roughness: 0.4, metalness: 0.1 })
);
body.scale.set(1, 1.2, 1);
previewAlien.add(body);

const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x35d1b2, roughness: 0.4, metalness: 0.1 })
);
head.position.set(0, 1.1, 0);
previewAlien.add(head);

const leftEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x44ffdf, emissiveIntensity: 0.4 })
);
const rightEye = leftEye.clone();
leftEye.position.set(-0.2, 1.2, 0.4);
rightEye.position.set(0.2, 1.2, 0.4);
previewAlien.add(leftEye);
previewAlien.add(rightEye);

const armGeom = new THREE.CylinderGeometry(0.1, 0.1, 1, 16);
const armMat = new THREE.MeshStandardMaterial({ color: 0x4ffee0, roughness: 0.4, metalness: 0.1 });
const leftArm = new THREE.Mesh(armGeom, armMat);
const rightArm = new THREE.Mesh(armGeom, armMat);
leftArm.position.set(-0.75, 0.25, 0);
leftArm.rotation.z = Math.PI / 3;
rightArm.position.set(0.75, 0.25, 0);
rightArm.rotation.z = -Math.PI / 3;
previewAlien.add(leftArm);
previewAlien.add(rightArm);

const legGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.9, 16);
const leftLeg = new THREE.Mesh(legGeom, armMat);
const rightLeg = new THREE.Mesh(legGeom, armMat);
leftLeg.position.set(-0.25, -0.9, 0);
rightLeg.position.set(0.25, -0.9, 0);
previewAlien.add(leftLeg);
previewAlien.add(rightLeg);

const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x7ee9d2, metalness: 0.3 })
);
antenna.position.set(0, 1.8, 0);
previewAlien.add(antenna);

const antennaTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x88ffff, emissive: 0x88ffff, emissiveIntensity: 0.6 })
);
antennaTip.position.set(0, 0.45, 0);
antenna.add(antennaTip);

previewAlien.position.y = 0.2;
scene.add(previewAlien);

const gunGroup = new THREE.Group();
previewAlien.add(gunGroup);

let mouseX = 0;
let mouseY = 0;

document.addEventListener('pointermove', (event) => {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
});

function updateWeapon(weaponType) {
    while (gunGroup.children.length > 0) {
        gunGroup.remove(gunGroup.children[0]);
    }

    const config = weapons[weaponType];
    const bodyGeo = new THREE.BoxGeometry(config.size * 0.8, config.size * 0.5, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ color: config.color, metalness: 0.85, roughness: 0.2 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(0, -0.25, -0.7);
    gunGroup.add(bodyMesh);

    const barrelGeo = new THREE.CylinderGeometry(config.size * 0.18, config.size * 0.18, 1.2, 12);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });
    const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
    barrelMesh.rotation.x = Math.PI / 2;
    barrelMesh.position.set(0, -0.25, -1.35);
    gunGroup.add(barrelMesh);

    const gripGeo = new THREE.BoxGeometry(config.size * 0.35, config.size * 0.7, 0.25);
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.9 });
    const gripMesh = new THREE.Mesh(gripGeo, gripMat);
    gripMesh.position.set(0, -0.6, -0.5);
    gunGroup.add(gripMesh);

    gunGroup.position.set(-0.6, 0.3, 0.5);
    currentWeapon = weaponType;
}

updateWeapon('pistol');

camera.position.set(0, 1.4, 3.2);
camera.lookAt(0, 0.8, 0);

function animate() {
    requestAnimationFrame(animate);
    previewAlien.rotation.y = mouseX * 1.5;
    previewAlien.rotation.x = mouseY * 0.7;
    gunGroup.rotation.x = mouseY * 0.8;
    gunGroup.rotation.y = mouseX * 0.6;
    renderer.render(scene, camera);
}

animate();

window.updateWeapon = updateWeapon; 