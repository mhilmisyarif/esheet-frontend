// src/components/TemplateBuilder.jsx
//
// Used inside ManageStandards.jsx.
// Engineers define table templates for a specific sub-clause of a TestStandard.

import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  FiPlus,
  FiTrash2,
  FiSave,
  FiX,
  FiChevronDown,
  FiChevronRight,
  FiColumns,
  FiList,
  FiLayers,
  FiMenu,
} from "react-icons/fi";
import apiClient from "../api";
import {
  formulaToString,
  passRuleToString,
  genId,
} from "../utils/tableFormulas";

const LAYOUT_OPTIONS = [
  {
    value: "key_value",
    label: "Key-value form",
    icon: FiList,
    desc: "Label + value + manual result per row (like Lampiran 2 top section)",
  },
  {
    value: "table",
    label: "Data table",
    icon: FiColumns,
    desc: "Columns + data rows with optional computed columns",
  },
  {
    value: "mixed",
    label: "Mixed layout",
    icon: FiLayers,
    desc: "Key-value form on top, table below (full Lampiran 2)",
  },
];

const INPUT_TYPES = ["text", "number", "dropdown"];
const FORMULA_OPS = [
  { value: "subtract", label: "A − B (subtract)" },
  { value: "add", label: "A + B (add)" },
  { value: "multiply", label: "A × B (multiply)" },
  { value: "divide", label: "A ÷ B (divide)" },
];
const PASS_OPS = [
  { value: "lte", label: "value ≤ threshold" },
  { value: "gte", label: "value ≥ threshold" },
  { value: "lt", label: "value < threshold" },
  { value: "gt", label: "value > threshold" },
  { value: "eq", label: "value = threshold" },
  { value: "range", label: "min ≤ value ≤ max" },
];

// ── Shared style tokens ──────────────────────────────────────────────────────
const inpBase =
  "px-2.5 py-1.5 border border-line rounded-lg text-[13px] text-navy-800 bg-paper outline-none transition-colors focus:border-navy-600 focus:ring-2 focus:ring-navy-600/10 placeholder:text-ink-400";
const inp = `w-full ${inpBase}`;
const inpXs =
  "w-full px-2 py-1 border border-line rounded-md text-xs text-navy-800 bg-paper outline-none transition-colors focus:border-navy-600";
const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-semibold bg-navy-800 text-white hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnGhost =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-semibold bg-paper text-navy-800 border border-line hover:bg-navy-50 transition-colors";
const linkBtn =
  "inline-flex items-center gap-1.5 text-xs font-semibold text-navy-700 hover:text-navy-900 w-fit";
const lbl = "block text-[11px] font-medium text-ink-500 mb-1";
const iconBtn =
  "inline-flex items-center justify-center rounded-md transition-colors shrink-0";

