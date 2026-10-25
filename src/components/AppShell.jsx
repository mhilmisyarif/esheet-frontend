import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  User,
  Users,
  Menu as MenuIcon,
  X as XIcon,
  ChevronDown,
  LogOut,
  Settings,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";
import logoUrl from "../assets/logo.png";
import avatarUrl from "../assets/avatar.png";

const TECH_NAV = [
  {
    key: "dashboard",
    label: "Dashboard",
    Icon: LayoutDashboard,
    path: "/technician-dashboard",
  },
  {
    key: "registration",
    label: "Registration",
    Icon: ClipboardList,
    path: "/create-report",
  },
  { key: "profile", label: "Profile", Icon: User, path: null },
];

const ENGINEER_NAV = [
  {
    key: "dashboard",
    label: "Dashboard",
    Icon: LayoutDashboard,
    path: "/engineer-dashboard",
  },
  {
    key: "standards",
    label: "Manage Standards",
    Icon: BookOpen,
    path: "/manage-standards",
  },
  { key: "profile", label: "Profile", Icon: User, path: null },
];

const ADMIN_NAV = [
  {
    key: "dashboard",
    label: "Dashboard",
    Icon: LayoutDashboard,
    path: "/admin-dashboard",
  },
  {
    key: "users",
    label: "Manage Users",
    Icon: Users,
    path: "/manage-users",
  },
  {
    key: "standards",
    label: "Manage Standards",
    Icon: BookOpen,
    path: "/manage-standards",
  },
  { key: "profile", label: "Profile", Icon: User, path: null },
];

