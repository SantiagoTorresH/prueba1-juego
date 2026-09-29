const test = require('node:test');
const assert = require('node:assert/strict');
const GameState = require('../server/gameState');

test('aplica daño y respawnea correctamente', () => {
  const state = new GameState();

  state.addPlayer('a', { name: 'Alpha' });
  state.addPlayer('b', { name: 'Beta' });

  const firstHit = state.handleHit('a', 'b', 'rifle');
  assert.equal(firstHit.damage, 20);
  assert.equal(firstHit.health, 80);
  assert.equal(state.getPlayer('b').health, 80);

  const secondHit = state.handleHit('a', 'b', 'rifle');
  assert.equal(secondHit.health, 60);
  assert.equal(state.getPlayer('b').health, 60);
  assert.equal(secondHit.respawned, false);

  const thirdHit = state.handleHit('a', 'b', 'rifle');
  assert.equal(thirdHit.health, 40);
  assert.equal(state.getPlayer('b').health, 40);
  assert.equal(thirdHit.respawned, false);

  const fourthHit = state.handleHit('a', 'b', 'rifle');
  assert.equal(fourthHit.health, 20);
  assert.equal(state.getPlayer('b').health, 20);
  assert.equal(fourthHit.respawned, false);

  const fifthHit = state.handleHit('a', 'b', 'rifle');
  assert.equal(fifthHit.health, 0);
  assert.equal(state.getPlayer('b').health, 0);
  assert.equal(fifthHit.respawned, true);
  assert.equal(fifthHit.respawnDelayMs, 4000);
  assert.equal(fifthHit.shieldMs, 3000);
  assert.ok(state.getPlayer('b').respawnAt > Date.now());
  const respawned = state.respawnPlayer('b');
  assert.equal(respawned.health, 100);
  assert.equal(respawned.grenades, 3);
  assert.ok(respawned.shieldUntil > Date.now());
});

test('filtra los snapshots por sala sin mezclar jugadores', () => {
  const state = new GameState();

  state.addPlayer('a', { name: 'Alpha', roomId: 'room-a' });
  state.addPlayer('b', { name: 'Beta', roomId: 'room-b' });
  state.addPlayer('c', { name: 'Gamma', roomId: 'room-a' });

  assert.deepEqual(state.getSnapshot('room-a').map(([id]) => id), ['a', 'c']);
  assert.deepEqual(state.getSnapshot('room-b').map(([id]) => id), ['b']);
  assert.equal(state.getSnapshot('room-c').length, 0);
});

test('rechaza movimiento fuera del mapa o más rápido que el límite permitido', () => {
  const state = new GameState();
  state.addPlayer('a', { roomId: 'room-a', team: 'red' });
  const initial = state.getPlayer('a').position;

  assert.equal(state.acceptPlayerMove('a', { x: 100, y: 0, z: 0 }, { x: 0, y: 0 }, 1000), null);
  assert.equal(state.acceptPlayerMove('a', { x: 18, y: 0, z: 18 }, { x: 0, y: 0 }, 1000), null);
  assert.deepEqual(state.getPlayer('a').position, initial);

  const accepted = state.acceptPlayerMove('a', { x: -17.8, y: 0, z: -18 }, { x: 0, y: 0 }, 1020);
  assert.equal(accepted.position.x, -17.8);
});

test('bloquea el paso a través de cajas y permite subir una escalera', () => {
  const blockedState = new GameState();
  blockedState.addPlayer('blocked', { roomId: 'room-a', position: { x: -8, y: 0, z: 0 } });
  const blocked = blockedState.acceptPlayerMove('blocked', { x: -6, y: 0, z: 0 }, { x: 0, y: 0 }, Date.now() + 500);
  assert.ok(blocked);
  assert.equal(blocked.position.x, -8);

  const stairState = new GameState();
  stairState.addPlayer('climber', { roomId: 'room-a', position: { x: -18, y: 0, z: 2 } });
  const climbed = stairState.acceptPlayerMove('climber', { x: -16.5, y: 0, z: 2 }, { x: 0, y: 0 }, Date.now() + 500);
  assert.ok(climbed);
  assert.ok(climbed.position.y > 0);
});

test('detecta aterrizaje sobre la superficie de una caja', () => {
  const state = new GameState();
  const physics = require('../public/arena-physics');
  const landingHeight = physics.findLandingSurface(
    3.4,
    2.8,
    -6,
    0,
    state.playerCollisionBoxes
  );
  assert.equal(landingHeight, 3);
  assert.equal(physics.findLandingSurface(2.4, 1.8, -10, -10, state.playerCollisionBoxes), 2);
  assert.equal(physics.findLandingSurface(0.6, 0.4, -15, 2, state.playerCollisionBoxes), 0.45);
});

