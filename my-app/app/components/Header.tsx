"use client";

import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem("vishaka_admin_session");
    setIsAdmin(session === "true");
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("vishaka_admin_session");
    setIsAdmin(false);
    router.push("/");
  };

  const isDashboard = pathname?.startsWith("/admin");

  return (
    <header className="w-full relative z-50 pt-3 md:pt-6 px-3 md:px-6">
      <nav className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 flex items-center justify-between bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500">
        {/* Logo & Brand */}
        <Link href="/" className="flex items-center gap-2 md:gap-4 group">
          <div className="relative w-8 h-8 md:w-16 md:h-16 transition-transform duration-700 group-hover:scale-110">
            <Image
              src="/side-image.png"
              alt="Vishaka Logo"
              fill
              className="object-contain filter brightness-110 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-outfit font-black text-sm md:text-3xl tracking-[0.05em] text-white leading-tight uppercase">
              VISHAKA <span className="text-amber-500">2K26</span>
            </span>
          </div>
        </Link>

        <div className="flex items-center">
          {isDashboard || isAdmin ? (
            <button
              onClick={handleLogout}
              className="group relative flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 px-5 md:px-10 py-2.5 md:py-5 rounded-full text-[10px] md:text-[13px] font-black tracking-[0.2em] overflow-hidden transition-all duration-500 hover:bg-red-500 hover:text-white shadow-2xl active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-2">
                LOGOUT <LogOut size={14} strokeWidth={3} className="hidden md:block group-hover:scale-110 transition-transform" />
              </span>
            </button>
          ) : (
            <Link 
              href="/login" 
              className="group relative flex items-center gap-2 bg-white text-black px-5 md:px-10 py-2.5 md:py-5 rounded-full text-[10px] md:text-[13px] font-black tracking-[0.2em] overflow-hidden transition-all duration-500 hover:bg-amber-500 shadow-2xl hover:shadow-amber-500/20 active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-2">
                PORTAL <LogIn size={14} strokeWidth={3} className="hidden md:block group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
