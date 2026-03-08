"""
SQL Parser module — uses sqlglot to extract tables, CTEs, joins,
join conditions, dbt ref() calls, and column lineage from SQL text.
"""

import re
import sqlglot
from sqlglot import exp


def _extract_dbt_refs(sql: str) -> dict[str, str]:
    """Find {{ ref('name') }} patterns and replace them with plain table names."""
    refs = {}
    pattern = r"\{\{\s*ref\(\s*['\"](\w+)['\"]\s*\)\s*\}\}"
    for match in re.finditer(pattern, sql):
        ref_name = match.group(1)
        refs[ref_name] = ref_name
    cleaned = re.sub(pattern, r"\1", sql)
    return cleaned, refs


def _table_name(table_node) -> str:
    """Get the canonical table name from a sqlglot Table node."""
    parts = []
    if table_node.catalog:
        parts.append(table_node.catalog)
    if table_node.db:
        parts.append(table_node.db)
    parts.append(table_node.name)
    return ".".join(parts)


def parse_sql(sql: str) -> dict:
    """
    Parse a SQL string and return a graph structure:
    {
      "nodes": [ { "id", "type", "sql_snippet", "columns", "alias" } ],
      "edges": [ { "source", "target", "join_type", "join_keys", "edge_type" } ],
      "details": { <node_id>: { ... } }
    }
    """
    # ── Pre-process dbt refs ──
    cleaned_sql, dbt_refs = _extract_dbt_refs(sql)

    nodes: dict[str, dict] = {}
    edges: list[dict] = []
    details: dict[str, dict] = {}
    cte_names: set[str] = set()
    cte_order: list[str] = []

    # Try to parse; fall back to dialect-tolerant mode
    try:
        parsed = sqlglot.parse(cleaned_sql)
    except Exception:
        try:
            parsed = sqlglot.parse(cleaned_sql, error_level=sqlglot.ErrorLevel.IGNORE)
        except Exception:
            return {"nodes": [], "edges": [], "details": {}}

    for statement in parsed:
        if statement is None:
            continue

        # ── Collect CTEs ──
        for cte in statement.find_all(exp.CTE):
            cte_name = cte.alias
            cte_names.add(cte_name)
            cte_order.append(cte_name)
            sql_snippet = cte.sql(dialect="bigquery", pretty=True)
            # Truncate very long snippets for the UI
            if len(sql_snippet) > 2000:
                sql_snippet = sql_snippet[:2000] + "\n-- (truncated)"

            columns = []
            select = cte.find(exp.Select)
            if select:
                for col_expr in select.expressions:
                    if isinstance(col_expr, exp.Star):
                        columns.append("*")
                    elif hasattr(col_expr, "alias") and col_expr.alias:
                        columns.append(col_expr.alias)
                    elif isinstance(col_expr, exp.Column):
                        columns.append(col_expr.name)
                    else:
                        col_text = col_expr.sql(dialect="bigquery")
                        if len(col_text) < 60:
                            columns.append(col_text)

            nodes[cte_name] = {
                "id": cte_name,
                "type": "cte",
                "sql_snippet": sql_snippet,
                "columns": columns,
                "alias": cte_name,
            }
            details[cte_name] = {
                "name": cte_name,
                "type": "cte",
                "columns": columns,
                "source_tables": [],
                "sql_snippet": sql_snippet,
            }

        # ── Collect source tables (non-CTE) ──
        for table in statement.find_all(exp.Table):
            tname = _table_name(table)
            if tname in cte_names or tname == "":
                continue
            if tname not in nodes:
                node_type = "dbt_ref" if tname in dbt_refs else "table"
                nodes[tname] = {
                    "id": tname,
                    "type": node_type,
                    "sql_snippet": "",
                    "columns": [],
                    "alias": table.alias or tname,
                }
                details[tname] = {
                    "name": tname,
                    "type": node_type,
                    "columns": [],
                    "source_tables": [],
                    "sql_snippet": "",
                }

        # ── Build dependency edges from CTEs ──
        for cte in statement.find_all(exp.CTE):
            cte_name = cte.alias
            sources = set()
            for table in cte.find_all(exp.Table):
                tname = _table_name(table)
                if tname and tname != cte_name:
                    sources.add(tname)
            for src in sources:
                edges.append({
                    "source": src,
                    "target": cte_name,
                    "join_type": None,
                    "join_keys": [],
                    "edge_type": "dependency",
                })
            if cte_name in details:
                details[cte_name]["source_tables"] = list(sources)

        # ── Collect joins and join conditions ──
        for join in statement.find_all(exp.Join):
            join_type = "JOIN"
            if join.args.get("side"):
                join_type = f"{join.args['side'].upper()} JOIN"
            elif join.args.get("kind"):
                join_type = f"{join.args['kind'].upper()} JOIN"

            join_table_node = join.find(exp.Table)
            if join_table_node is None:
                continue
            join_table = _table_name(join_table_node)

            # Extract join keys from ON clause
            join_keys = []
            on_clause = join.args.get("on")
            if on_clause:
                for eq in on_clause.find_all(exp.EQ):
                    left = eq.left
                    right = eq.right
                    if isinstance(left, exp.Column) and isinstance(right, exp.Column):
                        join_keys.append({
                            "left": left.sql(dialect="bigquery"),
                            "right": right.sql(dialect="bigquery"),
                        })

            # Try to find the other side of the join
            # The parent SELECT's FROM table
            parent_select = join.parent_select
            if parent_select:
                from_clause = parent_select.find(exp.From)
                if from_clause:
                    from_table_node = from_clause.find(exp.Table)
                    if from_table_node:
                        from_table = _table_name(from_table_node)
                        # Update existing dependency edge or add join info
                        found = False
                        for e in edges:
                            if e["source"] == join_table and e["target"] != "" :
                                if e["join_type"] is None:
                                    e["join_type"] = join_type
                                    e["join_keys"] = join_keys
                                    found = True
                                    break
                        if not found:
                            # Check reverse
                            for e in edges:
                                if e["source"] == from_table or e["source"] == join_table:
                                    if e["join_type"] is None:
                                        e["join_type"] = join_type
                                        e["join_keys"] = join_keys
                                        break

        # ── Final query node ──
        # The outermost SELECT (after CTEs) is the "final_query"
        final_sources = set()
        outer_select = statement
        if hasattr(statement, "this") and isinstance(statement.this, exp.Select):
            outer_select = statement.this
        elif isinstance(statement, exp.Select):
            outer_select = statement

        for table in outer_select.find_all(exp.Table):
            tname = _table_name(table)
            if tname:
                final_sources.add(tname)

        # Only add final_query if there are sources
        if final_sources:
            final_snippet = outer_select.sql(dialect="bigquery", pretty=True)
            if len(final_snippet) > 2000:
                final_snippet = final_snippet[:2000] + "\n-- (truncated)"
            final_cols = []
            sel = outer_select if isinstance(outer_select, exp.Select) else outer_select.find(exp.Select)
            if sel:
                for col_expr in sel.expressions:
                    if isinstance(col_expr, exp.Star):
                        final_cols.append("*")
                    elif hasattr(col_expr, "alias") and col_expr.alias:
                        final_cols.append(col_expr.alias)
                    elif isinstance(col_expr, exp.Column):
                        final_cols.append(col_expr.name)

            nodes["final_query"] = {
                "id": "final_query",
                "type": "final",
                "sql_snippet": final_snippet,
                "columns": final_cols,
                "alias": "final_query",
            }
            details["final_query"] = {
                "name": "final_query",
                "type": "final",
                "columns": final_cols,
                "source_tables": list(final_sources),
                "sql_snippet": final_snippet,
            }
            for src in final_sources:
                # Avoid duplicate edges
                dup = any(
                    e["source"] == src and e["target"] == "final_query"
                    for e in edges
                )
                if not dup:
                    edges.append({
                        "source": src,
                        "target": "final_query",
                        "join_type": None,
                        "join_keys": [],
                        "edge_type": "dependency",
                    })

    # ── Column lineage (basic tracking) ──
    column_lineage = _extract_column_lineage(nodes, edges)

    return {
        "nodes": list(nodes.values()),
        "edges": edges,
        "details": details,
        "column_lineage": column_lineage,
        "dbt_refs": list(dbt_refs.keys()),
    }


