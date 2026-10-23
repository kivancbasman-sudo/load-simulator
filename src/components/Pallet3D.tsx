import React, { useRef, useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Center, Text, Edges, Billboard } from '@react-three/drei';
import { PackedBox, Pallet, PalletResult, CenterOfGravity, Margins } from '../types';

interface Pallet3DProps {
  pallets: PalletResult[];
  activePalletId?: string;
  selectedBoxId?: string;
  hoveredBoxId?: string;
  onSelectBox: (box: PackedBox, palletId: string) => void;
  onHoverBox: (box: PackedBox | null) => void;
  showCoG: boolean;
  showRulers: boolean;
  showWireframe: boolean;
  maxVisibleSequence: number;
  maxVisibleLayer: number;
  cameraPreset: 'iso' | 'top' | 'front' | 'side';
  bgColor?: string;
  isManualMode?: boolean;
  onMoveBox?: (boxId: string, newPos: { x: number; y: number; z: number }) => void;
  onRotateBox?: (boxId: string) => void;
  onDeleteBox?: (boxId: string) => void;
  onDropToFloor?: (boxId: string) => void;
  snapToGrid?: boolean;
  snapStepMm?: number;
  magneticSnap?: boolean;
  autoStack?: boolean;
  cameraLock?: boolean;
}

// Realistic 3D Euro & Industrial Wood Pallet Model
const RealisticWoodenPallet = ({ width, depth }: { width: number; depth: number }) => {
  const woodColor = '#b3824f';
  const woodDark = '#986c3b';
  const woodLight = '#c59560';

  const deckThickness = 2.2; // 22mm
  const blockHeight = 7.8; // 78mm
  const totalPalletHeight = deckThickness * 2 + blockHeight; // ~122mm (~12.2cm)

  const numTopBoards = depth >= 90 ? 7 : 5;
  const boardWidth = (depth - 4) / numTopBoards - 1;

  return (
    <group position={[width / 2, -totalPalletHeight / 2, depth / 2]}>
      {/* 3 Bottom Runners / Skids */}
      {[-depth / 2 + 5, 0, depth / 2 - 5].map((zPos, idx) => (
        <mesh key={`bottom-skid-${idx}`} position={[0, -blockHeight / 2 - deckThickness / 2, zPos]}>
          <boxGeometry args={[width, deckThickness, 10]} />
          <meshStandardMaterial color={woodDark} roughness={0.9} />
          <Edges color="#5c3f20" threshold={20} />
        </mesh>
      ))}

      {/* 9 Wooden Spacer Blocks (Corner blocks + Center blocks) */}
      {[-width / 2 + 7, 0, width / 2 - 7].map((xPos, xIdx) =>
        [-depth / 2 + 7, 0, depth / 2 - 7].map((zPos, zIdx) => (
          <mesh key={`block-${xIdx}-${zIdx}`} position={[xPos, 0, zPos]}>
            <boxGeometry args={[12, blockHeight, 12]} />
            <meshStandardMaterial color={woodColor} roughness={0.85} />
            <Edges color="#5c3f20" threshold={20} />
          </mesh>
        ))
      )}

      {/* 3 Stringer Crossboards directly above blocks */}
      {[-width / 2 + 7, 0, width / 2 - 7].map((xPos, idx) => (
        <mesh key={`stringer-${idx}`} position={[xPos, blockHeight / 2 + deckThickness / 2, 0]}>
          <boxGeometry args={[12, deckThickness, depth]} />
          <meshStandardMaterial color={woodDark} roughness={0.9} />
          <Edges color="#5c3f20" threshold={20} />
        </mesh>
      ))}

      {/* Top Deck Boards */}
      {Array.from({ length: numTopBoards }).map((_, idx) => {
        const zPos = -depth / 2 + 3 + idx * (boardWidth + 1.2) + boardWidth / 2;
        const colorVar = idx % 2 === 0 ? woodLight : woodColor;
        return (
          <mesh key={`top-board-${idx}`} position={[0, blockHeight / 2 + deckThickness + deckThickness / 2, zPos]}>
            <boxGeometry args={[width, deckThickness, boardWidth]} />
            <meshStandardMaterial color={colorVar} roughness={0.8} />
            <Edges color="#5c3f20" threshold={20} />
          </mesh>
        );
      })}

      {/* Forklift Pocket Labels on Front */}
      <Billboard position={[0, -blockHeight / 2, depth / 2 + 1]}>
        <Text fontSize={3} color="#451a03" anchorX="center" anchorY="middle">
          FORK ENTRY
        </Text>
      </Billboard>

      {/* Pallet Floor Contact Shadow for separation against lighter floor */}
      <mesh position={[0, -totalPalletHeight / 2 - 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width + 8, depth + 8]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.25} />
      </mesh>
    </group>
  );
};

