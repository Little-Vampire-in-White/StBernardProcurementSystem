import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import DocumentUploadModal from "../../components/procurement/DocumentUploadModal";
import { useAuth } from "../../context/AuthContext";
import { useApi } from "../../lib/api";
import { downloadCsv } from "../../lib/download";

const categoryMeta = {
  procurement: {
    label: "Procurement",
    type: "sk_procurement",
    description: "Procurement transactions for SK purchases and acquisition activities.",
  },
  "programs-and-activities": {
    label: "Programs and/or Activities",
    type: "sk_programs_activities",
    description: "Program implementation, activity execution, and event-related expense requests.",
  },
  projects: {
    label: "Projects",
    type: "sk_projects",
    description: "Infrastructure or project-based requests, including labor and completion requirements.",
  },
  honorarium: {
    label: "Honorarium",
    type: "sk_honorarium",
    description: "Honorarium claims and remuneration payments for SK members and officers.",
  },
  travel: {
    label: "Travel",
    type: "sk_travel",
    description: "Travel orders, itineraries, and transport-related SK expenses.",
  },
} as const;

const requirementMap = {
  sk_procurement: [
    "Photocopy of Check",
    "Disbursement Voucher (DV)",
    "Request for Obligation of Appropriations (ROA)",
    "Official Receipt (OR) from the Supplier (winning bidder)",
    "Purchase Order (PO)",
    "Acceptance and Inspection Report (AIR)",
    "BAC Resolution",
    "Abstract of Canvass",
    "Canvasses",
    "Purchase Request (PR)",
    "Documentation (Photo of Material Purchase)",
    "Attachment of the winning bidder (Updated Business Permit, Philgeps, DTI, BIR 2303)",
  ],
  sk_programs_activities: [
    "Photocopy of Check",
    "Disbursement Voucher (DV)",
    "Request for Obligation of Appropriations (ROA)",
    "Payroll (for each activity)",
    "Activity Design",
    "Documentation of Programs and/or Activities",
    "Resolution of Augmentation of Appropriation, if applicable (Shortage of Fund)",
  ],
  sk_projects: [
    "Photocopy of Check",
    "Disbursement Voucher (DV)",
    "Request for Obligation of Appropriations (ROA)",
    "Purchase Order (PO)",
    "BAC Resolution",
    "Official Receipt (OR) from the Supplier (winning bidder)",
    "Abstract of Canvass",
    "Canvasses",
    "Purchase Request",
    "Program of Works (POW), if there is labor indicated in the project",
    "Documentation (Photos of the project before, during and after)",
    "Attachment of the winning bidder (Updated Business Permit, Philgeps, DTI, BIR 2303)",
  ],
  sk_honorarium: [
    "Photocopy of Check",
    "Disbursement Voucher (DV)",
    "Request for Obligation of Appropriations (ROA)",
    "Payroll",
    "Monthly Accomplishment Report of the SK Members",
    "DTR of SK Secretary and SK Treasurer",
    "Photocopy of the Minutes of Meeting",
  ],
  sk_travel: [
    "Photocopy of Check",
    "Disbursement Voucher (DV)",
    "Request for Obligation of Appropriations (ROA)",
    "Itinerary of Travel",
    "Travel Order",
    "Certificate of Appearance",
    "Certification of Expenses Not Requiring Receipts (CENRR)",
    "Van Ticket, if applicable",
  ],
  sk_projects_labor: [
    "Photocopy of Check",
    "Disbursement Voucher (DV)",
    "Request for Obligation of Appropriations (ROA)",
    "Payroll",
    "Summary of Payroll",
    "DTR of Laborers",
    "Certification that project is 100% finished",
    "Statement of Work Accomplishment (SWA) signed by the Mun. Engineer",
    "Inspection Report signed by the Mun. Engineer",
    "Program of Works (POW) signed by the Mun. Engineer",
    "Job Assignment",
    "Documentation (Photos of the laborers during implementation and before/after)",
  ],
} as const;

