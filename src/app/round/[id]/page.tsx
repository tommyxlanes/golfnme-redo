"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Flag,
  Menu,
  X,
  Share2,
  Pause,
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Target,
  Circle,
  Save,
  Trophy,
  BarChart3,
  Loader2,
} from "lucide-react";
import { Scorecard, MiniScorecard } from "@/components/scorecard";
import { useActiveRoundStore } from "@/stores";
import {
  getScoreRelativeToPar,
  getScoreColor,
  formatScoreToPar,
} from "@/lib/golf-utils";
import type { Round, Course, Hole, Score } from "@/types";

export default function ActiveRoundPage() {
  const router = useRouter();
  const params = useParams();
  const roundId = params.id as string;

  const {
    round,
    scores,
    currentHole,
    setRound,
    setScore,
    setCurrentHole,
    clearRound,
  } = useActiveRoundStore();

  const [showMiniCard, setShowMiniCard] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [courseData, setCourseData] = useState<
    (Course & { holes: Hole[] }) | null
  >(null);

  // Load round data from API
  useEffect(() => {
    const loadRound = async () => {
      try {
        const response = await fetch(`/api/rounds/${roundId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load round");
        }

        const roundData = data.data;

        // Set course data
        setCourseData(roundData.course);

        // Set round in store
        setRound({
          id: roundData.id,
          userId: roundData.userId,
          courseId: roundData.courseId,
          playedAt: new Date(roundData.playedAt),
          status: roundData.status,
          weather: roundData.weather,
          notes: roundData.notes,
          totalScore: roundData.totalScore,
          totalPutts: roundData.totalPutts,
          fairwaysHit: roundData.fairwaysHit,
          greensInReg: roundData.greensInReg,
          course: roundData.course,
          scores: roundData.scores,
        });

        // Load existing scores into the store
        if (roundData.scores && roundData.scores.length > 0) {
          roundData.scores.forEach((score: any) => {
            setScore(score.hole.id, {
              id: score.id,
              roundId: score.roundId,
              holeId: score.hole.id,
              userId: score.userId,
              strokes: score.strokes,
              putts: score.putts,
              fairwayHit: score.fairwayHit,
              greenInReg: score.greenInReg,
              penalties: score.penalties,
            });
          });

          // Set current hole to next unplayed hole or last hole
          const playedHoles = new Set(
            roundData.scores.map((s: any) => s.hole.holeNumber)
          );
          const nextHole = roundData.course.holes.find(
            (h: Hole) => !playedHoles.has(h.holeNumber)
          );
          if (nextHole) {
            setCurrentHole(nextHole.holeNumber);
          } else {
            setCurrentHole(18);
          }
        }

        // If round is completed, redirect to summary
        if (roundData.status === "COMPLETED") {
          router.replace(`/round/${roundId}/summary`);
          return;
        }

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load round");
        setIsLoading(false);
      }
    };

    loadRound();
  }, [roundId, setRound, setScore, setCurrentHole, router]);

  const course = courseData;
  const hole = course?.holes.find((h) => h.holeNumber === currentHole);

  // Calculate running totals
  let totalScore = 0;
  let totalPar = 0;
  if (course) {
    course.holes.forEach((h) => {
      const score = scores.get(h.id);
      if (score) {
        totalScore += score.strokes;
        totalPar += h.par;
      }
    });
  }
  const scoreToPar = totalScore - totalPar;

  const handleScoreUpdate = async (holeId: string, data: Partial<Score>) => {
    if (!data.strokes) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId,
          holeId,
          strokes: data.strokes,
          putts: data.putts,
          fairwayHit: data.fairwayHit,
          greenInReg: data.greenInReg,
          penalties: data.penalties || 0,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save score");
      }

      // Update local store
      const newScore: Score = {
        id: result.data.score.id,
        roundId,
        holeId,
        userId: result.data.score.userId,
        strokes: data.strokes,
        putts: data.putts,
        fairwayHit: data.fairwayHit,
        greenInReg: data.greenInReg,
        penalties: data.penalties || 0,
      };

      setScore(holeId, newScore);
    } catch (err) {
      console.error("Failed to save score:", err);
      // Could show a toast notification here
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteRound = async () => {
    try {
      const response = await fetch(`/api/rounds/${roundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });

      if (!response.ok) {
        throw new Error("Failed to complete round");
      }

      router.push(`/round/${roundId}/summary`);
    } catch (err) {
      console.error("Failed to complete round:", err);
    }
  };

  const handleAbandonRound = async () => {
    if (
      confirm(
        "Are you sure you want to abandon this round? Your progress will be saved."
      )
    ) {
      try {
        await fetch(`/api/rounds/${roundId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ABANDONED" }),
        });
      } catch (err) {
        console.error("Failed to abandon round:", err);
      }

      clearRound();
      router.push("/");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-fairway-500 mx-auto mb-4" />
          <p className="text-sand-600">Loading round...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Round not found"}</p>
          <button onClick={() => router.push("/")} className="btn btn-primary">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-fairway-gradient text-white sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <button
              onClick={() => router.push("/")}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="text-center">
              <p className="font-medium text-sm">{course.name}</p>
              <p className="text-white/60 text-xs">Par {course.par}</p>
            </div>

            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              {showMenu ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Running Score Bar */}
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-white/60 text-xs">Thru</p>
                <p className="text-xl font-bold">{scores.size}</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <p className="text-white/60 text-xs">Score</p>
                <p className="text-xl font-bold">{totalScore || "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isSaving && (
                <Loader2 className="w-4 h-4 animate-spin text-white/60" />
              )}
              <div
                className={`text-3xl font-display font-bold ${
                  scoreToPar <= 0 ? "text-gold-300" : "text-white"
                }`}
              >
                {totalScore > 0 ? formatScoreToPar(scoreToPar) : "E"}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Menu Dropdown */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-14 right-4 z-30 card shadow-xl p-2 min-w-[200px]"
          >
            <button
              onClick={() => {
                setShowMiniCard(!showMiniCard);
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <BarChart3 className="w-5 h-5 text-sand-500" />
              <span className="text-sand-700">View Scorecard</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors">
              <Share2 className="w-5 h-5 text-sand-500" />
              <span className="text-sand-700">Share Round</span>
            </button>
            <button
              onClick={handleAbandonRound}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 transition-colors text-red-600"
            >
              <Pause className="w-5 h-5" />
              <span>Abandon Round</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Mini Scorecard Toggle */}
        <AnimatePresence>
          {showMiniCard && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <MiniScorecard
                holes={course.holes}
                scores={scores}
                currentHole={currentHole}
                onHoleSelect={setCurrentHole}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Scorecard */}
        <Scorecard
          holes={course.holes}
          scores={scores}
          currentHole={currentHole}
          onScoreUpdate={handleScoreUpdate}
          onHoleChange={setCurrentHole}
          onComplete={handleCompleteRound}
          coursePar={course.par}
        />

        {/* Hole Navigation Pills */}
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
          {course.holes.map((h) => {
            const score = scores.get(h.id);
            const relativeScore = score
              ? getScoreRelativeToPar(score.strokes, h.par)
              : null;
            const colorClass = relativeScore
              ? getScoreColor(relativeScore)
              : "";

            return (
              <button
                key={h.id}
                onClick={() => setCurrentHole(h.holeNumber)}
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  currentHole === h.holeNumber
                    ? "bg-fairway-500 text-white ring-2 ring-fairway-500 ring-offset-2"
                    : score
                    ? colorClass
                    : "bg-sand-100 text-sand-500"
                }`}
              >
                {score?.strokes || h.holeNumber}
              </button>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4 text-center">
            <p className="text-sand-500 text-xs mb-1">Front 9</p>
            <p className="text-xl font-bold text-sand-900">
              {(() => {
                let front = 0;
                course.holes.slice(0, 9).forEach((h) => {
                  const s = scores.get(h.id);
                  if (s) front += s.strokes;
                });
                return front || "—";
              })()}
            </p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-sand-500 text-xs mb-1">Back 9</p>
            <p className="text-xl font-bold text-sand-900">
              {(() => {
                let back = 0;
                course.holes.slice(9).forEach((h) => {
                  const s = scores.get(h.id);
                  if (s) back += s.strokes;
                });
                return back || "—";
              })()}
            </p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-sand-500 text-xs mb-1">Putts</p>
            <p className="text-xl font-bold text-sand-900">
              {(() => {
                let putts = 0;
                scores.forEach((s) => {
                  if (s.putts) putts += s.putts;
                });
                return putts || "—";
              })()}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
