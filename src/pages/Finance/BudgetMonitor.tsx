import { useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import { useAuth } from "../../context/AuthContext";
import { useApi } from "../../lib/api";
import { downloadCsv } from "../../lib/download";

export default function BudgetMonitor() {
  const apiFetch = useApi();
  const [departmentBudgets, setDepartmentBudgets] = useState<any[]>([]);
  const [barangayBudgets, setBarangayBudgets] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [obligated, setObligated] = useState(0);
  const [available, setAvailable] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  const { profile } = useAuth();

  const budgetMetrics = useMemo(
    () => [
      { label: "Total Budget", value: `₱${totalBudget.toLocaleString("en-PH")}` },
      { label: "Obligated", value: `₱${obligated.toLocaleString("en-PH")}` },
      { label: "Available", value: `₱${available.toLocaleString("en-PH")}` },
      { label: "Remaining", value: `₱${remaining.toLocaleString("en-PH")}` },
    ],
    [totalBudget, obligated, available, remaining]
  );

  const selectedRequests = useMemo(() => {
    if (!selectedDepartment) return [];
    return requests.filter((req) => req.department === selectedDepartment);
  }, [requests, selectedDepartment]);

  async function loadBudgetSummary() {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/budgets");
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Unable to load budget summary.");
        return;
      }

      setTotalBudget(Number(data.totalBudget || 0));
      setObligated(Number(data.obligated || 0));
      setAvailable(Number(data.available || 0));
      setRemaining(Number(data.remaining || 0));
      setDepartmentBudgets(data.departmentBudgets || []);
      setBarangayBudgets(data.barangayBudgets || []);
      setRequests(data.requests || []);
    } catch (err: any) {
      setError(err?.message || "Unable to load budget summary.");
      console.warn(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveBarangayBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSavingBudget(true);
    try {
      const res = await apiFetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barangay_id: Number(selectedBarangayId), amount: Number(budgetAmount) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to save barangay budget.');
      setBudgetAmount("");
      await loadBudgetSummary();
    } catch (err: any) {
      setError(err?.message || 'Unable to save barangay budget.');
    } finally {
      setSavingBudget(false);
    }
  }

  async function exportBudgetSummary() {
    setExportLoading(true);

    try {
      const res = await apiFetch('/api/exports/budgets');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Unable to export budget summary.');
      }

      const csv = await res.text();
      downloadCsv(csv, `budget-summary-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err: any) {
      alert(err?.message || 'Unable to export budget summary.');
    } finally {
      setExportLoading(false);
    }
  }

  useEffect(() => {
    loadBudgetSummary();
  }, []);

  const canExportBudget = ['Administrator', 'BudgetOfficer', 'FinanceManager'].includes(profile?.role ?? 'Guest');

  return (
    <>
      <PageMeta
        title="Budget Monitor | E-Procurement"
        description="Real-time budget tracking and encumbrance monitoring for LGU departments."
      />
      <div className="grid gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Budget Monitoring
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {profile?.role === 'FinanceManager'
                ? `Track the allocation and utilization for ${profile.barangayName || 'your barangay'}.`
                : 'Create and monitor budget allocations for every barangay.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-gray-700"
              disabled={!canExportBudget || exportLoading}
              onClick={exportBudgetSummary}
            >
              {exportLoading ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button size="sm" className="bg-brand-500 hover:bg-brand-600" onClick={loadBudgetSummary}>
              Refresh Data
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/10 dark:text-red-200">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-3xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            Loading budget summary...
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {budgetMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"
            >
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {metric.label}
              </p>
              <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        {profile?.role === 'Administrator' && (
          <form onSubmit={saveBarangayBudget} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Set Barangay Budget</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Saving a budget again updates this barangay's current-year allocation.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <select required value={selectedBarangayId} onChange={(event) => setSelectedBarangayId(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                <option value="">Select barangay</option>
                {barangayBudgets.map((budget) => <option key={budget.barangay_id} value={budget.barangay_id}>{budget.barangay_name}</option>)}
              </select>
              <input required min="0" step="0.01" type="number" value={budgetAmount} onChange={(event) => setBudgetAmount(event.target.value)} placeholder="Budget amount" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <Button type="submit" size="sm" disabled={savingBudget}>{savingBudget ? 'Saving...' : 'Save budget'}</Button>
            </div>
          </form>
        )}

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Barangay Budget Allocation</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-800"><tr><th className="px-3 py-3">Barangay</th><th className="px-3 py-3">Allocation</th><th className="px-3 py-3">Utilized</th><th className="px-3 py-3">Remaining</th><th className="px-3 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {barangayBudgets.map((budget) => <tr key={budget.barangay_id}><td className="px-3 py-3 font-medium text-gray-900 dark:text-white">Barangay {budget.barangay_name}</td><td className="px-3 py-3">₱{Number(budget.allocation).toLocaleString('en-PH')}</td><td className="px-3 py-3">₱{Number(budget.spent).toLocaleString('en-PH')}</td><td className="px-3 py-3">₱{Number(budget.remaining).toLocaleString('en-PH')}</td><td className="px-3 py-3">{budget.atRisk ? 'Over budget' : `${Math.round(budget.utilization)}% used`}</td></tr>)}
                {barangayBudgets.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-gray-500">No barangay budget has been assigned.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Department Budget Drill-down
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Review allocations and request commitments for each department, and open a request detail drill-down.
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-800">
            <div className="grid gap-4 p-4 text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400 md:grid-cols-5">
              <div>Department</div>
              <div>Allocation</div>
              <div>Spent</div>
              <div>Remaining</div>
              <div>Status</div>
            </div>
            <div className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {departmentBudgets.map((dept) => (
                <div key={dept.name} className="grid gap-4 p-4 md:grid-cols-5">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{dept.name}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDepartment(dept.name);
                        setModalOpen(true);
                      }}
                      className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                    >
                      View requests
                    </button>
                  </div>
                  <div className="text-gray-700 dark:text-gray-300">
                    ₱{dept.allocation.toLocaleString("en-PH")}
                  </div>
                  <div className="text-gray-700 dark:text-gray-300">
                    ₱{dept.spent.toLocaleString("en-PH")}
                  </div>
                  <div className="text-gray-700 dark:text-gray-300">
                    ₱{dept.remaining.toLocaleString("en-PH")}
                  </div>
                  <div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        dept.atRisk
                          ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-200"
                          : "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-200"
                      }`}
                    >
                      {dept.atRisk ? "Over Budget" : `${Math.round(dept.utilization)}% used`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-brand-50 p-5 text-sm text-brand-700 shadow-sm dark:border-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
            {available < 0 ? (
              <>
                Warning: total requested spend is above the configured budget by
                <span className="font-semibold"> ₱{Math.abs(available).toLocaleString("en-PH")}</span>.
              </>
            ) : (
              <>Budget utilization and request commitments are within the current available balance.</>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedDepartment ? `Requests for ${selectedDepartment}` : "Department Requests"}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {selectedDepartment || "Department"}
              </p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                Showing {selectedRequests.length} matching purchase request(s).
              </p>
            </div>
            <Button size="sm" className="bg-gray-200 text-gray-700" onClick={() => setModalOpen(false)}>
              Close
            </Button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <table className="min-w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-3">Tracking</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {selectedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      No request data available for this department.
                    </td>
                  </tr>
                ) : (
                  selectedRequests.map((request) => (
                    <tr key={request.id}>
                      <td className="px-3 py-4 font-medium text-gray-900 dark:text-white">
                        {request.request_uuid}
                      </td>
                      <td className="px-3 py-4 text-gray-700 dark:text-gray-300">
                        ₱{Number(request.amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-4 text-sm text-brand-600 dark:text-brand-400">
                        {request.status}
                      </td>
                      <td className="px-3 py-4 text-gray-500 dark:text-gray-400">
                        {new Date(request.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </>
  );
}
