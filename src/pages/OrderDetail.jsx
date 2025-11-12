// src/pages/OrderDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../mocks/api';

export default function OrderDetail() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let mounted = true;
    api.getOrders().then(list => {
      const o = list.find(x => x.id === orderId);
      if (mounted) setOrder(o || null);
    });
    return () => (mounted = false);
  }, [orderId]);

  if (!order) return <div>Order not found</div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Order {order.order_no}</h2>
          <div className="text-sm text-gray-600">IWO: {order.iwo_no}</div>
        </div>
        <div>
          <Link to="/" className="text-sm text-sky-600">Back</Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {order.samples.map(s => (
          <div key={s.id} className="bg-white rounded shadow p-4">
            <div className="flex justify-between">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-gray-600">{s.brand} — {s.model}</div>
                <div className="text-xs text-gray-500 mt-1">{s.identifier}</div>
              </div>
              <div className="flex flex-col gap-2">
                <Link to={`/reports/${s.id}`} className="px-3 py-2 bg-sky-600 text-white rounded text-sm">Open Report</Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
