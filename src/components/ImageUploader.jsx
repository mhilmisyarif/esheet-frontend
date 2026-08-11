import React, { useState, useEffect } from "react";
import apiClient from "../api";
import toast from "react-hot-toast";

/**
 * ImageUploader Component with Drag-and-Drop functionality.
 *
 * Props:
 * - sampleId: Optional sample identifier
 * - reportId: Required report ID for backend endpoints
 * - images: Initial or controlled list of uploaded image objects
 * - onChange: Callback fired when image list updates
 */
export default function ImageUploader({
  sampleId,
  reportId,
  images = [],
  onChange,
}) {
  const [localImgs, setLocalImgs] = useState(images || []);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setLocalImgs(images || []);
  }, [images]);

  /**
   * Core function to validate and upload an image file
   */
  async function processFile(file) {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Hanya gambar");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max 5MB");
      return;
    }

    // Ensure report ID exists before attempting upload
    if (!reportId) {
      toast.error("Gagal upload: Report ID tidak ditemukan");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await apiClient.post(
        `/uploads/report-image/${reportId}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      const newImage = res.data;
      const next = [...localImgs, newImage];
      setLocalImgs(next);
      if (onChange) onChange(next);
      toast.success("Gambar diunggah");
    } catch (err) {
      toast.error("Gagal upload");
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  }

  // Handle file select via standard file browser input
  function handleFileInput(e) {
    const file = e.target.files[0];
    processFile(file);
    e.target.value = ""; // Reset input value
  }

  // Drag and Drop Event Handlers
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }

  // Handle removing image from server/state
  async function removeImage(img) {
    if (img.id && !String(img.id).startsWith("tmp-")) {
      try {
        await apiClient.delete(`/uploads/image/${img.id}`);
        const next = localImgs.filter((i) => i.id !== img.id);
        setLocalImgs(next);
        if (onChange) onChange(next);
        toast.success("Gambar dihapus");
      } catch (err) {
        toast.error("Gagal hapus gambar");
        console.error("Delete image error:", err);
        return;
      }
    } else {
      const next = localImgs.filter((i) => i.id !== img.id);
      setLocalImgs(next);
      if (onChange) onChange(next);
    }
  }

  // Update image caption locally and notify parent
  function updateCaption(imgId, caption) {
    const next = localImgs.map((i) => (i.id === imgId ? { ...i, caption } : i));
    setLocalImgs(next);
    if (onChange) onChange(next);
  }

  return (
    <div className="mt-6">
      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400 bg-gray-50"
        }`}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
          id="file-upload-input"
          disabled={uploading}
        />
        <label htmlFor="file-upload-input" className="cursor-pointer block">
          {uploading ? (
            <p className="text-blue-600 font-medium">Mengunggah gambar...</p>
          ) : (
            <div>
              <p className="text-gray-700 font-medium">
                Tarik & Lepas gambar di sini, atau{" "}
                <span className="text-blue-600 underline">Pilih File</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Format: PNG, JPG, JPEG (Maksimal 5MB)
              </p>
            </div>
          )}
        </label>
      </div>

      {/* Image Preview Grid */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {localImgs.map((img) => (
          <div key={img.id} className="border p-2 rounded bg-white shadow-sm">
            <img
              src={img.url}
              alt={img.caption || "Uploaded item"}
              className="w-full h-36 object-contain"
            />
            <input
              value={img.caption || ""}
              onChange={(e) => updateCaption(img.id, e.target.value)}
              placeholder="Tambah Caption..."
              className="w-full mt-2 border px-2 py-1 rounded text-sm"
            />
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={() => removeImage(img)}
                className="px-2 py-1 text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded"
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
