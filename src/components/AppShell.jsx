import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiGrid,
  FiUser,
  FiClipboard,
  FiBell,
  FiChevronDown,
  FiLogOut,
  FiSettings,
  FiX,
  FiMenu,
} from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import logoUrl from "../assets/logo.png";
import avatarUrl from "../assets/avatar.png";

const NAV = [
  { key: "dashboard", label: "Dashboard", Icon: FiGrid, path: "/technician-dashboard" },
  { key: "profile", label: "Profile", Icon: FiUser, path: null },
  { key: "registration", label: "Registration", Icon: FiClipboard, path: "/create-report" },
];

function titleCase(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function Sidebar({ navOpen, onClose }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleNav = (item) => {
    onClose();
    if (!item.path) {
      toast("Halaman ini belum tersedia.");
      return;
    }
    navigate(item.path);
  };

  return (
    <aside
      className={`flex flex-col bg-navy-50 border-r border-line
        fixed inset-y-0 left-0 w-[280px] z-[60]
        transition-transform duration-200 ease-out
        ${
          navOpen
            ? "translate-x-0 shadow-[12px_0_36px_rgba(7,25,63,0.18)]"
            : "-translate-x-full"
        }
        nav:sticky nav:top-0 nav:h-screen nav:w-[264px] nav:translate-x-0 nav:shadow-none`}
    >
      <button
        onClick={onClose}
        aria-label="Close menu"
        className="nav:hidden absolute top-3.5 right-3.5 w-9 h-9 rounded-full flex items-center justify-center text-ink-500 hover:bg-black/5"
      >
        <FiX size={20} />
      </button>

      <div className="flex flex-col items-center gap-1.5 px-6 pt-5 pb-7">
        <img src={logoUrl} alt="" className="w-[132px] h-auto" />
        <div className="font-mono font-bold text-[22px] tracking-[-0.02em] text-navy-900">
          E-Datasheet
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-4 py-4">
        {NAV.map((item) => {
          const active =
            item.path &&
            (pathname === item.path ||
              (item.key === "dashboard" &&
                (pathname.startsWith("/reports/") ||
                  pathname.startsWith("/datasheet/"))));
          return (
            <button
              key={item.key}
              onClick={() => handleNav(item)}
              className={`flex items-center gap-3.5 h-14 px-4 rounded-xl text-base font-medium text-left w-full transition-colors
                ${
                  active
                    ? "bg-navy-800 text-white"
                    : "text-navy-700 hover:bg-navy-800/[0.06]"
                }`}
            >
              <item.Icon size={22} className="shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex items-center justify-between px-4 py-4 border-t border-line text-xs text-ink-400">
        <span>v2.4.1</span>
        <span>&copy; SERCO Lab</span>
      </div>
    </aside>
  );
}

function Topbar({ crumbs, onOpenMenu, onRequestLogout }) {
  const { user } = useAuth();
  const [pdOpen, setPdOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setPdOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const name = user?.name || "User";
  const role = titleCase(user?.role) || "Technician";
  const email = user?.email || "";

  return (
    <header className="h-[68px] nav:h-20 px-4 nav:px-8 bg-paper border-b border-line flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="nav:hidden w-11 h-11 rounded-xl flex items-center justify-center text-navy-800 hover:bg-navy-50 shrink-0"
        >
          <FiMenu size={22} />
        </button>
        <div className="flex items-center gap-2 text-[13px] text-ink-400 min-w-0">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            const isMid = i > 0 && !isLast;
            return (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && (
                  <span className={`text-ink-300 ${isMid ? "hidden nav:inline" : ""}`}>
                    /
                  </span>
                )}
                {isLast ? (
                  <strong className="font-medium text-navy-800">{c}</strong>
                ) : (
                  <span className={isMid ? "hidden nav:inline" : ""}>{c}</span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0" ref={ref}>
        <button
          title="Notifications"
          className="relative w-11 h-11 rounded-full flex items-center justify-center text-navy-700 hover:bg-navy-50"
        >
          <FiBell size={22} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-bad-fg border-2 border-paper" />
        </button>

        <div className="relative">
          <button
            onClick={() => setPdOpen((o) => !o)}
            className="flex items-center gap-3 pl-1.5 pr-3 py-1.5 rounded-full hover:bg-navy-50"
          >
            <img
              src={avatarUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover border-2 border-paper shadow-[0_0_0_1px_var(--color-line)]"
            />
            <div className="hidden nav:block text-right">
              <div className="text-[15px] font-medium text-navy-800 leading-tight">
                {name}
              </div>
              <div className="text-xs text-ink-400 leading-tight mt-0.5">{role}</div>
            </div>
            <FiChevronDown
              size={16}
              className={`hidden nav:block text-ink-400 transition-transform ${
                pdOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {pdOpen && (
            <div className="absolute top-full mt-2 right-0 min-w-[240px] bg-paper border border-line rounded-xl shadow-pop overflow-hidden z-40">
              <div className="flex items-center gap-3 p-4 border-b border-line-soft">
                <img
                  src={avatarUrl}
                  alt=""
                  className="w-11 h-11 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-navy-800 truncate">
                    {name}
                  </div>
                  {email && (
                    <div className="text-xs text-ink-400 truncate">{email}</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setPdOpen(false);
                  toast("Halaman ini belum tersedia.");
                }}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-navy-800 text-left hover:bg-navy-50"
              >
                <FiUser size={18} /> View profile
              </button>
              <button
                onClick={() => {
                  setPdOpen(false);
                  toast("Halaman ini belum tersedia.");
                }}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-navy-800 text-left hover:bg-navy-50"
              >
                <FiSettings size={18} /> Settings
              </button>
              <button
                onClick={() => {
                  setPdOpen(false);
                  onRequestLogout();
                }}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-bad-fg text-left border-t border-line-soft hover:bg-[#fef0f3]"
              >
                <FiLogOut size={18} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function LogoutConfirm({ onCancel, onConfirm }) {
  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[100] bg-[rgba(7,25,63,0.42)] flex items-center justify-center p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] bg-paper rounded-3xl shadow-modal overflow-hidden"
      >
        <div className="flex justify-between items-start px-7 pt-6 pb-4">
          <div>
            <h3 className="text-xl font-semibold text-navy-800">
              Log out of E-Datasheet?
            </h3>
            <p className="text-[13px] text-ink-400 mt-1">
              You&apos;ll need to sign in again to access your datasheets.
            </p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="w-11 h-11 rounded-full flex items-center justify-center text-navy-700 hover:bg-navy-50 shrink-0"
          >
            <FiX size={20} />
          </button>
        </div>
        <div className="flex justify-end gap-2 px-7 pb-6">
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center h-11 px-[18px] rounded-xl text-sm font-semibold bg-navy-50 text-navy-800 hover:bg-navy-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-xl text-sm font-semibold bg-white text-bad-fg border-[1.5px] border-bad-fg hover:bg-[#fef0f3]"
          >
            <FiLogOut size={16} /> Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children, crumbs = ["Technician", "Dashboard"] }) {
  const [navOpen, setNavOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  const handleLogout = () => {
    setShowLogout(false);
    logout();
    toast.success("Logged out");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-canvas grid nav:grid-cols-[264px_1fr]">
      <Sidebar navOpen={navOpen} onClose={() => setNavOpen(false)} />

      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          className="nav:hidden fixed inset-0 z-[50] bg-[rgba(7,25,63,0.42)]"
        />
      )}

      <div className="min-w-0 flex flex-col">
        <Topbar
          crumbs={crumbs}
          onOpenMenu={() => setNavOpen(true)}
          onRequestLogout={() => setShowLogout(true)}
        />
        <main className="w-full max-w-[1400px] px-4 pt-5 pb-12 nav:px-10 nav:pt-8 nav:pb-16">
          {children}
        </main>
      </div>

      {showLogout && (
        <LogoutConfirm
          onCancel={() => setShowLogout(false)}
          onConfirm={handleLogout}
        />
      )}
    </div>
  );
}
