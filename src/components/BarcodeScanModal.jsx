// src/components/BarcodeScanModal.jsx
//
// Camera barcode scanner for physical sample labels (order_no barcodes,
// e.g. CBT/3801/20-104-04/00132/06/2026-01).
//
// Automatically requests browser camera permission on open and streams live video.
// Decodes Barcodes (Code 128, Code 39, EAN, etc.) and QR Codes using @zxing/browser.
// Resolved codes hit GET /api/samples/lookup and navigate to the datasheet detail.
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiX,
  FiCamera,
  FiSearch,
  FiPlus,
  FiRotateCw,
  FiAlertCircle,
} from "react-icons/fi";
import { BrowserMultiFormatReader } from "@zxing/browser";
import apiClient from "../api";
import { parseOrderNo } from "../utils/orderParser";

export default function BarcodeScanModal({ open, onClose }) {
  // 'loading' | 'active' | 'denied' | 'unsupported' | 'error'
  const [cameraState, setCameraState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [busy, setBusy] = useState(false);
  // Scanned code with no existing datasheet → offer to create one
  const [notFound, setNotFound] = useState(null);
  // Bumping this restarts the camera effect (used by "Scan Ulang")
  const [session, setSession] = useState(0);
  // Lab list (lab_code → name) for the parsed-code breakdown display
  const [labs, setLabs] = useState([]);
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const resolvedRef = useRef(false);
  const navigate = useNavigate();

  const stopCamera = useCallback(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {}
      controlsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      } catch {}
    }
  }, []);

  const resolveCode = useCallback(
    async (code) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      setBusy(true);
      try {
        const res = await apiClient.get(
          `/samples/lookup?code=${encodeURIComponent(code)}`,
        );
        const items = res.data.items || [];
        if (items.length === 0) {
          // No datasheet for this code yet → offer to create one with the
          // scanned order number prefilled
          stopCamera();
          setNotFound(code);
          return;
        }
        stopCamera();
        onClose();
        toast.success(`Sampel ditemukan: ${items[0].name}`);
        navigate(`/datasheet/${items[0].id}`);
      } catch {
        toast.error("Gagal mencari sampel. Coba lagi.");
        resolvedRef.current = false;
      } finally {
        setBusy(false);
      }
    },
    [navigate, onClose, stopCamera],
  );

  // Lab names for the breakdown display — fetched once per modal open
  useEffect(() => {
    if (!open || labs.length > 0) return;
    apiClient
      .get("/labs")
      .then((res) => setLabs(res.data || []))
      .catch(() => {});
  }, [open, labs.length]);

  // Start camera + detection loop when opened (session bump = rescan)
  useEffect(() => {
    if (!open) return;
    resolvedRef.current = false;
    setManualCode("");
    setNotFound(null);
    setCameraState("loading");
    setErrorMessage("");

    let cancelled = false;

    const startScanner = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState("unsupported");
        setErrorMessage(
          "Browser ini tidak mendukung akses kamera atau situs belum berjalan di koneksi aman (HTTPS / localhost).",
        );
        return;
      }

      const codeReader = new BrowserMultiFormatReader();

      try {
        let controls;
        try {
          // Request rear camera on mobile / tablet
          controls = await codeReader.decodeFromConstraints(
            { video: { facingMode: { ideal: "environment" } }, audio: false },
            videoRef.current,
            (result) => {
              if (cancelled || resolvedRef.current) return;
              if (result && result.getText()) {
                resolveCode(result.getText());
              }
            },
          );
        } catch (constraintErr) {
          // Fallback to any default camera (e.g. laptop webcam)
          controls = await codeReader.decodeFromConstraints(
            { video: true, audio: false },
            videoRef.current,
            (result) => {
              if (cancelled || resolvedRef.current) return;
              if (result && result.getText()) {
                resolveCode(result.getText());
              }
            },
          );
        }

        if (cancelled) {
          if (controls) controls.stop();
          return;
        }

        controlsRef.current = controls;
        setCameraState("active");
      } catch (err) {
        if (cancelled) return;
        console.warn("Camera access failed:", err);
        const name = err.name || "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setCameraState("denied");
          setErrorMessage(
            "Izin kamera belum diberikan atau diblokir. Silakan klik ikon gembok / kamera pada address bar browser Anda untuk mengizinkan akses kamera.",
          );
        } else if (
          name === "NotFoundError" ||
          name === "DevicesNotFoundError"
        ) {
          setCameraState("error");
          setErrorMessage(
            "Tidak ditemukan perangkat kamera yang terhubung pada gadget/laptop ini.",
          );
        } else if (
          name === "NotReadableError" ||
          name === "TrackStartError"
        ) {
          setCameraState("error");
          setErrorMessage(
            "Kamera sedang digunakan oleh aplikasi lain. Silakan tutup aplikasi tersebut lalu coba lagi.",
          );
        } else {
          setCameraState("error");
          setErrorMessage(
            "Gagal mengakses kamera: " +
              (err.message || "Pastikan browser mengizinkan kamera."),
          );
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, session, resolveCode, stopCamera]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(7,25,63,0.65)] p-4 backdrop-blur-xs"
      onClick={() => {
        stopCamera();
        onClose();
      }}
    >
      <div
        className="bg-paper rounded-3xl shadow-modal w-full max-w-[430px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
          <span className="flex items-center gap-2 text-[15px] font-semibold text-navy-900">
            <FiCamera size={18} className="text-navy-700" /> Scan Barcode
            Sampel
          </span>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Tutup pemindai"
            className="w-9 h-9 rounded-full flex items-center justify-center text-ink-500 hover:bg-navy-50 transition-colors"
          >
            <FiX size={19} />
          </button>
        </div>

        {notFound ? (
          /* Scanned code has no datasheet yet — offer to create one */
          <div className="px-5 py-6 text-center bg-navy-50/50">
            <div className="text-4xl mb-2">🗂️</div>
            <div className="text-[15px] font-semibold text-navy-900">
              Belum ada datasheet untuk kode ini
            </div>
            <div className="font-mono text-[12px] text-ink-500 mt-1.5 break-all px-2 font-bold">
              {notFound}
            </div>

            {/* Auto-detected breakdown of the scanned order number */}
            {(() => {
              const p = parseOrderNo(notFound);
              if (!p) return null;
              const lab = labs.find((l) => l.lab_code === p.labCode);
              const rows = [
                ["Lab Tujuan", lab ? lab.name : `Kode ${p.labCode}`],
                ["No. Lab", p.labNoShort],
                ["Bulan Order", `${p.monthName} (${p.month})`],
                ["Tahun", p.year],
                ["Sampel ke-", p.sampleSeq],
              ];
              return (
                <div className="mt-4 mx-auto max-w-[300px] bg-paper border border-line rounded-xl overflow-hidden text-left">
                  {rows.map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 px-3.5 py-2 border-b border-line-soft last:border-b-0"
                    >
                      <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-[0.05em]">
                        {label}
                      </span>
                      <span className="text-[13px] font-semibold text-navy-800 text-right">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="flex flex-col gap-2 mt-5">
              <button
                onClick={() => {
                  onClose();
                  navigate(
                    `/create-report?order_no=${encodeURIComponent(notFound)}`,
                  );
                }}
                className="inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-navy-800 text-white text-sm font-semibold hover:bg-navy-700 transition-colors"
              >
                <FiPlus size={16} /> Buat Datasheet Baru
              </button>
              <button
                onClick={() => {
                  resolvedRef.current = false;
                  setNotFound(null);
                  setSession((s) => s + 1);
                }}
                className="inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-paper border border-line text-navy-800 text-sm font-semibold hover:bg-navy-50 transition-colors"
              >
                <FiRotateCw size={15} /> Scan Ulang
              </button>
            </div>
          </div>
        ) : cameraState === "active" || cameraState === "loading" ? (
          /* Active Camera / Loading Permission View */
          <div className="relative bg-black aspect-[4/3] overflow-hidden flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />

            {/* Target Reticle / Aim Frame */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[74%] h-[74%] border-2 border-white/85 rounded-2xl shadow-[0_0_0_9999px_rgba(7,25,63,0.45)] relative overflow-hidden">
                {cameraState === "active" && (
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse" />
                )}
              </div>
            </div>

            {/* Status / Instructions Overlay */}
            <div className="absolute bottom-3 inset-x-0 text-center text-white/95 text-[12.5px] px-3 font-medium drop-shadow-md">
              {busy
                ? "Mencari sampel…"
                : cameraState === "active"
                  ? "Arahkan kamera ke barcode / QR code pada label sampel"
                  : "Menyalakan kamera, silakan izinkan di browser…"}
            </div>
          </div>
        ) : (
          /* Permission Denied or Error State */
          <div className="px-6 py-8 text-center bg-navy-50/50">
            <div className="w-13 h-13 mx-auto mb-3.5 rounded-2xl bg-warn-bg text-warn-fg flex items-center justify-center shadow-xs">
              <FiAlertCircle size={28} />
            </div>
            <div className="text-[15px] font-semibold text-navy-900 mb-1.5">
              {cameraState === "denied"
                ? "Izin Akses Kamera Diperlukan"
                : "Kamera Tidak Dapat Digunakan"}
            </div>
            <p className="text-[13px] text-ink-500 mb-5 max-w-[320px] mx-auto leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={() => setSession((s) => s + 1)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-navy-800 text-white text-[13px] font-semibold hover:bg-navy-700 transition-colors"
            >
              <FiRotateCw size={15} /> Coba Izinkan Ulang
            </button>
          </div>
        )}

        {/* Manual Input Fallback */}
        {!notFound && (
          <form
            className="flex gap-2 p-4 border-t border-line-soft bg-paper"
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) resolveCode(manualCode.trim());
            }}
          >
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Atau ketik manual nomor order / sampel…"
              className="flex-1 px-3.5 py-2.5 border border-line rounded-xl font-mono text-[13px] text-navy-800 outline-none focus:border-navy-600 focus:ring-[3px] focus:ring-navy-600/10 placeholder:text-ink-400 placeholder:font-sans"
            />
            <button
              type="submit"
              disabled={busy || !manualCode.trim()}
              className="inline-flex items-center gap-1.5 px-4 rounded-xl bg-navy-800 text-white text-[13px] font-semibold hover:bg-navy-700 disabled:opacity-50 transition-colors shrink-0"
            >
              <FiSearch size={15} /> Cari
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
