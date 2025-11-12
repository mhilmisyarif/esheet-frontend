// src/mocks/api.js
import klausulData from '../data/klausul_dummy_per_butir.json';

// create in-memory copy
const DB = {
    orders: [
        {
            id: 'order-001',
            order_no: 'CBT/3801/20-104-01/000038/01/2025-1',
            iwo_no: 'SER.IWO.25.6981',
            applicant: 'PT MEGA CAKRA NUSANTARA',
            applicant_address: 'SOVOISM Office Building Jl. Dr. Cipto No.20, Semarang',
            created_at: '2025-10-03',
            samples: [
                {
                    id: 'sample-001',
                    name: 'Lampu LED Swa-Balast',
                    brand: 'KISEKI',
                    model: 'CKLB 13W',
                    identifier: '180-265V~ / 50/60Hz / 13W'
                },
                {
                    id: 'sample-002',
                    name: 'Luminer Magun',
                    brand: 'MAGUN',
                    model: 'LMG-45',
                    identifier: '220V / 50Hz / 45W'
                }
            ]
        }
    ],
    // reports: per sample id create copy of klausulData
    reports: {}
};

// initialize reports by copying klausul template
DB.orders.forEach(order => {
    order.samples.forEach(sample => {
        const snapshot = JSON.parse(JSON.stringify(klausulData));
        // add metadata fields per butir: hasil_catatan, keputusan, last_modified_*
        snapshot.forEach(k => {
            k.sub_klausul.forEach(s => {
                s.butir.forEach(b => {
                    b.hasil_catatan = '';
                    b.keputusan = null;
                    b.last_modified_by = null;
                    b.last_modified_at = null;
                });
            });
        });
        DB.reports[sample.id] = {
            id: `report-${sample.id}`,
            sample_id: sample.id,
            sample,
            order_id: order.id,
            klausul: snapshot,
            created_at: new Date().toISOString()
        };
    });
});

// Mock delay helper
function delay(ms = 250) {
    return new Promise((res) => setTimeout(res, ms));
}

// const delay = (t) => new Promise(r => setTimeout(r, t));
// Tambahkan fungsi penyimpanan gambar (gallery)
async function updateImages(sampleId, imagesArray = []) {
    await delay(250);
    const report = DB.reports[sampleId];
    if (!report) throw new Error('Report not found');
    report.images = JSON.parse(JSON.stringify(imagesArray));
    console.log('mock updateImages', { sampleId, imagesArray });
    return { ok: true };
}

// Re-declare export agar fungsi baru ikut
export default {
    async getOrders() {
        await delay();
        return DB.orders;
    },

    async getReportBySampleId(sampleId) {
        await delay();
        const r = DB.reports[sampleId];
        if (!r) throw new Error('Report not found');
        return JSON.parse(JSON.stringify(r));
    },

    async updateButir(sampleId, klausulCode, butirKode, payload) {
        await delay();
        const report = DB.reports[sampleId];
        if (!report) throw new Error('Report not found');

        let found = false;
        report.klausul.forEach(k => {
            if (k.klausul === klausulCode) {
                k.sub_klausul.forEach(s => {
                    s.butir.forEach(b => {
                        if (b.kode === butirKode) {
                            if ('hasil_catatan' in payload) b.hasil_catatan = payload.hasil_catatan;
                            if ('keputusan' in payload) b.keputusan = payload.keputusan;
                            b.last_modified_by = payload.by || 'demo-user';
                            b.last_modified_at = new Date().toISOString();
                            found = true;
                        }
                    });
                });
            }
        });

        if (!found) throw new Error('Butir not found');
        return { ok: true };
    },

    async bulkUpdate(sampleId, updates = []) {
        await delay();
        for (const u of updates) {
            await this.updateButir(sampleId, u.klausulCode, u.butirKode, u);
        }
        return { ok: true };
    },

    async updateKlausulMeta(sampleId, klausulCode, metaObj) {
        await delay(300);
        const report = DB.reports[sampleId];
        if (!report) throw new Error('Report not found');
        const klausul = report.klausul.find(k => k.klausul === klausulCode);
        if (klausul) {
            klausul.meta = { ...(klausul.meta || {}), ...metaObj };
        }
        console.log('mock updateKlausulMeta', { sampleId, klausulCode, metaObj });
        return { ok: true };
    },

    async saveKlausulTables(sampleId, klausulCode, tables) {
        await delay(300);
        const report = DB.reports[sampleId];
        if (!report) throw new Error('Report not found');
        const klausul = report.klausul.find(k => k.klausul === klausulCode);
        if (klausul) klausul.tables = JSON.parse(JSON.stringify(tables));
        console.log('mock save tables', { sampleId, klausulCode, tables });
        return { ok: true };
    },

    async uploadImage(sampleId, file) {
        await delay(500);
        const id = 'img-' + Math.random().toString(36).slice(2, 9);
        const url = `/mock_uploads/${id}_${file.name}`;
        const report = DB.reports[sampleId];
        if (!report.images) report.images = [];
        report.images.push({ id, url, caption: '' });
        console.log('mock upload', { sampleId, file, url });
        return { ok: true, id, url };
    },

    async deleteImage(sampleId, imageId) {
        await delay(200);
        const report = DB.reports[sampleId];
        if (!report || !report.images) return { ok: true };
        report.images = report.images.filter(img => img.id !== imageId);
        console.log('mock delete', { sampleId, imageId });
        return { ok: true };
    },

    async updateImages(sampleId, imagesArray) {
        return updateImages(sampleId, imagesArray);
    }
};
