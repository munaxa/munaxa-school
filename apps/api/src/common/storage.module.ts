import { Global, Module } from '@nestjs/common';
import { StorageLedgerRepository } from './storage-ledger.repository';
import { StorageService } from './storage.service';

/**
 * Object storage, provided once for the whole API. One instance and one ledger, so every upload
 * path — homework, receipts, documents, resources, branding, agreements — is metered against the
 * same `storage_gb` limit (StorageService). Modules inject {@link StorageService}; none provides
 * its own.
 */
@Global()
@Module({
  providers: [StorageService, StorageLedgerRepository],
  exports: [StorageService],
})
export class StorageModule {}
