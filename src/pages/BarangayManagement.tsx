import { useEffect, useState } from "react";
import PageMeta from "../components/common/PageMeta";
import { useApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

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

export default function BarangayManagement() {
  const apiFetch = useApi();
  const { profile } = useAuth();
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  return <>
    <PageMeta title="Barangay Management | E-Procurement" description="Barangay and Bookkeeper assignments." />
    <div className="mx-auto max-w-5xl space-y-6">
      <div><h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Barangay Management</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{profile?.role === 'MunicipalAccountant' || profile?.role === 'Administrator' ? 'View every barangay and its assigned Barangay Bookkeeper.' : 'Manage financial records for the barangays assigned to you by the Municipal Accountant.'}</p></div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!error && barangays.length === 0 && <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950">No barangays are available.</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{barangays.map((barangay) => <div key={barangay.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950"><div className="flex items-center gap-3">{barangay.seal_url ? <img src={barangay.seal_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">{barangay.name.slice(0, 2).toUpperCase()}</div>}<div><h2 className="font-semibold text-gray-900 dark:text-white">{barangay.name}</h2><p className="text-sm text-gray-500">{profile?.role === 'MunicipalAccountant' || profile?.role === 'Administrator' ? 'Barangay Bookkeeper' : 'Assigned barangay'}</p></div></div>{(profile?.role === 'MunicipalAccountant' || profile?.role === 'Administrator') && <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">{barangay.assignedBookkeepers?.length ? barangay.assignedBookkeepers.map((bookkeeper) => <p key={bookkeeper.id}>{bookkeeper.display_name || bookkeeper.email}{bookkeeper.status !== 'active' ? ` (${bookkeeper.status})` : ''}</p>) : <p className="text-gray-500">No Bookkeeper assigned</p>}</div>}</div>)}</div>
    </div>
  </>;
}
