const ARENA_CONFIG = require('../public/arena-config');
const ARENA_PHYSICS = require('../public/arena-physics');

const DEFAULT_WEAPONS = Object.freeze({
  pistol: { damage: 10, speed: 18, fireIntervalMs: 350, range: 60, magazine: 12 },
  shotgun: { damage: 15, speed: 14, fireIntervalMs: 850, range: 36, magazine: 5 },
  rifle: { damage: 20, speed: 30, fireIntervalMs: 120, range: 84, magazine: 30 },
  smg: { damage: 7, speed: 25, fireIntervalMs: 85, range: 58, magazine: 36, autoFire: true },
  double_barrel: { damage: 28, speed: 17, fireIntervalMs: 720, range: 27, magazine: 2, hitRadius: 1.75 }
});

const TEAMS = Object.freeze({
  RED: 'red',
  BLUE: 'blue'
});

const TEAM_SPAWN_POSITIONS = {
  red: { x: -18, y: 0, z: -18 },
  blue: { x: 18, y: 0, z: 18 }
};

function createArenaCollisionBoxes() {
  const boxes = [
    { min: { x: -31.5, y: -0.5, z: -31.5 }, max: { x: 31.5, y: 0, z: 31.5 }, surface: 'ground' },
    { min: { x: -32.5, y: 0, z: -32 }, max: { x: -31.5, y: 5, z: 32 }, surface: 'metal' },
    { min: { x: 31.5, y: 0, z: -32 }, max: { x: 32.5, y: 5, z: 32 }, surface: 'metal' },
    { min: { x: -32, y: 0, z: -32.5 }, max: { x: 32, y: 5, z: -31.5 }, surface: 'metal' },
    { min: { x: -32, y: 0, z: 31.5 }, max: { x: 32, y: 5, z: 32.5 }, surface: 'metal' }
  ];

  for (const obstacle of ARENA_CONFIG.obstacles) {
    let dimensions;
    let centerY;

    if (obstacle.type === 'crate') {
      dimensions = { x: obstacle.width, y: obstacle.height, z: obstacle.depth };
      centerY = obstacle.height / 2;
    } else if (obstacle.type === 'shortWall') {
      dimensions = { x: obstacle.width, y: 2, z: obstacle.depth };
      centerY = 1;
    } else if (obstacle.type === 'barrel') {
      dimensions = { x: 1.2, y: 2, z: 1.2 };
      centerY = 1;
    } else if (obstacle.type === 'pillar') {
      dimensions = { x: 0.8, y: obstacle.height, z: 0.8 };
      centerY = obstacle.height / 2;
    } else if (obstacle.type === 'tree') {
      boxes.push(
        { min: { x: obstacle.x - 0.65, y: 0, z: obstacle.z - 0.65 }, max: { x: obstacle.x + 0.65, y: 3.2, z: obstacle.z + 0.65 }, surface: 'wood' },
        { min: { x: obstacle.x - 2.1, y: 2, z: obstacle.z - 2.1 }, max: { x: obstacle.x + 2.1, y: 6.2, z: obstacle.z + 2.1 }, surface: 'foliage' }
      );
      continue;
    } else {
      continue;
    }

    boxes.push({
      min: {
        x: obstacle.x - dimensions.x / 2,
        y: centerY - dimensions.y / 2,
        z: obstacle.z - dimensions.z / 2
      },
      max: {
        x: obstacle.x + dimensions.x / 2,
        y: centerY + dimensions.y / 2,
        z: obstacle.z + dimensions.z / 2
      },
      surface: obstacle.type === 'crate' || obstacle.type === 'shortWall' ? 'wood' : 'metal'
    });
  }

  for (const staircase of ARENA_CONFIG.staircases) {
    for (let index = 0; index < staircase.steps; index += 1) {
      const height = 0.45 + index * 0.22;
      const centerZ = staircase.z + index * staircase.direction * 1.1;
      boxes.push({
        min: { x: staircase.x - 1.75, y: 0, z: centerZ - 0.6 },
        max: { x: staircase.x + 1.75, y: height, z: centerZ + 0.6 },
        surface: 'metal'
      });
    }
  }

  return boxes;
}

