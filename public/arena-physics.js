(function exposeArenaPhysics(root) {
  function createCollisionBoxes(config) {
    const boxes = [
      { min: { x: -32.5, y: 0, z: -32 }, max: { x: -31.5, y: 5, z: 32 }, surface: 'metal' },
      { min: { x: 31.5, y: 0, z: -32 }, max: { x: 32.5, y: 5, z: 32 }, surface: 'metal' },
      { min: { x: -32, y: 0, z: -32.5 }, max: { x: 32, y: 5, z: -31.5 }, surface: 'metal' },
      { min: { x: -32, y: 0, z: 31.5 }, max: { x: 32, y: 5, z: 32.5 }, surface: 'metal' }
    ];

    for (const obstacle of config.obstacles) {
      let dimensions;
      let height;
      let surface;
      let walkable = false;

      if (obstacle.type === 'crate') {
        dimensions = { x: obstacle.width, y: obstacle.height, z: obstacle.depth };
        height = obstacle.height;
        surface = 'wood';
        walkable = true;
      } else if (obstacle.type === 'shortWall') {
        dimensions = { x: obstacle.width, y: 2, z: obstacle.depth };
        height = 2;
        surface = 'wood';
      } else if (obstacle.type === 'barrel') {
        dimensions = { x: 1.24, y: 2, z: 1.24 };
        height = 2;
        surface = 'metal';
        walkable = true;
      } else if (obstacle.type === 'pillar') {
        dimensions = { x: 1.16, y: obstacle.height, z: 1.16 };
        height = obstacle.height;
        surface = 'metal';
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
        min: { x: obstacle.x - dimensions.x / 2, y: 0, z: obstacle.z - dimensions.z / 2 },
        max: { x: obstacle.x + dimensions.x / 2, y: height, z: obstacle.z + dimensions.z / 2 },
        surface,
        walkable
      });
    }

    for (const staircase of config.staircases) {
      for (let index = 0; index < staircase.steps; index += 1) {
        const height = 0.45 + index * 0.22;
        const centerZ = staircase.z + index * staircase.direction * 1.1;
        boxes.push({
          min: { x: staircase.x - 1.75, y: 0, z: centerZ - 0.6 },
          max: { x: staircase.x + 1.75, y: height, z: centerZ + 0.6 },
          surface: 'metal',
          walkable: true
        });
      }
    }

    return boxes;
  }

  function overlapsFootprint(position, box, radius) {
    return position.x + radius > box.min.x && position.x - radius < box.max.x
      && position.z + radius > box.min.z && position.z - radius < box.max.z;
  }

  function overlapsBody(position, box, radius, height) {
    return overlapsFootprint(position, box, radius)
      && position.y < box.max.y - 0.025
      && position.y + height > box.min.y + 0.025;
  }

  function resolvePlayerMove(current, desired, boxes, options = {}) {
    const radius = options.radius ?? 0.48;
    const height = options.height ?? 2.2;
    const maxStepHeight = options.maxStepHeight ?? 0.48;
    const resolved = { x: current.x, y: desired.y, z: current.z };

    for (const axis of ['x', 'z']) {
      const candidate = { ...resolved, [axis]: desired[axis] };
      let blocked = false;
      for (const box of boxes) {
        if (!overlapsBody(candidate, box, radius, height)) continue;

        const rise = box.max.y - resolved.y;
        if (box.walkable && rise >= -0.06 && rise <= maxStepHeight) {
          const stepped = { ...candidate, y: box.max.y };
          const headBlocked = boxes.some((other) => other !== box && overlapsBody(stepped, other, radius, height));
          if (!headBlocked) {
            candidate.y = Math.max(candidate.y, box.max.y);
            continue;
          }
        }

        if (box.walkable && resolved.y >= box.max.y - 0.06) continue;
        blocked = true;
        break;
      }
      if (!blocked) {
        resolved.x = candidate.x;
        resolved.z = candidate.z;
        resolved.y = Math.max(resolved.y, candidate.y);
      }
    }

    return resolved;
  }

  function findLandingSurface(previousY, nextY, x, z, boxes, radius = 0.48) {
    let landingY = nextY <= 0 && previousY >= 0 ? 0 : null;
    for (const box of boxes) {
      if (!box.walkable || !overlapsFootprint({ x, z }, box, radius)) continue;
      const top = box.max.y;
      if (nextY <= top && previousY >= top && (landingY === null || top > landingY)) {
        landingY = top;
      }
    }
    return landingY;
  }

  const api = { createCollisionBoxes, resolvePlayerMove, findLandingSurface };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ARENA_PHYSICS = api;
})(typeof window !== 'undefined' ? window : globalThis);