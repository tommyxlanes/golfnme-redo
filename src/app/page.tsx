"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flag,
  Users,
  Trophy,
  TrendingUp,
  Calendar,
  MapPin,
  Plus,
  ChevronRight,
  User,
  Settings,
  BarChart3,
  History,
  UserPlus,
  Play,
  Zap,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import type {
  Round,
  Course,
  Score,
  Hole,
  Friend,
  FriendRequest,
  PaginatedResponse,
} from "@/types";
import Image from "next/image";
import { NotificationBell } from "@/components/NotificationBell";

// ============================================
// TYPES - Matching stats.service.ts exactly
// ============================================

interface OverviewStats {
  totalRounds: number;
  averageScore: number;
  bestRound: number | null;
  worstRound: number | null;
  handicapIndex: number | null;
  scoringDistribution: {
    eagles: number;
    birdies: number;
    pars: number;
    bogeys: number;
    doubleBogeys: number;
    worse: number;
  };
  parPerformance: {
    par3Average: number;
    par4Average: number;
    par5Average: number;
  };
  fairwayPercentage: number;
  girPercentage: number;
  averagePutts: number;
  recentScores: Array<{
    date: string;
    score: number;
    courseName: string;
    par: number;
  }>;
}

interface RoundWithDetails extends Round {
  course: Course & { holes?: Hole[] };
  scores: (Score & { hole: Hole })[];
}

function useActiveSessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const [waitingRes, inProgressRes] = await Promise.all([
          fetch("/api/sessions?status=WAITING"),
          fetch("/api/sessions?status=IN_PROGRESS"),
        ]);

        const waitingData = waitingRes.ok
          ? await waitingRes.json()
          : { data: [] };
        const inProgressData = inProgressRes.ok
          ? await inProgressRes.json()
          : { data: [] };

        const allSessions = [
          ...(inProgressData.data ?? []),
          ...(waitingData.data ?? []),
        ];

        setSessions(allSessions);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load sessions",
        );
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  return {
    sessions,
    loading,
    error,
    refetch: () => {
      setLoading(true);
    },
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function calculateScoreToPar(round: RoundWithDetails): number {
  if (!round.totalScore) return 0;
  const coursePar =
    round.course?.par ??
    (round.scores?.reduce((sum, s) => sum + s.hole.par, 0) || 72);
  return round.totalScore - coursePar;
}

function getCoursePar(round: RoundWithDetails): number {
  return (
    round.course?.par ??
    (round.scores?.reduce((sum, s) => sum + s.hole.par, 0) || 72)
  );
}

// ============================================
// DATA FETCHING HOOKS
// ============================================

function useStats() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats?type=overview");
        if (!res.ok) {
          if (res.status === 401) {
            setStats(null);
            return;
          }
          throw new Error("Failed to fetch stats");
        }
        const json = await res.json();
        setStats(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return { stats, loading, error };
}

function useRounds(
  options: {
    status?: Round["status"];
    limit?: number;
  } = {},
) {
  const [data, setData] = useState<PaginatedResponse<RoundWithDetails> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRounds() {
      try {
        const params = new URLSearchParams();
        if (options.status) params.set("status", options.status);
        if (options.limit) params.set("take", options.limit.toString());

        const res = await fetch(`/api/rounds?${params.toString()}`);
        if (!res.ok) {
          if (res.status === 401) {
            setData(null);
            return;
          }
          throw new Error("Failed to fetch rounds");
        }
        const result: PaginatedResponse<RoundWithDetails> = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load rounds");
      } finally {
        setLoading(false);
      }
    }
    fetchRounds();
  }, [options.status, options.limit]);

  return { data, loading, error };
}

