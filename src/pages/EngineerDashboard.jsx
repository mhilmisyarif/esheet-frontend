// src/pages/EngineerDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";

export default function EngineerDashboard() {
  const [worksheets, setWorksheets] = useState([]);
  const [filterStatus, setFilterStatus] = useState("SUBMITTED"); // Default to SUBMITTED
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth(); // Get the logged-in user

  useEffect(() => {
    setLoading(true);
    // Call the backend endpoint with our status filter
    apiClient
      .get(`/api/samples?status=${filterStatus}`)
      .then((response) => {
        // Map the data just like in the Technician dashboard
        const mappedWorksheets = response.data.map((sample) => ({
          id: sample.id, // Sample ID
          reportId: sample.Report ? sample.Report.id : null,
          title: sample.name || "N/A",
          orderNo: sample.order.order_no,
          createdAt: sample.order.createdAt,
          status: sample.Report ? sample.Report.status : "DRAFT",
        }));
        setWorksheets(mappedWorksheets);
      })
      .catch((error) => {
        console.error("Error fetching samples:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [filterStatus]); // Re-run this effect when the filterStatus changes

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          Selamat Datang, {user?.name}!
        </h1>
        <p className="text-sm text-gray-500">Engineer Dashboard</p>
      </div>

      {/* --- Filter Tabs --- */}
      <div className="mb-4 flex border-b">
        <button
          className={`py-2 px-4 ${
            filterStatus === "SUBMITTED"
              ? "border-b-2 border-sky-600 font-semibold text-sky-600"
              : "text-gray-500"
          }`}
          onClick={() => setFilterStatus("SUBMITTED")}
        >
          Awaiting Review
        </button>
        <button
          className={`py-2 px-4 ${
            filterStatus === "APPROVED"
              ? "border-b-2 border-sky-600 font-semibold text-sky-600"
              : "text-gray-500"
          }`}
          onClick={() => setFilterStatus("APPROVED")}
        >
          Approved
        </button>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-4">
          {filterStatus === "SUBMITTED"
            ? "Worksheets Awaiting Review"
            : "Approved Worksheets"}
        </h2>
        <div className="space-y-4">
          {loading ? (
            <p>Loading...</p>
          ) : worksheets.length === 0 ? (
            <p>No reports found with this status.</p>
          ) : (
            worksheets.map((w) => (
              <div
                key={w.id}
                className="bg-white rounded-lg shadow p-4 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold">{w.title}</div>
                  <div className="text-sm text-gray-500">{w.orderNo}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Created: {formatDate(w.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={w.status} />
                  <button
                    // Navigate to the same ReportEditor page
                    onClick={() => navigate(`/reports/${w.id}`)}
                    className="px-3 py-2 rounded bg-sky-600 text-white text-sm"
                  >
                    {/* Text depends on status */}
                    {w.status === "APPROVED" ? "View" : "Review"}
                  </button>
                  {/* Download button for approved reports */}
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
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// (You can copy this helper function from TechnicianDashboard.jsx)
function formatDate(d) {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d;
  }
}
