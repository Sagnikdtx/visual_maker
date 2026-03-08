/**
 * SqlEditor — CodeMirror SQL editor with file upload, example SQL, and Visualize button.
 */
import React, { useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { Upload, Play, FileText, RotateCcw } from 'lucide-react';

const EXAMPLE_SQL = `WITH cte_union_models AS (
  SELECT *
  FROM sem_walmart
  JOIN sem_target
    ON sem_walmart.product_id = sem_target.product_id
),

cte_historical_union AS (
  SELECT *
  FROM cte_union_models
  LEFT JOIN dim_product_tags
    ON dim_product_tags.customer_product_id = cte_union_models.customer_product_id
)

SELECT *
FROM cte_historical_union`;

const EXAMPLE_DBT_SQL = `WITH enriched_orders AS (
  SELECT
    o.order_id,
    o.customer_id,
    o.amount,
    c.customer_name,
    c.segment
  FROM {{ ref('stg_orders') }} o
  INNER JOIN {{ ref('dim_customers') }} c
    ON o.customer_id = c.customer_id
),

final AS (
  SELECT
    enriched_orders.*,
    p.product_name,
    p.category
  FROM enriched_orders
  LEFT JOIN {{ ref('dim_products') }} p
    ON enriched_orders.product_id = p.product_id
)

SELECT * FROM final`;

const editorTheme = {
    '&': {
        backgroundColor: 'transparent',
    },
    '.cm-gutters': {
        backgroundColor: 'rgba(10, 11, 26, 0.5)',
        borderRight: '1px solid rgba(92, 124, 250, 0.1)',
        color: '#4a5568',
    },
};

export default function SqlEditor({ value, onChange, onVisualize, loading }) {
    const fileInputRef = useRef(null);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            onChange(event.target.result);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const loadExample = (exampleSql) => {
        onChange(exampleSql);
    };

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/50">
                <button
                    className="btn-primary flex items-center gap-1.5"
                    onClick={onVisualize}
                    disabled={loading || !value?.trim()}
                >
                    {loading ? (
                        <div className="spinner" />
                    ) : (
                        <Play size={14} />
                    )}
                    Visualize
                </button>

                <div className="h-5 w-px bg-gray-700/50 mx-1" />

                <button
                    className="btn-secondary flex items-center gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload SQL file"
                >
                    <Upload size={13} />
                    Upload
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".sql,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                />

                <div className="h-5 w-px bg-gray-700/50 mx-1" />

                <button
                    className="btn-secondary flex items-center gap-1.5 text-xs"
                    onClick={() => loadExample(EXAMPLE_SQL)}
                    title="Load example SQL"
                >
                    <FileText size={12} />
                    Example
                </button>
                <button
                    className="btn-secondary flex items-center gap-1.5 text-xs"
                    onClick={() => loadExample(EXAMPLE_DBT_SQL)}
                    title="Load dbt example"
                >
                    <FileText size={12} />
                    dbt Example
                </button>

                <div className="flex-1" />

                <button
                    className="btn-secondary flex items-center gap-1 text-xs"
                    onClick={() => onChange('')}
                    title="Clear editor"
                >
                    <RotateCcw size={12} />
                </button>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
                <CodeMirror
                    value={value}
                    onChange={onChange}
                    extensions={[sql()]}
                    theme="dark"
                    height="100%"
                    style={{ height: '100%' }}
                    placeholder="-- Paste your SQL or dbt model here...

-- Example:
-- WITH cte AS (
--   SELECT * FROM table1
--   JOIN table2 ON table1.id = table2.id
-- )
-- SELECT * FROM cte"
                    basicSetup={{
                        lineNumbers: true,
                        highlightActiveLineGutter: true,
                        highlightActiveLine: true,
                        foldGutter: true,
                        autocompletion: false,
                    }}
                />
            </div>
        </div>
    );
}
