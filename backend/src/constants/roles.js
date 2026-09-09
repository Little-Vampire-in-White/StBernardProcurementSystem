const ROLES = {
  ADMINISTRATOR: 'Administrator',
  MUNICIPAL_ACCOUNTANT: 'MunicipalAccountant',
  BARANGAY_TREASURER: 'BarangayTreasurer',
  SK_TREASURER: 'SKTreasurer',
  SK_CHAIRMAN: 'SKChairman',
  BARANGAY_BOOKKEEPER: 'BarangayBookkeeper',
  SK_BOOKKEEPER: 'SKBookkeeper',
};

const ROLE_OPTIONS = [
  { value: ROLES.BARANGAY_TREASURER, label: 'Barangay Treasurer' },
  { value: ROLES.SK_TREASURER, label: 'Sangguniang Kabataan Treasurer' },
  { value: ROLES.SK_CHAIRMAN, label: 'Sangguniang Kabataan Chairman' },
  { value: ROLES.BARANGAY_BOOKKEEPER, label: 'Barangay Bookkeeper' },
  { value: ROLES.SK_BOOKKEEPER, label: 'Sangguniang Kabataan Bookkeeper' },
  { value: ROLES.MUNICIPAL_ACCOUNTANT, label: 'Municipal Accountant' },
];

const VALID_ROLES = [ROLES.ADMINISTRATOR, ...ROLE_OPTIONS.map((role) => role.value)];
const BARANGAY_SCOPED_ROLES = new Set([
  ROLES.BARANGAY_TREASURER,
  ROLES.SK_TREASURER,
  ROLES.SK_CHAIRMAN,
  ROLES.BARANGAY_BOOKKEEPER,
]);

module.exports = { ROLES, ROLE_OPTIONS, VALID_ROLES, BARANGAY_SCOPED_ROLES };
