// src/components/TableEditor.jsx
import React, { useState } from "react";
import api from "../mocks/api";
import toast from "react-hot-toast";

export default function TableEditor({ sampleId, klausulCode, tables = [], onChange }) {
  const [local, setLocal] = useState(() => (tables || []).map(t => ({...t})));
  const [editingIndex, setEditingIndex] = useState(null);
  const [saving, setSaving] = useState(false);

  function addEmptyTable() {
    const t = { id: 'tbl-' + Math.random().toString(36).slice(2,9), title: '', headers: ['Col 1','Col 2'], rows: [['','']], notes: '' };
    const next = [...local, t];
    setLocal(next);
    onChange && onChange(next);
    setEditingIndex(prev => next.length - 1);
  }

  function removeTable(idx) {
    const next = local.slice(); next.splice(idx,1);
    setLocal(next); onChange && onChange(next);
  }

  function updateCell(tblIdx, rowIdx, colIdx, value) {
    const next = JSON.parse(JSON.stringify(local));
    next[tblIdx].rows[rowIdx][colIdx] = value;
    setLocal(next); onChange && onChange(next);
  }

  function addRow(tblIdx) {
    const next = JSON.parse(JSON.stringify(local));
    const cols = next[tblIdx].headers.length;
    next[tblIdx].rows.push(new Array(cols).fill(''));
    setLocal(next); onChange && onChange(next);
  }

  function addColumn(tblIdx) {
    const next = JSON.parse(JSON.stringify(local));
    next[tblIdx].headers.push(`Col ${next[tblIdx].headers.length+1}`);
    next[tblIdx].rows.forEach(r => r.push(''));
    setLocal(next); onChange && onChange(next);
  }

  async function saveAll() {
    setSaving(true);
    try {
      await api.saveKlausulTables(sampleId, klausulCode, local);
      toast.success("Tabel disimpan");
    } catch (e) { toast.error("Gagal menyimpan tabel"); }
    setSaving(false);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">Tabel Lampiran</h4>
        <div className="flex gap-2">
          <button onClick={addEmptyTable} className="px-2 py-1 border rounded">Tambah Tabel</button>
          <button onClick={saveAll} className="px-3 py-1 bg-blue-600 text-white rounded" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Tabel'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {local.map((t, ti) => (
          <div key={t.id} className="border rounded p-3 bg-white">
            <div className="flex justify-between items-start">
              <input value={t.title} onChange={(e)=>{ const n=JSON.parse(JSON.stringify(local)); n[ti].title=e.target.value; setLocal(n); onChange&&onChange(n);} }
                placeholder="Judul Tabel" className="w-2/3 border px-2 py-1 rounded" />
              <div className="flex gap-2">
                <button onClick={()=>setEditingIndex(editingIndex === ti ? null : ti)} className="px-2 py-1 border rounded">{editingIndex===ti ? 'Selesai' : 'Edit'}</button>
                <button onClick={()=>removeTable(ti)} className="px-2 py-1 border rounded text-red-600">Hapus</button>
              </div>
            </div>

            {/* render table */}
            <div className="overflow-auto mt-3">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    {t.headers.map((h,hi)=>(
                      <th key={hi} className="border px-2 py-1 text-left">
                        {editingIndex===ti ? (
                          <input value={h} onChange={(e)=>{ const n=JSON.parse(JSON.stringify(local)); n[ti].headers[hi]=e.target.value; setLocal(n); onChange&&onChange(n); }} className="px-1 py-0.5 border rounded" />
                        ) : h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r,ri)=>(
                    <tr key={ri}>
                      {r.map((cell,ci)=>(
                        <td key={ci} className="border px-2 py-1">
                          {editingIndex===ti ? (
                            <input value={cell} onChange={(e)=>updateCell(ti,ri,ci,e.target.value)} className="w-full px-1 py-0.5 border rounded" />
                          ) : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editingIndex===ti && (
              <div className="flex gap-2 mt-2">
                <button onClick={()=>addRow(ti)} className="px-2 py-1 border rounded">Tambah Baris</button>
                <button onClick={()=>addColumn(ti)} className="px-2 py-1 border rounded">Tambah Kolom</button>
              </div>
            )}

            <textarea value={t.notes||''} onChange={(e)=>{ const n=JSON.parse(JSON.stringify(local)); n[ti].notes=e.target.value; setLocal(n); onChange&&onChange(n); }} placeholder="Catatan (opsional)" className="w-full mt-2 border rounded p-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
