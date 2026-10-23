import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Layers,
  Move,
  RotateCw,
  Plus,
  Trash2,
  Copy,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  Grid,
  Magnet,
  AlertTriangle,
  CheckCircle2,
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  CornerDownLeft,
  Columns,
  Eye,
  Sliders,
  Sparkles,
  Lock,
  Unlock,
  Wand2,
  PackageCheck,
  RotateCcw,
  MousePointer,
  Stamp
} from 'lucide-react';
import { Box, PackedBox, Pallet, ProductCatalogItem } from '../types';

export interface PlacementValidation {
  isValid: boolean;
  hasCollision: boolean;
  hasOverhang: boolean;
  hasFloatingGap: boolean;
  collidingBoxIds: string[];
  overhangDetails?: { xOverflow: number; zOverflow: number; yOverflow: number };
}

export function validatePlacement(
  targetBox: PackedBox,
  allBoxes: PackedBox[],
  pallet: Pallet
): PlacementValidation {
  const collidingBoxIds: string[] = [];
  let hasCollision = false;

  for (const b of allBoxes) {
    if (b.id === targetBox.id) continue;
    // Check 3D AABB overlap with small 0.1cm epsilon to allow touching faces
    const overlapX = targetBox.x < b.x + b.width - 0.1 && targetBox.x + targetBox.width > b.x + 0.1;
    const overlapY = targetBox.y < b.y + b.height - 0.1 && targetBox.y + targetBox.height > b.y + 0.1;
    const overlapZ = targetBox.z < b.z + b.depth - 0.1 && targetBox.z + targetBox.depth > b.z + 0.1;

    if (overlapX && overlapY && overlapZ) {
      hasCollision = true;
      collidingBoxIds.push(b.id);
    }
  }

  const xOverflow = Math.max(0, targetBox.x + targetBox.width - pallet.width, -targetBox.x);
  const zOverflow = Math.max(0, targetBox.z + targetBox.depth - pallet.depth, -targetBox.z);
  const yOverflow = Math.max(0, targetBox.y + targetBox.height - pallet.height, -targetBox.y);
  const hasOverhang = xOverflow > 0.05 || zOverflow > 0.05 || yOverflow > 0.05;

  // Check for floating gap (unsupported/uneven bottom surface)
  let hasFloatingGap = false;
  if (targetBox.y > 0.1) {
    const underlyingBoxes = allBoxes.filter(b => {
      if (b.id === targetBox.id) return false;
      const overlapX = targetBox.x < b.x + b.width - 0.1 && targetBox.x + targetBox.width > b.x + 0.1;
      const overlapZ = targetBox.z < b.z + b.depth - 0.1 && targetBox.z + targetBox.depth > b.z + 0.1;
      return overlapX && overlapZ && b.y + b.height <= targetBox.y + 0.1;
    });

    if (underlyingBoxes.length === 0) {
      // Entirely floating in air with no support underneath
      hasFloatingGap = true;
    } else {
      const maxSupportY = Math.max(...underlyingBoxes.map(b => b.y + b.height));
      // If box is floating above the highest support
      if (Math.abs(targetBox.y - maxSupportY) > 0.2) {
        hasFloatingGap = true;
      } else {
        // Check if all underlying boxes under targetBox have the SAME top height (level support)
        for (const u of underlyingBoxes) {
          if (Math.abs(u.y + u.height - maxSupportY) > 0.5) {
            // There is a lower box under targetBox, leaving a floating gap underneath targetBox!
            hasFloatingGap = true;
            break;
          }
        }
      }
    }
  }

  return {
    isValid: !hasCollision && !hasOverhang && !hasFloatingGap,
    hasCollision,
    hasOverhang,
    hasFloatingGap,
    collidingBoxIds,
    overhangDetails: { xOverflow, zOverflow, yOverflow }
  };
}

interface ManualPlacementStudioProps {
  pallet: Pallet;
  boxes: Box[];
  packedBoxes: PackedBox[];
  onChangePackedBoxes: (boxes: PackedBox[]) => void;
  selectedBoxId: string | null;
  onSelectBoxId: (id: string | null) => void;
  masterCatalog?: ProductCatalogItem[];
  bgColor?: string;
  render3DViewport: (props: {
    snapStep: number;
    magneticSnap: boolean;
    cameraLock: boolean;
    activeLayerIndex: number;
  }) => React.ReactNode;
  onOpenAddBoxModal?: () => void;
  onDeleteBoxType?: (boxTypeId: string) => void;
  onUpdateBoxQuantity?: (boxTypeId: string, newQuantity: number) => void;
}

