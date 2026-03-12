"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, Camera, User, Building, Users, ScanLine, X, LogIn, LogOut, Sparkles, ChevronRight } from "lucide-react";
import { Participant } from "@/lib/types";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";

export default function QRScannerPage() {
    const [scanMode, setScanMode] = useState<'check-in' | 'check-out'>('check-in');
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [participant, setParticipant] = useState<Participant | null>(null);
    const [lastAction, setLastAction] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCameraStarted, setIsCameraStarted] = useState(false);
    const router = useRouter();
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const isStarting = useRef(false);

    const startScanner = async () => {
        if (isStarting.current || isCameraStarted) return;
        isStarting.current = true;

        try {
            // Ensure any existing instance is cleaned up
            if (scannerRef.current) {
                try {
                    // Check if it's scanning before stopping
                    if (scannerRef.current.isScanning) {
                        await scannerRef.current.stop();
                    }
                } catch (e) {
                    console.warn("Cleanup stop failed:", e);
                }
            } else {
                scannerRef.current = new Html5Qrcode("reader");
            }

            const qrConfig = { 
                fps: 30, 
                qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                    const qrboxSize = Math.floor(minEdge * 0.7);
                    return { width: qrboxSize, height: qrboxSize };
                },
                aspectRatio: 1.0,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                }
            };

            const onScanSuccess = (decodedText: string) => {
                const parts = decodedText.split('/');
                const id = parts[parts.length - 1];
                if (id && id !== scanResult) {
                    setScanResult(id);
                    fetchParticipant(id);
                }
            };

            const onScanFailure = (errorMessage: string) => { };

            try {
                // Primary attempt: Environment camera
                await scannerRef.current.start(
                    { facingMode: "environment" },
                    qrConfig,
                    onScanSuccess,
                    onScanFailure
                );
            } catch (primaryErr: any) {
                console.warn("Primary camera start failed, trying fallback:", primaryErr);
                // Fallback: Just try to start with any available camera
                await scannerRef.current.start(
                    { facingMode: "user" }, // Try user camera if environment is locked or missing
                    qrConfig,
                    onScanSuccess,
                    onScanFailure
                );
            }

            setIsCameraStarted(true);
            setError(null);
        } catch (err: any) {
            const errorMsg = err?.toString() || "";

            // Log unexpected errors
            if (!errorMsg.includes("gesture") && !errorMsg.includes("stop")) {
                console.error("Failed to start scanner:", err);
            }

            setIsCameraStarted(false);

            if (errorMsg.includes("Permission") || errorMsg.includes("NotAllowedError")) {
                setError("CAMERA ACCESS_DENIED. SYSTEM REQUIRES VISUAL LENS PERMISSION.");
            } else if (errorMsg.includes("NotReadableError") || errorMsg.includes("TrackStartError") || errorMsg.includes("Could not start video source")) {
                setError("HARDWARE_LOCKED: THE CAMERA IS BUSY. PLEASE CLOSE OTHER TABS OR REFRESH THE BROWSER.");
            } else if (errorMsg.includes("NotFoundError") || errorMsg.includes("no camera")) {
                setError("HARDWARE_MISSING: NO OPTICAL SENSOR DETECTED ON THIS UNIT.");
            } else {
                setError(`SCANNER_ERROR: ${errorMsg.substring(0, 50)}...`);
            }
        } finally {
            isStarting.current = false;
        }
    };

    useEffect(() => {
        const isAdmin = localStorage.getItem("vishaka_admin_session");
        if (isAdmin !== "true") {
            router.push("/login");
            return;
        }

        startScanner();

        return () => {
            if (scannerRef.current) {
                const scanner = scannerRef.current;
                // Use a non-async cleanup to avoid issues with unmounting
                try {
                    scanner.stop().catch(err => {
                        console.warn("Auto-stop failed on unmount:", err);
                        try { scanner.clear(); } catch (e) { }
                    }).finally(() => {
                        try { scanner.clear(); } catch (e) { }
                    });
                } catch (e) {
                    try { scanner.clear(); } catch (err) { }
                }
            }
        };
    }, []);

    const fetchParticipant = async (id: string) => {
        try {
            setLoading(true);
            setError(null);
            setLastAction(null);

            const { data, error: dbError } = await supabase
                .from('participants')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (dbError || !data) {
                setError("IDENTITY NOT FOUND. INVALID SYSTEM TAG.");
                setParticipant(null);
                return;
            }

            const targetTable = scanMode === 'check-in' ? 'check_in_logs' : 'check_out_logs';
            const { data: historyData } = await supabase
                .from(targetTable)
                .select('*')
                .eq('participant_id', id)
                .order('recorded_at', { ascending: false })
                .limit(1);

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

            if (historyData && historyData.length > 0) {
                setLastAction(historyData[0]);
            }

        } catch (err) {
            setError("SYSTEM_ERROR: DATABASE COMMUNICATION FAILURE.");
        } finally {
            setLoading(false);
        }
    };

    const handleAttendance = async () => {
        if (!participant) return;

        try {
            setIsUpdating(true);
            const targetTable = scanMode === 'check-in' ? 'check_in_logs' : 'check_out_logs';

            if (scanMode === 'check-in') {
                await supabase.from('participants').update({ status: 'checked-in' }).eq('id', participant.id);
            }

            const { data: newLog, error: logError } = await supabase
                .from(targetTable)
                .insert([{
                    participant_id: participant.id,
                    participant_name: participant.name
                }])
                .select()
                .single();

            if (logError) throw logError;

            setLastAction(newLog || { id: 'INTERNAL_AUTH', recorded_at: new Date().toISOString() });

            setTimeout(() => {
                resetScanner();
            }, 2500);
        } catch (err) {
            setError("ACTION_FAILED: DATABASE UPLOAD ERROR.");
        } finally {
            setIsUpdating(false);
        }
    };

    const resetScanner = () => {
        setScanResult(null);
        setParticipant(null);
        setError(null);
        setLastAction(null);
    };

    const fadin: Variants = {
        hidden: { opacity: 0, y: 10 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.1, duration: 0.8, ease: "easeOut" } as any,
        }),
    };

    return (
        <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-outfit selection:bg-amber-500/30 overflow-x-hidden relative">

            {/* Cinematic Overlay Lines */}
            <div className="fixed inset-0 pointer-events-none opacity-20 z-0">
                <div className="absolute top-0 left-[20%] w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                <div className="absolute top-0 right-[20%] w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                <div className={`absolute top-0 left-0 w-full h-[30%] bg-gradient-to-b transition-colors duration-1000 ${scanMode === 'check-in' ? 'from-amber-500/5' : 'from-blue-500/5'} to-transparent`} />
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8 relative z-10 pt-20 md:pt-32 lg:pt-40">
                {/* Header Section */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col lg:flex-row items-center justify-between gap-6 md:gap-12 mb-8 md:mb-16"
                >
                    <div className="flex items-center gap-4 md:gap-6 w-full lg:w-auto">
                        <Link
                            href="/admin"
                            className="group p-3 md:p-4 bg-white/5 rounded-2xl hover:bg-amber-500 hover:text-black transition-all border border-white/5 active:scale-95 flex items-center justify-center shadow-2xl"
                        >
                            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 group-hover:-translate-x-1 transition-transform" strokeWidth={3} />
                        </Link>
                        <div className="flex items-center gap-4">
                            <div className="relative w-10 h-10 md:w-14 md:h-14">
                                <Image src="/side-image.png" alt="Logo" fill className="object-contain" />
                            </div>
                            <div>
                                <p className="text-[8px] md:text-[10px] font-black tracking-[0.4em] text-amber-500 uppercase mb-1 md:mb-2">Visual Entrance Control</p>
                                <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase leading-none italic">
                                    Scann<span className="text-amber-500">er</span> Core.
                                </h1>
                            </div>
                        </div>
                    </div>

                    {/* Pro Mode Switcher */}
                    <div className="flex bg-[#0a0a0a] p-1.5 md:p-2 rounded-[2rem] border border-white/5 backdrop-blur-3xl w-full lg:w-auto shadow-2xl">
                        <button
                            onClick={() => { setScanMode('check-in'); resetScanner(); }}
                            className={`flex-1 lg:flex-none flex items-center justify-center gap-3 md:gap-4 px-6 md:px-10 py-4 md:py-5 rounded-[1.5rem] font-black text-[10px] md:text-[11px] uppercase tracking-[0.2em] transition-all duration-700 ${scanMode === 'check-in' ? 'bg-amber-500 text-black shadow-2xl shadow-amber-500/20 scale-[1.02]' : 'text-white/20 hover:text-white/40'}`}
                        >
                            <LogIn className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={3} /> <span>CHECK_IN</span>
                        </button>
                        <button
                            onClick={() => { setScanMode('check-out'); resetScanner(); }}
                            className={`flex-1 lg:flex-none flex items-center justify-center gap-3 md:gap-4 px-6 md:px-10 py-3.5 md:py-5 rounded-[1.5rem] font-black text-[10px] md:text-[11px] uppercase tracking-[0.2em] transition-all duration-700 ${scanMode === 'check-out' ? 'bg-amber-500 text-black shadow-2xl shadow-amber-500/20 scale-[1.02]' : 'text-white/20 hover:text-white/40'}`}
                        >
                            <LogOut className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={3} /> <span>CHECK_OUT</span>
                        </button>
                    </div>
                </motion.header>

                <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-16 items-start pb-20">
                    {/* Viewfinder Lens */}
                    <div className="lg:col-span-6 flex flex-col items-center">
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={fadin}
                            custom={1}
                            className="relative w-full max-w-lg aspect-square"
                        >
                            {/* Industrial HUD Frame */}
                            <div className="absolute -inset-3 md:-inset-6 border border-white/5 rounded-[2.5rem] md:rounded-[4rem] pointer-events-none" />
                            <div className={`absolute -inset-1 border-2 rounded-[2.2rem] md:rounded-[3.5rem] pointer-events-none transition-all duration-1000 ${participant ? 'border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.2)]' : 'border-white/10'}`} />

                            {/* Scanning Hardware Lens */}
                            <div className="relative z-10 w-full h-full bg-[#030303] rounded-[2rem] md:rounded-[3.2rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/5">
                                <div id="reader" className="w-full h-full object-cover opacity-80 contrast-125 brightness-110"></div>

                                <AnimatePresence>
                                    {!isCameraStarted && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="absolute inset-0 bg-[#050505] backdrop-blur-3xl z-40 flex flex-col items-center justify-center p-8 md:p-12 text-center gap-8 md:gap-10"
                                        >
                                            <div className="relative">
                                                <div className="w-20 h-20 md:w-24 md:h-24 bg-amber-500/5 rounded-full flex items-center justify-center text-amber-500 border border-amber-500/10 mb-2">
                                                    <Camera className="w-8 h-8 md:w-11 md:h-11" strokeWidth={1.5} />
                                                </div>
                                                <div className="absolute inset-0 bg-amber-500/10 blur-3xl rounded-full" />
                                            </div>
                                            {/* Logo Integration */}
                                            <div className="flex items-center gap-3 opacity-30">
                                                <Image src="/side-image.png" alt="Logo" width={30} height={30} className="object-contain" />
                                                <span className="text-[10px] font-black tracking-[0.4em] text-white">VISHAKA 2K26</span>
                                            </div>
                                            <div>
                                                <h4 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white mb-3 md:mb-4">LENS AUTH REQUIRED</h4>
                                                <p className="text-white/30 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] leading-relaxed max-w-[200px] md:max-w-[220px] mx-auto">Manual gesture required for optical initialization.</p>
                                            </div>
                                            <button
                                                onClick={startScanner}
                                                className="px-8 md:px-12 py-4 md:py-6 bg-white text-black rounded-xl md:rounded-2xl font-black uppercase tracking-[0.3em] text-[10px] md:text-[11px] hover:bg-amber-500 transition-all shadow-2xl active:scale-[0.98]"
                                            >
                                                INITIALIZE LENS
                                            </button>
                                        </motion.div>
                                    )}

                                    {!participant && !loading && isCameraStarted && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="absolute inset-0 pointer-events-none flex items-center justify-center z-20"
                                        >
                                            {/* Tactical Viewfinder */}
                                            <div className="w-64 h-64 relative">
                                                <div className="absolute top-0 left-0 w-16 h-16 border-t-[2px] border-l-[2px] border-amber-500/80 rounded-tl-3xl" />
                                                <div className="absolute top-0 right-0 w-16 h-16 border-t-[2px] border-r-[2px] border-amber-500/80 rounded-tr-3xl" />
                                                <div className="absolute bottom-0 left-0 w-16 h-16 border-b-[2px] border-l-[2px] border-amber-500/80 rounded-bl-3xl" />
                                                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-[2px] border-r-[2px] border-amber-500/80 rounded-br-3xl" />

                                                <motion.div
                                                    animate={{
                                                        height: ['0%', '100%', '0%'],
                                                        opacity: [0.1, 0.5, 0.1]
                                                    }}
                                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                                    className="absolute top-0 left-0 right-0 w-full bg-gradient-to-b from-transparent via-amber-500 to-transparent z-20"
                                                />
                                                {/* Scanning Points */}
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {loading && (
                                    <div className="absolute inset-0 bg-[#000]/90 backdrop-blur-3xl flex flex-col items-center justify-center gap-8 z-50">
                                        <div className="relative">
                                            <div className="w-24 h-24 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-40">
                                                <Image src="/side-image.png" alt="Logo" width={40} height={40} className="object-contain" />
                                            </div>
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-amber-500 animate-pulse">Searching Identities...</p>
                                    </div>
                                )}
                            </div>

                            {/* HUD Status Bar */}
                            <div className="mt-8 md:mt-12 flex flex-col items-center gap-4 md:gap-6">
                                <div className="px-6 md:px-8 py-2.5 md:py-3 bg-[#0a0a0a] border border-white/5 rounded-full flex items-center gap-3 md:gap-4 shadow-2xl">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white whitespace-nowrap">SYSTEM_LIVE</span>
                                    </div>
                                    <div className="w-px h-3 bg-white/10" />
                                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">MODE: <span className="text-white">{scanMode}</span></span>
                                </div>
                                <button onClick={resetScanner} className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.4em] text-white/10 hover:text-amber-500 transition-colors">FORCE_RESET_LENS</button>
                            </div>
                        </motion.div>
                    </div>

                    {/* Result Interface */}
                    <div className="lg:col-span-6 h-full">
                        <AnimatePresence mode="wait">
                            {participant ? (
                                <motion.div
                                    initial={{ opacity: 0, x: 30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -30 }}
                                    className="w-full max-w-2xl mx-auto bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 shadow-[0_50px_100px_rgba(0,0,0,0.6)] relative overflow-hidden"
                                >
                                    {/* Event Logo Watermark */}
                                    <div className="absolute top-4 right-4 w-12 h-12 md:w-16 md:h-16 opacity-20 pointer-events-none">
                                        <Image
                                            src="/side-image.png"
                                            alt="Event Logo"
                                            fill
                                            className="object-contain filter grayscale invert"
                                        />
                                    </div>
                                    {/* Profile Background Glow */}
                                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/5 blur-[120px] rounded-full" />

                                    <div className="relative z-10">
                                        <div className="flex items-center justify-between mb-8 md:mb-16">
                                            <span className="bg-amber-500/5 border border-amber-500/20 text-amber-500 px-4 py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] italic">IDENTITY_PENDING</span>
                                            <span className="text-[9px] md:text-[10px] font-mono text-white/20 font-bold uppercase tracking-widest">{participant.id}</span>
                                        </div>

                                        <div className="flex flex-col items-start gap-8 md:gap-10 mb-12 md:mb-16">
                                            <div className="w-20 h-20 md:w-24 md:h-24 bg-white/5 rounded-[1.8rem] md:rounded-[2.2rem] flex items-center justify-center text-white/20 border border-white/5 group-hover:text-amber-500 transition-colors">
                                                <User className="w-10 h-10 md:w-12 md:h-12" strokeWidth={1} />
                                            </div>
                                            <div>
                                                <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter uppercase leading-[0.8] mb-4 md:mb-6">{participant.name}</h2>
                                                <div className="flex items-center gap-3 text-white/30 text-[9px] md:text-[11px] font-black uppercase tracking-[0.25em]">
                                                    <Building size={14} className="text-amber-500" />
                                                    {participant.college}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 mb-16">
                                            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">SQUAD_ID</p>
                                                    <p className="text-sm font-black text-white tracking-widest uppercase">{participant.team}</p>
                                                </div>
                                                <Users size={20} className="text-white/10" />
                                            </div>
                                        </div>

                                        {lastAction ? (
                                            <motion.div
                                                initial={{ y: 20, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                className={`p-10 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center text-center gap-6 ${scanMode === 'check-in'
                                                    ? 'border-emerald-500/30 bg-emerald-500/5'
                                                    : 'border-blue-500/30 bg-blue-500/5'
                                                    }`}
                                            >
                                                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-black shadow-2xl ${scanMode === 'check-in'
                                                    ? 'bg-emerald-500 shadow-emerald-500/20'
                                                    : 'bg-blue-500 shadow-blue-500/20'
                                                    }`}>
                                                    <CheckCircle2 size={32} strokeWidth={3} />
                                                </div>
                                                {/* Card Logo */}
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Image src="/side-image.png" alt="Logo" width={18} height={18} className="object-contain filter brightness-125" />
                                                    <span className="text-[7px] font-black tracking-[0.3em] text-white/40 uppercase">VISHAKA_AUTHORIZED</span>
                                                </div>
                                                <div>
                                                    <p className={`font-black uppercase tracking-[0.4em] text-xs italic ${scanMode === 'check-in' ? 'text-emerald-500' : 'text-blue-500'
                                                        }`}>
                                                        {scanMode === 'check-in' ? 'ENTRANCE_GRANTED_SUCCESS' : 'EXIT_AUTHORIZATION_SUCCESS'}
                                                    </p>
                                                    <p className="text-[7px] text-white/20 mt-3 font-mono uppercase tracking-[0.2em] leading-tight">
                                                        LOG: {new Date(lastAction.recorded_at).toLocaleTimeString()} // SIG: {String(lastAction?.id || 'LOCAL').slice(0, 8)}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <button
                                                onClick={handleAttendance}
                                                disabled={isUpdating}
                                                className="w-full bg-white text-black py-5 md:py-7 rounded-[1.5rem] md:rounded-[2rem] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-[10px] md:text-xs hover:bg-amber-500 transition-all duration-700 shadow-3xl disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-4"
                                            >
                                                {isUpdating ? <Loader2 size={24} className="animate-spin" /> : <>AUTHORIZE_TRANSACTION <ChevronRight size={20} strokeWidth={3} /></>}
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ) : error ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="w-full max-w-2xl mx-auto bg-red-500/5 border border-red-500/10 rounded-[3.5rem] p-12 md:p-16 flex flex-col items-center justify-center text-center gap-10 backdrop-blur-3xl relative overflow-hidden"
                                >
                                    {/* Event Logo Watermark */}
                                    <div className="absolute top-4 right-4 w-12 h-12 opacity-10 pointer-events-none">
                                        <Image
                                            src="/side-image.png"
                                            alt="Event Logo"
                                            fill
                                            className="object-contain filter grayscale invert"
                                        />
                                    </div>
                                    <div className="relative">
                                        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 border border-red-500/20">
                                            <AlertCircle size={48} strokeWidth={1.5} />
                                        </div>
                                        <div className="absolute inset-0 bg-red-500/20 blur-3xl animate-pulse rounded-full" />
                                    </div>
                                    <div className="flex items-center gap-2 opacity-40">
                                        <Image src="/side-image.png" alt="Logo" width={20} height={20} className="object-contain brightness-125" />
                                        <span className="text-[8px] font-black tracking-widest text-white/40 uppercase">Vishaka 2K26</span>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">SECURITY_ERROR</h3>
                                        <p className="text-red-500/80 text-[10px] font-black uppercase tracking-[0.3em] leading-relaxed max-w-[280px] mx-auto">{error}</p>
                                    </div>
                                    <button
                                        onClick={resetScanner}
                                        className="w-full py-6 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-[0.5em] transition-all text-white/40 hover:text-white"
                                    >
                                        RETRY_IDENTIFICATION
                                    </button>
                                </motion.div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-center gap-8 md:gap-12 px-4 md:pr-6">
                                    <div className="relative">
                                        <div className="w-20 h-20 md:w-28 md:h-28 bg-white/[0.02] rounded-[2rem] md:rounded-[3rem] flex items-center justify-center text-white/5 border border-white/5">
                                            <ScanLine className="w-10 h-10 md:w-14 md:h-14" strokeWidth={1} />
                                        </div>
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                                            transition={{ duration: 5, repeat: Infinity }}
                                            className="absolute -inset-6 md:-inset-8 border-2 border-white/5 rounded-full"
                                        />
                                        {/* Corner Logo */}
                                        <div className="absolute -bottom-4 -right-4 w-10 h-10 md:w-12 md:h-12 opacity-10">
                                            <Image src="/side-image.png" alt="Logo" fill className="object-contain filter grayscale invert" />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-sm md:text-xl font-black uppercase tracking-[0.5em] text-white/5 italic">System_Ready</h4>
                                    </div>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </main>
            </div>

            {/* Nav Footer (Mobile Optimized) */}
            <div className="fixed bottom-6 md:bottom-10 left-0 w-full flex justify-center px-6 lg:hidden z-50">
                <nav className="bg-[#0f0f0f]/90 backdrop-blur-2xl border border-white/10 px-6 md:px-8 py-4 md:py-5 rounded-full flex items-center gap-8 md:gap-12 shadow-3xl">
                    <Link href="/admin" className="text-white/40 hover:text-white transition-colors">
                        <LayoutDashboard size={24} />
                    </Link>
                    <div className="w-px h-6 bg-white/10" />
                    <button onClick={resetScanner} className="text-amber-500">
                        <ScanLine size={28} strokeWidth={3} />
                    </button>
                    <div className="w-px h-6 bg-white/10" />
                    <button onClick={() => { localStorage.removeItem("vishaka_admin_session"); router.push("/login"); }} className="text-white/40 hover:text-red-500 transition-colors">
                        <LogOut size={24} />
                    </button>
                </nav>
            </div>

            <style jsx global>{`
                #reader {
                    background: #000 !important;
                    border: none !important;
                }
                #reader__scan_region {
                    background: #000 !important;
                }
                #reader__dashboard {
                    background: transparent !important;
                    color: white !important;
                    padding: 24px !important;
                }
                #reader select {
                    background: #0a0a0a !important;
                    color: white !important;
                    border: 1px solid rgba(255, 255, 255, 0.05) !important;
                    padding: 10px !important;
                    border-radius: 12px !important;
                    font-size: 10px !important;
                    font-weight: 900 !important;
                    text-transform: uppercase !important;
                    opacity: 0.5;
                }
                video {
                    object-fit: cover !important;
                    width: 100% !important;
                    height: 100% !important;
                }
            `}</style>
        </div>
    );
}

const LayoutDashboard = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>
);
