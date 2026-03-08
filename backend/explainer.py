"""
AI Explainer module — sends SQL + parsed metadata to Google Gemini
for a natural-language pipeline explanation.
"""

import json
import google.generativeai as genai


async def explain_pipeline(sql: str, parsed_graph: dict, api_key: str) -> str:
    """
    Use Google Gemini to generate a natural-language explanation of the SQL pipeline.
    """
    if not api_key:
        return "Please provide a Gemini API key to use the AI explanation feature."

    genai.configure(api_key=api_key)

    # Build a concise context string
    node_summary = []
    for n in parsed_graph.get("nodes", []):
        node_summary.append(f"- {n['id']} (type: {n['type']})")

    edge_summary = []
    for e in parsed_graph.get("edges", []):
        jt = e.get("join_type") or "dependency"
        keys = e.get("join_keys", [])
        key_str = ", ".join(
            f"{k['left']} = {k['right']}" for k in keys
        ) if keys else ""
        edge_summary.append(
            f"- {e['source']} → {e['target']} ({jt})"
            + (f" ON {key_str}" if key_str else "")
        )

    prompt = f"""You are a senior data engineer. Analyze this SQL pipeline and provide a clear,
concise explanation that would help someone understand the data flow.

## SQL Code
```sql
{sql}
```

## Parsed Structure
### Nodes (Tables / CTEs):
{chr(10).join(node_summary)}

### Edges (Dependencies / Joins):
{chr(10).join(edge_summary)}

## Please explain:
1. **What this query does** — overview in 2-3 sentences
2. **Data flow** — step-by-step how data moves through the pipeline
3. **Key joins** — what tables are being joined and why (based on join keys)
4. **Main source tables** — what raw/source data is being used
5. **Potential concerns** — any performance or logic concerns you notice

Format your response in clean markdown.
"""

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"AI explanation failed: {str(e)}"


async def ask_question(sql: str, parsed_graph: dict, question: str, api_key: str) -> str:
    """
    Answer a specific user question about the SQL pipeline using Gemini.
    """
    if not api_key:
        return "Please provide a Gemini API key to use the AI assistant."

    genai.configure(api_key=api_key)

    node_summary = []
    for n in parsed_graph.get("nodes", []):
        node_summary.append(f"- {n['id']} (type: {n['type']})")

    prompt = f"""You are a senior data engineer assistant. A user has a question about their SQL pipeline.

## SQL Code
```sql
{sql}
```

## Pipeline Structure
{chr(10).join(node_summary)}

## User Question
{question}

Provide a helpful, concise answer in markdown format. Reference specific parts of the SQL when relevant.
"""

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"AI response failed: {str(e)}"
