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
}

export default function Canvas({ nodes, segments, ropes, result, loadWeight, onNodeMove }: CanvasProps) {
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
        const loads = nodes.filter(n => n.type === 'LOAD' || n.type === 'PULLEY_FREE');

        // Assuming Single Anchor and Single Load per new topology

        return (
            <>
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

                            <text x={node.position.x} y={node.position.y - 25} textAnchor="middle" fill="#6b7280" fontSize="14" fontWeight="bold">
                                Anchor
                            </text>
                        </g>
                    );
                })}

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

                            <text x={node.position.x + 20} y={node.position.y + 5} fill="#a855f7" fontWeight="bold">
                                Load ({loadWeight}kg)
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

            {/* Segments (Ropes) with Ordered Zig-Zag Offsets */}
            {(() => {
                if (!ropes || ropes.length === 0) return null;
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
                        if (idx === -1) return null; // Should not happen

                        const offset = (idx - (supportCount - 1) / 2) * spacing;
                        offA = offset;
                        offB = offset;
                    } else {
                        // Haul Strand
                        // Starts at the offset of the LAST supporting strand (tangent exit)
                        // Ends at the Haul Node (0 offset)

                        const lastOffset = ((supportCount - 1) - (supportCount - 1) / 2) * spacing;

                        // Check which node is the Block
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
                                {/* Arrowhead at approx end? or use Marker */}
                                {/* Let's put a text label mid-way */}
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

                // For Blocks, draw sheaves points
                // Find all segments attached to this node
                // We need to draw a circle for each attachment point (offset).
                const attachedSegments = segments.filter(s => s.nodeAId === node.id || s.nodeBId === node.id);
                // But attachedSegments includes connections to Haul?
                // We want to group by "Other Node".

                // Actually, we processed "parallelSegments" above.
                // We can iterate attached segments again or just infer from node.sheaveCount?

                // Let's deduce sheave centers.
                // We want to draw circles at: node.x + offset.

                // Gather unique offsets used?
                // It's cleaner to iterate attached segments and compute their offset again.

                // We can group by connection.
                // Problem: A node might be connected to Haul (singular) AND Load (multiple).
                // For `n_anchor`: connected to `n_load` (N times) and `n_haul` (1 time).
                // We should render sheaves for the `n_load` connections.

                return (
                    <g key={node.id} onMouseDown={(e) => handleStart(e, node.id)} onTouchStart={(e) => handleStart(e, node.id)} style={{ cursor: 'pointer' }}>
                        {/* Main Axle Hitbox (invisible but draggable) */}
                        <rect x={node.position.x - 50} y={node.position.y - 15} width={100} height={30} fill="transparent" />

                        {attachedSegments.map(seg => {
                            const otherId = seg.nodeAId === node.id ? seg.nodeBId : seg.nodeAId;
                            // Only draw sheave dot if connection is part of the block tackle (vertical).
                            // i.e. other is n_anchor or n_load.
                            if (otherId === 'n_haul') return null; // Don't draw sheave for haul line exit (or do?)

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
