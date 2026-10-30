"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
    Plus, Trash2, Edit3, Copy, Search, Loader2, Calendar, MapPin, 
    Users, ShieldCheck, QrCode, Mail, ScanLine, LayoutDashboard, 
    ChevronRight, X, Sparkles, Filter, CheckCircle2, ArrowRight, 
    RefreshCw, AlertCircle, Layers, Check, ExternalLink, BarChart3,
    Database, Table2, FileCode, Terminal
} from "lucide-react";
import { EventItem, Participant } from "@/lib/types";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getEvents, createEvent, updateEvent, deleteEvent } from "@/lib/events";
import { 
    getEventTableNames, 
    generateEventTablesSQL, 
    provisionEventTables, 
    checkTableExists,
    sanitizeEventTableName 
} from "@/lib/eventTables";
import EventTablesModal from "@/app/components/EventTablesModal";
import Link from "next/link";

const CATEGORIES = ["ALL", "TECHNICAL", "CULTURAL", "SYMPOSIUM", "GAMING", "SPORTS", "WORKSHOP"] as const;
const STATUS_OPTIONS = ["all", "active", "upcoming", "completed"] as const;

export default function AdminEventsDashboard() {
    const router = useRouter();

    const [events, setEvents] = useState<EventItem[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
    const [selectedStatus, setSelectedStatus] = useState<string>("all");

    // Modal States
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
    const [deletingEvent, setDeletingEvent] = useState<EventItem | null>(null);
    const [tablesModalEvent, setTablesModalEvent] = useState<EventItem | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Auth verification
    useEffect(() => {
        const isAdmin = localStorage.getItem("vishaka_admin_session");
        const role = localStorage.getItem("vishaka_role");
        if (isAdmin !== "true") {
            router.push("/login");
            return;
        }
        if (role === "volunteer") {
            router.push("/admin/scan");
            return;
        }

        loadAllData();
    }, [router]);

    // Supabase Real-time updates for participants & events
    useEffect(() => {
        const channel = supabase
            .channel('admin-events-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'participants_ignite2k26' }, () => {
                fetchParticipantsOnly();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'check_in_logs_ignite2k26' }, () => {
                fetchParticipantsOnly();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
                fetchParticipantsOnly();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'check_in_logs' }, () => {
                fetchParticipantsOnly();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
                loadAllData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function loadAllData() {
        setLoading(true);
        try {
            const list = await getEvents();
            setEvents(list);
            await fetchParticipantsOnly(list);
        } catch (e) {
            console.error("Error loading dashboard data:", e);
        } finally {
            setLoading(false);
        }
    }

    async function loadEventsOnly() {
        try {
            const list = await getEvents();
            setEvents(list);
            return list;
        } catch (err) {
            console.error("Failed to load events:", err);
            return [];
        }
    }

    async function fetchParticipantsOnly(eventsList?: EventItem[]) {
        try {
            const evts = eventsList || events;
            let allParticipants: any[] = [];
            let allCheckedInIds = new Set<string>();

            // 1. Query all dedicated event tables (including participants_ignite2k26 by default)
            const tablePairs = new Map<string, string>();
            tablePairs.set('participants_ignite2k26', 'check_in_logs_ignite2k26');

            for (const evt of evts) {
                const { participantsTable, checkInTable } = getEventTableNames(evt.title);
                const pT = evt.participantsTable || participantsTable;
                const cT = evt.checkInTable || checkInTable;
                tablePairs.set(pT, cT);
            }

            for (const [pTable, cTable] of Array.from(tablePairs.entries())) {
                try {
                    const exists = await checkTableExists(pTable);
                    if (exists) {
                        const pRes = await supabase.from(pTable).select('*');
                        let logData: any[] = [];
                        const hasLogTable = await checkTableExists(cTable);
                        if (hasLogTable) {
                            const lRes = await supabase.from(cTable).select('participant_id');
                            if (lRes.data) logData = lRes.data;
                        }

                        if (pRes.data) {
                            const existingIds = new Set(allParticipants.map((p: any) => p.participant_id || p.id));
                            for (const row of pRes.data) {
                                const pid = row.participant_id || row.id;
                                if (pid && !existingIds.has(pid)) {
                                    allParticipants.push({
                                        ...row,
                                        source_table: pTable,
                                        event: row.event || (pTable.includes('ignite') ? 'Ignite2k26' : 'General')
                                    });
                                    existingIds.add(pid);
                                }
                            }
                        }
                        if (logData.length > 0) {
                            logData.forEach((l: any) => {
                                if (l && l.participant_id) allCheckedInIds.add(l.participant_id);
                            });
                        }
                    }
                } catch (e) {
                    console.warn(`Error querying table pair ${pTable}:`, e);
                }
            }

            // 2. Try unified table if it exists
            try {
                const hasUnified = await checkTableExists('participants');
                if (hasUnified) {
                    const [pRes, logRes] = await Promise.all([
                        supabase.from('participants').select('*'),
                        supabase.from('check_in_logs').select('participant_id')
                    ]);
                    if (pRes.data) {
                        const existingIds = new Set(allParticipants.map((p: any) => p.participant_id || p.id));
                        for (const row of pRes.data) {
                            const pid = row.participant_id || row.id;
                            if (pid && !existingIds.has(pid)) {
                                allParticipants.push(row);
                                existingIds.add(pid);
                            }
                        }
                    }
                    if (logRes.data) {
                        (logRes.data as any[]).forEach(l => allCheckedInIds.add(l.participant_id));
                    }
                }
            } catch (e) {}

            // 3. Reconcile localStorage caches with live database truth
            if (typeof window !== 'undefined') {
                try {
                    if (allParticipants.length > 0) {
                        // Live database is authoritative: prune stale local caches so they don't ghost-inflate counts
                        const keysToRemove: string[] = [];
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.startsWith('local_participants_')) {
                                keysToRemove.push(key);
                            }
                        }
                        keysToRemove.forEach(k => localStorage.removeItem(k));
                    } else {
                        // Fallback only if database returned 0 records or is offline
                        const existingIds = new Set(allParticipants.map((p: any) => String(p.participant_id || p.id || '').toLowerCase()));
                        const existingRegs = new Set(allParticipants.map((p: any) => String(p.register_number || '').trim().toLowerCase()));

                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.startsWith('local_participants_')) {
                                const items = JSON.parse(localStorage.getItem(key) || '[]');
                                for (const row of items) {
                                    const pid = String(row.participant_id || row.id || '').toLowerCase();
                                    const reg = String(row.register_number || row.registerNumber || '').trim().toLowerCase();
                                    if ((!pid || !existingIds.has(pid)) && (!reg || !existingRegs.has(reg))) {
                                        allParticipants.push(row);
                                        if (pid) existingIds.add(pid);
                                        if (reg) existingRegs.add(reg);
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {}
            }

            setParticipants(allParticipants);
            setCheckedInIds(allCheckedInIds);
        } catch (err) {
            console.error("Failed to fetch participants count:", err);
        }
    }

    // Helper: calculate registered & checked-in counts for an event
    const eventStats = useMemo(() => {
        const stats: Record<string, { registered: number; checkedIn: number }> = {};
        
        events.forEach(evt => {
            const isMainSymposium = evt.id === "vishaka-2026" || /vishaka/i.test(evt.code);
            const evtCode = evt.code.toLowerCase();
            const evtTitle = evt.title.toLowerCase();

            const matched = participants.filter((p: any) => {
                const pEvent = (p.event || "").trim().toLowerCase();
                const pSource = (p.source_table || "").toLowerCase();
                if (evt.id === "ignite2k26-mvi537sm" || /ignite/i.test(evtCode) || /ignite/i.test(evtTitle)) {
                    return /ignite/i.test(pEvent) || /ignite/i.test(pSource);
                }
                if (isMainSymposium) {
                    return !pEvent || /vishaka/i.test(pEvent) || /splash/i.test(pEvent) || pEvent.includes(evtCode);
                }
                return pEvent.includes(evtCode) || pEvent.includes(evtTitle) || evtTitle.includes(pEvent);
            });

            const checkedIn = matched.filter((p: any) => 
                p.status === 'checked-in' || checkedInIds.has(p.participant_id) || checkedInIds.has(p.id)
            ).length;

            stats[evt.id] = {
                registered: matched.length,
                checkedIn: checkedIn
            };
        });

        return stats;
    }, [events, participants, checkedInIds]);

    // Aggregates across the entire fest
    const totalEventsCount = events.length;
    const activeEventsCount = events.filter(e => e.status === "active").length;
    const totalFestRegistrations = participants.length;
    const totalFestCheckedIn = participants.filter((p: any) => 
        p.status === 'checked-in' || checkedInIds.has(p.participant_id) || checkedInIds.has(p.id)
    ).length;

    // Filter events
    const filteredEvents = useMemo(() => {
        return events.filter(evt => {
            const matchesCategory = selectedCategory === "ALL" || evt.category.toUpperCase() === selectedCategory;
            const matchesStatus = selectedStatus === "all" || evt.status === selectedStatus;
            const matchesSearch = !searchTerm || 
                evt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                evt.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                evt.venue.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (evt.description && evt.description.toLowerCase().includes(searchTerm.toLowerCase()));

            return matchesCategory && matchesStatus && matchesSearch;
        });
    }, [events, selectedCategory, selectedStatus, searchTerm]);

    // Handle Create Event with optional Table Provisioning
    const handleCreateEvent = async (data: Omit<EventItem, 'id' | 'createdAt'>, autoCreateTables: boolean = true) => {
        setIsSubmitting(true);
        try {
            let tableProps: Partial<EventItem> = {};
            let provResult: any = null;

            if (autoCreateTables) {
                const { participantsTable, checkInTable } = getEventTableNames(data.title);
                tableProps.participantsTable = participantsTable;
                tableProps.checkInTable = checkInTable;

                provResult = await provisionEventTables(data.title);
                tableProps.tablesCreated = provResult.success;
            }

            const newEvt = await createEvent({
                ...data,
                ...tableProps,
            });

            setEvents(prev => [newEvt, ...prev]);
            setShowCreateModal(false);

            // If auto-create was selected, open the Table Modal so the user can see status & copy SQL if needed
            if (autoCreateTables) {
                setTablesModalEvent(newEvt);
            }
        } catch (err: any) {
            alert("Failed to create event: " + (err.message || err));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Update Event
    const handleUpdateEvent = async (data: Partial<EventItem>) => {
        if (!editingEvent) return;
        setIsSubmitting(true);
        try {
            const updated = await updateEvent(editingEvent.id, data);
            setEvents(prev => prev.map(e => e.id === editingEvent.id ? updated : e));
            setEditingEvent(null);
        } catch (err: any) {
            alert("Failed to update event: " + (err.message || err));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Delete Event
    const handleDeleteEvent = async () => {
        if (!deletingEvent) return;
        setIsSubmitting(true);
        try {
            await deleteEvent(deletingEvent.id);
            setEvents(prev => prev.filter(e => e.id !== deletingEvent.id));
            setDeletingEvent(null);
        } catch (err: any) {
            alert("Failed to delete event: " + (err.message || err));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Duplicate Event
    const handleDuplicateEvent = async (source: EventItem) => {
        try {
            const cloneData: Omit<EventItem, 'id' | 'createdAt'> = {
                title: `${source.title} (Copy)`,
                code: `${source.code}-COPY`,
                category: source.category,
                description: source.description,
                venue: source.venue,
                date: source.date,
                time: source.time,
                status: 'upcoming',
                maxCapacity: source.maxCapacity,
                colorTheme: source.colorTheme,
            };
            const created = await createEvent(cloneData);
            setEvents(prev => [created, ...prev]);
        } catch (e: any) {
            alert("Duplicate failed: " + e.message);
        }
    };

    const getCategoryBadgeClass = (category: string) => {
        switch (category.toLowerCase()) {
            case 'technical': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
            case 'cultural': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
            case 'gaming': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'sports': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case 'workshop': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            case 'symposium': default: return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        }
    };

    const fadin: Variants = {
        hidden: { opacity: 0, y: 15 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] } as any,
        }),
    };

    return (
        <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-outfit selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden relative pb-32">
            {/* Background Grid Accent */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: '40px 40px' }} />

            <div className="max-w-7xl mx-auto px-4 md:px-6 pt-24 md:pt-28">

                {/* Dashboard Main Header */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-10"
                >
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            Administrator Control • Event Orchestration
                        </div>

                        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight uppercase leading-none">
                            Events <span className="text-amber-500">Dashboard.</span>
                        </h1>

                        <p className="text-xs md:text-sm text-white/40 font-medium max-w-xl">
                            Create, configure, and orchestrate all festival events at a time. Click any event to launch its live Command Center.
                        </p>
                    </div>

                    {/* Header Controls */}
                    <div className="flex flex-wrap items-center gap-2.5 md:gap-3 w-full lg:w-auto">
                        <Link
                            href="/admin/scan"
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#101013] border border-white/5 hover:border-amber-500/30 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white transition-all shadow-lg"
                        >
                            <ScanLine className="w-3.5 h-3.5 text-amber-500" /> SCANNER
                        </Link>

                        <Link
                            href="/admin/broadcast"
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#101013] border border-white/5 hover:border-amber-500/30 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white transition-all shadow-lg"
                        >
                            <Mail className="w-3.5 h-3.5 text-amber-500" /> BROADCAST
                        </Link>

                        <Link
                            href="/admin/events/all"
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#101013] border border-white/5 hover:border-amber-500/30 px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white transition-all shadow-lg"
                        >
                            <BarChart3 className="w-3.5 h-3.5 text-amber-500" /> ALL PARTICIPANTS
                        </Link>

                        <button
                            onClick={loadAllData}
                            className="w-10 h-10 flex items-center justify-center bg-[#101013] border border-white/5 hover:border-amber-500/30 rounded-xl text-white/40 hover:text-white transition-all cursor-pointer"
                            title="Refresh Data"
                        >
                            <RefreshCw size={15} />
                        </button>

                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.25em] hover:brightness-110 transition-all shadow-xl shadow-amber-500/20 active:scale-95 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" strokeWidth={3} /> CREATE EVENT
                        </button>
                    </div>
                </motion.header>

                {/* Festival Summary Stats (4 Metrics) */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-10"
                >
                    <div className="bg-[#0b0b0e] border border-white/5 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors" />
                        <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
                            <div className="flex items-center justify-between">
                                <Layers size={18} className="text-white/20 group-hover:text-amber-500 transition-colors" />
                                <span className="text-[9px] font-black uppercase text-amber-500 tracking-[0.2em] bg-amber-500/10 px-2 py-0.5 rounded-md">Total</span>
                            </div>
                            <div>
                                <h3 className="text-3xl md:text-4xl font-black text-white tracking-tighter leading-none mb-1">
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin text-amber-500" /> : totalEventsCount}
                                </h3>
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">MANAGED EVENTS</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#0b0b0e] border border-white/5 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
                        <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[9px] font-black uppercase text-emerald-400 tracking-[0.2em] bg-emerald-400/10 px-2 py-0.5 rounded-md">Live</span>
                            </div>
                            <div>
                                <h3 className="text-3xl md:text-4xl font-black text-white tracking-tighter leading-none mb-1">
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> : activeEventsCount}
                                </h3>
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">ACTIVE SESSIONS</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#0b0b0e] border border-white/5 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
                        <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
                            <div className="flex items-center justify-between">
                                <Users size={18} className="text-white/20 group-hover:text-blue-500 transition-colors" />
                                <span className="text-[9px] font-black uppercase text-blue-400 tracking-[0.2em] bg-blue-400/10 px-2 py-0.5 rounded-md">Delegates</span>
                            </div>
                            <div>
                                <h3 className="text-3xl md:text-4xl font-black text-white tracking-tighter leading-none mb-1">
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin text-blue-500" /> : totalFestRegistrations}
                                </h3>
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">FEST REGISTRATIONS</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#0b0b0e] border border-white/5 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors" />
                        <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
                            <div className="flex items-center justify-between">
                                <ShieldCheck size={18} className="text-white/20 group-hover:text-purple-500 transition-colors" />
                                <span className="text-[9px] font-black uppercase text-purple-400 tracking-[0.2em] bg-purple-400/10 px-2 py-0.5 rounded-md">Checked In</span>
                            </div>
                            <div>
                                <h3 className="text-3xl md:text-4xl font-black text-white tracking-tighter leading-none mb-1">
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin text-purple-500" /> : totalFestCheckedIn}
                                </h3>
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">ATTENDEES INSIDE</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Filter & Search Bar */}
                <div className="space-y-4 mb-8">
                    <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={17} />
                            <input
                                type="text"
                                placeholder="Search by event title, code, venue..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-[#0c0c0f] border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-white placeholder:text-white/25 outline-none focus:border-amber-500/50 transition-colors"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-widest hidden sm:inline">Status:</span>
                            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-wider">
                                {STATUS_OPTIONS.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => setSelectedStatus(opt)}
                                        className={`px-3 py-1.5 rounded-lg transition-colors capitalize ${
                                            selectedStatus === opt 
                                                ? 'bg-amber-500 text-black font-black' 
                                                : 'text-white/40 hover:text-white'
                                        }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Category Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide text-[10px] font-black uppercase tracking-wider">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-xl border whitespace-nowrap transition-all ${
                                    selectedCategory === cat
                                        ? 'bg-white text-black border-white shadow-lg'
                                        : 'bg-white/[0.02] border-white/5 text-white/50 hover:text-white hover:border-white/20'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Events Cards Grid */}
                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center gap-4 text-white/30">
                        <Loader2 size={36} className="animate-spin text-amber-500" />
                        <p className="text-xs uppercase tracking-widest font-black">Loading event catalog...</p>
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div className="bg-[#0b0b0e] border border-white/5 rounded-3xl p-12 text-center max-w-md mx-auto">
                        <Layers size={36} className="mx-auto text-white/20 mb-4" />
                        <h3 className="text-white font-black text-base uppercase tracking-wider mb-2">No Matching Events Found</h3>
                        <p className="text-white/30 text-xs mb-6">
                            Try adjusting your search terms or filter selections, or create a brand new event.
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-amber-500 text-black px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors"
                        >
                            + Create Event
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredEvents.map((evt, i) => {
                            const stats = eventStats[evt.id] || { registered: 0, checkedIn: 0 };
                            const cap = evt.maxCapacity || 250;
                            const pct = Math.min(100, Math.round((stats.registered / cap) * 100));

                            return (
                                <motion.div
                                    key={evt.id}
                                    variants={fadin}
                                    initial="hidden"
                                    animate="visible"
                                    custom={i}
                                    className="bg-[#0a0a0d] border border-white/10 hover:border-amber-500/40 rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden group transition-all duration-300 hover:-translate-y-1"
                                >
                                    {/* Subtle Top Glow Accent */}
                                    <div 
                                        className="absolute top-0 left-0 w-full h-[3px] opacity-70 group-hover:opacity-100 transition-opacity"
                                        style={{ backgroundColor: evt.colorTheme || '#f59e0b' }}
                                    />

                                    <div>
                                        {/* Card Header: Category & Status */}
                                        <div className="flex items-center justify-between gap-2 mb-4">
                                            <span className={`text-[9px] font-black uppercase tracking-[0.25em] px-2.5 py-1 rounded-full border ${getCategoryBadgeClass(evt.category)}`}>
                                                {evt.category}
                                            </span>

                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-2 h-2 rounded-full ${
                                                    evt.status === 'active' ? 'bg-emerald-400 animate-pulse' : 
                                                    evt.status === 'upcoming' ? 'bg-blue-400' : 'bg-white/30'
                                                }`} />
                                                <span className="text-[9px] font-black uppercase tracking-wider text-white/50">
                                                    {evt.status}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Title & Code */}
                                        <div className="mb-4">
                                            <div className="font-mono text-[10px] font-black tracking-widest text-amber-500/80 mb-1">
                                                CODE: {evt.code}
                                            </div>
                                            <h2 className="text-xl font-black text-white uppercase tracking-tight leading-snug group-hover:text-amber-400 transition-colors line-clamp-2">
                                                {evt.title}
                                            </h2>
                                        </div>

                                        {/* Description */}
                                        {evt.description && (
                                            <p className="text-white/40 text-xs font-medium line-clamp-2 mb-5">
                                                {evt.description}
                                            </p>
                                        )}

                                        {/* Venue & Date Details */}
                                        <div className="space-y-2 mb-6 text-xs text-white/50 font-semibold bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                                            <div className="flex items-center gap-2 truncate">
                                                <MapPin size={13} className="text-amber-500 flex-shrink-0" />
                                                <span className="truncate">{evt.venue || "Campus Venue"}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Calendar size={13} className="text-amber-500 flex-shrink-0" />
                                                <span>{evt.date || "Date TBA"} {evt.time ? `• ${evt.time}` : ''}</span>
                                            </div>
                                        </div>

                                        {/* Capacity & Attendance Bar */}
                                        <div className="space-y-2 mb-6">
                                            <div className="flex justify-between items-center text-xs font-bold">
                                                <span className="text-white/50 uppercase text-[9px] tracking-wider">Capacity Fill</span>
                                                <span className="text-white font-mono text-[11px]">
                                                    <strong className="text-amber-400">{stats.registered}</strong> / {cap} ({pct}%)
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{ 
                                                        width: `${pct}%`,
                                                        backgroundColor: evt.colorTheme || '#f59e0b'
                                                    }}
                                                />
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] text-white/40 font-bold uppercase tracking-wider">
                                                <span>Present Inside: <strong className="text-emerald-400 font-mono">{stats.checkedIn}</strong></span>
                                                <span>Pending: <strong className="text-white/70 font-mono">{stats.registered - stats.checkedIn}</strong></span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Controls */}
                                    <div className="space-y-3 pt-4 border-t border-white/5">
                                        {/* Primary Dynamic Command Center Button */}
                                        <Link
                                            href={`/admin/events/${evt.id}`}
                                            className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-amber-500 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl active:scale-[0.98] group/btn no-underline"
                                        >
                                            <span>COMMAND CENTER</span>
                                            <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                                        </Link>

                                        {/* Sub Action Buttons */}
                                        <div className="flex items-center justify-between gap-2">
                                            <Link
                                                href={`/admin/scan?event=${encodeURIComponent(evt.code)}`}
                                                className="flex-1 flex items-center justify-center gap-1.5 bg-white/[0.03] hover:bg-white/[0.08] text-white/60 hover:text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors no-underline border border-white/5"
                                                title="Open Scanner for this event"
                                            >
                                                <ScanLine size={12} className="text-amber-500" />
                                                <span>SCAN</span>
                                            </Link>

                                            <button
                                                onClick={() => setTablesModalEvent(evt)}
                                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors border cursor-pointer ${
                                                    evt.tablesCreated
                                                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                                                        : 'bg-white/[0.03] hover:bg-amber-500/10 text-white/60 hover:text-amber-300 border-white/5'
                                                }`}
                                                title="Design schema and generate tables for this event"
                                            >
                                                <Database size={12} className={evt.tablesCreated ? "text-emerald-400" : "text-amber-500"} />
                                                <span>TABLES</span>
                                            </button>

                                            <button
                                                onClick={() => handleDuplicateEvent(evt)}
                                                className="w-8 h-8 flex items-center justify-center bg-white/[0.03] hover:bg-white/[0.08] text-white/40 hover:text-white rounded-lg transition-colors border border-white/5 cursor-pointer"
                                                title="Duplicate Event"
                                            >
                                                <Copy size={13} />
                                            </button>

                                            <button
                                                onClick={() => setEditingEvent(evt)}
                                                className="w-8 h-8 flex items-center justify-center bg-white/[0.03] hover:bg-white/[0.08] text-white/40 hover:text-white rounded-lg transition-colors border border-white/5 cursor-pointer"
                                                title="Edit Event Details"
                                            >
                                                <Edit3 size={13} />
                                            </button>

                                            <button
                                                onClick={() => setDeletingEvent(evt)}
                                                className="w-8 h-8 flex items-center justify-center bg-white/[0.03] hover:bg-red-500/20 text-white/40 hover:text-red-400 rounded-lg transition-colors border border-white/5 cursor-pointer"
                                                title="Delete Event"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* CREATE EVENT MODAL */}
            <EventFormModal
                isOpen={showCreateModal}
                title="Create New Event"
                subtitle="Initialize a new event in the festival catalogue"
                initialData={{
                    title: "",
                    code: "",
                    category: "Technical",
                    description: "",
                    venue: "",
                    date: "2026-03-15",
                    time: "10:00 AM - 04:00 PM",
                    status: "active",
                    maxCapacity: 200,
                    colorTheme: "#f59e0b",
                }}
                isSubmitting={isSubmitting}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreateEvent}
            />

            {/* EDIT EVENT MODAL */}
            {editingEvent && (
                <EventFormModal
                    isOpen={true}
                    title="Update Event"
                    subtitle={`Modifying configuration for ${editingEvent.code}`}
                    initialData={editingEvent}
                    isSubmitting={isSubmitting}
                    onClose={() => setEditingEvent(null)}
                    onSubmit={handleUpdateEvent}
                />
            )}

            {/* DELETE CONFIRMATION MODAL */}
            <AnimatePresence>
                {deletingEvent && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#0e0e11] border border-red-500/20 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                                <AlertCircle size={24} />
                            </div>

                            <div>
                                <h3 className="text-white font-black text-lg uppercase tracking-tight mb-2">Delete Event?</h3>
                                <p className="text-white/50 text-xs leading-relaxed">
                                    Are you sure you want to delete <strong className="text-white">{deletingEvent.title}</strong> ({deletingEvent.code})?
                                    Existing participants registered for this event will remain in the database.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeletingEvent(null)}
                                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-bold uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteEvent}
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-wider disabled:opacity-50"
                                >
                                    {isSubmitting ? "Deleting..." : "Confirm Delete"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* EVENT DEDICATED TABLES MODAL */}
            {tablesModalEvent && (
                <EventTablesModal
                    isOpen={true}
                    event={tablesModalEvent}
                    onClose={() => setTablesModalEvent(null)}
                    onTablesCreated={(updatedEvt) => {
                        setEvents(prev => prev.map(e => e.id === updatedEvt.id ? updatedEvt : e));
                        setTablesModalEvent(updatedEvt);
                    }}
                />
            )}
        </div>
    );
}

// ── Reusable Event Form Modal (Create & Edit) ──────────────────────────────
interface EventFormModalProps {
    isOpen: boolean;
    title: string;
    subtitle: string;
    initialData: Partial<EventItem>;
    isSubmitting: boolean;
    onClose: () => void;
    onSubmit: (data: any, autoCreateTables?: boolean) => Promise<void>;
}

function EventFormModal({ isOpen, title, subtitle, initialData, isSubmitting, onClose, onSubmit }: EventFormModalProps) {
    const isNew = !initialData.id;
    const [formData, setFormData] = useState({
        title: initialData.title || "",
        code: initialData.code || "",
        category: initialData.category || "Technical",
        description: initialData.description || "",
        venue: initialData.venue || "",
        date: initialData.date || "2026-03-15",
        time: initialData.time || "10:00 AM - 04:00 PM",
        status: initialData.status || "active",
        maxCapacity: initialData.maxCapacity || 200,
        colorTheme: initialData.colorTheme || "#f59e0b",
    });
    const [autoCreateTables, setAutoCreateTables] = useState(true);

    if (!isOpen) return null;

    // Auto slugify code if empty while typing title
    const handleTitleChange = (val: string) => {
        setFormData(prev => {
            const updates: any = { title: val };
            if (!initialData.code && (!prev.code || prev.code === prev.title.toUpperCase().replace(/[^A-Z0-9]+/g, '-'))) {
                updates.code = val.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 16);
            }
            return { ...prev, ...updates };
        });
    };

    const tableNames = getEventTableNames(formData.title || "event");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(formData, autoCreateTables);
    };

    const THEME_COLORS = [
        { name: "Amber", hex: "#f59e0b" },
        { name: "Cyan", hex: "#06b6d4" },
        { name: "Emerald", hex: "#10b981" },
        { name: "Pink", hex: "#ec4899" },
        { name: "Purple", hex: "#a855f7" },
        { name: "Rose", hex: "#f43f5e" },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#0d0d10] border border-white/10 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            >
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center flex-shrink-0">
                    <div>
                        <p className="text-[10px] font-black tracking-[0.3em] text-amber-500 uppercase mb-1">{subtitle}</p>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">{title}</h2>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl text-white/50 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-6 md:p-8 flex-1 overflow-y-auto">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Event Title *</label>
                                <input
                                    required
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white placeholder:text-white/20"
                                    placeholder="e.g. AI Prompt Engineering Challenge"
                                    value={formData.title}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Event Code / Tag *</label>
                                <input
                                    required
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white uppercase placeholder:text-white/20"
                                    placeholder="e.g. PROMPT-26"
                                    value={formData.code}
                                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s+/g, '-') }))}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Category *</label>
                                <select
                                    className="w-full bg-[#121215] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white"
                                    value={formData.category}
                                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
                                >
                                    <option value="Technical">Technical</option>
                                    <option value="Cultural">Cultural</option>
                                    <option value="Symposium">Symposium</option>
                                    <option value="Gaming">Gaming / Esports</option>
                                    <option value="Sports">Sports</option>
                                    <option value="Workshop">Workshop</option>
                                    <option value="General">General</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Venue / Location *</label>
                                <input
                                    required
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white placeholder:text-white/20"
                                    placeholder="e.g. Computing Lab 4"
                                    value={formData.venue}
                                    onChange={(e) => setFormData(prev => ({ ...prev, venue: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Max Capacity</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white"
                                    value={formData.maxCapacity}
                                    onChange={(e) => setFormData(prev => ({ ...prev, maxCapacity: parseInt(e.target.value) || 200 }))}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Date *</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full bg-[#121215] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white"
                                    value={formData.date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Time Schedule</label>
                                <input
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white placeholder:text-white/20"
                                    placeholder="e.g. 10:00 AM - 04:00 PM"
                                    value={formData.time}
                                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Status</label>
                                <select
                                    className="w-full bg-[#121215] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white"
                                    value={formData.status}
                                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                                >
                                    <option value="active">Active (Registration & Check-in Open)</option>
                                    <option value="upcoming">Upcoming</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Color Accent</label>
                                <div className="flex items-center gap-2 pt-1">
                                    {THEME_COLORS.map(c => (
                                        <button
                                            key={c.hex}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, colorTheme: c.hex }))}
                                            className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                                                formData.colorTheme === c.hex ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                                            }`}
                                            style={{ backgroundColor: c.hex }}
                                            title={c.name}
                                        >
                                            {formData.colorTheme === c.hex && <Check size={12} className="text-black" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Description / Instructions</label>
                                <textarea
                                    rows={2}
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white placeholder:text-white/20 resize-none"
                                    placeholder="Brief overview of event rules, eligibility, or track details..."
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                />
                            </div>

                            {/* Option: Create Dedicated Database Tables */}
                            {isNew && (
                                <div className="md:col-span-2 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={autoCreateTables}
                                            onChange={(e) => setAutoCreateTables(e.target.checked)}
                                            className="mt-1 accent-amber-500 w-4 h-4 rounded cursor-pointer"
                                        />
                                        <div className="space-y-1">
                                            <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                                <Database size={13} /> Customize Schema & Generate Dedicated Tables
                                            </span>
                                            <p className="text-[10px] text-white/50 leading-relaxed">
                                                Opens the interactive Schema Designer after creation where you define custom column names, data types, and default values to generate the PostgreSQL script.
                                            </p>
                                        </div>
                                    </label>

                                    {autoCreateTables && formData.title && (
                                        <div className="bg-black/50 rounded-xl p-3 border border-white/5 font-mono text-[10px] space-y-1">
                                            <div className="text-emerald-400 flex items-center gap-1.5 truncate">
                                                <Check size={12} className="flex-shrink-0" />
                                                <span className="text-white/40">Participants Table:</span>
                                                <span className="text-white font-bold truncate">{tableNames.participantsTable}</span>
                                            </div>
                                            <div className="text-blue-400 flex items-center gap-1.5 truncate">
                                                <Check size={12} className="flex-shrink-0" />
                                                <span className="text-white/40">Check-In Logs Table:</span>
                                                <span className="text-white font-bold truncate">{tableNames.checkInTable}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-white/5 flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-bold uppercase tracking-wider"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider disabled:opacity-50 transition-colors shadow-lg shadow-amber-500/20"
                            >
                                {isSubmitting ? "Saving & Provisioning..." : "Save Event"}
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
