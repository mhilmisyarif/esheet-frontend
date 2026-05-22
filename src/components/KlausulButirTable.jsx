// src/components/KlausulButirTable.jsx
//
// Clause fill UI — redesigned to the E-Datasheet "klausul editor" design:
// test-conditions card, subsection clause-cards, ci-table, L/TB/G segmented
// controls and inline Hasil/Catatan. All decision / autosave logic preserved.

import React, { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { FaSpinner } from "react-icons/fa";
import {
  FiMoreHorizontal,
  FiTrash2,
  FiRotateCcw,
  FiCheck,
  FiLock,
} from "react-icons/fi";
import apiClient from "../api";
import TableInstanceEditor from "./TableInstanceEditor";

const SEG_OPTS = ["L", "TB", "G"];
const SEG_TITLE = { L: "Lulus", TB: "Tidak Berlaku", G: "Gagal" };
const SEG_ACTIVE = {
  L: "bg-[#1b9c4d] text-white",
  TB: "bg-[#f59e0b] text-white",
  G: "bg-[#d12c45] text-white",
};

// Segmented L / TB / G control
function Seg({ value, onChange, small, disabled }) {
  return (
    <div className="inline-flex bg-white border border-line rounded-[10px] p-[3px] gap-0.5">
      {SEG_OPTS.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            disabled={disabled}
            title={SEG_TITLE[o]}
            onClick={() => onChange(o)}
            className={`inline-flex items-center justify-center font-bold rounded-[7px] transition-colors ${
              small
                ? "min-w-7 h-6 px-2 text-[11px]"
                : "min-w-9 h-[30px] px-2.5 text-xs"
            } ${
              active
                ? SEG_ACTIVE[o]
                : disabled
                  ? "text-ink-300 cursor-not-allowed"
                  : "text-ink-500 hover:bg-navy-50 hover:text-navy-800"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

const condInput =
  "w-full px-3 py-2 border border-line rounded-lg text-sm text-navy-800 bg-paper outline-none transition-colors focus:border-navy-600 focus:ring-[3px] focus:ring-navy-600/[0.12]";

function CondField({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-ink-500 uppercase tracking-[0.06em]">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function KlausulButirTable({
  report,
  fullReport,
  onChangeReport,
  onRegisterFlush,
  onDeleteSample,
  userRole,
  userName,
}) {
  const [localKlausulArr, setLocalKlausulArr] = useState(report.klausul || []);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [imagesState, setImagesState] = useState(report.images || []);
  const [menuOpen, setMenuOpen] = useState(false);

  const dirtyRef = useRef({});
  const persistedRef = useRef({});
  const menuRef = useRef(null);

  const sampleId =
    (fullReport && fullReport.sample_id) ||
    report.sample_id ||
    (fullReport && fullReport.sample && fullReport.sample.id) ||
    null;

  const reportId =
    (fullReport && fullReport.id) || (report && report.id) || null;

  const reportStatus = fullReport?.status || report?.status || "DRAFT";
  const locked = reportStatus === "APPROVED";

  useEffect(() => {
    const cloned = JSON.parse(JSON.stringify(report.klausul || []));
    cloned.forEach((k) => {
      if (!k.meta)
        k.meta = {
          tester_name: "",
          test_datetime: "",
          temperature: null,
          humidity: null,
        };
    });
    setLocalKlausulArr(cloned);
    setImagesState(fullReport.images || []);

    const map = {};
    cloned.forEach((k) => {
      k.sub_klausul.forEach((s) => {
        s.butir.forEach((b) => {
          map[b.kode] = {
            keputusan: b.keputusan,
            hasil_catatan: b.hasil_catatan,
          };
        });
      });
      map[`meta-${k.klausul}`] = { ...(k.meta || {}) };
    });
    map["images"] = JSON.stringify(fullReport.images || []);
    persistedRef.current = map;
  }, [report, fullReport.images]);

  // Close the kebab menu on outside click
  useEffect(() => {
    const h = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const markDirty = useCallback((key) => {
    dirtyRef.current = { ...dirtyRef.current, [key]: true };
  }, []);

  function updateLocalDecision(klausulCode, butirKode, decision) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.sub_klausul.forEach((s) =>
          s.butir.forEach((b) => {
            if (b.kode === butirKode) {
              if (userRole === "ENGINEER" || userRole === "ADMIN") {
                if (b.original_keputusan === undefined) {
                  b.original_keputusan = b.keputusan;
                }
                b.is_corrected = decision !== b.original_keputusan;
                if (b.is_corrected) b.corrected_by = userName;
              }
              b.keputusan = decision;
              b.last_modified_by = userName || "unknown";
              b.last_modified_at = new Date().toISOString();
            }
          }),
        );
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport(next);
    markDirty(butirKode);
  }

  function updateLocalCatatan(klausulCode, butirKode, text) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.sub_klausul.forEach((s) =>
          s.butir.forEach((b) => {
            if (b.kode === butirKode) {
              b.hasil_catatan = text;
              b.last_modified_by = userName || "unknown";
              b.last_modified_at = new Date().toISOString();
            }
          }),
        );
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport(next);
    markDirty(butirKode);
  }

  function updateKlausulMeta(klausulCode, changes) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    let changedClause = null;
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.meta = { ...(k.meta || {}), ...changes };
        k.last_meta_modified_at = new Date().toISOString();
        changedClause = k;
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport([changedClause]);
    markDirty(`meta-${klausulCode}`);
  }

  const isButirFilled = (b) => !!b.keputusan;

  const flushAutosave = useCallback(async () => {
    if (reportStatus === "APPROVED") {
      return { ok: true, count: 0 };
    }

    if (!reportId || Object.keys(dirtyRef.current).length === 0) {
      toast("Tidak ada perubahan untuk disimpan");
      return { ok: true, count: 0 };
    }

    const currentReportData = fullReport.data;
    const currentImagesData = imagesState;

    setIsAutosaving(true);
    try {
      await apiClient.patch(`/reports/${reportId}/data`, {
        data: currentReportData,
        images: currentImagesData,
      });
      dirtyRef.current = {};
      toast.success("Perubahan berhasil disimpan");
      return { ok: true, count: 1 };
    } catch (e) {
      toast.error("Gagal menyimpan perubahan");
      console.error("flushAutosave error", e);
      return { ok: false, error: e };
    } finally {
      setIsAutosaving(false);
    }
  }, [reportId, fullReport, imagesState, reportStatus]);

  useEffect(() => {
    if (typeof onRegisterFlush === "function") {
      onRegisterFlush(flushAutosave);
    }
  }, [onRegisterFlush, flushAutosave]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Object.keys(dirtyRef.current).length > 0) flushAutosave();
    }, 30000);
    return () => clearInterval(interval);
  }, [flushAutosave]);

  async function handleDeleteSample() {
    setMenuOpen(false);
    if (
      !window.confirm(
        "Hapus sample ini dari sistem? Tindakan ini tidak bisa dibatalkan.",
      )
    )
      return;
    try {
      if (typeof onDeleteSample === "function") {
        await onDeleteSample(sampleId);
      } else {
        await apiClient.delete(`/samples/${sampleId}`);
        toast.success("Sample berhasil dihapus");
      }
    } catch (e) {
      toast.error("Gagal menghapus sample");
      console.error(e);
    }
  }

  function bulkSetKlausul(klausulCode, value) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    let changedClause = null;
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.sub_klausul.forEach((s) =>
          s.butir.forEach((b) => {
            b.keputusan = value;
            b.last_modified_at = new Date().toISOString();
            markDirty(b.kode);
          }),
        );
        changedClause = k;
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport([changedClause]);
  }

  function bulkSetSubclause(klausulCode, subKode, value) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    let changedClause = null;
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.sub_klausul.forEach((s) => {
          if (s.kode === subKode) {
            s.butir.forEach((b) => {
              b.keputusan = value;
              b.last_modified_at = new Date().toISOString();
              markDirty(b.kode);
            });
          }
        });
        changedClause = k;
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport([changedClause]);
  }

  function resetClause(klausulCode) {
    setMenuOpen(false);
    if (
      !window.confirm(
        "Reset semua keputusan & catatan untuk klausul ini?",
      )
    )
      return;
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    let changedClause = null;
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.sub_klausul.forEach((s) =>
          s.butir.forEach((b) => {
            b.keputusan = "";
            b.hasil_catatan = "";
            b.last_modified_at = new Date().toISOString();
            markDirty(b.kode);
          }),
        );
        changedClause = k;
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport([changedClause]);
  }

  const dirtyCount = Object.keys(dirtyRef.current).length;
  const autosaveText = isAutosaving
    ? "Menyimpan otomatis…"
    : dirtyCount > 0
      ? "Perubahan belum tersimpan"
      : "Semua perubahan tersimpan";

  const thCls =
    "bg-[#fbfcfe] text-left text-[11px] font-semibold text-ink-500 uppercase tracking-[0.06em] px-4 py-2.5 border-b border-line";

  const condCls = locked
    ? "w-full px-3 py-2 border border-line rounded-lg text-sm text-ink-700 bg-navy-50 outline-none cursor-not-allowed"
    : condInput;
  const hasilCls = locked
    ? "w-full border border-line rounded-lg px-2.5 py-2 text-[13px] text-ink-700 bg-navy-50 resize-none min-h-[38px] max-h-[120px] outline-none cursor-not-allowed"
    : "w-full border border-line rounded-lg px-2.5 py-2 text-[13px] text-navy-800 bg-white resize-y min-h-[38px] max-h-[120px] outline-none transition-colors focus:border-navy-600 focus:ring-[3px] focus:ring-navy-600/10 placeholder:text-ink-400";

  return (
    <div className="flex flex-col gap-4">
      {localKlausulArr.map((k) => (
        <React.Fragment key={k.klausul}>
          {/* TEST CONDITIONS CARD */}
          <section
            id={`clause-${k.klausul}`}
            className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden"
          >
            <div className="flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between px-4 nav:px-5 py-3.5 border-b border-line-soft">
              <div className="flex items-center gap-3">
                {!locked && (
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setMenuOpen((o) => !o)}
                      aria-label="Menu klausul"
                      className={`w-8 h-8 rounded-lg inline-flex items-center justify-center text-ink-400 hover:bg-navy-50 hover:text-navy-800 transition-colors ${
                        menuOpen ? "bg-navy-50 text-navy-800" : ""
                      }`}
                    >
                      <FiMoreHorizontal size={18} />
                    </button>
                    {menuOpen && (
                      <div className="absolute left-0 top-10 min-w-[200px] bg-paper border border-line rounded-xl shadow-pop p-1.5 z-20">
                        <button
                          onClick={() => resetClause(k.klausul)}
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-[13px] text-navy-800 hover:bg-navy-50 text-left transition-colors"
                        >
                          <FiRotateCcw size={14} /> Reset klausul
                        </button>
                        <button
                          onClick={handleDeleteSample}
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-[13px] text-bad-fg hover:bg-[#fef0f3] text-left transition-colors"
                        >
                          <FiTrash2 size={14} /> Hapus sample
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <span className="text-[13px] text-ink-500">
                  {locked
                    ? "Klausul ini sudah disetujui — tampilan hanya-baca"
                    : "Klausul pengujian — isi kondisi & keputusan per butir"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {locked ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-400">
                    <FiLock size={13} /> Terkunci
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-400">
                      {isAutosaving ? (
                        <FaSpinner className="animate-spin" size={12} />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-ok-fg/60" />
                      )}
                      {autosaveText}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-ink-400">
                      <span>Set semua</span>
                      <Seg
                        value={null}
                        onChange={(v) => bulkSetKlausul(k.klausul, v)}
                        small
                      />
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 nav:grid-cols-4 gap-5 p-4 nav:p-5">
              <CondField label="Nama Teknisi / Penguji">
                <input
                  value={(k.meta && k.meta.tester_name) || ""}
                  onChange={(e) =>
                    updateKlausulMeta(k.klausul, { tester_name: e.target.value })
                  }
                  readOnly={locked}
                  className={condCls}
                  placeholder="Nama teknisi"
                />
              </CondField>
              <CondField label="Tanggal Uji">
                <input
                  type="date"
                  value={
                    k.meta && k.meta.test_datetime
                      ? formatDateLocal(k.meta.test_datetime)
                      : ""
                  }
                  onChange={(e) =>
                    updateKlausulMeta(k.klausul, {
                      test_datetime: toIsoFromDateLocal(e.target.value),
                    })
                  }
                  readOnly={locked}
                  className={condCls}
                />
              </CondField>
              <CondField label="Suhu (°C)">
                <input
                  type="number"
                  step="0.1"
                  value={k.meta && (k.meta.temperature ?? "")}
                  onChange={(e) =>
                    updateKlausulMeta(k.klausul, {
                      temperature:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  readOnly={locked}
                  className={condCls}
                  placeholder="25.0"
                />
              </CondField>
              <CondField label="Kelembaban (%)">
                <input
                  type="number"
                  step="0.1"
                  value={k.meta && (k.meta.humidity ?? "")}
                  onChange={(e) =>
                    updateKlausulMeta(k.klausul, {
                      humidity:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  readOnly={locked}
                  className={condCls}
                  placeholder="60"
                />
              </CondField>
            </div>
          </section>

          {/* SUBSECTION CLAUSE CARDS */}
          {k.sub_klausul.map((s) => {
            const subFilled =
              s.butir.length > 0 && s.butir.every((b) => isButirFilled(b));
            return (
              <section
                key={s.kode}
                className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden"
              >
                <div className="flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between px-4 nav:px-6 py-4 bg-navy-50 border-b border-line">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono font-bold text-sm text-navy-800 bg-white border border-line px-2.5 py-1 rounded-lg">
                      {s.kode}
                    </span>
                    {s.judul && (
                      <span className="text-[15px] font-semibold text-navy-800">
                        {s.judul}
                      </span>
                    )}
                    <span className="text-[13px] text-ink-400">
                      {s.butir.length} butir uji
                    </span>
                    {subFilled && (
                      <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full bg-ok-bg text-ok-fg text-[11px] font-semibold">
                        <FiCheck size={11} /> Lengkap
                      </span>
                    )}
                  </div>
                  {!locked && (
                    <div className="flex items-center gap-2 text-xs text-ink-500">
                      <span>Set semua di {s.kode}</span>
                      <Seg
                        value={null}
                        onChange={(v) => bulkSetSubclause(k.klausul, s.kode, v)}
                        small
                      />
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className={`${thCls} w-1/2`}>
                          Syarat-syarat Pengujian
                        </th>
                        <th className={`${thCls} w-[30%]`}>Hasil / Catatan</th>
                        <th className={`${thCls} w-[20%] !text-right`}>
                          Keputusan
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.butir.map((b) => (
                        <tr key={b.kode}>
                          <td className="px-4 py-4 border-b border-line-soft align-top text-sm">
                            <span className="font-mono font-bold text-navy-700 mr-2">
                              {b.kode}
                            </span>
                            <span className="text-ink-700 leading-relaxed">
                              {b.teks}
                            </span>
                          </td>
                          <td className="px-4 py-4 border-b border-line-soft align-top">
                            <textarea
                              rows={1}
                              readOnly={locked}
                              value={b.hasil_catatan || ""}
                              onChange={(e) =>
                                updateLocalCatatan(
                                  k.klausul,
                                  b.kode,
                                  e.target.value,
                                )
                              }
                              placeholder={locked ? "—" : "Catatan hasil…"}
                              className={hasilCls}
                            />
                          </td>
                          <td className="px-4 py-4 border-b border-line-soft align-top">
                            <div className="flex flex-col items-end gap-1">
                              {b.is_corrected && b.original_keputusan && (
                                <span className="text-[11px] font-semibold text-bad-fg">
                                  <span className="line-through">
                                    {b.original_keputusan}
                                  </span>{" "}
                                  <span className="text-ink-400">(Rev)</span>
                                </span>
                              )}
                              <Seg
                                value={b.keputusan}
                                disabled={locked}
                                onChange={(v) =>
                                  updateLocalDecision(k.klausul, b.kode, v)
                                }
                              />
                              {b.is_corrected && b.corrected_by && (
                                <span className="text-[10px] text-navy-600">
                                  oleh {b.corrected_by}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Structured data tables for THIS sub-clause. Templates are
                    saved per sub-clause code (e.g. "6.1"), so each editor is
                    queried with s.kode. Renders nothing when the sub-clause
                    has no table template (empty:hidden collapses the wrapper). */}
                <div className="px-4 nav:px-5 pb-5 empty:hidden">
                  <TableInstanceEditor
                    reportId={reportId}
                    subClauseCode={s.kode}
                    reportStatus={reportStatus}
                    userRole={userRole}
                  />
                </div>
              </section>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Date helpers (unchanged) ─────────────────────────────────────────────────
function formatDateLocal(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toIsoFromDateLocal(dateValue) {
  if (!dateValue) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return dateValue;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
