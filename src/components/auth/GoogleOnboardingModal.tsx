import { useEffect, useState } from "react";
import { GoogleAccount, RoleType } from "../../context/AuthContext";
import Button from "../ui/button/Button";
import Label from "../form/Label";

interface Barangay {
  id: number;
  name: string;
}

interface Props {
  account: GoogleAccount;
  onComplete: (role: RoleType, barangayId?: string) => Promise<void>;
  onCancel: () => Promise<void>;
}

const roles: { value: RoleType; label: string }[] = [
  { value: "BarangayTreasurer", label: "Barangay Treasurer" },
  { value: "SKTreasurer", label: "Sangguniang Kabataan Treasurer" },
  { value: "SKChairman", label: "Sangguniang Kabataan Chairman" },
  { value: "BarangayBookkeeper", label: "Barangay Bookkeeper" },
  { value: "SKBookkeeper", label: "Sangguniang Kabataan Bookkeeper" },
  { value: "MunicipalAccountant", label: "Municipal Accountant" },
];

export default function GoogleOnboardingModal({ account, onComplete, onCancel }: Props) {
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [role, setRole] = useState<RoleType>("BarangayTreasurer");
  const [barangayId, setBarangayId] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/barangays")
      .then((res) => res.json())
      .then((data) => setBarangays(Array.isArray(data?.barangays) ? data.barangays : []))
      .catch(() => setError("Unable to load barangays. Please try again."));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (role !== "MunicipalAccountant" && !barangayId) {
      setError("Please select your barangay.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await onComplete(role, barangayId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your account details.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-99999 flex items-center justify-center overflow-y-auto bg-gray-950/55 p-3 backdrop-blur-sm sm:p-4">
      <form onSubmit={submit} className="my-auto w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl dark:bg-gray-900 sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <img className="h-12 w-12 rounded-full object-cover" src={account.photoUrl || "/images/user/owner.jpg"} alt="Google profile" />
          {role !== "MunicipalAccountant" && <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Complete your profile</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{account.email}</p>
          </div>}
        </div>
        <p className="mb-5 text-sm text-gray-600 dark:text-gray-300">Choose your role and barangay. Your request will need administrator approval before access is granted.</p>
        <div className="space-y-4">
          <div>
            <Label>Role</Label>
            <select value={role} onChange={(event) => setRole(event.target.value as RoleType)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
              {roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <Label>Barangay</Label>
            <select value={barangayId} onChange={(event) => setBarangayId(event.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
              <option value="">Select barangay</option>
              {barangays.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-error-500">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => void onCancel()} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Submit request"}</Button>
        </div>
      </form>
    </div>
  );
}