def _extract_column_lineage(nodes: dict, edges: list) -> list:
    """
    Basic column lineage: trace columns from source tables through CTEs to final.
    Returns a list of lineage paths.
    """
    lineage = []
    # Build adjacency
    adj: dict[str, list[str]] = {}
    for e in edges:
        adj.setdefault(e["source"], []).append(e["target"])

    # For each source table, trace columns forward
    for node_id, node in nodes.items():
        if node["type"] == "table" or node["type"] == "dbt_ref":
            for col in node.get("columns", []):
                if col == "*":
                    continue
                path = [f"{node_id}.{col}"]
                _trace_column(node_id, col, adj, nodes, path, lineage)

    return lineage


def _trace_column(current: str, col: str, adj: dict, nodes: dict,
                  path: list, lineage: list, visited: set = None):
    if visited is None:
        visited = set()
    if current in visited:
        return
    visited.add(current)

    targets = adj.get(current, [])
    if not targets:
        if len(path) > 1:
            lineage.append(path[:])
        return

    for target in targets:
        target_node = nodes.get(target, {})
        target_cols = target_node.get("columns", [])
        if col in target_cols or "*" in target_cols:
            path.append(f"{target}.{col}")
            _trace_column(target, col, adj, nodes, path, lineage, visited.copy())
            path.pop()
        elif not target_cols:
            path.append(f"{target}.{col}")
            _trace_column(target, col, adj, nodes, path, lineage, visited.copy())
            path.pop()
