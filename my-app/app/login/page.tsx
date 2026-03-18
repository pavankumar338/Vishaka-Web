"use client";

import React, { useState, useEffect } from "react";
import { motion, Variants } from "framer-motion";
import { Lock, User, ShieldCheck, ArrowRight, Loader2, AlertCircle, LogIn, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLogin() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<"admin" | "volunteer">("volunteer");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const isAdmin = localStorage.getItem("vishaka_admin_session");
        const role = localStorage.getItem("vishaka_role");
        if (isAdmin === "true") {
            if (role === "volunteer") {
                router.push("/admin/scan");
            } else {
                router.push("/admin");
            }
        }
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        setTimeout(() => {
            if (role === "admin" && username.toLowerCase() === "admin" && password === "VishakaEvent@2026") {
                localStorage.setItem("vishaka_admin_session", "true");
                localStorage.setItem("vishaka_role", "admin");
                router.push("/admin");
            } else if (role === "volunteer" && username.toLowerCase() === "volunteer" && password === "Vishaka@2026") {
                localStorage.setItem("vishaka_admin_session", "true");
                localStorage.setItem("vishaka_role", "volunteer");
                router.push("/admin/scan");
            } else {
                setError("ACCESS DENIED: INVALID ADMINISTRATIVE CREDENTIALS");
                setIsLoading(false);
            }
        }, 1200);
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
        <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex items-center justify-center p-6 font-outfit selection:bg-amber-500/30 selection:text-amber-200 overflow-hidden relative">

            {/* Cinematic Background Lines */}
            <div className="fixed inset-0 pointer-events-none opacity-20">
                <div className="absolute top-0 left-[20%] w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                <div className="absolute top-0 right-[20%] w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
            </div>


            <motion.div
                initial="hidden"
                animate="visible"
                variants={fadin}
                custom={1}
                className="w-full max-w-lg relative z-10 pt-12"
            >
                <div className="text-center mb-8 md:mb-12">

                    <h1 className="text-3xl md:text-7xl font-black tracking-[-0.04em] mb-4 text-white uppercase leading-[0.9]">
                        RESTRICTED <br />
                        <span className="text-amber-500 italic">ACCESS.</span>
                    </h1>
                    <Link href="/" className="inline-flex items-center gap-2 text-[10px] font-black tracking-[0.3em] text-white/20 hover:text-amber-500 transition-colors uppercase mt-4">
                        <ArrowRight size={12} className="rotate-180" /> Back to Portal
                    </Link>
                </div>

                <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 md:p-14 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                    {/* Animated Accent Bar */}
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />

                    <form onSubmit={handleLogin} className="space-y-8 md:space-y-10">
                        <div className="flex bg-white/[0.03] p-1.5 rounded-2xl border border-white/5">
                            <button
                                type="button"
                                onClick={() => { setRole("admin"); setError(""); }}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-2 ${role === "admin" ? "bg-amber-500 text-black shadow-lg" : "text-white/40 hover:text-white"}`}
                            >
                                <ShieldCheck size={14} /> Admin
                            </button>
                            <button
                                type="button"
                                onClick={() => { setRole("volunteer"); setError(""); }}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-2 ${role === "volunteer" ? "bg-amber-500 text-black shadow-lg" : "text-white/40 hover:text-white"}`}
                            >
                                <User size={14} /> Volunteer
                            </button>
                        </div>

                        <div className="space-y-3 md:space-y-4">
                            <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em] ml-1">
                                {role === 'admin' ? 'Administrator ID' : 'Volunteer ID'}
                            </label>
                            <div className="relative">
                                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                                <input
                                    required
                                    type="text"
                                    placeholder="Enter System User"
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-4 md:py-5 pl-14 pr-6 outline-none focus:border-amber-500/50 transition-all font-outfit text-xs font-bold tracking-widest text-white uppercase placeholder:text-white/10"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-3 md:space-y-4">
                            <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em] ml-1">Secure Key</label>
                            <div className="relative">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                                <input
                                    required
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-4 md:py-5 pl-14 pr-6 outline-none focus:border-amber-500/50 transition-all font-outfit text-xs font-bold tracking-widest text-white uppercase placeholder:text-white/10"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 p-4 md:p-5 rounded-xl text-red-500 text-[10px] font-black uppercase tracking-widest"
                            >
                                <AlertCircle size={16} />
                                {error}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full group relative overflow-hidden bg-white text-black py-5 md:py-6 rounded-xl font-black uppercase tracking-[0.3em] text-[10px] md:text-[11px] hover:bg-amber-500 transition-all duration-500 flex items-center justify-center gap-3 shadow-2xl active:scale-[0.98] disabled:opacity-50"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3 text-black">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} /> VERIFYING ACCESS...
                                    </>
                                ) : (
                                    <>
                                        INITIALIZE SESSION <ArrowRight size={16} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </span>
                        </button>
                    </form>
                </div>

            </motion.div>

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
                }
            `}</style>
        </div>
    );
}
