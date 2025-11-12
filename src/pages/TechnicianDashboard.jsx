// src/pages/TechnicianDashboard.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import WorksheetCard from "../components/WorksheetCard";
import api from "../mocks/api";
import StatusBadge from "../components/StatusBadge";

export default function TechnicianDashboard() {
  const [orders, setOrders] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    api.getOrders().then((list) => {
      if (!mounted) return;
      // flatten reports as demo worksheets (one per sample)
      const worksheets = [];
      list.forEach((o) => {
        o.samples.forEach((s) => {
          worksheets.push({
            id: s.id,
            title: s.name,
            orderNo: o.order_no,
            createdAt: o.created_at,
            status: Math.random() > 0.5 ? "Submitted" : "Approved", // demo statuses
          });
        });
      });
      setOrders(worksheets);
    });
    return () => (mounted = false);
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          Selamat Datang, Afif Iskayana Zainullah!
        </h1>
        <p className="text-sm text-gray-500">Dashboard Teknisi</p>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-medium mb-4">
          Riwayat Worksheet Anda (Demo)
        </h2>
        <div className="space-y-4">
          {orders.map((w) => (
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
                  onClick={() => navigate(`/reports/${w.id}`)}
                  className="px-3 py-2 rounded bg-sky-600 text-white text-sm"
                >
                  Buka Worksheet
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <button
        onClick={() => navigate("/reports/new")}
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
    return dt.toLocaleDateString();
  } catch {
    return d;
  }
}
