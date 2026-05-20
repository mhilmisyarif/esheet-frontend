// src/components/KlausulSubmitModal.jsx
//
// A modal that wraps KlausulStatusPanel.
// Triggered by a button in ReportEditor — keeps the sidebar clean.
//
// Props:
//   isOpen         {bool}
//   onClose        {fn}
//   reportId       {number}
//   reportData     {Array}
//   klausulStatuses {object}
//   userRole       {string}
//   onStatusChange {fn}

import { FiX } from "react-icons/fi";
import KlausulStatusPanel from "./KlausulStatusPanel";

export default function KlausulSubmitModal({
  isOpen,
  onClose,
  reportId,
  reportData,
  klausulStatuses,
  userRole,
  onStatusChange,
  onBeforeApprove,
}) {
  if (!isOpen) return null;

  const isEngineer = userRole === "ENGINEER" || userRole === "ADMIN";
  const title = isEngineer
    ? "Review & Setujui Klausul"
    : "Submit Klausul ke Engineer";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(7,25,63,0.42)] p-6"
      onClick={onClose}
    >
      <div
        className="bg-paper rounded-3xl shadow-modal w-full max-w-[480px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft">
          <h3 className="text-base font-semibold text-navy-800">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center text-ink-400 hover:bg-navy-50 hover:text-navy-800 transition-colors"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 p-4">
          <KlausulStatusPanel
            reportId={reportId}
            reportData={reportData}
            klausulStatuses={klausulStatuses}
            userRole={userRole}
            onStatusChange={(newStatuses) => {
              onStatusChange && onStatusChange(newStatuses);
            }}
            onBeforeApprove={onBeforeApprove}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-line-soft bg-navy-50">
          <button
            onClick={onClose}
            className="w-full h-10 rounded-xl text-sm font-semibold bg-paper text-navy-800 border border-line hover:bg-navy-100 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
