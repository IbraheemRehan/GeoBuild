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

export type MapStyleKey = "esri_hd" | "google_satellite" | "streets" | "blueprint" | "studio";

export interface CesiumGlobeRef {
  viewer: CesiumViewer | null;
  flyTo: (lng: number, lat: number, height?: number) => void;
  flyToBuilding: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  tiltCamera: (degrees: number) => void;
  rotateCamera: (degrees: number) => void;
  resetNorth: () => void;
  setCameraView: (mode: "2d" | "3d", targetLng?: number, targetLat?: number) => void;
  setMapStyle: (style: MapStyleKey) => void;
  setPlotPolygon: (coords: [number, number][], label?: string) => void;
  clearPlot: () => void;
  startDrawingPlot: () => void;
  finishDrawingPlot: () => void;
  cancelDrawingPlot: () => void;
  startPlotPlacement: (onPlace: (lng: number, lat: number) => void) => void;
  cancelPlotPlacement: () => void;
  loadGlbModel: (
    glbUri: string,
    center: [number, number],
    headingDeg?: number
  ) => void;
  clearModel: () => void;
  setBuildingRotation: (headingDeg: number) => void;
  rotateBuilding: (degDelta: number) => number;
  toggleOrbit: (enabled?: boolean) => void;
  toggleShadows: () => boolean;
  focusPlot: (coords?: [number, number][]) => void;
  toggleMarkings: (visible?: boolean) => boolean;
  setMarkingsVisible: (visible: boolean) => void;
}

interface CesiumGlobeProps {
  ionToken: string;
  onReady?: (viewer: CesiumViewer) => void;
  onPlotDrawn?: (coordinates: [number, number][]) => void;
  onDrawingChange?: (isDrawing: boolean, pointCount: number) => void;
  className?: string;
}

const MAP_STYLES: Record<
  Exclude<MapStyleKey, "studio">,
  { name: string; url: string; maxLevel: number; subdomains?: string[] }
> = {
  esri_hd: {
    name: "Esri Ultra-HD",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxLevel: 20,
  },
  google_satellite: {
    name: "HD Satellite",
    url: "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    subdomains: ["0", "1", "2", "3"],
    maxLevel: 22,
  },
  streets: {
    name: "Clear Streets",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxLevel: 19,
  },
  blueprint: {
    name: "CAD Blueprint",
    url: "https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
    maxLevel: 20,
  },
};

const CesiumGlobe = forwardRef<CesiumGlobeRef, CesiumGlobeProps>(
  ({ ionToken, onReady, onPlotDrawn, onDrawingChange, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<CesiumViewer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isPlacing, setIsPlacing] = useState(false);
    const [currentStyle, setCurrentStyle] = useState<MapStyleKey>("google_satellite");
    const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
    const [showMarkings, setShowMarkings] = useState(true);
    const showMarkingsRef = useRef(true);

    // Internal entity references
    const modelEntityRef = useRef<Entity | null>(null);
    const plotPolygonEntityRef = useRef<Entity | null>(null);
    const plotPolylineEntityRef = useRef<Entity | null>(null);
    const plotLabelEntityRef = useRef<Entity | null>(null);
    const edgeLabelEntitiesRef = useRef<Entity[]>([]);
    const markerEntitiesRef = useRef<Entity[]>([]);
    const drawHandlerRef = useRef<ScreenSpaceEventHandler | null>(null);
    const placeHandlerRef = useRef<ScreenSpaceEventHandler | null>(null);
    const activePointsRef = useRef<[number, number][]>([]);
    const dynamicDrawPolylineRef = useRef<Entity | null>(null);
    const orbitIntervalRef = useRef<number | null>(null);
    const lastPlotCenterRef = useRef<[number, number] | null>(null);
    const buildingCenterRef = useRef<[number, number] | null>(null);
    const buildingHeadingRef = useRef<number>(0);

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

    // Stop placing cleanup
    const stopPlacing = useCallback(() => {
      if (placeHandlerRef.current && !placeHandlerRef.current.isDestroyed()) {
        placeHandlerRef.current.destroy();
        placeHandlerRef.current = null;
      }
      setIsPlacing(false);
    }, []);

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
      edgeLabelEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
      edgeLabelEntitiesRef.current = [];
      markerEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
      markerEntitiesRef.current = [];
      lastPlotCenterRef.current = null;
    }, []);

    // Map style switcher
    const setMapStyleInternal = useCallback((style: MapStyleKey) => {
      const viewer = viewerRef.current;
      const Cesium = (window as any).Cesium;
      if (!viewer || !Cesium) return;

      setCurrentStyle(style);

      if (style === "studio") {
        // Architectural Studio Mode: clean dark background, no globe imagery, pure 3D model focus
        viewer.scene.globe.show = false;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#090d16");
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
        if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
      } else {
        viewer.scene.globe.show = true;
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
        const config = MAP_STYLES[style];
        if (config?.url) {
          viewer.imageryLayers.removeAll();
          const provider = new Cesium.UrlTemplateImageryProvider({
            url: config.url,
            maximumLevel: config.maxLevel,
            subdomains: config.subdomains,
          });
          viewer.imageryLayers.addImageryProvider(provider);
        }
      }
    }, []);

    // Toggle CAD Dimension markings, numberings, and labels
    const setMarkingsVisibleInternal = useCallback((visible: boolean) => {
      showMarkingsRef.current = visible;
      setShowMarkings(visible);

      edgeLabelEntitiesRef.current.forEach((e) => {
        e.show = visible;
      });
      markerEntitiesRef.current.forEach((e) => {
        e.show = visible;
      });
      if (plotLabelEntityRef.current) {
        plotLabelEntityRef.current.show = visible;
      }
      if (plotPolygonEntityRef.current) {
        plotPolygonEntityRef.current.show = visible;
      }
      if (plotPolylineEntityRef.current) {
        plotPolylineEntityRef.current.show = visible;
      }
    }, []);

