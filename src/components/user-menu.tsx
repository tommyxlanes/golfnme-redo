"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Trophy,
  BarChart3,
  UserPlus,
} from "lucide-react";
import Image from "next/image";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "loading") {
    return <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />;
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="px-4 py-2 text-sm font-medium bg-white text-fairway-700 rounded-lg hover:bg-white/90 transition-colors"
        >
          Sign up
        </Link>
      </div>
    );
  }

  console.log("USERMENU: ", session?.user);

  const initials =
    session.user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1 pr-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-medium">
          {session.user.image ? (
            <Image
              src={session.user.image!}
              alt={session.user.name || ""}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            initials
          )}
        </div>
        <span className="text-sm font-medium text-white hidden sm:block">
          {session.user.name?.split(" ")[0]}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-white/70 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-sand-100 overflow-hidden z-50"
          >
            {/* User Info */}
            <div className="p-4 border-b border-sand-100">
              <p className="font-medium text-sand-900">{session.user.name}</p>
              <p className="text-sm text-sand-500">
                @{session.user.username || "user"}
              </p>
              {session.user.handicap && (
                <p className="text-xs text-fairway-600 mt-1">
                  Handicap: {session.user.handicap}
                </p>
              )}
            </div>

            {/* Menu Items */}
            <div className="p-2">
              <Link
                href="/profile"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <User className="w-5 h-5 text-sand-500" />
                <span className="text-sand-700">Profile</span>
              </Link>

              <Link
                href="/stats"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <BarChart3 className="w-5 h-5 text-sand-500" />
                <span className="text-sand-700">My Stats</span>
              </Link>

              <Link
                href="/friends"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <UserPlus className="w-5 h-5 text-sand-500" />
                <span className="text-sand-700">Friends</span>
              </Link>

              <Link
                href="/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Settings className="w-5 h-5 text-sand-500" />
                <span className="text-sand-700">Settings</span>
              </Link>
            </div>

            {/* Sign Out */}
            <div className="p-2 border-t border-sand-100">
              <button
                onClick={() => {
                  setIsOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors text-red-600"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
