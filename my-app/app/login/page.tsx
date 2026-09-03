"use client";

import React, { useState, useEffect } from "react";
import { motion, Variants } from "framer-motion";
import { Lock, User, ShieldCheck, ArrowRight, Loader2, AlertCircle } from "lucide-react";
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
    const savedRole = localStorage.getItem("vishaka_role");
    if (isAdmin === "true") {
      if (savedRole === "volunteer") {
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
      if (role === "admin" && username.toLowerCase() === "admin" && password === "PavanR@1617") {
        localStorage.setItem("vishaka_admin_session", "true");
        localStorage.setItem("vishaka_role", "admin");
        router.push("/admin");
      } else if (role === "volunteer" && username.toLowerCase() === "volunteer" && password === "SplashEvent@2026") {
        localStorage.setItem("vishaka_admin_session", "true");
        localStorage.setItem("vishaka_role", "volunteer");
        router.push("/admin/scan");
      } else {
        setError("ACCESS DENIED: INVALID ADMINISTRATIVE CREDENTIALS");
        setIsLoading(false);
      }
    }, 800);
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
                onClick={() => { setRole("volunteer"); setError(""); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${role === "volunteer"
                  ? "bg-amber-500 text-black shadow-md shadow-amber-500/20 font-black"
                  : "text-white/50 hover:text-white"
                  }`}
              >
                <User size={15} /> Volunteer
              </button>
              <button
                type="button"
                onClick={() => { setRole("admin"); setError(""); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${role === "admin"
                  ? "bg-amber-500 text-black shadow-md shadow-amber-500/20 font-black"
                  : "text-white/50 hover:text-white"
                  }`}
              >
                <ShieldCheck size={15} /> Admin
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
              <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">
                Secure Key
              </label>
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
                  INITIALIZE SESSION <ArrowRight size={16} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
