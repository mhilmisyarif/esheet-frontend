// src/components/TemplateBuilder.jsx
//
// Used inside ManageStandards.jsx.
// Engineers define table templates for a specific sub-clause of a TestStandard
// using the Unified Sucofindo Spreadsheet Editor.

import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  FiPlus,
  FiTrash2,
  FiSave,
  FiX,
  FiFileText,
} from "react-icons/fi";
import apiClient from "../api";
import SucofindoSpreadsheet from "./SucofindoSpreadsheet";
import {
  spreadsheetToTemplateDefinition,
  templateDefinitionToSpreadsheet,
  createDefaultSpreadsheetGrid,
} from "../utils/spreadsheetEngine";

const clauseLabel = (s, max = 60) => {
  const judul = (s.judul || "").trim();
  if (!judul) return s.kode;
  const short =
    judul.length > max ? `${judul.slice(0, max).trimEnd()}…` : judul;
  return `${s.kode} — ${short}`;
};

// ── Shared style tokens ──────────────────────────────────────────────────────
const inpBase =
  "px-2.5 py-1.5 border border-line rounded-lg text-[13px] text-navy-800 bg-paper outline-none transition-colors focus:border-navy-600 focus:ring-2 focus:ring-navy-600/10 placeholder:text-ink-400";
const inp = `w-full ${inpBase}`;
const btnPrimary =
  "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold bg-navy-800 text-white hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 shadow-xs transition-colors";
const btnGhost =
  "inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl text-[13px] font-semibold bg-paper text-navy-800 border border-line hover:bg-navy-50 transition-colors whitespace-nowrap shrink-0";
const lbl = "block text-[11px] font-medium text-ink-500 mb-1";
const iconBtn =
  "inline-flex items-center justify-center rounded-md transition-colors shrink-0";

