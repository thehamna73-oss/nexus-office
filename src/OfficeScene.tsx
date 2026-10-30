import { Billboard, Html, Line, RoundedBox } from '@react-three/drei'
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { copy } from './config'
import { findPath } from './pathfinding'
import { useOfficeStore } from './store'

const wood = '#d9b382'
const sage = '#8fb0a0'
const floor = '#f3f1ec'
const EMPTY_PATH: THREE.Vector3[] = []

function Box({ position, scale, color, radius = 0, ...props }: {
  position: [number, number, number]; scale: [number, number, number]; color: string; radius?: number
  transparent?: boolean; opacity?: number; [key: string]: unknown
}) {
  const { transparent = false, opacity = 1, ...meshProps } = props
  if (radius) return <RoundedBox position={position} args={scale} radius={radius} smoothness={2} castShadow receiveShadow {...props}>
    <meshStandardMaterial color={color} roughness={0.78} transparent={transparent} opacity={opacity} />
  </RoundedBox>
  return <mesh position={position} scale={scale} castShadow receiveShadow {...meshProps}>
    <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={color} roughness={0.78} transparent={transparent} opacity={opacity} />
  </mesh>
}

function Sign({ children, position, color = sage, size = 0.62 }: { children: string; position: [number, number, number]; color?: string; size?: number }) {
  return <Html position={position} center distanceFactor={12} transform occlude={false} zIndexRange={[0, 0]}>
    <div className="world-sign" style={{ backgroundColor: color, fontSize: `${size}rem` }}>{children}</div>
  </Html>
}

function Label({ text, color = '#365747' }: { text: string; color?: string }) {
  return <Billboard follow position={[0, 1.65, 0]}>
    <Html center distanceFactor={10} transform occlude={false} zIndexRange={[0, 0]}>
      <div className="person-label" style={{ background: color }}>{text}<span /></div>
    </Html>
  </Billboard>
}

function Plant({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return <group position={position} scale={scale}>
    <mesh position={[0, 0.28, 0]} castShadow><cylinderGeometry args={[0.22, 0.28, 0.55, 7]} /><meshStandardMaterial color="#c98962" roughness={0.9} /></mesh>
    <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.25, 0.27, 0.08, 7]} /><meshStandardMaterial color="#a66c4e" /></mesh>
    {[0, 1, 2, 3, 4].map((leaf) => <mesh key={leaf} position={[Math.cos(leaf * 1.25) * 0.2, 0.9 + (leaf % 2) * 0.13, Math.sin(leaf * 1.25) * 0.2]} rotation={[0.2, leaf * 1.25, -Math.cos(leaf * 1.25) * 0.38]} castShadow>
      <coneGeometry args={[0.17, 0.85, 5]} /><meshStandardMaterial color={leaf % 2 ? '#3d7755' : '#2f5d45'} roughness={0.85} />
    </mesh>)}
  </group>
}

