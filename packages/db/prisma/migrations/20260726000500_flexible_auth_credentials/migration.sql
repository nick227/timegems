-- Support credential-free guest accounts and optional email/password login.
ALTER TABLE `User`
    MODIFY `email` VARCHAR(191) NULL,
    MODIFY `googleId` VARCHAR(191) NULL,
    ADD COLUMN `passwordHash` VARCHAR(191) NULL,
    ADD COLUMN `isAnonymous` BOOLEAN NOT NULL DEFAULT false;
