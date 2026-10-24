// src/pages/ReportEditor.jsx
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { FaSpinner } from "react-icons/fa";
import {
  FiArrowLeft,
  FiSave,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiSend,
  FiCheckCircle,
  FiLock,
} from "react-icons/fi";
import SidebarClauses from "../components/SidebarClauses";
import KlausulButirTable from "../components/KlausulButirTable";
import KlausulSubmitModal from "../components/KlausulSubmitModal";
import apiClient from "../api";
import { useAuth } from "../context/AuthContext";
import { isTableInstanceFailed } from "../utils/tableFormulas";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-xl text-sm font-semibold bg-navy-800 text-white hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnGhost =
  "inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-xl text-sm font-semibold bg-paper text-navy-800 border border-line hover:bg-navy-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const btnSoft =
  "inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-xl text-sm font-semibold bg-navy-50 text-navy-800 hover:bg-navy-100 transition-colors";

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

export default function ReportEditor() {
  const { sampleId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const canReview =
    user?.role === "ENGINEER" ||
    user?.role === "ADMIN" ||
    user?.role === "DRAFTER";

  // Back navigation: ONLY role ENGINEER (and DRAFTER from engineer-dashboard) returns to /engineer-dashboard.
  // ADMIN and TECHNICIAN return to /datasheet/:sampleId
  const isEngineerOnly =
    user?.role === "ENGINEER" ||
    (user?.role !== "ADMIN" && location.state?.from === "/engineer-dashboard");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [images, setImages] = useState([]); // State to hold images
  const [klausulStatuses, setKlausulStatuses] = useState({});
  const [submitModalOpen, setSubmitModalOpen] = useState(false);

  // flush function provided by child
  const flushRef = useRef(null);

  // modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tableInstances, setTableInstances] = useState([]);

  const fetchTableInstances = useCallback(async (repId) => {
    const targetId = repId || report?.id;
    if (!targetId) return;
    try {
      const res = await apiClient.get(`/reports/${targetId}/table-instances`);
      setTableInstances(res.data || []);
    } catch (err) {
      console.error("Failed to fetch table instances in ReportEditor:", err);
    }
  }, [report?.id]);

  useEffect(() => {
    let mounted = true;
    if (!sampleId) {
      console.warn("No sampleId provided");
      setLoading(false);
      return;
    }

    // The route param here is a SAMPLE id — use the by-sample endpoint
    // (the bare /reports/:reportId route looks up by report id).
    apiClient
      .get(`/reports/by-sample/${sampleId}`)
      .then((response) => {
        if (!mounted) return;
        setReport(response.data);
        setKlausulStatuses(response.data.klausulStatuses || {});
        fetchTableInstances(response.data.id);
        setLoading(false);
      })
      .catch((err) => {
        if (err.response && err.response.status === 404) {
          console.log("No report exists for this sample yet.");
        } else {
          console.error("Error fetching report:", err);
        }
        setLoading(false);
      });
    return () => (mounted = false);
  }, [sampleId, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-ink-400">
        <FaSpinner className="animate-spin" /> Memuat klausul…
      </div>
    );
  }
  if (!report) {
    return (
      <div className="py-24 text-center">
        <div className="text-[15px] font-medium text-navy-800">
          Report tidak ditemukan
        </div>
        <p className="text-sm text-ink-400 mt-1">
          Belum ada report untuk sample ini.
        </p>
      </div>
    );
  }

  function handleSelectClause(index) {
    setActiveIndex(index);
    const klausulCode = report.data[index] && report.data[index].klausul;
    if (klausulCode) {
      const el = document.getElementById(`clause-${klausulCode}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleRegisterFlush(fn) {
    flushRef.current = fn;
  }

  function confirmSaveAndBack() {
    setConfirmOpen(true);
  }

  async function doSaveAndBack() {
    const returnPath = isEngineerOnly ? "/engineer-dashboard" : `/datasheet/${sampleId}`;
    const returnState = isEngineerOnly
      ? {
          from: "report-editor",
          lastClickedId: sampleId,
          tab: location.state?.tab,
          page: location.state?.page,
          search: location.state?.search,
        }
      : undefined;

    if (!flushRef.current) {
      navigate(returnPath, { state: returnState });
      return;
    }
    setIsSaving(true);
    try {
      const res = await flushRef.current();

      if (res && res.ok === false) {
        throw res.error || new Error("Gagal menyimpan");
      }

      if (res && res.count === 0) {
        setConfirmOpen(false);
        navigate(returnPath, { state: returnState });
        return;
      }

      toast.success(`Perubahan berhasil disimpan.`);
      setConfirmOpen(false);
      setTimeout(() => navigate(returnPath, { state: returnState }), 400);
    } catch (e) {
      console.error("Save failed", e);
      toast.error("Gagal menyimpan perubahan. Coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }

  const handleBackToDatasheet = async () => {
    if (flushRef.current) {
      try {
        await flushRef.current();
      } catch (e) {
        console.error("Save on back error", e);
      }
    }
    if (isEngineerOnly) {
      navigate("/engineer-dashboard", {
        state: {
          from: "report-editor",
          lastClickedId: sampleId,
          tab: location.state?.tab,
          page: location.state?.page,
          search: location.state?.search,
        },
      });
    } else {
      navigate(`/datasheet/${sampleId}`);
    }
  };

  const handleManualSave = async () => {
    if (!flushRef.current) return;
    setIsSaving(true);
    try {
      const res = await flushRef.current();
      if (res && res.ok === false) {
        throw res.error || new Error("Gagal menyimpan");
      }
      toast.success("Semua perubahan berhasil disimpan");
    } catch (e) {
      console.error("Manual save error", e);
      toast.error("Gagal menyimpan perubahan");
    } finally {
      setIsSaving(false);
    }
  };

  const steps = report.data.map((k) => {
    let total = 0,
      missing = 0,
      countL = 0,
      countTB = 0,
      countG = 0;

    (k.sub_klausul || []).forEach((s) => {
      // Sub-klausul level decision
      if (s.keputusan === "G") countG++;
      else if (s.keputusan === "L") countL++;
      else if (s.keputusan === "TB") countTB++;

      if (!s.butir || s.butir.length === 0) {
        total++;
        if (!s.keputusan) missing++;
      } else {
        s.butir.forEach((b) => {
          total++;
          const filled = !!b.keputusan;
          if (!filled) missing++;
          if (b.keputusan === "L") countL++;
          if (b.keputusan === "TB") countTB++;
          if (b.keputusan === "G") countG++;
        });
      }
    });

    // Check if any table instance in this clause has failed
    const clauseSubCodes = new Set((k.sub_klausul || []).map((s) => s.kode));
    clauseSubCodes.add(String(k.klausul));
    const hasFailedTable = (tableInstances || []).some((inst) => {
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

    let status = "blue";
    if (countG > 0) status = "red";
    else if (total > 0 && countTB === total && countL === 0) status = "gray";
    else if (countL > 0) status = "green";
    else if (missing > 0) status = "yellow";

    return {
      klausul: k.klausul,
      title: k.judul || "",
      subCount: (k.sub_klausul || []).length,
      total,
      missingCount: missing,
      status,
    };
  });

  const activeClause = report.data[activeIndex];

  const handleDownloadDatasheet = async () => {
    try {
      const response = await apiClient.get(
        `/reports/${report.id}/download/datasheet`,
        { responseType: "blob" },
      );

      const password = response.headers["x-datasheet-password"];

      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `DATASHEET-${report.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      if (password) {
        toast.success(`Datasheet diunduh. Password: ${password}`, {
          duration: 10000,
          icon: "🔒",
          style: { fontFamily: "monospace", fontSize: "14px" },
        });
        setTimeout(() => {
          window.alert(
            `Datasheet berhasil diunduh!\n\n` +
              `Password untuk membuka file:\n\n` +
              `  ${password}\n\n` +
              `Simpan password ini — Anda membutuhkannya untuk membuka file PDF.`,
          );
        }, 500);
      }
    } catch (error) {
      console.error("Datasheet download failed:", error);
      toast.error(
        "Gagal mengunduh Datasheet. Pastikan ada klausul yang sudah disetujui.",
      );
    }
  };

  const handleDownloadDraft = async () => {
    try {
      const response = await apiClient.get(
        `/reports/${report.id}/download/draft`,
        { responseType: "blob" },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `DRAFT-${report.id}.docx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Draft berhasil diunduh.");
    } catch (error) {
      console.error("Draft download failed:", error);
      toast.error("Gagal mengunduh Draft.");
    }
  };

  const isTechnician = user?.role === "TECHNICIAN" || user?.role === "ADMIN";
  const canDownloadDraft =
    user?.role === "ENGINEER" ||
    user?.role === "ADMIN" ||
    user?.role === "DRAFTER";
  const canDownloadDatasheet =
    user?.role === "TECHNICIAN" ||
    user?.role === "ENGINEER" ||
    user?.role === "ADMIN";
  const isApproved = report.status === "APPROVED";

  const draftCount = (report.data || []).filter((k) => {
    const s = klausulStatuses[k.klausul];
    return !s || s.status === "DRAFT";
  }).length;
  const reviewCount = Object.values(klausulStatuses).filter(
    (s) => s.status === "SUBMITTED",
  ).length;
  const hasApprovedKlausul = Object.values(klausulStatuses).some(
    (s) => s.status === "APPROVED",
  );

  return (
    <div className="flex flex-col nav:flex-row gap-6">
      {/* Clause navigation */}
      <aside className="nav:w-[300px] shrink-0 nav:sticky nav:top-[96px] nav:self-start flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <button
            type="button"
            onClick={handleBackToDatasheet}
            className="inline-flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-navy-800 transition-colors cursor-pointer w-fit"
            title={isEngineerOnly ? "Back to dashboard" : "Back to datasheet"}
          >
            <FiArrowLeft size={14} />{" "}
            {isEngineerOnly ? "Back to dashboard" : "Back to datasheet"}
          </button>
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-navy-800 text-white hover:bg-navy-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isSaving ? (
              <FaSpinner className="animate-spin" size={11} />
            ) : (
              <FiSave size={13} />
            )}
            Simpan
          </button>
        </div>
        <SidebarClauses
          steps={steps}
          activeIndex={activeIndex}
          onSelect={handleSelectClause}
        />
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex flex-col gap-3 mb-5">
          <div className="min-w-0">
            <div className="text-[13px] text-ink-400">
              Klausul {activeIndex + 1} dari {report.data.length}
            </div>
            <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
              <h1 className="text-2xl font-semibold text-navy-800 tracking-[-0.01em]">
                {activeClause.klausul} — {activeClause.judul || ""}
              </h1>
              {steps[activeIndex]?.status === "red" && (
                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-bad-bg text-bad-fg border border-bad-fg/40">
                  Gagal
                </span>
              )}
              {steps[activeIndex]?.status === "green" && (
                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-ok-bg text-ok-fg border border-ok-fg/40">
                  Lulus
                </span>
              )}
              {steps[activeIndex]?.status === "gray" && (
                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-warn-bg text-warn-fg border border-warn-fg/40">
                  Tidak Berlaku
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Fill UI — renders its own conditions card + clause cards */}
        <KlausulButirTable
          report={{ klausul: [activeClause] }}
          fullReport={report}
          userRole={user?.role}
          userName={user?.name}
          reportStatus={report.status}
          images={images}
          onChangeImages={setImages}
          onTableStatusChange={() => fetchTableInstances(report?.id)}
          onChangeReport={(updatedKlausuls) => {
            setReport((prev) => {
              const copy = JSON.parse(JSON.stringify(prev));
              copy.data[activeIndex] = updatedKlausuls[0];
              return copy;
            });
          }}
          onRegisterFlush={handleRegisterFlush}
        />

        {/* Footer controls */}
        <div className="mt-5 flex flex-col gap-4 nav:flex-row nav:items-center nav:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {isTechnician && !isApproved && (
              <button
                className={btnPrimary}
                onClick={() => setSubmitModalOpen(true)}
              >
                <FiSend size={16} /> Submit Klausul
                {draftCount > 0 && (
                  <span className="ml-0.5 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                    {draftCount}
                  </span>
                )}
              </button>
            )}

            {canReview && !isApproved && (
              <button
                className={btnPrimary}
                onClick={() => setSubmitModalOpen(true)}
              >
                <FiCheckCircle size={16} /> Review Klausul
                {reviewCount > 0 && (
                  <span className="ml-0.5 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                    {reviewCount}
                  </span>
                )}
              </button>
            )}

            {canDownloadDraft && (
              <button className={btnSoft} onClick={handleDownloadDraft}>
                <FiDownload size={16} /> Download Draft
              </button>
            )}

            {canDownloadDatasheet && (hasApprovedKlausul || isApproved) && (
              <button className={btnSoft} onClick={handleDownloadDatasheet}>
                <FiDownload size={16} /> Download Datasheet
              </button>
            )}

            {isApproved && (
              <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold bg-ok-bg text-ok-fg">
                <FiLock size={14} /> Semua Klausul Disetujui
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden nav:inline text-[13px] text-ink-400">
              Langkah {activeIndex + 1} dari {report.data.length}
            </span>
            <button
              className={btnGhost}
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
            >
              <FiChevronLeft size={16} /> Sebelumnya
            </button>
            <button
              className={btnPrimary}
              disabled={activeIndex === report.data.length - 1}
              onClick={() =>
                setActiveIndex((i) =>
                  Math.min(report.data.length - 1, i + 1),
                )
              }
            >
              Selanjutnya <FiChevronRight size={16} />
            </button>
          </div>
        </div>

        <KlausulSubmitModal
          isOpen={submitModalOpen}
          onClose={() => setSubmitModalOpen(false)}
          reportId={report.id}
          reportData={report.data}
          klausulStatuses={klausulStatuses}
          userRole={user?.role}
          onStatusChange={(newStatuses) => {
            setKlausulStatuses(newStatuses);
            // When every klausul is APPROVED the backend auto-locks the
            // report. Mirror that here so flushAutosave stops PATCHing a
            // locked report (it would get 403 otherwise).
            const codes = report.data.map((k) => k.klausul);
            const allApproved =
              codes.length > 0 &&
              codes.every((c) => newStatuses[c]?.status === "APPROVED");
            if (allApproved) {
              setReport((prev) => ({ ...prev, status: "APPROVED" }));
            }
          }}
          onBeforeApprove={async () => {
            if (flushRef.current) await flushRef.current();
          }}
        />
      </main>

      {/* Save & back confirmation modal removed — auto-save handles persistence */}
    </div>
  );
}
