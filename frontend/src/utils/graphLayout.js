/**
 * Graph layout utility using dagre for automatic node positioning.
 */
import dagre from '@dagrejs/dagre';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

/**
 * Apply dagre layout to nodes and edges, positioning them in a top-to-bottom DAG.
 */
export function layoutGraph(nodes, edges) {
    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: 'TB',
        nodesep: 80,
        ranksep: 100,
        edgesep: 30,
        marginx: 50,
        marginy: 50,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes
    for (const node of nodes) {
        g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    // Add edges
    for (const edge of edges) {
        g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    // Map back to React Flow positions
    const positionedNodes = nodes.map(node => {
        const dagreNode = g.node(node.id);
        return {
            ...node,
            position: {
                x: dagreNode.x - NODE_WIDTH / 2,
                y: dagreNode.y - NODE_HEIGHT / 2,
            },
        };
    });

    return positionedNodes;
}
