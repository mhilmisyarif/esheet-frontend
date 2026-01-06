// src/pages/ReportEditor.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SidebarClauses from "../components/SidebarClauses";
import KlausulButirTable from "../components/KlausulButirTable";
import toast from "react-hot-toast";
import { FaSpinner } from "react-icons/fa";
import apiClient from "../api";
import { useAuth } from "../context/AuthContext";

export default function ReportEditor() {
  const { sampleId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [images, setImages] = useState([]); // State to hold images

  // flush function provided by child
  const flushRef = useRef(null);

  // modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!sampleId) {
      console.warn("No sampleId provided");
      setLoading(false);
      return;
    }

    // --- AFTER (using real API) ---
    apiClient
      .get(`/reports/${sampleId}`) // <-- Call new route
      .then((response) => {
        if (!mounted) return;
        setReport(response.data); // Set the report from the API
        setLoading(false);
      })
      .catch((err) => {
        // A 404 is normal if the report hasn't been created
        if (err.response && err.response.status === 404) {
          // You'd ideally show a "Create Report" button here
          console.log("No report exists for this sample yet.");
        } else {
          console.error("Error fetching report:", err);
        }
        setLoading(false);
      });
    return () => (mounted = false);
  }, [sampleId, navigate]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!report) return <div className="p-8">Report tidak ditemukan</div>;

  function handleSelectClause(index) {
    setActiveIndex(index);
    // <--- FIXED: report.data instead of report.klausul
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
    if (!flushRef.current) {
      navigate("/");
      return;
    }
    setIsSaving(true);
    try {
      const res = await flushRef.current();

      if (res && res.ok === false) {
        throw res.error || new Error("Gagal menyimpan");
      }

      // Check for "success but no changes"
      if (res && res.count === 0) {
        setConfirmOpen(false);
        navigate("/");
        return;
      }

      toast.success(`Perubahan berhasil disimpan.`);
      setConfirmOpen(false);
      setTimeout(() => navigate("/"), 400);
    } catch (e) {
      console.error("Save failed", e);
      toast.error("Gagal menyimpan perubahan. Coba lagi.");
    } finally {
      setIsSaving(false);
    }
  }

  // <--- FIXED: report.data instead of report.klausul
  const steps = report.data.map((k) => {
    let total = 0,
      missing = 0,
      countL = 0,
      countTB = 0,
      countG = 0;
    k.sub_klausul.forEach((s) =>
      s.butir.forEach((b) => {
        total++;
        const filled = !!b.keputusan;
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

  // <--- FIXED: report.data instead of report.klausul
  const activeClause = report.data[activeIndex];

  const handleApprove = async () => {
    if (!window.confirm("Are you sure you want to approve this report?"))
      return;
    try {
      await apiClient.post(`/reports/${report.id}/approve`);
      toast.success("Report Approved!");
      setReport((prev) => ({ ...prev, status: "APPROVED" }));
      setTimeout(() => navigate("/"), 500);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to approve");
    }
  };

  const handleReject = async () => {
    const reason = window.prompt("Please provide a reason for rejection:");
    if (!reason) {
      toast.error("Rejection cancelled. A reason is required.");
      return;
    }
    try {
      await apiClient.post(`/reports/${report.id}/reject`, { reason });
      toast.success("Report Rejected and sent back to technician.");
      setReport((prev) => ({
        ...prev,
        status: "REJECTED",
        rejection_reason: reason,
      }));
      setTimeout(() => navigate("/"), 500);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to reject");
    }
  };

  const isEngineer = user?.role === "ENGINEER" || user?.role === "ADMIN";
  const isTechnician = user?.role === "TECHNICIAN" || user?.role === "ADMIN"; // Admin can act as tech

  const isDraft = report.status === "DRAFT";
  const isRejected = report.status === "REJECTED";
  const isSubmitted = report.status === "SUBMITTED";
  const isRevised = report.status === "REVISED";
  const isApproved = report.status === "APPROVED";

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
            // <--- FIXED: report prop structure
            report={{ klausul: [activeClause] }}
            fullReport={report}
            // Pass User Info for Corrections
            userRole={user?.role}
            userName={user?.name}
            // Pass Images state
            images={images}
            onChangeImages={setImages}
            onChangeReport={(updatedKlausuls) => {
              setReport((prev) => {
                const copy = JSON.parse(JSON.stringify(prev));
                // <--- FIXED: copy.data instead of copy.klausul
                copy.data[activeIndex] = updatedKlausuls[0];
                return copy;
              });
            }}
            onRegisterFlush={handleRegisterFlush}
          />
        </div>

        {/* Footer controls */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {/* TECHNICIAN CONTROLS */}
            {isTechnician && !isApproved && (
              <div className="flex gap-2">
                <button
                  onClick={confirmSaveAndBack}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  {isRejected ? "Simpan Perbaikan" : "Simpan & Kembali"}
                </button>

                <button
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Kirim laporan ini untuk review Engineer?"
                      )
                    )
                      return;
                    try {
                      await apiClient.post(`/reports/${report.id}/submit`);
                      toast.success("Laporan berhasil dikirim!");
                      setReport((prev) => ({
                        ...prev,
                        status: isRejected ? "REVISED" : "SUBMITTED",
                      }));
                      navigate("/");
                    } catch (e) {
                      toast.error(
                        "Gagal mengirim. Pastikan semua data terisi."
                      );
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {isRejected
                    ? "Kirim Revisi"
                    : isSubmitted || isRevised
                    ? "Update Pengajuan"
                    : "Submit ke Engineer"}
                </button>
              </div>
            )}

            {/* ENGINEER CONTROLS */}
            {isEngineer && (isSubmitted || isRevised) && (
              <div className="flex gap-2">
                <button
                  onClick={confirmSaveAndBack}
                  className="px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded hover:bg-blue-50"
                >
                  Simpan Koreksi
                </button>
                <button
                  onClick={handleReject}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                >
                  Approve {isRevised ? "(Revisi)" : ""}
                </button>
              </div>
            )}

            {/* READ ONLY INDICATOR */}
            {isApproved && (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded font-medium">
                🔒 Laporan Disetujui (Locked)
              </span>
            )}
          </div>

          <div className="text-sm text-gray-500">
            {/* <--- FIXED: report.data.length */}
            Langkah {activeIndex + 1} dari {report.data.length}
          </div>

          {/* Navigation */}
          <div>
            <button
              onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
              className="px-4 py-2 bg-gray-200 rounded mr-2"
            >
              Sebelumnya
            </button>
            <button
              onClick={() =>
                // <--- FIXED: report.data.length
                setActiveIndex((i) => Math.min(report.data.length - 1, i + 1))
              }
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
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
                  Semua perubahan lokal akan dikirim ke server sekarang.
                </p>

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
