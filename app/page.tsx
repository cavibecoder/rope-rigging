'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Node, Segment, Rope, solveEquilibrium, SimulationResult } from './utils/PhysicsEngine';
import { Vector2 } from './utils/Vector2';
import Controls from './components/Controls';

const Canvas = dynamic(() => import('./components/Canvas'), { ssr: false });

const INITIAL_LOAD = 100;

export default function Home() {
  const [loadWeight, setLoadWeight] = useState(INITIAL_LOAD);
  const [efficiency, setEfficiency] = useState(1.0);
  const [maCount, setMaCount] = useState(1);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [ropes, setRopes] = useState<Rope[]>([]);

  const [result, setResult] = useState<SimulationResult>({
    tensions: new Map(),
    nodeForces: new Map(),
    stats: { haulTension: 0, loadRef: 0, idealMA: 0, effectiveMA: 0 }
  });

  // Generates N:1 Block & Tackle System with Correct Topology
  const generateSystem = useCallback((ma: number) => {
    // 1. Define Fixed Positions
    const anchorPos = new Vector2(400, 50);
    const loadPos = new Vector2(400, 300);

    // Rope Path Logic
    // Even (2, 4): Pull Up (End at Load). Total Lines = MA.
    // Odd (3, 5): Pull Down from Anchor (End at A). Total Lines = MA.
    // Odd (1): Pull Down from Anchor (Start Load).

    const isEven = ma % 2 === 0;
    const isOne = ma === 1;

    // Haul Position
    // Even: Up (50). Odd: Down (450).
    const haulPos = new Vector2(500, isEven ? 50 : 450);

    const newNodes: Node[] = [
      { id: 'n_anchor', position: anchorPos, type: 'PULLEY_ANCHOR', sheaveCount: Math.ceil((ma + 1) / 2) },
      { id: 'n_load', position: loadPos, type: 'PULLEY_FREE', sheaveCount: Math.floor((ma + 1) / 2) },
      { id: 'n_haul', position: haulPos, type: 'FREE' }
    ];

    const newSegments: Segment[] = [];
    const ropeSegments: string[] = [];

    // Start Node Logic
    // MA=1: Start Load (L->A->H)
    // MA>1: Start Anchor (A->...->H)
    let currNodeId = isOne ? 'n_load' : 'n_anchor';

    // Loop Logic
    // Total Lines (Support + Haul) should equal MA (visually).
    // Loop creates Support segments.
    // Support Segments = MA - 1 (for all MA > 1).
    // For 1:1, Support = 1.
    const loopCount = isOne ? 1 : ma - 1;

    for (let i = 0; i < loopCount; i++) {
      const nextNodeId = currNodeId === 'n_anchor' ? 'n_load' : 'n_anchor';
      newSegments.push({ id: `s_${i}`, nodeAId: currNodeId, nodeBId: nextNodeId });
      ropeSegments.push(`s_${i}`);
      currNodeId = nextNodeId;
    }

    // Final Segment -> Haul
    const haulSegId = `s_haul`;
    newSegments.push({ id: haulSegId, nodeAId: currNodeId, nodeBId: 'n_haul' });
    ropeSegments.push(haulSegId);

    // Reverse rope order so Haul is Source (Index 0)
    const orderedSegments = [...ropeSegments].reverse();
    const newRope: Rope = { id: 'r1', segmentIds: orderedSegments };

    setNodes(newNodes);
    setSegments(newSegments);
    setRopes([newRope]);

  }, []);

  useEffect(() => {
    generateSystem(maCount);
  }, [maCount, generateSystem]);

  useEffect(() => {
    // Pass maCount as targetMA for safety check
    const res = solveEquilibrium(nodes, segments, ropes, loadWeight, efficiency, maCount);
    setResult(res);
  }, [nodes, segments, ropes, loadWeight, efficiency, maCount]);

  const handleNodeMove = useCallback((nodeId: string, pos: Vector2) => {
    // With simplified nodes, drag is easy.
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        // Constraint: X position of Anchor and Load should align? 
        // Or allow free move?
        // User said "remove floating feeling".
        // Maybe keep them vertically aligned if user drags one?
        // MVP: Allow free drag.
        return { ...n, position: pos };
      }
      return n;
    }));
  }, []);

  const handleReset = () => {
    setMaCount(1);
    setEfficiency(1.0);
    setLoadWeight(INITIAL_LOAD);
  };

  return (
    <div className="app-container">
      <Controls
        loadWeight={loadWeight}
        setLoadWeight={setLoadWeight}
        efficiency={efficiency}
        setEfficiency={setEfficiency}
        nodeCount={nodes.length}
        segmentCount={segments.length}
        maxTension={resultsMax(result.tensions)}
        stats={result.stats}
        maCount={maCount}
        setMaCount={setMaCount}
        onPreset={() => { }}
        onReset={handleReset}
      />
      <div className="main-content">
        <Canvas
          nodes={nodes}
          segments={segments}
          ropes={ropes}
          result={result}
          loadWeight={loadWeight}
          onNodeMove={handleNodeMove}
        />
      </div>
    </div>
  );
}

function resultsMax(map: Map<string, number>): number {
  if (map.size === 0) return 0;
  return Math.round(Math.max(...Array.from(map.values())));
}
