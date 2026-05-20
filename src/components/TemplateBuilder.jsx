// src/components/TemplateBuilder.jsx
//
// Used inside ManageStandards.jsx.
// Engineers define table templates for a specific sub-clause of a TestStandard.
//
// Props:
//   standardId   {number}  — the TestStandard being edited
//   subClauses   {Array}   — [{ kode, judul }] from the standard's clause tree
//                            used to populate the sub-clause selector
//   onClose      {fn}      — called when the panel should be hidden

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
    FaPlus, FaTrash, FaSave, FaTimes, FaChevronDown, FaChevronRight,
    FaTable, FaListAlt, FaLayerGroup, FaGripLines,
} from 'react-icons/fa';
import apiClient from '../api';
import { formulaToString, passRuleToString, genId } from '../utils/tableFormulas';

const LAYOUT_OPTIONS = [
    { value: 'key_value', label: 'Key-value form', icon: FaListAlt,
      desc: 'Label + value + manual result per row (like Lampiran 2 top section)' },
    { value: 'table', label: 'Data table', icon: FaTable,
      desc: 'Columns + data rows with optional computed columns' },
    { value: 'mixed', label: 'Mixed layout', icon: FaLayerGroup,
      desc: 'Key-value form on top, table below (full Lampiran 2)' },
];

const INPUT_TYPES = ['text', 'number', 'dropdown'];
const FORMULA_OPS = [
    { value: 'subtract', label: 'A − B (subtract)' },
    { value: 'add',      label: 'A + B (add)' },
    { value: 'multiply', label: 'A × B (multiply)' },
    { value: 'divide',   label: 'A ÷ B (divide)' },
];
const PASS_OPS = [
    { value: 'lte',   label: 'value ≤ threshold' },
    { value: 'gte',   label: 'value ≥ threshold' },
    { value: 'lt',    label: 'value < threshold' },
    { value: 'gt',    label: 'value > threshold' },
    { value: 'eq',    label: 'value = threshold' },
    { value: 'range', label: 'min ≤ value ≤ max' },
];

