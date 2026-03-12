"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Participant } from "@/lib/types";
import { User, Mail, School, Users, CheckCircle2, ShieldCheck, MapPin, Loader2, ArrowRight, Sparkles, Building, Zap } from "lucide-react";
import { motion, Variants } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function ParticipantProfile() {
    const { id } = useParams();
    const [participant, setParticipant] = useState<Participant | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function getParticipant() {
            try {
                const { data, error } = await supabase
                    .from('participants')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                if (data) {
                    setParticipant({
                        id: data.id,
                        name: data.name,
                        email: data.email,
                        college: data.college,
                        team: data.team,
                        status: data.status,
                        event: data.event,
                        registrationDate: new Date(data.created_at).toLocaleDateString(),
                        qrValue: ""
                    });
                }
            } catch (err) {
                console.error("Error fetching participant:", err);
            } finally {
                setLoading(false);
            }
        }

        if (id) getParticipant();
    }, [id]);

    const fadin: Variants = {
        hidden: { opacity: 0, y: 10 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.1, duration: 0.8, ease: "easeOut" } as any,
        }),
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-8">
                <div className="relative">
                    <div className="w-20 h-20 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <ShieldCheck className="text-amber-500 animate-pulse" size={32} />
                    </div>
                </div>
                <p className="text-amber-500 font-black uppercase tracking-[0.4em] text-[10px]">RECONSTRUCTING_PROFILE</p>
            </div>
        );
    }

    if (!participant) {
        return (
            <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col items-center justify-center p-8 text-center font-outfit">
                <div className="bg-red-500/5 p-10 rounded-[3rem] mb-12 border border-red-500/10">
                    <div className="relative">
                        <ShieldCheck size={72} className="text-red-500" />
                        <div className="absolute inset-0 bg-red-500/20 blur-3xl animate-pulse" />
                    </div>
                </div>
                <h1 className="text-5xl font-black mb-6 tracking-tighter uppercase italic">IDENTITY_NOT_FOUND</h1>
                <p className="text-white/20 max-w-sm text-[10px] font-black uppercase tracking-[0.3em] leading-loose">
                    The security tag credentials scanned do not match any processed identities in the Vishaka 2026 framework.
                </p>
                <Link href="/" className="mt-16 flex items-center gap-4 text-white hover:text-amber-500 font-black uppercase tracking-[0.4em] text-[10px] transition-all group">
                    RETURN_TO_PORTAL <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-outfit selection:bg-amber-500/30 overflow-x-hidden relative pb-32">

            {/* Background Architecture */}
            <div className="fixed inset-0 pointer-events-none opacity-20">
                <div className="absolute top-0 left-[20%] w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                <div className="absolute top-0 right-[20%] w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.05)_0%,transparent_50%)]" />
            </div>

            <div className="relative max-w-2xl mx-auto pt-24 md:pt-32 px-4 md:px-6">

                {/* Status Indicator */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center mb-12 md:mb-16">
                    <div className="bg-amber-500/5 border border-amber-500/20 px-6 md:px-8 py-2.5 md:py-3 rounded-full flex items-center gap-3 text-amber-500 font-black text-[9px] md:text-[10px] uppercase tracking-[0.3em] md:tracking-[0.4em] shadow-2xl">
                        <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5 animate-pulse" /> SYSTEM_TAG_VERIFIED
                    </div>
                </motion.div>

                {/* Identity Passport Card */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} className="bg-[#0a0a0b] border border-white/5 rounded-[3rem] md:rounded-[4rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)] relative">

                    {/* Visual Command Header */}
                    <div className="h-32 md:h-48 bg-white text-black relative p-8 md:p-12 overflow-hidden group">
                        <div className="absolute -right-20 -top-20 w-60 md:w-80 h-60 md:h-80 bg-amber-500/10 rounded-full group-hover:scale-110 transition-transform duration-1000" />
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-black">VISHAKA_PASS</p>
                                <h4 className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-black/20">EVENT_SERIES_26</h4>
                            </div>
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-black flex items-center justify-center rounded-xl text-white">
                                <Zap className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" strokeWidth={0} />
                            </div>
                        </div>

                        <div className="absolute -bottom-12 md:-bottom-16 left-8 md:left-12 group-hover:rotate-6 transition-transform duration-500">
                            <div className="w-24 h-24 md:w-32 md:h-32 bg-[#0a0a0b] p-2 rounded-[2rem] md:rounded-[2.5rem] shadow-3xl border border-white/5">
                                <div className="w-full h-full bg-white/[0.03] rounded-[1.8rem] md:rounded-[2rem] flex items-center justify-center text-amber-500/30">
                                    <User className="w-10 h-10 md:w-14 md:h-14" strokeWidth={1} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-20 md:pt-24 pb-12 md:pb-16 px-8 md:px-16">
                        <div className="mb-10 md:mb-14">
                            <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 text-white uppercase leading-none">{participant.name}</h1>
                            <div className="flex items-center gap-3 text-amber-500/80">
                                <Building className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                <p className="font-black uppercase text-[9px] md:text-[10px] tracking-[0.2em] md:tracking-[0.3em]">{participant.college}</p>
                            </div>
                        </div>

                        {/* Framework Data Grid */}
                        <div className="space-y-6">
                            <div className="bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5 transition-all hover:bg-white/[0.04]">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">Identity_Node_ID</p>
                                    <ShieldCheck size={16} className="text-amber-500/50" />
                                </div>
                                <p className="text-2xl font-mono text-amber-500 font-black tracking-widest">{participant.id}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5">
                                    <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em] mb-4">Tactical_Squad</p>
                                    <div className="flex items-center gap-3">
                                        <Users size={18} className="text-white/20" />
                                        <p className="text-white font-black text-[11px] uppercase tracking-widest">{participant.team}</p>
                                    </div>
                                </div>
                                <div className="bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5">
                                    <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em] mb-4">Current_Status</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                        <p className="text-amber-500 font-black uppercase text-[11px] tracking-widest italic">{participant.status}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5">
                                <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em] mb-4">Relay_Node</p>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/20">
                                        <Mail size={18} />
                                    </div>
                                    <p className="text-xs font-black text-white/50 tracking-widest font-mono uppercase">{participant.email}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer System Details */}
                    <div className="px-12 py-10 bg-[#070707] border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <MapPin size={18} className="text-white/10" />
                            <div>
                                <p className="text-[8px] font-black text-white/10 uppercase tracking-[0.4em] leading-none mb-2">Venue_Authorization</p>
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">Main Hub • CAL-2 REGION</p>
                            </div>
                        </div>
                        <div className="text-center md:text-right">
                            <p className="text-[8px] font-black text-white/10 uppercase tracking-[0.4em] leading-none mb-2">System_Log_Stamp</p>
                            <p className="text-[10px] font-black text-amber-500 tracking-widest uppercase italic">VISHAKA_2026_CORE</p>
                        </div>
                    </div>
                </motion.div>

                {/* Final Interface Interaction */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-16 text-center space-y-10">
                    <p className="text-white/10 text-[9px] font-black uppercase tracking-[0.6em]">System Architecture Finalized • Identity Confirmed</p>
                    <Link href="/" className="inline-flex bg-white text-black px-12 py-6 rounded-2xl font-black uppercase tracking-[0.4em] text-[10px] hover:bg-amber-500 transition-all shadow-3xl active:scale-98">
                        CLOSE_IDENTITY_FILE
                    </Link>
                </motion.div>
            </div>

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
            `}</style>
        </div>
    );
}
