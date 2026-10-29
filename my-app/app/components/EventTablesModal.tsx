"use client";

import React, { useState, useEffect } from "react";
import { 
    X, Check, Copy, RefreshCw, Loader2, Database, FileCode, Terminal, 
    Plus, Trash2, Code2, Sparkles, ArrowRight, ArrowLeft, Download,
    CheckCircle2, Layers, KeyRound, ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EventItem } from "@/lib/types";
import { updateEvent } from "@/lib/events";
import { 
    getEventTableNames, 
    checkTableExists,
    provisionEventTables,
    generateCustomEventTablesSQL,
    SchemaColumn,
    COMMON_SQL_TYPES,
    DEFAULT_PARTICIPANT_COLUMNS,
    DEFAULT_CHECKIN_COLUMNS,
} from "@/lib/eventTables";

interface EventTablesModalProps {
    isOpen: boolean;
    event: EventItem | null;
    onClose: () => void;
    onTablesCreated?: (updatedEvt: EventItem) => void;
}

export default function EventTablesModal({ isOpen, event, onClose, onTablesCreated }: EventTablesModalProps) {
    if (!isOpen || !event) return null;

    const { participantsTable, checkInTable, slug } = getEventTableNames(event.title);

    // Active Tab: 'designer' (Columns Builder) or 'sql' (Generated Script)
    const [activeTab, setActiveTab] = useState<'designer' | 'sql'>('designer');
    const [targetTable, setTargetTable] = useState<'participants' | 'checkin'>('participants');

    const [participantCols, setParticipantCols] = useState<SchemaColumn[]>(() => 
        DEFAULT_PARTICIPANT_COLUMNS.map(c => ({ ...c }))
    );
    const [checkInCols, setCheckInCols] = useState<SchemaColumn[]>(() => 
        DEFAULT_CHECKIN_COLUMNS.map(c => ({ ...c }))
    );

    const [generatedSQL, setGeneratedSQL] = useState<string>("");
    const [isChecking, setIsChecking] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [exists, setExists] = useState<boolean | null>(event.tablesCreated || null);
    const [copied, setCopied] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");

    useEffect(() => {
        verifyTableStatus();
    }, [event.id, event.title]);

    const currentCols = targetTable === 'participants' ? participantCols : checkInCols;
    const setCurrentCols = targetTable === 'participants' ? setParticipantCols : setCheckInCols;

    async function verifyTableStatus() {
        setIsChecking(true);
        try {
            const hasTable = await checkTableExists(participantsTable);
            setExists(hasTable);
            if (hasTable && !event?.tablesCreated) {
                const updated = await updateEvent(event!.id, {
                    tablesCreated: true,
                    participantsTable,
                    checkInTable,
                });
                if (onTablesCreated) onTablesCreated(updated);
            }
        } catch {
            setExists(false);
        } finally {
            setIsChecking(false);
        }
    }

    const handleAddColumn = () => {
        const newCol: SchemaColumn = {
            id: 'col_' + Date.now() + Math.random().toString(36).substring(2, 6),
            name: '',
            type: 'TEXT',
            defaultValue: '',
            isNullable: true,
            isPrimaryKey: false,
            isUnique: false,
        };
        setCurrentCols(prev => [...prev, newCol]);
    };

    const handleUpdateColumn = (id: string, updates: Partial<SchemaColumn>) => {
        setCurrentCols(prev => prev.map(col => col.id === id ? { ...col, ...updates } : col));
    };

    const handleRemoveColumn = (id: string) => {
        setCurrentCols(prev => prev.filter(col => col.id !== id));
    };

    const handleLoadPreset = (preset: 'standard' | 'hackathon' | 'minimal') => {
        if (targetTable === 'participants') {
            if (preset === 'standard') {
                setParticipantCols(DEFAULT_PARTICIPANT_COLUMNS.map(c => ({ ...c })));
            } else if (preset === 'hackathon') {
                setParticipantCols([
                    { id: 'h1', name: 'id', type: 'TEXT', isPrimaryKey: true, isNullable: false },
                    { id: 'h2', name: 'participant_id', type: 'TEXT', isNullable: false, isUnique: true },
                    { id: 'h3', name: 'participant_name', type: 'TEXT', isNullable: false },
                    { id: 'h4', name: 'team_name', type: 'TEXT', isNullable: false },
                    { id: 'h5', name: 'team_role', type: 'TEXT', defaultValue: "'Lead'", isNullable: true },
                    { id: 'h6', name: 'github_username', type: 'TEXT', isNullable: true },
                    { id: 'h7', name: 'tech_stack', type: 'TEXT', isNullable: true },
                    { id: 'h8', name: 'email', type: 'TEXT', isNullable: false },
                    { id: 'h9', name: 'mobile', type: 'TEXT', isNullable: true },
                    { id: 'h10', name: 'status', type: 'TEXT', defaultValue: "'registered'", isNullable: true },
                    { id: 'h11', name: 'event', type: 'TEXT', defaultValue: `'${event.title.replace(/'/g, "''")}'`, isNullable: true },
                    { id: 'h12', name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', defaultValue: "timezone('utc'::text, now())", isNullable: true },
                ]);
            } else if (preset === 'minimal') {
                setParticipantCols([
                    { id: 'm1', name: 'id', type: 'TEXT', isPrimaryKey: true, isNullable: false },
                    { id: 'm2', name: 'participant_id', type: 'TEXT', isNullable: false, isUnique: true },
                    { id: 'm3', name: 'participant_name', type: 'TEXT', isNullable: false },
                    { id: 'm4', name: 'email', type: 'TEXT', isNullable: true },
                    { id: 'm5', name: 'status', type: 'TEXT', defaultValue: "'registered'", isNullable: true },
                    { id: 'm6', name: 'event', type: 'TEXT', isNullable: true },
                ]);
            }
        } else {
            setCheckInCols(DEFAULT_CHECKIN_COLUMNS.map(c => ({ ...c })));
        }
    };

    const handleGenerateScript = () => {
        const validParticipantCols = participantCols
            .filter(c => c.name.trim() !== '')
            .map(c => ({ ...c, name: c.name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_') }));

        const validCheckInCols = checkInCols
            .filter(c => c.name.trim() !== '')
            .map(c => ({ ...c, name: c.name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_') }));

        const sql = generateCustomEventTablesSQL(event.title, validParticipantCols, validCheckInCols);
        setGeneratedSQL(sql);
        setActiveTab('sql');
    };

    const handleCopySQL = () => {
        const sqlToCopy = generatedSQL || generateCustomEventTablesSQL(event.title, participantCols, checkInCols);
        navigator.clipboard.writeText(sqlToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleDownloadSQL = () => {
        const sqlToDownload = generatedSQL || generateCustomEventTablesSQL(event.title, participantCols, checkInCols);
        const blob = new Blob([sqlToDownload], { type: 'text/sql' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schema_${slug}.sql`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleAutoCreateWithCustomSQL = async () => {
        setIsCreating(true);
        setStatusMessage("");
        try {
            const sqlToRun = generatedSQL || generateCustomEventTablesSQL(event.title, participantCols, checkInCols);
            const res = await provisionEventTables(event.title, sqlToRun);
            setStatusMessage(res.message);

            if (res.success) {
                setExists(true);
                const updated = await updateEvent(event!.id, {
                    tablesCreated: true,
                    participantsTable,
                    checkInTable,
                });
                if (onTablesCreated) onTablesCreated(updated);
            }
        } catch (err: any) {
            setStatusMessage("Error: " + (err.message || String(err)));
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 15 }}
                className="bg-[#0e0e12] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col text-white"
            >
                {/* 1. Sleek Studio Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#131318] flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <Database size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-black uppercase tracking-tight text-white truncate max-w-[320px] sm:max-w-md">
                                    {event.title}
                                </h2>
                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                                    exists 
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                }`}>
                                    {exists ? "Active in DB" : "Draft / Pending"}
                                </span>
                            </div>
                            <p className="text-[11px] font-mono text-white/40">
                                Target: <span className="text-white/70">{participantsTable}</span>
                            </p>
                        </div>
                    </div>

                    {/* Mode Switcher Pills */}
                    <div className="flex items-center gap-3">
                        <div className="flex bg-black/50 p-1 rounded-xl border border-white/10 text-xs font-bold">
                            <button
                                onClick={() => setActiveTab('designer')}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                    activeTab === 'designer' 
                                        ? 'bg-amber-500 text-black font-black shadow' 
                                        : 'text-white/60 hover:text-white'
                                }`}
                            >
                                <Layers size={13} />
                                <span>Columns</span>
                            </button>
                            <button
                                onClick={handleGenerateScript}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                    activeTab === 'sql' 
                                        ? 'bg-amber-500 text-black font-black shadow' 
                                        : 'text-white/60 hover:text-white'
                                }`}
                            >
                                <Code2 size={13} />
                                <span>SQL Script</span>
                            </button>
                        </div>

                        <button 
                            onClick={onClose} 
                            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* 2. Body Area */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                    {/* TAB 1: COLUMNS DESIGNER */}
                    {activeTab === 'designer' && (
                        <div className="space-y-4">
                            {/* Toolbar: Table Select & Presets */}
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#131318] p-3 rounded-2xl border border-white/5">
                                {/* Table Selector */}
                                <div className="flex items-center gap-2 text-xs font-bold">
                                    <span className="text-white/40 text-[11px] uppercase tracking-wider">Editing:</span>
                                    <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5 font-mono text-[11px]">
                                        <button
                                            onClick={() => setTargetTable('participants')}
                                            className={`px-2.5 py-1 rounded-md transition-all ${
                                                targetTable === 'participants' 
                                                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' 
                                                    : 'text-white/50 hover:text-white'
                                            }`}
                                        >
                                            participants ({participantCols.length})
                                        </button>
                                        <button
                                            onClick={() => setTargetTable('checkin')}
                                            className={`px-2.5 py-1 rounded-md transition-all ${
                                                targetTable === 'checkin' 
                                                    ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40' 
                                                    : 'text-white/50 hover:text-white'
                                            }`}
                                        >
                                            check_in_logs ({checkInCols.length})
                                        </button>
                                    </div>
                                </div>

                                {/* Quick Presets & Add Column */}
                                <div className="flex items-center gap-2">
                                    <span className="text-white/30 text-[10px] uppercase font-bold hidden sm:inline">Presets:</span>
                                    <button
                                        type="button"
                                        onClick={() => handleLoadPreset('standard')}
                                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-[10px] font-bold uppercase transition-colors"
                                    >
                                        Standard
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleLoadPreset('hackathon')}
                                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-[10px] font-bold uppercase transition-colors"
                                    >
                                        Hackathon
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleLoadPreset('minimal')}
                                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-[10px] font-bold uppercase transition-colors"
                                    >
                                        Minimal
                                    </button>

                                    <div className="w-[1px] h-4 bg-white/10 mx-1" />

                                    <button
                                        type="button"
                                        onClick={handleAddColumn}
                                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-black text-xs font-black uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/10 cursor-pointer"
                                    >
                                        <Plus size={13} strokeWidth={3} />
                                        <span>Add Column</span>
                                    </button>
                                </div>
                            </div>

                            {/* Clean Data Grid / Column Rows */}
                            <div className="bg-[#111116] border border-white/10 rounded-2xl overflow-hidden">
                                {/* Grid Header */}
                                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-black/40 border-b border-white/5 text-[10px] font-black uppercase tracking-wider text-white/40">
                                    <div className="col-span-1 text-center">#</div>
                                    <div className="col-span-4">Column Name</div>
                                    <div className="col-span-3">Data Type</div>
                                    <div className="col-span-3">Default Value / Values</div>
                                    <div className="col-span-1 text-right">Action</div>
                                </div>

                                {/* Columns Scrollable List */}
                                <div className="divide-y divide-white/5 max-h-[380px] overflow-y-auto font-mono text-xs">
                                    {currentCols.map((col, idx) => (
                                        <div
                                            key={col.id}
                                            className="grid grid-cols-12 gap-2 px-4 py-2 items-center hover:bg-white/[0.02] transition-colors"
                                        >
                                            {/* Index & PK indicator */}
                                            <div className="col-span-1 flex items-center justify-center gap-1 text-[11px] text-white/30">
                                                {col.isPrimaryKey ? (
                                                    <span title="Primary Key" className="text-amber-400 font-bold">🔑</span>
                                                ) : (
                                                    <span>{idx + 1}</span>
                                                )}
                                            </div>

                                            {/* Column Name */}
                                            <div className="col-span-4 flex items-center gap-1.5">
                                                <input
                                                    type="text"
                                                    value={col.name}
                                                    onChange={(e) => handleUpdateColumn(col.id, { name: e.target.value })}
                                                    placeholder="column_name"
                                                    className="w-full bg-black/40 border border-white/10 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none font-bold placeholder:text-white/20 transition-colors"
                                                />
                                            </div>

                                            {/* Data Type */}
                                            <div className="col-span-3">
                                                <select
                                                    value={col.type}
                                                    onChange={(e) => handleUpdateColumn(col.id, { type: e.target.value })}
                                                    className="w-full bg-black/40 border border-white/10 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-bold outline-none transition-colors"
                                                >
                                                    {COMMON_SQL_TYPES.map(t => (
                                                        <option key={t} value={t} className="bg-[#111] text-white">{t}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Default Value & Constraints */}
                                            <div className="col-span-3 flex items-center gap-1.5">
                                                <input
                                                    type="text"
                                                    value={col.defaultValue || ""}
                                                    onChange={(e) => handleUpdateColumn(col.id, { defaultValue: e.target.value })}
                                                    placeholder="NULL"
                                                    className="w-full bg-black/40 border border-white/10 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-white/80 outline-none placeholder:text-white/20 transition-colors"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateColumn(col.id, { isNullable: !col.isNullable })}
                                                    title={col.isNullable === false ? "NOT NULL" : "Nullable"}
                                                    className={`px-1.5 py-1 rounded text-[9px] font-bold flex-shrink-0 transition-colors ${
                                                        col.isNullable === false 
                                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                                                            : 'bg-white/5 text-white/30 hover:text-white/60'
                                                    }`}
                                                >
                                                    NN
                                                </button>
                                            </div>

                                            {/* Delete */}
                                            <div className="col-span-1 flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveColumn(col.id)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                    title="Remove Column"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {currentCols.length === 0 && (
                                        <div className="text-center py-8 text-white/40 text-xs">
                                            No columns defined. Click "Add Column" or select a preset above.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: GENERATED SQL SCRIPT */}
                    {activeTab === 'sql' && (
                        <div className="space-y-4">
                            {/* Studio Code Box */}
                            <div className="bg-[#08080b] border border-white/10 rounded-2xl overflow-hidden shadow-inner">
                                <div className="px-4 py-2.5 bg-[#121216] border-b border-white/5 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-white/50 font-mono text-[11px]">
                                        <FileCode size={13} className="text-amber-500" />
                                        <span>PostgreSQL DDL • {participantsTable} & {checkInTable}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleCopySQL}
                                            className="px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[11px] font-bold uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
                                        >
                                            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                            <span>{copied ? "Copied!" : "Copy SQL"}</span>
                                        </button>
                                        <button
                                            onClick={handleDownloadSQL}
                                            className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-[11px] font-bold uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Download size={12} />
                                            <span>Download</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 max-h-[360px] overflow-y-auto font-mono text-xs text-amber-200/90 leading-relaxed scrollbar-thin">
                                    <pre className="whitespace-pre-wrap">{generatedSQL || generateCustomEventTablesSQL(event.title, participantCols, checkInCols)}</pre>
                                </div>
                            </div>

                            {statusMessage && (
                                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-amber-300">
                                    {statusMessage}
                                </div>
                            )}

                            {/* Execution Notice */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#131318] border border-white/5 text-xs">
                                <p className="text-white/50 text-[11px]">
                                    Execute this script in <strong>Supabase SQL Editor</strong>, or click Run RPC to auto-provision:
                                </p>
                                <button
                                    onClick={handleAutoCreateWithCustomSQL}
                                    disabled={isCreating}
                                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                                >
                                    {isCreating ? <Loader2 size={13} className="animate-spin" /> : <Terminal size={13} />}
                                    <span>Run in Supabase (RPC)</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Clean Footer */}
                <div className="px-6 py-3.5 border-t border-white/10 flex items-center justify-between bg-[#111116] flex-shrink-0 text-xs">
                    <button
                        onClick={verifyTableStatus}
                        disabled={isChecking}
                        className="text-white/40 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer text-[11px] font-mono"
                    >
                        <RefreshCw size={11} className={isChecking ? "animate-spin" : ""} />
                        <span>Check Status</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-bold transition-colors cursor-pointer"
                        >
                            Close
                        </button>

                        {activeTab === 'designer' ? (
                            <button
                                onClick={handleGenerateScript}
                                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
                            >
                                <span>Generate Script</span>
                                <ArrowRight size={14} strokeWidth={3} />
                            </button>
                        ) : (
                            <button
                                onClick={handleCopySQL}
                                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                <span>{copied ? "Copied to Clipboard" : "Copy Complete SQL"}</span>
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
