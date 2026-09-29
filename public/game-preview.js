(function () {
    const previewContainer = document.getElementById('gamePreviewContainer');
    const gameContainer = document.getElementById('gameContainer');

    // Crear escena de preview
    const previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x192326);
    previewScene.fog = new THREE.Fog(0x192326, 54, 105);

    const previewCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    previewRenderer.setSize(window.innerWidth, window.innerHeight);
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    previewRenderer.outputEncoding = THREE.sRGBEncoding;
    previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    previewRenderer.toneMappingExposure = 1.08;
    previewRenderer.shadowMap.enabled = true;

    previewContainer.appendChild(previewRenderer.domElement);

    // Posicionar cámara en vista isométrica
    previewCamera.position.set(37, 43, 37);
    previewCamera.lookAt(0, 0, 0);

    // Luces
    const previewHemiLight = new THREE.HemisphereLight(0x9ac4ce, 0x182423, 0.52);
    previewScene.add(previewHemiLight);

    const previewDirectionalLight = new THREE.DirectionalLight(0xffe2b1, 0.9);
    previewDirectionalLight.position.set(-8, 25, 10);
    previewDirectionalLight.castShadow = true;
    previewDirectionalLight.shadow.mapSize.set(1024, 1024);
    previewDirectionalLight.shadow.camera.near = 0.5;
    previewDirectionalLight.shadow.camera.far = 50;
    previewScene.add(previewDirectionalLight);

    const previewAmbientLight = new THREE.AmbientLight(0x80928d, 0.28);
    previewScene.add(previewAmbientLight);

    // Suelo
    const arenaVisuals = window.createArenaVisuals(THREE);
    const previewFloorGeometry = new THREE.PlaneGeometry(64, 64);
    const previewFloorMaterial = arenaVisuals.materials.floor;
    const previewFloor = new THREE.Mesh(previewFloorGeometry, previewFloorMaterial);
    previewFloor.rotation.x = -Math.PI / 2;
    previewFloor.position.y = 0;
    previewFloor.receiveShadow = true;
    previewScene.add(previewFloor);

    window.ARENA_CONFIG.obstacles.forEach((obstacle) => {
        const mesh = arenaVisuals.createObstacle(obstacle);
        if (mesh) previewScene.add(mesh);
    });
    window.ARENA_CONFIG.staircases.forEach((staircase) => {
        previewScene.add(arenaVisuals.createStairs(staircase));
    });

    // Paredes del mapa
    const previewWallMaterial = arenaVisuals.createWallMaterial();

    const previewWallGeometry1 = new THREE.BoxGeometry(64, 5, 1);
    const previewWallFront = new THREE.Mesh(previewWallGeometry1, previewWallMaterial);
    previewWallFront.position.set(0, 2.5, -32);
    previewWallFront.receiveShadow = true;
    previewScene.add(previewWallFront);

    const previewWallBack = new THREE.Mesh(previewWallGeometry1, previewWallMaterial);
    previewWallBack.position.set(0, 2.5, 32);
    previewWallBack.receiveShadow = true;
    previewScene.add(previewWallBack);

    const previewWallGeometry2 = new THREE.BoxGeometry(1, 5, 64);
    const previewWallLeft = new THREE.Mesh(previewWallGeometry2, previewWallMaterial);
    previewWallLeft.position.set(-32, 2.5, 0);
    previewWallLeft.receiveShadow = true;
    previewScene.add(previewWallLeft);

    const previewWallRight = new THREE.Mesh(previewWallGeometry2, previewWallMaterial);
    previewWallRight.position.set(32, 2.5, 0);
    previewWallRight.receiveShadow = true;
    previewScene.add(previewWallRight);

    const connectedPlayers = new Map();

    function createPlayerPreviewBall(x, z, color = 0x42f0c4) {
        const geometry = new THREE.SphereGeometry(0.5, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
        const ball = new THREE.Mesh(geometry, material);
        ball.position.set(x, 0.5, z);
        ball.castShadow = true;
        previewScene.add(ball);
        return ball;
    }

    function createPreviewHUD() {
        const hudElement = document.createElement('div');
        hudElement.id = 'previewHUD';
        hudElement.className = 'preview-hud';

        const title = document.createElement('div');
        title.className = 'preview-title';
        title.innerHTML = 'METEOR YARD<span>ALIEN ARENA / LIVE LOBBY</span>';

        const playerList = document.createElement('div');
        playerList.id = 'previewPlayerList';
        playerList.className = 'preview-player-list';

        const playerListTitle = document.createElement('div');
        playerListTitle.className = 'preview-player-list-title';
        playerListTitle.textContent = 'SQUAD ONLINE';
        playerList.appendChild(playerListTitle);

        const playButton = document.createElement('button');
        playButton.id = 'previewPlayButton';
        playButton.className = 'preview-play-button';
        playButton.textContent = 'DROP INTO ARENA';
        playButton.onclick = () => startGame();

        hudElement.appendChild(title);
        hudElement.appendChild(playerList);
        hudElement.appendChild(playButton);
        previewContainer.appendChild(hudElement);
    }

    createPreviewHUD();

    function updatePreviewPlayerList(players) {
        const playerListDiv = document.getElementById('previewPlayerList');
        const entries = playerListDiv.querySelectorAll('.preview-player-entry');
        entries.forEach((entry) => entry.remove());

        if (!Array.isArray(players) || players.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'preview-player-entry';
            emptyMsg.textContent = 'Waiting for squad';
            playerListDiv.appendChild(emptyMsg);
            return;
        }

        players.forEach((player) => {
            const entry = document.createElement('div');
            entry.className = 'preview-player-entry';
            entry.className = 'preview-player-entry';
            entry.textContent = (player.username || player.name || 'alien') + ' ✓';
            playerListDiv.appendChild(entry);
        });
    }

    function animatePreview() {
        requestAnimationFrame(animatePreview);
        previewCamera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.00018);
        previewCamera.lookAt(0, 0, 0);
        previewRenderer.render(previewScene, previewCamera);
    }

    window.addEventListener('resize', () => {
        previewCamera.aspect = window.innerWidth / window.innerHeight;
        previewCamera.updateProjectionMatrix();
        previewRenderer.setSize(window.innerWidth, window.innerHeight);
    });

    function showPreview() {
        previewContainer.style.display = 'block';
        gameContainer.style.display = 'none';
        animatePreview();
    }

    function hidePreview() {
        previewContainer.style.display = 'none';
        gameContainer.style.display = 'block';
        previewRenderer.dispose();
    }

    function setupPreviewSocketListeners() {
        const socketWaitInterval = setInterval(() => {
            if (typeof socket !== 'undefined' && socket) {
                clearInterval(socketWaitInterval);

                socket.on('roomState', (state) => {
                    if (state && Array.isArray(state.players)) {
                        updatePreviewPlayerList(state.players);
                    }
                });

                socket.on('currentPlayers', (players) => {
                    if (Array.isArray(players)) {
                        const playerList = players.map(([id, info]) => ({
                            id,
                            username: info.username || info.name || 'alien'
                        }));
                        updatePreviewPlayerList(playerList);
                    }
                });
            }
        }, 100);
    }

    window.gamePreview = {
        show: showPreview,
        hide: hidePreview,
        setupListeners: setupPreviewSocketListeners
    };
})();
