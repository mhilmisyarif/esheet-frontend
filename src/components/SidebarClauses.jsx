// src/components/SidebarClauses.jsx
import React from 'react';
import { ExclamationIcon } from './icons';

/**
 steps: array of { klausul, title, subCount, total, missingCount, status }
 status values: 'red','green','gray','yellow','blue'
*/
export default function SidebarClauses({ steps = [], activeIndex = 0, onSelect }) {
  return (
    <div className="w-72 bg-white rounded shadow p-3 sticky top-4 h-[80vh] overflow-auto">
      <div className="mb-3">
        <div className="text-sm font-semibold">Klausul</div>
      </div>

      <div className="space-y-2">
        {steps.map((s, i) => {
          const hasMissing = s.missingCount && s.missingCount > 0;
          // determine color classes from status
          const status = s.status || 'blue';
          const colorMap = {
            red: { bg: 'bg-red-100', text: 'text-red-800', ring: 'ring-red-50' },
            green: { bg: 'bg-emerald-100', text: 'text-emerald-800', ring: 'ring-emerald-50' },
            gray: { bg: 'bg-gray-100', text: 'text-gray-700', ring: 'ring-gray-50' },
            yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', ring: 'ring-yellow-50' },
            blue: { bg: 'bg-sky-100', text: 'text-sky-600', ring: 'ring-sky-50' }
          };
          const cls = colorMap[status] || colorMap.blue;

          return (
            <button
              key={s.klausul}
              onClick={() => onSelect && onSelect(i)}
              className={`w-full text-left flex items-center gap-3 p-2 rounded transition ${i === activeIndex ? 'bg-sky-50 border-l-4 border-sky-600' : 'hover:bg-gray-50'} ${s.missingCount > 0 ? 'ring-2 ring-yellow-100' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${cls.bg} ${cls.text}`}>
                {s.klausul}
              </div>

              <div className="flex-1">
                <div className="text-sm font-medium">{s.title || `Klausul ${s.klausul}`}</div>
                <div className="text-xs text-gray-400">{s.subCount} langkah</div>
              </div>

              {/* show missing count or status badge */}
              <div className="flex items-center gap-2">
                {s.missingCount > 0 ? (
                  <>
                    <span className="text-xs text-yellow-800 bg-yellow-50 px-2 py-0.5 rounded">{s.missingCount}</span>
                    <ExclamationIcon className="w-4 h-4 text-yellow-700" />
                  </>
                ) : (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${cls.bg} ${cls.text}`}>{s.status === 'green' ? 'OK' : s.status === 'gray' ? 'TB' : ' '}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
