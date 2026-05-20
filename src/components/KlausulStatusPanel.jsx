// src/components/KlausulStatusPanel.jsx
//
// Shows the status of each klausul in a report and provides:
// - Technician: "Submit this klausul" checkbox selection + submit button
// - Engineer: "Approve selected klausuls" with optional correction notes
//
// Props:
//   reportId       {number}
//   reportData     {Array}   - the clauses array from report.data
//   klausulStatuses {object} - { klausulCode: KlausulStatus }
//   userRole       {string}
//   onStatusChange {fn}     - called after a successful submit or approve

import React, { useState } from "react";
import toast from "react-hot-toast";
import { FaSpinner, FaCheck, FaUpload } from "react-icons/fa";
import apiClient from "../api";
import StatusBadge from "./StatusBadge";

export default function KlausulStatusPanel({
  reportId,
  reportData = [],
  klausulStatuses = {},
  userRole,
  onStatusChange,
  onBeforeApprove,
}) {
  const [selected, setSelected] = useState(new Set());
  const [corrections, setCorrections] = useState({}); // { klausulCode: string }
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);

  const isTechnician = userRole === "TECHNICIAN" || userRole === "ADMIN";
  const isEngineer = userRole === "ENGINEER" || userRole === "ADMIN";

  function toggleSelect(code) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  function selectAll(codes) {
    setSelected(new Set(codes));
  }

  // ── Technician: submit selected klausuls ──────────────────────────────────
  async function handleSubmit() {
    if (selected.size === 0) {
      toast.error("Pilih minimal satu klausul untuk di-submit.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.post(`/reports/${reportId}/submit-klausuls`, {
        klausulCodes: Array.from(selected),
      });
      toast.success(`${selected.size} klausul berhasil di-submit ke engineer.`);
      setSelected(new Set());
      onStatusChange && onStatusChange(res.data.klausulStatuses);
    } catch (e) {
      const msg = e.response?.data?.error || "Gagal submit klausul.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Engineer: approve selected klausuls ───────────────────────────────────
  async function handleApprove() {
    if (selected.size === 0) {
      toast.error("Pilih minimal satu klausul untuk disetujui.");
      return;
    }

    if (onBeforeApprove) {
      await onBeforeApprove();
    }

    setApproving(true);
    try {
      const klausuls = Array.from(selected).map((code) => ({
        klausulCode: code,
        corrections: corrections[code] || null,
      }));
      const res = await apiClient.post(
        `/reports/${reportId}/approve-klausuls`,
        {
          klausuls,
        },
      );
      toast.success(`${selected.size} klausul disetujui.`);
      setSelected(new Set());
      setCorrections({});
      onStatusChange && onStatusChange(res.data.klausulStatuses);
    } catch (e) {
      const msg = e.response?.data?.error || "Gagal menyetujui klausul.";
      toast.error(msg);
    } finally {
      setApproving(false);
    }
  }

  // Which klausuls are selectable depends on role
  const submittableCodes = reportData
    .map((k) => k.klausul)
    .filter((code) => {
      const s = klausulStatuses[code];
      return !s || s.status === "DRAFT"; // only draft ones can be submitted
    });

  const approvableCodes = reportData
    .map((k) => k.klausul)
    .filter((code) => {
      const s = klausulStatuses[code];
      return s && s.status === "SUBMITTED";
    });

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Status Klausul</h3>
        {isTechnician && submittableCodes.length > 0 && (
          <button
            onClick={() => selectAll(submittableCodes)}
            className="text-xs text-sky-600 hover:underline"
          >
            Pilih semua Draft
          </button>
        )}
        {isEngineer && approvableCodes.length > 0 && (
          <button
            onClick={() => selectAll(approvableCodes)}
            className="text-xs text-sky-600 hover:underline"
          >
            Pilih semua Direview
          </button>
        )}
      </div>

      <div className="space-y-2">
        {reportData.map((k) => {
          const s = klausulStatuses[k.klausul];
          const status = s?.status || "DRAFT";
          const isSelectable = isTechnician
            ? status === "DRAFT"
            : isEngineer
              ? status === "SUBMITTED"
              : false;

          const isChecked = selected.has(k.klausul);

          return (
            <div key={k.klausul}>
              <div
                className={`flex items-center gap-3 p-2 rounded transition ${
                  isSelectable ? "cursor-pointer hover:bg-gray-50" : ""
                } ${isChecked ? "bg-sky-50 ring-1 ring-sky-200" : ""}`}
                onClick={() => isSelectable && toggleSelect(k.klausul)}
              >
                {isSelectable && (
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSelect(k.klausul)}
                    className="w-4 h-4 accent-sky-600"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                {!isSelectable && (
                  <div className="w-4 h-4 flex items-center justify-center">
                    {status === "APPROVED" && (
                      <FaCheck size={12} className="text-emerald-600" />
                    )}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">
                      {k.klausul}
                    </span>
                    <span className="text-xs text-gray-500 truncate">
                      {k.judul || ""}
                    </span>
                  </div>
                  {s?.submittedBy && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      Oleh: {s.submittedBy.name}
                      {s.submittedAt &&
                        ` · ${new Date(s.submittedAt).toLocaleDateString("id-ID")}`}
                    </div>
                  )}
                  {s?.corrections && (
                    <div className="text-xs text-amber-600 mt-0.5">
                      Koreksi: {s.corrections}
                    </div>
                  )}
                </div>

                <StatusBadge status={status} />
              </div>

              {/* Engineer correction notes input — shown when this klausul is selected */}
              {isEngineer && isChecked && status === "SUBMITTED" && (
                <div className="ml-7 mt-1 mb-2">
                  <input
                    type="text"
                    placeholder="Catatan koreksi (opsional)"
                    value={corrections[k.klausul] || ""}
                    onChange={(e) =>
                      setCorrections((prev) => ({
                        ...prev,
                        [k.klausul]: e.target.value,
                      }))
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="w-full border rounded px-2 py-1 text-xs"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      {isTechnician && selected.size > 0 && (
        <div className="mt-4 pt-3 border-t">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 text-white rounded text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <FaSpinner className="animate-spin" size={12} /> Menyubmit...
              </>
            ) : (
              <>
                <FaUpload size={12} /> Submit {selected.size} Klausul ke
                Engineer
              </>
            )}
          </button>
        </div>
      )}

      {isEngineer && selected.size > 0 && (
        <div className="mt-4 pt-3 border-t">
          <button
            onClick={handleApprove}
            disabled={approving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {approving ? (
              <>
                <FaSpinner className="animate-spin" size={12} /> Menyetujui...
              </>
            ) : (
              <>
                <FaCheck size={12} /> Setujui {selected.size} Klausul
              </>
            )}
          </button>
        </div>
      )}

      {selected.size === 0 && (
        <p className="mt-3 text-xs text-gray-400 text-center">
          {isTechnician
            ? "Centang klausul yang ingin di-submit ke engineer"
            : isEngineer
              ? "Centang klausul yang ingin disetujui"
              : ""}
        </p>
      )}
    </div>
  );
}
