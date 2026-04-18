"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X, Crosshair, Navigation } from "lucide-react";

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface LiveMapProps {
  /** Called when user closes the map */
  onClose: () => void;
  /** Optional: course coordinates to also mark on the map */
  courseLat?: number | null;
  courseLng?: number | null;
  courseName?: string;
}

// ─────────────────────────────────────────────
// Accuracy pill colors
// ─────────────────────────────────────────────
function accColor(acc: number) {
  if (acc <= 10)
    return "text-emerald-400 border-emerald-400/40 bg-emerald-400/10";
  if (acc <= 30) return "text-amber-400 border-amber-400/40 bg-amber-400/10";
  return "text-red-400 border-red-400/40 bg-red-400/10";
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export function LiveMap({
  onClose,
  courseLat,
  courseLng,
  courseName,
}: LiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const playerMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const courseMarkerRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);

  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [firstFix, setFirstFix] = useState(true);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // ── Load Leaflet dynamically (avoids SSR issues) ───────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  // ── Init map once Leaflet is ready ────────────────────────────────────
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInstanceRef.current) return;

    const L = (window as any).L;

    const map = L.map(mapRef.current, {
      center: [36.5683, -121.9505],
      zoom: 17,
      zoomControl: false,
      tap: true,
      tapTolerance: 15,
    });

    // Satellite tiles
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 20 },
    ).addTo(map);

    // Label overlay
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 20, opacity: 0.4 },
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapInstanceRef.current = map;

    // Add course marker if coordinates available
    if (courseLat && courseLng) {
      const courseIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:14px;height:14px;border-radius:50%;
          background:#c9a227;border:3px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      courseMarkerRef.current = L.marker([courseLat, courseLng], {
        icon: courseIcon,
      })
        .bindTooltip(courseName ?? "Course", { permanent: false })
        .addTo(map);
    }

    setTimeout(() => map.invalidateSize(), 100);

    // Start GPS
    startGPS(map);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leafletLoaded]);

  // ── GPS tracking ───────────────────────────────────────────────────────
  function startGPS(map: any) {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy, speed } = pos.coords;
        const L = (window as any).L;
        if (!L) return;

        setStatus("live");
        setAccuracy(Math.round(accuracy));
        setSpeed(speed ? Math.round(speed * 3.6) : 0);
        setCoords({ lat, lng });

        // Player marker
        const playerIcon = L.divIcon({
          className: "",
          html: `<div style="
            width:48px;height:48px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            position:relative;
          ">
            <div style="
              position:absolute;inset:0;border-radius:50%;
              background:rgba(110,231,183,0.15);
              animation:ripple1 2s ease-out infinite;
            "></div>
            <div style="
              width:20px;height:20px;border-radius:50%;
              background:#1d5a3c;border:3px solid #6ee7b7;
              box-shadow:0 0 0 3px rgba(110,231,183,0.25),0 3px 12px rgba(0,0,0,0.5);
              position:relative;z-index:1;
            "></div>
          </div>`,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        });

        if (!playerMarkerRef.current) {
          playerMarkerRef.current = L.marker([lat, lng], {
            icon: playerIcon,
          }).addTo(map);
        } else {
          playerMarkerRef.current.setLatLng([lat, lng]);
        }

        // Accuracy circle
        if (!accuracyCircleRef.current) {
          accuracyCircleRef.current = L.circle([lat, lng], {
            radius: accuracy,
            weight: 1,
            color: "rgba(110,231,183,0.5)",
            fillColor: "rgba(110,231,183,0.06)",
            fillOpacity: 1,
          }).addTo(map);
        } else {
          accuracyCircleRef.current.setLatLng([lat, lng]).setRadius(accuracy);
        }

        // Fly to on first fix
        if (firstFix) {
          map.flyTo([lat, lng], 19, { duration: 1.5 });
          setFirstFix(false);
        }
      },
      () => setStatus("error"),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );
  }

  function recenter() {
    if (coords && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([coords.lat, coords.lng], 19, {
        duration: 0.8,
      });
    }
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <>
      {/* Ripple animation */}
      <style>{`
        @keyframes ripple1 {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
        style={{ height: "75vh", maxHeight: "600px" }}
      >
        {/* Handle bar */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 py-3 rounded-t-2xl"
          style={{ background: "linear-gradient(135deg, #065f46, #022c22)" }}
        >
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-white/80" />
            <div>
              <p className="font-semibold text-white text-sm leading-none">
                Live Location
              </p>
              {courseName && (
                <p className="text-white/50 text-xs mt-0.5">{courseName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status pill */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                status === "live"
                  ? "text-emerald-400 border-emerald-400/40 bg-emerald-400/10"
                  : status === "error"
                    ? "text-red-400 border-red-400/40 bg-red-400/10"
                    : "text-amber-400 border-amber-400/40 bg-amber-400/10"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  status === "live"
                    ? "bg-emerald-400 animate-pulse"
                    : status === "error"
                      ? "bg-red-400"
                      : "bg-amber-400 animate-pulse"
                }`}
              />
              {status === "live"
                ? "Live"
                : status === "error"
                  ? "No GPS"
                  : "Searching…"}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative min-h-0">
          <div
            ref={mapRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
          />

          {/* Loading overlay */}
          {!leafletLoaded && (
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
              <div className="text-center text-white/60">
                <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm">Loading map…</p>
              </div>
            </div>
          )}

          {/* Recenter button */}
          {status === "live" && (
            <button
              onClick={recenter}
              className="absolute bottom-4 left-4 z-10 flex items-center gap-2 px-3 py-2 rounded-xl text-white text-xs font-semibold"
              style={{
                background: "rgba(13,17,23,0.85)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <Crosshair className="w-3.5 h-3.5" />
              Center
            </button>
          )}
        </div>

        {/* Stats bar */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 py-3 gap-4"
          style={{
            background: "rgba(10,15,10,0.95)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {status === "live" ? (
            <>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="font-mono text-lg font-bold text-white leading-none">
                    {accuracy ?? "—"}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">Accuracy (m)</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="font-mono text-lg font-bold text-white leading-none">
                    {speed ?? "—"}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">Speed (km/h)</p>
                </div>
              </div>
              {coords && (
                <p className="font-mono text-xs text-white/30 truncate">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </p>
              )}
            </>
          ) : status === "error" ? (
            <p className="text-red-400 text-sm">
              GPS unavailable — check location permissions
            </p>
          ) : (
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <div className="w-3 h-3 border border-amber-400/50 border-t-amber-400 rounded-full animate-spin" />
              Acquiring GPS signal…
            </div>
          )}
        </div>
      </div>
    </>
  );
}