// Box mesh with chamfered appearance, face labels, 3D drag states, collision glow and selection badge
const BoxMesh = ({
  box,
  isSelected,
  isHovered,
  isDragging,
  isTransparent,
  isManualMode,
  hasCollision,
  hasOverhang,
  hasFloatingGap,
  onClick,
  onDoubleClick,
  onPointerDown,
  onPointerOver,
  onPointerOut
}: {
  box: PackedBox;
  isSelected: boolean;
  isHovered: boolean;
  isDragging: boolean;
  isTransparent: boolean;
  isManualMode: boolean;
  hasCollision?: boolean;
  hasOverhang?: boolean;
  hasFloatingGap?: boolean;
  onClick: (e: any) => void;
  onDoubleClick: (e: any) => void;
  onPointerDown: (e: any) => void;
  onPointerOver: (e: any) => void;
  onPointerOut: (e: any) => void;
}) => {
  const minDim = Math.min(box.width, box.height, box.depth);
  const fontSize = Math.max(2.5, Math.min(minDim / 3.5, 6));

  const hasIssue = isManualMode && (hasCollision || hasOverhang || hasFloatingGap);
  const edgeColor = hasIssue
    ? '#ef4444'
    : isDragging
    ? '#facc15'
    : isSelected
    ? '#38bdf8'
    : isHovered
    ? '#ffffff'
    : '#0f172a';

  return (
    <group position={[box.x + box.width / 2, box.y + box.height / 2, box.z + box.depth / 2]}>
      <mesh
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[box.width, box.height, box.depth]} />
        <meshStandardMaterial
          color={hasIssue ? '#ef4444' : box.color}
          roughness={0.5}
          metalness={0.1}
          transparent={isTransparent}
          opacity={isTransparent ? 0.35 : 1}
          emissive={hasIssue ? '#b91c1c' : isDragging ? '#facc15' : isSelected ? '#ffffff' : isHovered ? box.color : '#000000'}
          emissiveIntensity={hasIssue ? 0.6 : isDragging ? 0.45 : isSelected ? 0.35 : isHovered ? 0.2 : 0}
        />
        <Edges
          color={edgeColor}
          lineWidth={hasIssue ? 3.5 : isDragging ? 3 : isSelected ? 2.5 : 1}
          threshold={15}
        />

        {/* Top Face Label */}
        {box.height > 6 && !isTransparent && (
          <Text
            position={[0, box.height / 2 + 0.1, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={fontSize}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            maxWidth={box.width * 0.85}
          >
            {box.name}
          </Text>
        )}

        {/* Front Face Label */}
        {box.depth > 6 && !isTransparent && (
          <Text
            position={[0, 0, box.depth / 2 + 0.1]}
            fontSize={fontSize}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            maxWidth={box.width * 0.85}
          >
            {`${box.name} (#${box.sequenceNumber || 1})`}
          </Text>
        )}
      </mesh>

      {/* Manual Mode: Live Real-time Coordinate & Issue Badge above selected box */}
      {isManualMode && isSelected && (
        <Billboard position={[0, box.height / 2 + 6, 0]}>
          <Text
            fontSize={3.8}
            color={hasIssue ? '#ef4444' : isDragging ? '#facc15' : '#38bdf8'}
            outlineWidth={0.6}
            outlineColor="#09090b"
            fontWeight="bold"
            anchorX="center"
            anchorY="middle"
            lineHeight={1.3}
            textAlign="center"
          >
            {hasIssue
              ? `⚠️ ${hasCollision ? 'ÇAKIŞMA!' : hasOverhang ? 'TAŞMA!' : 'HAVADA KALIYOR (ALT DESTEK FARKLI)!'}\nX: ${Math.round(box.x * 10)} | Z: ${Math.round(box.z * 10)} | Y: ${Math.round(box.y * 10)} mm`
              : `X: ${Math.round(box.x * 10)} | Z: ${Math.round(box.z * 10)} | Y: ${Math.round(box.y * 10)} mm`}
          </Text>
        </Billboard>
      )}

      {/* Manual Mode: Floor shadow / footprint projection when dragging or selected */}
      {isManualMode && (isSelected || isDragging) && (
        <mesh position={[0, -box.height / 2 - box.y + 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[box.width, box.depth]} />
          <meshBasicMaterial color={hasIssue ? '#ef4444' : '#38bdf8'} transparent opacity={isDragging ? 0.45 : 0.18} />
          <Edges color={hasIssue ? '#ef4444' : '#38bdf8'} lineWidth={1.5} />
        </mesh>
      )}
    </group>
  );
};

// 3D Vertical Y-Axis Elevation Gizmo Handle
const VerticalYHandle = ({
  box,
  onPointerDown
}: {
  box: PackedBox;
  onPointerDown: (e: any) => void;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <group
      position={[box.x + box.width / 2, box.y + box.height + 1, box.z + box.depth / 2]}
      onPointerDown={onPointerDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        setIsHovered(true);
        document.body.style.cursor = 'ns-resize';
      }}
      onPointerOut={() => {
        setIsHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Stem */}
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 3.6, 12]} />
        <meshStandardMaterial
          color={isHovered ? '#fbbf24' : '#f59e0b'}
          emissive="#f59e0b"
          emissiveIntensity={isHovered ? 0.9 : 0.5}
        />
      </mesh>
      {/* Arrow Cone */}
      <mesh position={[0, 4.4, 0]}>
        <coneGeometry args={[1.3, 2.4, 16]} />
        <meshStandardMaterial
          color={isHovered ? '#fbbf24' : '#f59e0b'}
          emissive="#f59e0b"
          emissiveIntensity={isHovered ? 0.9 : 0.5}
        />
      </mesh>
      {/* Label */}
      <Billboard position={[0, 7.2, 0]}>
        <Text fontSize={3.2} color="#f59e0b" outlineWidth={0.5} outlineColor="#000000" fontWeight="bold">
          ▲ Y (Yükseklik)
        </Text>
      </Billboard>
    </group>
  );
};

