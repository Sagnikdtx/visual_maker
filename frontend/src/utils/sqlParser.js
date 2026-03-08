/**
 * SQL Parser Utility
 * Parses SQL text using node-sql-parser and extracts:
 *  - tables, CTEs, joins, join conditions, dbt ref() calls
 *  - builds a graph structure { nodes, edges, details }
 */
import { Parser } from 'node-sql-parser';

const parser = new Parser();

/**
 * Extract dbt {{ ref('name') }} patterns and replace with plain table names.
 */
function extractDbtRefs(sql) {
    const refs = {};
    const pattern = /\{\{\s*ref\(\s*['"](\w+)['"]\s*\)\s*\}\}/g;
    let match;
    while ((match = pattern.exec(sql)) !== null) {
        refs[match[1]] = match[1];
    }
    const cleaned = sql.replace(pattern, '$1');
    return { cleaned, refs };
}

/**
 * Recursively collect table references from an AST node.
 */
function collectTables(node, tables = new Set(), cteNames = new Set()) {
    if (!node || typeof node !== 'object') return tables;

    if (Array.isArray(node)) {
        node.forEach(n => collectTables(n, tables, cteNames));
        return tables;
    }

    // Table reference
    if (node.type === 'table' || (node.table && !node.type)) {
        // Not sure about actual type, so safeguard
    }
    if (node.table && typeof node.table === 'string') {
        const tname = node.db ? `${node.db}.${node.table}` : node.table;
        if (!cteNames.has(tname)) {
            tables.add(tname);
        }
    }

    // Recurse into all object values
    for (const key of Object.keys(node)) {
        if (key === 'parent') continue; // avoid cycles
        collectTables(node[key], tables, cteNames);
    }
    return tables;
}

/**
 * Extract join info from a FROM clause.
 */
function extractJoins(from, cteNames) {
    const joins = [];
    if (!from) return joins;

    const fromItems = Array.isArray(from) ? from : [from];

    for (const item of fromItems) {
        if (item.join) {
            const joinType = item.join.toUpperCase();
            const joinTable = item.db ? `${item.db}.${item.table}` : item.table;
            const joinKeys = [];

            // Extract ON conditions
            if (item.on) {
                extractJoinKeys(item.on, joinKeys);
            }

            joins.push({
                table: joinTable,
                joinType,
                joinKeys,
            });
        }
    }
    return joins;
}

/**
 * Recursively extract join key pairs from an ON condition AST.
 */
function extractJoinKeys(onNode, keys) {
    if (!onNode) return;

    if (onNode.type === 'binary_expr' && onNode.operator === '=') {
        const left = columnToString(onNode.left);
        const right = columnToString(onNode.right);
        if (left && right) {
            keys.push({ left, right });
        }
    }

    if (onNode.type === 'binary_expr' && (onNode.operator === 'AND' || onNode.operator === 'OR')) {
        extractJoinKeys(onNode.left, keys);
        extractJoinKeys(onNode.right, keys);
    }
}

function columnToString(node) {
    if (!node) return null;
    if (node.type === 'column_ref') {
        const parts = [];
        if (node.table) parts.push(node.table);
        parts.push(node.column?.expr?.value || node.column);
        return parts.join('.');
    }
    return null;
}

/**
 * Extract columns from a SELECT clause.
 */
function extractColumns(columns) {
    if (!columns || columns === '*') return ['*'];
    if (!Array.isArray(columns)) return [];

    return columns.map(col => {
        if (col.expr?.type === 'star' || col.expr?.column === '*') return '*';
        if (col.as) return col.as;
        if (col.expr?.type === 'column_ref') {
            return col.expr.column?.expr?.value || col.expr.column || '';
        }
        return col.as || '';
    }).filter(Boolean);
}

/**
 * Try to reconstruct a SQL snippet for a CTE from its AST.
 */
function cteToSql(cte) {
    try {
        // Build a standalone SELECT from the CTE's AST
        const ast = { ...cte.stmt };
        return parser.sqlify(ast);
    } catch {
        return '';
    }
}

/**
 * Main parse function.
 */
export function parseSQL(sql) {
    const { cleaned, refs } = extractDbtRefs(sql);

    const nodes = {};
    const edges = [];
    const details = {};
    const cteNames = new Set();

    let ast;
    try {
        // Try multiple dialects
        try {
            ast = parser.astify(cleaned, { database: 'BigQuery' });
        } catch {
            try {
                ast = parser.astify(cleaned, { database: 'MySQL' });
            } catch {
                ast = parser.astify(cleaned, { database: 'PostgresQL' });
            }
        }
    } catch (e) {
        console.error('SQL parse error:', e);
        return { nodes: [], edges: [], details: {}, columnLineage: [], dbtRefs: Object.keys(refs), error: e.message };
    }

    const statements = Array.isArray(ast) ? ast : [ast];

    for (const stmt of statements) {
        if (!stmt) continue;

        // ── Collect CTEs ──
        const withs = stmt.with || [];
        for (const cte of withs) {
            const cteName = cte.name?.value || cte.name;
            if (!cteName) continue;
            cteNames.add(cteName);
        }

        // Process CTEs
        for (const cte of withs) {
            const cteName = cte.name?.value || cte.name;
            if (!cteName) continue;

            let sqlSnippet = '';
            try { sqlSnippet = cteToSql(cte); } catch { sqlSnippet = ''; }

            const columns = extractColumns(cte.stmt?.columns);

            // Find source tables
            const sources = new Set();
            collectTables(cte.stmt, sources, new Set()); // don't exclude cte names for cross-ref
            // But do mark CTE cross-references differently
            const actualTables = new Set();
            const cteDeps = new Set();
            for (const src of sources) {
                if (cteNames.has(src)) {
                    cteDeps.add(src);
                } else {
                    actualTables.add(src);
                }
            }

            // Get joins
            const joins = extractJoins(cte.stmt?.from, cteNames);

            nodes[cteName] = {
                id: cteName,
                type: 'cte',
                sqlSnippet,
                columns,
                alias: cteName,
            };

            details[cteName] = {
                name: cteName,
                type: 'cte',
                columns,
                sourceTables: [...actualTables, ...cteDeps],
                sqlSnippet,
                joins,
            };

            // Add dependency edges
            for (const src of actualTables) {
                if (!nodes[src]) {
                    const nodeType = refs[src] ? 'dbt_ref' : 'table';
                    nodes[src] = { id: src, type: nodeType, sqlSnippet: '', columns: [], alias: src };
                    details[src] = { name: src, type: nodeType, columns: [], sourceTables: [], sqlSnippet: '', joins: [] };
                }
                edges.push({
                    source: src,
                    target: cteName,
                    joinType: null,
                    joinKeys: [],
                    edgeType: 'dependency',
                });
            }

            // CTE-to-CTE dependency edges
            for (const dep of cteDeps) {
                edges.push({
                    source: dep,
                    target: cteName,
                    joinType: null,
                    joinKeys: [],
                    edgeType: 'dependency',
                });
            }

            // Annotate join info on edges
            for (const join of joins) {
                const existing = edges.find(e => e.source === join.table && e.target === cteName);
                if (existing) {
                    existing.joinType = join.joinType;
                    existing.joinKeys = join.joinKeys;
                } else {
                    // Try reverse
                    const rev = edges.find(e => e.target === cteName && !e.joinType);
                    if (rev && join.joinKeys.length > 0) {
                        rev.joinType = join.joinType;
                        rev.joinKeys = join.joinKeys;
                    }
                }
            }
        }

        // ── Final query (outer SELECT after CTEs) ──
        const finalSources = new Set();
        collectTables(stmt, finalSources, new Set());
        // Remove CTE self-references — only keep tables referenced in the outer select
        const outerTables = new Set();
        if (stmt.from) {
            const fromArr = Array.isArray(stmt.from) ? stmt.from : [stmt.from];
            for (const f of fromArr) {
                if (f.table) {
                    const tname = f.db ? `${f.db}.${f.table}` : f.table;
                    outerTables.add(tname);
                }
            }
        }

        const finalColumns = extractColumns(stmt.columns);
        const finalJoins = extractJoins(stmt.from, cteNames);

        // Create source table nodes that haven't been created yet  
        for (const src of outerTables) {
            if (!nodes[src] && !cteNames.has(src)) {
                const nodeType = refs[src] ? 'dbt_ref' : 'table';
                nodes[src] = { id: src, type: nodeType, sqlSnippet: '', columns: [], alias: src };
                details[src] = { name: src, type: nodeType, columns: [], sourceTables: [], sqlSnippet: '', joins: [] };
            }
        }

        // Final query node
        let finalSnippet = '';
        try {
            const stmtCopy = { ...stmt, with: undefined };
            finalSnippet = parser.sqlify(stmtCopy);
        } catch { finalSnippet = ''; }

        nodes['final_query'] = {
            id: 'final_query',
            type: 'final',
            sqlSnippet: finalSnippet,
            columns: finalColumns,
            alias: 'Final Query',
        };
        details['final_query'] = {
            name: 'Final Query',
            type: 'final',
            columns: finalColumns,
            sourceTables: [...outerTables],
            sqlSnippet: finalSnippet,
            joins: finalJoins,
        };

        // Edges from outer tables / CTEs to final_query
        for (const src of outerTables) {
            const exists = edges.some(e => e.source === src && e.target === 'final_query');
            if (!exists) {
                edges.push({
                    source: src,
                    target: 'final_query',
                    joinType: null,
                    joinKeys: [],
                    edgeType: 'dependency',
                });
            }
        }

        // Annotate join info on final edges
        for (const join of finalJoins) {
            const existing = edges.find(e => e.source === join.table && e.target === 'final_query');
            if (existing) {
                existing.joinType = join.joinType;
                existing.joinKeys = join.joinKeys;
            }
        }
    }

    return {
        nodes: Object.values(nodes),
        edges: deduplicateEdges(edges),
        details,
        columnLineage: [],
        dbtRefs: Object.keys(refs),
    };
}

/**
 * Deduplicate edges with same source-target.
 */
function deduplicateEdges(edges) {
    const map = new Map();
    for (const e of edges) {
        const key = `${e.source}→${e.target}`;
        if (!map.has(key) || (e.joinType && !map.get(key).joinType)) {
            map.set(key, e);
        }
    }
    return [...map.values()];
}

/**
 * Diff two SQL strings and return merged graph with diff annotations.
 */
export function diffSQL(sqlOld, sqlNew) {
    const graphOld = parseSQL(sqlOld);
    const graphNew = parseSQL(sqlNew);

    const oldNodes = Object.fromEntries(graphOld.nodes.map(n => [n.id, n]));
    const newNodes = Object.fromEntries(graphNew.nodes.map(n => [n.id, n]));

    const oldEdges = Object.fromEntries(graphOld.edges.map(e => [`${e.source}→${e.target}`, e]));
    const newEdges = Object.fromEntries(graphNew.edges.map(e => [`${e.source}→${e.target}`, e]));

    const mergedNodes = [];
    const allNodeIds = new Set([...Object.keys(oldNodes), ...Object.keys(newNodes)]);

    for (const nid of allNodeIds) {
        if (oldNodes[nid] && newNodes[nid]) {
            const node = { ...newNodes[nid] };
            if (oldNodes[nid].type !== newNodes[nid].type || oldNodes[nid].sqlSnippet !== newNodes[nid].sqlSnippet) {
                node.diffStatus = 'modified';
            } else {
                node.diffStatus = 'unchanged';
            }
            mergedNodes.push(node);
        } else if (newNodes[nid]) {
            mergedNodes.push({ ...newNodes[nid], diffStatus: 'added' });
        } else {
            mergedNodes.push({ ...oldNodes[nid], diffStatus: 'removed' });
        }
    }

    const mergedEdges = [];
    const allEdgeKeys = new Set([...Object.keys(oldEdges), ...Object.keys(newEdges)]);

    for (const ek of allEdgeKeys) {
        if (oldEdges[ek] && newEdges[ek]) {
            const edge = { ...newEdges[ek] };
            if (oldEdges[ek].joinType !== newEdges[ek].joinType) {
                edge.diffStatus = 'modified';
                edge.diffDetail = `${oldEdges[ek].joinType || 'dependency'} → ${newEdges[ek].joinType || 'dependency'}`;
            } else {
                edge.diffStatus = 'unchanged';
            }
            mergedEdges.push(edge);
        } else if (newEdges[ek]) {
            mergedEdges.push({ ...newEdges[ek], diffStatus: 'added' });
        } else {
            mergedEdges.push({ ...oldEdges[ek], diffStatus: 'removed' });
        }
    }

    // Merge details
    const mergedDetails = { ...graphOld.details, ...graphNew.details };

    // Build summary
    const summary = [];
    for (const nid of allNodeIds) {
        if (!oldNodes[nid] && newNodes[nid]) summary.push(`Added ${newNodes[nid].type}: ${nid}`);
        if (oldNodes[nid] && !newNodes[nid]) summary.push(`Removed ${oldNodes[nid].type}: ${nid}`);
    }
    for (const ek of allEdgeKeys) {
        if (oldEdges[ek] && newEdges[ek] && oldEdges[ek].joinType !== newEdges[ek].joinType) {
            summary.push(`Join changed: ${oldEdges[ek].joinType} → ${newEdges[ek].joinType}`);
        }
        if (!oldEdges[ek] && newEdges[ek]) summary.push(`Added edge: ${ek}`);
        if (oldEdges[ek] && !newEdges[ek]) summary.push(`Removed edge: ${ek}`);
    }

    return {
        nodes: mergedNodes,
        edges: mergedEdges,
        details: mergedDetails,
        diffSummary: summary,
    };
}
