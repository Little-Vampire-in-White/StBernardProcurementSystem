const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  listBarangays,
  listMyAssignedBarangays,
  createBarangay,
  updateBarangay,
  deleteBarangay,
  listPendingUsers,
  listUsers,
  updateManagedUser,
  deleteManagedUser,
  approveUserRegistration,
  rejectUserRegistration,
} = require('../controllers/barangaysController');
const requireRoles = require('../middleware/roleMiddleware');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', listBarangays);
router.get('/my-assignments', listMyAssignedBarangays);
router.get('/pending-users', requireRoles(['Administrator']), listPendingUsers);
router.get('/users', requireRoles(['Administrator']), listUsers);
router.post('/', requireRoles(['Administrator']), upload.single('seal'), createBarangay);
router.put('/:id', requireRoles(['Administrator']), upload.single('seal'), updateBarangay);
router.delete('/:id', requireRoles(['Administrator']), deleteBarangay);
router.put('/users/:id', requireRoles(['Administrator']), updateManagedUser);
router.delete('/users/:id', requireRoles(['Administrator']), deleteManagedUser);
router.post('/approve-user', requireRoles(['Administrator']), approveUserRegistration);
router.post('/reject-user', requireRoles(['Administrator']), rejectUserRegistration);

module.exports = router;