function Person({ visitor = false, receptionist = false, employeeIndex }: { visitor?: boolean; receptionist?: boolean; employeeIndex?: number }) {
  const group = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const walking = useRef(false)
  const path = useOfficeStore((s) => receptionist ? s.receptionistPath : visitor ? s.visitorPath : EMPTY_PATH)
  const stage = useOfficeStore((s) => s.stage)
  const store = useOfficeStore
  const index = useRef(0)
  const target = useRef(new THREE.Vector3())
  const goalReached = useRef(false)
  const clock = useRef(0)
  const initialPosition = useMemo(() => {
    if (receptionist) return store.getState().receptionistPosition.clone()
    if (visitor) return store.getState().visitorPosition.clone()
    const employeePositions = [-4, -1, 2, 4]
    return new THREE.Vector3(employeePositions[employeeIndex ?? 0], 0.1, -2.15)
  }, [])
  const origin = useMemo(() => initialPosition.clone(), [])

  useEffect(() => {
    if (group.current) group.current.position.copy(initialPosition)
  }, [])

  useEffect(() => {
    index.current = 0
    goalReached.current = false
    if (path.length) target.current.copy(path[0])
  }, [path])

  useFrame((_, delta) => {
    const obj = group.current
    if (!obj) return
    clock.current += delta
    const currentPath = receptionist ? store.getState().receptionistPath : visitor ? store.getState().visitorPath : EMPTY_PATH
    if (currentPath.length && index.current < currentPath.length) {
      const desired = currentPath[index.current]
      const dx = desired.x - obj.position.x
      const dz = desired.z - obj.position.z
      const distance = Math.hypot(dx, dz)
      walking.current = distance > 0.08
      if (walking.current) {
        const speed = receptionist ? 3.6 : 4
        const step = Math.min(distance, delta * speed)
        obj.position.x += (dx / distance) * step
        obj.position.z += (dz / distance) * step
        obj.rotation.y = Math.atan2(dx, dz)
      } else {
        index.current += 1
      }
      if (walking.current && visitor) store.getState().visitorPosition.set(obj.position.x, 0, obj.position.z)
      if (walking.current && receptionist) store.getState().receptionistPosition.set(obj.position.x, 0, obj.position.z)
      if (index.current >= currentPath.length && !goalReached.current && (visitor || receptionist)) {
        goalReached.current = true
        if (receptionist) {
          window.setTimeout(() => {
            if (store.getState().stage === 'guided') {
              const end = store.getState().visitorPath
              if (!end.length) store.getState().arrive()
            }
          }, 300)
        } else {
          window.setTimeout(() => {
            const state = store.getState()
            if (state.stage === 'intro') state.beginReception()
            else if (state.stage === 'guided') state.arrive()
          }, 280)
        }
      }
    } else {
      walking.current = false
      if (receptionist && !path.length && stage !== 'guided') obj.position.lerp(origin, Math.min(1, delta * 4))
    }

    const stride = walking.current ? Math.sin(clock.current * 10) : 0
    if (legL.current) legL.current.rotation.x = stride * 0.48
    if (legR.current) legR.current.rotation.x = -stride * 0.48
    if (armL.current) armL.current.rotation.x = walking.current ? -stride * 0.32 : Math.sin(clock.current * (employeeIndex === undefined ? 1.7 : 4.2)) * (employeeIndex === undefined ? 0.025 : 0.12)
    if (armR.current) armR.current.rotation.x = walking.current ? stride * 0.32 : Math.sin(clock.current * (employeeIndex === undefined ? 1.7 : 4.2) + 1) * (employeeIndex === undefined ? 0.025 : 0.12)
    obj.position.y = Math.abs(stride) * 0.035
  })

  return <group ref={group} position={initialPosition.toArray()}>
    {visitor && <Label text="YOU" />}
    {receptionist && stage === 'guided' && <Label text="RECEPTIONIST" color="#f8f6f0" />}
    <mesh position={[0, 0.42, 0]} castShadow><capsuleGeometry args={[0.19, 0.47, 3, 7]} /><meshStandardMaterial color={visitor ? '#497db0' : '#313b3a'} roughness={0.85} /></mesh>
    <mesh position={[0, 0.94, 0]} castShadow><sphereGeometry args={[0.19, 9, 7]} /><meshStandardMaterial color="#e3b995" roughness={0.9} /></mesh>
    <mesh position={[0, 1.08, -0.035]} castShadow><sphereGeometry args={[0.195, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.45]} /><meshStandardMaterial color={visitor ? '#3b302b' : '#282d2c'} /></mesh>
    <group ref={armL} position={[-0.22, 0.63, 0]}><mesh position={[0, -0.19, 0]} castShadow><capsuleGeometry args={[0.07, 0.28, 3, 5]} /><meshStandardMaterial color={visitor ? '#497db0' : '#313b3a'} /></mesh></group>
    <group ref={armR} position={[0.22, 0.63, 0]}><mesh position={[0, -0.19, 0]} castShadow><capsuleGeometry args={[0.07, 0.28, 3, 5]} /><meshStandardMaterial color={visitor ? '#497db0' : '#313b3a'} /></mesh></group>
    <group ref={legL} position={[-0.11, 0.19, 0]}><mesh position={[0, -0.12, 0.01]} castShadow><capsuleGeometry args={[0.075, 0.2, 2, 5]} /><meshStandardMaterial color="#30383a" /></mesh></group>
    <group ref={legR} position={[0.11, 0.19, 0]}><mesh position={[0, -0.12, 0.01]} castShadow><capsuleGeometry args={[0.075, 0.2, 2, 5]} /><meshStandardMaterial color="#30383a" /></mesh></group>
    {receptionist && stage !== 'guided' && <mesh position={[0, 0.97, 0.18]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.07, 0.014, 4, 8]} /><meshStandardMaterial color="#d9b382" /></mesh>}
  </group>
}

