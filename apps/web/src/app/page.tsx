"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import type { CesiumGlobeRef, MapStyleKey } from "@/components/CesiumGlobe";
import PlotSelector, { type PlotPresetKey } from "@/components/PlotSelector";
import BuildingAnalysisHUD from "@/components/BuildingAnalysisHUD";
import MapControls, { type Neighborhood } from "@/components/MapControls";
import TopNavBar from "@/components/TopNavBar";

// Dynamic import — CesiumJS cannot run on the server
const CesiumGlobe = dynamic(() => import("@/components/CesiumGlobe"), {
  ssr: false,
  loading: () => (
    <div className="cesium-loading-overlay">
      <div className="cesium-loading-spinner" />
      <p>Launching 3D Geospatial Engine...</p>
    </div>
  ),
});

const CESIUM_TOKEN = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || "";

// City coordinates (Rule 8 & 9)
const CITIES = {
  lahore: { lng: 74.3587, lat: 31.5204, label: "Lahore" },
  islamabad: { lng: 73.0479, lat: 33.6844, label: "Islamabad" },
  karachi: { lng: 67.0011, lat: 24.8607, label: "Karachi" },
} as const;

type CityKey = keyof typeof CITIES;

// Pakistani Neighborhood Quick Jumps
const NEIGHBORHOODS: Record<CityKey, Neighborhood[]> = {
  lahore: [
    { name: "DHA Phase 6", lng: 74.4503, lat: 31.4728, height: 350 },
    { name: "Bahria Town Sector C", lng: 74.195, lat: 31.3695, height: 350 },
    { name: "Gulberg III", lng: 74.3496, lat: 31.5135, height: 350 },
    { name: "Johar Town Phase 2", lng: 74.2785, lat: 31.4697, height: 350 },
    { name: "Model Town", lng: 74.3218, lat: 31.4878, height: 350 },
  ],
  islamabad: [
    { name: "F-7 / Blue Area", lng: 73.0551, lat: 33.72, height: 350 },
    { name: "DHA Phase 2 Islamabad", lng: 73.155, lat: 33.528, height: 350 },
    { name: "Bahria Enclave", lng: 73.205, lat: 33.685, height: 350 },
    { name: "Sector G-11", lng: 72.998, lat: 33.668, height: 350 },
  ],
  karachi: [
    { name: "Clifton Block 4", lng: 67.032, lat: 24.819, height: 350 },
    { name: "DHA Phase 8", lng: 67.085, lat: 24.77, height: 350 },
    { name: "Bahria Town Karachi", lng: 67.33, lat: 25.01, height: 450 },
    { name: "Gulshan-e-Iqbal", lng: 67.088, lat: 24.918, height: 350 },
  ],
};

const PRESET_LABELS: Record<PlotPresetKey, string> = {
  "5marla": "5 Marla (25×45 ft)",
  "10marla": "10 Marla (35×65 ft)",
  "1kanal": "1 Kanal (50×90 ft)",
  "2kanal": "2 Kanal (75×120 ft)",
};

const ARCHITECTURAL_PRESETS = [
  {
    icon: "🏠",
    title: "5 Marla Modern",
    tag: "2 Manzil",
    prompt: "Design a modern 2-storey house on 5 marla plot with 4 bedrooms, rooftop terrace, and contemporary Pakistani facade",
  },
  {
    icon: "🏰",
    title: "10 Marla Villa",
    tag: "Luxury",
    prompt: "10 marla luxury villa with 4 bedrooms, servant quarter, covered porch, and traditional jali screens",
  },
  {
    icon: "🌇",
    title: "Terrace & Jali",
    tag: "Feature",
    prompt: "Add rooftop mumty terrace, traditional laser-cut jali screens, and modern cantilevered balcony",
  },
  {
    icon: "🚗",
    title: "1 Kanal Porch",
    tag: "Executive",
    prompt: "1 kanal modern house with drawing room, 2-car covered porch, 5 bedrooms, and lawn setback",
  },
  {
    icon: "🌿",
    title: "Rooftop Mumty",
    tag: "Terrace",
    prompt: "Modern 2-storey house with concrete mumty stair tower, rooftop water tank, and steel shade pergola",
  },
  {
    icon: "🕌",
    title: "Contemporary Islamic",
    tag: "Heritage",
    prompt: "Contemporary Islamic facade with elegant arched porch, geometric jali patterns, and warm teak wood accents",
  },
  {
    icon: "🇵🇰",
    title: "2 Manzil Ghar",
    tag: "اردو",
    prompt: "5 marla ka khubsurat 2 manzil ghar, 3 kamre, car porch, drawing room, aur chat par mumty",
  },
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  spec?: any;
  costTotal?: number;
}

