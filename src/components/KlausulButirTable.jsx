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
import SymbolStrip from "./SymbolStrip";
import { isTableInstanceFailed } from "../utils/tableFormulas";

const REPORT_STATUS = {
  DRAFT: { label: "Draft", cls: "bg-neutral-bg text-neutral-fg" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-warn-bg text-warn-fg" },
  APPROVED: { label: "Approved", cls: "bg-ok-bg text-ok-fg" },
};

function ReportStatusPill({ status }) {
  const m = REPORT_STATUS[status] || REPORT_STATUS.DRAFT;
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap ${m.cls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {m.label}
    </span>
  );
}

const SEG_OPTS = ["L", "TB", "G"];
const SEG_TITLE = { L: "Lulus", TB: "Tidak Berlaku", G: "Gagal" };
const SEG_ACTIVE = {
  L: "bg-[#1b9c4d] text-white",
  TB: "bg-[#f59e0b] text-white",
  G: "bg-[#d12c45] text-white",
};

function getKlausulDecisionStatus(k, allTableInstances = []) {
  let countG = 0;
  let countL = 0;
  let countTB = 0;
  let totalDecisions = 0;

  (k?.sub_klausul || []).forEach((s) => {
    if (s.keputusan === "G") countG++;
    else if (s.keputusan === "L") countL++;
    else if (s.keputusan === "TB") countTB++;
    if (s.keputusan) totalDecisions++;

    (s.butir || []).forEach((b) => {
      if (b.keputusan === "G") countG++;
      else if (b.keputusan === "L") countL++;
      else if (b.keputusan === "TB") countTB++;
      if (b.keputusan) totalDecisions++;
    });
  });

  // Check if any table instance for this clause has failed
  const clauseSubCodes = new Set((k?.sub_klausul || []).map((s) => s.kode));
  clauseSubCodes.add(String(k?.klausul));

  const hasFailedTable = (allTableInstances || []).some((inst) => {
    const subCode = inst.template?.subClauseCode;
    if (!subCode) return false;
    const parentCode = subCode.split(".")[0];
    if (clauseSubCodes.has(subCode) || clauseSubCodes.has(parentCode)) {
      return isTableInstanceFailed(inst);
    }
    return false;
  });

  if (hasFailedTable) {
    countG++;
  }

  if (countG > 0) {
    return {
      status: "red",
      label: "GAGAL",
      badgeCls: "bg-bad-bg text-bad-fg border-bad-fg/40",
      pillCls: "bg-bad-bg text-bad-fg border-bad-fg/30",
    };
  }
  if (countL > 0) {
    return {
      status: "green",
      label: "LULUS",
      badgeCls: "bg-ok-bg text-ok-fg border-ok-fg/40",
      pillCls: "bg-ok-bg text-ok-fg border-ok-fg/30",
    };
  }
  if (countTB > 0 && totalDecisions === countTB) {
    return {
      status: "gray",
      label: "TB",
      badgeCls: "bg-warn-bg text-warn-fg border-warn-fg/40",
      pillCls: "bg-warn-bg text-warn-fg border-warn-fg/30",
    };
  }
  return {
    status: "neutral",
    label: null,
    badgeCls: "bg-navy-50 text-navy-800 border-navy-100",
    pillCls: "",
  };
}

function getSubKodeBadgeCls(keputusan) {
  if (keputusan === "G") return "bg-bad-bg text-bad-fg border-bad-fg/40";
  if (keputusan === "L") return "bg-ok-bg text-ok-fg border-ok-fg/40";
  if (keputusan === "TB") return "bg-warn-bg text-warn-fg border-warn-fg/40";
  return "bg-white text-navy-800 border-line";
}

// Animated segmented L / TB / G control
function Seg({ value, onChange, small, disabled }) {
  const opts = SEG_OPTS;
  const activeIdx = opts.indexOf(value);

  return (
    <div
      className={`relative inline-grid grid-cols-3 bg-white border border-line rounded-[10px] p-[3px] select-none ${
        disabled ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      {/* Sliding background pill */}
      {activeIdx !== -1 && (
        <span
          aria-hidden="true"
          className={`absolute top-[3px] bottom-[3px] rounded-[7px] transition-transform duration-200 ease-out pointer-events-none shadow-xs ${SEG_ACTIVE[value]}`}
          style={{
            width: "calc((100% - 6px) / 3)",
            left: "3px",
            transform: `translateX(${activeIdx * 100}%)`,
          }}
        />
      )}
      {opts.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            disabled={disabled}
            title={SEG_TITLE[o]}
            onClick={() => onChange(o)}
            className={`relative z-10 inline-flex items-center justify-center font-bold rounded-[7px] transition-colors cursor-pointer ${
              small
                ? "w-9 h-9 text-xs nav:w-7 nav:h-6 nav:text-[11px]"
                : "w-11 h-10 text-[13px] nav:w-9 nav:h-[30px] nav:text-xs"
            } ${
              active
                ? "text-white"
                : disabled
                ? "text-ink-300 cursor-not-allowed"
                : "text-ink-500 hover:text-navy-800"
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

// Matches the `nav` breakpoint (960px) from index.css. Conditional JS render
// (instead of CSS hidden) so heavy children like TableInstanceEditor mount
// only once — no duplicate API fetches or diverging state.
function useIsNarrow() {
  const [narrow, setNarrow] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 959px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 959px)");
    const h = (e) => setNarrow(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return narrow;
}

export default function KlausulButirTable({
  report,
  fullReport,
  onChangeReport,
  onRegisterFlush,
  onDeleteSample,
  userRole,
  userName,
  onTableStatusChange,
}) {
  const [localKlausulArr, setLocalKlausulArr] = useState(report.klausul || []);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [imagesState, setImagesState] = useState(report.images || []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [technicians, setTechnicians] = useState([]);

  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle'|'saving'|'saved'|'error'|'offline'
  const debounceRef = useRef(null);

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

  const labId =
    fullReport?.sample?.order?.labId ||
    fullReport?.sample?.order?.lab_id ||
    report?.sample?.order?.labId ||
    report?.lab_id ||
    null;

  const reportStatus = fullReport?.status || report?.status || "DRAFT";
  const locked = reportStatus === "APPROVED";
  const isNarrow = useIsNarrow();

  // Fetch technicians filtered by ACTIVE status and labId
  useEffect(() => {
    const fetchTechnicians = async () => {
      try {
        // Build query string dynamically based on whether labId exists
        const queryParams = new URLSearchParams({ status: "ACTIVE" });
        if (labId) {
          queryParams.append("labId", labId);
        }

        const response = await apiClient.get(
          `/technicians?${queryParams.toString()}`,
        );
        if (response.data && response.data.data) {
          setTechnicians(response.data.data);
        }
      } catch (error) {
        console.error("Failed to load technician list for lab:", error);
      }
    };

    fetchTechnicians();
  }, [labId]);

  const [tableTemplates, setTableTemplates] = useState({});
  const [tableInstances, setTableInstances] = useState([]);

  const loadTableData = useCallback(async () => {
    if (!reportId) return;
    try {
      const [tplRes, instRes] = await Promise.all([
        apiClient.get(`/reports/${reportId}/table-templates`),
        apiClient.get(`/reports/${reportId}/table-instances`),
      ]);
      setTableTemplates(tplRes.data || {});
      setTableInstances(instRes.data || []);
    } catch (err) {
      console.error("Failed to load table data:", err);
    }
  }, [reportId]);

  useEffect(() => {
    loadTableData();
  }, [loadTableData]);

  const handleTableInstanceSaved = useCallback(
    (updatedInst) => {
      setTableInstances((prev) => {
        const idx = prev.findIndex((i) => i.id === updatedInst.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = updatedInst;
          return copy;
        }
        return [...prev, updatedInst];
      });
      if (onTableStatusChange) {
        onTableStatusChange(updatedInst);
      }
    },
    [onTableStatusChange],
  );

  useEffect(() => {
    const defaultTester =
      fullReport?.technician_name ||
      fullReport?.sample?.Report?.technician_name ||
      fullReport?.technician?.name ||
      fullReport?.sample?.Report?.technician?.name ||
      report?.technician_name ||
      "";

    const cloned = JSON.parse(JSON.stringify(report.klausul || []));
    cloned.forEach((k) => {
      if (!k.meta) {
        k.meta = {
          tester_name: defaultTester,
          test_datetime: "",
          temperature: null,
          humidity: null,
        };
      } else if (!k.meta.tester_name && defaultTester) {
        k.meta.tester_name = defaultTester;
      }
    });
    setLocalKlausulArr(cloned);
    setImagesState(fullReport.images || []);

    const map = {};
    cloned.forEach((k) => {
      k.sub_klausul.forEach((s) => {
        map[`sub-${s.kode}`] = {
          keputusan: s.keputusan,
          hasil_catatan: s.hasil_catatan,
        };
        s.butir.forEach((b) => {
          // Butir letter kodes repeat across subs — key by sub + butir.
          map[`${s.kode}:${b.kode}`] = {
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

  const pendingDataRef = useRef(null);

  const getFullDataWithUpdates = useCallback(
    (updatedLocalClauses) => {
      const list = fullReport?.data || [];
      return list.map((k) => {
        const match = updatedLocalClauses.find((loc) => loc.klausul === k.klausul);
        return match ? JSON.parse(JSON.stringify(match)) : k;
      });
    },
    [fullReport?.data],
  );

  const triggerAutoSave = useCallback(
    (explicitData) => {
      if (reportStatus === "APPROVED" || !reportId) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      setSaveStatus("saving");

      debounceRef.current = setTimeout(async () => {
        if (!navigator.onLine) {
          setSaveStatus("offline");
          return;
        }

        const dataToSave =
          explicitData ||
          pendingDataRef.current ||
          getFullDataWithUpdates(localKlausulArr);
        if (!dataToSave || dataToSave.length === 0) return;

        try {
          await apiClient.patch(`/reports/${reportId}/data`, {
            data: dataToSave,
            images: imagesState,
          });
          dirtyRef.current = {};
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 3000);
        } catch (e) {
          console.error("Auto-save error", e);
          setSaveStatus("error");
        }
      }, 600);
    },
    [reportId, reportStatus, imagesState, localKlausulArr, getFullDataWithUpdates],
  );

  // Online / offline listeners
  useEffect(() => {
    const handleOnline = () => setSaveStatus((s) => s === 'offline' ? 'idle' : s);
    const handleOffline = () => setSaveStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // NOTE: butir kode (a, b, c…) repeats across sub-klausul in the new
  // template format, so butir updates must be scoped by subKode too —
  // matching on butir kode alone would update the same letter in every
  // sub-klausul of the clause.
  function updateLocalDecision(klausulCode, subKode, butirKode, decision) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.sub_klausul.forEach((s) => {
          if (s.kode !== subKode) return;
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
          });
        });
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport(next);
    markDirty(`${subKode}:${butirKode}`);
    const allData = getFullDataWithUpdates(next);
    pendingDataRef.current = allData;
    triggerAutoSave(allData);
  }

  function updateLocalCatatan(klausulCode, subKode, butirKode, text) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.sub_klausul.forEach((s) => {
          if (s.kode !== subKode) return;
          s.butir.forEach((b) => {
            if (b.kode === butirKode) {
              // Track catatan revision like we do for keputusan: when an
              // engineer/admin edits, remember the technician's original
              // text so the reviewed technician can see what changed.
              if (userRole === "ENGINEER" || userRole === "ADMIN") {
                if (b.original_hasil_catatan === undefined) {
                  b.original_hasil_catatan = b.hasil_catatan || "";
                }
                b.catatan_corrected = text !== (b.original_hasil_catatan || "");
                if (b.catatan_corrected) b.catatan_corrected_by = userName;
              }
              b.hasil_catatan = text;
              b.last_modified_by = userName || "unknown";
              b.last_modified_at = new Date().toISOString();
            }
          });
        });
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport(next);
    markDirty(`${subKode}:${butirKode}`);
    const allData = getFullDataWithUpdates(next);
    pendingDataRef.current = allData;
    triggerAutoSave(allData);
  }

  function updateLocalSubDecision(klausulCode, subKode, decision) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    next.forEach((k) => {
      if (k.klausul !== klausulCode) return;
      k.sub_klausul.forEach((s) => {
        if (s.kode !== subKode) return;
        if (userRole === "ENGINEER" || userRole === "ADMIN") {
          if (s.original_keputusan === undefined) {
            s.original_keputusan = s.keputusan;
          }
          s.is_corrected = decision !== s.original_keputusan;
          if (s.is_corrected) s.corrected_by = userName;
        }
        s.keputusan = decision;
        s.last_modified_by = userName || "unknown";
        s.last_modified_at = new Date().toISOString();
      });
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport(next);
    markDirty(`sub-${subKode}`);
    const allData = getFullDataWithUpdates(next);
    pendingDataRef.current = allData;
    triggerAutoSave(allData);
  }

  function updateLocalSubCatatan(klausulCode, subKode, text) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    next.forEach((k) => {
      if (k.klausul !== klausulCode) return;
      k.sub_klausul.forEach((s) => {
        if (s.kode !== subKode) return;
        if (userRole === "ENGINEER" || userRole === "ADMIN") {
          if (s.original_hasil_catatan === undefined) {
            s.original_hasil_catatan = s.hasil_catatan || "";
          }
          s.catatan_corrected = text !== (s.original_hasil_catatan || "");
          if (s.catatan_corrected) s.catatan_corrected_by = userName;
        }
        s.hasil_catatan = text;
        s.last_modified_by = userName || "unknown";
        s.last_modified_at = new Date().toISOString();
      });
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport(next);
    markDirty(`sub-${subKode}`);
    const allData = getFullDataWithUpdates(next);
    pendingDataRef.current = allData;
    triggerAutoSave(allData);
  }

  function updateKlausulMeta(klausulCode, changes) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.meta = { ...(k.meta || {}), ...changes };
        k.last_meta_modified_at = new Date().toISOString();
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport(next);
    markDirty(`meta-${klausulCode}`);
    const allData = getFullDataWithUpdates(next);
    pendingDataRef.current = allData;
    triggerAutoSave(allData);
  }

  const isButirFilled = (b) => !!b.keputusan;

  const flushAutosave = useCallback(async () => {
    if (reportStatus === "APPROVED") {
      return { ok: true, count: 0 };
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const currentReportData =
      pendingDataRef.current || getFullDataWithUpdates(localKlausulArr);
    const currentImagesData = imagesState;

    if (!reportId || !currentReportData || currentReportData.length === 0) {
      toast("Tidak ada perubahan untuk disimpan");
      return { ok: true, count: 0 };
    }

    setIsAutosaving(true);
    setSaveStatus("saving");
    try {
      await apiClient.patch(`/reports/${reportId}/data`, {
        data: currentReportData,
        images: currentImagesData,
      });
      dirtyRef.current = {};
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 3000);
      return { ok: true, count: 1 };
    } catch (e) {
      const serverMsg = e.response?.data?.error || "";
      if (e.response?.status === 403 && /locked|approved/i.test(serverMsg)) {
        dirtyRef.current = {};
        toast("Report sudah disetujui & terkunci — perubahan tidak disimpan", {
          icon: "🔒",
        });
        return { ok: true, count: 0 };
      }
      setSaveStatus("error");
      toast.error("Gagal menyimpan perubahan");
      console.error("flushAutosave error", e);
      return { ok: false, error: e };
    } finally {
      setIsAutosaving(false);
    }
  }, [reportId, imagesState, reportStatus, localKlausulArr, getFullDataWithUpdates]);

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

  // When a technician runs bulk-set or reset we must NOT overwrite butir that
  // an engineer has already corrected — those are locked from the technician.
  const isProtectedFromTechnician = (b) =>
    userRole === "TECHNICIAN" && b.is_corrected;

  function bulkSetKlausul(klausulCode, value) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    let changedClause = null;
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.sub_klausul.forEach((s) => {
          // Set sub-klausul keputusan (technicians can always overwrite this
          // — the corrected-lock rule only applies to butir per prior design).
          s.keputusan = value;
          s.last_modified_at = new Date().toISOString();
          markDirty(`sub-${s.kode}`);
          s.butir.forEach((b) => {
            if (isProtectedFromTechnician(b)) return;
            b.keputusan = value;
            b.last_modified_at = new Date().toISOString();
            markDirty(`${s.kode}:${b.kode}`);
          });
        });
        changedClause = k;
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport([changedClause]);
    const allData = getFullDataWithUpdates(next);
    pendingDataRef.current = allData;
    triggerAutoSave(allData);
  }

  function bulkSetSubclause(klausulCode, subKode, value) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    let changedClause = null;
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.sub_klausul.forEach((s) => {
          if (s.kode === subKode) {
            s.butir.forEach((b) => {
              if (isProtectedFromTechnician(b)) return;
              b.keputusan = value;
              b.last_modified_at = new Date().toISOString();
              markDirty(`${s.kode}:${b.kode}`);
            });
          }
        });
        changedClause = k;
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport([changedClause]);
    const allData = getFullDataWithUpdates(next);
    pendingDataRef.current = allData;
    triggerAutoSave(allData);
  }

  function resetClause(klausulCode) {
    setMenuOpen(false);
    if (!window.confirm("Reset semua keputusan & catatan untuk klausul ini?"))
      return;
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    let changedClause = null;
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.sub_klausul.forEach((s) => {
          s.keputusan = "";
          s.hasil_catatan = "";
          s.last_modified_at = new Date().toISOString();
          markDirty(`sub-${s.kode}`);
          s.butir.forEach((b) => {
            if (isProtectedFromTechnician(b)) return;
            b.keputusan = "";
            b.hasil_catatan = "";
            b.last_modified_at = new Date().toISOString();
            markDirty(`${s.kode}:${b.kode}`);
          });
        });
        changedClause = k;
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport([changedClause]);
    const allData = getFullDataWithUpdates(next);
    pendingDataRef.current = allData;
    triggerAutoSave(allData);
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
  const hasilLockedCls =
    "w-full border border-line rounded-lg px-2.5 py-2 text-[13px] text-ink-700 bg-navy-50 resize-none min-h-[38px] max-h-[120px] outline-none cursor-not-allowed";
  const hasilEditCls =
    "w-full border border-line rounded-lg px-2.5 py-2 text-[13px] text-navy-800 bg-white resize-y min-h-[38px] max-h-[120px] outline-none transition-colors focus:border-navy-600 focus:ring-[3px] focus:ring-navy-600/10 placeholder:text-ink-400";

  // Technicians cannot override an engineer's correction on a butir.
  const isButirLockedFor = (b) =>
    locked || (userRole === "TECHNICIAN" && b.is_corrected);
  const isButirCatatanLocked = (b) =>
    locked || (userRole === "TECHNICIAN" && b.catatan_corrected);
  const isSubLockedFor = (s) =>
    locked || (userRole === "TECHNICIAN" && s.is_corrected);
  const isSubCatatanLocked = (s) =>
    locked || (userRole === "TECHNICIAN" && s.catatan_corrected);

  return (
    <div className="flex flex-col gap-4">
      {localKlausulArr.map((k) => (
        <React.Fragment key={k.klausul}>
          {/* TEST CONDITIONS CARD */}
          <section
            id={`clause-${k.klausul}`}
            className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden"
          >
            {/* CLAUSE TITLE ROW — the actual clause heading ("8 PENANDAAN") */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 nav:px-5 pt-4 nav:pt-5 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                {!locked && (
                  <div className="relative shrink-0" ref={menuRef}>
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
                {(() => {
                  const kStatus = getKlausulDecisionStatus(k, tableInstances);
                  return (
                    <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold text-[15px] px-2.5 py-1 rounded-lg border transition-colors ${kStatus.badgeCls}`}
                        >
                          {k.klausul}
                        </span>
                        {kStatus.label && (
                          <span
                            className={`font-mono font-bold text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${kStatus.pillCls}`}
                          >
                            {kStatus.label}
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl nav:text-2xl font-bold text-navy-900 uppercase tracking-tight break-words">
                        {k.judul}
                      </h2>
                    </div>
                  );
                })()}
              </div>

              {/* Top-right of container: Save indicator & Report Status Pill */}
              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-400">
                  {saveStatus === "saving" || isAutosaving ? (
                    <><FaSpinner className="animate-spin" size={12} /><span>Menyimpan…</span></>
                  ) : saveStatus === "saved" ? (
                    <><FiCheck size={12} className="text-ok-fg" /><span className="text-ok-fg">Tersimpan</span></>
                  ) : saveStatus === "error" ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-bad-fg" /><span className="text-bad-fg">Gagal menyimpan</span></>
                  ) : saveStatus === "offline" ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-warn-fg" /><span className="text-warn-fg">Anda sedang offline</span></>
                  ) : dirtyCount > 0 ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-warn-fg/60 animate-pulse" /><span>Perubahan belum tersimpan</span></>
                  ) : (
                    <><span className="w-1.5 h-1.5 rounded-full bg-ok-fg/60" /><span>Semua tersimpan</span></>
                  )}
                </span>
                <ReportStatusPill status={reportStatus} />
              </div>
            </div>

            <div className="flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between px-4 nav:px-5 py-3 border-y border-line-soft bg-canvas/40">
              <span className="text-[13px] text-ink-500">
                {locked
                  ? "Klausul ini sudah disetujui — tampilan hanya-baca"
                  : "Isi kondisi pengujian & keputusan per butir"}
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {locked ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-400">
                    <FiLock size={13} /> Terkunci
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-xs text-ink-400">
                    <span>Set semua</span>
                    <Seg
                      value={null}
                      onChange={(v) => bulkSetKlausul(k.klausul, v)}
                      small
                    />
                  </span>
                )}
              </div>
            </div>

            {/* Insert-symbol toolbar (Ω, ⏚, ⧈, pecahan…) for catatan fields */}
            {!locked && <SymbolStrip />}

            <div className="grid grid-cols-1 sm:grid-cols-2 nav:grid-cols-4 gap-5 p-4 nav:p-5">
              <CondField label="Nama Teknisi / Penguji">
                <select
                  value={(k.meta && k.meta.tester_name) || ""}
                  disabled={true}
                  className="w-full px-3 py-2 border border-line-soft rounded-lg text-sm text-navy-800/80 bg-navy-50/70 outline-none cursor-not-allowed select-none font-medium"
                  title="Nama teknisi diatur pada Datasheet Info"
                >
                  <option value="">-- Pilih Teknisi --</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.name}>
                      {tech.name}{" "}
                      {tech.employeeId ? `(${tech.employeeId})` : ""}
                    </option>
                  ))}
                  {/* Ensures existing report names remain selected if not present in the current active list */}
                  {k.meta?.tester_name &&
                    !technicians.some((t) => t.name === k.meta.tester_name) && (
                      <option value={k.meta.tester_name}>
                        {k.meta.tester_name}
                      </option>
                    )}
                </select>
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

          {/* ONE consolidated table per klausul.
              Sub-klausul rows are visual dividers inside the same table —
              they no longer own their own "Set semua" control. Set-semua at
              klausul level is the only bulk action. */}
          <section className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden">
            {/* Desktop: consolidated table. Mobile renders cards instead —
                conditional render (not CSS hidden) so TableInstanceEditor
                mounts exactly once. */}
            {!isNarrow && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className={`${thCls} w-[12%]`}>Klausul</th>
                      <th className={`${thCls} w-[42%]`}>
                        Syarat-syarat Pengujian
                      </th>
                      <th className={`${thCls} w-[26%]`}>Hasil / Catatan</th>
                      <th className={`${thCls} w-[20%] !text-right`}>
                        Keputusan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {k.sub_klausul.map((s) => {
                      const subLocked = isSubLockedFor(s);
                      const subCatLocked = isSubCatatanLocked(s);
                      return (
                        <React.Fragment key={s.kode}>
                          {/* Sub-klausul row — has its own Hasil/Catatan and
                            Keputusan (L/TB/G), like a butir but with heavier
                            styling to indicate it's the sub-clause header. */}
                          <tr className="bg-canvas/40">
                            <td className="px-4 py-3 border-b border-line align-top">
                              <span className={`font-mono font-bold text-[13px] px-2 py-0.5 rounded-md border transition-colors ${getSubKodeBadgeCls(s.keputusan)}`}>
                                {s.kode}
                              </span>
                            </td>
                            <td className="px-4 py-3 border-b border-line align-top text-sm">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                {s.judul && (
                                  <span className="font-semibold text-navy-800 leading-snug">
                                    {s.judul}
                                  </span>
                                )}
                                <span className="text-[11px] text-ink-400">
                                  · {s.butir.length} butir
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 border-b border-line align-top">
                              <div className="flex flex-col gap-1">
                                {s.catatan_corrected &&
                                  s.original_hasil_catatan !== undefined && (
                                    <span className="text-[11px] text-bad-fg">
                                      <span className="line-through opacity-70">
                                        {s.original_hasil_catatan || "(kosong)"}
                                      </span>{" "}
                                      <span className="text-ink-400 font-semibold">
                                        (Rev)
                                      </span>
                                    </span>
                                  )}
                                <textarea
                                  rows={1}
                                  readOnly={subCatLocked}
                                  value={s.hasil_catatan || ""}
                                  onChange={(e) =>
                                    updateLocalSubCatatan(
                                      k.klausul,
                                      s.kode,
                                      e.target.value,
                                    )
                                  }
                                  placeholder={
                                    subCatLocked ? "—" : "Catatan hasil…"
                                  }
                                  className={
                                    subCatLocked ? hasilLockedCls : hasilEditCls
                                  }
                                />
                                {s.catatan_corrected &&
                                  s.catatan_corrected_by && (
                                    <span className="text-[10px] text-navy-600">
                                      oleh {s.catatan_corrected_by}
                                    </span>
                                  )}
                              </div>
                            </td>
                            <td className="px-4 py-3 border-b border-line align-top">
                              <div className="flex flex-col items-end gap-1">
                                {s.is_corrected && (
                                  <span className="text-[11px] font-semibold text-bad-fg">
                                    <span className="line-through">
                                      {s.original_keputusan || "-"}
                                    </span>{" "}
                                    <span className="text-ink-400">(Rev)</span>
                                  </span>
                                )}
                                <Seg
                                  value={s.keputusan}
                                  disabled={subLocked}
                                  onChange={(v) =>
                                    updateLocalSubDecision(k.klausul, s.kode, v)
                                  }
                                />
                                {s.is_corrected && s.corrected_by && (
                                  <span className="text-[10px] text-navy-600">
                                    oleh {s.corrected_by}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                          {s.butir.map((b) => {
                            const butirLocked = isButirLockedFor(b);
                            const butirCatLocked = isButirCatatanLocked(b);
                            return (
                              <tr key={`${s.kode}:${b.kode}`}>
                                <td className="px-4 py-4 border-b border-line-soft align-top text-sm">
                                  {/* Butir kode intentionally hidden — the
                                    sub-klausul row above already anchors the
                                    numbering context, matching the Word draft
                                    layout where butir rows have no code. */}
                                </td>
                                <td className="px-4 py-4 border-b border-line-soft align-top text-sm">
                                  <span className="text-ink-700 leading-relaxed">
                                    {b.teks}
                                  </span>
                                </td>
                                <td className="px-4 py-4 border-b border-line-soft align-top">
                                  <div className="flex flex-col gap-1">
                                    {b.catatan_corrected &&
                                      b.original_hasil_catatan !==
                                        undefined && (
                                        <span className="text-[11px] text-bad-fg">
                                          <span className="line-through opacity-70">
                                            {b.original_hasil_catatan ||
                                              "(kosong)"}
                                          </span>{" "}
                                          <span className="text-ink-400 font-semibold">
                                            (Rev)
                                          </span>
                                        </span>
                                      )}
                                    <textarea
                                      rows={1}
                                      readOnly={butirCatLocked}
                                      value={b.hasil_catatan || ""}
                                      onChange={(e) =>
                                        updateLocalCatatan(
                                          k.klausul,
                                          s.kode,
                                          b.kode,
                                          e.target.value,
                                        )
                                      }
                                      placeholder={
                                        butirCatLocked ? "—" : "Catatan hasil…"
                                      }
                                      className={
                                        butirCatLocked
                                          ? hasilLockedCls
                                          : hasilEditCls
                                      }
                                    />
                                    {b.catatan_corrected &&
                                      b.catatan_corrected_by && (
                                        <span className="text-[10px] text-navy-600">
                                          oleh {b.catatan_corrected_by}
                                        </span>
                                      )}
                                  </div>
                                </td>
                                <td className="px-4 py-4 border-b border-line-soft align-top">
                                  <div className="flex flex-col items-end gap-1">
                                    {b.is_corrected && (
                                      <span className="text-[11px] font-semibold text-bad-fg">
                                        <span className="line-through">
                                          {b.original_keputusan || "-"}
                                        </span>{" "}
                                        <span className="text-ink-400">
                                          (Rev)
                                        </span>
                                      </span>
                                    )}
                                    <Seg
                                      value={b.keputusan}
                                      disabled={butirLocked}
                                      onChange={(v) =>
                                        updateLocalDecision(
                                          k.klausul,
                                          s.kode,
                                          b.kode,
                                          v,
                                        )
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
                            );
                          })}
                          {/* Structured data tables per sub-clause */}
                          {((tableTemplates[s.kode] && tableTemplates[s.kode].length > 0) ||
                            (s.kode === k.sub_klausul[0]?.kode && tableTemplates[String(k.klausul)]?.length > 0)) && (
                            <tr className="bg-canvas/20">
                              <td colSpan={4} className="p-4 nav:p-5 border-b border-line">
                                <TableInstanceEditor
                                  reportId={reportId}
                                  subClauseCode={s.kode}
                                  reportStatus={reportStatus}
                                  userRole={userRole}
                                  onInstanceSaved={handleTableInstanceSaved}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mobile / tablet: stacked cards — same data & handlers as the
                table, laid out vertically with touch-sized controls. */}
            {isNarrow && (
              <div className="divide-y divide-line-soft">
                {k.sub_klausul.map((s) => {
                  const subLocked = isSubLockedFor(s);
                  const subCatLocked = isSubCatatanLocked(s);
                  return (
                    <div key={`m-${s.kode}`}>
                      {/* Sub-klausul header card */}
                      <div className="bg-canvas/60 px-4 py-3.5 flex flex-col gap-2.5">
                        <div className="flex items-start gap-2">
                          <span className={`font-mono font-bold text-[13px] px-2 py-0.5 rounded-md border shrink-0 transition-colors ${getSubKodeBadgeCls(s.keputusan)}`}>
                            {s.kode}
                          </span>
                          <div className="min-w-0">
                            {s.judul && (
                              <div className="text-sm font-semibold text-navy-800 leading-snug">
                                {s.judul}
                              </div>
                            )}
                            <div className="text-[11px] text-ink-400 mt-0.5">
                              {s.butir.length} butir
                            </div>
                          </div>
                        </div>
                        {s.catatan_corrected &&
                          s.original_hasil_catatan !== undefined && (
                            <span className="text-[11px] text-bad-fg">
                              <span className="line-through opacity-70">
                                {s.original_hasil_catatan || "(kosong)"}
                              </span>{" "}
                              <span className="text-ink-400 font-semibold">
                                (Rev)
                              </span>
                            </span>
                          )}
                        <textarea
                          rows={1}
                          readOnly={subCatLocked}
                          value={s.hasil_catatan || ""}
                          onChange={(e) =>
                            updateLocalSubCatatan(
                              k.klausul,
                              s.kode,
                              e.target.value,
                            )
                          }
                          placeholder={subCatLocked ? "—" : "Catatan hasil…"}
                          className={
                            subCatLocked ? hasilLockedCls : hasilEditCls
                          }
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.06em]">
                            Keputusan
                            {s.is_corrected && (
                              <span className="ml-2 normal-case font-semibold text-bad-fg">
                                <span className="line-through">
                                  {s.original_keputusan || "-"}
                                </span>{" "}
                                <span className="text-ink-400">(Rev)</span>
                              </span>
                            )}
                          </span>
                          <Seg
                            value={s.keputusan}
                            disabled={subLocked}
                            onChange={(v) =>
                              updateLocalSubDecision(k.klausul, s.kode, v)
                            }
                          />
                        </div>
                        {s.is_corrected && s.corrected_by && (
                          <span className="text-[10px] text-navy-600 text-right">
                            oleh {s.corrected_by}
                          </span>
                        )}
                      </div>

                      {/* Butir cards */}
                      {s.butir.map((b) => {
                        const butirLocked = isButirLockedFor(b);
                        const butirCatLocked = isButirCatatanLocked(b);
                        return (
                          <div
                            key={`m-${s.kode}:${b.kode}`}
                            className="px-4 py-3.5 border-t border-line-soft flex flex-col gap-2.5"
                          >
                            <div className="text-sm text-ink-700 leading-relaxed">
                              {b.teks}
                            </div>
                            {b.catatan_corrected &&
                              b.original_hasil_catatan !== undefined && (
                                <span className="text-[11px] text-bad-fg">
                                  <span className="line-through opacity-70">
                                    {b.original_hasil_catatan || "(kosong)"}
                                  </span>{" "}
                                  <span className="text-ink-400 font-semibold">
                                    (Rev)
                                  </span>
                                </span>
                              )}
                            <textarea
                              rows={1}
                              readOnly={butirCatLocked}
                              value={b.hasil_catatan || ""}
                              onChange={(e) =>
                                updateLocalCatatan(
                                  k.klausul,
                                  s.kode,
                                  b.kode,
                                  e.target.value,
                                )
                              }
                              placeholder={
                                butirCatLocked ? "—" : "Catatan hasil…"
                              }
                              className={
                                butirCatLocked ? hasilLockedCls : hasilEditCls
                              }
                            />
                            {b.catatan_corrected && b.catatan_corrected_by && (
                              <span className="text-[10px] text-navy-600">
                                oleh {b.catatan_corrected_by}
                              </span>
                            )}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.06em]">
                                Keputusan
                                {b.is_corrected && (
                                  <span className="ml-2 normal-case font-semibold text-bad-fg">
                                    <span className="line-through">
                                      {b.original_keputusan || "-"}
                                    </span>{" "}
                                    <span className="text-ink-400">(Rev)</span>
                                  </span>
                                )}
                              </span>
                              <Seg
                                value={b.keputusan}
                                disabled={butirLocked}
                                onChange={(v) =>
                                  updateLocalDecision(
                                    k.klausul,
                                    s.kode,
                                    b.kode,
                                    v,
                                  )
                                }
                              />
                            </div>
                            {b.is_corrected && b.corrected_by && (
                              <span className="text-[10px] text-navy-600 text-right">
                                oleh {b.corrected_by}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {/* Structured data tables per sub-clause (mobile) */}
                      {((tableTemplates[s.kode] && tableTemplates[s.kode].length > 0) ||
                        (s.kode === k.sub_klausul[0]?.kode && tableTemplates[String(k.klausul)]?.length > 0)) && (
                        <div className="px-4 py-3 border-t border-line-soft bg-canvas/20">
                          <TableInstanceEditor
                            reportId={reportId}
                            subClauseCode={s.kode}
                            reportStatus={reportStatus}
                            userRole={userRole}
                            onInstanceSaved={handleTableInstanceSaved}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
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
