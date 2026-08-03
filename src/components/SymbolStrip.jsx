// src/components/SymbolStrip.jsx
//
// Insert-symbol toolbar for the klausul editor. Click a symbol while a
// catatan <textarea> is focused and it is inserted at the cursor.
//
// Uses document.execCommand('insertText') — it fires a native input event,
// so React controlled textareas pick the change up through their normal
// onChange (autosave/dirty tracking untouched). Buttons prevent focus steal
// via onPointerDown preventDefault.
import { useState } from "react";
import toast from "react-hot-toast";
import { FiChevronDown } from "react-icons/fi";

// Symbols grouped for lab use. All glyphs exist in Segoe UI Symbol —
// the font embedded in the datasheet PDF — so they print correctly.
const GROUPS = [
  {
    label: "Listrik",
    symbols: [
      ["Ω", "Ohm"],
      ["µ", "Mikro"],
      ["⏚", "Pembumian"],
      ["⎓", "DC"],
      ["⏦", "AC"],
      ["⧈", "Kelas II"],
      ["◇Ⅲ", "Kelas III"],
      ["°", "Derajat"],
      ["℃", "Celsius"],
    ],
  },
  {
    label: "Matematika",
    symbols: [
      ["±", "Plus-minus"],
      ["×", "Kali"],
      ["÷", "Bagi"],
      ["≤", "Kurang sama"],
      ["≥", "Lebih sama"],
      ["≈", "Kira-kira"],
      ["≠", "Tidak sama"],
      ["√", "Akar"],
      ["²", "Pangkat 2"],
      ["³", "Pangkat 3"],
      ["‰", "Permil"],
      ["Δ", "Delta"],
      ["π", "Pi"],
      ["φ", "Phi"],
    ],
  },
  {
    label: "Pecahan",
    symbols: [
      ["½", "Setengah"],
      ["⅓", "Sepertiga"],
      ["¼", "Seperempat"],
      ["¾", "Tiga perempat"],
      ["⅔", "Dua pertiga"],
      ["⅛", "Seperdelapan"],
    ],
  },
];

const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const SUB = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
const toSup = (s) => [...String(s)].map((c) => SUP[c] ?? c).join("");
const toSub = (s) => [...String(s)].map((c) => SUB[c] ?? c).join("");

function insertIntoActiveTextarea(text) {
  const el = document.activeElement;
  if (!el || el.tagName !== "TEXTAREA" || el.readOnly || el.disabled) {
    toast("Klik dulu kolom catatan yang ingin diisi, lalu pilih simbol.", {
      icon: "ℹ️",
    });
    return;
  }
  el.focus();
  document.execCommand("insertText", false, text);
}

export default function SymbolStrip() {
  const [open, setOpen] = useState(false);

  const buildFraction = () => {
    const raw = window.prompt("Pecahan (format a/b, contoh 3/16):", "");
    if (!raw) return;
    const m = raw.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m) {
      toast.error("Format pecahan harus a/b, contoh 3/16");
      return;
    }
    insertIntoActiveTextarea(`${toSup(m[1])}⁄${toSub(m[2])}`);
  };

  return (
    <div className="border-b border-line-soft bg-canvas/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 nav:px-5 py-2 text-[12px] font-semibold text-ink-500 hover:text-navy-800"
      >
        <span>
          Simbol & Pecahan{" "}
          <span className="font-normal text-ink-400">
            — Ω ⏚ ⧈ ½ … untuk kolom catatan
          </span>
        </span>
        <FiChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-4 nav:px-5 pb-3 flex flex-col gap-2">
          {GROUPS.map((g) => (
            <div key={g.label} className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-[0.06em] w-[86px] shrink-0">
                {g.label}
              </span>
              {g.symbols.map(([sym, title]) => (
                <button
                  key={sym}
                  type="button"
                  title={title}
                  // preventDefault keeps focus on the textarea being edited
                  onPointerDown={(e) => e.preventDefault()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertIntoActiveTextarea(sym)}
                  className="min-w-9 h-9 px-2 rounded-lg bg-paper border border-line text-[15px] text-navy-800 hover:bg-navy-50 hover:border-navy-200 active:bg-navy-100"
                >
                  {sym}
                </button>
              ))}
              {g.label === "Pecahan" && (
                <button
                  type="button"
                  title="Pecahan bebas a/b"
                  onPointerDown={(e) => e.preventDefault()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={buildFraction}
                  className="h-9 px-3 rounded-lg bg-paper border border-dashed border-navy-300 text-[12px] font-semibold text-navy-700 hover:bg-navy-50"
                >
                  a⁄b …
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
