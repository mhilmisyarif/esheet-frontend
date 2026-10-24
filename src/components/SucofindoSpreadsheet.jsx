// src/components/SucofindoSpreadsheet.jsx
//
// Unified Lightweight Spreadsheet Editor (PT SUCOFINDO - Lab Teknik)
// Directly implements the design from the user's mockup:
// - Top Toolbar: Undo/Redo, + Baris -, + Kolom -, Merge, Bold, Italic, Alignment, Warna Sel, Rumus Cepat
// - Formula Bar (fx) with coordinate display (A1, B2...)
// - Grid canvas with cell merges, formula calculations, and technician access locks

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FiRotateCcw,
  FiRotateCw,
  FiPlus,
  FiMinus,
  FiLayers,
  FiBold,
  FiItalic,
  FiAlignLeft,
  FiAlignCenter,
  FiAlignRight,
  FiLock,
  FiUnlock,
  FiCheckCircle,
} from "react-icons/fi";
import {
  MdVerticalAlignTop,
  MdVerticalAlignCenter,
  MdVerticalAlignBottom,
  MdTextRotationNone,
  MdTextRotateVertical,
} from "react-icons/md";
import {
  toCellKey,
  fromCellKey,
  toCellName,
  fromCellName,
  evaluateAllCells,
  createDefaultSpreadsheetGrid,
} from "../utils/spreadsheetEngine";
import { indexToColLetter } from "../utils/tableFormulas";

const COLOR_PALETTE = [
  { name: "Putih", bg: "#FFFFFF", border: "#E2E8F0" },
  { name: "Biru", bg: "#EFF6FF", border: "#BFDBFE" },
  { name: "Hijau", bg: "#DCFCE7", border: "#86EFAC" },
  { name: "Kuning", bg: "#FEF9C3", border: "#FDE047" },
  { name: "Merah", bg: "#FEE2E2", border: "#FCA5A5" },
];

