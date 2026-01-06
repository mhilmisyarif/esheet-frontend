// src/components/TableEditor.jsx
import React, { useState, useEffect } from "react";
// import api from "../mocks/api"; // <-- REMOVED
import toast from "react-hot-toast";

// This is now a "controlled component". It manages its own UI
// but does NOT save to the API. It passes all changes up
// to the parent component via the `onChange` prop.
export default function TableEditor({
  sampleId,
  klausulCode,
  tables = [],
  onChange,
}) {
  const [local, setLocal] = useState(() =>
    (tables || []).map((t) => ({ ...t }))
  );
  const [editingIndex, setEditingIndex] = useState(null);
  // const [saving, setSaving] = useState(false); // No longer needed

  // Sync with parent prop
  useEffect(() => {
    setLocal((tables || []).map((t) => ({ ...t })));
  }, [tables]);

  function setAndNotify(next) {
    setLocal(next);
    onChange && onChange(next);
  }

  function addEmptyTable() {
    const t = {
      id: "tbl-" + Math.random().toString(36).slice(2, 9),
      title: "",
      headers: ["Col 1", "Col 2"],
      rows: [["", ""]],
      notes: "",
    };
    const next = [...local, t];
    setAndNotify(next);
    setEditingIndex((prev) => next.length - 1);
  }

  function removeTable(idx) {
    const next = local.slice();
    next.splice(idx, 1);
    setAndNotify(next);
  }

  function updateCell(tblIdx, rowIdx, colIdx, value) {
    const next = JSON.parse(JSON.stringify(local));
    next[tblIdx].rows[rowIdx][colIdx] = value;
    setAndNotify(next);
  }

  function addRow(tblIdx) {
    const next = JSON.parse(JSON.stringify(local));
    const cols = next[tblIdx].headers.length;
    next[tblIdx].rows.push(new Array(cols).fill(""));
    setAndNotify(next);
  }

  function addColumn(tblIdx) {
    const next = JSON.parse(JSON.stringify(local));
    next[tblIdx].headers.push(`Col ${next[tblIdx].headers.length + 1}`);
    next[tblIdx].rows.forEach((r) => r.push(""));
    setAndNotify(next);
  }

  // The saveAll function that called the mock API is REMOVED.
  // async function saveAll() { ... }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">Tabel Lampiran</h4>
        <div className="flex gap-2">
          <button onClick={addEmptyTable} className="px-2 py-1 border rounded">
            Tambah Tabel
          </button>
          {/* Save button is removed. Parent handles saving. */}
        </div>
      </div>

      <div className="space-y-4">
        {local.map((t, ti) => (
          <div key={t.id} className="border rounded p-3 bg-white">
            <div className="flex justify-between items-start">
              <input
                value={t.title}
                onChange={(e) => {
                  const n = JSON.parse(JSON.stringify(local));
                  n[ti].title = e.target.value;
                  setAndNotify(n);
                }}
                placeholder="Judul Tabel"
                className="w-2/3 border px-2 py-1 rounded"
              />
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setEditingIndex(editingIndex === ti ? null : ti)
                  }
                  className="px-2 py-1 border rounded"
                >
                  {editingIndex === ti ? "Selesai" : "Edit"}
                </button>
                <button
                  onClick={() => removeTable(ti)}
                  className="px-2 py-1 border rounded text-red-600"
                >
                  Hapus
                </button>
              </div>
            </div>

            {/* render table */}
            <div className="overflow-auto mt-3">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    {t.headers.map((h, hi) => (
                      <th key={hi} className="border px-2 py-1 text-left">
                        {editingIndex === ti ? (
                          <input
                            value={h}
                            onChange={(e) => {
                              const n = JSON.parse(JSON.stringify(local));
                              n[ti].headers[hi] = e.target.value;
                              setAndNotify(n);
                            }}
                            className="px-1 py-0.5 border rounded"
                          />
                        ) : (
                          h
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r, ri) => (
                    <tr key={ri}>
                      {r.map((cell, ci) => (
                        <td key={ci} className="border px-2 py-1">
                          {editingIndex === ti ? (
                            <input
                              value={cell}
                              onChange={(e) =>
                                updateCell(ti, ri, ci, e.target.value)
                              }
                              className="w-full px-1 py-0.5 border rounded"
                            />
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editingIndex === ti && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => addRow(ti)}
                  className="px-2 py-1 border rounded"
                >
                  Tambah Baris
                </button>
                <button
                  onClick={() => addColumn(ti)}
                  className="px-2 py-1 border rounded"
                >
                  Tambah Kolom
                </button>
              </div>
            )}

            <textarea
              value={t.notes || ""}
              onChange={(e) => {
                const n = JSON.parse(JSON.stringify(local));
                n[ti].notes = e.target.value;
                setAndNotify(n);
              }}
              placeholder="Catatan (opsional)"
              className="w-full mt-2 border rounded p-2"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