function cleanPolygonCoordinates(rawCoords: [number, number][]): [number, number][] {
  if (rawCoords.length < 3) return rawCoords;
  const result: [number, number][] = [];
  for (let i = 0; i < rawCoords.length; i++) {
    const pt = rawCoords[i];
    if (result.length === 0) {
      result.push(pt);
      continue;
    }
    const prev = result[result.length - 1];
    const dLat = (pt[1] - prev[1]) * 111132;
    const dLng = (pt[0] - prev[0]) * 111132 * Math.cos(((pt[1] + prev[1]) * Math.PI) / 360);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist >= 1.0) {
      result.push(pt);
    }
  }
  if (result.length >= 3) {
    const first = result[0];
    const last = result[result.length - 1];
    const dLat = (last[1] - first[1]) * 111132;
    const dLng = (last[0] - first[0]) * 111132 * Math.cos(((first[1] + last[1]) * Math.PI) / 360);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < 1.2) {
      result.pop();
    }
  }
  return result.length >= 3 ? result : rawCoords;
}

    // Set plot polygon
    const setPlotPolygonInternal = useCallback(
      (rawCoords: [number, number][], label?: string) => {
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        const coords = cleanPolygonCoordinates(rawCoords);
        if (!viewer || !Cesium || coords.length < 3) return;

        clearPlotInternal();

        // Closed loop for outline polyline
        const loopCoords = [...coords, coords[0]];
        const flatDegrees = coords.flat();
        const flatLoopDegrees = loopCoords.flat();

        // 1. Translucent plot polygon fill (clamped to terrain and 3D tiles)
        plotPolygonEntityRef.current = viewer.entities.add({
          name: "Plot Boundary Area",
          show: showMarkingsRef.current,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(
              Cesium.Cartesian3.fromDegreesArray(flatDegrees)
            ),
            material: Cesium.Color.fromCssColorString("rgba(255, 255, 255, 0.22)"),
            classificationType: Cesium.ClassificationType.BOTH,
          },
        });

        // 2. Architectural monochrome boundary polyline (crisp line at all zoom levels)
        plotPolylineEntityRef.current = viewer.entities.add({
          name: "Plot Outline",
          show: showMarkingsRef.current,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(flatLoopDegrees),
            width: 3.5,
            material: Cesium.Color.fromCssColorString("#ffffff"),
            clampToGround: true,
          },
        });

        // 3. Corner pin dots (clamped to ground)
        coords.forEach((pt, idx) => {
          const marker = viewer.entities.add({
            name: `Plot Corner ${idx + 1}`,
            show: showMarkingsRef.current,
            position: Cesium.Cartesian3.fromDegrees(pt[0], pt[1]),
            point: {
              pixelSize: 9,
              color: Cesium.Color.fromCssColorString("#ffffff"),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
          markerEntitiesRef.current.push(marker);
        });

        // 4. Edge dimension labels (feet & metres, clamped to ground)
        edgeLabelEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
        edgeLabelEntitiesRef.current = [];

        for (let i = 0; i < coords.length; i++) {
          const p1 = coords[i];
          const p2 = coords[(i + 1) % coords.length];
          const c1 = Cesium.Cartesian3.fromDegrees(p1[0], p1[1]);
          const c2 = Cesium.Cartesian3.fromDegrees(p2[0], p2[1]);
          const distM = Cesium.Cartesian3.distance(c1, c2);
          const distFt = distM * 3.28084;
          if (distM < 1.0) continue; // Skip microscopic sliver edges (e.g. 0.0 ft)

          const midLon = (p1[0] + p2[0]) / 2;
          const midLat = (p1[1] + p2[1]) / 2;
          const edgeTag = viewer.entities.add({
            name: `Edge ${i + 1} Dimension`,
            show: showMarkingsRef.current,
            position: Cesium.Cartesian3.fromDegrees(midLon, midLat),
            label: {
              text: `${distFt.toFixed(1)} ft (${distM.toFixed(1)}m)`,
              font: "bold 12px 'Inter', sans-serif",
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              backgroundColor: Cesium.Color.fromCssColorString("rgba(9, 9, 11, 0.9)"),
              showBackground: true,
              backgroundPadding: new Cesium.Cartesian2(7, 4),
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
          edgeLabelEntitiesRef.current.push(edgeTag);
        }

        // 5. Centroid label
        const sumX = coords.reduce((acc, c) => acc + c[0], 0);
        const sumY = coords.reduce((acc, c) => acc + c[1], 0);
        const centerLon = sumX / coords.length;
        const centerLat = sumY / coords.length;
        lastPlotCenterRef.current = [centerLon, centerLat];

        if (label) {
          plotLabelEntityRef.current = viewer.entities.add({
            name: "Plot Info Label",
            show: showMarkingsRef.current,
            position: Cesium.Cartesian3.fromDegrees(centerLon, centerLat),
            label: {
              text: `📐 ${label}`,
              font: "bold 14px 'Outfit', sans-serif",
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              backgroundColor: Cesium.Color.fromCssColorString("rgba(9, 9, 11, 0.94)"),
              showBackground: true,
              backgroundPadding: new Cesium.Cartesian2(10, 5),
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
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
      buildingCenterRef.current = null;
      buildingHeadingRef.current = 0;
    }, []);

    // Set 3D building rotation interactively
    const setBuildingRotationInternal = useCallback((headingDeg: number) => {
      const viewer = viewerRef.current;
      const Cesium = (window as any).Cesium;
      const model = modelEntityRef.current;
      if (!viewer || !Cesium || !model || !buildingCenterRef.current) return;

      buildingHeadingRef.current = headingDeg;
      const position = Cesium.Cartesian3.fromDegrees(
        buildingCenterRef.current[0],
        buildingCenterRef.current[1],
        0.0
      );
      const headingRad = Cesium.Math.toRadians(headingDeg);
      const hpr = new Cesium.HeadingPitchRoll(headingRad, 0, 0);
      const orientation = Cesium.Transforms.headingPitchRollQuaternion(
        position,
        hpr
      );
      model.orientation = orientation;
    }, []);

    const rotateBuildingInternal = useCallback(
      (degDelta: number) => {
        const next = (buildingHeadingRef.current + degDelta + 360) % 360;
        setBuildingRotationInternal(next);
        return next;
      },
      [setBuildingRotationInternal]
    );

    // Load 3D GLB model
    const loadGlbModelInternal = useCallback(
      (glbUri: string, center: [number, number], headingDeg = 0) => {
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        if (!viewer || !Cesium) return;

        clearModelInternal();
        buildingCenterRef.current = center;
        buildingHeadingRef.current = headingDeg;

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

        // Strict 1:1 metric scale (no artificial pixel enlargement) and ground clamping
        const modelEntity = viewer.entities.add({
          name: "GeoBuild 3D Building",
          position: position,
          orientation: orientation,
          model: {
            uri: finalUri,
            scale: 1.0,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            shadows: Cesium.ShadowMode.ENABLED,
            runAnimations: false,
          },
        });

        modelEntityRef.current = modelEntity;

        // Smoothly fly camera to 3D perspective of building target (ground anchored)
        const targetCartesian = Cesium.Cartesian3.fromDegrees(center[0], center[1], 0.0);
        const sphere = new Cesium.BoundingSphere(targetCartesian, 25.0);
        viewer.camera.flyToBoundingSphere(sphere, {
          offset: new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians((headingDeg || 0) + 25),
            Cesium.Math.toRadians(-28),
            65.0
          ),
          duration: 1.8,
        });
      },
      [clearModelInternal]
    );

    // Click to place plot on map
    const startPlotPlacementInternal = useCallback(
      (onPlace: (lng: number, lat: number) => void) => {
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        if (!viewer || !Cesium) return;

        stopPlacing();
        stopDrawing();
        setIsPlacing(true);

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        placeHandlerRef.current = handler;

        handler.setInputAction((click: any) => {
          const ray = viewer.camera.getPickRay(click.position);
          if (!ray) return;
          const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
          if (!cartesian) return;

          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          const lon = Cesium.Math.toDegrees(cartographic.longitude);
          const lat = Cesium.Math.toDegrees(cartographic.latitude);

          stopPlacing();
          onPlace(lon, lat);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      },
      [stopDrawing, stopPlacing]
    );

    // Interactive polygon drawing
    const startDrawingPlotInternal = useCallback(() => {
      const viewer = viewerRef.current;
      const Cesium = (window as any).Cesium;
      if (!viewer || !Cesium) return;

      stopDrawing();
      stopPlacing();
      clearPlotInternal();

      activePointsRef.current = [];
      setIsDrawing(true);
      setDrawingPoints([]);
      onDrawingChange?.(true, 0);

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      drawHandlerRef.current = handler;

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

      handler.setInputAction((click: any) => {
        const ray = viewer.camera.getPickRay(click.position);
        if (!ray) return;
        const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        if (!cartesian) return;

        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);

        // Ignore clicks within 1.0m of the preceding point to avoid duplicate zero-length edges
        const pts = activePointsRef.current;
        if (pts.length > 0) {
          const last = pts[pts.length - 1];
          const dLat = (lat - last[1]) * 111132;
          const dLng = (lon - last[0]) * 111132 * Math.cos(((lat + last[1]) * Math.PI) / 360);
          if (Math.sqrt(dLat * dLat + dLng * dLng) < 1.0) {
            return;
          }
        }

        activePointsRef.current = [...activePointsRef.current, [lon, lat]];
        const count = activePointsRef.current.length;
        setDrawingPoints([...activePointsRef.current]);
        onDrawingChange?.(true, count);

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

      handler.setInputAction(() => {
        const finalCoords = cleanPolygonCoordinates(activePointsRef.current);
        if (finalCoords.length >= 3) {
          stopDrawing();
          setPlotPolygonInternal(finalCoords, "Custom Drawn Plot");
          onPlotDrawn?.(finalCoords);

          // Gently frame the completed drawn plot without changing view orientation
          const sumX = finalCoords.reduce((acc, c) => acc + c[0], 0);
          const sumY = finalCoords.reduce((acc, c) => acc + c[1], 0);
          const cLon = sumX / finalCoords.length;
          const cLat = sumY / finalCoords.length;
          const target = Cesium.Cartesian3.fromDegrees(cLon, cLat, 0);
          const sphere = new Cesium.BoundingSphere(target, 35);
          viewer.camera.flyToBoundingSphere(sphere, {
            offset: new Cesium.HeadingPitchRange(
              viewer.camera.heading,
              Math.min(viewer.camera.pitch, Cesium.Math.toRadians(-35)),
              90.0
            ),
            duration: 1.2,
          });
        }
      }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }, [clearPlotInternal, onDrawingChange, onPlotDrawn, setPlotPolygonInternal, stopDrawing, stopPlacing]);

    const finishDrawingPlotInternal = useCallback(() => {
      const finalCoords = cleanPolygonCoordinates(activePointsRef.current);
      if (finalCoords.length >= 3) {
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        stopDrawing();
        setPlotPolygonInternal(finalCoords, "Custom Drawn Plot");
        onPlotDrawn?.(finalCoords);

        if (viewer && Cesium) {
          const sumX = finalCoords.reduce((acc, c) => acc + c[0], 0);
          const sumY = finalCoords.reduce((acc, c) => acc + c[1], 0);
          const cLon = sumX / finalCoords.length;
          const cLat = sumY / finalCoords.length;
          const target = Cesium.Cartesian3.fromDegrees(cLon, cLat, 0);
          const sphere = new Cesium.BoundingSphere(target, 35);
          viewer.camera.flyToBoundingSphere(sphere, {
            offset: new Cesium.HeadingPitchRange(
              viewer.camera.heading,
              Math.min(viewer.camera.pitch, Cesium.Math.toRadians(-35)),
              90.0
            ),
            duration: 1.2,
          });
        }
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
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        if (!viewer || !Cesium) return;
        const center = lastPlotCenterRef.current;
        if (center) {
          const target = Cesium.Cartesian3.fromDegrees(center[0], center[1], 0);
          const sphere = new Cesium.BoundingSphere(target, 25);
          viewer.camera.flyToBoundingSphere(sphere, {
            offset: new Cesium.HeadingPitchRange(
              Cesium.Math.toRadians(25),
              Cesium.Math.toRadians(-28),
              70.0
            ),
            duration: 1.5,
          });
        } else if (modelEntityRef.current) {
          viewer.flyTo(modelEntityRef.current);
        }
      },
      focusPlot: (coords?: [number, number][]) => {
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        if (!viewer || !Cesium) return;
        const pts = coords || (lastPlotCenterRef.current ? [lastPlotCenterRef.current] : null);
        if (!pts || pts.length === 0) return;
        let cLon = 0;
        let cLat = 0;
        if (pts.length === 1) {
          cLon = pts[0][0];
          cLat = pts[0][1];
        } else {
          cLon = pts.reduce((a, b) => a + b[0], 0) / pts.length;
          cLat = pts.reduce((a, b) => a + b[1], 0) / pts.length;
        }
        const target = Cesium.Cartesian3.fromDegrees(cLon, cLat, 0);
        const sphere = new Cesium.BoundingSphere(target, 35);
        viewer.camera.flyToBoundingSphere(sphere, {
          offset: new Cesium.HeadingPitchRange(
            viewer.camera.heading,
            Cesium.Math.toRadians(-45),
            85.0
          ),
          duration: 1.2,
        });
      },
      zoomIn: () => {
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        if (!viewer || !Cesium) return;

        const scene = viewer.scene;
        let targetCartesian: any = null;
        try {
          const centerPos = new Cesium.Cartesian2(
            scene.canvas.clientWidth / 2,
            scene.canvas.clientHeight / 2
          );
          const ray = viewer.camera.getPickRay(centerPos);
          if (ray) targetCartesian = scene.globe.pick(ray, scene);
        } catch {}

        if (targetCartesian) {
          const currentRange = Cesium.Cartesian3.distance(viewer.camera.position, targetCartesian);
          const newRange = Math.max(currentRange * 0.65, 12);
          const sphere = new Cesium.BoundingSphere(targetCartesian, 0);
          viewer.camera.flyToBoundingSphere(sphere, {
            offset: new Cesium.HeadingPitchRange(viewer.camera.heading, viewer.camera.pitch, newRange),
            duration: 0.25,
          });
        } else {
          const carto = viewer.camera.positionCartographic;
          const currentHeight = carto ? carto.height : 500;
          viewer.camera.zoomIn(Math.max(currentHeight * 0.35, 15));
        }
      },
      zoomOut: () => {
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        if (!viewer || !Cesium) return;

        const scene = viewer.scene;
        let targetCartesian: any = null;
        try {
          const centerPos = new Cesium.Cartesian2(
            scene.canvas.clientWidth / 2,
            scene.canvas.clientHeight / 2
          );
          const ray = viewer.camera.getPickRay(centerPos);
          if (ray) targetCartesian = scene.globe.pick(ray, scene);
        } catch {}

        if (targetCartesian) {
          const currentRange = Cesium.Cartesian3.distance(viewer.camera.position, targetCartesian);
          const newRange = Math.min(currentRange * 1.45, 100000);
          const sphere = new Cesium.BoundingSphere(targetCartesian, 0);
          viewer.camera.flyToBoundingSphere(sphere, {
            offset: new Cesium.HeadingPitchRange(viewer.camera.heading, viewer.camera.pitch, newRange),
            duration: 0.25,
          });
        } else {
          const carto = viewer.camera.positionCartographic;
          const currentHeight = carto ? carto.height : 500;
          viewer.camera.zoomOut(Math.max(currentHeight * 0.35, 15));
        }
      },
      tiltCamera: (degrees: number) => {
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        if (!viewer || !Cesium) return;

        const scene = viewer.scene;
        let targetCartesian: any = null;
        try {
          const centerPos = new Cesium.Cartesian2(
            scene.canvas.clientWidth / 2,
            scene.canvas.clientHeight / 2
          );
          const ray = viewer.camera.getPickRay(centerPos);
          if (ray) {
            targetCartesian = scene.globe.pick(ray, scene);
          }
        } catch {}

        if (!targetCartesian) {
          const cLon = lastPlotCenterRef.current?.[0] ?? 74.3587;
          const cLat = lastPlotCenterRef.current?.[1] ?? 31.5204;
          targetCartesian = Cesium.Cartesian3.fromDegrees(cLon, cLat, 0);
        }

        const range = Cesium.Cartesian3.distance(viewer.camera.position, targetCartesian);
        const currentHeading = viewer.camera.heading;
        const currentPitch = viewer.camera.pitch;

        // degrees > 0 means tilt up towards horizontal (facades)
        // degrees < 0 means tilt down towards top-down 2D
        const newPitch = Math.min(
          Math.max(currentPitch + Cesium.Math.toRadians(degrees), Cesium.Math.toRadians(-89.5)),
          Cesium.Math.toRadians(-10)
        );

        const sphere = new Cesium.BoundingSphere(targetCartesian, 0);
        viewer.camera.flyToBoundingSphere(sphere, {
          offset: new Cesium.HeadingPitchRange(currentHeading, newPitch, range),
          duration: 0.3,
        });
      },
      rotateCamera: (degrees: number) => {
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        if (!viewer || !Cesium) return;

        const scene = viewer.scene;
        let targetCartesian: any = null;
        try {
          const centerPos = new Cesium.Cartesian2(
            scene.canvas.clientWidth / 2,
            scene.canvas.clientHeight / 2
          );
          const ray = viewer.camera.getPickRay(centerPos);
          if (ray) {
            targetCartesian = scene.globe.pick(ray, scene);
          }
        } catch {}

        if (!targetCartesian) {
          const cLon = lastPlotCenterRef.current?.[0] ?? 74.3587;
          const cLat = lastPlotCenterRef.current?.[1] ?? 31.5204;
          targetCartesian = Cesium.Cartesian3.fromDegrees(cLon, cLat, 0);
        }

        const range = Cesium.Cartesian3.distance(viewer.camera.position, targetCartesian);
        const currentHeading = viewer.camera.heading;
        const currentPitch = viewer.camera.pitch;
        const newHeading = currentHeading + Cesium.Math.toRadians(degrees);

        const clampedPitch = Math.min(
          Math.max(currentPitch, Cesium.Math.toRadians(-89.5)),
          Cesium.Math.toRadians(-5)
        );

        const sphere = new Cesium.BoundingSphere(targetCartesian, 0);
        viewer.camera.flyToBoundingSphere(sphere, {
          offset: new Cesium.HeadingPitchRange(newHeading, clampedPitch, range),
          duration: 0.3,
        });
      },
      resetNorth: () => {
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        if (!viewer || !Cesium) return;

        const scene = viewer.scene;
        let targetCartesian: any = null;
        try {
          const centerPos = new Cesium.Cartesian2(
            scene.canvas.clientWidth / 2,
            scene.canvas.clientHeight / 2
          );
          const ray = viewer.camera.getPickRay(centerPos);
          if (ray) targetCartesian = scene.globe.pick(ray, scene);
        } catch {}

        if (targetCartesian) {
          const range = Cesium.Cartesian3.distance(viewer.camera.position, targetCartesian);
          const currentPitch = viewer.camera.pitch;
          const clampedPitch = Math.min(
            Math.max(currentPitch, Cesium.Math.toRadians(-89.5)),
            Cesium.Math.toRadians(-5)
          );
          const sphere = new Cesium.BoundingSphere(targetCartesian, 0);
          viewer.camera.flyToBoundingSphere(sphere, {
            offset: new Cesium.HeadingPitchRange(0, clampedPitch, range),
            duration: 0.5,
          });
        } else {
          const carto = viewer.camera.positionCartographic;
          if (!carto) return;
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height),
            orientation: {
              heading: 0,
              pitch: viewer.camera.pitch,
              roll: 0,
            },
            duration: 0.6,
          });
        }
      },
      setCameraView: (mode: "2d" | "3d", targetLng?: number, targetLat?: number) => {
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        if (!viewer || !Cesium) return;

        const cLon = targetLng ?? lastPlotCenterRef.current?.[0] ?? 74.3587;
        const cLat = targetLat ?? lastPlotCenterRef.current?.[1] ?? 31.5204;
        const targetCartesian = Cesium.Cartesian3.fromDegrees(cLon, cLat);
        const sphere = new Cesium.BoundingSphere(targetCartesian, 0);

        if (mode === "2d") {
          // Top-down CAD orthogonal view
          viewer.camera.flyToBoundingSphere(sphere, {
            offset: new Cesium.HeadingPitchRange(
              0,
              Cesium.Math.toRadians(-89.5),
              140.0
            ),
            duration: 1.2,
          });
        } else {
          // 3D architectural perspective view
          viewer.camera.flyToBoundingSphere(sphere, {
            offset: new Cesium.HeadingPitchRange(
              Cesium.Math.toRadians(25),
              Cesium.Math.toRadians(-32),
              95.0
            ),
            duration: 1.2,
          });
        }
      },
      setMapStyle: setMapStyleInternal,
      setPlotPolygon: setPlotPolygonInternal,
      clearPlot: clearPlotInternal,
      startDrawingPlot: startDrawingPlotInternal,
      finishDrawingPlot: finishDrawingPlotInternal,
      cancelDrawingPlot: stopDrawing,
      startPlotPlacement: startPlotPlacementInternal,
      cancelPlotPlacement: stopPlacing,
      loadGlbModel: loadGlbModelInternal,
      clearModel: clearModelInternal,
      toggleOrbit: (enabled?: boolean) => {
        const viewer = viewerRef.current;
        const Cesium = (window as any).Cesium;
        if (!viewer || !Cesium) return;

        if (orbitIntervalRef.current) {
          clearInterval(orbitIntervalRef.current);
          orbitIntervalRef.current = null;
          viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
          if (enabled === false) return;
        }

        if (enabled !== false) {
          const cLon = lastPlotCenterRef.current?.[0] ?? 74.3587;
          const cLat = lastPlotCenterRef.current?.[1] ?? 31.5204;
          const target = Cesium.Cartesian3.fromDegrees(cLon, cLat, 0);
          const transform = Cesium.Transforms.eastNorthUpToFixedFrame(target);

          let currentHeading = viewer.camera.heading;
          const pitch = Math.min(
            Math.max(viewer.camera.pitch, Cesium.Math.toRadians(-60)),
            Cesium.Math.toRadians(-15)
          );
          const range = Math.max(Cesium.Cartesian3.distance(viewer.camera.position, target), 30);

          orbitIntervalRef.current = window.setInterval(() => {
            currentHeading += 0.005;
            viewer.camera.lookAtTransform(
              transform,
              new Cesium.HeadingPitchRange(currentHeading, pitch, range)
            );
          }, 30);
        }
      },
      toggleShadows: () => {
        const viewer = viewerRef.current;
        if (!viewer) return false;
        viewer.shadows = !viewer.shadows;
        return viewer.shadows;
      },
      toggleMarkings: (visible?: boolean) => {
        const next = visible !== undefined ? visible : !showMarkingsRef.current;
        setMarkingsVisibleInternal(next);
        return next;
      },
      setMarkingsVisible: setMarkingsVisibleInternal,
      setBuildingRotation: setBuildingRotationInternal,
      rotateBuilding: rotateBuildingInternal,
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

          // Default: High-definition Google Hybrid Satellite (crystal clear, high zoom)
          let baseLayer: any = undefined;
          try {
            const googleProvider = new Cesium.UrlTemplateImageryProvider({
              url: "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
              subdomains: ["0", "1", "2", "3"],
              maximumLevel: 22,
            });
            baseLayer = new Cesium.ImageryLayer(googleProvider);
          } catch (e) {
            console.warn("Using OSM fallback:", e);
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

          if (hasValidToken) {
            try {
              viewerOptions.terrain = Cesium.Terrain.fromWorldTerrain();
            } catch {}
          }

          viewer = new Cesium.Viewer(containerRef.current, viewerOptions);
          viewerRef.current = viewer;

          // Force immediate resize to fill container bounds
          try {
            viewer.resize();
          } catch {}

          // ResizeObserver ensures canvas always matches 100% of container when layout reflows
          const resizeObserver = new ResizeObserver(() => {
            if (viewerRef.current && !viewerRef.current.isDestroyed()) {
              try {
                viewerRef.current.resize();
              } catch {}
            }
          });
          if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
          }

          const handleWindowResize = () => {
            if (viewerRef.current && !viewerRef.current.isDestroyed()) {
              try {
                viewerRef.current.resize();
              } catch {}
            }
          };
          window.addEventListener("resize", handleWindowResize);

          // Photorealistic architectural visual fidelity settings
          viewer.resolutionScale = Math.min(window.devicePixelRatio || 1.0, 2.0);
          viewer.scene.highDynamicRange = true; // HDR tone mapping for vivid PBR materials & glass reflections
          viewer.scene.globe.enableLighting = true; // Real-world solar illumination & dynamic building shading
          viewer.scene.globe.maximumScreenSpaceError = 1.0; // Load highest detail satellite tiles earlier
          viewer.scene.globe.tileCacheSize = 500;
          viewer.scene.globe.loadingDescendantLimit = 250;
          viewer.scene.postProcessStages.fxaa.enabled = true; // High-precision anti-aliasing

          // Crisp architectural shadow mapping
          viewer.shadows = true;
          if (viewer.shadowMap) {
            viewer.shadowMap.size = 2048;
            viewer.shadowMap.softShadows = true;
            viewer.shadowMap.darkness = 0.45;
          }

          // Ambient Occlusion for deep architectural contact shadows under eaves and sills
          try {
            if (viewer.scene.postProcessStages.ambientOcclusion) {
              viewer.scene.postProcessStages.ambientOcclusion.enabled = true;
              viewer.scene.postProcessStages.ambientOcclusion.uniforms.intensity = 2.0;
              viewer.scene.postProcessStages.ambientOcclusion.uniforms.bias = 0.1;
              viewer.scene.postProcessStages.ambientOcclusion.uniforms.lengthCap = 0.5;
            }
          } catch {}

          // Afternoon Pakistan sun angle (crisp directional facade shadows)
          try {
            const pkSunTime = Cesium.JulianDate.fromIso8601("2026-03-21T09:30:00Z");
            viewer.clock.currentTime = pkSunTime;
            viewer.clock.shouldAnimate = false;
          } catch {}

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
            destination: Cesium.Cartesian3.fromDegrees(74.3587, 31.5204, 3000),
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

          // Also trigger resize shortly after ready to catch any final layout transitions
          setTimeout(() => {
            if (viewerRef.current && !viewerRef.current.isDestroyed()) {
              try {
                viewerRef.current.resize();
              } catch {}
            }
          }, 200);
        } catch (err) {
          console.error("Failed to initialize Cesium:", err);
          setError(err instanceof Error ? err.message : "Failed to load 3D globe");
          setIsLoading(false);
        }
      };

      initCesium();

      return () => {
        stopDrawing();
        stopPlacing();
        clearModelInternal();
        window.removeEventListener("resize", () => {});
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

        {/* In-Globe Placement Status Banner */}
        {isPlacing && (
          <div className="globe-notification-banner">
            <span className="banner-text">
              📍 <strong>Click anywhere on the map</strong> to place your plot
            </span>
            <button
              onClick={stopPlacing}
              className="banner-cancel-btn"
              title="Cancel plot placement"
            >
              Cancel ✕
            </button>
          </div>
        )}

        {/* In-Globe Drawing Status Banner */}
        {isDrawing && (
          <div className="globe-notification-banner drawing">
            <span className="banner-text">
              ✏️ <strong>Click map to place corners</strong> ({drawingPoints.length} points) • Double-click to finish
            </span>
            <div className="banner-actions">
              <button
                onClick={finishDrawingPlotInternal}
                disabled={drawingPoints.length < 3}
                className="banner-complete-btn"
                title={drawingPoints.length < 3 ? "Click at least 3 points on the map first" : "Complete and confirm plot shape"}
              >
                ✓ Complete OK
              </button>
              <button
                onClick={stopDrawing}
                className="banner-cancel-btn"
                title="Cancel drawing"
              >
                Cancel ✕
              </button>
            </div>
          </div>
        )}

        <div
          ref={containerRef}
          className="cesium-viewer-container"
          style={{ cursor: isDrawing || isPlacing ? "crosshair" : "default" }}
        />
      </div>
    );
  }
);

CesiumGlobe.displayName = "CesiumGlobe";
export default CesiumGlobe;

