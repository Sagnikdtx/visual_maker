/**
 * CustomEdge — styled labeled edge for React Flow showing join type and keys.
 */
import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';

const edgeColors = {
    dependency: '#4a5568',
    JOIN: '#3b82f6',
    'INNER JOIN': '#3b82f6',
    'LEFT JOIN': '#a855f7',
    'RIGHT JOIN': '#f59e0b',
    'FULL JOIN': '#10b981',
    'CROSS JOIN': '#ef4444',
    'LEFT OUTER JOIN': '#a855f7',
    'RIGHT OUTER JOIN': '#f59e0b',
    'FULL OUTER JOIN': '#10b981',
};

const diffColors = {
    added: '#10b981',
    removed: '#ef4444',
    modified: '#f59e0b',
};

export default function CustomEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    style = {},
    markerEnd,
}) {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const joinType = data?.joinType;
    const joinKeys = data?.joinKeys || [];
    const diffStatus = data?.diffStatus;
    const diffDetail = data?.diffDetail;

    // Determine edge color
    let strokeColor = edgeColors[joinType] || edgeColors.dependency;
    if (diffStatus && diffColors[diffStatus]) {
        strokeColor = diffColors[diffStatus];
    }

    const hasLabel = joinType || diffDetail;
    const labelText = diffDetail || joinType || '';
    const keyText = joinKeys.map(k => `${k.left} = ${k.right}`).join(', ');

    return (
        <>
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    stroke: strokeColor,
                    strokeWidth: joinType ? 2.5 : 1.5,
                    strokeDasharray: diffStatus === 'removed' ? '5,5' : undefined,
                    opacity: diffStatus === 'removed' ? 0.4 : 0.8,
                }}
            />
            {hasLabel && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'all',
                        }}
                        className="group"
                    >
                        <div
                            className="px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap cursor-default
                         border border-gray-700/50 shadow-lg"
                            style={{
                                background: `${strokeColor}20`,
                                color: strokeColor,
                                borderColor: `${strokeColor}40`,
                            }}
                        >
                            {labelText}
                        </div>
                        {/* Tooltip with join keys */}
                        {keyText && (
                            <div
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1
                           bg-gray-900/95 border border-gray-700/50 rounded-md text-[10px]
                           text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100
                           transition-opacity pointer-events-none shadow-xl z-50"
                            >
                                ON {keyText}
                            </div>
                        )}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
