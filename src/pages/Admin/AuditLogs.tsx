import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useApi } from "../../lib/api";

export default function AuditLogs() {
  const apiFetch = useApi();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLogs() {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/audit-logs?limit=200');
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Unable to load audit logs.');
        return;
      }
      setLogs(data.auditLogs || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load audit logs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <>
      <PageMeta title="Audit Trail | E-Procurement" description="View the secure audit trail for procurement operations." />
      <div className="grid gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Audit Trail</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Review approved actions, document uploads, and security events in the procurement system.
            </p>
          </div>
          <button
            className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            onClick={loadLogs}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Target ID</th>
                  <th className="px-4 py-3">IP Address</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
                      {loading ? 'Loading audit records…' : 'No audit records found.'}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {log.user?.display_name || log.user?.email || log.actor_name || log.actor_email || 'System'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{log.action}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{log.target_table || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{log.target_id || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{log.ip_address || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        <pre className="whitespace-pre-wrap break-words text-xs text-gray-500 dark:text-gray-400">
                          {log.details ? JSON.stringify(log.details, null, 0) : '-' }
                        </pre>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
