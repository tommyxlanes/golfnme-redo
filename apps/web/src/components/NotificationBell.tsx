"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Bell, UserPlus, Users, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: string;
}

function kindIcon(kind: string) {
  if (kind === "friend_request" || kind === "friend_accepted")
    return <UserPlus className="w-4 h-4" />;
  if (
    kind === "session_invite" ||
    kind === "session_started" ||
    kind === "session_chat"
  )
    return <Users className="w-4 h-4" />;
  return <Bell className="w-4 h-4" />;
}

function kindColor(kind: string) {
  if (kind === "friend_request") return "bg-blue-100 text-blue-600";
  if (kind === "friend_accepted") return "bg-emerald-100 text-emerald-600";
  if (kind === "session_chat") return "bg-fairway-100 text-fairway-600";
  if (kind === "session_invite" || kind === "session_started")
    return "bg-yellow-100 text-yellow-600";
  return "bg-sand-100 text-sand-600";
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const { data: session } = useSession();
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const ablyRef = useRef<any>(null);

  const unread = notifs.filter((n) => !n.read).length;

  // ── Fetch persisted notifications from DB ──
  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifs(data.notifications ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    if (session?.user?.id) fetchNotifs();
  }, [session?.user?.id, fetchNotifs]);

  // ── Close on outside click ─────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      )
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Ably real-time ─────────────────────────
  useEffect(() => {
    if (!session?.user?.id || !process.env.NEXT_PUBLIC_ABLY_KEY) return;
    let channel: any = null;

    async function connect() {
      try {
        const Ably = (await import("ably")).default;
        const client = new Ably.Realtime({
          key: process.env.NEXT_PUBLIC_ABLY_KEY,
        });
        ablyRef.current = client;
        channel = client.channels.get(`user:${session!.user!.id}`);
        channel.subscribe("notification", () => {
          // Re-fetch from DB so we get the real persisted record
          setTimeout(fetchNotifs, 400);
        });
      } catch (e) {
        console.error("[NotificationBell] Ably error:", e);
      }
    }

    connect();
    return () => {
      channel?.unsubscribe();
      ablyRef.current?.close();
    };
  }, [session?.user?.id, fetchNotifs]);

  // ── Handlers ──────────────────────────────
  async function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  }

  async function dismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
  }

  async function clearAll() {
    setNotifs([]);
    setOpen(false);
    await fetch("/api/notifications", { method: "DELETE" });
  }

  async function handleClick(notif: Notification) {
    if (!notif.read) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notif.id] }),
      });
      setNotifs((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)),
      );
    }
    setOpen(false);
    if (notif.actionUrl) router.push(notif.actionUrl);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          const opening = !open;
          setOpen(opening);
          if (opening && unread > 0) markAllRead();
        }}
        className="relative p-2 rounded-lg btn-ghost text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-full mt-2 w-80 z-50 rounded-2xl overflow-hidden bg-white"
            style={{
              boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
              border: "1px solid #f3ede1",
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-sand-100">
              <span className="font-semibold text-sand-900 text-sm">
                Notifications
              </span>
              {notifs.length > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-fairway-600 hover:underline font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-sand-200 mx-auto mb-2" />
                  <p className="text-sand-400 text-sm">No notifications yet</p>
                </div>
              ) : (
                notifs.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-sand-50 hover:bg-sand-50 transition-colors cursor-pointer ${
                      !n.read ? "bg-fairway-50/40" : ""
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${kindColor(n.kind)}`}
                    >
                      {kindIcon(n.kind)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-tight ${!n.read ? "font-semibold text-sand-900" : "font-medium text-sand-700"}`}
                      >
                        {n.title}
                      </p>
                      <p className="text-xs text-sand-500 mt-0.5 leading-snug">
                        {n.body}
                      </p>
                      <p className="text-xs text-sand-400 mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      {!n.read && (
                        <div className="w-2 h-2 rounded-full bg-fairway-500 mt-1" />
                      )}
                      <button
                        onClick={(e) => dismiss(n.id, e)}
                        className="text-sand-300 hover:text-sand-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {notifs.length > 0 && (
              <div className="px-4 py-2 border-t border-sand-100">
                <button
                  onClick={clearAll}
                  className="text-xs text-sand-400 hover:text-sand-600 transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
