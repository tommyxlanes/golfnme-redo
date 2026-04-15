"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, UserPlus, Check, XCircle, Loader2 } from "lucide-react";

export default function AddFriendPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Search users
  const search = async () => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/friends/search?query=${query}`);

      if (!res.ok) throw new Error("Search failed");

      const data = await res.json();
      setResults(data.users ?? []);
    } catch (err) {
      setError("Failed to search users.");
    } finally {
      setLoading(false);
    }
  };

  // Send friend request
  const sendRequest = async (username: string) => {
    setSendingId(username);
    setError("");

    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        body: JSON.stringify({ username }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to send request");
        return;
      }

      // Update UI
      setResults((prev) =>
        prev.map((u) =>
          u.username === username ? { ...u, hasPendingRequest: true } : u
        )
      );
    } catch (err) {
      setError("Request failed.");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-sand-900">Add Friends</h1>
        <p className="text-sand-600 mb-6">
          Search for players by username to send friend requests.
        </p>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="w-5 h-5 text-sand-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={search}
            className="input pl-10 border-sand-300"
          />
        </div>

        {error && (
          <div className="text-red-600 mb-4 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Search Results */}
        <div className="space-y-3">
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-sand-600" />
            </div>
          )}

          {!loading && results.length === 0 && query.length > 1 && (
            <p className="text-sand-500 text-center">No golfers found.</p>
          )}

          {results.map((user) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-white rounded-xl shadow-sm border border-sand-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <img
                  src={user.avatarUrl || "/default-avatar.png"}
                  className="w-12 h-12 rounded-full object-cover"
                />

                <div>
                  <p className="font-semibold text-sand-900">{user.name}</p>
                  <p className="text-sand-500 text-sm">@{user.username}</p>
                </div>
              </div>

              {/* Right side actions */}
              {user.isFriend ? (
                <div className="text-fairway-600 font-medium flex items-center gap-1">
                  <Check className="w-4 h-4" /> Friends
                </div>
              ) : user.hasPendingRequest ? (
                <div className="text-sand-500 font-medium">Pending</div>
              ) : (
                <button
                  disabled={sendingId === user.username}
                  onClick={() => sendRequest(user.username)}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {sendingId === user.username ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Add
                </button>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
