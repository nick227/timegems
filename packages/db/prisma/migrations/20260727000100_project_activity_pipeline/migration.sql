-- Project activity feed + GitHub update writer pipeline (idempotent)

CREATE TABLE IF NOT EXISTS `GithubInstallation` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `installationId` VARCHAR(191) NOT NULL,
    `accountName` VARCHAR(191) NOT NULL,
    `accountAvatarUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GithubInstallation_installationId_key`(`installationId`),
    INDEX `GithubInstallation_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `GithubWebhookDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `githubDeliveryId` VARCHAR(191) NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `processed` BOOLEAN NOT NULL DEFAULT false,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GithubWebhookDelivery_githubDeliveryId_key`(`githubDeliveryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @repo_col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'GithubBinding' AND COLUMN_NAME = 'repoId'
);
SET @sql = IF(@repo_col_exists = 0, 'ALTER TABLE `GithubBinding` ADD COLUMN `repoId` VARCHAR(191) NOT NULL DEFAULT ''''', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `ProjectEvent` (
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

CREATE TABLE IF NOT EXISTS `ProjectUpdate` (
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

CREATE TABLE IF NOT EXISTS `ProjectUpdateJob` (
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
