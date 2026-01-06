// src/components/WorksheetCard.jsx
import React, { useState } from "react";
import ImageUploader from "./ImageUploader"; // <-- This now imports the CORRECT uploader
// import api from "../mocks/api"; // <-- REMOVED
import toast from "react-hot-toast";

/**
 * WorksheetCard
 * Props:
 * - report: object (sample/report)
 * - onOpen: function(report)
 * - onDelete: function(report)
 * - onImagesSaved: function(reportId, images) optional
 */
export default function WorksheetCard({
  report,
  onOpen,
  onDelete,
  onImagesSaved, // This prop is likely no longer needed
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [images, setImages] = useState(report.images || []);

  // We need both sampleId and reportId
  const sampleId = report.sample_id || report.sampleId || report.id;
  // Assumes your report object has the report ID.
  // You may need to adjust this based on your data structure.
  const reportId = report.reportId || report.id;

  async function handleSaveImages(updatedImages) {
    // This function used to call the mock API.
    // The new `ImageUploader` component handles its own uploads.
    // The main `KlausulButirTable` handles saving captions/order.
    // This function is redundant. We will just close the modal.
    setImages(updatedImages);
    setUploaderOpen(false);
    toast.success("Gambar diperbarui");
  }

  async function handleDeleteReport() {
    if (!window.confirm(`Hapus worksheet "${report.sample_name || sampleId}"?`))
      return;
    try {
      // This part is fine, it just calls the parent function
      if (typeof onDelete === "function") {
        await onDelete(report);
      }
      toast.success("Worksheet dihapus");
    } catch (e) {
      toast.error("Gagal menghapus");
      console.error(e);
    }
  }

  return (
    <div className="rounded shadow-sm bg-white border p-4 flex items-center justify-between">
      <div>
        <div className="text-lg font-semibold">
          {report.sample_name || "Sample"}
        </div>
        <div className="text-xs text-gray-500">
          {report.order_no || report.order || ""}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Dibuat pada: {report.created_at || report.date || ""}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Status badge (optional) */}
        <div>
          {report.status === "approved" ? (
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm">
              Approved
            </span>
          ) : report.status === "submitted" ? (
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-sm">
              Submitted
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
              Draft
            </span>
          )}
        </div>

        <button
          onClick={() => onOpen && onOpen(report)}
          className="px-4 py-2 bg-sky-600 text-white rounded"
        >
          Buka Worksheet
        </button>

        {/* Kebab menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((s) => !s)}
            aria-label="More"
            className="w-10 h-10 rounded-full flex items-center justify-center border hover:bg-gray-100"
            title="Lainnya"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              viewBox="0 0 20 20"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow z-50">
              <button
                onClick={() => {
                  setUploaderOpen(true);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50"
              >
                Input Komponen + Gambar
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleDeleteReport();
                }}
                className="w-full text-left px-3 py-2 text-red-600 hover:bg-gray-50"
              >
                Hapus
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal ImageUploader */}
      {uploaderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg w-[900px] max-w-full mx-4 p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Input Komponen & Gambar</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUploaderOpen(false)}
                  className="px-3 py-1 border rounded"
                >
                  Tutup
                </button>
                <button
                  onClick={() => handleSaveImages(images)}
                  className="px-3 py-1 bg-sky-600 text-white rounded"
                >
                  Simpan & Tutup
                </button>
              </div>
            </div>

            <div>
              {/* Pass the reportId to the now-correct uploader */}
              <ImageUploader
                sampleId={sampleId}
                reportId={reportId}
                images={images}
                onChange={(imgs) => setImages(imgs)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
