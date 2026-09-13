import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Map, useMap } from "@vis.gl/react-google-maps";
import { TerraDraw, TerraDrawPolygonMode, TerraDrawRenderMode, TerraDrawSelectMode } from "terra-draw";
import { TerraDrawGoogleMapsAdapter } from "terra-draw-google-maps-adapter";
import { Crosshair, Layers, Loader2, MousePointerClick, Pencil, PenLine, Search, Trash2, X } from "lucide-react";
import { boundsFromCoordinates, DEFAULT_ZOOM, DEHRADUN_CENTER, GOOGLE_MAP_ID, searchLocation } from "../services/maps";
import { latLngsToRing, ringToLatLngs } from "../services/parcel";
import type { LatLng } from "../types";

export type DrawMode = "idle" | "drawing" | "editing";

export type ParcelMapHandle = {
  startDrawing: () => void;
  startEditing: () => void;
  finishEditing: () => void;
  deleteParcel: () => void;
  showParcel: (coordinates: LatLng[]) => void;
};

type Props = {
  ref?: Ref<ParcelMapHandle>;
  hasParcel: boolean;
  mode: DrawMode;
  onModeChange: (mode: DrawMode) => void;
  onShapeComplete: (coordinates: LatLng[], edited: boolean) => void;
  onShapeCleared: () => void;
  onNotice: (message: string) => void;
};

const MAP_ELEMENT_ID = "nn-main-map";
const GREEN = "#34A853";
const DEEP_GREEN = "#176B45";
const WHITE = "#FFFFFF";

function createDraw(map: google.maps.Map) {
  const adapter = new TerraDrawGoogleMapsAdapter({ lib: google.maps, map, coordinatePrecision: 9 });
  return new TerraDraw({
    adapter,
    modes: [
      new TerraDrawRenderMode({
        modeName: "idle",
        styles: { polygonFillColor: GREEN, polygonFillOpacity: 0.22, polygonOutlineColor: DEEP_GREEN, polygonOutlineWidth: 3 },
      }),
      new TerraDrawPolygonMode({
        styles: {
          fillColor: GREEN,
          fillOpacity: 0.22,
          outlineColor: DEEP_GREEN,
          outlineWidth: 3,
          closingPointColor: WHITE,
          closingPointOutlineColor: DEEP_GREEN,
          closingPointWidth: 6,
          closingPointOutlineWidth: 3,
        },
      }),
      new TerraDrawSelectMode({
        flags: {
          polygon: {
            feature: {
              draggable: true,
              coordinates: { midpoints: true, draggable: true, deletable: true },
            },
          },
        },
        styles: {
          selectedPolygonColor: GREEN,
          selectedPolygonFillOpacity: 0.3,
          selectedPolygonOutlineColor: DEEP_GREEN,
          selectedPolygonOutlineWidth: 3,
          selectionPointColor: WHITE,
          selectionPointOutlineColor: DEEP_GREEN,
          selectionPointWidth: 6,
          selectionPointOutlineWidth: 3,
          midPointColor: GREEN,
          midPointOutlineColor: WHITE,
          midPointWidth: 4,
          midPointOutlineWidth: 2,
        },
      }),
    ],
  });
}

