/**
 * AiPanel — AI-powered pipeline explanation and Q&A panel.
 * Uses Google Gemini API.
 */
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Send, Key, X, MessageCircle } from 'lucide-react';
import { explainPipeline, askQuestion } from '../utils/aiService';

export default function AiPanel({ sql, graphData, isOpen, onClose }) {
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
    const [showKeyInput, setShowKeyInput] = useState(false);
    const [explanation, setExplanation] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [question, setQuestion] = useState('');
    const [chatHistory, setChatHistory] = useState([]);

    const saveApiKey = (key) => {
        setApiKey(key);
        localStorage.setItem('gemini_api_key', key);
        setShowKeyInput(false);
    };

    const handleExplain = async () => {
        if (!apiKey) {
            setShowKeyInput(true);
            return;
        }
        if (!sql || !graphData) return;

        setLoading(true);
        setError('');
        try {
            const result = await explainPipeline(sql, graphData, apiKey);
            setExplanation(result);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAsk = async () => {
        if (!apiKey) {
            setShowKeyInput(true);
            return;
        }
        if (!question.trim() || !sql || !graphData) return;

        const userQ = question;
        setQuestion('');
        setChatHistory(prev => [...prev, { role: 'user', content: userQ }]);
        setLoading(true);
        setError('');

        try {
            const answer = await askQuestion(sql, graphData, userQ, apiKey);
            setChatHistory(prev => [...prev, { role: 'assistant', content: answer }]);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="h-full flex flex-col animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                        <Sparkles size={16} className="text-violet-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-100">AI Assistant</h3>
                        <span className="text-[10px] text-gray-500">Powered by Gemini</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowKeyInput(!showKeyInput)}
                        className={`p-1.5 rounded-md transition-colors ${apiKey ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-amber-400 hover:bg-amber-500/10'}`}
                        title={apiKey ? 'API key set' : 'Set API key'}
                    >
                        <Key size={14} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md hover:bg-gray-800/50 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* API Key input */}
            {showKeyInput && (
                <div className="px-4 py-3 border-b border-gray-800/30 bg-gray-900/30">
                    <label className="text-xs text-gray-400 mb-1 block">Gemini API Key</label>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter your Gemini API key..."
                            className="flex-1 px-3 py-1.5 rounded-md bg-gray-800/50 border border-gray-700/50
                         text-sm text-gray-200 placeholder-gray-600
                         focus:outline-none focus:border-brand-500/50"
                        />
                        <button
                            onClick={() => saveApiKey(apiKey)}
                            className="btn-primary text-xs px-3"
                        >
                            Save
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">
                        Stored locally in your browser. Never sent to third parties.
                    </p>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {/* Explain button */}
                <button
                    onClick={handleExplain}
                    disabled={loading || !sql}
                    className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
                >
                    {loading ? (
                        <div className="spinner" />
                    ) : (
                        <Sparkles size={15} />
                    )}
                    Explain this Pipeline
                </button>

                {/* Error */}
                {error && (
                    <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* Explanation */}
                {explanation && (
                    <div className="markdown-content">
                        <ReactMarkdown>{explanation}</ReactMarkdown>
                    </div>
                )}

                {/* Chat history */}
                {chatHistory.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-gray-800/30">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <MessageCircle size={12} />
                            Conversation
                        </h4>
                        {chatHistory.map((msg, i) => (
                            <div
                                key={i}
                                className={`px-3 py-2 rounded-lg text-sm ${msg.role === 'user'
                                        ? 'bg-brand-500/10 border border-brand-500/20 text-gray-200'
                                        : 'bg-gray-800/30 border border-gray-700/20'
                                    }`}
                            >
                                {msg.role === 'user' ? (
                                    <p className="text-gray-200">{msg.content}</p>
                                ) : (
                                    <div className="markdown-content">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Question input */}
            <div className="px-4 py-3 border-t border-gray-800/50">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                        placeholder="Ask about this pipeline..."
                        className="flex-1 px-3 py-2 rounded-lg bg-gray-800/30 border border-gray-700/30
                       text-sm text-gray-200 placeholder-gray-600
                       focus:outline-none focus:border-brand-500/30"
                    />
                    <button
                        onClick={handleAsk}
                        disabled={loading || !question.trim()}
                        className="btn-primary p-2"
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
