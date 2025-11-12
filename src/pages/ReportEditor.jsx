// src/pages/ReportEditor.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../mocks/api";
import SidebarClauses from "../components/SidebarClauses";
import KlausulButirTable from "../components/KlausulButirTable";
import toast from "react-hot-toast";
import { FaSpinner } from "react-icons/fa";

/**
 * ReportEditor with polished "Simpan & Kembali" confirmation modal.
 * - Child registers flush function via onRegisterFlush
 * - Parent shows polished modal, calls flush, shows spinner/toast, then navigates back
 */

export default function ReportEditor() {
  const { sampleId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  // flush function provided by child
  const flushRef = useRef(null);

  // modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!sampleId) {
      api.getOrders().then((list) => {
        const sample = list[0].samples[0];
        navigate(`/reports/${sample.id}`, { replace: true });
      });
      return;
    }
    api
      .getReportBySampleId(sampleId)
      .then((r) => {
        if (!mounted) return;
        setReport(r);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => (mounted = false);
  }, [sampleId, navigate]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!report) return <div className="p-8">Report tidak ditemukan</div>;

  function handleSelectClause(index) {
    setActiveIndex(index);
    const klausulCode = report.klausul[index] && report.klausul[index].klausul;
    if (klausulCode) {
      const el = document.getElementById(`clause-${klausulCode}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // child registers flush function here
  function handleRegisterFlush(fn) {
    flushRef.current = fn;
  }

  // open modal
  function confirmSaveAndBack() {
    setConfirmOpen(true);
  }

  // actual save action (called from modal)
  async function doSaveAndBack() {
    if (!flushRef.current) {
      // no flush function: still navigate back
      navigate("/");
      return;
    }
    setIsSaving(true);
    try {
      const res = await flushRef.current();
      // flush function returns object { ok: true, count } or similar in our child
      // show toast accordingly
      if (res && res.ok === false) {
        throw res.error || new Error("Gagal menyimpan");
      }
      toast.success(`Perubahan berhasil disimpan.`);
      setConfirmOpen(false);
      // small delay to let user feel the success toast (optional)
      setTimeout(() => navigate("/"), 400);
    } catch (e) {
      console.error("Save failed", e);
      toast.error("Gagal menyimpan perubahan. Coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }

  // compute steps (for sidebar badges) — reused from earlier logic
  const steps = report.klausul.map((k) => {
    let total = 0,
      missing = 0,
      countL = 0,
      countTB = 0,
      countG = 0;
    k.sub_klausul.forEach((s) =>
      s.butir.forEach((b) => {
        total++;
        const filled = !!b.keputusan; // treat any decision as filled
        if (!filled) missing++;
        if (b.keputusan === "L") countL++;
        if (b.keputusan === "TB") countTB++;
        if (b.keputusan === "G") countG++;
      })
    );
    let status = "blue";
    if (countG > 0) status = "red";
    else if (total > 0 && countTB === total) status = "gray";
    else if (countL > 0) status = "green";
    else if (missing > 0) status = "yellow";
    return {
      klausul: k.klausul,
      title: k.judul || "",
      subCount: k.sub_klausul.length,
      total,
      missingCount: missing,
      status,
    };
  });

  const activeClause = report.klausul[activeIndex];

  return (
    <div className="flex gap-6 p-6">
      {/* Sidebar */}
      <aside style={{ width: 320 }}>
        <SidebarClauses
          steps={steps}
          activeIndex={activeIndex}
          onSelect={handleSelectClause}
        />
      </aside>

      {/* Main */}
      <main className="flex-1">
        <div className="mb-4">
          <div className="text-sm text-gray-500">Klausul</div>
          <div className="text-2xl font-semibold">
            {activeClause.klausul} — {activeClause.judul || ""}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded">
          <KlausulButirTable
            report={{ ...report, klausul: [activeClause] }}
            fullReport={report}
            onChangeReport={(updatedKlausuls) => {
              setReport((prev) => {
                const copy = JSON.parse(JSON.stringify(prev));
                copy.klausul[activeIndex] = updatedKlausuls[0];
                return copy;
              });
            }}
            onRegisterFlush={handleRegisterFlush}
          />
        </div>

        {/* Footer controls */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            <button
              onClick={confirmSaveAndBack}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-250"
            >
              Simpan & Kembali
            </button>
          </div>

          <div className="text-sm text-gray-500">
            Langkah {activeIndex + 1} dari {report.klausul.length}
          </div>

          <div>
            <button
              onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
              className="px-4 py-2 bg-gray-200 rounded mr-2"
            >
              Sebelumnya
            </button>
            <button
              onClick={() =>
                setActiveIndex((i) => Math.min(report.klausul.length - 1, i + 1))
              }
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </main>

      {/* Polished confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6"
            style={{ transform: "translateY(0)", transition: "all 180ms ease" }}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-6 h-6 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4M7 7h.01M7 11h.01M7 15h.01"
                    />
                  </svg>
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">
                  Simpan perubahan dan kembali?
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Semua perubahan lokal akan dikirim ke server sekarang. Pastikan
                  koneksi internet stabil. Setelah simpan, Anda akan kembali ke
                  halaman utama.
                </p>

                {/* summary: number of unsaved butir (try to read from flushRef if possible) */}
                <div className="flex items-center gap-3 text-sm text-gray-700 mb-4">
                  <div className="px-3 py-2 bg-gray-100 rounded">
                    {/* estimate number: we cannot access child's dirtyRef directly here,
                        but we can show a soft hint by counting differences in report (simple) */}
                    {/* we'll derive a rough count: count empty keputusan in activeClause */}
                    <strong>
                      {
                        activeClause.sub_klausul.reduce(
                          (acc, s) =>
                            acc +
                            s.butir.filter((b) => !b.keputusan).length,
                          0
                        )
                      }
                    </strong>{" "}
                    butir belum terisi
                  </div>
                  <div className="text-xs text-gray-500">Klik "Ya, Simpan Sekarang" untuk menyimpan.</div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                    disabled={isSaving}
                  >
                    Batal
                  </button>

                  <button
                    onClick={doSaveAndBack}
                    className={`px-4 py-2 rounded text-white flex items-center gap-2 ${
                      isSaving ? "bg-sky-500/90" : "bg-sky-600 hover:bg-sky-700"
                    }`}
                    disabled={isSaving}
                  >
                    {isSaving ? <FaSpinner className="animate-spin" /> : null}
                    {isSaving ? "Menyimpan..." : "Ya, Simpan Sekarang"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
