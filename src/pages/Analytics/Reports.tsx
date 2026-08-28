import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart } from "recharts";
import PageMeta from "../../components/common/PageMeta";

const budgetData = [
  { name: "Health", budget: 240, actual: 180 },
  { name: "Infrastructure", budget: 320, actual: 290 },
  { name: "Social Welfare", budget: 220, actual: 170 },
  { name: "Education", budget: 180, actual: 140 },
];

const supplierData = [
  { name: "Saint Bernard Foods", value: 56 },
  { name: "Island Transit Supplies", value: 42 },
  { name: "Local Hardware Hub", value: 28 },
];

export default function Reports() {
  return (
    <>
      <PageMeta
        title="Analytics & Reports | E-Procurement"
        description="Visualize procurement spending, supplier rankings, and budget utilization."
      />
      <div className="grid gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Analytics & Reports
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Live procurement insights and finance analytics for audit-ready reporting.
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Budget Utilization</h2>
            <div className="mt-6 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="budget" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="actual" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Suppliers</h2>
            <div className="mt-6 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={supplierData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={3} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
