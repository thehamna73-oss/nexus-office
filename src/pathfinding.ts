import * as THREE from 'three'

const CELL = 0.5
const BOUNDS = { minX: -9.5, maxX: 9.5, minZ: -7.2, maxZ: 7.5 }
const furniture = [-4.3, -1.6, 1.4, 4.1].flatMap((x) =>
  [-3.2, -0.2].map((z) => ({ x, z, w: 2.25, d: 1.65 })),
)

const blocked = [
  { x: -7.5, z: 2.5, w: 2, d: 1.4 },
  { x: 0, z: 3.2, w: 4.2, d: 1.3 },
  { x: -6, z: -1.7, w: 2.8, d: 3.6 },
  { x: 6, z: -1.7, w: 2.8, d: 3.6 },
  { x: 0, z: -5.7, w: 3.6, d: 1.6 },
  { x: -3.2, z: -1.2, w: 1.1, d: 1.1 },
  { x: 3.2, z: -1.2, w: 1.1, d: 1.1 },
  { x: -8.3, z: -7.15, w: 1.9, d: 1.9 },
  { x: -8.3, z: -3.2, w: 2.2, d: 1.4 },
  ...furniture,
]

type Cell = { x: number; z: number; g: number; f: number; parent?: Cell }
const key = (x: number, z: number) => `${x},${z}`
const toCell = (v: number, min: number) => Math.round((v - min) / CELL)
const toWorld = (v: number, min: number) => min + v * CELL

function isBlocked(x: number, z: number) {
  const wx = toWorld(x, BOUNDS.minX)
  const wz = toWorld(z, BOUNDS.minZ)
  return blocked.some((obstacle) =>
    Math.abs(wx - obstacle.x) < obstacle.w / 2 + 0.2 &&
    Math.abs(wz - obstacle.z) < obstacle.d / 2 + 0.2,
  )
}

export function findPath(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] {
  const sx = toCell(THREE.MathUtils.clamp(start.x, BOUNDS.minX, BOUNDS.maxX), BOUNDS.minX)
  const sz = toCell(THREE.MathUtils.clamp(start.z, BOUNDS.minZ, BOUNDS.maxZ), BOUNDS.minZ)
  let ex = toCell(THREE.MathUtils.clamp(end.x, BOUNDS.minX, BOUNDS.maxX), BOUNDS.minX)
  let ez = toCell(THREE.MathUtils.clamp(end.z, BOUNDS.minZ, BOUNDS.maxZ), BOUNDS.minZ)
  const maxX = toCell(BOUNDS.maxX, BOUNDS.minX)
  const maxZ = toCell(BOUNDS.maxZ, BOUNDS.minZ)
  if (isBlocked(ex, ez)) {
    let nearest: [number, number] | undefined
    for (let radius = 1; radius <= 12 && !nearest; radius += 1) {
      for (let dx = -radius; dx <= radius && !nearest; dx += 1) {
        const dz = radius - Math.abs(dx)
        for (const candidateZ of dz === 0 ? [ez] : [ez - dz, ez + dz]) {
          const candidateX = ex + dx
          if (candidateX >= 0 && candidateX <= maxX && candidateZ >= 0 && candidateZ <= maxZ && !isBlocked(candidateX, candidateZ)) {
            nearest = [candidateX, candidateZ]
            break
          }
        }
      }
    }
    if (!nearest) return [start.clone()]
    ex = nearest[0]
    ez = nearest[1]
  }
  const open: Cell[] = [{ x: sx, z: sz, g: 0, f: Math.abs(ex - sx) + Math.abs(ez - sz) }]
  const seen = new Map<string, Cell>()
  const closed = new Set<string>()
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

  while (open.length) {
    open.sort((a, b) => a.f - b.f)
    const current = open.shift()!
    const currentKey = key(current.x, current.z)
    if (current.x === ex && current.z === ez) {
      const path: THREE.Vector3[] = []
      let step: Cell | undefined = current
      while (step) {
        path.push(new THREE.Vector3(toWorld(step.x, BOUNDS.minX), 0, toWorld(step.z, BOUNDS.minZ)))
        step = step.parent
      }
      return path.reverse()
    }
    closed.add(currentKey)
    for (const [dx, dz] of directions) {
      const x = current.x + dx
      const z = current.z + dz
      const nextKey = key(x, z)
      if (closed.has(nextKey) || x < 0 || z < 0 || x > maxX || z > maxZ || isBlocked(x, z)) continue
      const g = current.g + 1
      const prior = seen.get(nextKey)
      if (prior && prior.g <= g) continue
      const next: Cell = { x, z, g, f: g + Math.abs(ex - x) + Math.abs(ez - z), parent: current }
      seen.set(nextKey, next)
      open.push(next)
    }
  }
  return [start.clone()]
}
