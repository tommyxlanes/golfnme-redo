"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Search,
  Flag,
  MapPin,
  Plus,
  Globe,
  PenLine,
  X,
  Loader2,
  BarChart3,
  Star,
  ChevronRight,
  Layers,
  StarIcon,
} from "lucide-react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Course {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string;
  par: number;
  numHoles: number;
  rating: number | null;
  slope: number | null;
  isPublic: boolean;
  holes?: { id: string; holeNumber: number; par: number }[];
  _count?: { rounds: number };
}

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
// Course Card
// ─────────────────────────────────────────────
function CourseCard({
  course,
  index,
  onClick,
}: {
  course: Course;
  index: number;
  onClick: () => void;
}) {
  const rounds = course._count?.rounds ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="card p-5 cursor-pointer hover:shadow-card-hover transition-all"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-fairway-100 flex items-center justify-center shrink-0 text-fairway-600">
          <Flag className="w-6 h-6" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sand-900 leading-tight">
                {course.name}
              </p>
              {(course.city || course.state) && (
                <p className="flex items-center gap-1 text-sm text-sand-500 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {[course.city, course.state].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-sand-300 shrink-0 mt-0.5" />
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-xs font-mono font-medium bg-sand-100 text-sand-700 px-2 py-1 rounded-lg">
              Par {course.par}
            </span>
            <span className="text-xs bg-sand-100 text-sand-600 px-2 py-1 rounded-lg">
              {course.numHoles} holes
            </span>
            {course.rating && (
              <span className="text-xs bg-sand-100 text-sand-600 px-2 py-1 rounded-lg flex items-center gap-2">
                <Star className="h-3 w-3 text-amber-500" /> {course.rating}
              </span>
            )}
            {rounds > 0 && (
              <span className="text-xs text-fairway-600 font-medium">
                {rounds} round{rounds !== 1 ? "s" : ""} played
              </span>
            )}
          </div>

          {course.slope && (
            <span className="flex items-center mt-2 w-fit text-xs bg-sand-100 text-sand-600 px-2 py-1 rounded-lg">
              Slope Rating: {course.slope}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Add Course Modal (same as new round page)
// ─────────────────────────────────────────────
function AddCourseModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (course: Course) => void;
}) {
  const [tab, setTab] = useState<"search" | "manual">("search");
  const [apiQuery, setApiQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [apiResults, setApiResults] = useState<GolfApiCourse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState<number | null>(null);
  const [importError, setImportError] = useState("");
  const [manualError, setManualError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    city: "",
    state: "",
    par: 72,
    numHoles: 18,
    slope: "",
    rating: "",
  });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(apiQuery), 400);
    return () => clearTimeout(t);
  }, [apiQuery]);

  useEffect(() => {
    if (debounced.length < 2) {
      setApiResults([]);
      return;
    }
    setIsSearching(true);
    fetch(`/api/courses/search?q=${encodeURIComponent(debounced)}`)
      .then((r) => r.json())
      .then((d) => setApiResults(d.courses ?? []))
      .finally(() => setIsSearching(false));
  }, [debounced]);

  const handleImport = async (id: number) => {
    setIsImporting(id);
    setImportError("");
    try {
      const res = await fetch("/api/courses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ golfApiId: id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onAdded(data.data);
    } catch (e: any) {
      setImportError(e.message);
    } finally {
      setIsImporting(null);
    }
  };

  const handleManual = async () => {
    if (!form.name || !form.city || !form.state) return;
    setIsAdding(true);
    setManualError("");
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          city: form.city,
          state: form.state,
          par: form.par,
          numHoles: form.numHoles,
          slope: form.slope ? parseInt(form.slope) : undefined,
          rating: form.rating ? parseFloat(form.rating) : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onAdded(data.data);
    } catch (e: any) {
      setManualError(e.message);
    } finally {
      setIsAdding(false);
    }
  };

  const getTeeInfo = (c: GolfApiCourse) => {
    const tees = c.tees?.male ?? [];
    const tee =
      tees.find((t) => t.tee_name.toLowerCase() === "white") || tees[0];
    return tee
      ? `Par ${tee.par_total} · ${tee.number_of_holes} holes · Rating ${tee.course_rating} · Slope ${tee.slope_rating}`
      : null;
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl z-50 max-w-md mx-auto max-h-[90vh] overflow-y-auto border border-sand-100">
        <div className="flex items-center justify-between p-6 pb-0">
          <h3 className="font-display text-xl font-bold text-sand-900">
            Add Course
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-sand-100 transition-colors"
          >
            <X className="w-5 h-5 text-sand-500" />
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4">
          {[
            { id: "search" as const, icon: Globe, label: "Search Database" },
            { id: "manual" as const, icon: PenLine, label: "Enter Manually" },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-fairway-500 text-white"
                  : "bg-sand-100 text-sand-600 hover:bg-sand-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {tab === "search" && (
            <>
              <p className="text-sm text-sand-500">
                Search 10,000+ courses with accurate ratings and slope.
              </p>
              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
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
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sand-400 animate-spin" />
                )}
              </div>

              {apiResults.length > 0 && (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {apiResults.map((c) => {
                    const teeInfo = getTeeInfo(c);
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleImport(c.id)}
                        disabled={isImporting !== null}
                        className="w-full p-3 rounded-xl border border-sand-200 hover:border-fairway-400 hover:bg-fairway-50 text-left transition-all disabled:opacity-50 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sand-900 text-sm">
                              {c.course_name || c.club_name}
                            </p>
                            {c.course_name && c.club_name !== c.course_name && (
                              <p className="text-xs text-sand-400">
                                {c.club_name}
                              </p>
                            )}
                            <p className="flex items-center gap-1 text-xs text-sand-500 mt-1">
                              <MapPin className="w-3 h-3" />
                              {c.location.city}, {c.location.state}
                            </p>
                            {teeInfo && (
                              <p className="text-xs text-fairway-600 mt-1">
                                {teeInfo}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0">
                            {isImporting === c.id ? (
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

              {debounced.length >= 2 &&
                !isSearching &&
                apiResults.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-sand-500 text-sm">
                      No courses found for "{debounced}"
                    </p>
                    <button
                      onClick={() => setTab("manual")}
                      className="text-fairway-600 text-sm font-medium mt-2 hover:underline"
                    >
                      Enter manually instead
                    </button>
                  </div>
                )}
              {debounced.length < 2 && (
                <div className="text-center py-6 text-sand-400 text-sm">
                  Type at least 2 characters to search
                </div>
              )}
            </>
          )}

          {tab === "manual" && (
            <>
              {manualError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {manualError}
                </div>
              )}
              <input
                type="text"
                placeholder="Course Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="City *"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="State *"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Par</label>
                  <input
                    type="number"
                    value={form.par}
                    onChange={(e) =>
                      setForm({ ...form, par: parseInt(e.target.value) || 72 })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="input-label">Holes</label>
                  <select
                    value={form.numHoles}
                    onChange={(e) =>
                      setForm({ ...form, numHoles: parseInt(e.target.value) })
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
                  value={form.slope}
                  onChange={(e) => setForm({ ...form, slope: e.target.value })}
                  className="input"
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Rating (optional)"
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: e.target.value })}
                  className="input"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="btn btn-outline flex-1">
                  Cancel
                </button>
                <button
                  onClick={handleManual}
                  disabled={!form.name || !form.city || !form.state || isAdding}
                  className="btn btn-primary flex-1 disabled:opacity-50"
                >
                  {isAdding ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
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
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function CoursesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "rounds" | "slope">("rounds");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debounced) params.set("search", debounced);
      params.set("limit", "100");
      const res = await fetch(`/api/courses?${params}`);
      const data = await res.json();
      if (data.success) setCourses(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const sorted = [...courses].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "rounds")
      return (b._count?.rounds ?? 0) - (a._count?.rounds ?? 0);
    if (sortBy === "slope") return (b.slope ?? 0) - (a.slope ?? 0);
    return 0;
  });

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
              <h1 className="font-display text-2xl font-bold">Courses</h1>
              <p className="text-white/70 text-sm">
                {courses.length} course{courses.length !== 1 ? "s" : ""} in your
                library
              </p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Course
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
            <input
              type="text"
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition-all"
            />
          </div>
        </div>
      </header>

      {/* Sort bar */}
      <div className="sticky top-0 z-10 bg-sand-50/90 backdrop-blur-lg border-b border-sand-200 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-sand-400" />
          <span className="text-xs text-sand-500 mr-1">Sort:</span>
          {(
            [
              { id: "rounds", label: "Most Played" },
              { id: "name", label: "Name" },
              { id: "slope", label: "Difficulty" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSortBy(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === id
                  ? "bg-fairway-500 text-white"
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
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sand-200" />
                  <div className="flex-1">
                    <div className="h-4 bg-sand-200 rounded w-40 mb-2" />
                    <div className="h-3 bg-sand-200 rounded w-28" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-fairway-100 mx-auto mb-4 flex items-center justify-center">
              <Flag className="w-10 h-10 text-fairway-500" />
            </div>
            <h3 className="font-display text-xl font-bold text-sand-900 mb-2">
              {search ? `No courses matching "${search}"` : "No courses yet"}
            </h3>
            <p className="text-sand-500 mb-6">
              {search
                ? "Try a different search term."
                : "Add your first course to start tracking rounds."}
            </p>
            {!search && (
              <button
                onClick={() => setShowAdd(true)}
                className="btn btn-primary mx-auto"
              >
                <Plus className="w-5 h-5" /> Add First Course
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((course, i) => (
              <CourseCard
                key={course.id}
                course={course}
                index={i}
                onClick={() => router.push(`/round/new?courseId=${course.id}`)}
              />
            ))}

            {/* Add more CTA */}
            <button
              onClick={() => setShowAdd(true)}
              className="w-full card p-4 border-2 border-dashed border-sand-200 hover:border-fairway-400 hover:bg-fairway-50 transition-all text-sand-500 flex items-center justify-center gap-3"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another Course</span>
            </button>
          </div>
        )}
      </main>

      {/* Add Course Modal */}
      <AnimatePresence>
        {showAdd && (
          <AddCourseModal
            onClose={() => setShowAdd(false)}
            onAdded={(course) => {
              setCourses((prev) => [
                course,
                ...prev.filter((c) => c.id !== course.id),
              ]);
              setShowAdd(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
