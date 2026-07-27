-- Reconciliation migration: collapse Agent 1 (eventSource/eventType via db:push)
-- and Agent 2 (source/kind) into one provider-neutral ProjectEvent contract.
-- WIP feature tables may be emptied; GithubInstallation/GithubBinding are preserved.

-- ── GithubWebhookDelivery.deliveryId → githubDeliveryId ──────────────────────
SET @has_delivery = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GithubWebhookDelivery' AND COLUMN_NAME = 'deliveryId'
);
SET @has_github_delivery = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GithubWebhookDelivery' AND COLUMN_NAME = 'githubDeliveryId'
);
SET @sql = IF(@has_delivery = 1 AND @has_github_delivery = 0,
  'ALTER TABLE `GithubWebhookDelivery` CHANGE `deliveryId` `githubDeliveryId` VARCHAR(191) NOT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Rename unique index if it still uses the old name
SET @has_old_idx = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GithubWebhookDelivery' AND INDEX_NAME = 'GithubWebhookDelivery_deliveryId_key'
);
SET @sql = IF(@has_old_idx > 0,
  'ALTER TABLE `GithubWebhookDelivery` RENAME INDEX `GithubWebhookDelivery_deliveryId_key` TO `GithubWebhookDelivery_githubDeliveryId_key`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_new_idx = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GithubWebhookDelivery' AND INDEX_NAME = 'GithubWebhookDelivery_githubDeliveryId_key'
);
SET @sql = IF(@has_new_idx = 0,
  'CREATE UNIQUE INDEX `GithubWebhookDelivery_githubDeliveryId_key` ON `GithubWebhookDelivery`(`githubDeliveryId`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── Rebuild ProjectEvent as the canonical merged model ───────────────────────
-- Jobs/updates that reference event IDs are also WIP — clear and recreate.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `ProjectUpdateJob`;
DROP TABLE IF EXISTS `ProjectUpdate`;
DROP TABLE IF EXISTS `ProjectEvent`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `ProjectEvent` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `source` ENUM('HUMAN', 'GITHUB', 'SYSTEM', 'AI') NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(512) NOT NULL,
    `title` VARCHAR(191) NULL,
    `body` TEXT NULL,
    `payload` JSON NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProjectEvent_tenantId_projectId_occurredAt_idx`(`tenantId`, `projectId`, `occurredAt`),
    INDEX `ProjectEvent_kind_idx`(`kind`),
    UNIQUE INDEX `ProjectEvent_projectId_source_externalId_key`(`projectId`, `source`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProjectEvent`
  ADD CONSTRAINT `ProjectEvent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ProjectEvent_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ProjectEvent_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `ProjectUpdate` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `confidence` DOUBLE NOT NULL,
    `modelName` VARCHAR(191) NOT NULL,
    `modelVersion` VARCHAR(191) NULL,
    `sourceEventIds` JSON NOT NULL,
    `evidence` JSON NOT NULL,
    `provenance` ENUM('AI', 'HUMAN') NOT NULL DEFAULT 'AI',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `ProjectUpdate_tenantId_projectId_createdAt_idx`(`tenantId`, `projectId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProjectUpdateJob` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD') NOT NULL DEFAULT 'PENDING',
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `scheduledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lockedAt` DATETIME(3) NULL,
    `lockedBy` VARCHAR(191) NULL,
    `lastError` TEXT NULL,
    `batchKey` VARCHAR(191) NULL,
    `sourceEventIds` JSON NOT NULL,
    `dedupeKey` VARCHAR(191) NOT NULL,
    `projectUpdateId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `ProjectUpdateJob_dedupeKey_key`(`dedupeKey`),
    UNIQUE INDEX `ProjectUpdateJob_projectUpdateId_key`(`projectUpdateId`),
    INDEX `ProjectUpdateJob_status_scheduledAt_idx`(`status`, `scheduledAt`),
    INDEX `ProjectUpdateJob_tenantId_projectId_idx`(`tenantId`, `projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProjectUpdate`
  ADD CONSTRAINT `ProjectUpdate_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ProjectUpdate_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProjectUpdateJob`
  ADD CONSTRAINT `ProjectUpdateJob_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ProjectUpdateJob_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ProjectUpdateJob_projectUpdateId_fkey` FOREIGN KEY (`projectUpdateId`) REFERENCES `ProjectUpdate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- GithubBinding multi-repo uniqueness (many repos per project)
SET @has_binding_unique = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GithubBinding'
    AND INDEX_NAME = 'GithubBinding_tenantId_linkedProjectId_repoId_key'
);
SET @sql = IF(@has_binding_unique = 0,
  'CREATE UNIQUE INDEX `GithubBinding_tenantId_linkedProjectId_repoId_key` ON `GithubBinding`(`tenantId`, `linkedProjectId`, `repoId`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
