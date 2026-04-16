"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Flag,
  Calendar,
  MapPin,
  ChevronRight,
  Filter,
  Trophy,
  TrendingUp,
  TrendingDown,
  Users,
  User,
  Search,
  Loader2,
  AlertCircle,
  Plus,
  BarChart3,
  X,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Round {
  id: string;
  playedAt: string;
  weather: string | null;
  notes: string | null;
  totalScore: number | null;
  totalPutts: number | null;
  fairwaysHit: number | null;
  greensInReg: number | null;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  sessionId: string | null;
  course: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    par: number;
    numHoles: number;
  };
  scores: Array<{ hole: { par: number } }>;
}

type FilterMode = "all" | "solo" | "group";
type SortMode = "newest" | "oldest" | "best" | "worst";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function getCoursePar(round: Round) {
  return (
    (round.course?.par ?? round.scores.reduce((s, sc) => s + sc.hole.par, 0)) ||
    72
  );
}

function scoreToPar(round: Round) {
  return round.totalScore ? round.totalScore - getCoursePar(round) : 0;
}

function scoreColor(diff: number) {
  if (diff <= -2) return "text-eagle";
  if (diff === -1) return "text-birdie";
  if (diff === 0) return "text-par";
  if (diff <= 5) return "text-bogey";
  return "text-double";
}

function scoreBg(diff: number) {
  if (diff <= -2)
    return "bg-eagle/10 text-eagle";
  if (diff === -1)
    return "bg-birdie/10 text-birdie";
  if (diff === 0)
    return "bg-sand-100 text-sand-700";
  if (diff <= 5)
    return "bg-bogey/10 text-bogey";
  return "bg-double/10 text-double";
}

function weatherEmoji(w: string | null) {
  if (!w) return "";
  if (w === "sunny") return "☀️";
  if (w === "cloudy") return "☁️";
  if (w === "rainy") return "🌧️";
  if (w === "windy") return "💨";
  return "";
}

