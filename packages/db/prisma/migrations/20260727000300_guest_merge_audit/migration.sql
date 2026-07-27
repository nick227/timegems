-- GuestMerge: the audit trail for GuestMergeService (see schema.prisma's
-- User comment) -- one row per completed guest→target merge, never mutated
-- after creation. `guestUserId` unique so a guest can be merged exactly
-- once, ever (this doubles as the feature's durable idempotency guarantee).
CREATE TABLE `GuestMerge` (
    `id` VARCHAR(191) NOT NULL,
    `guestUserId` VARCHAR(191) NOT NULL,
    `targetUserId` VARCHAR(191) NOT NULL,
    `sourceTenantId` VARCHAR(191) NULL,
    `finalizedSessionIds` JSON NULL,
    `mergedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GuestMerge_guestUserId_key`(`guestUserId`),
    INDEX `GuestMerge_targetUserId_idx`(`targetUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GuestMerge` ADD CONSTRAINT `GuestMerge_guestUserId_fkey` FOREIGN KEY (`guestUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuestMerge` ADD CONSTRAINT `GuestMerge_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
