"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { 
    Plus, Trash2, Download, Search, Loader2, Building, Users, ShieldCheck, 
    QrCode, Mail, ScanLine, LayoutDashboard, ChevronRight, X, Upload, 
    FileText, AlertTriangle, CheckCircle2, Table2, RefreshCw, ArrowLeft,
    Calendar, MapPin, Tag, Filter, Check, ChevronDown, Sparkles, Database,
    Terminal, FileCode, Copy
} from "lucide-react";
import { Participant, EventItem } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getEvents, getEventById, updateEvent } from "@/lib/events";
import { 
    getEventTableNames, 
    generateEventTablesSQL, 
    provisionEventTables, 
    checkTableExists,
    sanitizeEventTableName 
} from "@/lib/eventTables";
import EventTablesModal from "@/app/components/EventTablesModal";
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

export default function EventCommandCenterPage() {
    const params = useParams();
    const router = useRouter();
    const eventId = (params?.id as string) || "vishaka-2026";

    const [currentEvent, setCurrentEvent] = useState<EventItem | null>(null);
    const [allEvents, setAllEvents] = useState<EventItem[]>([]);
    const [showEventDropdown, setShowEventDropdown] = useState(false);
    const [hasDedicatedTable, setHasDedicatedTable] = useState(false);
    const [showTablesModal, setShowTablesModal] = useState(false);

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<'all' | 'registered' | 'checked-in'>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [baseUrl, setBaseUrl] = useState("");

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

    // Initial auth & event loading
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

        loadEventData();
    }, [eventId, router]);

    async function loadEventData() {
        try {
            const events = await getEvents();
            setAllEvents(events);
            let targetEvt: EventItem | null = null;
            if (eventId === "all") {
                targetEvt = {
                    id: "all",
                    title: "All Events Global Fest",
                    code: "ALL-EVENTS",
                    category: "Symposium",
                    description: "Aggregated command center displaying participants across all registered events.",
                    venue: "Campus Wide",
                    date: "2026-03-15",
                    status: "active",
                    maxCapacity: 1500,
                    colorTheme: "#f59e0b",
                };
            } else {
                targetEvt = events.find(e => 
                    e.id.toLowerCase() === eventId.toLowerCase() || 
                    e.code.toLowerCase() === eventId.toLowerCase()
                ) || (events.length > 0 ? events[0] : null);
            }

            if (targetEvt) {
                setCurrentEvent(targetEvt);
                if (targetEvt.id !== "all") {
                    const { participantsTable } = getEventTableNames(targetEvt.title);
                    const tableActive = await checkTableExists(participantsTable);
                    setHasDedicatedTable(tableActive);
                }
            }
        } catch (e) {
            console.error("Error loading event:", e);
        }
    }

    const fetchParticipants = useCallback(async () => {
        if (!currentEvent) return;
        try {
            const isAll = currentEvent.id === "all";
            const { participantsTable, checkInTable } = getEventTableNames(currentEvent.title);

            let rawData: any[] = [];
            let checkedInSet = new Set<string>();

            // Always check if dedicated table exists for this event
            let dedicatedExists = false;
            if (!isAll) {
                dedicatedExists = await checkTableExists(participantsTable);
                setHasDedicatedTable(dedicatedExists);
            }

            if (dedicatedExists && !isAll) {
                try {
                    const [pRes, logRes] = await Promise.all([
                        supabase.from(participantsTable).select('*').order('created_at', { ascending: false }),
                        supabase.from(checkInTable).select('participant_id, logged_at')
                    ]);

                    if (!pRes.error && pRes.data) {
                        rawData = pRes.data;
                        checkedInSet = new Set((logRes.data || []).map((l: any) => l.participant_id));
                    }
                } catch (dedErr) {
                    console.warn("Dedicated table read error:", dedErr);
                }
            } else {
                // Check if unified table exists
                const hasUnified = await checkTableExists('participants');
                if (hasUnified) {
                    try {
                        const [pRes, logRes] = await Promise.all([
                            supabase.from('participants').select('*').order('created_at', { ascending: false }),
                            supabase.from('check_in_logs').select('participant_id, logged_at')
                        ]);

                        if (!pRes.error && pRes.data) {
                            const isMainSymposium = currentEvent.id === "vishaka-2026" || /vishaka/i.test(currentEvent.code);
                            rawData = (pRes.data || []).filter((item: any) => {
                                if (isAll) return true;
                                const pEvent = (item.event || "").trim().toLowerCase();
                                const eventCode = (currentEvent.code || "").toLowerCase();
                                const eventTitle = (currentEvent.title || "").toLowerCase();

                                if (isMainSymposium) {
                                    return !pEvent || /vishaka/i.test(pEvent) || /splash/i.test(pEvent) || pEvent.includes(eventCode);
                                }

                                return pEvent.includes(eventCode) || 
                                       pEvent.includes(eventTitle) || 
                                       eventTitle.includes(pEvent);
                            });
                            checkedInSet = new Set((logRes.data || []).map((l: any) => l.participant_id));
                        }
                    } catch (uniErr) {
                        console.warn("Unified table read error:", uniErr);
                    }
                }
            }

            // Merge with local storage cache for this event as a resilient fail-safe
            try {
                const localKey = `local_participants_${currentEvent.id}`;
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
                console.warn("LocalStorage merge warning:", lsErr);
            }

            const mappedData: Participant[] = rawData.map((item: any) => {
                const rawId = item.participant_id || item.id || "";
                const cleanId = rawId.replace(/splash/gi, "Vishaka");
                const isCheckedIn = item.status === 'checked-in' || checkedInSet.has(rawId) || checkedInSet.has(cleanId) || checkedInSet.has(item.id);

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
                    culturalInterest: item.cultural_interest || item.culturalInterest || "",
                    status: isCheckedIn ? 'checked-in' : (item.status || 'registered'),
                    event: item.event || currentEvent.title,
                    registrationDate: item.created_at ? new Date(item.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
                    qrValue: `${baseUrl}/p/${cleanId}`
                };
            });

            setParticipants(mappedData);
        } catch (error) {
            console.error('Error fetching participants for event:', error);
        } finally {
            setLoading(false);
        }
    }, [currentEvent, baseUrl]);

    useEffect(() => {
        if (currentEvent) {
            setLoading(true);
            fetchParticipants();
        }
    }, [currentEvent, fetchParticipants]);

    useEffect(() => {
        const { participantsTable, checkInTable } = currentEvent ? getEventTableNames(currentEvent.title) : { participantsTable: 'participants', checkInTable: 'check_in_logs' };

        const channel = supabase
            .channel(`dashboard-${eventId}-sync`)
            .on('postgres_changes', { event: '*', schema: 'public', table: hasDedicatedTable ? participantsTable : 'participants' }, () => {
                fetchParticipants();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: hasDedicatedTable ? checkInTable : 'check_in_logs' }, () => {
                fetchParticipants();
            })
            .subscribe();

        const interval = setInterval(() => {
            fetchParticipants();
        }, 6000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [eventId, fetchParticipants, currentEvent, hasDedicatedTable]);

    // Participant ID generation
    const generateParticipantId = () => {
        let maxCount = 0;
        const prefix = currentEvent ? currentEvent.code.replace(/[^A-Za-z0-9]/g, '') : "Vishaka";
        
        participants.forEach(p => {
            const regex = new RegExp(`(?:${prefix}|Vishaka|Splash)(?:2026)?[-_]?(\\d+)`, 'i');
            const match = p.participant_id?.match(regex);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxCount) maxCount = num;
            }
        });
        const padded = (maxCount + 1).toString().padStart(4, "0");
        return `${prefix || "Vishaka"}2026-${padded}`;
    };

    const handleAddParticipant = async (data: any) => {
        setIsSaving(true);
        try {
            const customId = generateParticipantId();
            const eventName = currentEvent ? currentEvent.title : "Vishaka 2026";
            const { participantsTable } = getEventTableNames(eventName);

            const insertPayload = {
                id: customId,
                participant_id: customId,
                participant_name: data.name,
                register_number: data.registerNumber,
                year: data.year,
                department: data.department,
                section: data.section,
                game: data.game || null,
                email: data.email || null,
                mobile: data.mobile || null,
                category: data.category,
                cultural_interest: data.culturalInterest || null,
                status: 'registered',
                event: eventName,
                created_at: new Date().toISOString()
            };

            // Check if dedicated table exists in Supabase right now
            const isDedicatedActive = await checkTableExists(participantsTable);
            let savedToSupabase = false;

            if (isDedicatedActive) {
                const { error: dedErr } = await supabase.from(participantsTable).insert([insertPayload]);
                if (!dedErr) {
                    savedToSupabase = true;
                    setHasDedicatedTable(true);
                } else {
                    console.error("Dedicated table insert error:", dedErr);
                }
            } else {
                // If unified table exists, try inserting
                const hasUnified = await checkTableExists('participants');
                if (hasUnified) {
                    const { error: uniErr } = await supabase.from('participants').insert([insertPayload]);
                    if (!uniErr) savedToSupabase = true;
                }
            }

            // Always save to localStorage as a fail-safe so registration never drops
            const localKey = `local_participants_${currentEvent?.id || 'default'}`;
            try {
                const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
                existing.unshift(insertPayload);
                localStorage.setItem(localKey, JSON.stringify(existing));
            } catch (lsErr) {
                console.warn("localStorage save error:", lsErr);
            }

            // Optimistically add participant to UI state immediately
            const newParticipant: Participant = {
                id: customId,
                participant_id: customId,
                name: data.name,
                participant_name: data.name,
                registerNumber: data.registerNumber,
                year: data.year,
                department: data.department,
                section: data.section,
                game: data.game || "",
                email: data.email || "",
                mobile: data.mobile || "",
                category: data.category,
                culturalInterest: data.culturalInterest || "",
                status: 'registered',
                event: eventName,
                registrationDate: new Date().toLocaleDateString(),
                qrValue: `${baseUrl}/p/${customId}`
            };

            setParticipants(prev => [newParticipant, ...prev]);
            setShowAddModal(false);

            if (savedToSupabase) {
                alert(`✅ Participant added & synced to database: ${customId}`);
            } else {
                alert(`✅ Participant added with ID: ${customId}!\n\nSaved in Command Center! (Note: Supabase table "${participantsTable}" has not been created yet. Open the TABLES modal to generate and run the SQL script).`);
            }

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
        if (!confirm(`Are you sure you want to delete participant: ${participantId}?`)) return;
        try {
            const { participantsTable } = getEventTableNames(currentEvent?.title || "");
            const isDedicatedActive = await checkTableExists(participantsTable);
            if (isDedicatedActive) {
                await supabase.from(participantsTable).delete().eq('participant_id', participantId);
            }
            const hasUnified = await checkTableExists('participants');
            if (hasUnified) {
                await supabase.from('participants').delete().eq('participant_id', participantId);
            }

            // Remove from local storage
            const localKey = `local_participants_${currentEvent?.id || 'default'}`;
            try {
                const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
                const filtered = existing.filter((p: any) => p.participant_id !== participantId && p.id !== participantId);
                localStorage.setItem(localKey, JSON.stringify(filtered));
            } catch (e) {}

            setParticipants(prev => prev.filter(p => p.participant_id !== participantId));
        } catch (error) {
            alert("Deletion failed.");
        }
    };

    const handleResetDay = async () => {
        if (!currentEvent) return;
        if (!confirm(`Reset check-in status for all participants in "${currentEvent.title}" back to 'registered'?`)) return;

        setIsSaving(true);
        try {
            const isAll = currentEvent.id === "all";
            const { participantsTable } = getEventTableNames(currentEvent.title);
            const targetTable = (hasDedicatedTable && !isAll) ? participantsTable : 'participants';
            
            let query = supabase.from(targetTable).update({ status: 'registered' }).neq('status', 'registered');
            
            if (!isAll && targetTable === 'participants') {
                query = query.or(`event.ilike.%${currentEvent.code}%,event.ilike.%${currentEvent.title}%`);
            }

            const { error } = await query;
            if (error) throw error;

            alert("Attendance successfully reset for this event.");
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

    // CSV Handling
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
                if (["name", "participant_name", "student_name", "full_name"].some(k => h.includes(k))) {
                    row["name"] = val;
                }
                if (["id", "reg_no", "regno", "register_no", "register_number", "roll_no"].some(k => h.includes(k))) {
                    row["register_number"] = val;
                }
                if (h.includes("year")) row["year"] = val;
                if (h.includes("dept") || h.includes("branch")) row["department"] = val;
                if (h.includes("sec") || h.includes("section")) row["section"] = val;
                if (h.includes("category")) row["category"] = val;
                if (h.includes("cultur")) row["culturals"] = val;
                if (h.includes("game") || h.includes("sport")) row["game"] = val;
                if (h.includes("mobile") || h.includes("phone")) row["mobile"] = val;
                if (h.includes("email") || h.includes("mail")) row["email"] = val;

                if (!detectedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) detectedEmail = val.trim();
                if (!detectedMobile && /^[6-9]\d{9}$/.test(val.replace(/[\s+-]/g, ""))) detectedMobile = val.trim();
            });

            const parsedName = row["name"] || "";
            const parsedReg = row["register_number"] || "";
            const errors: string[] = [];
            if (!parsedName) errors.push("Missing: Name");
            if (!parsedReg) errors.push("Missing: Register Number");

            rows.push({
                name: parsedName,
                register_number: parsedReg,
                year: row["year"] || "1",
                department: row["department"] || "CSE",
                section: row["section"] || "A",
                category: row["category"] || (currentEvent?.category || "General"),
                culturals: row["culturals"] || "",
                game: row["game"] || "",
                email: row["email"] || detectedEmail,
                mobile: row["mobile"] || detectedMobile,
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
            setCsvRows(parseCsv(text));
        };
        reader.readAsText(file);
    };

    const handleCsvDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleCsvFile(file);
    }, []);

    const handleBulkImport = async () => {
        const validRows = csvRows.filter(r => !r._error);
        if (!validRows.length || !currentEvent) return;

        setCsvImporting(true);
        setCsvProgress(0);
        setCsvErrors([]);

        const prefix = currentEvent.code.replace(/[^A-Za-z0-9]/g, '');
        const { participantsTable } = getEventTableNames(currentEvent.title);
        const targetTable = (hasDedicatedTable && currentEvent.id !== 'all') ? participantsTable : 'participants';

        const { data: allIds } = await supabase.from(targetTable).select("participant_id");

        let maxCount = 0;
        (allIds || []).forEach((p: { participant_id: string }) => {
            const m = p.participant_id?.match(/(\d+)/);
            if (m) maxCount = Math.max(maxCount, parseInt(m[1], 10));
        });

        const errors: string[] = [];
        for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i];
            maxCount++;
            const padded = maxCount.toString().padStart(4, "0");
            const customId = `${prefix || "Vishaka"}2026-${padded}`;

            const insertPayload = {
                id: customId,
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
                event: currentEvent.title,
                status: "registered",
            };

            let { error } = await supabase.from(targetTable).insert([insertPayload]);
            if (error && targetTable !== 'participants') {
                const fb = await supabase.from('participants').insert([insertPayload]);
                error = fb.error;
            }
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

    const downloadQR = (id?: string, name?: string) => {
        const validId = id || "unknown";
        const validName = name || "participant";
        const canvas = document.getElementById(`qr-${validId}`) as HTMLCanvasElement;
        if (canvas) {
            const url = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = url;
            link.download = `PASS-${currentEvent?.code || 'EVENT'}-${validName.replace(/\s+/g, "-")}.png`;
            link.click();
        }
    };

    const filteredParticipants = participants
        .filter(p => {
            if (statusFilter !== 'all' && p.status !== statusFilter) return false;
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (
                p.participant_name?.toLowerCase().includes(term) ||
                p.registerNumber?.toLowerCase().includes(term) ||
                p.participant_id?.toLowerCase().includes(term) ||
                p.department?.toLowerCase().includes(term) ||
                p.game?.toLowerCase().includes(term) ||
                p.category?.toLowerCase().includes(term)
            );
        });

    const totalReg = participants.length;
    const checkedInCount = participants.filter(p => p.status === 'checked-in').length;
    const activitiesCount = participants.filter(p => p.game || p.culturalInterest || p.category !== 'General').length;
    const pendingCount = participants.filter(p => p.status === 'registered').length;
    const capacityLimit = currentEvent?.maxCapacity || 300;
    const capacityPct = Math.min(100, Math.round((totalReg / capacityLimit) * 100));

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

            <div className="max-w-7xl mx-auto px-4 md:px-6 pt-24 md:pt-28">
                
                {/* Back to Events Navigation Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <Link 
                        href="/admin"
                        className="inline-flex items-center gap-2.5 text-xs font-black tracking-widest text-white/50 hover:text-amber-400 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-amber-500/30 px-4 py-2.5 rounded-full transition-all uppercase no-underline shadow-lg group"
                    >
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform text-amber-500" />
                        <span>All Events Dashboard</span>
                    </Link>

                    {/* Quick Event Switcher Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowEventDropdown(!showEventDropdown)}
                            className="flex items-center gap-3 bg-[#0d0d10] border border-white/10 hover:border-amber-500/40 px-4 py-2 rounded-xl text-xs font-black tracking-wider text-white transition-all shadow-xl"
                        >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentEvent?.colorTheme || '#f59e0b' }} />
                            <span className="text-white/40 uppercase text-[10px]">Switch Event:</span>
                            <span className="text-amber-400 truncate max-w-[200px]">{currentEvent?.title || "Loading..."}</span>
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
                                        Select Target Event
                                    </div>
                                    <div className="max-h-60 overflow-y-auto py-1 space-y-1">
                                        {allEvents.map((evt) => (
                                            <button
                                                key={evt.id}
                                                onClick={() => {
                                                    setShowEventDropdown(false);
                                                    router.push(`/admin/events/${evt.id}`);
                                                }}
                                                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group ${
                                                    evt.id === currentEvent?.id 
                                                        ? 'bg-amber-500 text-black font-black' 
                                                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                                                }`}
                                            >
                                                <div className="truncate">
                                                    <div className="truncate">{evt.title}</div>
                                                    <div className={`text-[9px] uppercase tracking-wider ${evt.id === currentEvent?.id ? 'text-black/70' : 'text-white/30'}`}>
                                                        {evt.code} • {evt.category}
                                                    </div>
                                                </div>
                                                {evt.id === currentEvent?.id && <Check size={14} />}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Event Context Header */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass bg-[#0d0d10]/80 border border-white/10 rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden shadow-2xl"
                >
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-80" />
                    
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    {currentEvent?.category || "Symposium"} Event
                                </span>
                                <span className="font-mono text-[10px] font-black px-2.5 py-1 rounded-full bg-white/5 text-white/50 border border-white/10 uppercase tracking-widest">
                                    CODE: {currentEvent?.code || "VISHAKA"}
                                </span>
                                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    {currentEvent?.status || "Active"}
                                </span>
                                {currentEvent && currentEvent.id !== 'all' && (
                                    <button
                                        onClick={() => setShowTablesModal(true)}
                                        className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                                            hasDedicatedTable
                                                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30 hover:bg-purple-500/20'
                                                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                                        }`}
                                        title="Click to view or design dedicated schema for this event"
                                    >
                                        <Database size={11} className={hasDedicatedTable ? "text-purple-400" : "text-amber-400"} />
                                        <span>{hasDedicatedTable ? 'Dedicated DB Active' : 'Configure Schema'}</span>
                                    </button>
                                )}
                            </div>

                            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white uppercase tracking-tight leading-tight">
                                {currentEvent?.title || "Command Center"}<span className="text-amber-500">.</span>
                            </h1>

                            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-white/40">
                                {currentEvent?.venue && (
                                    <span className="flex items-center gap-1.5">
                                        <MapPin size={13} className="text-amber-500" /> {currentEvent.venue}
                                    </span>
                                )}
                                {currentEvent?.date && (
                                    <span className="flex items-center gap-1.5">
                                        <Calendar size={13} className="text-amber-500" /> {currentEvent.date} {currentEvent.time ? `(${currentEvent.time})` : ''}
                                    </span>
                                )}
                                <span className="text-white/20">•</span>
                                <span className="text-amber-400/80">
                                    Capacity: <strong className="text-white">{totalReg}</strong> / {capacityLimit} ({capacityPct}%)
                                </span>
                            </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2.5 md:gap-3 w-full lg:w-auto">
                            {currentEvent && currentEvent.id !== 'all' && (
                                <button 
                                    onClick={() => setShowTablesModal(true)} 
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#141416] border border-purple-500/30 hover:border-purple-400/60 transition-all px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] text-purple-300 hover:text-white cursor-pointer shadow-lg shadow-purple-950/20"
                                >
                                    <Database className="w-3.5 h-3.5 text-purple-400" /> TABLES
                                </button>
                            )}

                            <Link 
                                href={`/admin/scan?event=${encodeURIComponent(currentEvent?.code || '')}`}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#141416] border border-white/10 hover:border-amber-500/40 transition-all px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] text-white/70 hover:text-white"
                            >
                                <ScanLine className="w-3.5 h-3.5 text-amber-500" /> SCANNER
                            </Link>

                            <Link 
                                href={`/admin/broadcast?event=${encodeURIComponent(currentEvent?.title || '')}`}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#141416] border border-white/10 hover:border-amber-500/40 transition-all px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] text-white/70 hover:text-white"
                            >
                                <Mail className="w-3.5 h-3.5 text-amber-500" /> BROADCAST
                            </Link>

                            <button 
                                onClick={handleResetDay} 
                                disabled={isSaving} 
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#141416] border border-white/10 hover:border-red-500/40 transition-all px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] text-red-400/80 hover:text-red-400 disabled:opacity-50 cursor-pointer"
                            >
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" /> : <RefreshCw className="w-3.5 h-3.5 text-red-500" />} RESET ATTENDANCE
                            </button>

                            <button 
                                onClick={() => setShowCsvModal(true)} 
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#141416] border border-white/10 hover:border-amber-500/40 transition-all px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] text-white/70 hover:text-white cursor-pointer"
                            >
                                <Upload className="w-3.5 h-3.5 text-amber-500" /> IMPORT CSV
                            </button>

                            <button 
                                onClick={() => setShowAddModal(true)} 
                                className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.25em] hover:brightness-110 transition-all shadow-xl shadow-amber-500/20 active:scale-95 cursor-pointer"
                            >
                                <Plus className="w-4 h-4" strokeWidth={3} /> REGISTER NEW
                            </button>
                        </div>
                    </div>
                </motion.header>

                {/* Dashboard Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8"
                >
                    <div className="bg-[#0a0a0c] border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />
                        <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                            <div className="flex items-center justify-between">
                                <Users size={20} className="text-white/20 group-hover:text-amber-500 transition-colors" />
                                <span className="text-[9px] font-black uppercase text-amber-500 tracking-[0.2em] bg-amber-500/10 px-2 py-1 rounded-md">Total</span>
                            </div>
                            <div>
                                <h3 className="text-3xl md:text-5xl font-black text-white tracking-tighter leading-none mb-1">
                                    {loading ? <Loader2 className="w-8 h-8 animate-spin text-amber-500" /> : totalReg}
                                </h3>
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">EVENT REGISTRATIONS</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#0a0a0c] border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors" />
                        <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                            <div className="flex items-center justify-between">
                                <ShieldCheck size={20} className="text-white/20 group-hover:text-emerald-500 transition-colors" />
                                <span className="text-[9px] font-black uppercase text-emerald-400 tracking-[0.2em] bg-emerald-400/10 px-2 py-1 rounded-md">Present</span>
                            </div>
                            <div>
                                <h3 className="text-3xl md:text-5xl font-black text-white tracking-tighter leading-none mb-1">
                                    {loading ? <Loader2 className="w-8 h-8 animate-spin text-emerald-500" /> : checkedInCount}
                                </h3>
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">CHECKED IN TODAY</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#0a0a0c] border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors" />
                        <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                            <div className="flex items-center justify-between">
                                <Tag size={20} className="text-white/20 group-hover:text-blue-500 transition-colors" />
                                <span className="text-[9px] font-black uppercase text-blue-400 tracking-[0.2em] bg-blue-400/10 px-2 py-1 rounded-md">Activities</span>
                            </div>
                            <div>
                                <h3 className="text-3xl md:text-5xl font-black text-white tracking-tighter leading-none mb-1">
                                    {loading ? <Loader2 className="w-8 h-8 animate-spin text-blue-500" /> : activitiesCount}
                                </h3>
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">TRACKS & CATEGORIES</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#0a0a0c] border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl group-hover:bg-purple-500/10 transition-colors" />
                        <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                            <div className="flex items-center justify-between">
                                <QrCode size={20} className="text-white/20 group-hover:text-purple-500 transition-colors" />
                                <span className="text-[9px] font-black uppercase text-purple-400 tracking-[0.2em] bg-purple-400/10 px-2 py-1 rounded-md">Pending</span>
                            </div>
                            <div>
                                <h3 className="text-3xl md:text-5xl font-black text-white tracking-tighter leading-none mb-1">
                                    {loading ? <Loader2 className="w-8 h-8 animate-spin text-purple-500" /> : pendingCount}
                                </h3>
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">AWAITING ENTRY</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Search, Filter & Participants Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="bg-[#0a0a0c] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl mb-12"
                >
                    {/* Controls Bar */}
                    <div className="p-6 md:p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                            <input
                                type="text"
                                placeholder="Search by name, reg no, department..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold text-white placeholder:text-white/20 outline-none focus:border-amber-500/40 transition-colors"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-wider">
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === 'all' ? 'bg-amber-500 text-black' : 'text-white/40 hover:text-white'}`}
                                >
                                    All ({participants.length})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('checked-in')}
                                    className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === 'checked-in' ? 'bg-emerald-500 text-black' : 'text-white/40 hover:text-white'}`}
                                >
                                    Checked In ({checkedInCount})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('registered')}
                                    className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === 'registered' ? 'bg-amber-500/20 text-amber-400' : 'text-white/40 hover:text-white'}`}
                                >
                                    Pending ({pendingCount})
                                </button>
                            </div>

                            <button
                                onClick={fetchParticipants}
                                className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-colors"
                                title="Refresh participants"
                            >
                                <RefreshCw size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Table / List */}
                    {loading ? (
                        <div className="py-24 flex flex-col items-center justify-center gap-4 text-white/30">
                            <Loader2 size={32} className="animate-spin text-amber-500" />
                            <p className="text-xs uppercase tracking-widest font-black">Syncing event records...</p>
                        </div>
                    ) : filteredParticipants.length === 0 ? (
                        <div className="py-24 text-center px-4">
                            <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto mb-4 text-white/20">
                                <Users size={28} />
                            </div>
                            <h3 className="text-white font-black text-base uppercase tracking-wider mb-1">No Participants Registered Yet</h3>
                            <p className="text-white/30 text-xs max-w-sm mx-auto mb-6">
                                Start adding attendees for {currentEvent?.title || "this event"} or import a batch CSV file.
                            </p>
                            <div className="flex justify-center gap-3">
                                <button 
                                    onClick={() => setShowAddModal(true)}
                                    className="bg-amber-500 text-black px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-amber-400 transition-colors"
                                >
                                    + Add Participant
                                </button>
                                <button 
                                    onClick={() => setShowCsvModal(true)}
                                    className="bg-white/5 border border-white/10 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-white/10 transition-colors"
                                >
                                    Import CSV
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/[0.02] border-b border-white/5 font-outfit text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                                        <th className="px-8 py-5">TAG / ID</th>
                                        <th className="px-8 py-5">DELEGATE NAME</th>
                                        <th className="px-8 py-5">ACADEMIC INFO</th>
                                        <th className="px-8 py-5">CATEGORY / TRACK</th>
                                        <th className="px-8 py-5 text-center">QR PASS</th>
                                        <th className="px-8 py-5 text-right">ACTIONS</th>
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
                                            className="group hover:bg-white/[0.015] transition-colors"
                                        >
                                            <td className="px-8 py-5">
                                                <span className="font-mono text-[11px] font-black text-amber-500/80 tracking-widest bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/10 whitespace-nowrap">
                                                    {p.participant_id}
                                                </span>
                                            </td>

                                            <td className="px-8 py-5">
                                                <div className="font-black text-sm text-white tracking-wider uppercase mb-0.5">{p.participant_name}</div>
                                                <div className="text-[10px] text-white/30 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                                    <Building size={11} className="text-amber-500/60" /> {p.registerNumber}
                                                </div>
                                            </td>

                                            <td className="px-8 py-5">
                                                <div className="text-[11px] font-black text-white/60 tracking-wider uppercase mb-1">
                                                    {p.department} (Year {p.year}, Sec {p.section})
                                                </div>
                                                <div className="inline-flex items-center gap-1.5 text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-full border whitespace-nowrap" style={{ color: getStatusColor(p.status), borderColor: `${getStatusColor(p.status)}40`, backgroundColor: `${getStatusColor(p.status)}10` }}>
                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getStatusColor(p.status) }} />
                                                    {p.status}
                                                </div>
                                            </td>

                                            <td className="px-8 py-5">
                                                <div className="text-xs font-bold text-white/70">
                                                    {p.game || p.culturalInterest || p.category || "General"}
                                                </div>
                                                <div className="text-[9px] text-white/30 uppercase tracking-widest">
                                                    {p.category}
                                                </div>
                                            </td>

                                            <td className="px-8 py-5 text-center">
                                                <div
                                                    className="inline-block bg-white p-1.5 rounded-lg cursor-pointer hover:scale-105 transition-transform shadow-lg"
                                                    onClick={() => setSelectedParticipant(p)}
                                                    title="Click to expand pass"
                                                >
                                                    <QRCodeCanvas
                                                        id={`qr-${p.participant_id}`}
                                                        value={p.qrValue}
                                                        size={44}
                                                        level="H"
                                                    />
                                                </div>
                                            </td>

                                            <td className="px-8 py-5">
                                                <div className="flex justify-end items-center gap-2">
                                                    <button
                                                        onClick={() => downloadQR(p.participant_id, p.participant_name)}
                                                        className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-amber-500 hover:text-black transition-all rounded-xl text-white/30 cursor-pointer"
                                                        title="Download pass image"
                                                    >
                                                        <Download size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteParticipant(p.participant_id)}
                                                        className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-red-500 transition-all rounded-xl text-white/30 hover:text-white cursor-pointer"
                                                        title="Delete participant"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* CSV Import Modal */}
            <AnimatePresence>
                {showCsvModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/95 backdrop-blur-xl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-[#0c0c0e] border border-white/10 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
                        >
                            <div className="p-8 border-b border-white/5 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black tracking-[0.3em] text-amber-500 uppercase mb-1">
                                        Data Ingestion for {currentEvent?.code}
                                    </p>
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Import CSV Participants</h2>
                                </div>
                                <button onClick={resetCsvModal} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-white/50 hover:text-white">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-8 flex-1 overflow-y-auto space-y-6">
                                {!csvRows.length && !csvDone && (
                                    <div
                                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={handleCsvDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all ${
                                            isDragging ? 'border-amber-500 bg-amber-500/10' : 'border-white/10 hover:border-amber-500/40 bg-white/[0.01]'
                                        }`}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            onChange={(e) => { if (e.target.files?.[0]) handleCsvFile(e.target.files[0]); }}
                                        />
                                        <Upload size={36} className="mx-auto mb-4 text-amber-500" />
                                        <p className="text-white font-bold text-sm mb-1 uppercase tracking-wider">Drag & drop CSV file or click to browse</p>
                                        <p className="text-white/30 text-xs uppercase tracking-widest">Columns: name, register_number, year, department, section, game, mobile, email</p>
                                    </div>
                                )}

                                {csvRows.length > 0 && !csvDone && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-white/60">{csvFileName} ({csvRows.length} rows detected)</span>
                                            <button onClick={() => setCsvRows([])} className="text-xs text-red-400 hover:underline">Clear</button>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto rounded-xl border border-white/5">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-[#141416] text-white/30 text-[9px] uppercase tracking-wider">
                                                    <tr>
                                                        <th className="p-3">#</th>
                                                        <th className="p-3">Name</th>
                                                        <th className="p-3">Reg No</th>
                                                        <th className="p-3">Dept</th>
                                                        <th className="p-3">Year</th>
                                                        <th className="p-3">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {csvRows.slice(0, 50).map((r, i) => (
                                                        <tr key={i} className="hover:bg-white/[0.02]">
                                                            <td className="p-3 text-white/30">{i + 1}</td>
                                                            <td className="p-3 font-bold text-white">{r.name}</td>
                                                            <td className="p-3 text-amber-400">{r.register_number}</td>
                                                            <td className="p-3 text-white/60">{r.department}</td>
                                                            <td className="p-3 text-white/60">{r.year}</td>
                                                            <td className="p-3">{r._error ? <span className="text-red-400">{r._error}</span> : <span className="text-emerald-400">✓ Valid</span>}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {csvImporting && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold">
                                            <span className="text-white/50">Importing records into {currentEvent?.code}...</span>
                                            <span className="text-amber-400">{csvProgress}%</span>
                                        </div>
                                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${csvProgress}%` }} />
                                        </div>
                                    </div>
                                )}

                                {csvDone && (
                                    <div className="text-center py-6">
                                        <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-3" />
                                        <h3 className="text-white font-bold text-lg mb-1">Import Complete!</h3>
                                        <p className="text-white/40 text-xs">Records have been assigned to {currentEvent?.title}.</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t border-white/5 flex gap-3">
                                {!csvDone ? (
                                    <>
                                        <button onClick={resetCsvModal} className="flex-1 py-3 rounded-xl bg-white/5 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider">Cancel</button>
                                        <button
                                            onClick={handleBulkImport}
                                            disabled={csvImporting || csvRows.length === 0}
                                            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider disabled:opacity-40"
                                        >
                                            {csvImporting ? "Importing..." : `Import ${csvRows.filter(r => !r._error).length} Participants`}
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={resetCsvModal} className="w-full py-3 rounded-xl bg-white text-black font-black uppercase tracking-wider text-xs">Close</button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Add Participant Modal */}
            <AddParticipantModal
                isOpen={showAddModal}
                eventName={currentEvent?.title || "Vishaka 2026"}
                onClose={() => setShowAddModal(false)}
                onAdd={handleAddParticipant}
            />

            {/* Event Dedicated Tables Modal */}
            {currentEvent && (
                <EventTablesModal
                    isOpen={showTablesModal}
                    event={currentEvent}
                    onClose={() => setShowTablesModal(false)}
                    onTablesCreated={() => {
                        setHasDedicatedTable(true);
                        fetchParticipants();
                    }}
                />
            )}

            {/* Big Identity QR Pass Modal */}
            <AnimatePresence>
                {selectedParticipant && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/95 backdrop-blur-3xl" onClick={() => setSelectedParticipant(null)}>
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }} className="bg-white rounded-[3rem] w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl relative" onClick={e => e.stopPropagation()}>
                            <div className="p-8 md:p-12">
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.4em] mb-2">{currentEvent?.code || "VISHAKA 2K26"}</p>
                                        <h3 className="text-black text-3xl font-black leading-tight uppercase tracking-tight">{selectedParticipant.name}</h3>
                                        <p className="text-black/40 font-bold uppercase text-xs mt-1">{selectedParticipant.registerNumber}</p>
                                    </div>
                                    <X onClick={() => setSelectedParticipant(null)} className="text-black/30 hover:text-black cursor-pointer" size={22} />
                                </div>

                                <div className="bg-[#f5f5f7] p-8 rounded-3xl mb-8 flex flex-col items-center justify-center border border-black/5 shadow-inner">
                                    <QRCodeCanvas id={`qr-big-${selectedParticipant.id}`} value={selectedParticipant.qrValue} size={220} level="H" />
                                    <div className="mt-6 flex flex-col items-center">
                                        <p className="text-black font-mono text-xs font-black tracking-widest bg-black/5 px-4 py-1.5 rounded-full uppercase">
                                            ID: {selectedParticipant.participant_id}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8 text-xs">
                                    <div>
                                        <p className="text-[9px] font-black text-black/30 uppercase tracking-widest mb-1">Department</p>
                                        <p className="text-black font-bold uppercase">{selectedParticipant.department} (Yr {selectedParticipant.year})</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-black/30 uppercase tracking-widest mb-1">Status</p>
                                        <p className="font-black uppercase" style={{ color: getStatusColor(selectedParticipant.status) }}>
                                            {selectedParticipant.status}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => downloadQR(`qr-big-${selectedParticipant.id}`, selectedParticipant.name)}
                                    className="w-full bg-black text-white py-4 rounded-2xl font-black uppercase tracking-[0.25em] text-xs hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center gap-2 shadow-xl"
                                >
                                    <Download size={16} /> DOWNLOAD PASS
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

interface AddParticipantModalProps {
    isOpen: boolean;
    eventName: string;
    onClose: () => void;
    onAdd: (data: any) => Promise<void>;
}

function AddParticipantModal({ isOpen, eventName, onClose, onAdd }: AddParticipantModalProps) {
    const [formData, setFormData] = useState({
        name: "",
        registerNumber: "",
        year: "1",
        department: "CSE",
        section: "A",
        game: "",
        email: "",
        mobile: "",
        category: "General",
        culturalInterest: "",
    });
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onAdd(formData);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/95 backdrop-blur-xl">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-[#0c0c0e] border border-white/10 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] font-black tracking-[0.3em] text-amber-500 uppercase mb-1">New Participant for {eventName}</p>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Manual Registration</h2>
                    </div>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl text-white/50 hover:text-white"><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Full Name *</label>
                                <input required className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white" placeholder="Student Name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Register Number *</label>
                                <input required className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white" placeholder="e.g. 2200030111" value={formData.registerNumber} onChange={(e) => setFormData(prev => ({ ...prev, registerNumber: e.target.value }))} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Year *</label>
                                <select className="w-full bg-[#111] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white" value={formData.year} onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}>
                                    <option value="1">1st Year</option>
                                    <option value="2">2nd Year</option>
                                    <option value="3">3rd Year</option>
                                    <option value="4">4th Year</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Department *</label>
                                <input required className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white" placeholder="CSE / ECE / MECH..." value={formData.department} onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Section *</label>
                                <input required className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white" placeholder="Section (e.g. A, B)" value={formData.section} onChange={(e) => setFormData(prev => ({ ...prev, section: e.target.value }))} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Category</label>
                                <select className="w-full bg-[#111] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white" value={formData.category} onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}>
                                    <option value="General">General / Delegate</option>
                                    <option value="Technical">Technical</option>
                                    <option value="Games">Games / Esports</option>
                                    <option value="Culturals">Culturals</option>
                                    <option value="Workshop">Workshop</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Email (Optional)</label>
                                <input type="email" className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white" placeholder="email@klu.ac.in" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Mobile (Optional)</label>
                                <input type="tel" className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500 text-xs font-bold text-white" placeholder="Phone Number" value={formData.mobile} onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))} />
                            </div>
                        </div>

                        <button type="submit" disabled={isSaving} className="w-full bg-amber-500 hover:bg-amber-400 text-black py-4 rounded-xl font-black uppercase tracking-[0.25em] text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl cursor-pointer">
                            {isSaving ? <Loader2 className="animate-spin" size={16} /> : <>CONFIRM REGISTRATION <ChevronRight size={16} strokeWidth={3} /></>}
                        </button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