export default function TemplateBuilder({ standardId, subClauses = [], onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null); // null = list view
  const [saving, setSaving] = useState(false);
  const [filterClause, setFilterClause] = useState("");

  // ── Fetch existing templates ─────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    if (!standardId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(
        `/standards/${standardId}/table-templates`
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
    setEditingTemplate({
      _isNew: true,
      subClauseCode: filterClause || "",
      title: "",
      definition: {
        layout: "table",
        sections: [newTableSection()],
      },
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
            title: editingTemplate.title,
            definition: editingTemplate.definition,
          }
        );
        setTemplates((prev) => [...prev, res.data]);
      } else {
        const res = await apiClient.put(
          `/table-templates/${editingTemplate.id}`,
          {
            title: editingTemplate.title,
            subClauseCode: editingTemplate.subClauseCode,
            definition: editingTemplate.definition,
          }
        );
        setTemplates((prev) =>
          prev.map((t) => (t.id === res.data.id ? res.data : t))
        );
      }
      toast.success("Template disimpan");
      setEditingTemplate(null);
    } catch (e) {
      toast.error(e.response?.data?.error || "Gagal menyimpan template");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(id) {
    if (
      !window.confirm(
        "Hapus template ini? Semua data yang sudah diisi akan hilang."
      )
    )
      return;
    try {
      await apiClient.delete(`/table-templates/${id}`);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template dihapus");
    } catch (e) {
      toast.error("Gagal menghapus template");
    }
  }

  // ── Mutate editingTemplate helpers ───────────────────────────────────────
  function setDef(mutator) {
    setEditingTemplate((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.definition = mutator(next.definition);
      return next;
    });
  }

  function setLayout(layout) {
    setDef((def) => {
      def.layout = layout;
      if (layout === "key_value") def.sections = [newKvSection()];
      else if (layout === "table") def.sections = [newTableSection()];
      else def.sections = [newKvSection(), newTableSection()];
      return def;
    });
  }

  function updateSectionLabel(sIdx, label) {
    setDef((def) => {
      def.sections[sIdx].label = label;
      return def;
    });
  }

  // ── KEY-VALUE SECTION helpers ────────────────────────────────────────────
  function newKvSection() {
    return {
      type: "key_value",
      label: "",
      rows: [
        {
          id: genId("kv"),
          label: "",
          inputType: "text",
          resultMode: "manual",
          required: false,
        },
      ],
    };
  }

  function addKvRow(sIdx) {
    setDef((def) => {
      def.sections[sIdx].rows.push({
        id: genId("kv"),
        label: "",
        inputType: "text",
        resultMode: "manual",
        required: false,
      });
      return def;
    });
  }

  function updateKvRow(sIdx, rIdx, field, value) {
    setDef((def) => {
      def.sections[sIdx].rows[rIdx][field] = value;
      return def;
    });
  }

  function removeKvRow(sIdx, rIdx) {
    setDef((def) => {
      def.sections[sIdx].rows.splice(rIdx, 1);
      return def;
    });
  }

  // ── TABLE SECTION helpers ────────────────────────────────────────────────
  function newTableSection() {
    const c1 = genId("c");
    return {
      type: "table",
      label: "",
      allowAddRows: true,
      rowGroups: [],
      columns: [
        {
          id: c1,
          header: "Parameter",
          inputType: "text",
          editable: true,
          isResult: false,
          width: 200,
        },
      ],
      fixedRows: [{ id: genId("r"), cells: { [c1]: "" } }],
    };
  }

  function addColumn(sIdx) {
    const id = genId("c");
    setDef((def) => {
      def.sections[sIdx].columns.push({
        id,
        header: "Kolom Baru",
        inputType: "number",
        editable: true,
        isResult: false,
      });
      def.sections[sIdx].fixedRows.forEach((r) => {
        r.cells[id] = "";
      });
      return def;
    });
  }

  function updateColumn(sIdx, cIdx, field, value) {
    setDef((def) => {
      def.sections[sIdx].columns[cIdx][field] = value;
      if (field === "formula" && value)
        def.sections[sIdx].columns[cIdx].editable = false;
      if (field === "isResult" && value)
        def.sections[sIdx].columns[cIdx].editable = false;
      return def;
    });
  }

  function removeColumn(sIdx, cIdx) {
    setDef((def) => {
      const colId = def.sections[sIdx].columns[cIdx].id;
      def.sections[sIdx].columns.splice(cIdx, 1);
      def.sections[sIdx].fixedRows.forEach((r) => {
        delete r.cells[colId];
      });
      return def;
    });
  }

  function addFixedRow(sIdx) {
    setDef((def) => {
      const cells = {};
      def.sections[sIdx].columns.forEach((c) => {
        cells[c.id] = "";
      });
      def.sections[sIdx].fixedRows.push({ id: genId("r"), cells });
      return def;
    });
  }

  function updateFixedRow(sIdx, rIdx, colId, value) {
    setDef((def) => {
      def.sections[sIdx].fixedRows[rIdx].cells[colId] = value;
      return def;
    });
  }

  function removeFixedRow(sIdx, rIdx) {
    setDef((def) => {
      def.sections[sIdx].fixedRows.splice(rIdx, 1);
      return def;
    });
  }

  function addRowGroup(sIdx) {
    setDef((def) => {
      if (!def.sections[sIdx].rowGroups) def.sections[sIdx].rowGroups = [];
      def.sections[sIdx].rowGroups.push({ label: "", rowIds: [] });
      return def;
    });
  }

  function updateRowGroup(sIdx, gIdx, field, value) {
    setDef((def) => {
      def.sections[sIdx].rowGroups[gIdx][field] = value;
      return def;
    });
  }

  function removeRowGroup(sIdx, gIdx) {
    setDef((def) => {
      def.sections[sIdx].rowGroups.splice(gIdx, 1);
      return def;
    });
  }

  // ── RENDER ───────────────────────────────────────────────────────────────
  const filtered = filterClause
    ? templates.filter((t) => t.subClauseCode === filterClause)
    : templates;

  if (editingTemplate) {
    return (
      <TemplateEditor
        t={editingTemplate}
        subClauses={subClauses}
        saving={saving}
        onBack={() => setEditingTemplate(null)}
        onSave={saveTemplate}
        onChange={setEditingTemplate}
        setDef={setDef}
        setLayout={setLayout}
        updateSectionLabel={updateSectionLabel}
        addKvRow={addKvRow}
        updateKvRow={updateKvRow}
        removeKvRow={removeKvRow}
        addColumn={addColumn}
        updateColumn={updateColumn}
        removeColumn={removeColumn}
        addFixedRow={addFixedRow}
        updateFixedRow={updateFixedRow}
        removeFixedRow={removeFixedRow}
        addRowGroup={addRowGroup}
        updateRowGroup={updateRowGroup}
        removeRowGroup={removeRowGroup}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between mb-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="text-[15px] font-semibold text-navy-800">
            Template Tabel Lampiran
          </h3>
          <select
            value={filterClause}
            onChange={(e) => setFilterClause(e.target.value)}
            className={inpBase}
          >
            <option value="">Semua sub-klausul</option>
            {subClauses.map((s) => (
              <option key={s.kode} value={s.kode}>
                {s.kode} — {s.judul || ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={newTemplate} className={btnPrimary}>
            <FiPlus size={13} /> Template Baru
          </button>
          {onClose && (
            <button onClick={onClose} className={btnGhost}>
              <FiX size={14} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-400 py-2">Memuat template…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink-400 py-2">
          Belum ada template. Klik &ldquo;Template Baru&rdquo; untuk membuat.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 border border-line rounded-xl bg-paper hover:bg-navy-50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-mono font-semibold bg-navy-50 text-navy-800 px-1.5 py-0.5 rounded shrink-0">
                  {t.subClauseCode}
                </span>
                <span className="text-sm font-medium text-navy-800 truncate">
                  {t.title || "Tanpa judul"}
                </span>
                <span className="text-xs text-ink-400 shrink-0">
                  {t.definition?.layout}
                </span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => setEditingTemplate({ ...t })}
                  className="px-2.5 py-1 border border-line rounded-md text-xs font-semibold text-navy-700 hover:bg-navy-100 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className={`${iconBtn} w-7 h-7 text-ink-400 hover:bg-bad-bg hover:text-bad-fg`}
                >
                  <FiTrash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TemplateEditor sub-component ─────────────────────────────────────────────
function TemplateEditor({
  t,
  subClauses,
  saving,
  onBack,
  onSave,
  onChange,
  setDef,
  setLayout,
  updateSectionLabel,
  addKvRow,
  updateKvRow,
  removeKvRow,
  addColumn,
  updateColumn,
  removeColumn,
  addFixedRow,
  updateFixedRow,
  removeFixedRow,
  addRowGroup,
  updateRowGroup,
  removeRowGroup,
}) {
  const def = t.definition;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 text-[13px]">
        <button
          onClick={onBack}
          className="text-ink-500 hover:text-navy-800 transition-colors"
        >
          ← Kembali
        </button>
        <span className="text-ink-300">/</span>
        <span className="font-medium text-navy-800">
          {t._isNew ? "Template Baru" : t.title || "Edit Template"}
        </span>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className={lbl}>Sub-klausul</label>
          <select
            value={t.subClauseCode}
            onChange={(e) =>
              onChange((p) => ({ ...p, subClauseCode: e.target.value }))
            }
            className={inp}
          >
            <option value="">-- Pilih --</option>
            {subClauses.map((s) => (
              <option key={s.kode} value={s.kode}>
                {s.kode}
                {s.judul ? ` — ${s.judul}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Judul template</label>
          <input
            value={t.title}
            onChange={(e) => onChange((p) => ({ ...p, title: e.target.value }))}
            placeholder="misal: TABEL I — Pengujian Mampu Tukar E27"
            className={inp}
          />
        </div>
      </div>

      {/* Layout selector */}
      <div className="mb-4">
        <label className={lbl}>Tipe layout</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLayout(opt.value)}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-colors ${
                def.layout === opt.value
                  ? "border-navy-600 bg-navy-50 ring-1 ring-navy-200"
                  : "border-line hover:border-navy-500"
              }`}
            >
              <opt.icon size={15} className="mb-1 text-navy-700" />
              <span className="text-xs font-semibold text-navy-800">
                {opt.label}
              </span>
              <span className="text-[10px] text-ink-400 mt-0.5 leading-snug">
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-3 mb-4">
        {def.sections.map((section, sIdx) => (
          <div
            key={sIdx}
            className="border border-line rounded-xl bg-navy-50/60 p-3"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-mono bg-paper border border-line rounded px-1.5 py-0.5 text-ink-500 shrink-0">
                {section.type}
              </span>
              <input
                value={section.label || ""}
                onChange={(e) => updateSectionLabel(sIdx, e.target.value)}
                placeholder="Label seksi (opsional)"
                className={inp}
              />
            </div>

            {section.type === "key_value" && (
              <KvSectionEditor
                section={section}
                sIdx={sIdx}
                addKvRow={addKvRow}
                updateKvRow={updateKvRow}
                removeKvRow={removeKvRow}
              />
            )}

            {section.type === "table" && (
              <TableSectionEditor
                section={section}
                sIdx={sIdx}
                setDef={setDef}
                addColumn={addColumn}
                updateColumn={updateColumn}
                removeColumn={removeColumn}
                addFixedRow={addFixedRow}
                updateFixedRow={updateFixedRow}
                removeFixedRow={removeFixedRow}
                addRowGroup={addRowGroup}
                updateRowGroup={updateRowGroup}
                removeRowGroup={removeRowGroup}
              />
            )}
          </div>
        ))}
      </div>

      {/* Save */}
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

// ── Key-value section editor ──────────────────────────────────────────────────
function KvSectionEditor({ section, sIdx, addKvRow, updateKvRow, removeKvRow }) {
  return (
    <div className="flex flex-col gap-2">
      {section.rows.map((row, rIdx) => (
        <div
          key={row.id}
          className="flex items-center gap-2 bg-paper border border-line rounded-lg px-2 py-1.5"
        >
          <input
            value={row.label}
            onChange={(e) => updateKvRow(sIdx, rIdx, "label", e.target.value)}
            placeholder="Label baris"
            className={inp}
          />
          <select
            value={row.inputType}
            onChange={(e) =>
              updateKvRow(sIdx, rIdx, "inputType", e.target.value)
            }
            className={`${inpXs} w-auto`}
          >
            {INPUT_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {ty}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-ink-500 whitespace-nowrap">
            <input
              type="checkbox"
              className="accent-navy-700"
              checked={row.required || false}
              onChange={(e) =>
                updateKvRow(sIdx, rIdx, "required", e.target.checked)
              }
            />
            Wajib
          </label>
          {section.rows.length > 1 && (
            <button
              onClick={() => removeKvRow(sIdx, rIdx)}
              className={`${iconBtn} w-7 h-7 text-ink-400 hover:bg-bad-bg hover:text-bad-fg`}
            >
              <FiTrash2 size={12} />
            </button>
          )}
        </div>
      ))}
      <button onClick={() => addKvRow(sIdx)} className={linkBtn}>
        <FiPlus size={11} /> Tambah baris
      </button>
    </div>
  );
}

// ── Table section editor ──────────────────────────────────────────────────────
function TableSectionEditor({
  section,
  sIdx,
  setDef,
  addColumn,
  updateColumn,
  removeColumn,
  addFixedRow,
  updateFixedRow,
  removeFixedRow,
  addRowGroup,
  updateRowGroup,
  removeRowGroup,
}) {
  const [expandedCol, setExpandedCol] = useState(null);
  const columns = section.columns || [];
  const fixedRows = section.fixedRows || [];

  return (
    <div className="flex flex-col gap-4">
      {/* Allow add rows toggle */}
      <label className="flex items-center gap-2 text-xs text-ink-600">
        <input
          type="checkbox"
          className="accent-navy-700"
          checked={section.allowAddRows || false}
          onChange={(e) =>
            setDef((def) => {
              def.sections[sIdx].allowAddRows = e.target.checked;
              return def;
            })
          }
        />
        Teknisi dapat menambah baris baru
      </label>

      {/* Columns */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-ink-600">Kolom</span>
          <button onClick={() => addColumn(sIdx)} className={linkBtn}>
            <FiPlus size={11} /> Tambah kolom
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {columns.map((col, cIdx) => (
            <div
              key={col.id}
              className="border border-line rounded-lg bg-paper overflow-hidden"
            >
              <div
                className="flex items-center gap-2 px-2.5 py-2 cursor-pointer"
                onClick={() =>
                  setExpandedCol(expandedCol === cIdx ? null : cIdx)
                }
              >
                {expandedCol === cIdx ? (
                  <FiChevronDown size={12} className="text-ink-400" />
                ) : (
                  <FiChevronRight size={12} className="text-ink-400" />
                )}
                <span className="text-[13px] flex-1 text-navy-800">
                  {col.header || "Kolom"}
                  {!col.editable && (
                    <span className="ml-1.5 text-[11px] font-semibold text-warn-fg">
                      [auto]
                    </span>
                  )}
                  {col.isResult && (
                    <span className="ml-1.5 text-[11px] font-semibold text-ok-fg">
                      [hasil]
                    </span>
                  )}
                </span>
                <span className="text-xs text-ink-400">{col.inputType}</span>
                {columns.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeColumn(sIdx, cIdx);
                    }}
                    className={`${iconBtn} w-6 h-6 text-ink-400 hover:bg-bad-bg hover:text-bad-fg`}
                  >
                    <FiTrash2 size={12} />
                  </button>
                )}
              </div>

              {expandedCol === cIdx && (
                <div className="border-t border-line-soft p-3 flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={lbl}>Header</label>
                      <input
                        value={col.header}
                        onChange={(e) =>
                          updateColumn(sIdx, cIdx, "header", e.target.value)
                        }
                        className={inpXs}
                      />
                    </div>
                    <div>
                      <label className={lbl}>Tipe input</label>
                      <select
                        value={col.inputType}
                        onChange={(e) =>
                          updateColumn(sIdx, cIdx, "inputType", e.target.value)
                        }
                        disabled={col.isResult}
                        className={inpXs}
                      >
                        {INPUT_TYPES.map((ty) => (
                          <option key={ty} value={ty}>
                            {ty}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {col.inputType === "dropdown" && (
                    <div>
                      <label className={lbl}>
                        Opsi dropdown (satu per baris)
                      </label>
                      <textarea
                        value={(col.dropdownOptions || []).join("\n")}
                        onChange={(e) =>
                          updateColumn(
                            sIdx,
                            cIdx,
                            "dropdownOptions",
                            e.target.value.split("\n").filter(Boolean)
                          )
                        }
                        rows={3}
                        className={inpXs}
                      />
                    </div>
                  )}

                  <div className="flex gap-4 text-xs">
                    <label className="flex items-center gap-1.5 text-ink-600">
                      <input
                        type="checkbox"
                        className="accent-navy-700"
                        checked={col.editable}
                        disabled={!!col.formula || col.isResult}
                        onChange={(e) =>
                          updateColumn(
                            sIdx,
                            cIdx,
                            "editable",
                            e.target.checked
                          )
                        }
                      />
                      Dapat diedit teknisi
                    </label>
                    <label className="flex items-center gap-1.5 text-ink-600">
                      <input
                        type="checkbox"
                        className="accent-navy-700"
                        checked={col.isResult || false}
                        onChange={(e) =>
                          updateColumn(
                            sIdx,
                            cIdx,
                            "isResult",
                            e.target.checked
                          )
                        }
                      />
                      Kolom hasil (L/TB/G)
                    </label>
                  </div>

                  {!col.isResult && (
                    <FormulaEditor
                      col={col}
                      columns={columns}
                      cIdx={cIdx}
                      sIdx={sIdx}
                      updateColumn={updateColumn}
                    />
                  )}

                  {col.isResult && (
                    <PassRuleEditor
                      col={col}
                      columns={columns}
                      cIdx={cIdx}
                      sIdx={sIdx}
                      updateColumn={updateColumn}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fixed rows */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-ink-600">
            Baris tetap (pre-filled)
          </span>
          <button onClick={() => addFixedRow(sIdx)} className={linkBtn}>
            <FiPlus size={11} /> Tambah baris
          </button>
        </div>
        {fixedRows.length > 0 && (
          <div className="overflow-x-auto border border-line rounded-lg">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.id}
                      className="border-b border-r border-line bg-navy-50 px-2 py-1.5 text-left font-semibold text-ink-500 whitespace-nowrap"
                    >
                      {c.header}
                    </th>
                  ))}
                  <th className="border-b border-line bg-navy-50 w-7" />
                </tr>
              </thead>
              <tbody>
                {fixedRows.map((row, rIdx) => (
                  <tr key={row.id}>
                    {columns.map((c) => (
                      <td
                        key={c.id}
                        className="border-b border-r border-line-soft px-1 py-0.5"
                      >
                        <input
                          value={row.cells?.[c.id] ?? ""}
                          onChange={(e) =>
                            updateFixedRow(sIdx, rIdx, c.id, e.target.value)
                          }
                          placeholder={c.editable ? "" : "(auto)"}
                          disabled={!c.editable}
                          className="w-full px-1 py-0.5 text-xs bg-transparent outline-none disabled:bg-navy-50 disabled:text-ink-400"
                        />
                      </td>
                    ))}
                    <td className="border-b border-line-soft px-1 py-0.5 text-center">
                      {fixedRows.length > 1 && (
                        <button
                          onClick={() => removeFixedRow(sIdx, rIdx)}
                          className="text-ink-400 hover:text-bad-fg"
                        >
                          <FiTrash2 size={11} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row groups */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-ink-600">
            Grup baris (label visual, opsional)
          </span>
          <button onClick={() => addRowGroup(sIdx)} className={linkBtn}>
            <FiPlus size={11} /> Tambah grup
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {(section.rowGroups || []).map((g, gIdx) => (
            <div key={gIdx} className="flex items-center gap-2">
              <FiMenu size={12} className="text-ink-300 shrink-0" />
              <input
                value={g.label}
                onChange={(e) =>
                  updateRowGroup(sIdx, gIdx, "label", e.target.value)
                }
                placeholder="Label grup"
                className={inpXs}
              />
              <input
                value={(g.rowIds || []).join(", ")}
                onChange={(e) =>
                  updateRowGroup(
                    sIdx,
                    gIdx,
                    "rowIds",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                placeholder="Row IDs (comma-separated)"
                className={inpXs}
              />
              <button
                onClick={() => removeRowGroup(sIdx, gIdx)}
                className={`${iconBtn} w-7 h-7 text-ink-400 hover:bg-bad-bg hover:text-bad-fg`}
              >
                <FiTrash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Formula editor ────────────────────────────────────────────────────────────
function FormulaEditor({ col, columns, cIdx, sIdx, updateColumn }) {
  const otherCols = columns.filter((c) => c.id !== col.id && !c.isResult);
  const hasFormula = !!col.formula;

  return (
    <div className="border border-warn-fg/20 rounded-lg p-2.5 bg-warn-bg/50">
      <label className="flex items-center gap-1.5 text-xs font-medium text-warn-fg mb-2">
        <input
          type="checkbox"
          className="accent-warn-fg"
          checked={hasFormula}
          onChange={(e) =>
            updateColumn(
              sIdx,
              cIdx,
              "formula",
              e.target.checked
                ? {
                    op: "subtract",
                    a: otherCols[0]?.id || "",
                    b: otherCols[1]?.id || "",
                  }
                : null
            )
          }
        />
        Kolom dihitung otomatis (formula)
      </label>
      {hasFormula && col.formula && (
        <div className="grid grid-cols-3 gap-1.5 items-center">
          <select
            value={col.formula.a}
            onChange={(e) =>
              updateColumn(sIdx, cIdx, "formula", {
                ...col.formula,
                a: e.target.value,
              })
            }
            className={inpXs}
          >
            {otherCols.map((c) => (
              <option key={c.id} value={c.id}>
                {c.header}
              </option>
            ))}
          </select>
          <select
            value={col.formula.op}
            onChange={(e) =>
              updateColumn(sIdx, cIdx, "formula", {
                ...col.formula,
                op: e.target.value,
              })
            }
            className={inpXs}
          >
            {FORMULA_OPS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={col.formula.b}
            onChange={(e) =>
              updateColumn(sIdx, cIdx, "formula", {
                ...col.formula,
                b: e.target.value,
              })
            }
            className={inpXs}
          >
            {otherCols.map((c) => (
              <option key={c.id} value={c.id}>
                {c.header}
              </option>
            ))}
          </select>
        </div>
      )}
      {hasFormula && col.formula && (
        <p className="text-[10px] text-warn-fg mt-1.5">
          Preview: {formulaToString(col.formula, columns)}
        </p>
      )}
    </div>
  );
}

// ── Pass rule editor ──────────────────────────────────────────────────────────
function PassRuleEditor({ col, columns, cIdx, sIdx, updateColumn }) {
  const numericCols = columns.filter(
    (c) => c.id !== col.id && c.inputType === "number"
  );
  const rule = col.passRule || {};
  const isRange = rule.op === "range";

  return (
    <div className="border border-ok-fg/20 rounded-lg p-2.5 bg-ok-bg/25">
      <p className="text-xs font-semibold text-ok-fg mb-2">
        Aturan lulus/gagal (auto L/G)
      </p>
      <div className="grid grid-cols-2 gap-1.5 mb-1.5">
        <div>
          <label className={lbl}>Kolom yang dievaluasi</label>
          <select
            value={rule.col || ""}
            onChange={(e) =>
              updateColumn(sIdx, cIdx, "passRule", {
                ...rule,
                col: e.target.value,
              })
            }
            className={inpXs}
          >
            <option value="">-- Pilih kolom --</option>
            {numericCols.map((c) => (
              <option key={c.id} value={c.id}>
                {c.header}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Operator</label>
          <select
            value={rule.op || "lte"}
            onChange={(e) =>
              updateColumn(sIdx, cIdx, "passRule", {
                ...rule,
                op: e.target.value,
              })
            }
            className={inpXs}
          >
            {PASS_OPS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!isRange ? (
        <div>
          <label className={lbl}>Threshold</label>
          <input
            type="number"
            value={rule.threshold ?? ""}
            onChange={(e) =>
              updateColumn(sIdx, cIdx, "passRule", {
                ...rule,
                threshold: parseFloat(e.target.value),
              })
            }
            className={inpXs}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className={lbl}>Min</label>
            <input
              type="number"
              value={rule.rangeMin ?? ""}
              onChange={(e) =>
                updateColumn(sIdx, cIdx, "passRule", {
                  ...rule,
                  rangeMin: parseFloat(e.target.value),
                })
              }
              className={inpXs}
            />
          </div>
          <div>
            <label className={lbl}>Max</label>
            <input
              type="number"
              value={rule.rangeMax ?? ""}
              onChange={(e) =>
                updateColumn(sIdx, cIdx, "passRule", {
                  ...rule,
                  rangeMax: parseFloat(e.target.value),
                })
              }
              className={inpXs}
            />
          </div>
        </div>
      )}
      {rule.col && rule.op && (
        <p className="text-[10px] text-ok-fg mt-1.5">
          Lulus jika: {passRuleToString(rule, columns)}
        </p>
      )}
    </div>
  );
}
