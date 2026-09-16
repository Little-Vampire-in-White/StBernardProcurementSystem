ALTER TABLE procurement_requests ADD COLUMN contract_type VARCHAR(64) NULL AFTER description;
ALTER TABLE procurement_documents MODIFY COLUMN doc_type VARCHAR(255) NOT NULL;