export function ParcelMap({ ref, hasParcel, mode, onModeChange, onShapeComplete, onShapeCleared, onNotice }: Props) {
  const map = useMap(MAP_ELEMENT_ID);
  const drawRef = useRef<TerraDraw | null>(null);
  const pendingRef = useRef<LatLng[] | null>(null);
  const [ready, setReady] = useState(false);
  const [mapType, setMapType] = useState<"hybrid" | "roadmap">("hybrid");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  // Keep latest callbacks without re-creating the Terra Draw instance.
  const callbacks = useRef({ onModeChange, onShapeComplete, onShapeCleared, onNotice });
  callbacks.current = { onModeChange, onShapeComplete, onShapeCleared, onNotice };

  const polygonIds = useCallback(() => {
    const draw = drawRef.current;
    return draw ? draw.getSnapshot().filter((f) => f.geometry.type === "Polygon").map((f) => f.id!) : [];
  }, []);

  const fitTo = useCallback(
    (coordinates: LatLng[]) => {
      if (!map || !coordinates.length) return;
      map.fitBounds(boundsFromCoordinates(coordinates), 120);
    },
    [map],
  );

  const renderParcel = useCallback(
    (coordinates: LatLng[]) => {
      const draw = drawRef.current;
      if (!draw) return;
      draw.setMode("idle");
      draw.clear();
      const [result] = draw.addFeatures([
        {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [latLngsToRing(coordinates)] },
          properties: { mode: "polygon" },
        },
      ]);
      if (!result?.valid) callbacks.current.onNotice("Please draw a closed parcel boundary.");
      callbacks.current.onModeChange("idle");
      fitTo(coordinates);
    },
    [fitTo],
  );

  // Terra Draw lifecycle — one instance per map.
  useEffect(() => {
    if (!map) return;
    const draw = createDraw(map);
    drawRef.current = draw;

    draw.on("ready", () => {
      draw.setMode("idle");
      setReady(true);
      if (pendingRef.current) {
        renderParcel(pendingRef.current);
        pendingRef.current = null;
      }
    });

    draw.on("finish", (id, context) => {
      const feature = draw.getSnapshotFeature(id);
      if (!feature || feature.geometry.type !== "Polygon") return;

      if (context.mode === "polygon") {
        // One parcel at a time — drop any previous boundary.
        const stale = draw.getSnapshot().filter((f) => f.id !== id).map((f) => f.id!);
        if (stale.length) draw.removeFeatures(stale);
        draw.setMode("idle");
        callbacks.current.onModeChange("idle");
      }
      callbacks.current.onShapeComplete(ringToLatLngs(feature.geometry.coordinates[0] as number[][]), context.mode !== "polygon");
    });

    draw.start();

    return () => {
      try {
        draw.stop();
      } catch {
        /* map already torn down */
      }
      drawRef.current = null;
      setReady(false);
    };
  }, [map, renderParcel]);

  const startDrawing = useCallback(() => {
    const draw = drawRef.current;
    if (!draw || !ready) {
      callbacks.current.onNotice("Map is still loading — try again in a moment.");
      return;
    }
    draw.clear();
    draw.setMode("polygon");
    callbacks.current.onShapeCleared();
    callbacks.current.onModeChange("drawing");
  }, [ready]);

  const startEditing = useCallback(() => {
    const draw = drawRef.current;
    const [id] = polygonIds();
    if (!draw || id === undefined) return;
    draw.setMode("select");
    draw.selectFeature(id);
    callbacks.current.onModeChange("editing");
  }, [polygonIds]);

  const finishEditing = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    draw.setMode("idle");
    callbacks.current.onModeChange("idle");
  }, []);

  const deleteParcel = useCallback(() => {
    const draw = drawRef.current;
    if (draw) {
      draw.clear();
      draw.setMode("idle");
    }
    callbacks.current.onModeChange("idle");
    callbacks.current.onShapeCleared();
  }, []);

  const cancelDrawing = useCallback(() => {
    drawRef.current?.clear();
    drawRef.current?.setMode("idle");
    callbacks.current.onModeChange("idle");
  }, []);

  const showParcel = useCallback(
    (coordinates: LatLng[]) => {
      if (drawRef.current && ready) renderParcel(coordinates);
      else pendingRef.current = coordinates;
    },
    [ready, renderParcel],
  );

  useImperativeHandle(ref, () => ({ startDrawing, startEditing, finishEditing, deleteParcel, showParcel }), [
    startDrawing,
    startEditing,
    finishEditing,
    deleteParcel,
    showParcel,
  ]);

  const recenter = () => {
    if (!map) return;
    const [id] = polygonIds();
    const feature = id !== undefined ? drawRef.current?.getSnapshotFeature(id) : undefined;
    if (feature?.geometry.type === "Polygon") fitTo(ringToLatLngs(feature.geometry.coordinates[0] as number[][]));
    else {
      map.panTo(DEHRADUN_CENTER);
      map.setZoom(DEFAULT_ZOOM);
    }
  };

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !map) return;
    setSearching(true);
    const result = await searchLocation(query);
    setSearching(false);
    if (!result) {
      callbacks.current.onNotice("Location not found. Try a more specific place name.");
      return;
    }
    setQuery(result.label);
    if (result.viewport) map.fitBounds(result.viewport);
    else {
      map.panTo(result.location);
      map.setZoom(17);
    }
  };

  return (
    <div className="map-shell">
      <Map
        id={MAP_ELEMENT_ID}
        mapId={GOOGLE_MAP_ID}
        defaultCenter={DEHRADUN_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        mapTypeId={mapType}
        gestureHandling="greedy"
        disableDoubleClickZoom
        clickableIcons={false}
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={false}
        zoomControl
        className="map-canvas"
      />

      <form className="map-search card-float" onSubmit={onSearch} role="search">
        <Search size={18} aria-hidden />
        <label htmlFor="map-search" className="sr-only">
          Search a location
        </label>
        <input
          id="map-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a location…"
          autoComplete="off"
        />
        {query && !searching && (
          <button type="button" className="icon-btn ghost" aria-label="Clear search" onClick={() => setQuery("")}>
            <X size={16} />
          </button>
        )}
        {searching && <Loader2 size={16} className="spin" aria-label="Searching" />}
      </form>

      <div className="map-toolbar card-float" role="toolbar" aria-label="Parcel drawing tools">
        <ToolButton label="Draw parcel" active={mode === "drawing"} onClick={startDrawing} icon={<PenLine size={18} />} />
        <ToolButton
          label={mode === "editing" ? "Finish editing" : "Edit boundary"}
          active={mode === "editing"}
          disabled={!hasParcel}
          onClick={mode === "editing" ? finishEditing : startEditing}
          icon={<Pencil size={18} />}
        />
        <ToolButton label="Delete parcel" disabled={!hasParcel && mode !== "drawing"} onClick={deleteParcel} icon={<Trash2 size={18} />} />
        <span className="toolbar-sep" aria-hidden />
        <ToolButton label="Recenter" onClick={recenter} icon={<Crosshair size={18} />} />
        <ToolButton
          label={mapType === "hybrid" ? "Show road map" : "Show satellite"}
          onClick={() => setMapType((t) => (t === "hybrid" ? "roadmap" : "hybrid"))}
          icon={<Layers size={18} />}
        />
      </div>

      {mode === "drawing" && (
        <div className="map-hint card-float hint-active" role="status">
          <span className="pulse-dot" aria-hidden />
          <div>
            <strong>Click around the land boundary, then close the polygon.</strong>
            <span>Click the first point again to finish.</span>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={cancelDrawing}>
            Cancel
          </button>
        </div>
      )}

      {mode === "editing" && (
        <div className="map-hint card-float hint-active" role="status">
          <span className="pulse-dot" aria-hidden />
          <div>
            <strong>Drag corners to adjust the boundary.</strong>
            <span>Drag the small midpoints to add a corner.</span>
          </div>
          <button type="button" className="btn btn-sm btn-primary" onClick={finishEditing}>
            Done
          </button>
        </div>
      )}

      {mode === "idle" && !hasParcel && (
        <div className="map-hint card-float" role="note">
          <span className="hint-icon" aria-hidden>
            <MousePointerClick size={16} />
          </span>
          <div>
            <strong>Draw your land parcel to begin.</strong>
            <span>Use the polygon tool to mark the property boundary.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolButton({
  label,
  icon,
  onClick,
  active,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`tool-btn${active ? " is-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
