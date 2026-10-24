// src/pages/ManageUsers.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiSearch,
  FiUserPlus,
  FiUsers,
  FiTrash2,
  FiChevronLeft,
  FiChevronRight,
  FiCheck,
  FiX,
  FiChevronDown,
} from "react-icons/fi";
import { FaSpinner } from "react-icons/fa";
import apiClient from "../api";
import { useAuth } from "../context/AuthContext";

const PER_PAGE = 10;
const CELL = "px-4 py-3.5 border-b border-line-soft";

const ROLE_BADGES = {
  ADMIN: {
    label: "ADMIN",
    dot: "bg-purple-600",
    cls: "bg-purple-100 text-purple-900 border-purple-200",
  },
  ENGINEER: {
    label: "ENGINEER",
    dot: "bg-sky-600",
    cls: "bg-sky-100 text-sky-900 border-sky-200",
  },
  TECHNICIAN: {
    label: "TECHNICIAN",
    dot: "bg-emerald-600",
    cls: "bg-emerald-100 text-emerald-900 border-emerald-200",
  },
  DRAFTER: {
    label: "DRAFTER",
    dot: "bg-amber-600",
    cls: "bg-amber-100 text-amber-900 border-amber-200",
  },
};

const ALL_ROLES = ["ALL", "ADMIN", "ENGINEER", "TECHNICIAN", "DRAFTER"];

