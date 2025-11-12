// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import WorksheetCard from "../components/WorksheetCard";
import api from "../mocks/api";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    let mounted = true;
    api.getOrders().then((data) => {
      if (mounted) setOrders(data);
    });
    return () => (mounted = false);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
      <div className="space-y-4">
        {orders.map((o) => (
          <div key={o.id} className="bg-white p-4 rounded shadow">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm text-gray-500">Order</div>
                <div className="text-lg font-medium">{o.order_no}</div>
                <div className="text-sm text-gray-600">{o.applicant}</div>
                <div className="text-sm text-gray-500">IWO: {o.iwo_no}</div>
              </div>
              <div>
                <Link
                  to={`/orders/${o.id}`}
                  className="px-3 py-2 bg-sky-600 text-white rounded"
                >
                  Open
                </Link>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-sm text-gray-500">Samples</div>
              <div className="flex gap-2 mt-2">
                {o.samples.map((s) => (
                  <div
                    key={s.id}
                    className="text-xs px-2 py-1 bg-gray-100 rounded"
                  >
                    {s.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
