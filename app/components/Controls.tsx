import React from 'react';

interface ControlsProps {
    loadWeight: number;
    setLoadWeight: (w: number) => void;
    efficiency: number;
    setEfficiency: (e: number) => void;
    onReset: () => void;

    nodeCount: number;
    segmentCount: number;
    maxTension: number;

    stats: {
        haulTension: number;
        idealMA: number;
        effectiveMA: number;
    };

    // New props
    maCount: number;
    setMaCount: (n: number) => void;
    onPreset: (n: number) => void;
    currentPreset: 'SIMPLE' | 'COMPLEX' | 'SKATE_BLOCK';

    // Skate Block specific
    ropeATension?: number;
    setRopeATension?: (t: number) => void;
}

export default function Controls({
    loadWeight, setLoadWeight,
    efficiency, setEfficiency,
    onReset,
    nodeCount, segmentCount, maxTension,
    stats,
    maCount, setMaCount,
    onPreset, currentPreset,
    ropeATension, setRopeATension
}: ControlsProps) {
    const isHighTension = maxTension > loadWeight * 2;

    return (
        <div className="sidebar">
            <h1 className="sidebar-header">
                Rope Rigging
            </h1>

            {/* Preset Selector */}
            <div className="control-group">
                <label className="control-label">System Preset</label>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg gap-1">
                    <button
                        onClick={() => onPreset(0)}
                        className={`flex-1 py-1 px-1 rounded text-xs font-medium transition-colors ${currentPreset === 'SIMPLE' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Standard
                    </button>
                    <button
                        onClick={() => onPreset(1)}
                        className={`flex-1 py-1 px-1 rounded text-xs font-medium transition-colors ${currentPreset === 'COMPLEX' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Complex
                    </button>
                    <button
                        onClick={() => onPreset(2)}
                        className={`flex-1 py-1 px-1 rounded text-xs font-medium transition-colors ${currentPreset === 'SKATE_BLOCK' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Skate Block
                    </button>
                </div>
            </div>

            {/* MA Stepper (Only for Simple) */}
            {currentPreset === 'SIMPLE' && (
                <div className="control-group">
                    <label className="control-label">Mechanical Advantage</label>
                    <div className="flex items-center gap-4 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg justify-between">
                        <button
                            onClick={() => setMaCount(Math.max(1, maCount - 1))}
                            className="w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-700 shadow rounded font-bold hover:bg-gray-50"
                        >
                            -
                        </button>
                        <span className="font-bold text-lg">
                            {maCount}:1 System
                        </span>
                        <button
                            onClick={() => setMaCount(Math.min(6, maCount + 1))}
                            className="w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-700 shadow rounded font-bold hover:bg-gray-50"
                        >
                            +
                        </button>
                    </div>
                </div>
            )}

            <div className="control-group">
                <label className="control-label">
                    Load Weight ({loadWeight} kg)
                </label>
                <div className="control-input-row">
                    <input
                        type="range"
                        min="10"
                        max="500"
                        step="10"
                        value={loadWeight}
                        onChange={(e) => setLoadWeight(Number(e.target.value))}
                        className="range-input"
                    />
                </div>
            </div>

            {/* Skate Block Tension Control */}
            {currentPreset === 'SKATE_BLOCK' && setRopeATension && ropeATension !== undefined && (
                <div className="control-group">
                    <label className="control-label">
                        Port-a-wrap Tension ({ropeATension} kg)
                    </label>
                    <div className="control-input-row">
                        <input
                            type="range"
                            min="50"
                            max="1000"
                            step="10"
                            value={ropeATension}
                            onChange={(e) => setRopeATension(Number(e.target.value))}
                            className="range-input"
                        />
                    </div>
                </div>
            )}

            <div className="control-group">
                <label className="control-label">
                    Pulley Efficiency ({Math.round(efficiency * 100)}%)
                </label>
                <div className="control-input-row">
                    <span style={{ fontSize: '0.8rem' }}>50%</span>
                    <input
                        type="range"
                        min="0.5"
                        max="1.0"
                        step="0.05"
                        value={efficiency}
                        onChange={(e) => setEfficiency(Number(e.target.value))}
                        className="range-input"
                    />
                    <span style={{ fontSize: '0.8rem' }}>100%</span>
                </div>
            </div>

            {/* Stats */}
            <div className="info-section">
                <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#ec4899' }}>Haul Stats</h3>
                <div className="status-stats">
                    <div className="stat-row">
                        <span title="Theoretical Mechanical Advantage">Ideal MA:</span>
                        <span style={{ fontWeight: 'bold' }}>{stats.idealMA.toFixed(1)} : 1</span>
                    </div>
                    <div className="stat-row">
                        <span title="Actual MA with friction">Effective MA:</span>
                        <span>{stats.effectiveMA.toFixed(2)} : 1</span>
                    </div>
                    <div className="stat-row" style={{ marginTop: '0.5rem', borderTop: '1px dashed #ccc', paddingTop: '0.5rem' }}>
                        <span style={{ color: '#ec4899', fontWeight: 'bold' }}>Pull Force:</span>
                        <span style={{ color: '#ec4899', fontWeight: 'bold', fontSize: '1.1em' }}>
                            {Math.round(stats.haulTension)} kg
                        </span>
                    </div>
                </div>
            </div>

            {/* Complex Stats Panel */}
            {currentPreset === 'COMPLEX' && (
                <div className="info-section">
                    <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#8b5cf6' }}>Force Analysis</h3>
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs leading-5">
                        <p><strong>Note:</strong> Static approximation. Ignores friction at anchors, assume perfect redirects.</p>
                        <p className="mt-2">Check the canvas labels for segment tensions and resultant forces at anchors.</p>
                    </div>
                </div>
            )}

            {currentPreset === 'SKATE_BLOCK' && (
                <div className="info-section">
                    <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#8b5cf6' }}>Skate Block Info</h3>
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs leading-5">
                        <p><strong>System:</strong> Split control lines (B/C) supporting load on a skyline (A).</p>
                        <p className="mt-2">Carriage 'Sags' until vertical support equals Load. Control lines balance horizontally.</p>
                    </div>
                </div>
            )}

            <div className="info-section">
                <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '600' }}>System Limit</h3>
                <div className="status-stats">
                    <div className="stat-row">
                        <span>Nodes:</span>
                        <span>{nodeCount}</span>
                    </div>
                    <div className="stat-row">
                        <span>Max Tension:</span>
                        <span style={{ color: isHighTension ? 'var(--danger-color)' : 'inherit', fontWeight: isHighTension ? 'bold' : 'normal' }}>
                            {Math.round(maxTension)} kg
                        </span>
                    </div>
                </div>
            </div>

            <div className="info-section">
                <p style={{ fontSize: '0.75rem' }}>
                    Drag any part of the <strong>Anchor Beam</strong> or <strong>Load Block</strong> to move the whole group.
                </p>
            </div>

            <button onClick={onReset} className="reset-button">
                Reset to Default
            </button>
        </div>
    );
}