export const ManualPlacementStudio: React.FC<ManualPlacementStudioProps> = ({
  pallet,
  boxes,
  packedBoxes,
  onChangePackedBoxes,
  selectedBoxId,
  onSelectBoxId,
  masterCatalog = [],
  bgColor = '#242c38',
  render3DViewport,
  onOpenAddBoxModal,
  onDeleteBoxType,
  onUpdateBoxQuantity
}) => {
  // Undo / Redo History State
  const [history, setHistory] = useState<PackedBox[][]>([packedBoxes]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Settings
  const [snapStep, setSnapStep] = useState<number>(10); // in mm: 5, 10, 25, 50
  const [magneticSnap, setMagneticSnap] = useState<boolean>(true); // Snap to pallet edge & nearby boxes
  const [cameraLock, setCameraLock] = useState<boolean>(false); // Lock orbit for easy drag
  const [activeLayerIndex, setActiveLayerIndex] = useState<number>(1); // 1-based layer index
  const [viewSplitMode, setViewSplitMode] = useState<'both' | '3d-only' | '2d-only'>('both');
  const [selectedBoxTypeToAdd, setSelectedBoxTypeToAdd] = useState<string>(boxes[0]?.id || '');
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);

  // Push new state into history
  const updateBoxesWithHistory = useCallback((newBoxes: PackedBox[]) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newBoxes);
    if (updatedHistory.length > 30) updatedHistory.shift();
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    onChangePackedBoxes(newBoxes);
  }, [history, historyIndex, onChangePackedBoxes]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      onChangePackedBoxes(history[nextIdx]);
    }
  }, [history, historyIndex, onChangePackedBoxes]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      onChangePackedBoxes(history[nextIdx]);
    }
  }, [history, historyIndex, onChangePackedBoxes]);

  // Selected Box Object
  const selectedBox = useMemo(() => {
    return packedBoxes.find(b => b.id === selectedBoxId) || null;
  }, [packedBoxes, selectedBoxId]);

  // Derived layers list
  const layersList = useMemo(() => {
    const layersMap = new Map<number, { count: number; heightMin: number; heightMax: number }>();
    packedBoxes.forEach(box => {
      const layer = box.layerIndex || 1;
      const current = layersMap.get(layer) || { count: 0, heightMin: box.y, heightMax: box.y + box.height };
      current.count += 1;
      current.heightMin = Math.min(current.heightMin, box.y);
      current.heightMax = Math.max(current.heightMax, box.y + box.height);
      layersMap.set(layer, current);
    });

    const maxLayer = Math.max(1, ...Array.from(layersMap.keys()));
    const result = [];
    for (let i = 1; i <= maxLayer; i++) {
      const data = layersMap.get(i) || { count: 0, heightMin: (i - 1) * 30, heightMax: i * 30 };
      result.push({
        layerNumber: i,
        count: data.count,
        heightMinMm: Math.round(data.heightMin * 10),
        heightMaxMm: Math.round(data.heightMax * 10)
      });
    }
    return result;
  }, [packedBoxes]);

  // Remaining Box Inventory
  const boxInventory = useMemo(() => {
    return boxes.map(b => {
      const placedCount = packedBoxes.filter(pb => pb.materialCode === b.materialCode || pb.name === b.name).length;
      return {
        ...b,
        placedCount,
        remainingCount: Math.max(0, b.quantity - placedCount)
      };
    });
  }, [boxes, packedBoxes]);

  // Validation Report for all placed boxes
  const placementIssues = useMemo(() => {
    const issues: { box: PackedBox; validation: PlacementValidation }[] = [];
    packedBoxes.forEach(box => {
      const val = validatePlacement(box, packedBoxes, pallet);
      if (!val.isValid) {
        issues.push({ box, validation: val });
      }
    });
    return issues;
  }, [packedBoxes, pallet]);

  // Smart Snap Calculation Helper
  const applySnapping = useCallback((targetX: number, targetZ: number, boxWidth: number, boxDepth: number, currentBoxId?: string) => {
    const stepCm = snapStep / 10;
    let sx = Math.round(targetX / stepCm) * stepCm;
    let sz = Math.round(targetZ / stepCm) * stepCm;

    if (magneticSnap) {
      const magnetDist = 2.5; // cm (25mm magnetic attraction threshold)

      // Snap to pallet borders
      if (Math.abs(sx) <= magnetDist) sx = 0;
      if (Math.abs(sx + boxWidth - pallet.width) <= magnetDist) sx = pallet.width - boxWidth;
      if (Math.abs(sz) <= magnetDist) sz = 0;
      if (Math.abs(sz + boxDepth - pallet.depth) <= magnetDist) sz = pallet.depth - boxDepth;

      // Snap to nearby adjacent boxes on the same layer
      for (const other of packedBoxes) {
        if (other.id === currentBoxId) continue;
        if (Math.abs(sx - (other.x + other.width)) <= magnetDist) sx = other.x + other.width;
        if (Math.abs(sx + boxWidth - other.x) <= magnetDist) sx = other.x - boxWidth;
        if (Math.abs(sz - (other.z + other.depth)) <= magnetDist) sz = other.z + other.depth;
        if (Math.abs(sz + boxDepth - other.z) <= magnetDist) sz = other.z - boxDepth;
        if (Math.abs(sx - other.x) <= magnetDist) sx = other.x;
        if (Math.abs(sz - other.z) <= magnetDist) sz = other.z;
      }
    }

    // Clamp inside pallet bounds
    sx = Math.max(0, Math.min(pallet.width - boxWidth, Math.round(sx * 10) / 10));
    sz = Math.max(0, Math.min(pallet.depth - boxDepth, Math.round(sz * 10) / 10));

    return { x: sx, z: sz };
  }, [snapStep, magneticSnap, packedBoxes, pallet]);

  // Find open placement on a specific layer with strict floor-first and coplanar level support
  const findSpotOnLayer = useCallback((
    boxType: Box,
    targetLayer: number,
    currentBoxes: PackedBox[]
  ): { found: boolean; x: number; y: number; z: number; width: number; depth: number; rotated: boolean } | null => {
    const step = 2; // 2cm search granularity

    // Calculate support considering ONLY boxes in lower layers (b.layerIndex < targetLayer)
    const getSupportingInfo = (x: number, z: number, w: number, d: number) => {
      // ONLY consider boxes that belong to a layer BELOW targetLayer
      const lowerBoxes = currentBoxes.filter(b => (b.layerIndex || 1) < targetLayer);
      const underlying = lowerBoxes.filter(b => {
        const ox = x < b.x + b.width - 0.1 && x + w > b.x + 0.1;
        const oz = z < b.z + b.depth - 0.1 && z + d > b.z + 0.1;
        return ox && oz;
      });

      if (underlying.length === 0) {
        return { candY: 0, hasSupportFromPrevLayer: false, isLevel: true };
      }

      const maxY = Math.max(...underlying.map(b => b.y + b.height));
      const minY = Math.min(...underlying.map(b => b.y + b.height));
      const isLevel = (maxY - minY) <= 0.5;

      // Check if at least one underlying box belongs to layer (targetLayer - 1)
      const hasSupportFromPrevLayer = underlying.some(b => (b.layerIndex || 1) === targetLayer - 1);

      return { candY: maxY, hasSupportFromPrevLayer, isLevel };
    };

    const candidates: { score: number; candY: number; x: number; y: number; z: number; width: number; depth: number; rotated: boolean }[] = [];

    const testOrientation = (w: number, d: number, rotated: boolean) => {
      for (let z = 0; z <= pallet.depth - d; z += step) {
        for (let x = 0; x <= pallet.width - w; x += step) {
          const { candY, hasSupportFromPrevLayer, isLevel } = getSupportingInfo(x, z, w, d);

          // STRICT LAYER 1 CONSTRAINT:
          // Layer 1 is the floor (candY === 0). Do NOT stack on top of existing boxes when trying to fill Layer 1!
          if (targetLayer === 1) {
            if (candY > 0.1) continue;
          } else {
            // STRICT UPPER LAYER CONSTRAINT:
            // Layers > 1 MUST sit on top of underlying boxes from Layer (targetLayer - 1),
            // must have candY > 0.1, and must have a level supporting surface!
            if (candY <= 0.1 || !hasSupportFromPrevLayer || !isLevel) {
              continue;
            }
          }

          const candidate: PackedBox = {
            ...boxType,
            width: w,
            depth: d,
            id: 'test-cand',
            x,
            y: candY,
            z,
            rotated,
            layerIndex: targetLayer
          };

          const val = validatePlacement(candidate, currentBoxes, pallet);
          if (val.isValid) {
            // Heuristic score:
            // 1. candY (prefer lowest supporting level first)
            // 2. z position (row-by-row)
            // 3. x position (column order)
            const score = (candY * 100000) + (z * 100) + x;
            candidates.push({
              score,
              candY,
              x,
              y: candY,
              z,
              width: w,
              depth: d,
              rotated
            });
          }
        }
      }
    };

    // 1. Standard orientation
    testOrientation(boxType.width, boxType.depth, false);

    // 2. 90° Rotated orientation if rotation allowed
    if (boxType.allowRotateY !== false && boxType.width !== boxType.depth) {
      testOrientation(boxType.depth, boxType.width, true);
    }

    if (candidates.length === 0) {
      return null;
    }

    // Sort candidates: lowest score (lowest candY, row z, col x) first
    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];

    return {
      found: true,
      x: best.x,
      y: best.y,
      z: best.z,
      width: best.width,
      depth: best.depth,
      rotated: best.rotated
    };
  }, [pallet]);

  // SMART NEXT-FIT: Automatically finds the best open spot, advances to upper layer if current layer is full
  const handleSmartDropNextFit = (boxType: Box) => {
    // 1. Try to fit on activeLayerIndex first
    let targetLayer = activeLayerIndex;
    let spot = findSpotOnLayer(boxType, targetLayer, packedBoxes);

    // 2. If it does not fit on activeLayerIndex, check existing upper layers or create next layer
    if (!spot) {
      const maxExistingLayer = packedBoxes.length > 0
        ? Math.max(...packedBoxes.map(b => b.layerIndex || 1))
        : 1;

      for (let lyr = activeLayerIndex + 1; lyr <= Math.max(maxExistingLayer + 1, activeLayerIndex + 1); lyr++) {
        const testSpot = findSpotOnLayer(boxType, lyr, packedBoxes);
        if (testSpot) {
          spot = testSpot;
          targetLayer = lyr;
          break;
        }
      }
    }

    // 3. If still no spot found, create a brand new upper layer
    if (!spot) {
      const maxExistingLayer = packedBoxes.length > 0
        ? Math.max(...packedBoxes.map(b => b.layerIndex || 1))
        : 1;
      targetLayer = maxExistingLayer + 1;
      let newY = 0;
      if (packedBoxes.length > 0) {
        newY = Math.max(...packedBoxes.map(b => b.y + b.height));
      }
      spot = {
        found: true,
        x: 0,
        y: newY,
        z: 0,
        width: boxType.width,
        depth: boxType.depth,
        rotated: false
      };
    }

    const newBox: PackedBox = {
      ...boxType,
      width: spot.width,
      depth: spot.depth,
      id: `${boxType.id}-${Date.now()}`,
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rotated: spot.rotated,
      sequenceNumber: packedBoxes.length + 1,
      layerIndex: targetLayer
    };

    const updated = [...packedBoxes, newBox];
    updateBoxesWithHistory(updated);
    onSelectBoxId(newBox.id);

    // Automatically transition to the upper layer if the box was placed above!
    if (targetLayer !== activeLayerIndex) {
      setActiveLayerIndex(targetLayer);
    }
  };

  // Rotate Selected Box 90°
  const handleRotateSelected = (axis: 'x' | 'y' | 'z') => {
    if (!selectedBox) return;

    let w = selectedBox.width;
    let h = selectedBox.height;
    let d = selectedBox.depth;

    if (axis === 'y') {
      w = selectedBox.depth;
      d = selectedBox.width;
    } else if (axis === 'x') {
      h = selectedBox.depth;
      d = selectedBox.height;
    } else if (axis === 'z') {
      w = selectedBox.height;
      h = selectedBox.width;
    }

    const snapped = applySnapping(selectedBox.x, selectedBox.z, w, d, selectedBox.id);

    const updated = packedBoxes.map(b => {
      if (b.id === selectedBox.id) {
        return {
          ...b,
          width: w,
          height: h,
          depth: d,
          x: snapped.x,
          z: snapped.z,
          rotated: !b.rotated
        };
      }
      return b;
    });

    updateBoxesWithHistory(updated);
  };

  // Nudge Selected Box
  const handleNudgeSelected = (axis: 'x' | 'y' | 'z', deltaCm: number) => {
    if (!selectedBox) return;

    const updated = packedBoxes.map(b => {
      if (b.id === selectedBox.id) {
        let nx = b.x + (axis === 'x' ? deltaCm : 0);
        let ny = b.y + (axis === 'y' ? deltaCm : 0);
        let nz = b.z + (axis === 'z' ? deltaCm : 0);

        nx = Math.max(0, Math.min(pallet.width - b.width, Math.round(nx * 10) / 10));
        ny = Math.max(0, Math.min(pallet.height - b.height, Math.round(ny * 10) / 10));
        nz = Math.max(0, Math.min(pallet.depth - b.depth, Math.round(nz * 10) / 10));

        return { ...b, x: nx, y: ny, z: nz };
      }
      return b;
    });

    updateBoxesWithHistory(updated);
  };

  // Corner Snap
  const handleSnapToCorner = (corner: 'front-left' | 'front-right' | 'back-left' | 'back-right') => {
    if (!selectedBox) return;

    let nx = 0;
    let nz = 0;

    switch (corner) {
      case 'front-left':
        nx = 0;
        nz = pallet.depth - selectedBox.depth;
        break;
      case 'front-right':
        nx = pallet.width - selectedBox.width;
        nz = pallet.depth - selectedBox.depth;
        break;
      case 'back-left':
        nx = 0;
        nz = 0;
        break;
      case 'back-right':
        nx = pallet.width - selectedBox.width;
        nz = 0;
        break;
    }

    const updated = packedBoxes.map(b => {
      if (b.id === selectedBox.id) {
        return { ...b, x: nx, z: nz };
      }
      return b;
    });

    updateBoxesWithHistory(updated);
  };

  // Duplicate Selected Box
  const handleDuplicateSelected = () => {
    if (!selectedBox) return;

    let nx = selectedBox.x + selectedBox.width;
    let nz = selectedBox.z;

    if (nx + selectedBox.width > pallet.width) {
      nx = selectedBox.x;
      nz = selectedBox.z + selectedBox.depth;
    }

    if (nz + selectedBox.depth > pallet.depth) {
      nx = 0;
      nz = 0;
    }

    const duplicated: PackedBox = {
      ...selectedBox,
      id: `${selectedBox.id}-dup-${Date.now()}`,
      x: nx,
      z: nz,
      sequenceNumber: packedBoxes.length + 1
    };

    const updated = [...packedBoxes, duplicated];
    updateBoxesWithHistory(updated);
    onSelectBoxId(duplicated.id);
  };

  // Delete Selected Box
  const handleDeleteSelected = () => {
    if (!selectedBoxId) return;
    const updated = packedBoxes.filter(b => b.id !== selectedBoxId);
    updateBoxesWithHistory(updated);
    onSelectBoxId(null);
  };

  // Auto Fill Row
  const handleFillRow = () => {
    if (!selectedBox) return;
    const w = selectedBox.width;
    const currentInventory = boxInventory.find(b => b.materialCode === selectedBox.materialCode || b.name === selectedBox.name);
    let remaining = currentInventory ? currentInventory.remainingCount : 999;

    let currentX = selectedBox.x + w;
    const newBoxes: PackedBox[] = [];

    while (currentX + w <= pallet.width && remaining > 0) {
      const clone: PackedBox = {
        ...selectedBox,
        id: `${selectedBox.id}-row-${Date.now()}-${newBoxes.length}`,
        x: currentX,
        sequenceNumber: packedBoxes.length + newBoxes.length + 1
      };
      const val = validatePlacement(clone, [...packedBoxes, ...newBoxes], pallet);
      if (val.isValid) {
        newBoxes.push(clone);
        remaining--;
        currentX += w;
      } else {
        break;
      }
    }

    if (newBoxes.length > 0) {
      updateBoxesWithHistory([...packedBoxes, ...newBoxes]);
    }
  };

  // Duplicate Entire Active Layer Upward (Next Layer)
  const handleDuplicateLayerUp = () => {
    const currentLayerBoxes = packedBoxes.filter(b => (b.layerIndex || 1) === activeLayerIndex);
    if (currentLayerBoxes.length === 0) return;

    const layerHeight = Math.max(...currentLayerBoxes.map(b => b.height));
    const newLayerIdx = activeLayerIndex + 1;

    const newLayerBoxes: PackedBox[] = currentLayerBoxes.map((b, idx) => ({
      ...b,
      id: `${b.id}-L${newLayerIdx}-${idx}-${Date.now()}`,
      y: b.y + layerHeight,
      layerIndex: newLayerIdx,
      sequenceNumber: packedBoxes.length + idx + 1
    }));

    updateBoxesWithHistory([...packedBoxes, ...newLayerBoxes]);
    setActiveLayerIndex(newLayerIdx);
  };

  // Center All Packed Boxes & Resolve Collisions / Overhangs
  const handleCenterAllBoxes = useCallback(() => {
    if (packedBoxes.length === 0) return;

    // Sort input boxes by layer and sequence
    const sortedInput = [...packedBoxes].sort((a, b) => {
      if ((a.layerIndex || 1) !== (b.layerIndex || 1)) {
        return (a.layerIndex || 1) - (b.layerIndex || 1);
      }
      return (a.sequenceNumber || 0) - (b.sequenceNumber || 0);
    });

    const resolved: PackedBox[] = [];

    const hasConflict = (cand: { x: number; y: number; z: number; width: number; height: number; depth: number }, currentList: PackedBox[]) => {
      for (const r of currentList) {
        const ox = cand.x < r.x + r.width - 0.1 && cand.x + cand.width > r.x + 0.1;
        const oy = cand.y < r.y + r.height - 0.1 && cand.y + cand.height > r.y + 0.1;
        const oz = cand.z < r.z + r.depth - 0.1 && cand.z + cand.depth > r.z + 0.1;
        if (ox && oy && oz) return true;
      }
      return false;
    };

    for (const box of sortedInput) {
      const origLayer = box.layerIndex || 1;
      let width = box.width;
      let depth = box.depth;
      let height = box.height;

      let candX = Math.max(0, Math.min(pallet.width - width, box.x));
      let candZ = Math.max(0, Math.min(pallet.depth - depth, box.z));
      let candY = box.y;
      let candLayer = origLayer;
      let candRotated = box.rotated;

      let candidate: PackedBox = {
        ...box,
        x: candX,
        y: candY,
        z: candZ,
        width,
        depth,
        height,
        layerIndex: candLayer,
        rotated: candRotated
      };

      // If candidate has collision or overhang, find nearest open spot
      if (hasConflict(candidate, resolved)) {
        let foundSpot = false;

        for (let l = candLayer; l <= candLayer + 5 && !foundSpot; l++) {
          const belowOnL = resolved.filter(r => (r.layerIndex || 1) < l);

          // Grid search on layer l
          for (let cz = 0; cz <= pallet.depth - depth && !foundSpot; cz += 1) {
            for (let cx = 0; cx <= pallet.width - width && !foundSpot; cx += 1) {
              let layerY = 0;
              if (l > 1) {
                const underlying = belowOnL.filter(r => cx < r.x + r.width - 0.1 && cx + width > r.x + 0.1 && cz < r.z + r.depth - 0.1 && cz + depth > r.z + 0.1);
                if (underlying.length === 0) continue;
                layerY = Math.max(...underlying.map(r => r.y + r.height));
              }

              const testCand: PackedBox = {
                ...box,
                x: cx,
                y: layerY,
                z: cz,
                width,
                depth,
                height,
                layerIndex: l,
                rotated: box.rotated
              };
              if (!hasConflict(testCand, resolved)) {
                candidate = testCand;
                foundSpot = true;
              }
            }
          }

          // Try 90 degree rotated if Y rotation allowed
          if (!foundSpot && (box.allowRotateY ?? true)) {
            const rWidth = depth;
            const rDepth = width;
            for (let cz = 0; cz <= pallet.depth - rDepth && !foundSpot; cz += 1) {
              for (let cx = 0; cx <= pallet.width - rWidth && !foundSpot; cx += 1) {
                let layerY = 0;
                if (l > 1) {
                  const underlying = belowOnL.filter(r => cx < r.x + r.width - 0.1 && cx + rWidth > r.x + 0.1 && cz < r.z + r.depth - 0.1 && cz + rDepth > r.z + 0.1);
                  if (underlying.length === 0) continue;
                  layerY = Math.max(...underlying.map(r => r.y + r.height));
                }

                const testCand: PackedBox = {
                  ...box,
                  x: cx,
                  y: layerY,
                  z: cz,
                  width: rWidth,
                  depth: rDepth,
                  height,
                  layerIndex: l,
                  rotated: !box.rotated
                };
                if (!hasConflict(testCand, resolved)) {
                  candidate = testCand;
                  foundSpot = true;
                }
              }
            }
          }
        }
      }

      resolved.push(candidate);
    }

    // Now center the resolved layout on the pallet
    if (resolved.length > 0) {
      const minX = Math.min(...resolved.map(b => b.x));
      const maxX = Math.max(...resolved.map(b => b.x + b.width));
      const minZ = Math.min(...resolved.map(b => b.z));
      const maxZ = Math.max(...resolved.map(b => b.z + b.depth));

      const usedW = maxX - minX;
      const usedD = maxZ - minZ;

      const targetLeft = Math.max(0, (pallet.width - usedW) / 2);
      const targetBack = Math.max(0, (pallet.depth - usedD) / 2);

      const shiftX = targetLeft - minX;
      const shiftZ = targetBack - minZ;

      const finalFixed = resolved.map(b => ({
        ...b,
        x: Math.round((b.x + shiftX) * 10) / 10,
        z: Math.round((b.z + shiftZ) * 10) / 10
      }));

      updateBoxesWithHistory(finalFixed);
    }
  }, [packedBoxes, pallet, updateBoxesWithHistory]);

  // Clear Active Layer
  const handleClearActiveLayer = () => {
    const updated = packedBoxes.filter(b => (b.layerIndex || 1) !== activeLayerIndex);
    updateBoxesWithHistory(updated);
    onSelectBoxId(null);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'r') {
        if (selectedBoxId) {
          e.preventDefault();
          handleRotateSelected('y');
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBoxId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (e.key.toLowerCase() === 'd' && (e.ctrlKey || e.metaKey)) {
        if (selectedBoxId) {
          e.preventDefault();
          handleDuplicateSelected();
        }
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedBoxId) {
          e.preventDefault();
          const stepCm = snapStep / 10;
          if (e.key === 'ArrowLeft') handleNudgeSelected('x', -stepCm);
          if (e.key === 'ArrowRight') handleNudgeSelected('x', stepCm);
          if (e.key === 'ArrowUp') handleNudgeSelected('z', -stepCm);
          if (e.key === 'ArrowDown') handleNudgeSelected('z', stepCm);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBoxId, handleUndo, handleRedo, snapStep]);

  // 2D Canvas SVG Rendering
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [svgDragBoxId, setSvgDragBoxId] = useState<string | null>(null);
  const [svgDragOffset, setSvgDragOffset] = useState<{ x: number; z: number }>({ x: 0, z: 0 });
  const [isStampMode, setIsStampMode] = useState<boolean>(false);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedRef = useRef<boolean>(false);
  const justFinishedDragRef = useRef<boolean>(false);

  const handleSvgPointerDown = (box: PackedBox, e: React.PointerEvent) => {
    e.stopPropagation();
    onSelectBoxId(box.id);
    setSvgDragBoxId(box.id);
    hasDraggedRef.current = false;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };

    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = pallet.width / rect.width;
      const scaleZ = pallet.depth / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseZ = (e.clientY - rect.top) * scaleZ;
      setSvgDragOffset({
        x: mouseX - box.x,
        z: mouseZ - box.z
      });
    }
  };

  const handleSvgPointerMove = (e: React.PointerEvent) => {
    if (!svgDragBoxId || !svgRef.current) return;

    const dx = Math.abs(e.clientX - dragStartPosRef.current.x);
    const dy = Math.abs(e.clientY - dragStartPosRef.current.y);
    if (dx > 3 || dy > 3) {
      hasDraggedRef.current = true;
    }

    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = pallet.width / rect.width;
    const scaleZ = pallet.depth / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseZ = (e.clientY - rect.top) * scaleZ;

    const targetBox = packedBoxes.find(b => b.id === svgDragBoxId);
    if (!targetBox) return;

    const rawX = mouseX - svgDragOffset.x;
    const rawZ = mouseZ - svgDragOffset.z;

    const snapped = applySnapping(rawX, rawZ, targetBox.width, targetBox.depth, targetBox.id);

    onChangePackedBoxes(packedBoxes.map(b => {
      if (b.id === svgDragBoxId) {
        return { ...b, x: snapped.x, z: snapped.z };
      }
      return b;
    }));
  };

  const handleSvgPointerUp = () => {
    if (svgDragBoxId) {
      setSvgDragBoxId(null);
      if (hasDraggedRef.current) {
        updateBoxesWithHistory(packedBoxes);
        justFinishedDragRef.current = true;
        setTimeout(() => {
          justFinishedDragRef.current = false;
        }, 150);
      }
    }
  };

  const handleSvgBackgroundClick = (e: React.MouseEvent) => {
    // If just finished a drag or dragging, ignore
    if (justFinishedDragRef.current || svgDragBoxId || !svgRef.current) {
      return;
    }

    // Default behavior: clicking blank canvas simply deselects active box
    if (!isStampMode) {
      onSelectBoxId(null);
      return;
    }

    // Explicit Stamp Mode only: Place a new box at the clicked position
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = pallet.width / rect.width;
    const scaleZ = pallet.depth / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickZ = (e.clientY - rect.top) * scaleZ;

    const boxType = boxes.find(b => b.id === selectedBoxTypeToAdd) || boxes[0];
    if (!boxType) return;

    // Check remaining inventory limit
    const currentPackedCount = packedBoxes.filter(b => b.name === boxType.name).length;
    if (boxType.quantity && currentPackedCount >= boxType.quantity) {
      return;
    }

    const snapped = applySnapping(clickX - boxType.width / 2, clickZ - boxType.depth / 2, boxType.width, boxType.depth);

    let targetLayer = activeLayerIndex;
    let targetY = 0;

    if (targetLayer > 1) {
      const lowerBoxes = packedBoxes.filter(b => (b.layerIndex || 1) < targetLayer);
      const underlying = lowerBoxes.filter(b => {
        const ox = snapped.x < b.x + b.width - 0.1 && snapped.x + boxType.width > b.x + 0.1;
        const oz = snapped.z < b.z + b.depth - 0.1 && snapped.z + boxType.depth > b.z + 0.1;
        return ox && oz;
      });
      if (underlying.length > 0) {
        targetY = Math.max(...underlying.map(b => b.y + b.height));
      }
    }

    const candidateBox: PackedBox = {
      ...boxType,
      id: `${boxType.id}-${Date.now()}`,
      x: snapped.x,
      y: targetY,
      z: snapped.z,
      rotated: false,
      sequenceNumber: packedBoxes.length + 1,
      layerIndex: targetLayer
    };

    let val = validatePlacement(candidateBox, packedBoxes, pallet);
    // If placing at exact click causes an issue, try to find the best valid spot on targetLayer or next layer
    if (!val.isValid) {
      const spot = findSpotOnLayer(boxType, targetLayer, packedBoxes);
      if (spot) {
        candidateBox.x = spot.x;
        candidateBox.y = spot.y;
        candidateBox.z = spot.z;
        candidateBox.width = spot.width;
        candidateBox.depth = spot.depth;
        candidateBox.rotated = spot.rotated;
        val = validatePlacement(candidateBox, packedBoxes, pallet);
      } else {
        // Try next layer
        targetLayer = activeLayerIndex + 1;
        const nextSpot = findSpotOnLayer(boxType, targetLayer, packedBoxes);
        if (nextSpot) {
          candidateBox.x = nextSpot.x;
          candidateBox.y = nextSpot.y;
          candidateBox.z = nextSpot.z;
          candidateBox.width = nextSpot.width;
          candidateBox.depth = nextSpot.depth;
          candidateBox.rotated = nextSpot.rotated;
          candidateBox.layerIndex = targetLayer;
          setActiveLayerIndex(targetLayer);
          val = validatePlacement(candidateBox, packedBoxes, pallet);
        }
      }
    }

    if (val.isValid) {
      updateBoxesWithHistory([...packedBoxes, candidateBox]);
      onSelectBoxId(candidateBox.id);
    }
  };

  return (
    <div className="flex flex-col h-full w-full select-none bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* 
        ========================================================================
        STUDIO CONTROL DOCK: Layer Switcher, History, Snapping, Views, Camera Lock
        ========================================================================
      */}
      <div className="min-h-12 py-1 bg-zinc-900 border-b border-zinc-800 px-4 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20 overflow-x-auto">
        {/* Left: Active Layer Switcher & Solo */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
            <Layers size={14} />
            <span>KATMAN:</span>
          </div>

          <div className="flex items-center bg-zinc-800 p-0.5 rounded-lg border border-zinc-700/80">
            {layersList.map((layer) => (
              <button
                key={layer.layerNumber}
                onClick={() => setActiveLayerIndex(layer.layerNumber)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  activeLayerIndex === layer.layerNumber
                    ? 'bg-amber-500 text-zinc-950 shadow-sm font-bold'
                    : 'text-zinc-300 hover:text-white'
                }`}
                title={`Katman ${layer.layerNumber} (${layer.count} koli, ${layer.heightMinMm}-${layer.heightMaxMm} mm)`}
              >
                <span>K{layer.layerNumber}</span>
                <span className={`text-[10px] px-1 rounded font-mono ${
                  activeLayerIndex === layer.layerNumber ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-900 text-zinc-400'
                }`}>
                  {layer.count}
                </span>
              </button>
            ))}

            <button
              onClick={() => {
                const nextLayer = layersList.length + 1;
                setActiveLayerIndex(nextLayer);
              }}
              className="px-2 py-1 text-xs text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-1"
              title="Yeni Üst Katman Ekle"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Duplicate Layer Button */}
          <button
            onClick={handleDuplicateLayerUp}
            disabled={packedBoxes.filter(b => (b.layerIndex || 1) === activeLayerIndex).length === 0}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            title="Mevcut katmandaki tüm kolileri aynen bir üst katmana kopyalar"
          >
            <Copy size={13} />
            <span className="hidden sm:inline">Katmanı Kopyala</span>
          </button>
        </div>

        {/* Center: Snapping & Alignment Toolbar */}
        <div className="flex items-center gap-2">
          {/* Snap Step Selector */}
          <div className="flex items-center gap-1 bg-zinc-800 px-2 py-0.5 rounded-lg border border-zinc-700/80 text-xs">
            <Grid size={13} className="text-zinc-400" />
            <span className="text-zinc-400 text-[10px] uppercase font-bold">Izgara:</span>
            {[5, 10, 25, 50].map((step) => (
              <button
                key={step}
                onClick={() => setSnapStep(step)}
                className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-bold transition-colors ${
                  snapStep === step
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {step}mm
              </button>
            ))}
          </div>

          {/* Magnetic Attraction */}
          <button
            onClick={() => setMagneticSnap(!magneticSnap)}
            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
              magneticSnap
                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
            title="Kolileri kenarlara ve yan yana gelen diğer kolilere mıknatıs gibi sıfır boşlukla yapıştırır"
          >
            <Magnet size={13} />
            <span className="hidden md:inline">Manyetik Kilit</span>
          </button>

          {/* Camera Lock / Orbit Toggle for 3D Dragging */}
          <button
            onClick={() => setCameraLock(!cameraLock)}
            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
              cameraLock
                ? 'bg-amber-600/20 text-amber-300 border-amber-500/40'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
            title={cameraLock ? 'Kamera kilitli: 3D sahnede koli sürüklerken kamera dönmez' : 'Kamera serbest: Sahneyi döndürebilirsiniz'}
          >
            {cameraLock ? <Lock size={13} /> : <Unlock size={13} />}
            <span className="hidden md:inline">{cameraLock ? 'Kamera Kilitli' : 'Kamera Serbest'}</span>
          </button>

          {/* Center All Button */}
          <button
            onClick={handleCenterAllBoxes}
            disabled={packedBoxes.length === 0}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            title="Tüm kolileri palet merkezine hizalar ve kenar boşluklarını eşitler"
          >
            <Crosshair size={13} className="text-blue-400" />
            <span>Ortala</span>
          </button>
        </div>

        {/* Right: History Undo/Redo & View Mode */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center bg-zinc-800 p-0.5 rounded-lg border border-zinc-700">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1 rounded text-zinc-300 hover:text-white disabled:opacity-30 transition-colors"
              title="Geri Al (Ctrl+Z)"
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1 rounded text-zinc-300 hover:text-white disabled:opacity-30 transition-colors"
              title="İleri Al (Ctrl+Y)"
            >
              <Redo2 size={14} />
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-zinc-800 p-0.5 rounded-lg border border-zinc-700">
            <button
              onClick={() => setViewSplitMode('both')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1 ${
                viewSplitMode === 'both' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="3D Simülasyon + 2D Katman Planı Bölünmüş Görünüm"
            >
              <Columns size={13} />
              <span className="hidden sm:inline">Bölünmüş (3D+2D)</span>
            </button>
            <button
              onClick={() => setViewSplitMode('3d-only')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                viewSplitMode === '3d-only' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Yalnızca 3D Görünüm"
            >
              3D
            </button>
            <button
              onClick={() => setViewSplitMode('2d-only')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                viewSplitMode === '2d-only' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Yalnızca 2D Katman Planı"
            >
              2D Plan
            </button>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        WORKSPACE BODY: 2D Blueprint + 3D Viewport + Inspector
        ========================================================================
      */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 1. LEFT PANE: 2D Plan Panel (When in 'both' or '2d-only' mode) */}
        {(viewSplitMode === 'both' || viewSplitMode === '2d-only') && (
          <div className={`${viewSplitMode === '2d-only' ? 'flex-1' : 'w-[380px] xl:w-[420px]'} border-r border-zinc-800 bg-zinc-900/60 flex flex-col shrink-0 overflow-hidden relative z-10`}>
            {/* 2D Viewport Header */}
            <div className="h-9 px-3.5 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                  <Grid size={13} className="text-amber-400" />
                  <span>Katman {activeLayerIndex} Planı</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  ({Math.round(pallet.width * 10)}×{Math.round(pallet.depth * 10)} mm)
                </span>
              </div>

              {/* Mode Selector: Selection Mode vs Stamp Mode */}
              <div className="flex items-center bg-zinc-800 p-0.5 rounded-md border border-zinc-700/80">
                <button
                  onClick={() => setIsStampMode(false)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-all ${
                    !isStampMode
                      ? 'bg-zinc-700 text-white shadow-xs font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Seçim & Taşıma Modu: Kolileri seçip sürükleyin. Boşluğa tıklamak seçimi kaldırır."
                >
                  <MousePointer size={11} />
                  <span>Seç</span>
                </button>
                <button
                  onClick={() => setIsStampMode(true)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-all ${
                    isStampMode
                      ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Damga Modu: Palet üzerinde boş alana tıklayarak seçili tipte koli yerleştirin."
                >
                  <Stamp size={11} />
                  <span>Damga</span>
                </button>
              </div>

              <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                <span className="text-emerald-400 font-bold font-mono">
                  {packedBoxes.filter(b => (b.layerIndex || 1) === activeLayerIndex).length} Koli
                </span>
                <button
                  onClick={handleClearActiveLayer}
                  className="text-zinc-400 hover:text-rose-400 p-0.5 rounded transition-colors"
                  title="Bu katmanı tamamen boşalt"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* 2D Interactive SVG Pallet Canvas */}
            <div className="flex-1 p-4 flex items-center justify-center overflow-auto bg-zinc-950/70">
              <div className="relative border-2 border-dashed border-blue-500/50 rounded-lg p-1 bg-zinc-900/40 shadow-inner">
                <svg
                  ref={svgRef}
                  width="330"
                  height={Math.round((330 * pallet.depth) / pallet.width)}
                  viewBox={`0 0 ${pallet.width} ${pallet.depth}`}
                  className={`bg-zinc-900 rounded overflow-visible touch-none shadow-2xl ${
                    isStampMode ? 'cursor-crosshair' : 'cursor-default'
                  }`}
                  onPointerMove={handleSvgPointerMove}
                  onPointerUp={handleSvgPointerUp}
                  onClick={handleSvgBackgroundClick}
                >
                  <defs>
                    <pattern id="smallGrid" width="5" height="5" patternUnits="userSpaceOnUse">
                      <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#27272a" strokeWidth="0.3" />
                    </pattern>
                    <pattern id="majorGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <rect width="20" height="20" fill="url(#smallGrid)" />
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#3f3f46" strokeWidth="0.6" />
                    </pattern>
                  </defs>

                  <rect width={pallet.width} height={pallet.depth} fill="url(#majorGrid)" />

                  {/* Pallet Center Crosshairs */}
                  <line
                    x1={pallet.width / 2}
                    y1={0}
                    x2={pallet.width / 2}
                    y2={pallet.depth}
                    stroke="#0ea5e9"
                    strokeWidth="0.4"
                    strokeDasharray="2,2"
                    opacity="0.5"
                  />
                  <line
                    x1={0}
                    y1={pallet.depth / 2}
                    x2={pallet.width}
                    y2={pallet.depth / 2}
                    stroke="#0ea5e9"
                    strokeWidth="0.4"
                    strokeDasharray="2,2"
                    opacity="0.5"
                  />

                  {/* Render Other Layers as Dimmed Ghosts */}
                  {packedBoxes
                    .filter(b => (b.layerIndex || 1) !== activeLayerIndex)
                    .map((box) => (
                      <g key={`ghost-${box.id}`} opacity="0.25">
                        <rect
                          x={box.x}
                          y={box.z}
                          width={box.width}
                          height={box.depth}
                          fill="#475569"
                          stroke="#64748b"
                          strokeWidth="0.4"
                          rx="0.5"
                        />
                      </g>
                    ))}

                  {/* Render Boxes on Active Layer */}
                  {packedBoxes
                    .filter(b => (b.layerIndex || 1) === activeLayerIndex)
                    .map((box) => {
                      const isSel = box.id === selectedBoxId;
                      const isHov = box.id === hoveredBoxId;
                      const val = validatePlacement(box, packedBoxes, pallet);

                      return (
                        <g
                          key={box.id}
                          onPointerDown={(e) => handleSvgPointerDown(box, e)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBoxId(box.id);
                          }}
                          onPointerEnter={() => setHoveredBoxId(box.id)}
                          onPointerLeave={() => setHoveredBoxId(null)}
                          className="cursor-move"
                        >
                          <rect
                            x={box.x}
                            y={box.z}
                            width={box.width}
                            height={box.depth}
                            fill={!val.isValid ? '#ef4444' : box.color}
                            stroke={isSel ? '#ffffff' : !val.isValid ? '#fca5a5' : isHov ? '#93c5fd' : '#0f172a'}
                            strokeWidth={isSel ? '1.2' : '0.6'}
                            rx="0.8"
                            opacity={isSel ? 0.95 : 0.85}
                          />

                          {isSel && (
                            <rect
                              x={box.x + 0.5}
                              y={box.z + 0.5}
                              width={Math.max(1, box.width - 1)}
                              height={Math.max(1, box.depth - 1)}
                              fill="none"
                              stroke="#38bdf8"
                              strokeWidth="0.5"
                              strokeDasharray="1.5,1.5"
                            />
                          )}

                          {box.width >= 15 && box.depth >= 15 && (
                            <text
                              x={box.x + box.width / 2}
                              y={box.z + box.depth / 2}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="#ffffff"
                              fontSize={Math.max(2.8, Math.min(5, box.width / 4))}
                              fontWeight="bold"
                              pointerEvents="none"
                            >
                              {`#${box.sequenceNumber || 1}`}
                            </text>
                          )}
                        </g>
                      );
                    })}
                </svg>

                {/* Directions Legend */}
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-zinc-400 tracking-wider">
                  ÖN (FRONT)
                </div>
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-zinc-500 tracking-wider">
                  ARKA (BACK)
                </div>
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-[9px] font-bold text-zinc-500 tracking-wider -rotate-90">
                  SOL
                </div>
                <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-[9px] font-bold text-zinc-500 tracking-wider rotate-90">
                  SAĞ
                </div>
              </div>
            </div>

            <div className="px-3.5 py-2 bg-zinc-950 border-t border-zinc-800/80 text-[11px] text-zinc-400 shrink-0 flex items-center justify-between">
              {isStampMode ? (
                <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                  <Sparkles size={12} className="text-amber-400 animate-pulse" />
                  <span>
                    <strong>Damga Modu:</strong> Boş alana tıklayarak seçili koliyi ekleyin ({boxes.find(b => b.id === selectedBoxTypeToAdd)?.name || 'koli'}).
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <Sparkles size={12} className="text-blue-400" />
                  <span>
                    <strong>Seçim Modu:</strong> Kolileri sürükleyin. Yeni koli eklemek için sağdaki <strong>+ Ekle</strong> butonunu kullanın.
                  </span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* 2. CENTER PANE: 3D Viewport (When in 'both' or '3d-only' mode) */}
        {(viewSplitMode === 'both' || viewSplitMode === '3d-only') && (
          <div className="flex-1 relative overflow-hidden bg-zinc-950 flex flex-col">
            {/* Real-time Placement Issues Warning Overlay */}
            {placementIssues.length > 0 && (
              <div className="absolute top-4 left-4 max-w-md xl:max-w-lg z-20 bg-rose-950/90 backdrop-blur-md border border-rose-800/80 px-3.5 py-2 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-200 shadow-xl pointer-events-auto">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle size={15} className="text-rose-400 shrink-0" />
                  <span className="truncate">
                    <strong>Uyarı:</strong> {placementIssues.length} kolide çakışma var!
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCenterAllBoxes}
                  className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-[11px] font-bold transition-colors shadow-sm shrink-0"
                >
                  Ortala ve Düzelt
                </button>
              </div>
            )}

            <div className="flex-1 w-full h-full">
              {render3DViewport({
                snapStep,
                magneticSnap,
                cameraLock,
                activeLayerIndex
              })}
            </div>
          </div>
        )}

        {/* 3. RIGHT PANE: Queue & Selected Inspector */}
        <div className="w-80 xl:w-96 border-l border-zinc-800 bg-zinc-900/90 flex flex-col shrink-0 overflow-hidden z-10">
          {/* Live Pallet Height Gauge Banner */}
          <div className="bg-amber-950/30 border-b border-zinc-800 px-3 py-2 flex items-center justify-between text-xs font-mono shrink-0">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <ArrowUp size={14} className="text-amber-400 shrink-0" />
              <span>YÜKSEKLİK:</span>
              <span className="text-white text-sm font-extrabold font-mono">
                {Math.round(packedBoxes.reduce((m, b) => Math.max(m, b.y + b.height), 0) * 10)} mm
              </span>
            </div>
            <span className="text-[10px] text-zinc-400">
              Max {Math.round(pallet.height * 10)} mm ({Math.round(pallet.height)} cm)
            </span>
          </div>

          {/* Pending Boxes Header & Grid */}
          <div className="p-3 border-b border-zinc-800 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <PackageCheck size={14} className="text-blue-400" /> Koli Tipleri ({boxes.length})
              </span>
              <div className="flex items-center gap-2">
                {onOpenAddBoxModal && (
                  <button
                    onClick={onOpenAddBoxModal}
                    className="px-2 py-0.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                    title="Katalogdan veya özel ölçülerle koli tipi ekle"
                  >
                    <Plus size={11} />
                    <span>Yeni Koli</span>
                  </button>
                )}
                <span className="text-[11px] text-zinc-400 font-mono">
                  <strong className="text-emerald-400">{packedBoxes.length}</strong> Koli
                </span>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {boxInventory.map((item) => {
                const isSelectedForStamp = selectedBoxTypeToAdd === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedBoxTypeToAdd(item.id)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelectedForStamp
                        ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50'
                        : 'bg-zinc-800/70 border-zinc-700/60 hover:border-zinc-600'
                    }`}
                  >
                    {/* Header: Color + Name + Dimensions + Trash */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: item.color }} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{item.name}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">
                            {Math.round(item.width * 10)}×{Math.round(item.depth * 10)}×{Math.round(item.height * 10)} mm • {item.weight || 0} kg
                          </p>
                        </div>
                      </div>

                      {onDeleteBoxType && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteBoxType(item.id);
                          }}
                          className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors shrink-0"
                          title="Bu koli tipini sil"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* Actions Row: Qty Stepper | Remaining Counter | Add Button */}
                    <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-zinc-700/40">
                      {/* Quantity Controller */}
                      <div
                        className="flex items-center gap-0.5 bg-zinc-950/80 border border-zinc-700/80 rounded-lg p-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[10px] text-zinc-400 font-semibold px-1">Adet:</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onUpdateBoxQuantity) onUpdateBoxQuantity(item.id, item.quantity - 1);
                          }}
                          disabled={item.quantity <= 0}
                          className="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 hover:text-white rounded font-bold text-xs flex items-center justify-center transition-colors"
                          title="Koli adedini azalt"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="9999"
                          value={item.quantity}
                          onChange={(e) => {
                            e.stopPropagation();
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            if (onUpdateBoxQuantity) onUpdateBoxQuantity(item.id, val);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 bg-transparent text-center font-mono font-bold text-xs text-white focus:outline-none focus:bg-zinc-800 rounded p-0"
                          title="Koli sayısını doğrudan girin"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onUpdateBoxQuantity) onUpdateBoxQuantity(item.id, item.quantity + 1);
                          }}
                          className="w-5 h-5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded font-bold text-xs flex items-center justify-center transition-colors"
                          title="Koli adedini artır"
                        >
                          +
                        </button>
                      </div>

                      {/* Remaining Badge & Add Button */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          item.remainingCount > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          {item.remainingCount} Kalan
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSmartDropNextFit(item);
                          }}
                          disabled={item.remainingCount <= 0}
                          className="py-1 px-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded-lg text-[11px] font-bold transition-colors shadow-sm"
                          title="Otomatik en uygun boş yere oturtarak yerleştirir"
                        >
                          + Ekle
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {boxInventory.length === 0 && (
                <div className="py-6 px-3 border border-dashed border-zinc-800 rounded-xl text-center flex flex-col items-center gap-2 text-zinc-500">
                  <p className="text-xs">Henüz koli tipi eklenmemiş.</p>
                  {onOpenAddBoxModal && (
                    <button
                      onClick={onOpenAddBoxModal}
                      className="px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-semibold transition-colors"
                    >
                      + Yeni Koli Ekle
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Selected Box Inspector Panel */}
          {selectedBox ? (
            <div className="flex-1 p-3.5 flex flex-col gap-3.5 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: selectedBox.color }} />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">{selectedBox.name}</h4>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      Katman: {selectedBox.layerIndex || 1} • #{selectedBox.sequenceNumber || 1}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDuplicateSelected}
                    className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded border border-zinc-700 transition-colors"
                    title="Çoğalt (Ctrl+D)"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="p-1 bg-rose-950/50 hover:bg-rose-900 text-rose-300 rounded border border-rose-800 transition-colors"
                    title="Kaldır (Delete)"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Quick Action Grid */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleRotateSelected('y')}
                  className="py-1.5 px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  title="90° Yatay Çevir (R)"
                >
                  <RotateCw size={13} />
                  <span>90° Çevir (R)</span>
                </button>
                <button
                  onClick={() => handleNudgeSelected('y', -selectedBox.y)}
                  className="py-1.5 px-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  title="Tabana Oturt (Y=0)"
                >
                  <ArrowDown size={13} />
                  <span>Tabana İndir</span>
                </button>
                <button
                  onClick={handleFillRow}
                  className="py-1.5 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  title="Sırayı Otomatik Doldur"
                >
                  <Sparkles size={13} />
                  <span>Sırayı Doldur</span>
                </button>
                <button
                  onClick={() => handleRotateSelected('x')}
                  className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  title="Yan Yüzeye Yatır"
                >
                  <RotateCw size={13} />
                  <span>Yan Yatır</span>
                </button>
              </div>

              {/* Corner Magnet Push Buttons */}
              <div className="bg-zinc-950/70 p-2.5 rounded-lg border border-zinc-800 space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Köşelere Manyetik İt:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleSnapToCorner('back-left')}
                    className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[11px] font-semibold text-zinc-300 border border-zinc-700"
                  >
                    ↖ Sol-Arka
                  </button>
                  <button
                    onClick={() => handleSnapToCorner('back-right')}
                    className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[11px] font-semibold text-zinc-300 border border-zinc-700"
                  >
                    ↗ Sağ-Arka
                  </button>
                  <button
                    onClick={() => handleSnapToCorner('front-left')}
                    className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[11px] font-semibold text-zinc-300 border border-zinc-700"
                  >
                    ↙ Sol-Ön
                  </button>
                  <button
                    onClick={() => handleSnapToCorner('front-right')}
                    className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[11px] font-semibold text-zinc-300 border border-zinc-700"
                  >
                    ↘ Sağ-Ön
                  </button>
                </div>
              </div>

              {/* High Precision Coordinate Pad */}
              <div className="bg-zinc-950/70 p-2.5 rounded-lg border border-zinc-800 space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Hassas Milimetrik Konum (±{snapStep} mm)
                </span>
                <div className="space-y-1.5 text-xs">
                  {/* X */}
                  <div className="flex items-center justify-between bg-zinc-900 p-1.5 rounded border border-zinc-800">
                    <span className="text-zinc-400 font-bold">X (En):</span>
                    <span className="font-mono text-blue-400 font-bold">{Math.round(selectedBox.x * 10)} mm</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleNudgeSelected('x', -snapStep / 10)}
                        className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded font-mono font-bold text-[10px]"
                      >
                        -{snapStep}
                      </button>
                      <button
                        onClick={() => handleNudgeSelected('x', snapStep / 10)}
                        className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded font-mono font-bold text-[10px]"
                      >
                        +{snapStep}
                      </button>
                    </div>
                  </div>

                  {/* Z */}
                  <div className="flex items-center justify-between bg-zinc-900 p-1.5 rounded border border-zinc-800">
                    <span className="text-zinc-400 font-bold">Z (Boy):</span>
                    <span className="font-mono text-blue-400 font-bold">{Math.round(selectedBox.z * 10)} mm</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleNudgeSelected('z', -snapStep / 10)}
                        className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded font-mono font-bold text-[10px]"
                      >
                        -{snapStep}
                      </button>
                      <button
                        onClick={() => handleNudgeSelected('z', snapStep / 10)}
                        className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded font-mono font-bold text-[10px]"
                      >
                        +{snapStep}
                      </button>
                    </div>
                  </div>

                  {/* Y */}
                  <div className="flex items-center justify-between bg-zinc-900 p-1.5 rounded border border-zinc-800">
                    <span className="text-zinc-400 font-bold">Y (Yük.):</span>
                    <span className="font-mono text-amber-400 font-bold">{Math.round(selectedBox.y * 10)} mm</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleNudgeSelected('y', -snapStep / 10)}
                        className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded font-mono font-bold text-[10px]"
                      >
                        -{snapStep}
                      </button>
                      <button
                        onClick={() => handleNudgeSelected('y', snapStep / 10)}
                        className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded font-mono font-bold text-[10px]"
                      >
                        +{snapStep}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center text-zinc-500 gap-2">
              <Move size={28} className="text-zinc-600 mb-1" />
              <p className="text-xs font-semibold text-zinc-400">
                Koliyi seçmek için 2D Plan veya 3D sahneye tıklayın
              </p>
              <p className="text-[10px] text-zinc-600 max-w-[200px]">
                Seçili koliyi <strong>R</strong> ile çevirebilir, ok tuşlarıyla kaydırabilir, <strong>Delete</strong> ile silebilirsiniz.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
