// requireRoles(['Administrator','FinanceManager'])
module.exports = function requireRoles(allowedRoles) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    if (!allowedRoles || !allowedRoles.length) return next();
    const role = req.user.role;
    if (!role) return res.status(403).json({ error: 'forbidden' });
    if (allowedRoles.includes(role)) return next();
    return res.status(403).json({ error: 'forbidden' });
  };
};
