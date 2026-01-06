// src/components/KlausulButirTable.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
// import sud from "../mocks/api";
import toast from "react-hot-toast";
import { FaSpinner } from "react-icons/fa";
import apiClient from "../api";
/**
 * KlausulButirTable.jsx
 * - Per-klausul meta (tester, tanggal, suhu, kelembaban)
 * - Per-klausul tables (CRUD table lampiran)
 * - Images uploader (sample gallery) — displayed at bottom + modal via menu
 * - Autosave (butir/meta/tables/images) + parent registration
 *
 * Note: ensure src/mocks/api.js exposes:
 * - updateButir(sampleId, klausulCode, butirKode, payload)
 * - bulkUpdate(sampleId, updates)
 * - updateKlausulMeta(sampleId, klausulCode, meta)
 * - saveKlausulTables(sampleId, klausulCode, tables)
 * - uploadImage(sampleId, file)
 * - deleteImage(sampleId, imageId)
 * - updateImages(sampleId, images)  (optional)
 *
 * Props:
 * - report, fullReport
 * - onChangeReport (optional)
 * - onRegisterFlush (optional)
 * - onDeleteSample (optional) - called when user chooses Hapus in menu
 */

const DECISIONS = [
  { value: "L", label: "L", color: "green" },
  { value: "TB", label: "TB", color: "gray" },
  { value: "G", label: "G", color: "red" },
];

