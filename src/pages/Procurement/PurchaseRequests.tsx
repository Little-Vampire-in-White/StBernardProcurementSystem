import { useState, useEffect } from "react";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import { useAuth } from "../../context/AuthContext";
import { useApi } from "../../lib/api";
import { downloadCsv } from "../../lib/download";
import DocumentUploadModal from "../../components/procurement/DocumentUploadModal";

export default function PurchaseRequests() {
  const { profile } = useAuth();
  const apiFetch = useApi();
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newBarangayId, setNewBarangayId] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  async function loadRequests(){
    try{
      const res = await apiFetch('/api/requests');
      const data = await res.json();
      if (res.ok && data.requests) {
        setRequests(
          data.requests.map((req: any) => ({
            id: req.id,
            tracking: req.request_uuid,
            department: String(req.barangay_id || "N/A"),
            total: `₱${Number(req.amount).toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            status: req.status,
            documentCount: req.documentCount || 0,
            uploadedCount: req.uploadedCount || 0,
            compliant: !!req.compliant,
          }))
        );
      }
    }catch(err){
      console.warn(err);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function createRequest(){
    setCreateError(null);
    if (!newTitle || !newAmount) {
      setCreateError('Title and amount are required.');
      return;
    }
    setCreateLoading(true);
    try{
      const payload = {
        title: newTitle,
        description: newDescription,
        amount: Number(newAmount),
        barangay_id: newBarangayId ? Number(newBarangayId) : null,
      };
      const res = await apiFetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data?.error || 'Unable to create request.');
        return;
      }
      setCreateOpen(false);
      setNewTitle('');
      setNewAmount('');
      setNewDescription('');
      setNewBarangayId('');
      await loadRequests();
    } catch (err:any) {
      setCreateError(err?.message || 'Unable to create request.');
    } finally {
      setCreateLoading(false);
    }
  }

  async function exportRequests() {
    setExportLoading(true);

    try {
      const res = await apiFetch('/api/exports/requests');
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Unable to export requests.');
      }

      const csv = await res.text();
      downloadCsv(csv, `procurement-requests-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err: any) {
      alert(err?.message || 'Unable to export requests.');
    } finally {
      setExportLoading(false);
    }
  }

  const canCreateRequest = ['Administrator', 'FinanceManager', 'BarangayStaff'].includes(profile?.role ?? 'Guest');
  const canExportRequests = ['Administrator', 'BudgetOfficer'].includes(profile?.role ?? 'Guest');

  return (
    <>
      <PageMeta
        title="Purchase Requests | E-Procurement"
        description="Create and manage purchase requests for the Saint Bernard LGU."
      />
      <div className="grid gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Purchase Requests
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create new purchase requests and review current submissions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-brand-500 hover:bg-brand-600"
              disabled={!canExportRequests || exportLoading}
              onClick={exportRequests}
            >
              {exportLoading ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button
              size="sm"
              className={`${
                canCreateRequest
                  ? "bg-brand-500 hover:bg-brand-600"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
              disabled={!canCreateRequest}
              onClick={() => setCreateOpen(true)}
            >
              New Request
            </Button>
          </div>
        </div>

        {profile?.role === "Auditor" && (
          <div className="rounded-3xl border border-gray-200 bg-yellow-50 p-4 text-sm text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/10 dark:text-yellow-200">
            Auditors have read-only access. Request creation and edit controls are disabled.
          </div>
        )}

        <div className="overflow-x-auto rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <table className="min-w-[760px] divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4">Tracking Number</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Total Cost</th>
                <th className="px-6 py-4">Uploaded Docs</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {requests.map((request) => (
                <tr key={request.tracking} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    {request.tracking}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {request.department}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {request.total}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {request.uploadedCount}/12
                  </td>
                  <td className="px-6 py-4 text-sm text-brand-600 dark:text-brand-400">
                    {request.status}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedRequest(request.id);
                          setModalOpen(true);
                        }}
                        className="text-blue-600"
                      >
                        Documents
                      </button>
                      {(profile?.role === "Administrator" || profile?.role === "FinanceManager") && (
                        <button
                          disabled={!request.compliant}
                          onClick={async () => {
                            const res = await apiFetch("/api/approvals", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ request_id: request.id, action: 'approve' }),
                            });
                            if (res.ok) {
                              alert("Approved");
                              await loadRequests();
                            } else {
                              const j = await res.json();
                              alert(j.error || "Failed");
                            }
                          }}
                          className={`px-3 py-1 rounded ${request.compliant ? "bg-green-600 text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
                        >
                          Approve ({request.uploadedCount}/12)
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <DocumentUploadModal requestId={selectedRequest} open={modalOpen} onClose={() => { setModalOpen(false); loadRequests(); }} onUploaded={() => loadRequests()} />
      <Modal isOpen={createOpen} onClose={()=>setCreateOpen(false)} title="Create Purchase Request">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input value={newTitle} onChange={(e)=>setNewTitle(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount</label>
            <input value={newAmount} onChange={(e)=>setNewAmount(e.target.value)} type="number" step="0.01" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Barangay ID</label>
            <input value={newBarangayId} onChange={(e)=>setNewBarangayId(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea value={newDescription} onChange={(e)=>setNewDescription(e.target.value)} rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          {createError && <div className="text-sm text-red-600">{createError}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setCreateOpen(false)} className="bg-gray-200">Cancel</Button>
            <Button type="button" onClick={createRequest} disabled={createLoading} className="bg-brand-500">
              {createLoading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