class GameState {
  constructor({ weapons = DEFAULT_WEAPONS, baseHealth = 100, spawnPosition = { x: 0, y: 0, z: 0 } } = {}) {
    this.players = new Map();
    this.weapons = weapons;
    this.baseHealth = baseHealth;
    this.spawnPosition = spawnPosition;
    this.respawnDelayMs = 4000;
    this.spawnShieldMs = 3000;
    this.arenaCollisionBoxes = createArenaCollisionBoxes();
    this.playerCollisionBoxes = ARENA_PHYSICS.createCollisionBoxes(ARENA_CONFIG);
    this.projectiles = new Map();
    this.nextProjectileId = 1;
    this.weaponPickups = new Map();
    this.nextDroppedWeaponId = 1;
    this.grenades = new Map();
    this.nextGrenadeId = 1;
  }

  addPlayer(id, data = {}) {
    const team = data.team && (data.team === TEAMS.RED || data.team === TEAMS.BLUE) ? data.team : null;
    const spawnPos = team ? TEAM_SPAWN_POSITIONS[team] : (data.position || this.spawnPosition);
    
    const weaponType = this.weapons[data.weapon] ? data.weapon : 'pistol';
    const ammo = Object.fromEntries(Object.entries(this.weapons).map(([type, config]) => [
      type,
      typeof data.ammo?.[type] === 'number' ? Math.max(0, Math.min(config.magazine, data.ammo[type])) : config.magazine
    ]));
    const player = {
      id,
      name: data.name || 'Jugador',
      roomId: data.roomId || null,
      position: this.normalizePosition(spawnPos),
      rotation: this.normalizeRotation(data.rotation),
      health: typeof data.health === 'number' ? data.health : this.baseHealth,
      weapon: weaponType,
      ammo,
      grenades: Number.isInteger(data.grenades) ? Math.max(0, Math.min(3, data.grenades)) : 3,
      team: team,
      respawnAt: 0,
      shieldUntil: 0,
      lastMoveAt: Date.now(),
      lastShotAt: 0
    };

    this.players.set(id, player);
    return this.serializePlayer(player);
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  getPlayer(id) {
    return this.players.get(id);
  }

  getSnapshot(roomId) {
    return Array.from(this.players.entries())
      .filter(([, player]) => roomId === undefined || player.roomId === roomId)
      .map(([id, player]) => [id, this.serializePlayer(player)]);
  }

  ensureRoomWeaponPickups(roomId) {
    for (const pickup of ARENA_CONFIG.weaponPickups || []) {
      const pickupId = `${roomId}:${pickup.id}`;
      if (!this.weaponPickups.has(pickupId)) {
        this.weaponPickups.set(pickupId, {
          id: pickup.id,
          roomId,
          weaponType: pickup.weaponType,
          position: { x: pickup.x, y: 0.55, z: pickup.z },
          active: true,
          availableAt: 0
        });
      }
    }
  }

  getWeaponPickups(roomId) {
    return Array.from(this.weaponPickups.values())
      .filter((pickup) => pickup.roomId === roomId)
      .map((pickup) => ({ ...pickup, position: { ...pickup.position } }));
  }

  pickupWeapon(playerId, pickupId, now = Date.now()) {
    const player = this.players.get(playerId);
    if (!player || player.health <= 0) return null;
    const pickup = this.weaponPickups.get(`${player.roomId}:${pickupId}`);
    if (!pickup || !pickup.active || pickup.availableAt > now) return null;

    const distance = Math.hypot(
      player.position.x - pickup.position.x,
      player.position.z - pickup.position.z
    );
    if (distance > 2.6 || !this.weapons[pickup.weaponType]) return null;

    const droppedWeapon = player.weapon;
    const droppedAmmo = player.ammo[droppedWeapon];
    player.weapon = pickup.weaponType;
    player.ammo[pickup.weaponType] = pickup.ammo ?? this.weapons[pickup.weaponType].magazine;
    pickup.active = false;
    this.weaponPickups.delete(`${player.roomId}:${pickupId}`);

    if (droppedWeapon !== pickup.weaponType) {
      const droppedId = `drop-${this.nextDroppedWeaponId++}`;
      this.weaponPickups.set(`${player.roomId}:${droppedId}`, {
        id: droppedId,
        roomId: player.roomId,
        weaponType: droppedWeapon,
        position: { x: player.position.x, y: 0.55, z: player.position.z },
        active: true,
        availableAt: now + 900,
        ammo: droppedAmmo
      });
    }

    return {
      player: this.serializePlayer(player),
      pickups: this.getWeaponPickups(player.roomId),
      pickedWeapon: pickup.weaponType,
      droppedWeapon
    };
  }

  reloadWeapon(playerId) {
    const player = this.players.get(playerId);
    if (!player || player.health <= 0) return null;
    const weapon = this.weapons[player.weapon];
    if (!weapon || player.ammo[player.weapon] >= weapon.magazine) return null;
    player.ammo[player.weapon] = weapon.magazine;
    return { weaponType: player.weapon, ammo: { ...player.ammo } };
  }

  registerGrenade(playerId, position, direction, charge = 0.5, now = Date.now()) {
    const player = this.players.get(playerId);
    if (!player || !player.roomId || player.health <= 0 || player.grenades <= 0
      || !this.isFiniteVector(position) || !this.isFiniteVector(direction) || !Number.isFinite(charge)) {
      return null;
    }

    const originDistance = Math.hypot(
      position.x - player.position.x,
      position.y - (player.position.y + 1.2),
      position.z - player.position.z
    );
    const directionLength = Math.hypot(direction.x, direction.y, direction.z);
    if (originDistance > 3 || directionLength < 0.9 || directionLength > 1.1) return null;

    const power = Math.max(0, Math.min(1, charge));
    const velocity = {
      x: direction.x / directionLength * (5 + power * 8),
      y: direction.y / directionLength * (5 + power * 8) + 2 + power * 4,
      z: direction.z / directionLength * (5 + power * 8)
    };
    const grenade = {
      id: String(this.nextGrenadeId++),
      playerId,
      roomId: player.roomId,
      position: this.normalizePosition(position),
      velocity,
      fuseAt: now + 2000,
      radius: 4.5,
      damage: 45
    };
    player.grenades -= 1;
    this.grenades.set(grenade.id, grenade);
    return { ...grenade, position: { ...grenade.position }, velocity: { ...velocity }, remaining: player.grenades };
  }

  getGrenades(roomId) {
    return Array.from(this.grenades.values())
      .filter((grenade) => roomId === undefined || grenade.roomId === roomId)
      .map((grenade) => ({ ...grenade, position: { ...grenade.position }, velocity: { ...grenade.velocity } }));
  }

  advanceGrenades(deltaSeconds, now = Date.now()) {
    const events = [];
    const delta = Math.min(Math.max(deltaSeconds, 0), 0.1);
    for (const grenade of this.grenades.values()) {
      const previous = { ...grenade.position };
      grenade.velocity.y -= 9.8 * delta;
      const next = {
        x: grenade.position.x + grenade.velocity.x * delta,
        y: grenade.position.y + grenade.velocity.y * delta,
        z: grenade.position.z + grenade.velocity.z * delta
      };
      const hit = this.findFirstArenaHit(previous, next);
      if (hit) {
        grenade.position = { ...hit.position };
        if (hit.surface === 'ground') {
          grenade.position.y = 0.18;
          grenade.velocity.y = Math.abs(grenade.velocity.y) * 0.36;
          grenade.velocity.x *= 0.76;
          grenade.velocity.z *= 0.76;
        } else {
          grenade.velocity.x *= -0.28;
          grenade.velocity.y = Math.abs(grenade.velocity.y) * 0.25;
          grenade.velocity.z *= -0.28;
        }
      } else {
        grenade.position = next;
      }

      if (grenade.fuseAt <= now) {
        const results = this.handleExplosion(grenade.playerId, grenade.position, grenade.radius, grenade.damage);
        events.push({
          type: 'detonated',
          grenade: { ...grenade, position: { ...grenade.position } },
          results
        });
        this.grenades.delete(grenade.id);
      }
    }
    return events;
  }

  updatePlayer(id, data = {}) {
    const player = this.players.get(id);
    if (!player) {
      return null;
    }

    if (typeof data.name === 'string' && data.name.trim()) {
      player.name = data.name.trim();
    }

    if (typeof data.roomId === 'string') {
      player.roomId = data.roomId;
    }

    if (data.position) {
      player.position = this.normalizePosition(data.position);
    }

    if (data.rotation) {
      player.rotation = {
        ...player.rotation,
        ...this.normalizeRotation(data.rotation)
      };
    }

    if (typeof data.health === 'number') {
      player.health = data.health;
    }

    if (data.weapon && this.weapons[data.weapon]) {
      player.weapon = data.weapon;
    }

    if (data.team) {
      player.team = data.team;
    }

    return this.serializePlayer(player);
  }

  acceptPlayerMove(id, position, rotation, now = Date.now()) {
    const player = this.players.get(id);
    if (!player || !this.isFiniteVector(position) || !rotation || !Number.isFinite(rotation.x) || !Number.isFinite(rotation.y)) {
      return null;
    }

    if (Math.abs(position.x) > 31 || Math.abs(position.z) > 31 || position.y < 0 || position.y > 4.2) {
      return null;
    }

    const elapsedMs = Math.min(Math.max(now - player.lastMoveAt, 0), 1000);
    const distance = Math.hypot(
      position.x - player.position.x,
      position.y - player.position.y,
      position.z - player.position.z
    );
    const maximumDistance = 24 * (elapsedMs / 1000) + 0.5;
    if (distance > maximumDistance) {
      return null;
    }

    const resolvedPosition = ARENA_PHYSICS.resolvePlayerMove(player.position, position, this.playerCollisionBoxes);
    player.lastMoveAt = now;
    return this.updatePlayer(id, { position: resolvedPosition, rotation });
  }

  registerShot(id, weaponType, position, direction, now = Date.now()) {
    const player = this.players.get(id);
    const weapon = this.weapons[weaponType];
    if (!player || !player.roomId || player.health <= 0 || player.weapon !== weaponType || !weapon || !this.isFiniteVector(position) || !this.isFiniteVector(direction)) {
      return null;
    }
    if (player.ammo[weaponType] <= 0) return null;

    const directionLength = Math.hypot(direction.x, direction.y, direction.z);
    const originDistance = Math.hypot(
      position.x - player.position.x,
      position.y - player.position.y,
      position.z - player.position.z
    );
    if (directionLength < 0.9 || directionLength > 1.1 || originDistance > 3) {
      return null;
    }

    if (now - player.lastShotAt < weapon.fireIntervalMs) {
      return null;
    }
    const activeProjectiles = Array.from(this.projectiles.values()).filter((projectile) => projectile.playerId === id).length;
    if (activeProjectiles >= 48) {
      return null;
    }

    player.lastShotAt = now;
    player.ammo[weaponType] -= 1;
    const normalizedDirection = {
      x: direction.x / directionLength,
      y: direction.y / directionLength,
      z: direction.z / directionLength
    };
    const projectile = {
      id: String(this.nextProjectileId++),
      playerId: id,
      roomId: player.roomId,
      position: this.normalizePosition(position),
      previousPosition: this.normalizePosition(position),
      direction: normalizedDirection,
      weaponType,
      speed: weapon.speed,
      damage: weapon.damage,
      range: weapon.range,
      hitRadius: weapon.hitRadius || 1.1,
      traveled: 0,
      expiresAt: now + (weapon.range / weapon.speed) * 1000
    };
    this.projectiles.set(projectile.id, projectile);
    return this.serializeProjectile(projectile);
  }

  advanceProjectiles(deltaSeconds, now = Date.now()) {
    const events = [];
    const delta = Math.min(Math.max(deltaSeconds, 0), 0.1);

    for (const projectile of this.projectiles.values()) {
      const stepDistance = Math.min(projectile.speed * delta, projectile.range - projectile.traveled);
      projectile.previousPosition = this.normalizePosition(projectile.position);
      projectile.position = {
        x: projectile.position.x + projectile.direction.x * stepDistance,
        y: projectile.position.y + projectile.direction.y * stepDistance,
        z: projectile.position.z + projectile.direction.z * stepDistance
      };
      projectile.traveled += stepDistance;

      const arenaHit = this.findFirstArenaHit(projectile.previousPosition, projectile.position);
      const playerHit = this.findFirstPlayerHit(projectile);
      const collision = playerHit && (!arenaHit || playerHit.distance < arenaHit.distance)
        ? playerHit
        : arenaHit;

      if (collision) {
        let damageResult = null;
        if (collision.playerId) {
          damageResult = this.applyProjectileDamage(projectile, collision.playerId, now);
        }
        events.push({
          type: collision.playerId ? 'player' : 'arena',
          surface: collision.surface || null,
          projectile: this.serializeProjectile(projectile),
          position: collision.position,
          playerId: collision.playerId || null,
          damageResult
        });
        this.projectiles.delete(projectile.id);
        continue;
      }

      if (projectile.traveled >= projectile.range || projectile.expiresAt <= now) {
        events.push({
          type: 'range',
          projectile: this.serializeProjectile(projectile),
          position: this.normalizePosition(projectile.position),
          playerId: null,
          damageResult: null
        });
        this.projectiles.delete(projectile.id);
      }
    }

    return events;
  }

  getProjectiles(roomId) {
    return Array.from(this.projectiles.values())
      .filter((projectile) => roomId === undefined || projectile.roomId === roomId)
      .map((projectile) => this.serializeProjectile(projectile));
  }

  findFirstArenaHit(start, end) {
    let firstHit = null;
    for (const box of this.arenaCollisionBoxes) {
      const hit = this.segmentBoxHit(start, end, box);
      if (hit && (!firstHit || hit.distance < firstHit.distance)) {
        firstHit = hit;
      }
    }
    return firstHit;
  }

  findFirstPlayerHit(projectile) {
    let firstHit = null;
    for (const [playerId, player] of this.players) {
      if (playerId === projectile.playerId || player.roomId !== projectile.roomId || player.health <= 0) {
        continue;
      }

      const center = { x: player.position.x, y: player.position.y + 1.2, z: player.position.z };
      const hit = this.segmentSphereHit(projectile.previousPosition, projectile.position, center, projectile.hitRadius || 1.1);
      if (hit && (!firstHit || hit.distance < firstHit.distance)) {
        firstHit = { ...hit, playerId };
      }
    }
    return firstHit;
  }

  applyProjectileDamage(projectile, targetId, now) {
    const target = this.players.get(targetId);
    if (!target || target.shieldUntil > now) {
      return { ignored: true, targetId, reason: 'spawn-shield' };
    }

    target.health = Math.max(0, target.health - projectile.damage);
    const respawned = target.health === 0;
    if (respawned) {
      target.respawnAt = now + this.respawnDelayMs;
    }

    return {
      targetId,
      damage: projectile.damage,
      health: target.health,
      respawned,
      respawnDelayMs: this.respawnDelayMs,
      shieldMs: this.spawnShieldMs
    };
  }

  serializeProjectile(projectile) {
    return {
      id: projectile.id,
      playerId: projectile.playerId,
      roomId: projectile.roomId,
      position: this.normalizePosition(projectile.position),
      direction: { ...projectile.direction },
      weaponType: projectile.weaponType,
      speed: projectile.speed,
      range: projectile.range
    };
  }

  handleHit(shooterId, targetId, weaponType) {
    const target = this.players.get(targetId);
    if (!target) {
      return null;
    }

    if (target.shieldUntil > Date.now()) {
      return { ignored: true, targetId, reason: 'spawn-shield' };
    }

    const weaponConfig = this.weapons[weaponType] || this.weapons.pistol;
    const damage = weaponConfig.damage;
    const nextHealth = Math.max(0, target.health - damage);
    target.health = nextHealth;

    let respawned = false;
    if (nextHealth <= 0) {
      target.health = 0;
      target.respawnAt = Date.now() + this.respawnDelayMs;
      respawned = true;
    }

    return {
      targetId,
      damage,
      health: target.health,
      respawned,
      respawnDelayMs: this.respawnDelayMs,
      shieldMs: this.spawnShieldMs,
      position: this.normalizePosition(target.position),
      weaponType
    };
  }

  respawnPlayer(targetId) {
    const target = this.players.get(targetId);
    if (!target || target.health > 0) return null;

    const spawnPos = target.team ? TEAM_SPAWN_POSITIONS[target.team] : this.spawnPosition;
    target.health = this.baseHealth;
    target.grenades = 3;
    target.position = this.normalizePosition(spawnPos);
    target.rotation = { x: 0, y: 0 };
    target.respawnAt = 0;
    target.shieldUntil = Date.now() + this.spawnShieldMs;
    return this.serializePlayer(target);
  }

  handleExplosion(shooterId, position, radius = 4, damage = 45) {
    const shooter = this.players.get(shooterId);
    if (!shooter || !this.isFiniteVector(position) || !Number.isFinite(radius) || !Number.isFinite(damage)) {
      return [];
    }

    const results = [];
    for (const [targetId, target] of this.players) {
      if (targetId === shooterId || target.roomId !== shooter.roomId || target.shieldUntil > Date.now()) continue;
      const distance = Math.hypot(
        target.position.x - position.x,
        target.position.y - position.y,
        target.position.z - position.z
      );
      if (distance > radius) continue;

      target.health = Math.max(0, target.health - damage);
      const respawned = target.health === 0;
      if (respawned) target.respawnAt = Date.now() + this.respawnDelayMs;
      results.push({ targetId, health: target.health, respawned, position: this.normalizePosition(target.position) });
    }
    return results;
  }

  serializePlayer(player) {
    return {
      id: player.id,
      name: player.name,
      position: this.normalizePosition(player.position),
      rotation: this.normalizeRotation(player.rotation),
      health: player.health,
      weapon: player.weapon,
      ammo: { ...player.ammo },
      grenades: player.grenades,
      team: player.team,
      respawnAt: Number(player.respawnAt) || 0,
      shieldUntil: Number(player.shieldUntil) || 0
    };
  }

  normalizePosition(position) {
    return {
      x: Number(position?.x) || 0,
      y: Number(position?.y) || 0,
      z: Number(position?.z) || 0
    };
  }

  normalizeRotation(rotation = {}) {
    return {
      x: Number(rotation.x) || 0,
      y: Number(rotation.y) || 0
    };
  }

  isFiniteVector(value) {
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
  }

  segmentBoxHit(start, end, box) {
    let minimumT = 0;
    let maximumT = 1;

    for (const axis of ['x', 'y', 'z']) {
      const delta = end[axis] - start[axis];
      if (Math.abs(delta) < Number.EPSILON) {
        if (start[axis] < box.min[axis] || start[axis] > box.max[axis]) {
          return null;
        }
        continue;
      }

      let firstT = (box.min[axis] - start[axis]) / delta;
      let secondT = (box.max[axis] - start[axis]) / delta;
      if (firstT > secondT) [firstT, secondT] = [secondT, firstT];
      minimumT = Math.max(minimumT, firstT);
      maximumT = Math.min(maximumT, secondT);
      if (minimumT > maximumT) {
        return null;
      }
    }

    if (maximumT < 0 || minimumT > 1) {
      return null;
    }

    const t = Math.max(0, minimumT);
    const position = {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      z: start.z + (end.z - start.z) * t
    };
    return {
      position,
      surface: box.surface,
      distance: Math.hypot(position.x - start.x, position.y - start.y, position.z - start.z)
    };
  }

  segmentSphereHit(start, end, center, radius) {
    const delta = { x: end.x - start.x, y: end.y - start.y, z: end.z - start.z };
    const lengthSquared = delta.x * delta.x + delta.y * delta.y + delta.z * delta.z;
    if (lengthSquared === 0) return null;

    const offset = { x: start.x - center.x, y: start.y - center.y, z: start.z - center.z };
    const a = lengthSquared;
    const b = 2 * (offset.x * delta.x + offset.y * delta.y + offset.z * delta.z);
    const c = offset.x * offset.x + offset.y * offset.y + offset.z * offset.z - radius * radius;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;

    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (t < 0 || t > 1) return null;

    const position = { x: start.x + delta.x * t, y: start.y + delta.y * t, z: start.z + delta.z * t };
    return { position, distance: Math.sqrt(lengthSquared) * t };
  }
}

module.exports = GameState;