export default function SKTransactions() {
  const { category } = useParams();
  const currentCategory = category && categoryMeta[category as keyof typeof categoryMeta] ? category : "procurement";
  const meta = categoryMeta[currentCategory as keyof typeof categoryMeta];
  const { profile } = useAuth();
  const apiFetch = useApi();

  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const categoryRequirements = useMemo(
    () => requirementMap[meta.type as keyof typeof requirementMap] || requirementMap.sk_procurement,
    [meta.type],
  );

  const canCreateRequest = ["MunicipalAccountant", "SKBookkeeper", "SKChairman", "SKTreasurer"].includes(profile?.role ?? "Guest");
  const canExportRequests = canCreateRequest;

  async function loadRequests() {
    try {
      const res = await apiFetch("/api/requests");
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.requests)) {
        setRequests([]);
        return;
      }

      const filtered = data.requests.filter((req: any) => req.contract_type === meta.type);
      setRequests(
        filtered.map((req: any) => ({
          id: req.id,
          tracking: req.request_uuid,
          barangay: req.barangay_id ? `Barangay ${req.barangay_id}` : "Municipal",
          total: `₱${Number(req.amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          status: req.status,
          documentCount: req.documentCount || 0,
          uploadedCount: req.uploadedCount || 0,
          compliant: !!req.compliant,
          requiredCount: req.requiredCount || 0,
          checklistLabel: req.checklist_label || meta.label,
          contractType: req.contract_type || meta.type,
        })),
      );
    } catch (error) {
      console.warn("Unable to load SK transactions", error);
      setRequests([]);
    }
  }

  useEffect(() => {
    loadRequests();
  }, [apiFetch, meta.type]);

  async function createRequest() {
    setCreateError(null);
    if (!newTitle || !newAmount) {
      setCreateError("Title and amount are required.");
      return;
    }

    setCreateLoading(true);
    try {
      const payload = {
        title: newTitle,
        description: newDescription,
        amount: Number(newAmount),
        contract_type: meta.type,
      };

      const res = await apiFetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data?.error || "Unable to create request.");
        return;
      }

      setCreateOpen(false);
      setNewTitle("");
      setNewAmount("");
      setNewDescription("");
      await loadRequests();
    } catch (error: any) {
      setCreateError(error?.message || "Unable to create request.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function exportRequests() {
    setExportLoading(true);
    try {
      const res = await apiFetch("/api/exports/requests");
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "Unable to export requests.");
      }
      const csv = await res.text();
      downloadCsv(csv, `sk-${currentCategory}-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (error: any) {
      alert(error?.message || "Unable to export requests.");
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <>
      <PageMeta
        title={`${meta.label} | SK Transactions | E-Procurement`}
        description={`Create and manage ${meta.label.toLowerCase()} requests for the SK.`}
      />

      <div className="grid gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">SK Transactions</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{meta.label} / SK request tracking</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-brand-500 hover:bg-brand-600"
              disabled={!canExportRequests || exportLoading}
              onClick={exportRequests}
            >
              {exportLoading ? "Exporting…" : "Export CSV"}
            </Button>
            <Button
              size="sm"
              className={canCreateRequest ? "bg-brand-500 hover:bg-brand-600" : "bg-gray-200 text-gray-500 cursor-not-allowed"}
              disabled={!canCreateRequest}
              onClick={() => setCreateOpen(true)}
            >
              New Request
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{meta.label}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{meta.description}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 p-4 dark:border-brand-900/50 dark:bg-brand-500/5">
            <p className="text-sm font-medium text-brand-700 dark:text-brand-300">Required attachments</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {categoryRequirements.map((requirement) => (
                <li key={requirement} className="text-sm text-gray-700 dark:text-gray-300">• {requirement}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <table className="min-w-[760px] divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4">Tracking Number</th>
                <th className="px-6 py-4">Barangay</th>
                <th className="px-6 py-4">Total Cost</th>
                <th className="px-6 py-4">Uploaded Docs</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No {meta.label.toLowerCase()} requests found for this category.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.tracking} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{request.tracking}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{request.barangay}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{request.total}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{request.uploadedCount}/{request.requiredCount}</td>
                    <td className="px-6 py-4 text-sm text-brand-600 dark:text-brand-400">{request.status}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <button
                        onClick={() => {
                          setSelectedRequest(request.id);
                          setModalOpen(true);
                        }}
                        className="text-blue-600"
                      >
                        Checklist
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DocumentUploadModal
        requestId={selectedRequest}
        contractType={requests.find((request) => request.id === selectedRequest)?.contractType || meta.type}
        checklistLabel={requests.find((request) => request.id === selectedRequest)?.checklistLabel || meta.label}
        open={modalOpen}
        onClose={() => { setModalOpen(false); loadRequests(); }}
        onUploaded={() => loadRequests()}
      />

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title={`Create ${meta.label} Request`} className="mx-4 max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount</label>
            <input value={newAmount} onChange={(e) => setNewAmount(e.target.value)} type="number" step="0.01" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm text-brand-700 dark:border-brand-900/50 dark:bg-brand-500/5 dark:text-brand-300">
            Requirement set: {categoryRequirements.length} attached documents will be tracked.
          </div>
          {createError && <div className="text-sm text-red-600">{createError}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setCreateOpen(false)} className="bg-gray-200">Cancel</Button>
            <Button type="button" onClick={createRequest} disabled={createLoading} className="bg-brand-500">
              {createLoading ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
