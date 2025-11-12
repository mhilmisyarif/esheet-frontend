// src/pages/ReportPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../mocks/api';
import KlausulButirTable from '../components/KlausulButirTable';

export default function ReportPage() {
  const { sampleId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.getReportBySampleId(sampleId).then(r => {
      if (mounted) {
        setReport(r);
        setLoading(false);
      }
    }).catch(() => setLoading(false));
    return () => (mounted = false);
  }, [sampleId]);

  if (loading) return <div>Loading report...</div>;
  if (!report) return <div>Report not found</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Report — {report.sample.name}</h2>
          <div className="text-sm text-gray-600">{report.sample.brand} • {report.sample.model}</div>
        </div>
        <div>
          <Link to={`/orders/${report.order_id}`} className="text-sm text-sky-600">Back to Order</Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <KlausulButirTable report={report} />
      </div>
    </div>
  );
}
