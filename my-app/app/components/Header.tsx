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
    localStorage.removeItem("vishaka_role");
    setIsAdmin(false);
    router.push("/");
  };

  const isDashboard = pathname?.startsWith("/admin");

  return (
    <header className="w-full relative z-50 pt-4 md:pt-6 px-4 md:px-8">
      <nav className="max-w-7xl mx-auto px-5 md:px-8 py-3.5 md:py-4 flex items-center justify-between bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-full shadow-2xl transition-all duration-300">
        {/* Logo & Brand */}
        <Link href="/" className="flex items-center gap-3 group no-underline">
          <div className="relative w-8 h-8 md:w-10 md:h-10 transition-transform duration-500 group-hover:scale-105">
            <Image
              src="/side-image.png"
              alt="Vishaka Logo"
              fill
              className="object-contain filter brightness-110 drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-outfit font-black text-sm md:text-xl tracking-wider text-white leading-tight uppercase">
              VISHAKA <span className="text-amber-500">2K26</span>
            </span>
          </div>
        </Link>

        <div className="flex items-center">
          {isDashboard || isAdmin ? (
            <button
              onClick={handleLogout}
              className="group relative flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:text-white px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs font-black tracking-widest uppercase transition-all duration-300 hover:bg-red-500 shadow-lg active:scale-95 cursor-pointer"
            >
              <span>LOGOUT</span>
              <LogOut size={14} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
            </button>
          ) : (
            <Link 
              href="/login" 
              className="group relative flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-4 md:px-6 py-2 md:py-2.5 rounded-full text-xs font-black tracking-widest uppercase transition-all duration-300 shadow-lg shadow-amber-500/20 active:scale-95 no-underline"
            >
              <span>PORTAL</span>
              <LogIn size={14} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