function DeskSet() {
  const desks: [number, number, number][] = [
    [-4.3, 0, -3.2], [-1.6, 0, -3.2], [1.4, 0, -3.2], [4.1, 0, -3.2],
    [-4.3, 0, -0.2], [-1.6, 0, -0.2], [1.4, 0, -0.2], [4.1, 0, -0.2],
  ]
  const { tops, legs, screens, chairs } = useMemo(() => {
    const make = (locations: [number, number, number][], size: [number, number, number], offset: [number, number, number]) => {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color: '#d9b382', roughness: 0.8 }), locations.length)
      const matrix = new THREE.Matrix4()
      locations.forEach((p, i) => { matrix.makeTranslation(p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]); mesh.setMatrixAt(i, matrix) })
      mesh.instanceMatrix.needsUpdate = true
      mesh.castShadow = true
      mesh.receiveShadow = true
      return mesh
    }
    const legPoints = desks.flatMap(([x, y, z]) => [[x - 0.82, y + 0.43, z - 0.52], [x + 0.82, y + 0.43, z - 0.52], [x - 0.82, y + 0.43, z + 0.52], [x + 0.82, y + 0.43, z + 0.52]] as [number, number, number][])
    const seatPoints = desks.map(([x, y, z]) => [x, y + 0.3, z + 1.05] as [number, number, number])
    return {
      tops: make(desks, [1.9, 0.14, 1.25], [0, 1.05, 0]),
      legs: make(legPoints, [0.09, 0.86, 0.09], [0, 0, 0]),
      screens: desks.map(([x, y, z]) => ({ x, y, z })),
      chairs: make(seatPoints, [0.72, 0.15, 0.7], [0, 0, 0]),
    }
  }, [])
  return <group>
    <primitive object={tops} /><primitive object={legs} /><primitive object={chairs} />
    {screens.map(({ x, y, z }, i) => <group key={i} position={[x, y, z]}>
      <mesh position={[0, 1.48, -0.24]} castShadow><boxGeometry args={[0.82, 0.58, 0.07]} /><meshStandardMaterial color="#253332" roughness={0.45} /></mesh>
      <mesh position={[0, 1.47, -0.195]}><planeGeometry args={[0.7, 0.46]} /><meshStandardMaterial color={i % 3 === 0 ? '#91b8a8' : '#526865'} emissive={i % 3 === 0 ? '#354c43' : '#243231'} /></mesh>
      <mesh position={[0, 1.15, -0.22]}><boxGeometry args={[0.08, 0.24, 0.08]} /><meshStandardMaterial color="#394440" /></mesh>
    </group>)}
  </group>
}

function Room({ x, z, width, depth, title, tint = '#e9e5dc' }: { x: number; z: number; width: number; depth: number; title: string; tint?: string }) {
  const front = z + depth / 2
  const back = z - depth / 2
  const left = x - width / 2
  const right = x + width / 2
  return <group>
    <Box position={[x, 0.04, z]} scale={[width, 0.08, depth]} color={tint} />
    {[left, right].flatMap((edgeX) => [front, back].map((edgeZ) =>
      <Box key={`${edgeX}-${edgeZ}`} position={[edgeX, 1.05, edgeZ]} scale={[0.075, 2.05, 0.075]} color="#35433e" />,
    ))}
    <Box position={[x, 1.05, front]} scale={[width, 0.075, 0.075]} color="#35433e" />
    <Box position={[x, 1.05, back]} scale={[width, 0.075, 0.075]} color="#35433e" />
    <Box position={[left, 1.05, z]} scale={[0.075, 0.075, depth]} color="#35433e" />
    <Box position={[right, 1.05, z]} scale={[0.075, 0.075, depth]} color="#35433e" />
    <Box position={[x, 1.04, front]} scale={[width - 0.15, 1.88, 0.025]} color="#c6d9d0" transparent opacity={0.2} />
    <Box position={[x, 1.04, back]} scale={[width - 0.15, 1.88, 0.025]} color="#c6d9d0" transparent opacity={0.2} />
    <Box position={[left, 1.04, z]} scale={[0.025, 1.88, depth - 0.15]} color="#c6d9d0" transparent opacity={0.2} />
    <Box position={[right, 1.04, z]} scale={[0.025, 1.88, depth - 0.15]} color="#c6d9d0" transparent opacity={0.2} />
    <Sign position={[x, 2.18, front + 0.05]}>{title.toUpperCase()}</Sign>
  </group>
}

