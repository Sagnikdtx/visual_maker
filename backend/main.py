"""
FastAPI backend for SQL/dbt Model Visualizer.
Provides endpoints for SQL parsing, diffing, and AI explanation.
"""

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from parser import parse_sql
from differ import diff_sql
from explainer import explain_pipeline, ask_question

app = FastAPI(title="SQL Visualizer API", version="1.0.0")

# CORS — allow the React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ──

class ParseRequest(BaseModel):
    sql: str

class DiffRequest(BaseModel):
    sql_old: str
    sql_new: str

class ExplainRequest(BaseModel):
    sql: str
    api_key: Optional[str] = ""

class AskRequest(BaseModel):
    sql: str
    question: str
    api_key: Optional[str] = ""


# ── Routes ──

@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/parse")
async def parse_endpoint(req: ParseRequest):
    """Parse SQL and return graph JSON."""
    result = parse_sql(req.sql)
    return result


@app.post("/api/parse-file")
async def parse_file_endpoint(file: UploadFile = File(...)):
    """Parse an uploaded SQL file."""
    content = await file.read()
    sql = content.decode("utf-8", errors="replace")
    result = parse_sql(sql)
    return result


@app.post("/api/diff")
async def diff_endpoint(req: DiffRequest):
    """Compare two SQL strings and return annotated graph."""
    result = diff_sql(req.sql_old, req.sql_new)
    return result


@app.post("/api/explain")
async def explain_endpoint(req: ExplainRequest):
    """Get AI explanation of SQL pipeline."""
    graph = parse_sql(req.sql)
    explanation = await explain_pipeline(req.sql, graph, req.api_key or "")
    return {"explanation": explanation}


@app.post("/api/ask")
async def ask_endpoint(req: AskRequest):
    """Ask a question about the SQL pipeline."""
    graph = parse_sql(req.sql)
    answer = await ask_question(req.sql, graph, req.question, req.api_key or "")
    return {"answer": answer}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
