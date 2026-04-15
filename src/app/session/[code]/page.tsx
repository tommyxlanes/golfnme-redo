"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Users,
  Flag,
  Crown,
  Trophy,
  Play,
  MessageCircle,
  Send,
  X,
  Copy,
  Check,
  ChevronRight,
  Minus,
  Plus,
  Zap,
} from "lucide-react";
import { useAuthStore } from "@/stores";
import {
  formatScoreToPar,
  getScoreColor,
  getScoreRelativeToPar,
} from "@/lib/golf-utils";
import type { Course, Hole } from "@/types";
import { useSession } from "next-auth/react";
import { useSessionChat } from "@/hooks/useSessionChat";

// ---- Types matching your API responses ----

type SessionStatus = "WAITING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

interface ApiUser {
  id: string;
  name: string | null;
  username: string;
  avatarUrl: string | null;
}

interface ApiMember {
  id: string;
  sessionId: string;
  userId: string;
  isReady: boolean;
  joinedAt: string | Date;
  user: ApiUser;
}

interface ApiScore {
  id: string;
  holeId: string;
  strokes: number;
  putts?: number;
}

interface ApiRound {
  id: string;
  userId: string;
  scores: ApiScore[];
  user: ApiUser;
}

interface ApiSession {
  id: string;
  hostId: string;
  inviteCode: string;
  status: SessionStatus;
  maxPlayers: number;
  course: Course & { holes?: Hole[] };
  host: ApiUser;
  members: ApiMember[];
  rounds?: ApiRound[];
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  currentHole: number;
  totalScore: number;
  scoreToPar: number;
  lastUpdate: Date;
  scores: number[];
}

interface ChatMessage {
  userId: string;
  userName: string;
  text: string;
}

