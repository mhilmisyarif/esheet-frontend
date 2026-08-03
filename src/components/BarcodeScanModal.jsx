// src/components/BarcodeScanModal.jsx
//
// Camera barcode scanner for physical sample labels (order_no barcodes,
// e.g. CBT/3801/20-104-04/00132/06/2026-01).
//
// Uses the native BarcodeDetector API (Chrome/Edge/Android — no library
// needed). On browsers without it (iOS Safari), falls back to manual code
// entry. Resolved codes hit GET /api/samples/lookup and navigate to the
// datasheet detail.
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiX, FiCamera, FiSearch, FiPlus, FiRotateCw } from "react-icons/fi";
import apiClient from "../api";
import { parseOrderNo } from "../utils/orderParser";

const SUPPORTED_FORMATS = [
  "qr_code",
  "code_128",
  "code_39",
  "ean_13",
  "data_matrix",
];

export default function BarcodeScanModal({ open, onClose }) {
  const [supported, setSupported] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [busy, setBusy] = useState(false);
  // Scanned code with no existing datasheet → offer to create one
  const [notFound, setNotFound] = useState(null);
  // Bumping this restarts the camera effect (used by "Scan Ulang")
  const [session, setSession] = useState(0);
  // Lab list (lab_code → name) for the parsed-code breakdown display
  const [labs, setLabs] = useState([]);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const resolvedRef = useRef(false);
  const navigate = useNavigate();

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
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
          // scanned order number prefilled (keep resolvedRef=true so the
          // detect loop stays halted while the prompt is on screen).
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
      .catch(() => {}); // breakdown falls back to the raw lab code
  }, [open, labs.length]);

  // Start camera + detection loop when opened (session bump = rescan)
  useEffect(() => {
    if (!open) return;
    resolvedRef.current = false;
    setManualCode("");
    setNotFound(null);

    if (!("BarcodeDetector" in window)) {
      setSupported(true);
      return;
    }
    setSupported(true);

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setScanning(true);

        const detector = new window.BarcodeDetector({
          formats: SUPPORTED_FORMATS,
        });
        const tick = async () => {
          if (cancelled || resolvedRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0].rawValue) {
              resolveCode(codes[0].rawValue);
              return;
            }
          } catch {
            /* frame not ready — keep looping */
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // Camera denied/unavailable → manual entry still works
        setSupported(false);
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, session, resolveCode, stopCamera]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(7,25,63,0.6)] p-4"
      onClick={() => {
        stopCamera();
        onClose();
      }}
    >
      <div
        className="bg-paper rounded-3xl shadow-modal w-full max-w-[420px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
          <span className="flex items-center gap-2 text-[15px] font-semibold text-navy-900">
            <FiCamera size={17} /> Scan Barcode Sampel
          </span>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-ink-500 hover:bg-navy-50"
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
            <div className="font-mono text-[12px] text-ink-500 mt-1.5 break-all px-2">
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
                className="inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-navy-800 text-white text-sm font-semibold hover:bg-navy-700"
              >
                <FiPlus size={16} /> Buat Datasheet Baru
              </button>
              <button
                onClick={() => {
                  resolvedRef.current = false;
                  setNotFound(null);
                  setSession((s) => s + 1);
                }}
                className="inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-paper border border-line text-navy-800 text-sm font-semibold hover:bg-navy-50"
              >
                <FiRotateCw size={15} /> Scan Ulang
              </button>
            </div>
          </div>
        ) : supported ? (
          <div className="relative bg-black aspect-[4/3]">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Aim frame */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[75%] h-[75%] border-2 border-white/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            <div className="absolute bottom-3 inset-x-0 text-center text-white/85 text-[12.5px]">
              {busy
                ? "Mencari sampel…"
                : scanning
                  ? "Arahkan kamera ke barcode pada label sampel"
                  : "Menyalakan kamera…"}
            </div>
          </div>
        ) : (
          <div className="px-5 py-6 text-[13px] text-ink-500 bg-navy-50/50">
            Kamera / pemindai barcode tidak tersedia di browser ini. Masukkan
            nomor sampel secara manual di bawah.
          </div>
        )}

        {/* Manual fallback — hidden while the not-found prompt is shown */}
        {!notFound && (
          <form
            className="flex gap-2 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) resolveCode(manualCode.trim());
            }}
          >
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="CBT/3801/20-104-04/…"
              className="flex-1 px-3.5 py-2.5 border border-line rounded-xl font-mono text-[13px] text-navy-800 outline-none focus:border-navy-600 focus:ring-[3px] focus:ring-navy-600/10 placeholder:text-ink-300 placeholder:font-sans"
            />
            <button
              type="submit"
              disabled={busy || !manualCode.trim()}
              className="inline-flex items-center gap-1.5 px-4 rounded-xl bg-navy-800 text-white text-[13px] font-semibold disabled:opacity-50"
            >
              <FiSearch size={15} /> Cari
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
