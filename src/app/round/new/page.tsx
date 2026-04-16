"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Search,
  ChevronRight,
  Flag,
  Plus,
  ArrowLeft,
  Cloud,
  Sun,
  CloudRain,
  Wind,
  Loader2,
  Globe,
  PenLine,
  Check,
  X,
} from "lucide-react";
import type { Course } from "@/types";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface GolfApiCourse {
  id: number;
  club_name: string;
  course_name: string;
  location: {
    city: string;
    state: string;
    country: string;
    address: string;
  };
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

const weatherOptions = [
  { id: "sunny", label: "Sunny", icon: Sun },
  { id: "cloudy", label: "Cloudy", icon: Cloud },
  { id: "rainy", label: "Rainy", icon: CloudRain },
  { id: "windy", label: "Windy", icon: Wind },
];

// ─────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────
const fetchCourses = async (search: string): Promise<Course[]> => {
  const res = await fetch(`/api/courses?search=${encodeURIComponent(search)}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to fetch courses");
  return data.data;
};

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

const createCourse = async (courseData: {
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

const createRound = async (roundData: {
  courseId: string;
  weather: string;
  notes: string;
}) => {
  const res = await fetch("/api/rounds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(roundData),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to create round");
  return data.data;
};

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function NewRoundPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Course selection
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [weather, setWeather] = useState("sunny");
  const [notes, setNotes] = useState("");

  // Add course modal
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [modalTab, setModalTab] = useState<"search" | "manual">("search");

  // Golf API search state (inside modal)
  const [apiQuery, setApiQuery] = useState("");
  const [debouncedApiQuery, setDebouncedApiQuery] = useState("");

  // Manual form state
  const [newCourse, setNewCourse] = useState({
    name: "",
    city: "",
    state: "",
    par: 72,
    numHoles: 18,
    slope: "",
    rating: "",
  });

  // Debounce main search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Debounce API search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedApiQuery(apiQuery), 400);
    return () => clearTimeout(t);
  }, [apiQuery]);

  // ── Queries ────────────────────────────────
  const { data: courses = [], isLoading: isLoadingCourses } = useQuery({
    queryKey: ["courses", debouncedSearch],
    queryFn: () => fetchCourses(debouncedSearch),
    staleTime: 1000 * 60 * 5,
  });

  const { data: apiResults = [], isLoading: isSearchingApi } = useQuery({
    queryKey: ["golf-api-search", debouncedApiQuery],
    queryFn: () => searchGolfApi(debouncedApiQuery),
    enabled: debouncedApiQuery.length >= 2,
    staleTime: 1000 * 60 * 10,
  });

  // ── Mutations ──────────────────────────────
  const importMutation = useMutation({
    mutationFn: importCourse,
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setSelectedCourse(course);
      closeModal();
    },
  });

  const addCourseMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setSelectedCourse(course);
      closeModal();
    },
  });

  const createRoundMutation = useMutation({
    mutationFn: createRound,
    onSuccess: (round) => router.push(`/round/${round.id}`),
  });

  // ── Helpers ────────────────────────────────
  const closeModal = () => {
    setShowAddCourse(false);
    setApiQuery("");
    setDebouncedApiQuery("");
    setModalTab("search");
    setNewCourse({
      name: "",
      city: "",
      state: "",
      par: 72,
      numHoles: 18,
      slope: "",
      rating: "",
    });
    importMutation.reset();
    addCourseMutation.reset();
  };

  const handleAddCourse = () => {
    if (!newCourse.name || !newCourse.city || !newCourse.state) return;
    addCourseMutation.mutate({
      name: newCourse.name,
      city: newCourse.city,
      state: newCourse.state,
      par: newCourse.par,
      numHoles: newCourse.numHoles,
      slope: newCourse.slope ? parseInt(newCourse.slope) : undefined,
      rating: newCourse.rating ? parseFloat(newCourse.rating) : undefined,
    });
  };

  const handleStartRound = () => {
    if (!selectedCourse) return;
    createRoundMutation.mutate({ courseId: selectedCourse.id, weather, notes });
  };

  // Helper: pick the best tee summary for display
  const getTeeInfo = (course: GolfApiCourse) => {
    const tees = course.tees?.male ?? [];
    const tee =
      tees.find((t) => t.tee_name.toLowerCase() === "white") || tees[0];
    return tee
      ? `Par ${tee.par_total} · ${tee.number_of_holes} holes · Rating ${tee.course_rating} · Slope ${tee.slope_rating}`
      : null;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-fairway-gradient text-white">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display text-2xl font-bold">New Round</h1>
              <p className="text-white/70 text-sm">Me Time - Solo Play</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Course Selection */}
        <section>
          <h2 className="font-display text-lg font-semibold text-sand-900 mb-4">
            Select Course
          </h2>

          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-400" />
            <input
              type="text"
              placeholder="Search your courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-12"
            />
          </div>

          <div className="space-y-3">
            {isLoadingCourses ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-fairway-500 mx-auto mb-2" />
                <p className="text-sand-500">Loading courses...</p>
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-8">
                <Flag className="w-12 h-12 text-sand-300 mx-auto mb-2" />
                <p className="text-sand-500">No courses found</p>
                <p className="text-sand-400 text-sm">
                  Add a course below to get started
                </p>
              </div>
            ) : (
              courses.map((course) => (
                <motion.button
                  key={course.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedCourse(course)}
                  className={`w-full card p-4 text-left transition-all ${
                    selectedCourse?.id === course.id
                      ? "ring-2 ring-fairway-500 bg-fairway-50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        selectedCourse?.id === course.id
                          ? "bg-fairway-500 text-white"
                          : "bg-fairway-100 text-fairway-600"
                      }`}
                    >
                      <Flag className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sand-900">{course.name}</p>
                      <div className="flex items-center gap-2 text-sm text-sand-500">
                        <MapPin className="w-4 h-4" />
                        <span>
                          {course.city}, {course.state}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-medium text-sand-700">
                        Par {course.par}
                      </p>
                      {course.slope && (
                        <p className="text-xs text-sand-500">
                          Slope: {course.slope}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      className={`w-5 h-5 ${selectedCourse?.id === course.id ? "text-fairway-500" : "text-sand-300"}`}
                    />
                  </div>
                </motion.button>
              ))
            )}
          </div>

          <button
            onClick={() => setShowAddCourse(true)}
            className="w-full mt-3 card p-4 text-left hover:bg-slate-50 transition-colors border-2 border-dashed border-sand-200"
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
        </section>

        {/* Weather */}
        <section>
          <h2 className="font-display text-lg font-semibold text-sand-900 mb-4">
            Weather Conditions
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {weatherOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setWeather(option.id)}
                className={`card p-4 text-center transition-all ${
                  weather === option.id
                    ? "ring-2 ring-fairway-500 bg-fairway-50"
                    : "hover:bg-slate-50"
                }`}
              >
                <option.icon
                  className={`w-8 h-8 mx-auto mb-2 ${weather === option.id ? "text-fairway-500" : "text-sand-400"}`}
                />
                <p
                  className={`text-sm font-medium ${weather === option.id ? "text-fairway-700" : "text-sand-600"}`}
                >
                  {option.label}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Notes */}
        <section>
          <h2 className="font-display text-lg font-semibold text-sand-900 mb-4">
            Round Notes (Optional)
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this round..."
            rows={3}
            className="input resize-none"
          />
        </section>

        {/* Course Summary */}
        {selectedCourse && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6 bg-fairway-gradient text-white"
          >
            <h3 className="font-display text-lg font-semibold mb-4">
              Round Summary
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/60 text-sm">Course</p>
                <p className="font-medium">{selectedCourse.name}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm">Location</p>
                <p className="font-medium">
                  {selectedCourse.city}, {selectedCourse.state}
                </p>
              </div>
              <div>
                <p className="text-white/60 text-sm">Par</p>
                <p className="font-display text-2xl font-bold">
                  {selectedCourse.par}
                </p>
              </div>
              <div>
                <p className="text-white/60 text-sm">Holes</p>
                <p className="font-display text-2xl font-bold">
                  {selectedCourse.numHoles}
                </p>
              </div>
              {selectedCourse.rating && (
                <div>
                  <p className="text-white/60 text-sm">Rating</p>
                  <p className="font-medium">{selectedCourse.rating}</p>
                </div>
              )}
              {selectedCourse.slope && (
                <div>
                  <p className="text-white/60 text-sm">Slope</p>
                  <p className="font-medium">{selectedCourse.slope}</p>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {createRoundMutation.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {createRoundMutation.error.message}
          </div>
        )}

        <button
          onClick={handleStartRound}
          disabled={!selectedCourse || createRoundMutation.isPending}
          className="btn btn-gold w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed
         "
        >
          {createRoundMutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Starting Round...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Flag className="w-5 h-5" /> Start Round
            </span>
          )}
        </button>
      </main>

      {/* ── Add Course Modal ── */}
      {showAddCourse && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={closeModal}
          />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl z-50 max-w-md mx-auto max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
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

            {/* Tabs */}
            <div className="flex gap-2 px-6 pt-4">
              <button
                onClick={() => setModalTab("search")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  modalTab === "search"
                    ? "bg-fairway-500 text-white"
                    : "bg-sand-100 text-sand-600 hover:bg-sand-200"
                }`}
              >
                <Globe className="w-4 h-4" />
                Search Database
              </button>
              <button
                onClick={() => setModalTab("manual")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  modalTab === "manual"
                    ? "bg-fairway-500 text-white"
                    : "bg-sand-100 text-sand-600 hover:bg-sand-200"
                }`}
              >
                <PenLine className="w-4 h-4" />
                Enter Manually
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* ── Tab: Search Golf Course API ── */}
              {modalTab === "search" && (
                <>
                  <p className="text-sm text-sand-500">
                    Search 10,000+ courses with accurate ratings and slope.
                  </p>

                  {importMutation.error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {importMutation.error.message}
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

                  {/* Results */}
                  {apiResults.length > 0 && (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {apiResults.map((course) => {
                        const teeInfo = getTeeInfo(course);
                        const isImporting =
                          importMutation.isPending &&
                          importMutation.variables === course.id;
                        return (
                          <button
                            key={course.id}
                            onClick={() => importMutation.mutate(course.id)}
                            disabled={importMutation.isPending}
                            className="w-full p-3 rounded-xl border border-sand-200 hover:border-fairway-300 hover:bg-fairway-50 text-left transition-all disabled:opacity-50 group"
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
                                  <p className="text-xs text-fairway-600 mt-1">
                                    {teeInfo}
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0">
                                {isImporting ? (
                                  <Loader2 className="w-5 h-5 text-fairway-500 animate-spin" />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-fairway-100 group-hover:bg-fairway-500 flex items-center justify-center transition-colors">
                                    <Plus className="w-4 h-4 text-fairway-600 group-hover:text-white" />
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
                          className="text-fairway-600 text-sm font-medium mt-2 hover:underline"
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

              {/* ── Tab: Manual Entry ── */}
              {modalTab === "manual" && (
                <>
                  {addCourseMutation.error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {addCourseMutation.error.message}
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
                      onClick={handleAddCourse}
                      disabled={
                        !newCourse.name ||
                        !newCourse.city ||
                        !newCourse.state ||
                        addCourseMutation.isPending
                      }
                      className="btn btn-primary flex-1 disabled:opacity-50"
                    >
                      {addCourseMutation.isPending ? (
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