export default function SucofindoSpreadsheet({
  initialGrid,
  onChange,
  readOnly = false,
  technicianMode = false, // If true: only editable cells can be modified
}) {
  const [grid, setGrid] = useState(() => {
    const base = initialGrid || createDefaultSpreadsheetGrid();
    return {
      ...base,
      cells: evaluateAllCells(base.cells || {}),
    };
  });

  const [activeCell, setActiveCell] = useState({ r: 0, c: 0 });
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState(null); // { r, c }
  const [selectedRange, setSelectedRange] = useState(null); // { r1, c1, r2, c2 }
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [inlineValue, setInlineValue] = useState("");

  // History for Undo / Redo
  const [history, setHistory] = useState([grid]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const gridContainerRef = useRef(null);
  const lastEmittedGridRef = useRef(null);

  // Global mouse up to stop drag selection
  useEffect(() => {
    function handleGlobalMouseUp() {
      setIsMouseDown(false);
    }
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  // Sync external changes from props without breaking local edits
  useEffect(() => {
    if (initialGrid && initialGrid !== lastEmittedGridRef.current) {
      setGrid({
        ...initialGrid,
        cells: evaluateAllCells(initialGrid.cells || {}),
      });
    }
  }, [initialGrid]);

  // Sync back to parent when grid changes
  const updateGridState = useCallback(
    (newGrid, addToHistory = true) => {
      const evaluated = {
        ...newGrid,
        cells: evaluateAllCells(newGrid.cells || {}),
      };
      lastEmittedGridRef.current = evaluated;
      setGrid(evaluated);
      if (onChange) onChange(evaluated);

      if (addToHistory) {
        setHistory((prev) => [...prev.slice(0, historyIndex + 1), evaluated]);
        setHistoryIndex((prev) => prev + 1);
      }
    },
    [historyIndex, onChange]
  );

  // Undo / Redo
  function handleUndo() {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex((i) => i - 1);
      setGrid(prev);
      if (onChange) onChange(prev);
    }
  }

  function handleRedo() {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex((i) => i + 1);
      setGrid(next);
      if (onChange) onChange(next);
    }
  }

  // Helper to validate and normalize L / TB / G result cell values
  function normalizeResultValue(raw) {
    if (raw === null || raw === undefined || raw === "") return "";
    const s = String(raw).trim().toUpperCase();
    if (s === "L") return "L";
    if (s === "G") return "G";
    if (s === "T" || s === "TB" || s === "B") return "TB";
    return null; // Invalid value!
  }

  // Active cell info & merge info
  const activeKey = toCellKey(activeCell.r, activeCell.c);
  const currentCellData = grid.cells[activeKey] || {};
  const activeCellCoordText = toCellName(activeCell.r, activeCell.c);
  const isCurrentCellResult =
    !!currentCellData.isResult ||
    !!(grid.colMeta && grid.colMeta[activeCell.c]?.isResult);
  const activeRawValue = currentCellData.f
    ? currentCellData.f
    : (currentCellData.v !== undefined && currentCellData.v !== null && currentCellData.v !== ""
        ? currentCellData.v
        : (currentCellData.computed ?? ""));

  const activeMerge = (grid.merges || []).find(
    (m) =>
      activeCell.r >= m.r &&
      activeCell.r < m.r + m.rSpan &&
      activeCell.c >= m.c &&
      activeCell.c < m.c + m.cSpan
  );
  const isCurrentCellMerged = !!activeMerge;

  const selectedRangeText = selectedRange
    ? `${toCellName(
        Math.min(selectedRange.r1, selectedRange.r2),
        Math.min(selectedRange.c1, selectedRange.c2)
      )}:${toCellName(
        Math.max(selectedRange.r1, selectedRange.r2),
        Math.max(selectedRange.c1, selectedRange.c2)
      )}`
    : null;

  // ── Cell Value / Formula Changes ───────────────────────────────────────────
  function setCellValue(r, c, rawInput) {
    const key = toCellKey(r, c);
    const existing = grid.cells[key] || {};
    const isRes =
      !!existing.isResult ||
      !!(grid.colMeta && grid.colMeta[c]?.isResult);

    let finalValue = rawInput;
    if (isRes && !String(rawInput).startsWith("=")) {
      const normalized = normalizeResultValue(rawInput);
      if (normalized === null) {
        // Strictly reject any value other than L, TB, G, or empty!
        return;
      }
      finalValue = normalized;
    }

    const isFormula = String(finalValue).startsWith("=");

    const updatedCell = {
      ...existing,
      v: isFormula ? "" : finalValue,
      f: isFormula ? finalValue : undefined,
      computed: isFormula ? undefined : finalValue,
    };

    const nextCells = {
      ...grid.cells,
      [key]: updatedCell,
    };

    updateGridState({
      ...grid,
      cells: nextCells,
    });
  }

  function setCellResultValue(optId) {
    const normalized = normalizeResultValue(optId);
    if (normalized === null && optId !== "") return;
    const finalOpt = normalized || "";

    if (selectedRange) {
      const minR = Math.min(selectedRange.r1, selectedRange.r2);
      const maxR = Math.max(selectedRange.r1, selectedRange.r2);
      const minC = Math.min(selectedRange.c1, selectedRange.c2);
      const maxC = Math.max(selectedRange.c1, selectedRange.c2);
      const nextCells = { ...grid.cells };
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const key = toCellKey(r, c);
          const cell = nextCells[key] || {};
          const isRes =
            cell.isResult ||
            (grid.colMeta && grid.colMeta[c]?.isResult);
          if (isRes && !cell.f) {
            nextCells[key] = {
              ...cell,
              v: finalOpt,
              f: undefined,
              computed: finalOpt,
            };
          }
        }
      }
      updateGridState({ ...grid, cells: nextCells });
    } else {
      setCellValue(
        activeCell.r,
        activeCell.c,
        finalOpt
      );
    }
  }

  // ── Cell Formatting (Bold, Italic, Align, Color, vAlign, Orientation) ──────
  function updateCellFormat(patch) {
    const nextCells = { ...grid.cells };

    if (selectedRange) {
      const minR = Math.min(selectedRange.r1, selectedRange.r2);
      const maxR = Math.max(selectedRange.r1, selectedRange.r2);
      const minC = Math.min(selectedRange.c1, selectedRange.c2);
      const maxC = Math.max(selectedRange.c1, selectedRange.c2);

      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const key = toCellKey(r, c);
          const existing = nextCells[key] || {};
          nextCells[key] = { ...existing, ...patch };
        }
      }
    } else {
      const key = activeKey;
      const existing = nextCells[key] || {};
      nextCells[key] = { ...existing, ...patch };
    }

    updateGridState({
      ...grid,
      cells: nextCells,
    });
  }

  // ── Row & Column Management ────────────────────────────────────────────────
  function addRow() {
    updateGridState({
      ...grid,
      rowCount: grid.rowCount + 1,
    });
  }

  function removeRow() {
    if (grid.rowCount <= 1) return;
    const targetR = activeCell.r;
    const nextCells = {};

    Object.keys(grid.cells).forEach((key) => {
      const { r, c } = fromCellKey(key);
      if (r < targetR) {
        nextCells[key] = grid.cells[key];
      } else if (r > targetR) {
        nextCells[toCellKey(r - 1, c)] = grid.cells[key];
      }
    });

    const nextMerges = (grid.merges || [])
      .filter((m) => m.r !== targetR)
      .map((m) => (m.r > targetR ? { ...m, r: m.r - 1 } : m));

    updateGridState({
      ...grid,
      rowCount: grid.rowCount - 1,
      cells: nextCells,
      merges: nextMerges,
    });
    setActiveCell((prev) => ({ ...prev, r: Math.max(0, targetR - 1) }));
  }

  function addColumn() {
    updateGridState({
      ...grid,
      colCount: grid.colCount + 1,
    });
  }

  function removeColumn() {
    if (grid.colCount <= 1) return;
    const targetC = activeCell.c;
    const nextCells = {};

    Object.keys(grid.cells).forEach((key) => {
      const { r, c } = fromCellKey(key);
      if (c < targetC) {
        nextCells[key] = grid.cells[key];
      } else if (c > targetC) {
        nextCells[toCellKey(r, c - 1)] = grid.cells[key];
      }
    });

    const nextMerges = (grid.merges || [])
      .filter((m) => m.c !== targetC)
      .map((m) => (m.c > targetC ? { ...m, c: m.c - 1 } : m));

    updateGridState({
      ...grid,
      colCount: grid.colCount - 1,
      cells: nextCells,
      merges: nextMerges,
    });
    setActiveCell((prev) => ({ ...prev, c: Math.max(0, targetC - 1) }));
  }

  // ── Cell Merge Management (Free Horizontal / Vertical / 2D Block) ────────
  function handleMergeToggle() {
    if (selectedRange) {
      handleMergeRange();
    } else if (isCurrentCellMerged) {
      handleUnmergeActive();
    } else {
      // Default: merge horizontal with next cell
      handleMergeDirection("horizontal");
    }
  }

  function handleMergeRange() {
    if (!selectedRange) return;
    const minR = Math.min(selectedRange.r1, selectedRange.r2);
    const maxR = Math.max(selectedRange.r1, selectedRange.r2);
    const minC = Math.min(selectedRange.c1, selectedRange.c2);
    const maxC = Math.max(selectedRange.c1, selectedRange.c2);
    const rSpan = maxR - minR + 1;
    const cSpan = maxC - minC + 1;

    if (rSpan <= 1 && cSpan <= 1) return;

    // Check if this exact range is already merged -> unmerge
    const exactMergeIdx = (grid.merges || []).findIndex(
      (m) => m.r === minR && m.c === minC && m.rSpan === rSpan && m.cSpan === cSpan
    );
    if (exactMergeIdx !== -1) {
      const nextMerges = grid.merges.filter((_, idx) => idx !== exactMergeIdx);
      updateGridState({ ...grid, merges: nextMerges });
      setSelectedRange(null);
      return;
    }

    // Remove any overlapping merges
    const nextMerges = (grid.merges || []).filter(
      (m) =>
        m.r + m.rSpan - 1 < minR ||
        m.r > maxR ||
        m.c + m.cSpan - 1 < minC ||
        m.c > maxC
    );

    nextMerges.push({ r: minR, c: minC, rSpan, cSpan });
    updateGridState({ ...grid, merges: nextMerges });
    setSelectedRange(null);
    setActiveCell({ r: minR, c: minC });
  }

  function handleMergeDirection(direction) {
    const { r, c } = activeCell;
    let rSpan = 1;
    let cSpan = 1;

    if (direction === "horizontal") {
      if (c >= grid.colCount - 1) return;
      cSpan = 2;
    } else if (direction === "vertical") {
      if (r >= grid.rowCount - 1) return;
      rSpan = 2;
    }

    const minR = r;
    const maxR = r + rSpan - 1;
    const minC = c;
    const maxC = c + cSpan - 1;

    // Remove overlapping merges
    const nextMerges = (grid.merges || []).filter(
      (m) =>
        m.r + m.rSpan - 1 < minR ||
        m.r > maxR ||
        m.c + m.cSpan - 1 < minC ||
        m.c > maxC
    );

    nextMerges.push({ r, c, rSpan, cSpan });
    updateGridState({ ...grid, merges: nextMerges });
    setSelectedRange(null);
  }

  function handleUnmergeActive() {
    if (selectedRange) {
      const minR = Math.min(selectedRange.r1, selectedRange.r2);
      const maxR = Math.max(selectedRange.r1, selectedRange.r2);
      const minC = Math.min(selectedRange.c1, selectedRange.c2);
      const maxC = Math.max(selectedRange.c1, selectedRange.c2);

      const nextMerges = (grid.merges || []).filter(
        (m) =>
          m.r + m.rSpan - 1 < minR ||
          m.r > maxR ||
          m.c + m.cSpan - 1 < minC ||
          m.c > maxC
      );
      updateGridState({ ...grid, merges: nextMerges });
      setSelectedRange(null);
      return;
    }

    if (!isCurrentCellMerged) return;
    const nextMerges = (grid.merges || []).filter((m) => m !== activeMerge);
    updateGridState({ ...grid, merges: nextMerges });
    setSelectedRange(null);
  }

  // ── Quick Formula Insertion (SUM, AVG, MAX) ────────────────────────────────
  function insertQuickFormula(fnName) {
    const targetCName = indexToColLetter(activeCell.c);
    const formulaStr =
      activeCell.r > 1
        ? `=${fnName}(${targetCName}2:${targetCName}${activeCell.r})`
        : `=${fnName}(${targetCName}1:${targetCName}${activeCell.r + 1})`;
    setCellValue(activeCell.r, activeCell.c, formulaStr);
  }

  // ── Keyboard Navigation ────────────────────────────────────────────────────
  function handleKeyDown(e) {
    // Do not intercept if event originated inside the formula bar input
    if (e.target && e.target.getAttribute("data-formula-input")) {
      return;
    }

    if (isEditingInline) {
      if (e.key === "Enter") {
        e.preventDefault();
        setCellValue(activeCell.r, activeCell.c, inlineValue);
        setIsEditingInline(false);
        setActiveCell((prev) => ({
          ...prev,
          r: Math.min(grid.rowCount - 1, prev.r + 1),
        }));
      } else if (e.key === "Tab") {
        e.preventDefault();
        setCellValue(activeCell.r, activeCell.c, inlineValue);
        setIsEditingInline(false);
        setActiveCell((prev) => ({
          ...prev,
          c: Math.min(grid.colCount - 1, prev.c + 1),
        }));
      } else if (e.key === "Escape") {
        setIsEditingInline(false);
      }
      return;
    }

    // Shift + Arrow range selection expansion (Excel style)
    if (e.shiftKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const anchor = selectionAnchor || { r: activeCell.r, c: activeCell.c };
      if (!selectionAnchor) setSelectionAnchor(anchor);

      const currTarget = selectedRange
        ? { r: selectedRange.r2, c: selectedRange.c2 }
        : { r: activeCell.r, c: activeCell.c };

      let nextR = currTarget.r;
      let nextC = currTarget.c;

      if (e.key === "ArrowDown") nextR = Math.min(grid.rowCount - 1, nextR + 1);
      if (e.key === "ArrowUp") nextR = Math.max(0, nextR - 1);
      if (e.key === "ArrowRight") nextC = Math.min(grid.colCount - 1, nextC + 1);
      if (e.key === "ArrowLeft") nextC = Math.max(0, nextC - 1);

      if (nextR === anchor.r && nextC === anchor.c) {
        setSelectedRange(null);
      } else {
        setSelectedRange({
          r1: anchor.r,
          c1: anchor.c,
          r2: nextR,
          c2: nextC,
        });
      }
      return;
    }

    const { r, c } = activeCell;

    if (e.key === "ArrowDown" || (e.key === "Enter" && !e.shiftKey)) {
      e.preventDefault();
      setSelectionAnchor(null);
      setSelectedRange(null);
      setActiveCell({ r: Math.min(grid.rowCount - 1, r + 1), c });
    } else if (e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey)) {
      e.preventDefault();
      setSelectionAnchor(null);
      setSelectedRange(null);
      setActiveCell({ r: Math.max(0, r - 1), c });
    } else if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      setSelectionAnchor(null);
      setSelectedRange(null);
      setActiveCell({ r, c: Math.min(grid.colCount - 1, c + 1) });
    } else if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      setSelectionAnchor(null);
      setSelectedRange(null);
      setActiveCell({ r, c: Math.max(0, c - 1) });
    } else if (e.key === "F2") {
      e.preventDefault();
      if (!readOnly && (!technicianMode || currentCellData.editable || isCurrentCellResult)) {
        setInlineValue(activeRawValue);
        setIsEditingInline(true);
      }
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedRange) {
        const minR = Math.min(selectedRange.r1, selectedRange.r2);
        const maxR = Math.max(selectedRange.r1, selectedRange.r2);
        const minC = Math.min(selectedRange.c1, selectedRange.c2);
        const maxC = Math.max(selectedRange.c1, selectedRange.c2);
        const nextCells = { ...grid.cells };
        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            const key = toCellKey(r, c);
            const cell = nextCells[key] || {};
            const isRes =
              cell.isResult ||
              (grid.colMeta && grid.colMeta[c]?.isResult);
            if (!technicianMode || cell.editable || isRes) {
              nextCells[key] = { ...cell, v: "", f: undefined, computed: "" };
            }
          }
        }
        updateGridState({ ...grid, cells: nextCells });
      } else if (!technicianMode || currentCellData.editable || isCurrentCellResult) {
        setCellValue(r, c, "");
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // If cell is an L/TB/G status cell, only L, TB, G are allowed!
      if (isCurrentCellResult) {
        e.preventDefault();
        if (!readOnly && !currentCellData.f) {
          const up = e.key.toUpperCase();
          if (up === "L") {
            setCellResultValue("L");
          } else if (up === "T" || up === "B") {
            setCellResultValue("TB");
          } else if (up === "G") {
            setCellResultValue("G");
          }
          // Any other letter/number is strictly forbidden!
        }
        return;
      }

      // Start inline typing — prevent default to avoid duplicating character into the newly mounted input!
      if (!technicianMode || currentCellData.editable) {
        e.preventDefault();
        setInlineValue(e.key);
        setIsEditingInline(true);
      }
    }
  }

  // Build lookup of covered merged cells to skip rendering them
  const mergeRootMap = {};
  const coveredCells = new Set();

  (grid.merges || []).forEach((m) => {
    mergeRootMap[toCellKey(m.r, m.c)] = m;
    for (let ro = 0; ro < m.rSpan; ro++) {
      for (let co = 0; co < m.cSpan; co++) {
        if (ro !== 0 || co !== 0) {
          coveredCells.add(toCellKey(m.r + ro, m.c + co));
        }
      }
    }
  });

  // Helper to determine optimal column width and layout props
  function getColumnProps(cIdx) {
    const meta = (grid.colMeta && grid.colMeta[cIdx]) || {};
    const headerCell = grid.cells[toCellKey(0, cIdx)] || {};
    const headerText = String(headerCell.v ?? "").trim();

    // Check if column has vertical cells or result cells
    let hasVertical = false;
    let hasResult = !!meta.isResult;
    for (let r = 0; r < grid.rowCount; r++) {
      const cell = grid.cells[toCellKey(r, cIdx)];
      if (cell?.orientation === "vertical") hasVertical = true;
      if (cell?.isResult) hasResult = true;
    }

    if (hasVertical) {
      return {
        thClass: "w-10 min-w-[36px] max-w-[44px] px-1 text-center",
        tdClass: "text-center px-1 py-1",
        style: { width: "40px", minWidth: "36px", maxWidth: "46px" },
      };
    }

    if (hasResult || /^\d{1,2}$/.test(headerText)) {
      // Result column or sample number (e.g. 01..10)
      return {
        thClass: "w-12 min-w-[40px] max-w-[50px] px-1 text-center",
        tdClass: "text-center px-1 py-1",
        style: { width: "46px", minWidth: "40px", maxWidth: "52px" },
      };
    }

    if (meta.width && meta.width > 0) {
      return {
        thClass: "px-2 py-1.5",
        tdClass: "px-2 py-1.5",
        style: { width: `${meta.width}px`, minWidth: "75px" },
      };
    }

    if (headerText.length > 12 || cIdx === 1) {
      // Long parameter description column (e.g. column B)
      return {
        thClass: "min-w-[170px] max-w-[320px] px-2.5 py-1.5 text-left",
        tdClass: "px-2.5 py-1.5 text-left",
        style: { minWidth: "170px", maxWidth: "340px" },
      };
    }

    // Default column (e.g. Keterangan)
    return {
      thClass: "min-w-[75px] max-w-[130px] px-2 py-1.5 text-center",
      tdClass: "px-2 py-1.5",
      style: { minWidth: "70px", maxWidth: "140px" },
    };
  }

  return (
    <div
      ref={gridContainerRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="border border-slate-300 rounded-xl bg-white shadow-sm overflow-hidden outline-none select-none text-xs w-full max-w-full"
    >
      {/* ── 1. TOP TOOLBAR (Technician Mode) ────────────────────────────────── */}
      {!readOnly && technicianMode && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-1.5 bg-slate-50 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Undo / Redo */}
            <div className="flex items-center gap-0.5 bg-white border border-slate-300 rounded-md p-0.5 shrink-0">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-1.5 text-slate-600 hover:text-navy-900 hover:bg-slate-100 rounded disabled:opacity-30"
                title="Undo (Ctrl+Z)"
              >
                <FiRotateCcw size={13} />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-1.5 text-slate-600 hover:text-navy-900 hover:bg-slate-100 rounded disabled:opacity-30"
                title="Redo (Ctrl+Y)"
              >
                <FiRotateCw size={13} />
              </button>
            </div>

            {/* Quick guidance badge */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-800 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Hijau: Isi Nilai
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-[10px] font-semibold text-purple-800 shrink-0">
                <FiCheckCircle size={10} className="text-purple-600" />
                Ungu: L / TB / G
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 hidden xl:block shrink-0 text-right">
            Ketik L/TB/G atau tekan F2 untuk mengedit
          </div>
        </div>
      )}

      {/* ── 1. TOP TOOLBAR (Design / Engineer Mode) ─────────────────────────── */}
      {!readOnly && !technicianMode && (
        <div className="bg-slate-50 border-b border-slate-200 divide-y divide-slate-200">
          {/* BARIS 1: Pengaturan Font & Teks */}
          <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none w-24 shrink-0">
              Font & Teks
            </span>

            {/* Gaya Huruf: Bold & Italic */}
            <div className="flex items-center bg-white border border-slate-300 rounded-md p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() =>
                  updateCellFormat({ bold: !currentCellData.bold })
                }
                className={`p-1.5 rounded transition ${
                  currentCellData.bold
                    ? "bg-sky-100 text-sky-800 font-bold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                title="Tebal (Bold)"
              >
                <FiBold size={13} />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateCellFormat({ italic: !currentCellData.italic })
                }
                className={`p-1.5 rounded transition ${
                  currentCellData.italic
                    ? "bg-sky-100 text-sky-800"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                title="Miring (Italic)"
              >
                <FiItalic size={13} />
              </button>
            </div>

            <div className="h-4 w-px bg-slate-300" />

            {/* Perataan Horizontal: Left, Center, Right */}
            <div className="flex items-center bg-white border border-slate-300 rounded-md p-0.5 shadow-2xs" title="Perataan Horizontal">
              {[
                { id: "left", label: "Rata Kiri", Icon: FiAlignLeft },
                { id: "center", label: "Rata Tengah", Icon: FiAlignCenter },
                { id: "right", label: "Rata Kanan", Icon: FiAlignRight },
              ].map(({ id, label, Icon }) => {
                const isSelected = (currentCellData.align || "left") === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => updateCellFormat({ align: id })}
                    className={`p-1.5 rounded transition ${
                      isSelected
                        ? "bg-sky-100 text-sky-800 font-bold"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    title={label}
                  >
                    <Icon size={13} />
                  </button>
                );
              })}
            </div>

            <div className="h-4 w-px bg-slate-300" />

            {/* Perataan Vertikal: Top, Middle, Bottom */}
            <div className="flex items-center bg-white border border-slate-300 rounded-md p-0.5 shadow-2xs" title="Perataan Vertikal">
              {[
                { id: "top", label: "Rata Atas", Icon: MdVerticalAlignTop },
                { id: "middle", label: "Rata Tengah", Icon: MdVerticalAlignCenter },
                { id: "bottom", label: "Rata Bawah", Icon: MdVerticalAlignBottom },
              ].map(({ id, label, Icon }) => {
                const isSelected = (currentCellData.vAlign || "middle") === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => updateCellFormat({ vAlign: id })}
                    className={`p-1.5 rounded transition ${
                      isSelected
                        ? "bg-sky-100 text-sky-800 font-bold"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    title={label}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}
            </div>

            <div className="h-4 w-px bg-slate-300" />

            {/* Orientasi Teks: Horizontal vs Vertikal */}
            <div className="flex items-center bg-white border border-slate-300 rounded-md p-0.5 shadow-2xs" title="Orientasi Teks">
              <button
                type="button"
                onClick={() => updateCellFormat({ orientation: "horizontal" })}
                className={`p-1.5 rounded transition ${
                  (currentCellData.orientation || "horizontal") === "horizontal"
                    ? "bg-sky-100 text-sky-800 font-bold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                title="Teks Horizontal (Mendatar)"
              >
                <MdTextRotationNone size={14} />
              </button>
              <button
                type="button"
                onClick={() => updateCellFormat({ orientation: "vertical" })}
                className={`p-1.5 rounded transition ${
                  currentCellData.orientation === "vertical"
                    ? "bg-sky-100 text-sky-800 font-bold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                title="Teks Vertikal (Tegak)"
              >
                <MdTextRotateVertical size={14} />
              </button>
            </div>
          </div>

          {/* BARIS 2: Pengaturan Sel */}
          <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-slate-50/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none w-24 shrink-0">
              Pengaturan Sel
            </span>

            {/* Undo / Redo */}
            <div className="flex items-center gap-0.5 bg-white border border-slate-300 rounded-md p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-1.5 text-slate-600 hover:text-navy-900 hover:bg-slate-100 rounded disabled:opacity-30 transition"
                title="Undo (Ctrl+Z)"
              >
                <FiRotateCcw size={13} />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-1.5 text-slate-600 hover:text-navy-900 hover:bg-slate-100 rounded disabled:opacity-30 transition"
                title="Redo (Ctrl+Y)"
              >
                <FiRotateCw size={13} />
              </button>
            </div>

            <div className="h-4 w-px bg-slate-300" />

            {/* + Baris - */}
            <div className="inline-flex items-center bg-white border border-slate-300 rounded-md overflow-hidden text-xs shadow-2xs">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:bg-sky-50 hover:text-sky-700 font-medium transition"
              >
                <FiPlus size={11} className="text-emerald-600 font-bold" /> Baris
              </button>
              <button
                type="button"
                onClick={removeRow}
                className="px-2 py-1 border-l border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                title="Hapus baris aktif"
              >
                <FiMinus size={11} />
              </button>
            </div>

            {/* + Kolom - */}
            <div className="inline-flex items-center bg-white border border-slate-300 rounded-md overflow-hidden text-xs shadow-2xs">
              <button
                type="button"
                onClick={addColumn}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:bg-sky-50 hover:text-sky-700 font-medium transition"
              >
                <FiPlus size={11} className="text-emerald-600 font-bold" /> Kolom
              </button>
              <button
                type="button"
                onClick={removeColumn}
                className="px-2 py-1 border-l border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                title="Hapus kolom aktif"
              >
                <FiMinus size={11} />
              </button>
            </div>

            <div className="h-4 w-px bg-slate-300" />

            {/* Merge Sel Tunggal (Tanpa dropdown opsi kanan) */}
            <button
              type="button"
              onClick={handleMergeToggle}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-semibold shadow-2xs transition ${
                isCurrentCellMerged || selectedRange
                  ? "bg-amber-100 border-amber-400 text-amber-900 hover:bg-amber-200"
                  : "bg-white border-slate-300 text-slate-700 hover:bg-amber-50 hover:text-amber-800"
              }`}
              title={
                selectedRange
                  ? `Gabung Sel yang Disorot (${selectedRangeText})`
                  : isCurrentCellMerged
                  ? "Pisahkan Sel Ini (Unmerge)"
                  : "Gabung dengan Sel Sebelah (Merge)"
              }
            >
              <FiLayers size={13} className="text-amber-600" />
              <span>
                {selectedRange
                  ? `Merge (${selectedRangeText})`
                  : isCurrentCellMerged
                  ? "Unmerge Sel"
                  : "Merge Sel"}
              </span>
            </button>

            <div className="h-4 w-px bg-slate-300" />

            {/* Warna Latar Sel */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-md px-2.5 py-1 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-medium mr-1 select-none">
                Warna Sel:
              </span>
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.bg}
                  type="button"
                  onClick={() => updateCellFormat({ bg: c.bg })}
                  className="w-4 h-4 rounded-full border border-slate-300 transition-transform hover:scale-125 focus:ring-2 focus:ring-sky-400"
                  style={{ backgroundColor: c.bg }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* BARIS 3: Fungsi Khusus & Rumus */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none w-24 shrink-0">
                Fungsi & Izin
              </span>

              {/* Teknisi Boleh Isi / Kunci Nilai */}
              <button
                type="button"
                onClick={() =>
                  updateCellFormat({
                    editable: !currentCellData.editable,
                    isResult: false,
                  })
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold shadow-2xs transition ${
                  currentCellData.editable
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-100"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
                title="Tentukan apakah sel ini boleh diisi teknisi saat pengujian"
              >
                {currentCellData.editable ? (
                  <FiUnlock size={12} />
                ) : (
                  <FiLock size={12} />
                )}
                <span>{currentCellData.editable ? "Teknisi Boleh Isi" : "Kunci Nilai"}</span>
              </button>

              {/* Status L/TB/G */}
              <button
                type="button"
                onClick={() =>
                  updateCellFormat({
                    isResult: !currentCellData.isResult,
                    editable: false,
                  })
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold shadow-2xs transition ${
                  currentCellData.isResult
                    ? "bg-purple-600 text-white border-purple-600 shadow-purple-100"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-purple-50 hover:text-purple-700"
                }`}
                title="Jadikan sel ini sebagai penilaian hasil (L/TB/G)"
              >
                <FiCheckCircle size={12} />
                <span>Status L/TB/G</span>
              </button>
            </div>

            {/* Quick Formulas: SUM, AVG, MAX */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
              <span className="font-sans text-[11px] text-slate-400 select-none">
                Rumus Cepat:
              </span>
              <button
                type="button"
                onClick={() => insertQuickFormula("SUM")}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-md hover:bg-sky-50 hover:text-sky-700 font-bold shadow-2xs transition"
                title="Jumlahkan range angka (SUM)"
              >
                Σ SUM
              </button>
              <button
                type="button"
                onClick={() => insertQuickFormula("AVERAGE")}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-md hover:bg-sky-50 hover:text-sky-700 font-bold shadow-2xs transition"
                title="Rata-rata angka (AVERAGE)"
              >
                x̄ AVG
              </button>
              <button
                type="button"
                onClick={() => insertQuickFormula("MAX")}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-md hover:bg-sky-50 hover:text-sky-700 font-bold shadow-2xs transition"
                title="Nilai maksimum (MAX)"
              >
                ↑ MAX
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. FORMULA BAR (fx) ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-white border-b border-slate-200 font-mono">
        {/* Cell Coordinate Box (A1, B2, or A1:B3) */}
        <div className="px-2 py-0.5 bg-sky-50 border border-sky-300 text-navy-900 rounded font-bold text-xs min-w-[44px] text-center shadow-2xs shrink-0">
          {selectedRangeText || activeCellCoordText}
        </div>

        {/* fx symbol */}
        <span className="text-slate-400 font-serif italic font-bold text-xs select-none shrink-0">
          fx
        </span>

        {/* Direct Formula / Value Input */}
        <input
          data-formula-input="true"
          type="text"
          value={activeRawValue}
          disabled={
            readOnly ||
            (technicianMode && !currentCellData.editable && !isCurrentCellResult)
          }
          onChange={(e) => {
            if (isCurrentCellResult) {
              const up = e.target.value.toUpperCase().trim();
              if (up === "" || up === "L" || up === "G" || up === "T" || up === "TB") {
                setCellResultValue(up === "T" ? "TB" : up);
              }
              return;
            }
            setCellValue(activeCell.r, activeCell.c, e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setActiveCell((prev) => ({
                ...prev,
                r: Math.min(grid.rowCount - 1, prev.r + 1),
              }));
              return;
            }
            if (
              isCurrentCellResult &&
              e.key.length === 1 &&
              !e.ctrlKey &&
              !e.metaKey &&
              !e.altKey
            ) {
              const up = e.key.toUpperCase();
              if (up !== "L" && up !== "T" && up !== "B" && up !== "G") {
                e.preventDefault();
              }
            }
          }}
          placeholder={
            isCurrentCellResult
              ? "Ketik status L, TB, atau G"
              : "Ketik nilai atau rumus (contoh: =C2 * D2)"
          }
          className={`min-w-[120px] flex-1 px-2.5 py-1 border rounded text-xs font-mono transition ${
            isCurrentCellResult
              ? "bg-purple-50/40 text-purple-900 border-purple-200 font-bold focus:border-purple-500 focus:bg-white"
              : "bg-slate-50/50 text-navy-900 border-slate-200 focus:border-sky-500 focus:bg-white"
          }`}
        />

        {/* Quick L / TB / G helper buttons in formula bar */}
        {isCurrentCellResult && !currentCellData.f && !readOnly && (
          <div className="flex items-center gap-0.5 shrink-0 bg-slate-100 p-0.5 rounded-md border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 px-1 select-none">
              Pilihan:
            </span>
            {[
              { id: "L", label: "L", title: "Lulus", activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-extrabold" },
              { id: "TB", label: "TB", title: "Tidak Berlaku", activeClass: "bg-slate-700 text-white border-slate-700 shadow-2xs font-extrabold" },
              { id: "G", label: "G", title: "Gagal", activeClass: "bg-red-600 text-white border-red-600 shadow-2xs font-extrabold" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                title={opt.title}
                onClick={() => setCellResultValue(opt.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition border ${
                  activeRawValue === opt.id
                    ? opt.activeClass
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {isCurrentCellResult ? (
          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-sans font-semibold flex items-center gap-1 shrink-0">
            <FiCheckCircle size={10} className="text-purple-600" />
            L / TB / G
          </span>
        ) : currentCellData.editable ? (
          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-sans font-semibold shrink-0">
            Boleh Diisi
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-sans font-medium flex items-center gap-1 shrink-0">
            <FiLock size={10} /> Terkunci
          </span>
        )}
      </div>

      {/* ── 3. SPREADSHEET CANVAS ─────────────────────────────────────────── */}
      <div className="overflow-x-auto max-h-[550px] bg-white scrollbar-thin scrollbar-thumb-slate-300">
        <table className="w-full border-collapse text-xs select-none min-w-full">
          <thead>
            {/* Header: Column Letters (A, B, C...) */}
            <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 text-center font-mono sticky top-0 z-20">
              <th className="w-9 min-w-[34px] max-w-[36px] border-r border-slate-300 py-1 text-[11px] font-bold bg-slate-200 text-slate-600 text-center">
                #
              </th>
              {Array.from({ length: grid.colCount }).map((_, cIdx) => {
                const isActiveCol = activeCell.c === cIdx;
                const letter = indexToColLetter(cIdx);
                const colProps = getColumnProps(cIdx);
                return (
                  <th
                    key={cIdx}
                    style={colProps.style}
                    onClick={() => setActiveCell((prev) => ({ ...prev, c: cIdx }))}
                    className={`border-r border-slate-300 py-1 cursor-pointer transition select-none ${
                      colProps.thClass
                    } ${
                      isActiveCol
                        ? "bg-sky-200 text-sky-900 font-extrabold border-b-2 border-b-sky-600"
                        : "hover:bg-slate-200"
                    }`}
                  >
                    {letter}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: grid.rowCount }).map((_, rIdx) => {
              const isActiveRow = activeCell.r === rIdx;

              return (
                <tr key={rIdx} className="border-b border-slate-200">
                  {/* Row Number Header (1, 2, 3...) */}
                  <td
                    onClick={() => setActiveCell((prev) => ({ ...prev, r: rIdx }))}
                    className={`w-9 min-w-[34px] max-w-[36px] border-r border-slate-300 text-center font-mono text-[11px] py-1 select-none cursor-pointer transition ${
                      isActiveRow
                        ? "bg-sky-200 text-sky-900 font-bold"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {rIdx + 1}
                  </td>

                  {/* Spreadsheet Cells */}
                  {Array.from({ length: grid.colCount }).map((_, cIdx) => {
                    const key = toCellKey(rIdx, cIdx);

                    // Skip covered merged cells
                    if (coveredCells.has(key)) return null;

                    const cell = grid.cells[key] || {};
                    const merge = mergeRootMap[key];
                    const colProps = getColumnProps(cIdx);

                    const isCellActive =
                      activeCell.r === rIdx && activeCell.c === cIdx;

                    const isCellInRange =
                      selectedRange &&
                      rIdx >= Math.min(selectedRange.r1, selectedRange.r2) &&
                      rIdx <= Math.max(selectedRange.r1, selectedRange.r2) &&
                      cIdx >= Math.min(selectedRange.c1, selectedRange.c2) &&
                      cIdx <= Math.max(selectedRange.c1, selectedRange.c2);

                    const isVertical = cell.orientation === "vertical";
                    const isCellResult =
                      !!cell.isResult ||
                      !!(grid.colMeta && grid.colMeta[cIdx]?.isResult);

                    // Display priority: computed formula result -> raw value
                    const displayValue = cell.f
                      ? (cell.computed !== undefined ? cell.computed : "")
                      : (cell.v !== undefined && cell.v !== null && cell.v !== "" ? cell.v : (cell.computed ?? ""));

                    return (
                      <td
                        key={cIdx}
                        colSpan={merge?.cSpan || 1}
                        rowSpan={merge?.rSpan || 1}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          if (isEditingInline) {
                            setCellValue(activeCell.r, activeCell.c, inlineValue);
                            setIsEditingInline(false);
                          }
                          setIsMouseDown(true);
                          setSelectionAnchor({ r: rIdx, c: cIdx });
                          setActiveCell({ r: rIdx, c: cIdx });
                          setSelectedRange(null);
                        }}
                        onMouseEnter={() => {
                          if (!isMouseDown || !selectionAnchor) return;
                          if (
                            rIdx === selectionAnchor.r &&
                            cIdx === selectionAnchor.c
                          ) {
                            setSelectedRange(null);
                          } else {
                            setSelectedRange({
                              r1: selectionAnchor.r,
                              c1: selectionAnchor.c,
                              r2: rIdx,
                              c2: cIdx,
                            });
                          }
                        }}
                        onClick={() => {
                          if (isEditingInline) {
                            setCellValue(activeCell.r, activeCell.c, inlineValue);
                            setIsEditingInline(false);
                          }
                          setActiveCell({ r: rIdx, c: cIdx });
                        }}
                        onDoubleClick={() => {
                          if (!readOnly && (!technicianMode || cell.editable || isCellResult)) {
                            setInlineValue(cell.f || cell.v || "");
                            setIsEditingInline(true);
                          }
                        }}
                        style={{
                          ...(merge && merge.cSpan > 1 ? {} : colProps.style),
                          backgroundColor: isCellInRange
                            ? isCellActive
                              ? "#BAE6FD"
                              : "#E0F2FE"
                            : cell.bg ||
                              (isCellResult
                                ? "#FAF5FF"
                                : cell.editable
                                ? "#F0FDF4"
                                : "#FFFFFF"),
                          verticalAlign:
                            cell.vAlign === "top"
                              ? "top"
                              : cell.vAlign === "bottom"
                              ? "bottom"
                              : "middle",
                        }}
                        className={`border-r border-slate-300 relative transition-all ${
                          colProps.tdClass
                        } ${
                          isCellResult
                            ? "border-purple-200"
                            : cell.editable
                            ? "border-emerald-300"
                            : ""
                        }`}
                      >
                        {/* Active Cell Selection Highlight (Excel-like crisp border overlay) */}
                        {isCellActive && (
                          <div
                            className="absolute inset-0 pointer-events-none z-20 border-2 border-sky-600 shadow-[0_0_0_1px_rgba(2,132,199,0.3)]"
                            style={{ margin: "-1px" }}
                          >
                            {/* Corner drag handle square like Excel */}
                            <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-sky-600 border border-white rounded-[1px]" />
                          </div>
                        )}

                        {/* Inline editing input */}
                        {isCellActive && isEditingInline ? (
                          <input
                            ref={(el) => {
                              if (el) {
                                el.focus();
                                const len = el.value.length;
                                el.setSelectionRange(len, len);
                              }
                            }}
                            type="text"
                            value={inlineValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (isCellResult) {
                                const up = val.toUpperCase().trim();
                                if (up === "" || up === "L" || up === "G" || up === "T" || up === "TB") {
                                  const mapped = up === "T" ? "TB" : up;
                                  setInlineValue(mapped);
                                  setCellValue(rIdx, cIdx, mapped);
                                }
                                return;
                              }
                              setInlineValue(val);
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") {
                                e.preventDefault();
                                setCellValue(rIdx, cIdx, inlineValue);
                                setIsEditingInline(false);
                                setActiveCell((prev) => ({
                                  ...prev,
                                  r: Math.min(grid.rowCount - 1, prev.r + 1),
                                }));
                              } else if (e.key === "Tab") {
                                e.preventDefault();
                                setCellValue(rIdx, cIdx, inlineValue);
                                setIsEditingInline(false);
                                setActiveCell((prev) => ({
                                  ...prev,
                                  c: Math.min(grid.colCount - 1, prev.c + 1),
                                }));
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setIsEditingInline(false);
                              } else if (
                                isCellResult &&
                                e.key.length === 1 &&
                                !e.ctrlKey &&
                                !e.metaKey &&
                                !e.altKey
                              ) {
                                const up = e.key.toUpperCase();
                                if (up !== "L" && up !== "T" && up !== "B" && up !== "G") {
                                  e.preventDefault();
                                }
                              }
                            }}
                            onBlur={() => {
                              setCellValue(rIdx, cIdx, inlineValue);
                              setIsEditingInline(false);
                            }}
                            className={`w-full h-full p-0 m-0 border-0 outline-none bg-white font-mono text-xs relative z-10 ${
                              isCellResult ? "text-center font-bold text-purple-900" : ""
                            }`}
                          />
                        ) : (
                          <div
                            className={`w-full ${
                              cell.bold ? "font-bold" : ""
                            } ${cell.italic ? "italic" : ""} ${
                              cell.align === "center"
                                ? "text-center"
                                : cell.align === "right"
                                ? "text-right"
                                : isCellResult
                                ? "text-center"
                                : "text-left"
                            } ${
                              cell.f
                                ? "text-navy-900 font-semibold"
                                : "text-slate-800"
                            } ${
                              isVertical
                                ? "flex items-center justify-center py-1"
                                : "line-clamp-2 break-words"
                            }`}
                            title={typeof displayValue === "string" ? displayValue : undefined}
                            style={
                              isVertical
                                ? {
                                    writingMode: "vertical-rl",
                                    transform: "rotate(180deg)",
                                    whiteSpace: "nowrap",
                                    margin: "0 auto",
                                    minHeight: "45px",
                                  }
                                : undefined
                            }
                          >
                            {isCellResult && displayValue ? (
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded font-bold text-[11px] shadow-2xs border ${
                                  displayValue === "L"
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                    : displayValue === "G"
                                    ? "bg-red-100 text-red-800 border-red-300"
                                    : "bg-slate-100 text-slate-700 border-slate-300"
                                }`}
                              >
                                {displayValue}
                              </span>
                            ) : displayValue !== "" ? (
                              displayValue
                            ) : isCellResult && !readOnly ? (
                              <span className="text-purple-300 text-[10px] font-sans font-medium select-none">
                                L/TB/G
                              </span>
                            ) : (
                              <span className="text-transparent">.</span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── 4. SPREADSHEET FOOTER HELPER ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border-t border-slate-200 text-[11px] text-slate-500 font-sans">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Hijau: Data Nilai
          </span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
            Ungu: Sel Hasil (Wajib "L", "TB", "G")
          </span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-navy-600 inline-block" />
            Navy: Rumus (fx)
          </span>
        </div>
        <div>
          <span>Ketik nilai atau tekan F2 untuk mengedit sel aktif</span>
        </div>
      </div>
    </div>
  );
}