// Center of Gravity 3D Gizmo
const CenterOfGravityMarker = ({
  cog,
  pallet
}: {
  cog: CenterOfGravity;
  pallet: Pallet;
}) => {
  const isBalanced = cog.deviationPercent <= 10;
  const cogColor = isBalanced ? '#22c55e' : cog.deviationPercent <= 18 ? '#eab308' : '#ef4444';

  return (
    <group position={[0, 0, 0]}>
      {/* Ideal Center Target on Pallet Floor */}
      <mesh position={[pallet.width / 2, 0.2, pallet.depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4, 5, 32]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Actual CoG Ground Target */}
      <mesh position={[cog.x, 0.3, cog.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6, 7.5, 32]} />
        <meshBasicMaterial color={cogColor} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Target Crosshairs */}
      <mesh position={[cog.x, 0.3, cog.z]}>
        <boxGeometry args={[18, 0.2, 0.8]} />
        <meshBasicMaterial color={cogColor} />
      </mesh>
      <mesh position={[cog.x, 0.3, cog.z]}>
        <boxGeometry args={[0.8, 0.2, 18]} />
        <meshBasicMaterial color={cogColor} />
      </mesh>

      {/* Vertical Plumb Line to 3D CoG Point */}
      <mesh position={[cog.x, cog.y / 2, cog.z]}>
        <cylinderGeometry args={[0.4, 0.4, Math.max(1, cog.y), 8]} />
        <meshBasicMaterial color={cogColor} transparent opacity={0.8} />
      </mesh>

      {/* 3D CoG Sphere */}
      <mesh position={[cog.x, cog.y, cog.z]}>
        <sphereGeometry args={[3.5, 24, 24]} />
        <meshStandardMaterial
          color={cogColor}
          emissive={cogColor}
          emissiveIntensity={0.6}
          roughness={0.2}
        />
      </mesh>

      {/* 3D Billboard Label */}
      <Billboard position={[cog.x, cog.y + 10, cog.z]}>
        <Text
          fontSize={5}
          color={cogColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.5}
          outlineColor="#09090b"
        >
          {`Ağırlık Merkezi (CoG)\n%${cog.deviationPercent} Sapma - ${cog.statusLabel}`}
        </Text>
      </Billboard>
    </group>
  );
};

// Edge Margin Measurement Rulers
const MarginsRuler = ({
  pallet,
  margins
}: {
  pallet: Pallet;
  margins: Margins;
}) => {
  return (
    <group position={[0, 0.5, 0]}>
      {/* Left Margin Dimension Line */}
      {margins.left > 0 && (
        <group position={[margins.left / 20, 0, pallet.depth / 2]}>
          <Billboard>
            <Text fontSize={4} color="#38bdf8" outlineWidth={0.4} outlineColor="#0f172a">
              {`Sol: ${margins.left} mm`}
            </Text>
          </Billboard>
        </group>
      )}

      {/* Right Margin Dimension Line */}
      {margins.right > 0 && (
        <group position={[pallet.width - margins.right / 20, 0, pallet.depth / 2]}>
          <Billboard>
            <Text fontSize={4} color="#38bdf8" outlineWidth={0.4} outlineColor="#0f172a">
              {`Sağ: ${margins.right} mm`}
            </Text>
          </Billboard>
        </group>
      )}

      {/* Front Margin Dimension Line */}
      {margins.front > 0 && (
        <group position={[pallet.width / 2, 0, margins.front / 20]}>
          <Billboard>
            <Text fontSize={4} color="#38bdf8" outlineWidth={0.4} outlineColor="#0f172a">
              {`Ön: ${margins.front} mm`}
            </Text>
          </Billboard>
        </group>
      )}

      {/* Back Margin Dimension Line */}
      {margins.back > 0 && (
        <group position={[pallet.width / 2, 0, pallet.depth - margins.back / 20]}>
          <Billboard>
            <Text fontSize={4} color="#38bdf8" outlineWidth={0.4} outlineColor="#0f172a">
              {`Arka: ${margins.back} mm`}
            </Text>
          </Billboard>
        </group>
      )}
    </group>
  );
};

