// src/components/KlausulButirTable.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "../mocks/api";
import toast from "react-hot-toast";
import { FaSpinner } from "react-icons/fa";

/**
 * KlausulButirTable.jsx
 * - Per-klausul meta (tester, tanggal, suhu, kelembaban)
 * - Per-klausul tables (CRUD table lampiran)
 * - Images uploader (sample gallery) — displayed at bottom
 * - Autosave (butir/meta/tables/images) + parent registration
 *
 * Note: ensure src/mocks/api.js exposes:
 * - updateButir(sampleId, klausulCode, butirKode, payload)
 * - bulkUpdate(sampleId, updates)
 * - updateKlausulMeta(sampleId, klausulCode, meta)
 * - saveKlausulTables(sampleId, klausulCode, tables)
 * - uploadImage(sampleId, file)
 * - deleteImage(sampleId, imageId)
 * - updateImages(sampleId, images)  (optional, used to persist image metadata)
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
}) {
  const [localKlausulArr, setLocalKlausulArr] = useState(report.klausul || []);
  const [editingButir, setEditingButir] = useState(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [imagesState, setImagesState] = useState(report.images || []);

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

  // init local state and persisted snapshot
  useEffect(() => {
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
    setImagesState(report.images || []);

    // persisted snapshot
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
    map["images"] = JSON.stringify(report.images || []);
    persistedRef.current = map;
    dirtyRef.current = {};
  }, [report]);

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
              b.keputusan = decision;
              b.last_modified_by = "demo-user";
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
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.meta = { ...(k.meta || {}), ...changes };
        k.last_meta_modified_at = new Date().toISOString();
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport(next);
    markDirty(`meta-${klausulCode}`);
  }

  function updateKlausulTables(klausulCode, tables) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.tables = tables;
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport(next);
    markDirty(`tables-${klausulCode}`);
  }

  // images handlers: ImageUploader will upload/delete via api; here we just update state & mark dirty
  function setImages(images) {
    setImagesState(images);
    // mark dirty to ensure flush will persist images metadata if API supports it
    markDirty("images");
    // propagate up optionally (report object)
    onChangeReport &&
      onChangeReport((prev) => {
        // if onChangeReport expects array, provide new klausul arr; else caller can pick from state
        // We'll call onChangeReport with new klausul arr where images not included; parent ReportEditor stores images separately
        return prev;
      });
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

  // save note (defensive)
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

    if (!sampleId) {
      console.error("saveNote: sampleId missing", {
        klausulCode,
        butirKode,
        text,
      });
      toast.error("Gagal menyimpan catatan: sample tidak ditemukan");
      return { ok: false, error: "missing_sample" };
    }

    const key = `${klausulCode || "unknown"}-${butirKode}`;
    // optimistic update
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    next.forEach((k) => {
      if (k.klausul === (klausulCode || k.klausul)) {
        k.sub_klausul.forEach((s) =>
          s.butir.forEach((b) => {
            if (b.kode === butirKode) {
              b.hasil_catatan = text;
              b.last_modified_by = "demo-user";
              b.last_modified_at = new Date().toISOString();
            }
          })
        );
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport(next);

    try {
      setIsAutosaving(true);
      setTimeout(() => {}, 0);
      const res = await api.updateButir(sampleId, klausulCode, butirKode, {
        hasil_catatan: text,
        by: "demo-user",
      });
      if (res && res.ok === false) throw res.error || new Error("API error");
      // clear dirty for this butir
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

  // bulkSet only local (mark all butir dirty)
  function bulkSetKlausul(klausulCode, decision, { clearNotes = false } = {}) {
    const next = JSON.parse(JSON.stringify(localKlausulArr));
    next.forEach((k) => {
      if (k.klausul === klausulCode) {
        k.sub_klausul.forEach((s) =>
          s.butir.forEach((b) => {
            b.keputusan = decision;
            if (clearNotes) b.hasil_catatan = "";
            b.last_modified_by = "demo-user";
            b.last_modified_at = new Date().toISOString();
            // mark dirty
            dirtyRef.current = { ...dirtyRef.current, [b.kode]: true };
          })
        );
      }
    });
    setLocalKlausulArr(next);
    onChangeReport && onChangeReport(next);
  }

  // build dirty updates separated
  function buildDirtyUpdates() {
    const dirtyKeys = Object.keys(dirtyRef.current || {});
    const butirKeys = dirtyKeys.filter(
      (k) =>
        !k.startsWith("meta-") && !k.startsWith("tables-") && k !== "images"
    );
    const metaKeys = dirtyKeys.filter((k) => k.startsWith("meta-"));
    const tableKeys = dirtyKeys.filter((k) => k.startsWith("tables-"));
    const imagesDirty = dirtyKeys.includes("images");

    const butirUpdates = butirKeys.map((kode) => {
      const { keputusan, hasil_catatan } = findButirValue(kode);
      let klausulCode = null;
      outer: for (const k of localKlausulArr)
        for (const s of k.sub_klausul)
          for (const b of s.butir)
            if (b.kode === kode) {
              klausulCode = k.klausul;
              break outer;
            }
      return {
        klausulCode,
        butirKode: kode,
        keputusan,
        hasil_catatan: hasil_catatan || "",
      };
    });

    const metaUpdates = metaKeys.map((mk) => {
      const klausulCode = mk.replace("meta-", "");
      const kObj = localKlausulArr.find((x) => x.klausul === klausulCode);
      return { klausulCode, meta: kObj ? { ...(kObj.meta || {}) } : {} };
    });

    const tableUpdates = tableKeys.map((tk) => {
      const klausulCode = tk.replace("tables-", "");
      const kObj = localKlausulArr.find((x) => x.klausul === klausulCode);
      return { klausulCode, tables: kObj ? kObj.tables || [] : [] };
    });

    return { butirUpdates, metaUpdates, tableUpdates, imagesDirty };
  }

  // flush: send butirUpdates, metaUpdates, tableUpdates, images (if dirty)
  const flushAutosave = useCallback(async () => {
    const { butirUpdates, metaUpdates, tableUpdates, imagesDirty } =
      buildDirtyUpdates();
    if (
      (!butirUpdates || butirUpdates.length === 0) &&
      (!metaUpdates || metaUpdates.length === 0) &&
      (!tableUpdates || tableUpdates.length === 0) &&
      !imagesDirty
    ) {
      toast("Tidak ada perubahan untuk disimpan");
      return { ok: true, count: 0 };
    }
    setIsAutosaving(true);
    try {
      let total = 0;
      if (butirUpdates && butirUpdates.length > 0) {
        await api.bulkUpdate(sampleId, butirUpdates);
        const copy = { ...dirtyRef.current };
        butirUpdates.forEach((u) => {
          delete copy[u.butirKode];
          persistedRef.current[u.butirKode] = {
            keputusan: u.keputusan,
            hasil_catatan: u.hasil_catatan,
          };
        });
        dirtyRef.current = copy;
        total += butirUpdates.length;
      }

      if (metaUpdates && metaUpdates.length > 0) {
        for (const m of metaUpdates) {
          await api.updateKlausulMeta(sampleId, m.klausulCode, m.meta);
          const copy = { ...dirtyRef.current };
          delete copy[`meta-${m.klausulCode}`];
          dirtyRef.current = copy;
          persistedRef.current[`meta-${m.klausulCode}`] = { ...(m.meta || {}) };
          total++;
        }
      }

      if (tableUpdates && tableUpdates.length > 0) {
        for (const t of tableUpdates) {
          await api.saveKlausulTables(sampleId, t.klausulCode, t.tables);
          const copy = { ...dirtyRef.current };
          delete copy[`tables-${t.klausulCode}`];
          dirtyRef.current = copy;
          persistedRef.current[`tables-${t.klausulCode}`] = JSON.stringify(
            t.tables || []
          );
          total++;
        }
      }

      if (imagesDirty) {
        // optional: persist images metadata (API must implement updateImages)
        try {
          await api.updateImages(sampleId, imagesState || []);
        } catch (e) {
          // if not implemented, ignore or log
          console.warn("updateImages not available or failed:", e);
        }
        const copy = { ...dirtyRef.current };
        delete copy["images"];
        dirtyRef.current = copy;
        persistedRef.current["images"] = JSON.stringify(imagesState || []);
        total++;
      }

      toast.success("Perubahan berhasil disimpan");
      return { ok: true, count: total };
    } catch (e) {
      toast.error("Gagal menyimpan perubahan");
      console.error("flushAutosave error", e);
      return { ok: false, error: e };
    } finally {
      setIsAutosaving(false);
    }
  }, [sampleId, localKlausulArr, imagesState]);

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

  // RENDER
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          {Object.keys(dirtyRef.current).length > 0 ? (
            <span className="text-sm text-yellow-700">
              Perubahan belum tersimpan (otomatis menyimpan setiap 30s)
            </span>
          ) : (
            <span className="text-sm text-gray-500">
              Semua perubahan tersimpan
            </span>
          )}
        </div>
        <div className="text-sm text-gray-400">
          {isAutosaving ? "Menyimpan otomatis..." : ""}
        </div>
      </div>

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

              <div className="col-span-3">
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
                {/* --- Tabel Pengujian SNI Style --- */}
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
                                  }`}
                                  onClick={() =>
                                    updateLocalDecision(
                                      k.klausul,
                                      b.kode,
                                      d.value
                                    )
                                  }
                                  aria-label={`Set keputusan ${d.value} untuk ${b.kode}`}
                                >
                                  {d.label}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* opsional: footer kecil untuk tiap sub-klausul */}
                  <div className="mt-1 text-xs text-gray-500 italic px-2">
                    Klik judul butir untuk menambah atau mengubah catatan.
                  </div>
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

      {/* Images uploader at the end */}
      <div className="bg-white rounded border p-4">
        <h3 className="text-lg font-semibold mb-2">Galeri Gambar Sampel</h3>
        <ImageUploader
          sampleId={sampleId}
          images={imagesState}
          onChange={setImages}
        />
      </div>

      {/* Editor modal */}
      {editingButir && (
        <EditorModal
          butir={editingButir}
          onClose={() => setEditingButir(null)}
          onSave={async (text) => {
            // find klausul code for butir
            let klausulCode = null;
            for (const k of localKlausulArr) {
              for (const s of k.sub_klausul) {
                if (s.butir.some((b) => b.kode === editingButir.kode)) {
                  klausulCode = k.klausul;
                  break;
                }
              }
              if (klausulCode) break;
            }
            const res = await saveNote(klausulCode, editingButir.kode, text);
            if (res && res.ok) setEditingButir(null);
            // else keep modal open
          }}
        />
      )}
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
                await onSave(txt);
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

  async function saveAll() {
    setSaving(true);
    try {
      await api.saveKlausulTables(sampleId, klausulCode, local);
      toast.success("Tabel disimpan");
    } catch (e) {
      toast.error("Gagal menyimpan tabel");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">Lampiran Tabel</h4>
        <div className="flex gap-2">
          <button onClick={addEmptyTable} className="px-2 py-1 border rounded">
            Tambah Tabel
          </button>
          <button
            onClick={saveAll}
            className="px-3 py-1 bg-blue-600 text-white rounded"
            disabled={saving}
          >
            {saving ? "Menyimpan..." : "Simpan Tabel"}
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
function ImageUploader({ sampleId, images = [], onChange }) {
  const [localImgs, setLocalImgs] = useState(images || []);
  const [uploading, setUploading] = useState(false);

  useEffect(() => setLocalImgs(images || []), [images]);

  async function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Hanya gambar yang diperbolehkan");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Ukuran maksimal 10MB");
      return;
    }

    // optimistic preview
    const reader = new FileReader();
    reader.onload = async () => {
      const previewUrl = reader.result;
      const temp = {
        id: "tmp-" + Math.random().toString(36).slice(2, 9),
        url: previewUrl,
        caption: "",
      };
      const withTemp = [...localImgs, temp];
      setLocalImgs(withTemp);
      onChange && onChange(withTemp);
      setUploading(true);
      try {
        const res = await api.uploadImage(sampleId, f);
        if (res && res.ok) {
          const replaced = withTemp.map((im) =>
            im.id === temp.id ? { id: res.id, url: res.url, caption: "" } : im
          );
          setLocalImgs(replaced);
          onChange && onChange(replaced);
          toast.success("Gambar berhasil diunggah");
        } else {
          throw new Error("upload failed");
        }
      } catch (err) {
        toast.error("Gagal upload gambar");
        setLocalImgs((prev) => prev.filter((i) => i.id !== temp.id));
        onChange && onChange(localImgs.filter((i) => i.id !== temp.id));
        console.error(err);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  async function removeImage(img) {
    if (!window.confirm("Hapus gambar ini?")) return;
    try {
      if (img.id && !String(img.id).startsWith("tmp-")) {
        const res = await api.deleteImage(sampleId, img.id);
        if (!res || !res.ok) throw new Error("delete failed");
      }
    } catch (e) {
      toast.error("Gagal menghapus gambar");
      console.error(e);
      return;
    }
    const next = localImgs.filter((i) => i.id !== img.id);
    setLocalImgs(next);
    onChange && onChange(next);
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
