import { useEffect, useState } from "react";
import PageMeta from "../components/common/PageMeta";
import { useApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../components/ui/modal";
import { Link } from "react-router";

type Barangay = {
  id: number;
  name: string;
  seal_url?: string | null;
  assignedBookkeepers?: { id: number; display_name?: string | null; email: string; status: string }[];
};

type ManagedUser = {
  id: number;
  role: string;
  display_name?: string | null;
  email: string;
  status: string;
  assigned_barangays?: { id: number; name: string }[];
};

type BarangayDetails = {
  barangay: Barangay;
  bookkeepers: { id: number; display_name?: string | null; email: string; status: string }[];
  members: { id: number; display_name?: string | null; email: string; role: string; status: string }[];
  transactions: { id: number; request_uuid: string; title: string; amount: number; status: string; updated_at: string; creator?: { display_name?: string | null; email?: string } }[];
  activity: { id: number; timestamp: string; action: string; target_id: number; user?: { display_name?: string | null; email?: string } }[];
};

export default function BarangayManagement() {
  const apiFetch = useApi();
  const { profile } = useAuth();
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    const canViewAll = profile?.role === 'MunicipalAccountant' || profile?.role === 'Administrator';
    const loadBarangays = canViewAll
      ? Promise.all([apiFetch('/api/barangays'), apiFetch('/api/barangays/users')]).then(async ([barangayResponse, userResponse]) => {
        const barangayData = await barangayResponse.json();
        const userData = await userResponse.json();
        if (!barangayResponse.ok || !userResponse.ok) throw new Error(barangayData.error || userData.error || 'Unable to load barangays.');
        const bookkeepers = (userData.users || []).filter((user: ManagedUser) => user.role === 'BarangayBookkeeper');
        return (barangayData.barangays || []).map((barangay: Barangay) => ({
          ...barangay,
          assignedBookkeepers: bookkeepers
            .filter((bookkeeper: ManagedUser) => (bookkeeper.assigned_barangays || []).some((assignedBarangay) => assignedBarangay.id === barangay.id))
            .map((bookkeeper: ManagedUser) => ({ id: bookkeeper.id, display_name: bookkeeper.display_name, email: bookkeeper.email, status: bookkeeper.status })),
        }));
      })
      : apiFetch('/api/barangays/my-assignments').then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load barangays.');
        return data.barangays || [];
      });

    loadBarangays
      .then((data) => setBarangays(data))
      .catch((loadError) => setError(loadError.message));
  }, [apiFetch, profile?.role]);

  async function openBarangayDetails(barangayId: number) {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsError(null);
    setSelectedBarangay(null);
    try {
      const response = await apiFetch(`/api/barangays/${barangayId}/management-details`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load barangay details.');
      setSelectedBarangay(data);
    } catch (loadError: any) {
      setDetailsError(loadError.message || 'Unable to load barangay details.');
    } finally {
      setDetailsLoading(false);
    }
  }

  return <>
    <PageMeta title="Barangay Management | E-Procurement" description="Barangay and Bookkeeper assignments." />
    <div className="mx-auto max-w-5xl space-y-6">
      <div><h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Barangay Management</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{profile?.role === 'MunicipalAccountant' || profile?.role === 'Administrator' ? 'View every barangay and its assigned Barangay Bookkeeper.' : 'Manage financial records for the barangays assigned to you by the Municipal Accountant.'}</p></div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!error && barangays.length === 0 && <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950">No barangays are available.</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{barangays.map((barangay) => <button key={barangay.id} type="button" onClick={() => openBarangayDetails(barangay.id)} className="rounded-xl border border-gray-200 bg-white p-5 text-left transition hover:border-brand-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-950"><div className="flex items-center gap-3">{barangay.seal_url ? <img src={barangay.seal_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">{barangay.name.slice(0, 2).toUpperCase()}</div>}<div><h2 className="font-semibold text-gray-900 dark:text-white">{barangay.name}</h2><p className="text-sm text-gray-500">{profile?.role === 'MunicipalAccountant' || profile?.role === 'Administrator' ? 'Barangay Bookkeeper' : 'Assigned barangay'}</p></div></div>{(profile?.role === 'MunicipalAccountant' || profile?.role === 'Administrator') && <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">{barangay.assignedBookkeepers?.length ? barangay.assignedBookkeepers.map((bookkeeper) => <p key={bookkeeper.id}>{bookkeeper.display_name || bookkeeper.email}{bookkeeper.status !== 'active' ? ` (${bookkeeper.status})` : ''}</p>) : <p className="text-gray-500">No Bookkeeper assigned</p>}</div>}<p className="mt-4 text-sm font-medium text-brand-600">View barangay details →</p></button>)}</div>
      <Modal isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} title={selectedBarangay ? `Barangay ${selectedBarangay.barangay.name}` : 'Barangay details'} className="mx-4 max-w-3xl">
        {detailsLoading && <p className="text-sm text-gray-500">Loading barangay details…</p>}
        {detailsError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{detailsError}</p>}
        {selectedBarangay && <div className="max-h-[65vh] space-y-6 overflow-y-auto pr-1">
          <Link to={`/barangay-management/${selectedBarangay.barangay.id}/dashboard`} onClick={() => setDetailsOpen(false)} className="inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">View Barangay Dashboard</Link>
          <section><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Assigned Barangay Bookkeepers</h3><div className="mt-2 space-y-2 text-sm text-gray-600 dark:text-gray-300">{selectedBarangay.bookkeepers.length ? selectedBarangay.bookkeepers.map((bookkeeper) => <p key={bookkeeper.id}>{bookkeeper.display_name || bookkeeper.email} <span className="text-gray-400">{bookkeeper.email}</span></p>) : <p className="text-gray-500">No Barangay Bookkeeper assigned.</p>}</div></section>
          <section><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Barangay Members</h3><div className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">{selectedBarangay.members.length ? selectedBarangay.members.map((member) => <div key={member.id} className="flex items-center justify-between px-3 py-2 text-sm"><span>{member.display_name || member.email}</span><span className="text-gray-500">{member.role} · {member.status}</span></div>) : <p className="p-3 text-sm text-gray-500">No members assigned directly to this barangay.</p>}</div></section>
          <section><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Purchase Transactions</h3><div className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">{selectedBarangay.transactions.length ? selectedBarangay.transactions.map((transaction) => <div key={transaction.id} className="px-3 py-2 text-sm"><div className="flex justify-between gap-4"><span className="font-medium text-gray-800">{transaction.title}</span><span>₱{Number(transaction.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div><p className="mt-1 text-xs text-gray-500">{transaction.status} · {transaction.creator?.display_name || transaction.creator?.email || 'Unknown'} · {new Date(transaction.updated_at).toLocaleString()}</p></div>) : <p className="p-3 text-sm text-gray-500">No purchase transactions yet.</p>}</div></section>
          <section><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Activity</h3><div className="mt-2 space-y-2 text-sm text-gray-600">{selectedBarangay.activity.length ? selectedBarangay.activity.map((activity) => <p key={activity.id}>{activity.action.replace(/_/g, ' ')} by {activity.user?.display_name || activity.user?.email || 'Unknown'} · {new Date(activity.timestamp).toLocaleString()}</p>) : <p className="text-gray-500">No recorded transaction activity yet.</p>}</div></section>
        </div>}
      </Modal>
    </div>
  </>;
}
