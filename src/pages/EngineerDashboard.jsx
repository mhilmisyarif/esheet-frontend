// src/pages/EngineerDashboard.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiMoreHorizontal,
  FiFileText,
  FiDownload,
} from "react-icons/fi";
import apiClient from "../api";

const STATUS_META = {
  DRAFT: { label: "Draft", cls: "bg-neutral-bg text-neutral-fg" },
  IN_PROGRESS: { label: "Review", cls: "bg-warn-bg text-warn-fg" },
  APPROVED: { label: "Approved", cls: "bg-ok-bg text-ok-fg" },
};

const TABS = [
  { key: "IN_PROGRESS", label: "Awaiting Review" },
  { key: "APPROVED", label: "Approved" },
];

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

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export default function EngineerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const savedState = useMemo(() => {
    if (location.state?.from === "report-editor" || location.state?.lastClickedId) {
      return location.state;
    }
    try {
      const str = sessionStorage.getItem("engineer_dashboard_state");
      return str ? JSON.parse(str) : null;
    } catch {
      return null;
    }
  }, [location.state]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(() => savedState?.tab || "IN_PROGRESS");
  const [search, setSearch] = useState(() => savedState?.search || "");
  const [page, setPage] = useState(() => savedState?.page || 1);
  const [menu, setMenu] = useState(null); // { row, top, left }

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPage(1);
  }, [tab, search]);

  // Keep sessionStorage in sync
  useEffect(() => {
    try {
      const prev = JSON.parse(
        sessionStorage.getItem("engineer_dashboard_state") || "{}"
      );
      sessionStorage.setItem(
        "engineer_dashboard_state",
        JSON.stringify({
          ...prev,
          tab,
          search,
          page,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }, [tab, search, page]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiClient
      .get(`/samples?status=${tab}`)
      .then((res) => {
        if (!mounted) return;
        // API returns { items, total, page, limit }; tolerate bare arrays
        const list = Array.isArray(res.data) ? res.data : res.data.items || [];
        setRows(
          list.map((s) => ({
            id: s.id,
            reportId: s.Report?.id || null,
            orderNo: s.order?.order_no || "—",
            client: s.order?.applicant || "—",
            sampleName: s.name || "—",
            createdAt: s.order?.createdAt || null,
            status: s.Report?.status || "DRAFT",
          }))
        );
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
  }, [tab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.client.toLowerCase().includes(q) ||
        r.orderNo.toLowerCase().includes(q) ||
        r.sampleName.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pages);
  const pageRows = filtered.slice(
    (safePage - 1) * PER_PAGE,
    safePage * PER_PAGE
  );

  const didScrollRef = useRef(false);

  // Restore scroll position & highlight the last clicked row
  useEffect(() => {
    if (loading || rows.length === 0 || didScrollRef.current) return;
    const targetId = location.state?.lastClickedId || savedState?.lastClickedId;
    if (!targetId) return;

    // Check if target item is in the current filtered list and adjust page if needed
    const itemIndex = filtered.findIndex((r) => r.id === targetId);
    if (itemIndex !== -1) {
      const targetPage = Math.floor(itemIndex / PER_PAGE) + 1;
      if (page !== targetPage) {
        setPage(targetPage);
        return;
      }
    }

    didScrollRef.current = true;
    const timer = setTimeout(() => {
      const el = document.getElementById(`datasheet-row-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-navy-600", "bg-sky-50");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-navy-600", "bg-sky-50");
        }, 2200);
      } else if (savedState?.scrollY) {
        window.scrollTo({ top: savedState.scrollY, behavior: "smooth" });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [loading, rows, filtered, page, location.state, savedState]);

  const handleOpenReport = (sampleId) => {
    const stateToSave = {
      tab,
      page,
      search,
      lastClickedId: sampleId,
      scrollY: window.scrollY || window.pageYOffset || 0,
    };
    try {
      sessionStorage.setItem(
        "engineer_dashboard_state",
        JSON.stringify(stateToSave)
      );
    } catch {
      // Ignore storage errors
    }

    navigate(`/reports/${sampleId}`, {
      state: {
        from: "/engineer-dashboard",
        ...stateToSave,
      },
    });
  };

  function openRowMenu(e, row) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({ row, top: rect.bottom + 6, left: rect.right - 200 });
  }

  async function downloadDraft(row) {
    if (!row.reportId) {
      toast.error("Datasheet ini belum memiliki report.");
      return;
    }
    try {
      const res = await apiClient.get(
        `/reports/${row.reportId}/download/draft`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `DRAFT-${row.id}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Draft diunduh.");
    } catch (err) {
      console.error("Draft download failed:", err);
      toast.error("Gagal mengunduh draft.");
    }
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
      toast.error(
        err.response?.data?.error || "Gagal mengunduh datasheet."
      );
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
            Review and approve submitted datasheets
          </p>
        </div>
        <div className="relative inline-grid grid-cols-2 p-1 bg-navy-50 rounded-xl self-start select-none">
          {(() => {
            const activeIdx = TABS.findIndex((t) => t.key === tab);
            return (
              activeIdx !== -1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 bottom-1 rounded-lg bg-paper shadow-card transition-transform duration-200 ease-out pointer-events-none"
                  style={{
                    width: "calc((100% - 8px) / 2)",
                    left: "4px",
                    transform: `translateX(${activeIdx * 100}%)`,
                  }}
                />
              )
            );
          })()}
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`relative z-10 h-9 px-4 rounded-lg text-sm font-semibold transition-colors cursor-pointer inline-flex items-center justify-center whitespace-nowrap ${
                  active
                    ? "text-navy-800"
                    : "text-ink-500 hover:text-navy-800"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel */}
      <section className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden">
        <div className="flex flex-col gap-3 p-4 nav:flex-row nav:items-center nav:justify-between nav:py-5 nav:px-6 border-b border-line-soft">
          <div>
            <h2 className="text-lg font-semibold text-navy-800">
              {tab === "IN_PROGRESS"
                ? "Awaiting Review"
                : "Approved Datasheets"}
            </h2>
            <p className="text-[13px] text-ink-400 mt-0.5">
              {filtered.length} datasheet{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2 h-10 px-3.5 w-full nav:w-[280px] bg-paper border border-line rounded-xl focus-within:border-navy-500 transition-colors">
            <FiSearch size={18} className="text-ink-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, lab no or sample…"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm text-navy-800 placeholder:text-ink-400"
            />
          </div>
        </div>

        {/* Table */}
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
                {tab === "IN_PROGRESS"
                  ? "No datasheets awaiting review"
                  : "No approved datasheets"}
              </div>
              <div className="text-sm text-ink-400">
                {search
                  ? "Try a different search"
                  : "Submitted datasheets will appear here"}
              </div>
            </div>
          ) : (
            pageRows.map((r) => (
              <div
                key={`m-${r.id}`}
                id={`datasheet-row-${r.id}`}
                onClick={() => handleOpenReport(r.id)}
                className="px-4 py-3.5 flex items-start gap-3 active:bg-navy-50 cursor-pointer rounded-xl transition-all duration-300"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-navy-800">
                      {r.sampleName}
                    </span>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="text-[13px] text-ink-700 mt-0.5">
                    {r.client} · {fmtDate(r.createdAt)}
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
          <table className="w-full min-w-[820px] border-separate border-spacing-0">
            <thead>
              <tr>
                {["No.", "Lab No.", "Client", "Sample", "Created", "Status"].map(
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
                        {tab === "IN_PROGRESS"
                          ? "No datasheets awaiting review"
                          : "No approved datasheets"}
                      </div>
                      <div className="text-sm text-ink-400">
                        {search
                          ? "Try a different search"
                          : "Submitted datasheets will appear here"}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((r, i) => (
                  <tr
                    key={r.id}
                    id={`datasheet-row-${r.id}`}
                    onClick={() => handleOpenReport(r.id)}
                    className="group cursor-pointer hover:bg-navy-50 transition-all duration-300"
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
                      {fmtDate(r.createdAt)}
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
                handleOpenReport(row.id);
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-[13px] text-navy-800 hover:bg-navy-50 text-left transition-colors"
            >
              <FiFileText size={15} />
              {menu.row.status === "APPROVED" ? "View Report" : "Review Report"}
            </button>
            <button
              onClick={() => {
                const row = menu.row;
                setMenu(null);
                downloadDraft(row);
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-[13px] text-navy-800 hover:bg-navy-50 text-left transition-colors"
            >
              <FiDownload size={15} /> Download Draft
            </button>
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
          </div>
        </>
      )}
    </div>
  );
}