function SessionsTab() {
  const router = useRouter();
  const { sessions, loading, error } = useActiveSessions();

  const inProgressSessions = sessions.filter((s) => s.status === "IN_PROGRESS");
  const waitingSessions = sessions.filter((s) => s.status === "WAITING");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-sand-900">
          Active Sessions
        </h2>
        <div className="flex gap-3">
          <button
            className="btn btn-gold"
            onClick={() => router.push("/session/new")}
          >
            <Plus className="w-5 h-5" />
            Create
          </button>
          <button
            className="btn btn-outline"
            onClick={() => router.push("/session/join")}
          >
            <Zap className="w-5 h-5" />
            Join
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-sand-200" />
                <div className="flex-1">
                  <div className="h-4 bg-sand-200 rounded w-32 mb-2" />
                  <div className="h-3 bg-sand-200 rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-sand-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-outline mt-4"
          >
            Try Again
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="card p-8 text-center">
          <Users className="w-12 h-12 text-sand-300 mx-auto mb-4" />
          <p className="text-sand-600 mb-4">
            No active sessions. Create one or join with an invite code!
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => router.push("/session/new")}
              className="btn btn-gold"
            >
              <Plus className="w-5 h-5" />
              Create Session
            </button>
            <button
              onClick={() => router.push("/session/join")}
              className="btn btn-outline"
            >
              <Zap className="w-5 h-5" />
              Join Session
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* In Progress Sessions */}
          {inProgressSessions.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-semibold text-sand-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-birdie animate-pulse" />
                In Progress
              </h3>
              {inProgressSessions.map((session, index) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  index={index}
                  onClick={() => router.push(`/session/${session.inviteCode}`)}
                />
              ))}
            </div>
          )}

          {/* Waiting Sessions */}
          {waitingSessions.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-semibold text-sand-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gold-500" />
                Waiting to Start
              </h3>
              {waitingSessions.map((session, index) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  index={index}
                  onClick={() => router.push(`/session/${session.inviteCode}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function SessionCard({
  session,
  index,
  onClick,
}: {
  session: any;
  index: number;
  onClick: () => void;
}) {
  const isInProgress = session.status === "IN_PROGRESS";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="card p-3 sm:p-4 hover:shadow-card-hover cursor-pointer transition-all"
      onClick={onClick}
    >
      {/* Mobile Layout */}
      <div className="sm:hidden">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isInProgress
                ? "bg-fairway-100 text-fairway-600"
                : "bg-gold-100 text-gold-600"
            }`}
          >
            {isInProgress ? (
              <Play className="w-5 h-5" />
            ) : (
              <Users className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sand-900 truncate">
                {session.course?.name ?? "Golf Session"}
              </p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  isInProgress
                    ? "bg-fairway-100 text-fairway-700"
                    : "bg-gold-100 text-gold-700"
                }`}
              >
                {isInProgress ? "Playing" : "Lobby"}
              </span>
            </div>
            <p className="text-sm text-sand-500 mt-1">
              Hosted by{" "}
              <span className="text-sand-700 font-medium">
                {session.host?.name || session.host?.username || "Unknown"}
              </span>
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-sand-400 shrink-0 mt-2" />
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-sand-100">
          <span className="flex items-center gap-1.5 text-sm text-sand-500">
            <Users className="w-4 h-4" />
            {session.members?.length ?? 1} / {session.maxPlayers} players
          </span>
          <span className="font-mono text-sm text-sand-500 bg-sand-50 px-2 py-0.5 rounded">
            {session.inviteCode}
          </span>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:flex gap-4 items-center">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            isInProgress
              ? "bg-fairway-100 text-fairway-600"
              : "bg-gold-100 text-gold-600"
          }`}
        >
          {isInProgress ? (
            <Play className="w-6 h-6" />
          ) : (
            <Users className="w-6 h-6" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sand-900 truncate">
              {session.course?.name ?? "Golf Session"}
            </p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                isInProgress
                  ? "bg-fairway-100 text-fairway-700"
                  : "bg-gold-100 text-gold-700"
              }`}
            >
              {isInProgress ? "Playing" : "Lobby"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-sand-500 mt-0.5">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {session.members?.length ?? 1} / {session.maxPlayers} players
            </span>
            <span className="font-mono bg-sand-50 px-2 py-0.5 rounded text-xs">
              {session.inviteCode}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-sand-500">Host</p>
          <p className="font-medium text-sand-700">
            {session.host?.name || session.host?.username || "Unknown"}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-sand-400 shrink-0" />
      </div>
    </motion.div>
  );
}

function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFriends() {
      try {
        const [friendsRes, requestsRes] = await Promise.all([
          fetch("/api/friends"),
          fetch("/api/friends?type=requests"),
        ]);

        if (friendsRes.ok) {
          const data = await friendsRes.json();
          setFriends(data.items ?? data);
        }

        if (requestsRes.ok) {
          const data = await requestsRes.json();
          setPendingRequests(data.items ?? data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load friends");
      } finally {
        setLoading(false);
      }
    }
    fetchFriends();
  }, []);

  return {
    friends,
    pendingRequests,
    loading,
    error,
    setFriends,
    setPendingRequests,
  };
}

function useInProgressRound() {
  const { data, loading } = useRounds({ status: "IN_PROGRESS", limit: 1 });
  return {
    round: data?.items?.[0] ?? null,
    loading,
  };
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<
    "play" | "sessions" | "history" | "stats" | "friends"
  >("play");

  const { stats, loading: statsLoading } = useStats();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-sand-50 flex items-center justify-center transition-colors">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-fairway-600 mx-auto mb-4" />
          <p className="text-sand-600">Loading...</p>
        </div>
      </div>
    );
  }

  const user = session?.user
    ? {
        name: session.user.name || "Golfer",
        username: session.user.username || "golfer",
        handicap: session.user.handicap || null,
      }
    : null;

  const displayStats = {
    totalRounds: stats?.totalRounds ?? 0,
    averageScore: stats?.averageScore ?? 0,
    bestRound: stats?.bestRound ?? null,
    handicapIndex: stats?.handicapIndex ?? null,
  };

  console.log(user);

  return (
    <div className="min-h-screen bg-sand-50 transition-colors">
      {/* Header */}
      <header className="bg-fairway-gradient text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-1">
              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center">
                <Image
                  src="/golf-me-logo.png"
                  alt="GolfnMe"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-display text-xl font-semibold">
                GolfnMe
              </span>
            </div>

            <div className="flex items-center gap-4">
              <NotificationBell />
              <UserMenu />
            </div>
          </div>
        </div>

        {/* Hero Stats */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-4">
          {statsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 animate-pulse"
                >
                  <div className="h-4 bg-white/20 rounded w-20 mb-2" />
                  <div className="h-8 bg-white/20 rounded w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatBadge
                label="Rounds Played"
                value={displayStats.totalRounds.toString()}
                icon={<Flag className="w-4 h-4" />}
              />
              <StatBadge
                label="Average Score"
                value={
                  displayStats.averageScore > 0
                    ? displayStats.averageScore.toFixed(1)
                    : "-"
                }
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <StatBadge
                label="Best Round"
                value={displayStats.bestRound?.toString() ?? "-"}
                icon={<Trophy className="w-4 h-4" />}
              />
              <StatBadge
                label="Handicap Index"
                value={displayStats.handicapIndex?.toFixed(1) ?? "-"}
                icon={<BarChart3 className="w-4 h-4" />}
              />
            </div>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="sticky top-0 z-10 bg-sand-50/80 backdrop-blur-lg border-b border-sand-200 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 py-3">
            {[
              { id: "play" as const, label: "Play", icon: Play },
              { id: "sessions" as const, label: "Sessions", icon: Zap },
              { id: "history" as const, label: "History", icon: History },
              { id: "stats" as const, label: "Stats", icon: BarChart3 },
              { id: "friends" as const, label: "Friends", icon: Users },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-fairway-500 text-white shadow-lg shadow-fairway-500/20"
                    : "text-sand-600 hover:bg-sand-100"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === "play" && <PlayTab key="play" />}
          {activeTab === "sessions" && <SessionsTab key="sessions" />}
          {activeTab === "history" && <HistoryTab key="history" />}
          {activeTab === "stats" && <StatsTab key="stats" />}
          {activeTab === "friends" && <FriendsTab key="friends" />}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ============================================
// STAT BADGE COMPONENT
// ============================================

function StatBadge({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 text-white/60 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p
        className={`text-2xl font-bold font-display ${
          highlight ? "text-gold-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ============================================
// PLAY TAB
// ============================================

function PlayTab() {
  const router = useRouter();
  const { round: inProgressRound, loading: inProgressLoading } =
    useInProgressRound();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="grid md:grid-cols-2 gap-6">
        {/* Solo Play Card */}
        <motion.div
          whileHover={{ y: -4 }}
          className="card overflow-hidden group cursor-pointer"
          onClick={() => router.push("/round/new")}
        >
          <div className="relative h-48 bg-fairway-gradient flex items-center justify-center">
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />
            <div className="relative text-center text-white">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mx-auto mb-4 flex items-center justify-center">
                <User className="w-8 h-8" />
              </div>
              <h3 className="font-display text-2xl font-semibold">My Tee</h3>
              <p className="text-white/70 mt-1">Solo round tracking</p>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sand-600 mb-4">
              Track your score hole-by-hole, monitor putts, fairways, and greens
              in regulation.
            </p>
            <button
              className="btn btn-primary w-full"
              onClick={(e) => {
                e.stopPropagation();
                router.push("/round/new");
              }}
            >
              <Plus className="w-5 h-5" />
              Start New Round
            </button>
          </div>
        </motion.div>

        {/* Group Play Card */}
        <motion.div
          whileHover={{ y: -4 }}
          className="card overflow-hidden group cursor-pointer"
        >
          <div className="relative h-48 bg-gold-gradient flex items-center justify-center">
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />
            <div className="relative text-center text-fairway-900">
              <div className="w-16 h-16 rounded-2xl bg-white/30 backdrop-blur mx-auto mb-4 flex items-center justify-center">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="font-display text-2xl font-semibold">
                Group Compete
              </h3>
              <p className="text-fairway-800/70 mt-1">Real-time multiplayer</p>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sand-600 mb-4">
              Create a session, invite friends, and track scores in real-time
              with live leaderboards.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="btn btn-gold"
                onClick={() => router.push("/session/new")}
              >
                <Plus className="w-5 h-5" />
                Create
              </button>
              <button
                className="btn btn-outline"
                onClick={() => router.push("/session/join")}
              >
                <Zap className="w-5 h-5" />
                Join
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-display text-lg font-semibold text-sand-900">
            Quick Actions
          </h2>
        </div>
        <div className="divide-y divide-sand-100">
          <QuickActionRow
            icon={<MapPin className="w-5 h-5" />}
            label="Find Nearby Courses"
            description="Discover courses in your area"
            onClick={() => router.push("/courses")}
          />
          {inProgressLoading ? (
            <div className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-sand-100 animate-pulse" />
              <div className="flex-1">
                <div className="h-4 bg-sand-100 rounded w-32 mb-2 animate-pulse" />
                <div className="h-3 bg-sand-100 rounded w-48 animate-pulse" />
              </div>
            </div>
          ) : inProgressRound ? (
            <QuickActionRow
              icon={<History className="w-5 h-5" />}
              label="Continue Round"
              description={`Resume at ${
                inProgressRound.course?.name ?? "Unknown Course"
              } (${inProgressRound.scores?.length ?? 0}/${
                inProgressRound.course?.numHoles ?? 18
              } holes)`}
              onClick={() => router.push(`/round/${inProgressRound.id}`)}
            />
          ) : (
            <QuickActionRow
              icon={<History className="w-5 h-5" />}
              label="View Round History"
              description="See all your past rounds"
              onClick={() => router.push("/rounds")}
            />
          )}
          <QuickActionRow
            icon={<UserPlus className="w-5 h-5" />}
            label="Invite Friends"
            description="Share your invite code"
            onClick={() => router.push("/friends")}
          />
        </div>
      </div>
    </motion.div>
  );
}

function QuickActionRow({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 hover:bg-sand-50 transition-colors text-left"
    >
      <div className="w-10 h-10 rounded-xl bg-fairway-100 text-fairway-600 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sand-900">{label}</p>
        <p className="text-sm text-sand-500 truncate">{description}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-sand-400" />
    </button>
  );
}

// ============================================
// HISTORY TAB
// ============================================

function HistoryTab() {
  const router = useRouter();
  const { data, loading, error } = useRounds({
    status: "COMPLETED",
    limit: 20,
  });
  const [filter, setFilter] = useState<"all" | "solo" | "group">("all");

  const rounds = data?.items ?? [];

  const filteredRounds = useMemo(() => {
    return rounds.filter((round) => {
      if (filter === "all") return true;
      if (filter === "solo") return !round.sessionId;
      if (filter === "group") return !!round.sessionId;
      return true;
    });
  }, [rounds, filter]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-sand-900">
          Round History
        </h2>
        <button
          onClick={() => router.push("/rounds")}
          className="text-sm text-fairway-600 font-medium hover:underline flex items-center gap-1"
        >
          View All Rounds <ChevronRight className="w-4 h-4" />
        </button>
        <div className="tab-nav">
          <button
            className={`tab-item ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`tab-item ${filter === "solo" ? "active" : ""}`}
            onClick={() => setFilter("solo")}
          >
            Solo
          </button>
          <button
            className={`tab-item ${filter === "group" ? "active" : ""}`}
            onClick={() => setFilter("group")}
          >
            Group
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-sand-200" />
                <div className="flex-1">
                  <div className="h-4 bg-sand-200 rounded w-32 mb-2" />
                  <div className="h-3 bg-sand-200 rounded w-24" />
                </div>
                <div className="h-6 bg-sand-200 rounded w-12" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-sand-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-outline mt-4"
          >
            Try Again
          </button>
        </div>
      ) : filteredRounds.length === 0 ? (
        <div className="card p-8 text-center">
          <Flag className="w-12 h-12 text-sand-300 mx-auto mb-4" />
          <p className="text-sand-600 mb-4">
            No rounds yet. Start playing to see your history!
          </p>
          <button
            onClick={() => router.push("/round/new")}
            className="btn btn-primary"
          >
            <Plus className="w-5 h-5" />
            Start Your First Round
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRounds.map((round, index) => {
            const scoreToPar = calculateScoreToPar(round);
            const coursePar = getCoursePar(round);

            return (
              <motion.div
                key={round.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="card p-4 hover:shadow-card-hover cursor-pointer transition-all"
                onClick={() => router.push(`/round/${round.id}/summary`)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-fairway-100 text-fairway-600 flex items-center justify-center font-display font-bold text-lg">
                    {round.totalScore ?? "-"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sand-900">
                        {round.course?.name ?? "Unknown Course"}
                      </p>
                      {round.sessionId && (
                        <span className="text-xs bg-gold-100 text-gold-700 px-2 py-0.5 rounded-full">
                          Group
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-sand-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(round.playedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span>Par {coursePar}</span>
                    </div>
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      scoreToPar <= 0
                        ? "text-birdie"
                        : scoreToPar <= 10
                          ? "text-bogey"
                          : "text-double"
                    }`}
                  >
                    {scoreToPar > 0 ? "+" : ""}
                    {scoreToPar}
                  </div>
                  <ChevronRight className="w-5 h-5 text-sand-400" />
                </div>
              </motion.div>
            );
          })}

          {data?.hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={() => router.push("/rounds")}
                className="btn btn-outline"
              >
                View All Rounds
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ============================================
// STATS TAB
// ============================================

function StatsTab() {
  const router = useRouter();
  const { stats, loading, error } = useStats();

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="space-y-8"
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="stat-card animate-pulse">
              <div className="h-8 bg-sand-200 rounded w-16 mb-2" />
              <div className="h-4 bg-sand-200 rounded w-24" />
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (error || !stats || stats.totalRounds === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="card p-8 text-center"
      >
        <BarChart3 className="w-12 h-12 text-sand-300 mx-auto mb-4" />
        <p className="text-sand-600 mb-4">
          {error || "Play some rounds to see your statistics!"}
        </p>
        <button
          onClick={() => router.push("/round/new")}
          className="btn btn-primary"
        >
          <Plus className="w-5 h-5" />
          Start a Round
        </button>
      </motion.div>
    );
  }

  const scoringData = [
    {
      name: "Eagles",
      value: stats.scoringDistribution.eagles,
      color: "bg-eagle",
    },
    {
      name: "Birdies",
      value: stats.scoringDistribution.birdies,
      color: "bg-birdie",
    },
    {
      name: "Pars",
      value: stats.scoringDistribution.pars,
      color: "bg-par",
    },
    {
      name: "Bogeys",
      value: stats.scoringDistribution.bogeys,
      color: "bg-bogey",
    },
    {
      name: "Double+",
      value:
        stats.scoringDistribution.doubleBogeys +
        stats.scoringDistribution.worse,
      color: "bg-double",
    },
  ];

  const maxValue = Math.max(...scoringData.map((d) => d.value), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-sand-900">
          Performance Stats
        </h2>
        <button
          onClick={() => router.push("/stats")}
          className="text-sm text-fairway-600 font-medium hover:underline flex items-center gap-1"
        >
          View All
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-value">{stats.averageScore.toFixed(1)}</div>
          <div className="stat-label">Average Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.averagePutts.toFixed(1)}</div>
          <div className="stat-label">Avg Putts/Round</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.fairwayPercentage}%</div>
          <div className="stat-label">Fairway %</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.girPercentage}%</div>
          <div className="stat-label">GIR %</div>
        </div>
      </div>

      {/* Scoring Distribution */}
      <div className="card p-6">
        <h3 className="font-display text-lg font-semibold text-sand-900 mb-6">
          Scoring Distribution
        </h3>
        <div className="space-y-4">
          {scoringData.map((item) => (
            <div key={item.name} className="flex items-center gap-4">
              <span className="w-20 text-sm text-sand-600">{item.name}</span>
              <div className="flex-1 h-8 bg-sand-100 rounded-lg overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(item.value / maxValue) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className={`h-full ${item.color} rounded-lg`}
                />
              </div>
              <span className="w-12 text-right font-mono text-sm font-medium text-sand-700">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Par Performance */}
      <div className="card p-6">
        <h3 className="font-display text-lg font-semibold text-sand-900 mb-6">
          Par Performance
        </h3>
        <div className="grid grid-cols-3 gap-6">
          <ParPerformanceCard
            par={3}
            average={stats.parPerformance.par3Average}
          />
          <ParPerformanceCard
            par={4}
            average={stats.parPerformance.par4Average}
          />
          <ParPerformanceCard
            par={5}
            average={stats.parPerformance.par5Average}
          />
        </div>
      </div>

      {/* Recent Scores Chart */}
      {stats.recentScores.length > 0 && (
        <div className="card p-6">
          <h3 className="font-display text-lg font-semibold text-sand-900 mb-6">
            Recent Scores
          </h3>
          <div className="space-y-3">
            {stats.recentScores.map((round, i) => {
              const scoreToPar = round.score - round.par;
              return (
                <div key={i} className="flex items-center gap-4">
                  <div
                    className="w-24 text-sm text-sand-500 truncate"
                    title={round.courseName}
                  >
                    {round.courseName}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-6 bg-sand-100 rounded-lg overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min((round.score / 120) * 100, 100)}%`,
                        }}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                        className={`h-full rounded-lg ${
                          scoreToPar <= 0
                            ? "bg-birdie"
                            : scoreToPar <= 10
                              ? "bg-bogey"
                              : "bg-double"
                        }`}
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-sm font-medium text-sand-700">
                      {round.score}
                    </span>
                  </div>
                  <div
                    className={`w-12 text-right text-sm font-medium ${
                      scoreToPar <= 0
                        ? "text-birdie"
                        : scoreToPar <= 10
                          ? "text-bogey"
                          : "text-double"
                    }`}
                  >
                    {scoreToPar > 0 ? "+" : ""}
                    {scoreToPar}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ParPerformanceCard({
  par,
  average,
}: {
  par: number;
  average: number;
}) {
  const difference = average - par;

  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-2xl bg-fairway-100 mx-auto mb-3 flex items-center justify-center">
        <span className="font-display text-2xl font-bold text-fairway-600">
          {par}
        </span>
      </div>
      <p className="text-2xl font-bold text-sand-900">{average.toFixed(2)}</p>
      <p className="text-sm text-sand-500">Par {par} Average</p>
      <p
        className={`text-xs mt-1 ${
          difference <= 0 ? "text-birdie" : "text-bogey"
        }`}
      >
        {difference > 0 ? "+" : ""}
        {difference.toFixed(2)} vs par
      </p>
    </div>
  );
}

// ============================================
// FRIENDS TAB
// ============================================

function FriendsTab() {
  const router = useRouter();
  const {
    friends,
    pendingRequests,
    loading,
    error,
    setPendingRequests,
    setFriends,
  } = useFriends();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filteredFriends = useMemo(() => {
    return friends.filter(
      (friend) =>
        friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        friend.username.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [friends, searchQuery]);

  async function handleAcceptRequest(requestId: string) {
    setActionLoading(requestId);

    try {
      const res = await fetch(`/api/friends`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "accept" }),
      });

      if (res.ok) {
        const acceptedRequest = pendingRequests.find((r) => r.id === requestId);

        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));

        if (acceptedRequest?.sender) {
          const newFriend: Friend = {
            ...acceptedRequest.sender,
            friendshipId: requestId,
          };

          setFriends((prev) => [...prev, newFriend]);
        }
      }
    } catch (err) {
      console.error("Failed to accept request:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeclineRequest(requestId: string) {
    setActionLoading(requestId);

    try {
      const res = await fetch(`/api/friends`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "decline" }),
      });

      if (res.ok) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch (err) {
      console.error("Failed to decline request:", err);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-sand-900">
          Friends
        </h2>
        <button
          className="btn btn-primary"
          onClick={() => router.push("/friends/add")}
        >
          <UserPlus className="w-5 h-5" />
          Add Friend
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search friends by name or username..."
          className="input pl-12"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-400" />
      </div>

      {/* Friends List */}
      {loading ? (
        <div className="card divide-y divide-sand-100">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-sand-200" />
              <div className="flex-1">
                <div className="h-4 bg-sand-200 rounded w-32 mb-2" />
                <div className="h-3 bg-sand-200 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-sand-600">{error}</p>
        </div>
      ) : filteredFriends.length === 0 ? (
        <div className="card p-8 text-center">
          <Users className="w-12 h-12 text-sand-300 mx-auto mb-4" />
          <p className="text-sand-600 mb-4">
            {searchQuery
              ? "No friends match your search"
              : "No friends yet. Add some friends to compete!"}
          </p>
          {!searchQuery && (
            <button
              onClick={() => router.push("/friends/add")}
              className="btn btn-primary"
            >
              <UserPlus className="w-5 h-5" />
              Find Friends
            </button>
          )}
        </div>
      ) : (
        <div className="card divide-y divide-sand-100">
          {filteredFriends.map((friend, index) => (
            <motion.div
              key={friend.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-4 p-4 hover:bg-sand-50 transition-colors cursor-pointer"
              onClick={() => router.push(`/friends/${friend.id}`)}
            >
              <div className="avatar bg-fairway-100 text-fairway-600">
                {friend.avatarUrl ? (
                  <Image
                    src={friend.avatarUrl}
                    alt={friend.name || ""}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  friend.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sand-900">{friend.name}</p>
                <p className="text-sm text-sand-500">@{friend.username}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-medium text-fairway-600">
                  {friend.handicap?.toFixed(1) ?? "-"}
                </p>
                <p className="text-xs text-sand-500">Handicap</p>
              </div>
              <button
                className="btn btn-outline px-4 py-2 text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/session/new?invite=${friend.id}`);
                }}
              >
                Challenge
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pending Requests */}
      <div className="card p-6">
        <h3 className="font-display text-lg font-semibold text-sand-900 mb-4">
          Pending Requests
        </h3>
        {loading ? (
          <div className="animate-pulse">
            <div className="h-4 bg-sand-200 rounded w-48" />
          </div>
        ) : pendingRequests.length === 0 ? (
          <p className="text-sand-500 text-center py-4">
            No pending friend requests
          </p>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center gap-4 p-3 bg-sand-50 rounded-xl"
              >
                <div className="avatar bg-gold-100 text-gold-600">
                  {request.sender?.avatarUrl ? (
                    <img
                      src={request.sender.avatarUrl}
                      alt={request.sender.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    (request.sender?.name?.charAt(0).toUpperCase() ?? "?")
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sand-900">
                    {request.sender?.name ?? "Unknown"}
                  </p>
                  <p className="text-sm text-sand-500">
                    @{request.sender?.username ?? "unknown"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
                    onClick={() => handleAcceptRequest(request.id)}
                    disabled={actionLoading === request.id}
                  >
                    {actionLoading === request.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Accept"
                    )}
                  </button>
                  <button
                    className="btn btn-outline px-3 py-1.5 text-sm disabled:opacity-50"
                    onClick={() => handleDeclineRequest(request.id)}
                    disabled={actionLoading === request.id}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
