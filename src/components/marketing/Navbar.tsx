

// src\components\marketing\Navbar.tsx

// src\components\marketing\Navbar.tsx

"use client";

import Link from "next/link";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("accessToken")));
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleDarkMode() {
    document.documentElement.classList.toggle("dark");
    setIsDark(document.documentElement.classList.contains("dark"));
  }

  function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setIsLoggedIn(false);
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-[-0.05em] text-slate-950">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">D</span>
          DataVerse <span className="text-sky-700">AI</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[13px] font-medium tracking-[0.14em] text-slate-600 uppercase transition hover:text-slate-950"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {isLoggedIn ? (
            <>
              <Link
                href="/dashboard"
                className="hidden rounded-full bg-slate-950 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 sm:inline-flex"
              >
                Go to Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:text-slate-950 sm:inline-flex"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/signup"
              className="hidden rounded-full bg-slate-950 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 sm:inline-flex"
            >
              Get Started
            </Link>
          )}

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white/90 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-[12px] font-medium uppercase tracking-[0.15em] text-slate-600"
              >
                {link.label}
              </Link>
            ))}

            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-full bg-slate-950 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
                >
                  Go to Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600"
                >
                  Log out
                </button>
              </>
            ) : (
              <Link
                href="/signup"
                className="rounded-full bg-slate-950 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
