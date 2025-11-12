// src/components/StatusBadge.jsx
import React from 'react';

export default function StatusBadge({ status }) {
  const map = {
    Submitted: 'bg-amber-100 text-amber-800',
    Approved: 'bg-emerald-100 text-emerald-800',
    Draft: 'bg-gray-100 text-gray-700'
  };
  const cls = map[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
