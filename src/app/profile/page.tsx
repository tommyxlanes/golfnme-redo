"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  User,
  AtSign,
  Mail,
  Flag,
  Save,
  Loader2,
  Check,
  Trash2,
  AlertCircle,
  Trophy,
  BarChart3,
  Calendar,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
  handicap: number | null;
}

interface Stats {
  totalRounds: number;
  averageScore: number;
  bestRound: number | null;
  handicapIndex: number | null;
}

// ─────────────────────────────────────────────
// Avatar Upload Component
// ─────────────────────────────────────────────
function AvatarUpload({
  avatarUrl,
  name,
  onUploaded,
}: {
  avatarUrl: string | null;
  name: string | null;
  onUploaded: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const current = preview ?? avatarUrl;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    setError("");

    try {
      const form = new FormData();
      form.append("avatar", file);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: form,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Upload failed");

      onUploaded(data.avatarUrl);
      setPreview(null); // use real URL now
    } catch (err: any) {
      setError(err.message);
      setPreview(null);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setUploading(true);
    setError("");
    try {
      await fetch("/api/user/avatar", { method: "DELETE" });
      onUploaded(null);
      setPreview(null);
    } catch {
      setError("Failed to remove avatar");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar circle */}
      <div className="relative group">
        <div className="w-28 h-28 rounded-full overflow-hidden bg-fairway-100 text-fairway-600 flex items-center justify-center ring-4 ring-white shadow-lg">
          {uploading ? (
            <Loader2 className="w-8 h-8 animate-spin text-fairway-400" />
          ) : current ? (
            <img
              src={current}
              alt="Avatar"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <User className="w-12 h-12" />
          )}
        </div>

        {/* Camera overlay */}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        >
          <Camera className="w-7 h-7 text-white" />
        </button>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn btn-outline text-sm px-4 py-2 disabled:opacity-50"
        >
          <Camera className="w-4 h-4" />
          {current ? "Change" : "Upload"} Photo
        </button>
        {current && (
          <button
            onClick={handleRemove}
            disabled={uploading}
            className="p-2 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-sand-400">JPEG, PNG, WebP · max 5MB</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const { data: session, update } = useSession();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    username: "",
    handicap: "",
  });

  // ── Load profile + stats ───────────────────
  useEffect(() => {
    async function load() {
      try {
        const [profileRes, statsRes] = await Promise.all([
          fetch("/api/user/profile"),
          fetch("/api/stats?type=overview"),
        ]);
        const profileData = await profileRes.json();
        const statsData = await statsRes.json();

        const u = profileData.user;
        setProfile(u);
        setForm({
          name: u.name ?? "",
          username: u.username ?? "",
          handicap: u.handicap?.toString() ?? "",
        });
        setStats(statsData.data ?? null);
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Save profile ───────────────────────────
  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          username: form.username,
          handicap: form.handicap ? parseFloat(form.handicap) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setProfile((prev) => (prev ? { ...prev, ...data.user } : prev));
      await update({ name: form.name, username: form.username });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-sand-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-fairway-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-50 transition-colors">
      {/* Header */}
      <header className="bg-fairway-gradient text-white">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display text-2xl font-bold">Profile</h1>
              <p className="text-white/60 text-sm">Manage your account</p>
            </div>
          </div>

          {/* Avatar */}
          <div className="flex justify-center">
            <AvatarUpload
              avatarUrl={profile?.avatarUrl ?? null}
              name={profile?.name ?? null}
              onUploaded={(url) =>
                setProfile((p) => (p ? { ...p, avatarUrl: url } : p))
              }
            />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: "Rounds",
                value: stats.totalRounds.toString(),
                icon: <Calendar className="w-4 h-4" />,
              },
              {
                label: "Best",
                value: stats.bestRound?.toString() ?? "—",
                icon: <Trophy className="w-4 h-4" />,
              },
              {
                label: "Handicap",
                value: stats.handicapIndex?.toFixed(1) ?? "—",
                icon: <BarChart3 className="w-4 h-4" />,
              },
            ].map(({ label, value, icon }) => (
              <div key={label} className="card p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-sand-400 mb-1">
                  {icon}
                  <span className="text-xs">{label}</span>
                </div>
                <p className="font-display text-2xl font-bold text-sand-900">
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Profile form */}
        <div className="card p-6 space-y-5">
          <h2 className="font-display text-lg font-semibold text-sand-900">
            Personal Info
          </h2>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="input-label flex items-center gap-2">
              <User className="w-4 h-4 text-sand-400" /> Display Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your full name"
              className="input"
            />
          </div>

          {/* Username */}
          <div>
            <label className="input-label flex items-center gap-2">
              <AtSign className="w-4 h-4 text-sand-400" /> Username
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) =>
                setForm({
                  ...form,
                  username: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, ""),
                })
              }
              placeholder="username"
              className="input"
              maxLength={20}
            />
            <p className="text-xs text-sand-400 mt-1">
              Letters, numbers, underscores only
            </p>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="input-label flex items-center gap-2">
              <Mail className="w-4 h-4 text-sand-400" /> Email
            </label>
            <input
              type="email"
              value={profile?.email ?? ""}
              className="input opacity-60 bg-sand-50"
            />
            <p className="text-xs text-sand-400 mt-1">
              Email cannot be changed
            </p>
          </div>

          {/* Handicap */}
          <div>
            <label className="input-label flex items-center gap-2">
              <Flag className="w-4 h-4 text-sand-400" /> Handicap Index
            </label>
            <input
              type="number"
              value={form.handicap}
              onChange={(e) => setForm({ ...form, handicap: e.target.value })}
              placeholder="e.g. 14.2"
              step="0.1"
              min="0"
              max="54"
              className="input"
            />
            <p className="text-xs text-sand-400 mt-1">
              Will be recalculated automatically as you play
            </p>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </span>
            ) : saved ? (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" /> Saved!
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Changes
              </span>
            )}
          </button>
        </div>

        {/* Danger zone */}
        <div className="card p-6 border border-red-100">
          <h2 className="font-display text-lg font-semibold text-sand-900 mb-4">
            Danger Zone
          </h2>
          <button
            onClick={() => {
              if (confirm("Are you sure? This cannot be undone.")) {
                // TODO: implement account deletion
              }
            }}
            className="btn w-full border-2 border-red-200 text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      </main>
    </div>
  );
}
