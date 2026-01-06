// src/components/ImageUploader.jsx
import React, { useState, useEffect } from "react";
import apiClient from "../api"; // <-- CORRECT: Use real API client
import toast from "react-hot-toast";

// This component MUST receive reportId to know where to upload
export default function ImageUploader({
  sampleId,
  reportId,
  images = [],
  onChange,
}) {
  const [localImgs, setLocalImgs] = useState(images || []);
  const [uploading, setUploading] = useState(false);

  useEffect(() => setLocalImgs(images || []), [images]);

  async function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Hanya gambar");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Max 5MB");
      return;
    }

    if (!reportId) {
      toast.error("Gagal upload: Report ID tidak ditemukan");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("image", f);

    try {
      // Use the real API client and endpoint
      const res = await apiClient.post(
        `/uploads/report-image/${reportId}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const newImage = res.data; // The new ReportImage object
      const next = [...localImgs, newImage];
      setLocalImgs(next);
      onChange && onChange(next); // Update parent
      toast.success("Gambar diunggah");
    } catch (err) {
      toast.error("Gagal upload");
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }

    // reset input
    e.target.value = "";
  }

  async function removeImage(img) {
    if (img.id && !String(img.id).startsWith("tmp-")) {
      try {
        // Use the real DELETE endpoint
        await apiClient.delete(`/uploads/image/${img.id}`);
        const next = localImgs.filter((i) => i.id !== img.id);
        setLocalImgs(next);
        onChange && onChange(next);
        toast.success("Gambar dihapus");
      } catch (err) {
        toast.error("Gagal hapus gambar");
        console.error("Delete image error:", err);
        return;
      }
    } else {
      // It's a temporary image, just remove from state
      const next = localImgs.filter((i) => i.id !== img.id);
      setLocalImgs(next);
      onChange && onChange(next);
    }
  }

  function updateCaption(imgId, caption) {
    const next = localImgs.map((i) => (i.id === imgId ? { ...i, caption } : i));
    setLocalImgs(next);
    // Pass the change up to the parent, which should handle saving
    onChange && onChange(next);
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <label className="px-3 py-1 border rounded cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
          {uploading ? "Mengunggah..." : "Tambah Gambar"}
        </label>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        {localImgs.map((img) => (
          <div key={img.id} className="border p-2 rounded">
            <img
              src={img.url}
              alt={img.caption || ""}
              className="w-full h-36 object-contain"
            />
            <input
              value={img.caption || ""}
              onChange={(e) => updateCaption(img.id, e.target.value)}
              placeholder="Caption"
              className="w-full mt-2 border px-2 py-1 rounded"
            />
            <div className="flex justify-between mt-2">
              <button
                onClick={() => removeImage(img)}
                className="px-2 py-1 text-red-600 border rounded"
              >
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
