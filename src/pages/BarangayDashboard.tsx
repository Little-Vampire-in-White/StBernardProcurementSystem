import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import PageMeta from "../components/common/PageMeta";
import { useApi } from "../lib/api";

type DashboardData = {
  barangay: { id: number; name: string; seal_url?: string | null };
  fiscalYear: number;
  budget: { allocation: number; obligated: number; remaining: number; utilization: number };
  analytics: { transactionCount: number; pendingCount: number; approvedCount: number; disbursedCount: number; documentCount: number };
  liquidation: { awaiting: number; liquidated: number; outstanding: number };
  transactions: Array<{ id: number; request_uuid: string; title: string; amount: number; status: string; updated_at: string; creator?: { display_name?: string | null; email?: string } }>;
  documents: Array<{ id: number; doc_type: string; file_path?: string | null; uploaded_at?: string | null; request_uuid: string; request_title: string }>;
};

const pesos = (amount: number) => `₱${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BarangayDashboard() {
  const { barangayId } = useParams();
  const apiFetch = useApi();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!barangayId) return;
    apiFetch(`/api/barangays/${barangayId}/dashboard`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load barangay dashboard.');
        setDashboard(data);
      })
      .catch((loadError) => setError(loadError.message || 'Unable to load barangay dashboard.'))
      .finally(() => setLoading(false));
  }, [apiFetch, barangayId]);

  return <>
    <PageMeta title="Barangay Dashboard | E-Procurement" description="Barangay procurement, budget, records, and liquidation dashboard." />
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><Link to="/barangay-management" className="text-sm font-medium text-brand-600">← Barangay Management</Link><h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{dashboard ? `Barangay ${dashboard.barangay.name} Dashboard` : 'Barangay Dashboard'}</h1><p className="mt-1 text-sm text-gray-500">Procurement records, budget tracking, analytics, documents, and liquidation status.</p></div>
      </div>
      {loading && <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">Loading dashboard…</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}
      {dashboard && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[['Budget allocation', pesos(dashboard.budget.allocation)], ['Obligated amount', pesos(dashboard.budget.obligated)], ['Available balance', pesos(dashboard.budget.remaining)], ['Budget used', `${Math.round(dashboard.budget.utilization)}%`]].map(([label, value]) => <div key={label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{value}</p></div>)}
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Procurement Analytics</h2><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-gray-50 p-4"><p className="text-gray-500">Transactions</p><p className="mt-1 text-xl font-semibold">{dashboard.analytics.transactionCount}</p></div><div className="rounded-lg bg-yellow-50 p-4"><p className="text-yellow-700">Pending</p><p className="mt-1 text-xl font-semibold">{dashboard.analytics.pendingCount}</p></div><div className="rounded-lg bg-green-50 p-4"><p className="text-green-700">Approved</p><p className="mt-1 text-xl font-semibold">{dashboard.analytics.approvedCount}</p></div><div className="rounded-lg bg-blue-50 p-4"><p className="text-blue-700">Disbursed</p><p className="mt-1 text-xl font-semibold">{dashboard.analytics.disbursedCount}</p></div></div></section>
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Liquidation Tracking</h2><p className="mt-1 text-sm text-gray-500">Amounts are derived from approved and disbursed purchase requests.</p><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span>Awaiting liquidation</span><strong>{pesos(dashboard.liquidation.awaiting)}</strong></div><div className="flex justify-between"><span>Disbursed / settled</span><strong>{pesos(dashboard.liquidation.liquidated)}</strong></div><div className="flex justify-between border-t pt-3"><span>Outstanding</span><strong>{pesos(dashboard.liquidation.outstanding)}</strong></div></div></section>
        </div>
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">All Barangay Transactions</h2><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b text-xs uppercase text-gray-500"><tr><th className="px-3 py-3">Tracking</th><th className="px-3 py-3">Title</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Updated</th></tr></thead><tbody className="divide-y">{dashboard.transactions.map((transaction) => <tr key={transaction.id}><td className="px-3 py-3">{transaction.request_uuid}</td><td className="px-3 py-3"><p className="font-medium">{transaction.title}</p><p className="text-xs text-gray-500">{transaction.creator?.display_name || transaction.creator?.email || 'Unknown'}</p></td><td className="px-3 py-3">{pesos(transaction.amount)}</td><td className="px-3 py-3">{transaction.status}</td><td className="px-3 py-3">{new Date(transaction.updated_at).toLocaleDateString()}</td></tr>)}{!dashboard.transactions.length && <tr><td className="px-3 py-4 text-gray-500" colSpan={5}>No transactions recorded.</td></tr>}</tbody></table></div></section>
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Document Archive</h2><p className="mt-1 text-sm text-gray-500">{dashboard.analytics.documentCount} uploaded document(s) across this barangay’s purchase requests.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{dashboard.documents.map((document) => <div key={document.id} className="rounded-lg border border-gray-200 p-3 text-sm"><p className="font-medium">{document.doc_type}</p><p className="mt-1 text-xs text-gray-500">{document.request_title} · {document.request_uuid}</p>{document.file_path && <a className="mt-2 inline-block text-brand-600" href={`/${document.file_path}`} target="_blank" rel="noreferrer">Open document</a>}</div>)}{!dashboard.documents.length && <p className="text-sm text-gray-500">No archived documents yet.</p>}</div></section>
      </>}
    </div>
  </>;
}
