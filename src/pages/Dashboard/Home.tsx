import { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import PageMeta from "../../components/common/PageMeta";
import { useApi } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type DepartmentBudget = {
  name: string;
  allocation: number;
  spent: number;
  remaining: number;
  utilization: number;
  requestCount: number;
};

type BarangayPerformance = {
  barangay_id: number | null;
  barangay: string;
  spent: number;
  requestCount: number;
  mainUse: string;
};

type BudgetSummary = {
  totalBudget: number;
  obligated: number;
  available: number;
  remaining: number;
  departmentBudgets: DepartmentBudget[];
  barangayPerformance: BarangayPerformance[];
  requests: Array<{ amount: number; department: string; created_at?: string }>;
};

const defaultSummary: BudgetSummary = {
  totalBudget: 0,
  obligated: 0,
  available: 0,
  remaining: 0,
  departmentBudgets: [],
  barangayPerformance: [],
  requests: [],
};

const periodScale: Record<"weekly" | "monthly" | "annual", number> = {
  weekly: 0.18,
  monthly: 0.65,
  annual: 1,
};

export default function Home() {
  const apiFetch = useApi();
  const { profile } = useAuth();
  const [summary, setSummary] = useState<BudgetSummary>(defaultSummary);
  const [period, setPeriod] = useState<"weekly" | "monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBudget = async () => {
      setLoading(true);
      try {
        const res = await apiFetch('/api/budgets');
        const data = await res.json();
        if (res.ok && data) {
          setSummary({
            totalBudget: Number(data.totalBudget || 0),
            obligated: Number(data.obligated || 0),
            available: Number(data.available || 0),
            remaining: Number(data.remaining || 0),
            departmentBudgets: Array.isArray(data.departmentBudgets) ? data.departmentBudgets : [],
            barangayPerformance: Array.isArray(data.barangayPerformance) ? data.barangayPerformance : [],
            requests: Array.isArray(data.requests) ? data.requests : [],
          });
        }
      } catch (error) {
        console.warn('Unable to load budget summary for dashboard', error);
      } finally {
        setLoading(false);
      }
    };

    loadBudget();
  }, [apiFetch]);

  const chartData = useMemo(() => {
    const scale = periodScale[period];
    return (summary.departmentBudgets || []).map((dept) => ({
      name: dept.name,
      spent: Number((dept.spent * scale).toFixed(0)),
      allocation: Number((dept.allocation * scale).toFixed(0)),
      utilization: dept.utilization,
      remaining: dept.remaining,
    }));
  }, [summary.departmentBudgets, period]);

  const topDepartment = useMemo(() => {
    const departments = summary.departmentBudgets || [];
    if (!departments.length) return null;
    return departments.reduce((top, item) => (item.spent > top.spent ? item : top));
  }, [summary.departmentBudgets]);

  const averageUtilization = useMemo(() => {
    const departments = summary.departmentBudgets || [];
    if (!departments.length) return 0;
    return departments.reduce((sum, item) => sum + item.utilization, 0) / departments.length;
  }, [summary.departmentBudgets]);

  const topBarangay = useMemo(() => {
    const barangays = summary.barangayPerformance || [];
    if (!barangays.length) return null;
    return [...barangays].sort((a, b) => b.spent - a.spent)[0];
  }, [summary.barangayPerformance]);

  const lowestBarangay = useMemo(() => {
    const barangays = summary.barangayPerformance || [];
    if (!barangays.length) return null;
    return [...barangays].sort((a, b) => a.spent - b.spent)[0];
  }, [summary.barangayPerformance]);

  const commonBarangayUse = useMemo(() => {
    const barangays = summary.barangayPerformance || [];
    if (!barangays.length) return 'No data';
    return [...barangays].sort((a, b) => b.spent - a.spent)[0].mainUse;
  }, [summary.barangayPerformance]);

  const chartOptions: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, background: 'transparent' },
    plotOptions: { bar: { horizontal: false, columnWidth: '50%', borderRadius: 8 } },
    dataLabels: { enabled: false },
    colors: ['#465FFF', '#9CB9FF'],
    xaxis: {
      categories: chartData.map((item) => item.name),
      labels: { style: { colors: '#6B7280', fontSize: '12px' } },
    },
    yaxis: {
      labels: {
        formatter: (value) => `₱${Number(value).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`,
      },
    },
    tooltip: {
      y: {
        formatter: (value) => `₱${Number(value).toLocaleString('en-PH')}`,
      },
    },
    grid: { borderColor: '#E5E7EB', strokeDashArray: 4 },
    legend: { position: 'top', horizontalAlign: 'left' },
    stroke: { show: true, width: 2, colors: ['transparent'] },
    fill: { opacity: 1 },
    noData: { text: 'No data available' },
  };

  const chartSeries = [{
    name: 'Spent',
    data: chartData.map((item) => item.spent),
  }, {
    name: 'Allocated',
    data: chartData.map((item) => item.allocation),
  }];

  const formatCurrency = (value: number) =>
    `₱${Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

  return (
    <>
      <PageMeta
        title="LGU Budget Dashboard | E-Procurement"
        description="Overview of budget utilization, department spending, and financial trends across barangays."
      />

      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Budget Overview</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {profile?.role === 'BarangayStaff'
                ? `View the budget allocation and request utilization for ${profile.barangayName || 'your barangay'}.`
                : 'Monitor where the LGU budget is being used most and how each department is performing.'}
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
            {(['weekly', 'monthly', 'annual'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPeriod(option)}
                className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition ${
                  period === option
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
            Loading budget analytics...
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Budget</p>
                <h3 className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(summary.totalBudget)}</h3>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                <p className="text-sm text-gray-500 dark:text-gray-400">Actual Spending</p>
                <h3 className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(summary.obligated)}</h3>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                <p className="text-sm text-gray-500 dark:text-gray-400">Remaining</p>
                <h3 className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(summary.remaining)}</h3>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                <p className="text-sm text-gray-500 dark:text-gray-400">Top Usage</p>
                <h3 className="mt-3 text-xl font-semibold text-gray-900 dark:text-white">
                  {topDepartment ? topDepartment.name : 'N/A'}
                </h3>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Department Spending</h2>
                  <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{period}</span>
                </div>
                <div className="overflow-hidden rounded-xl">
                  <Chart options={chartOptions} series={chartSeries} type="bar" height={360} />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Budget Insight</h2>
                <div className="mt-5 space-y-4">
                  <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Average utilization</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{averageUtilization.toFixed(0)}%</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Highest spending department</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                      {topDepartment ? `${topDepartment.name} (${formatCurrency(topDepartment.spent)})` : 'No data'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Common use of budget</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                      {commonBarangayUse}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Barangay Performance</h2>
                <div className="space-y-3">
                  {(summary.barangayPerformance || []).map((item, index) => (
                    <div key={`${item.barangay}-${index}`} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{item.barangay}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.mainUse}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(item.spent)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.requestCount} requests</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Barangay Insights</h2>
                <div className="space-y-4">
                  <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Highest spend</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                      {topBarangay ? `${topBarangay.barangay} • ${formatCurrency(topBarangay.spent)}` : 'No data'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Lowest spend</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                      {lowestBarangay ? `${lowestBarangay.barangay} • ${formatCurrency(lowestBarangay.spent)}` : 'No data'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Common barangay use</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{commonBarangayUse}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Department Utilization</h2>
              <div className="space-y-4">
                {(summary.departmentBudgets || []).map((dept) => (
                  <div key={dept.name} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{dept.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatCurrency(dept.spent)} spent / {formatCurrency(dept.allocation)} allocated
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-brand-500">{Math.round(dept.utilization)}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.min(dept.utilization, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
