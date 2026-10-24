// src/components/ExcelTableEditor.jsx
//
// Lightweight Excel Grid component for Laboratory Datasheet Testing.
// Features:
// - Column letters (A, B, C...) and row numbers (1, 2, 3...)
// - Keyboard navigation: Arrow keys, Enter (down), Tab (right)
// - Formula Bar (fx) showing real-time formulas and bounds
// - Toggle Auto-lock vs Manual for L / TB / G result cells
// - Immediate visual distinction between input cells, formula cells, and results

import React, { useState, useRef, useEffect } from "react";
import {
  FiPlus,
  FiTrash2,
  FiLock,
  FiUnlock,
  FiCornerDownLeft,
  FiInfo,
} from "react-icons/fi";
import {
  indexToColLetter,
  resolveComputedCells,
  formulaToString,
  passRuleToString,
} from "../utils/tableFormulas";

export default function ExcelTableEditor({
  section,
  sData = {},
  canEdit = true,
  onCellChange,
  onManualResultChange,
  onAddRow,
  onRemoveRow,
}) {
  const columns = section.columns || [];
  const fixedRows = section.fixedRows || [];
  const headerGroups = section.headerGroups || [];
  const addedRows = sData.addedRows || [];
  const storedRows = sData.rows || {};

  // Track currently active/focused cell for Excel-like highlighting and fx bar
  const [activeCell, setActiveCell] = useState(null); // { rowId, colId, rIdx, cIdx }

  // Build combined row list
  const allRows = [
    ...fixedRows.map((fr) => ({
      rowId: fr.id,
      isAdded: false,
      rawCells: { ...fr.cells, ...((storedRows[fr.id] || {}).cells || {}) },
      manualResults: (storedRows[fr.id] || {}).manualResults || {},
      autoLocked: (storedRows[fr.id] || {}).autoLocked || {},
    })),
    ...addedRows.map((ar) => ({
      rowId: ar.rowId,
      isAdded: true,
      rawCells: ar.cells || {},
      manualResults: ar.manualResults || {},
      autoLocked: ar.autoLocked || {},
    })),
  ];

  // Resolve formulas & results for all rows
  const resolvedRows = allRows.map((row) => ({
    ...row,
    cells: resolveComputedCells(row.rawCells, columns, {
      manualResults: row.manualResults,
    }),
  }));

  // Row group labels
  const groupLabels = {};
  (section.rowGroups || []).forEach((g) => {
    (g.rowIds || []).forEach((id) => {
      groupLabels[id] = g.label;
    });
  });
  const renderedGroups = new Set();

  // Grid container ref for keyboard navigation
  const gridRef = useRef(null);

  // Focus helper by row and column index
  function focusCell(targetRIdx, targetCIdx) {
    if (!gridRef.current) return;
    const targetInput = gridRef.current.querySelector(
      `[data-coord="${targetRIdx}-${targetCIdx}"]`
    );
    if (targetInput) {
      targetInput.focus();
      if (typeof targetInput.select === "function") {
        targetInput.select();
      }
    }
  }

  // Keyboard navigation handler
  function handleKeyDown(e, rIdx, cIdx, col) {
    const isEnter = e.key === "Enter";
    const isTab = e.key === "Tab";
    const isArrowUp = e.key === "ArrowUp";
    const isArrowDown = e.key === "ArrowDown";
    const isArrowLeft = e.key === "ArrowLeft";
    const isArrowRight = e.key === "ArrowRight";

    // Enter -> Move Down (or Up with Shift)
    if (isEnter) {
      e.preventDefault();
      const nextR = e.shiftKey ? rIdx - 1 : rIdx + 1;
      if (nextR >= 0 && nextR < resolvedRows.length) {
        focusCell(nextR, cIdx);
      }
      return;
    }

    // Tab -> Move Right (or Left with Shift)
    if (isTab) {
      // Find next editable column
      let targetC = cIdx + (e.shiftKey ? -1 : 1);
      let targetR = rIdx;

      while (targetR >= 0 && targetR < resolvedRows.length) {
        if (targetC < 0) {
          targetR -= 1;
          targetC = columns.length - 1;
          continue;
        }
        if (targetC >= columns.length) {
          targetR += 1;
          targetC = 0;
          continue;
        }
        const targetCol = columns[targetC];
        if (targetCol && targetCol.editable && !targetCol.isResult) {
          e.preventDefault();
          focusCell(targetR, targetC);
          return;
        }
        targetC += e.shiftKey ? -1 : 1;
      }
      return;
    }

    // Arrow keys
    if (isArrowUp) {
      if (rIdx > 0) {
        e.preventDefault();
        focusCell(rIdx - 1, cIdx);
      }
    } else if (isArrowDown) {
      if (rIdx < resolvedRows.length - 1) {
        e.preventDefault();
        focusCell(rIdx + 1, cIdx);
      }
    } else if (isArrowRight && (e.target.selectionStart === e.target.value.length || !e.target.value)) {
      // Find next editable col in same row
      for (let nextC = cIdx + 1; nextC < columns.length; nextC++) {
        if (columns[nextC].editable && !columns[nextC].isResult) {
          e.preventDefault();
          focusCell(rIdx, nextC);
          break;
        }
      }
    } else if (isArrowLeft && (e.target.selectionEnd === 0 || !e.target.value)) {
      // Find prev editable col in same row
      for (let prevC = cIdx - 1; prevC >= 0; prevC--) {
        if (columns[prevC].editable && !columns[prevC].isResult) {
          e.preventDefault();
          focusCell(rIdx, prevC);
          break;
        }
      }
    }
  }

  // Active column info for Formula Bar
  const activeCol = activeCell ? columns[activeCell.cIdx] : null;
  const activeFormulaStr = activeCol
    ? activeCol.formula
      ? formulaToString(activeCol.formula, columns)
      : activeCol.passRule
      ? passRuleToString(activeCol.passRule, columns)
      : null
    : null;

  return (
    <div className="space-y-2">
      {/* Section Header */}
      {section.label && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-navy-800 uppercase tracking-wide">
            {section.label}
          </p>
          {section.footnote && (
            <span className="text-[11px] text-gray-500 italic">
              *{section.footnote}
            </span>
          )}
        </div>
      )}

      {/* Excel Formula Bar (fx) */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded-md text-xs font-mono text-slate-700">
        <span className="font-bold text-navy-700 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px] shrink-0">
          {activeCell
            ? `${indexToColLetter(activeCell.cIdx)}${activeCell.rIdx + 1}`
            : "Cell"}
        </span>
        <span className="text-slate-400 font-sans italic shrink-0">fx:</span>
        <div className="flex-1 truncate text-slate-800">
          {activeFormulaStr ? (
            <span className="font-semibold text-sky-700">
              {String(activeFormulaStr).startsWith("=")
                ? activeFormulaStr
                : `=${activeFormulaStr}`}
            </span>
          ) : activeCell ? (
            <span className="text-slate-500 font-sans">
              {activeCol?.header || "Input Langsung"}
            </span>
          ) : (
            <span className="text-slate-400 font-sans italic text-[11px]">
              Klik pada salah satu sel untuk navigasi atau melihat rumus
            </span>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-400 font-sans">
          <span>Panah / Enter / Tab untuk navigasi</span>
        </div>
      </div>

      {/* Excel Grid Table */}
      <div
        ref={gridRef}
        className="overflow-x-auto border border-slate-300 rounded-md shadow-sm bg-white"
      >
        <table className="w-full border-collapse text-xs select-none min-w-max">
          <thead>
            {/* Tier 1: Merged Header Groups (if any) */}
            {headerGroups.length > 0 && (
              <tr className="bg-slate-200 border-b border-slate-300 text-center text-navy-900 font-bold">
                <th className="w-9 border-r border-slate-300 py-1 bg-slate-300/70" />
                {(() => {
                  const renderedColIds = new Set();
                  const cells = [];
                  columns.forEach((col) => {
                    if (renderedColIds.has(col.id)) return;
                    const group = headerGroups.find((g) =>
                      (g.colIds || []).includes(col.id)
                    );
                    if (group) {
                      const span = group.colIds.length;
                      group.colIds.forEach((id) => renderedColIds.add(id));
                      cells.push(
                        <th
                          key={group.id}
                          colSpan={span}
                          className="border-r border-slate-300 py-1.5 px-2 bg-amber-100 text-amber-900 text-xs font-bold"
                        >
                          {group.title}
                        </th>
                      );
                    } else {
                      renderedColIds.add(col.id);
                      cells.push(
                        <th
                          key={col.id}
                          className="border-r border-slate-300 py-1 text-slate-400 font-normal text-[10px]"
                        >
                          —
                        </th>
                      );
                    }
                  });
                  return cells;
                })()}
                {canEdit && <th className="w-8 py-1" />}
              </tr>
            )}

            {/* Top row: Column Letters (A, B, C...) */}
            <tr className="bg-slate-200 text-slate-600 border-b border-slate-300 text-center font-mono">
              <th className="w-9 border-r border-slate-300 py-1 text-[10px] font-semibold bg-slate-300/70">
                #
              </th>
              {columns.map((col, cIdx) => {
                const isActive = activeCell?.cIdx === cIdx;
                return (
                  <th
                    key={col.id}
                    className={`border-r border-slate-300 py-1 px-2 text-[11px] font-bold transition-colors ${
                      isActive
                        ? "bg-sky-200 text-sky-900 border-b-2 border-b-sky-600"
                        : "text-slate-600"
                    }`}
                  >
                    {indexToColLetter(cIdx)}
                  </th>
                );
              })}
              {canEdit && <th className="w-8 py-1" />}
            </tr>

            {/* Sub-row: Column Headers with parameters */}
            <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
              <th className="border-r border-slate-300 px-1 py-2 text-center text-[10px] text-slate-400 font-normal">
                No
              </th>
              {columns.map((col, cIdx) => (
                <th
                  key={col.id}
                  className="border-r border-slate-300 px-2.5 py-2 text-left font-semibold whitespace-nowrap text-xs"
                  style={col.width ? { minWidth: col.width } : { minWidth: "110px" }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>{col.header}</span>
                    {!col.editable && !col.isResult && (
                      <span className="text-[10px] text-amber-600 font-mono font-normal bg-amber-50 px-1 rounded border border-amber-200">
                        fx
                      </span>
                    )}
                    {col.isResult && (
                      <span className="text-[10px] text-emerald-700 font-mono font-normal bg-emerald-50 px-1 rounded border border-emerald-200">
                        status
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {canEdit && <th className="w-8 border-b border-slate-300" />}
            </tr>
          </thead>

          <tbody>
            {resolvedRows.map((row, rIdx) => {
              const { rowId, isAdded, cells, autoLocked, manualResults } = row;
              const groupLabel = groupLabels[rowId];
              const showGroup = groupLabel && !renderedGroups.has(groupLabel);
              if (groupLabel) renderedGroups.add(groupLabel);

              const isRowActive = activeCell?.rIdx === rIdx;

              return (
                <React.Fragment key={rowId}>
                  {/* Row Group Separator Banner */}
                  {showGroup && (
                    <tr className="bg-slate-100/90 font-medium text-slate-700 border-b border-slate-300">
                      <td
                        colSpan={columns.length + (canEdit ? 2 : 1)}
                        className="px-3 py-1.5 text-xs text-navy-900 font-semibold bg-sky-50/60 border-l-4 border-l-navy-700"
                      >
                        {groupLabel}
                      </td>
                    </tr>
                  )}

                  {/* Grid Row */}
                  <tr
                    className={`border-b border-slate-200 transition-colors ${
                      isAdded
                        ? "bg-sky-50/40 hover:bg-sky-50/70"
                        : isRowActive
                        ? "bg-slate-50"
                        : "hover:bg-slate-50/80"
                    }`}
                  >
                    {/* Row Index Number */}
                    <td
                      className={`border-r border-slate-300 px-1 py-1 text-center font-mono text-[11px] ${
                        isRowActive
                          ? "bg-sky-200 font-bold text-sky-900"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {rIdx + 1}
                    </td>

                    {/* Cells */}
                    {columns.map((col, cIdx) => {
                      const isCellActive =
                        activeCell?.rIdx === rIdx && activeCell?.cIdx === cIdx;
                      const rawVal = cells[col.id];

                      // 1. Result Column (L / TB / G)
                      if (col.isResult) {
                        const isAuto = autoLocked[col.id] !== false && col.lockAutoResult !== false;
                        const currResult = rawVal || "";

                        return (
                          <td
                            key={col.id}
                            onClick={() =>
                              setActiveCell({ rowId, colId: col.id, rIdx, cIdx })
                            }
                            className={`border-r border-slate-300 px-2 py-1 text-center align-middle transition-all ${
                              isCellActive
                                ? "ring-2 ring-sky-500 z-10 bg-sky-50/50"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Result Badge */}
                              <ResultBadge value={currResult} />

                              {/* Toggle Auto / Manual Lock */}
                              {canEdit && (
                                <div className="flex items-center gap-1 ml-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextIsAuto = !isAuto;
                                      if (onManualResultChange) {
                                        onManualResultChange(
                                          rowId,
                                          col.id,
                                          nextIsAuto ? "" : (currResult || "L"),
                                          nextIsAuto
                                        );
                                      }
                                    }}
                                    title={
                                      isAuto
                                        ? "Kunci Otomatis (Klik untuk ubah manual)"
                                        : "Pilihan Manual (Klik untuk kunci otomatis)"
                                    }
                                    className={`p-1 rounded text-[11px] transition ${
                                      isAuto
                                        ? "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                        : "text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-300"
                                    }`}
                                  >
                                    {isAuto ? (
                                      <FiLock size={11} />
                                    ) : (
                                      <FiUnlock size={11} />
                                    )}
                                  </button>

                                  {/* Manual Selector if unlocked */}
                                  {!isAuto && (
                                    <div className="flex gap-0.5 ml-0.5">
                                      {["L", "TB", "G"].map((opt) => (
                                        <button
                                          key={opt}
                                          type="button"
                                          onClick={() => {
                                            if (onManualResultChange) {
                                              onManualResultChange(
                                                rowId,
                                                col.id,
                                                opt,
                                                false
                                              );
                                            }
                                          }}
                                          className={`px-1 py-0.5 rounded text-[10px] font-bold border transition ${
                                            currResult === opt
                                              ? opt === "L"
                                                ? "bg-emerald-600 text-white border-emerald-600"
                                                : opt === "TB"
                                                ? "bg-slate-600 text-white border-slate-600"
                                                : "bg-red-600 text-white border-red-600"
                                              : "bg-white text-slate-500 border-slate-300 hover:border-slate-500"
                                          }`}
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      }

                      // 2. Computed Formula Column (Read-only)
                      if (!col.editable) {
                        return (
                          <td
                            key={col.id}
                            onClick={() =>
                              setActiveCell({ rowId, colId: col.id, rIdx, cIdx })
                            }
                            className={`border-r border-slate-300 px-2.5 py-1.5 text-center font-mono font-medium text-navy-900 bg-slate-50/70 cursor-pointer ${
                              isCellActive
                                ? "ring-2 ring-sky-500 bg-sky-50 z-10"
                                : ""
                            }`}
                          >
                            <span>
                              {rawVal !== "" && rawVal != null ? rawVal : "—"}
                            </span>
                          </td>
                        );
                      }

                      // 3. Editable Input Cell (User input)
                      return (
                        <td
                          key={col.id}
                          className={`border-r border-slate-300 p-0 relative ${
                            isCellActive ? "ring-2 ring-sky-500 z-10" : ""
                          }`}
                        >
                          {canEdit ? (
                            col.inputType === "dropdown" ? (
                              <select
                                data-coord={`${rIdx}-${cIdx}`}
                                value={rawVal ?? ""}
                                onFocus={() =>
                                  setActiveCell({
                                    rowId,
                                    colId: col.id,
                                    rIdx,
                                    cIdx,
                                  })
                                }
                                onKeyDown={(e) =>
                                  handleKeyDown(e, rIdx, cIdx, col)
                                }
                                onChange={(e) =>
                                  onCellChange(rowId, col.id, e.target.value)
                                }
                                className="w-full h-8 px-2 bg-transparent text-xs outline-none cursor-pointer"
                              >
                                <option value=""></option>
                                {(col.dropdownOptions || []).map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                data-coord={`${rIdx}-${cIdx}`}
                                type={
                                  col.inputType === "number" ? "number" : "text"
                                }
                                step="any"
                                value={rawVal ?? ""}
                                onFocus={() =>
                                  setActiveCell({
                                    rowId,
                                    colId: col.id,
                                    rIdx,
                                    cIdx,
                                  })
                                }
                                onKeyDown={(e) =>
                                  handleKeyDown(e, rIdx, cIdx, col)
                                }
                                onChange={(e) =>
                                  onCellChange(rowId, col.id, e.target.value)
                                }
                                className="w-full h-8 px-2 text-center text-xs bg-transparent outline-none focus:bg-white"
                                placeholder="-"
                              />
                            )
                          ) : (
                            <div className="h-8 px-2 flex items-center justify-center text-xs text-slate-700">
                              {rawVal ?? "—"}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Delete Added Row Action */}
                    {canEdit && (
                      <td className="px-1 text-center align-middle">
                        {isAdded && (
                          <button
                            type="button"
                            onClick={() => onRemoveRow(rowId)}
                            className="p-1 text-slate-400 hover:text-red-500 transition rounded hover:bg-red-50"
                            title="Hapus baris ini"
                          >
                            <FiTrash2 size={11} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Row Button */}
      {canEdit && section.allowAddRows && (
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-slate-300 rounded-md text-xs font-medium text-slate-600 hover:border-sky-500 hover:text-sky-600 hover:bg-sky-50/50 transition"
        >
          <FiPlus size={12} />
          Tambah Baris Pengukuran
        </button>
      )}
    </div>
  );
}

function ResultBadge({ value }) {
  if (!value) return <span className="text-slate-300 text-xs font-mono">—</span>;
  const s = {
    L: "bg-emerald-100 text-emerald-800 border-emerald-300",
    TB: "bg-slate-100 text-slate-700 border-slate-300",
    G: "bg-red-100 text-red-800 border-red-300 font-bold",
  };
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
        s[value] || "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {value}
    </span>
  );
}

