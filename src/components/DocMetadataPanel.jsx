// src/components/DocMetadataPanel.jsx
//
// Shown to DRAFTER (and ENGINEER/ADMIN) before downloading the Draft document.
// Allows filling in document metadata: applicant, address, standard, location, notes.
//
// Props:
//   reportId   {number}
//   report     {object}  - the full report object (contains doc_* fields)
//   userRole   {string}
//   onUpdate   {fn}      - called with updated report after save

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FaSave, FaFileWord, FaSpinner } from 'react-icons/fa';
import apiClient from '../api';

export default function DocMetadataPanel({ reportId, report, userRole, onUpdate }) {
    const [form, setForm] = useState({
        applicant: '',
        address:   '',
        standard:  '',
        location:  'Laboratorium PT. SUCOFINDO',
        notes:     '',
    });
    const [saving, setSaving]         = useState(false);
    const [downloading, setDownloading] = useState(false);

    const canEdit = ['DRAFTER', 'ENGINEER', 'ADMIN'].includes(userRole);

    useEffect(() => {
        if (!report) return;
        setForm({
            applicant: report.doc_applicant || report.sample?.order?.applicant || '',
            address:   report.doc_address   || report.sample?.order?.address   || '',
            standard:  report.doc_standard  || report.sample?.testStandard?.name || '',
            location:  report.doc_location  || 'Laboratorium PT. SUCOFINDO',
            notes:     report.doc_notes     || '',
        });
    }, [report]);

    function update(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function handleSave() {
        setSaving(true);
        try {
            const res = await apiClient.patch(`/reports/${reportId}/doc-metadata`, form);
            toast.success('Metadata dokumen disimpan.');
            onUpdate && onUpdate(res.data);
        } catch (e) {
            toast.error('Gagal menyimpan metadata.');
        } finally {
            setSaving(false);
        }
    }

    async function handleDownloadDraft() {
        setDownloading(true);
        try {
            const res = await apiClient.get(`/reports/${reportId}/download/draft`, {
                responseType: 'blob',
            });
            const url  = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href  = url;
            link.setAttribute('download', `DRAFT-${reportId}.docx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (e) {
            toast.error('Gagal mengunduh Draft.');
        } finally {
            setDownloading(false);
        }
    }

    const fields = [
        { key: 'applicant', label: 'Aplikan / Pemohon', placeholder: 'Nama perusahaan pemohon' },
        { key: 'address',   label: 'Alamat',            placeholder: 'Alamat pemohon' },
        { key: 'standard',  label: 'Standar',           placeholder: 'e.g. SNI IEC 62560:2015' },
        { key: 'location',  label: 'Lokasi Pengujian',  placeholder: 'Laboratorium PT. SUCOFINDO' },
        { key: 'notes',     label: 'Keterangan',        placeholder: 'Laporan ini bukan Sertifikat Produk', isTextarea: true },
    ];

    return (
        <div className="bg-white border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
                Metadata Dokumen
            </h3>

            <div className="space-y-3">
                {fields.map(f => (
                    <div key={f.key}>
                        <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                        {f.isTextarea ? (
                            <textarea
                                value={form[f.key]}
                                onChange={e => update(f.key, e.target.value)}
                                disabled={!canEdit}
                                placeholder={f.placeholder}
                                rows={3}
                                className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                            />
                        ) : (
                            <input
                                type="text"
                                value={form[f.key]}
                                onChange={e => update(f.key, e.target.value)}
                                disabled={!canEdit}
                                placeholder={f.placeholder}
                                className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                            />
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-3 border-t flex gap-2">
                {canEdit && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 border rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        {saving
                            ? <FaSpinner className="animate-spin" size={11} />
                            : <FaSave size={11} />}
                        Simpan
                    </button>
                )}
                <button
                    onClick={handleDownloadDraft}
                    disabled={downloading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white rounded text-sm hover:bg-sky-700 disabled:opacity-50"
                >
                    {downloading
                        ? <FaSpinner className="animate-spin" size={11} />
                        : <FaFileWord size={11} />}
                    Download Draft
                </button>
            </div>
        </div>
    );
}
