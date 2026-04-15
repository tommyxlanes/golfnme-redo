"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Flag,
  Target,
  Circle,
  Minus,
  Plus,
  Save,
  X,
} from "lucide-react";
import {
  getScoreRelativeToPar,
  getScoreColor,
  formatScoreToPar,
} from "@/lib/golf-utils";
import type { Hole, Score } from "@/types";

interface ScorecardProps {
  holes: Hole[];
  scores: Map<string, Score>;
  currentHole: number;
  onScoreUpdate: (holeId: string, data: Partial<Score>) => Promise<void>;
  onHoleChange: (hole: number) => void;
  onComplete: () => void;
  coursePar: number;
}

export function Scorecard({
  holes,
  scores,
  currentHole,
  onScoreUpdate,
  onHoleChange,
  onComplete,
  coursePar,
}: ScorecardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const hole = holes.find((h) => h.holeNumber === currentHole);
  const existingScore = hole ? scores.get(hole.id) : undefined;

  const [strokes, setStrokes] = useState(
    existingScore?.strokes ?? hole?.par ?? 4
  );
  const [putts, setPutts] = useState(existingScore?.putts ?? 2);
  const [fairwayHit, setFairwayHit] = useState(
    existingScore?.fairwayHit ?? false
  );
  const [greenInReg, setGreenInReg] = useState(
    existingScore?.greenInReg ?? false
  );

  // Reset when hole changes
  useEffect(() => {
    const score = hole ? scores.get(hole.id) : undefined;
    setStrokes(score?.strokes ?? hole?.par ?? 4);
    setPutts(score?.putts ?? 2);
    setFairwayHit(score?.fairwayHit ?? false);
    setGreenInReg(score?.greenInReg ?? false);
  }, [currentHole, hole, scores]);

  // Calculate totals
  let totalScore = 0;
  let totalPar = 0;
  holes.forEach((h) => {
    const score = scores.get(h.id);
    if (score) {
      totalScore += score.strokes;
    }
    if (h.holeNumber <= currentHole) {
      totalPar += h.par;
    }
  });

  const scoreToPar =
    totalScore - totalPar + (existingScore ? 0 : strokes - (hole?.par ?? 0));

  const handleSave = async () => {
    if (!hole) return;

    setIsUpdating(true);
    try {
      await onScoreUpdate(hole.id, {
        strokes,
        putts,
        fairwayHit: hole.par >= 4 ? fairwayHit : undefined,
        greenInReg,
        penalties: 0,
      });

      // Auto-advance to next hole
      if (currentHole < 18) {
        onHoleChange(currentHole + 1);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const scoreRelative = hole ? getScoreRelativeToPar(strokes, hole.par) : "par";
  const scoreColorClass = getScoreColor(scoreRelative);

  if (!hole) return null;

  return (
    <div className="card overflow-hidden">
      {/* Header with hole info */}
      <div className="bg-fairway-gradient text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => onHoleChange(currentHole - 1)}
            disabled={currentHole === 1}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <p className="text-white/60 text-sm">Hole</p>
            <p className="text-4xl font-display font-bold">{currentHole}</p>
          </div>

          <button
            onClick={() => onHoleChange(currentHole + 1)}
            disabled={currentHole === 18}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-white/60 text-xs">Par</p>
            <p className="text-2xl font-bold">{hole.par}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs">Yards</p>
            <p className="text-2xl font-bold">{hole.yardage ?? "—"}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs">Handicap</p>
            <p className="text-2xl font-bold">{hole.handicapRank ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Score Entry */}
      <div className="p-6 space-y-6">
        {/* Main Score */}
        <div className="text-center">
          <p className="text-sand-500 text-sm mb-2">Strokes</p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setStrokes((s) => Math.max(1, s - 1))}
              className="w-12 h-12 rounded-full bg-sand-100 hover:bg-sand-200 flex items-center justify-center transition-colors"
            >
              <Minus className="w-5 h-5 text-sand-600" />
            </button>

            <motion.div
              key={strokes}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-display font-bold ${scoreColorClass}`}
            >
              {strokes}
            </motion.div>

            <button
              onClick={() => setStrokes((s) => Math.min(15, s + 1))}
              className="w-12 h-12 rounded-full bg-sand-100 hover:bg-sand-200 flex items-center justify-center transition-colors"
            >
              <Plus className="w-5 h-5 text-sand-600" />
            </button>
          </div>

          <p
            className={`mt-2 text-sm font-medium ${
              strokes <= hole.par ? "text-birdie" : "text-bogey"
            }`}
          >
            {strokes === hole.par
              ? "Par"
              : strokes < hole.par
              ? `${hole.par - strokes} under`
              : `${strokes - hole.par} over`}
          </p>
        </div>

        {/* Quick Score Buttons */}
        <div className="grid grid-cols-5 gap-2">
          {[
            hole.par - 2,
            hole.par - 1,
            hole.par,
            hole.par + 1,
            hole.par + 2,
          ].map(
            (score) =>
              score > 0 && (
                <button
                  key={score}
                  onClick={() => setStrokes(score)}
                  className={`py-3 rounded-xl font-medium transition-all ${
                    strokes === score
                      ? "bg-fairway-500 text-white shadow-lg"
                      : "bg-sand-100 text-sand-600 hover:bg-sand-200"
                  }`}
                >
                  {score}
                </button>
              )
          )}
        </div>

        {/* Details Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full py-2 text-sm text-fairway-600 hover:text-fairway-700 font-medium"
        >
          {showDetails ? "Hide Details" : "Add Details (Putts, FIR, GIR)"}
        </button>

        {/* Expanded Details */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-4 overflow-hidden"
            >
              {/* Putts */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-sand-500" />
                  <span className="text-sand-700">Putts</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPutts((p) => Math.max(0, p - 1))}
                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-bold text-lg">
                    {putts}
                  </span>
                  <button
                    onClick={() => setPutts((p) => Math.min(10, p + 1))}
                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Fairway Hit (only for par 4 and 5) */}
              {hole.par >= 4 && (
                <button
                  onClick={() => setFairwayHit(!fairwayHit)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                    fairwayHit
                      ? "bg-birdie/10 border-2 border-birdie"
                      : "bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Flag className="w-5 h-5 text-sand-500" />
                    <span className="text-sand-700">Fairway Hit</span>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      fairwayHit ? "bg-birdie text-white" : "bg-sand-200"
                    }`}
                  >
                    {fairwayHit && <Check className="w-4 h-4" />}
                  </div>
                </button>
              )}

              {/* Green in Regulation */}
              <button
                onClick={() => setGreenInReg(!greenInReg)}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                  greenInReg
                    ? "bg-birdie/10 border-2 border-birdie"
                    : "bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Circle className="w-5 h-5 text-sand-500" />
                  <span className="text-sand-700">Green in Regulation</span>
                </div>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    greenInReg ? "bg-birdie text-white" : "bg-sand-200"
                  }`}
                >
                  {greenInReg && <Check className="w-4 h-4" />}
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isUpdating}
          className="btn btn-primary w-full"
        >
          {isUpdating ? (
            <span className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
              Saving...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Save className="w-5 h-5" />
              {existingScore ? "Update Score" : "Save & Continue"}
            </span>
          )}
        </button>
      </div>

      {/* Running Total Footer */}
      <div className="bg-sand-100 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-sand-500 text-sm">Thru {currentHole}</p>
          <p className="text-xl font-bold text-sand-900">
            {totalScore + (existingScore ? 0 : strokes)}
          </p>
        </div>
        <div
          className={`text-2xl font-display font-bold ${
            scoreToPar <= 0 ? "text-birdie" : "text-bogey"
          }`}
        >
          {formatScoreToPar(scoreToPar)}
        </div>
      </div>

      {/* Complete Round Button */}
      {currentHole === 18 && scores.size === 18 && (
        <div className="p-4 bg-gold-50 border-t border-gold-200">
          <button onClick={onComplete} className="btn btn-gold w-full">
            <Check className="w-5 h-5" />
            Complete Round
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// MINI SCORECARD (Overview of all holes)
// ============================================

interface MiniScorecardProps {
  holes: Hole[];
  scores: Map<string, Score>;
  currentHole: number;
  onHoleSelect: (hole: number) => void;
}

export function MiniScorecard({
  holes,
  scores,
  currentHole,
  onHoleSelect,
}: MiniScorecardProps) {
  const frontNine = holes.filter((h) => h.holeNumber <= 9);
  const backNine = holes.filter((h) => h.holeNumber > 9);

  const calculateTotal = (holeSet: Hole[]) => {
    let par = 0;
    let score = 0;
    holeSet.forEach((h) => {
      par += h.par;
      const s = scores.get(h.id);
      if (s) score += s.strokes;
    });
    return { par, score };
  };

  const frontTotals = calculateTotal(frontNine);
  const backTotals = calculateTotal(backNine);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Front Nine */}
          <thead>
            <tr className="bg-fairway-500 text-white">
              <th className="px-2 py-2 text-left font-medium">Hole</th>
              {frontNine.map((h) => (
                <th
                  key={h.id}
                  className="px-2 py-2 text-center font-medium w-10"
                >
                  {h.holeNumber}
                </th>
              ))}
              <th className="px-2 py-2 text-center font-medium bg-fairway-600">
                OUT
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-slate-50">
              <td className="px-2 py-2 font-medium text-sand-600">Par</td>
              {frontNine.map((h) => (
                <td key={h.id} className="px-2 py-2 text-center text-sand-600">
                  {h.par}
                </td>
              ))}
              <td className="px-2 py-2 text-center font-bold bg-sand-100">
                {frontTotals.par}
              </td>
            </tr>
            <tr>
              <td className="px-2 py-2 font-medium text-sand-900">Score</td>
              {frontNine.map((h) => {
                const score = scores.get(h.id);
                const isActive = h.holeNumber === currentHole;
                const relativeScore = score
                  ? getScoreRelativeToPar(score.strokes, h.par)
                  : null;
                const colorClass = relativeScore
                  ? getScoreColor(relativeScore)
                  : "";

                return (
                  <td
                    key={h.id}
                    onClick={() => onHoleSelect(h.holeNumber)}
                    className={`px-2 py-2 text-center cursor-pointer transition-colors hover:bg-sand-100 ${
                      isActive ? "ring-2 ring-fairway-500 ring-inset" : ""
                    }`}
                  >
                    {score ? (
                      <span
                        className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-bold ${colorClass}`}
                      >
                        {score.strokes}
                      </span>
                    ) : (
                      <span className="text-sand-300">—</span>
                    )}
                  </td>
                );
              })}
              <td className="px-2 py-2 text-center font-bold bg-sand-100">
                {frontTotals.score || "—"}
              </td>
            </tr>
          </tbody>

          {/* Back Nine */}
          <thead>
            <tr className="bg-fairway-500 text-white">
              <th className="px-2 py-2 text-left font-medium">Hole</th>
              {backNine.map((h) => (
                <th
                  key={h.id}
                  className="px-2 py-2 text-center font-medium w-10"
                >
                  {h.holeNumber}
                </th>
              ))}
              <th className="px-2 py-2 text-center font-medium bg-fairway-600">
                IN
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-slate-50">
              <td className="px-2 py-2 font-medium text-sand-600">Par</td>
              {backNine.map((h) => (
                <td key={h.id} className="px-2 py-2 text-center text-sand-600">
                  {h.par}
                </td>
              ))}
              <td className="px-2 py-2 text-center font-bold bg-sand-100">
                {backTotals.par}
              </td>
            </tr>
            <tr>
              <td className="px-2 py-2 font-medium text-sand-900">Score</td>
              {backNine.map((h) => {
                const score = scores.get(h.id);
                const isActive = h.holeNumber === currentHole;
                const relativeScore = score
                  ? getScoreRelativeToPar(score.strokes, h.par)
                  : null;
                const colorClass = relativeScore
                  ? getScoreColor(relativeScore)
                  : "";

                return (
                  <td
                    key={h.id}
                    onClick={() => onHoleSelect(h.holeNumber)}
                    className={`px-2 py-2 text-center cursor-pointer transition-colors hover:bg-sand-100 ${
                      isActive ? "ring-2 ring-fairway-500 ring-inset" : ""
                    }`}
                  >
                    {score ? (
                      <span
                        className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-bold ${colorClass}`}
                      >
                        {score.strokes}
                      </span>
                    ) : (
                      <span className="text-sand-300">—</span>
                    )}
                  </td>
                );
              })}
              <td className="px-2 py-2 text-center font-bold bg-sand-100">
                {backTotals.score || "—"}
              </td>
            </tr>
          </tbody>

          {/* Total Row */}
          <tfoot>
            <tr className="bg-fairway-700 text-white font-bold">
              <td className="px-2 py-3">Total</td>
              <td colSpan={9} className="px-2 py-3 text-center">
                Par {frontTotals.par + backTotals.par}
              </td>
              <td className="px-2 py-3 text-center text-xl">
                {(frontTotals.score || 0) + (backTotals.score || 0) || "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
