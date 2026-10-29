"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
    Mail, ArrowLeft, Loader2, Search, CheckSquare, Square, Send, Users, 
    ShieldCheck, CheckCircle2, X, Sparkles, AlertCircle, ChevronDown, Check,
    Filter, Database, Calendar, MapPin
} from "lucide-react";
import { Participant, EventItem } from "@/lib/types";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getEvents } from "@/lib/events";
import { getEventTableNames, checkTableExists } from "@/lib/eventTables";
import Link from "next/link";

export default function BroadcastPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">
                <Loader2 className="animate-spin text-amber-500" size={36} />
            </div>
        }>
            <MailsContent />
        </Suspense>
    );
}

function MailsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [allEvents, setAllEvents] = useState<EventItem[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
    const [showEventDropdown, setShowEventDropdown] = useState(false);

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [sentIds, setSentIds] = useState<string[]>([]);
    const [filterTab, setFilterTab] = useState<'pending' | 'sent' | 'all'>('pending');
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState({ type: "", message: "" });

    // Authentication check
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

        // Load saved sent IDs from localStorage
        try {
            const saved = localStorage.getItem("vishaka_sent_email_ids");
            if (saved) {
                setSentIds(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Error loading sent IDs:", e);
        }

        loadEventsAndTarget();
    }, [router]);

    // Load registered events and detect target event from URL
    async function loadEventsAndTarget() {
        try {
            setLoading(true);
            const events = await getEvents();
            setAllEvents(events);

            const eventParam = searchParams.get("event") || "";
            let matched: EventItem | null = null;

            if (eventParam) {
                const cleanParam = decodeURIComponent(eventParam).trim().toLowerCase();
                matched = events.find(e => 
                    e.title.toLowerCase() === cleanParam || 
                    e.code.toLowerCase() === cleanParam || 
                    e.id.toLowerCase() === cleanParam
                ) || null;
            }

            if (!matched && events.length > 0) {
                matched = events[0];
            }

            setSelectedEvent(matched);
        } catch (e) {
            console.error("Error loading events:", e);
        }
    }

    // Fetch participants whenever selectedEvent changes
    useEffect(() => {
        if (allEvents.length > 0 || selectedEvent !== undefined) {
            fetchEventParticipants();
        }
    }, [selectedEvent]);

    async function fetchEventParticipants() {
        setLoading(true);
        try {
            let rawData: any[] = [];
            const target = selectedEvent;

            if (target) {
                // 1. Fetch from event's dedicated database table
                const { participantsTable } = getEventTableNames(target.title);
                const hasDedicated = await checkTableExists(participantsTable);

                if (hasDedicated) {
                    try {
                        const { data, error } = await supabase
                            .from(participantsTable)
                            .select('*')
                            .order('created_at', { ascending: false });

                        if (!error && data) {
                            rawData = data;
                        }
                    } catch (e) {
                        console.warn("Dedicated table read error:", e);
                    }
                } else {
                    // Check unified participants table
                    const hasUnified = await checkTableExists('participants');
                    if (hasUnified) {
                        try {
                            const { data, error } = await supabase
                                .from('participants')
                                .select('*')
                                .order('participant_id', { ascending: true });

                            if (!error && data) {
                                const eventCode = target.code.toLowerCase();
                                const eventTitle = target.title.toLowerCase();
                                rawData = data.filter((item: any) => {
                                    const pEvt = (item.event || "").toLowerCase();
                                    return pEvt.includes(eventCode) || pEvt.includes(eventTitle);
                                });
                            }
                        } catch (uniErr) {
                            console.warn("Unified read warning:", uniErr);
                        }
                    }
                }

                // 2. Merge local storage participants for this event
                try {
                    const localKey = `local_participants_${target.id}`;
                    const savedLocal = localStorage.getItem(localKey);
                    if (savedLocal) {
                        const localItems: any[] = JSON.parse(savedLocal);
                        const existingIds = new Set(rawData.map(r => r.participant_id || r.id));
                        for (const loc of localItems) {
                            if (!existingIds.has(loc.participant_id) && !existingIds.has(loc.id)) {
                                rawData.unshift(loc);
                            }
                        }
                    }
                } catch (lsErr) {
                    console.warn("Local storage merge warning:", lsErr);
                }
            } else {
                // "All Events" aggregated fetch
                const allTables = allEvents.map(e => getEventTableNames(e.title).participantsTable);
                for (const tName of allTables) {
                    try {
                        const hasT = await checkTableExists(tName);
                        if (hasT) {
                            const { data } = await supabase.from(tName).select('*');
                            if (data) rawData.push(...data);
                        }
                    } catch {}
                }

                // Check localStorage
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('local_participants_')) {
                        try {
                            const localItems: any[] = JSON.parse(localStorage.getItem(key) || '[]');
                            const existingIds = new Set(rawData.map(r => r.participant_id || r.id));
                            for (const loc of localItems) {
                                if (!existingIds.has(loc.participant_id) && !existingIds.has(loc.id)) {
                                    rawData.unshift(loc);
                                }
                            }
                        } catch {}
                    }
                }
            }

            const mappedData: Participant[] = rawData.map((item: any) => {
                const rawId = item.participant_id || item.id || "";
                const cleanId = rawId.replace(/splash/gi, "Vishaka");
                return {
                    id: cleanId,
                    participant_id: cleanId,
                    name: item.participant_name || item.name || "Unknown",
                    participant_name: item.participant_name || item.name || "Unknown",
                    registerNumber: item.register_number || item.registerNumber || "",
                    year: item.year || "",
                    department: item.department || "",
                    section: item.section || "",
                    game: item.game || "",
                    email: item.email || "",
                    mobile: item.mobile || item.phone || "",
                    category: item.category || "",
                    culturalInterest: item.cultural_interest || item.culturals || "",
                    status: item.status || 'registered',
                    event: item.event || selectedEvent?.title || "Vishaka 2026",
                    registrationDate: item.created_at ? new Date(item.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
                    qrValue: ""
                };
            });

            setParticipants(mappedData);
        } catch (err) {
            console.error("Error fetching broadcast participants:", err);
        } finally {
            setLoading(false);
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const selectAll = () => {
        const selectable = filteredParticipants.filter(p => p.email && p.email.includes('@'));
        if (selectedIds.length === selectable.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(selectable.map(p => p.id));
        }
    };

    const selectOnlyRemaining = () => {
        const remaining = participants
            .filter(p => !sentIds.includes(p.id) && p.email && p.email.includes('@'))
            .map(p => p.id);
        setSelectedIds(remaining);
        setFilterTab('pending');
    };

    const resetSentHistory = () => {
        if (confirm("Reset sent history tracker? This will mark all participants as unsent locally.")) {
            setSentIds([]);
            localStorage.removeItem("vishaka_sent_email_ids");
            setStatus({ type: "info", message: "Sent history has been reset." });
        }
    };

    const markAsSentManually = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSentIds(prev => {
            const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
            localStorage.setItem("vishaka_sent_email_ids", JSON.stringify(next));
            return next;
        });
    };

    const filteredParticipants = participants
        .filter((p) => {
            const isSent = sentIds.includes(p.id);
            if (filterTab === 'pending' && isSent) return false;
            if (filterTab === 'sent' && !isSent) return false;

            return (
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.registerNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.email || "").toLowerCase().includes(searchTerm.toLowerCase())
            );
        })
        .sort((a, b) => {
            const numA = parseInt(a.id.match(/\d+/)?.[0] || "0", 10);
            const numB = parseInt(b.id.match(/\d+/)?.[0] || "0", 10);
            return numA - numB;
        });

    const handleSendMails = async () => {
        if (selectedIds.length === 0) return;

        setIsSending(true);
        setStatus({ type: "info", message: `INITIALIZING DISPATCH: Preparing ${selectedIds.length} email(s)...` });

        const selectedParticipants = participants.filter(p => selectedIds.includes(p.id));
        let successCount = 0;
        let failCount = 0;
        let lastErrorMessage = "";
        let fatalErrorCount = 0;

        const windowUrl = window.location.origin;
        const defaultUrl = windowUrl.includes('localhost')
            ? `http://10.136.9.91:3000`
            : windowUrl;

        const eventTitle = selectedEvent ? selectedEvent.title : "Vishaka 2026";
        const eventVenue = selectedEvent?.venue || "Main Auditorium";
        const eventDate = selectedEvent?.date ? `${selectedEvent.date} ${selectedEvent.time ? `at ${selectedEvent.time}` : ''}` : "Festival Schedule";

        for (let i = 0; i < selectedParticipants.length; i++) {
            const p = selectedParticipants[i];

            setStatus({
                type: "info",
                message: `DISPATCHING [${i + 1}/${selectedParticipants.length}]: Processing ${p.name}... (Sent: ${successCount} | Failed: ${failCount})`
            });

            if (!p.email || !p.email.includes('@')) {
                failCount++;
                lastErrorMessage = `Missing or invalid email for ${p.name} (${p.id})`;
                continue;
            }

            try {
                const response = await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: p.email.trim(),
                        subject: `Confirmation of Registration – ${eventTitle} 🎉`,
                        qrData: defaultUrl + '/p/' + p.id,
                        participantName: p.name,
                        participantId: p.id,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #eaeaea; border-radius: 12px; background: #ffffff; color: #333333;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                                    <tr>
                                        <td valign="middle" align="left">
                                            <h2 style="color: #d97706; margin: 0; font-size: 22px; line-height: 1.3;">Confirmation of Registration – ${eventTitle} 🎉</h2>
                                        </td>
                                        <td valign="middle" align="right" style="width: 75px; padding-left: 15px;">
                                            <img src="cid:vishaka_logo" alt="Logo" width="65" height="65" style="width: 65px; height: 65px; object-fit: contain; display: block;" />
                                        </td>
                                    </tr>
                                </table>
                                <p style="font-size: 16px;">Dear <strong>${p.name}</strong>,</p>
                                <p style="font-size: 16px;">Greetings!</p>
                                <p style="font-size: 16px; line-height: 1.5;">Thank you for registering for <strong>${eventTitle}</strong>. We are excited to have you participate in this event.</p>
                                
                                <div style="background: #fffbeb; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #fde68a;">
                                    <h3 style="margin-top: 0; color: #b45309;">Registration Details:</h3>
                                    <p style="margin: 8px 0; font-size: 15px;"><strong>Name:</strong> ${p.name}</p>
                                    <p style="margin: 8px 0; font-size: 15px;"><strong>Participant ID:</strong> <span style="font-family: monospace; background: #fef3c7; padding: 2px 6px; border-radius: 4px;">${p.id}</span></p>
                                    <p style="margin: 8px 0; font-size: 15px;"><strong>Event:</strong> ${eventTitle}</p>
                                    ${p.department ? `<p style="margin: 8px 0; font-size: 15px;"><strong>Department:</strong> ${p.department} (Year ${p.year})</p>` : ''}
                                </div>
                                <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #bae6fd;">
                                    <h3 style="margin-top: 0; color: #0369a1;">Venue & Schedule:</h3>
                                    <p style="margin: 8px 0; font-size: 15px;"><strong>📍 Venue:</strong> ${eventVenue}</p>
                                    <p style="margin: 8px 0; font-size: 15px;"><strong>📅 Date & Time:</strong> ${eventDate}</p>
                                </div>
                                
                                <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                                    <p style="font-size: 16px; font-weight: bold; color: #0f172a; margin: 0;">📄 Your Entry Pass PDF is attached!</p>
                                    <p style="font-size: 14px; color: #475569; margin-top: 8px; margin-bottom: 0;">Please present your dynamic QR pass at the entrance scanner.</p>
                                </div>
                                
                                <p style="font-size: 15px; line-height: 1.5;">We look forward to seeing you at ${eventTitle}.</p>
                                <br />
                                <p style="font-size: 15px; margin-bottom: 0;">Best regards,</p>
                                <p style="font-size: 16px; font-weight: bold; margin-top: 5px; color: #d97706;">${eventTitle} Organizing Team • Vishaka 2K26</p>
                            </div>
                        `
                    }),
                });

                if (response.ok) {
                    successCount++;
                    fatalErrorCount = 0;
                    setSelectedIds((prev) => prev.filter((id) => id !== p.id));
                    setSentIds((prev) => {
                        const next = Array.from(new Set([...prev, p.id]));
                        try {
                            localStorage.setItem("vishaka_sent_email_ids", JSON.stringify(next));
                        } catch (e) {
                            console.error("Failed saving sent email IDs:", e);
                        }
                        return next;
                    });
                } else {
                    const errData = await response.json().catch(() => ({}));
                    lastErrorMessage = errData.error || `HTTP ${response.status}`;
                    failCount++;
                    fatalErrorCount++;

                    if (lastErrorMessage.includes('454') || lastErrorMessage.includes('EAUTH') || lastErrorMessage.includes('credentials')) {
                        if (fatalErrorCount >= 3) {
                            setStatus({
                                type: "warning",
                                message: `BROADCAST PAUSED: SMTP Rate Limit Reached (${lastErrorMessage}). Successfully sent ${successCount} emails.`
                            });
                            setIsSending(false);
                            return;
                        }
                    }
                }
            } catch (err: any) {
                lastErrorMessage = err.message || "Network request failed";
                failCount++;
            }

            if (i < selectedParticipants.length - 1) {
                await new Promise((res) => setTimeout(res, 1500));
            }
        }

        setIsSending(false);
        if (failCount === 0) {
            setStatus({ type: "success", message: `DISPATCH SUCCESS: Broadcast delivered to ${successCount} attendee(s).` });
            setSelectedIds([]);
        } else {
            setStatus({
                type: "warning",
                message: `SYSTEM ALERT: Sent: ${successCount} | Failed: ${failCount}${lastErrorMessage ? ` — Reason: ${lastErrorMessage}` : ''}`
            });
        }
    };

    const remainingCount = participants.filter(p => !sentIds.includes(p.id) && p.email && p.email.includes('@')).length;
    const sentCount = participants.filter(p => sentIds.includes(p.id)).length;
    const validEmailCount = participants.filter(p => p.email && p.email.includes('@')).length;

    const fadin: Variants = {
        hidden: { opacity: 0, y: 10 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.02, duration: 0.4, ease: "easeOut" } as any,
        }),
    };

    return (
        <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-outfit selection:bg-amber-500/30 overflow-x-hidden relative pb-40">
            {/* Ambient Background Glow */}
            <div className="fixed inset-0 pointer-events-none opacity-10">
                <div className="absolute top-0 left-[15%] w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                <div className="absolute top-0 right-[15%] w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
            </div>

            <div className="max-w-7xl mx-auto px-6 pt-32 lg:pt-36 relative z-10">
                {/* Advanced Header */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8"
                >
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <Link
                            href={selectedEvent ? `/admin/events/${selectedEvent.id}` : "/admin"}
                            className="group p-3 md:p-4 bg-white/5 rounded-2xl hover:bg-amber-500 hover:text-black transition-all border border-white/5 active:scale-95 flex items-center justify-center shadow-2xl"
                            title="Return to Command Center"
                        >
                            <ArrowLeft size={22} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black tracking-[0.4em] text-amber-500 uppercase">
                                    Broadcast Center
                                </span>
                                {selectedEvent && (
                                    <span className="text-[9px] font-mono font-bold text-white/50 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                        {selectedEvent.code}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase leading-none">
                                {selectedEvent ? selectedEvent.title : "All Events Broadcast"}<span className="text-amber-500">.</span>
                            </h1>
                        </div>
                    </div>

                    {/* Quick Event Switcher Dropdown */}
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div className="relative">
                            <button
                                onClick={() => setShowEventDropdown(!showEventDropdown)}
                                className="flex items-center gap-2.5 bg-[#121216] border border-white/10 hover:border-amber-500/40 px-4 py-3 rounded-xl text-xs font-black tracking-wider text-white transition-all shadow-xl cursor-pointer"
                            >
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedEvent?.colorTheme || '#f59e0b' }} />
                                <span className="text-white/40 uppercase text-[10px]">Event:</span>
                                <span className="text-amber-400 truncate max-w-[180px]">{selectedEvent?.title || "All Events"}</span>
                                <ChevronDown size={14} className={`text-white/40 transition-transform ${showEventDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {showEventDropdown && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.96 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.96 }}
                                        className="absolute right-0 mt-2 w-72 bg-[#0c0c0e] border border-white/10 rounded-2xl p-2 shadow-2xl z-50 backdrop-blur-xl"
                                    >
                                        <div className="px-3 py-2 text-[9px] font-black tracking-[0.3em] uppercase text-white/30 border-b border-white/5">
                                            Select Event Filter
                                        </div>
                                        <div className="max-h-64 overflow-y-auto py-1 space-y-1">
                                            {allEvents.map((evt) => (
                                                <button
                                                    key={evt.id}
                                                    onClick={() => {
                                                        setShowEventDropdown(false);
                                                        setSelectedEvent(evt);
                                                    }}
                                                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group cursor-pointer ${
                                                        evt.id === selectedEvent?.id 
                                                            ? 'bg-amber-500 text-black font-black' 
                                                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                                                    }`}
                                                >
                                                    <div className="truncate">
                                                        <div className="truncate">{evt.title}</div>
                                                        <div className={`text-[9px] uppercase tracking-wider ${evt.id === selectedEvent?.id ? 'text-black/70' : 'text-white/30'}`}>
                                                            {evt.code} • {evt.category}
                                                        </div>
                                                    </div>
                                                    {evt.id === selectedEvent?.id && <Check size={14} />}
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Selected Count & Execute Dispatch */}
                        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/5 px-4 py-3 rounded-xl">
                            <Users size={15} className="text-amber-500" />
                            <span className="text-[10px] font-black tracking-wider text-white/40 uppercase whitespace-nowrap">
                                Selected: <strong className="text-white">{selectedIds.length}</strong>
                            </span>
                        </div>

                        <button
                            onClick={handleSendMails}
                            disabled={isSending || selectedIds.length === 0}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:brightness-110 transition-all shadow-xl active:scale-95 disabled:opacity-30 disabled:grayscale cursor-pointer"
                        >
                            {isSending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} strokeWidth={3} />}
                            <span>{isSending ? "DISPATCHING..." : "SEND EMAILS"}</span>
                        </button>
                    </div>
                </motion.header>

                {/* System Feedback */}
                <AnimatePresence>
                    {status.message && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="mb-8"
                        >
                            <div className={`p-5 rounded-2xl flex items-center gap-4 border ${status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : status.type === 'info' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                {status.type === 'success' ? <CheckCircle2 size={20} /> : status.type === 'info' ? <Loader2 className="animate-spin" size={20} /> : <AlertCircle size={20} />}
                                <span className="text-xs font-bold uppercase tracking-wider">{status.message}</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Filter Tabs & Quick Action Bar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-2 bg-[#0c0c10] p-1.5 rounded-2xl border border-white/5 w-full md:w-auto">
                        <button
                            onClick={() => setFilterTab('pending')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer ${filterTab === 'pending' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-white/40 hover:text-white'}`}
                        >
                            <span>Ready to Send</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${filterTab === 'pending' ? 'bg-black/20 text-black' : 'bg-white/5 text-amber-400'}`}>
                                {remainingCount}
                            </span>
                        </button>

                        <button
                            onClick={() => setFilterTab('sent')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer ${filterTab === 'sent' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-white/40 hover:text-white'}`}
                        >
                            <span>Sent</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${filterTab === 'sent' ? 'bg-black/20 text-black' : 'bg-white/5 text-emerald-400'}`}>
                                {sentCount}
                            </span>
                        </button>

                        <button
                            onClick={() => setFilterTab('all')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer ${filterTab === 'all' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                        >
                            <span>All Registered</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${filterTab === 'all' ? 'bg-black/20 text-black' : 'bg-white/5 text-white/60'}`}>
                                {participants.length}
                            </span>
                        </button>
                    </div>

                    {/* Quick Selection Shortcuts */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        <button
                            onClick={selectOnlyRemaining}
                            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer"
                        >
                            <Sparkles size={12} />
                            Select Remaining ({remainingCount})
                        </button>
                        {sentCount > 0 && (
                            <button
                                onClick={resetSentHistory}
                                className="px-3 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider text-white/30 hover:text-red-400 transition-colors cursor-pointer"
                                title="Reset Sent Tracker"
                            >
                                Reset Sent Tracker
                            </button>
                        )}
                    </div>
                </div>

                {/* Filtration Command Bar */}
                <div className="bg-[#0c0c10] border border-white/5 rounded-2xl p-3 flex flex-col md:flex-row items-center gap-3 mb-6 shadow-2xl relative overflow-hidden group">
                    <div className="relative flex-grow w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-amber-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="SEARCH BY NAME, ID, REGISTER NUMBER OR EMAIL..."
                            className="w-full bg-transparent py-2.5 pl-11 pr-4 outline-none font-mono text-xs font-bold text-white placeholder:text-white/20 uppercase"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={selectAll}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap border cursor-pointer ${
                                selectedIds.length === filteredParticipants.filter(p => p.email && p.email.includes('@')).length && filteredParticipants.length > 0 
                                    ? 'bg-amber-500 border-amber-500 text-black' 
                                    : 'bg-white/5 border-white/5 text-white/60 hover:text-white'
                            }`}
                        >
                            {selectedIds.length === filteredParticipants.filter(p => p.email && p.email.includes('@')).length && filteredParticipants.length > 0 ? (
                                <CheckSquare size={13} strokeWidth={3} />
                            ) : (
                                <Square size={13} strokeWidth={3} />
                            )}
                            Select All with Email ({filteredParticipants.filter(p => p.email && p.email.includes('@')).length})
                        </button>
                    </div>
                </div>

                {/* Participants Record List */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-[#0a0a0d] border border-white/5 rounded-3xl overflow-hidden shadow-2xl"
                >
                    {loading ? (
                        <div className="py-24 flex flex-col items-center gap-4">
                            <Loader2 className="animate-spin text-amber-500" size={36} />
                            <p className="text-[10px] font-black tracking-[0.3em] text-white/30 uppercase">
                                Loading participants for {selectedEvent?.title || "event"}...
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.04]">
                            {filteredParticipants.map((p, i) => {
                                const isSent = sentIds.includes(p.id);
                                const hasEmail = Boolean(p.email && p.email.includes('@'));
                                const isSelected = selectedIds.includes(p.id);

                                return (
                                    <motion.div
                                        key={p.id}
                                        variants={fadin}
                                        initial="hidden"
                                        animate="visible"
                                        custom={i}
                                        onClick={() => {
                                            if (hasEmail) toggleSelect(p.id);
                                        }}
                                        className={`flex flex-col md:flex-row items-start md:items-center gap-4 px-6 py-5 transition-all cursor-pointer group ${
                                            isSelected ? 'bg-amber-500/[0.04]' : 'hover:bg-white/[0.02]'
                                        } ${!hasEmail ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                            isSelected 
                                                ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20' 
                                                : hasEmail 
                                                    ? 'bg-transparent border-white/20 group-hover:border-white/40' 
                                                    : 'border-white/10 opacity-30'
                                        }`}>
                                            {isSelected && <CheckSquare size={14} strokeWidth={3} className="text-black" />}
                                        </div>

                                        <div className="flex-grow space-y-1">
                                            <div className="flex flex-wrap items-center gap-2.5">
                                                <span className="font-black text-white text-sm tracking-tight uppercase">
                                                    {p.name}
                                                </span>
                                                <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded text-amber-400 font-mono font-bold tracking-wider">
                                                    {p.id}
                                                </span>

                                                {/* Email Delivery Status Badge */}
                                                {isSent ? (
                                                    <span
                                                        onClick={(e) => markAsSentManually(p.id, e)}
                                                        className="text-[9px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 rounded font-black tracking-wider flex items-center gap-1 cursor-pointer"
                                                        title="Click to toggle sent status"
                                                    >
                                                        <CheckCircle2 size={10} /> SENT
                                                    </span>
                                                ) : hasEmail ? (
                                                    <span
                                                        onClick={(e) => markAsSentManually(p.id, e)}
                                                        className="text-[9px] bg-white/5 border border-white/10 text-white/40 px-2.5 py-0.5 rounded font-bold tracking-wider hover:border-emerald-500/30 hover:text-emerald-400 transition-colors cursor-pointer"
                                                        title="Click to mark as sent manually"
                                                    >
                                                        PENDING
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] bg-red-500/10 border border-red-500/30 text-red-400 px-2.5 py-0.5 rounded font-bold tracking-wider">
                                                        NO EMAIL
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/40 font-mono">
                                                <span className="text-white/60 font-bold">{p.registerNumber || "No Reg No"}</span>
                                                <span>•</span>
                                                <span className={hasEmail ? "text-amber-300 font-medium" : "text-red-400/80 italic"}>
                                                    {p.email || "Missing Email Address"}
                                                </span>
                                                <span>•</span>
                                                <span>{p.department} ({p.year ? `Yr ${p.year}` : ''} Sec {p.section})</span>
                                            </div>
                                        </div>

                                        <div className="text-right text-[10px] font-mono text-white/30 hidden md:block">
                                            <span className="text-amber-400/80 font-bold">{p.category || "General"}</span>
                                        </div>
                                    </motion.div>
                                );
                            })}

                            {filteredParticipants.length === 0 && (
                                <div className="py-24 text-center text-white/20 font-bold uppercase tracking-widest text-xs">
                                    {filterTab === 'pending' 
                                        ? 'All participants for this event have already received their emails.' 
                                        : 'No participants found matching this search.'}
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
