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
                {w.status === "APPROVED" && (
                  <a
                    href={`${apiClient.defaults.baseURL}/reports/${w.reportId}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="px-3 py-2 rounded bg-emerald-600 text-white text-sm"
                  >
                    Download
                  </a>
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
