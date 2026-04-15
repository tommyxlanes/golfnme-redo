"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Users,
  Search,
  UserPlus,
  Check,
  X,
  Mail,
  ChevronRight,
  Flag,
  Swords,
} from "lucide-react";

export default function FriendsPage() {
  const router = useRouter();

  // --- REAL DATA ---
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "find">(
    "friends"
  );
  const [selectedFriend, setSelectedFriend] = useState<any | null>(null);

  // ============================================
  // FETCH FRIENDS + REQUESTS
  // ============================================
  useEffect(() => {
    async function load() {
      try {
        const [friendsRes, requestsRes] = await Promise.all([
          fetch("/api/friends"),
          fetch("/api/friends?type=requests"),
        ]);

        const friendsData = await friendsRes.json();
        const requestsData = await requestsRes.json();

        setFriends(friendsData ?? []);
        setRequests(requestsData ?? []);
      } catch (e) {
        console.error("Failed loading friends", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // ============================================
  // ACCEPT REQUEST
  // ============================================
  async function handleAcceptRequest(requestId: string) {
    try {
      const res = await fetch("/api/friends", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "accept" }),
      });

      if (!res.ok) return;

      const req = requests.find((r) => r.id === requestId);

      // Add as friend
      if (req?.sender) {
        setFriends((prev) => [
          ...prev,
          {
            ...req.sender,
            friendshipId: req.id,
            mutualRounds: 0,
            headToHead: { wins: 0, losses: 0, ties: 0 },
          },
        ]);
      }

      // Remove from request list
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error("Error accepting request", err);
    }
  }

  // ============================================
  // DECLINE REQUEST
  // ============================================
  async function handleDeclineRequest(requestId: string) {
    try {
      const res = await fetch("/api/friends", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "decline" }),
      });

      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch (err) {
      console.error("Error declining request", err);
    }
  }

  // ============================================
  // FILTER FRIEND LIST
  // ============================================
  const filteredFriends = friends.filter((f) => {
    return (
      f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // ============================================
  // UI RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-fairway-gradient text-white">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display text-2xl font-bold">Friends</h1>
              <p className="text-white/70 text-sm">{friends.length} friends</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {[
              {
                id: "friends" as const,
                label: "Friends",
                count: friends.length,
              },
              {
                id: "requests" as const,
                label: "Requests",
                count: requests.length,
              },
              { id: "find" as const, label: "Find Friends" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "bg-white text-fairway-700"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      activeTab === tab.id
                        ? "bg-fairway-100 text-fairway-700"
                        : "bg-white/20 text-white"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* FRIENDS TAB */}
        {activeTab === "friends" && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-400" />
              <input
                type="text"
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-12"
              />
            </div>

            {/* Friends List */}
            <div className="card divide-y divide-sand-100">
              {filteredFriends.map((friend) => (
                <motion.button
                  key={friend.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedFriend(friend)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-fairway-100 text-fairway-600 flex items-center justify-center font-bold text-lg">
                    {friend.name?.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sand-900">{friend.name}</p>
                    <p className="text-sm text-sand-500">@{friend.username}</p>
                  </div>

                  <div className="text-right">
                    <p className="font-mono text-sm font-medium text-fairway-600">
                      {friend.handicap ?? "-"}
                    </p>
                    <p className="text-xs text-sand-500">Handicap</p>
                  </div>

                  <ChevronRight className="w-5 h-5 text-sand-300" />
                </motion.button>
              ))}

              {!loading && filteredFriends.length === 0 && (
                <div className="p-8 text-center text-sand-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No friends found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* REQUESTS TAB */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            {requests.length > 0 ? (
              <div className="card divide-y divide-sand-100">
                {requests.map((request) => (
                  <div key={request.id} className="flex items-center gap-4 p-4">
                    <div className="w-12 h-12 rounded-full bg-gold-100 text-gold-600 flex items-center justify-center font-bold text-lg">
                      {request.sender?.name?.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1">
                      <p className="font-medium text-sand-900">
                        {request.sender?.name}
                      </p>
                      <p className="text-sm text-sand-500">
                        @{request.sender?.username}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(request.id)}
                        className="p-2 rounded-lg bg-birdie/20 text-birdie hover:bg-birdie/30"
                      >
                        <Check className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => handleDeclineRequest(request.id)}
                        className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-8 text-center text-sand-500">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No pending friend requests</p>
              </div>
            )}
          </div>
        )}

        {/* FIND FRIENDS TAB (can hook up search later) */}
        {activeTab === "find" && (
          <div className="space-y-4">
            <button
              onClick={() => router.push("/friends/add")}
              className="btn btn-primary w-full"
            >
              <UserPlus className="w-5 h-5" />
              Search for Friends
            </button>
          </div>
        )}
      </main>

      {/* FRIEND PROFILE MODAL */}
      <AnimatePresence>
        {selectedFriend && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFriend(null)}
            />

            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 max-h-[85vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
            >
              <div className="p-6">
                <h3 className="font-display text-xl font-semibold text-sand-900 mb-4">
                  {selectedFriend.name}
                </h3>

                <p className="text-sand-600">@{selectedFriend.username}</p>

                <div className="mt-4">
                  <button
                    onClick={() =>
                      router.push(`/session/new?invite=${selectedFriend.id}`)
                    }
                    className="btn btn-gold w-full"
                  >
                    <Flag className="w-5 h-5" />
                    Challenge to a Round
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
