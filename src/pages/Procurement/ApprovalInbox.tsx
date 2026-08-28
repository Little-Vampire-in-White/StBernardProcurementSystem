import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { useApi } from "../../lib/api";

export default function ApprovalInbox() {
  const apiFetch = useApi();
  const [searchParams] = useSearchParams();
  const highlightedRequestId = Number(searchParams.get("requestId"));
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/requests");
      const data = await res.json();
      if (res.ok && data.requests) {
        setRequests(
          data.requests
            .filter((req: any) => req.status === "Pending")
            .map((req: any) => ({
              id: req.id,
              title: req.title,
              tracking: req.request_uuid,
              department: String(req.barangay_id || "N/A"),
              requestedBy: req.creator?.display_name || "Unknown",
              amount: `₱${Number(req.amount).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`,
              uploadedCount: req.uploadedCount || 0,
              compliant: !!req.compliant,
              status: req.status,
            }))
        );
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  const [remarks, setRemarks] = useState<Record<number, string>>({});

  async function approveRequest(requestId: number) {
    setActionError(null);
    try {
      const res = await apiFetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, action: 'approve' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data?.error || "Unable to approve request.");
        return;
      }
      await loadRequests();
    } catch (err: any) {
      setActionError(err?.message || "Unable to approve request.");
    }
  }

  async function rejectRequest(requestId: number) {
    setActionError(null);
    try {
      const remark = remarks[requestId] || '';
      const res = await apiFetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, action: 'reject', remark }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data?.error || "Unable to reject request.");
        return;
      }
      setRemarks((prev) => ({ ...prev, [requestId]: '' }));
      await loadRequests();
    } catch (err: any) {
      setActionError(err?.message || "Unable to reject request.");
    }
  }

  return (
    <>
      <PageMeta
        title="Approval Inbox | E-Procurement"
        description="Review pending purchase requests and move approvals through the workflow."
      />
      <div className="grid gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Approval Inbox
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Review procurement requests and approve or return with remarks.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-brand-500 hover:bg-brand-600"
            onClick={loadRequests}
          >
            Refresh Queue
          </Button>
        </div>

        {actionError && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/10 dark:text-red-200">
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
            Loading approval queue...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
            No pending purchase requests found.
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((item) => (
              <div
                key={item.id}
                className={`rounded-3xl border bg-white p-6 shadow-sm dark:bg-gray-950 ${
                  item.id === highlightedRequestId
                    ? "border-brand-500 ring-2 ring-brand-500/30 dark:border-brand-400"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Awaiting approval • {item.uploadedCount}/12 documents uploaded
                    </p>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {item.tracking} • {item.department}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">
                      {item.amount}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => approveRequest(item.id)}
                      disabled={!item.compliant}
                      className={`${
                        item.compliant
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-gray-200 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border border-red-200 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/10"
                      onClick={() => rejectRequest(item.id)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Requested by {item.requestedBy} for the next approval stage.
                  </p>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Rejection remark (optional)
                    </label>
                    <textarea
                      value={remarks[item.id] || ''}
                      onChange={(e) => setRemarks((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      rows={2}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
