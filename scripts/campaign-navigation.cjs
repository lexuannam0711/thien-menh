'use strict';

function nextWaypoint(start, target, barriers, tolerance = 45) {
  const finitePoint = point => point !== null && typeof point === 'object'
    && Number.isFinite(point.x) && Number.isFinite(point.y);
  if (!finitePoint(start) || !finitePoint(target)) throw new TypeError('start and target must have finite x/y');
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new TypeError('tolerance must be finite and nonnegative');
  if (!Array.isArray(barriers)) throw new TypeError('barriers must be an array');
  for (const barrier of barriers) {
    if (!finitePoint(barrier) || !Number.isFinite(barrier.width) || !Number.isFinite(barrier.height)
      || barrier.width <= 0 || barrier.height <= 0 || !Number.isFinite(barrier.x + barrier.width)
      || !Number.isFinite(barrier.y + barrier.height)) throw new TypeError('barrier must be a finite positive rectangle');
  }
  const inBounds = point => point.x >= 33 && point.x <= 932 && point.y >= 99 && point.y <= 508;
  if (!inBounds(start)) throw new RangeError('start outside navigation bounds');
  const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
  const segmentSafe = (from, to) => inBounds(from) && inBounds(to) && barriers.every(barrier => {
    let enter = 0;
    let exit = 1;
    for (const [axis, size] of [['x', 'width'], ['y', 'height']]) {
      const delta = to[axis] - from[axis];
      if (delta === 0) {
        if (from[axis] < barrier[axis] || from[axis] > barrier[axis] + barrier[size]) {
          enter = Infinity;
          break;
        }
      } else {
        const first = (barrier[axis] - from[axis]) / delta;
        const last = (barrier[axis] + barrier[size] - from[axis]) / delta;
        enter = Math.max(enter, Math.min(first, last));
        exit = Math.min(exit, Math.max(first, last));
      }
    }
    if (enter <= exit) return false;
    for (const point of [from, to]) {
      const nearest = { x: Math.max(barrier.x, Math.min(barrier.x + barrier.width, point.x)),
        y: Math.max(barrier.y, Math.min(barrier.y + barrier.height, point.y)) };
      if (distance(point, nearest) < 22) return false;
    }
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    return [barrier.x, barrier.x + barrier.width].every(cornerX =>
      [barrier.y, barrier.y + barrier.height].every(cornerY => {
        const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
          ((cornerX - from.x) * deltaX + (cornerY - from.y) * deltaY) / lengthSquared));
        return Math.hypot(cornerX - from.x - fraction * deltaX,
          cornerY - from.y - fraction * deltaY) >= 22;
      }));
  });
  if (!segmentSafe(start, start)) throw new Error('no-route: start overlaps a barrier');
  const goal = { x: Math.max(33, Math.min(932, target.x)), y: Math.max(99, Math.min(508, target.y)) };
  if (segmentSafe(start, goal) && distance(goal, target) <= tolerance) return goal;
  const axisPoints = (minimum, maximum) => [...Array.from({ length: Math.ceil((maximum - minimum) / 24) },
    (_, index) => minimum + index * 24), maximum];
  const columns = axisPoints(33, 932);
  const rows = axisPoints(99, 508);
  const points = rows.flatMap(y => columns.map(x => ({ x, y })));
  const root = points.length;
  const nodes = [...points, { x: start.x, y: start.y }];
  const parents = Array(nodes.length).fill(undefined);
  parents[root] = -1;
  const queue = [root];
  let best;
  let bestDistance = Infinity;
  // ponytail: 24px grid can miss narrow corridors; reduce spacing if campaign geometry needs them.
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const point = nodes[index];
    let candidate = goal;
    if (!segmentSafe(point, candidate)) {
      let low = 0;
      let high = 1;
      for (let iteration = 0; iteration < 40; iteration += 1) {
        const fraction = (low + high) / 2;
        const probe = { x: point.x + (goal.x - point.x) * fraction,
          y: point.y + (goal.y - point.y) * fraction };
        if (segmentSafe(point, probe)) low = fraction;
        else high = fraction;
      }
      candidate = { x: point.x + (goal.x - point.x) * low, y: point.y + (goal.y - point.y) * low };
    }
    const remaining = distance(candidate, target);
    if (remaining <= tolerance && remaining < bestDistance - 1e-9) {
      best = { index, candidate };
      bestDistance = remaining;
    }
    if (best && bestDistance <= distance(goal, target) + 1e-9) break;
    const column = index % columns.length;
    const row = Math.floor(index / columns.length);
    const neighbors = index === root ? points.flatMap((entry, neighbor) =>
      distance(point, entry) > 1e-9 && distance(point, entry) <= 24 * Math.SQRT2 ? [neighbor] : [])
      : [column > 0 ? index - 1 : -1, column + 1 < columns.length ? index + 1 : -1,
        row > 0 ? index - columns.length : -1, row + 1 < rows.length ? index + columns.length : -1];
    for (const neighbor of neighbors) {
      if (neighbor < 0 || parents[neighbor] !== undefined || !segmentSafe(point, nodes[neighbor])) continue;
      parents[neighbor] = index;
      queue.push(neighbor);
    }
  }
  if (!best) throw new Error('no-route: no reachable goal within tolerance on 24px grid');
  if (best.index === root || segmentSafe(start, best.candidate)) return best.candidate;
  let waypoint = best.index;
  while (parents[waypoint] !== root) waypoint = parents[waypoint];
  return { ...nodes[waypoint] };
}

