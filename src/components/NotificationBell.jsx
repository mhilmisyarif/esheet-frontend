// src/components/NotificationBell.jsx
//
// Topbar bell: unread badge + dropdown of the latest notifications.
// Polls every 60s (cheap — single indexed query per user).
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiCheck } from "react-icons/fi";
import apiClient from "../api";

const TYPE_ICON = {
  KLAUSUL_SUBMITTED: "📥",
  KLAUSUL_APPROVED: "✅",
  KLAUSUL_CORRECTED: "✏️",
};

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "baru saja";
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      const res = await apiClient.get("/notifications?limit=15");
      setItems(res.data.items || []);
      setUnread(res.data.unread || 0);
    } catch {
      /* polling failure is non-fatal (e.g. token expiring) */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  // Close on outside click
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const markAllRead = async () => {
    try {
      await apiClient.patch("/notifications/read", {});
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      /* ignore */
    }
  };

  const openItem = async (n) => {
    setOpen(false);
    if (!n.read) {
      apiClient
        .patch("/notifications/read", { ids: [n.id] })
        .then(() => refresh())
        .catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      );
    }
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        title="Notifications"
        onClick={() => setOpen((o) => !o)}
        className={`relative w-11 h-11 rounded-full flex items-center justify-center text-navy-700 hover:bg-navy-50 ${
          open ? "bg-navy-50" : ""
        }`}
      >
        <FiBell size={22} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-bad-fg text-white text-[10px] font-bold flex items-center justify-center border-2 border-paper">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[76px] nav:absolute nav:inset-x-auto nav:right-0 nav:top-[52px] nav:w-[340px] bg-paper border border-line rounded-2xl shadow-pop z-40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft">
            <span className="text-sm font-semibold text-navy-900">
              Notifikasi
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-navy-600 hover:text-navy-800"
              >
                <FiCheck size={13} /> Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px] text-ink-400">
                Belum ada notifikasi
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 border-b border-line-soft last:border-b-0 hover:bg-navy-50 transition-colors ${
                    n.read ? "opacity-65" : "bg-navy-50/40"
                  }`}
                >
                  <span className="text-lg leading-none mt-0.5">
                    {TYPE_ICON[n.type] || "🔔"}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-navy-800 leading-snug">
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="block text-[12px] text-ink-500 mt-0.5 truncate">
                        {n.body}
                      </span>
                    )}
                    <span className="block text-[11px] text-ink-400 mt-1">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                  {!n.read && (
                    <span className="ml-auto mt-1.5 w-2 h-2 rounded-full bg-navy-600 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