export default function ActiveSessionPage() {
  const router = useRouter();
  const params = useParams();
  const inviteCode = params.code as string;
  const { data: session, status: authStatus } = useSession();

  const user = session?.user;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<ApiSession | null>(null);

  const [status, setStatus] = useState<"lobby" | "playing">("lobby");

  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [myScores, setMyScores] = useState<number[]>(Array(18).fill(0));
  const [myRoundId, setMyRoundId] = useState<string | null>(null);

  const [currentHole, setCurrentHole] = useState(1);
  const [strokes, setStrokes] = useState(4);
  const [isSaving, setIsSaving] = useState(false);

  const [copied, setCopied] = useState(false);

  const [lastReadCount, setLastReadCount] = useState(0);
  const [hasStartedLoading, setHasStartedLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");

  const [readyLoading, setReadyLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);

  const [putts, setPutts] = useState<number | undefined>(undefined);
  const [fairwayHit, setFairwayHit] = useState<boolean | undefined>(undefined);
  const [greenInReg, setGreenInReg] = useState<boolean | undefined>(undefined);

  const [isCompleting, setIsCompleting] = useState(false);

  const course: (Course & { holes?: Hole[] }) | null =
    sessionData?.course ?? null;
  const holes: Hole[] =
    course?.holes && course.holes.length > 0
      ? course.holes
      : Array.from({ length: 18 }, (_, i) => ({
          id: `hole-${i + 1}`,
          courseId: course?.id ?? "unknown",
          holeNumber: i + 1,
          par: 4,
          yardage: 350,
          handicapRank: i + 1,
        }));

  const hole = holes[currentHole - 1];

  const allHolesScored = myScores.filter((s) => s > 0).length === holes.length;

  const currentUserId = user?.id;

  const {
    messages: chatMessages,
    isConnected: chatConnected,
    isLoading: chatLoading,
    sendMessage,
  } = useSessionChat({
    sessionId: sessionData?.id,
    userId: currentUserId,
    userName: user?.name || user?.username || "Player",
  });

  useEffect(() => {
    setHasStartedLoading(false);
    setInitialLoadDone(false);
  }, [sessionData?.id]);

  useEffect(() => {
    if (chatLoading && sessionData?.id) {
      setHasStartedLoading(true);
    }
  }, [chatLoading, sessionData?.id]);

  useEffect(() => {
    if (
      !chatLoading &&
      hasStartedLoading &&
      !initialLoadDone &&
      sessionData?.id
    ) {
      setLastReadCount(chatMessages.length);
      setInitialLoadDone(true);
    }
  }, [
    chatLoading,
    hasStartedLoading,
    initialLoadDone,
    chatMessages.length,
    sessionData?.id,
  ]);

  const isHost = !!(
    sessionData &&
    currentUserId &&
    sessionData.hostId === currentUserId
  );

  const myMember = sessionData?.members.find((m) => m.userId === currentUserId);
  const isMeReady = !!myMember?.isReady;

  const unreadCount = initialLoadDone
    ? chatMessages
        .slice(lastReadCount)
        .filter((msg) => msg.userId !== currentUserId).length
    : 0;

  const handleOpenChat = () => {
    setShowChat(true);
    setLastReadCount(chatMessages.length);
  };

  // --- Helpers ---

  function buildPlayersFromSession(session: ApiSession): LeaderboardEntry[] {
    const scoresEmpty = Array(18).fill(0);
    const now = new Date();

    const allUsers: ApiUser[] = [
      session.host,
      ...session.members
        .map((m) => m.user)
        .filter((u) => u.id !== session.host.id),
    ];

    return allUsers.map((u) => ({
      userId: u.id,
      userName: u.name || u.username,
      currentHole: 1,
      totalScore: 0,
      scoreToPar: 0,
      lastUpdate: now,
      scores: [...scoresEmpty],
    }));
  }

  function buildLeaderboardFromRounds(
    session: ApiSession,
    courseHoles: Hole[]
  ): LeaderboardEntry[] {
    if (!session.rounds || session.rounds.length === 0) {
      return buildPlayersFromSession(session);
    }

    return session.rounds
      .map((round) => {
        const scores = Array(18).fill(0);

        round.scores?.forEach((s) => {
          const holeNum = courseHoles.find(
            (h) => h.id === s.holeId
          )?.holeNumber;
          if (holeNum) {
            scores[holeNum - 1] = s.strokes;
          }
        });

        const totalScore = scores.reduce((a, b) => a + b, 0);
        const playedHoles = scores.filter((s) => s > 0).length;
        const parThrough = courseHoles
          .slice(0, playedHoles)
          .reduce((a, h) => a + h.par, 0);

        return {
          userId: round.userId,
          userName: round.user?.name || round.user?.username || "Player",
          currentHole: playedHoles,
          totalScore,
          scoreToPar: totalScore - parThrough,
          lastUpdate: new Date(),
          scores,
        };
      })
      .sort((a, b) => {
        if (a.totalScore === 0 && b.totalScore === 0) return 0;
        if (a.totalScore === 0) return 1;
        if (b.totalScore === 0) return -1;
        return a.scoreToPar - b.scoreToPar;
      });
  }

  function userIsInSession(
    session: ApiSession,
    uId: string | undefined | null
  ): boolean {
    if (!uId) return false;
    if (session.hostId === uId) return true;
    return session.members.some((m) => m.userId === uId);
  }

  async function fetchSession() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/sessions?inviteCode=${inviteCode}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to load session");
        setSessionData(null);
        setPlayers([]);
        return;
      }

      const session: ApiSession = data.data;
      console.log("Session rounds:", session.rounds);
      console.log("Current user ID:", currentUserId);
      setSessionData(session);
      setStatus(session.status === "WAITING" ? "lobby" : "playing");

      const courseHoles = session.course.holes ?? holes;

      if (session.status === "IN_PROGRESS" && session.rounds) {
        if (currentUserId) {
          const myRound = session.rounds.find(
            (r) => r.userId === currentUserId
          );
          console.log("My round:", myRound);
          if (myRound) {
            setMyRoundId(myRound.id);
            console.log("Set myRoundId to:", myRound.id);

            if (myRound.scores) {
              const loadedScores = Array(18).fill(0);
              myRound.scores.forEach((s) => {
                const holeNum = courseHoles.find(
                  (h) => h.id === s.holeId
                )?.holeNumber;
                if (holeNum) {
                  loadedScores[holeNum - 1] = s.strokes;
                }
              });
              setMyScores(loadedScores);

              const firstUnplayed = loadedScores.findIndex((s) => s === 0);
              if (firstUnplayed !== -1) {
                setCurrentHole(firstUnplayed + 1);
              }
            }
          }
        }

        setPlayers(buildLeaderboardFromRounds(session, courseHoles));
      } else if (session.status === "WAITING") {
        setPlayers(buildPlayersFromSession(session));
      }
    } catch (err) {
      console.error("Error fetching session:", err);
      setError("Failed to load session");
    } finally {
      setLoading(false);
    }
  }

  async function ensureJoined(session: ApiSession) {
    if (!currentUserId) return;

    if (userIsInSession(session, currentUserId)) return;

    if (session.status !== "WAITING") return;

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      const data = await res.json();

      if (
        !res.ok &&
        data.error &&
        !/Already in this session/i.test(data.error)
      ) {
        setError(data.error);
        return;
      }

      await fetchSession();
    } catch (err) {
      console.error("Error joining session:", err);
      setError("Failed to join session.");
    }
  }

  // --- Effects ---

  useEffect(() => {
    if (authStatus === "loading") return;
    fetchSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode, authStatus, currentUserId]);

  useEffect(() => {
    if (sessionData && currentUserId) {
      ensureJoined(sessionData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.id, currentUserId]);

  useEffect(() => {
    if (status !== "lobby" || authStatus === "loading") return;

    const interval = setInterval(() => {
      fetchSession();
    }, 3000);

    return () => clearInterval(interval);
  }, [status, authStatus, inviteCode]);

  useEffect(() => {
    if (!hole) return;
    const existingScore = myScores[currentHole - 1];
    setStrokes(existingScore || hole.par || 4);
    setPutts(undefined);
    setFairwayHit(undefined);
    setGreenInReg(undefined);
  }, [currentHole, hole?.par]);

  // --- Actions ---

  const handleCopyCode = () => {
    if (!sessionData?.inviteCode) return;
    navigator.clipboard.writeText(sessionData.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleReady = async () => {
    if (!sessionData) return;
    if (!currentUserId) {
      setError("You must be logged in to ready up.");
      return;
    }

    setReadyLoading(true);
    setError(null);

    try {
      const action = isMeReady ? "unready" : "ready";

      const res = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionData.id,
          action,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to update ready status");
      } else {
        await fetchSession();
      }
    } catch (err) {
      console.error("Error updating ready status:", err);
      setError("Failed to update ready status.");
    } finally {
      setReadyLoading(false);
    }
  };

  const handleStartSession = async () => {
    if (!sessionData || !isHost) return;

    setStartLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionData.id,
          action: "start",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to start session");
        return;
      }

      await fetchSession();
    } catch (err) {
      console.error("Error starting session:", err);
      setError("Failed to start session.");
    } finally {
      setStartLoading(false);
    }
  };

  const handleSaveScore = async () => {
    if (!hole || !sessionData || !myRoundId) {
      setError("Unable to save score - round not found");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: myRoundId,
          holeId: hole.id,
          strokes,
          putts,
          fairwayHit,
          greenInReg,
          penalties: 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Failed to save score:", data.error);
        setError("Failed to save score");
        setIsSaving(false);
        return;
      }

      const newScores = [...myScores];
      newScores[currentHole - 1] = strokes;
      setMyScores(newScores);

      const updatedPlayers = players.map((p) => {
        if (p.userId === currentUserId) {
          const newTotal = newScores.reduce((a, b) => a + (b || 0), 0);
          const playedHoles = newScores.filter((s) => s > 0).length;
          const parThrough = holes
            .slice(0, playedHoles)
            .reduce((a, h) => a + h.par, 0);

          return {
            ...p,
            scores: newScores,
            totalScore: newTotal,
            scoreToPar: parThrough ? newTotal - parThrough : 0,
            currentHole,
            lastUpdate: new Date(),
          };
        }
        return p;
      });

      updatedPlayers.sort((a, b) => {
        if (a.totalScore === 0 && b.totalScore === 0) return 0;
        if (a.totalScore === 0) return 1;
        if (b.totalScore === 0) return -1;
        return a.scoreToPar - b.scoreToPar;
      });

      setPlayers(updatedPlayers);

      setPutts(undefined);
      setFairwayHit(undefined);
      setGreenInReg(undefined);

      if (currentHole < 18) {
        setCurrentHole((h) => h + 1);
      }
    } catch (error) {
      console.error("Error saving score:", error);
      setError("Failed to save score");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim());
    setChatInput("");
  };

  // --- Derived totals ---
  const myTotalScore = myScores.reduce((a, b) => a + (b || 0), 0);
  const playedHoles = myScores.filter((s) => s > 0).length;
  const courseParThrough = holes
    .slice(0, playedHoles)
    .reduce((a, h) => a + h.par, 0);
  const myScoreToPar = courseParThrough ? myTotalScore - courseParThrough : 0;

  // --- Render ---

  if ((loading && !sessionData) || authStatus === "loading") {
    return (
      <div className="min-h-screen bg-sand-50 dark:bg-dark-950 flex items-center justify-center transition-colors">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-gold-200 dark:border-gold-800 border-t-gold-500 rounded-full"
        />
      </div>
    );
  }

  if (error && !sessionData) {
    return (
      <div className="min-h-screen bg-sand-50 dark:bg-dark-950 flex items-center justify-center transition-colors">
        <div className="card p-8 text-center max-w-md">
          <p className="text-sand-800 dark:text-sand-200 font-semibold mb-2">
            Session Error
          </p>
          <p className="text-sand-600 dark:text-sand-400 mb-4">{error}</p>
          <button onClick={() => router.push("/")} className="btn btn-primary">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const handleCompleteRound = async () => {
    if (!myRoundId) {
      setError("No round found to complete");
      return;
    }

    setIsCompleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/rounds/${myRoundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to complete round");
        setIsCompleting(false);
        return;
      }

      router.push(`/round/${myRoundId}/summary`);
    } catch (error) {
      console.error("Error completing round:", error);
      setError("Failed to complete round");
      setIsCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand-50 dark:bg-dark-950 flex flex-col transition-colors">
      {/* Header */}
      <header className="bg-gold-gradient dark:bg-gold-gradient-dark text-fairway-900 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <button
              onClick={() => router.push("/")}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="text-center">
              <p className="font-medium text-sm">
                {course?.name || "Golf Session"}
              </p>
              <div className="flex items-center justify-center gap-2 text-fairway-700/70 dark:text-fairway-800/70 text-xs">
                <span
                  className={`w-2 h-2 rounded-full ${
                    chatConnected ? "bg-birdie" : "bg-sand-400"
                  }`}
                />
                <span>{players.length} players</span>
              </div>
            </div>

            <button
              onClick={handleOpenChat}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors relative"
            >
              <MessageCircle className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Top-level inline errors */}
        {error && (
          <div className="card p-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {/* Lobby View */}
        {status === "lobby" && sessionData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Invite Code */}
            <div className="card p-6 text-center">
              <p className="text-sm text-sand-500 dark:text-sand-400 mb-2">
                Invite Code
              </p>
              <p className="font-mono text-3xl font-bold text-fairway-600 dark:text-fairway-400 tracking-wider mb-4">
                {sessionData.inviteCode}
              </p>
              <button onClick={handleCopyCode} className="btn btn-outline">
                {copied ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
                {copied ? "Copied!" : "Copy Code"}
              </button>
            </div>

            {/* Players List */}
            <div className="card overflow-hidden">
              <div className="bg-sand-50 dark:bg-dark-800 px-4 py-3 flex items-center justify-between border-b border-sand-100 dark:border-dark-700">
                <h3 className="font-medium text-sand-900 dark:text-sand-100">
                  Players
                </h3>
                <span className="text-sm text-sand-500 dark:text-sand-400">
                  {sessionData.members.length} / {sessionData.maxPlayers}
                </span>
              </div>
              <div className="divide-y divide-sand-100 dark:divide-dark-800">
                {/* Host */}
                {(() => {
                  const hostMember = sessionData.members.find(
                    (m) => m.userId === sessionData.hostId
                  );
                  return (
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-10 h-10 rounded-full bg-gold-100 dark:bg-gold-900/40 text-gold-600 dark:text-gold-400 flex items-center justify-center">
                        <Crown className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sand-900 dark:text-sand-100">
                          {sessionData.host.name || sessionData.host.username}
                        </p>
                        <p className="text-sm text-sand-500 dark:text-sand-400">
                          Host{" "}
                          {hostMember
                            ? hostMember.isReady
                              ? "• Ready"
                              : "• Not Ready"
                            : ""}
                        </p>
                      </div>
                      {sessionData.hostId === currentUserId && (
                        <span className="px-2 py-1 bg-fairway-100 dark:bg-fairway-900/40 text-fairway-700 dark:text-fairway-400 text-xs font-medium rounded-full">
                          You
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Members (excluding host) */}
                {sessionData.members
                  .filter((m) => m.userId !== sessionData.hostId)
                  .map((m) => (
                    <div key={m.id} className="flex items-center gap-4 p-4">
                      <div className="w-10 h-10 rounded-full bg-fairway-100 dark:bg-fairway-900/40 text-fairway-600 dark:text-fairway-400 flex items-center justify-center">
                        {m.user.name?.[0] || m.user.username[0] || "?"}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sand-900 dark:text-sand-100">
                          {m.user.name || m.user.username}
                        </p>
                        <p className="text-sm text-sand-500 dark:text-sand-400">
                          {m.isReady ? "Ready" : "Not Ready"}
                        </p>
                      </div>
                      {m.userId === currentUserId && (
                        <span className="px-2 py-1 bg-fairway-100 dark:bg-fairway-900/40 text-fairway-700 dark:text-fairway-400 text-xs font-medium rounded-full">
                          You
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            {/* Ready Button */}
            <button
              onClick={handleToggleReady}
              className="btn btn-outline w-full"
              disabled={readyLoading}
            >
              {readyLoading ? (
                <span className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-5 h-5 border-2 border-sand-300 dark:border-sand-600 border-t-sand-700 dark:border-t-sand-300 rounded-full"
                  />
                  Updating...
                </span>
              ) : isMeReady ? (
                <>
                  <Flag className="w-5 h-5" />
                  I'm Not Ready
                </>
              ) : (
                <>
                  <Flag className="w-5 h-5" />
                  I'm Ready
                </>
              )}
            </button>

            {/* Start Button (Host Only) */}
            {isHost && (
              <button
                onClick={handleStartSession}
                className="btn btn-gold w-full py-4 text-lg"
                disabled={startLoading}
              >
                {startLoading ? (
                  <span className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="w-5 h-5 border-2 border-fairway-900/30 border-t-fairway-900 rounded-full"
                    />
                    Starting...
                  </span>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Start Round
                  </>
                )}
              </button>
            )}
          </motion.div>
        )}

        {/* Playing View */}
        {status === "playing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Live Leaderboard */}
            <div className="card overflow-hidden">
              <div className="bg-gold-gradient dark:bg-gold-gradient-dark px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-fairway-700 dark:text-fairway-800" />
                  <h3 className="font-display font-semibold text-fairway-900 dark:text-fairway-950">
                    Leaderboard
                  </h3>
                </div>
                <span className="text-sm text-fairway-700/70 dark:text-fairway-800/70">
                  Live
                </span>
              </div>
              <div className="divide-y divide-sand-100 dark:divide-dark-800">
                {players.map((player, index) => (
                  <motion.div
                    key={player.userId}
                    layout
                    className={`flex items-center gap-4 p-4 ${
                      player.userId === currentUserId
                        ? "bg-fairway-50 dark:bg-fairway-900/20"
                        : ""
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0
                          ? "bg-gold-500 text-white"
                          : index === 1
                          ? "bg-sand-300 dark:bg-dark-500 text-sand-700 dark:text-sand-200"
                          : index === 2
                          ? "bg-amber-600 text-white"
                          : "bg-sand-100 dark:bg-dark-700 text-sand-500 dark:text-sand-400"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sand-900 dark:text-sand-100 truncate">
                        {player.userName}
                        {player.userId === currentUserId && (
                          <span className="ml-2 text-xs text-fairway-600 dark:text-fairway-400">
                            (You)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-sand-500 dark:text-sand-400">
                        Thru {player.scores.filter((s) => s > 0).length}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xl font-display font-bold ${
                          player.totalScore === 0
                            ? "text-sand-300 dark:text-sand-600"
                            : player.scoreToPar <= 0
                            ? "text-birdie dark:text-emerald-400"
                            : "text-bogey dark:text-amber-400"
                        }`}
                      >
                        {player.totalScore > 0
                          ? formatScoreToPar(player.scoreToPar)
                          : "—"}
                      </p>
                      <p className="text-sm text-sand-500 dark:text-sand-400">
                        {player.totalScore || "—"}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Score Entry Card */}
            <div className="card overflow-hidden">
              {/* Hole Header */}
              <div className="bg-fairway-gradient dark:bg-fairway-gradient-dark text-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setCurrentHole((h) => (h > 1 ? h - 1 : h))}
                    disabled={currentHole === 1}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 rotate-180" />
                  </button>
                  <div className="text-center">
                    <p className="text-white/60 text-sm">Hole</p>
                    <p className="text-4xl font-display font-bold">
                      {currentHole}
                    </p>
                  </div>
                  <button
                    onClick={() => setCurrentHole((h) => (h < 18 ? h + 1 : h))}
                    disabled={currentHole === 18}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-white/60 text-xs">Par</p>
                    <p className="text-2xl font-bold">{hole?.par}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Yards</p>
                    <p className="text-2xl font-bold">{hole?.yardage ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Handicap</p>
                    <p className="text-2xl font-bold">
                      {hole?.handicapRank ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Strokes Input */}
                <div>
                  <p className="text-sm font-medium text-sand-600 dark:text-sand-400 mb-3 text-center">
                    Strokes
                  </p>
                  <div className="flex items-center justify-center gap-6">
                    <button
                      onClick={() => setStrokes((s) => Math.max(1, s - 1))}
                      className="w-12 h-12 rounded-full bg-sand-100 dark:bg-dark-800 hover:bg-sand-200 dark:hover:bg-dark-700 flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-5 h-5 text-sand-600 dark:text-sand-400" />
                    </button>

                    <motion.div
                      key={strokes}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-display font-bold ${getScoreColor(
                        getScoreRelativeToPar(strokes, hole?.par || 4)
                      )}`}
                    >
                      {strokes}
                    </motion.div>

                    <button
                      onClick={() => setStrokes((s) => Math.min(15, s + 1))}
                      className="w-12 h-12 rounded-full bg-sand-100 dark:bg-dark-800 hover:bg-sand-200 dark:hover:bg-dark-700 flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-5 h-5 text-sand-600 dark:text-sand-400" />
                    </button>
                  </div>

                  {/* Quick Score Buttons */}
                  <div className="grid grid-cols-5 gap-2 mt-4">
                    {[
                      (hole?.par ?? 4) - 2,
                      (hole?.par ?? 4) - 1,
                      hole?.par ?? 4,
                      (hole?.par ?? 4) + 1,
                      (hole?.par ?? 4) + 2,
                    ]
                      .filter((s) => s > 0)
                      .map((score) => (
                        <button
                          key={score}
                          onClick={() => setStrokes(score)}
                          className={`py-2 rounded-xl text-sm font-medium transition-all ${
                            strokes === score
                              ? "bg-fairway-500 dark:bg-fairway-600 text-white"
                              : "bg-sand-100 dark:bg-dark-800 text-sand-600 dark:text-sand-400 hover:bg-sand-200 dark:hover:bg-dark-700"
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Putts Input */}
                <div>
                  <p className="text-sm font-medium text-sand-600 dark:text-sand-400 mb-3 text-center">
                    Putts
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {[0, 1, 2, 3, 4].map((num) => (
                      <button
                        key={num}
                        onClick={() => setPutts(num)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium transition-all ${
                          putts === num
                            ? "bg-fairway-500 dark:bg-fairway-600 text-white"
                            : "bg-sand-100 dark:bg-dark-800 text-sand-600 dark:text-sand-400 hover:bg-sand-200 dark:hover:bg-dark-700"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        setPutts(
                          putts !== undefined ? Math.min(10, putts + 1) : 5
                        )
                      }
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium transition-all ${
                        putts !== undefined && putts > 4
                          ? "bg-fairway-500 dark:bg-fairway-600 text-white"
                          : "bg-sand-100 dark:bg-dark-800 text-sand-600 dark:text-sand-400 hover:bg-sand-200 dark:hover:bg-dark-700"
                      }`}
                    >
                      {putts !== undefined && putts > 4 ? putts : "5+"}
                    </button>
                  </div>
                </div>

                {/* Fairway & GIR Toggles */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Fairway Hit - Only show for Par 4 and Par 5 */}
                  {(hole?.par ?? 4) >= 4 && (
                    <div>
                      <p className="text-sm font-medium text-sand-600 dark:text-sand-400 mb-2 text-center">
                        Fairway
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFairwayHit(true)}
                          className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                            fairwayHit === true
                              ? "bg-birdie dark:bg-emerald-600 text-white"
                              : "bg-sand-100 dark:bg-dark-800 text-sand-600 dark:text-sand-400 hover:bg-sand-200 dark:hover:bg-dark-700"
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          Hit
                        </button>
                        <button
                          onClick={() => setFairwayHit(false)}
                          className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                            fairwayHit === false
                              ? "bg-bogey dark:bg-amber-600 text-white"
                              : "bg-sand-100 dark:bg-dark-800 text-sand-600 dark:text-sand-400 hover:bg-sand-200 dark:hover:bg-dark-700"
                          }`}
                        >
                          <X className="w-4 h-4" />
                          Miss
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Green in Regulation */}
                  <div
                    className={`${(hole?.par ?? 4) < 4 ? "col-span-2" : ""}`}
                  >
                    <p className="text-sm font-medium text-sand-600 dark:text-sand-400 mb-2 text-center">
                      Green in Reg
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setGreenInReg(true)}
                        className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                          greenInReg === true
                            ? "bg-birdie dark:bg-emerald-600 text-white"
                            : "bg-sand-100 dark:bg-dark-800 text-sand-600 dark:text-sand-400 hover:bg-sand-200 dark:hover:bg-dark-700"
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        Yes
                      </button>
                      <button
                        onClick={() => setGreenInReg(false)}
                        className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                          greenInReg === false
                            ? "bg-bogey dark:bg-amber-600 text-white"
                            : "bg-sand-100 dark:bg-dark-800 text-sand-600 dark:text-sand-400 hover:bg-sand-200 dark:hover:bg-dark-700"
                        }`}
                      >
                        <X className="w-4 h-4" />
                        No
                      </button>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveScore}
                  disabled={isSaving || !myRoundId}
                  className="btn btn-primary w-full py-4 text-lg"
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Saving...
                    </span>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Save & Continue
                    </>
                  )}
                </button>

                {/* Running Total */}
                <div className="bg-sand-50 dark:bg-dark-800 rounded-xl p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-sand-500 dark:text-sand-400">
                        Through
                      </p>
                      <p className="text-lg font-bold text-sand-900 dark:text-sand-100">
                        {playedHoles} holes
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-sand-500 dark:text-sand-400">
                        Total
                      </p>
                      <p className="text-lg font-bold text-sand-900 dark:text-sand-100">
                        {myTotalScore || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-sand-500 dark:text-sand-400">
                        To Par
                      </p>
                      <p
                        className={`text-lg font-bold ${
                          myScoreToPar <= 0
                            ? "text-birdie dark:text-emerald-400"
                            : "text-bogey dark:text-amber-400"
                        }`}
                      >
                        {playedHoles ? formatScoreToPar(myScoreToPar) : "E"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Hole Progress */}
            <div className="flex gap-1 overflow-x-auto p-2">
              {holes.map((h, i) => {
                const score = myScores[i];
                const relative = score
                  ? getScoreRelativeToPar(score, h.par)
                  : null;

                return (
                  <button
                    key={h.id}
                    onClick={() => setCurrentHole(i + 1)}
                    className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                      currentHole === i + 1
                        ? "ring-2 ring-fairway-500 dark:ring-fairway-400 ring-offset-2 dark:ring-offset-dark-950"
                        : ""
                    } ${
                      score
                        ? getScoreColor(relative!)
                        : "bg-sand-100 dark:bg-dark-800 text-sand-400 dark:text-sand-500"
                    }`}
                  >
                    {score || i + 1}
                  </button>
                );
              })}
            </div>

            {/* Finish Round Section */}
            {allHolesScored && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-6 bg-gradient-to-br from-gold-50 to-gold-100 dark:from-gold-900/30 dark:to-gold-800/30 border-gold-200 dark:border-gold-700"
              >
                <div className="text-center mb-4">
                  <Trophy className="w-12 h-12 text-gold-500 mx-auto mb-2" />
                  <h3 className="text-xl font-display font-bold text-sand-900 dark:text-sand-100">
                    Round Complete!
                  </h3>
                  <p className="text-sand-600 dark:text-sand-400">
                    You scored {myTotalScore} ({formatScoreToPar(myScoreToPar)})
                  </p>
                </div>

                <button
                  onClick={handleCompleteRound}
                  disabled={isCompleting}
                  className="btn btn-gold w-full py-4 text-lg"
                >
                  {isCompleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="w-5 h-5 border-2 border-fairway-900/30 border-t-fairway-900 rounded-full"
                      />
                      Finishing...
                    </span>
                  ) : (
                    <>
                      <Flag className="w-5 h-5" />
                      Finish & View Summary
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {/* Or show progress toward completion */}
            {!allHolesScored && playedHoles > 0 && (
              <div className="card p-4 bg-sand-50 dark:bg-dark-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-sand-600 dark:text-sand-400">
                    Round Progress
                  </span>
                  <span className="text-sm font-medium text-sand-900 dark:text-sand-100">
                    {playedHoles} / {holes.length} holes
                  </span>
                </div>
                <div className="w-full bg-sand-200 dark:bg-dark-700 rounded-full h-2">
                  <div
                    className="bg-fairway-500 dark:bg-fairway-400 h-2 rounded-full transition-all"
                    style={{ width: `${(playedHoles / holes.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Chat Drawer */}
      <AnimatePresence>
        {showChat && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowChat(false)}
              className="fixed inset-0 bg-black/50 z-30"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-dark-900 rounded-t-2xl z-40 max-h-[70vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-sand-100 dark:border-dark-800">
                <h3 className="font-display font-semibold text-sand-900 dark:text-sand-100">
                  Group Chat
                </h3>
                <button
                  onClick={() => {
                    setShowChat(false);
                    setLastReadCount(chatMessages.length);
                  }}
                >
                  <X className="w-5 h-5 text-sand-500 dark:text-sand-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 ? (
                  <p className="text-center text-sand-400 dark:text-sand-500 py-8">
                    No messages yet. Start the conversation!
                  </p>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${
                        msg.userId === currentUserId
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                          msg.userId === currentUserId
                            ? "bg-fairway-500 dark:bg-fairway-600 text-white"
                            : "bg-sand-100 dark:bg-dark-800 text-sand-900 dark:text-sand-100"
                        }`}
                      >
                        <p className="text-xs opacity-70 mb-1">
                          {msg.userName}
                        </p>
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-sand-100 dark:border-dark-800 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Type a message..."
                  className="input flex-1"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim()}
                  className="btn btn-primary px-4 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
