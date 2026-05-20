// src/components/TableInstanceEditor.jsx
//
// Fixed bugs from previous version:
// 1. setLoading(false) was missing in finally block — spinner never disappeared
// 2. subClauseCode filter now also matches parent clause (e.g. templates saved
//    against "6" are shown when rendering sub-clause "6.1")
// 3. Error handling added to all API calls — errors are surfaced to user
// 4. null-guard on template.definition before rendering sections

import React, { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { FaPlus, FaTrash, FaSave, FaSpinner } from "react-icons/fa";
import apiClient from "../api";
import { resolveComputedCells } from "../utils/tableFormulas";

export default function TableInstanceEditor({
  reportId,
  subClauseCode,
  reportStatus,
  userRole,
}) {
  const [instances, setInstances] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState({});
  const [dirty, setDirty] = useState({});

  const isLocked = reportStatus === "APPROVED";
  const canEdit = !isLocked;

  // ── Load instances + autoprovision ───────────────────────────────────────
  const load = useCallback(async () => {
    if (!reportId || !subClauseCode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Autoprovision — safe to call every time, idempotent
      await apiClient.post(
        `/reports/${reportId}/table-instances/autoprovision`,
      );

      // Fetch instances for this sub-clause
      const res = await apiClient.get(
        `/reports/${reportId}/table-instances?subClauseCode=${encodeURIComponent(subClauseCode)}`,
      );
      setInstances(res.data || []);

      // Fetch all templates for this report's standard, grouped by subClauseCode
      const tplRes = await apiClient.get(
        `/reports/${reportId}/table-templates`,
      );
      const grouped = tplRes.data || {};

      // Match templates by exact subClauseCode OR by parent clause code.
      // e.g. if subClauseCode = "6.1", also show templates saved for "6"
      const parentCode = subClauseCode.split(".")[0];
      const matched = [
        ...(grouped[subClauseCode] || []),
        // avoid duplicates if exact match === parent match
        ...(parentCode !== subClauseCode ? grouped[parentCode] || [] : []),
      ];
      setTemplates(matched);
    } catch (e) {
      console.error("TableInstanceEditor load error:", e);
      setError("Gagal memuat tabel lampiran. Coba refresh halaman.");
    } finally {
      // BUG FIX: this was missing — caused infinite spinner
      setLoading(false);
    }
  }, [reportId, subClauseCode]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Auto-save on idle (1.5s after last keystroke) ────────────────────────
  const timers = useRef({});

  function markDirty(instanceId) {
    setDirty((prev) => ({ ...prev, [instanceId]: true }));
    clearTimeout(timers.current[instanceId]);
    timers.current[instanceId] = setTimeout(() => {
      saveInstance(instanceId);
    }, 1500);
  }

  // Cleanup timers on unmount
  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────
  async function saveInstance(instanceId) {
    const inst = instances.find((i) => i.id === instanceId);
    if (!inst) return;
    setSaving((prev) => ({ ...prev, [instanceId]: true }));
    try {
      const res = await apiClient.put(`/table-instances/${instanceId}`, {
        data: inst.data,
      });
      setInstances((prev) =>
        prev.map((i) =>
          i.id === instanceId ? { ...i, data: res.data.data } : i,
        ),
      );
      setDirty((prev) => ({ ...prev, [instanceId]: false }));
    } catch (e) {
      toast.error("Gagal menyimpan tabel");
      console.error(e);
    } finally {
      setSaving((prev) => ({ ...prev, [instanceId]: false }));
    }
  }

  // ── Add another instance ─────────────────────────────────────────────────
  async function addInstance(templateId) {
    try {
      const res = await apiClient.post(`/reports/${reportId}/table-instances`, {
        templateId,
      });
      setInstances((prev) => [...prev, res.data]);
      toast.success("Tabel baru ditambahkan");
    } catch (e) {
      toast.error(e.response?.data?.error || "Gagal menambah tabel");
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function deleteInstance(instanceId) {
    if (!window.confirm("Hapus tabel ini?")) return;
    try {
      await apiClient.delete(`/table-instances/${instanceId}`);
      setInstances((prev) => prev.filter((i) => i.id !== instanceId));
      toast.success("Tabel dihapus");
    } catch (e) {
      toast.error(e.response?.data?.error || "Gagal menghapus tabel");
    }
  }

  // ── Cell mutations ───────────────────────────────────────────────────────
  function setCellValue(instanceId, sectionIdx, rowId, colId, value) {
    setInstances((prev) =>
      prev.map((inst) => {
        if (inst.id !== instanceId) return inst;
        const data = JSON.parse(JSON.stringify(inst.data || {}));
        if (!data.sections) data.sections = {};
        if (!data.sections[sectionIdx])
          data.sections[sectionIdx] = { rows: {} };
        if (!data.sections[sectionIdx].rows)
          data.sections[sectionIdx].rows = {};
        if (!data.sections[sectionIdx].rows[rowId])
          data.sections[sectionIdx].rows[rowId] = { cells: {} };
        data.sections[sectionIdx].rows[rowId].cells[colId] = value;
        return { ...inst, data };
      }),
    );
    markDirty(instanceId);
  }

  function setKvValue(instanceId, sectionIdx, rowId, field, value) {
    setInstances((prev) =>
      prev.map((inst) => {
        if (inst.id !== instanceId) return inst;
        const data = JSON.parse(JSON.stringify(inst.data || {}));
        if (!data.sections) data.sections = {};
        if (!data.sections[sectionIdx]) data.sections[sectionIdx] = { kv: {} };
        if (!data.sections[sectionIdx].kv) data.sections[sectionIdx].kv = {};
        if (!data.sections[sectionIdx].kv[rowId])
          data.sections[sectionIdx].kv[rowId] = {};
        data.sections[sectionIdx].kv[rowId][field] = value;
        return { ...inst, data };
      }),
    );
    markDirty(instanceId);
  }

  function addRow(instanceId, sectionIdx, columns) {
    const rowId =
      "added-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5);
    setInstances((prev) =>
      prev.map((inst) => {
        if (inst.id !== instanceId) return inst;
        const data = JSON.parse(JSON.stringify(inst.data || {}));
        if (!data.sections) data.sections = {};
        if (!data.sections[sectionIdx]) data.sections[sectionIdx] = {};
        if (!data.sections[sectionIdx].addedRows)
          data.sections[sectionIdx].addedRows = [];
        const cells = {};
        columns.forEach((c) => {
          cells[c.id] = "";
        });
        data.sections[sectionIdx].addedRows.push({ rowId, cells });
        return { ...inst, data };
      }),
    );
    markDirty(instanceId);
  }

  function removeAddedRow(instanceId, sectionIdx, rowId) {
    setInstances((prev) =>
      prev.map((inst) => {
        if (inst.id !== instanceId) return inst;
        const data = JSON.parse(JSON.stringify(inst.data || {}));
        if (data.sections?.[sectionIdx]?.addedRows) {
          data.sections[sectionIdx].addedRows = data.sections[
            sectionIdx
          ].addedRows.filter((r) => r.rowId !== rowId);
        }
        return { ...inst, data };
      }),
    );
    markDirty(instanceId);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-gray-400 py-2">
        <FaSpinner className="animate-spin" size={12} />
        Memuat tabel lampiran...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 text-sm text-red-500 flex items-center gap-2 py-2">
        {error}
        <button onClick={load} className="underline text-sky-600">
          Coba lagi
        </button>
      </div>
    );
  }

  // If no templates exist for this clause, render nothing (no noise for clauses without tables)
  if (instances.length === 0 && templates.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-5">
      {instances.map((inst) => {
        const template = inst.template;
        if (!template?.definition) return null;

        const def = template.definition;
        const sameTemplate = instances.filter(
          (i) => i.templateId === inst.templateId,
        );
        const copyNum = sameTemplate.findIndex((i) => i.id === inst.id) + 1;

        return (
          <div
            key={inst.id}
            className="border rounded-lg bg-white overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-800">
                  {template.title || "Tabel Lampiran"}
                </span>
                {sameTemplate.length > 1 && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 rounded">
                    Pengulangan {copyNum}
                  </span>
                )}
                {dirty[inst.id] && (
                  <span className="text-xs text-amber-500">
                    ● belum tersimpan
                  </span>
                )}
                {saving[inst.id] && (
                  <span className="flex items-center gap-1 text-xs text-sky-500">
                    <FaSpinner className="animate-spin" size={9} /> menyimpan...
                  </span>
                )}
              </div>
              {canEdit && (
                <div className="flex gap-2 shrink-0">
                  {dirty[inst.id] && (
                    <button
                      onClick={() => saveInstance(inst.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-sky-600 text-white rounded text-xs"
                    >
                      <FaSave size={10} /> Simpan
                    </button>
                  )}
                  {inst.order > 0 && (
                    <button
                      onClick={() => deleteInstance(inst.id)}
                      className="px-2 py-1 border border-red-200 text-red-500 rounded text-xs hover:bg-red-50"
                    >
                      <FaTrash size={10} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Sections */}
            <div className="p-3 space-y-4">
              {(def.sections || []).map((section, sIdx) => {
                const sData = inst.data?.sections?.[sIdx] || {};
                if (section.type === "key_value") {
                  return (
                    <KvSectionRenderer
                      key={sIdx}
                      section={section}
                      sData={sData}
                      canEdit={canEdit}
                      onKvChange={(rowId, field, value) =>
                        setKvValue(inst.id, sIdx, rowId, field, value)
                      }
                    />
                  );
                }
                if (section.type === "table") {
                  return (
                    <TableSectionRenderer
                      key={sIdx}
                      section={section}
                      sData={sData}
                      canEdit={canEdit}
                      onCellChange={(rowId, colId, value) =>
                        setCellValue(inst.id, sIdx, rowId, colId, value)
                      }
                      onAddRow={() => addRow(inst.id, sIdx, section.columns)}
                      onRemoveRow={(rowId) =>
                        removeAddedRow(inst.id, sIdx, rowId)
                      }
                    />
                  );
                }
                return null;
              })}
            </div>
          </div>
        );
      })}

      {/* Add another instance */}
      {canEdit && templates.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => addInstance(t.id)}
              className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-gray-300 rounded text-xs text-gray-500 hover:border-sky-400 hover:text-sky-600 transition"
            >
              <FaPlus size={9} />
              Ulangi: {t.title || "Tabel ini"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Key-value section ─────────────────────────────────────────────────────────
function KvSectionRenderer({ section, sData, canEdit, onKvChange }) {
  const kv = sData.kv || {};
  return (
    <div>
      {section.label && (
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
          {section.label}
        </p>
      )}
      <table className="w-full border-collapse text-sm">
        <tbody>
          {(section.rows || []).map((row) => {
            const rowData = kv[row.id] || {};
            return (
              <tr key={row.id} className="border-b last:border-b-0">
                <td className="py-2 pr-3 text-gray-700 w-1/2 align-middle text-sm">
                  {row.label}
                  {row.required && <span className="text-red-400 ml-1">*</span>}
                </td>
                <td className="py-1 pr-2 align-middle">
                  {canEdit ? (
                    <input
                      type={row.inputType === "number" ? "number" : "text"}
                      value={rowData.value ?? ""}
                      onChange={(e) =>
                        onKvChange(row.id, "value", e.target.value)
                      }
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  ) : (
                    <span className="text-gray-700">
                      {rowData.value || "-"}
                    </span>
                  )}
                </td>
                <td className="py-1 w-24 text-center align-middle">
                  {canEdit ? (
                    <ResultSelector
                      value={rowData.result || ""}
                      onChange={(v) => onKvChange(row.id, "result", v)}
                    />
                  ) : (
                    <ResultBadge value={rowData.result} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Table section ─────────────────────────────────────────────────────────────
function TableSectionRenderer({
  section,
  sData,
  canEdit,
  onCellChange,
  onAddRow,
  onRemoveRow,
}) {
  const columns = section.columns || [];
  const fixedRows = section.fixedRows || [];
  const addedRows = sData.addedRows || [];
  const storedRows = sData.rows || {};

  const allRows = [
    ...fixedRows.map((fr) => ({
      rowId: fr.id,
      isAdded: false,
      rawCells: { ...fr.cells, ...((storedRows[fr.id] || {}).cells || {}) },
    })),
    ...addedRows.map((ar) => ({
      rowId: ar.rowId,
      isAdded: true,
      rawCells: ar.cells || {},
    })),
  ];

  const resolvedRows = allRows.map((row) => ({
    ...row,
    cells: resolveComputedCells(row.rawCells, columns),
  }));

  // Row group labels
  const groupLabels = {};
  (section.rowGroups || []).forEach((g) => {
    g.rowIds.forEach((id) => {
      groupLabels[id] = g.label;
    });
  });
  const renderedGroups = new Set();

  return (
    <div>
      {section.label && (
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
          {section.label}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-max">
          <thead>
            <tr className="bg-gray-100">
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="border border-gray-300 px-2 py-1.5 text-left text-xs font-medium whitespace-nowrap"
                  style={col.width ? { minWidth: col.width } : {}}
                >
                  {col.header}
                  {!col.editable && !col.isResult && (
                    <span className="ml-1 text-amber-500 font-normal">
                      [auto]
                    </span>
                  )}
                </th>
              ))}
              {canEdit && <th className="border border-gray-300 w-6" />}
            </tr>
          </thead>
          <tbody>
            {resolvedRows.map(({ rowId, isAdded, cells }) => {
              const groupLabel = groupLabels[rowId];
              const showGroup = groupLabel && !renderedGroups.has(groupLabel);
              if (groupLabel) renderedGroups.add(groupLabel);

              return (
                <React.Fragment key={rowId}>
                  {showGroup && (
                    <tr>
                      <td
                        colSpan={columns.length + (canEdit ? 1 : 0)}
                        className="border border-gray-300 px-2 py-1 bg-gray-50 text-xs font-medium text-gray-600"
                      >
                        {groupLabel}
                      </td>
                    </tr>
                  )}
                  <tr className={isAdded ? "bg-sky-50" : "hover:bg-gray-50"}>
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className="border border-gray-300 px-2 py-1"
                      >
                        {col.isResult ? (
                          <ResultBadge value={cells[col.id]} />
                        ) : !col.editable ? (
                          <span className="text-gray-500 text-xs">
                            {cells[col.id] !== "" && cells[col.id] != null
                              ? cells[col.id]
                              : "—"}
                          </span>
                        ) : canEdit ? (
                          col.inputType === "dropdown" ? (
                            <select
                              value={cells[col.id] ?? ""}
                              onChange={(e) =>
                                onCellChange(rowId, col.id, e.target.value)
                              }
                              className="w-full border rounded px-1 py-0.5 text-xs"
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
                              type={
                                col.inputType === "number" ? "number" : "text"
                              }
                              value={cells[col.id] ?? ""}
                              onChange={(e) =>
                                onCellChange(rowId, col.id, e.target.value)
                              }
                              className="w-full border rounded px-1 py-0.5 text-xs text-center"
                            />
                          )
                        ) : (
                          <span className="text-xs">
                            {cells[col.id] ?? "—"}
                          </span>
                        )}
                      </td>
                    ))}
                    {canEdit && (
                      <td className="border border-gray-300 px-1 text-center">
                        {isAdded && (
                          <button
                            onClick={() => onRemoveRow(rowId)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <FaTrash size={9} />
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
      {canEdit && section.allowAddRows && (
        <button
          onClick={onAddRow}
          className="mt-2 flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800"
        >
          <FaPlus size={9} /> Tambah baris pengukuran
        </button>
      )}
    </div>
  );
}

function ResultBadge({ value }) {
  if (!value) return <span className="text-gray-300 text-xs">—</span>;
  const s = {
    L: "bg-emerald-100 text-emerald-800",
    TB: "bg-gray-100 text-gray-600",
    G: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${s[value] || ""}`}
    >
      {value}
    </span>
  );
}

function ResultSelector({ value, onChange }) {
  return (
    <div className="flex gap-1 justify-center">
      {["L", "TB", "G"].map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-1.5 py-0.5 rounded border text-xs font-medium transition ${
            value === v
              ? v === "L"
                ? "bg-emerald-600 text-white border-emerald-600"
                : v === "TB"
                  ? "bg-gray-500 text-white border-gray-500"
                  : "bg-red-600 text-white border-red-600"
              : "bg-white text-gray-400 border-gray-300 hover:border-gray-500"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
