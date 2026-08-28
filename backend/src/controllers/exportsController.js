const { ProcurementRequest, ProcurementDocument, User } = require('../models');

const departmentAllocations = {
  'Health Services': 4500000,
  'Public Works': 3200000,
  Education: 2000000,
  'Social Welfare': 2300000,
};

const barangayDepartmentMap = {
  1: 'Health Services',
  2: 'Public Works',
  3: 'Education',
  4: 'Social Welfare',
};

function resolveDepartment(request) {
  if (request.creator?.department) return request.creator.department;
  const id = Number(request.barangay_id || 0);
  return barangayDepartmentMap[id] || 'Unassigned';
}

function escapeCsvCell(value) {
  const cell = value === undefined || value === null ? '' : String(value);
  if (/[",\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function buildCsv(rows, columns) {
  const header = columns.map((col) => escapeCsvCell(col.header)).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((col) => escapeCsvCell(col.value(row)))
        .join(',')
    )
    .join('\n');
  return `${header}\n${body}`;
}

async function exportRequests(req, res) {
  try {
    const requestWhere = req.user?.role === 'FinanceManager' ? { barangay_id: req.user.barangay_id } : {};
    const requests = await ProcurementRequest.findAll({
      where: requestWhere,
      include: [
        { model: ProcurementDocument, as: 'documents' },
        { model: User, as: 'creator' },
      ],
      order: [['created_at', 'DESC']],
    });

    const rows = requests.map((request) => ({
      request_uuid: request.request_uuid,
      title: request.title,
      department: resolveDepartment(request),
      amount: Number(request.amount || 0),
      status: request.status,
      created_by: request.creator?.display_name || request.creator?.email || 'Unknown',
      created_at: request.created_at ? request.created_at.toISOString() : '',
      updated_at: request.updated_at ? request.updated_at.toISOString() : '',
      document_count: request.documents?.length || 0,
    }));

    const csv = buildCsv(rows, [
      { header: 'Tracking Number', value: (row) => row.request_uuid },
      { header: 'Title', value: (row) => row.title },
      { header: 'Department', value: (row) => row.department },
      { header: 'Amount', value: (row) => row.amount.toFixed(2) },
      { header: 'Status', value: (row) => row.status },
      { header: 'Created By', value: (row) => row.created_by },
      { header: 'Created At', value: (row) => row.created_at },
      { header: 'Updated At', value: (row) => row.updated_at },
      { header: 'Document Count', value: (row) => row.document_count },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="procurement-requests.csv"');
    return res.send(csv);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

async function exportBudgetSummary(req, res) {
  try {
    const requestWhere = req.user?.role === 'FinanceManager' ? { barangay_id: req.user.barangay_id } : {};
    const requests = await ProcurementRequest.findAll({
      where: requestWhere,
      include: [{ model: User, as: 'creator' }],
      order: [['created_at', 'DESC']],
    });

    const normalizedRequests = requests.map((request) => ({
      amount: Number(request.amount || 0),
      department: resolveDepartment(request),
    }));

    const totalBudget = Object.values(departmentAllocations).reduce((sum, value) => sum + value, 0);
    const obligated = normalizedRequests.reduce((sum, request) => sum + request.amount, 0);
    const available = totalBudget - obligated;
    const remaining = Math.max(0, available);

    const departments = new Map();
    normalizedRequests.forEach((request) => {
      const current = departments.get(request.department) || {
        name: request.department,
        allocation: departmentAllocations[request.department] ?? 0,
        spent: 0,
        requestCount: 0,
      };
      current.spent += request.amount;
      current.requestCount += 1;
      departments.set(request.department, current);
    });

    Object.entries(departmentAllocations).forEach(([name, allocation]) => {
      if (!departments.has(name)) {
        departments.set(name, {
          name,
          allocation,
          spent: 0,
          requestCount: 0,
        });
      }
    });

    const departmentRows = Array.from(departments.values()).map((dept) => ({
      department: dept.name,
      allocation: dept.allocation,
      spent: dept.spent,
      remaining: Math.max(0, dept.allocation - dept.spent),
      utilization: dept.allocation > 0 ? (dept.spent / dept.allocation) * 100 : 0,
      atRisk: dept.spent > dept.allocation ? 'Yes' : 'No',
      requestCount: dept.requestCount,
    }));

    const csv = buildCsv(departmentRows, [
      { header: 'Department', value: (row) => row.department },
      { header: 'Allocation', value: (row) => row.allocation.toFixed(2) },
      { header: 'Spent', value: (row) => row.spent.toFixed(2) },
      { header: 'Remaining', value: (row) => row.remaining.toFixed(2) },
      { header: 'Utilization %', value: (row) => row.utilization.toFixed(2) },
      { header: 'At Risk', value: (row) => row.atRisk },
      { header: 'Request Count', value: (row) => row.requestCount },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="budget-summary.csv"');
    return res.send(csv);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

module.exports = { exportRequests, exportBudgetSummary };
