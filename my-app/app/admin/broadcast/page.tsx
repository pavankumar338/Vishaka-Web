"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, ArrowLeft, Loader2, Search, CheckSquare, Square, Send, Users, ShieldCheck, CheckCircle2, X, Sparkles, AlertCircle } from "lucide-react";
import { Participant } from "@/lib/types";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function MailsPage() {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [sentIds, setSentIds] = useState<string[]>([]);
    const [filterTab, setFilterTab] = useState<'pending' | 'sent' | 'all'>('pending');
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState({ type: "", message: "" });
    const router = useRouter();

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

        fetchParticipants();
    }, [router]);

    async function fetchParticipants() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('participants')
                .select('*')
                .order('participant_id', { ascending: true });

            if (error) throw error;

            const mappedData: Participant[] = (data || []).map(item => ({
                id: item.participant_id,
                participant_id: item.participant_id,
                name: item.participant_name,
                participant_name: item.participant_name,
                registerNumber: item.register_number || "",
                year: item.year || "",
                department: item.department || "",
                section: item.section || "",
                game: item.game || "",
                email: item.email || "",
                mobile: item.mobile || item.phone || "",
                category: item.category || "",
                culturalInterest: item.cultural_interest || item.culturals || "",
                status: item.status,
                event: item.event,
                registrationDate: new Date(item.created_at).toLocaleDateString(),
                qrValue: ""
            }));

            setParticipants(mappedData);
        } catch (error) {
            console.error('Error fetching participants:', error);
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
        if (selectedIds.length === filteredParticipants.length && filteredParticipants.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredParticipants.map(p => p.id));
        }
    };

    const selectOnlyRemaining = () => {
        const remaining = participants.filter(p => !sentIds.includes(p.id)).map(p => p.id);
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
                p.registerNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.id.toLowerCase().includes(searchTerm.toLowerCase())
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

        for (let i = 0; i < selectedParticipants.length; i++) {
            const p = selectedParticipants[i];

            // Live progress update
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
                const activityHtml = p.game && p.culturalInterest
                    ? `<p style="margin: 8px 0; font-size: 15px;"><strong>Registered Game:</strong> ${p.game}</p><p style="margin: 8px 0; font-size: 15px;"><strong>Registered Cultural:</strong> ${p.culturalInterest}</p>`
                    : (p.culturalInterest || p.category?.toLowerCase().includes('cultural'))
                    ? `<p style="margin: 8px 0; font-size: 15px;"><strong>Registered Cultural:</strong> ${p.culturalInterest || p.game || 'N/A'}</p>`
                    : `<p style="margin: 8px 0; font-size: 15px;"><strong>Registered Game:</strong> ${p.game || 'N/A'}</p>`;

                const response = await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: p.email.trim(),
                        subject: `Confirmation of Registration – Splash-2K26 🎉`,
                        qrData: defaultUrl + '/p/' + p.id,
                        participantName: p.name,
                        participantId: p.id,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #eaeaea; border-radius: 12px; background: #ffffff; color: #333333;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                                    <tr>
                                        <td valign="middle" align="left">
                                            <h2 style="color: #d97706; margin: 0; font-size: 22px; line-height: 1.3;">Confirmation of Registration – Splash-2K26 🎉</h2>
                                        </td>
                                        <td valign="middle" align="right" style="width: 75px; padding-left: 15px;">
                                            <img src="cid:vishaka_logo" alt="Vishaka Logo" width="65" height="65" style="width: 65px; height: 65px; object-fit: contain; display: block;" />
                                        </td>
                                    </tr>
                                </table>
                                <p style="font-size: 16px;">Dear <strong>${p.name}</strong>,</p>
                                <p style="font-size: 16px;">Greetings!</p>
                                <p style="font-size: 16px; line-height: 1.5;">Thank you for registering for  Splash-2K26. We are excited to have you as a participant in this celebration.</p>
                                
                                 <div style="background: #fffbeb; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #fde68a;">
                                    <h3 style="margin-top: 0; color: #b45309;">Registration Details:</h3>
                                    <p style="margin: 8px 0; font-size: 15px;"><strong>Name:</strong> ${p.name}</p>
                                    <p style="margin: 8px 0; font-size: 15px;"><strong>Participant ID:</strong> <span style="font-family: monospace; background: #fef3c7; padding: 2px 6px; border-radius: 4px;">${p.id}</span></p>
                                    ${activityHtml}
                                </div>
                                <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #bae6fd;">
                                    <h3 style="margin-top: 0; color: #0369a1;">Schedule & Important Notice:</h3>
                                    <p style="margin: 8px 0; font-size: 15px;"><strong>🎮 Games Start:</strong> 9:30 AM on 04-09-2026 at Indoor Stadium</p>
                                    <p style="margin: 8px 0; font-size: 15px;"><strong>📅 Main Event Starts:</strong> 9:00 AM on 05-09-2026 at K.S.Krishnan Auditorium</p>
                                    <p style="margin: 15px 0 0 0; font-size: 15px; color: #ef4444; font-weight: bold;">⚠️ Notice:Without Partcipation in the Games and Event cannot get the Certificate.</p>
                                </div>
                                
                                <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                                    <p style="font-size: 16px; font-weight: bold; color: #0f172a; margin: 0;">📄 Your Entry Pass PDF is attached!</p>
                                    <p style="font-size: 14px; color: #475569; margin-top: 8px; margin-bottom: 0;">Please download and present the attached PDF for quick check-in at the venue.</p>
                                </div>
                                
                                <p style="font-size: 15px; line-height: 1.5;">We look forward to your enthusiastic participation and hope you have a wonderful experience at Splash-2K26.</p>
                                
                                <p style="font-size: 15px; line-height: 1.5;">If you have any queries, feel free to contact the organizing team.</p>
                                
                                <br />
                                <p style="font-size: 15px; margin-bottom: 0;">Best regards,</p>
                                <p style="font-size: 16px; font-weight: bold; margin-top: 5px; color: #d97706;">Splash-2K26  Organized by Vishaka Club</p>
                            </div>
                        `
                    }),
                });

                if (response.ok) {
                    successCount++;
                    fatalErrorCount = 0;
                    // Auto remove sent participant from selection
                    setSelectedIds((prev) => prev.filter((id) => id !== p.id));
                    // Mark as sent and persist to localStorage
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
                    console.error("Failed email delivery to", p.email, errData);
                    failCount++;
                    fatalErrorCount++;

                    // If SMTP server rejects authentication or rate limits, halt to prevent account lock
                    if (lastErrorMessage.includes('454') || lastErrorMessage.includes('EAUTH') || lastErrorMessage.includes('Invalid login') || lastErrorMessage.includes('credentials')) {
                        if (fatalErrorCount >= 3) {
                            setStatus({
                                type: "warning",
                                message: `BROADCAST PAUSED: SMTP Rate Limit Reached (${lastErrorMessage}). Successfully sent ${successCount} emails. The remaining unsent participants are still queued. Wait 2–3 minutes and click EXECUTE DISPATCH to continue.`
                            });
                            setIsSending(false);
                            return;
                        }
                    }
                }
            } catch (err: any) {
                lastErrorMessage = err.message || "Network request failed";
                console.error("Network error sending email to", p.email, err);
                failCount++;
            }

            // Pacing delay (1.5 seconds) to stay safely within Google SMTP per-minute rate limits
            if (i < selectedParticipants.length - 1) {
                await new Promise((res) => setTimeout(res, 1500));
            }
        }

        setIsSending(false);
        if (failCount === 0) {
            setStatus({ type: "success", message: `DISPATCH SUCCESS: Broadcast delivered to ${successCount} node(s).` });
            setSelectedIds([]);
        } else {
            setStatus({ 
                type: "warning", 
                message: `SYSTEM ALERT: Sent: ${successCount} | Failed: ${failCount}${lastErrorMessage ? ` — Reason: ${lastErrorMessage}` : ''}` 
            });
        }
    };

    const remainingCount = participants.filter(p => !sentIds.includes(p.id)).length;
    const sentCount = participants.filter(p => sentIds.includes(p.id)).length;

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

            {/* Cinematic Background Lines */}
            <div className="fixed inset-0 pointer-events-none opacity-10">
                <div className="absolute top-0 left-[15%] w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                <div className="absolute top-0 right-[15%] w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
            </div>

            <div className="max-w-7xl mx-auto px-6 pt-32 lg:pt-40 relative z-10">
                {/* Advanced Header */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col lg:flex-row items-center justify-between gap-8 mb-10"
                >
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <Link
                            href="/admin"
                            className="group p-3 md:p-4 bg-white/5 rounded-2xl hover:bg-amber-500 hover:text-black transition-all border border-white/5 active:scale-95 flex items-center justify-center shadow-2xl"
                        >
                            <ArrowLeft size={24} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
                        </Link>
                        <div>
                            <p className="text-[8px] md:text-[10px] font-black tracking-[0.4em] text-amber-500 uppercase mb-1">Internal Relay System</p>
                            <h1 className="text-2xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none italic">
                                Broadcas<span className="text-amber-500">t.</span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div className="flex-grow lg:flex-none flex items-center gap-3 bg-white/[0.03] border border-white/5 px-4 md:px-6 py-3 md:py-4 rounded-xl">
                            <Users size={16} className="text-amber-500" />
                            <span className="text-[8px] md:text-[10px] font-black tracking-[0.2em] text-white/40 uppercase whitespace-nowrap">Selected: <span className="text-white font-bold">{selectedIds.length} Nodes</span></span>
                        </div>
                        <button
                            onClick={handleSendMails}
                            disabled={isSending || selectedIds.length === 0}
                            className="flex-grow lg:flex-none flex items-center justify-center gap-3 bg-white text-black px-6 md:px-10 py-4 md:py-5 rounded-2xl font-black text-[9px] md:text-[11px] uppercase tracking-[0.3em] hover:bg-amber-500 transition-all shadow-3xl active:scale-95 disabled:opacity-20 disabled:grayscale"
                        >
                            {isSending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} strokeWidth={3} />}
                            {isSending ? "DISPATCHING..." : "EXECUTE_DISPATCH"}
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
                            <div className={`p-6 rounded-[2rem] flex items-center gap-4 border-2 border-dashed ${status.type === 'success' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : status.type === 'info' ? 'bg-amber-500/5 border-amber-500/20 text-amber-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
                                {status.type === 'success' ? <CheckCircle2 size={24} /> : status.type === 'info' ? <Loader2 className="animate-spin" size={24} /> : <AlertCircle size={24} />}
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{status.message}</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Filter Tabs & Quick Action Bar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-2 bg-[#0a0a0b] p-1.5 rounded-2xl border border-white/5 w-full md:w-auto">
                        <button
                            onClick={() => setFilterTab('pending')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${filterTab === 'pending' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-white/40 hover:text-white'}`}
                        >
                            <span>Remaining to Send</span>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${filterTab === 'pending' ? 'bg-black/20 text-black' : 'bg-white/5 text-amber-400'}`}>
                                {remainingCount}
                            </span>
                        </button>

                        <button
                            onClick={() => setFilterTab('sent')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${filterTab === 'sent' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-white/40 hover:text-white'}`}
                        >
                            <span>Sent</span>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${filterTab === 'sent' ? 'bg-black/20 text-black' : 'bg-white/5 text-emerald-400'}`}>
                                {sentCount}
                            </span>
                        </button>

                        <button
                            onClick={() => setFilterTab('all')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${filterTab === 'all' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                        >
                            <span>All</span>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${filterTab === 'all' ? 'bg-black/20 text-black' : 'bg-white/5 text-white/60'}`}>
                                {participants.length}
                            </span>
                        </button>
                    </div>

                    {/* Quick Selection Shortcuts */}
                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <button
                            onClick={selectOnlyRemaining}
                            className="flex items-center gap-2 px-4 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest bg-white/5 border border-white/5 text-amber-400 hover:bg-amber-500/10 transition-all active:scale-95"
                        >
                            <Sparkles size={12} />
                            Select Remaining ({remainingCount})
                        </button>
                        {sentCount > 0 && (
                            <button
                                onClick={resetSentHistory}
                                className="px-3 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest text-white/20 hover:text-red-400 transition-colors"
                                title="Reset Sent Tracker"
                            >
                                Reset Tracker
                            </button>
                        )}
                    </div>
                </div>

                {/* Filtration Command Bar */}
                <div className="bg-[#0a0a0b] border border-white/5 rounded-[2.5rem] p-4 flex flex-col md:flex-row items-center gap-4 mb-8 shadow-2xl relative overflow-hidden group">
                    <div className="relative flex-grow w-full">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/10 group-focus-within:text-amber-500 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="FIND SYSTEM IDENTITIES..."
                            className="w-full bg-transparent py-6 pl-16 pr-6 outline-none font-outfit text-[11px] font-black tracking-[0.3em] text-white uppercase placeholder:text-white/10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto px-2">
                        <button
                            onClick={selectAll}
                            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[9px] uppercase tracking-[0.3em] transition-all active:scale-95 whitespace-nowrap border ${selectedIds.length === filteredParticipants.length && filteredParticipants.length > 0 ? 'bg-amber-500 border-amber-500 text-black' : 'bg-white/5 border-white/5 text-white/40 hover:text-white'}`}
                        >
                            {selectedIds.length === filteredParticipants.length && filteredParticipants.length > 0 ? <CheckSquare size={14} strokeWidth={3} /> : <Square size={14} strokeWidth={3} />}
                            Select All ({filteredParticipants.length})
                        </button>
                    </div>
                </div>

                {/* System Record List */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-[#0a0a0b] border border-white/5 rounded-[3rem] overflow-hidden shadow-3xl"
                >
                    {loading ? (
                        <div className="py-32 flex flex-col items-center gap-6">
                            <div className="relative">
                                <Loader2 className="animate-spin text-amber-500" size={48} />
                                <div className="absolute inset-0 bg-amber-500 blur-3xl opacity-20" />
                            </div>
                            <p className="text-[10px] font-black tracking-[0.5em] text-white/10 uppercase">Accessing System Directory...</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.02]">
                            {filteredParticipants.map((p, i) => {
                                const isSent = sentIds.includes(p.id);
                                return (
                                    <motion.div
                                        key={p.id}
                                        variants={fadin}
                                        initial="hidden"
                                        animate="visible"
                                        custom={i}
                                        onClick={() => toggleSelect(p.id)}
                                        className={`flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 px-6 md:px-10 py-6 md:py-8 transition-all cursor-pointer group ${selectedIds.includes(p.id) ? 'bg-amber-500/[0.03]' : 'hover:bg-white/[0.01]'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${selectedIds.includes(p.id) ? 'bg-amber-500 border-amber-500 shadow-2xl shadow-amber-500/20' : 'bg-transparent border-white/10 group-hover:border-white/20'}`}>
                                            {selectedIds.includes(p.id) && <CheckSquare size={18} strokeWidth={3} className="text-black" />}
                                        </div>
                                        <div className="flex-grow space-y-2">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <span className="font-black text-white text-sm tracking-widest uppercase">{p.name}</span>
                                                <span className="text-[9px] bg-amber-500/5 border border-amber-500/10 px-3 py-1 rounded-lg text-amber-500 font-mono font-black tracking-widest">{p.id}</span>
                                                
                                                {/* Email Delivery Status Badge */}
                                                {isSent ? (
                                                    <span 
                                                        onClick={(e) => markAsSentManually(p.id, e)}
                                                        className="text-[9px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-0.5 rounded-lg font-black tracking-widest flex items-center gap-1.5 hover:border-red-500/30 hover:text-red-400 transition-colors"
                                                        title="Click to toggle sent status"
                                                    >
                                                        <CheckCircle2 size={11} /> SENT
                                                    </span>
                                                ) : (
                                                    <span 
                                                        onClick={(e) => markAsSentManually(p.id, e)}
                                                        className="text-[9px] bg-white/5 border border-white/10 text-white/40 px-3 py-0.5 rounded-lg font-black tracking-widest hover:border-emerald-500/30 hover:text-emerald-400 transition-colors"
                                                        title="Click to mark as sent manually"
                                                    >
                                                        REMAINING
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-[10px] text-white/30 font-mono">
                                                <span className="font-black uppercase tracking-[0.2em]">{p.registerNumber}</span>
                                                <span>•</span>
                                                <span className="text-white/40">{p.email || "No Email"}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-start md:items-end gap-2">
                                            <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] group-hover:text-amber-500 transition-colors">SEC {p.section}</div>
                                            <div className="text-[9px] font-bold text-white/10 uppercase tracking-[0.2em]">{p.department} ({p.year})</div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                            {filteredParticipants.length === 0 && (
                                <div className="py-32 text-center text-white/10 font-black uppercase tracking-[0.5em] text-[10px]">
                                    {filterTab === 'pending' ? 'ALL RECORDED PARTICIPANTS HAVE BEEN SENT EMAILS.' : 'NO RECORDED IDENTITIES FOUND IN THIS FILTER.'}
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>

                {/* System Status Footer */}
                <footer className="mt-20 flex flex-col items-center gap-6">
                    <div className="h-px w-20 bg-white/10" />
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-[10px] font-black text-white/5 uppercase tracking-[0.5em]">Vishaka Relay Framework • Finalized Protocol</p>
                        <div className="flex items-center gap-4 text-[9px] text-white/20 font-black uppercase tracking-[0.3em]">
                            <span className="flex items-center gap-2 saturate-0 group hover:saturate-100 transition-all"><Sparkles size={10} className="text-amber-500" /> STABLE CONNECTION</span>
                            <span className="text-white/5">|</span>
                            <span>NODE_CAL-2</span>
                        </div>
                    </div>
                </footer>
            </div>

            {/* Global Theme Overlay */}
            <div className="fixed inset-0 pointer-events-none border-[30px] border-[#000] opacity-20 hidden lg:block" />
        </div>
    );
}

