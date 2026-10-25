// src/components/SpreadsheetTemplateDesigner.jsx
//
// Simple spreadsheet-like template designer for Engineers.
// Features:
// - Direct visual spreadsheet table canvas
// - Add / remove columns & rows (+ Kolom, + Baris)
// - Merge headers (gabung 2+ kolom bersebelahan dengan satu judul payung)
// - Toggle hak akses: "Boleh Diisi Teknisi" vs "Terkunci / Rumus"
// - Formula input (=C - B, =AVERAGE(B, C, D), =ROUND)
// - Hasil evaluasi L / TB / G (<= 60, IF condition)

import React, { useState } from "react";
import {
  FiPlus,
  FiTrash2,
  FiLayers,
  FiSettings,
  FiCheck,
  FiX,
  FiHelpCircle,
  FiCheckSquare,
  FiSquare,
} from "react-icons/fi";
import {
  indexToColLetter,
  genId,
  passRuleToString,
  formulaToString,
} from "../utils/tableFormulas";

export default function SpreadsheetTemplateDesigner({
  section,
  onChange,
}) {
  const columns = section.columns || [];
  const fixedRows = section.fixedRows || [];
  const headerGroups = section.headerGroups || [];

  const [activeColIdx, setActiveColIdx] = useState(0);
  const [mergeSelection, setMergeSelection] = useState([]); // array of col ids
  const [mergeTitle, setMergeTitle] = useState("");
  const [isMerging, setIsMerging] = useState(false);

  const activeCol = columns[activeColIdx] || null;

  // ── Column Mutations ───────────────────────────────────────────────────────
  function addColumn() {
    const nextIdx = columns.length;
    const newId = genId("c");
    const newCol = {
      id: newId,
      header: `Kolom ${indexToColLetter(nextIdx)}`,
      inputType: "number",
      editable: true,
      isResult: false,
    };
    const nextCols = [...columns, newCol];
    const nextRows = fixedRows.map((r) => ({
      ...r,
      cells: { ...(r.cells || {}), [newId]: "" },
    }));
    onChange({
      ...section,
      columns: nextCols,
      fixedRows: nextRows,
    });
    setActiveColIdx(nextCols.length - 1);
  }

  function removeColumn(cIdx) {
    if (columns.length <= 1) {
      alert("Tabel harus memiliki minimal 1 kolom.");
      return;
    }
    const removedId = columns[cIdx].id;
    const nextCols = columns.filter((_, idx) => idx !== cIdx);
    const nextRows = fixedRows.map((r) => {
      const copy = { ...(r.cells || {}) };
      delete copy[removedId];
      return { ...r, cells: copy };
    });
    // Remove from headerGroups if present
    const nextGroups = headerGroups
      .map((g) => ({
        ...g,
        colIds: (g.colIds || []).filter((id) => id !== removedId),
      }))
      .filter((g) => g.colIds.length > 1);

    onChange({
      ...section,
      columns: nextCols,
      fixedRows: nextRows,
      headerGroups: nextGroups,
    });
    setActiveColIdx(Math.max(0, cIdx - 1));
  }

  function updateActiveColumn(field, value) {
    if (!activeCol) return;
    const nextCols = columns.map((col, idx) => {
      if (idx !== activeColIdx) return col;
      const updated = { ...col, [field]: value };
      if (field === "isFormula" && value) {
        updated.editable = false;
        if (!updated.formula) updated.formula = "=B - A";
      } else if (field === "isFormula" && !value) {
        delete updated.formula;
        updated.editable = true;
      }

      if (field === "isResult" && value) {
        updated.editable = false;
        if (!updated.passRule) updated.passRule = "<= 60";
        if (updated.lockAutoResult === undefined) updated.lockAutoResult = true;
      } else if (field === "isResult" && !value) {
        delete updated.passRule;
        delete updated.lockAutoResult;
        updated.editable = true;
      }
      return updated;
    });
    onChange({ ...section, columns: nextCols });
  }

  // ── Row Mutations ──────────────────────────────────────────────────────────
  function addRow() {
    const newRowId = genId("r");
    const emptyCells = {};
    columns.forEach((c) => {
      emptyCells[c.id] = "";
    });
    const nextRows = [...fixedRows, { id: newRowId, cells: emptyCells }];
    onChange({ ...section, fixedRows: nextRows });
  }

  function removeRow(rIdx) {
    const nextRows = fixedRows.filter((_, idx) => idx !== rIdx);
    onChange({ ...section, fixedRows: nextRows });
  }

  function updateRowCell(rIdx, colId, value) {
    const nextRows = fixedRows.map((row, idx) => {
      if (idx !== rIdx) return row;
      return {
        ...row,
        cells: { ...(row.cells || {}), [colId]: value },
      };
    });
    onChange({ ...section, fixedRows: nextRows });
  }

  // ── Header Merging ─────────────────────────────────────────────────────────
  function toggleMergeSelect(colId) {
    setMergeSelection((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
    );
  }

  function applyMerge() {
    if (mergeSelection.length < 2) {
      alert("Pilih minimal 2 kolom untuk digabungkan (merge).");
      return;
    }
    if (!mergeTitle.trim()) {
      alert("Masukkan judul untuk kolom yang digabung.");
      return;
    }
    const newGroup = {
      id: genId("grp"),
      title: mergeTitle.trim(),
      colIds: [...mergeSelection],
    };
    // Remove existing groups overlapping with selection
    const cleanGroups = headerGroups.filter(
      (g) => !g.colIds.some((id) => mergeSelection.includes(id))
    );
    onChange({
      ...section,
      headerGroups: [...cleanGroups, newGroup],
    });
    setMergeSelection([]);
    setMergeTitle("");
    setIsMerging(false);
  }

  function removeGroup(groupId) {
    const nextGroups = headerGroups.filter((g) => g.id !== groupId);
    onChange({ ...section, headerGroups: nextGroups });
  }

  return (
    <div className="space-y-4">
      {/* 1. SPREADSHEET TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 border border-slate-300 rounded-lg">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={addColumn}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 hover:bg-sky-50 hover:border-sky-400 hover:text-sky-700 transition"
          >
            <FiPlus size={13} className="text-sky-600" /> + Tambah Kolom
          </button>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 hover:bg-sky-50 hover:border-sky-400 hover:text-sky-700 transition"
          >
            <FiPlus size={13} className="text-sky-600" /> + Tambah Baris
          </button>

          <div className="h-5 w-px bg-slate-300 mx-1" />

          {/* Merge Header Button */}
          <button
            type="button"
            onClick={() => setIsMerging(!isMerging)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition ${
              isMerging
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-slate-700 border-slate-300 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-800"
            }`}
          >
            <FiLayers size={13} />
            {isMerging ? "Batal Merge" : "Merge Header"}
          </button>
        </div>

        {/* Global Settings */}
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            className="accent-navy-700 w-3.5 h-3.5"
            checked={section.allowAddRows ?? true}
            onChange={(e) =>
              onChange({ ...section, allowAddRows: e.target.checked })
            }
          />
          <span>Teknisi boleh tambah baris (+ Tambah Baris)</span>
        </label>
      </div>

      {/* 2. MERGE HEADER CREATION PANEL (when isMerging active) */}
      {isMerging && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
          <p className="text-xs font-semibold text-amber-900">
            Centang kolom yang ingin digabungkan, lalu masukkan judul payungnya:
          </p>
          <div className="flex flex-wrap gap-2">
            {columns.map((c, idx) => {
              const letter = indexToColLetter(idx);
              const isChecked = mergeSelection.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleMergeSelect(c.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition ${
                    isChecked
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-white text-slate-700 border-slate-300 hover:border-amber-400"
                  }`}
                >
                  {isChecked ? <FiCheckSquare size={12} /> : <FiSquare size={12} />}
                  <strong>{letter}</strong>: {c.header}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={mergeTitle}
              onChange={(e) => setMergeTitle(e.target.value)}
              placeholder="Judul Header Gabungan (contoh: Pengukuran Suhu)"
              className="px-3 py-1.5 border border-amber-300 rounded text-xs text-navy-900 bg-white flex-1 outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={applyMerge}
              className="px-4 py-1.5 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 transition"
            >
              Terapkan Merge
            </button>
          </div>
        </div>
      )}

      {/* 3. VISUAL SPREADSHEET CANVAS */}
      <div className="border border-slate-300 rounded-lg overflow-x-auto bg-white shadow-sm">
        <table className="w-full border-collapse text-xs select-none min-w-max">
          <thead>
            {/* TIER 1: Merged Headers (if any) */}
            {headerGroups.length > 0 && (
              <tr className="bg-slate-200 border-b border-slate-300 text-center text-navy-900 font-bold">
                <th className="w-9 border-r border-slate-300" />
                {(() => {
                  const renderedColIds = new Set();
                  const cells = [];

                  columns.forEach((col, idx) => {
                    if (renderedColIds.has(col.id)) return;
                    const group = headerGroups.find((g) =>
                      g.colIds.includes(col.id)
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
                          <div className="flex items-center justify-center gap-1.5">
                            <span>{group.title}</span>
                            <button
                              type="button"
                              onClick={() => removeGroup(group.id)}
                              title="Hapus merge"
                              className="text-amber-700 hover:text-red-600 p-0.5 rounded"
                            >
                              <FiX size={11} />
                            </button>
                          </div>
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
                <th className="w-8" />
              </tr>
            )}

            {/* TIER 2: Column Letters (A, B, C...) with Active Highlight */}
            <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-mono text-center">
              <th className="w-9 border-r border-slate-300 py-1 text-[10px] bg-slate-200 text-slate-500 font-bold">
                #
              </th>
              {columns.map((col, idx) => {
                const isActive = idx === activeColIdx;
                const letter = indexToColLetter(idx);
                return (
                  <th
                    key={col.id}
                    onClick={() => setActiveColIdx(idx)}
                    className={`border-r border-slate-300 py-1 px-2 cursor-pointer transition ${
                      isActive
                        ? "bg-sky-200 text-sky-900 font-extrabold border-b-2 border-b-sky-600"
                        : "hover:bg-slate-200"
                    }`}
                  >
                    {letter}
                  </th>
                );
              })}
              <th className="w-8 border-b border-slate-300" />
            </tr>

            {/* TIER 3: Column Headers with Action Badges */}
            <tr className="bg-white border-b-2 border-slate-300">
              <th className="border-r border-slate-300 text-slate-400 font-normal text-center text-[10px]">
                No
              </th>
              {columns.map((col, idx) => {
                const isActive = idx === activeColIdx;
                const isFormula = !!col.formula;
                const isResult = !!col.isResult;
                const isEditable = col.editable && !isFormula && !isResult;

                return (
                  <th
                    key={col.id}
                    onClick={() => setActiveColIdx(idx)}
                    className={`border-r border-slate-300 px-2 py-2 text-left cursor-pointer transition ${
                      isActive ? "bg-sky-50/70" : "hover:bg-slate-50"
                    }`}
                    style={col.width ? { minWidth: col.width } : { minWidth: "125px" }}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-navy-900 text-xs truncate">
                        {col.header || `Kolom ${indexToColLetter(idx)}`}
                      </span>
                      {isActive && (
                        <span className="p-0.5 bg-sky-600 text-white rounded text-[10px]">
                          <FiSettings size={10} />
                        </span>
                      )}
                    </div>

                    {/* Role badge tag */}
                    <div className="flex items-center gap-1">
                      {isEditable && (
                        <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium">
                          Teknisi Isi
                        </span>
                      )}
                      {isFormula && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 font-medium">
                          fx: {typeof col.formula === "string" ? col.formula : formulaToString(col.formula, columns) || "rumus"}
                        </span>
                      )}
                      {isResult && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 border border-purple-300 font-medium">
                          {typeof col.passRule === "string"
                            ? col.passRule
                            : passRuleToString(col.passRule, columns) || "L/TB/G"}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="w-8 border-b-2 border-slate-300 text-center text-slate-400 text-[10px]">
                Aksi
              </th>
            </tr>
          </thead>

          {/* SPREADSHEET ROWS */}
          <tbody>
            {fixedRows.map((row, rIdx) => (
              <tr
                key={row.id || rIdx}
                className="border-b border-slate-200 hover:bg-slate-50 transition"
              >
                <td className="border-r border-slate-300 text-center font-mono text-[10px] bg-slate-100 text-slate-500 py-1">
                  {rIdx + 1}
                </td>
                {columns.map((col, cIdx) => {
                  const isActive = cIdx === activeColIdx;
                  return (
                    <td
                      key={col.id}
                      onClick={() => setActiveColIdx(cIdx)}
                      className={`border-r border-slate-300 p-0 ${
                        isActive ? "bg-sky-50/40" : ""
                      }`}
                    >
                      <input
                        type="text"
                        value={row.cells?.[col.id] ?? ""}
                        onChange={(e) =>
                          updateRowCell(rIdx, col.id, e.target.value)
                        }
                        placeholder={
                          col.formula
                            ? "[auto fx]"
                            : col.isResult
                            ? "[L/TB/G]"
                            : "-"
                        }
                        className="w-full h-7 px-2 text-xs bg-transparent outline-none focus:bg-white text-center text-slate-700"
                      />
                    </td>
                  );
                })}
                <td className="px-1 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => removeRow(rIdx)}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                    title="Hapus baris ini"
                  >
                    <FiTrash2 size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. ACTIVE COLUMN INSPECTOR (Card popover below spreadsheet) */}
      {activeCol && (
        <div className="p-4 bg-slate-50 border-2 border-sky-500 rounded-lg shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-sky-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                {indexToColLetter(activeColIdx)}
              </span>
              <span className="text-xs font-bold text-navy-900">
                Pengaturan Kolom {indexToColLetter(activeColIdx)}: {activeCol.header}
              </span>
            </div>
            <button
              type="button"
              onClick={() => removeColumn(activeColIdx)}
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition"
            >
              <FiTrash2 size={12} /> Hapus Kolom Ini
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Field 1: Header Title */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Nama / Judul Kolom
              </label>
              <input
                type="text"
                value={activeCol.header || ""}
                onChange={(e) => updateActiveColumn("header", e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-navy-900 outline-none focus:border-sky-500 font-medium"
              />
            </div>

            {/* Field 2: Tipe Input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Tipe Input Sel
              </label>
              <select
                value={activeCol.inputType || "number"}
                onChange={(e) =>
                  updateActiveColumn("inputType", e.target.value)
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-navy-900 outline-none focus:border-sky-500"
              >
                <option value="number">Angka (Number)</option>
                <option value="text">Teks Bebas (Text)</option>
                <option value="dropdown">Pilihan Dropdown</option>
              </select>
            </div>

            {/* Field 3: Lebar Kolom */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Lebar Minimal Kolom (px)
              </label>
              <input
                type="number"
                value={activeCol.width || 120}
                onChange={(e) =>
                  updateActiveColumn("width", parseInt(e.target.value, 10) || 120)
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-navy-900 outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Role Checkboxes */}
          <div className="p-3 bg-white border border-slate-300 rounded-md space-y-3">
            <span className="text-xs font-bold text-slate-800 block">
              Peran & Hak Akses Teknisi
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Option A: Boleh diisi teknisi */}
              <label className="flex items-start gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  className="accent-emerald-600 w-4 h-4 mt-0.5"
                  checked={
                    activeCol.editable &&
                    !activeCol.formula &&
                    !activeCol.isResult
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateActiveColumn("editable", true);
                      updateActiveColumn("isFormula", false);
                      updateActiveColumn("isResult", false);
                    } else {
                      updateActiveColumn("editable", false);
                    }
                  }}
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Boleh Diisi Teknisi
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block">
                    Teknisi mengetik pembacaan alat uji langsung.
                  </span>
                </div>
              </label>

              {/* Option B: Kolom Rumus (Formula) */}
              <label className="flex items-start gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  className="accent-amber-600 w-4 h-4 mt-0.5"
                  checked={!!activeCol.formula}
                  onChange={(e) =>
                    updateActiveColumn("isFormula", e.target.checked)
                  }
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Kolom Rumus (fx)
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block">
                    Dihitung otomatis (misal kenaikan suhu = C - B).
                  </span>
                </div>
              </label>

              {/* Option C: Kolom Keputusan (L/TB/G) */}
              <label className="flex items-start gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  className="accent-purple-600 w-4 h-4 mt-0.5"
                  checked={!!activeCol.isResult}
                  onChange={(e) =>
                    updateActiveColumn("isResult", e.target.checked)
                  }
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Hasil Lulus / Gagal
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight block">
                    Evaluasi otomatis status L, TB, atau G.
                  </span>
                </div>
              </label>
            </div>

            {/* Sub-Panel: Formula Input */}
            {activeCol.formula && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">
                    Ketik Rumus Excel:
                  </span>
                  <span className="text-[10px] text-amber-700">
                    Contoh: <code>=C - B</code> atau <code>=AVERAGE(B, C, D)</code>
                  </span>
                </div>
                <input
                  type="text"
                  value={
                    typeof activeCol.formula === "string"
                      ? activeCol.formula
                      : formulaToString(activeCol.formula, columns) || "=C - B"
                  }
                  onChange={(e) =>
                    updateActiveColumn("formula", e.target.value)
                  }
                  placeholder="=C - B"
                  className="w-full px-2.5 py-1.5 border border-amber-300 rounded text-xs font-mono text-navy-900 bg-white outline-none focus:border-amber-600 font-bold"
                />
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="text-slate-500">Sisipkan kolom:</span>
                  {columns.map((c, i) => {
                    if (i === activeColIdx) return null;
                    const letter = indexToColLetter(i);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          const curr =
                            typeof activeCol.formula === "string"
                              ? activeCol.formula
                              : "";
                          updateActiveColumn(
                            "formula",
                            (curr ? curr + " " : "=") + letter
                          );
                        }}
                        className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-700 hover:bg-amber-100 font-mono text-xs"
                      >
                        <strong>{letter}</strong> ({c.header})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sub-Panel: Pass Rule Input */}
            {activeCol.isResult && (
              <div className="p-2.5 bg-purple-50 border border-purple-300 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900">
                    Aturan Batas Lulus / Gagal:
                  </span>
                  <span className="text-[10px] text-purple-700">
                    Contoh: <code>&lt;= 60</code> atau <code>=IF(D &lt;= 60, "L", "G")</code>
                  </span>
                </div>
                <input
                  type="text"
                  value={
                    typeof activeCol.passRule === "string"
                      ? activeCol.passRule
                      : passRuleToString(activeCol.passRule, columns) || "<= 60"
                  }
                  onChange={(e) =>
                    updateActiveColumn("passRule", e.target.value)
                  }
                  placeholder="<= 60"
                  className="w-full px-2.5 py-1.5 border border-purple-300 rounded text-xs font-mono text-navy-900 bg-white outline-none focus:border-purple-600 font-bold"
                />
                <label className="flex items-center gap-1.5 text-xs text-purple-900 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    className="accent-purple-700 w-3.5 h-3.5"
                    checked={activeCol.lockAutoResult !== false}
                    onChange={(e) =>
                      updateActiveColumn("lockAutoResult", e.target.checked)
                    }
                  />
                  <span>
                    Kunci Otomatis (L/TB/G dihitung sistem, teknisi tidak bisa ubah kecuali dibuka gembok)
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

