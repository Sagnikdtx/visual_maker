/**
 * DiffView — Side-by-side SQL editors for diff mode.
 * Shows two SQL editors and a summary of changes.
 */
import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { Play, AlertTriangle } from 'lucide-react';

export default function DiffView({
    sqlOld,
    sqlNew,
    onSqlOldChange,
    onSqlNewChange,
    onDiff,
    loading,
    diffSummary,
}) {
    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/50">
                <button
                    className="btn-primary flex items-center gap-1.5"
                    onClick={onDiff}
                    disabled={loading || !sqlOld?.trim() || !sqlNew?.trim()}
                >
                    {loading ? <div className="spinner" /> : <Play size={14} />}
                    Compare
                </button>

                {diffSummary && diffSummary.length > 0 && (
                    <div className="flex items-center gap-1.5 ml-3">
                        <AlertTriangle size={13} className="text-amber-400" />
                        <span className="text-xs text-amber-400 font-medium">
                            {diffSummary.length} change{diffSummary.length > 1 ? 's' : ''} detected
                        </span>
                    </div>
                )}
            </div>

            {/* Diff summary badges */}
            {diffSummary && diffSummary.length > 0 && (
                <div className="px-3 py-2 border-b border-gray-800/30 flex flex-wrap gap-1.5">
                    {diffSummary.map((s, i) => (
                        <span
                            key={i}
                            className="px-2 py-0.5 rounded-md text-[10px] font-medium
                         bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        >
                            {s}
                        </span>
                    ))}
                </div>
            )}

            {/* Side-by-side editors */}
            <div className="flex-1 flex min-h-0">
                {/* Old SQL */}
                <div className="flex-1 flex flex-col border-r border-gray-800/30">
                    <div className="px-3 py-1.5 bg-red-500/5 border-b border-gray-800/30">
                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                            Original SQL
                        </span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <CodeMirror
                            value={sqlOld}
                            onChange={onSqlOldChange}
                            extensions={[sql()]}
                            theme="dark"
                            height="100%"
                            style={{ height: '100%' }}
                            placeholder="-- Paste original SQL here..."
                            basicSetup={{
                                lineNumbers: true,
                                highlightActiveLine: true,
                                foldGutter: true,
                                autocompletion: false,
                            }}
                        />
                    </div>
                </div>

                {/* New SQL */}
                <div className="flex-1 flex flex-col">
                    <div className="px-3 py-1.5 bg-emerald-500/5 border-b border-gray-800/30">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                            Modified SQL
                        </span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <CodeMirror
                            value={sqlNew}
                            onChange={onSqlNewChange}
                            extensions={[sql()]}
                            theme="dark"
                            height="100%"
                            style={{ height: '100%' }}
                            placeholder="-- Paste modified SQL here..."
                            basicSetup={{
                                lineNumbers: true,
                                highlightActiveLine: true,
                                foldGutter: true,
                                autocompletion: false,
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