module.exports = nextWaypoint;

if (require.main === module) {
  const assert = require('node:assert/strict');
  const straight = { x: 800, y: 270 };
  assert.deepEqual(nextWaypoint({ x: 138, y: 270 }, straight, []), straight);
  assert.deepEqual(nextWaypoint({ x: 33, y: 99 }, { x: 932, y: 508 }, []), { x: 932, y: 508 });
  assert.deepEqual(nextWaypoint({ x: 138, y: 270 }, { x: 950, y: 270 }, [], 20), { x: 932, y: 270 });
  const obstacle = { x: 440, y: 200, width: 80, height: 140 };
  let position = { x: 138, y: 270 };
  let turns = 0;
  while (Math.hypot(position.x - straight.x, position.y - straight.y) > 1 && turns < 150) {
    const waypoint = nextWaypoint(position, straight, [obstacle], 0);
    assert.notDeepEqual(waypoint, position);
    for (let step = 0; step <= 100; step += 1) {
      const point = { x: position.x + (waypoint.x - position.x) * step / 100,
        y: position.y + (waypoint.y - position.y) * step / 100 };
      const nearestX = Math.max(obstacle.x, Math.min(obstacle.x + obstacle.width, point.x));
      const nearestY = Math.max(obstacle.y, Math.min(obstacle.y + obstacle.height, point.y));
      assert.ok(Math.hypot(point.x - nearestX, point.y - nearestY) >= 22 - 1e-7);
      assert.ok(point.x >= 33 && point.x <= 932 && point.y >= 99 && point.y <= 508);
    }
    position = waypoint;
    turns += 1;
  }
  assert.ok(turns < 150, 'Detour must reach the target');
  assert.ok(turns > 1, 'Obstacle must prevent a straight route');
  const corner = { x: 440, y: 200, width: 80, height: 140 };
  const cornerStart = { x: 400, y: 220 };
  const cornerTarget = { x: 460, y: 160 };
  const cornerWaypoint = nextWaypoint(cornerStart, cornerTarget, [corner], 0);
  assert.notDeepEqual(cornerWaypoint, cornerTarget, 'Segment must not clip the rounded corner');
  for (let step = 0; step <= 100; step += 1) {
    const fraction = step / 100;
    const point = { x: cornerStart.x + (cornerWaypoint.x - cornerStart.x) * fraction,
      y: cornerStart.y + (cornerWaypoint.y - cornerStart.y) * fraction };
    const nearestX = Math.max(corner.x, Math.min(corner.x + corner.width, point.x));
    const nearestY = Math.max(corner.y, Math.min(corner.y + corner.height, point.y));
    assert.ok(Math.hypot(point.x - nearestX, point.y - nearestY) >= 22 - 1e-7);
  }
  const frozenStart = Object.freeze({ x: 138, y: 270 });
  const frozenTarget = Object.freeze({ x: 800, y: 270 });
  nextWaypoint(frozenStart, frozenTarget, Object.freeze([Object.freeze({ ...obstacle })]));
  const blockedTarget = { x: 480, y: 270 };
  const reachable = nextWaypoint({ x: 400, y: 270 }, blockedTarget, [obstacle], 65);
  assert.ok(Math.abs(reachable.x - 418) < 1e-6);
  assert.equal(reachable.y, 270);
  assert.ok(Math.hypot(reachable.x - blockedTarget.x, reachable.y - blockedTarget.y) <= 65);
  assert.throws(() => nextWaypoint({ x: 400, y: 270 }, blockedTarget, [obstacle], 10), /no-route/i);
  assert.throws(() => nextWaypoint({ x: 138, y: 270 }, straight,
    [{ x: 440, y: 99, width: 80, height: 409 }]), /no-route/i);
  assert.throws(() => nextWaypoint({ x: 32, y: 270 }, straight, []), /bounds/i);
  assert.throws(() => nextWaypoint(blockedTarget, straight, [obstacle]), /no-route/i);
  for (const invalid of [null, {}, { x: NaN, y: 270 }, { x: 138, y: Infinity }]) {
    assert.throws(() => nextWaypoint(invalid, straight, []), /finite/i);
    assert.throws(() => nextWaypoint({ x: 138, y: 270 }, invalid, []), /finite/i);
  }
  assert.throws(() => nextWaypoint({ x: 138, y: 270 }, straight, null), /barriers/i);
  for (const invalid of [null, {}, { ...obstacle, width: -1 }, { ...obstacle, height: 0 },
    { ...obstacle, x: Infinity }, { ...obstacle, x: Number.MAX_VALUE, width: Number.MAX_VALUE }]) {
    assert.throws(() => nextWaypoint({ x: 138, y: 270 }, straight, [invalid]), /barrier/i);
  }
  for (const tolerance of [-1, NaN, Infinity, '45']) {
    assert.throws(() => nextWaypoint({ x: 138, y: 270 }, straight, [], tolerance), /tolerance/i);
  }
  console.log('campaign-navigation selfcheck: PASS');
}