export default function TemplateBuilder({
  standardId,
  subClauses = [],
  onClose,
}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterClause, setFilterClause] = useState("");

  // ── Fetch existing templates ─────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    if (!standardId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(
        `/standards/${standardId}/table-templates`,
      );
      setTemplates(res.data || []);
    } catch (e) {
      toast.error("Gagal memuat template tabel");
    } finally {
      setLoading(false);
    }
  }, [standardId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // ── Start creating a new template ────────────────────────────────────────
  function newTemplate() {
    const grid = createDefaultSpreadsheetGrid();
    setEditingTemplate({
      _isNew: true,
      subClauseCode: filterClause || "",
      title: "",
      definition: spreadsheetToTemplateDefinition(grid, ""),
    });
  }

  // ── Save template (create or update) ─────────────────────────────────────
  async function saveTemplate() {
    if (!editingTemplate.subClauseCode) {
      toast.error("Pilih sub-klausul terlebih dahulu");
      return;
    }
    setSaving(true);
    try {
      if (editingTemplate._isNew) {
        const res = await apiClient.post(
          `/standards/${standardId}/table-templates`,
          {
            subClauseCode: editingTemplate.subClauseCode,
            title: editingTemplate.title || "Tabel Pengujian",
            definition: editingTemplate.definition,
          },
        );
        setTemplates((prev) => [...prev, res.data]);
      } else {
        const res = await apiClient.put(
          `/table-templates/${editingTemplate.id}`,
          {
            title: editingTemplate.title || "Tabel Pengujian",
            subClauseCode: editingTemplate.subClauseCode,
            definition: editingTemplate.definition,
          },
        );
        setTemplates((prev) =>
          prev.map((t) => (t.id === res.data.id ? res.data : t)),
        );
      }
      toast.success("Template berhasil disimpan");
      setEditingTemplate(null);
    } catch (e) {
      toast.error(e.response?.data?.error || "Gagal menyimpan template");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete template ───────────────────────────────────────────────────────
  async function deleteTemplate(id) {
    if (!window.confirm("Hapus template tabel ini?")) return;
    try {
      await apiClient.delete(`/table-templates/${id}`);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template dihapus");
    } catch (e) {
      toast.error(e.response?.data?.error || "Gagal menghapus template");
    }
  }

  const filtered = filterClause
    ? templates.filter((t) => t.subClauseCode === filterClause)
    : templates;

  // ── Active Editor View ───────────────────────────────────────────────────
  if (editingTemplate) {
    return (
      <TemplateEditor
        t={editingTemplate}
        subClauses={subClauses}
        saving={saving}
        onBack={() => setEditingTemplate(null)}
        onSave={saveTemplate}
        onChange={setEditingTemplate}
      />
    );
  }

  // ── Template List View ───────────────────────────────────────────────────
  return (
    <div>
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 pb-4 border-b border-line-soft">
        <div>
          <h3 className="text-[16px] font-bold text-navy-900 tracking-tight">
            Template Tabel Lampiran (Spreadsheet)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Format spreadsheet pengujian untuk sub-klausul standar lab.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <select
            value={filterClause}
            onChange={(e) => setFilterClause(e.target.value)}
            className={`${inpBase} w-full sm:w-[220px] md:w-[260px] truncate`}
          >
            <option value="">Semua sub-klausul</option>
            {subClauses.map((s) => (
              <option key={s.kode} value={s.kode} title={s.judul || s.kode}>
                {clauseLabel(s)}
              </option>
            ))}
          </select>

          <button onClick={newTemplate} className={btnPrimary}>
            <FiPlus size={15} className="shrink-0" />
            <span>Buat Tabel Baru</span>
          </button>

          {onClose && (
            <button onClick={onClose} className={btnGhost} title="Tutup">
              <FiX size={15} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-400 py-2">Memuat template…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-line rounded-xl">
          <FiFileText size={28} className="mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-medium text-slate-700">
            Belum ada template tabel untuk klausul ini
          </p>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Klik tombol &ldquo;Buat Tabel Baru&rdquo; untuk merancang format spreadsheet pengujian.
          </p>
          <button onClick={newTemplate} className={btnPrimary}>
            <FiPlus size={15} className="shrink-0" />
            <span>Buat Tabel Baru</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 px-4 py-3 border border-line rounded-xl bg-paper hover:bg-navy-50/50 shadow-2xs transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[11px] font-mono font-bold bg-navy-50 text-navy-800 px-2.5 py-1 rounded-md border border-navy-100 shrink-0">
                  Klausul {t.subClauseCode}
                </span>
                <span className="text-sm font-semibold text-navy-800 truncate">
                  {t.title || "Tabel Pengujian"}
                </span>
                <span className="text-xs text-slate-400 font-sans hidden sm:inline">
                  • Spreadsheet
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditingTemplate({ ...t })}
                  className="px-3.5 py-1.5 border border-line rounded-lg text-xs font-semibold text-navy-700 hover:bg-navy-100 hover:text-navy-900 transition-colors whitespace-nowrap"
                >
                  Edit Spreadsheet
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className={`${iconBtn} w-8 h-8 rounded-lg text-ink-400 hover:bg-bad-bg hover:text-bad-fg transition-colors`}
                  title="Hapus template"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Unified Spreadsheet Template Editor ──────────────────────────────────────
function TemplateEditor({
  t,
  subClauses,
  saving,
  onBack,
  onSave,
  onChange,
}) {
  const [grid, setGrid] = useState(() =>
    templateDefinitionToSpreadsheet(t.definition)
  );

  function handleGridChange(updatedGrid) {
    setGrid(updatedGrid);
    const def = spreadsheetToTemplateDefinition(updatedGrid, t.title);
    onChange((p) => ({ ...p, definition: def }));
  }

  function handleTitleChange(newTitle) {
    const def = spreadsheetToTemplateDefinition(grid, newTitle);
    onChange((p) => ({ ...p, title: newTitle, definition: def }));
  }

  return (
    <div className="space-y-4">
      {/* Header Back Navigation */}
      <div className="flex items-center gap-2 text-[13px]">
        <button
          onClick={onBack}
          className="text-ink-500 hover:text-navy-800 transition-colors font-medium"
        >
          ← Kembali ke Daftar Template
        </button>
        <span className="text-ink-300">/</span>
        <span className="font-bold text-navy-800">
          {t._isNew ? "Desain Template Baru" : t.title || "Edit Template"}
        </span>
      </div>

      {/* Target Clause & Title */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <div>
          <label className={lbl}>Sub-klausul Target Pengujian *</label>
          <select
            value={t.subClauseCode || ""}
            onChange={(e) =>
              onChange((p) => ({ ...p, subClauseCode: e.target.value }))
            }
            className={`${inp} truncate font-medium`}
          >
            <option value="">-- Pilih sub-klausul --</option>
            {subClauses.map((s) => (
              <option key={s.kode} value={s.kode} title={s.judul || s.kode}>
                {clauseLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Judul Tabel Pengujian</label>
          <input
            value={t.title || ""}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="misal: TABEL I — Pengujian Kenaikan Suhu"
            className={`${inp} font-medium`}
          />
        </div>
      </div>

      {/* Unified Spreadsheet Canvas */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-navy-800 uppercase tracking-wide">
            Kanvas Desain Spreadsheet
          </label>
          <span className="text-[11px] text-slate-500">
            Atur kolom, baris, warna, rumus (fx), dan izin edit teknisi langsung di sel.
          </span>
        </div>
        <SucofindoSpreadsheet
          initialGrid={grid}
          onChange={handleGridChange}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-3 border-t border-line-soft">
        <button onClick={onBack} className={btnGhost}>
          Batal
        </button>
        <button onClick={onSave} disabled={saving} className={btnPrimary}>
          <FiSave size={13} />
          {saving ? "Menyimpan…" : "Simpan Template"}
        </button>
      </div>
    </div>
  );
}
