/**
 * PropertyVisualizer — interactive 3-D property build modeler.
 *
 * Renders a Three.js canvas via React Three Fiber showing:
 *   • A ground plane sized to the parcel square footage
 *   • An optional aerial satellite image texture on the ground
 *   • A configurable 3-D structure (driveway overlay, building shell, addition)
 *   • Orbit controls so customers can rotate, zoom, and pan freely
 *
 * All visual options (material, color, build type, dimensions) are driven by
 * the `config` prop from BuildConfigurator so changes update instantly.
 */
/* eslint-disable react/no-unknown-property */
import { Suspense, useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, Text } from '@react-three/drei'
import * as THREE from 'three'

// ── Colour palette keyed by material name ────────────────────────────────────
const MATERIAL_COLORS = {
  asphalt:     '#2d2d2d',
  concrete:    '#b0aca4',
  cobblestone: '#7a6a58',
  pavers:      '#c8a87a',
  gravel:      '#9a9080',
}

const STRUCTURE_COLORS = {
  brick:        '#b5563c',
  stucco:       '#e8dcc8',
  hardieplank:  '#5a7fa0',
  vinyl:        '#e8e4dc',
  stone:        '#7a7062',
}

// ── Helper: convert sqft to approximate world-space dims (1 unit = 10 ft) ────
function sqftToDims(sqft) {
  // Try to keep a 4:3 aspect ratio for the lot
  const area  = Math.max(sqft, 400)
  const width = Math.sqrt(area * (4 / 3)) / 10
  const depth = Math.sqrt(area * (3 / 4)) / 10
  return { width, depth }
}

// ── Ground plane with optional texture ───────────────────────────────────────
function GroundPlane({ width, depth, materialType, aerialUrl }) {
  const color    = MATERIAL_COLORS[materialType] ?? '#4a7c45'
  const texture  = useMemo(() => {
    if (!aerialUrl) return null
    const loader = new THREE.TextureLoader()
    return loader.load(aerialUrl)
  }, [aerialUrl])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial
        color={aerialUrl ? '#ffffff' : color}
        map={texture}
        roughness={0.9}
        metalness={0.05}
      />
    </mesh>
  )
}

// ── Driveway overlay strip ───────────────────────────────────────────────────
function DrivewayOverlay({ groundWidth, groundDepth, materialType }) {
  const color = MATERIAL_COLORS[materialType] ?? MATERIAL_COLORS.asphalt
  const driveWidth = Math.min(groundWidth * 0.28, 3.0)

  return (
    <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[driveWidth, groundDepth * 0.85]} />
      <meshStandardMaterial color={color} roughness={0.95} metalness={0.0} />
    </mesh>
  )
}