// Preset plot dimensions in metres (Rule 7, 10)
const PRESET_DIMS: Record<PlotPresetKey, { width: number; depth: number }> = {
  "5marla": { width: 7.62, depth: 13.72 },   // 25x45 ft ~ 104.5 m²
  "10marla": { width: 10.67, depth: 19.81 }, // 35x65 ft ~ 211.4 m²
  "1kanal": { width: 15.24, depth: 27.43 },  // 50x90 ft ~ 418.0 m²
  "2kanal": { width: 22.86, depth: 36.58 },  // 75x120 ft ~ 836.0 m²
};

// Helper to create rotated rectangular plot coordinates centered at (cLng, cLat)
function createOrientedPlotCoordinates(
  cLng: number,
  cLat: number,
  preset: PlotPresetKey,
  rotDeg: number = 0
): [number, number][] {
  const { width, depth } = PRESET_DIMS[preset];
  const latRad = (cLat * Math.PI) / 180;
  const mPerDegLat = 111132;
  const mPerDegLng = 111132 * Math.cos(latRad);

  const halfW = width / 2;
  const halfD = depth / 2;
  const rad = (rotDeg * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  const localCorners = [
    [-halfW, -halfD],
    [+halfW, -halfD],
    [+halfW, +halfD],
    [-halfW, +halfD],
  ];

  return localCorners.map(([x, y]) => {
    const rx = x * cosR - y * sinR;
    const ry = x * sinR + y * cosR;
    const lng = cLng + rx / mPerDegLng;
    const lat = cLat + ry / mPerDegLat;
    return [lng, lat];
  });
}

export default function HomePage() {
  const globeRef = useRef<CesiumGlobeRef>(null);
  const [selectedCity, setSelectedCity] = useState<CityKey>("lahore");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [globeReady, setGlobeReady] = useState(false);

  // Floating AI Architect drawer state & tab
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "zoning">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat when messages or status change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing, statusMessage]);

  // Map & Camera mode state
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("google_satellite");
  const [cameraMode, setCameraMode] = useState<"2d" | "3d">("3d");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const ribbonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("geobuild-theme") as "dark" | "light" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("geobuild-theme", next);
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  }, []);

  const scrollRibbon = (direction: "left" | "right") => {
    if (ribbonRef.current) {
      const scrollAmount = direction === "left" ? -200 : 200;
      ribbonRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // Plot state
  const [currentPlot, setCurrentPlot] = useState<[number, number][] | null>(null);
  const [plotCenter, setPlotCenter] = useState<[number, number]>([74.3587, 31.5204]);
  const [selectedPreset, setSelectedPreset] = useState<PlotPresetKey | "custom" | null>(null);
  const [plotRotation, setPlotRotation] = useState<number>(0);
  const [plotMarla, setPlotMarla] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);

  // 3D Building & Analysis state
  const [latestAnalysis, setLatestAnalysis] = useState<{
    spec: any;
    generate: any;
    analysis: any;
  } | null>(null);
  const [isOrbiting, setIsOrbiting] = useState(false);

  // Handle City Change
  const handleCityChange = useCallback((city: string) => {
    const cKey = city as CityKey;
    setSelectedCity(cKey);
    const coords = CITIES[cKey];
    if (coords) {
      setPlotCenter([coords.lng, coords.lat]);
      globeRef.current?.flyTo(coords.lng, coords.lat, 3000);
    }
  }, []);

  // Pakistani Neighborhood quick selection
  const handleSelectNeighborhood = useCallback(
    (n: Neighborhood) => {
      setPlotCenter([n.lng, n.lat]);
      globeRef.current?.flyTo(n.lng, n.lat, n.height);
      if (selectedPreset && selectedPreset !== "custom") {
        const coords = createOrientedPlotCoordinates(n.lng, n.lat, selectedPreset, plotRotation);
        setCurrentPlot(coords);
        globeRef.current?.setPlotPolygon(
          coords,
          `${PRESET_LABELS[selectedPreset]} • ${n.name}`
        );
      }
    },
    [selectedPreset, plotRotation]
  );

  // Map style toggle
  const handleSelectMapStyle = useCallback((style: MapStyleKey) => {
    setMapStyle(style);
    globeRef.current?.setMapStyle(style);
  }, []);

  // 2D / 3D camera mode toggle
  const handleToggleCameraMode = useCallback(
    (mode: "2d" | "3d") => {
      setCameraMode(mode);
      globeRef.current?.setCameraView(mode, plotCenter[0], plotCenter[1]);
    },
    [plotCenter]
  );

  // Preset plot selection
  const handleSelectPreset = useCallback(
    (preset: PlotPresetKey) => {
      setSelectedPreset(preset);
      const coords = createOrientedPlotCoordinates(plotCenter[0], plotCenter[1], preset, plotRotation);
      setCurrentPlot(coords);

      const marlaMap: Record<PlotPresetKey, number> = {
        "5marla": 5.0,
        "10marla": 10.0,
        "1kanal": 20.0,
        "2kanal": 40.0,
      };
      setPlotMarla(marlaMap[preset]);

      const label = `${preset === "5marla" ? "5 Marla" : preset === "10marla" ? "10 Marla" : preset === "1kanal" ? "1 Kanal" : "2 Kanal"} Plot`;
      globeRef.current?.setPlotPolygon(coords, label);
      // Maintained user's camera viewpoint without jarring reset
    },
    [plotCenter, plotRotation]
  );

  // Auto-initialize 5 Marla plot once globe is ready if no plot exists yet
  useEffect(() => {
    if (globeReady && !currentPlot) {
      handleSelectPreset("5marla");
    }
  }, [globeReady, currentPlot, handleSelectPreset]);

  // Rotate plot orientation
  const handleRotatePlot = useCallback(
    (deg: number) => {
      setPlotRotation(deg);
      if (selectedPreset && selectedPreset !== "custom") {
        const coords = createOrientedPlotCoordinates(plotCenter[0], plotCenter[1], selectedPreset, deg);
        setCurrentPlot(coords);
        const label = `${selectedPreset === "5marla" ? "5 Marla" : selectedPreset === "10marla" ? "10 Marla" : "1 Kanal"} Plot`;
        globeRef.current?.setPlotPolygon(coords, label);
      }
    },
    [selectedPreset, plotCenter]
  );

  // Click map to place plot
  const handleStartPlacement = useCallback(() => {
    setIsPlacing(true);
    globeRef.current?.startPlotPlacement((lng, lat) => {
      setIsPlacing(false);
      setPlotCenter([lng, lat]);
      const preset = selectedPreset && selectedPreset !== "custom" ? selectedPreset : "5marla";
      setSelectedPreset(preset);
      const coords = createOrientedPlotCoordinates(lng, lat, preset, plotRotation);
      setCurrentPlot(coords);

      const marlaMap: Record<PlotPresetKey, number> = {
        "5marla": 5.0,
        "10marla": 10.0,
        "1kanal": 20.0,
        "2kanal": 40.0,
      };
      setPlotMarla(marlaMap[preset]);

      const label = `${preset === "5marla" ? "5 Marla" : preset === "10marla" ? "10 Marla" : "1 Kanal"} Plot`;
      globeRef.current?.setPlotPolygon(coords, label);
      // Placed right where user clicked without moving camera away
    });
  }, [selectedPreset, plotRotation]);

  // Custom plot drawn on map
  const handlePlotDrawn = useCallback((coords: [number, number][]) => {
    setCurrentPlot(coords);
    setSelectedPreset("custom");

    const sumX = coords.reduce((acc, c) => acc + c[0], 0);
    const sumY = coords.reduce((acc, c) => acc + c[1], 0);
    const cLon = sumX / coords.length;
    const cLat = sumY / coords.length;
    setPlotCenter([cLon, cLat]);

    const latRad = (cLat * Math.PI) / 180;
    const mPerDegLat = 111132;
    const mPerDegLng = 111132 * Math.cos(latRad);

    let areaSqm = 0;
    const n = coords.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const xi = coords[i][0] * mPerDegLng;
      const yi = coords[i][1] * mPerDegLat;
      const xj = coords[j][0] * mPerDegLng;
      const yj = coords[j][1] * mPerDegLat;
      areaSqm += xi * yj - xj * yi;
    }
    areaSqm = Math.abs(areaSqm) / 2;
    const marla = areaSqm / 25.2929;
    const roundedMarla = roundTo(marla, 1);
    setPlotMarla(roundedMarla);

    // 1. Automatically expand AI Architect Copilot drawer so user sees it right away
    setIsSidebarCollapsed(false);
    setActiveTab("chat");

    // 2. Prefill prompt input ready to submit
    setInputValue(
      `Design a modern 2-storey house on this custom ${roundedMarla} marla plot with 4 bedrooms, rooftop terrace, and contemporary Pakistani facade`
    );

    // 3. Smoothly frame the drawn plot in Cesium without reloading
    globeRef.current?.focusPlot(coords);
  }, []);

  // Clear plot and model
  const handleClearPlot = useCallback(() => {
    setCurrentPlot(null);
    setSelectedPreset(null);
    setPlotMarla(null);
    setLatestAnalysis(null);
    globeRef.current?.clearPlot();
    globeRef.current?.clearModel();
  }, []);

  // Core Pipeline: Natural Language -> AI Spec -> 3D Building -> Map Placement -> Feasibility
  const handleSend = useCallback(
    async (text?: string) => {
      const prompt = text || inputValue.trim();
      if (!prompt) return;

      setInputValue("");
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);
      setStatusMessage("Interpreting requirements with Gemini 2.5 Flash...");

      const aiUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || "http://localhost:8000";

      try {
        // Step 1: Natural Language -> AI Building Specification (Rule 1, 2, 5)
        const interpretRes = await fetch(`${aiUrl}/api/v1/interpret`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            city: selectedCity,
          }),
        });

        if (!interpretRes.ok) {
          let errDetail = `AI service error: ${interpretRes.status}`;
          try {
            const errData = await interpretRes.json();
            if (errData?.detail) errDetail = errData.detail;
          } catch {}
          throw new Error(errDetail);
        }

        const interpretData = await interpretRes.json();
        const spec = interpretData.spec;

        // Step 2: Ensure Plot Polygon exists
        let activePlot = currentPlot;
        if (!activePlot || activePlot.length < 3) {
          const pLower = prompt.toLowerCase();
          let presetKey: PlotPresetKey = "5marla";
          if (pLower.includes("10 marla") || pLower.includes("10marla") || spec.rooms?.bedrooms >= 5) {
            presetKey = "10marla";
          } else if (pLower.includes("kanal") || pLower.includes("villa") || spec.floors >= 3) {
            presetKey = "1kanal";
          }

          // Use plotCenter (where user is currently looking) instead of jumping back to city origin
          const targetCenter = plotCenter || [CITIES[selectedCity].lng, CITIES[selectedCity].lat];
          activePlot = createOrientedPlotCoordinates(targetCenter[0], targetCenter[1], presetKey, plotRotation);
          setCurrentPlot(activePlot);
          setSelectedPreset(presetKey);
          const label = `${presetKey === "5marla" ? "5 Marla" : presetKey === "10marla" ? "10 Marla" : "1 Kanal"} Plot`;
          globeRef.current?.setPlotPolygon(activePlot, label);
        }

        if (!activePlot || activePlot.length < 3) {
          throw new Error("Unable to establish plot coordinates for 3D generation.");
        }

        setStatusMessage("Building procedural 3D model (GLB extrusion)...");

        // Step 3: Procedural 3D Geometry Generation (Rule 11, 12, 13, 14)
        const generateRes = await fetch(`${aiUrl}/api/v1/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spec,
            plot_polygon_wgs84: activePlot,
            front_edge_index: 0,
            city: selectedCity,
          }),
        });

        if (!generateRes.ok) {
          let genErr = `Generation failed: ${generateRes.status}`;
          try {
            const ed = await generateRes.json();
            if (ed?.detail) genErr = ed.detail;
          } catch {}
          throw new Error(genErr);
        }

        const generateData = await generateRes.json();

        // Step 4: Geospatial Placement on Cesium Globe
        if (generateData.glb_data_uri && generateData.center_wgs84) {
          globeRef.current?.loadGlbModel(
            generateData.glb_data_uri,
            generateData.center_wgs84 as [number, number],
            generateData.heading_deg || 0
          );
        }

        setStatusMessage("Verifying LDA/CDA compliance and cost rates...");

        // Step 5: Regulatory Compliance & Cost Feasibility (Rule 15, 16, 17)
        let analysisData: any = null;
        try {
          const analyzeRes = await fetch(`${aiUrl}/api/v1/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              spec,
              plot_area_sqm: generateData.plot_area_sqm || 126.5,
              city: selectedCity,
              cost_tier: "standard",
            }),
          });
          if (analyzeRes.ok) {
            analysisData = await analyzeRes.json();
          }
        } catch (anErr) {
          console.warn("Analysis check skipped:", anErr);
        }

        setLatestAnalysis({
          spec,
          generate: generateData,
          analysis: analysisData,
        });

        // Step 6: Assistant Chat Message
        const costTotal = analysisData?.cost_estimate?.total;
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: formatFullResponse(spec, generateData, analysisData),
          timestamp: new Date(),
          spec,
          costTotal,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // Show assumptions if any
        if (interpretData.assumptions?.length > 0) {
          const sysMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "system",
            content: `💡 Assumptions: ${interpretData.assumptions.join(" • ")}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, sysMsg]);
        }
      } catch (err: any) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "system",
          content: `⚠️ ${err?.message || "Failed to process request. Ensure AI service is running at port 8000."}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsProcessing(false);
        setStatusMessage(null);
      }
    },
    [inputValue, selectedCity, currentPlot, plotRotation, selectedPreset]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const toggleOrbitMode = useCallback(() => {
    setIsOrbiting((prev) => {
      const next = !prev;
      globeRef.current?.toggleOrbit(next);
      return next;
    });
  }, []);

  return (
    <div className="app-layout">
      {/* 1. Unified Top Navigation Command Bar */}
      <TopNavBar
        cities={CITIES}
        selectedCity={selectedCity}
        onSelectCity={handleCityChange}
        neighborhoods={NEIGHBORHOODS[selectedCity] || []}
        onSelectNeighborhood={handleSelectNeighborhood}
        selectedPreset={selectedPreset}
        onSelectPreset={handleSelectPreset}
        isPlacing={isPlacing}
        onStartPlacement={handleStartPlacement}
        isDrawing={isDrawing}
        onStartDrawing={() => globeRef.current?.startDrawingPlot()}
        hasPlot={Boolean(currentPlot && currentPlot.length >= 3)}
        plotRotation={plotRotation}
        onRotatePlot={handleRotatePlot}
        onClearPlot={handleClearPlot}
        plotMarla={plotMarla}
        mapStyle={mapStyle}
        onSelectMapStyle={handleSelectMapStyle}
        cameraMode={cameraMode}
        onToggleCameraMode={handleToggleCameraMode}
        isSidebarOpen={!isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        hasBuilding={Boolean(latestAnalysis)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* 2. Floating AI Architect Copilot Drawer (Left Side) */}
      <aside className={`ai-copilot-drawer ${isSidebarCollapsed ? "collapsed" : ""}`}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-header-info">
            <div className="drawer-header-icon">🏛️</div>
            <div>
              <div className="drawer-title">AI Architect Copilot</div>
              <div className="drawer-subtitle">
                <span className="ai-dot-pulse" />
                <span>Gemini 2.5 Flash • Urdu / English</span>
              </div>
            </div>
          </div>

          <div className="drawer-header-actions">
            <div className="drawer-tab-switch">
              <button
                className={`drawer-tab-btn ${activeTab === "chat" ? "active" : ""}`}
                onClick={() => setActiveTab("chat")}
              >
                💬 Chat
              </button>
              <button
                className={`drawer-tab-btn ${activeTab === "zoning" ? "active" : ""}`}
                onClick={() => setActiveTab("zoning")}
              >
                📐 Zoning
              </button>
            </div>

            <button
              className="drawer-collapse-btn"
              onClick={() => setIsSidebarCollapsed(true)}
              title="Collapse Copilot Panel"
            >
              ◀
            </button>
          </div>
        </div>

        {/* Tab 1: Architecture Chat & Suggestions */}
        {activeTab === "chat" && (
          <>
            {/* Custom Drawn Plot Banner in Sidebar */}
            {selectedPreset === "custom" && currentPlot && currentPlot.length >= 3 && (
              <div className="drawn-plot-sidebar-card">
                <div className="drawn-plot-header">
                  <div className="drawn-plot-title-wrap">
                    <span className="drawn-plot-icon">✏️</span>
                    <div>
                      <div className="drawn-plot-title">Custom Drawn Plot Active</div>
                      <div className="drawn-plot-stats">
                        {plotMarla || "—"} Marla • {currentPlot.length} Corners • {CITIES[selectedCity].label}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      onClick={() => globeRef.current?.focusPlot(currentPlot)}
                      className="drawn-plot-focus-btn"
                      title="Frame drawn plot in view"
                    >
                      🎯 Frame
                    </button>
                    <button
                      onClick={handleClearPlot}
                      className="drawn-plot-clear-btn"
                      title="Clear drawn plot"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <button
                  className="drawn-plot-generate-btn"
                  onClick={() =>
                    handleSend(
                      inputValue.trim() ||
                        `Design a modern 2-storey house on this custom ${plotMarla} marla plot with 4 bedrooms, rooftop terrace, and contemporary Pakistani facade`
                    )
                  }
                  disabled={isProcessing}
                  title="Generate 3D building on this custom drawn plot"
                >
                  <span>⚡ Generate 3D Building on this Plot</span>
                </button>

                <div className="drawn-plot-prompts-label">Quick Pakistani Architectural Prompts:</div>
                <div className="drawn-plot-quick-pills">
                  <button
                    className="drawn-plot-pill"
                    onClick={() =>
                      handleSend(
                        `Design a modern 2-storey house on this custom ${plotMarla} marla plot with 4 bedrooms, rooftop terrace, and contemporary Pakistani facade`
                      )
                    }
                  >
                    🏠 2-Storey Modern
                  </button>
                  <button
                    className="drawn-plot-pill"
                    onClick={() =>
                      handleSend(
                        `Luxury ${plotMarla} marla villa on this drawn plot with 5 bedrooms, covered parking, traditional jali screens, and balcony`
                      )
                    }
                  >
                    🏰 Luxury Villa
                  </button>
                  <button
                    className="drawn-plot-pill"
                    onClick={() =>
                      handleSend(
                        `${plotMarla} marla ka 2 manzil ghar, 3 kamre, covered car porch, drawing room`
                      )
                    }
                  >
                    🇵🇰 2 Manzil Ghar (اردو)
                  </button>
                </div>
              </div>
            )}

            <div className="chat-stream-container">
              {messages.length === 0 ? (
                <div className="welcome-screen">
                  <div className="welcome-icon">🏗️</div>
                  <h2 className="welcome-title">AI Property Architect</h2>
                  <p className="welcome-description">
                    Describe your desired residential or commercial property in Urdu or English. The AI procedural pipeline extrudes 3D floors, aligns setbacks with LDA/CDA zoning, and computes accurate Pakistani construction rate tables.
                  </p>

                  <div className="welcome-suggestions">
                    <button
                      className="suggestion-btn"
                      onClick={() => handleSend("Design a modern 2-storey house with 4 bedrooms, rooftop terrace, and contemporary Pakistani facade")}
                    >
                      🏠 <strong>5 Marla 2-Storey Modern</strong>
                      <div style={{ fontSize: "0.72rem", opacity: 0.75, marginTop: "2px" }}>
                        4 Beds, rooftop terrace, contemporary facade
                      </div>
                    </button>

                    <button
                      className="suggestion-btn"
                      onClick={() => handleSend("10 marla luxury villa with 5 bedrooms, servant quarter, covered porch, and jali screens")}
                    >
                      🏰 <strong>10 Marla Luxury Villa</strong>
                      <div style={{ fontSize: "0.72rem", opacity: 0.75, marginTop: "2px" }}>
                        5 Beds, traditional jali screens, servant quarter
                      </div>
                    </button>

                    <button
                      className="suggestion-btn"
                      onClick={() => handleSend("5 marla ka ghar, 2 manzil, 3 kamre, covered car porch, drawing room")}
                    >
                      🇵🇰 <strong>5 Marla Ka Ghar (اردو)</strong>
                      <div style={{ fontSize: "0.72rem", opacity: 0.75, marginTop: "2px" }}>
                        2 Manzil, 3 Kamre, Drawing Room, Porch
                      </div>
                    </button>

                    <button
                      className="suggestion-btn"
                      onClick={() => handleSend("1 kanal modern house with basement, 6 bedrooms, swimming pool patio, and double height lobby")}
                    >
                      🏢 <strong>1 Kanal Executive Estate</strong>
                      <div style={{ fontSize: "0.72rem", opacity: 0.75, marginTop: "2px" }}>
                        Basement, 6 Bedrooms, double height lobby
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`chat-msg ${msg.role}`} style={{ whiteSpace: "pre-line" }}>
                    {msg.content}
                    {msg.role === "assistant" && (
                      <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                        <button
                          onClick={() => globeRef.current?.flyToBuilding()}
                          style={{
                            background: "var(--color-surface)",
                            border: "1px solid var(--color-surface-border)",
                            color: "var(--color-text-primary)",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          🎥 Focus 3D Model
                        </button>
                        <button
                          onClick={toggleOrbitMode}
                          style={{
                            background: isOrbiting ? "#10b981" : "rgba(30, 41, 59, 0.8)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            color: "white",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          🔄 {isOrbiting ? "Stop Orbit" : "360° Orbit"}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* In-Flight Status Indicator */}
            {statusMessage && (
              <div className="chat-status-bar">
                <div className="status-pulse-dot" />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Pinned Sticky Input Dock */}
            <div className="drawer-input-dock">
              {/* Moving Architectural Preset Ribbon */}
              <div className="moving-ribbon-wrapper">
                <button
                  className="ribbon-arrow-btn left"
                  onClick={() => scrollRibbon("left")}
                  title="Scroll left"
                >
                  ‹
                </button>

                <div className="moving-ribbon-viewport" ref={ribbonRef}>
                  <div className="moving-ribbon-track">
                    {[...ARCHITECTURAL_PRESETS, ...ARCHITECTURAL_PRESETS].map((preset, idx) => (
                      <button
                        key={`${preset.title}-${idx}`}
                        className="moving-ribbon-card"
                        onClick={() => {
                          setInputValue(preset.prompt);
                          handleSend(preset.prompt);
                        }}
                        title={`Click to generate: ${preset.prompt}`}
                      >
                        <span>{preset.icon}</span>
                        <span>{preset.title}</span>
                        <span className="ribbon-card-tag">{preset.tag}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="ribbon-arrow-btn right"
                  onClick={() => scrollRibbon("right")}
                  title="Scroll right"
                >
                  ›
                </button>
              </div>

              <div className="chat-input-row">
                <textarea
                  className="chat-prompt-textarea"
                  placeholder="Describe your building (e.g. '5 marla ka ghar, 2 manzil, 4 kamre, modern facade')..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isProcessing}
                  rows={2}
                />
                <button
                  className="chat-send-action-btn"
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || isProcessing}
                  title="Generate 3D Architectural Building"
                >
                  {isProcessing ? "⏳" : "→"}
                </button>
              </div>
              <div className="chat-input-helper">
                Press Enter ↵ to generate • Shift+Enter for new line
              </div>
            </div>
          </>
        )}

        {/* Tab 2: Detailed Plot & Regulatory Zoning */}
        {activeTab === "zoning" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px" }}>
            <PlotSelector
              selectedPreset={selectedPreset}
              onSelectPreset={handleSelectPreset}
              onStartDrawing={() => globeRef.current?.startDrawingPlot()}
              onStartPlacement={handleStartPlacement}
              onClearPlot={handleClearPlot}
              isDrawing={isDrawing}
              isPlacing={isPlacing}
              hasPlot={Boolean(currentPlot && currentPlot.length >= 3)}
              plotMarla={plotMarla}
              mapStyle={mapStyle}
              onSelectMapStyle={handleSelectMapStyle}
              cameraMode={cameraMode}
              onToggleCameraMode={handleToggleCameraMode}
              plotRotation={plotRotation}
              onRotatePlot={handleRotatePlot}
            />

            <button
              onClick={() => setActiveTab("chat")}
              style={{
                width: "100%",
                background: "var(--color-text-primary)",
                border: "none",
                borderRadius: "10px",
                color: "var(--color-bg-primary)",
                padding: "12px 16px",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "var(--shadow-sm)",
                marginTop: "12px",
                transition: "opacity 0.15s ease",
              }}
            >
              <span>Back to AI Prompt & Generation</span>
              <span>💬 →</span>
            </button>
          </div>
        )}
      </aside>

      {/* Floating Re-Open Button when Copilot is Collapsed */}
      {isSidebarCollapsed && (
        <button
          className="copilot-floating-expand-btn"
          onClick={() => setIsSidebarCollapsed(false)}
          title="Open AI Architect Copilot"
        >
          <span>💬</span>
          <span>Open AI Architect</span>
        </button>
      )}

      {/* 3. Full-Bleed 3D Geospatial Engine Viewport */}
      <main className="globe-container">
        <CesiumGlobe
          ref={globeRef}
          ionToken={CESIUM_TOKEN}
          onReady={() => setGlobeReady(true)}
          onPlotDrawn={handlePlotDrawn}
          onDrawingChange={(drawing) => setIsDrawing(drawing)}
        />

        {/* Minimalist Bottom-Right GIS Camera Dock */}
        {globeReady && (
          <MapControls
            globeRef={globeRef}
            cameraMode={cameraMode}
            onToggleCameraMode={handleToggleCameraMode}
            isOrbiting={isOrbiting}
            onToggleOrbit={toggleOrbitMode}
            hasBuilding={Boolean(latestAnalysis)}
            hasPlot={Boolean(currentPlot && currentPlot.length >= 3)}
          />
        )}

        {/* Floating Building Feasibility & Compliance HUD */}
        {latestAnalysis && (
          <BuildingAnalysisHUD
            spec={latestAnalysis.spec}
            generate={latestAnalysis.generate}
            analysis={latestAnalysis.analysis}
            onFocusBuilding={() => globeRef.current?.flyToBuilding()}
            onToggleOrbit={toggleOrbitMode}
            onToggleShadows={() => globeRef.current?.toggleShadows()}
            isOrbiting={isOrbiting}
            onClose={() => setLatestAnalysis(null)}
            isSidebarOpen={!isSidebarCollapsed}
          />
        )}
      </main>
    </div>
  );
}

function roundTo(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Format complete response combining spec, 3D model status, and costs.
 */
function formatFullResponse(spec: any, generate: any, analysis: any): string {
  const lines = [
    `✅ 3D Building Model Generated & Placed!`,
    ``,
    `🏠 ${spec.floors} Storey${spec.floors > 1 ? "s" : ""}${spec.basement ? " + Basement" : ""} • Style: ${(spec.facade?.style || "contemporary_pakistani").replace(/_/g, " ")}`,
    `📐 Total Height: ${generate.total_height_m}m • Footprint: ${generate.building_footprint_sqm} m²`,
    `🛏️ ${spec.rooms?.bedrooms || 3} Bedrooms, ${spec.rooms?.bathrooms || 3} Bathrooms`,
    `🚗 ${spec.parking?.cars || 1} Car Parking (${spec.parking?.type || "covered"})`,
  ];

  if (spec.rooftopTerrace) lines.push(`🌇 Rooftop Terrace`);
  if (spec.facade?.hasBalcony) lines.push(`🏛️ Balcony`);
  if (spec.facade?.hasJali) lines.push(`🪟 Traditional Jali Screen`);
  if (spec.rooms?.drawingRoom) lines.push(`🛋️ Drawing Room`);

  if (analysis?.cost_estimate?.total) {
    const total = analysis.cost_estimate.total;
    const formattedTotal =
      total >= 10000000
        ? `PKR ${(total / 10000000).toFixed(2)} Crore`
        : `PKR ${(total / 100000).toFixed(2)} Lakh`;
    lines.push(``);
    lines.push(`💰 Estimated Cost: ${formattedTotal}`);
  }

  lines.push(``);
  lines.push(`⚖️ Preliminary check — not legal or regulatory approval`);

  return lines.join("\n");
}
