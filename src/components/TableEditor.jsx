// src/components/TableEditor.jsx
//
// Completely replaces the inline TableEditor in KlausulButirTable.jsx.
// Tables are now stored in the ClauseTable DB table, not in report.data JSON.
// Each save/add/delete calls the API directly — no dirty flag, no autosave needed.
//
// Props:
//   reportId    {number}  — the Report id
//   clauseCode  {string}  — e.g. "6.1", "6", "9.1"
//   reportStatus {string} — "DRAFT" | "SUBMITTED" | "REVISED" | "APPROVED" etc.

import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  FaSpinner,
  FaPlus,
  FaTrash,
  FaCheck,
  FaPencilAlt,
} from "react-icons/fa";
import apiClient from "../api";

export default function TableEditor({ reportId, clauseCode, reportStatus }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // tableId being edited
  const [saving, setSaving] = useState(false);

  const isLocked = reportStatus === "APPROVED";

  // ── Fetch tables for this clause on mount / when clauseCode changes ──
  const fetchTables = useCallback(async () => {
    if (!reportId || !clauseCode) return;
    setLoading(true);
    try {
      const res = await apiClient.get(
        `/reports/${reportId}/clause-tables?clauseCode=${encodeURIComponent(clauseCode)}`,
      );
      setTables(res.data || []);
    } catch (e) {
      console.error("Failed to fetch clause tables", e);
    } finally {
      setLoading(false);
    }
  }, [reportId, clauseCode]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // ── Add a new empty table ────────────────────────────────────────────
  async function addTable() {
    if (isLocked) return;
    setSaving(true);
    try {
      const res = await apiClient.post(`/reports/${reportId}/clause-tables`, {
        clauseCode,
        title: "",
        headers: ["Kolom 1", "Kolom 2"],
        rows: [["", ""]],
        notes: "",
      });
      setTables((prev) => [...prev, res.data]);
      setEditingId(res.data.id); // auto-open for editing
      toast.success("Tabel baru ditambahkan");
    } catch (e) {
      toast.error("Gagal menambah tabel");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  // ── Save edits for a specific table ─────────────────────────────────
  async function saveTable(table) {
    if (isLocked) return;
    setSaving(true);
    try {
      const res = await apiClient.put(`/clause-tables/${table.id}`, {
        title: table.title,
        headers: table.headers,
        rows: table.rows,
        notes: table.notes,
      });
      setTables((prev) => prev.map((t) => (t.id === table.id ? res.data : t)));
      setEditingId(null);
      toast.success("Tabel disimpan");
    } catch (e) {
      toast.error("Gagal menyimpan tabel");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete a table ───────────────────────────────────────────────────
  async function deleteTable(tableId) {
    if (isLocked) return;
    if (!window.confirm("Hapus tabel ini?")) return;
    try {
      await apiClient.delete(`/clause-tables/${tableId}`);
      setTables((prev) => prev.filter((t) => t.id !== tableId));
      if (editingId === tableId) setEditingId(null);
      toast.success("Tabel dihapus");
    } catch (e) {
      toast.error("Gagal menghapus tabel");
      console.error(e);
    }
  }

  // ── Local mutations (before save) ───────────────────────────────────
  function mutateTable(tableId, mutator) {
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId ? mutator(JSON.parse(JSON.stringify(t))) : t,
      ),
    );
  }

  function updateCell(tableId, rowIdx, colIdx, value) {
    mutateTable(tableId, (t) => {
      t.rows[rowIdx][colIdx] = value;
      return t;
    });
  }

  function updateHeader(tableId, colIdx, value) {
    mutateTable(tableId, (t) => {
      t.headers[colIdx] = value;
      return t;
    });
  }

  function addRow(tableId) {
    mutateTable(tableId, (t) => {
      t.rows.push(new Array(t.headers.length).fill(""));
      return t;
    });
  }

  function removeRow(tableId, rowIdx) {
    mutateTable(tableId, (t) => {
      t.rows.splice(rowIdx, 1);
      return t;
    });
  }

  function addColumn(tableId) {
    mutateTable(tableId, (t) => {
      t.headers.push(`Kolom ${t.headers.length + 1}`);
      t.rows.forEach((r) => r.push(""));
      return t;
    });
  }

  function removeColumn(tableId, colIdx) {
    mutateTable(tableId, (t) => {
      t.headers.splice(colIdx, 1);
      t.rows.forEach((r) => r.splice(colIdx, 1));
      return t;
    });
  }

  function updateTitle(tableId, value) {
    mutateTable(tableId, (t) => {
      t.title = value;
      return t;
    });
  }

  function updateNotes(tableId, value) {
    mutateTable(tableId, (t) => {
      t.notes = value;
      return t;
    });
  }

  // ── Render ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mt-4 text-sm text-gray-400 flex items-center gap-2">
        <FaSpinner className="animate-spin" />
        Memuat tabel lampiran...
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800">
          Lampiran Tabel
          {tables.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({tables.length} tabel)
            </span>
          )}
        </h4>
        {!isLocked && (
          <button
            onClick={addTable}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 border rounded text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? (
              <FaSpinner className="animate-spin" size={12} />
            ) : (
              <FaPlus size={12} />
            )}
            Tambah Tabel
          </button>
        )}
      </div>

      {tables.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          {isLocked
            ? "Tidak ada tabel lampiran untuk klausul ini."
            : "Belum ada tabel. Klik 'Tambah Tabel' untuk menambahkan."}
        </p>
      )}

      <div className="space-y-5">
        {tables.map((t) => {
          const isEditing = editingId === t.id;

          return (
            <div
              key={t.id}
              className="border rounded-lg bg-white overflow-hidden"
            >
              {/* Table header bar */}
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
                {isEditing ? (
                  <input
                    value={t.title}
                    onChange={(e) => updateTitle(t.id, e.target.value)}
                    placeholder="Judul tabel (misal: TABEL I: Pengujian Mampu Tukar E27)"
                    className="flex-1 border rounded px-2 py-1 text-sm mr-2"
                    autoFocus
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-700">
                    {t.title || (
                      <span className="italic text-gray-400">Tanpa judul</span>
                    )}
                  </span>
                )}

                {!isLocked && (
                  <div className="flex items-center gap-2 shrink-0">
                    {isEditing ? (
                      <button
                        onClick={() => saveTable(t)}
                        disabled={saving}
                        className="flex items-center gap-1 px-2 py-1 bg-sky-600 text-white rounded text-xs"
                      >
                        {saving ? (
                          <FaSpinner className="animate-spin" size={10} />
                        ) : (
                          <FaCheck size={10} />
                        )}
                        Simpan
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditingId(t.id)}
                        className="flex items-center gap-1 px-2 py-1 border rounded text-xs hover:bg-gray-100"
                      >
                        <FaPencilAlt size={10} />
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => deleteTable(t.id)}
                      className="flex items-center gap-1 px-2 py-1 border border-red-200 text-red-600 rounded text-xs hover:bg-red-50"
                    >
                      <FaTrash size={10} />
                      Hapus
                    </button>
                  </div>
                )}
              </div>

              {/* Table body */}
              <div className="overflow-x-auto p-2">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {t.headers.map((h, hi) => (
                        <th
                          key={hi}
                          className="border border-gray-300 px-2 py-1 bg-gray-100 text-center relative"
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                value={h}
                                onChange={(e) =>
                                  updateHeader(t.id, hi, e.target.value)
                                }
                                className="w-full px-1 py-0.5 border rounded text-xs"
                              />
                              {t.headers.length > 1 && (
                                <button
                                  onClick={() => removeColumn(t.id, hi)}
                                  className="text-red-400 hover:text-red-600 shrink-0"
                                  title="Hapus kolom"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="font-medium">{h}</span>
                          )}
                        </th>
                      ))}
                      {/* Row delete column when editing */}
                      {isEditing && (
                        <th className="border border-gray-300 px-1 py-1 bg-gray-100 w-6" />
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(t.rows || []).map((row, ri) => (
                      <tr key={ri}>
                        {t.headers.map((_, ci) => (
                          <td
                            key={ci}
                            className="border border-gray-300 px-2 py-1 text-center"
                          >
                            {isEditing ? (
                              <input
                                value={
                                  Array.isArray(row) ? (row[ci] ?? "") : ""
                                }
                                onChange={(e) =>
                                  updateCell(t.id, ri, ci, e.target.value)
                                }
                                className="w-full px-1 py-0.5 border rounded text-xs text-center"
                              />
                            ) : (
                              <span>
                                {Array.isArray(row) ? (row[ci] ?? "") : ""}
                              </span>
                            )}
                          </td>
                        ))}
                        {isEditing && (
                          <td className="border border-gray-300 px-1 py-1 text-center">
                            {t.rows.length > 1 && (
                              <button
                                onClick={() => removeRow(t.id, ri)}
                                className="text-red-400 hover:text-red-600 text-xs"
                                title="Hapus baris"
                              >
                                ×
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Edit-mode controls */}
              {isEditing && (
                <div className="px-3 pb-3 space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => addRow(t.id)}
                      className="px-2 py-1 border rounded text-xs hover:bg-gray-50"
                    >
                      + Tambah Baris
                    </button>
                    <button
                      onClick={() => addColumn(t.id)}
                      className="px-2 py-1 border rounded text-xs hover:bg-gray-50"
                    >
                      + Tambah Kolom
                    </button>
                  </div>
                  <textarea
                    value={t.notes || ""}
                    onChange={(e) => updateNotes(t.id, e.target.value)}
                    placeholder="Catatan tabel (opsional)"
                    rows={2}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>
              )}

              {/* Notes display when not editing */}
              {!isEditing && t.notes && (
                <div className="px-3 py-2 text-xs text-gray-500 italic border-t">
                  {t.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
