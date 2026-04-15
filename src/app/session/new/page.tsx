"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Users,
  MapPin,
  Search,
  Flag,
  ChevronRight,
  Copy,
  Share2,
  Check,
  Crown,
  AlertCircle,
  Plus,
  Globe,
  PenLine,
  X,
  Loader2,
} from "lucide-react";
import type { Course } from "@/types";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type SessionStatus = "WAITING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type CreatedSession = {
  id: string;
  inviteCode: string;
  status: SessionStatus;
  maxPlayers: number;
  name?: string | null;
  course: Course;
};
interface GolfApiCourse {
  id: number;
  club_name: string;
  course_name: string;
  location: { city: string; state: string; country: string; address: string };
  tees?: {
    male?: Array<{
      tee_name: string;
      par_total: number;
      course_rating: number;
      slope_rating: number;
      number_of_holes: number;
    }>;
  };
}

// ─────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────
const searchGolfApi = async (q: string): Promise<GolfApiCourse[]> => {
  if (!q || q.length < 2) return [];
  const res = await fetch(`/api/courses/search?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  return data.courses ?? [];
};

const importCourse = async (golfApiId: number): Promise<Course> => {
  const res = await fetch("/api/courses/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ golfApiId }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to import course");
  return data.data;
};

const createManualCourse = async (courseData: {
  name: string;
  city: string;
  state: string;
  par: number;
  numHoles: number;
  slope?: number;
  rating?: number;
}): Promise<Course> => {
  const res = await fetch("/api/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(courseData),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to create course");
  return data.data;
};

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function NewSessionPage() {
  const router = useRouter();
  const [step, setStep] = useState<"course" | "settings" | "share">("course");

  // Course step
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  // Session settings
  const [sessionName, setSessionName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);

  // Created session
  const [createdSession, setCreatedSession] = useState<CreatedSession | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  // Add course modal
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [modalTab, setModalTab] = useState<"search" | "manual">("search");

  // Golf API search
  const [apiQuery, setApiQuery] = useState("");
  const [debouncedApiQuery, setDebouncedApiQuery] = useState("");
  const [apiResults, setApiResults] = useState<GolfApiCourse[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [isImporting, setIsImporting] = useState<number | null>(null);
  const [importError, setImportError] = useState("");

  // Manual form
  const [newCourse, setNewCourse] = useState({
    name: "",
    city: "",
    state: "",
    par: 72,
    numHoles: 18,
    slope: "",
    rating: "",
  });
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualError, setManualError] = useState("");

  // ── Effects ────────────────────────────────

  // Fetch local courses
  useEffect(() => {
    const controller = new AbortController();
    const fetchCourses = async () => {
      setIsLoadingCourses(true);
      setCoursesError(null);
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        params.set("limit", "50");
        const res = await fetch(`/api/courses?${params}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok || !data.success)
          throw new Error(data.error || "Failed to load courses");
        setCourses(data.data);
      } catch (err: any) {
        if (err.name !== "AbortError") setCoursesError(err.message);
      } finally {
        setIsLoadingCourses(false);
      }
    };
    const t = setTimeout(fetchCourses, 300);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [searchQuery]);

  // Debounce Golf API query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedApiQuery(apiQuery), 400);
    return () => clearTimeout(t);
  }, [apiQuery]);

  // Fetch Golf API results
  useEffect(() => {
    if (debouncedApiQuery.length < 2) {
      setApiResults([]);
      return;
    }
    setIsSearchingApi(true);
    searchGolfApi(debouncedApiQuery)
      .then(setApiResults)
      .finally(() => setIsSearchingApi(false));
  }, [debouncedApiQuery]);

  // ── Helpers ────────────────────────────────
  const closeModal = () => {
    setShowAddCourse(false);
    setApiQuery("");
    setDebouncedApiQuery("");
    setApiResults([]);
    setModalTab("search");
    setImportError("");
    setManualError("");
    setNewCourse({
      name: "",
      city: "",
      state: "",
      par: 72,
      numHoles: 18,
      slope: "",
      rating: "",
    });
  };

  const handleImport = async (courseId: number) => {
    setIsImporting(courseId);
    setImportError("");
    try {
      const course = await importCourse(courseId);
      setCourses((prev) => {
        if (prev.find((c) => c.id === course.id)) return prev;
        return [course, ...prev];
      });
      setSelectedCourse(course);
      closeModal();
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setIsImporting(null);
    }
  };

  const handleAddManual = async () => {
    if (!newCourse.name || !newCourse.city || !newCourse.state) return;
    setIsAddingManual(true);
    setManualError("");
    try {
      const course = await createManualCourse({
        name: newCourse.name,
        city: newCourse.city,
        state: newCourse.state,
        par: newCourse.par,
        numHoles: newCourse.numHoles,
        slope: newCourse.slope ? parseInt(newCourse.slope) : undefined,
        rating: newCourse.rating ? parseFloat(newCourse.rating) : undefined,
      });
      setCourses((prev) => [course, ...prev]);
      setSelectedCourse(course);
      closeModal();
    } catch (err: any) {
      setManualError(err.message);
    } finally {
      setIsAddingManual(false);
    }
  };

  const handleCreateSession = async () => {
    if (!selectedCourse) return;
    setIsCreating(true);
    setError("");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          name: sessionName || `Round at ${selectedCourse.name}`,
          maxPlayers,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Failed to create session",
        );
        return;
      }
      setCreatedSession(data.data);
      setStep("share");
    } catch {
      setError("Failed to create session. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = () => {
    if (!createdSession?.inviteCode) return;
    navigator.clipboard.writeText(createdSession.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!createdSession?.inviteCode) return;
    const url = `${window.location.origin}/session/join?code=${createdSession.inviteCode}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join my golf round!",
          text: sessionName || "Join me for a round of golf",
          url,
        });
      } else {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* ignore cancel */
    }
  };

  const getTeeInfo = (course: GolfApiCourse) => {
    const tees = course.tees?.male ?? [];
    const tee =
      tees.find((t) => t.tee_name.toLowerCase() === "white") || tees[0];
    return tee
      ? `Par ${tee.par_total} · ${tee.number_of_holes} holes · Rating ${tee.course_rating} · Slope ${tee.slope_rating}`
      : null;
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gold-gradient text-fairway-900">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setError("");
                if (step === "course") router.back();
                else if (step === "settings") setStep("course");
                else if (step === "share") setStep("settings");
              }}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display text-2xl font-bold">Group Compete</h1>
              <p className="text-fairway-700/70 text-sm">
                Create a new session
              </p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mt-6">
            {["course", "settings", "share"].map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    step === s
                      ? "bg-fairway-700 text-white"
                      : ["settings", "share"].indexOf(step) >= i
                        ? "bg-fairway-700/50 text-white"
                        : "bg-white/30 text-fairway-700"
                  }`}
                >
                  {["settings", "share"].indexOf(step) > i ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 2 && (
                  <div
                    className={`w-8 h-0.5 mx-1 ${["settings", "share"].indexOf(step) > i ? "bg-fairway-700" : "bg-white/30"}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <div className="card p-3 mb-6 bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* ── Step 1: Course ── */}
        {step === "course" && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h2 className="font-display text-lg font-semibold text-sand-900">
              Select Course
            </h2>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-400" />
              <input
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-12"
              />
            </div>

            <div className="space-y-3">
              {isLoadingCourses && (
                <div className="card p-6 text-center text-sand-500">
                  Loading courses…
                </div>
              )}
              {!isLoadingCourses && coursesError && (
                <div className="card p-6 text-center text-red-600">
                  {coursesError}
                </div>
              )}
              {!isLoadingCourses && !coursesError && courses.length === 0 && (
                <div className="card p-6 text-center text-sand-500">
                  <Flag className="w-10 h-10 text-sand-300 mx-auto mb-2" />
                  <p>No courses yet</p>
                  <p className="text-sm text-sand-400">Add a course below</p>
                </div>
              )}
              {!isLoadingCourses &&
                courses.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => setSelectedCourse(course)}
                    className={`w-full card p-4 text-left transition-all ${
                      selectedCourse?.id === course.id
                        ? "ring-2 ring-gold-500 bg-gold-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          selectedCourse?.id === course.id
                            ? "bg-gold-500 text-white"
                            : "bg-gold-100 text-gold-600"
                        }`}
                      >
                        <Flag className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sand-900">
                          {course.name}
                        </p>
                        <p className="text-sm text-sand-500 flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {course.city ?? "—"}
                          {course.state ? `, ${course.state}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-medium text-sand-700">
                          Par {course.par}
                        </p>
                        {course.slope && (
                          <p className="text-xs text-sand-500">
                            Slope {course.slope}
                          </p>
                        )}
                      </div>
                      <ChevronRight
                        className={`w-5 h-5 ${selectedCourse?.id === course.id ? "text-gold-500" : "text-sand-300"}`}
                      />
                    </div>
                  </button>
                ))}
            </div>

            {/* Add Course button */}
            <button
              onClick={() => setShowAddCourse(true)}
              className="w-full card p-4 text-left hover:bg-slate-50 transition-colors border-2 border-dashed border-sand-200"
            >
              <div className="flex items-center gap-4 text-sand-500">
                <div className="w-12 h-12 rounded-xl bg-sand-100 flex items-center justify-center">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-medium block">Add New Course</span>
                  <span className="text-xs text-sand-400">
                    Search 10,000+ courses or enter manually
                  </span>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setError("");
                setStep("settings");
              }}
              disabled={!selectedCourse}
              className="btn btn-gold w-full disabled:opacity-50"
            >
              Continue <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {/* ── Step 2: Settings ── */}
        {step === "settings" && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <h2 className="font-display text-lg font-semibold text-sand-900">
              Session Settings
            </h2>

            {selectedCourse && (
              <div className="card p-4 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gold-100 text-gold-600 flex items-center justify-center">
                    <Flag className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sand-900">
                      {selectedCourse.name}
                    </p>
                    <p className="text-sm text-sand-500">
                      Par {selectedCourse.par}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-sand-700 mb-2">
                Session Name (Optional)
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Sunday Round with the Boys"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-sand-700 mb-2">
                Maximum Players
              </label>
              <div className="grid grid-cols-4 gap-3">
                {[2, 3, 4, 6].map((num) => (
                  <button
                    key={num}
                    onClick={() => setMaxPlayers(num)}
                    className={`card p-4 text-center transition-all ${
                      maxPlayers === num
                        ? "ring-2 ring-gold-500 bg-gold-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <Users
                      className={`w-6 h-6 mx-auto mb-1 ${maxPlayers === num ? "text-gold-600" : "text-sand-400"}`}
                    />
                    <p
                      className={`font-medium ${maxPlayers === num ? "text-gold-700" : "text-sand-600"}`}
                    >
                      {num}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreateSession}
              disabled={isCreating}
              className="btn btn-gold w-full"
            >
              {isCreating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Creating
                  Session...
                </span>
              ) : (
                <>
                  {" "}
                  Create Session <ChevronRight className="w-5 h-5" />{" "}
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* ── Step 3: Share ── */}
        {step === "share" && createdSession && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="text-center py-6">
              <div className="w-20 h-20 rounded-full bg-gold-100 mx-auto mb-4 flex items-center justify-center">
                <Crown className="w-10 h-10 text-gold-600" />
              </div>
              <h2 className="font-display text-2xl font-bold text-sand-900">
                Session Created!
              </h2>
              <p className="text-sand-600 mt-2">
                Share the invite code with your friends
              </p>
            </div>

            <div className="card p-6 text-center">
              <p className="text-sm text-sand-500 mb-2">Invite Code</p>
              <p className="font-mono text-4xl font-bold text-fairway-600 tracking-wider">
                {createdSession.inviteCode}
              </p>
              <button
                onClick={handleCopyCode}
                className="mt-4 btn btn-outline w-full"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 text-birdie" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" /> Copy Code
                  </>
                )}
              </button>
            </div>

            <button onClick={handleShare} className="btn btn-outline w-full">
              <Share2 className="w-5 h-5" /> Share Invite Link
            </button>

            <div className="card p-4 bg-slate-50">
              <h3 className="font-medium text-sand-900 mb-2">
                Session Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-sand-500">Course</span>
                  <span className="text-sand-700">
                    {createdSession.course.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sand-500">Max Players</span>
                  <span className="text-sand-700">
                    {createdSession.maxPlayers}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sand-500">Status</span>
                  <span className="text-gold-600 font-medium">
                    Waiting for players
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() =>
                router.push(`/session/${createdSession.inviteCode}`)
              }
              className="btn btn-gold w-full py-4 text-lg"
            >
              <Users className="w-5 h-5" /> Go to Lobby
            </button>
          </motion.div>
        )}
      </main>

      {/* ── Add Course Modal ── */}
      {showAddCourse && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={closeModal}
          />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl z-50 max-w-md mx-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-0">
              <h3 className="font-display text-xl font-bold text-sand-900">
                Add Course
              </h3>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-sand-100 transition-colors"
              >
                <X className="w-5 h-5 text-sand-500" />
              </button>
            </div>

            <div className="flex gap-2 px-6 pt-4">
              <button
                onClick={() => setModalTab("search")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  modalTab === "search"
                    ? "bg-gold-500 text-white"
                    : "bg-sand-100 text-sand-600 hover:bg-sand-200"
                }`}
              >
                <Globe className="w-4 h-4" /> Search Database
              </button>
              <button
                onClick={() => setModalTab("manual")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  modalTab === "manual"
                    ? "bg-gold-500 text-white"
                    : "bg-sand-100 text-sand-600 hover:bg-sand-200"
                }`}
              >
                <PenLine className="w-4 h-4" /> Enter Manually
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Search tab */}
              {modalTab === "search" && (
                <>
                  <p className="text-sm text-sand-500">
                    Search 10,000+ courses with accurate ratings and slope.
                  </p>

                  {importError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {importError}
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sand-400" />
                    <input
                      type="text"
                      placeholder="Search by course or club name..."
                      value={apiQuery}
                      onChange={(e) => setApiQuery(e.target.value)}
                      className="input pl-10"
                      autoFocus
                    />
                    {isSearchingApi && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sand-400 animate-spin" />
                    )}
                  </div>

                  {apiResults.length > 0 && (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {apiResults.map((course) => {
                        const teeInfo = getTeeInfo(course);
                        const loading = isImporting === course.id;
                        return (
                          <button
                            key={course.id}
                            onClick={() => handleImport(course.id)}
                            disabled={isImporting !== null}
                            className="w-full p-3 rounded-xl border border-sand-200 hover:border-gold-300 hover:bg-gold-50 text-left transition-all disabled:opacity-50 group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sand-900 text-sm leading-tight">
                                  {course.course_name || course.club_name}
                                </p>
                                {course.course_name &&
                                  course.club_name !== course.course_name && (
                                    <p className="text-xs text-sand-400">
                                      {course.club_name}
                                    </p>
                                  )}
                                <div className="flex items-center gap-1 mt-1 text-xs text-sand-500">
                                  <MapPin className="w-3 h-3" />
                                  <span>
                                    {course.location.city},{" "}
                                    {course.location.state}
                                  </span>
                                </div>
                                {teeInfo && (
                                  <p className="text-xs text-gold-600 mt-1">
                                    {teeInfo}
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0">
                                {loading ? (
                                  <Loader2 className="w-5 h-5 text-gold-500 animate-spin" />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-gold-100 group-hover:bg-gold-500 flex items-center justify-center transition-colors">
                                    <Plus className="w-4 h-4 text-gold-600 group-hover:text-white" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {debouncedApiQuery.length >= 2 &&
                    !isSearchingApi &&
                    apiResults.length === 0 && (
                      <div className="text-center py-6">
                        <p className="text-sand-500 text-sm">
                          No courses found for "{debouncedApiQuery}"
                        </p>
                        <button
                          onClick={() => setModalTab("manual")}
                          className="text-gold-600 text-sm font-medium mt-2 hover:underline"
                        >
                          Enter manually instead
                        </button>
                      </div>
                    )}

                  {debouncedApiQuery.length < 2 && (
                    <div className="text-center py-6 text-sand-400 text-sm">
                      Type at least 2 characters to search
                    </div>
                  )}
                </>
              )}

              {/* Manual tab */}
              {modalTab === "manual" && (
                <>
                  {manualError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {manualError}
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Course Name *"
                    value={newCourse.name}
                    onChange={(e) =>
                      setNewCourse({ ...newCourse, name: e.target.value })
                    }
                    className="input"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="City *"
                      value={newCourse.city}
                      onChange={(e) =>
                        setNewCourse({ ...newCourse, city: e.target.value })
                      }
                      className="input"
                    />
                    <input
                      type="text"
                      placeholder="State *"
                      value={newCourse.state}
                      onChange={(e) =>
                        setNewCourse({ ...newCourse, state: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-sand-600 mb-1 block">
                        Par
                      </label>
                      <input
                        type="number"
                        value={newCourse.par}
                        onChange={(e) =>
                          setNewCourse({
                            ...newCourse,
                            par: parseInt(e.target.value) || 72,
                          })
                        }
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-sand-600 mb-1 block">
                        Holes
                      </label>
                      <select
                        value={newCourse.numHoles}
                        onChange={(e) =>
                          setNewCourse({
                            ...newCourse,
                            numHoles: parseInt(e.target.value),
                          })
                        }
                        className="input"
                      >
                        <option value={9}>9 Holes</option>
                        <option value={18}>18 Holes</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Slope (optional)"
                      value={newCourse.slope}
                      onChange={(e) =>
                        setNewCourse({ ...newCourse, slope: e.target.value })
                      }
                      className="input"
                    />
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Rating (optional)"
                      value={newCourse.rating}
                      onChange={(e) =>
                        setNewCourse({ ...newCourse, rating: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={closeModal}
                      className="btn btn-outline flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddManual}
                      disabled={
                        !newCourse.name ||
                        !newCourse.city ||
                        !newCourse.state ||
                        isAddingManual
                      }
                      className="btn btn-primary flex-1 disabled:opacity-50"
                    >
                      {isAddingManual ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Adding...
                        </span>
                      ) : (
                        "Add Course"
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
