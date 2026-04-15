"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Trophy,
  Flag,
  Target,
  TrendingUp,
  TrendingDown,
  Calendar,
  MapPin,
  Cloud,
  ChevronLeft,
  Share2,
  Home,
  BarChart3,
  Circle,
  Minus,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface RoundData {
  id: string;
  playedAt: string;
  weather: string | null;
  notes: string | null;
  totalScore: number | null;
  totalPutts: number | null;
  fairwaysHit: number | null;
  greensInReg: number | null;
  status: string;
  course: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    par: number;
    numHoles: number;
    holes: Array<{
      id: string;
      holeNumber: number;
      par: number;
      yardage: number | null;
      handicapRank: number | null;
    }>;
  };
  scores: Array<{
    id: string;
    strokes: number;
    putts: number | null;
    fairwayHit: boolean | null;
    greenInReg: boolean | null;
    hole: {
      id: string;
      holeNumber: number;
      par: number;
      yardage: number | null;
      handicapRank: number | null;
    };
  }>;
  user: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
    handicap: number | null;
  };
  stats: {
    coursePar: number;
    holesPlayed: number;
    scoreToPar: number | null;
    scoringBreakdown: {
      eagles: number;
      birdies: number;
      pars: number;
      bogeys: number;
      doubleBogeys: number;
      worse: number;
    };
    parPerformance: {
      par3: { count: number; totalStrokes: number; average: string | null };
      par4: { count: number; totalStrokes: number; average: string | null };
      par5: { count: number; totalStrokes: number; average: string | null };
    };
    fairwayPercentage: string | null;
    girPercentage: string | null;
    avgPutts: string | null;
  };
}

