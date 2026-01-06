// src/components/StatusBadge.jsx
import React from "react";

export default function StatusBadge({ status }) {
  const map = {
    SUBMITTED: "bg-blue-100 text-blue-800",
    REVISED: "bg-purple-100 text-purple-800", // Distinct color for revised
    APPROVED: "bg-emerald-100 text-emerald-800",
    REJECTED: "bg-red-100 text-red-800",
    DRAFT: "bg-gray-100 text-gray-700",
  };
  const cls = map[status] || "bg-gray-100 text-gray-700";
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
