import { Box, PackedBox, Pallet, PackingResult, PalletResult, CenterOfGravity, Margins } from '../types';

export class Packer {
  private pallet: Pallet;
  private boxes: Box[];

  constructor(pallet: Pallet, boxes: Box[]) {
    this.pallet = {
      ...pallet,
      maxWeight: pallet.maxWeight || 1500,
      tareWeight: pallet.tareWeight || 25
    };
    
    // Flatten boxes based on quantity
    this.boxes = boxes.flatMap(box => 
      Array.from({ length: Math.max(0, box.quantity) }, (_, i) => ({
        ...box,
        id: `${box.id}-${i}`,
        quantity: 1,
        weight: box.weight ?? Math.round((box.width * box.height * box.depth) / 3000 * 10) / 10
      }))
    );
  }

  public pack(): PackingResult {
    // Sort boxes:
    // 1. Boxes that must be on the floor first
    // 2. Boxes with heavier weight / larger footprint
    let remainingBoxes = [...this.boxes].sort((a, b) => {
      if (a.mustBeBottom && !b.mustBeBottom) return -1;
      if (!a.mustBeBottom && b.mustBeBottom) return 1;
      
      // Primary sort by height (group same-height boxes together so layers are level)
      if (Math.abs(b.height - a.height) > 0.5) {
        return b.height - a.height;
      }

      const volA = a.width * a.height * a.depth;
      const volB = b.width * b.height * b.depth;
      const weightA = a.weight || 0;
      const weightB = b.weight || 0;
      
      // Heavy items lower/first
      if (Math.abs(weightB - weightA) > 2) {
        return weightB - weightA;
      }
      return volB - volA;
    });

    const pallets: PalletResult[] = [];
    let palletCounter = 1;

    while (remainingBoxes.length > 0) {
      const result = this.packSinglePallet(remainingBoxes, `Palet ${palletCounter}`);
      
      if (result.packedBoxes.length === 0) {
        // Cannot fit even a single box into a fresh pallet
        break;
      }
      
      pallets.push(result);
      
      const packedIds = new Set(result.packedBoxes.map(b => b.id));
      remainingBoxes = remainingBoxes.filter(b => !packedIds.has(b.id));
      palletCounter++;
      
      // Safety limit for maximum pallets
      if (palletCounter > 50) break;
    }

    const totalPalletVolume = pallets.length * this.pallet.width * this.pallet.height * this.pallet.depth;
    const totalPackedVolume = pallets.reduce((sum, p) => sum + p.totalLoadedVolume, 0);
    const totalEfficiency = totalPalletVolume > 0 ? (totalPackedVolume / totalPalletVolume) * 100 : 0;
    const totalWeight = pallets.reduce((sum, p) => sum + p.actualWeight, 0);
    const totalBoxesPacked = pallets.reduce((sum, p) => sum + p.packedBoxes.length, 0);

    return {
      pallets,
      unpackedBoxes: remainingBoxes,
      totalEfficiency: Math.round(totalEfficiency * 10) / 10,
      totalWeight: Math.round(totalWeight * 10) / 10,
      totalBoxesPacked,
      totalBoxesRemaining: remainingBoxes.length
    };
  }

