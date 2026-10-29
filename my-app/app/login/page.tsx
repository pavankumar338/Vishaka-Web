"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Lock, User, ShieldCheck, ArrowRight, Loader2, AlertCircle, CheckCircle2, Sparkles, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "volunteer">("admin");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccessData, setLoginSuccessData] = useState<{ role: string; redirectUrl: string } | null>(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const router = useRouter();

  // Check if session is already active
  useEffect(() => {
    try {
      const isAdmin = localStorage.getItem("vishaka_admin_session");
      const savedRole = localStorage.getItem("vishaka_role");
      if (isAdmin === "true") {
        const dest = savedRole === "volunteer" ? "/admin/scan" : "/admin";
        router.push(dest);
      }
    } catch (e) {
      console.warn("Storage check warning:", e);
    }
  }, [router]);

  const saveSessionAndRedirect = (userRole: "admin" | "volunteer", destUrl: string) => {
    try {
      localStorage.setItem("vishaka_admin_session", "true");
      localStorage.setItem("vishaka_role", userRole);
      // Also persist in document cookie for maximum browser compatibility
      document.cookie = `vishaka_admin_session=true; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `vishaka_role=${userRole}; path=/; max-age=604800; SameSite=Lax`;
    } catch (e) {
      console.warn("Error saving session storage:", e);
    }

    setLoginSuccessData({ role: userRole, redirectUrl: destUrl });

    // Smooth guaranteed redirect after confirmation animation
    setTimeout(() => {
      window.location.href = destUrl;
    }, 1200);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setShowErrorPopup(false);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    setTimeout(() => {
      // 1. Check Admin credentials (auto-detect regardless of tab)
      const isAdminUser = ["admin", "administrator", "pavan", "admin@vishaka.com", "admin@klu.ac.in"].includes(cleanUser);
      const isAdminPass = cleanPass === "PavanR@1617" || cleanPass === "admin" || cleanPass === "admin123";

      // 2. Check Volunteer credentials (auto-detect regardless of tab)
      const isVolUser = ["volunteer", "vol", "scan", "scanner", "volunteer@vishaka.com"].includes(cleanUser);
      const isVolPass = cleanPass === "VishakaEvent@2026" || cleanPass === "volunteer123" || cleanPass === "volunteer";

      if (isAdminUser && isAdminPass) {
        saveSessionAndRedirect("admin", "/admin");
      } else if (isVolUser && isVolPass) {
        saveSessionAndRedirect("volunteer", "/admin/scan");
      } else if (role === "admin" && cleanPass === "PavanR@1617") {
        // Fallback for custom admin username
        saveSessionAndRedirect("admin", "/admin");
      } else if (role === "volunteer" && cleanPass === "VishakaEvent@2026") {
        // Fallback for custom volunteer username
        saveSessionAndRedirect("volunteer", "/admin/scan");
      } else {
        const errorMsg = "ACCESS DENIED: INVALID ADMINISTRATIVE CREDENTIALS";
        setError(errorMsg);
        setShowErrorPopup(true);
        setIsLoading(false);
      }
    }, 600);
  };

  // Quick fill helper for seamless convenience
  const fillCredentials = (type: "admin" | "volunteer") => {
    if (type === "admin") {
      setRole("admin");
      setUsername("admin");
      setPassword("PavanR@1617");
      setError("");
      setShowErrorPopup(false);
    } else {
      setRole("volunteer");
      setUsername("volunteer");
      setPassword("VishakaEvent@2026");
      setError("");
      setShowErrorPopup(false);
    }
  };

  const fadin: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] } as any,
    }),
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#050505] text-[#e0e0e0] flex items-center justify-center p-4 md:p-8 font-sans selection:bg-amber-500/30 selection:text-amber-200 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/[0.04] rounded-full blur-3xl pointer-events-none" />
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadin}
        custom={1}
        className="w-full max-w-md relative z-10 my-auto"
      >
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-white/40 hover:text-amber-400 transition-colors uppercase mb-6"
          >
            <ArrowRight size={14} className="rotate-180" /> Back to Home
          </Link>

          <h1 className="text-3xl md:text-5xl font-outfit font-black tracking-tight text-white uppercase leading-tight">
            RESTRICTED <span className="text-amber-500 italic">ACCESS</span>
          </h1>
          <p className="text-xs text-white/40 tracking-wider uppercase mt-2">
            Authenticate to access terminal
          </p>
        </div>

        <div className="glass bg-[#0d0d0f]/90 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          {/* Accent top line */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-60" />

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Role switch */}
            <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 gap-1">
              <button
                type="button"
                onClick={() => { setRole("admin"); setError(""); setShowErrorPopup(false); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${role === "admin"
                  ? "bg-amber-500 text-black shadow-md shadow-amber-500/20 font-black"
                  : "text-white/50 hover:text-white"
                  }`}
              >
                <ShieldCheck size={15} /> Admin
              </button>
              <button
                type="button"
                onClick={() => { setRole("volunteer"); setError(""); setShowErrorPopup(false); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${role === "volunteer"
                  ? "bg-amber-500 text-black shadow-md shadow-amber-500/20 font-black"
                  : "text-white/50 hover:text-white"
                  }`}
              >
                <User size={15} /> Volunteer
              </button>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">
                {role === "admin" ? "Administrator ID" : "Volunteer ID"}
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                <input
                  required
                  type="text"
                  placeholder={role === "admin" ? "admin" : "volunteer"}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 transition-all font-outfit text-sm font-medium text-white placeholder:text-white/20"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-white/50 uppercase tracking-widest">
                  Secure Key
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 transition-all font-outfit text-sm font-medium text-white placeholder:text-white/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Quick autofill helper pills */}
            <div className="flex items-center justify-between text-[11px] pt-1 text-white/40">
              <span className="flex items-center gap-1.5 font-medium"><KeyRound size={13} /> Quick Fill:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fillCredentials("admin")}
                  className="hover:text-amber-400 font-bold uppercase transition-colors underline cursor-pointer"
                >
                  Admin
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => fillCredentials("volunteer")}
                  className="hover:text-amber-400 font-bold uppercase transition-colors underline cursor-pointer"
                >
                  Volunteer
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl text-red-400 text-xs font-bold tracking-wide"
              >
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative overflow-hidden bg-amber-500 text-black py-4 rounded-xl font-outfit font-black uppercase tracking-widest text-xs hover:bg-amber-400 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> VERIFYING ACCESS...
                </>
              ) : (
                <>
                  CONFIRM & INITIALIZE SESSION <ArrowRight size={16} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>

      {/* SUCCESS CONFIRMATION POPUP MODAL */}
      <AnimatePresence>
        {loginSuccessData && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#0e0e12] border border-amber-500/40 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-emerald-400 to-amber-500 animate-pulse" />
              
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl mx-auto flex items-center justify-center text-emerald-400 mb-5 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 size={36} strokeWidth={2.5} />
              </div>

              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">
                ACCESS GRANTED
              </span>
              <h3 className="text-xl font-black text-white uppercase tracking-tight mt-1 mb-2">
                SESSION CONFIRMED
              </h3>
              <p className="text-xs text-white/60 mb-6 font-medium">
                Identity verified as <strong className="text-amber-400 uppercase">{loginSuccessData.role}</strong>. Session saved successfully.
              </p>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-center gap-3">
                <Loader2 className="animate-spin text-amber-400" size={18} />
                <span className="text-[11px] font-bold text-white/80 uppercase tracking-widest">
                  Entering Command Center...
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ERROR ALERT POPUP MODAL */}
      <AnimatePresence>
        {showErrorPopup && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" onClick={() => setShowErrorPopup(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0e0e12] border border-red-500/30 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative"
            >
              <div className="w-16 h-16 bg-red-500/20 border border-red-500/40 rounded-2xl mx-auto flex items-center justify-center text-red-400 mb-5 shadow-lg shadow-red-500/10">
                <AlertCircle size={36} strokeWidth={2.5} />
              </div>

              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-400">
                VERIFICATION FAILED
              </span>
              <h3 className="text-xl font-black text-white uppercase tracking-tight mt-1 mb-2">
                INVALID CREDENTIALS
              </h3>
              <p className="text-xs text-white/60 mb-6">
                The credentials you entered do not match our authorization registry.
              </p>

              <div className="space-y-2 mb-6">
                <button
                  type="button"
                  onClick={() => fillCredentials("admin")}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  <ShieldCheck size={16} /> Quick Login as Admin
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials("volunteer")}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <User size={16} /> Quick Login as Volunteer
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowErrorPopup(false)}
                className="text-[11px] font-bold text-white/40 hover:text-white uppercase tracking-widest cursor-pointer"
              >
                Close & Try Again
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    