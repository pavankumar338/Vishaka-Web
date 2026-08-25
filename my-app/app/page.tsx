"use client";

import Link from "next/link";
import { QrCode, Mail, Settings, ArrowUpRight, LogIn, ChevronRight, Sparkles, Shield, Zap } from "lucide-react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";

export default function Home() {
  const [isHovered, setIsHovered] = useState<number | null>(null);
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const yRange = useTransform(scrollYProgress, [0, 1], [0, 100]);

  const fadin: any = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.8, ease: "easeOut" },
    }),
  };

  const features = [
    {
      id: 1,
      title: "QR PASS SYSTEM",
      desc: "Instant generation of high-resolution QR identifiers for every participant.",
      icon: <QrCode size={24} />,
      btnText: "SCAN SYSTEM",
      accent: "#f59e0b"
    },
    {
      id: 2,
      title: "MAIL AUTOMATION",
      desc: "Automated delivery of digital passes and tickets directly to participant inboxes.",
      icon: <Mail size={24} />,
      btnText: "BROADCAST",
      accent: "#f59e0b"
    },
    {
      id: 3,
      title: "EVENT MANAGEMENT",
      desc: "Centralized platform for tracking, searching, and managing all delegate records.",
      icon: <Settings size={24} />,
      btnText: "DASHBOARD",
      accent: "#f59e0b"
    }
  ];

  return (
    <div ref={containerRef} className="home-bg font-sans selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">

      {/* Dynamic Interactive Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.03),transparent_50%)]" />
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
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[110vh] pt-20 px-6 overflow-hidden">
        <div className="max-w-6xl w-full text-center">

          <motion.div
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadin}
            className="relative perspective-1000"
          >
            <h1 className="text-[14vw] md:text-[14rem] font-outfit font-black leading-[0.8] tracking-[-0.08em] select-none flex flex-col items-center">
              <motion.span
                className="text-white hover:text-amber-500 transition-colors duration-700 cursor-default"
                whileHover={{ scale: 1.02, rotateX: 10 }}
              >
                VISHAKA
              </motion.span>
              <motion.span
                className="text-amber-500 italic drop-shadow-[0_0_30px_rgba(245,158,11,0.4)] relative"
                whileHover={{ scale: 1.1, rotateY: -10 }}
              >
                2K26
                <motion.span
                  className="absolute -inset-2 bg-amber-500/10 blur-2xl rounded-full -z-10"
                  animate={{ opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </motion.span>
            </h1>
          </motion.div>

          <motion.div
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadin}
            className="flex flex-col items-center justify-center gap-12 mt-16 md:mt-24"
          >
            <div className="flex gap-8">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="/login" className="hero-cta-button font-outfit font-black text-[10px] md:text-[14px] tracking-[0.4em] rounded-full overflow-hidden block text-center">
                  <div className="absolute inset-0 bg-amber-500 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                  <span className="relative z-10 flex items-center justify-center gap-4 whitespace-nowrap">
                    INITIALIZE SYSTEM <ChevronRight size={18} strokeWidth={3} />
                  </span>
                </Link>
              </motion.div>
            </div>

          </motion.div>
        </div>

        {/* Hover-Interactive Features Section */}
        <section id="features" className="max-w-7xl w-full mt-64 mb-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                className="relative group p-[1px] rounded-[2.5rem] overflow-hidden glass hover:bg-gradient-to-br hover:from-amber-500/40 hover:to-transparent transition-all duration-1000 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              >
                <div className="relative z-10 bg-[#080808]/90 backdrop-blur-sm p-10 md:p-12 h-full rounded-[2.5rem] flex flex-col border border-white/[0.05] group-hover:border-amber-500/20 transition-all duration-700">
                  <div className="flex justify-between items-start mb-14">
                    <motion.div
                      animate={isHovered === f.id ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                      className="w-16 h-16 bg-white/[0.03] text-white flex items-center justify-center rounded-2xl border border-white/10 group-hover:border-amber-500/50 group-hover:text-amber-500 group-hover:bg-amber-500/5 transition-all duration-500 shadow-2xl"
                    >
                      {f.icon}
                    </motion.div>
                    <div className="flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-500">
                      <span className="text-[10px] font-black text-amber-500 tracking-[0.4em]">LIVE_NODE</span>
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                    </div>
                  </div>

                  <h3 className="font-outfit font-black text-sm md:text-base tracking-[0.4em] text-white mb-8 uppercase group-hover:text-amber-500 transition-colors duration-500">{f.title}</h3>
                  <p className="text-white/30 text-[10px] md:text-[11px] leading-[2.2] font-bold uppercase tracking-[0.25em] mb-12 flex-grow transition-colors duration-500 group-hover:text-white/70">
                    {f.desc}
                  </p>

                  <button className="flex items-center gap-4 text-[10px] font-black tracking-[0.4em] text-white/20 group-hover:text-amber-500 transition-all duration-500 mt-auto">
                    {f.btnText} <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>


      </main>

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

        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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