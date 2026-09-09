import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import { useApi } from "../../lib/api";

type Barangay = {
  id: number;
  name: string;
  seal_url?: string | null;
};

type PendingUser = {
  id: number;
  email: string;
  display_name: string;
  role: string;
  pending_role: string;
  barangay_id: number | null;
  barangay_name: string | null;
  status: string;
};

type ManagedUser = {
  id: number;
  email: string;
  display_name: string;
  role: string;
  status: 'active' | 'pending' | 'rejected';
  department?: string | null;
  barangay_id: number | null;
  barangay_name: string | null;
  assigned_barangays?: { id: number; name: string }[];
};

const userRoles = ['MunicipalAccountant', 'BarangayTreasurer', 'SKTreasurer', 'SKChairman', 'BarangayBookkeeper', 'SKBookkeeper'];

export default function UserProvisioning() {
  const apiFetch = useApi();
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [name, setName] = useState("");
  const [sealFile, setSealFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingBarangay, setEditingBarangay] = useState<Barangay | null>(null);
  const [editName, setEditName] = useState("");
  const [editSealFile, setEditSealFile] = useState<File | null>(null);
  const [updatingBarangay, setUpdatingBarangay] = useState(false);
  const [deletingBarangayId, setDeletingBarangayId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserRole, setEditUserRole] = useState('BarangayTreasurer');
  const [editUserStatus, setEditUserStatus] = useState<ManagedUser['status']>('active');
  const [editUserBarangayId, setEditUserBarangayId] = useState('');
  const [editUserBarangayIds, setEditUserBarangayIds] = useState<string[]>([]);
  const [editUserDepartment, setEditUserDepartment] = useState('');
  const [updatingUser, setUpdatingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [barangayRes, pendingRes, usersRes] = await Promise.all([
        apiFetch('/api/barangays'),
        apiFetch('/api/barangays/pending-users'),
        apiFetch('/api/barangays/users'),
      ]);

      const barangayData = await barangayRes.json().catch(() => ({ barangays: [] }));
      const pendingData = await pendingRes.json().catch(() => ({ users: [] }));
      const usersData = await usersRes.json().catch(() => ({ users: [] }));

      if (barangayRes.ok) setBarangays(Array.isArray(barangayData.barangays) ? barangayData.barangays : []);
      if (pendingRes.ok) setPendingUsers(Array.isArray(pendingData.users) ? pendingData.users : []);
      if (usersRes.ok) setUsers(Array.isArray(usersData.users) ? usersData.users : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load admin data.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBarangay = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Barangay name is required.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      if (sealFile) formData.append('seal', sealFile);

      const res = await apiFetch('/api/barangays', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to create barangay.');
      }

      setName('');
      setSealFile(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Unable to create barangay.');
    } finally {
      setSaving(false);
    }
  };

  const handleApproval = async (userId: number, approved: boolean) => {
    setError(null);
    try {
      const res = await apiFetch(`/api/barangays/${approved ? 'approve-user' : 'reject-user'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to update request.');
      }

      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Unable to update approval.');
    }
  };

  const openEditBarangay = (barangay: Barangay) => {
    setEditingBarangay(barangay);
    setEditName(barangay.name);
    setEditSealFile(null);
  };

  const handleUpdateBarangay = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingBarangay || !editName.trim()) {
      setError('Barangay name is required.');
      return;
    }

    setUpdatingBarangay(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('name', editName.trim());
      if (editSealFile) formData.append('seal', editSealFile);
      const res = await apiFetch(`/api/barangays/${editingBarangay.id}`, { method: 'PUT', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || 'Unable to update barangay.');
      setEditingBarangay(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Unable to update barangay.');
    } finally {
      setUpdatingBarangay(false);
    }
  };

  const handleDeleteBarangay = async (barangay: Barangay) => {
    if (!window.confirm(`Delete ${barangay.name}? This cannot be undone.`)) return;
    setDeletingBarangayId(barangay.id);
    setError(null);
    try {
      const res = await apiFetch(`/api/barangays/${barangay.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || 'Unable to delete barangay.');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Unable to delete barangay.');
    } finally {
      setDeletingBarangayId(null);
    }
  };

  const openEditUser = (user: ManagedUser) => {
    setEditingUser(user);
    setEditUserName(user.display_name || '');
    const selectedRole = userRoles.includes(user.role) ? user.role : 'BarangayTreasurer';
    setEditUserRole(selectedRole);
    setEditUserStatus(user.status);
    setEditUserBarangayId(['MunicipalAccountant', 'SKBookkeeper'].includes(selectedRole) ? '' : user.barangay_id ? String(user.barangay_id) : '');
    setEditUserBarangayIds(selectedRole === 'BarangayBookkeeper' ? (user.assigned_barangays || []).map((barangay) => String(barangay.id)) : []);
    setEditUserDepartment(user.department || '');
  };

  const handleUpdateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) return;
    setUpdatingUser(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/barangays/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: editUserName,
          role: editUserRole,
          status: editUserStatus,
          barangay_id: editUserBarangayId ? Number(editUserBarangayId) : null,
          barangay_ids: editUserRole === 'BarangayBookkeeper' ? editUserBarangayIds.map(Number) : [],
          department: editUserDepartment,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || 'Unable to update user.');
      setEditingUser(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Unable to update user.');
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleDeleteUser = async (user: ManagedUser) => {
    if (!window.confirm(`Permanently delete ${user.display_name || user.email}? This also removes their Firebase sign-in account and cannot be undone.`)) return;
    setDeletingUserId(user.id);
    setError(null);
    try {
      const res = await apiFetch(`/api/barangays/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || 'Unable to delete user.');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Unable to delete user.');
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <>
      <PageMeta
        title="User Provisioning | E-Procurement"
        description="Administrators can create barangays and approve local staff and finance manager accounts."
      />
      <div className="grid gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              User Provisioning
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage barangays, upload official seals, and approve local staff or finance manager accounts.
            </p>
          </div>
          <Button size="sm" className="bg-brand-500 hover:bg-brand-600" onClick={loadData} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/10 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleCreateBarangay} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Add Barangay</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Barangay name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  placeholder="e.g. San Roque"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Official seal</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSealFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <Button type="submit" size="sm" className="bg-brand-500 hover:bg-brand-600" disabled={saving}>
                {saving ? 'Saving...' : 'Save Barangay'}
              </Button>
            </div>
          </form>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Registered Barangays</h2>
            <div className="space-y-3">
              {barangays.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No barangays yet.</p>
              ) : (
                barangays.map((barangay) => (
                  <div key={barangay.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      {barangay.seal_url ? (
                        <img src={barangay.seal_url} alt={barangay.name} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {barangay.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-800 dark:text-white">{barangay.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditBarangay(barangay)}>Edit</Button>
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => handleDeleteBarangay(barangay)}
                        disabled={deletingBarangayId === barangay.id}
                      >
                        {deletingBarangayId === barangay.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Pending Approvals</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Barangay</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
                  {pendingUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        No pending role approvals.
                      </td>
                    </tr>
                  ) : (
                    pendingUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{user.display_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{user.pending_role || user.role}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{user.barangay_name || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApproval(user.id, true)}>
                              Approve
                            </Button>
                            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => handleApproval(user.id, false)}>
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="p-6">
            <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">User Management</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Update a user’s role, barangay assignment, department, or account status.</p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Barangay</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                      <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900 dark:text-white">{user.display_name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p></td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{user.role}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{user.role === 'BarangayBookkeeper' ? (user.assigned_barangays || []).map((barangay) => barangay.name).join(', ') || 'Not assigned' : user.barangay_name || 'Municipality-wide'}</td>
                      <td className="px-4 py-3 text-sm capitalize text-gray-600 dark:text-gray-300">{user.status}</td>
                      <td className="px-4 py-3"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => openEditUser(user)}>Manage</Button><Button size="sm" className="bg-red-600 hover:bg-red-700" disabled={deletingUserId === user.id} onClick={() => handleDeleteUser(user)}>{deletingUserId === user.id ? 'Deleting...' : 'Delete'}</Button></div></td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">No registered users found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <Modal isOpen={Boolean(editingBarangay)} onClose={() => setEditingBarangay(null)} className="max-w-md m-4">
          <form onSubmit={handleUpdateBarangay} className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Barangay</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Barangay name</label>
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Replace official seal (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setEditSealFile(event.target.files?.[0] || null)}
                  className="block w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button size="sm" variant="outline" onClick={() => setEditingBarangay(null)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={updatingBarangay}>{updatingBarangay ? 'Saving...' : 'Save changes'}</Button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={Boolean(editingUser)} onClose={() => setEditingUser(null)} className="max-w-md m-4">
          <form onSubmit={handleUpdateUser} className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Manage User</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{editingUser?.email}</p>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name<input value={editUserName} onChange={(event) => setEditUserName(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role<select value={editUserRole} onChange={(event) => { const role = event.target.value; setEditUserRole(role); if (['MunicipalAccountant', 'SKBookkeeper'].includes(role)) { setEditUserBarangayId(''); setEditUserBarangayIds([]); } }} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white">{userRoles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
              {!['BarangayBookkeeper', 'MunicipalAccountant', 'SKBookkeeper'].includes(editUserRole) && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Barangay<select value={editUserBarangayId} onChange={(event) => setEditUserBarangayId(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="">Select barangay</option>{barangays.map((barangay) => <option key={barangay.id} value={barangay.id}>{barangay.name}</option>)}</select></label>}
              {editUserRole === 'MunicipalAccountant' && <p className="text-sm text-gray-500 dark:text-gray-400">Municipality-wide super administrator. No barangay is assigned.</p>}
              {editUserRole === 'SKBookkeeper' && <p className="text-sm text-gray-500 dark:text-gray-400">Municipality-wide SK Bookkeeper. This role is reserved for SK budgeting and SK-related users across all barangays.</p>}
              {editUserRole === 'BarangayBookkeeper' && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Assigned barangays ({editUserBarangayIds.length}/5)<select multiple value={editUserBarangayIds} onChange={(event) => setEditUserBarangayIds(Array.from(event.currentTarget.selectedOptions, (option) => option.value).slice(0, 5))} className="mt-1 block h-36 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white">{barangays.map((barangay) => <option key={barangay.id} value={barangay.id}>{barangay.name}</option>)}</select><span className="mt-1 block text-xs font-normal text-gray-500">Select one to five barangays. Only six Barangay Bookkeepers can be active or pending.</span></label>}
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Department<input value={editUserDepartment} onChange={(event) => setEditUserDepartment(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white" /></label>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account status<select value={editUserStatus} onChange={(event) => setEditUserStatus(event.target.value as ManagedUser['status'])} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="active">Active</option><option value="pending">Pending</option><option value="rejected">Rejected (blocked)</option></select></label>
            </div>
            <div className="mt-6 flex justify-end gap-3"><Button size="sm" variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button><Button type="submit" size="sm" disabled={updatingUser}>{updatingUser ? 'Saving...' : 'Save user'}</Button></div>
          </form>
        </Modal>
      </div>
    </>
  );
}
