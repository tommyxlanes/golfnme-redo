"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  Flag,
  Calendar,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types matching the API response shape
// ─────────────────────────────────────────────
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

interface TrendStats {
  scoreTrend: Array<{
    date: string;
    score: number;
    courseName: string;
    scoreToPar: number;
  }>;
  handicapHistory: Array<{ date: string; handicap: number }>;
  periodDays: number;
}

interface CourseStats {
  courseId: string;
  courseName: string;
  par: number;
  roundsPlayed: number;
  bestScore: number;
  averageScore: number;
  lastPlayed: string;
  scoreTrend: number[];
}

type TimeRange = "7d" | "30d" | "90d" | "1y" | "all";

const PERIOD_MAP: Record<TimeRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
  all: 9999,
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmt(n: number | null | undefined, decimals = 1) {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

function scoreColor(scoreToPar: number) {
  if (scoreToPar <= -2) return "text-purple-600";
  if (scoreToPar === -1) return "text-birdie";
  if (scoreToPar === 0) return "text-sand-600";
  if (scoreToPar <= 2) return "text-bogey";
  return "text-red-600";
}

function scoreBg(scoreToPar: number) {
  if (scoreToPar <= -2) return "bg-purple-100 text-purple-600";
  if (scoreToPar === -1) return "bg-birdie/20 text-birdie";
  if (scoreToPar === 0) return "bg-sand-100 text-sand-600";
  if (scoreToPar <= 2) return "bg-bogey/20 text-bogey";
  return "bg-red-100 text-red-600";
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────
function EmptyStats({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div
        className="w-20 h-20 rounded-full bg-fairway-100 flex items-center justify-center mb-4
     "
      >
        <Flag className="w-10 h-10 text-fairway-500" />
      </div>
      <h2 className="font-display text-xl font-bold text-sand-900 mb-2">
        No rounds yet
      </h2>
      <p className="text-sand-500 mb-6 max-w-xs">
        Play your first round to start seeing your stats and trends here.
      </p>
      <button
        onClick={() => router.push("/round/new")}
        className="btn-primary px-6 py-3 rounded-xl"
      >
        Start a Round
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function StatsPage() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [trends, setTrends] = useState<TrendStats | null>(null);
  const [courses, setCourses] = useState<CourseStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all three endpoints in parallel
  useEffect(() => {
    const period = PERIOD_MAP[timeRange];

    async function fetchStats() {
      setLoading(true);
      setError(null);
      try {
        const [overviewRes, trendsRes, coursesRes] = await Promise.all([
          fetch("/api/stats?type=overview"),
          fetch(`/api/stats?type=trends&period=${period}`),
          fetch("/api/stats?type=courses"),
        ]);

        if (!overviewRes.ok || !trendsRes.ok || !coursesRes.ok) {
          throw new Error("Failed to fetch stats");
        }

        const [o, t, c] = await Promise.all([
          overviewRes.json(),
          trendsRes.json(),
          coursesRes.json(),
        ]);

        setOverview(o.data);
        setTrends(t.data);
        setCourses(c.data ?? []);
      } catch (err) {
        setError("Could not load stats. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [timeRange]);

  // Scoring distribution bar data
  const scoringData = overview
    ? [
        {
          name: "Eagles",
          value: overview.scoringDistribution.eagles,
          color: "bg-purple-500",
        },
        {
          name: "Birdies",
          value: overview.scoringDistribution.birdies,
          color: "bg-birdie",
        },
        {
          name: "Pars",
          value: overview.scoringDistribution.pars,
          color: "bg-sand-400",
        },
        {
          name: "Bogeys",
          value: overview.scoringDistribution.bogeys,
          color: "bg-bogey",
        },
        {
          name: "Double+",
          value:
            overview.scoringDistribution.doubleBogeys +
            overview.scoringDistribution.worse,
          color: "bg-red-500",
        },
      ]
    : [];

  const maxScoringValue = Math.max(...scoringData.map((d) => d.value), 1);

  // Chart data — last 8 rounds from trend
  const chartRounds = (trends?.scoreTrend ?? []).slice(-8);
  const chartMin = Math.min(...chartRounds.map((r) => r.score), 70);
  const chartMax = Math.max(...chartRounds.map((r) => r.score), 100);
  const chartRange = chartMax - chartMin || 10;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-fairway-gradient text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display text-2xl font-bold">Statistics</h1>
              <p className="text-white/70 text-sm">Track your progress</p>
            </div>
          </div>

          {/* Time Range */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(["7d", "30d", "90d", "1y", "all"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  timeRange === r
                    ? "bg-white text-fairway-700"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {r === "7d"
                  ? "7 Days"
                  : r === "30d"
                    ? "30 Days"
                    : r === "90d"
                      ? "90 Days"
                      : r === "1y"
                        ? "1 Year"
                        : "All Time"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-fairway-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && overview?.totalRounds === 0 && (
        <EmptyStats router={router} />
      )}

      {/* Content */}
      {!loading && !error && overview && overview.totalRounds > 0 && (
        <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
          {/* Overview Cards */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 text-sand-500 mb-2">
                <Flag className="w-4 h-4" />
                <span className="text-xs">Rounds</span>
              </div>
              <p className="text-3xl font-display font-bold text-sand-900">
                {overview.totalRounds}
              </p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 text-sand-500 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">Average</span>
              </div>
              <p className="text-3xl font-display font-bold text-sand-900">
                {fmt(overview.averageScore)}
              </p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 text-sand-500 mb-2">
                <Trophy className="w-4 h-4" />
                <span className="text-xs">Best Round</span>
              </div>
              <p className="text-3xl font-display font-bold text-birdie">
                {overview.bestRound ?? "—"}
              </p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 text-sand-500 mb-2">
                <Target className="w-4 h-4" />
                <span className="text-xs">Handicap</span>
              </div>
              <p className="text-3xl font-display font-bold text-sand-900">
                {overview.handicapIndex != null
                  ? fmt(overview.handicapIndex)
                  : "—"}
              </p>
            </div>
          </section>

          {/* Score Trend Chart */}
          {chartRounds.length > 1 && (
            <section className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-lg font-semibold text-sand-900">
                  Score Trend
                </h2>
                <span className="text-sm text-sand-500">
                  Last {chartRounds.length} rounds
                </span>
              </div>

              <div className="relative h-48">
                <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between text-xs text-sand-400">
                  <span>{chartMax}</span>
                  <span>{Math.round((chartMax + chartMin) / 2)}</span>
                  <span>{chartMin}</span>
                </div>

                <div className="ml-12 h-40 relative">
                  <div className="absolute inset-0 flex flex-col justify-between">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="border-b border-sand-100" />
                    ))}
                  </div>

                  <svg className="absolute inset-0 w-full h-full overflow-visible">
                    <polyline
                      fill="none"
                      stroke="rgb(34 197 94)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={chartRounds
                        .map((r, i) => {
                          const x = (i / (chartRounds.length - 1)) * 100;
                          const y = ((r.score - chartMin) / chartRange) * 100;
                          return `${x}%,${100 - y}%`;
                        })
                        .join(" ")}
                    />
                    {chartRounds.map((r, i) => {
                      const x = (i / (chartRounds.length - 1)) * 100;
                      const y = ((r.score - chartMin) / chartRange) * 100;
                      return (
                        <circle
                          key={i}
                          cx={`${x}%`}
                          cy={`${100 - y}%`}
                          r="5"
                          fill="white"
                          stroke="rgb(34 197 94)"
                          strokeWidth="2"
                        />
                      );
                    })}
                  </svg>
                </div>

                <div className="mt-2 flex justify-between text-xs text-sand-400 ml-12">
                  {chartRounds.map((r, i) => (
                    <span key={i}>
                      {new Date(r.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Scoring Distribution */}
          <section className="card p-6">
            <h2 className="font-display text-lg font-semibold text-sand-900 mb-6">
              Scoring Distribution
            </h2>
            <div className="space-y-4">
              {scoringData.map((item) => (
                <div key={item.name} className="flex items-center gap-4">
                  <span className="w-16 text-sm text-sand-600">
                    {item.name}
                  </span>
                  <div className="flex-1 h-8 bg-sand-100 rounded-lg overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(item.value / maxScoringValue) * 100}%`,
                      }}
                      transition={{ duration: 0.8, delay: 0.1 }}
                      className={`h-full ${item.color} rounded-lg flex items-center justify-end pr-2`}
                    >
                      {item.value > 0 && (
                        <span className="text-xs font-medium text-white">
                          {item.value}
                        </span>
                      )}
                    </motion.div>
                  </div>
                  <span className="w-12 text-right font-mono text-sm font-medium text-sand-700">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Par Performance */}
          <section className="card p-6">
            <h2 className="font-display text-lg font-semibold text-sand-900 mb-6">
              Par Performance
            </h2>
            <div className="grid grid-cols-3 gap-6">
              {[
                { par: 3, avg: overview.parPerformance.par3Average },
                { par: 4, avg: overview.parPerformance.par4Average },
                { par: 5, avg: overview.parPerformance.par5Average },
              ].map(({ par, avg }) => {
                const diff = avg - par;
                return (
                  <div key={par} className="text-center">
                    <div className="w-20 h-20 rounded-2xl bg-fairway-100 mx-auto mb-3 flex items-center justify-center">
                      <span className="font-display text-3xl font-bold text-fairway-600">
                        {par}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-sand-900">
                      {avg > 0 ? fmt(avg, 2) : "—"}
                    </p>
                    <p className="text-sm text-sand-500">Avg Score</p>
                    {avg > 0 && (
                      <p
                        className={`text-xs mt-1 font-medium ${diff <= 0 ? "text-birdie" : "text-bogey"}`}
                      >
                        {diff > 0 ? "+" : ""}
                        {fmt(diff, 2)} vs par
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Key Metrics */}
          <section className="card p-6">
            <h2 className="font-display text-lg font-semibold text-sand-900 mb-6">
              Key Metrics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-slate-50 rounded-xl">
                <p className="text-2xl font-bold text-sand-900">
                  {overview.fairwayPercentage > 0
                    ? `${fmt(overview.fairwayPercentage)}%`
                    : "—"}
                </p>
                <p className="text-xs text-sand-500 mt-1">Fairways Hit</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-xl">
                <p className="text-2xl font-bold text-sand-900">
                  {overview.girPercentage > 0
                    ? `${fmt(overview.girPercentage)}%`
                    : "—"}
                </p>
                <p className="text-xs text-sand-500 mt-1">Greens in Reg</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-xl">
                <p className="text-2xl font-bold text-sand-900">
                  {overview.averagePutts > 0
                    ? fmt(overview.averagePutts, 1)
                    : "—"}
                </p>
                <p className="text-xs text-sand-500 mt-1">Avg Putts/Round</p>
              </div>
            </div>
          </section>

          {/* Top Courses */}
          {courses.length > 0 && (
            <section className="card overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-sand-100">
                <h2 className="font-display text-lg font-semibold text-sand-900">
                  Top Courses
                </h2>
                <span className="text-sm text-sand-500">By rounds played</span>
              </div>
              <div className="divide-y divide-sand-100">
                {courses.slice(0, 5).map((course, index) => (
                  <div
                    key={course.courseId}
                    className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                        index === 0
                          ? "bg-yellow-100 text-yellow-600"
                          : index === 1
                            ? "bg-sand-200 text-sand-600"
                            : "bg-amber-100 text-amber-600"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sand-900">
                        {course.courseName}
                      </p>
                      <p className="text-sm text-sand-500">
                        {course.roundsPlayed} rounds
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-medium text-sand-700">
                        Avg {fmt(course.averageScore, 1)}
                      </p>
                      <p className="text-xs text-birdie">
                        Best: {course.bestScore}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-sand-300" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent Rounds */}
          {overview.recentScores.length > 0 && (
            <section className="card overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-sand-100">
                <h2 className="font-display text-lg font-semibold text-sand-900">
                  Recent Rounds
                </h2>
              </div>
              <div className="divide-y divide-sand-100">
                {overview.recentScores.slice(0, 8).map((round, i) => {
                  const diff = round.score - round.par;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-lg ${scoreBg(diff)}`}
                      >
                        {round.score}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sand-900">
                          {round.courseName}
                        </p>
                        <p className="text-sm text-sand-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(round.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className={`text-lg font-bold ${scoreColor(diff)}`}>
                        {diff > 0 ? "+" : ""}
                        {diff}
                      </div>
                      <ChevronRight className="w-5 h-5 text-sand-300" />
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      )}
    </div>
  );
}