// High-visibility Pallet Perimeter & Bounding Box System
const PalletBoundarySystem = ({ pallet }: { pallet: Pallet }) => {
  const { width, depth, height } = pallet;
  const cornerLen = Math.min(14, Math.min(width, depth) / 4);
  const cornerThick = 0.9;

  return (
    <group>
      {/* 1. PALLET GROUND PERIMETER / FOOTPRINT */}
      {/* Semi-transparent tint on pallet base area for crisp separation */}
      <mesh position={[width / 2, 0.25, depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>

      {/* Crisp Ground Perimeter Edges */}
      <group position={[width / 2, 0.3, depth / 2]}>
        <mesh>
          <boxGeometry args={[width, 0.4, depth]} />
          <meshBasicMaterial transparent opacity={0} />
          <Edges color="#38bdf8" threshold={1} lineWidth={2.5} />
        </mesh>
      </group>

      {/* 4 High-contrast L-shaped Corner Brackets at Base */}
      {/* Corner 1: (0, 0) */}
      <group position={[0, 0.4, 0]}>
        <mesh position={[cornerLen / 2, 0, cornerThick / 2]}>
          <boxGeometry args={[cornerLen, 0.4, cornerThick]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <mesh position={[cornerThick / 2, 0, cornerLen / 2]}>
          <boxGeometry args={[cornerThick, 0.4, cornerLen]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>

      {/* Corner 2: (width, 0) */}
      <group position={[width, 0.4, 0]}>
        <mesh position={[-cornerLen / 2, 0, cornerThick / 2]}>
          <boxGeometry args={[cornerLen, 0.4, cornerThick]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <mesh position={[-cornerThick / 2, 0, cornerLen / 2]}>
          <boxGeometry args={[cornerThick, 0.4, cornerLen]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>

      {/* Corner 3: (0, depth) */}
      <group position={[0, 0.4, depth]}>
        <mesh position={[cornerLen / 2, 0, -cornerThick / 2]}>
          <boxGeometry args={[cornerLen, 0.4, cornerThick]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <mesh position={[cornerThick / 2, 0, -cornerLen / 2]}>
          <boxGeometry args={[cornerThick, 0.4, cornerLen]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>

      {/* Corner 4: (width, depth) */}
      <group position={[width, 0.4, depth]}>
        <mesh position={[-cornerLen / 2, 0, -cornerThick / 2]}>
          <boxGeometry args={[cornerLen, 0.4, cornerThick]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <mesh position={[-cornerThick / 2, 0, -cornerLen / 2]}>
          <boxGeometry args={[cornerThick, 0.4, cornerLen]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>

      {/* Dimension Indicators at Ground Level */}
      <Billboard position={[width / 2, 0.6, depth + 8]}>
        <Text fontSize={4.5} color="#38bdf8" outlineWidth={0.6} outlineColor="#0f172a" fontWeight="bold">
          {`◄ ${Math.round(width * 10)} mm ►`}
        </Text>
      </Billboard>
      <Billboard position={[width + 8, 0.6, depth / 2]}>
        <Text fontSize={4.5} color="#38bdf8" outlineWidth={0.6} outlineColor="#0f172a" fontWeight="bold">
          {`◄ ${Math.round(depth * 10)} mm ►`}
        </Text>
      </Billboard>

      {/* 2. 3D PALLET VOLUME BOUNDS (Max Allowable Height) */}
      <group position={[width / 2, height / 2, depth / 2]}>
        {/* Subtle semi-transparent bounding envelope */}
        <mesh>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#0284c7" transparent opacity={0.05} />
        </mesh>
        {/* Crisp perimeter outline edges */}
        <Edges color="#38bdf8" threshold={15} lineWidth={2} />
      </group>

      {/* 4 Vertical Corner Guide Posts with High Visibility */}
      {[
        [0, 0],
        [width, 0],
        [0, depth],
        [width, depth]
      ].map(([cx, cz], idx) => (
        <group key={`corner-post-${idx}`} position={[cx, height / 2, cz]}>
          <mesh>
            <cylinderGeometry args={[0.35, 0.35, height, 6]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} />
          </mesh>
        </group>
      ))}

      {/* 3. Top Ceiling Max Height Frame */}
      <group position={[width / 2, height, depth / 2]}>
        <Billboard position={[0, 5, 0]}>
          <Text
            fontSize={4.5}
            color="#fbbf24"
            outlineWidth={0.6}
            outlineColor="#0f172a"
            fontWeight="bold"
            anchorX="center"
            anchorY="middle"
          >
            {`▲ AZAMİ YÜKSEKLİK: ${Math.round(height * 10)} mm`}
          </Text>
        </Billboard>
      </group>
    </group>
  );
};

// Single Pallet Assembly
const SinglePalletAssembly = ({
  palletResult,
  isSelectedBox,
  hoveredBoxId,
  selectedBoxId,
  onSelectBox,
  onHoverBox,
  showCoG,
  showRulers,
  showWireframe,
  maxVisibleSequence,
  maxVisibleLayer,
  isManualMode = false,
  onMoveBox,
  onRotateBox,
  snapToGrid = true,
  snapStepMm = 10,
  magneticSnap = true,
  autoStack = true,
  setOrbitEnabled,
  onDeleteBox,
  onDropToFloor
}: {
  palletResult: PalletResult;
  isSelectedBox: (id: string) => boolean;
  hoveredBoxId?: string;
  selectedBoxId?: string;
  onSelectBox: (box: PackedBox, palletId: string) => void;
  onHoverBox: (box: PackedBox | null) => void;
  showCoG: boolean;
  showRulers: boolean;
  showWireframe: boolean;
  maxVisibleSequence: number;
  maxVisibleLayer: number;
  isManualMode?: boolean;
  onMoveBox?: (boxId: string, newPos: { x: number; y: number; z: number }) => void;
  onRotateBox?: (boxId: string) => void;
  onDeleteBox?: (boxId: string) => void;
  onDropToFloor?: (boxId: string) => void;
  snapToGrid?: boolean;
  snapStepMm?: number;
  magneticSnap?: boolean;
  autoStack?: boolean;
  setOrbitEnabled?: (enabled: boolean) => void;
}) => {
  const { pallet, packedBoxes, centerOfGravity, margins } = palletResult;
  const { camera } = useThree();

  const [draggedBoxId, setDraggedBoxId] = useState<string | null>(null);
  const dragStateRef = useRef<{
    boxId: string;
    type: 'xz' | 'y';
    startBoxX: number;
    startBoxY: number;
    startBoxZ: number;
    worldPlane: THREE.Plane;
    startIntersect: THREE.Vector3;
    boxWidth: number;
    boxDepth: number;
    boxHeight: number;
  } | null>(null);

  // Global safety release on window pointerup
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (dragStateRef.current) {
        dragStateRef.current = null;
        setDraggedBoxId(null);
        setOrbitEnabled?.(true);
        document.body.style.cursor = 'auto';
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [setOrbitEnabled]);

  // Real-time collision, overhang, and floating detection map for manual mode
  const collisionMap = useMemo(() => {
    const map = new Map<string, { isCollision: boolean; isOverhang: boolean; isFloating: boolean }>();
    if (!isManualMode) return map;

    for (const b of packedBoxes) {
      let isCollision = false;
      for (const o of packedBoxes) {
        if (o.id === b.id) continue;
        const ox = b.x < o.x + o.width - 0.1 && b.x + b.width > o.x + 0.1;
        const oy = b.y < o.y + o.height - 0.1 && b.y + b.height > o.y + 0.1;
        const oz = b.z < o.z + o.depth - 0.1 && b.z + b.depth > o.z + 0.1;
        if (ox && oy && oz) {
          isCollision = true;
          break;
        }
      }
      const isOverhang = b.x < -0.1 || b.x + b.width > pallet.width + 0.1 || b.z < -0.1 || b.z + b.depth > pallet.depth + 0.1 || b.y + b.height > pallet.height + 0.1;

      // Check for floating gap (unsupported/uneven bottom surface)
      let isFloating = false;
      if (b.y > 0.1) {
        const underlying = packedBoxes.filter(o => {
          if (o.id === b.id) return false;
          const ox = b.x < o.x + o.width - 0.1 && b.x + b.width > o.x + 0.1;
          const oz = b.z < o.z + o.depth - 0.1 && b.z + b.depth > o.z + 0.1;
          return ox && oz && o.y + o.height <= b.y + 0.1;
        });

        if (underlying.length === 0) {
          isFloating = true;
        } else {
          const maxUnderlyingY = Math.max(...underlying.map(o => o.y + o.height));
          if (Math.abs(b.y - maxUnderlyingY) > 0.2) {
            isFloating = true;
          } else {
            for (const u of underlying) {
              if (Math.abs(u.y + u.height - maxUnderlyingY) > 0.5) {
                isFloating = true;
                break;
              }
            }
          }
        }
      }

      map.set(b.id, { isCollision, isOverhang, isFloating });
    }
    return map;
  }, [packedBoxes, pallet, isManualMode]);

  const handleBoxPointerDown = (box: PackedBox, e: any) => {
    onSelectBox(box, palletResult.id);
    if (!isManualMode || !onMoveBox) return;

    e.stopPropagation();
    setOrbitEnabled?.(false);
    document.body.style.cursor = 'grabbing';

    // Horizontal plane passing through hit point in world coords
    const worldPlane = new THREE.Plane();
    worldPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), e.point);

    const startIntersect = new THREE.Vector3();
    e.ray.intersectPlane(worldPlane, startIntersect);

    dragStateRef.current = {
      boxId: box.id,
      type: 'xz',
      startBoxX: box.x,
      startBoxY: box.y,
      startBoxZ: box.z,
      worldPlane,
      startIntersect,
      boxWidth: box.width,
      boxDepth: box.depth,
      boxHeight: box.height
    };
    setDraggedBoxId(box.id);
  };

  const handleYPointerDown = (box: PackedBox, e: any) => {
    e.stopPropagation();
    setOrbitEnabled?.(false);
    document.body.style.cursor = 'ns-resize';

    // Vertical plane facing the camera
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    camDir.normalize();

    const worldPlane = new THREE.Plane();
    worldPlane.setFromNormalAndCoplanarPoint(camDir, e.point);

    const startIntersect = new THREE.Vector3();
    e.ray.intersectPlane(worldPlane, startIntersect);

    dragStateRef.current = {
      boxId: box.id,
      type: 'y',
      startBoxX: box.x,
      startBoxY: box.y,
      startBoxZ: box.z,
      worldPlane,
      startIntersect,
      boxWidth: box.width,
      boxDepth: box.depth,
      boxHeight: box.height
    };
    setDraggedBoxId(box.id);
  };

  const handlePointerMove = (e: any) => {
    const state = dragStateRef.current;
    if (!state || !isManualMode || !onMoveBox) return;
    e.stopPropagation();

    if (state.type === 'xz') {
      const currentIntersect = new THREE.Vector3();
      if (e.ray.intersectPlane(state.worldPlane, currentIntersect)) {
        const deltaX = currentIntersect.x - state.startIntersect.x;
        const deltaZ = currentIntersect.z - state.startIntersect.z;

        let rawX = state.startBoxX + deltaX;
        let rawZ = state.startBoxZ + deltaZ;

        const stepCm = (snapStepMm || 10) / 10;
        if (snapToGrid) {
          rawX = Math.round(rawX / stepCm) * stepCm;
          rawZ = Math.round(rawZ / stepCm) * stepCm;
        } else {
          rawX = Math.round(rawX * 10) / 10;
          rawZ = Math.round(rawZ * 10) / 10;
        }

        // Tactile Magnetic Snapping to Pallet Edges and Adjacent Boxes
        if (magneticSnap) {
          const magnetDist = 2.5; // cm (25 mm)
          if (Math.abs(rawX) <= magnetDist) rawX = 0;
          if (Math.abs(rawX + state.boxWidth - pallet.width) <= magnetDist) rawX = pallet.width - state.boxWidth;
          if (Math.abs(rawZ) <= magnetDist) rawZ = 0;
          if (Math.abs(rawZ + state.boxDepth - pallet.depth) <= magnetDist) rawZ = pallet.depth - state.boxDepth;

          for (const other of packedBoxes) {
            if (other.id === state.boxId) continue;
            if (Math.abs(rawX - (other.x + other.width)) <= magnetDist) rawX = other.x + other.width;
            if (Math.abs(rawX + state.boxWidth - other.x) <= magnetDist) rawX = other.x - state.boxWidth;
            if (Math.abs(rawZ - (other.z + other.depth)) <= magnetDist) rawZ = other.z + other.depth;
            if (Math.abs(rawZ + state.boxDepth - other.z) <= magnetDist) rawZ = other.z - state.boxDepth;
            if (Math.abs(rawX - other.x) <= magnetDist) rawX = other.x;
            if (Math.abs(rawZ - other.z) <= magnetDist) rawZ = other.z;
          }
        }

        const clampedX = Math.max(0, Math.min(pallet.width - state.boxWidth, Math.round(rawX * 10) / 10));
        const clampedZ = Math.max(0, Math.min(pallet.depth - state.boxDepth, Math.round(rawZ * 10) / 10));

        let newY = state.startBoxY;
        if (autoStack) {
          let topY = 0;
          packedBoxes.forEach(other => {
            if (other.id === state.boxId) return;
            const overlapX = clampedX < other.x + other.width - 0.1 && clampedX + state.boxWidth > other.x + 0.1;
            const overlapZ = clampedZ < other.z + other.depth - 0.1 && clampedZ + state.boxDepth > other.z + 0.1;
            if (overlapX && overlapZ) {
              topY = Math.max(topY, other.y + other.height);
            }
          });
          newY = topY;
        }

        onMoveBox(state.boxId, { x: clampedX, y: newY, z: clampedZ });
      }
    } else if (state.type === 'y') {
      const currentIntersect = new THREE.Vector3();
      if (e.ray.intersectPlane(state.worldPlane, currentIntersect)) {
        const deltaY = currentIntersect.y - state.startIntersect.y;
        let rawY = state.startBoxY + deltaY;

        const stepCm = (snapStepMm || 10) / 10;
        if (snapToGrid) {
          rawY = Math.round(rawY / stepCm) * stepCm;
        } else {
          rawY = Math.round(rawY * 10) / 10;
        }

        const clampedY = Math.max(0, Math.min(pallet.height - state.boxHeight, Math.round(rawY * 10) / 10));
        onMoveBox(state.boxId, { x: state.startBoxX, y: clampedY, z: state.startBoxZ });
      }
    }
  };

  const handlePointerUp = (e?: any) => {
    if (dragStateRef.current) {
      if (e) e.stopPropagation();
      dragStateRef.current = null;
      setDraggedBoxId(null);
      setOrbitEnabled?.(true);
      document.body.style.cursor = 'auto';
    }
  };

  // Filter boxes by layer and sequence
  const visibleBoxes = useMemo(() => {
    return packedBoxes.filter(box => {
      const seqMatch = (box.sequenceNumber || 1) <= maxVisibleSequence;
      const layerMatch = (box.layerIndex || 1) <= maxVisibleLayer;
      return seqMatch && layerMatch;
    });
  }, [packedBoxes, maxVisibleSequence, maxVisibleLayer]);

  const selectedBoxObj = visibleBoxes.find(b => b.id === selectedBoxId);

  return (
    <group position={[-pallet.width / 2, 0, -pallet.depth / 2]}>
      {/* 3D Realistic Wooden Pallet Base */}
      <RealisticWoodenPallet width={pallet.width} depth={pallet.depth} />

      {/* High-visibility Pallet Perimeter & Bounding Box System */}
      <PalletBoundarySystem pallet={pallet} />

      {/* Direction Floor Badges with High Contrast */}
      <Billboard position={[pallet.width / 2, 0.2, pallet.depth + 18]}>
        <Text fontSize={4.5} color="#f8fafc" outlineWidth={0.5} outlineColor="#0f172a" fontWeight="bold">
          ▼ ÖN (FRONT)
        </Text>
      </Billboard>
      <Billboard position={[pallet.width / 2, 0.2, -18]}>
        <Text fontSize={4.5} color="#94a3b8" outlineWidth={0.5} outlineColor="#0f172a" fontWeight="bold">
          ▲ ARKA (BACK)
        </Text>
      </Billboard>
      <Billboard position={[-18, 0.2, pallet.depth / 2]}>
        <Text fontSize={4.5} color="#94a3b8" outlineWidth={0.5} outlineColor="#0f172a" fontWeight="bold">
          ◀ SOL (LEFT)
        </Text>
      </Billboard>
      <Billboard position={[pallet.width + 18, 0.2, pallet.depth / 2]}>
        <Text fontSize={4.5} color="#94a3b8" outlineWidth={0.5} outlineColor="#0f172a" fontWeight="bold">
          SAĞ (RIGHT) ▶
        </Text>
      </Billboard>

      {/* Render Packed Boxes */}
      {visibleBoxes.map((box, idx) => {
        const issues = collisionMap.get(box.id);
        return (
          <BoxMesh
            key={`${box.id}-${idx}`}
            box={box}
            isSelected={isSelectedBox(box.id)}
            isHovered={hoveredBoxId === box.id}
            isDragging={draggedBoxId === box.id}
            isTransparent={showWireframe}
            isManualMode={isManualMode}
            hasCollision={issues?.isCollision}
            hasOverhang={issues?.isOverhang}
            hasFloatingGap={issues?.isFloating}
            onClick={(e) => {
              e.stopPropagation();
              onSelectBox(box, palletResult.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onRotateBox?.(box.id);
            }}
            onPointerDown={(e) => handleBoxPointerDown(box, e)}
            onPointerOver={(e) => {
              e.stopPropagation();
              onHoverBox(box);
              if (isManualMode && !draggedBoxId) {
                document.body.style.cursor = 'grab';
              }
            }}
            onPointerOut={() => {
              onHoverBox(null);
              if (!draggedBoxId) {
                document.body.style.cursor = 'auto';
              }
            }}
          />
        );
      })}

      {/* Manual Mode: Vertical Y Handle on Selected Box */}
      {isManualMode && selectedBoxObj && (
        <VerticalYHandle
          box={selectedBoxObj}
          onPointerDown={(e) => handleYPointerDown(selectedBoxObj, e)}
        />
      )}

      {/* Full-scene invisible drag catcher active while dragging */}
      {draggedBoxId && (
        <mesh
          position={[pallet.width / 2, 0, pallet.depth / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          visible={false}
        >
          <planeGeometry args={[5000, 5000]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      {/* Center of Gravity Gizmo */}
      {showCoG && visibleBoxes.length > 0 && (
        <CenterOfGravityMarker cog={centerOfGravity} pallet={pallet} />
      )}

      {/* Rulers / Distance to edges */}
      {showRulers && visibleBoxes.length > 0 && (
        <MarginsRuler pallet={pallet} margins={margins} />
      )}
    </group>
  );
};

const CameraPresetSync: React.FC<{
  preset: 'iso' | 'top' | 'front' | 'side';
  controlsRef: React.RefObject<any>;
}> = ({ preset, controlsRef }) => {
  const { camera } = useThree();

  useEffect(() => {
    let targetPos: [number, number, number];
    switch (preset) {
      case 'top':
        targetPos = [0, 420, 0.1];
        break;
      case 'front':
        targetPos = [0, 120, 380];
        break;
      case 'side':
        targetPos = [380, 120, 0];
        break;
      case 'iso':
      default:
        targetPos = [240, 220, 260];
        break;
    }
    camera.position.set(...targetPos);
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [preset, camera, controlsRef]);

  return null;
};

// 3D Visual Reticle showing the Camera Focal/Center Target (controls.target)
// Visible EXACTLY while pointer is down (dragging/orbiting) or wheel scrolling, and disappears INSTANTLY on pointerup
const FocalTargetGizmo: React.FC<{
  controlsRef: React.RefObject<any>;
  isRightDragging?: boolean;
}> = ({ controlsRef, isRightDragging = false }) => {
  const groupRef = useRef<THREE.Group>(null);
  const isPointerDownRef = useRef(false);
  const isWheelActiveRef = useRef(false);
  const wheelTimerRef = useRef<any>(null);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      // Show when holding left or right mouse button or touch
      isPointerDownRef.current = true;
    };

    const handlePointerUp = () => {
      // INSTANTLY hide on pointer release
      isPointerDownRef.current = false;
    };

    const handleWheel = () => {
      isWheelActiveRef.current = true;
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => {
        isWheelActiveRef.current = false;
      }, 70);
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
      window.removeEventListener('wheel', handleWheel);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, []);

  useFrame((state) => {
    if (!controlsRef.current || !groupRef.current) return;
    const tgt = controlsRef.current.target;
    const cam = state.camera;

    // Active strictly while dragging (pointer down) or scrolling wheel
    const isActive = isPointerDownRef.current || isRightDragging || isWheelActiveRef.current;
    groupRef.current.visible = isActive;

    if (isActive) {
      // Pin exactly to OrbitControls target (focal center)
      groupRef.current.position.copy(tgt);

      // Ultra-refined micro-reticle scaling
      const dist = cam.position.distanceTo(tgt);
      const scaleFactor = Math.max(0.012, dist * 0.006);
      groupRef.current.scale.setScalar(scaleFactor);
    }
  });

  return (
    <group ref={groupRef} renderOrder={9999} visible={false}>
      {/* Billboarded Camera Target Reticle - ALWAYS rendered on top of all scene geometry (depthTest: false) */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* Dark contrast drop shadow ring */}
        <mesh renderOrder={9997}>
          <ringGeometry args={[1.2, 1.8, 32]} />
          <meshBasicMaterial
            color="#090d16"
            transparent
            opacity={0.65}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>

        {/* Outer primary reticle ring (Vibrant cyan) */}
        <mesh renderOrder={9998}>
          <ringGeometry args={[1.3, 1.6, 32]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.95}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>

        {/* 4 Cardinal Crosshair Tick Marks */}
        {/* Top tick */}
        <mesh position={[0, 1.5, 0]} renderOrder={9999}>
          <planeGeometry args={[0.2, 0.7]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.95}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        {/* Bottom tick */}
        <mesh position={[0, -1.5, 0]} renderOrder={9999}>
          <planeGeometry args={[0.2, 0.7]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.95}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        {/* Left tick */}
        <mesh position={[-1.5, 0, 0]} renderOrder={9999}>
          <planeGeometry args={[0.7, 0.2]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.95}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        {/* Right tick */}
        <mesh position={[1.5, 0, 0]} renderOrder={9999}>
          <planeGeometry args={[0.7, 0.2]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.95}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>

        {/* Center Target Bullseye Dot */}
        <mesh renderOrder={9999}>
          <circleGeometry args={[0.35, 18]} />
          <meshBasicMaterial
            color="#090d16"
            transparent
            opacity={0.85}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        <mesh renderOrder={10000}>
          <circleGeometry args={[0.22, 18]} />
          <meshBasicMaterial
            color="#facc15"
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
};

export const Pallet3D: React.FC<Pallet3DProps> = ({
  pallets,
  activePalletId,
  selectedBoxId,
  hoveredBoxId,
  onSelectBox,
  onHoverBox,
  showCoG,
  showRulers,
  showWireframe,
  maxVisibleSequence,
  maxVisibleLayer,
  cameraPreset,
  bgColor = '#242c38',
  isManualMode = false,
  onMoveBox,
  onRotateBox,
  onDeleteBox,
  onDropToFloor,
  snapToGrid = true,
  snapStepMm = 10,
  magneticSnap = true,
  autoStack = true,
  cameraLock = false
}) => {
  const controlsRef = useRef<any>(null);
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [isRightDragging, setIsRightDragging] = useState(false);

  // Track right-click dragging (camera panning)
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) { // Right click
        setIsRightDragging(true);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        setIsRightDragging(false);
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Filter pallets to show: If activePalletId is selected and not 'all', show only that pallet
  const displayedPallets = useMemo(() => {
    if (!pallets || pallets.length === 0) return [];
    if (!activePalletId || activePalletId === 'all') return pallets;
    const filtered = pallets.filter(p => p.id === activePalletId);
    return filtered.length > 0 ? filtered : pallets;
  }, [pallets, activePalletId]);

  // Adjust camera position based on preset
  const cameraPosition = useMemo((): [number, number, number] => {
    switch (cameraPreset) {
      case 'top':
        return [0, 420, 0.1];
      case 'front':
        return [0, 120, 380];
      case 'side':
        return [380, 120, 0];
      case 'iso':
      default:
        return [240, 220, 260];
    }
  }, [cameraPreset]);

  return (
    <div 
      className="w-full h-full relative" 
      style={{ backgroundColor: bgColor }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        {/* Lighter, eye-friendly studio slate background color */}
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, 350, 1500]} />

        <PerspectiveCamera makeDefault position={cameraPosition} fov={45} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!cameraLock && orbitEnabled}
          minDistance={60}
          maxDistance={1200}
          maxPolarAngle={Math.PI / 2 + 0.05} // don't go below floor
          dampingFactor={0.08}
        />

        {/* Dynamic camera preset controller */}
        <CameraPresetSync preset={cameraPreset} controlsRef={controlsRef} />

        {/* Real-time 3D Focal Target Gizmo visible during right-click panning */}
        <FocalTargetGizmo controlsRef={controlsRef} isRightDragging={isRightDragging} />

        {/* Studio Lighting tuned for lighter slate background */}
        {/* Key Light (warm-tinted directional) */}
        <directionalLight position={[150, 260, 180]} intensity={1.35} castShadow shadow-mapSize={2048} />
        {/* Fill Light (balanced cool-tinted ambient/directional) */}
        <ambientLight intensity={0.7} color="#f8fafc" />
        <directionalLight position={[-180, 150, -100]} intensity={0.55} color="#94a3b8" />
        {/* Rim Light (crisp silhouette highlight from behind) */}
        <directionalLight position={[0, 200, -250]} intensity={0.75} color="#ffffff" />

        {displayedPallets.length > 0 && (
          <Center top>
            <group>
            {displayedPallets.map((palletResult, index) => {
              const spacing = palletResult.pallet.width + 50;
              const xOffset = displayedPallets.length === 1 
                ? 0 
                : index * spacing - ((displayedPallets.length - 1) * spacing) / 2;

              return (
                <group key={palletResult.id} position={[xOffset, 0, 0]}>
                  <SinglePalletAssembly
                    palletResult={palletResult}
                    isSelectedBox={(id) => id === selectedBoxId}
                    hoveredBoxId={hoveredBoxId}
                    selectedBoxId={selectedBoxId}
                    onSelectBox={onSelectBox}
                    onHoverBox={onHoverBox}
                    showCoG={showCoG}
                    showRulers={showRulers}
                    showWireframe={showWireframe}
                    maxVisibleSequence={maxVisibleSequence}
                    maxVisibleLayer={maxVisibleLayer}
                    isManualMode={isManualMode}
                    onMoveBox={onMoveBox}
                    onRotateBox={onRotateBox}
                    onDeleteBox={onDeleteBox}
                    onDropToFloor={onDropToFloor}
                    snapToGrid={snapToGrid}
                    snapStepMm={snapStepMm}
                    magneticSnap={magneticSnap}
                    autoStack={autoStack}
                  />
                </group>
              );
            })}
          </group>
        </Center>
        )}

        {/* Floor Grid contrasting cleanly with the lighter studio slate tone */}
        <Grid
          infiniteGrid
          fadeDistance={700}
          fadeStrength={3}
          cellSize={20}
          sectionSize={100}
          sectionColor="#4b5563"
          cellColor="#374151"
          position={[0, -12.5, 0]}
        />
      </Canvas>
    </div>
  );
};
