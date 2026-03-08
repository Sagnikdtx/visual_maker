/**
 * CustomNode — styled React Flow node with type-based coloring,
 * icon, label, and glow effects.
 */
import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Database, GitBranch, CheckCircle2, Package } from 'lucide-react';

const typeConfig = {
    table: {
        icon: Database,
        color: '#3b82f6',
        bgGradient: 'from-blue-500/20 to-blue-600/10',
        borderColor: 'border-blue-500/40',
        glow: 'node-glow-blue',
        label: 'TABLE',
        labelBg: 'bg-blue-500/20 text-blue-300',
    },
    cte: {
        icon: GitBranch,
        color: '#a855f7',
        bgGradient: 'from-purple-500/20 to-purple-600/10',
        borderColor: 'border-purple-500/40',
        glow: 'node-glow-purple',
        label: 'CTE',
        labelBg: 'bg-purple-500/20 text-purple-300',
    },
    final: {
        icon: CheckCircle2,
        color: '#10b981',
        bgGradient: 'from-emerald-500/20 to-emerald-600/10',
        borderColor: 'border-emerald-500/40',
        glow: 'node-glow-green',
        label: 'OUTPUT',
        labelBg: 'bg-emerald-500/20 text-emerald-300',
    },
    dbt_ref: {
        icon: Package,
        color: '#f59e0b',
        bgGradient: 'from-amber-500/20 to-amber-600/10',
        borderColor: 'border-amber-500/40',
        glow: 'node-glow-amber',
        label: 'DBT REF',
        labelBg: 'bg-amber-500/20 text-amber-300',
    },
};

function CustomNode({ data, selected }) {
    const config = typeConfig[data.nodeType] || typeConfig.table;
    const Icon = config.icon;

    const diffClass = data.diffStatus
        ? data.diffStatus === 'added' ? 'diff-added'
            : data.diffStatus === 'removed' ? 'diff-removed'
                : data.diffStatus === 'modified' ? 'diff-modified'
                    : ''
        : '';

    return (
        <div
            className={`
        relative bg-gradient-to-br ${config.bgGradient}
        border ${config.borderColor} rounded-xl
        px-4 py-3 min-w-[200px] max-w-[260px]
        cursor-pointer transition-all duration-200
        hover:scale-[1.03] hover:shadow-lg
        ${selected ? config.glow : ''}
        ${diffClass}
      `}
            style={{
                backdropFilter: 'blur(12px)',
                background: selected
                    ? `linear-gradient(135deg, ${config.color}22, ${config.color}11)`
                    : `linear-gradient(135deg, ${config.color}15, ${config.color}08)`,
            }}
        >
            {/* Top handle */}
            <Handle
                type="target"
                position={Position.Top}
                className="!bg-gray-500/50 !border-gray-400/30 !w-2 !h-2"
            />

            {/* Header row */}
            <div className="flex items-center gap-2 mb-1">
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${config.color}25` }}
                >
                    <Icon size={15} style={{ color: config.color }} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-100 truncate">
                        {data.label}
                    </div>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${config.labelBg}`}>
                    {config.label}
                </span>
            </div>

            {/* Column count */}
            {data.columns && data.columns.length > 0 && (
                <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                    <span className="opacity-60">⊞</span>
                    {data.columns[0] === '*' ? 'All columns (*)' : `${data.columns.length} column${data.columns.length > 1 ? 's' : ''}`}
                </div>
            )}

            {/* Diff badge */}
            {data.diffStatus && data.diffStatus !== 'unchanged' && (
                <div className={`
          absolute -top-2 -right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full
          ${data.diffStatus === 'added' ? 'bg-emerald-500 text-white' : ''}
          ${data.diffStatus === 'removed' ? 'bg-red-500 text-white' : ''}
          ${data.diffStatus === 'modified' ? 'bg-amber-500 text-white' : ''}
        `}>
                    {data.diffStatus.toUpperCase()}
                </div>
            )}

            {/* Bottom handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="!bg-gray-500/50 !border-gray-400/30 !w-2 !h-2"
            />
        </div>
    );
}

export default memo(CustomNode);
