import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiSearch,
  FiPlus,
  FiCamera,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiMoreHorizontal,
  FiFileText,
  FiDownload,
  FiTrash2,
} from "react-icons/fi";
import apiClient from "../api";
import BarcodeScanModal from "../components/BarcodeScanModal";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Maps the filter label shown in the UI to the backend ReportStatus value.
const STATUS_FILTERS = {
  All: null,
  Draft: "DRAFT",
  Review: "IN_PROGRESS",
  Approved: "APPROVED",
};

const STATUS_META = {
  DRAFT: { label: "Draft", cls: "bg-neutral-bg text-neutral-fg" },
  IN_PROGRESS: { label: "Review", cls: "bg-warn-bg text-warn-fg" },
  APPROVED: { label: "Approved", cls: "bg-ok-bg text-ok-fg" },
};

const PER_PAGE = 7;
const CELL = "px-4 py-[18px] border-b border-line-soft";

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.DRAFT;
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap ${m.cls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {m.label}
    </span>
  );
}

function FilterDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-between gap-2 h-10 px-3.5 w-full nav:w-auto bg-paper border border-line rounded-xl text-sm font-medium text-navy-800 hover:border-navy-500 transition-colors"
      >
        <span className="flex items-center gap-1">
          <span className="text-ink-400 font-normal">{label}:</span>
          <span>{value}</span>
        </span>
        <FiChevronDown size={14} className="text-ink-400" />
      </button>
      {open && (
        <div className="absolute top-[46px] right-0 min-w-[160px] max-h-[280px] overflow-y-auto bg-paper border border-line rounded-xl shadow-pop p-1.5 z-20">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-navy-50
                ${
                  value === opt
                    ? "bg-navy-50 text-navy-800 font-semibold"
                    : "text-ink-700"
                }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TechnicianDashboard() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [month, setMonth] = useState("All");
  const [year, setYear] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState(null); // row-action menu: { row, top, left }
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiClient
      .get("/samples")
      .then((res) => {
        if (!mounted) return;
        // API returns { items, total, page, limit }; tolerate bare arrays
        const list = Array.isArray(res.data) ? res.data : res.data.items || [];
        const mapped = list.map((s) => ({
          id: s.id,
          reportId: s.Report?.id || null,
          orderNo: s.order?.order_no || "—",
          client: s.order?.applicant || "—",
          sampleName: s.name || "—",
          brandModel:
            [s.brand, s.model].filter(Boolean).join(" ") || "—",
          status: s.Report?.status || "DRAFT",
          createdAt: s.order?.createdAt || null,
        }));
        setRows(mapped);
      })
      .catch((err) => {
        console.error("Error fetching samples:", err);
        toast.error("Gagal memuat datasheet.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const years = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.createdAt) set.add(String(new Date(r.createdAt).getFullYear()));
    });
    return ["All", ...[...set].sort().reverse()];
  }, [rows]);

  const filtered = useMemo(() => {
    const targetStatus = STATUS_FILTERS[statusFilter];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (targetStatus && r.status !== targetStatus) return false;
      if (year !== "All" || month !== "All") {
        if (!r.createdAt) return false;
        const d = new Date(r.createdAt);
        if (year !== "All" && String(d.getFullYear()) !== year) return false;
        if (month !== "All" && MONTHS[d.getMonth()] !== month) return false;
      }
      if (
        q &&
        !r.client.toLowerCase().includes(q) &&
        !r.orderNo.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [rows, statusFilter, month, year, search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, month, year, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pages);
  const pageRows = filtered.slice(
    (safePage - 1) * PER_PAGE,
    safePage * PER_PAGE
  );

  function openRowMenu(e, row) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({ row, top: rect.bottom + 6, left: rect.right - 200 });
  }

  async function downloadDatasheet(row) {
    if (!row.reportId) {
      toast.error("Datasheet ini belum memiliki report.");
      return;
    }
    try {
      const res = await apiClient.get(
        `/reports/${row.reportId}/download/datasheet`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `DATASHEET-${row.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      const password = res.headers["x-datasheet-password"];
      toast.success(
        password
          ? `Datasheet diunduh. Password: ${password}`
          : "Datasheet diunduh.",
        { duration: password ? 10000 : 4000 }
      );
    } catch (err) {
      console.error("Datasheet download failed:", err);
      toast.error("Gagal mengunduh datasheet.");
    }
  }

  async function deleteDatasheet(row) {
    if (
      !window.confirm(
        `Hapus datasheet "${row.client}"? Semua data terkait akan ikut terhapus dan tidak dapat dikembalikan.`
      )
    )
      return;
    try {
      await apiClient.delete(`/samples/${row.id}`);
      setRows((rs) => rs.filter((x) => x.id !== row.id));
      toast.success("Datasheet dihapus.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Gagal menghapus datasheet.");
    }
  }

  return (
    <div>
      {/* Page head */}
      <div className="flex flex-col gap-4 nav:flex-row nav:items-center nav:justify-between mb-6">
        <div>
          <h1 className="text-2xl nav:text-[28px] font-semibold text-navy-800 tracking-[-0.01em]">
            Dashboard
          </h1>
          <p className="text-sm text-ink-400 mt-1">
            Track and manage your active datasheets
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 nav:flex nav:gap-3">
          <div className="col-span-2 nav:col-auto">
            <FilterDropdown
              label="Status"
              value={statusFilter}
              options={Object.keys(STATUS_FILTERS)}
              onChange={setStatusFilter}
            />
          </div>
          <FilterDropdown
            label="Month"
            value={month}
            options={["All", ...MONTHS]}
            onChange={setMonth}
          />
          <FilterDropdown
            label="Year"
            value={year}
            options={years}
            onChange={setYear}
          />
        </div>
      </div>

      {/* Panel */}
      <section className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden">
        <div className="flex flex-col gap-3 p-4 nav:flex-row nav:items-center nav:justify-between nav:py-5 nav:px-6 border-b border-line-soft">
          <div>
            <h2 className="text-lg font-semibold text-navy-800">
              Datasheet on Progress
            </h2>
            <p className="text-[13px] text-ink-400 mt-0.5">
              {filtered.length} of {rows.length} entries
            </p>
          </div>
          <div className="flex flex-col gap-3 nav:flex-row nav:items-center">
            <div className="flex items-center gap-2 h-10 px-3.5 w-full nav:w-[280px] bg-paper border border-line rounded-xl focus-within:border-navy-500 transition-colors">
              <FiSearch size={18} className="text-ink-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search client or lab no…"
                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-navy-800 placeholder:text-ink-400"
              />
            </div>
            <button
              onClick={() => setScanOpen(true)}
              className="inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-xl text-sm font-semibold bg-paper text-navy-800 border border-line hover:bg-navy-50 transition-colors whitespace-nowrap"
            >
              <FiCamera size={17} /> Scan
            </button>
            <button
              onClick={() => navigate("/create-report")}
              className="inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-xl text-sm font-semibold bg-paper text-navy-800 border-[1.5px] border-navy-800 hover:bg-navy-50 transition-colors whitespace-nowrap"
            >
              <FiPlus size={18} /> New Datasheet
            </button>
          </div>
        </div>

        {/* Mobile: stacked datasheet cards (table hidden below `nav`) */}
        <div className="nav:hidden divide-y divide-line-soft">
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-ink-400">
              Loading datasheets…
            </div>
          ) : pageRows.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <FiFileText size={48} className="mx-auto text-ink-300 mb-3" />
              <div className="text-[15px] font-medium text-navy-800 mb-1">
                No datasheets match your filters
              </div>
              <div className="text-sm text-ink-400">
                Try changing the status or search
              </div>
            </div>
          ) : (
            pageRows.map((r) => (
              <div
                key={`m-${r.id}`}
                onClick={() => navigate(`/datasheet/${r.id}`)}
                className="px-4 py-3.5 flex items-start gap-3 active:bg-navy-50 cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-navy-800">
                      {r.sampleName}
                    </span>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="text-[13px] text-ink-700 mt-0.5">
                    {r.brandModel} · {r.client}
                  </div>
                  <div className="font-mono text-[11px] text-ink-400 mt-1 truncate">
                    {r.orderNo}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openRowMenu(e, r);
                  }}
                  aria-label="Aksi datasheet"
                  className="inline-flex w-11 h-11 -mr-1.5 rounded-lg items-center justify-center text-ink-400 active:bg-navy-100 shrink-0"
                >
                  <FiMoreHorizontal size={20} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden nav:block overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0">
            <thead>
              <tr>
                {["No.", "Lab No.", "Client", "Sample", "Brand / Model", "Status"].map(
                  (h) => (
                    <th
                      key={h}
                      className="bg-navy-50 text-left text-xs font-semibold text-ink-500 uppercase tracking-[0.06em] px-4 py-3.5 border-b border-line whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
                <th className="bg-navy-50 border-b border-line w-14" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-ink-400"
                  >
                    Loading datasheets…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="py-12 px-6 text-center">
                      <FiFileText
                        size={48}
                        className="mx-auto text-ink-300 mb-3"
                      />
                      <div className="text-[15px] font-medium text-navy-800 mb-1">
                        No datasheets match your filters
                      </div>
                      <div className="text-sm text-ink-400">
                        Try changing the status or search
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/datasheet/${r.id}`)}
                    className="group cursor-pointer hover:bg-navy-50 transition-colors"
                  >
                    <td className={`${CELL} text-sm text-ink-400 tabular-nums`}>
                      {String((safePage - 1) * PER_PAGE + i + 1).padStart(
                        2,
                        "0"
                      )}
                    </td>
                    <td className={CELL}>
                      <span className="font-mono text-[13px] font-medium text-navy-800">
                        {r.orderNo}
                      </span>
                    </td>
                    <td className={`${CELL} text-sm font-medium text-navy-800`}>
                      {r.client}
                    </td>
                    <td className={`${CELL} text-sm text-ink-700`}>
                      {r.sampleName}
                    </td>
                    <td className={`${CELL} text-sm text-ink-700`}>
                      {r.brandModel}
                    </td>
                    <td className={CELL}>
                      <StatusPill status={r.status} />
                    </td>
                    <td className={`${CELL} text-right`}>
                      <button
                        onClick={(e) => openRowMenu(e, r)}
                        aria-label="Aksi datasheet"
                        className="inline-flex w-8 h-8 rounded-lg items-center justify-center text-ink-400 hover:bg-navy-100 hover:text-navy-800 group-hover:text-navy-800 transition-colors"
                      >
                        <FiMoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between px-4 nav:px-6 py-4 border-t border-line-soft text-[13px] text-ink-400">
          <span>
            Showing{" "}
            {filtered.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1}–
            {(safePage - 1) * PER_PAGE + pageRows.length} of {filtered.length}
          </span>
          <div className="flex items-center justify-center flex-wrap gap-1">
            <button
              disabled={safePage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-[13px] font-medium text-navy-800 hover:bg-navy-50 disabled:text-ink-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <FiChevronLeft size={16} /> Previous
            </button>
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`min-w-9 h-9 px-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                  safePage === i + 1
                    ? "bg-navy-800 text-white"
                    : "text-navy-800 hover:bg-navy-50"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={safePage === pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-[13px] font-medium text-navy-800 hover:bg-navy-50 disabled:text-ink-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              Next <FiChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Row-action menu */}
      {menu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenu(null)}
          />
          <div
            className="fixed z-50 w-[200px] bg-paper border border-line rounded-xl shadow-pop p-1.5"
            style={{ top: menu.top, left: menu.left }}
          >
            <button
              onClick={() => {
                const row = menu.row;
                setMenu(null);
                navigate(`/datasheet/${row.id}`);
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-[13px] text-navy-800 hover:bg-navy-50 text-left transition-colors"
            >
              <FiFileText size={15} /> Datasheet Detail
            </button>
            {menu.row.status === "APPROVED" && (
              <button
                onClick={() => {
                  const row = menu.row;
                  setMenu(null);
                  downloadDatasheet(row);
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-[13px] text-navy-800 hover:bg-navy-50 text-left transition-colors"
              >
                <FiDownload size={15} /> Download Datasheet
              </button>
            )}
            <button
              onClick={() => {
                const row = menu.row;
                setMenu(null);
                deleteDatasheet(row);
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-[13px] text-bad-fg hover:bg-[#fef0f3] text-left transition-colors"
            >
              <FiTrash2 size={15} /> Delete Datasheet
            </button>
          </div>
        </>
      )}

      <BarcodeScanModal open={scanOpen} onClose={() => setScanOpen(false)} />
    </div>
  );
}