  public packSinglePallet(boxes: Box[], id: string): PalletResult {
    const packedBoxes: PackedBox[] = [];
    
    const width = Math.max(1, Math.ceil(this.pallet.width));
    const depth = Math.max(1, Math.ceil(this.pallet.depth));
    const palletHeight = Math.max(0, this.pallet.height);
    const maxWeight = this.pallet.maxWeight || 1500;

    const emptyResult: PalletResult = {
      id,
      pallet: { ...this.pallet },
      packedBoxes: [],
      efficiency: 0,
      actualWeight: 0,
      chargeableWeight: 0,
      totalLoadedVolume: 0,
      maxPackedHeight: 0,
      centerOfGravity: {
        x: width / 2,
        y: 0,
        z: depth / 2,
        idealX: width / 2,
        idealZ: depth / 2,
        xOffset: 0,
        zOffset: 0,
        deviationPercent: 0,
        status: 'perfect',
        statusLabel: 'Mükemmel Denge'
      },
      margins: {
        left: 0,
        right: 0,
        front: 0,
        back: 0,
        isXBalanced: true,
        isZBalanced: true
      },
      layerCount: 0
    };

    if (width <= 0 || depth <= 0 || palletHeight <= 0) {
      return emptyResult;
    }

    // 2D Height and stackability map
    const heightMap: { height: number; stackable: boolean }[][] = Array.from({ length: width }, () => 
      Array.from({ length: depth }, () => ({ height: 0, stackable: true }))
    );

    let currentPalletWeight = 0;

    for (const box of boxes) {
      const boxWeight = box.weight || 0;
      if (currentPalletWeight + boxWeight > maxWeight) {
        // Pallet weight capacity exceeded
        continue;
      }

      let bestX = -1;
      let bestZ = -1;
      let bestY = Infinity;
      let bestOrientation: { w: number; h: number; d: number; rotated: boolean } | null = null;
      let bestScore = Infinity;

      const orientations: { w: number; h: number; d: number; rotated: boolean }[] = [];
      
      // Default orientation
      orientations.push({ w: box.width, h: box.height, d: box.depth, rotated: false });
      
      // Y-axis horizontal 90° rotation (yaw)
      if (box.allowRotateY !== false) {
        orientations.push({ w: box.depth, h: box.height, d: box.width, rotated: true });
      }
      
      // Z-axis tilt forward/backward (roll)
      if (box.allowRotateZ === true) {
        orientations.push({ w: box.height, h: box.width, d: box.depth, rotated: true });
        if (box.allowRotateY !== false) {
          orientations.push({ w: box.depth, h: box.width, d: box.height, rotated: true });
        }
      }
      
      // X-axis tilt sideways (pitch)
      if (box.allowRotateX === true) {
        orientations.push({ w: box.width, h: box.depth, d: box.height, rotated: true });
        if (box.allowRotateY !== false) {
          orientations.push({ w: box.height, h: box.depth, d: box.width, rotated: true });
        }
      }

      // Filter unique valid orientations that fit inside pallet dimensions
      const uniqueOrientations: { w: number; h: number; d: number; rotated: boolean }[] = [];
      const seen = new Set<string>();
      for (const ori of orientations) {
        const key = `${Math.round(ori.w * 10)}-${Math.round(ori.h * 10)}-${Math.round(ori.d * 10)}`;
        if (!seen.has(key) && ori.w <= width && ori.d <= depth && ori.h <= palletHeight) {
          seen.add(key);
          uniqueOrientations.push(ori);
        }
      }

      // Collect valid candidate placements for this box
      const floorCandidates: {
        score: number;
        x: number;
        z: number;
        y: number;
        ori: { w: number; h: number; d: number; rotated: boolean };
      }[] = [];

      const upperCandidates: {
        score: number;
        x: number;
        z: number;
        y: number;
        ori: { w: number; h: number; d: number; rotated: boolean };
      }[] = [];

      for (const ori of uniqueOrientations) {
        const wGrid = Math.ceil(ori.w);
        const hVal = ori.h;
        const dGrid = Math.ceil(ori.d);

        // Candidate points: combination of box edge boundaries and fine grid step
        const xPoints = new Set<number>([0]);
        const zPoints = new Set<number>([0]);

        if (width - wGrid >= 0) xPoints.add(width - wGrid);
        if (depth - dGrid >= 0) zPoints.add(depth - dGrid);

        // Fine grid sampling step to guarantee no floor gaps are missed
        for (let gx = 0; gx <= width - wGrid; gx += 2) xPoints.add(gx);
        for (let gz = 0; gz <= depth - dGrid; gz += 2) zPoints.add(gz);

        for (const pb of packedBoxes) {
          const pbGridW = Math.ceil(pb.width);
          const pbGridD = Math.ceil(pb.depth);

          if (pb.x + pbGridW <= width - wGrid) xPoints.add(pb.x + pbGridW);
          if (pb.x <= width - wGrid) xPoints.add(pb.x);
          if (pb.x + pbGridW - wGrid >= 0) xPoints.add(pb.x + pbGridW - wGrid);
          if (pb.x - wGrid >= 0) xPoints.add(pb.x - wGrid);

          if (pb.z + pbGridD <= depth - dGrid) zPoints.add(pb.z + pbGridD);
          if (pb.z <= depth - dGrid) zPoints.add(pb.z);
          if (pb.z + pbGridD - dGrid >= 0) zPoints.add(pb.z + pbGridD - dGrid);
          if (pb.z - dGrid >= 0) zPoints.add(pb.z - dGrid);
        }

        const sortedX = Array.from(xPoints).sort((a, b) => a - b);
        const sortedZ = Array.from(zPoints).sort((a, b) => a - b);

        for (const x of sortedX) {
          if (x + wGrid > width) continue;

          for (const z of sortedZ) {
            if (z + dGrid > depth) continue;

            let maxH = 0;
            let minH = Infinity;
            let isStackable = true;

            for (let ix = x; ix < x + wGrid; ix++) {
              for (let iz = z; iz < z + dGrid; iz++) {
                if (ix >= width || iz >= depth) {
                  isStackable = false;
                  break;
                }
                const cell = heightMap[ix][iz];
                if (cell.height > maxH) maxH = cell.height;
                if (cell.height < minH) minH = cell.height;
              }
              if (!isStackable) break;
            }

            if (!isStackable || maxH + hVal > palletHeight) continue;

            const centerX = x + ori.w / 2;
            const centerZ = z + ori.d / 2;
            const distFromPalletCenter = Math.hypot(centerX - width / 2, centerZ - depth / 2);

            const touchesLeft = x === 0;
            const touchesBack = z === 0;
            const touchesRight = x + wGrid === width;
            const touchesFront = z + dGrid === depth;
            const wallTouches = (touchesLeft ? 1 : 0) + (touchesBack ? 1 : 0) + (touchesRight ? 1 : 0) + (touchesFront ? 1 : 0);

            if (maxH === 0) {
              // Floor candidate
              const score = (z * 100) + (x * 10) + (distFromPalletCenter * 2) - (wallTouches * 15);
              floorCandidates.push({
                score,
                x,
                z,
                y: 0,
                ori
              });
            } else {
              // Upper candidate (maxH > 0)
              if (box.mustBeBottom) continue;

              // STRICT LEVEL SUPPORT CHECK:
              // To prevent ANY box from floating in the air over underlying boxes of different heights,
              // all cells under the box footprint MUST have height equal to maxH (no lower gaps).
              if (Math.abs(maxH - minH) > 0.2) continue;

              // Check if underlying surface allows stacking
              for (let ix = x; ix < x + wGrid; ix++) {
                for (let iz = z; iz < z + dGrid; iz++) {
                  const cell = heightMap[ix][iz];
                  if (!cell.stackable) {
                    isStackable = false;
                    break;
                  }
                }
                if (!isStackable) break;
              }
              if (!isStackable) continue;

              // Score for upper candidate: prefer lowest maxH first, then row z, col x
              const score = (maxH * 100000) + (z * 100) + (x * 10) + (distFromPalletCenter * 2) - (wallTouches * 15);
              upperCandidates.push({
                score,
                x,
                z,
                y: maxH,
                ori
              });
            }
          }
        }
      }

      // Pick best candidate: Floor candidates ALWAYS take absolute priority over upper candidates!
      let bestChoice: {
        x: number;
        z: number;
        y: number;
        ori: { w: number; h: number; d: number; rotated: boolean };
      } | null = null;

      if (floorCandidates.length > 0) {
        floorCandidates.sort((a, b) => a.score - b.score);
        bestChoice = floorCandidates[0];
      } else if (upperCandidates.length > 0) {
        upperCandidates.sort((a, b) => a.score - b.score);
        bestChoice = upperCandidates[0];
      }

      if (bestChoice) {
        const { x, z, y, ori } = bestChoice;
        const gridW = Math.ceil(ori.w);
        const gridD = Math.ceil(ori.d);

        packedBoxes.push({
          ...box,
          width: ori.w,
          height: ori.h,
          depth: ori.d,
          x,
          y,
          z,
          rotated: ori.rotated,
          sequenceNumber: packedBoxes.length + 1
        });

        currentPalletWeight += boxWeight;

        for (let ix = x; ix < x + gridW; ix++) {
          for (let iz = z; iz < z + gridD; iz++) {
            if (ix < width && iz < depth) {
              heightMap[ix][iz] = {
                height: y + ori.h,
                stackable: box.stackable !== false
              };
            }
          }
        }
      }
    }

    if (packedBoxes.length === 0) {
      return emptyResult;
    }

    // --- USER REQUEST: STRICT CENTER ALIGNMENT & EQUAL OPPOSITE MARGINS ---
    // "koli yerleşimi paletin tek bir tarafına yığılmasın. ağırlık dengesi için hep palet ortalansın.
    // koli yerleşiminde paletin karşılıklı kenarlarına olan mesafe eşit olsun"
    const minX = Math.min(...packedBoxes.map(b => b.x));
    const maxX = Math.max(...packedBoxes.map(b => b.x + b.width));
    const minZ = Math.min(...packedBoxes.map(b => b.z));
    const maxZ = Math.max(...packedBoxes.map(b => b.z + b.depth));

    const usedWidth = maxX - minX;
    const usedDepth = maxZ - minZ;

    // Center offset ensuring (pallet.width - usedWidth) / 2 is applied
    const targetLeft = Math.max(0, (this.pallet.width - usedWidth) / 2);
    const targetBack = Math.max(0, (this.pallet.depth - usedDepth) / 2);

    const shiftX = targetLeft - minX;
    const shiftZ = targetBack - minZ;

    for (const pb of packedBoxes) {
      pb.x = Math.round((pb.x + shiftX) * 10) / 10;
      pb.z = Math.round((pb.z + shiftZ) * 10) / 10;
    }

    // Determine layers by distinct Y positions
    const yLevels = Array.from(new Set(packedBoxes.map(b => Math.round(b.y * 10) / 10))).sort((a, b) => a - b);
    for (const pb of packedBoxes) {
      const idx = yLevels.findIndex(lvl => Math.abs(lvl - pb.y) < 0.2);
      pb.layerIndex = idx >= 0 ? idx + 1 : 1;
    }

    // Calculate margins in mm
    const finalMinX = Math.min(...packedBoxes.map(b => b.x));
    const finalMaxX = Math.max(...packedBoxes.map(b => b.x + b.width));
    const finalMinZ = Math.min(...packedBoxes.map(b => b.z));
    const finalMaxZ = Math.max(...packedBoxes.map(b => b.z + b.depth));

    const leftMarginMm = Math.max(0, Math.round(finalMinX * 10));
    const rightMarginMm = Math.max(0, Math.round((this.pallet.width - finalMaxX) * 10));
    const frontMarginMm = Math.max(0, Math.round(finalMinZ * 10));
    const backMarginMm = Math.max(0, Math.round((this.pallet.depth - finalMaxZ) * 10));

    const margins: Margins = {
      left: leftMarginMm,
      right: rightMarginMm,
      front: frontMarginMm,
      back: backMarginMm,
      isXBalanced: Math.abs(leftMarginMm - rightMarginMm) <= 2,
      isZBalanced: Math.abs(frontMarginMm - backMarginMm) <= 2
    };

    // Calculate Center of Gravity (CoG)
    let totalMass = 0;
    let sumMx = 0;
    let sumMy = 0;
    let sumMz = 0;

    for (const pb of packedBoxes) {
      const mass = (pb.weight && pb.weight > 0) ? pb.weight : (pb.width * pb.height * pb.depth) / 1000;
      totalMass += mass;
      sumMx += mass * (pb.x + pb.width / 2);
      sumMy += mass * (pb.y + pb.height / 2);
      sumMz += mass * (pb.z + pb.depth / 2);
    }

    const cgX = totalMass > 0 ? sumMx / totalMass : this.pallet.width / 2;
    const cgY = totalMass > 0 ? sumMy / totalMass : 0;
    const cgZ = totalMass > 0 ? sumMz / totalMass : this.pallet.depth / 2;

    const idealX = this.pallet.width / 2;
    const idealZ = this.pallet.depth / 2;
    const xOffset = cgX - idealX;
    const zOffset = cgZ - idealZ;

    const maxRadius = Math.hypot(idealX, idealZ);
    const offsetRadius = Math.hypot(xOffset, zOffset);
    const deviationPercent = Math.min(100, Math.round((offsetRadius / maxRadius) * 1000) / 10);

    let cogStatus: CenterOfGravity['status'] = 'perfect';
    let cogStatusLabel = 'Mükemmel Denge (%0-%3 sapma)';

    if (deviationPercent <= 4) {
      cogStatus = 'perfect';
      cogStatusLabel = 'Mükemmel Denge';
    } else if (deviationPercent <= 10) {
      cogStatus = 'good';
      cogStatusLabel = 'İyi Denge';
    } else if (deviationPercent <= 18) {
      cogStatus = 'warning';
      cogStatusLabel = 'Hafif Dengesiz';
    } else {
      cogStatus = 'critical';
      cogStatusLabel = 'Kritik Dengesiz (Palet devrilme riski)';
    }

    const centerOfGravity: CenterOfGravity = {
      x: Math.round(cgX * 10) / 10,
      y: Math.round(cgY * 10) / 10,
      z: Math.round(cgZ * 10) / 10,
      idealX,
      idealZ,
      xOffset: Math.round(xOffset * 10) / 10,
      zOffset: Math.round(zOffset * 10) / 10,
      deviationPercent,
      status: cogStatus,
      statusLabel: cogStatusLabel
    };

    const totalVolume = this.pallet.width * this.pallet.height * this.pallet.depth;
    const totalLoadedVolume = packedBoxes.reduce((sum, b) => sum + (b.width * b.height * b.depth), 0);
    const efficiency = totalVolume > 0 ? Math.round((totalLoadedVolume / totalVolume) * 1000) / 10 : 0;

    const actualWeight = Math.round(packedBoxes.reduce((sum, b) => sum + (b.weight || 0), 0) * 10) / 10;
    const maxPackedHeight = Math.round(packedBoxes.reduce((max, b) => Math.max(max, b.y + b.height), 0) * 10) / 10;
    
    // IATA Standard Volumetric Weight (L x W x H in cm / 5000 or 6000)
    const chargeableWeight = Math.round(((this.pallet.width * this.pallet.depth * maxPackedHeight) / 5000) * 10) / 10;

    return {
      id,
      pallet: { ...this.pallet },
      packedBoxes,
      efficiency,
      actualWeight,
      chargeableWeight,
      totalLoadedVolume,
      maxPackedHeight,
      centerOfGravity,
      margins,
      layerCount: yLevels.length
    };
  }
}
