

// src\components\marketing\Navbar.tsx

// src\components\marketing\Navbar.tsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Moon, Sun, Menu, X } from "lucide-react";

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
    setIsLoggedIn(!!localStorage.getItem("accessToken"));

    const prefersDark = document.documentElement.classList.contains("dark");
    setIsDark(prefersDark);
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
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-[#111827] dark:text-white">
          DataVerse <span className="text-[#2563EB]">AI</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-[#2563EB] transition"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {isLoggedIn ? (
            <>
              <Link
                href="/dashboard"
                className="hidden sm:inline-block px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#2563EB]/90 transition"
              >
                Go to Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="hidden sm:inline-block text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-[#2563EB] transition"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/signup"
              className="hidden sm:inline-block px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#2563EB]/90 transition"
            >
              Get Started
            </Link>
          )}

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 px-4 py-4 flex flex-col gap-4 bg-white dark:bg-[#0B1120]">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-gray-600 dark:text-gray-300"
            >
              {link.label}
            </Link>
          ))}

          {isLoggedIn ? (
            <>
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium text-center"
              >
                Go to Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-gray-600 dark:text-gray-300 text-left"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/signup"
              className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium text-center"
            >
              Get Started
            </Link>
          )}
        </div>
      )}
    </header>
  );
}