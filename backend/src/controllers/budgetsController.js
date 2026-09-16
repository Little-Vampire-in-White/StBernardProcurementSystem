const { ProcurementRequest, User, Barangay, BarangayBudget } = require('../models');

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

function inferMainUse(title = '', description = '') {
  const combined = `${title} ${description}`.toLowerCase();
  if (/health|clinic|medicine|hospital|vaccine|sanitation/i.test(combined)) return 'Health Services';
  if (/road|drain|bridge|repair|pavement|construction|public works/i.test(combined)) return 'Public Works';
  if (/school|education|books|scholarship|classroom/i.test(combined)) return 'Education';
  if (/cash|relief|feeding|assistance|social|welfare/i.test(combined)) return 'Social Welfare';
  if (/utility|water|electric|internet|fuel|gas|maintenance/i.test(combined)) return 'Utilities';
  return 'General Services';
}

async function getBudgetSummary(req, res) {
  try {
    const fiscalYear = Number(req.query.fiscal_year) || new Date().getFullYear();
    const isBarangayScopedUser = ['FinanceManager', 'BarangayStaff', 'BarangayTreasurer'].includes(req.user.role);
    const barangayId = Number(req.user.barangay_id || 0);
    if (isBarangayScopedUser && !barangayId) {
      return res.status(400).json({ error: 'user_barangay_required' });
    }

    const requestWhere = isBarangayScopedUser ? { barangay_id: barangayId } : {};
    const budgetWhere = { fiscal_year: fiscalYear };
    if (isBarangayScopedUser) budgetWhere.barangay_id = barangayId;

    const [requests, barangays] = await Promise.all([
      ProcurementRequest.findAll({
        where: requestWhere,
        include: [{ model: User, as: 'creator' }],
        order: [['created_at', 'DESC']],
      }),
      Barangay.findAll({
        where: isBarangayScopedUser ? { id: barangayId } : {},
        include: [{ model: BarangayBudget, as: 'budgets', where: budgetWhere, required: false }],
        order: [['name', 'ASC']],
      }),
    ]);

    const barangayMap = new Map(barangays.map((barangay) => [Number(barangay.id), barangay.name]));

    const normalizedRequests = requests.map((request) => {
      const department = resolveDepartment(request);
      return {
        id: request.id,
        request_uuid: request.request_uuid,
        title: request.title,
        description: request.description,
        amount: Number(request.amount || 0),
        status: request.status,
        barangay_id: request.barangay_id,
        barangay_name: barangayMap.get(Number(request.barangay_id)) || (request.barangay_id ? `Barangay ${request.barangay_id}` : 'Unassigned'),
        department,
        created_by: request.created_by,
        created_at: request.created_at,
        updated_at: request.updated_at,
        mainUse: inferMainUse(request.title, request.description),
      };
    });

    const barangayBudgets = barangays.map((barangay) => {
      const budget = barangay.budgets?.[0];
      const allocation = Number(budget?.amount || 0);
      const spent = normalizedRequests
        .filter((request) => Number(request.barangay_id) === Number(barangay.id))
        .reduce((sum, request) => sum + request.amount, 0);
      return {
        id: budget?.id || null,
        barangay_id: barangay.id,
        barangay_name: barangay.name,
        fiscal_year: fiscalYear,
        allocation,
        spent,
        remaining: Math.max(0, allocation - spent),
        utilization: allocation > 0 ? (spent / allocation) * 100 : 0,
        atRisk: spent > allocation,
      };
    });

    const totalBudget = barangayBudgets.reduce((sum, budget) => sum + budget.allocation, 0);
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

    const departmentBudgets = Array.from(departments.values()).map((dept) => ({
      ...dept,
      remaining: Math.max(0, dept.allocation - dept.spent),
      utilization: dept.allocation > 0 ? (dept.spent / dept.allocation) * 100 : 0,
      atRisk: dept.spent > dept.allocation,
    }));
    const visibleDepartmentBudgets = isBarangayScopedUser
      ? barangayBudgets.map((budget) => ({
        name: `Barangay ${budget.barangay_name}`,
        allocation: budget.allocation,
        spent: budget.spent,
        remaining: budget.remaining,
        utilization: budget.utilization,
        requestCount: normalizedRequests.length,
        atRisk: budget.atRisk,
      }))
      : departmentBudgets;

    const barangayPerformance = Array.from(
      normalizedRequests.reduce((map, request) => {
        const key = Number(request.barangay_id) || 0;
        const barangayName = request.barangay_name || 'Unassigned';
        const group = map.get(barangayName) || {
          barangay_id: key,
          barangay: barangayName,
          spent: 0,
          requestCount: 0,
          categoryCounts: {},
        };

        group.spent += request.amount;
        group.requestCount += 1;
        const category = request.mainUse || 'General Services';
        group.categoryCounts[category] = (group.categoryCounts[category] || 0) + 1;
        map.set(barangayName, group);
        return map;
      }, new Map()).values()
    )
      .map((group) => {
        const topCategory = Object.entries(group.categoryCounts || {}).sort((a, b) => Number(b[1]) - Number(a[1]))[0] || ['General Services', 1];
        return {
          barangay_id: group.barangay_id,
          barangay: group.barangay,
          spent: Number(group.spent || 0),
          requestCount: Number(group.requestCount || 0),
          mainUse: topCategory[0],
        };
      })
      .sort((a, b) => Number(b.spent) - Number(a.spent));

    return res.json({
      ok: true,
      totalBudget,
      obligated,
      available,
      remaining,
      departmentBudgets: visibleDepartmentBudgets,
      barangayPerformance,
      barangayBudgets,
      fiscalYear,
      requests: normalizedRequests,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}

async function saveBarangayBudget(req, res) {
  try {
    const barangayId = Number(req.body.barangay_id);
    const fiscalYear = Number(req.body.fiscal_year) || new Date().getFullYear();
    const amount = Number(req.body.amount);
    if (!Number.isInteger(barangayId) || barangayId <= 0) {
      return res.status(400).json({ error: 'valid_barangay_required' });
    }
    if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || !Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: 'valid_budget_amount_and_year_required' });
    }
    if (!(await Barangay.findByPk(barangayId))) {
      return res.status(404).json({ error: 'barangay_not_found' });
    }

    const [budget, created] = await BarangayBudget.findOrCreate({
      where: { barangay_id: barangayId, fiscal_year: fiscalYear },
      defaults: { amount, created_by: req.user.id },
    });
    if (!created) {
      budget.amount = amount;
      budget.created_by = req.user.id;
      await budget.save();
    }
    return res.status(created ? 201 : 200).json({ ok: true, budget });
  } catch (err) {
    console.error('saveBarangayBudget error', err);
    return res.status(500).json({ error: 'internal' });
  }
}

module.exports = { getBudgetSummary, saveBarangayBudget };
