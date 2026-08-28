-- 001_init.sql
-- Initial schema for E-Procurement & Budgeting System

-- Use a database/schema already created, e.g. `saint_bernard_procurement`

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `firebase_uid` VARCHAR(128) DEFAULT NULL,
  `email` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(255),
  `role` ENUM('Administrator','FinanceManager','BarangayStaff','Auditor') NOT NULL DEFAULT 'BarangayStaff',
  `department` VARCHAR(255),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_users_email` (`email`),
  UNIQUE KEY `ux_users_firebase_uid` (`firebase_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `barangays` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(128) NOT NULL,
  `population` INT UNSIGNED DEFAULT 0,
  `chairperson` VARCHAR(255),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `contact_info` TEXT,
  `rating` DECIMAL(3,2) DEFAULT NULL,
  `total_volume` DECIMAL(18,2) DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `procurement_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `request_uuid` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `barangay_id` INT UNSIGNED DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('Draft','Pending','InReview','Approved','Rejected','Disbursed') NOT NULL DEFAULT 'Draft',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_procurement_requests_uuid` (`request_uuid`),
  KEY `ix_procurement_requests_barangay` (`barangay_id`),
  CONSTRAINT `fk_pr_created_by_users` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_pr_barangay` FOREIGN KEY (`barangay_id`) REFERENCES `barangays` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Document types (12 required types). Use these exact keys in the frontend/backend.
-- PR, Canvass, BAC_Resolution, PO, AIR, OR, Invoice, DeliveryReceipt, Checklist, Certification, BudgetAllocation, Other

CREATE TABLE IF NOT EXISTS `procurement_documents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `request_id` BIGINT UNSIGNED NOT NULL,
  `doc_type` ENUM('PR','Canvass','BAC_Resolution','PO','AIR','OR','Invoice','DeliveryReceipt','Checklist','Certification','BudgetAllocation','Other') NOT NULL,
  `is_uploaded` TINYINT(1) NOT NULL DEFAULT 0,
  `file_path` VARCHAR(1024) DEFAULT NULL,
  `uploaded_by` BIGINT UNSIGNED DEFAULT NULL,
  `uploaded_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_request_doctype` (`request_id`,`doc_type`),
  KEY `ix_procurement_documents_request` (`request_id`),
  CONSTRAINT `fk_docs_request` FOREIGN KEY (`request_id`) REFERENCES `procurement_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_docs_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `approvals` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `request_id` BIGINT UNSIGNED NOT NULL,
  `approved_by` BIGINT UNSIGNED NOT NULL,
  `remark` TEXT,
  `approved_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_approvals_request` (`request_id`),
  CONSTRAINT `fk_approvals_request` FOREIGN KEY (`request_id`) REFERENCES `procurement_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_approvals_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only Audit Logs table
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` BIGINT UNSIGNED DEFAULT NULL,
  `action` VARCHAR(255) NOT NULL,
  `target_table` VARCHAR(255) DEFAULT NULL,
  `target_id` BIGINT UNSIGNED DEFAULT NULL,
  `ip_address` VARCHAR(64) DEFAULT NULL,
  `details` JSON DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_audit_target` (`target_table`,`target_id`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Prevent updates/deletes on audit_logs (append-only) via triggers
DELIMITER $$
CREATE TRIGGER `tr_audit_logs_no_update` BEFORE UPDATE ON `audit_logs`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only: updates are forbidden';
END$$

CREATE TRIGGER `tr_audit_logs_no_delete` BEFORE DELETE ON `audit_logs`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only: deletes are forbidden';
END$$
DELIMITER ;

-- Stored function to check compliance: returns 1 when all 12 required doc types are uploaded
DELIMITER $$
CREATE FUNCTION `check_compliance`(req_id BIGINT UNSIGNED) RETURNS TINYINT(1)
DETERMINISTIC
BEGIN
  DECLARE uploaded_count INT DEFAULT 0;
  SELECT COUNT(*) INTO uploaded_count
  FROM `procurement_documents`
  WHERE `request_id` = req_id AND `is_uploaded` = 1;

  IF uploaded_count >= 12 THEN
    RETURN 1;
  ELSE
    RETURN 0;
  END IF;
END$$
DELIMITER ;

-- Trigger to enforce compliance before inserting an approval
DELIMITER $$
CREATE TRIGGER `tr_approvals_before_insert` BEFORE INSERT ON `approvals`
FOR EACH ROW
BEGIN
  IF (check_compliance(NEW.request_id) = 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot approve: 12-document compliance not satisfied';
  END IF;
END$$
DELIMITER ;

-- Helpful view: procurement compliance status
CREATE OR REPLACE VIEW `v_procurement_compliance` AS
SELECT pr.id AS request_id,
       pr.request_uuid,
       pr.title,
       pr.amount,
       COALESCE(SUM(pd.is_uploaded),0) AS uploaded_count,
       (CASE WHEN COALESCE(SUM(pd.is_uploaded),0) >= 12 THEN 1 ELSE 0 END) AS is_compliant
FROM procurement_requests pr
LEFT JOIN procurement_documents pd ON pd.request_id = pr.id
GROUP BY pr.id, pr.request_uuid, pr.title, pr.amount;

-- Indexes to support reports and thresholds
CREATE INDEX IF NOT EXISTS `ix_pr_created_by` ON `procurement_requests` (`created_by`);
CREATE INDEX IF NOT EXISTS `ix_docs_uploaded_by` ON `procurement_documents` (`uploaded_by`);

-- Seed: pre-populate procurement_documents entries for each new request (optional helper view/trigger can be added in backend layer)

-- End of migration