export default function KlausulButirTable({
  report,
  fullReport,
  onChangeReport,
  onRegisterFlush,
  onDeleteSample,
  userRole,
  userName,
}) {
  const [localKlausulArr, setLocalKlausulArr] = useState(report.klausul || []);
  const [editingButir, setEditingButir] = useState(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [imagesState, setImagesState] = useState(report.images || []);

  // menu/modal states (NEW)
  const [menuOpen, setMenuOpen] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  // dirtyRef keys:
  // - <butirKode>
  // - meta-<klausulCode>
  // - tables-<klausulCode>
  // - images
  const dirtyRef = useRef({});
  const persistedRef = useRef({});
  const sampleId =
    (fullReport && fullReport.sample_id) ||
    report.sample_id ||
    (fullReport && fullReport.sample && fullReport.sample.id) ||
    null;
  const reportId =
    (fullReport && fullReport.id) || (report && report.id) || null;

  // init local state and persisted snapshot
  useEffect(() => {
    // Inisialisasi localKlausulArr HANYA dengan klausul aktif
    const cloned = JSON.parse(JSON.stringify(report.klausul || []));
    cloned.forEach((k) => {
      if (!k.meta)
        k.meta = {
          tester_name: "",
          test_datetime: "",
          temperature: null,
          humidity: null,
        };
      if (!k.tables) k.tables = [];
    });
    setLocalKlausulArr(cloned);

    // Inisialisasi imagesState
    setImagesState(fullReport.images || []); // Ambil images dari fullReport

    // persisted snapshot (ini sepertinya tidak lagi sinkron, tapi kita biarkan)
    const map = {};
    cloned.forEach((k) => {
      k.sub_klausul.forEach((s) => {
        s.butir.forEach((b) => {
          map[b.kode] = {
            keputusan: b.keputusan,
            hasil_catatan: b.hasil_catatan,
          };
        });
      });
      map[`meta-${k.klausul}`] = { ...(k.meta || {}) };
      map[`tables-${k.klausul}`] = JSON.stringify(k.tables || []);
    });
    map["images"] = JSON.stringify(fullReport.images || []);
    persistedRef.current = map;

    // Perbaikan dari bug sebelumnya (sudah benar)
    // dirtyRef.current = {}; (Dihapus)
  }, [report, fullReport.images]); // <-- Tambahkan fullReport.images

  const markDirty = useCallback((key) => {
    dirtyRef.current = { ...dirtyRef.current, [key]: true };
  }, []);

  function updateLocalDecision(klausulCode, butirKode, decision) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.sub_klausul.forEach((s) =>
          s.butir.forEach((b) => {
            if (b.kode === butirKode) {
              // --- CORRECTION LOGIC START ---
              // If Engineer is changing it, preserve the original
              if (userRole === "ENGINEER" || userRole === "ADMIN") {
                // If this is the FIRST correction, save the current value as original
                if (b.original_keputusan === undefined) {
                  b.original_keputusan = b.keputusan;
                }

                // Mark as corrected if it differs from the original
                // (If they change it back to original, we remove the flag)
                b.is_corrected = decision !== b.original_keputusan;

                // Optional: track who corrected it
                if (b.is_corrected) {
                  b.corrected_by = userName;
                }
              }
              // --- CORRECTION LOGIC END ---

              b.keputusan = decision;
              b.last_modified_by = userName || "demo-user";
              b.last_modified_at = new Date().toISOString();
            }
          })
        );
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport(next);
    markDirty(butirKode);
  }

  function updateKlausulMeta(klausulCode, changes) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    let changedClause = null;
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.meta = { ...(k.meta || {}), ...changes };
        k.last_meta_modified_at = new Date().toISOString();
        changedClause = k;
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport([changedClause]);
    markDirty(`meta-${klausulCode}`);
  }

  function updateKlausulTables(klausulCode, tables) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    let changedClause = null;
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.tables = tables;
        changedClause = k;
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport([changedClause]);
    markDirty(`tables-${klausulCode}`);
  }

  // images handlers
  function setImages(images) {
    setImagesState(images);
    markDirty("images");
    // Beri tahu parent bahwa 'images' telah berubah
    onChangeReport && onChangeReport(null, images);
  }

  const isButirFilled = (b) => !!b.keputusan;

  function findButirValue(butirKode) {
    for (const k of localKlausulArr)
      for (const s of k.sub_klausul)
        for (const b of s.butir)
          if (b.kode === butirKode)
            return { keputusan: b.keputusan, hasil_catatan: b.hasil_catatan };
    return {};
  }

  // save note (defensive) - Perbaikan dari bug sebelumnya
  async function saveNote(klausulCodeParam, butirKode, text) {
    let klausulCode = klausulCodeParam;
    if (!klausulCode) {
      for (const k of localKlausulArr) {
        for (const s of k.sub_klausul) {
          for (const b of s.butir) {
            if (b.kode === butirKode) {
              klausulCode = k.klausul;
              break;
            }
          }
          if (klausulCode) break;
        }
        if (klausulCode) break;
      }
    }

    if (!reportId) {
      console.error("saveNote: reportId missing", {
        klausulCode,
        butirKode,
        text,
      });
      toast.error("Gagal menyimpan catatan (reportId hilang)");
      return { ok: false };
    }

    try {
      setIsAutosaving(true);

      // Asumsi Anda punya endpoint ini di backend
      const res = await apiClient.patch(`/reports/${reportId}/butir`, {
        klausulCode: klausulCode,
        butirKode: butirKode,
        payload: {
          hasil_catatan: text,
          by: "demo-user", // TODO: Ganti dengan user asli
        },
      });

      if (res && res.status >= 400) throw new Error("API error");

      const copy = { ...dirtyRef.current };
      delete copy[butirKode];
      dirtyRef.current = copy;
      persistedRef.current[butirKode] = {
        keputusan: findButirValue(butirKode).keputusan,
        hasil_catatan: text,
      };
      toast.success("Catatan berhasil disimpan");
      return { ok: true };
    } catch (e) {
      console.error("saveNote error", e);
      toast.error("Gagal menyimpan catatan");
      return { ok: false, error: e };
    } finally {
      setIsAutosaving(false);
    }
  }

  // build dirty updates (fungsi ini tidak lagi digunakan oleh flushAutosave)
  function buildDirtyUpdates() {
    // ... (logika ini bisa disederhanakan/dihapus jika tidak dipakai)
  }

  // flush: send the entire data blob
  const flushAutosave = useCallback(async () => {
    // Jangan simpan jika tidak ada reportId atau tidak ada perubahan
    if (!reportId || Object.keys(dirtyRef.current).length === 0) {
      toast("Tidak ada perubahan untuk disimpan"); // Beri tahu user
      return { ok: true, count: 0 };
    }

    // ==========================================================
    // INI ADALAH PERBAIKAN UTAMA:
    // Ambil data dari 'fullReport.data' (prop dari parent)
    // BUKAN 'localKlausulArr' (state lokal)
    // ==========================================================
    const currentReportData = fullReport.data;
    const currentImagesData = imagesState; // Ambil state gambar saat ini

    setIsAutosaving(true);
    try {
      // Kirim data LENGKAP ke backend
      await apiClient.patch(`/reports/${reportId}/data`, {
        data: currentReportData,
        images: currentImagesData, // Kirim juga data gambar
      });

      // Jika sukses, bersihkan semua tanda 'dirty'
      dirtyRef.current = {};

      toast.success("Perubahan berhasil disimpan");
      return { ok: true, count: 1 }; // 1 operasi simpan
    } catch (e) {
      toast.error("Gagal menyimpan perubahan");
      console.error("flushAutosave error", e);
      return { ok: false, error: e };
    } finally {
      setIsAutosaving(false);
    }
  }, [reportId, fullReport, imagesState]); // <-- TAMBAHKAN fullReport dan imagesState

  // register flush with parent
  useEffect(() => {
    if (typeof onRegisterFlush === "function") {
      onRegisterFlush(flushAutosave);
    }
  }, [onRegisterFlush, flushAutosave]);

  // autosave interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (Object.keys(dirtyRef.current).length > 0) flushAutosave();
    }, 30000);
    return () => clearInterval(interval);
  }, [flushAutosave]);

  // save a single note (used by EditorModal)
  async function saveNoteWrapper(klausulCode, butirKode, text) {
    // Fungsi ini hanya menandai dirty. Sudah benar.
    markDirty(butirKode);
  }

  // handle delete sample from menu
  async function handleDeleteSample() {
    setMenuOpen(false);
    if (
      !window.confirm(
        "Hapus sample ini dari sistem? Tindakan ini tidak bisa dibatalkan."
      )
    )
      return;
    try {
      if (typeof onDeleteSample === "function") {
        await onDeleteSample(sampleId);
      } else {
        // fallback: panggil API hapus di sini jika ada
        await apiClient.delete(`/samples/${sampleId}`);
        toast.success("Sample berhasil dihapus");
        // Mungkin perlu navigasi kembali
      }
    } catch (e) {
      toast.error("Gagal menghapus sample");
      console.error(e);
    }
  }

  // RENDER
  return (
    <div>
      {/* TOP BAR containing the 3-dot menu on left */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Three-dot menu (left) */}
          <div className="relative">
            <button
              className="px-3 py-2 border rounded bg-white hover:bg-gray-50"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
            >
              {/* vertical dots */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="12" cy="5" r="1.5"></circle>
                <circle cx="12" cy="12" r="1.5"></circle>
                <circle cx="12" cy="19" r="1.5"></circle>
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute left-0 mt-2 w-56 bg-white border rounded shadow z-50">
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowImageModal(true);
                  }}
                >
                  Input Komponen + Gambar
                </button>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600"
                  onClick={handleDeleteSample}
                >
                  Hapus
                </button>
              </div>
            )}
          </div>

          {/* info text */}
          <div className="text-sm text-gray-600">
            Klausul pengujian — isi hasil & keputusan per butir
          </div>
        </div>

        <div className="text-sm text-gray-500">
          {isAutosaving
            ? "Menyimpan otomatis..."
            : Object.keys(dirtyRef.current).length > 0
            ? "Perubahan belum tersimpan"
            : "Semua perubahan tersimpan"}
        </div>
      </div>

      {/* Render HANYA klausul yang ada di localKlausulArr.
        localKlausulArr HANYA berisi klausul aktif (dari prop 'report').
        Ini sudah benar.
      */}
      {localKlausulArr.map((k) => (
        <div
          key={k.klausul}
          id={`clause-${k.klausul}`}
          className="bg-white rounded border mb-6"
        >
          {/* META FORM */}
          <div className="p-4 border-b bg-gray-50">
            <div className="grid grid-cols-12 gap-4 items-center">
              <div className="col-span-4">
                <label className="text-sm text-gray-600 block">
                  Nama Teknisi / Penguji
                </label>
                <input
                  value={(k.meta && k.meta.tester_name) || ""}
                  onChange={(e) =>
                    updateKlausulMeta(k.klausul, {
                      tester_name: e.target.value,
                    })
                  }
                  className="w-full border rounded px-2 py-1"
                  placeholder="Nama teknisi / penguji"
                />
              </div>

              <div className="col-span-3">
                <label className="text-sm text-gray-600 block">
                  Tanggal Uji
                </label>
                <input
                  type="date"
                  value={
                    k.meta && k.meta.test_datetime
                      ? formatDateLocal(k.meta.test_datetime)
                      : ""
                  }
                  onChange={(e) =>
                    updateKlausulMeta(k.klausul, {
                      test_datetime: toIsoFromDateLocal(e.target.value),
                    })
                  }
                  className="w-full border rounded px-2 py-1"
                />
              </div>

              <div className="col-span-2">
                <label className="text-sm text-gray-600 block">Suhu (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={k.meta && (k.meta.temperature ?? "")}
                  onChange={(e) =>
                    updateKlausulMeta(k.klausul, {
                      temperature:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="w-full border rounded px-2 py-1"
                  placeholder="25.0"
                />
              </div>

              <div className="col-span-2">
                <label className="text-sm text-gray-600 block">
                  Kelembaban (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={k.meta && (k.meta.humidity ?? "")}
                  onChange={(e) =>
                    updateKlausulMeta(k.klausul, {
                      humidity:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="w-full border rounded px-2 py-1"
                  placeholder="60"
                />
              </div>
            </div>
          </div>

          {/* header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <div className="text-lg font-semibold">
                {k.klausul} — {k.judul || ""}
              </div>
              <div className="text-xs text-gray-400">
                {k.sub_klausul.reduce((a, b) => a + b.butir.length, 0)} butir
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500 mr-2">Set semua:</div>
              <button
                onClick={() => bulkSetKlausul(k.klausul, "L")}
                className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded text-sm"
              >
                L
              </button>
              <button
                onClick={() => bulkSetKlausul(k.klausul, "TB")}
                className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm"
              >
                TB
              </button>
              <button
                onClick={() => bulkSetKlausul(k.klausul, "G")}
                className="px-3 py-1 bg-red-100 text-red-800 rounded text-sm"
              >
                G
              </button>
            </div>
          </div>

          {/* content */}
          <div>
            {k.sub_klausul.map((s) => (
              <div key={s.kode} className="p-4 border-b last:border-b-0">
                {/* --- Tabel Pengujian (SNI style) — hanya: Syarat-syarat Pengujian | Hasil - Catatan | Keputusan --- */}
                <div className="mt-4">
                  {/* judul sub-klausul sebagai grup header (merge across columns) */}
                  <div className="mb-2 border border-gray-400 rounded-t bg-gray-50">
                    <div className="px-3 py-2 font-semibold text-gray-800">
                      {s.kode} —{" "}
                      <span className="font-medium">{s.judul || ""}</span>
                    </div>
                  </div>

                  <table className="w-full border border-gray-400 border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-gray-800 font-medium">
                        <th className="border border-gray-400 px-3 py-2 text-left">
                          Syarat-syarat Pengujian
                        </th>
                        <th className="border border-gray-400 px-3 py-2 text-center w-64">
                          Hasil - Catatan
                        </th>
                        <th className="border border-gray-400 px-3 py-2 text-center w-56">
                          Keputusan
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {s.butir.map((b, i) => (
                        <tr
                          key={b.kode}
                          className={`align-top transition ${
                            !isButirFilled(b) ? "bg-yellow-50" : "bg-white"
                          } hover:bg-gray-50`}
                        >
                          {/* SYARAT-SYARAT PENGUJIAN (butir teks) */}
                          <td className="border border-gray-400 px-3 py-3 align-top">
                            <div className="text-sm text-gray-800">
                              <div className="font-semibold inline-block mr-2 text-gray-700">
                                {b.kode}
                              </div>
                              <span>{b.teks}</span>
                            </div>
                          </td>

                          {/* HASIL - CATATAN */}
                          <td className="border border-gray-400 px-3 py-3 text-center align-top">
                            {b.hasil_catatan ? (
                              <button
                                onClick={() => setEditingButir(b)}
                                className="w-full text-left px-2 py-1 bg-gray-50 rounded border hover:bg-gray-100 text-sm text-gray-700"
                              >
                                {b.hasil_catatan}
                              </button>
                            ) : (
                              <button
                                onClick={() => setEditingButir(b)}
                                className="mx-auto w-8 h-8 rounded-full flex items-center justify-center border border-gray-300 hover:bg-gray-100"
                                aria-label={`Tambah catatan untuk ${b.kode}`}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="w-4 h-4 text-gray-600"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            )}
                          </td>

                          {/* KEPUTUSAN */}
                          <td className="border border-gray-400 px-3 py-3 text-center align-top">
                            <div className="flex flex-col items-center justify-center gap-1">
                              {/* --- SHOW STRIKETHROUGH IF CORRECTED --- */}
                              {b.is_corrected && b.original_keputusan && (
                                <div
                                  className="text-xs text-red-500 font-bold mb-1"
                                  title={`Originally: ${b.original_keputusan}`}
                                >
                                  <span className="line-through decoration-2">
                                    {b.original_keputusan}
                                  </span>
                                  <span className="text-gray-400 text-[10px] ml-1">
                                    (Rev)
                                  </span>
                                </div>
                              )}
                              {/* --------------------------------------- */}

                              <div className="flex justify-center gap-2">
                                {DECISIONS.map((d) => (
                                  <button
                                    key={d.value}
                                    className={`px-3 py-1 rounded border text-sm font-medium transition ${
                                      d.value === "L"
                                        ? b.keputusan === "L"
                                          ? "bg-emerald-600 text-white border-emerald-600"
                                          : "bg-white text-emerald-600 border-emerald-400"
                                        : d.value === "TB"
                                        ? b.keputusan === "TB"
                                          ? "bg-gray-600 text-white border-gray-600"
                                          : "bg-white text-gray-600 border-gray-400"
                                        : b.keputusan === "G"
                                        ? "bg-red-600 text-white border-red-600"
                                        : "bg-white text-red-600 border-red-400"
                                    } ${
                                      // Add a visual indicator for the active corrected button
                                      b.is_corrected && b.keputusan === d.value
                                        ? "ring-2 ring-offset-1 ring-blue-400"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      updateLocalDecision(
                                        k.klausul,
                                        b.kode,
                                        d.value
                                      )
                                    }
                                  >
                                    {d.label}
                                  </button>
                                ))}
                              </div>

                              {/* Optional: Show who corrected it */}
                              {b.is_corrected && (
                                <span className="text-[9px] text-blue-600">
                                  By: {b.corrected_by}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Table editor for this klausul */}
            <div className="p-4 border-t">
              <TableEditor
                sampleId={sampleId}
                klausulCode={k.klausul}
                tables={k.tables || []}
                onChange={(tables) => updateKlausulTables(k.klausul, tables)}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Images uploader at the end (kept as gallery) */}
      <div className="bg-white rounded border p-4 mt-6">
        <h3 className="text-lg font-semibold mb-2">Galeri Gambar Sampel</h3>
        <ImageUploader
          sampleId={sampleId}
          reportId={reportId}
          images={imagesState}
          onChange={setImages}
        />
      </div>

      {/* Editor modal */}
      {editingButir && (
        <EditorModal
          butir={editingButir}
          onClose={() => setEditingButir(null)}
          onSave={(text) => {
            const butirKode = editingButir.kode;

            // 1. Update the local state
            const next = JSON.parse(JSON.stringify(localKlausulArr));
            let changedClause = null;
            next.forEach((k) => {
              k.sub_klausul.forEach((s) =>
                s.butir.forEach((b) => {
                  if (b.kode === butirKode) {
                    b.hasil_catatan = text;
                    b.last_modified_by = "demo-user"; // TODO: Ganti
                    b.last_modified_at = new Date().toISOString();
                    changedClause = k;
                  }
                })
              );
            });
            setLocalKlausulArr(next);
            // Kirim HANYA klausul yang berubah ke parent
            onChangeReport && onChangeReport([changedClause]);

            // 2. Mark this item as dirty for autosave
            markDirty(butirKode);

            // 3. Close the modal
            setEditingButir(null);
            toast.success("Catatan diperbarui (disimpan otomatis)");
          }}
        />
      )}

      {/* Image modal triggered from menu */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white max-w-3xl w-full rounded shadow p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Input Komponen + Gambar</h3>
              <button
                className="text-sm text-gray-600"
                onClick={() => setShowImageModal(false)}
              >
                Tutup
              </button>
            </div>
            <div className="mb-4 text-sm text-gray-700">
              Unggah gambar komponen atau foto sampel di sini.
            </div>
            <ImageUploader
              sampleId={sampleId}
              reportId={reportId}
              images={imagesState}
              onChange={(imgs) => {
                setImages(imgs);
              }}
            />
            <div className="flex justify-end mt-3">
              <button
                className="px-3 py-1 border rounded mr-2"
                onClick={() => setShowImageModal(false)}
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // helper: bulk set fungsi
  function bulkSetKlausul(klausulCode, value) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    let changedClause = null;
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.sub_klausul.forEach((s) =>
          s.butir.forEach((b) => {
            b.keputusan = value;
            b.last_modified_at = new Date().toISOString();
          })
        );
        changedClause = k;
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport([changedClause]);

    // mark all butir keys as dirty
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.sub_klausul.forEach((s) => s.butir.forEach((b) => markDirty(b.kode)));
      }
    });
  }
}

/* -------------------------
   EditorModal component
   ------------------------- */
function EditorModal({ butir, onClose, onSave }) {
  const [txt, setTxt] = useState(butir.hasil_catatan || "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setTxt(butir.hasil_catatan || ""), [butir]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white max-w-2xl w-full rounded shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">
            Edit Hasil - Catatan ({butir.kode})
          </h3>
          <button
            className="text-sm text-gray-600"
            onClick={() => !saving && onClose()}
          >
            Tutup
          </button>
        </div>
        <div className="text-sm text-gray-700 mb-3">{butir.teks}</div>
        <textarea
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          rows={8}
          className="w-full border p-2 rounded"
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={() => !saving && onClose()}
            className="px-3 py-1 border rounded"
          >
            Batal
          </button>
          <button
            onClick={async () => {
              setSaving(true);
              try {
                onSave(txt);
              } finally {
                setSaving(false);
              }
            }}
            className="px-3 py-1 bg-sky-600 text-white rounded"
            disabled={saving}
          >
            {saving ? <FaSpinner className="animate-spin" /> : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   TableEditor component (inline)
   ------------------------- */
// Ini sudah benar dari perbaikan sebelumnya
function TableEditor({ sampleId, klausulCode, tables = [], onChange }) {
  const [local, setLocal] = useState(() =>
    (tables || []).map((t) => ({ ...t }))
  );
  const [editingIndex, setEditingIndex] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal((tables || []).map((t) => ({ ...t })));
  }, [tables]);

  function setAndNotify(next) {
    setLocal(next);
    onChange && onChange(next);
  }

  function addEmptyTable() {
    const t = {
      id: "tbl-" + Math.random().toString(36).slice(2, 9),
      title: "",
      headers: ["Col 1", "Col 2"],
      rows: [["", ""]],
      notes: "",
    };
    const next = [...local, t];
    setAndNotify(next);
    setEditingIndex(next.length - 1);
  }

  function removeTable(idx) {
    if (!window.confirm("Hapus tabel ini?")) return;
    const next = local.slice();
    next.splice(idx, 1);
    setAndNotify(next);
  }

  function updateCell(tblIdx, rowIdx, colIdx, value) {
    const next = JSON.parse(JSON.stringify(local));
    next[tblIdx].rows[rowIdx][colIdx] = value;
    setAndNotify(next);
  }

  function addRow(tblIdx) {
    const next = JSON.parse(JSON.stringify(local));
    const cols = next[tblIdx].headers.length;
    next[tblIdx].rows.push(new Array(cols).fill(""));
    setAndNotify(next);
  }

  function addColumn(tblIdx) {
    const next = JSON.parse(JSON.stringify(local));
    next[tblIdx].headers.push(`Col ${next[tblIdx].headers.length + 1}`);
    next[tblIdx].rows.forEach((r) => r.push(""));
    setAndNotify(next);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">Lampiran Tabel</h4>
        <div className="flex gap-2">
          <button onClick={addEmptyTable} className="px-2 py-1 border rounded">
            Tambah Tabel
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {local.map((t, ti) => (
          <div key={t.id} className="border rounded p-3 bg-white">
            <div className="flex justify-between items-start">
              <input
                value={t.title}
                onChange={(e) => {
                  const n = JSON.parse(JSON.stringify(local));
                  n[ti].title = e.target.value;
                  setAndNotify(n);
                }}
                placeholder="Judul Tabel"
                className="w-2/3 border px-2 py-1 rounded"
              />
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setEditingIndex(editingIndex === ti ? null : ti)
                  }
                  className="px-2 py-1 border rounded"
                >
                  {editingIndex === ti ? "Selesai" : "Edit"}
                </button>
                <button
                  onClick={() => removeTable(ti)}
                  className="px-2 py-1 border rounded text-red-600"
                >
                  Hapus
                </button>
              </div>
            </div>

            <div className="overflow-auto mt-3">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    {t.headers.map((h, hi) => (
                      <th key={hi} className="border px-2 py-1 text-left">
                        {editingIndex === ti ? (
                          <input
                            value={h}
                            onChange={(e) => {
                              const n = JSON.parse(JSON.stringify(local));
                              n[ti].headers[hi] = e.target.value;
                              setAndNotify(n);
                            }}
                            className="px-1 py-0.5 border rounded"
                          />
                        ) : (
                          h
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r, ri) => (
                    <tr key={ri}>
                      {r.map((cell, ci) => (
                        <td key={ci} className="border px-2 py-1">
                          {editingIndex === ti ? (
                            <input
                              value={cell}
                              onChange={(e) =>
                                updateCell(ti, ri, ci, e.target.value)
                              }
                              className="w-full px-1 py-0.5 border rounded"
                            />
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editingIndex === ti && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => addRow(ti)}
                  className="px-2 py-1 border rounded"
                >
                  Tambah Baris
                </button>
                <button
                  onClick={() => addColumn(ti)}
                  className="px-2 py-1 border rounded"
                >
                  Tambah Kolom
                </button>
              </div>
            )}

            <textarea
              value={t.notes || ""}
              onChange={(e) => {
                const n = JSON.parse(JSON.stringify(local));
                n[ti].notes = e.target.value;
                setAndNotify(n);
              }}
              placeholder="Catatan (opsional)"
              className="w-full mt-2 border rounded p-2"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------
   ImageUploader component (inline)
   ------------------------- */
// Ini sudah benar dari perbaikan sebelumnya
function ImageUploader({ sampleId, images = [], onChange, reportId }) {
  // <-- ADD reportId
  const [localImgs, setLocalImgs] = useState(images || []);
  const [uploading, setUploading] = useState(false);

  useEffect(() => setLocalImgs(images || []), [images]);

  async function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    // ... (file type/size checks) ...

    setUploading(true);

    // Use FormData to send the file
    const formData = new FormData();
    formData.append("image", f); // 'image' must match router

    try {
      // Call the new backend endpoint
      const res = await apiClient.post(
        `/uploads/report-image/${reportId}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      // res.data is the new ReportImage object
      const newImage = res.data;
      const next = [...localImgs, newImage];
      setLocalImgs(next);
      onChange && onChange(next); // Update parent
      toast.success("Gambar berhasil diunggah");
    } catch (err) {
      toast.error("Gagal upload gambar");
      console.error(err);
    } finally {
      setUploading(false);
    }

    e.target.value = ""; // Clear file input
  }

  async function removeImage(img) {
    if (!window.confirm("Hapus gambar ini?")) return;

    try {
      // Call the new DELETE endpoint
      await apiClient.delete(`/uploads/image/${img.id}`);

      const next = localImgs.filter((i) => i.id !== img.id);
      setLocalImgs(next);
      onChange && onChange(next); // Update parent
      toast.success("Gambar dihapus");
    } catch (e) {
      toast.error("Gagal menghapus gambar");
      console.error(e);
      return;
    }
  }

  function updateCaption(imgId, caption) {
    const next = localImgs.map((i) => (i.id === imgId ? { ...i, caption } : i));
    setLocalImgs(next);
    onChange && onChange(next);
  }

  return (
    <div>
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
        <div className="text-sm text-gray-500">{localImgs.length} gambar</div>
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

/* -------------------------
   Helper functions: date-only
   ------------------------- */
function formatDateLocal(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function toIsoFromDateLocal(dateValue) {
  if (!dateValue) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return dateValue;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
