"use client";

import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";

import type {
  Viewer as CesiumViewer,
  Entity,
  ScreenSpaceEventHandler,
} from "cesium";

export interface CesiumGlobeRef {
  viewer: CesiumViewer | null;
  flyTo: (lng: number, lat: number, height?: number) => void;
  flyToBuilding: () => void;
  setPlotPolygon: (coords: [number, number][], label?: string) => void;
  clearPlot: () => void;
  startDrawingPlot: () => void;
  finishDrawingPlot: () => void;
  cancelDrawingPlot: () => void;
  loadGlbModel: (
    glbUri: string,
    center: [number, number],
    headingDeg?: number
  ) => void;
  clearModel: () => void;
  toggleOrbit: (enabled?: boolean) => void;
  toggleShadows: () => boolean;
}

interface CesiumGlobeProps {
  ionToken: string;
  onReady?: (viewer: CesiumViewer) => void;
  onPlotDrawn?: (coordinates: [number, number][]) => void;
  onDrawingChange?: (isDrawing: boolean, pointCount: number) => void;
  className?: string;
}

const CesiumGlobe = forwardRef<CesiumGlobeRef, CesiumGlobeProps>(
  ({ ionToken, onReady, onPlotDrawn, onDrawingChange, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<CesiumViewer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);

    // Internal entity references
    const modelEntityRef = useRef<Entity | null>(null);
    const plotPolygonEntityRef = useRef<Entity | null>(null);
    const plotPolylineEntityRef = useRef<Entity | null>(null);
    const plotLabelEntityRef = useRef<Entity | null>(null);
    const markerEntitiesRef = useRef<Entity[]>([]);
    const drawHandlerRef = useRef<ScreenSpaceEventHandler | null>(null);
    const activePointsRef = useRef<[number, number][]>([]);
    const dynamicDrawPolylineRef = useRef<Entity | null>(null);
    const orbitIntervalRef = useRef<number | null>(null);

    // Stop drawing cleanup
    const stopDrawing = useCallback(() => {
      if (drawHandlerRef.current && !drawHandlerRef.current.isDestroyed()) {
        drawHandlerRef.current.destroy();
        drawHandlerRef.current = null;
      }
      if (dynamicDrawPolylineRef.current && viewerRef.current) {
        viewerRef.current.entities.remove(dynamicDrawPolylineRef.current);
        dynamicDrawPolylineRef.current = null;
      }
      activePointsRef.current = [];
      setIsDrawing(false);
      setDrawingPoints([]);
      onDrawingChange?.(false, 0);
    }, [onDrawingChange]);

    // Clear plot entities
    const clearPlotInternal = useCallback(() => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      if (plotPolygonEntityRef.current) {
        viewer.entities.remove(plotPolygonEntityRef.current);
        plotPolygonEntityRef.current = null;
      }
      if (plotPolylineEntityRef.current) {
        viewer.entities.remove(plotPolylineEntityRef.current);
        plotPolylineEntityRef.current = null;
      }
      if (plotLabelEntityRef.current) {
        viewer.entities.remove(plotLabelEntityRef.current);
        plotLabelEntityRef.current = null;
      }
      markerEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
      markerEntitiesRef.current = [];
    }, []);

    // Set plot polygon
    const setPlotPolygonInternal = useCallback(
      (coords: [number, number][], label?: string) => {
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        if (!viewer || !Cesium || coords.length < 3) return;

        clearPlotInternal();

        // Closed loop for outline polyline
        const loopCoords = [...coords, coords[0]];
        const flatDegrees = coords.flat();
        const flatLoopDegrees = loopCoords.flat();

        // 1. Translucent plot polygon fill
        plotPolygonEntityRef.current = viewer.entities.add({
          name: "Plot Boundary Area",
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(flatDegrees),
            material: Cesium.Color.fromCssColorString("rgba(56, 189, 248, 0.25)"),
            height: 0.1,
          },
        });

        // 2. Glowing cyan boundary polyline (crisp line at all zoom levels)
        plotPolylineEntityRef.current = viewer.entities.add({
          name: "Plot Outline",
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(flatLoopDegrees),
            width: 3.5,
            material: Cesium.Color.fromCssColorString("#38bdf8"),
            clampToGround: true,
          },
        });

        // 3. Corner pin dots
        coords.forEach((pt, idx) => {
          const marker = viewer.entities.add({
            name: `Plot Corner ${idx + 1}`,
            position: Cesium.Cartesian3.fromDegrees(pt[0], pt[1], 0.2),
            point: {
              pixelSize: 8,
              color: Cesium.Color.fromCssColorString("#67e8f9"),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 1.5,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
          markerEntitiesRef.current.push(marker);
        });

        // 4. Centroid label
        const sumX = coords.reduce((acc, c) => acc + c[0], 0);
        const sumY = coords.reduce((acc, c) => acc + c[1], 0);
        const centerLon = sumX / coords.length;
        const centerLat = sumY / coords.length;

        if (label) {
          plotLabelEntityRef.current = viewer.entities.add({
            name: "Plot Info Label",
            position: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, 0.5),
            label: {
              text: label,
              font: "13px 'Inter', sans-serif",
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
        }
      },
      [clearPlotInternal]
    );

    // Clear 3D model
    const clearModelInternal = useCallback(() => {
      const viewer = viewerRef.current;
      if (viewer && modelEntityRef.current) {
        viewer.entities.remove(modelEntityRef.current);
        modelEntityRef.current = null;
      }
      if (orbitIntervalRef.current) {
        clearInterval(orbitIntervalRef.current);
        orbitIntervalRef.current = null;
      }
    }, []);

    // Load 3D GLB model
    const loadGlbModelInternal = useCallback(
      (glbUri: string, center: [number, number], headingDeg = 0) => {
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        if (!viewer || !Cesium) return;

        clearModelInternal();

        // Convert base64 data URI to object URL for smoother memory handling
        let finalUri = glbUri;
        if (glbUri.startsWith("data:")) {
          try {
            const cleanB64 = glbUri.includes(",") ? glbUri.split(",")[1] : glbUri;
            const byteCharacters = atob(cleanB64);
            const byteNumbers = new Uint8Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const blob = new Blob([byteNumbers], { type: "model/gltf-binary" });
            finalUri = URL.createObjectURL(blob);
          } catch (e) {
            console.warn("Direct data URI fallback:", e);
          }
        }

        const position = Cesium.Cartesian3.fromDegrees(center[0], center[1], 0.0);
        const headingRad = Cesium.Math.toRadians(headingDeg);
        const hpr = new Cesium.HeadingPitchRoll(headingRad, 0, 0);
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(
          position,
          hpr
        );

        const modelEntity = viewer.entities.add({
          name: "GeoBuild 3D Building",
          position: position,
          orientation: orientation,
          model: {
            uri: finalUri,
            minimumPixelSize: 64,
            maximumScale: 20000,
            scale: 1.0,
            shadows: Cesium.ShadowMode.ENABLED,
            runAnimations: false,
          },
        });

        modelEntityRef.current = modelEntity;

        // Fly camera directly to 3D perspective of building
        viewer.flyTo(modelEntity, {
          offset: new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(30),
            Cesium.Math.toRadians(-26),
            55.0 // distance in metres
          ),
          duration: 2.2,
        });
      },
      [clearModelInternal]
    );

    // Interactive drawing
    const startDrawingPlotInternal = useCallback(() => {
      const viewer = viewerRef.current;
      const Cesium = (window as any).Cesium;
      if (!viewer || !Cesium) return;

      stopDrawing();
      clearPlotInternal();

      activePointsRef.current = [];
      setIsDrawing(true);
      setDrawingPoints([]);
      onDrawingChange?.(true, 0);

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      drawHandlerRef.current = handler;

      // Dynamic polyline for drawing progress
      dynamicDrawPolylineRef.current = viewer.entities.add({
        name: "Plot Drawing Line",
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const pts = activePointsRef.current;
            if (pts.length < 2) return [];
            return Cesium.Cartesian3.fromDegreesArray(pts.flat());
          }, false),
          width: 3.0,
          material: Cesium.Color.fromCssColorString("#f59e0b"),
          clampToGround: true,
        },
      });

      // Left click to add vertex
      handler.setInputAction((click: any) => {
        const ray = viewer.camera.getPickRay(click.position);
        if (!ray) return;
        const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        if (!cartesian) return;

        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);

        activePointsRef.current = [...activePointsRef.current, [lon, lat]];
        const count = activePointsRef.current.length;
        setDrawingPoints([...activePointsRef.current]);
        onDrawingChange?.(true, count);

        // Add visual vertex dot
        const dot = viewer.entities.add({
          position: cartesian,
          point: {
            pixelSize: 10,
            color: Cesium.Color.fromCssColorString("#fbbf24"),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        markerEntitiesRef.current.push(dot);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // Double click to finish
      handler.setInputAction(() => {
        if (activePointsRef.current.length >= 3) {
          const finalCoords = [...activePointsRef.current];
          stopDrawing();
          setPlotPolygonInternal(finalCoords, "Custom Plot");
          onPlotDrawn?.(finalCoords);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }, [clearPlotInternal, onDrawingChange, onPlotDrawn, setPlotPolygonInternal, stopDrawing]);

    // Finish drawing manually
    const finishDrawingPlotInternal = useCallback(() => {
      if (activePointsRef.current.length >= 3) {
        const finalCoords = [...activePointsRef.current];
        stopDrawing();
        setPlotPolygonInternal(finalCoords, "Custom Plot");
        onPlotDrawn?.(finalCoords);
      }
    }, [onPlotDrawn, setPlotPolygonInternal, stopDrawing]);

    // Expose imperative API
    useImperativeHandle(ref, () => ({
      viewer: viewerRef.current,
      flyTo: (lng: number, lat: number, height = 2000) => {
        if (viewerRef.current) {
          const Cesium = (window as any).Cesium;
          viewerRef.current.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat, height),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-45),
              roll: 0,
            },
            duration: 2.0,
          });
        }
      },
      flyToBuilding: () => {
        if (viewerRef.current && modelEntityRef.current) {
          const Cesium = (window as any).Cesium;
          viewerRef.current.flyTo(modelEntityRef.current, {
            offset: new Cesium.HeadingPitchRange(
              Cesium.Math.toRadians(25),
              Cesium.Math.toRadians(-28),
              55.0
            ),
            duration: 1.5,
          });
        }
      },
      setPlotPolygon: setPlotPolygonInternal,
      clearPlot: clearPlotInternal,
      startDrawingPlot: startDrawingPlotInternal,
      finishDrawingPlot: finishDrawingPlotInternal,
      cancelDrawingPlot: stopDrawing,
      loadGlbModel: loadGlbModelInternal,
      clearModel: clearModelInternal,
      toggleOrbit: (enabled?: boolean) => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        if (orbitIntervalRef.current) {
          clearInterval(orbitIntervalRef.current);
          orbitIntervalRef.current = null;
          if (enabled === false) return;
        }
        if (enabled !== false) {
          orbitIntervalRef.current = window.setInterval(() => {
            viewer.camera.rotateRight(0.005);
          }, 30);
        }
      },
      toggleShadows: () => {
        const viewer = viewerRef.current;
        if (!viewer) return false;
        viewer.shadows = !viewer.shadows;
        return viewer.shadows;
      },
    }));

    // Initialize Cesium
    useEffect(() => {
      let viewer: CesiumViewer | null = null;

      const initCesium = async () => {
        try {
          const Cesium = await import("cesium");
          (window as any).CESIUM_BASE_URL = "/cesium";
          (window as any).Cesium = Cesium;

          const hasValidToken = Boolean(
            ionToken &&
              ionToken.trim() !== "" &&
              !ionToken.includes("your_cesium_ion_token_here") &&
              !ionToken.startsWith("your_")
          );

          if (hasValidToken) {
            Cesium.Ion.defaultAccessToken = ionToken;
          }

          if (!containerRef.current) return;

          // Provide high-resolution satellite basemap (ESRI World Imagery)
          let baseLayer: any = undefined;
          try {
            const esriImagery = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
              "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
              { enablePickFeatures: false }
            );
            baseLayer = new Cesium.ImageryLayer(esriImagery);
          } catch (esriErr) {
            console.warn("Could not load ESRI imagery, using OSM fallback:", esriErr);
            try {
              const osm = new Cesium.OpenStreetMapImageryProvider({
                url: "https://tile.openstreetmap.org/",
              });
              baseLayer = new Cesium.ImageryLayer(osm);
            } catch {}
          }

          const viewerOptions: any = {
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            animation: false,
            timeline: false,
            fullscreenButton: false,
            vrButton: false,
            infoBox: false,
            selectionIndicator: false,
            shadows: true,
            shouldAnimate: true,
            terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          };

          if (baseLayer) {
            viewerOptions.baseLayer = baseLayer;
          }

          // If a real valid token is supplied, enable World Terrain & OSM Buildings
          if (hasValidToken) {
            try {
              viewerOptions.terrain = Cesium.Terrain.fromWorldTerrain();
            } catch {}
          }

          viewer = new Cesium.Viewer(containerRef.current, viewerOptions);
          viewerRef.current = viewer;

          if (hasValidToken) {
            try {
              const osmBuildingsTileset = await Cesium.createOsmBuildingsAsync();
              viewer.scene.primitives.add(osmBuildingsTileset);
            } catch (e) {
              console.warn("OSM buildings skipped:", e);
            }
          }

          // Initial flight to Lahore, Pakistan
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(74.3587, 31.5204, 3500),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-45),
              roll: 0,
            },
            duration: 2.5,
          });

          viewer.scene.globe.depthTestAgainstTerrain = false;
          viewer.scene.globe.enableLighting = true;
          viewer.scene.fog.enabled = true;

          setIsLoading(false);
          onReady?.(viewer);
        } catch (err) {
          console.error("Failed to initialize Cesium:", err);
          setError(err instanceof Error ? err.message : "Failed to load 3D globe");
          setIsLoading(false);
        }
      };

      initCesium();

      return () => {
        stopDrawing();
        clearModelInternal();
        if (viewer && !viewer.isDestroyed()) {
          viewer.destroy();
        }
        viewerRef.current = null;
      };
    }, [ionToken]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div className={`cesium-globe-container ${className || ""}`}>
        {isLoading && (
          <div className="cesium-loading-overlay">
            <div className="cesium-loading-spinner" />
            <p>Loading 3D Geospatial Engine...</p>
          </div>
        )}
        {error && (
          <div className="cesium-error-overlay">
            <div className="cesium-error-icon">⚠️</div>
            <h3>Globe Error</h3>
            <p>{error}</p>
          </div>
        )}

        {/* In-Globe Drawing Status Banner */}
        {isDrawing && (
          <div
            style={{
              position: "absolute",
              top: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 350,
              background: "rgba(17, 24, 39, 0.92)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              borderRadius: "12px",
              padding: "10px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
              color: "#f1f5f9",
              fontSize: "0.85rem",
            }}
          >
            <span>
              ✏️ <strong>Click map to place plot corners</strong> ({drawingPoints.length} points) • Double-click to complete
            </span>
            <button
              onClick={finishDrawingPlotInternal}
              disabled={drawingPoints.length < 3}
              style={{
                background: drawingPoints.length >= 3 ? "#10b981" : "#374151",
                color: "white",
                border: "none",
                borderRadius: "6px",
                padding: "4px 12px",
                fontWeight: 600,
                cursor: drawingPoints.length >= 3 ? "pointer" : "not-allowed",
              }}
            >
              Complete
            </button>
            <button
              onClick={stopDrawing}
              style={{
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: "6px",
                padding: "4px 10px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        )}

        <div
          ref={containerRef}
          className="cesium-viewer-container"
          style={{ cursor: isDrawing ? "crosshair" : "default" }}
        />
      </div>
    );
  }
);

CesiumGlobe.displayName = "CesiumGlobe";
export default CesiumGlobe;

