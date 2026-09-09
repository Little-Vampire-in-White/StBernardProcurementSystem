// requireRoles(['Administrator','FinanceManager'])
module.exports = function requireRoles(allowedRoles) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    if (!allowedRoles || !allowedRoles.length) return next();
    const role = req.user.role;
    if (!role) return res.status(403).json({ error: 'forbidden' });
    // Municipal Accountant is the project-wide super-admin and therefore has
    // every permission that an Administrator has (and more specific routes).
    if (role === 'MunicipalAccountant' || allowedRoles.includes(role)) return next();
    return res.status(403).json({ error: 'forbidden' });
  };
};