test('simula un proyectil válido y aplica daño una sola vez al colisionar', () => {
  const state = new GameState();
  state.addPlayer('shooter', { roomId: 'room-a', position: { x: -18, y: 0, z: -18 }, weapon: 'rifle' });
  state.addPlayer('target', { roomId: 'room-a', position: { x: -18, y: 0, z: -24 }, team: null });
  const shotOrigin = { x: -18, y: 1.2, z: -18 };
  const shotDirection = { x: 0, y: 0, z: -1 };

  assert.equal(state.registerShot('shooter', 'unknown', shotOrigin, shotDirection, 1000), null);
  assert.ok(state.registerShot('shooter', 'rifle', shotOrigin, shotDirection, 1000));
  assert.equal(state.registerShot('shooter', 'rifle', shotOrigin, shotDirection, 1050), null);

  let events = [];
  for (let tick = 0; tick < 4 && events.length === 0; tick += 1) {
    events = state.advanceProjectiles(0.1, 1100 + tick * 100);
  }

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'player');
  assert.equal(events[0].playerId, 'target');
  assert.equal(events[0].damageResult.health, 80);
  assert.deepEqual(state.advanceProjectiles(0.1, 1600), []);
  assert.equal(state.getPlayer('target').health, 80);
});

test('consume el proyectil al chocar con cobertura antes del jugador', () => {
  const state = new GameState();
  state.addPlayer('shooter', { roomId: 'room-a', team: 'red', weapon: 'rifle' });
  state.addPlayer('target', { roomId: 'room-a', team: 'blue' });

  const projectile = state.registerShot(
    'shooter',
    'rifle',
    { x: -18, y: 1.2, z: -18 },
    { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 },
    1000
  );

  assert.ok(projectile);
  let events = [];
  for (let tick = 0; tick < 20 && events.length === 0; tick += 1) {
    events = state.advanceProjectiles(0.1, 1100 + tick * 100);
  }

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'arena');
  assert.equal(events[0].playerId, null);
  assert.equal(state.getPlayer('target').health, 100);
  assert.equal(state.projectiles.size, 0);
});

test('los proyectiles colisionan con suelo y escaleras', () => {
  const groundState = new GameState();
  groundState.addPlayer('shooter', { roomId: 'room-a', position: { x: -18, y: 0, z: -18 }, weapon: 'rifle' });
  groundState.registerShot('shooter', 'rifle', { x: -18, y: 1.2, z: -18 }, { x: 0, y: -1, z: 0 }, 1000);
  const [groundImpact] = groundState.advanceProjectiles(0.1, 1100);
  assert.equal(groundImpact.type, 'arena');
  assert.equal(groundImpact.surface, 'ground');

  const stairState = new GameState();
  stairState.addPlayer('shooter', { roomId: 'room-a', position: { x: -18, y: 0, z: 2 }, weapon: 'rifle' });
  stairState.registerShot('shooter', 'rifle', { x: -18, y: 0.2, z: 2 }, { x: 1, y: 0, z: 0 }, 1000);
  const [stairImpact] = stairState.advanceProjectiles(0.1, 1100);
  assert.equal(stairImpact.type, 'arena');
  assert.equal(stairImpact.surface, 'metal');
});

test('rechaza disparos con origen remoto o dirección inválida', () => {
  const state = new GameState();
  state.addPlayer('shooter', { roomId: 'room-a', team: 'red' });

  assert.equal(state.registerShot('shooter', 'pistol', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, 1000), null);
  assert.equal(state.registerShot('shooter', 'pistol', { x: -18, y: 1, z: -18 }, { x: 0, y: 0, z: -10 }, 1000), null);
});

test('recoger un arma equipa la nueva y deja la anterior en el suelo', () => {
  const state = new GameState();
  state.addPlayer('player', { roomId: 'room-a', position: { x: -10, y: 0, z: 0 }, weapon: 'pistol' });
  state.ensureRoomWeaponPickups('room-a');

  const result = state.pickupWeapon('player', 'smg-yard', Date.now());

  assert.ok(result);
  assert.equal(result.player.weapon, 'smg');
  assert.equal(result.player.ammo.smg, 36);
  assert.equal(result.pickups.some((pickup) => pickup.id === 'smg-yard'), false);
  const droppedWeapon = result.pickups.find((pickup) => pickup.weaponType === 'pistol' && pickup.id.startsWith('drop-'));
  assert.ok(droppedWeapon);
  assert.equal(droppedWeapon.ammo, 12);
});

