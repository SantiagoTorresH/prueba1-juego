(function exposeArenaConfig(root) {
  const arenaConfig = Object.freeze({
    obstacles: [
      { type: 'pillar', x: 0, z: 0, height: 4 },
      { type: 'pillar', x: 3, z: 2, height: 4 },
      { type: 'pillar', x: -3, z: -2, height: 4 },
      { type: 'crate', x: -12, z: -12, width: 4, height: 3, depth: 4 },
      { type: 'crate', x: -8, z: -14, width: 3, height: 3, depth: 3 },
      { type: 'barrel', x: -10, z: -10 },
      { type: 'barrel', x: -14, z: -12 },
      { type: 'crate', x: 12, z: -12, width: 4, height: 3, depth: 4 },
      { type: 'shortWall', x: 14, z: -10, width: 4, depth: 1 },
      { type: 'barrel', x: 10, z: -14 },
      { type: 'crate', x: -12, z: 12, width: 3, height: 3, depth: 3 },
      { type: 'crate', x: -9, z: 14, width: 4, height: 3, depth: 4 },
      { type: 'barrel', x: -11, z: 11 },
      { type: 'crate', x: 12, z: 12, width: 4, height: 3, depth: 4 },
      { type: 'shortWall', x: 10, z: 14, width: 5, depth: 1 },
      { type: 'pillar', x: 15, z: 11, height: 5 },
      { type: 'crate', x: -6, z: 0, width: 3, height: 3, depth: 3 },
      { type: 'crate', x: 6, z: 0, width: 3, height: 3, depth: 3 },
      { type: 'crate', x: 0, z: 6, width: 3, height: 3, depth: 3 },
      { type: 'crate', x: 0, z: -6, width: 3, height: 3, depth: 3 },
      { type: 'barrel', x: 5, z: 8 },
      { type: 'barrel', x: -5, z: 8 },
      { type: 'barrel', x: 7, z: -5 },
      { type: 'barrel', x: -7, z: -5 },
      { type: 'pillar', x: -15, z: -8, height: 4 },
      { type: 'pillar', x: 15, z: 8, height: 4 },
      { type: 'pillar', x: -8, z: 15, height: 4 },
      { type: 'pillar', x: 8, z: -15, height: 4 },
      { type: 'tree', x: -5, z: -12 },
      { type: 'tree', x: 6, z: 12 },
      { type: 'tree', x: -15, z: 10 }
    ],
    staircases: [
      { x: -15, z: 2, steps: 7, direction: -1 },
      { x: 15, z: -2, steps: 7, direction: 1 }
    ],
    weaponPickups: [
      { id: 'smg-yard', weaponType: 'smg', x: -10, z: 0 },
      { id: 'double-barrel-yard', weaponType: 'double_barrel', x: 10, z: 0 }
    ]
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = arenaConfig;
  } else {
    root.ARENA_CONFIG = arenaConfig;
  }
})(typeof window !== 'undefined' ? window : globalThis);