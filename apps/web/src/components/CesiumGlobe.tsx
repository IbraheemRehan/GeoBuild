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

export type MapStyleKey = "google_satellite" | "streets" | "blueprint" | "studio";

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

const MAP_STYLES: Record<
  Exclude<MapStyleKey, "studio">,
  { name: string; url: string; maxLevel: number }
> = {
  google_satellite: {
    name: "HD Satellite",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    maxLevel: 21,
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
          });
          viewer.imageryLayers.addImageryProvider(provider);
        }
      }
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
        // 4. Edge dimension labels (feet & metres)
        edgeLabelEntitiesRef.current.forEach((e) => viewer.entities.remove(e));
        edgeLabelEntitiesRef.current = [];

        for (let i = 0; i < coords.length; i++) {
          const p1 = coords[i];
          const p2 = coords[(i + 1) % coords.length];
          const c1 = Cesium.Cartesian3.fromDegrees(p1[0], p1[1], 0);
          const c2 = Cesium.Cartesian3.fromDegrees(p2[0], p2[1], 0);
          const distM = Cesium.Cartesian3.distance(c1, c2);
          const distFt = distM * 3.28084;

          const midLon = (p1[0] + p2[0]) / 2;
          const midLat = (p1[1] + p2[1]) / 2;
          const edgeTag = viewer.entities.add({
            name: `Edge ${i + 1} Dimension`,
            position: Cesium.Cartesian3.fromDegrees(midLon, midLat, 0.4),
            label: {
              text: `${distFt.toFixed(1)} ft (${distM.toFixed(1)}m)`,
              font: "bold 11px 'Inter', sans-serif",
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              fillColor: Cesium.Color.fromCssColorString("#f1f5f9"),
              outlineColor: Cesium.Color.fromCssColorString("#090d16"),
              outlineWidth: 3,
              backgroundColor: Cesium.Color.fromCssColorString("rgba(15, 23, 42, 0.75)"),
              showBackground: true,
              backgroundPadding: new Cesium.Cartesian2(6, 3),
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
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
            position: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, 0.5),
            label: {
              text: `📐 ${label}`,
              font: "bold 13px 'Outfit', sans-serif",
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              fillColor: Cesium.Color.fromCssColorString("#38bdf8"),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              backgroundColor: Cesium.Color.fromCssColorString("rgba(15, 23, 42, 0.85)"),
              showBackground: true,
              backgroundPadding: new Cesium.Cartesian2(8, 4),
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
            Cesium.Math.toRadians(28),
            Cesium.Math.toRadians(-26),
            55.0
          ),
          duration: 2.2,
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
        if (activePointsRef.current.length >= 3) {
          const finalCoords = [...activePointsRef.current];
          stopDrawing();
          setPlotPolygonInternal(finalCoords, "Custom Plot");
          onPlotDrawn?.(finalCoords);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }, [clearPlotInternal, onDrawingChange, onPlotDrawn, setPlotPolygonInternal, stopDrawing, stopPlacing]);

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

        if (mode === "2d") {
          // Orthographic top-down CAD view
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(cLon, cLat, 160),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-90),
              roll: 0,
            },
            duration: 1.5,
          });
        } else {
          // 3D architectural perspective view
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(cLon, cLat, 80),
            orientation: {
              heading: Cesium.Math.toRadians(25),
              pitch: Cesium.Math.toRadians(-30),
              roll: 0,
            },
            duration: 1.5,
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
              url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
              maximumLevel: 21,
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

          // Razor-sharp clarity settings for high-DPI displays & satellite zoom
          viewer.resolutionScale = Math.min(window.devicePixelRatio || 1.0, 2.0);
          viewer.scene.globe.maximumScreenSpaceError = 1.33; // Load higher detail tiles earlier
          viewer.scene.globe.tileCacheSize = 250;
          viewer.scene.postProcessStages.fxaa.enabled = true; // Smooth anti-aliasing

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
          <div
            style={{
              position: "absolute",
              top: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 350,
              background: "rgba(17, 24, 39, 0.92)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
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
              📍 <strong>Click anywhere on the map</strong> to place your plot
            </span>
            <button
              onClick={stopPlacing}
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
          style={{ cursor: isDrawing || isPlacing ? "crosshair" : "default" }}
        />
      </div>
    );
  }
);

CesiumGlobe.displayName = "CesiumGlobe";
export default CesiumGlobe;

