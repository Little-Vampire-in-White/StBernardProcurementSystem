-- Municipal role update and capacity enforcement for MySQL 8 / Cloud SQL.
-- Run once after 001_init.sql. Pending users reserve a position; rejected users do not.

ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM(
    'Administrator','FinanceManager','BarangayStaff','Auditor','BudgetOfficer','ProcurementOfficer','Requester','DepartmentHead','Guest',
    'MunicipalAccountant','BarangayTreasurer','SKTreasurer','SKChairman','BarangayBookkeeper','SKBookkeeper'
  ) NOT NULL DEFAULT 'BarangayTreasurer';

CREATE TABLE IF NOT EXISTS `user_barangay_assignments` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `barangay_id` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `barangay_id`),
  CONSTRAINT `fk_user_barangay_assignments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_barangay_assignments_barangay` FOREIGN KEY (`barangay_id`) REFERENCES `barangays` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TRIGGER IF EXISTS `tr_users_role_capacity_insert`;
DROP TRIGGER IF EXISTS `tr_users_role_capacity_update`;
DROP TRIGGER IF EXISTS `tr_bookkeeper_assignment_limit_insert`;

DELIMITER $$
CREATE TRIGGER `tr_users_role_capacity_insert` BEFORE INSERT ON `users`
FOR EACH ROW
BEGIN
  IF NEW.status <> 'rejected' THEN
    IF NEW.role IN ('BarangayTreasurer','SKTreasurer','SKChairman') AND (NEW.barangay_id IS NULL OR (SELECT COUNT(*) FROM users WHERE role = NEW.role AND barangay_id = NEW.barangay_id AND status <> 'rejected') >= 1) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'role_capacity_reached';
    END IF;
    IF NEW.role = 'BarangayBookkeeper' AND (NEW.barangay_id IS NULL OR (SELECT COUNT(*) FROM users WHERE role = NEW.role AND status <> 'rejected') >= 6) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'role_capacity_reached';
    END IF;
    IF NEW.role IN ('SKBookkeeper','MunicipalAccountant') AND (SELECT COUNT(*) FROM users WHERE role = NEW.role AND status <> 'rejected') >= 1 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'role_capacity_reached';
    END IF;
  END IF;
END$$
CREATE TRIGGER `tr_users_role_capacity_update` BEFORE UPDATE ON `users`
FOR EACH ROW
BEGIN
  IF NEW.status <> 'rejected' THEN
    IF NEW.role IN ('BarangayTreasurer','SKTreasurer','SKChairman') AND (NEW.barangay_id IS NULL OR (SELECT COUNT(*) FROM users WHERE id <> OLD.id AND role = NEW.role AND barangay_id = NEW.barangay_id AND status <> 'rejected') >= 1) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'role_capacity_reached';
    END IF;
    IF NEW.role = 'BarangayBookkeeper' AND (NEW.barangay_id IS NULL OR (SELECT COUNT(*) FROM users WHERE id <> OLD.id AND role = NEW.role AND status <> 'rejected') >= 6) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'role_capacity_reached';
    END IF;
    IF NEW.role IN ('SKBookkeeper','MunicipalAccountant') AND (SELECT COUNT(*) FROM users WHERE id <> OLD.id AND role = NEW.role AND status <> 'rejected') >= 1 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'role_capacity_reached';
    END IF;
  END IF;
END$$
CREATE TRIGGER `tr_bookkeeper_assignment_limit_insert` BEFORE INSERT ON `user_barangay_assignments`
FOR EACH ROW
BEGIN
  IF (SELECT role FROM users WHERE id = NEW.user_id) <> 'BarangayBookkeeper' OR (SELECT COUNT(*) FROM user_barangay_assignments WHERE user_id = NEW.user_id) >= 5 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'bookkeeper_barangay_limit';
  END IF;
END$$
DELIMITER ;
