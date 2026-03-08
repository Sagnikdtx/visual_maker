/**
 * App — Main application component.
 * 3-panel layout: left (SQL editor), center (graph), right (sidebar/AI).
 */
import React, { useState, useCallback } from 'react';
import {
    Code2, GitCompare, Sparkles, PanelRightOpen, PanelRightClose,
    Workflow, AlertCircle
} from 'lucide-react';
import SqlEditor from './components/SqlEditor';
import GraphCanvas from './components/GraphCanvas';
import Sidebar from './components/Sidebar';
import DiffView from './components/DiffView';
import AiPanel from './components/AiPanel';
import { parseSQL, diffSQL } from './utils/sqlParser';

const MODES = {
    SINGLE: 'single',
    DIFF: 'diff',
};

export default function App() {
    // ── State ──
    const [mode, setMode] = useState(MODES.SINGLE);
    const [sql, setSql] = useState('');
    const [sqlOld, setSqlOld] = useState('');
    const [sqlNew, setSqlNew] = useState('');
    const [graphData, setGraphData] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showRightPanel, setShowRightPanel] = useState(true);
    const [rightPanelTab, setRightPanelTab] = useState('details'); // 'details' | 'ai'
    const [leftPanelWidth, setLeftPanelWidth] = useState(380);
    const [diffSummary, setDiffSummary] = useState(null);

    // ── Handlers ──
    const handleVisualize = useCallback(() => {
        if (!sql.trim()) return;
        setLoading(true);
        setError('');
        setSelectedNode(null);

        // Use setTimeout to avoid blocking the UI
        setTimeout(() => {
            try {
                const result = parseSQL(sql);
                if (result.error) {
                    setError(`Parse error: ${result.error}`);
                    setGraphData(null);
                } else if (result.nodes.length === 0) {
                    setError('No tables or CTEs found in the SQL.');
                    setGraphData(null);
                } else {
                    setGraphData(result);
                    setError('');
                }
            } catch (e) {
                setError(`Parse error: ${e.message}`);
                setGraphData(null);
            } finally {
                setLoading(false);
            }
        }, 50);
    }, [sql]);

    const handleDiff = useCallback(() => {
        if (!sqlOld.trim() || !sqlNew.trim()) return;
        setLoading(true);
        setError('');
        setSelectedNode(null);

        setTimeout(() => {
            try {
                const result = diffSQL(sqlOld, sqlNew);
                setGraphData(result);
                setDiffSummary(result.diffSummary || []);
                setError('');
            } catch (e) {
                setError(`Diff error: ${e.message}`);
                setGraphData(null);
            } finally {
                setLoading(false);
            }
        }, 50);
    }, [sqlOld, sqlNew]);

    const handleNodeClick = useCallback((nodeId) => {
        setSelectedNode(nodeId);
        setRightPanelTab('details');
        if (!showRightPanel) setShowRightPanel(true);
    }, [showRightPanel]);

    // ── Drag to resize left panel ──
    const handleResizeStart = useCallback((e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = leftPanelWidth;

        const onMouseMove = (ev) => {
            const newWidth = Math.min(700, Math.max(280, startWidth + ev.clientX - startX));
            setLeftPanelWidth(newWidth);
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [leftPanelWidth]);

    return (
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface-500">
            {/* ── Top Bar ── */}
            <header className="h-12 flex items-center justify-between px-4 border-b border-gray-800/50 bg-surface-200/80 backdrop-blur-md z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
                        <Workflow size={17} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-gray-100 leading-tight tracking-tight">SQL Visualizer</h1>
                        <p className="text-[10px] text-gray-500 leading-tight">Interactive Pipeline Diagrams</p>
                    </div>
                </div>

                {/* Mode tabs */}
                <div className="flex items-center bg-surface-300/80 rounded-lg p-0.5 border border-gray-800/30">
                    <button
                        onClick={() => { setMode(MODES.SINGLE); setGraphData(null); setError(''); setDiffSummary(null); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === MODES.SINGLE
                                ? 'bg-brand-600/20 text-brand-300 shadow-sm'
                                : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <Code2 size={13} />
                        Single SQL
                    </button>
                    <button
                        onClick={() => { setMode(MODES.DIFF); setGraphData(null); setError(''); setDiffSummary(null); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === MODES.DIFF
                                ? 'bg-brand-600/20 text-brand-300 shadow-sm'
                                : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <GitCompare size={13} />
                        Compare
                    </button>
                </div>

                {/* Right side actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setRightPanelTab('ai');
                            setShowRightPanel(true);
                        }}
                        className="btn-secondary flex items-center gap-1.5 text-xs"
                    >
                        <Sparkles size={13} />
                        AI Assistant
                    </button>
                    <button
                        onClick={() => setShowRightPanel(!showRightPanel)}
                        className="p-1.5 rounded-md hover:bg-gray-800/50 text-gray-500 hover:text-gray-300 transition-colors"
                        title={showRightPanel ? 'Hide panel' : 'Show panel'}
                    >
                        {showRightPanel ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                    </button>
                </div>
            </header>

            {/* ── Main Content ── */}
            <div className="flex-1 flex min-h-0">
                {/* Left Panel — Editor */}
                <div
                    className="shrink-0 border-r border-gray-800/50 bg-surface-100/50 flex flex-col"
                    style={{ width: leftPanelWidth }}
                >
                    {mode === MODES.SINGLE ? (
                        <SqlEditor
                            value={sql}
                            onChange={setSql}
                            onVisualize={handleVisualize}
                            loading={loading}
                        />
                    ) : (
                        <DiffView
                            sqlOld={sqlOld}
                            sqlNew={sqlNew}
                            onSqlOldChange={setSqlOld}
                            onSqlNewChange={setSqlNew}
                            onDiff={handleDiff}
                            loading={loading}
                            diffSummary={diffSummary}
                        />
                    )}
                </div>

                {/* Resize handle */}
                <div
                    className="resize-handle"
                    onMouseDown={handleResizeStart}
                />

                {/* Center — Graph Canvas */}
                <div className="flex-1 min-w-0 relative">
                    {/* Error banner */}
                    {error && (
                        <div className="absolute top-3 left-3 right-3 z-10 animate-fade-in">
                            <div className="glass-panel px-4 py-2.5 flex items-start gap-2 border-red-500/30 bg-red-500/5">
                                <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm text-red-300 font-medium">Parse Error</p>
                                    <p className="text-xs text-red-400/80 mt-0.5">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stats bar */}
                    {graphData && graphData.nodes && graphData.nodes.length > 0 && (
                        <div className="absolute top-3 right-3 z-10 animate-fade-in">
                            <div className="glass-panel px-3 py-1.5 flex items-center gap-3 text-[11px]">
                                <span className="text-blue-400">
                                    <span className="font-bold">{graphData.nodes.filter(n => n.type === 'table' || n.type === 'dbt_ref').length}</span> tables
                                </span>
                                <span className="text-gray-700">|</span>
                                <span className="text-purple-400">
                                    <span className="font-bold">{graphData.nodes.filter(n => n.type === 'cte').length}</span> CTEs
                                </span>
                                <span className="text-gray-700">|</span>
                                <span className="text-emerald-400">
                                    <span className="font-bold">{graphData.edges.filter(e => e.joinType).length}</span> joins
                                </span>
                                {graphData.dbtRefs && graphData.dbtRefs.length > 0 && (
                                    <>
                                        <span className="text-gray-700">|</span>
                                        <span className="text-amber-400">
                                            <span className="font-bold">{graphData.dbtRefs.length}</span> dbt refs
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    <GraphCanvas
                        graphData={graphData}
                        onNodeClick={handleNodeClick}
                    />
                </div>

                {/* Right Panel — Sidebar / AI */}
                {showRightPanel && (
                    <>
                        <div className="w-px bg-gray-800/50" />
                        <div className="w-[320px] shrink-0 bg-surface-100/50 flex flex-col">
                            {/* Panel tabs */}
                            <div className="flex border-b border-gray-800/50">
                                <button
                                    onClick={() => setRightPanelTab('details')}
                                    className={`flex-1 py-2 text-xs font-medium transition-all ${rightPanelTab === 'details' ? 'tab-active' : 'tab-inactive'
                                        }`}
                                >
                                    Node Details
                                </button>
                                <button
                                    onClick={() => setRightPanelTab('ai')}
                                    className={`flex-1 py-2 text-xs font-medium transition-all flex items-center justify-center gap-1 ${rightPanelTab === 'ai' ? 'tab-active' : 'tab-inactive'
                                        }`}
                                >
                                    <Sparkles size={11} />
                                    AI Assistant
                                </button>
                            </div>

                            {/* Panel content */}
                            {rightPanelTab === 'details' ? (
                                <Sidebar
                                    nodeId={selectedNode}
                                    details={graphData?.details}
                                    onClose={() => setSelectedNode(null)}
                                />
                            ) : (
                                <AiPanel
                                    sql={mode === MODES.SINGLE ? sql : sqlNew}
                                    graphData={graphData}
                                    isOpen={true}
                                    onClose={() => setRightPanelTab('details')}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