function RolePill({ role }) {
  const m = ROLE_BADGES[role] || {
    label: role,
    dot: "bg-slate-500",
    cls: "bg-slate-100 text-slate-800 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap border ${m.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function FilterDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-between gap-2 h-10 px-3.5 bg-paper border border-line rounded-xl text-sm font-medium text-navy-800 hover:bg-navy-50 transition-colors cursor-pointer min-w-[130px]"
      >
        <span>
          <span className="text-ink-400 mr-1.5">{label}:</span>
          {value}
        </span>
        <FiChevronDown size={14} className="text-ink-400" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-30 mt-1 min-w-[150px] bg-paper border border-line rounded-xl shadow-lg p-1">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  value === opt
                    ? "bg-navy-50 text-navy-800 font-bold"
                    : "text-ink-500 hover:bg-navy-50 hover:text-navy-800"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ManageUsers() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  // Edit Role Modal / State
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState("TECHNICIAN");
  const [updatingRole, setUpdatingRole] = useState(false);

  // Delete User Confirmation State
  const [deletingUser, setDeletingUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load users from backend
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/users");
      setUsers(res.data || []);
    } catch (err) {
      console.error("Gagal memuat pengguna:", err);
      toast.error(err.response?.data?.error || "Gagal memuat daftar pengguna.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filtered & Paginated users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q))
      );
    });
  }, [users, roleFilter, search]);

  const pages = Math.max(1, Math.ceil(filteredUsers.length / PER_PAGE));
  const safePage = Math.min(page, pages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PER_PAGE;
    return filteredUsers.slice(start, start + PER_PAGE);
  }, [filteredUsers, safePage]);

  // Handle Role Update
  const handleUpdateRole = async () => {
    if (!editingUser) return;
    setUpdatingRole(true);
    try {
      await apiClient.patch(`/users/${editingUser.id}/role`, {
        role: selectedRole,
      });
      toast.success(`Role user "${editingUser.name}" berhasil diubah menjadi ${selectedRole}`);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Gagal memperbarui role.");
    } finally {
      setUpdatingRole(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/users/${deletingUser.id}`);
      toast.success(`User "${deletingUser.name}" berhasil dihapus.`);
      setDeletingUser(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Gagal menghapus user.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col gap-4 nav:flex-row nav:items-center nav:justify-between mb-6">
        <div>
          <h1 className="text-2xl nav:text-[28px] font-semibold text-navy-800 tracking-[-0.01em]">
            Manage Users
          </h1>
          <p className="text-sm text-ink-400 mt-1">
            Daftar dan manajemen hak akses pengguna laboratorium Sucofindo
          </p>
        </div>

        <button
          onClick={() => navigate("/register-user")}
          className="inline-flex items-center justify-center gap-2 h-11 px-[18px] rounded-xl text-sm font-semibold bg-navy-800 text-white hover:bg-navy-700 transition-colors whitespace-nowrap shadow-sm cursor-pointer"
        >
          <FiUserPlus size={18} /> Tambah User
        </button>
      </div>

      {/* Filters & Actions Toolbar */}
      <div className="flex flex-col gap-2 nav:flex-row nav:justify-end mb-4">
        <FilterDropdown
          label="Role"
          value={roleFilter}
          options={ALL_ROLES}
          onChange={(r) => {
            setRoleFilter(r);
            setPage(1);
          }}
        />
      </div>

      {/* Table Section (Same card styling as Datasheets) */}
      <section className="bg-paper border border-line rounded-2xl shadow-card overflow-hidden">
        {/* Table Toolbar Header */}
        <div className="flex flex-col gap-3 p-4 nav:flex-row nav:items-center nav:justify-between nav:py-5 nav:px-6 border-b border-line-soft">
          <div>
            <h2 className="text-lg font-semibold text-navy-800">
              Daftar Pengguna Sistem
            </h2>
            <p className="text-[13px] text-ink-400 mt-0.5">
              {filteredUsers.length} dari {users.length} total pengguna
            </p>
          </div>

          <div className="flex items-center gap-2 h-10 px-3.5 w-full nav:w-[280px] bg-paper border border-line rounded-xl focus-within:border-navy-500 transition-colors">
            <FiSearch size={18} className="text-ink-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama atau email…"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm text-navy-800 placeholder:text-ink-400"
            />
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden nav:block overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0">
            <thead>
              <tr>
                {["No.", "Nama Pengguna", "Email", "Role / Hak Akses", "Aksi"].map((h) => (
                  <th
                    key={h}
                    className="bg-navy-50 text-left text-xs font-semibold text-ink-500 uppercase tracking-[0.06em] px-4 py-3.5 border-b border-line whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-ink-400">
                    <div className="flex items-center justify-center gap-2">
                      <FaSpinner className="animate-spin text-navy-600" />
                      Memuat daftar pengguna…
                    </div>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="py-12 px-6 text-center">
                      <FiUsers size={48} className="mx-auto text-ink-300 mb-3" />
                      <div className="text-[15px] font-medium text-navy-800 mb-1">
                        Tidak ada pengguna yang cocok
                      </div>
                      <p className="text-xs text-ink-400">
                        Coba sesuaikan kata kunci pencarian atau filter role.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((u, i) => {
                  const isCurrent = currentUser?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      className="group hover:bg-navy-50 transition-colors"
                    >
                      {/* No. */}
                      <td className={`${CELL} text-sm text-ink-400 tabular-nums w-14`}>
                        {String((safePage - 1) * PER_PAGE + i + 1).padStart(2, "0")}
                      </td>

                      {/* Name */}
                      <td className={CELL}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-navy-100 text-navy-800 font-bold text-xs flex items-center justify-center shrink-0">
                            {(u.name || "U").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-sm text-navy-900 block">
                              {u.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] text-emerald-700 font-medium">
                                (Akun Anda)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className={CELL}>
                        <span className="font-mono text-[13px] text-ink-700">
                          {u.email}
                        </span>
                      </td>

                      {/* Role Pill */}
                      <td className={CELL}>
                        <RolePill role={u.role} />
                      </td>

                      {/* Actions */}
                      <td className={CELL}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingUser(u);
                              setSelectedRole(u.role);
                            }}
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold text-navy-800 bg-navy-50 hover:bg-navy-100 transition-colors cursor-pointer"
                            title="Ubah Role"
                          >
                            Ubah Role
                          </button>
                          {!isCurrent && (
                            <button
                              onClick={() => setDeletingUser(u)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Hapus Pengguna"
                            >
                              <FiTrash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Cards) */}
        <div className="nav:hidden divide-y divide-line-soft">
          {loading ? (
            <div className="p-8 text-center text-sm text-ink-400">
              <FaSpinner className="animate-spin inline mr-2 text-navy-600" /> Memuat...
            </div>
          ) : pageRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-400">
              Tidak ada pengguna
            </div>
          ) : (
            pageRows.map((u, i) => (
              <div key={u.id} className="p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-400 font-mono">
                      #{String((safePage - 1) * PER_PAGE + i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-semibold text-navy-900 text-sm">
                      {u.name}
                    </span>
                  </div>
                  <RolePill role={u.role} />
                </div>
                <div className="text-xs font-mono text-ink-500">{u.email}</div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setEditingUser(u);
                      setSelectedRole(u.role);
                    }}
                    className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-navy-50 text-navy-800 hover:bg-navy-100 transition-colors"
                  >
                    Ubah Role
                  </button>
                  {currentUser?.id !== u.id && (
                    <button
                      onClick={() => setDeletingUser(u)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Footer (Same as Datasheets) */}
        <div className="flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between px-4 nav:px-6 py-4 border-t border-line-soft text-[13px] text-ink-400">
          <span>
            Menampilkan{" "}
            {filteredUsers.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1}–
            {(safePage - 1) * PER_PAGE + pageRows.length} dari{" "}
            {filteredUsers.length} pengguna
          </span>
          <div className="flex items-center justify-center flex-wrap gap-1">
            <button
              disabled={safePage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-[13px] font-medium text-navy-800 hover:bg-navy-50 disabled:text-ink-300 disabled:cursor-not-allowed cursor-pointer"
            >
              <FiChevronLeft size={16} /> Sebelumnya
            </button>
            {Array.from({ length: pages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setPage(idx + 1)}
                className={`min-w-9 h-9 px-2.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
                  safePage === idx + 1
                    ? "bg-navy-800 text-white"
                    : "text-navy-800 hover:bg-navy-50"
                }`}
              >
                {idx + 1}
              </button>
            ))}
            <button
              disabled={safePage === pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-[13px] font-medium text-navy-800 hover:bg-navy-50 disabled:text-ink-300 disabled:cursor-not-allowed cursor-pointer"
            >
              Selanjutnya <FiChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Modal Ubah Role */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-xs p-4">
          <div className="bg-paper border border-line rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-line-soft">
              <h3 className="text-lg font-bold text-navy-900">Ubah Role Pengguna</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-ink-400 hover:text-navy-800 p-1 cursor-pointer"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="my-4">
              <p className="text-sm text-ink-500 mb-1">
                Pengguna: <strong className="text-navy-900">{editingUser.name}</strong>
              </p>
              <p className="text-xs font-mono text-ink-400 mb-4">{editingUser.email}</p>

              <label className="text-[13px] font-medium text-navy-800 block mb-1.5">
                Pilih Role Baru:
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-line rounded-lg text-sm bg-paper text-navy-800 outline-none focus:ring-[3px] focus:ring-navy-600/[0.12]"
              >
                <option value="TECHNICIAN">TECHNICIAN (Teknisi Pengujian)</option>
                <option value="ENGINEER">ENGINEER (Pemeriksa / Verifikator)</option>
                <option value="DRAFTER">DRAFTER (Penyusun Draf Laporan)</option>
                <option value="ADMIN">ADMIN (Administrator Sistem)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line-soft">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-ink-600 hover:bg-navy-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={updatingRole}
                onClick={handleUpdateRole}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-navy-800 text-white hover:bg-navy-700 disabled:opacity-50 transition cursor-pointer"
              >
                {updatingRole ? (
                  <FaSpinner className="animate-spin" size={13} />
                ) : (
                  <FiCheck size={14} />
                )}
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-xs p-4">
          <div className="bg-paper border border-line rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-navy-900 mb-2">Hapus Pengguna</h3>
            <p className="text-sm text-ink-600 mb-4">
              Apakah Anda yakin ingin menghapus akun{" "}
              <strong className="text-navy-900">{deletingUser.name}</strong> (
              <span className="font-mono text-xs">{deletingUser.email}</span>)?
              Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line-soft">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-ink-600 hover:bg-navy-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteUser}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition cursor-pointer"
              >
                {isDeleting ? (
                  <FaSpinner className="animate-spin" size={13} />
                ) : (
                  <FiTrash2 size={14} />
                )}
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

