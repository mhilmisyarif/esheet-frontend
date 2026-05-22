// src/components/StatusBadge.jsx
// Updated: removed REJECTED and REVISED, added IN_PROGRESS

export default function StatusBadge({ status }) {
    const config = {
        DRAFT:       { label: 'Draft',       bg: 'bg-gray-100',    text: 'text-gray-600'   },
        IN_PROGRESS: { label: 'Sedang Diuji', bg: 'bg-blue-100',   text: 'text-blue-700'   },
        SUBMITTED:   { label: 'Direview',    bg: 'bg-sky-100',     text: 'text-sky-700'    },
        APPROVED:    { label: 'Disetujui',   bg: 'bg-emerald-100', text: 'text-emerald-800'},
    };

    // Per-klausul statuses (used in KlausulStatus context)
    const klausulConfig = {
        DRAFT:     { label: 'Draft',      bg: 'bg-gray-100',    text: 'text-gray-600'  },
        SUBMITTED: { label: 'Direview',   bg: 'bg-amber-100',   text: 'text-amber-700' },
        APPROVED:  { label: 'Disetujui',  bg: 'bg-emerald-100', text: 'text-emerald-800'},
    };

    const c = config[status] || klausulConfig[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-500' };

    return (
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
            {c.label}
        </span>
    );
}
