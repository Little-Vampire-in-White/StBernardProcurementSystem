import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";

const sampleSuppliers = [
  {
    name: "Saint Bernard Foods Co.",
    contact: "Maria Santos",
    address: "Brgy. San Isidro, Saint Bernard",
    tin: "123-456-789",
    status: "Accredited",
  },
  {
    name: "Island Transit Supplies",
    contact: "Jose dela Cruz",
    address: "Brgy. Poblacion, Saint Bernard",
    tin: "987-654-321",
    status: "Pending",
  },
];

export default function Suppliers() {
  return (
    <>
      <PageMeta
        title="Supplier Management | E-Procurement"
        description="View and manage supplier records for the LGU procurement process."
      />
      <div className="grid gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Supplier Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Add, edit, and review supplier accreditation status for procurement.
            </p>
          </div>
          <Button size="sm" className="bg-brand-500 hover:bg-brand-600">
            Add Supplier
          </Button>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <table className="min-w-[720px] divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4">Supplier Name</th>
                <th className="px-6 py-4">Contact Person</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4">TIN</th>
                <th className="px-6 py-4">Accreditation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {sampleSuppliers.map((supplier) => (
                <tr key={supplier.name} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    {supplier.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {supplier.contact}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {supplier.address}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {supplier.tin}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                    {supplier.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
