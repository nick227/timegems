-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `googleId` VARCHAR(191) NOT NULL,
    `suspendedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_googleId_key`(`googleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `activeTenantId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_token_key`(`token`),
    INDEX `Session_token_idx`(`token`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminUser` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPERADMIN', 'SUPPORT') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminUser_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tenant` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `plan` ENUM('FREE', 'TEAM', 'ENTERPRISE') NOT NULL DEFAULT 'FREE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tenant_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Membership` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Membership_tenantId_idx`(`tenantId`),
    INDEX `Membership_userId_idx`(`userId`),
    UNIQUE INDEX `Membership_userId_tenantId_key`(`userId`, `tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Team` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Team_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamMembership` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TeamMembership_teamId_idx`(`teamId`),
    INDEX `TeamMembership_userId_idx`(`userId`),
    UNIQUE INDEX `TeamMembership_teamId_userId_key`(`teamId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Project_tenantId_idx`(`tenantId`),
    INDEX `Project_teamId_idx`(`teamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkSession` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `goalId` VARCHAR(191) NULL,
    `status` ENUM('RUNNING', 'PAUSED', 'STOPPED') NOT NULL DEFAULT 'RUNNING',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `stoppedAt` DATETIME(3) NULL,
    `activeDurationSec` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkSession_tenantId_idx`(`tenantId`),
    INDEX `WorkSession_userId_status_idx`(`userId`, `status`),
    INDEX `WorkSession_userId_startedAt_idx`(`userId`, `startedAt`),
    INDEX `WorkSession_projectId_idx`(`projectId`),
    INDEX `WorkSession_goalId_idx`(`goalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkSessionInterval` (
    `id` VARCHAR(191) NOT NULL,
    `workSessionId` VARCHAR(191) NOT NULL,
    `kind` ENUM('ACTIVE', 'PAUSED') NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkSessionInterval_workSessionId_idx`(`workSessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Note` (
    `id` VARCHAR(191) NOT NULL,
    `workSessionId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `isStopSummary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Note_workSessionId_createdAt_idx`(`workSessionId`, `createdAt`),
    INDEX `Note_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GemType` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GemType_projectId_key`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GemLedgerEntry` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `workSessionId` VARCHAR(191) NOT NULL,
    `gemTypeId` VARCHAR(191) NOT NULL,
    `activeDurationSec` INTEGER NOT NULL,
    `carryInSec` INTEGER NOT NULL,
    `carryOutSec` INTEGER NOT NULL,
    `gemsAwarded` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GemLedgerEntry_workSessionId_key`(`workSessionId`),
    INDEX `GemLedgerEntry_tenantId_idx`(`tenantId`),
    INDEX `GemLedgerEntry_userId_projectId_idx`(`userId`, `projectId`),
    INDEX `GemLedgerEntry_gemTypeId_idx`(`gemTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GemBalance` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `gemTypeId` VARCHAR(191) NOT NULL,
    `totalGems` INTEGER NOT NULL DEFAULT 0,
    `carrySec` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GemBalance_projectId_idx`(`projectId`),
    INDEX `GemBalance_gemTypeId_idx`(`gemTypeId`),
    UNIQUE INDEX `GemBalance_userId_projectId_gemTypeId_key`(`userId`, `projectId`, `gemTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentEmployee` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `kind` ENUM('SUMMARIZER', 'QA', 'PM', 'CODE_REVIEW', 'STEERING', 'CUSTOM') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `schedule` VARCHAR(191) NOT NULL,
    `lastRunAt` DATETIME(3) NULL,
    `config` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AgentEmployee_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentReport` (
    `id` VARCHAR(191) NOT NULL,
    `agentEmployeeId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `type` ENUM('SUMMARY', 'REVIEW', 'PROPOSAL', 'GOAL') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `postedTo` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AgentReport_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `AgentReport_agentEmployeeId_idx`(`agentEmployeeId`),
    INDEX `AgentReport_teamId_idx`(`teamId`),
    INDEX `AgentReport_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Goal` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('PROPOSED', 'ACTIVE', 'DONE', 'DROPPED') NOT NULL DEFAULT 'PROPOSED',
    `progressPercent` INTEGER NOT NULL DEFAULT 0,
    `complexityScore` INTEGER NOT NULL DEFAULT 3,
    `estimatedHours` DOUBLE NULL,
    `sourceAgentReportId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Goal_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `Goal_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Integration` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `kind` ENUM('GOOGLE', 'DISCORD', 'GITHUB') NOT NULL,
    `status` ENUM('CONNECTED', 'DISCONNECTED', 'ERROR') NOT NULL DEFAULT 'DISCONNECTED',
    `credentials` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Integration_tenantId_kind_key`(`tenantId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoogleDocLink` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `workSessionId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NULL,
    `docId` VARCHAR(191) NOT NULL,
    `docUrl` VARCHAR(191) NOT NULL,
    `syncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GoogleDocLink_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiscordBinding` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `postTypes` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DiscordBinding_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GithubBinding` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `installationId` VARCHAR(191) NOT NULL,
    `repoFullName` VARCHAR(191) NOT NULL,
    `linkedProjectId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GithubBinding_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_activeTenantId_fkey` FOREIGN KEY (`activeTenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminUser` ADD CONSTRAINT `AdminUser_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Team` ADD CONSTRAINT `Team_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamMembership` ADD CONSTRAINT `TeamMembership_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamMembership` ADD CONSTRAINT `TeamMembership_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkSession` ADD CONSTRAINT `WorkSession_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkSession` ADD CONSTRAINT `WorkSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkSession` ADD CONSTRAINT `WorkSession_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkSession` ADD CONSTRAINT `WorkSession_goalId_fkey` FOREIGN KEY (`goalId`) REFERENCES `Goal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkSessionInterval` ADD CONSTRAINT `WorkSessionInterval_workSessionId_fkey` FOREIGN KEY (`workSessionId`) REFERENCES `WorkSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Note` ADD CONSTRAINT `Note_workSessionId_fkey` FOREIGN KEY (`workSessionId`) REFERENCES `WorkSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Note` ADD CONSTRAINT `Note_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GemType` ADD CONSTRAINT `GemType_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GemLedgerEntry` ADD CONSTRAINT `GemLedgerEntry_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GemLedgerEntry` ADD CONSTRAINT `GemLedgerEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GemLedgerEntry` ADD CONSTRAINT `GemLedgerEntry_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GemLedgerEntry` ADD CONSTRAINT `GemLedgerEntry_workSessionId_fkey` FOREIGN KEY (`workSessionId`) REFERENCES `WorkSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GemLedgerEntry` ADD CONSTRAINT `GemLedgerEntry_gemTypeId_fkey` FOREIGN KEY (`gemTypeId`) REFERENCES `GemType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GemBalance` ADD CONSTRAINT `GemBalance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GemBalance` ADD CONSTRAINT `GemBalance_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GemBalance` ADD CONSTRAINT `GemBalance_gemTypeId_fkey` FOREIGN KEY (`gemTypeId`) REFERENCES `GemType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentEmployee` ADD CONSTRAINT `AgentEmployee_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentReport` ADD CONSTRAINT `AgentReport_agentEmployeeId_fkey` FOREIGN KEY (`agentEmployeeId`) REFERENCES `AgentEmployee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentReport` ADD CONSTRAINT `AgentReport_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentReport` ADD CONSTRAINT `AgentReport_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentReport` ADD CONSTRAINT `AgentReport_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goal` ADD CONSTRAINT `Goal_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goal` ADD CONSTRAINT `Goal_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goal` ADD CONSTRAINT `Goal_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goal` ADD CONSTRAINT `Goal_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goal` ADD CONSTRAINT `Goal_sourceAgentReportId_fkey` FOREIGN KEY (`sourceAgentReportId`) REFERENCES `AgentReport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Integration` ADD CONSTRAINT `Integration_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoogleDocLink` ADD CONSTRAINT `GoogleDocLink_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoogleDocLink` ADD CONSTRAINT `GoogleDocLink_workSessionId_fkey` FOREIGN KEY (`workSessionId`) REFERENCES `WorkSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoogleDocLink` ADD CONSTRAINT `GoogleDocLink_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscordBinding` ADD CONSTRAINT `DiscordBinding_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GithubBinding` ADD CONSTRAINT `GithubBinding_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GithubBinding` ADD CONSTRAINT `GithubBinding_linkedProjectId_fkey` FOREIGN KEY (`linkedProjectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

