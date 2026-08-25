"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { Plus, Trash2, Download, Search, Loader2, Building, Users, ShieldCheck, QrCode, Mail, ScanLine, LogOut, LayoutDashboard, ChevronRight, X, Upload, FileText, AlertTriangle, CheckCircle2, Table2, RefreshCw } from "lucide-react";
import { Participant } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type CsvRow = {
    name: string;
    register_number: string;
    year: string;
    department: string;
    section: string;
    game: string;
    category: string;
    culturals: string;
    email: string;
    mobile: string;
    _error?: string;
};

export default function AdminPage() {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [baseUrl, setBaseUrl] = useState("");
    const router = useRouter();

    // CSV Import state
    const [showCsvModal, setShowCsvModal] = useState(false);
    const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
    const [csvFileName, setCsvFileName] = useState("");
    const [csvImporting, setCsvImporting] = useState(false);
    const [csvProgress, setCsvProgress] = useState(0);
    const [csvDone, setCsvDone] = useState(false);
    const [csvErrors, setCsvErrors] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [newParticipant, setNewParticipant] = useState({
        name: "",
        registerNumber: "",
        year: "",
        department: "",
        section: "",
        game: "",
        email: "",
        mobile: "",
        category: "",
        culturalInterest: "",
        event: "Splash Event 2026",
    });

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

        const windowUrl = window.location.origin;
        const defaultUrl = windowUrl.includes('localhost')
            ? `http://10.136.9.91:3000`
            : windowUrl;

        setBaseUrl(defaultUrl);
        fetchParticipants();
    }, [router]);

    useEffect(() => {
        if (participants.length > 0) {
            setParticipants(prev => prev.map(p => ({
                ...p,
                qrValue: `${baseUrl}/p/${p.participant_id || p.id}`
            })));
        }
    }, [baseUrl]);

    useEffect(() => {
        const channel = supabase
            .channel('participants-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'participants' },
                (payload) => {
                    fetchParticipants();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function fetchParticipants() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('participants')
                .select('*')
                .order('created_at', { ascending: false });

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
                qrValue: `${baseUrl}/p/${item.participant_id}`
            }));

            setParticipants(mappedData);
        } catch (error) {
            const errMsg = (error && typeof error === 'object')
                ? (error as any).message || (error as any).details || (error as any).hint || JSON.stringify(error)
                : String(error);
            console.error('Error fetching participants:', errMsg);
        } finally {
            setLoading(false);
        }
    }

    const generateParticipantId = () => {
        let maxCount = 0;
        participants.forEach(p => {
            const match = p.participant_id?.match(/Splash2026-(\d+)/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxCount) maxCount = num;
            }
        });
        const padded = (maxCount + 1).toString().padStart(4, '0');
        return `Splash2026-${padded}`;
    };

    const handleAddParticipant = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const customId = generateParticipantId();
            const { error } = await supabase.from('participants').insert([{
                participant_id: customId,
                participant_name: newParticipant.name,
                email: newParticipant.email,
                mobile: newParticipant.mobile,
                category: newParticipant.category,
                cultural_interest: newParticipant.culturalInterest,
                register_number: newParticipant.registerNumber,
                year: newParticipant.year,
                department: newParticipant.department,
                section: newParticipant.section,
                game: newParticipant.game,
                event: "Splash 2026",
                status: "registered",
            }]);
            if (error) throw error;
            // Send welcome email if email provided
            if (newParticipant.email) {
                await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: newParticipant.email,
                        name: newParticipant.name,
                        event: "Splash 2026",
                    }),
                }).catch((e) => console.error('Email send error:', e));
            }
            // Reset form
            setNewParticipant({ name: "", registerNumber: "", year: "", department: "", section: "", game: "", email: "", mobile: "", event: "Splash 2026", category: "", culturalInterest: "" });
            setShowAddModal(false);
            fetchParticipants();
        } catch (error: any) {
            console.error('Error adding participant:', error);
            alert("Error adding participant: " + (error?.message || JSON.stringify(error)));
        } finally {
            setIsSaving(false);
        }
    };

    const deleteParticipant = async (participantId?: string) => {
        if (!participantId) return;
        if (!confirm("Confirm system deletion for: " + participantId)) return;
        try {
            const { error } = await supabase.from('participants').delete().eq('participant_id', participantId);
            if (error) throw error;
            setParticipants(participants.filter((p) => p.participant_id !== participantId));
        } catch (error) {
            alert("Deletion failed.");
        }
    };

    const handleResetDay = async () => {
        if (!confirm("This will reset all attendees' statuses back to 'registered' for a new attendance day. Are you sure?")) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('participants')
                .update({ status: 'registered' })
                .neq('status', 'registered');

            if (error) throw error;

            alert("Attendance successfully reset for a new day.");
            fetchParticipants();
        } catch (error: any) {
            console.error('Error resetting attendance:', error);
            alert("Error resetting attendance: " + (error?.message || JSON.stringify(error)));
        } finally {
            setIsSaving(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'checked-in': return '#00ff88';
            case 'checked-out': return '#3b82f6';
            case 'registered': default: return '#f59e0b';
        }
    };

    const filteredParticipants = participants.filter(
        (p) =>
            p.participant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.registerNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.participant_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const downloadQR = (id?: string, name?: string) => {
        const validId = id || "unknown";
        const validName = name || "participant";
        const canvas = document.getElementById(`qr-${validId}`) as HTMLCanvasElement;
        if (canvas) {
            const url = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = url;
            link.download = `QR-${validName.replace(/\s+/g, "-")}.png`;
            link.click();
        }
    };

    // ── CSV helpers ──────────────────────────────────────────────────────────
    const REQUIRED_HEADERS = ["name", "register_number"];

    const parseCsv = (text: string): CsvRow[] => {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return [];

        const headerLine = lines[0];
        let delimiter = ",";
        const commaCount = (headerLine.match(/,/g) || []).length;
        const tabCount = (headerLine.match(/\t/g) || []).length;
        const semiCount = (headerLine.match(/;/g) || []).length;
        if (tabCount > commaCount && tabCount > semiCount) delimiter = "\t";
        else if (semiCount > commaCount && semiCount > tabCount) delimiter = ";";

        const rawHeaders = headerLine.split(delimiter).map(h =>
            h.trim().toLowerCase().replace(/^["']|["']$/g, "").replace(/\s+/g, "_")
        );
        const rows: CsvRow[] = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values: string[] = [];
            if (delimiter === ",") {
                let cur = "";
                let inQuotes = false;
                for (const ch of line) {
                    if (ch === '"') inQuotes = !inQuotes;
                    else if (ch === ',' && !inQuotes) { values.push(cur.trim()); cur = ""; }
                    else { cur += ch; }
                }
                values.push(cur.trim());
            } else {
                line.split(delimiter).forEach(v => values.push(v.trim().replace(/^["']|["']$/g, "")));
            }

            const row: Record<string, string> = {};
            let detectedEmail = "";
            let detectedMobile = "";

            rawHeaders.forEach((h, idx) => {
                const val = values[idx] || "";
                row[h] = val;

                // Map aliases to standard field names
                if (["name", "participant_name", "student_name", "full_name", "identity", "student"].includes(h) || h.includes("student_name") || h.includes("participant_name")) {
                    row["name"] = val;
                }
                if (["id", "reg_no", "regno", "reg_number", "register_no", "register_number", "enrollment_number", "roll_no", "rollno", "ht_no", "hallticket"].includes(h) || h.includes("register") || h.includes("reg_no") || h.includes("roll")) {
                    row["register_number"] = val;
                }
                if (["year", "yr", "academic_year", "study_year"].includes(h) || h.includes("year")) {
                    row["year"] = val;
                }
                if (["dept", "department", "branch"].includes(h) || h.includes("dept") || h.includes("branch")) {
                    row["department"] = val;
                }
                if (["sec", "section", "class"].includes(h) || h.includes("section")) {
                    row["section"] = val;
                }
                if (["category", "cat", "participant_category", "type"].includes(h) || h.includes("category")) {
                    row["category"] = val;
                }
                if (["culturals", "cultural", "cultural_interest", "culturals_interest", "cultural_activity", "cultural_event"].includes(h) || h.includes("cultural")) {
                    row["culturals"] = val;
                }
                if (["game", "game_name", "event", "event_name", "sport", "sports", "activity"].includes(h) || h.includes("game") || h.includes("sport")) {
                    row["game"] = val;
                }
                if (["mobile", "phone", "phone_number", "mobile_number", "contact", "contact_number", "ph_no", "whatsapp", "cell"].includes(h) || h.includes("mobile") || h.includes("phone") || h.includes("contact")) {
                    row["mobile"] = val;
                }
                if (["email", "mail", "gmail", "email_id", "mail_id", "gmail_id", "emailid", "mailid", "gmailid", "email_address", "e_mail", "google_mail"].includes(h) || h.includes("email") || h.includes("mail") || h.includes("gmail")) {
                    row["email"] = val;
                }

                // Check cell value patterns as fallback
                if (!detectedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
                    detectedEmail = val.trim();
                }
                if (!detectedMobile && /^[6-9]\d{9}$/.test(val.replace(/[\s+-]/g, ""))) {
                    detectedMobile = val.trim();
                }
            });

            const parsedName = row["name"] || row["participant_name"] || "";
            const parsedReg = row["register_number"] || "";
            const parsedEmail = row["email"] || detectedEmail || "";
            const parsedMobile = row["mobile"] || detectedMobile || "";
            let parsedCategory = row["category"] || "";
            const parsedCulturals = row["culturals"] || row["cultural_interest"] || "";
            const parsedGame = row["game"] || "";

            // Auto-infer category if not given explicitly
            if (!parsedCategory) {
                if (parsedCulturals) parsedCategory = "Culturals";
                else if (parsedGame) parsedCategory = "Games";
            }

            const errors: string[] = [];
            if (!parsedName) errors.push("Missing: Name");
            if (!parsedReg) errors.push("Missing: Register Number");

            rows.push({
                name: parsedName,
                register_number: parsedReg,
                year: row["year"] || "",
                department: row["department"] || "",
                section: row["section"] || "",
                category: parsedCategory,
                culturals: parsedCulturals,
                game: parsedGame,
                email: parsedEmail,
                mobile: parsedMobile,
                _error: errors.length ? errors.join(", ") : undefined,
            });
        }
        return rows;
    };

    const handleCsvFile = (file: File) => {
        if (!file.name.endsWith(".csv")) {
            alert("Please upload a valid .csv file.");
            return;
        }
        setCsvFileName(file.name);
        setCsvDone(false);
        setCsvProgress(0);
        setCsvErrors([]);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const parsed = parseCsv(text);
            setCsvRows(parsed);
        };
        reader.readAsText(file);
    };

    const handleCsvDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleCsvFile(file);
    }, []);

    // Generate next ID based on current max + offset for batch imports
    const generateNextId = (currentMax: number) => {
        const padded = (currentMax + 1).toString().padStart(4, "0");
        return `Splash2026-${padded}`;
    };

    const handleBulkImport = async () => {
        const validRows = csvRows.filter(r => !r._error);
        if (!validRows.length) return;

        setCsvImporting(true);
        setCsvProgress(0);
        setCsvErrors([]);

        // Fetch current max id from DB
        const { data: allIds } = await supabase
            .from("participants")
            .select("participant_id");

        let maxCount = 0;
        (allIds || []).forEach((p: { participant_id: string }) => {
            const m = p.participant_id.match(/Splash2026-(\d+)/);
            if (m) maxCount = Math.max(maxCount, parseInt(m[1], 10));
        });

        const errors: string[] = [];
        for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i];
            maxCount++;
            const customId = generateNextId(maxCount - 1);
            const { error } = await supabase.from("participants").insert([{
                participant_id: customId,
                participant_name: row.name,
                email: row.email,
                mobile: row.mobile,
                category: row.category,
                cultural_interest: row.culturals,
                register_number: row.register_number,
                year: row.year,
                department: row.department,
                section: row.section,
                game: row.game,
                event: "Splash 2026",
                status: "registered",
            }]);
            if (error) errors.push(`Row ${i + 1} (${row.name}): ${error.message}`);
            setCsvProgress(Math.round(((i + 1) / validRows.length) * 100));
        }

        setCsvErrors(errors);
        setCsvImporting(false);
        setCsvDone(true);
        fetchParticipants();
    };

    const resetCsvModal = () => {
        setCsvRows([]);
        setCsvFileName("");
        setCsvProgress(0);
        setCsvDone(false);
        setCsvErrors([]);
        setShowCsvModal(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };
    // ─────────────────────────────────────────────────────────────────────────

    const fadin = {
        hidden: { opacity: 0, y: 10 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.05, duration: 0.5, ease: "easeOut" } as any,
        }),
    };

    return (
        <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-outfit selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden relative pb-32">

            {/* Background Grid Pattern */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: '40px 40px' }} />

            <div className="max-w-7xl mx-auto px-6 pt-32">
                {/* Header Section */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 md:gap-12 mb-12 md:mb-20"
                >
                    <div className="space-y-6 w-full lg:w-auto">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-black shadow-2xl shadow-amber-500/20">
                                <LayoutDashboard className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div>
                                <p className="text-[8px] md:text-[10px] font-black tracking-[0.4em] text-amber-500 uppercase">Administrator Control</p>
                                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">Command Center<span className="text-amber-500">.</span></h1>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 md:gap-4 w-full lg:w-auto">
                        <Link href="/admin/scan" className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#111111] border border-white/5 hover:border-amber-500/30 transition-all px-4 md:px-6 py-3.5 md:py-4 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-white/50 hover:text-white">
                            <ScanLine className="w-4 h-4 text-amber-500" /> SCANNER
                        </Link>
                        <Link href="/admin/broadcast" className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#111111] border border-white/5 hover:border-amber-500/30 transition-all px-4 md:px-6 py-3.5 md:py-4 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-white/50 hover:text-white">
                            <Mail className="w-4 h-4" /> BROADCAST
                        </Link>
                        <button onClick={handleResetDay} disabled={isSaving} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#111111] border border-white/5 hover:border-amber-500/30 transition-all px-4 md:px-6 py-3.5 md:py-4 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-red-500/80 hover:text-red-400 disabled:opacity-50">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <RefreshCw className="w-4 h-4 text-red-500" />} RESET DAY
                        </button>
                        <button onClick={() => setShowCsvModal(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#111111] border border-white/5 hover:border-amber-500/30 transition-all px-4 md:px-6 py-3.5 md:py-4 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-white/50 hover:text-white">
                            <Upload className="w-4 h-4 text-amber-500" /> IMPORT CSV
                        </button>
                        <button onClick={() => setShowAddModal(true)} className="w-full md:w-auto flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.3em] hover:bg-amber-500 transition-all shadow-2xl active:scale-95">
                            <Plus className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={3} /> REGISTER NEW
                        </button>
                    </div>
                </motion.header>


                {/* Dashboard Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12"
                >
                    <div className="bg-[#0a0a0b] border border-white/5 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />
                        <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                            <div className="flex items-center justify-between">
                                <Users size={20} className="text-white/20 group-hover:text-amber-500 transition-colors" />
                                <span className="text-[9px] font-black uppercase text-amber-500 tracking-[0.2em] bg-amber-500/10 px-2 py-1 rounded-md">Total</span>
                            </div>
                            <div>
                                <h3 className="text-4xl font-black text-white tracking-tighter">{participants.length}</h3>
                                <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold mt-1">Total Registrations</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#0a0a0b] border border-white/5 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors" />
                        <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                            <div className="flex items-center justify-between">
                                <ShieldCheck size={20} className="text-white/20 group-hover:text-emerald-500 transition-colors" />
                                <span className="text-[9px] font-black uppercase text-emerald-500 tracking-[0.2em] bg-emerald-500/10 px-2 py-1 rounded-md">Inside</span>
                            </div>
                            <div>
                                <h3 className="text-4xl font-black text-white tracking-tighter">{participants.filter(p => p.status === 'checked-in').length}</h3>
                                <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold mt-1">Checked In Today</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#0a0a0b] border border-white/5 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors" />
                        <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                            <div className="flex items-center justify-between">
                                <LogOut size={20} className="text-white/20 group-hover:text-blue-500 transition-colors" />
                                <span className="text-[9px] font-black uppercase text-blue-500 tracking-[0.2em] bg-blue-500/10 px-2 py-1 rounded-md">Left</span>
                            </div>
                            <div>
                                <h3 className="text-4xl font-black text-white tracking-tighter">{participants.filter(p => p.status === 'checked-out').length}</h3>
                                <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold mt-1">Checked Out</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#0a0a0b] border border-white/5 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl group-hover:bg-purple-500/10 transition-colors" />
                        <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                            <div className="flex items-center justify-between">
                                <QrCode size={20} className="text-white/20 group-hover:text-purple-500 transition-colors" />
                                <span className="text-[9px] font-black uppercase text-purple-500 tracking-[0.2em] bg-purple-500/10 px-2 py-1 rounded-md">Pending</span>
                            </div>
                            <div>
                                <h3 className="text-4xl font-black text-white tracking-tighter">{participants.filter(p => !p.status || p.status === 'registered').length}</h3>
                                <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold mt-1">Awaiting Entry</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <div className="mb-8">
                    <div className="relative group h-20 md:h-24">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/10 group-focus-within:text-amber-500 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="SEARCH BY IDENTITY TAG OR NAME"
                            className="w-full h-full bg-white/[0.02] border border-white/5 rounded-3xl md:rounded-[2rem] py-6 md:py-8 pl-14 md:pl-16 pr-6 md:pr-8 focus:outline-none focus:border-amber-500/30 transition-all font-outfit text-[10px] md:text-xs font-black tracking-[0.2em] md:tracking-[0.3em] placeholder:text-white/10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Table Interface */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-[#0a0a0b] border border-white/5 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                >
                    {loading ? (
                        <div className="p-20 md:p-32 flex flex-col items-center justify-center gap-6">
                            <div className="relative">
                                <Loader2 className="w-10 h-10 md:w-12 md:h-12 animate-spin text-amber-500" />
                                <div className="absolute inset-0 bg-amber-500 blur-2xl opacity-20 animate-pulse" />
                            </div>
                            <p className="text-[8px] md:text-[10px] font-black tracking-[0.4em] text-white/20 uppercase">Synchronizing System Data...</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile Card View */}
                            <div className="md:hidden divide-y divide-white/[0.05]">
                                {filteredParticipants.map((p) => (
                                    <div key={p.participant_id} className="p-4 space-y-4 bg-white/[0.01]">
                                        <div className="flex justify-between items-start">
                                            <span className="font-mono text-[9px] font-black text-amber-500/80 tracking-widest bg-amber-500/5 px-2.5 py-1 rounded-md border border-amber-500/10">
                                                {p.participant_id}
                                            </span>
                                            <div className="flex gap-2">
                                                <button onClick={() => downloadQR(p.participant_id, p.participant_name)} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-lg text-white/20">
                                                    <Download size={14} />
                                                </button>
                                                <button onClick={() => deleteParticipant(p.participant_id)} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-lg text-white/20">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <div onClick={() => setSelectedParticipant(p)}>
                                            <div className="font-black text-xs text-white tracking-widest uppercase mb-1">{p.participant_name}</div>
                                            <div className="text-[8px] text-white/30 font-bold uppercase tracking-widest flex items-center gap-2">
                                                <Building size={10} className="text-amber-500/50" /> {p.department} ({p.year})
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <div className="inline-flex items-center gap-2 text-[8px] font-black tracking-widest px-2.5 py-1 rounded-full border" style={{ color: getStatusColor(p.status), borderColor: `${getStatusColor(p.status)}40`, backgroundColor: `${getStatusColor(p.status)}10` }}>
                                                <div className="w-1 h-1 rounded-full" style={{ backgroundColor: getStatusColor(p.status) }} />
                                                {p.status}
                                            </div>
                                            <div className="text-[9px] font-black text-white/20 tracking-widest uppercase">SEC {p.section} | {p.registerNumber}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/[0.02] border-b border-white/5 font-outfit text-[10px] font-black uppercase tracking-[0.4em] text-white/20">
                                            <th className="px-10 py-8">IDENTITY TAG</th>
                                            <th className="px-10 py-8">DELEGATE PROFILE</th>
                                            <th className="px-10 py-8">DEPT & STATUS</th>
                                            <th className="px-10 py-8 text-center uppercase tracking-[0.2em] text-amber-500/50">SECURED QR PASS</th>
                                            <th className="px-10 py-8 text-right">CONTROLS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.02]">
                                        {filteredParticipants.map((p, i) => (
                                            <motion.tr
                                                key={p.participant_id}
                                                variants={fadin}
                                                initial="hidden"
                                                animate="visible"
                                                custom={i}
                                                className="group hover:bg-white/[0.01] transition-colors"
                                            >
                                                <td className="px-10 py-8">
                                                    <span className="font-mono text-[11px] font-black text-amber-500/80 tracking-widest bg-amber-500/5 px-3 py-1.5 rounded-lg border border-amber-500/10">
                                                        {p.participant_id}
                                                    </span>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <div className="font-black text-sm text-white tracking-widest uppercase mb-1">{p.participant_name}</div>
                                                    <div className="text-[10px] text-white/30 font-bold uppercase tracking-[0.1em] flex items-center gap-2">
                                                        <Building size={10} className="text-amber-500/50" /> {p.registerNumber}
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <div className="text-[11px] font-black text-white/50 tracking-widest uppercase mb-2 group-hover:text-white transition-colors">{p.department} (Year {p.year}, Sec {p.section})</div>
                                                    <div className="inline-flex items-center gap-2 lowercase text-[10px] font-black tracking-widest px-3 py-1 rounded-full border whitespace-nowrap" style={{ color: getStatusColor(p.status), borderColor: `${getStatusColor(p.status)}40`, backgroundColor: `${getStatusColor(p.status)}10` }}>
                                                        <div className="w-1 h-1 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: getStatusColor(p.status) }} />
                                                        {p.status}
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8 text-center">
                                                    <motion.div
                                                        whileHover={{ scale: 1.1, rotate: 2 }}
                                                        className="inline-block relative group/qr"
                                                    >
                                                        <div className="absolute -inset-2 bg-amber-500 opacity-0 group-hover/qr:opacity-10 blur-xl transition-opacity rounded-2xl" />
                                                        <div
                                                            className="bg-white p-2.5 rounded-xl cursor-pointer shadow-2xl relative z-10"
                                                            onClick={() => setSelectedParticipant(p)}
                                                        >
                                                            <QRCodeCanvas
                                                                id={`qr-${p.participant_id}`}
                                                                value={p.qrValue}
                                                                size={56}
                                                                level="H"
                                                            />
                                                        </div>
                                                    </motion.div>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <div className="flex justify-end items-center gap-3">
                                                        <button onClick={() => downloadQR(p.participant_id, p.participant_name)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-amber-500 hover:text-black transition-all rounded-xl text-white/20">
                                                            <Download size={16} />
                                                        </button>
                                                        <button onClick={() => deleteParticipant(p.participant_id)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-red-500 transition-all rounded-xl text-white/20">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </motion.div>
            </div>


            {/* ── CSV Import Modal ───────────────────────────────────────────────── */}
            <AnimatePresence>
                {showCsvModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/95 backdrop-blur-xl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="p-8 md:p-12 border-b border-white/5 flex justify-between items-end flex-shrink-0">
                                <div>
                                    <p className="text-[10px] font-black tracking-[0.4em] text-amber-500 uppercase mb-2">Bulk Data Ingestion</p>
                                    <h2 className="text-2xl md:text-3xl font-black text-white leading-none uppercase tracking-tighter">Import CSV.</h2>
                                    <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-2">
                                        Expected columns: name, register_number, year, department, section, game, mobile, email
                                    </p>
                                </div>
                                <button onClick={resetCsvModal} className="w-11 h-11 flex items-center justify-center bg-white/5 rounded-2xl hover:bg-white/10 transition-colors text-white/50 hover:text-white border border-white/5 flex-shrink-0">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-8">
                                {/* Drop Zone */}
                                {!csvRows.length && !csvDone && (
                                    <div
                                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={handleCsvDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`relative border-2 border-dashed rounded-[2rem] p-12 md:p-20 flex flex-col items-center justify-center text-center gap-6 cursor-pointer transition-all duration-300 ${isDragging
                                            ? "border-amber-500/60 bg-amber-500/5"
                                            : "border-white/10 hover:border-amber-500/30 hover:bg-white/[0.01]"
                                            }`}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            onChange={(e) => { if (e.target.files?.[0]) handleCsvFile(e.target.files[0]); }}
                                        />
                                        <div className={`w-20 h-20 rounded-[1.8rem] flex items-center justify-center transition-colors ${isDragging ? "bg-amber-500/20 text-amber-400" : "bg-white/[0.04] text-white/20"
                                            }`}>
                                            <Upload size={36} strokeWidth={1.5} />
                                        </div>
                                        <div>
                                            <p className="text-white/60 font-black text-sm uppercase tracking-widest mb-2">
                                                {isDragging ? "Release to upload" : "Drag & drop your CSV"}
                                            </p>
                                            <p className="text-white/20 text-[10px] uppercase tracking-[0.3em] font-bold">
                                                or click to browse files
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-30">
                                            <FileText size={12} className="text-amber-500" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-white">.csv files only</span>
                                        </div>
                                    </div>
                                )}

                                {/* Template Download */}
                                {!csvRows.length && !csvDone && (
                                    <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-2xl px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <Table2 size={16} className="text-amber-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Download template CSV</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const template = "name,register_number,year,department,section,category,game,culturals,mobile,email\nJohn Doe,22CS001,2,CSE,A,Games,Cricket,,9876543210,john@example.com\nJane Doe,22CS002,2,CSE,B,Culturals,,Dance,9876543211,jane@example.com";
                                                const blob = new Blob([template], { type: "text/csv" });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement("a");
                                                a.href = url; a.download = "participants_template.csv"; a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="flex items-center gap-2 text-amber-500 hover:text-amber-400 transition-colors text-[10px] font-black uppercase tracking-widest"
                                        >
                                            <Download size={14} /> Template
                                        </button>
                                    </div>
                                )}

                                {/* Preview Table */}
                                {csvRows.length > 0 && !csvDone && (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <FileText size={16} className="text-amber-500" />
                                                <span className="text-[11px] font-black uppercase tracking-widest text-white/60">{csvFileName}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400/80 bg-emerald-400/10 px-3 py-1 rounded-full">
                                                    {csvRows.filter(r => !r._error).length} valid
                                                </span>
                                                {csvRows.some(r => r._error) && (
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-red-400/80 bg-red-400/10 px-3 py-1 rounded-full">
                                                        {csvRows.filter(r => r._error).length} errors
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => { setCsvRows([]); setCsvFileName(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                                    className="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-red-400 transition-colors"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto rounded-2xl border border-white/5 max-h-72">
                                            <table className="w-full text-left border-collapse text-[10px] font-black uppercase tracking-widest">
                                                <thead className="sticky top-0">
                                                    <tr className="bg-[#111] border-b border-white/5 text-white/20">
                                                        <th className="px-4 py-3">#</th>
                                                        <th className="px-4 py-3">Name</th>
                                                        <th className="px-4 py-3">Reg No.</th>
                                                        <th className="px-4 py-3">Year</th>
                                                        <th className="px-4 py-3">Dept</th>
                                                        <th className="px-4 py-3">Sec</th>
                                                        <th className="px-4 py-3">Category</th>
                                                        <th className="px-4 py-3">Game</th>
                                                        <th className="px-4 py-3">Culturals</th>
                                                        <th className="px-4 py-3">Email</th>
                                                        <th className="px-4 py-3">Mobile</th>
                                                        <th className="px-4 py-3">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/[0.03]">
                                                    {csvRows.map((row, i) => (
                                                        <tr key={i} className={row._error ? "bg-red-500/5" : "hover:bg-white/[0.01]"}>
                                                            <td className="px-4 py-3 text-white/20">{i + 1}</td>
                                                            <td className="px-4 py-3 text-white">{row.name || <span className="text-red-400">—</span>}</td>
                                                            <td className="px-4 py-3 text-amber-500/70">{row.register_number || <span className="text-red-400">—</span>}</td>
                                                            <td className="px-4 py-3 text-white/50">{row.year}</td>
                                                            <td className="px-4 py-3 text-white/50">{row.department}</td>
                                                            <td className="px-4 py-3 text-white/50">{row.section}</td>
                                                            <td className="px-4 py-3 text-white/50">{row.category}</td>
                                                            <td className="px-4 py-3 text-white/50">{row.game}</td>
                                                            <td className="px-4 py-3 text-white/50">{row.culturals}</td>
                                                            <td className="px-4 py-3 text-white/40">{row.email}</td>
                                                            <td className="px-4 py-3 text-white/40">{row.mobile}</td>
                                                            <td className="px-4 py-3">
                                                                {row._error
                                                                    ? <span className="text-red-400 flex items-center gap-1"><AlertTriangle size={10} /> Error</span>
                                                                    : <span className="text-emerald-400">✓ OK</span>
                                                                }
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Progress */}
                                {csvImporting && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                            <span className="text-white/40">Importing records...</span>
                                            <span className="text-amber-500">{csvProgress}%</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div
                                                animate={{ width: `${csvProgress}%` }}
                                                className="h-full bg-amber-500 rounded-full"
                                                transition={{ ease: "linear" }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Done State */}
                                {csvDone && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex flex-col items-center gap-6 py-8 text-center"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                            <CheckCircle2 size={32} strokeWidth={1.5} />
                                        </div>
                                        <div>
                                            <p className="text-emerald-400 font-black text-sm uppercase tracking-widest">
                                                Import Complete
                                            </p>
                                            <p className="text-white/30 text-[10px] uppercase tracking-widest mt-2">
                                                {csvRows.filter(r => !r._error).length - csvErrors.length} of {csvRows.filter(r => !r._error).length} records added successfully.
                                            </p>
                                        </div>
                                        {csvErrors.length > 0 && (
                                            <div className="w-full bg-red-500/5 border border-red-500/10 rounded-2xl p-6 text-left space-y-2">
                                                <p className="text-red-400 text-[10px] font-black uppercase tracking-widest mb-3">Failed rows:</p>
                                                {csvErrors.map((e, i) => (
                                                    <p key={i} className="text-red-400/60 text-[9px] font-mono">{e}</p>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="p-8 md:p-12 border-t border-white/5 flex gap-4 flex-shrink-0">
                                {!csvDone ? (
                                    <>
                                        <button
                                            onClick={resetCsvModal}
                                            className="flex-1 py-5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleBulkImport}
                                            disabled={csvImporting || csvRows.filter(r => !r._error).length === 0}
                                            className="flex-1 flex items-center justify-center gap-3 bg-white text-black py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] hover:bg-amber-500 transition-all shadow-2xl disabled:opacity-40 active:scale-[0.98]"
                                        >
                                            {csvImporting
                                                ? <><Loader2 size={18} className="animate-spin" /> Importing...</>
                                                : <><Upload size={16} strokeWidth={3} /> Import {csvRows.filter(r => !r._error).length} Records</>
                                            }
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={resetCsvModal}
                                        className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] hover:bg-amber-500 transition-all shadow-2xl active:scale-[0.98]"
                                    >
                                        Done
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modals & Overlays */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/95 backdrop-blur-xl">
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col">
                            <div className="p-8 md:p-14 border-b border-white/5 flex justify-between items-end flex-shrink-0">
                                <div>
                                    <p className="text-[10px] font-black tracking-[0.4em] text-amber-500 uppercase mb-2">Initialize System Record</p>
                                    <h2 className="text-3xl font-black text-white leading-none uppercase tracking-tighter">Registration.</h2>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl hover:bg-white/10 transition-colors text-white/50 hover:text-white border border-white/5 flex-shrink-0"><X size={24} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8 md:p-14">
                                <form onSubmit={handleAddParticipant} className="space-y-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Full Identity</label>
                                            <input required className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-5 px-6 outline-none focus:border-amber-500/30 text-xs font-black tracking-widest text-white" placeholder="NAME" value={newParticipant.name} onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })} />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Register Number</label>
                                            <input required className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-5 px-6 outline-none focus:border-amber-500/30 text-xs font-black tracking-widest text-white" placeholder="REGISTER NUMBER" value={newParticipant.registerNumber} onChange={(e) => setNewParticipant({ ...newParticipant, registerNumber: e.target.value })} />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Year</label>
                                            <input required className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-5 px-6 outline-none focus:border-amber-500/30 text-xs font-black tracking-widest text-white" placeholder="YEAR" value={newParticipant.year} onChange={(e) => setNewParticipant({ ...newParticipant, year: e.target.value })} />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Department</label>
                                            <input required className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-5 px-6 outline-none focus:border-amber-500/30 text-xs font-black tracking-widest text-white" placeholder="DEPARTMENT" value={newParticipant.department} onChange={(e) => setNewParticipant({ ...newParticipant, department: e.target.value })} />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Section</label>
                                            <input required className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-5 px-6 outline-none focus:border-amber-500/30 text-xs font-black tracking-widest text-white" placeholder="SECTION" value={newParticipant.section} onChange={(e) => setNewParticipant({ ...newParticipant, section: e.target.value })} />
                                        </div>

                                        <div className="space-y-4">
                                            <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Email (Optional)</label>
                                            <input type="email" className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-5 px-6 outline-none focus:border-amber-500/30 text-xs font-black tracking-widest text-white" placeholder="EMAIL" value={newParticipant.email} onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })} />
                                            <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-4">Mobile (Optional)</label>
                                            <input type="tel" className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-5 px-6 outline-none focus:border-amber-500/30 text-xs font-black tracking-widest text-white" placeholder="MOBILE" value={newParticipant.mobile} onChange={(e) => setNewParticipant({ ...newParticipant, mobile: e.target.value })} />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Category</label>
                                            <select className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-5 px-6 outline-none focus:border-amber-500/30 text-xs font-black tracking-widest text-white" value={newParticipant.category} onChange={(e) => setNewParticipant({ ...newParticipant, category: e.target.value })}>
                                                <option value="Games">Games</option>
                                                <option value="Culturals">Culturals</option>
                                                <option value="Event & Dj Attendee">Event & Dj Attendee</option>
                                            </select>
                                        </div>
                                        {newParticipant.category === "Games" && (
                                            <div className="space-y-4">
                                                <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Game</label>
                                                <input className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-5 px-6 outline-none focus:border-amber-500/30 text-xs font-black tracking-widest text-white" placeholder="GAME" value={newParticipant.game} onChange={(e) => setNewParticipant({ ...newParticipant, game: e.target.value })} />
                                            </div>
                                        )}
                                        {newParticipant.category === "Culturals" && (
                                            <div className="space-y-4">
                                                <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Cultural Interest</label>
                                                <input className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-5 px-6 outline-none focus:border-amber-500/30 text-xs font-black tracking-widest text-white" placeholder="Cultural Interest" value={newParticipant.culturalInterest} onChange={(e) => setNewParticipant({ ...newParticipant, culturalInterest: e.target.value })} />
                                            </div>
                                        )}
                                    </div>
                                    <button type="submit" disabled={isSaving} className="w-full bg-white text-black py-6 rounded-xl font-black uppercase tracking-[0.3em] text-[11px] hover:bg-amber-500 transition-all flex items-center justify-center gap-4 shadow-3xl disabled:opacity-50">
                                        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <>FINALIZE ENTRANCE <ChevronRight size={18} strokeWidth={3} /></>}
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Big Identity View Overlay */}
            <AnimatePresence>
                {selectedParticipant && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/95 backdrop-blur-3xl" onClick={() => setSelectedParticipant(null)}>
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }} className="bg-white rounded-[3rem] w-full max-w-md max-h-[90vh] overflow-y-auto shadow-[0_0_100px_rgba(0,0,0,1)] relative scrollbar-hide" onClick={e => e.stopPropagation()}>
                            <div className="absolute top-0 right-10 h-16 w-1 bg-amber-500" />

                            <div className="p-8 md:p-12">
                                <div className="flex justify-between items-start mb-16">
                                    <div>
                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-3">System Identity Passport</p>
                                        <h3 className="text-black text-4xl font-black leading-none tracking-tighter uppercase whitespace-pre-wrap">{selectedParticipant.name}</h3>
                                        <p className="text-black/30 font-black uppercase text-[10px] mt-4 tracking-[0.2em]">{selectedParticipant.registerNumber}</p>
                                    </div>
                                    <X onClick={() => setSelectedParticipant(null)} className="text-black/10 hover:text-black cursor-pointer transition-colors flex-shrink-0" size={24} />
                                </div>

                                <div className="bg-[#f0f0f0] p-10 rounded-[2.5rem] mb-12 flex flex-col items-center justify-center border border-black/5 shadow-inner">
                                    <QRCodeCanvas id={`qr-big-${selectedParticipant.id}`} value={selectedParticipant.qrValue} size={240} level="H" />
                                    <div className="mt-10 space-y-2 flex flex-col items-center">
                                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                        <p className="text-black font-mono text-[11px] font-black tracking-widest bg-black/5 px-6 py-2 rounded-full uppercase">TAG: {selectedParticipant.id}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8 mb-16 px-2">
                                    <div>
                                        <p className="text-[9px] font-black text-black/20 uppercase tracking-widest mb-1">Details</p>
                                        <p className="text-black font-black text-xs tracking-widest uppercase">{selectedParticipant.department} - Yr {selectedParticipant.year} (Sec {selectedParticipant.section})</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-black/20 uppercase tracking-widest mb-1">Authorization</p>
                                        <p className="font-black text-xs tracking-widest uppercase italic" style={{ color: getStatusColor(selectedParticipant.status) }}>
                                            {selectedParticipant.status.replace('-', '_')}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => downloadQR(`qr-big-${selectedParticipant.id}`, selectedParticipant.id)}
                                    className="w-full bg-black text-white py-6 rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center gap-3 shadow-2xl"
                                >
                                    <Download size={18} /> DOWNLOAD_AS_IMAGE
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}

