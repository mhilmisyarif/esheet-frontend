// src/pages/TechnicianDashboard.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
// import WorksheetCard from "../components/WorksheetCard"; // This component isn't used here
import apiClient from "../api"; // <-- Import the real API client
import StatusBadge from "../components/StatusBadge";

export default function TechnicianDashboard() {
  // Rename state to 'worksheets' for clarity
  const [worksheets, setWorksheets] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    // Call the NEW backend endpoint
    apiClient
      .get("/samples")
      .then((response) => {
        if (!mounted) return;

        // response.data is an array of Sample objects from Prisma
        // We need to map it to the flat structure your render code expects
        const mappedWorksheets = response.data.map((sample) => {
          return {
            id: sample.id, // This is the Sample ID
            reportId: sample.Report ? sample.Report.id : null,
            title: sample.name || "N/A",
            orderNo: sample.order.order_no,
            createdAt: sample.order.createdAt, // Use the order's creation date
            // Get status from the related Report, default to 'DRAFT' if no report
            status: sample.Report ? sample.Report.status : "DRAFT",
          };
        });

        setWorksheets(mappedWorksheets); // Set the correctly shaped data
      })
      .catch((error) => {
        console.error("Error fetching samples:", error);
      });

    return () => (mounted = false);
  }, []); // Run only on mount

  // Function to handle secure file download
  const handleDownload = async (reportId, fileName) => {
    try {
      // 1. Request the file as a "blob" (binary data)
      const response = await apiClient.get(`/reports/${reportId}/download`, {
        responseType: "blob", // Important: tells axios to handle binary data
      });

      // 2. Create a temporary URL for the blob
      const url = window.URL.createObjectURL(new Blob([response.data]));

      // 3. Create a temporary link element and click it
      const link = document.createElement("a");
      link.href = url;

      // Use the filename from the backend or a fallback
      link.setAttribute("download", fileName || `Report-${reportId}.docx`);

      document.body.appendChild(link);
      link.click();

      // 4. Cleanup
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed", error);
      // Show a nice error message (e.g. if not approved yet)
      // You might need to read the blob as text to see the JSON error message
      alert(
        "Gagal mengunduh laporan. Pastikan laporan sudah disetujui (Approved)."
      );
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Selamat Datang, Teknisi!</h1>
        <p className="text-sm text-gray-500">Dashboard Teknisi</p>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-medium mb-4">
          Riwayat Worksheet Anda (Demo)
        </h2>
        <div className="space-y-4">
          {/* Change 'orders.map' to 'worksheets.map' */}
          {worksheets.map((w) => (
            <div
              key={w.id}
              className="bg-white rounded-lg shadow p-4 flex items-center justify-between"
            >
              <div>
                <div className="font-semibold">{w.title}</div>
                <div className="text-sm text-gray-500">{w.orderNo}</div>
                <div className="text-xs text-gray-400 mt-1">
                  Dibuat pada: {formatDate(w.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={w.status} />
                <button
                  // This navigate is correct: it goes to the report editor
                  // using the *sampleId* (which is w.id)
                  onClick={() => navigate(`/reports/${w.id}`)}
                  className="px-3 py-2 rounded bg-sky-600 text-white text-sm"
                >
                  {w.status === "APPROVED" ? "Lihat" : "Buka Worksheet"}
                </button>
                {/* NEW CODE - USE THIS */}
                {w.status === "APPROVED" && (
                  <button
                    onClick={() =>
                      handleDownload(w.reportId, `LHU-${w.title}.docx`)
                    }
                    className="px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                  >
                    Download
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <button
        onClick={() => navigate("/create-report")} // <-- UPDATE THIS
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 shadow-lg text-white text-2xl flex items-center justify-center"
        title="Buat worksheet baru"
      >
        +
      </button>
    </div>
  );
}

function formatDate(d) {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    // Use toLocaleDateString for a cleaner format
    return dt.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d;
  }
}
