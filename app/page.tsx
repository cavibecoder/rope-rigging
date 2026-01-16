'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Node, Segment, Rope, solveEquilibrium, SimulationResult, solveSkateBlock } from './utils/PhysicsEngine';
import { Vector2 } from './utils/Vector2';
import Controls from './components/Controls';

const Canvas = dynamic(() => import('./components/Canvas'), { ssr: false });

const INITIAL_LOAD = 100;
const INITIAL_SKYLINE_TENSION = 200;

export default function Home() {
  const [loadWeight, setLoadWeight] = useState(INITIAL_LOAD);
  const [efficiency, setEfficiency] = useState(1.0);
  const [maCount, setMaCount] = useState(1);
  const [preset, setPreset] = useState<'SIMPLE' | 'COMPLEX' | 'SKATE_BLOCK'>('SIMPLE');

  // Skate Block Specific State
  const [ropeATension, setRopeATension] = useState(INITIAL_SKYLINE_TENSION);
  // We need to track Carriage X specifically for Skate Block, 
  // because Physics Engine solves Y based on X.
  // Default to center.
  const [carriageX, setCarriageX] = useState(400);

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

  const generateComplexRig = useCallback(() => {
    // Single Rope Path Topology (Reeve-style Highline)
    // Path: Port-a-wrap (Haul) -> Tree Top (Redirect) -> Oval+Triple (Carriage) 
    //       -> Building Anchor -> Oval+Triple -> Load Block -> Oval+Triple (Becket)

    // Nodes with descriptive labels
    const n_portawrap = {
      id: 'n_portawrap',
      position: new Vector2(750, 500),
      type: 'ANCHOR' as const,
      label: 'Port-a-wrap'
    };

    const n_tree_top = {
      id: 'n_tree_top',
      position: new Vector2(750, 120),
      type: 'PULLEY_ANCHOR' as const,
      label: 'Tree Top Redirect'
    };

    const n_building = {
      id: 'n_building',
      position: new Vector2(100, 100),
      type: 'ANCHOR' as const,
      label: 'Building Anchor'
    };

    const n_carriage = {
      id: 'n_carriage',
      position: new Vector2(400, 220),
      type: 'PULLEY_FREE' as const,
      label: 'Oval+Triple'
    };

    const n_load = {
      id: 'n_load',
      position: new Vector2(400, 400),
      type: 'LOAD' as const,
      label: 'Load Block'
    };

    const newNodes: Node[] = [n_portawrap, n_tree_top, n_building, n_carriage, n_load];

    // Single continuous rope segments
    const s1 = { id: 's1', nodeAId: 'n_portawrap', nodeBId: 'n_tree_top' };      // Haul up
    const s2 = { id: 's2', nodeAId: 'n_tree_top', nodeBId: 'n_carriage' };       // Redirect to carriage
    const s3 = { id: 's3', nodeAId: 'n_carriage', nodeBId: 'n_building' };       // Highline left
    const s4 = { id: 's4', nodeAId: 'n_building', nodeBId: 'n_carriage' };       // Highline right
    const s5 = { id: 's5', nodeAId: 'n_carriage', nodeBId: 'n_load' };           // Down to load
    const s6 = { id: 's6', nodeAId: 'n_load', nodeBId: 'n_carriage' };           // Back up (2:1 on load)

    const newSegments = [s1, s2, s3, s4, s5, s6];

    // Single rope containing all segments in order
    const mainRope: Rope = {
      id: 'r_main',
      segmentIds: ['s1', 's2', 's3', 's4', 's5', 's6'],
      color: '#3b82f6'
    };

    setNodes(newNodes);
    setSegments(newSegments);
    setRopes([mainRope]);
  }, []);

  const generateSkateBlock = useCallback(() => {
    // Skate Block Topology
    // Anchors: Building (Left), Tree (Right).
    // Carriage: A composite object visually, but single physics point for now.
    // Actually, user wants "visibly separated" pulleys.
    // Let's define the nodes.

    const C_X = 400;
    const C_Y = 200; // Initial guess

    const n_building = {
      id: 'n_building',
      position: new Vector2(100, 100),
      type: 'ANCHOR' as const,
      label: 'Building Anchor'
    };

    const n_tree = {
      id: 'n_tree',
      position: new Vector2(700, 100),
      type: 'ANCHOR' as const,
      label: 'Tree Top Redirect'
    };

    // The carriage is the logic center. We will solve for its Y.
    // Visually we will render Pulleys 1, 2, 3, 4 around this center.
    const n_carriage = {
      id: 'n_carriage',
      position: new Vector2(C_X, C_Y),
      type: 'PULLEY_FREE' as const,
      label: 'Carriage'
    };

    const n_load = {
      id: 'n_load',
      position: new Vector2(C_X, C_Y + 100), // Load hangs below carriage
      type: 'LOAD' as const,
      label: 'Load'
    };

    // Rope A (Skyline) segments
    // A1: Building -> Carriage
    // A2: Carriage -> Tree
    // A3: Tree -> Port-a-wrap (Visual only really, represents tension source)
    // We can just draw A1 and A2 for the main triangle.
    // User requested "Port-a-wrap" visual.
    const n_portawrap = {
      id: 'n_portawrap',
      position: new Vector2(700, 450),
      type: 'ANCHOR' as const,
      label: 'Port a wrap'
    };

    // Rope A (Skyline) segments
    // A1: Building -> Carriage; A2: Carriage -> Tree; A3: Tree -> Port-a-wrap
    const sa1 = { id: 'sa1', nodeAId: 'n_building', nodeBId: 'n_carriage' };
    const sa2 = { id: 'sa2', nodeAId: 'n_carriage', nodeBId: 'n_tree' };
    const sa3 = { id: 'sa3', nodeAId: 'n_tree', nodeBId: 'n_portawrap' };

    // Rope B (Control Left)
    // Carriage(P1) -> Building -> Carriage(P3) -> Load (2 strands left support)
    const sb1 = { id: 'sb1', nodeAId: 'n_carriage', nodeBId: 'n_building' };
    const sb2 = { id: 'sb2', nodeAId: 'n_building', nodeBId: 'n_carriage' };
    const sb3 = { id: 'sb3', nodeAId: 'n_carriage', nodeBId: 'n_load' };

    // Rope C (Control Right)
    // Carriage(P2) -> Tree -> Carriage(P4) -> Load (2 strands right support)
    const sc1 = { id: 'sc1', nodeAId: 'n_carriage', nodeBId: 'n_tree' };
    const sc2 = { id: 'sc2', nodeAId: 'n_tree', nodeBId: 'n_carriage' }; // Loop back
    const sc3 = { id: 'sc3', nodeAId: 'n_carriage', nodeBId: 'n_load' };
    // remove sc4 (Port-a-wrap on C)

    const newNodes = [n_building, n_tree, n_carriage, n_load, n_portawrap];
    const newSegments = [sa1, sa2, sa3, sb1, sb2, sb3, sc1, sc2, sc3];

    // Ropes for coloring
    const ropeA: Rope = { id: 'ropeA', segmentIds: ['sa3', 'sa2', 'sa1'], color: '#3b82f6' }; // Blue
    const ropeB: Rope = { id: 'ropeB', segmentIds: ['sb1', 'sb2', 'sb3'], color: '#ef4444' }; // Red
    const ropeC: Rope = { id: 'ropeC', segmentIds: ['sc1', 'sc2', 'sc3'], color: '#10b981' }; // Green

    setNodes(newNodes);
    setSegments(newSegments);
    setRopes([ropeA, ropeB, ropeC]);

  }, []);

  useEffect(() => {
    if (preset === 'SIMPLE') {
      generateSystem(maCount);
    } else if (preset === 'COMPLEX') {
      generateComplexRig();
    } else {
      generateSkateBlock();
    }
  }, [maCount, preset, generateSystem, generateComplexRig, generateSkateBlock]);

  useEffect(() => {
    if (preset === 'SKATE_BLOCK') {
      const building = nodes.find(n => n.id === 'n_building');
      const tree = nodes.find(n => n.id === 'n_tree');
      if (building && tree) {
        // Solve Skate Block Geometry
        // We use the stored carriageX state.
        const sbRes = solveSkateBlock(
          building.position,
          tree.position,
          carriageX,
          ropeATension,
          loadWeight,
          efficiency
        );

        // Update Carriage Y in nodes
        setNodes(prev => prev.map(n => {
          if (n.id === 'n_carriage') {
            return { ...n, position: new Vector2(carriageX, sbRes.carriageY) };
          }
          if (n.id === 'n_load') {
            // Load hangs below carriage, let's say 100px fixed for now?
            // Or physics? Rope B/C length...
            // Let's just visually hang it 100px below.
            return { ...n, position: new Vector2(carriageX, sbRes.carriageY + 100) };
          }
          return n;
        }));

        // Map results to SimulationResult format
        const tensionMap = new Map<string, number>();
        // Rope A
        tensionMap.set('sa1', sbRes.tensionA);
        tensionMap.set('sa2', sbRes.tensionA);
        tensionMap.set('sa3', sbRes.tensionA);

        // Rope B
        tensionMap.set('sb1', sbRes.tensionB);
        tensionMap.set('sb2', sbRes.tensionB);
        tensionMap.set('sb3', sbRes.tensionB);

        // Rope C
        tensionMap.set('sc1', sbRes.tensionC);
        tensionMap.set('sc2', sbRes.tensionC);
        tensionMap.set('sc3', sbRes.tensionC);

        setResult({
          tensions: tensionMap,
          nodeForces: new Map(), // Not strictly needed for visual unless we want arrows
          stats: {
            haulTension: sbRes.tensionA,
            loadRef: loadWeight,
            idealMA: 0,
            effectiveMA: 0
          }
        });
      }
    } else {
      // Standard Solver
      const targetMA = preset === 'SIMPLE' ? maCount : undefined;
      const res = solveEquilibrium(nodes, segments, ropes, loadWeight, efficiency, targetMA);
      setResult(res);
    }
  }, [nodes, segments, ropes, loadWeight, efficiency, maCount, preset, ropeATension, carriageX]);

  const handleNodeMove = useCallback((nodeId: string, pos: Vector2) => {
    if (preset === 'SKATE_BLOCK') {
      // For Skate Block, dragging logic is specific.
      // If user drags Carriage or Load, we update carriageX.
      // Y is determined by physics solver in next render.
      if (nodeId === 'n_carriage' || nodeId === 'n_load') {
        // Clamp X between anchors
        // Use static anchor positions for now (should lookup)
        const minX = 120;
        const maxX = 680;
        const clampedX = Math.max(minX, Math.min(maxX, pos.x));
        setCarriageX(clampedX);
      }
      // If anchors move? Not supported yet for simplicity.
    } else {
      setNodes(prev => prev.map(n => {
        if (n.id === nodeId) {
          return { ...n, position: pos };
        }
        return n;
      }));
    }
  }, [preset]);

  const handleReset = () => {
    setPreset('SIMPLE');
    setMaCount(1);
    setEfficiency(1.0);
    setLoadWeight(INITIAL_LOAD);
    setRopeATension(INITIAL_SKYLINE_TENSION);
    setCarriageX(400);
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
        onPreset={(val) => {
          if (val === 2) setPreset('SKATE_BLOCK');
          else if (val === 1) setPreset('COMPLEX');
          else setPreset('SIMPLE');
        }}
        currentPreset={preset}
        onReset={handleReset}
        ropeATension={ropeATension}
        setRopeATension={setRopeATension}
      />
      <div className="main-content">
        <Canvas
          nodes={nodes}
          segments={segments}
          ropes={ropes}
          result={result}
          loadWeight={loadWeight}
          onNodeMove={handleNodeMove}
          preset={preset}
        />
      </div>
    </div>
  );
}

function resultsMax(map: Map<string, number>): number {
  if (map.size === 0) return 0;
  return Math.round(Math.max(...Array.from(map.values())));
}
