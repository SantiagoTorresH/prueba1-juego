(function exposeArenaVisuals(root) {
  function createArenaVisuals(THREE) {
    const makeCanvasTexture = (draw, repeat = [1, 1]) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      draw(context, canvas.width, canvas.height);
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeat[0], repeat[1]);
      texture.encoding = THREE.sRGBEncoding;
      texture.anisotropy = 4;
      return texture;
    };

    const floorTexture = makeCanvasTexture((context, width, height) => {
      context.fillStyle = '#56625c';
      context.fillRect(0, 0, width, height);
      for (let index = 0; index < 1150; index += 1) {
        const shade = index % 2 ? 'rgba(219,225,208,0.025)' : 'rgba(17,28,27,0.035)';
        context.fillStyle = shade;
        context.fillRect((index * 73) % width, (index * 139) % height, 2 + (index % 3), 2 + (index % 2));
      }
      context.strokeStyle = 'rgba(216,224,211,0.09)';
      context.lineWidth = 1;
      for (let line = 0; line <= 4; line += 1) {
        const offset = line * width / 4;
        context.beginPath();
        context.moveTo(offset, 0);
        context.lineTo(offset, height);
        context.moveTo(0, offset);
        context.lineTo(width, offset);
        context.stroke();
      }
    }, [8, 8]);

    const woodTexture = makeCanvasTexture((context, width, height) => {
      context.fillStyle = '#986b45';
      context.fillRect(0, 0, width, height);
      const boardHeight = height / 4;
      for (let board = 0; board < 4; board += 1) {
        context.fillStyle = board % 2 ? '#a77a50' : '#91623e';
        context.fillRect(0, board * boardHeight, width, boardHeight - 2);
        for (let grain = 0; grain < 22; grain += 1) {
          const y = board * boardHeight + (grain * 11 % boardHeight);
          context.strokeStyle = grain % 2 ? 'rgba(47,31,23,0.12)' : 'rgba(236,190,125,0.13)';
          context.lineWidth = grain % 5 === 0 ? 2 : 1;
          context.beginPath();
          context.moveTo((grain * 47) % 180, y);
          context.bezierCurveTo(80, y - 3, 160, y + 4, width, y + ((grain % 3) - 1) * 2);
          context.stroke();
        }
        context.fillStyle = 'rgba(36,29,25,0.32)';
        context.fillRect(0, board * boardHeight + boardHeight - 2, width, 2);
      }
    }, [1, 1]);

    const materials = {
      floor: new THREE.MeshStandardMaterial({ map: floorTexture, color: 0xd9dfd2, roughness: 0.94, metalness: 0.02 }),
      wood: new THREE.MeshStandardMaterial({ map: woodTexture, color: 0xe9d8be, roughness: 0.82, metalness: 0.02 }),
      crate: new THREE.MeshStandardMaterial({ map: woodTexture, color: 0xffe4bd, roughness: 0.75, metalness: 0.02 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x65747a, roughness: 0.43, metalness: 0.68 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x303c40, roughness: 0.52, metalness: 0.58 }),
      rust: new THREE.MeshStandardMaterial({ color: 0x805d48, roughness: 0.72, metalness: 0.28 }),
      foliage: new THREE.MeshStandardMaterial({ color: 0x718b58, roughness: 0.92 }),
      bolt: new THREE.MeshStandardMaterial({ color: 0xc0c4b4, roughness: 0.34, metalness: 0.78 })
    };

    function finishMesh(mesh, parent) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function createCrate({ width, height, depth }) {
      const group = new THREE.Group();
      finishMesh(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials.crate), group).position.y = height / 2;

      const trim = Math.min(0.13, width * 0.045, depth * 0.045);
      const insetX = width / 2 - trim / 2;
      const insetZ = depth / 2 - trim / 2;
      const verticalGeometry = new THREE.BoxGeometry(trim, height + 0.02, trim);
      for (const x of [-insetX, insetX]) {
        for (const z of [-insetZ, insetZ]) {
          finishMesh(new THREE.Mesh(verticalGeometry, materials.wood), group).position.set(x, height / 2, z);
        }
      }

      const railHeight = trim * 0.72;
      const frontRail = new THREE.BoxGeometry(width, railHeight, trim * 0.72);
      const sideRail = new THREE.BoxGeometry(trim * 0.72, railHeight, depth);
      for (const y of [trim / 2, height - trim / 2]) {
        for (const z of [-depth / 2, depth / 2]) {
          finishMesh(new THREE.Mesh(frontRail, materials.wood), group).position.set(0, y, z);
        }
        for (const x of [-width / 2, width / 2]) {
          finishMesh(new THREE.Mesh(sideRail, materials.wood), group).position.set(x, y, 0);
        }
      }

      const topBand = new THREE.Mesh(new THREE.BoxGeometry(width * 0.56, 0.025, depth * 0.09), materials.darkMetal);
      topBand.position.set(0, height + 0.012, 0);
      group.add(topBand);

      const boltGeometry = new THREE.SphereGeometry(Math.max(0.035, trim * 0.19), 8, 6);
      for (const x of [-insetX, insetX]) {
        for (const z of [-depth / 2 - 0.012, depth / 2 + 0.012]) {
          finishMesh(new THREE.Mesh(boltGeometry, materials.bolt), group).position.set(x, height * 0.72, z);
        }
      }

      group.position.y = 0;
      return group;
    }

    function createBarrel() {
      const group = new THREE.Group();
      finishMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 1.9, 20, 1), materials.rust), group).position.y = 0.98;
      const hoopMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa39e, roughness: 0.38, metalness: 0.74 });
      for (const y of [0.38, 0.94, 1.5]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.61, 0.045, 8, 24), hoopMaterial);
        hoop.rotation.x = Math.PI / 2;
        hoop.position.y = y;
        finishMesh(hoop, group);
      }
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.065, 20), materials.darkMetal);
      lid.position.y = 1.96;
      finishMesh(lid, group);
      const bung = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 12), materials.bolt);
      bung.position.set(0.2, 2.005, 0.12);
      finishMesh(bung, group);
      return group;
    }

    function createPillar(height) {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.58, 0.18, 8), materials.darkMetal);
      base.position.y = 0.09;
      finishMesh(base, group);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, height - 0.16, 8), materials.metal);
      body.position.y = height / 2 + 0.08;
      finishMesh(body, group);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.39, 0.14, 8), materials.darkMetal);
      cap.position.y = height - 0.01;
      finishMesh(cap, group);
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, Math.min(0.85, height * 0.32), 0.025),
        new THREE.MeshStandardMaterial({ color: 0xe6b455, emissive: 0x8f5b1d, emissiveIntensity: 0.18, metalness: 0.2 })
      );
      marker.position.set(0, height * 0.56, 0.39);
      finishMesh(marker, group);
      return group;
    }

    function createShortWall({ width, depth }) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(width, 1.86, depth), materials.wood);
      body.position.y = 0.93;
      finishMesh(body, group);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, 0.16, depth + 0.08), materials.darkMetal);
      cap.position.y = 1.93;
      finishMesh(cap, group);
      for (const x of [-width * 0.38, width * 0.38]) {
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.72, depth + 0.1), materials.metal);
        bracket.position.set(x, 0.93, 0);
        finishMesh(bracket, group);
      }
      return group;
    }

    function createTree() {
      const group = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 3.2, 10), materials.rust);
      trunk.position.y = 1.6;
      finishMesh(trunk, group);
      const foliageShapes = [
        { position: [0, 3.9, 0], scale: [1.05, 1.12, 1.0] },
        { position: [-0.9, 3.35, 0.1], scale: [0.66, 0.72, 0.7] },
        { position: [0.8, 3.45, -0.12], scale: [0.72, 0.77, 0.73] },
        { position: [0.12, 4.75, 0.1], scale: [0.62, 0.68, 0.65] }
      ];
      for (const [index, shape] of foliageShapes.entries()) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45, 1), materials.foliage);
        leaf.position.set(...shape.position);
        leaf.scale.set(...shape.scale);
        leaf.material = materials.foliage.clone();
        leaf.material.color.offsetHSL(index * 0.018, -0.04, (index % 2) * 0.045);
        finishMesh(leaf, group);
      }
      return group;
    }

    function createObstacle(obstacle) {
      let mesh;
      if (obstacle.type === 'crate') mesh = createCrate(obstacle);
      else if (obstacle.type === 'barrel') mesh = createBarrel();
      else if (obstacle.type === 'pillar') mesh = createPillar(obstacle.height);
      else if (obstacle.type === 'shortWall') mesh = createShortWall(obstacle);
      else if (obstacle.type === 'tree') mesh = createTree();
      if (!mesh) return null;
      mesh.position.x = obstacle.x;
      mesh.position.z = obstacle.z;
      return mesh;
    }

    function createStairs({ x, z, steps, direction }) {
      const group = new THREE.Group();
      for (let index = 0; index < steps; index += 1) {
        const height = 0.45 + index * 0.22;
        const step = new THREE.Mesh(new THREE.BoxGeometry(3.5, height, 1.2), materials.metal);
        step.position.set(0, height / 2, index * direction * 1.1);
        finishMesh(step, group);
      }
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, steps * 1.1), materials.darkMetal);
        rail.position.set(side * 1.55, 1.1, direction * (steps - 1) * 0.55);
        rail.rotation.x = direction * -0.18;
        finishMesh(rail, group);
      }
      group.position.set(x, 0, z);
      return group;
    }

    return {
      materials,
      createObstacle,
      createStairs,
      createWallMaterial() {
        return new THREE.MeshStandardMaterial({ color: 0x304148, roughness: 0.72, metalness: 0.08 });
      }
    };
  }

  root.createArenaVisuals = createArenaVisuals;
})(typeof window !== 'undefined' ? window : globalThis);