function OfficeBuilding({ finale, arrived }: { finale: boolean; arrived: boolean }) {
  const cars = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (cars.current) cars.current.children.forEach((car, index) => {
      car.position.x += delta * (index === 1 ? -1.2 : 0.84)
      if (car.position.x > 13) car.position.x = -13
      if (car.position.x < -13) car.position.x = 13
    })
    if (doors.current) {
      const amount = THREE.MathUtils.damp(doors.current.children[0].rotation.y, arrived ? -0.85 : 0, 3.2, delta)
      doors.current.children[0].rotation.y = amount
      doors.current.children[1].rotation.y = -amount
    }
  })
  const doors = useRef<THREE.Group>(null)
  return <group>
    <Box position={[0, -0.18, 0]} scale={[21, 0.3, 15]} color={floor} radius={0.12} />
    <Box position={[0, -0.28, 0]} scale={[21.3, 0.2, 15.3]} color="#d8d5cb" radius={0.12} />
    {/* Low rear cutaway walls frame the diorama without hiding the interiors. */}
    <Box position={[-10.35, 1.25, 0]} scale={[0.3, 2.5, 15]} color="#d8d4c9" />
    <Box position={[10.35, 1.25, 0]} scale={[0.3, 2.5, 15]} color="#d8d4c9" />
    <Box position={[-6.3, 1.25, -7.35]} scale={[8.1, 2.5, 0.3]} color="#d8d4c9" />
    <Box position={[6.3, 1.25, -7.35]} scale={[8.1, 2.5, 0.3]} color="#d8d4c9" />
    <Box position={[0, 0.02, -10.1]} scale={[29, 0.24, 4.1]} color="#3f4846" />
    <Box position={[0, 0.04, -7.95]} scale={[29, 0.14, 0.75]} color="#c4c0b3" />
    <Box position={[0, 0.14, -12.35]} scale={[29, 0.5, 0.25]} color="#527558" />
    {[-11, -7, -3, 1, 5, 9].map((x) => <Box key={x} position={[x, 0.17, -10.1]} scale={[1.3, 0.015, 0.1]} color="#efe8cf" />)}
    <group ref={cars}>
      {[
        { x: -9, z: -9.45, color: '#b55c4d', dir: 0 },
        { x: 2, z: -10.75, color: '#f5f2e9', dir: Math.PI },
        { x: 10, z: -9.45, color: '#303737', dir: 0 },
      ].map((car, i) => <group key={i} position={[car.x, 0, car.z]} rotation={[0, car.dir, 0]}>
        <Box position={[0, 0.32, 0]} scale={[2.05, 0.46, 0.92]} color={car.color} radius={0.16} />
        <Box position={[0.05, 0.62, 0]} scale={[1.02, 0.38, 0.73]} color={car.color} radius={0.14} />
        {[-0.63, 0.63].map((x) => <mesh key={x} position={[x, 0.65, 0.38]}><planeGeometry args={[0.38, 0.21]} /><meshStandardMaterial color="#9ab4b1" /></mesh>)}
        {[-0.67, 0.67].map((x) => <mesh key={x} position={[x, 0.13, 0.4]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.22, 0.22, 0.12, 10]} /><meshStandardMaterial color="#202625" /></mesh>)}
      </group>)}
    </group>
    {[-8, -3, 4, 9].map((x, i) => <group key={x} position={[x, 0, -13]}>
      <mesh position={[0, 1.3 + (i % 2) * 0.25, 0]} castShadow><cylinderGeometry args={[0.1, 0.14, 2.6, 6]} /><meshStandardMaterial color="#795f49" /></mesh>
      {[0, 1, 2, 3].map((leaf) => <mesh key={leaf} position={[Math.cos(leaf * 1.57) * 0.54, 2 + (leaf % 2) * 0.28, Math.sin(leaf * 1.57) * 0.54]} castShadow><icosahedronGeometry args={[0.88, 0]} /><meshStandardMaterial color={i % 2 ? '#557957' : '#638665'} roughness={1} /></mesh>)}
    </group>)}
    {[-8.3].map((x) => <group key={x} position={[x, 0, -7.15]}>
      <Box position={[0, 0.44, 0]} scale={[1.75, 0.88, 1.75]} color="#dfd5c0" radius={0.12} />
      <Box position={[0, 1.02, 0]} scale={[1.85, 0.3, 1.85]} color="#648466" radius={0.1} />
      <Sign position={[0, 1.48, 0]} color="#527558">{copy.securitySign}</Sign>
      <Box position={[0, 0.52, 0.9]} scale={[0.8, 0.45, 0.03]} color="#b4c6b6" />
    </group>)}
    {/* Entry stair and the welcoming exterior rail sign. */}
    {[-9.15, -8.5, -7.85, -7.2].map((z, i) => <Box key={z} position={[0, 0.08 + i * 0.13, z]} scale={[2.9, 0.16, 0.66]} color="#d7d0c3" />)}
    {[-1.8, 1.8].map((x) => <group key={x}>
      <Box position={[x, 0.8, -7.7]} scale={[0.07, 1.5, 0.07]} color="#293330" />
      <Box position={[x, 1.45, -8.35]} scale={[0.07, 0.07, 1.3]} color="#293330" />
    </group>)}
    <Box position={[-3.55, 1.35, -7.55]} scale={[3.8, 0.75, 0.14]} color={sage} radius={0.05} />
    <Sign position={[-3.55, 1.39, -7.45]} size={0.72}>{copy.company}</Sign>
    <Room x={-6} z={-1.6} width={4.1} depth={4.1} title={copy.options[0]} />
    <Room x={6} z={-1.6} width={4.1} depth={4.1} title={copy.options[1]} />
    <Room x={-6} z={-5.75} width={4.1} depth={2.2} title={copy.options[2]} />
    <Room x={6} z={-5.75} width={4.1} depth={2.2} title={copy.options[3]} />
    <DeskSet />
    {/* Simple computers and chairs imply a lively open-plan team. */}
    {[-4, -1, 2, 4].map((_, i) => <Person key={`staff-${i}`} employeeIndex={i} />)}
    {/* Reception counter with slat detail, monitor, and flanking greenery. */}
    <Box position={[0, 0.72, 3.3]} scale={[4.5, 1.2, 1.15]} color={wood} radius={0.08} />
    <Box position={[0, 1.34, 3.3]} scale={[4.7, 0.13, 1.26]} color="#e4c69d" radius={0.04} />
    {Array.from({ length: 19 }, (_, i) => <Box key={i} position={[-2.08 + i * 0.23, 0.7, 3.88]} scale={[0.055, 0.92, 0.045]} color="#bd9468" />)}
    <Box position={[0, 1.05, 2.69]} scale={[2.3, 0.48, 0.08]} color={sage} radius={0.04} />
    <Sign position={[0, 1.07, 2.62]}>{copy.receptionSign}</Sign>
    <Person receptionist />
    <Box position={[0, 1.72, 2.5]} scale={[0.9, 0.64, 0.08]} color="#26312f" radius={0.03} />
    <Plant position={[-3.1, 0, 3.1]} scale={1.18} /><Plant position={[3.1, 0, 3.1]} scale={1.18} />
    {/* Green lounge nook and textured executive area. */}
    <Box position={[-8.3, 0.44, -3.2]} scale={[1.9, 0.78, 1]} color="#77917e" radius={0.18} />
    <Box position={[-8.3, 0.76, -3.65]} scale={[1.9, 0.95, 0.32]} color="#829b87" radius={0.14} />
    <Box position={[-8.3, 0.88, -2.65]} scale={[0.3, 0.86, 1.05]} color="#66816e" radius={0.12} />
    <group ref={doors} position={[0, 1.1, -6.1]}>
      <group position={[-1, 0, 0]}><Box position={[0.5, 0, 0]} scale={[1, 1.7, 0.1]} color="#9d704b" radius={0.04} /></group>
      <group position={[1, 0, 0]}><Box position={[-0.5, 0, 0]} scale={[1, 1.7, 0.1]} color="#ad8059" radius={0.04} /></group>
    </group>
    <Box position={[0, 2.2, -6.02]} scale={[2.5, 0.48, 0.14]} color={sage} radius={0.04} />
    <Sign position={[0, 2.22, -5.92]}>{copy.bossDoor.toUpperCase()}</Sign>
    <Box position={[0, 0.95, -5.25]} scale={[2.5, 0.17, 1.1]} color="#aa7d52" radius={0.04} />
    <Box position={[0, 0.54, -5.25]} scale={[0.13, 0.7, 0.13]} color="#79583b" />
    <Plant position={[8.4, 0, -4.7]} />
    <Box position={[-8.3, 1.5, -5.5]} scale={[1.5, 1.1, 0.12]} color="#bd9165" />
    {Array.from({ length: 5 }, (_, i) => <Box key={i} position={[-8.8 + i * 0.25, 1.74, -5.4]} scale={[0.15, 0.42 + (i % 2) * 0.18, 0.16]} color={['#6f8575', '#c48268', '#d2bc91'][i % 3]} />)}
    <Box position={[8.4, 1.5, -5.5]} scale={[1.5, 1.1, 0.12]} color="#bd9165" />
    <Box position={[-10.18, 1.9, -6.8]} scale={[0.12, 3.8, 0.12]} color="#252e2b" />
    <Line points={[[-10.18, 3.8, -6.8], [-10.18, 2.1, -12.2]]} color="#252e2b" lineWidth={2} />
    {finale && <Html position={[0, 4.2, 0]} center zIndexRange={[0, 0]}><div className="scene-kicker">{copy.company}</div></Html>}
  </group>
}