export default function RoundSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const roundId = params.id as string;

  const [round, setRound] = useState<RoundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRound = async () => {
      try {
        const response = await fetch(`/api/rounds/${roundId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load round");
        }

        setRound(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load round");
      } finally {
        setLoading(false);
      }
    };

    fetchRound();
  }, [roundId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-sand-50 dark:bg-dark-950 flex items-center justify-center transition-colors">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-fairway-600 dark:text-fairway-400 mx-auto mb-4" />
          <p className="text-sand-600 dark:text-sand-400">
            Loading round summary...
          </p>
        </div>
      </div>
    );
  }

  if (error || !round) {
    return (
      <div className="min-h-screen bg-sand-50 dark:bg-dark-950 flex items-center justify-center transition-colors">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">
            {error || "Round not found"}
          </p>
          <button onClick={() => router.push("/")} className="btn btn-primary">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const scoreToPar = round.stats.scoreToPar ?? 0;
  const scoreToParDisplay =
    scoreToPar === 0 ? "E" : scoreToPar > 0 ? `+${scoreToPar}` : scoreToPar;

  return (
    <div className="min-h-screen bg-sand-50 dark:bg-dark-950 transition-colors">
      {/* Header */}
      <header className="bg-fairway-gradient dark:bg-fairway-gradient-dark text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Dashboard
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">Round Complete! 🎉</h1>
              <p className="text-white/80">{round.course.name}</p>
            </div>
            <button className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Score Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8 text-center"
        >
          <div className="mb-6">
            <div className="text-6xl font-bold text-sand-900 dark:text-sand-100 mb-2">
              {round.totalScore}
            </div>
            <div
              className={`inline-flex items-center gap-1 px-4 py-2 rounded-full text-lg font-semibold ${
                scoreToPar < 0
                  ? "bg-birdie/10 dark:bg-birdie/20 text-birdie dark:text-emerald-400"
                  : scoreToPar === 0
                  ? "bg-par/10 dark:bg-par/20 text-par dark:text-gray-400"
                  : "bg-bogey/10 dark:bg-bogey/20 text-bogey dark:text-amber-400"
              }`}
            >
              {scoreToPar < 0 ? (
                <TrendingDown className="w-5 h-5" />
              ) : scoreToPar > 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <Minus className="w-5 h-5" />
              )}
              {scoreToParDisplay}
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 text-sand-600 dark:text-sand-400 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {round.course.city}, {round.course.state}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {format(new Date(round.playedAt), "MMM d, yyyy")}
            </div>
            {round.weather && (
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                {round.weather}
              </div>
            )}
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          <div className="stat-card text-center">
            <div className="stat-value">{round.totalPutts}</div>
            <div className="stat-label">Total Putts</div>
          </div>
          <div className="stat-card text-center">
            <div className="stat-value">{round.stats.avgPutts || "-"}</div>
            <div className="stat-label">Putts/Hole</div>
          </div>
          <div className="stat-card text-center">
            <div className="stat-value">
              {round.stats.fairwayPercentage || "-"}%
            </div>
            <div className="stat-label">Fairways</div>
          </div>
          <div className="stat-card text-center">
            <div className="stat-value">
              {round.stats.girPercentage || "-"}%
            </div>
            <div className="stat-label">GIR</div>
          </div>
        </motion.div>

        {/* Scoring Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6"
        >
          <h2 className="text-lg font-semibold text-sand-900 dark:text-sand-100 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-fairway-600 dark:text-fairway-400" />
            Scoring Breakdown
          </h2>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {[
              {
                label: "Eagles",
                value: round.stats.scoringBreakdown.eagles,
                color: "bg-eagle dark:bg-blue-600 text-white",
              },
              {
                label: "Birdies",
                value: round.stats.scoringBreakdown.birdies,
                color: "bg-birdie dark:bg-emerald-600 text-white",
              },
              {
                label: "Pars",
                value: round.stats.scoringBreakdown.pars,
                color: "bg-par dark:bg-gray-600 text-white",
              },
              {
                label: "Bogeys",
                value: round.stats.scoringBreakdown.bogeys,
                color: "bg-bogey dark:bg-amber-600 text-white",
              },
              {
                label: "Doubles",
                value: round.stats.scoringBreakdown.doubleBogeys,
                color: "bg-double dark:bg-red-600 text-white",
              },
              {
                label: "Worse",
                value: round.stats.scoringBreakdown.worse,
                color: "bg-worse dark:bg-orange-700 text-white",
              },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div
                  className={`w-12 h-12 rounded-full ${item.color} flex items-center justify-center text-xl font-bold mx-auto mb-2`}
                >
                  {item.value}
                </div>
                <div className="text-xs text-sand-600 dark:text-sand-400">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Par Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6"
        >
          <h2 className="text-lg font-semibold text-sand-900 dark:text-sand-100 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-fairway-600 dark:text-fairway-400" />
            Par Performance
          </h2>

          <div className="grid grid-cols-3 gap-4">
            {[
              { par: 3, data: round.stats.parPerformance.par3 },
              { par: 4, data: round.stats.parPerformance.par4 },
              { par: 5, data: round.stats.parPerformance.par5 },
            ].map((item) => (
              <div
                key={item.par}
                className="bg-sand-50 dark:bg-dark-800 rounded-xl p-4 text-center"
              >
                <div className="text-sm text-sand-500 dark:text-sand-400 mb-1">
                  Par {item.par}s
                </div>
                <div className="text-2xl font-bold text-sand-900 dark:text-sand-100">
                  {item.data.average || "-"}
                </div>
                <div className="text-xs text-sand-500 dark:text-sand-400">
                  avg ({item.data.count} holes)
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Full Scorecard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-sand-100 dark:border-dark-800">
            <h2 className="text-lg font-semibold text-sand-900 dark:text-sand-100 flex items-center gap-2">
              <Flag className="w-5 h-5 text-fairway-600 dark:text-fairway-400" />
              Full Scorecard
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-sand-50 dark:bg-dark-800">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-sand-500 dark:text-sand-400">
                    Hole
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-sand-500 dark:text-sand-400">
                    Par
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-sand-500 dark:text-sand-400">
                    Yds
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-sand-500 dark:text-sand-400">
                    Score
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-sand-500 dark:text-sand-400">
                    +/-
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-sand-500 dark:text-sand-400">
                    Putts
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-sand-500 dark:text-sand-400">
                    FIR
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-sand-500 dark:text-sand-400">
                    GIR
                  </th>
                </tr>
              </thead>
              <tbody>
                {round.course.holes.map((hole) => {
                  const score = round.scores.find((s) => s.hole.id === hole.id);
                  const diff = score ? score.strokes - hole.par : null;

                  return (
                    <tr
                      key={hole.id}
                      className="border-b border-sand-100 dark:border-dark-800 last:border-b-0"
                    >
                      <td className="px-3 py-3">
                        <span className="w-7 h-7 rounded-full bg-fairway-100 dark:bg-fairway-900/40 text-fairway-700 dark:text-fairway-400 flex items-center justify-center text-sm font-medium">
                          {hole.holeNumber}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-sand-600 dark:text-sand-400">
                        {hole.par}
                      </td>
                      <td className="px-3 py-3 text-center text-sand-500 dark:text-sand-400 text-sm">
                        {hole.yardage || "-"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {score ? (
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                              diff !== null && diff <= -2
                                ? "bg-eagle/20 dark:bg-blue-500/30 text-eagle dark:text-blue-400"
                                : diff === -1
                                ? "bg-birdie/20 dark:bg-emerald-500/30 text-birdie dark:text-emerald-400"
                                : diff === 0
                                ? "bg-par/20 dark:bg-gray-500/30 text-par dark:text-gray-400"
                                : diff === 1
                                ? "bg-bogey/20 dark:bg-amber-500/30 text-bogey dark:text-amber-400"
                                : diff === 2
                                ? "bg-double/20 dark:bg-red-500/30 text-double dark:text-red-400"
                                : "bg-worse/20 dark:bg-orange-500/30 text-worse dark:text-orange-400"
                            }`}
                          >
                            {score.strokes}
                          </span>
                        ) : (
                          <span className="text-sand-400 dark:text-sand-500">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-sm">
                        {diff !== null ? (
                          <span
                            className={
                              diff < 0
                                ? "text-birdie dark:text-emerald-400"
                                : diff === 0
                                ? "text-sand-500 dark:text-sand-400"
                                : "text-bogey dark:text-amber-400"
                            }
                          >
                            {diff === 0 ? "E" : diff > 0 ? `+${diff}` : diff}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-sand-600 dark:text-sand-400">
                        {score?.putts ?? "-"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {score?.fairwayHit !== null &&
                        score?.fairwayHit !== undefined ? (
                          <Circle
                            className={`w-4 h-4 mx-auto ${
                              score.fairwayHit
                                ? "fill-birdie text-birdie dark:fill-emerald-500 dark:text-emerald-500"
                                : "text-sand-300 dark:text-sand-600"
                            }`}
                          />
                        ) : (
                          <span className="text-sand-300 dark:text-sand-600">
                            -
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {score?.greenInReg !== null &&
                        score?.greenInReg !== undefined ? (
                          <Circle
                            className={`w-4 h-4 mx-auto ${
                              score.greenInReg
                                ? "fill-birdie text-birdie dark:fill-emerald-500 dark:text-emerald-500"
                                : "text-sand-300 dark:text-sand-600"
                            }`}
                          />
                        ) : (
                          <span className="text-sand-300 dark:text-sand-600">
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-sand-50 dark:bg-dark-800 font-semibold">
                <tr>
                  <td className="px-3 py-3 text-sand-900 dark:text-sand-100">
                    Total
                  </td>
                  <td className="px-3 py-3 text-center text-sand-900 dark:text-sand-100">
                    {round.stats.coursePar}
                  </td>
                  <td className="px-3 py-3 text-center text-sm text-sand-600 dark:text-sand-400">
                    {round.course.holes.reduce(
                      (sum, h) => sum + (h.yardage || 0),
                      0
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-sand-900 dark:text-sand-100">
                    {round.totalScore}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={
                        scoreToPar < 0
                          ? "text-birdie dark:text-emerald-400"
                          : scoreToPar === 0
                          ? "text-sand-600 dark:text-sand-400"
                          : "text-bogey dark:text-amber-400"
                      }
                    >
                      {scoreToParDisplay}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-sand-900 dark:text-sand-100">
                    {round.totalPutts}
                  </td>
                  <td className="px-3 py-3 text-center text-sand-900 dark:text-sand-100">
                    {round.fairwaysHit}
                  </td>
                  <td className="px-3 py-3 text-center text-sand-900 dark:text-sand-100">
                    {round.greensInReg}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>

        {/* Notes */}
        {round.notes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="card p-6"
          >
            <h2 className="text-lg font-semibold text-sand-900 dark:text-sand-100 mb-2">
              Notes
            </h2>
            <p className="text-sand-600 dark:text-sand-400">{round.notes}</p>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <button
            onClick={() => router.push("/")}
            className="btn btn-primary flex-1"
          >
            <Home className="w-5 h-5" />
            Back to Dashboard
          </button>
          <button
            onClick={() => router.push("/round/new")}
            className="btn btn-outline flex-1"
          >
            <Flag className="w-5 h-5" />
            Start New Round
          </button>
        </motion.div>
      </main>
    </div>
  );
}