function titleCase(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function Sidebar({ navOpen, onClose, nav, deskCollapsed }) {
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

  const isMini = deskCollapsed && !navOpen;

  return (
    <aside
      className={`flex flex-col bg-paper border-r border-line-soft
        fixed inset-y-0 left-0 z-[60]
        transition-[width,transform] duration-200 ease-out
        ${
          navOpen
            ? "translate-x-0 shadow-[12px_0_36px_rgba(7,25,63,0.18)] w-[280px]"
            : "-translate-x-full"
        }
        nav:sticky nav:top-0 nav:h-screen nav:translate-x-0 nav:shadow-none nav:flex
        ${deskCollapsed ? "nav:w-[76px]" : "nav:w-[264px]"}`}
    >
      {/* Mobile close button */}
      <button
        onClick={onClose}
        aria-label="Close menu"
        className="nav:hidden absolute top-5 right-3.5 w-9 h-9 rounded-full flex items-center justify-center text-ink-500 hover:bg-navy-50 cursor-pointer"
      >
        <XIcon size={19} />
      </button>

      {/* Brand Header */}
      <div
        className={`flex items-center border-b border-line-soft transition-all duration-200 ${
          isMini
            ? "justify-center px-2 py-5"
            : "gap-3 px-5 py-5 pr-12 nav:pr-5"
        }`}
      >
        <img
          src={logoUrl}
          alt="Logo Sucofindo"
          title="E-Datasheet"
          className={`${
            isMini ? "w-11 max-h-9" : "w-[48px] max-h-10"
          } h-auto object-contain shrink-0`}
        />
        {!isMini && (
          <span className="font-mono font-bold text-[19px] tracking-tight text-navy-900 truncate">
            E-Datasheet
          </span>
        )}
      </div>

      {/* Navigation List */}
      <nav
        className={`flex-1 flex flex-col gap-1.5 py-4 transition-all duration-200 ${
          isMini ? "px-0 items-center overflow-visible" : "px-3 overflow-y-auto"
        }`}
      >
        {nav.map((item) => {
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
              className={`flex items-center transition-all duration-150 relative group cursor-pointer ${
                isMini
                  ? "w-full h-12 justify-center"
                  : "w-full h-11 px-3.5 gap-3.5 rounded-xl text-[14px] text-left " +
                    (active
                      ? "bg-navy-100/70 text-navy-900 font-semibold shadow-xs"
                      : "text-ink-600 hover:text-navy-900 hover:bg-navy-50/80 font-medium")
              }`}
            >
              {isMini ? (
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-150 ${
                    active
                      ? "bg-navy-100/70 text-navy-900 shadow-xs"
                      : "text-ink-400 group-hover:text-navy-900 group-hover:bg-navy-50/80"
                  }`}
                >
                  <item.Icon
                    size={20}
                    className={`shrink-0 transition-colors ${
                      active ? "text-navy-800 stroke-[2.2]" : "text-ink-400 stroke-[1.8]"
                    }`}
                  />
                </div>
              ) : (
                <>
                  <item.Icon
                    size={20}
                    className={`shrink-0 transition-colors ${
                      active ? "text-navy-800 stroke-[2.2]" : "text-ink-400 stroke-[1.8]"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}

              {/* Vertical active indicator bar on the right border of sidebar in mini mode */}
              {isMini && active && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-[3.5px] h-7 bg-navy-800 rounded-l-full" />
              )}

              {/* Floating pill tooltip on hover (delay-300 for hover lama, navy blue palette) */}
              {isMini && (
                <div className="hidden nav:flex items-center absolute left-full ml-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 delay-300 z-[90]">
                  <div className="w-2 h-2 bg-navy-800 rotate-45 -mr-1 shrink-0" />
                  <div className="bg-navy-800 text-white text-[12px] font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-pop tracking-wide border border-navy-700/60">
                    {item.label}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className={`border-t border-line-soft text-ink-400 transition-all duration-200 ${
          isMini
            ? "flex flex-col items-center justify-center py-4 text-[11px]"
            : "flex items-center justify-between px-5 py-4 text-xs"
        }`}
      >
        {isMini ? (
          <span title="va.0.0.1 © SBU Lab - Lab Teknik" className="font-mono text-ink-400 text-center">
            v1
          </span>
        ) : (
          <>
            <span className="font-mono">va.0.0.1</span>
            <span>&copy; SBU Lab - Lab Teknik</span>
          </>
        )}
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
    <header className="h-[68px] nav:h-20 px-4 nav:px-8 bg-paper border-b border-line-soft flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4 min-w-0">
        {/* Hamburger: opens the drawer on mobile, collapses/expands the
            sidebar on desktop — always visible. */}
        <button
          onClick={onOpenMenu}
          aria-label="Toggle menu"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-navy-800 hover:bg-navy-50 shrink-0 cursor-pointer transition-colors"
        >
          <MenuIcon size={20} />
        </button>
        <div className="flex items-center gap-2 text-[13px] text-ink-400 min-w-0">
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            const isMid = i > 0 && !isLast;
            return (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && (
                  <span
                    className={`text-ink-300 ${isMid ? "hidden nav:inline" : ""}`}
                  >
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

      <div className="flex items-center gap-2 shrink-0">
        <NotificationBell />

        <div className="relative" ref={ref}>
          <button
            onClick={() => setPdOpen((o) => !o)}
            className="flex items-center gap-3 pl-1.5 pr-3 py-1.5 rounded-full hover:bg-navy-50 cursor-pointer transition-colors"
          >
            <img
              src={avatarUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover border-2 border-paper shadow-[0_0_0_1px_var(--color-line)]"
            />
            <div className="hidden nav:block text-right">
              <div className="text-[14px] font-semibold text-navy-800 leading-tight">
                {name}
              </div>
              <div className="text-xs text-ink-400 leading-tight mt-0.5">
                {role}
              </div>
            </div>
            <ChevronDown
              size={16}
              className={`hidden nav:block text-ink-400 transition-transform ${
                pdOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {pdOpen && (
            <div className="absolute top-full mt-2 right-0 min-w-[240px] bg-paper border border-line-soft rounded-2xl shadow-pop overflow-hidden z-40">
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
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-navy-800 text-left hover:bg-navy-50 cursor-pointer transition-colors"
              >
                <User size={17} /> View profile
              </button>
              <button
                onClick={() => {
                  setPdOpen(false);
                  toast("Halaman ini belum tersedia.");
                }}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-navy-800 text-left hover:bg-navy-50 cursor-pointer transition-colors"
              >
                <Settings size={17} /> Settings
              </button>
              <button
                onClick={() => {
                  setPdOpen(false);
                  onRequestLogout();
                }}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-bad-fg text-left border-t border-line-soft hover:bg-[#fef0f3] cursor-pointer transition-colors"
              >
                <LogOut size={17} /> Logout
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
      className="fixed inset-0 z-[100] bg-[rgba(7,25,63,0.42)] flex items-center justify-center p-6 backdrop-blur-xs"
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
            className="w-10 h-10 rounded-full flex items-center justify-center text-navy-700 hover:bg-navy-50 shrink-0 cursor-pointer transition-colors"
          >
            <XIcon size={18} />
          </button>
        </div>
        <div className="flex justify-end gap-2 px-7 pb-6">
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center h-11 px-[18px] rounded-xl text-sm font-semibold bg-navy-50 text-navy-800 hover:bg-navy-100 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-xl text-sm font-semibold bg-white text-bad-fg border-[1.5px] border-bad-fg hover:bg-[#fef0f3] cursor-pointer transition-colors"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({
  children,
  crumbs = ["Technician", "Dashboard"],
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  // Auto-collapse logic for tablet screens (960px - 1200px):
  const [deskCollapsed, setDeskCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved !== null) return saved === "1";
      const isTablet = window.innerWidth <= 1200 && window.innerWidth >= 960;
      if (isTablet) return true;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      if (localStorage.getItem("sidebar-collapsed") === null) {
        if (window.innerWidth <= 1200 && window.innerWidth >= 960) {
          setDeskCollapsed(true);
        }
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const toggleMenu = () => {
    if (window.matchMedia("(min-width: 960px)").matches) {
      setDeskCollapsed((v) => {
        const next = !v;
        localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
        return next;
      });
    } else {
      setNavOpen(true);
    }
  };

  let nav = TECH_NAV; // Default to technician

  if (user?.role === "ADMIN") {
    nav = ADMIN_NAV;
  } else if (user?.role === "ENGINEER" || user?.role === "DRAFTER") {
    nav = ENGINEER_NAV;
  }

  const rolePrefix =
    user?.role === "ENGINEER"
      ? "Engineer"
      : user?.role === "ADMIN"
      ? "Admin"
      : "Technician";

  const displayCrumbs = useMemo(() => {
    if (!crumbs || crumbs.length === 0) return crumbs;
    if (crumbs[0] === "Technician" && user?.role && user.role !== "TECHNICIAN") {
      return [rolePrefix, ...crumbs.slice(1)];
    }
    return crumbs;
  }, [crumbs, user?.role, rolePrefix]);

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
    <div
      className={`min-h-screen bg-canvas grid ${
        deskCollapsed ? "nav:grid-cols-[76px_1fr]" : "nav:grid-cols-[264px_1fr]"
      }`}
    >
      <Sidebar
        nav={nav}
        navOpen={navOpen}
        onClose={() => setNavOpen(false)}
        deskCollapsed={deskCollapsed}
      />

      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          className="nav:hidden fixed inset-0 z-[50] bg-[rgba(7,25,63,0.42)]"
        />
      )}

      <div className="min-w-0 flex flex-col">
        <Topbar
          crumbs={displayCrumbs}
          onOpenMenu={toggleMenu}
          onRequestLogout={() => setShowLogout(true)}
        />
        <main className="w-full flex-1 px-4 pt-5 pb-12 nav:px-8 nav:pt-8 nav:pb-16">
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