function WalkController() {
  const stage = useOfficeStore((s) => s.stage)
  const setPath = useOfficeStore((s) => s.setVisitorPath)
  const { camera } = useThree()
  const cameraTarget = useRef(new THREE.Vector3())
  const lookTarget = useRef(new THREE.Vector3())

  useEffect(() => {
    if (stage === 'intro') {
      setPath([
        new THREE.Vector3(-3.5, 0, -9),
        new THREE.Vector3(0, 0, -7.2),
        new THREE.Vector3(0, 0, -5.5),
        new THREE.Vector3(0, 0, 4.4),
      ])
    }
  }, [stage, setPath])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const direction: Record<string, [number, number]> = {
        w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1],
        a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0],
      }
      const vector = direction[event.key.toLowerCase()]
      if (!vector || useOfficeStore.getState().stage !== 'reception') return
      event.preventDefault()
      const current = useOfficeStore.getState().visitorPosition
      setPath(findPath(current, new THREE.Vector3(current.x + vector[0] * 1.5, 0, current.z + vector[1] * 1.5)))
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [setPath])

  useFrame((_, delta) => {
    const state = useOfficeStore.getState()
    const visitor = state.visitorPosition
    if (state.stage === 'finale') {
      cameraTarget.current.set(0, 40, -3)
      lookTarget.current.set(0, 0, -3)
    } else {
      cameraTarget.current.set(visitor.x + 6, 14, visitor.z + 9)
      lookTarget.current.set(visitor.x, 0.5, visitor.z)
    }
    camera.position.lerp(cameraTarget.current, 1 - Math.exp(-delta * (state.stage === 'finale' ? 1.2 : 2.1)))
    camera.lookAt(lookTarget.current)
  })

  const moveTo = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (useOfficeStore.getState().stage !== 'reception') return
    const point = event.point
    const destination = new THREE.Vector3(point.x, 0, point.z)
    setPath(findPath(useOfficeStore.getState().visitorPosition, destination))
  }, [setPath])

  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} onPointerDown={moveTo} receiveShadow>
      <planeGeometry args={[20.5, 14.5]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  </>
}

function SceneContents() {
  const stage = useOfficeStore((s) => s.stage)
  const arrived = useOfficeStore((s) => s.arrived)
  const finale = stage === 'finale'
  return <>
    <color attach="background" args={['#e9e7e0']} />
    <fog attach="fog" args={['#e9e7e0', 52, 92]} />
    <ambientLight intensity={0.78} color="#fff9ee" />
    <hemisphereLight args={['#fffdf7', '#a4a897', 0.55]} />
    <directionalLight position={[-8, 18, 10]} intensity={2.2} color="#fff3dc" />
    <directionalLight position={[8, 10, -8]} intensity={0.8} color="#c6d9d0" />
    <OfficeBuilding finale={finale} arrived={arrived} />
    <Person visitor />
    <WalkController />
  </>
}

export default function OfficeScene() {
  return <Canvas dpr={[0.65, 0.85]} camera={{ position: [7, 14, 12], fov: 36, near: 0.1, far: 100 }} gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}>
    <SceneContents />
  </Canvas>
}
