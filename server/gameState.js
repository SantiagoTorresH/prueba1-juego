const DEFAULT_WEAPONS = Object.freeze({
  pistol: { damage: 10, speed: 0.5 },
  shotgun: { damage: 15, speed: 0.3 },
  rifle: { damage: 20, speed: 0.7 }
});

class GameState {
  constructor({ weapons = DEFAULT_WEAPONS, baseHealth = 100, spawnPosition = { x: 0, y: 0, z: 0 } } = {}) {
    this.players = new Map();
    this.weapons = weapons;
    this.baseHealth = baseHealth;
    this.spawnPosition = spawnPosition;
  }

  addPlayer(id, data = {}) {
    const player = {
      id,
      name: data.name || 'Jugador',
      position: this.normalizePosition(data.position || this.spawnPosition),
      rotation: this.normalizeRotation(data.rotation),
      health: typeof data.health === 'number' ? data.health : this.baseHealth,
      weapon: data.weapon || 'pistol',
      team: data.team || null
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

  getSnapshot() {
    return Array.from(this.players.entries()).map(([id, player]) => [id, this.serializePlayer(player)]);
  }

  updatePlayer(id, data = {}) {
    const player = this.players.get(id);
    if (!player) {
      return null;
    }

    if (typeof data.name === 'string' && data.name.trim()) {
      player.name = data.name.trim();
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

    if (data.weapon) {
      player.weapon = data.weapon;
    }

    if (data.team) {
      player.team = data.team;
    }

    return this.serializePlayer(player);
  }

  handleHit(shooterId, targetId, weaponType) {
    const target = this.players.get(targetId);
    if (!target) {
      return null;
    }

    const weaponConfig = this.weapons[weaponType] || this.weapons.pistol;
    const damage = weaponConfig.damage;
    const nextHealth = Math.max(0, target.health - damage);
    target.health = nextHealth;

    let respawned = false;
    if (nextHealth <= 0) {
      target.health = this.baseHealth;
      target.position = this.normalizePosition(this.spawnPosition);
      target.rotation = { x: 0, y: 0 };
      respawned = true;
    }

    return {
      targetId,
      damage,
      health: target.health,
      respawned,
      position: this.normalizePosition(target.position),
      weaponType
    };
  }

  serializePlayer(player) {
    return {
      id: player.id,
      name: player.name,
      position: this.normalizePosition(player.position),
      rotation: this.normalizeRotation(player.rotation),
      health: player.health,
      weapon: player.weapon,
      team: player.team
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
}

module.exports = GameState;