test('la SMG acepta cadencia automática y la recarga actualiza el cargador autoritativo', () => {
  const state = new GameState();
  state.addPlayer('player', { roomId: 'room-a', position: { x: -10, y: 0, z: 0 }, weapon: 'smg' });

  const firstShot = state.registerShot('player', 'smg', { x: -10, y: 1.2, z: 0 }, { x: 0, y: 0, z: -1 }, 1000);
  const tooSoon = state.registerShot('player', 'smg', { x: -10, y: 1.2, z: 0 }, { x: 0, y: 0, z: -1 }, 1050);
  const nextShot = state.registerShot('player', 'smg', { x: -10, y: 1.2, z: 0 }, { x: 0, y: 0, z: -1 }, 1090);

  assert.ok(firstShot);
  assert.equal(tooSoon, null);
  assert.ok(nextShot);
  assert.equal(state.getPlayer('player').ammo.smg, 34);
  const reloaded = state.reloadWeapon('player');
  assert.equal(reloaded.ammo.smg, 36);
});

test('una granada usa fuse autoritativo de dos segundos y gasta inventario al lanzarse', () => {
  const state = new GameState();
  state.addPlayer('thrower', { roomId: 'room-a', position: { x: 0, y: 0, z: 0 } });
  state.addPlayer('target', { roomId: 'room-a', position: { x: 2, y: 0, z: 0 } });

  const grenade = state.registerGrenade('thrower', { x: 0, y: 1.8, z: 0 }, { x: 1, y: 0, z: 0 }, 0.8, 1000);
  assert.ok(grenade);
  assert.equal(grenade.remaining, 2);
  assert.deepEqual(state.advanceGrenades(0.05, 2999), []);
  const [detonation] = state.advanceGrenades(0.05, 3000);
  assert.equal(detonation.type, 'detonated');
  assert.equal(detonation.results[0].targetId, 'target');
  assert.equal(detonation.results[0].health, 55);
});

test('ignora impactos durante el escudo de respawn y usa el arma indicada', () => {
  const state = new GameState();

  state.addPlayer('a', { name: 'Alpha' });
  state.addPlayer('b', { name: 'Beta' });

  state.getPlayer('b').shieldUntil = Date.now() + 3000;
  const protectedHit = state.handleHit('a', 'b', 'rifle');
  assert.equal(protectedHit.ignored, true);
  assert.equal(state.getPlayer('b').health, 100);

  state.getPlayer('b').shieldUntil = 0;
  const rifleHit = state.handleHit('a', 'b', 'rifle');
  assert.equal(rifleHit.damage, 20);
  assert.equal(rifleHit.health, 80);
});

test('aplica daño de granada dentro del radio y respeta el escudo', () => {
  const state = new GameState();
  state.addPlayer('a', { position: { x: 0, y: 0, z: 0 } });
  state.addPlayer('b', { position: { x: 2, y: 0, z: 0 } });
  state.getPlayer('b').shieldUntil = 0;

  const results = state.handleExplosion('a', { x: 0, y: 0, z: 0 }, 4, 45);
  assert.equal(results.length, 1);
  assert.equal(results[0].health, 55);
});

test('la granada deja al jugador muerto hasta el respawn explícito', () => {
  const state = new GameState();
  state.addPlayer('a', { position: { x: 0, y: 0, z: 0 } });
  state.addPlayer('b', { position: { x: 1, y: 0, z: 0 } });
  state.getPlayer('b').health = 40;

  const [result] = state.handleExplosion('a', { x: 0, y: 0, z: 0 }, 4, 45);
  assert.equal(result.respawned, true);
  assert.equal(state.getPlayer('b').health, 0);
  assert.equal(state.respawnPlayer('b').health, 100);
});

test('las explosiones no dañan jugadores de otras salas', () => {
  const state = new GameState();
  state.addPlayer('shooter', { roomId: 'room-a', position: { x: 0, y: 0, z: 0 } });
  state.addPlayer('same-room', { roomId: 'room-a', position: { x: 2, y: 0, z: 0 } });
  state.addPlayer('other-room', { roomId: 'room-b', position: { x: 1, y: 0, z: 0 } });

  const results = state.handleExplosion('shooter', { x: 0, y: 0, z: 0 }, 4, 45);

  assert.deepEqual(results.map((result) => result.targetId), ['same-room']);
  assert.equal(state.getPlayer('other-room').health, 100);
});
