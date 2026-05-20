// src/components/SidebarClauses.jsx
import { FiAlertCircle } from "react-icons/fi";

/**
 steps: array of { klausul, title, subCount, total, missingCount, status }
 status values: 'red','green','gray','yellow','blue'
*/
const STATUS_CLS = {
  red: "bg-bad-bg text-bad-fg",
  green: "bg-ok-bg text-ok-fg",
  gray: "bg-neutral-bg text-neutral-fg",
  yellow: "bg-warn-bg text-warn-fg",
  blue: "bg-navy-100 text-navy-700",
};

export default function SidebarClauses({ steps = [], activeIndex = 0, onSelect }) {
  return (
    <div className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden">
      <div className="px-4 py-3.5 border-b border-line-soft">
        <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-[0.06em]">
          Klausul
        </h3>
      </div>

      <div className="p-2 flex flex-col gap-1 max-h-[70vh] overflow-y-auto">
        {steps.map((s, i) => {
          const cls = STATUS_CLS[s.status || "blue"] || STATUS_CLS.blue;
          const isActive = i === activeIndex;
          return (
            <button
              key={s.klausul}
              onClick={() => onSelect && onSelect(i)}
              className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                isActive ? "bg-navy-100" : "hover:bg-navy-50"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0 ${cls}`}
              >
                {s.klausul}
              </div>

              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-medium truncate ${
                    isActive ? "text-navy-800" : "text-ink-700"
                  }`}
                >
                  {s.title || `Klausul ${s.klausul}`}
                </div>
                <div className="text-xs text-ink-400">{s.subCount} langkah</div>
              </div>

              {s.missingCount > 0 ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-warn-fg shrink-0">
                  <FiAlertCircle size={14} />
                  {s.missingCount}
                </span>
              ) : (
                <span className="text-xs font-semibold text-ink-300 shrink-0">
                  {s.status === "green"
                    ? "OK"
                    : s.status === "gray"
                    ? "TB"
                    : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
