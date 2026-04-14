"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Document } from "react-pdf";
import { PDFDocument } from "pdf-lib";
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  FileText,
  Upload,
  Trash2,
  AlertCircle,
  Layers,
} from "lucide-react";
import type { ISignatureZone, IPageDimensions } from "@/types";
import { SigningCanvas } from "./SigningCanvas";

interface SigningViewerProps {
  file: File;
  zones: ISignatureZone[];
  selectedZoneId: string | null;
  maxZones?: number;
  onZonesChange: (zones: ISignatureZone[]) => void;
  onSelectZone: (id: string | null) => void;
  onRemoveFile: () => void;
}

export function SigningViewer({
  file,
  zones,
  selectedZoneId,
  maxZones = 1,
  onZonesChange,
  onSelectZone,
  onRemoveFile,
}: SigningViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pageDimensions, setPageDimensions] = useState<Record<number, IPageDimensions>>({});
  const [, setFileData] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Canvas viewport
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Load file buffer + page dimensions
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!e.target?.result) return;
      const buffer = e.target.result as ArrayBuffer;
      setFileData(buffer);
      try {
        const pdfDoc = await PDFDocument.load(buffer);
        const pages = pdfDoc.getPages();
        const dims: Record<number, IPageDimensions> = {};
        pages.forEach((p, idx) => {
          dims[idx + 1] = { width: p.getWidth(), height: p.getHeight() };
        });
        setPageDimensions(dims);
      } catch {
        setError("Could not read PDF dimensions.");
      }
    };
    reader.readAsArrayBuffer(file);

    return () => {
      setFileData(null);
      setPageDimensions({});
      setNumPages(0);
      setPageNumber(1);
      setPan({ x: 0, y: 0 });
      setScale(1.0);
    };
  }, [file]);

  // Keyboard: delete zone, space pan
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedZoneId) {
        onZonesChange(zones.filter((z) => z.id !== selectedZoneId));
        onSelectZone(null);
      }
      if (e.code === "Space" && !e.repeat) {
        setIsSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
        setIsDraggingCanvas(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectedZoneId, zones, onZonesChange, onSelectZone]);

  // Wheel pan (trackpad)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) return;
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const handleAddZone = useCallback(
    (zone: ISignatureZone) => {
      onZonesChange([...zones, zone]);
      onSelectZone(zone.id);
    },
    [zones, onZonesChange, onSelectZone]
  );

  const handleUpdateZone = useCallback(
    (id: string, patch: Partial<ISignatureZone>) => {
      onZonesChange(zones.map((z) => (z.id === id ? { ...z, ...patch } : z)));
    },
    [zones, onZonesChange]
  );

  const handleDeleteZone = useCallback(
    (id: string) => {
      onZonesChange(zones.filter((z) => z.id !== id));
      if (selectedZoneId === id) onSelectZone(null);
    },
    [zones, selectedZoneId, onZonesChange, onSelectZone]
  );

  // Canvas panning mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSpacePressed || e.button === 1) {
      e.preventDefault();
      setIsDraggingCanvas(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    } else {
      onSelectZone(null);
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas && dragStartRef.current) {
      setPan((p) => ({
        x: p.x + (e.clientX - dragStartRef.current!.x),
        y: p.y + (e.clientY - dragStartRef.current!.y),
      }));
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };
  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    dragStartRef.current = null;
  };

  const changePage = (offset: number) =>
    setPageNumber((p) => Math.min(Math.max(1, p + offset), numPages));

  const zonesOnPage = zones.filter((z) => z.pageIndex === pageNumber).length;

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-2xl border border-stone-200/60 bg-white/50 backdrop-blur-md shadow-sm">
      {/* Toolbar */}
      <header
        className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/50 bg-white/80 px-3 py-2 backdrop-blur-sm sm:px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: file + zoom */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <FileText className="size-4 shrink-0 text-olive-600" />
            <span className="truncate text-xs font-medium text-stone-700 max-w-32 sm:max-w-48">
              {file.name}
            </span>
            <button
              onClick={onRemoveFile}
              className="shrink-0 rounded-md p-1 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
              title="Remove file"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>

          <div className="hidden h-5 w-px bg-stone-200 sm:block" />

          <div className="flex items-center rounded-lg border border-stone-200 bg-stone-50/80 p-0.5">
            <button
              onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
              className="rounded-md p-1.5 text-stone-500 transition-colors hover:bg-white hover:text-stone-700"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="w-12 text-center text-[11px] font-mono text-stone-600">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(3.0, s + 0.15))}
              className="rounded-md p-1.5 text-stone-500 transition-colors hover:bg-white hover:text-stone-700"
            >
              <ZoomIn className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Center: pages */}
        <div className="flex items-center gap-1">
          {numPages > 0 && (
            <div className="flex items-center rounded-lg border border-stone-200 bg-stone-50/80 p-0.5">
              <button
                onClick={() => changePage(-1)}
                disabled={pageNumber <= 1}
                className="rounded-md p-1.5 text-stone-500 transition-colors hover:bg-white hover:text-stone-700 disabled:opacity-30"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="px-2 text-[11px] font-medium text-stone-600">
                {pageNumber} / {numPages}
              </span>
              <button
                onClick={() => changePage(1)}
                disabled={pageNumber >= numPages}
                className="rounded-md p-1.5 text-stone-500 transition-colors hover:bg-white hover:text-stone-700 disabled:opacity-30"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right: zone count + reset */}
        <div className="flex items-center gap-2">
          {zones.length > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-olive-50 px-2 py-1 text-[10px] font-medium text-olive-700">
              <Layers className="size-3" />
              {zonesOnPage} on page · {zones.length} total
            </div>
          )}
          <button
            onClick={() => {
              setPan({ x: 0, y: 0 });
              setScale(1.0);
            }}
            className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            title="Reset view"
          >
            <RotateCcw className="size-3.5" />
          </button>

          {error && (
            <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] text-red-600">
              <AlertCircle className="size-3" />
              {error}
            </div>
          )}
        </div>
      </header>

      {/* Pan hint (mobile) */}
      <div className="flex items-center justify-center gap-2 border-b border-stone-100 bg-olive-50/50 px-3 py-1 text-[10px] text-olive-700 sm:hidden">
        <Upload className="size-3 rotate-180" />
        Scroll to pan · Pinch to zoom
      </div>

      {/* Viewport */}
      <div
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative flex-1 overflow-hidden bg-stone-100/60
          ${isSpacePressed || isDraggingCanvas ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        style={{
          backgroundImage: "radial-gradient(circle, #d6d3d1 0.8px, transparent 0.8px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div className="flex h-full items-center justify-center">
          <div
            className="transition-transform duration-75 ease-linear will-change-transform"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
          >
            <Document
              file={file}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-white/80 p-16 backdrop-blur-sm">
                  <div className="size-7 animate-spin rounded-full border-[3px] border-olive-200 border-t-olive-600" />
                  <p className="text-xs text-stone-500">Loading PDF…</p>
                </div>
              }
              error={
                <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50/80 p-10 text-sm text-red-600">
                  <AlertCircle className="size-5" />
                  Error loading PDF. Please try another file.
                </div>
              }
            >
              <div className="rounded-sm bg-white shadow-2xl ring-1 ring-stone-200/50">
                <SigningCanvas
                  pageNumber={pageNumber}
                  scale={scale}
                  zones={zones}
                  pageDimensions={pageDimensions[pageNumber] ?? null}
                  selectedId={selectedZoneId}
                  isPanning={isSpacePressed || isDraggingCanvas}
                  maxZones={maxZones}
                  onAddZone={handleAddZone}
                  onSelectZone={onSelectZone}
                  onUpdateZone={handleUpdateZone}
                  onDeleteZone={handleDeleteZone}
                  onPageLoadSuccess={() => {}}
                />
              </div>
            </Document>
          </div>
        </div>
      </div>
    </div>
  );
}
