"use client";

import type { ISignatureZone, IPageDimensions } from "@/types";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Page, pdfjs } from "react-pdf";
import { X, PenLine } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SigningCanvasProps {
  pageNumber: number;
  scale: number;
  zones: ISignatureZone[];
  pageDimensions: IPageDimensions | null;
  selectedId: string | null;
  isPanning: boolean;
  maxZones?: number;
  onAddZone: (zone: ISignatureZone) => void;
  onSelectZone: (id: string | null) => void;
  onUpdateZone: (id: string, patch: Partial<ISignatureZone>) => void;
  onDeleteZone: (id: string) => void;
  onPageLoadSuccess: (page: { width: number; height: number }) => void;
}

const DEFAULT_ZONE_W = 180;
const DEFAULT_ZONE_H = 60;

export function SigningCanvas({
  pageNumber,
  scale,
  zones,
  pageDimensions,
  selectedId,
  isPanning,
  maxZones = 1,
  onAddZone,
  onSelectZone,
  onUpdateZone,
  onDeleteZone,
  onPageLoadSuccess,
}: SigningCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const lastDragEndTime = useRef<number>(0);

  // Drag state for moving zones
  const [dragState, setDragState] = useState<{
    id: string;
    startX: number;
    startY: number;
    initialDisplayX: number;
    initialDisplayY: number;
  } | null>(null);

  // Resize state
  const [resizeState, setResizeState] = useState<{
    id: string;
    startX: number;
    startY: number;
    initialW: number;
    initialH: number;
    edge: string;
  } | null>(null);

  const pageZones = zones.filter((z) => z.pageIndex === pageNumber);

  // Move drag via window listeners
  useEffect(() => {
    if (!dragState) return;
    const handleMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragState.startX) / scale;
      const dy = (e.clientY - dragState.startY) / scale;
      let newDisplayX = dragState.initialDisplayX + dx;
      let newDisplayY = dragState.initialDisplayY + dy;

      if (pageDimensions) {
        const zone = zones.find((z) => z.id === dragState.id);
        if (zone) {
          newDisplayX = Math.max(0, Math.min(newDisplayX, pageDimensions.width - zone.width));
          newDisplayY = Math.max(0, Math.min(newDisplayY, pageDimensions.height - zone.height));
        }
      }

      // PDF bottom-left Y = pageHeight - displayY - zoneHeight
      const zone = zones.find((z) => z.id === dragState.id);
      const zoneH = zone?.height ?? DEFAULT_ZONE_H;
      const pdfY = pageDimensions ? pageDimensions.height - newDisplayY - zoneH : newDisplayY;
      onUpdateZone(dragState.id, { displayX: newDisplayX, displayY: newDisplayY, x: newDisplayX, y: pdfY });
    };
    const handleUp = () => {
      setDragState(null);
      lastDragEndTime.current = Date.now();
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragState, scale, pageDimensions, zones, onUpdateZone]);

  // Resize via window listeners
  useEffect(() => {
    if (!resizeState) return;
    const handleMove = (e: MouseEvent) => {
      const dx = (e.clientX - resizeState.startX) / scale;
      const dy = (e.clientY - resizeState.startY) / scale;
      let newW = Math.max(80, resizeState.initialW + dx);
      let newH = Math.max(30, resizeState.initialH + dy);

      if (pageDimensions) {
        const zone = zones.find((z) => z.id === resizeState.id);
        if (zone) {
          newW = Math.min(newW, pageDimensions.width - zone.displayX);
          newH = Math.min(newH, pageDimensions.height - zone.displayY);
        }
      }

      // Recalculate PDF Y since height changed: y = pageHeight - displayY - newHeight
      const zone = zones.find((z) => z.id === resizeState.id);
      const displayY = zone?.displayY ?? 0;
      const pdfY = pageDimensions ? pageDimensions.height - displayY - newH : displayY;
      onUpdateZone(resizeState.id, { width: newW, height: newH, y: pdfY });
    };
    const handleUp = () => {
      setResizeState(null);
      lastDragEndTime.current = Date.now();
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [resizeState, scale, pageDimensions, zones, onUpdateZone]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPanning) return;
      if (Date.now() - lastDragEndTime.current < 150) return;
      if (!containerRef.current) return;
      // Enforce max zones limit — if reached, don't add more
      if (zones.length >= maxZones) return;

      const rect = containerRef.current.getBoundingClientRect();
      const displayX = (e.clientX - rect.left) / scale;
      const displayY = (e.clientY - rect.top) / scale;
      const pageH = pageDimensions?.height ?? rect.height / scale;
      const pageW = pageDimensions?.width ?? rect.width / scale;

      // Center the zone on click, clamped to page
      const zoneX = Math.max(0, Math.min(displayX - DEFAULT_ZONE_W / 2, pageW - DEFAULT_ZONE_W));
      const zoneY = Math.max(0, Math.min(displayY - DEFAULT_ZONE_H / 2, pageH - DEFAULT_ZONE_H));
      // PDF uses bottom-left origin: convert display top-left Y to PDF bottom-left Y
      const pdfY = pageH - zoneY - DEFAULT_ZONE_H;

      const newZone: ISignatureZone = {
        id: crypto.randomUUID(),
        pageIndex: pageNumber,
        x: zoneX,
        y: pdfY,
        width: DEFAULT_ZONE_W,
        height: DEFAULT_ZONE_H,
        displayX: zoneX,
        displayY: zoneY,
      };
      onAddZone(newZone);
    },
    [pageNumber, scale, pageDimensions, isPanning, onAddZone, zones.length, maxZones]
  );

  const handleZoneMouseDown = (e: React.MouseEvent, zone: ISignatureZone) => {
    e.stopPropagation();
    if (isPanning) return;
    onSelectZone(zone.id);
    setDragState({
      id: zone.id,
      startX: e.clientX,
      startY: e.clientY,
      initialDisplayX: zone.displayX,
      initialDisplayY: zone.displayY,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, zone: ISignatureZone) => {
    e.stopPropagation();
    if (isPanning) return;
    onSelectZone(zone.id);
    setResizeState({
      id: zone.id,
      startX: e.clientX,
      startY: e.clientY,
      initialW: zone.width,
      initialH: zone.height,
      edge: "se",
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning || dragState || resizeState) {
      setHoverPos(null);
      return;
    }
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // Use a pen cursor SVG for signing mode
  const penCursorSvg = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23556B2F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>')}`;

  let cursorStyle = zones.length >= maxZones ? "cursor-default" : "";
  const customCursor = zones.length < maxZones && !dragState && !resizeState && !isPanning
    ? { cursor: `url("${penCursorSvg}") 2 22, crosshair` }
    : undefined;
  if (dragState) cursorStyle = "cursor-grabbing";
  else if (resizeState) cursorStyle = "cursor-se-resize";
  else if (isPanning) cursorStyle = "cursor-grab";

  return (
    <div
      ref={containerRef}
      className={`relative inline-block shadow-xl select-none leading-none ${cursorStyle}`}
      style={customCursor}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverPos(null)}
    >
      <Page
        pageNumber={pageNumber}
        scale={scale}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        onLoadSuccess={onPageLoadSuccess}
        className="pdf-page-container block"
      />

      {/* Hover guide */}
      {hoverPos && !dragState && !resizeState && !isPanning && zones.length < maxZones && (
        <div
          className="pointer-events-none absolute z-50"
          style={{ left: hoverPos.x, top: hoverPos.y }}
        >
          <div className="ml-4 mt-4 rounded-lg bg-olive-800/90 px-2.5 py-1.5 text-[10px] font-medium text-white shadow-lg backdrop-blur-sm whitespace-nowrap">
            Click to place signing spot
          </div>
        </div>
      )}

      {/* Signature zones */}
      {pageZones.map((zone) => {
        const isSelected = selectedId === zone.id;
        const isDragging = dragState?.id === zone.id;
        const isResizing = resizeState?.id === zone.id;

        return (
          <div
            key={zone.id}
            onMouseDown={(e) => handleZoneMouseDown(e, zone)}
            onClick={(e) => e.stopPropagation()}
            className={`absolute z-10 group rounded-lg border-2 border-dashed transition-colors
              ${isSelected || isDragging
                ? "border-olive-500 bg-olive-500/15 shadow-lg shadow-olive-500/10"
                : "border-olive-400/50 bg-olive-500/8 hover:border-olive-500 hover:bg-olive-500/12"
              }
              ${isDragging ? "cursor-grabbing" : isPanning ? "cursor-grab" : "cursor-move"}
            `}
            style={{
              left: zone.displayX * scale,
              top: zone.displayY * scale,
              width: zone.width * scale,
              height: zone.height * scale,
              transition: isDragging || isResizing ? "none" : "border-color 0.2s, background-color 0.2s",
            }}
          >
            {/* Label */}
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 pointer-events-none">
              <PenLine className="size-3.5 text-olive-600/60" />
              <span className="text-[11px] font-medium text-olive-700/70 select-none">
                Signature Zone
              </span>
            </div>

            {/* Delete button */}
            {isSelected && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteZone(zone.id);
                }}
                className="absolute -right-2.5 -top-2.5 z-20 flex size-5 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-transform hover:scale-110"
              >
                <X className="size-3" />
              </button>
            )}

            {/* Resize handle */}
            {isSelected && (
              <div
                onMouseDown={(e) => handleResizeMouseDown(e, zone)}
                className="absolute -bottom-1.5 -right-1.5 z-20 size-3 cursor-se-resize rounded-sm border-2 border-olive-500 bg-white shadow-sm"
              />
            )}

            {/* Page label */}
            <div className="absolute -top-5 left-0 text-[9px] font-medium text-olive-600/60 pointer-events-none">
              Page {zone.pageIndex}
            </div>
          </div>
        );
      })}
    </div>
  );
}
