"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { Plus, Trash2, User, Download, Search, Loader2, Wifi, Building, Users, ShieldCheck, QrCode, Mail, ScanLine, LogOut, LayoutDashboard, ChevronRight, X } from "lucide-react";
import { Participant } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function AdminPage() {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [baseUrl, setBaseUrl] = useState("");
    const router = useRouter();

    const [newParticipant, setNewParticipant] = useState({
        name: "",
        email: "",
        college: "",
        team: "",
        event: "Vishaka Event 2026",
    });

    useEffect(() => {
        const isAdmin = localStorage.getItem("vishaka_admin_session");
        if (isAdmin !== "true") {
            router.push("/login");
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
                qrValue: `${baseUrl}/p/${p.id}`
            })));
        }
    }, [baseUrl]);

    async function fetchParticipants() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('participants')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedData: Participant[] = (data || []).map(item => ({
                id: item.id,
                name: item.name,
                email: item.email,
                college: item.college,
                team: item.team,
                status: item.status,
                event: item.event,
                registrationDate: new Date(item.created_at).toLocaleDateString(),
                qrValue: `${baseUrl}/p/${item.id}`
            }));

            setParticipants(mappedData);
        } catch (error) {
            console.error('Error fetching participants:', error);
        } finally {
            setLoading(false);
        }
    }

    const generateParticipantId = () => {
        const count = participants.length + 1;
        const padded = count.toString().padStart(4, '0');
        return `Vishaka2026-${padded}`;
    };

    const handleAddParticipant = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const customId = generateParticipantId();
            const { data, error } = await supabase
                .from('participants')
                .insert([
                    {
                        id: customId,
                        name: newParticipant.name,
                        email: newParticipant.email,
                        college: newParticipant.college,
                        team: newParticipant.team,
                        event: newParticipant.event,
                        status: 'registered'
                    }
                ])
                .select();

            if (error) throw error;

            if (data) {
                const participant: Participant = {
                    id: data[0].id,
                    name: data[0].name,
                    email: data[0].email,
                    college: data[0].college,
                    team: data[0].team,
                    status: data[0].status,
                    event: data[0].event,
                    registrationDate: new Date(data[0].created_at).toLocaleDateString(),
                    qrValue: `${baseUrl}/p/${data[0].id}`
                };
                setParticipants([participant, ...participants]);

                try {
                    await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: participant.email,
                            subject: `Registration Confirmed - ${participant.event}`,
                            html: `<p>Hi ${participant.name}, your registration for ${participant.event} is confirmed! ID: ${participant.id}</p>`
                        }),
                    });
                } catch (e) {
                    console.error("Auto-email failed:", e);
                }

                setNewParticipant({ name: "", email: "", college: "", team: "", event: "Vishaka Event 2026" });
                setShowAddModal(false);
            }
        } catch (error) {
            console.error('Error adding participant:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteParticipant = async (id: string) => {
        if (!confirm("Confirm system deletion for: " + id)) return;
        try {
            const { error } = await supabase.from('participants').delete().eq('id', id);
            if (error) throw error;
            setParticipants(participants.filter((p) => p.id !== id));
        } catch (error) {
            alert("Deletion failed.");
        }
    };

    const filteredParticipants = participants.filter(
        (p) =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const downloadQR = (id: string, name: string) => {
        const canvas = document.getElementById(`qr-${id}`) as HTMLCanvasElement;
        if (canvas) {
            const url = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = url;
            link.download = `QR-${name.replace(/\s+/g, "-")}.png`;
            link.click();
        }
    };

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
                        <button onClick={() => setShowAddModal(true)} className="w-full md:w-auto flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.3em] hover:bg-amber-500 transition-all shadow-2xl active:scale-95">
                            <Plus className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={3} /> REGISTER NEW
                        </button>
                    </div>
                </motion.header>


                <div className="mb-16">
                    <div className="relative group h-20 md:h-24">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/10 group-focus-within:text-amber-500 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="SEARCH BY IDENTITY TAG OR NAME"
                            className="w-full h-full bg-white/[0.02] border border-white/5 rounded-3xl md:rounded-[2rem] py-6 md:py-8 pl-14 md:pl-16 pr-6 md:pr-8 focus:outline-none focus:border-amber-500/30 transition-all font-outfit text-[10px] md:text-xs font-black tracking-[0.2em] md:tracking-[0.3em] uppercase placeholder:text-white/10"
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
                                    <div key={p.id} className="p-6 space-y-6 bg-white/[0.01]">
                                        <div className="flex justify-between items-start">
                                            <span className="font-mono text-[9px] font-black text-amber-500/80 tracking-widest bg-amber-500/5 px-2.5 py-1 rounded-md border border-amber-500/10">
                                                {p.id}
                                            </span>
                                            <div className="flex gap-2">
                                                <button onClick={() => downloadQR(p.id, p.name)} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-lg text-white/20">
                                                    <Download size={14} />
                                                </button>
                                                <button onClick={() => deleteParticipant(p.id)} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-lg text-white/20">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <div onClick={() => setSelectedParticipant(p)}>
                                            <div className="font-black text-sm text-white tracking-widest uppercase mb-1">{p.name}</div>
                                            <div className="text-[9px] text-white/30 font-bold uppercase tracking-widest flex items-center gap-2">
                                                <Building size={10} className="text-amber-500/50" /> {p.college}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <div className="inline-flex items-center gap-2 text-[8px] font-black tracking-widest text-[#00ff88]/50 bg-[#00ff88]/5 px-2.5 py-1 rounded-full border border-[#00ff88]/10">
                                                <div className="w-1 h-1 rounded-full bg-[#00ff88]" />
                                                {p.status}
                                            </div>
                                            <div className="text-[9px] font-black text-white/20 tracking-widest uppercase">{p.team}</div>
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
                                            <th className="px-10 py-8">TEAM STATUS</th>
                                            <th className="px-10 py-8 text-center uppercase tracking-[0.2em] text-amber-500/50">SECURED QR PASS</th>
                                            <th className="px-10 py-8 text-right">CONTROLS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.02]">
                                        {filteredParticipants.map((p, i) => (
                                            <motion.tr
                                                key={p.id}
                                                variants={fadin}
                                                initial="hidden"
                                                animate="visible"
                                                custom={i}
                                                className="group hover:bg-white/[0.01] transition-colors"
                                            >
                                                <td className="px-10 py-8">
                                                    <span className="font-mono text-[11px] font-black text-amber-500/80 tracking-widest bg-amber-500/5 px-3 py-1.5 rounded-lg border border-amber-500/10">
                                                        {p.id}
                                                    </span>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <div className="font-black text-sm text-white tracking-widest uppercase mb-1">{p.name}</div>
                                                    <div className="text-[10px] text-white/30 font-bold uppercase tracking-[0.1em] flex items-center gap-2">
                                                        <Building size={10} className="text-amber-500/50" /> {p.college}
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <div className="text-[11px] font-black text-white/50 tracking-widest uppercase mb-2 group-hover:text-white transition-colors">{p.team}</div>
                                                    <div className="inline-flex items-center gap-2 lowercase text-[10px] font-black tracking-widest text-[#00ff88]/50 bg-[#00ff88]/5 px-3 py-1 rounded-full border border-[#00ff88]/10 whitespace-nowrap">
                                                        <div className="w-1 h-1 rounded-full bg-[#00ff88] shadow-[0_0_5px_#00ff88]" />
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
                                                                id={`qr-${p.id}`}
                                                                value={p.qrValue}
                                                                size={56}
                                                                level="H"
                                                            />
                                                        </div>
                                                    </motion.div>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <div className="flex justify-end items-center gap-3">
                                                        <button onClick={() => downloadQR(p.id, p.name)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-amber-500 hover:text-black transition-all rounded-xl text-white/20">
                                                            <Download size={16} />
                                                        </button>
                                                        <button onClick={() => deleteParticipant(p.id)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-red-500 transition-all rounded-xl text-white/20">
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


            {/* Modals & Overlays */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl">
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                            <div className="p-10 md:p-14 border-b border-white/5 flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] font-black tracking-[0.4em] text-amber-500 uppercase mb-2">Initialize System Record</p>
                                    <h2 className="text-3xl font-black text-white leading-none uppercase tracking-tighter">Registration.</h2>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl hover:bg-white/10 transition-colors text-white/50 hover:text-white border border-white/5"><X size={24} /></button>
                            </div>
                            <form onSubmit={handleAddParticipant} className="p-10 md:p-14 space-y-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Full Identity</label>
                                        <input required className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-5 px-6 outline-none focus:border-amber-500/30 text-xs font-black tracking-widest text-white uppercase" placeholder="NAME" value={newParticipant.name} onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Organization</label>
                                        <input required className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-5 px-6 outline-none focus:border-amber-500/30 text-xs font-black tracking-widest text-white uppercase" placeholder="COLLEGE" value={newParticipant.college} onChange={(e) => setNewParticipant({ ...newParticipant, college: e.target.value })} />
                                    </div>
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Contact Node</label>
                                        <input required type="email" className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-5 px-6 outline-none focus:border-amber-500/30 text-xs font-black tracking-widest text-white uppercase" placeholder="EMAIL ADDRESS" value={newParticipant.email} onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })} />
                                    </div>
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Team Identity</label>
                                        <input required className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-5 px-6 outline-none focus:border-amber-500/30 text-xs font-black tracking-widest text-white uppercase" placeholder="SQUAD NAME" value={newParticipant.team} onChange={(e) => setNewParticipant({ ...newParticipant, team: e.target.value })} />
                                    </div>
                                </div>
                                <button type="submit" disabled={isSaving} className="w-full bg-white text-black py-6 rounded-xl font-black uppercase tracking-[0.3em] text-[11px] hover:bg-amber-500 transition-all flex items-center justify-center gap-4 shadow-3xl disabled:opacity-50">
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <>FINALIZE ENTRANCE <ChevronRight size={18} strokeWidth={3} /></>}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Big Identity View Overlay */}
            <AnimatePresence>
                {selectedParticipant && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl" onClick={() => setSelectedParticipant(null)}>
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }} className="bg-white rounded-[3rem] p-12 md:p-16 max-w-md w-full shadow-[0_0_100px_rgba(0,0,0,1)] relative" onClick={e => e.stopPropagation()}>
                            <div className="absolute top-0 right-10 h-16 w-1 bg-amber-500" />

                            <div className="flex justify-between items-start mb-16">
                                <div>
                                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-3">System Identity Passport</p>
                                    <h3 className="text-black text-4xl font-black leading-none tracking-tighter uppercase whitespace-pre-wrap">{selectedParticipant.name}</h3>
                                    <p className="text-black/30 font-black uppercase text-[10px] mt-4 tracking-[0.2em]">{selectedParticipant.college}</p>
                                </div>
                                <X onClick={() => setSelectedParticipant(null)} className="text-black/10 hover:text-black cursor-pointer transition-colors" size={24} />
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
                                    <p className="text-[9px] font-black text-black/20 uppercase tracking-widest mb-1">Squad</p>
                                    <p className="text-black font-black text-xs tracking-widest uppercase">{selectedParticipant.team}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-black/20 uppercase tracking-widest mb-1">Authorization</p>
                                    <p className="text-emerald-500 font-black text-xs tracking-widest uppercase italic">ACTIVE_PASS</p>
                                </div>
                            </div>

                            <button
                                onClick={() => downloadQR(`qr-big-${selectedParticipant.id}`, selectedParticipant.id)}
                                className="w-full bg-black text-white py-6 rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center gap-3 shadow-2xl"
                            >
                                <Download size={18} /> DOWNLOAD_AS_IMAGE
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@900&family=Inter:wght@400;700;900&display=swap');
                
                :root {
                    --font-outfit: 'Outfit', sans-serif;
                    --font-inter: 'Inter', sans-serif;
                }
                
                body {
                    background-color: #050505;
                    margin: 0;
                    padding: 0;
                    overflow-x: hidden;
                }

                ::-webkit-scrollbar {
                  width: 4px;
                }
                ::-webkit-scrollbar-track {
                  background: #050505;
                }
                ::-webkit-scrollbar-thumb {
                  background: #1a1a1a;
                  border-radius: 10px;
                }
                ::-webkit-scrollbar-thumb:hover {
                  background: #2a2a2a;
                }
            `}</style>
        </div>
    );
}