// ── Building shell ───────────────────────────────────────────────────────────
function BuildingShell({ sqft, floors, exteriorMaterial, roofColor }) {
  const { width, depth } = sqftToDims(sqft / Math.max(floors, 1))
  const w    = Math.min(width,  8)
  const d    = Math.min(depth,  6)
  const h    = floors * 1.4
  const wall = STRUCTURE_COLORS[exteriorMaterial] ?? STRUCTURE_COLORS.brick
  const roof = roofColor ?? '#4a4a4a'

  return (
    <group position={[0, h / 2, 0]}>
      {/* Walls */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={wall} roughness={0.85} />
      </mesh>
      {/* Roof ridge */}
      <mesh position={[0, h / 2 + 0.4, 0]} castShadow>
        <boxGeometry args={[w * 1.05, 0.8, d * 1.05]} />
        <meshStandardMaterial color={roof} roughness={0.9} />
      </mesh>
    </group>
  )
}

// ── Addition block ───────────────────────────────────────────────────────────
function AdditionBlock({ sqft, floors, exteriorMaterial }) {
  const { width, depth } = sqftToDims(sqft / Math.max(floors, 1))
  const w    = Math.min(width * 0.55, 4)
  const d    = Math.min(depth * 0.55, 3.5)
  const h    = floors * 1.2
  const wall = STRUCTURE_COLORS[exteriorMaterial] ?? STRUCTURE_COLORS.brick

  return (
    <group position={[-(w / 2 + 1.5), h / 2, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={wall} roughness={0.85} />
      </mesh>
    </group>
  )
}

// ── Parking lot grid ─────────────────────────────────────────────────────────
function ParkingLot({ groundWidth, groundDepth, materialType }) {
  const color     = MATERIAL_COLORS[materialType] ?? MATERIAL_COLORS.asphalt
  const stalls    = Math.floor((groundWidth * groundDepth) / 2.5)
  const stallW    = 0.55
  const stallD    = 1.1
  const cols      = Math.max(Math.floor(groundWidth / (stallW + 0.08)), 1)
  const rows      = Math.ceil(stalls / cols)
  const startX    = -(cols * (stallW + 0.08)) / 2 + stallW / 2
  const startZ    = -(rows * (stallD + 0.06)) / 2 + stallD / 2

  return (
    <group>
      {/* Lot surface */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[groundWidth * 0.9, groundDepth * 0.9]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {/* Stall stripes */}
      {Array.from({ length: Math.min(stalls, 80) }).map((_, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        return (
          <mesh
            key={i}
            position={[startX + col * (stallW + 0.08), 0.01, startZ + row * (stallD + 0.06)]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[stallW, 0.03]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        )
      })}
    </group>
  )
}

// ── Label floating above the scene ───────────────────────────────────────────
function SceneLabel({ text, y }) {
  return (
    <Text
      position={[0, y, 0]}
      fontSize={0.35}
      color="#1a1a2e"
      anchorX="center"
      anchorY="middle"
      font={undefined}
    >
      {text}
    </Text>
  )
}

// ── Animated sun helper ───────────────────────────────────────────────────────
function AnimatedLight() {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime() * 0.15
    ref.current.position.x = Math.sin(t) * 12
    ref.current.position.z = Math.cos(t) * 8
  })
  return (
    <directionalLight
      ref={ref}
      position={[8, 10, 6]}
      intensity={1.4}
      castShadow
      shadow-mapSize={[1024, 1024]}
    />
  )
}

// ── Scene root ───────────────────────────────────────────────────────────────
function Scene({ config }) {
  const {
    buildType    = 'driveway',
    sqft         = 2000,
    groundMaterial   = 'asphalt',
    exteriorMaterial = 'brick',
    roofColor        = '#4a4a4a',
    floors           = 1,
    aerialUrl        = null,
  } = config

  const { width: gw, depth: gd } = sqftToDims(sqft)
  const groundY = -0.01

  const label = `${sqft.toLocaleString()} sq ft · ${buildType.replace(/_/g, ' ')}`

  return (
    <>
      <ambientLight intensity={0.5} />
      <AnimatedLight />

      {/* Ground */}
      <group position={[0, groundY, 0]}>
        <GroundPlane
          width={gw}
          depth={gd}
          materialType={buildType === 'driveway' ? groundMaterial : 'grass'}
          aerialUrl={aerialUrl}
        />
      </group>

      {/* Build overlay based on type */}
      {buildType === 'driveway' && (
        <DrivewayOverlay
          groundWidth={gw}
          groundDepth={gd}
          materialType={groundMaterial}
        />
      )}
      {buildType === 'parking_lot' && (
        <ParkingLot
          groundWidth={gw}
          groundDepth={gd}
          materialType={groundMaterial}
        />
      )}
      {(buildType === 'new_construction_residential' || buildType === 'commercial_build') && (
        <BuildingShell
          sqft={sqft}
          floors={floors}
          exteriorMaterial={exteriorMaterial}
          roofColor={roofColor}
        />
      )}
      {buildType === 'addition' && (
        <>
          <BuildingShell
            sqft={sqft * 0.65}
            floors={floors}
            exteriorMaterial={exteriorMaterial}
            roofColor={roofColor}
          />
          <AdditionBlock
            sqft={sqft * 0.35}
            floors={floors}
            exteriorMaterial={exteriorMaterial}
          />
        </>
      )}
      {buildType === 'adu' && (
        <BuildingShell
          sqft={sqft}
          floors={floors}
          exteriorMaterial={exteriorMaterial}
          roofColor={roofColor}
        />
      )}

      {/* Reference grid */}
      <Grid
        position={[0, groundY - 0.005, 0]}
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.3}
        cellColor="#c0c0c0"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#a0a0a0"
        fadeDistance={30}
        fadeStrength={1}
        infiniteGrid
      />

      {/* Floating label */}
      <SceneLabel text={label} y={(floors + 1) * 1.5 + 0.5} />

      {/* Camera controls */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={3}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2.05}
      />

      <Environment preset="city" />
    </>
  )
}

// ── Public component ─────────────────────────────────────────────────────────
export default function PropertyVisualizer({ config = {}, className = '' }) {
  return (
    <div className={`w-full rounded-2xl overflow-hidden shadow-xl border border-brand-navy/10 bg-brand-navy/5 ${className}`} style={{ height: 420 }}>
      <Canvas
        shadows
        camera={{ position: [8, 7, 10], fov: 45, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'linear-gradient(180deg, #dbeafe 0%, #f0fdf4 100%)' }}
      >
        <Suspense fallback={null}>
          <Scene config={config} />
        </Suspense>
      </Canvas>
    </div>
  )
}