export default function TemplateBuilder({ standardId, subClauses = [], onClose }) {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingTemplate, setEditingTemplate] = useState(null); // null = list view
    const [saving, setSaving] = useState(false);
    const [filterClause, setFilterClause] = useState('');

    // ── Fetch existing templates ─────────────────────────────────────────────
    const fetchTemplates = useCallback(async () => {
        if (!standardId) return;
        setLoading(true);
        try {
            const res = await apiClient.get(`/standards/${standardId}/table-templates`);
            setTemplates(res.data || []);
        } catch (e) {
            toast.error('Gagal memuat template tabel');
        } finally {
            setLoading(false);
        }
    }, [standardId]);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    // ── Start creating a new template ────────────────────────────────────────
    function newTemplate() {
        setEditingTemplate({
            _isNew: true,
            subClauseCode: filterClause || '',
            title: '',
            definition: {
                layout: 'table',
                sections: [newTableSection()],
            },
        });
    }

    // ── Save template (create or update) ─────────────────────────────────────
    async function saveTemplate() {
        if (!editingTemplate.subClauseCode) {
            toast.error('Pilih sub-klausul terlebih dahulu');
            return;
        }
        setSaving(true);
        try {
            if (editingTemplate._isNew) {
                const res = await apiClient.post(`/standards/${standardId}/table-templates`, {
                    subClauseCode: editingTemplate.subClauseCode,
                    title: editingTemplate.title,
                    definition: editingTemplate.definition,
                });
                setTemplates(prev => [...prev, res.data]);
            } else {
                const res = await apiClient.put(`/table-templates/${editingTemplate.id}`, {
                    title: editingTemplate.title,
                    subClauseCode: editingTemplate.subClauseCode,
                    definition: editingTemplate.definition,
                });
                setTemplates(prev => prev.map(t => t.id === res.data.id ? res.data : t));
            }
            toast.success('Template disimpan');
            setEditingTemplate(null);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Gagal menyimpan template');
        } finally {
            setSaving(false);
        }
    }

    async function deleteTemplate(id) {
        if (!window.confirm('Hapus template ini? Semua data yang sudah diisi akan hilang.')) return;
        try {
            await apiClient.delete(`/table-templates/${id}`);
            setTemplates(prev => prev.filter(t => t.id !== id));
            toast.success('Template dihapus');
        } catch (e) {
            toast.error('Gagal menghapus template');
        }
    }

    // ── Mutate editingTemplate helpers ───────────────────────────────────────
    function setDef(mutator) {
        setEditingTemplate(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            next.definition = mutator(next.definition);
            return next;
        });
    }

    function setLayout(layout) {
        setDef(def => {
            def.layout = layout;
            if (layout === 'key_value') def.sections = [newKvSection()];
            else if (layout === 'table') def.sections = [newTableSection()];
            else def.sections = [newKvSection(), newTableSection()];
            return def;
        });
    }

    function updateSectionLabel(sIdx, label) {
        setDef(def => { def.sections[sIdx].label = label; return def; });
    }

    // ── KEY-VALUE SECTION helpers ────────────────────────────────────────────
    function newKvSection() {
        return {
            type: 'key_value',
            label: '',
            rows: [{ id: genId('kv'), label: '', inputType: 'text', resultMode: 'manual', required: false }],
        };
    }

    function addKvRow(sIdx) {
        setDef(def => {
            def.sections[sIdx].rows.push({
                id: genId('kv'), label: '', inputType: 'text', resultMode: 'manual', required: false,
            });
            return def;
        });
    }

    function updateKvRow(sIdx, rIdx, field, value) {
        setDef(def => { def.sections[sIdx].rows[rIdx][field] = value; return def; });
    }

    function removeKvRow(sIdx, rIdx) {
        setDef(def => { def.sections[sIdx].rows.splice(rIdx, 1); return def; });
    }

    // ── TABLE SECTION helpers ────────────────────────────────────────────────
    function newTableSection() {
        const c1 = genId('c');
        return {
            type: 'table',
            label: '',
            allowAddRows: true,
            rowGroups: [],
            columns: [
                { id: c1, header: 'Parameter', inputType: 'text', editable: true, isResult: false, width: 200 },
            ],
            fixedRows: [{ id: genId('r'), cells: { [c1]: '' } }],
        };
    }

    function addColumn(sIdx) {
        const id = genId('c');
        setDef(def => {
            def.sections[sIdx].columns.push({
                id, header: 'Kolom Baru', inputType: 'number', editable: true, isResult: false,
            });
            def.sections[sIdx].fixedRows.forEach(r => { r.cells[id] = ''; });
            return def;
        });
    }

    function updateColumn(sIdx, cIdx, field, value) {
        setDef(def => {
            def.sections[sIdx].columns[cIdx][field] = value;
            // If marking as computed, auto-set editable=false
            if (field === 'formula' && value) def.sections[sIdx].columns[cIdx].editable = false;
            if (field === 'isResult' && value) def.sections[sIdx].columns[cIdx].editable = false;
            return def;
        });
    }

    function removeColumn(sIdx, cIdx) {
        setDef(def => {
            const colId = def.sections[sIdx].columns[cIdx].id;
            def.sections[sIdx].columns.splice(cIdx, 1);
            def.sections[sIdx].fixedRows.forEach(r => { delete r.cells[colId]; });
            return def;
        });
    }

    function addFixedRow(sIdx) {
        setDef(def => {
            const cells = {};
            def.sections[sIdx].columns.forEach(c => { cells[c.id] = ''; });
            def.sections[sIdx].fixedRows.push({ id: genId('r'), cells });
            return def;
        });
    }

    function updateFixedRow(sIdx, rIdx, colId, value) {
        setDef(def => { def.sections[sIdx].fixedRows[rIdx].cells[colId] = value; return def; });
    }

    function removeFixedRow(sIdx, rIdx) {
        setDef(def => { def.sections[sIdx].fixedRows.splice(rIdx, 1); return def; });
    }

    function addRowGroup(sIdx) {
        setDef(def => {
            if (!def.sections[sIdx].rowGroups) def.sections[sIdx].rowGroups = [];
            def.sections[sIdx].rowGroups.push({ label: '', rowIds: [] });
            return def;
        });
    }

    function updateRowGroup(sIdx, gIdx, field, value) {
        setDef(def => { def.sections[sIdx].rowGroups[gIdx][field] = value; return def; });
    }

    function removeRowGroup(sIdx, gIdx) {
        setDef(def => { def.sections[sIdx].rowGroups.splice(gIdx, 1); return def; });
    }

    // ── RENDER ───────────────────────────────────────────────────────────────
    const filtered = filterClause
        ? templates.filter(t => t.subClauseCode === filterClause)
        : templates;

    if (editingTemplate) {
        return <TemplateEditor
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
        />;
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-800">Template Tabel Lampiran</h3>
                    <select
                        value={filterClause}
                        onChange={e => setFilterClause(e.target.value)}
                        className="text-sm border rounded px-2 py-1"
                    >
                        <option value="">Semua sub-klausul</option>
                        {subClauses.map(s => (
                            <option key={s.kode} value={s.kode}>{s.kode} — {s.judul || ''}</option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={newTemplate}
                        className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 text-white rounded text-sm"
                    >
                        <FaPlus size={11} /> Template Baru
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="px-3 py-1.5 border rounded text-sm">
                            <FaTimes size={11} />
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <p className="text-sm text-gray-400">Memuat template...</p>
            ) : filtered.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                    Belum ada template. Klik "Template Baru" untuk membuat.
                </p>
            ) : (
                <div className="space-y-2">
                    {filtered.map(t => (
                        <div key={t.id}
                            className="flex items-center justify-between px-3 py-2 border rounded bg-white hover:bg-gray-50"
                        >
                            <div>
                                <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mr-2">
                                    {t.subClauseCode}
                                </span>
                                <span className="text-sm font-medium">{t.title || 'Tanpa judul'}</span>
                                <span className="text-xs text-gray-400 ml-2">
                                    {t.definition?.layout}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditingTemplate({ ...t })}
                                    className="px-2 py-1 border rounded text-xs text-sky-600 hover:bg-sky-50"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => deleteTemplate(t.id)}
                                    className="px-2 py-1 border border-red-200 rounded text-xs text-red-600 hover:bg-red-50"
                                >
                                    <FaTrash size={10} />
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
    t, subClauses, saving, onBack, onSave, onChange,
    setDef, setLayout, updateSectionLabel,
    addKvRow, updateKvRow, removeKvRow,
    addColumn, updateColumn, removeColumn,
    addFixedRow, updateFixedRow, removeFixedRow,
    addRowGroup, updateRowGroup, removeRowGroup,
}) {
    const def = t.definition;

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800">
                    ← Kembali
                </button>
                <span className="text-gray-300">/</span>
                <span className="text-sm font-medium">
                    {t._isNew ? 'Template Baru' : (t.title || 'Edit Template')}
                </span>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                    <label className="text-xs text-gray-500 block mb-1">Sub-klausul</label>
                    <select
                        value={t.subClauseCode}
                        onChange={e => onChange(p => ({ ...p, subClauseCode: e.target.value }))}
                        className="w-full border rounded px-2 py-1 text-sm"
                    >
                        <option value="">-- Pilih --</option>
                        {subClauses.map(s => (
                            <option key={s.kode} value={s.kode}>
                                {s.kode}{s.judul ? ` — ${s.judul}` : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-gray-500 block mb-1">Judul template</label>
                    <input
                        value={t.title}
                        onChange={e => onChange(p => ({ ...p, title: e.target.value }))}
                        placeholder="misal: TABEL I — Pengujian Mampu Tukar E27"
                        className="w-full border rounded px-2 py-1 text-sm"
                    />
                </div>
            </div>

            {/* Layout selector */}
            <div className="mb-4">
                <label className="text-xs text-gray-500 block mb-2">Tipe layout</label>
                <div className="grid grid-cols-3 gap-2">
                    {LAYOUT_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setLayout(opt.value)}
                            className={`flex flex-col items-start p-3 rounded border text-left transition ${
                                def.layout === opt.value
                                    ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-300'
                                    : 'border-gray-200 hover:border-gray-400'
                            }`}
                        >
                            <opt.icon size={14} className="mb-1 text-gray-600" />
                            <span className="text-xs font-medium text-gray-800">{opt.label}</span>
                            <span className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Sections */}
            <div className="space-y-4 mb-4">
                {def.sections.map((section, sIdx) => (
                    <div key={sIdx} className="border rounded bg-gray-50 p-3">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-mono bg-white border rounded px-1.5 py-0.5 text-gray-500">
                                {section.type}
                            </span>
                            <input
                                value={section.label || ''}
                                onChange={e => updateSectionLabel(sIdx, e.target.value)}
                                placeholder="Label seksi (opsional)"
                                className="flex-1 border rounded px-2 py-1 text-sm"
                            />
                        </div>

                        {section.type === 'key_value' && (
                            <KvSectionEditor
                                section={section}
                                sIdx={sIdx}
                                addKvRow={addKvRow}
                                updateKvRow={updateKvRow}
                                removeKvRow={removeKvRow}
                            />
                        )}

                        {section.type === 'table' && (
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
            <div className="flex gap-2 justify-end pt-3 border-t">
                <button onClick={onBack} className="px-4 py-2 border rounded text-sm">
                    Batal
                </button>
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="px-4 py-2 bg-sky-600 text-white rounded text-sm flex items-center gap-2"
                >
                    <FaSave size={12} />
                    {saving ? 'Menyimpan...' : 'Simpan Template'}
                </button>
            </div>
        </div>
    );
}

// ── Key-value section editor ──────────────────────────────────────────────────
function KvSectionEditor({ section, sIdx, addKvRow, updateKvRow, removeKvRow }) {
    return (
        <div className="space-y-2">
            {section.rows.map((row, rIdx) => (
                <div key={row.id} className="flex items-center gap-2 bg-white border rounded px-2 py-1.5">
                    <input
                        value={row.label}
                        onChange={e => updateKvRow(sIdx, rIdx, 'label', e.target.value)}
                        placeholder="Label baris"
                        className="flex-1 border rounded px-2 py-1 text-sm"
                    />
                    <select
                        value={row.inputType}
                        onChange={e => updateKvRow(sIdx, rIdx, 'inputType', e.target.value)}
                        className="border rounded px-1 py-1 text-xs"
                    >
                        {INPUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                        <input
                            type="checkbox"
                            checked={row.required || false}
                            onChange={e => updateKvRow(sIdx, rIdx, 'required', e.target.checked)}
                        />
                        Wajib
                    </label>
                    {section.rows.length > 1 && (
                        <button onClick={() => removeKvRow(sIdx, rIdx)} className="text-red-400 hover:text-red-600">
                            <FaTrash size={10} />
                        </button>
                    )}
                </div>
            ))}
            <button
                onClick={() => addKvRow(sIdx)}
                className="text-xs text-sky-600 flex items-center gap-1"
            >
                <FaPlus size={9} /> Tambah baris
            </button>
        </div>
    );
}

// ── Table section editor ──────────────────────────────────────────────────────
function TableSectionEditor({
    section, sIdx, setDef,
    addColumn, updateColumn, removeColumn,
    addFixedRow, updateFixedRow, removeFixedRow,
    addRowGroup, updateRowGroup, removeRowGroup,
}) {
    const [expandedCol, setExpandedCol] = useState(null);
    const columns = section.columns || [];
    const fixedRows = section.fixedRows || [];

    return (
        <div className="space-y-4">
            {/* Allow add rows toggle */}
            <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                    type="checkbox"
                    checked={section.allowAddRows || false}
                    onChange={e => setDef(def => {
                        def.sections[sIdx].allowAddRows = e.target.checked;
                        return def;
                    })}
                />
                Teknisi dapat menambah baris baru
            </label>

            {/* Columns */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">Kolom</span>
                    <button onClick={() => addColumn(sIdx)}
                        className="text-xs text-sky-600 flex items-center gap-1">
                        <FaPlus size={9} /> Tambah kolom
                    </button>
                </div>
                <div className="space-y-1">
                    {columns.map((col, cIdx) => (
                        <div key={col.id} className="border rounded bg-white">
                            <div
                                className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                                onClick={() => setExpandedCol(expandedCol === cIdx ? null : cIdx)}
                            >
                                {expandedCol === cIdx
                                    ? <FaChevronDown size={10} className="text-gray-400" />
                                    : <FaChevronRight size={10} className="text-gray-400" />
                                }
                                <span className="text-sm flex-1">
                                    {col.header || 'Kolom'}
                                    {!col.editable && <span className="ml-1 text-xs text-amber-600">[auto]</span>}
                                    {col.isResult && <span className="ml-1 text-xs text-emerald-600">[hasil]</span>}
                                </span>
                                <span className="text-xs text-gray-400">{col.inputType}</span>
                                {columns.length > 1 && (
                                    <button onClick={e => { e.stopPropagation(); removeColumn(sIdx, cIdx); }}
                                        className="text-red-400 hover:text-red-600 p-0.5">
                                        <FaTrash size={10} />
                                    </button>
                                )}
                            </div>

                            {expandedCol === cIdx && (
                                <div className="border-t p-3 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs text-gray-400">Header</label>
                                            <input value={col.header}
                                                onChange={e => updateColumn(sIdx, cIdx, 'header', e.target.value)}
                                                className="w-full border rounded px-2 py-1 text-xs" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400">Tipe input</label>
                                            <select value={col.inputType}
                                                onChange={e => updateColumn(sIdx, cIdx, 'inputType', e.target.value)}
                                                disabled={col.isResult}
                                                className="w-full border rounded px-2 py-1 text-xs">
                                                {INPUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {col.inputType === 'dropdown' && (
                                        <div>
                                            <label className="text-xs text-gray-400">Opsi dropdown (satu per baris)</label>
                                            <textarea
                                                value={(col.dropdownOptions || []).join('\n')}
                                                onChange={e => updateColumn(sIdx, cIdx, 'dropdownOptions',
                                                    e.target.value.split('\n').filter(Boolean))}
                                                rows={3}
                                                className="w-full border rounded px-2 py-1 text-xs"
                                            />
                                        </div>
                                    )}

                                    <div className="flex gap-4 text-xs">
                                        <label className="flex items-center gap-1 text-gray-600">
                                            <input type="checkbox" checked={col.editable}
                                                disabled={!!col.formula || col.isResult}
                                                onChange={e => updateColumn(sIdx, cIdx, 'editable', e.target.checked)} />
                                            Dapat diedit teknisi
                                        </label>
                                        <label className="flex items-center gap-1 text-gray-600">
                                            <input type="checkbox" checked={col.isResult || false}
                                                onChange={e => updateColumn(sIdx, cIdx, 'isResult', e.target.checked)} />
                                            Kolom hasil (L/TB/G)
                                        </label>
                                    </div>

                                    {/* Formula */}
                                    {!col.isResult && (
                                        <FormulaEditor
                                            col={col}
                                            columns={columns}
                                            cIdx={cIdx}
                                            sIdx={sIdx}
                                            updateColumn={updateColumn}
                                        />
                                    )}

                                    {/* Pass rule */}
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

            {/* Fixed rows (pre-defined row labels) */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">Baris tetap (pre-filled)</span>
                    <button onClick={() => addFixedRow(sIdx)}
                        className="text-xs text-sky-600 flex items-center gap-1">
                        <FaPlus size={9} /> Tambah baris
                    </button>
                </div>
                {fixedRows.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="text-xs border-collapse w-full">
                            <thead>
                                <tr>
                                    {columns.map(c => (
                                        <th key={c.id} className="border px-2 py-1 bg-gray-100 text-left font-medium">
                                            {c.header}
                                        </th>
                                    ))}
                                    <th className="border px-1 py-1 w-6" />
                                </tr>
                            </thead>
                            <tbody>
                                {fixedRows.map((row, rIdx) => (
                                    <tr key={row.id}>
                                        {columns.map(c => (
                                            <td key={c.id} className="border px-1 py-0.5">
                                                <input
                                                    value={row.cells?.[c.id] ?? ''}
                                                    onChange={e => updateFixedRow(sIdx, rIdx, c.id, e.target.value)}
                                                    placeholder={c.editable ? '' : '(auto)'}
                                                    disabled={!c.editable}
                                                    className="w-full px-1 py-0.5 text-xs disabled:bg-gray-50 disabled:text-gray-400"
                                                />
                                            </td>
                                        ))}
                                        <td className="border px-1 py-0.5 text-center">
                                            {fixedRows.length > 1 && (
                                                <button onClick={() => removeFixedRow(sIdx, rIdx)}
                                                    className="text-red-400 hover:text-red-600">
                                                    <FaTrash size={9} />
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
                    <span className="text-xs font-medium text-gray-600">
                        Grup baris (label visual, opsional)
                    </span>
                    <button onClick={() => addRowGroup(sIdx)}
                        className="text-xs text-sky-600 flex items-center gap-1">
                        <FaPlus size={9} /> Tambah grup
                    </button>
                </div>
                {(section.rowGroups || []).map((g, gIdx) => (
                    <div key={gIdx} className="flex items-center gap-2 mb-1">
                        <FaGripLines size={10} className="text-gray-300" />
                        <input
                            value={g.label}
                            onChange={e => updateRowGroup(sIdx, gIdx, 'label', e.target.value)}
                            placeholder="Label grup"
                            className="flex-1 border rounded px-2 py-0.5 text-xs"
                        />
                        <input
                            value={(g.rowIds || []).join(', ')}
                            onChange={e => updateRowGroup(sIdx, gIdx, 'rowIds',
                                e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            placeholder="Row IDs (comma-separated)"
                            className="flex-1 border rounded px-2 py-0.5 text-xs"
                        />
                        <button onClick={() => removeRowGroup(sIdx, gIdx)}
                            className="text-red-400"><FaTrash size={9} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Formula editor ────────────────────────────────────────────────────────────
function FormulaEditor({ col, columns, cIdx, sIdx, updateColumn }) {
    const otherCols = columns.filter(c => c.id !== col.id && !c.isResult);
    const hasFormula = !!col.formula;

    return (
        <div className="border rounded p-2 bg-amber-50">
            <label className="flex items-center gap-1 text-xs text-amber-700 mb-2">
                <input
                    type="checkbox"
                    checked={hasFormula}
                    onChange={e => updateColumn(sIdx, cIdx, 'formula',
                        e.target.checked
                            ? { op: 'subtract', a: otherCols[0]?.id || '', b: otherCols[1]?.id || '' }
                            : null
                    )}
                />
                Kolom dihitung otomatis (formula)
            </label>
            {hasFormula && col.formula && (
                <div className="grid grid-cols-3 gap-1 items-center">
                    <select value={col.formula.a}
                        onChange={e => updateColumn(sIdx, cIdx, 'formula', { ...col.formula, a: e.target.value })}
                        className="border rounded px-1 py-0.5 text-xs">
                        {otherCols.map(c => <option key={c.id} value={c.id}>{c.header}</option>)}
                    </select>
                    <select value={col.formula.op}
                        onChange={e => updateColumn(sIdx, cIdx, 'formula', { ...col.formula, op: e.target.value })}
                        className="border rounded px-1 py-0.5 text-xs">
                        {FORMULA_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <select value={col.formula.b}
                        onChange={e => updateColumn(sIdx, cIdx, 'formula', { ...col.formula, b: e.target.value })}
                        className="border rounded px-1 py-0.5 text-xs">
                        {otherCols.map(c => <option key={c.id} value={c.id}>{c.header}</option>)}
                    </select>
                </div>
            )}
            {hasFormula && col.formula && (
                <p className="text-[10px] text-amber-600 mt-1">
                    Preview: {formulaToString(col.formula, columns)}
                </p>
            )}
        </div>
    );
}

// ── Pass rule editor ──────────────────────────────────────────────────────────
function PassRuleEditor({ col, columns, cIdx, sIdx, updateColumn }) {
    const numericCols = columns.filter(c => c.id !== col.id && c.inputType === 'number');
    const rule = col.passRule || {};
    const isRange = rule.op === 'range';

    return (
        <div className="border rounded p-2 bg-emerald-50">
            <p className="text-xs font-medium text-emerald-700 mb-2">Aturan lulus/gagal (auto L/G)</p>
            <div className="grid grid-cols-2 gap-1 mb-1">
                <div>
                    <label className="text-[10px] text-gray-500">Kolom yang dievaluasi</label>
                    <select
                        value={rule.col || ''}
                        onChange={e => updateColumn(sIdx, cIdx, 'passRule', { ...rule, col: e.target.value })}
                        className="w-full border rounded px-1 py-0.5 text-xs"
                    >
                        <option value="">-- Pilih kolom --</option>
                        {numericCols.map(c => <option key={c.id} value={c.id}>{c.header}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] text-gray-500">Operator</label>
                    <select
                        value={rule.op || 'lte'}
                        onChange={e => updateColumn(sIdx, cIdx, 'passRule', { ...rule, op: e.target.value })}
                        className="w-full border rounded px-1 py-0.5 text-xs"
                    >
                        {PASS_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
            </div>
            {!isRange ? (
                <div>
                    <label className="text-[10px] text-gray-500">Threshold</label>
                    <input
                        type="number"
                        value={rule.threshold ?? ''}
                        onChange={e => updateColumn(sIdx, cIdx, 'passRule',
                            { ...rule, threshold: parseFloat(e.target.value) })}
                        className="w-full border rounded px-1 py-0.5 text-xs"
                    />
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-1">
                    <div>
                        <label className="text-[10px] text-gray-500">Min</label>
                        <input type="number" value={rule.rangeMin ?? ''}
                            onChange={e => updateColumn(sIdx, cIdx, 'passRule',
                                { ...rule, rangeMin: parseFloat(e.target.value) })}
                            className="w-full border rounded px-1 py-0.5 text-xs" />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500">Max</label>
                        <input type="number" value={rule.rangeMax ?? ''}
                            onChange={e => updateColumn(sIdx, cIdx, 'passRule',
                                { ...rule, rangeMax: parseFloat(e.target.value) })}
                            className="w-full border rounded px-1 py-0.5 text-xs" />
                    </div>
                </div>
            )}
            {rule.col && rule.op && (
                <p className="text-[10px] text-emerald-600 mt-1">
                    Lulus jika: {passRuleToString(rule, columns)}
                </p>
            )}
        </div>
    );
}
