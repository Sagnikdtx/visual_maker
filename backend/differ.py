"""
SQL Diff module — compares two parsed SQL graphs and annotates
nodes/edges as added, removed, or modified.
"""

from parser import parse_sql


def diff_sql(sql_old: str, sql_new: str) -> dict:
    """
    Parse two SQL strings and return a merged graph with diff annotations.
    Each node/edge gets a "diff_status" field: "unchanged", "added", "removed", "modified".
    """
    graph_old = parse_sql(sql_old)
    graph_new = parse_sql(sql_new)

    old_nodes = {n["id"]: n for n in graph_old["nodes"]}
    new_nodes = {n["id"]: n for n in graph_new["nodes"]}

    old_edges = {_edge_key(e): e for e in graph_old["edges"]}
    new_edges = {_edge_key(e): e for e in graph_new["edges"]}

    merged_nodes = []
    merged_edges = []

    # ── Nodes ──
    all_node_ids = set(old_nodes.keys()) | set(new_nodes.keys())
    for nid in all_node_ids:
        if nid in old_nodes and nid in new_nodes:
            node = {**new_nodes[nid]}
            # Check if anything meaningful changed
            if (old_nodes[nid].get("type") != new_nodes[nid].get("type") or
                old_nodes[nid].get("sql_snippet") != new_nodes[nid].get("sql_snippet")):
                node["diff_status"] = "modified"
            else:
                node["diff_status"] = "unchanged"
            merged_nodes.append(node)
        elif nid in new_nodes:
            node = {**new_nodes[nid], "diff_status": "added"}
            merged_nodes.append(node)
        else:
            node = {**old_nodes[nid], "diff_status": "removed"}
            merged_nodes.append(node)

    # ── Edges ──
    all_edge_keys = set(old_edges.keys()) | set(new_edges.keys())
    for ek in all_edge_keys:
        if ek in old_edges and ek in new_edges:
            edge = {**new_edges[ek]}
            if old_edges[ek].get("join_type") != new_edges[ek].get("join_type"):
                edge["diff_status"] = "modified"
                edge["diff_detail"] = (
                    f"{old_edges[ek].get('join_type', 'dependency')} → "
                    f"{new_edges[ek].get('join_type', 'dependency')}"
                )
            else:
                edge["diff_status"] = "unchanged"
            merged_edges.append(edge)
        elif ek in new_edges:
            edge = {**new_edges[ek], "diff_status": "added"}
            merged_edges.append(edge)
        else:
            edge = {**old_edges[ek], "diff_status": "removed"}
            merged_edges.append(edge)

    # Merge details
    merged_details = {}
    all_detail_keys = set(graph_old.get("details", {}).keys()) | set(graph_new.get("details", {}).keys())
    for dk in all_detail_keys:
        if dk in graph_new.get("details", {}):
            merged_details[dk] = graph_new["details"][dk]
        else:
            merged_details[dk] = graph_old["details"][dk]

    # Compute summary of changes
    summary = _build_summary(old_nodes, new_nodes, old_edges, new_edges)

    return {
        "nodes": merged_nodes,
        "edges": merged_edges,
        "details": merged_details,
        "diff_summary": summary,
    }


def _edge_key(edge: dict) -> str:
    return f"{edge['source']}→{edge['target']}"


def _build_summary(old_nodes, new_nodes, old_edges, new_edges) -> list[str]:
    summary = []
    added_nodes = set(new_nodes.keys()) - set(old_nodes.keys())
    removed_nodes = set(old_nodes.keys()) - set(new_nodes.keys())

    for n in added_nodes:
        summary.append(f"Added {new_nodes[n]['type']}: {n}")
    for n in removed_nodes:
        summary.append(f"Removed {old_nodes[n]['type']}: {n}")

    for ek in set(old_edges.keys()) & set(new_edges.keys()):
        old_jt = old_edges[ek].get("join_type")
        new_jt = new_edges[ek].get("join_type")
        if old_jt != new_jt:
            summary.append(f"Join changed on {ek}: {old_jt} → {new_jt}")

    added_edges = set(new_edges.keys()) - set(old_edges.keys())
    removed_edges = set(old_edges.keys()) - set(new_edges.keys())
    for e in added_edges:
        summary.append(f"Added edge: {e}")
    for e in removed_edges:
        summary.append(f"Removed edge: {e}")

    return summary