// ─────────────────────────────────────────────
// Summary bar — shows best, avg, total at top
// ─────────────────────────────────────────────
function SummaryBar({ rounds }: { rounds: Round[] }) {
  const completed = rounds.filter(
    (r) => r.status === "COMPLETED" && r.totalScore,
  );
  if (completed.length === 0) return null;

  const scores = completed.map((r) => r.totalScore!);
  const best = Math.min(...scores);
  const avg =
    Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  const bestRound = completed.find((r) => r.totalScore === best);
  const bestPar = bestRound ? getCoursePar(bestRound) : 72;

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      {[
        {
          label: "Rounds",
          value: completed.length.toString(),
          icon: <Flag className="w-4 h-4" />,
        },
        {
          label: "Best",
          value: best.toString(),
          sub: `${best - bestPar > 0 ? "+" : ""}${best - bestPar}`,
          icon: <Trophy className="w-4 h-4" />,
        },
        {
          label: "Average",
          value: avg.toFixed(1),
          icon: <BarChart3 className="w-4 h-4" />,
        },
      ].map(({ label, value, sub, icon }) => (
        <div key={label} className="card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-sand-500 mb-1">
            {icon}
            <span className="text-xs">{label}</span>
          </div>
          <p className="font-display text-2xl font-bold text-sand-900">
            {value}
          </p>
          {sub && (
            <p className="text-xs text-birdie font-medium mt-0.5">
              {sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Round Row
// ─────────────────────────────────────────────
function RoundRow({
  round,
  index,
  onClick,
}: {
  round: Round;
  index: number;
  onClick: () => void;
}) {
  const diff = scoreToPar(round);
  const par = getCoursePar(round);
  const isGroup = !!round.sessionId;
  const holes = round.scores.length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className="flex items-center gap-4 p-4 hover:bg-sand-50 transition-colors cursor-pointer"
    >
      {/* Score bubble */}
      <div
        className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-display font-bold shrink-0 ${scoreBg(diff)}`}
      >
        <span className="text-xl leading-none">{round.totalScore ?? "—"}</span>
        {round.totalScore && (
          <span className="text-xs font-medium leading-none mt-0.5">
            {diff > 0 ? "+" : ""}
            {diff}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sand-900 truncate">
            {round.course.name}
          </p>
          {isGroup && (
            <span className="text-xs bg-gold-100 text-gold-700 px-2 py-0.5 rounded-full shrink-0">
              Group
            </span>
          )}
          {round.status === "IN_PROGRESS" && (
            <span className="text-xs bg-fairway-100 text-fairway-700 px-2 py-0.5 rounded-full shrink-0 animate-pulse">
              In Progress
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-sand-500 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(round.playedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          {(round.course.city || round.course.state) && (
            <span className="flex items-center gap-1 hidden sm:flex">
              <MapPin className="w-3.5 h-3.5" />
              {[round.course.city, round.course.state]
                .filter(Boolean)
                .join(", ")}
            </span>
          )}
          <span className="font-mono">Par {par}</span>
          {holes > 0 && holes < round.course.numHoles && (
            <span>
              {holes}/{round.course.numHoles} holes
            </span>
          )}
          {weatherEmoji(round.weather) && (
            <span>{weatherEmoji(round.weather)}</span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
        {round.totalPutts && (
          <span className="text-xs text-sand-500">
            {round.totalPutts} putts
          </span>
        )}
        {round.fairwaysHit != null && (
          <span className="text-xs text-sand-500">
            {round.fairwaysHit} FIR
          </span>
        )}
      </div>
      <ChevronRight className="w-5 h-5 text-sand-300 shrink-0" />
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function RoundsPage() {
  const router = useRouter();

  const [allRounds, setAllRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Fetch all completed + in-progress rounds
  useEffect(() => {
    async function fetch_() {
      setLoading(true);
      setError(null);
      try {
        const [completedRes, inProgressRes] = await Promise.all([
          fetch("/api/rounds?status=COMPLETED&take=100"),
          fetch("/api/rounds?status=IN_PROGRESS&take=10"),
        ]);
        const completedData = completedRes.ok ? await completedRes.json() : {};
        const inProgressData = inProgressRes.ok
          ? await inProgressRes.json()
          : {};
        const all = [
          ...(inProgressData.data?.items ?? inProgressData.items ?? []),
          ...(completedData.data?.items ?? completedData.items ?? []),
        ];
        setAllRounds(all);
      } catch (e: any) {
        setError(e.message ?? "Failed to load rounds");
      } finally {
        setLoading(false);
      }
    }
    fetch_();
  }, []);

  const filtered = useMemo(() => {
    let rounds = [...allRounds];

    // Filter mode
    if (filterMode === "solo") rounds = rounds.filter((r) => !r.sessionId);
    if (filterMode === "group") rounds = rounds.filter((r) => !!r.sessionId);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      rounds = rounds.filter(
        (r) =>
          r.course.name.toLowerCase().includes(q) ||
          r.course.city?.toLowerCase().includes(q) ||
          r.course.state?.toLowerCase().includes(q),
      );
    }

    // Sort
    rounds.sort((a, b) => {
      if (sortMode === "newest")
        return new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime();
      if (sortMode === "oldest")
        return new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime();
      if (sortMode === "best")
        return (a.totalScore ?? 999) - (b.totalScore ?? 999);
      if (sortMode === "worst")
        return (b.totalScore ?? 0) - (a.totalScore ?? 0);
      return 0;
    });

    return rounds;
  }, [allRounds, filterMode, sortMode, search]);

  // Group by month
  const grouped = useMemo(() => {
    const groups: Record<string, Round[]> = {};
    for (const round of filtered) {
      const key = new Date(round.playedAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      (groups[key] ||= []).push(round);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-sand-50 transition-colors">
      {/* Header */}
      <header className="bg-fairway-gradient text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold">Round History</h1>
              <p className="text-white/70 text-sm">
                {loading
                  ? "Loading…"
                  : `${allRounds.length} round${allRounds.length !== 1 ? "s" : ""} total`}
              </p>
            </div>
            <button
              onClick={() => router.push("/round/new")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> New Round
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
            <input
              type="text"
              placeholder="Search by course or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-12 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Filter + Sort bar */}
      <div className="sticky top-0 z-10 bg-sand-50/90 backdrop-blur-lg border-b border-sand-200 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {/* Filter tabs */}
          {(["all", "solo", "group"] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filterMode === mode
                  ? "bg-fairway-500 text-white"
                  : "bg-sand-100 text-sand-600 hover:bg-sand-200"
              }`}
            >
              {mode === "solo" && <User className="w-3.5 h-3.5" />}
              {mode === "group" && <Users className="w-3.5 h-3.5" />}
              {mode === "all" && <Flag className="w-3.5 h-3.5" />}
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}

          <div className="w-px h-5 bg-sand-200 mx-1 shrink-0" />

          {/* Sort */}
          {(
            [
              { id: "newest", label: "Newest" },
              { id: "oldest", label: "Oldest" },
              { id: "best", label: "Best Score" },
              { id: "worst", label: "Worst Score" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSortMode(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                sortMode === id
                  ? "bg-sand-700 text-white"
                  : "bg-sand-100 text-sand-600 hover:bg-sand-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-sand-200" />
                  <div className="flex-1">
                    <div className="h-4 bg-sand-200 rounded w-40 mb-2" />
                    <div className="h-3 bg-sand-200 rounded w-28" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card p-10 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-sand-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-outline mx-auto"
            >
              Try Again
            </button>
          </div>
        ) : filtered.length === 0 && allRounds.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-fairway-100 mx-auto mb-4 flex items-center justify-center">
              <Flag className="w-10 h-10 text-fairway-500" />
            </div>
            <h3 className="font-display text-xl font-bold text-sand-900 mb-2">
              No rounds yet
            </h3>
            <p className="text-sand-500 mb-6">
              Start tracking your golf game by playing your first round.
            </p>
            <button
              onClick={() => router.push("/round/new")}
              className="btn btn-primary mx-auto"
            >
              <Plus className="w-5 h-5" /> Start First Round
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <Search className="w-12 h-12 text-sand-300 mx-auto mb-4" />
            <p className="text-sand-600">
              No rounds match your filters.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setFilterMode("all");
              }}
              className="text-fairway-600 text-sm font-medium mt-3 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <SummaryBar rounds={filtered} />

            <div className="space-y-8">
              {Object.entries(grouped).map(([month, rounds]) => (
                <div key={month}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="font-display text-sm font-semibold text-sand-500 uppercase tracking-wider">
                      {month}
                    </h2>
                    <div className="flex-1 h-px bg-sand-200" />
                    <span className="text-xs text-sand-400">
                      {rounds.length} round{rounds.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="card overflow-hidden divide-y divide-sand-100">
                    {rounds.map((round, i) => (
                      <RoundRow
                        key={round.id}
                        round={round}
                        index={i}
                        onClick={() =>
                          router.push(
                            round.status === "IN_PROGRESS"
                              ? `/round/${round.id}`
                              : `/round/${round.id}/summary`,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
