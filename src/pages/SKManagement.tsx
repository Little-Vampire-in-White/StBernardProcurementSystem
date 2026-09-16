import { useEffect, useState } from "react";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../lib/api";

type Barangay = { id: number; name: string; seal_url?: string | null };

const allBarangaySKRoles = new Set(["SKBookkeeper", "MunicipalAccountant", "Administrator"]);

export default function SKManagement() {
  const apiFetch = useApi();
  const { profile } = useAuth();
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/barangays')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load SK units.');
        const allBarangays = data.barangays || [];
        setBarangays(allBarangaySKRoles.has(profile?.role || '')
          ? allBarangays
          : allBarangays.filter((barangay: Barangay) => barangay.id === profile?.barangayId));
      })
      .catch((loadError) => setError(loadError.message));
  }, [apiFetch, profile?.barangayId, profile?.role]);

  const municipalityWide = allBarangaySKRoles.has(profile?.role || '');

  return <>
    <PageMeta title="SK Management | E-Procurement" description="Sangguniang Kabataan units and budgeting access." />
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Sangguniang Kabataan Management</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{municipalityWide ? 'View SK units across all barangays.' : 'View your assigned barangay SK unit.'}</p>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!error && barangays.length === 0 && <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950">No SK units are available yet. Add a barangay first.</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {barangays.map((barangay) => <div key={barangay.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center gap-3">
            {barangay.seal_url ? <img src={barangay.seal_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">SK</div>}
            <div><h2 className="font-semibold text-gray-900 dark:text-white">Barangay {barangay.name} SK</h2><p className="text-sm text-gray-500">SK budgeting and records</p></div>
          </div>
        </div>)}
      </div>
    </div>
  </>;
}
