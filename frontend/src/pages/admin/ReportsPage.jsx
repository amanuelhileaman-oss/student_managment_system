import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import DataTable from '../../components/common/DataTable';
import Badge from '../../components/common/Badge';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Download, BarChart3, Layers, Award } from 'lucide-react';

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('capacity');
  const [capacityData, setCapacityData] = useState([]);
  const [promotionData, setPromotionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [capRes, promoRes] = await Promise.all([
        api.get('/reports/capacity'),
        api.get('/reports/promotion'),
      ]);
      setCapacityData(capRes.data.data || capRes.data);
      setPromotionData(promoRes.data.data || promoRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const downloadCsv = async (endpoint, filename) => {
    try {
      const response = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to download CSV export.');
    }
  };

  const capacityColumns = [
    {
      header: 'Grade & Section',
      render: (r) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          Grade {r.grade_level} — Section {r.section_name}
        </span>
      ),
    },
    { header: 'Stream', accessor: 'stream_name' },
    { header: 'Capacity', accessor: 'capacity' },
    { header: 'Enrolled', accessor: 'enrolled_count' },
    { header: 'Remaining Seats', accessor: 'remaining_seats' },
    {
      header: 'Utilization',
      render: (r) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {r.utilization_pct}%
        </span>
      ),
    },
    {
      header: 'Status',
      render: (r) => (
        <Badge variant={r.status === 'FULL' ? 'danger' : 'success'} size="sm">
          {r.status}
        </Badge>
      ),
    },
  ];

  const promotionColumns = [
    {
      header: 'Student',
      render: (r) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100 block">
            {r.first_name} {r.last_name}
          </span>
          <span className="text-xs font-mono text-slate-400">{r.student_id}</span>
        </div>
      ),
    },
    {
      header: 'Current Placement',
      render: (r) => `Grade ${r.current_grade_level || 'N/A'} — Section ${r.section_name || 'N/A'}`,
    },
    { header: 'Stream', accessor: 'stream_name' },
    {
      header: 'Cumulative Average',
      render: (r) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {r.average_score ? `${r.average_score}%` : 'N/A'}
        </span>
      ),
    },
    {
      header: 'Promotion Status',
      render: (r) => (
        <Badge
          variant={r.academic_promotion_status === 'PROMOTED' ? 'success' : 'danger'}
          size="sm"
        >
          {r.academic_promotion_status}
        </Badge>
      ),
    },
  ];

  if (loading) return <LoadingSpinner message="Generating academic reports and analytics..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Administrative Reports & Official Exports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Real-time institutional reporting on section seat utilization and annual academic promotion status.
          </p>
        </div>

        <div>
          {activeTab === 'capacity' ? (
            <button
              onClick={() => downloadCsv('/reports/capacity/csv', 'section-capacity-report.csv')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Capacity CSV
            </button>
          ) : (
            <button
              onClick={() => downloadCsv('/reports/promotion/csv', 'student-promotion-report.csv')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Promotion CSV
            </button>
          )}
        </div>
      </div>

      {error && <Alert type="error" title="Report Error" message={error} onClose={() => setError('')} />}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('capacity')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'capacity'
              ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400 font-bold shadow-sm'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Section Capacity Report ({capacityData.length})
        </button>
        <button
          onClick={() => setActiveTab('promotion')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'promotion'
              ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400 font-bold shadow-sm'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          Academic Promotion Report ({promotionData.length})
        </button>
      </div>

      {activeTab === 'capacity' ? (
        <DataTable
          columns={capacityColumns}
          data={capacityData}
          searchPlaceholder="Filter sections or streams..."
        />
      ) : (
        <DataTable
          columns={promotionColumns}
          data={promotionData}
          searchPlaceholder="Search student name or ID..."
        />
      )}
    </div>
  );
};

export default ReportsPage;
