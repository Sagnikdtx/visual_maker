/**
 * Sidebar — detail panel shown when a node is clicked.
 * Shows node name, type, source tables, columns, SQL snippet, and joins.
 */
import React from 'react';
import { X, Database, GitBranch, CheckCircle2, Package, ArrowRight, Link2 } from 'lucide-react';

const typeIcons = {
    table: Database,
    cte: GitBranch,
    final: CheckCircle2,
    dbt_ref: Package,
};

const typeColors = {
    table: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    cte: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
    final: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    dbt_ref: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
};

export default function Sidebar({ nodeId, details, onClose }) {
    if (!nodeId || !details || !details[nodeId]) {
        return (
            <div className="h-full flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-800/50 flex items-center justify-center">
                        <Database size={20} className="text-gray-600" />
                    </div>
                    <p className="text-sm text-gray-500">Click a node to view details</p>
                </div>
            </div>
        );
    }

    const info = details[nodeId];
    const Icon = typeIcons[info.type] || Database;
    const colors = typeColors[info.type] || typeColors.table;

    return (
        <div className="h-full flex flex-col animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg}`}>
                        <Icon size={16} className={colors.text} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-gray-100 truncate">
                            {info.name || nodeId}
                        </h3>
                        <span className={`text-[10px] font-bold uppercase ${colors.text}`}>
                            {info.type}
                        </span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded-md hover:bg-gray-800/50 text-gray-500 hover:text-gray-300 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {/* Source Tables */}
                {info.sourceTables && info.sourceTables.length > 0 && (
                    <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Source Tables
                        </h4>
                        <div className="space-y-1">
                            {info.sourceTables.map((src, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-gray-800/30 text-sm"
                                >
                                    <ArrowRight size={12} className="text-gray-500" />
                                    <span className="text-gray-300 font-mono text-xs">{src}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Joins */}
                {info.joins && info.joins.length > 0 && (
                    <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Joins
                        </h4>
                        <div className="space-y-2">
                            {info.joins.map((join, i) => (
                                <div
                                    key={i}
                                    className={`px-3 py-2 rounded-lg border ${colors.border} ${colors.bg}`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Link2 size={12} className={colors.text} />
                                        <span className={`text-xs font-semibold ${colors.text}`}>
                                            {join.joinType}
                                        </span>
                                        <span className="text-xs text-gray-400">→ {join.table}</span>
                                    </div>
                                    {join.joinKeys && join.joinKeys.length > 0 && (
                                        <div className="mt-1">
                                            {join.joinKeys.map((k, j) => (
                                                <div key={j} className="text-[11px] text-gray-400 font-mono">
                                                    ON {k.left} = {k.right}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Columns */}
                {info.columns && info.columns.length > 0 && (
                    <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Columns ({info.columns.length})
                        </h4>
                        <div className="flex flex-wrap gap-1">
                            {info.columns.map((col, i) => (
                                <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-md bg-gray-800/50 text-xs text-gray-300 font-mono
                             border border-gray-700/30"
                                >
                                    {col}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* SQL Snippet */}
                {info.sqlSnippet && (
                    <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            SQL Snippet
                        </h4>
                        <pre className="text-[11px] text-gray-400 font-mono bg-gray-900/50 p-3 rounded-lg
                           border border-gray-800/50 overflow-x-auto max-h-60 overflow-y-auto
                           leading-relaxed">
                            {info.sqlSnippet}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
