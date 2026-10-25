// src/components/TableInstanceEditor.jsx
//
// Appendix Table Instance Editor (PT SUCOFINDO - Lab Teknik)
// Renders the Unified Sucofindo Spreadsheet for laboratory test datasheet filling.
//
// Features:
// - Loads table instances and autoprovisions them for sub-clauses
// - Mounts SucofindoSpreadsheet with technicianMode (restricting edit to green editable cells)
// - Real-time formula computation & automatic L/TB/G evaluation
// - Bidirectional auto-sync to both spreadsheetGrid and PostgreSQL JSONB sections
// - Debounced autosave (1.5s idle) + manual "Simpan" button
// - Instant notification to parent via onInstanceSaved for real-time clause pass/fail status
// - Support for adding/deleting multiple instance repetitions (Pengulangan 1, 2, ...)

import React, { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { FaPlus, FaTrash, FaSave, FaSpinner, FaCheckCircle } from "react-icons/fa";
import apiClient from "../api";
import SucofindoSpreadsheet from "./SucofindoSpreadsheet";
import {
  getSpreadsheetGridForInstance,
  syncSpreadsheetToInstanceData,
} from "../utils/spreadsheetEngine";

export default function TableInstanceEditor({
  reportId,
  subClauseCode,
  reportStatus,
  userRole,
  onInstanceSaved,
}) {
  const [instances, setInstances] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState({});
  const [dirty, setDirty] = useState({});
  const [justSaved, setJustSaved] = useState({});

  const instancesRef = useRef(instances);
  instancesRef.current = instances;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

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
      const instData = res.data || [];
      instancesRef.current = instData;
      setInstances(instData);

      // Fetch all templates for this report's standard, grouped by subClauseCode
      const tplRes = await apiClient.get(
        `/reports/${reportId}/table-templates`,
      );
      const grouped = tplRes.data || {};

      // Match templates by exact subClauseCode OR by parent clause code.
      const parentCode = subClauseCode.split(".")[0];
      const matched = [
        ...(grouped[subClauseCode] || []),
        ...(parentCode !== subClauseCode ? grouped[parentCode] || [] : []),
      ];
      setTemplates(matched);
    } catch (e) {
      console.error("TableInstanceEditor load error:", e);
      setError("Gagal memuat tabel lampiran. Coba refresh halaman.");
    } finally {
      setLoading(false);
    }
  }, [reportId, subClauseCode]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Auto-save on idle (400ms after last keystroke) ────────────────────────
  const timers = useRef({});

  function markDirty(instanceId) {
    dirtyRef.current[instanceId] = true;
    setDirty((prev) => ({ ...prev, [instanceId]: true }));
    setJustSaved((prev) => ({ ...prev, [instanceId]: false }));
    clearTimeout(timers.current[instanceId]);
    timers.current[instanceId] = setTimeout(() => {
      saveInstance(instanceId);
    }, 400);
  }

  // Cleanup timers & flush dirty instances on unmount
  useEffect(() => {
    return () => {
      const t = timers.current;
      Object.values(t).forEach(clearTimeout);

      // Flush any dirty instances immediately on unmount
      const pendingIds = Object.keys(dirtyRef.current).filter((id) => dirtyRef.current[id]);
      pendingIds.forEach((id) => {
        const inst = instancesRef.current.find((i) => String(i.id) === String(id));
        if (inst) {
          apiClient.put(`/table-instances/${id}`, { data: inst.data }).catch(console.error);
        }
      });
    };
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────
  async function saveInstance(instanceId) {
    const inst = instancesRef.current.find((i) => i.id === instanceId);
    if (!inst) return;
    setSaving((prev) => ({ ...prev, [instanceId]: true }));
    try {
      await apiClient.put(`/table-instances/${instanceId}`, {
        data: inst.data,
      });
      setDirty((prev) => ({ ...prev, [instanceId]: false }));
      setJustSaved((prev) => ({ ...prev, [instanceId]: true }));
      setTimeout(() => {
        setJustSaved((prev) => ({ ...prev, [instanceId]: false }));
      }, 3000);

      const updated = instancesRef.current.find((i) => i.id === instanceId);
      if (updated && onInstanceSaved) {
        onInstanceSaved(updated);
      }
    } catch (e) {
      toast.error("Gagal menyimpan tabel");
      console.error(e);
    } finally {
      setSaving((prev) => ({ ...prev, [instanceId]: false }));
    }
  }

  // ── Add another instance repetition ──────────────────────────────────────
  async function addInstance(templateId) {
    try {
      const res = await apiClient.post(`/reports/${reportId}/table-instances`, {
        templateId,
      });
      const next = [...instancesRef.current, res.data];
      instancesRef.current = next;
      setInstances(next);
      if (onInstanceSaved) onInstanceSaved(res.data);
      toast.success("Pengulangan tabel berhasil ditambahkan");
    } catch (e) {
      toast.error(e.response?.data?.error || "Gagal menambah tabel");
    }
  }

  // ── Delete repetition ────────────────────────────────────────────────────
  async function deleteInstance(instanceId) {
    if (!window.confirm("Hapus pengulangan tabel ini?")) return;
    try {
      await apiClient.delete(`/table-instances/${instanceId}`);
      const next = instancesRef.current.filter((i) => i.id !== instanceId);
      instancesRef.current = next;
      setInstances(next);
      toast.success("Tabel dihapus");
    } catch (e) {
      toast.error(e.response?.data?.error || "Gagal menghapus tabel");
    }
  }

  // ── Spreadsheet Cell Changes ─────────────────────────────────────────────
  function handleSpreadsheetChange(instanceId, updatedGrid) {
    const inst = instancesRef.current.find((i) => i.id === instanceId);
    if (!inst) return;
    const def = inst.template?.definition;
    const nextData = syncSpreadsheetToInstanceData(updatedGrid, def, inst.data);

    const next = instancesRef.current.map((i) => {
      if (i.id !== instanceId) return i;
      return { ...i, data: nextData };
    });
    instancesRef.current = next;
    setInstances(next);

    const changedInst = next.find((i) => i.id === instanceId);
    if (changedInst && onInstanceSaved) {
      onInstanceSaved(changedInst);
    }
    markDirty(instanceId);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-slate-400 py-2">
        <FaSpinner className="animate-spin" size={13} />
        Memuat tabel spreadsheet lampiran...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 text-sm text-red-500 flex items-center gap-2 py-2">
        {error}
        <button onClick={load} className="underline text-navy-600 font-semibold">
          Coba lagi
        </button>
      </div>
    );
  }

  // If no templates exist for this clause, render nothing
  if (instances.length === 0 && templates.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-6">
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
            className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden"
          >
            {/* Header Box */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-sm font-bold text-navy-900">
                  {template.title || "Tabel Pengujian"}
                </span>
                {sameTemplate.length > 1 && (
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-md">
                    Pengulangan {copyNum}
                  </span>
                )}
                {dirty[inst.id] && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Belum tersimpan
                  </span>
                )}
                {saving[inst.id] && (
                  <span className="flex items-center gap-1.5 text-xs text-navy-600 font-semibold">
                    <FaSpinner className="animate-spin" size={11} /> Menyimpan…
                  </span>
                )}
                {justSaved[inst.id] && !dirty[inst.id] && !saving[inst.id] && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                    <FaCheckCircle size={11} /> Tersimpan
                  </span>
                )}
              </div>

              {canEdit && (
                <div className="flex gap-2 shrink-0">
                  {dirty[inst.id] && (
                    <button
                      onClick={() => saveInstance(inst.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-navy-800 text-white hover:bg-navy-700 rounded-md text-xs font-semibold shadow-2xs transition"
                    >
                      <FaSave size={11} /> Simpan
                    </button>
                  )}
                  {inst.order > 0 && (
                    <button
                      onClick={() => deleteInstance(inst.id)}
                      className="px-2 py-1 border border-red-200 text-red-600 rounded-md text-xs hover:bg-red-50 transition"
                      title="Hapus pengulangan tabel ini"
                    >
                      <FaTrash size={11} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Unified Sucofindo Spreadsheet */}
            <div className="p-2 sm:p-3 overflow-x-auto max-w-full">
              <SucofindoSpreadsheet
                key={inst.id}
                initialGrid={getSpreadsheetGridForInstance(def, inst.data)}
                onChange={(updatedGrid) =>
                  handleSpreadsheetChange(inst.id, updatedGrid)
                }
                readOnly={!canEdit}
                technicianMode={canEdit}
              />
            </div>
          </div>
        );
      })}

      {/* Add repetition button */}
      {canEdit && templates.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => addInstance(t.id)}
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-dashed border-navy-300 rounded-xl text-xs font-semibold text-navy-800 bg-white hover:border-navy-600 hover:bg-navy-50/60 shadow-2xs transition whitespace-nowrap"
            >
              <FaPlus size={11} className="text-navy-600 shrink-0" />
              <span>Tambah Tabel: {t.title || "Tabel ini"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
