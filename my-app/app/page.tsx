"use client";

import Link from "next/link";
import { QrCode, Mail, Settings, ArrowUpRight, ChevronRight } from "lucide-react";
import { motion, useScroll, useTransform, Variants } from "framer-motion";
import { useState, useRef } from "react";

export default function Home() {
  const [isHovered, setIsHovered] = useState<number | null>(null);
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const yRange = useTransform(scrollYProgress, [0, 1], [0, 100]);

  const fadin: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.8, ease: "easeOut" } as any,
    }),
  };


  const features = [
    {
      id: 1,
      title: "QR PASS SYSTEM",
      desc: "Instant generation and verification of high-resolution QR identifiers for every participant.",
      icon: <QrCode size={24} />,
      btnText: "SCAN SYSTEM",
      href: "/admin/scan",
    },
    {
      id: 2,
      title: "MAIL AUTOMATION",
      desc: "Automated delivery of digital passes and tickets directly to participant inboxes.",
      icon: <Mail size={24} />,
      btnText: "BROADCAST",
      href: "/admin/broadcast",
    },
    {
      id: 3,
      title: "EVENT MANAGEMENT",
      desc: "Centralized platform for tracking, searching, and managing all delegate records.",
      icon: <Settings size={24} />,
      btnText: "DASHBOARD",
      href: "/admin",
    }
  ];

  return (
    <div ref={containerRef} className="home-bg font-sans selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden min-h-screen">

      {/* Dynamic Interactive Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.06),transparent_70%)]" />
        <motion.div
          style={{ y: yRange }}
          className="absolute inset-0 opacity-20"
        >
          <div className="absolute top-0 left-[15%] w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          <div className="absolute top-0 right-[15%] w-[1px] h-full bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          <div className="absolute top-[30%] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </motion.div>
      </div>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center pt-16 md:pt-24 pb-20 px-4 md:px-6">
        <div className="max-w-6xl w-full text-center">

          <motion.div
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadin}
            className="relative select-none"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-widest uppercase mb-6">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Annual Tech Symposium 2026
            </div>

            <h1 className="text-5xl sm:text-7xl md:text-9xl lg:text-[11rem] font-outfit font-black tracking-tight leading-none flex flex-col items-center gap-1 md:gap-2">
              <motion.span
                className="text-white hover:text-amber-400 transition-colors duration-500 cursor-default"
                whileHover={{ scale: 1.02 }}
              >
                VISHAKA
              </motion.span>
              <motion.span
                className="text-amber-500 italic drop-shadow-[0_0_40px_rgba(245,158,11,0.4)] relative"
                whileHover={{ scale: 1.05 }}
              >
                2K26
                <motion.span
                  className="absolute -inset-4 bg-amber-500/10 blur-3xl rounded-full -z-10"
                  animate={{ opacity: [0.2, 0.6, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </motion.span>
            </h1>
          </motion.div>

          <motion.p
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadin}
            className="max-w-xl mx-auto mt-6 text-sm md:text-base text-white/50 font-medium tracking-wide uppercase"
          >
            Next-Generation Event Orchestration & Participant Identification
          </motion.p>

          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={fadin}
            className="flex flex-col items-center justify-center mt-10 md:mt-12"
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Link href="/login" className="hero-cta-button font-outfit font-black text-xs md:text-sm tracking-[0.3em]">
                <span className="flex items-center justify-center gap-3">
                  INITIALIZE SYSTEM <ChevronRight size={18} strokeWidth={3} />
                </span>
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* Features Section */}
        <section id="features" className="max-w-7xl w-full mt-24 md:mt-36">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {features.map((f, i) => (
              <motion.div
                key={f.id}
                custom={i + 3}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadin}
                onMouseEnter={() => setIsHovered(f.id)}
                onMouseLeave={() => setIsHovered(null)}
                className="relative group rounded-3xl overflow-hidden glass hover:border-amber-500/40 transition-all duration-500 flex flex-col"
              >
                <div className="p-8 md:p-10 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-8">
                    <motion.div
                      animate={isHovered === f.id ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                      className="w-14 h-14 bg-white/[0.04] text-white flex items-center justify-center rounded-2xl border border-white/10 group-hover:border-amber-500/50 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition-all duration-500 shadow-xl"
                    >
                      {f.icon}
                    </motion.div>
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/5 opacity-60 group-hover:opacity-100 group-hover:border-amber-500/30 transition-all duration-500">
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                      <span className="text-[10px] font-black text-amber-400 tracking-widest">LIVE</span>
                    </div>
                  </div>

                  <h3 className="font-outfit font-black text-base md:text-lg tracking-widest text-white mb-4 uppercase group-hover:text-amber-400 transition-colors duration-300">
                    {f.title}
                  </h3>
                  <p className="text-white/40 text-xs md:text-sm leading-relaxed font-medium mb-8 flex-grow group-hover:text-white/70 transition-colors duration-300">
                    {f.desc}
                  </p>

                  <Link
                    href={f.href}
                    className="inline-flex items-center justify-between w-full pt-4 border-t border-white/10 text-xs font-black tracking-widest text-white/50 group-hover:text-amber-400 group-hover:border-amber-500/30 transition-all duration-300 mt-auto"
                  >
                    <span>{f.btnText}</span>
                    <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}