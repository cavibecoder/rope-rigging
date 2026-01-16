'use client';

import React, { useRef, useState } from 'react';
import { Node, Segment, SimulationResult, Rope } from '../utils/PhysicsEngine';
import { Vector2 } from '../utils/Vector2';

interface CanvasProps {
    nodes: Node[];
    segments: Segment[];
    ropes?: Rope[];
    result: SimulationResult;
    loadWeight: number;
    onNodeMove: (nodeId: string, pos: Vector2) => void;
    preset?: 'SIMPLE' | 'COMPLEX' | 'SKATE_BLOCK';
}

export default function Canvas({ nodes, segments, ropes, result, loadWeight, onNodeMove, preset = 'SIMPLE' }: CanvasProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

    const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
        if (!svgRef.current) return new Vector2(0, 0);
        const CTM = svgRef.current.getScreenCTM();
        if (!CTM) return new Vector2(0, 0);

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return new Vector2(
            (clientX - CTM.e) / CTM.a,
            (clientY - CTM.f) / CTM.d
        );
    };

    const handleStart = (e: React.MouseEvent | React.TouchEvent, nodeId: string) => {
        e.preventDefault();
        setDraggingNodeId(nodeId);
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!draggingNodeId) return;
        const pos = getMousePos(e);
        onNodeMove(draggingNodeId, pos);
    };

    const handleEnd = () => {
        setDraggingNodeId(null);
    };

    const getTensionColor = (tension: number) => {
        if (tension > loadWeight * 2) return '#ef4444';
        if (tension > loadWeight * 1.5) return '#f97316';
        if (tension > loadWeight) return '#eab308';
        return '#3b82f6';
    };

    const getStrokeWidth = (tension: number) => {
        return Math.max(2, Math.min(6, 2 + (tension / loadWeight) * 2));
    };

    // Render Anchor and Load Nodes as Circles (Blocks)
    const renderBlockNodes = () => {
        const anchors = nodes.filter(n => n.type === 'ANCHOR' || n.type === 'PULLEY_ANCHOR');
        const loads = nodes.filter(n => n.type === 'LOAD');
        const floaters = nodes.filter(n => n.type === 'PULLEY_FREE');

        // Safety check for shallow angles
        const carriage = nodes.find(n => n.id === 'n_carriage');
        const building = nodes.find(n => n.id === 'n_building');
        const treeTop = nodes.find(n => n.id === 'n_tree_top');
        let isUnsafe = false;
        let leftAngle = 0;
        let rightAngle = 0;

        if (preset === 'COMPLEX' && carriage && building && treeTop) {
            const avgY = (building.position.y + treeTop.position.y) / 2;
            const sag = carriage.position.y - avgY;
            const span = Math.abs(building.position.x - treeTop.position.x);
            const angle = Math.atan2(Math.abs(sag), span / 2) * (180 / Math.PI);
            if (angle < 10) isUnsafe = true;

            // Calculate angles: 0° = down (toward load), 90° = horizontal, 180° = up (toward anchor)
            // Left: Building -> Carriage
            const leftDx = carriage.position.x - building.position.x;
            const leftDy = carriage.position.y - building.position.y;
            // atan2(dy, dx) gives angle from positive x-axis, we want from negative y-axis (down)
            const leftRad = Math.atan2(leftDx, leftDy);
            leftAngle = leftRad * (180 / Math.PI);

            // Right: TreeTop -> Carriage  
            const rightDx = carriage.position.x - treeTop.position.x;
            const rightDy = carriage.position.y - treeTop.position.y;
            const rightRad = Math.atan2(rightDx, rightDy);
            rightAngle = rightRad * (180 / Math.PI);
        }

        return (
            <>
                {isUnsafe && (
                    <text x={400} y={50} textAnchor="middle" fill="#ef4444" fontSize="16" fontWeight="bold">
                        ⚠️ UNSAFE GEOMETRY (near-horizontal)
                    </text>
                )}

                {/* Geometry Info */}
                {preset === 'COMPLEX' && carriage && (
                    <g>
                        <text x={carriage.position.x + 40} y={carriage.position.y - 10} fill="#1f2937" fontSize="10" fontFamily="monospace">
                            Left angle: {Math.round(leftAngle)}°
                        </text>
                        <text x={carriage.position.x + 40} y={carriage.position.y + 5} fill="#1f2937" fontSize="10" fontFamily="monospace">
                            Right angle: {Math.round(rightAngle)}°
                        </text>
                        <text x={carriage.position.x + 40} y={carriage.position.y + 20} fill="#1f2937" fontSize="10" fontFamily="monospace" fontWeight="bold">
                            Effective MA: {result.stats.effectiveMA.toFixed(2)} : 1
                        </text>
                    </g>
                )}
                {anchors.map(node => {
                    const f = result.nodeForces.get(node.id);
                    return (
                        <g key={node.id}>
                            {/* Resultant Force Vector behind */}
                            {f && f.length() > 1 && (
                                <line
                                    x1={node.position.x} y1={node.position.y}
                                    x2={node.position.x + f.x * 0.5}
                                    y2={node.position.y + f.y * 0.5}
                                    stroke="#10b981" strokeWidth="4" markerEnd="url(#arrowhead-resultant)"
                                />
                            )}

                            {/* Anchor Circle */}
                            <circle cx={node.position.x} cy={node.position.y} r={12} fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2" />
                            <circle cx={node.position.x} cy={node.position.y} r={4} fill="#6b7280" />

                            {/* Custom Label */}
                            {(preset === 'COMPLEX' || preset === 'SKATE_BLOCK') ? (
                                <text x={node.position.x} y={node.position.y - 25} textAnchor="middle" fill="#6b7280" fontSize="10" fontWeight="bold">
                                    {node.label || 'Anchor'}
                                </text>
                            ) : (
                                <text x={node.position.x} y={node.position.y - 25} textAnchor="middle" fill="#6b7280" fontSize="14" fontWeight="bold">
                                    Anchor
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* Complex Rig: Special Labels for Anchors */}
                {preset === 'COMPLEX' && anchors.map(node => {
                    const f = result.nodeForces.get(node.id);
                    if (!f || f.length() < 1) return null;

                    // Show Resultant Force
                    return (
                        <g key={`force-${node.id}`}>
                            <text x={node.position.x + 15} y={node.position.y - 15} fill="#10b981" fontSize="11" fontWeight="bold">
                                R: {Math.round(f.length())}kg
                            </text>
                        </g>
                    )
                })}

                {/* Floating Blocks (Weightless) */}
                {floaters.map(node => (
                    <g key={node.id}>
                        <circle cx={node.position.x} cy={node.position.y} r={12} fill="#ddd6fe" stroke="#8b5cf6" strokeWidth="2" />
                        <circle cx={node.position.x} cy={node.position.y} r={4} fill="#8b5cf6" />
                    </g>
                ))}

                {loads.map(node => {
                    return (
                        <g key={node.id}>
                            {/* Load Gravity Vector */}
                            <line
                                x1={node.position.x} y1={node.position.y}
                                x2={node.position.x} y2={node.position.y + 80}
                                stroke="#a855f7" strokeWidth="4" markerEnd="url(#arrowhead-load)"
                            />

                            {/* Load Circle */}
                            <circle cx={node.position.x} cy={node.position.y} r={12} fill="#f3e8ff" stroke="#a855f7" strokeWidth="2" />
                            <circle cx={node.position.x} cy={node.position.y} r={4} fill="#a855f7" />

                            <text x={node.position.x + 20} y={node.position.y + 5} fill="#a855f7" fontWeight="bold" fontSize="10">
                                {preset === 'COMPLEX' && node.label ? node.label : `Load (${loadWeight}kg)`}
                            </text>
                        </g>
                    );
                })}
            </>
        );
    };

    return (
        <svg
            ref={svgRef}
            style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair', touchAction: 'none' }}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
        >
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" opacity="0.8" />
                </marker>
                <marker id="arrowhead-resultant" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" opacity="0.8" />
                </marker>
                <marker id="arrowhead-haul" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                    <polygon points="0 1, 12 6, 0 11" fill="#ec4899" />
                </marker>
                <marker id="arrowhead-load" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                    <polygon points="0 1, 12 6, 0 11" fill="#a855f7" />
                </marker>
            </defs>

            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="gray" strokeWidth="0.5" opacity="0.1" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {renderBlockNodes()}

            {/* Segments (Ropes) */}
            {(() => {
                if (!ropes || ropes.length === 0) return null;

                if (preset === 'COMPLEX' || preset === 'SKATE_BLOCK') {
                    return segments.map(seg => {
                        const nodeA = nodes.find(n => n.id === seg.nodeAId);
                        const nodeB = nodes.find(n => n.id === seg.nodeBId);
                        if (!nodeA || !nodeB) return null;

                        const tension = result.tensions.get(seg.id) || 0;

                        // Skate Block Visual Offsets
                        // We offset the connection points if they touch 'n_carriage'
                        let startPos = nodeA.position;
                        let endPos = nodeB.position;

                        if (preset === 'SKATE_BLOCK') {
                            const getOffset = (nodeId: string, segId: string): Vector2 => {
                                // Carriage Offsets
                                if (nodeId === 'n_carriage') {
                                    // P1: (-30, -15), P2: (+30, -15), P3: (-30, +15), P4: (+30, +15)
                                    // Rope A (Skyline)
                                    if (segId === 'sa1') return new Vector2(-30, -15); // Build -> P1
                                    if (segId === 'sa2') return new Vector2(30, -15);  // P2 -> Tree

                                    // Rope B (Left Control)
                                    // sb1: Carriage -> Build. Connects to P1 (Top Left)
                                    if (segId === 'sb1') return new Vector2(-30, -15);
                                    // sb2: Build -> Carriage. Connects to P3 (Bottom Left)
                                    if (segId === 'sb2') return new Vector2(-30, 15);
                                    // sb3: Carriage -> Load. (From P3).
                                    if (segId === 'sb3') return new Vector2(-30, 15);

                                    // Rope C (Right Control)
                                    // sc1: Carriage -> Tree (Assume starts at P2 - Top Right)
                                    if (segId === 'sc1') return new Vector2(30, -15);
                                    // sc2: Tree -> Carriage (Return to P4 - Bottom Right)
                                    if (segId === 'sc2') return new Vector2(30, 15);
                                    // sc3: Carriage -> Load (From P4)
                                    if (segId === 'sc3') return new Vector2(30, 15);
                                }

                                // Anchor Offsets (Pulley 5 & 6)
                                if (nodeId === 'n_building') {
                                    // rope B connects to Pulley 5 (below anchor)
                                    if (segId === 'sb1' || segId === 'sb2') return new Vector2(0, 20);
                                }
                                if (nodeId === 'n_tree') {
                                    // rope C connects to Pulley 6 (below anchor)
                                    if (segId === 'sc1' || segId === 'sc2') return new Vector2(0, 20);
                                }

                                return new Vector2(0, 0);
                            };

                            startPos = startPos.add(getOffset(nodeA.id, seg.id));
                            endPos = endPos.add(getOffset(nodeB.id, seg.id));
                        }

                        // Text Offset logic
                        const tensionTextOffset = (preset === 'SKATE_BLOCK' && seg.id.startsWith('sa')) ? -15 : 10;

                        // Color Logic
                        let segColor = getTensionColor(tension);
                        if (preset === 'SKATE_BLOCK') {
                            if (seg.id.startsWith('sa')) segColor = '#3b82f6'; // Blue
                            if (seg.id.startsWith('sb')) segColor = '#ef4444'; // Red
                            if (seg.id.startsWith('sc')) segColor = '#10b981'; // Green
                        }

                        return (
                            <g key={seg.id}>
                                <line
                                    x1={startPos.x} y1={startPos.y}
                                    x2={endPos.x} y2={endPos.y}
                                    stroke={segColor}
                                    // Use distinct styles for Rope A/B/C
                                    strokeWidth={seg.id.startsWith('sa') ? 4 : 2}
                                    strokeDasharray={seg.id.startsWith('sa') ? 'none' : '4,2'}
                                />
                                {tension > 1 && (
                                    <text
                                        x={(startPos.x + endPos.x) / 2}
                                        y={(startPos.y + endPos.y) / 2 + tensionTextOffset}
                                        textAnchor="middle"
                                        fill={segColor}
                                        fontSize="10"
                                        fontWeight="bold"
                                        style={{ pointerEvents: 'none', userSelect: 'none', textShadow: '0px 0px 4px white' }}
                                    >
                                        {Math.round(tension)}
                                    </text>
                                )}
                            </g>
                        )
                    });
                }

                // Standard Simple Mode Logic
                const ropeIds = ropes[0].segmentIds; // [haul, last_support, ..., first_support]
                const haulSegId = ropeIds[0];
                const supportIds = ropeIds.slice(1);

                // Visual Order: First Created (Fixed) -> Last Created. Left -> Right.
                const visualOrder = [...supportIds].reverse();
                const spacing = 20;
                const supportCount = visualOrder.length;

                return segments.map(seg => {
                    const nodeA = nodes.find(n => n.id === seg.nodeAId);
                    const nodeB = nodes.find(n => n.id === seg.nodeBId);
                    if (!nodeA || !nodeB) return null;

                    const tension = result.tensions.get(seg.id) || 0;
                    const isHaul = seg.id === haulSegId;

                    let offA = 0;
                    let offB = 0;

                    if (!isHaul) {
                        // Supporting Strand
                        const idx = visualOrder.indexOf(seg.id);
                        if (idx === -1) return null;

                        const offset = (idx - (supportCount - 1) / 2) * spacing;
                        offA = offset;
                        offB = offset;
                    } else {
                        // Haul Strand (Simple)
                        const lastOffset = ((supportCount - 1) - (supportCount - 1) / 2) * spacing;
                        const isBlockA = nodeA.type.includes('PULLEY') || nodeA.type.includes('ANCHOR') || nodeA.type.includes('LOAD');
                        if (isBlockA) offA = lastOffset;
                        else offB = lastOffset;
                    }

                    const x1 = nodeA.position.x + offA;
                    const y1 = nodeA.position.y;
                    const x2 = nodeB.position.x + offB;
                    const y2 = nodeB.position.y;

                    if (isHaul) {
                        return (
                            <g key={seg.id}>
                                <line
                                    x1={x1} y1={y1}
                                    x2={x2} y2={y2}
                                    stroke="#ec4899"
                                    strokeWidth="3"
                                    strokeDasharray="5,3"
                                />
                                <text
                                    x={(x1 + x2) / 2}
                                    y={(y1 + y2) / 2 - 10}
                                    fill="#ec4899"
                                    fontSize="12"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                >
                                    Pull
                                </text>
                            </g>
                        );
                    }

                    return (
                        <g key={seg.id}>
                            <line
                                x1={x1} y1={y1}
                                x2={x2} y2={y2}
                                stroke={getTensionColor(tension)}
                                strokeWidth={getStrokeWidth(tension)}
                                strokeLinecap="round"
                            />
                            <text
                                x={(x1 + x2) / 2}
                                y={(y1 + y2) / 2 - 10}
                                textAnchor="middle"
                                fill={getTensionColor(tension)}
                                fontSize="12"
                                fontWeight="bold"
                                style={{ pointerEvents: 'none', userSelect: 'none', textShadow: '0px 0px 4px white' }}
                            >
                                {Math.round(tension)} kg
                            </text>
                        </g>
                    );
                });
            })()}

            {/* Force Text Overlay for Complex Mode - Show Max Tension */}
            {preset === 'COMPLEX' && (() => {
                let maxT = 0;
                let maxSegId = '';
                result.tensions.forEach((t, id) => {
                    if (t > maxT) { maxT = t; maxSegId = id; }
                });

                const seg = segments.find(s => s.id === maxSegId);
                if (seg) {
                    const nodeA = nodes.find(n => n.id === seg.nodeAId);
                    const nodeB = nodes.find(n => n.id === seg.nodeBId);
                    if (nodeA && nodeB) {
                        const midX = (nodeA.position.x + nodeB.position.x) / 2;
                        const midY = (nodeA.position.y + nodeB.position.y) / 2;
                        return (
                            <text x={midX} y={midY - 25} textAnchor="middle" fill="red" fontSize="12" fontWeight="bold" stroke="white" strokeWidth="3" paintOrder="stroke">
                                CRITICAL!
                            </text>
                        )
                    }
                }
            })()}

            {/* Draw Sheaves/Axles on top of lines */}
            {nodes.map(node => {
                const isAnchor = node.type === 'ANCHOR' || node.type === 'PULLEY_ANCHOR';
                const isLoad = node.type === 'LOAD' || node.type === 'PULLEY_FREE';
                const isHaul = node.type === 'FREE';

                if (isHaul) {
                    return (
                        <g key={node.id}>
                            <circle cx={node.position.x} cy={node.position.y} r={8} fill="#ec4899" stroke="white" strokeWidth="2"
                                style={{ cursor: 'pointer' }}
                                onMouseDown={(e) => handleStart(e, node.id)}
                                onTouchStart={(e) => handleStart(e, node.id)}
                            />
                        </g>
                    );
                }

                // Render Pulleys 5 (Build) and 6 (Tree) for Skate Block
                if (preset === 'SKATE_BLOCK') {
                    if (node.id === 'n_building') {
                        return (
                            <g key={node.id}>
                                {/* Main Anchor Point (Rope A) - Circle */}
                                {/* Previously rendered in renderBlockNodes but we can overlay pulley 5 here */}
                                <circle cx={node.position.x} cy={node.position.y + 20} r={8} fill="#ef4444" stroke="white" strokeWidth="2" />
                                <text x={node.position.x} y={node.position.y + 35} textAnchor="middle" fontSize="10" fill="#ef4444">P5</text>
                            </g>
                        );
                    }
                    if (node.id === 'n_tree') {
                        return (
                            <g key={node.id}>
                                <circle cx={node.position.x} cy={node.position.y + 20} r={8} fill="#10b981" stroke="white" strokeWidth="2" />
                                <text x={node.position.x} y={node.position.y + 35} textAnchor="middle" fontSize="10" fill="#10b981">P6</text>
                            </g>
                        );
                    }
                }

                const attachedSegments = segments.filter(s => s.nodeAId === node.id || s.nodeBId === node.id);

                // Special Rendering for Skate Block Carriage
                if (preset === 'SKATE_BLOCK' && node.id === 'n_carriage') {
                    return (
                        <g key={node.id} onMouseDown={(e) => handleStart(e, node.id)} onTouchStart={(e) => handleStart(e, node.id)} style={{ cursor: 'move' }}>
                            {/* Visual Frame */}
                            <path d={`
                                M ${node.position.x - 35} ${node.position.y - 20} 
                                L ${node.position.x + 35} ${node.position.y - 20}
                                L ${node.position.x + 35} ${node.position.y + 20}
                                L ${node.position.x - 35} ${node.position.y + 20}
                                Z
                            `} fill="none" stroke="#6b7280" strokeWidth="4" opacity="0.5" />

                            {/* Connecting Line between main pulleys */}
                            <line
                                x1={node.position.x - 30} y1={node.position.y - 15}
                                x2={node.position.x + 30} y2={node.position.y - 15}
                                stroke="#3b82f6" strokeWidth="4"
                            />

                            {/* Pulleys 1, 2 (Top) */}
                            <circle cx={node.position.x - 30} cy={node.position.y - 15} r={8} fill="#3b82f6" stroke="white" strokeWidth="2" />
                            <circle cx={node.position.x + 30} cy={node.position.y - 15} r={8} fill="#3b82f6" stroke="white" strokeWidth="2" />

                            {/* Pulleys 3, 4 (Bottom) */}

                            <circle cx={node.position.x - 30} cy={node.position.y + 15} r={6} fill="#ef4444" stroke="white" strokeWidth="2" />
                            <circle cx={node.position.x + 30} cy={node.position.y + 15} r={6} fill="#10b981" stroke="white" strokeWidth="2" />

                            {/* Angle Arches (Calculated via Single Point Physics Model) */}
                            {(() => {
                                // Center of Carriage (Physics Point)
                                const center = node.position;

                                // Anchor/Load Nodes
                                const buildNode = nodes.find(n => n.id === 'n_building');
                                const treeNode = nodes.find(n => n.id === 'n_tree');
                                const loadNode = nodes.find(n => n.id === 'n_load'); // Visually below

                                if (!buildNode || !treeNode || !loadNode) return null;

                                // Helper: Get Arc Path for angle at logical center, drawn at offset center
                                const drawArc = (
                                    centerPos: Vector2, // Where vectors originate physically
                                    drawOrigin: Vector2, // Where to draw the arc visually
                                    vecA: Vector2, // Vector 1 (from center)
                                    vecB: Vector2, // Vector 2 (from center)
                                    color: string,
                                    key: string
                                ) => {
                                    // Angles in SVG Space (y down)
                                    const angA = Math.atan2(vecA.y, vecA.x) * 180 / Math.PI;
                                    const angB = Math.atan2(vecB.y, vecB.x) * 180 / Math.PI;

                                    // Internal angle (degrees)
                                    const dot = vecA.dot(vecB);
                                    const angleDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;

                                    // Arc Drawing Logic
                                    const r = 40;
                                    const startX = drawOrigin.x + r * Math.cos(angA * Math.PI / 180);
                                    const startY = drawOrigin.y + r * Math.sin(angA * Math.PI / 180);
                                    const endX = drawOrigin.x + r * Math.cos(angB * Math.PI / 180);
                                    const endY = drawOrigin.y + r * Math.sin(angB * Math.PI / 180);

                                    // Determine sweep based on shortest path
                                    let diff = angB - angA;
                                    while (diff < -180) diff += 360;
                                    while (diff > 180) diff -= 360;
                                    const sweep = diff > 0 ? 1 : 0;

                                    const d = `M ${startX} ${startY} A ${r} ${r} 0 0 ${sweep} ${endX} ${endY}`;

                                    const midAng = angA + diff / 2;
                                    const textX = drawOrigin.x + (r + 15) * Math.cos(midAng * Math.PI / 180);
                                    const textY = drawOrigin.y + (r + 15) * Math.sin(midAng * Math.PI / 180);

                                    return (
                                        <g key={key}>
                                            <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="4,2" opacity="0.8" />
                                            <circle cx={startX} cy={startY} r={2} fill={color} />
                                            <circle cx={endX} cy={endY} r={2} fill={color} />
                                            <text x={textX} y={textY} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill={color} fontWeight="bold">
                                                {Math.round(angleDeg)}°
                                            </text>
                                        </g>
                                    );
                                };

                                // Vectors from Center (Single Point Model)
                                // Top-Left (Skyline): Center -> Building
                                const vSkyL = buildNode.position.sub(center).normalize();
                                // Top-Right (Skyline): Center -> Tree
                                const vSkyR = treeNode.position.sub(center).normalize();
                                // Down-Left (Control B): Center -> Load (But actually Rope B pulls to Build?)
                                // No, control rope B pulls LEFT (to Building) and connects to Load.
                                // Actually, Rope B vector at carriage? 
                                // Tension B acts on Carriage pulling towards Building (left) and towards Load (down).
                                // BUT the angle visualized is usually the "internal angle" of the rope passing through.
                                // For Rope B (Carriage->Build, Carriage->Load):
                                // Vector 1: Center -> Building (Left Up)
                                // Vector 2: Center -> Load (Down)
                                const vLoad = loadNode.position.sub(center).normalize();

                                // Visual Origins
                                const pBottomLeft = new Vector2(node.position.x - 30, node.position.y + 15);
                                const pBottomRight = new Vector2(node.position.x + 30, node.position.y + 15);
                                const pTop = new Vector2(node.position.x, node.position.y - 15);

                                return (
                                    <g>
                                        {/* Rope A (Skyline) Angle: Between Left Leg and Right Leg */}
                                        {drawArc(center, pTop, vSkyL, vSkyR, '#3b82f6', 'angle-a')}

                                        {/* Rope B (Left Control) Angle: Between Building Leg and Load Leg */}
                                        {/* Note: vSkyL is Center->Building. vLoad is Center->Load. */}
                                        {drawArc(center, pBottomLeft, vSkyL, vLoad, '#ef4444', 'angle-b')}

                                        {/* Rope C (Right Control) Angle: Between Tree Leg and Load Leg */}
                                        {/* Note: vSkyR is Center->Tree. vLoad is Center->Load. */}
                                        {drawArc(center, pBottomRight, vSkyR, vLoad, '#10b981', 'angle-c')}
                                    </g>
                                );
                            })()}

                            {/* Label */}
                            <text x={node.position.x} y={node.position.y - 30} textAnchor="middle" fontSize="10" fill="#6b7280" fontWeight="bold">Skate Block</text>
                        </g>
                    );
                }

                return (
                    <g key={node.id} onMouseDown={(e) => handleStart(e, node.id)} onTouchStart={(e) => handleStart(e, node.id)} style={{ cursor: 'pointer' }}>
                        {/* Main Axle Hitbox (invisible but draggable) */}
                        <rect x={node.position.x - 50} y={node.position.y - 15} width={100} height={30} fill="transparent" />

                        {attachedSegments.map(seg => {
                            const otherId = seg.nodeAId === node.id ? seg.nodeBId : seg.nodeAId;
                            // Only draw sheave dot if connection is part of the block tackle (vertical).
                            // i.e. other is n_anchor or n_load.
                            if (otherId === 'n_haul') return null;

                            // Calculate offset same as line
                            const parallelSegments = segments.filter(s =>
                                (s.nodeAId === node.id && s.nodeBId === otherId) ||
                                (s.nodeAId === otherId && s.nodeBId === node.id)
                            );
                            const idx = parallelSegments.findIndex(s => s.id === seg.id);
                            const count = parallelSegments.length;
                            const offset = (idx - (count - 1) / 2) * 20;

                            return (
                                <circle
                                    key={seg.id}
                                    cx={node.position.x + offset}
                                    cy={node.position.y}
                                    r={6}
                                    fill={isAnchor ? '#4b5563' : '#8b5cf6'}
                                    stroke="white"
                                    strokeWidth="2"
                                />
                            );
                        })}
                    </g>
                );
            })}

        </svg>
    );
}
