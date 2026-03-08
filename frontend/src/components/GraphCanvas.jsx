/**
 * GraphCanvas — React Flow wrapper that renders the SQL lineage graph.
 */
import React, { useCallback, useMemo, useEffect } from 'react';
import {
    ReactFlow,
    Controls,
    MiniMap,
    Background,
    useNodesState,
    useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';
import { layoutGraph } from '../utils/graphLayout';

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

const miniMapNodeColor = (node) => {
    switch (node.data?.nodeType) {
        case 'table': return '#3b82f6';
        case 'cte': return '#a855f7';
        case 'final': return '#10b981';
        case 'dbt_ref': return '#f59e0b';
        default: return '#4a5568';
    }
};

export default function GraphCanvas({ graphData, onNodeClick }) {
    // Transform parser output into React Flow nodes/edges
    const { initialNodes, initialEdges } = useMemo(() => {
        if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
            return { initialNodes: [], initialEdges: [] };
        }

        // Create React Flow node objects
        const rfNodes = graphData.nodes.map(n => ({
            id: n.id,
            type: 'custom',
            position: { x: 0, y: 0 },
            data: {
                label: n.id === 'final_query' ? 'Final Query' : n.id,
                nodeType: n.type,
                columns: n.columns,
                sqlSnippet: n.sqlSnippet,
                diffStatus: n.diffStatus,
            },
        }));

        // Layout
        const rfEdgesForLayout = graphData.edges.map(e => ({
            source: e.source,
            target: e.target,
        }));
        const positionedNodes = layoutGraph(rfNodes, rfEdgesForLayout);

        // Create React Flow edge objects
        const rfEdges = graphData.edges.map((e, i) => ({
            id: `e-${e.source}-${e.target}-${i}`,
            source: e.source,
            target: e.target,
            type: 'custom',
            animated: e.edgeType === 'dependency' && !e.joinType,
            data: {
                joinType: e.joinType,
                joinKeys: e.joinKeys,
                edgeType: e.edgeType,
                diffStatus: e.diffStatus,
                diffDetail: e.diffDetail,
            },
            markerEnd: {
                type: 'arrowclosed',
                color: e.joinType ? '#5c7cfa' : '#4a5568',
                width: 15,
                height: 15,
            },
        }));

        return { initialNodes: positionedNodes, initialEdges: rfEdges };
    }, [graphData]);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    const handleNodeClick = useCallback((event, node) => {
        if (onNodeClick) {
            onNodeClick(node.id);
        }
    }, [onNodeClick]);

    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-center animate-fade-in">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-600/20 to-purple-600/20 flex items-center justify-center border border-brand-500/20">
                        <svg className="w-10 h-10 text-brand-400 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">No Graph to Display</h3>
                    <p className="text-sm text-gray-500 max-w-xs">
                        Paste SQL in the editor and click <strong>Visualize</strong> to see the lineage graph
                    </p>
                </div>
            </div>
        );
    }

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={2}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            proOptions={{ hideAttribution: true }}
        >
            <Background color="#1e293b" gap={20} size={1} variant="dots" />
            <Controls
                showInteractive={false}
                position="bottom-right"
            />
            <MiniMap
                nodeColor={miniMapNodeColor}
                maskColor="rgba(6, 7, 20, 0.8)"
                position="bottom-left"
                pannable
                zoomable
            />
        </ReactFlow>
    );
}
