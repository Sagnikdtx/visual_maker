/**
 * AI Service — calls Google Gemini API for pipeline explanations and Q&A.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Get an AI explanation of the SQL pipeline.
 */
export async function explainPipeline(sql, parsedGraph, apiKey) {
    if (!apiKey) {
        throw new Error('Please provide a Gemini API key to use AI features.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const nodeSummary = parsedGraph.nodes
        .map(n => `- ${n.id} (type: ${n.type})`)
        .join('\n');

    const edgeSummary = parsedGraph.edges
        .map(e => {
            const jt = e.joinType || 'dependency';
            const keys = (e.joinKeys || [])
                .map(k => `${k.left} = ${k.right}`)
                .join(', ');
            return `- ${e.source} → ${e.target} (${jt})${keys ? ` ON ${keys}` : ''}`;
        })
        .join('\n');

    const prompt = `You are a senior data engineer. Analyze this SQL pipeline and provide a clear,
concise explanation that would help someone understand the data flow.

## SQL Code
\`\`\`sql
${sql}
\`\`\`

## Parsed Structure
### Nodes (Tables / CTEs):
${nodeSummary}

### Edges (Dependencies / Joins):
${edgeSummary}

## Please explain:
1. **What this query does** — overview in 2-3 sentences
2. **Data flow** — step-by-step how data moves through the pipeline
3. **Key joins** — what tables are being joined and why (based on join keys)
4. **Main source tables** — what raw/source data is being used
5. **Potential concerns** — any performance or logic concerns you notice

Format your response in clean markdown.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * Ask a specific question about the SQL pipeline.
 */
export async function askQuestion(sql, parsedGraph, question, apiKey) {
    if (!apiKey) {
        throw new Error('Please provide a Gemini API key to use AI features.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const nodeSummary = parsedGraph.nodes
        .map(n => `- ${n.id} (type: ${n.type})`)
        .join('\n');

    const prompt = `You are a senior data engineer assistant. A user has a question about their SQL pipeline.

## SQL Code
\`\`\`sql
${sql}
\`\`\`

## Pipeline Structure
${nodeSummary}

## User Question
${question}

Provide a helpful, concise answer in markdown format. Reference specific parts of the SQL when relevant.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
}
