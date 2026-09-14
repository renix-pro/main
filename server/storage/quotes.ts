import {
  type Vendor,
  type InsertVendor,
  vendors,
  type Quote,
  type InsertQuote,
  quotes,
  type QuoteVersion,
  type InsertQuoteVersion,
  quoteVersions,
  type QuoteFinancials,
  type InsertQuoteFinancials,
  quoteFinancials,
  type VendorSnapshot,
  type InsertVendorSnapshot,
  vendorSnapshots,
  type QuoteMetadata,
  type InsertQuoteMetadata,
  quoteMetadata,
  type QuoteLineItem,
  type InsertQuoteLineItem,
  quoteLineItems,
  type QuoteTotal,
  type InsertQuoteTotal,
  quoteTotals,
  type PendingUpload,
  type InsertPendingUpload,
  pendingUploads,
  quoteAssessments,
} from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import type { db as DbType } from "../db";

type Db = typeof DbType;

export async function getVendorsByProject(db: Db, projectId: string, userId: string): Promise<Vendor[]> {
  return await db.select().from(vendors)
    .where(and(eq(vendors.projectId, projectId), eq(vendors.userId, userId)))
    .orderBy(desc(vendors.createdAt));
}

export async function getVendorByName(db: Db, projectId: string, userId: string, name: string): Promise<Vendor | undefined> {
  const [vendor] = await db.select().from(vendors)
    .where(and(eq(vendors.projectId, projectId), eq(vendors.userId, userId), eq(vendors.name, name)))
    .limit(1);
  return vendor;
}

export async function createVendor(db: Db, vendor: InsertVendor): Promise<Vendor> {
  const [created] = await db.insert(vendors).values(vendor).returning();
  return created;
}

export async function updateVendor(db: Db, id: string, userId: string, updates: Partial<InsertVendor>): Promise<Vendor | undefined> {
  const [updated] = await db.update(vendors)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(vendors.id, id), eq(vendors.userId, userId)))
    .returning();
  return updated;
}

export async function deleteVendor(db: Db, id: string, userId: string): Promise<boolean> {
  const result = await db.delete(vendors)
    .where(and(eq(vendors.id, id), eq(vendors.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export async function getQuotesByProject(db: Db, projectId: string, userId: string): Promise<Quote[]> {
  return await db.select().from(quotes)
    .where(and(eq(quotes.projectId, projectId), eq(quotes.userId, userId)))
    .orderBy(desc(quotes.createdAt));
}

export async function getQuoteById(db: Db, id: string, userId: string): Promise<Quote | undefined> {
  const [quote] = await db.select().from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.userId, userId)));
  return quote;
}

export async function getQuoteByLegacyVersionId(db: Db, legacyVersionId: string, userId: string): Promise<Quote | undefined> {
  const [byLegacy] = await db.select().from(quotes)
    .where(and(eq(quotes.legacyVersionId, legacyVersionId), eq(quotes.userId, userId)));
  if (byLegacy) return byLegacy;
  const [byId] = await db.select().from(quotes)
    .where(and(eq(quotes.id, legacyVersionId), eq(quotes.userId, userId)));
  return byId;
}

export async function createQuote(db: Db, quote: InsertQuote): Promise<Quote> {
  const [created] = await db.insert(quotes).values(quote).returning();
  return created;
}

export async function updateQuote(db: Db, id: string, userId: string, updates: Partial<InsertQuote>): Promise<Quote | undefined> {
  const [updated] = await db.update(quotes)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
    .returning();
  return updated;
}

export async function deleteQuote(db: Db, id: string, userId: string): Promise<boolean> {
  const [quote] = await db.select().from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.userId, userId)));
  if (!quote) return false;

  const versions = await db.select().from(quoteVersions)
    .where(eq(quoteVersions.quoteId, id));
  const versionIds = versions.map(v => v.id);

  if (versionIds.length > 0) {
    await db.delete(quoteLineItems).where(inArray(quoteLineItems.quoteVersionId, versionIds));
    await db.delete(quoteTotals).where(inArray(quoteTotals.quoteVersionId, versionIds));
    await db.delete(quoteMetadata).where(inArray(quoteMetadata.quoteVersionId, versionIds));
    await db.delete(vendorSnapshots).where(inArray(vendorSnapshots.quoteVersionId, versionIds));
    await db.delete(quoteVersions).where(eq(quoteVersions.quoteId, id));
  }

  await db.delete(quoteFinancials).where(eq(quoteFinancials.quoteId, id));
  await db.delete(quoteAssessments).where(eq(quoteAssessments.quoteId, id));

  const result = await db.delete(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export async function getVersionsByQuote(db: Db, quoteId: string, userId: string): Promise<QuoteVersion[]> {
  return await db.select().from(quoteVersions)
    .where(and(eq(quoteVersions.quoteId, quoteId), eq(quoteVersions.userId, userId)))
    .orderBy(desc(quoteVersions.createdAt));
}

export async function getQuoteVersionById(db: Db, id: string, userId: string): Promise<QuoteVersion | undefined> {
  const [version] = await db.select().from(quoteVersions)
    .where(and(eq(quoteVersions.id, id), eq(quoteVersions.userId, userId)));
  return version;
}

export async function createQuoteVersion(db: Db, version: InsertQuoteVersion): Promise<QuoteVersion> {
  const [created] = await db.insert(quoteVersions).values(version).returning();
  return created;
}

export async function updateQuoteVersion(db: Db, id: string, userId: string, updates: Partial<InsertQuoteVersion>): Promise<QuoteVersion | undefined> {
  const [updated] = await db.update(quoteVersions)
    .set(updates)
    .where(and(eq(quoteVersions.id, id), eq(quoteVersions.userId, userId)))
    .returning();
  return updated;
}

export async function updateVersionStatus(
  db: Db,
  versionId: string,
  userId: string,
  updates: { extractionStatus?: string; commitmentStatus?: string }
): Promise<QuoteVersion | undefined> {
  const [existing] = await db.select().from(quoteVersions)
    .where(and(eq(quoteVersions.id, versionId), eq(quoteVersions.userId, userId)));
  if (!existing) return undefined;

  const setFields: Record<string, any> = {};

  if (updates.extractionStatus) {
    if (!['draft', 'verified'].includes(updates.extractionStatus)) {
      throw new Error(`Invalid extractionStatus: ${updates.extractionStatus}`);
    }
    setFields.extractionStatus = updates.extractionStatus;
  }

  if (updates.commitmentStatus) {
    if (!['active', 'superseded', 'accepted'].includes(updates.commitmentStatus)) {
      throw new Error(`Invalid commitmentStatus: ${updates.commitmentStatus}`);
    }
    const effectiveExtractionStatus = updates.extractionStatus || existing.extractionStatus;
    if ((updates.commitmentStatus === 'accepted') && effectiveExtractionStatus !== 'verified') {
      throw new Error('Cannot set commitmentStatus to accepted unless extractionStatus is verified');
    }

    setFields.commitmentStatus = updates.commitmentStatus;
  }

  if (Object.keys(setFields).length === 0) return existing;

  const [updated] = await db.update(quoteVersions)
    .set(setFields)
    .where(and(eq(quoteVersions.id, versionId), eq(quoteVersions.userId, userId)))
    .returning();
  return updated;
}


export async function getFinancialsByQuote(db: Db, quoteId: string, userId: string): Promise<QuoteFinancials | undefined> {
  const verifiedFinancials = await db.select({
      financials: quoteFinancials,
      commitmentStatus: quotes.commitmentStatus,
      extractionStatus: quotes.extractionStatus,
    })
    .from(quoteFinancials)
    .innerJoin(quotes, eq(quoteFinancials.quoteId, quotes.id))
    .where(and(
      eq(quoteFinancials.quoteId, quoteId),
      eq(quoteFinancials.userId, userId),
      eq(quotes.extractionStatus, 'verified'),
      inArray(quotes.commitmentStatus, ['active', 'accepted'])
    ));

  if (verifiedFinancials.length === 0) return undefined;

  const accepted = verifiedFinancials.find(r => r.commitmentStatus === 'accepted');
  if (accepted) return accepted.financials;

  return verifiedFinancials[0].financials;
}

export async function getFinancialsByVersion(db: Db, versionId: string, userId: string): Promise<QuoteFinancials | undefined> {
  const [result] = await db.select().from(quoteFinancials)
    .where(and(eq(quoteFinancials.quoteVersionId, versionId), eq(quoteFinancials.userId, userId)));
  return result;
}

export async function createQuoteFinancials(db: Db, financials: InsertQuoteFinancials): Promise<QuoteFinancials> {
  const [created] = await db.insert(quoteFinancials).values(financials).returning();
  return created;
}

export async function updateQuoteFinancials(db: Db, id: string, userId: string, updates: Partial<InsertQuoteFinancials>): Promise<QuoteFinancials | undefined> {
  const [updated] = await db.update(quoteFinancials)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(quoteFinancials.id, id), eq(quoteFinancials.userId, userId)))
    .returning();
  return updated;
}

export async function getVendorSnapshotByVersion(db: Db, quoteVersionId: string, userId: string): Promise<VendorSnapshot | undefined> {
  const [snapshot] = await db.select().from(vendorSnapshots)
    .where(and(eq(vendorSnapshots.quoteVersionId, quoteVersionId), eq(vendorSnapshots.userId, userId)));
  return snapshot;
}

export async function createVendorSnapshot(db: Db, snapshot: InsertVendorSnapshot): Promise<VendorSnapshot> {
  const [created] = await db.insert(vendorSnapshots).values(snapshot).returning();
  return created;
}

export async function updateVendorSnapshot(db: Db, id: string, userId: string, updates: { name?: string; contactDetails?: any; confidence?: string }): Promise<VendorSnapshot | undefined> {
  const [updated] = await db.update(vendorSnapshots)
    .set(updates)
    .where(and(eq(vendorSnapshots.id, id), eq(vendorSnapshots.userId, userId)))
    .returning();
  return updated;
}

export async function getQuoteMetadataByVersion(db: Db, quoteVersionId: string, userId: string): Promise<QuoteMetadata | undefined> {
  const [metadata] = await db.select().from(quoteMetadata)
    .where(and(eq(quoteMetadata.quoteVersionId, quoteVersionId), eq(quoteMetadata.userId, userId)));
  return metadata;
}

export async function createQuoteMetadata(db: Db, metadata: InsertQuoteMetadata): Promise<QuoteMetadata> {
  const [created] = await db.insert(quoteMetadata).values(metadata).returning();
  return created;
}

export async function updateQuoteMetadata(db: Db, id: string, userId: string, updates: Partial<InsertQuoteMetadata>): Promise<QuoteMetadata | undefined> {
  const [updated] = await db.update(quoteMetadata)
    .set(updates)
    .where(and(eq(quoteMetadata.id, id), eq(quoteMetadata.userId, userId)))
    .returning();
  return updated;
}

export async function getLineItemsByVersion(db: Db, quoteVersionId: string, userId: string): Promise<QuoteLineItem[]> {
  return await db.select().from(quoteLineItems)
    .where(and(eq(quoteLineItems.quoteVersionId, quoteVersionId), eq(quoteLineItems.userId, userId)));
}

export async function createQuoteLineItem(db: Db, item: InsertQuoteLineItem): Promise<QuoteLineItem> {
  const [created] = await db.insert(quoteLineItems).values(item).returning();
  return created;
}

export async function updateQuoteLineItem(db: Db, id: string, userId: string, updates: Partial<InsertQuoteLineItem>): Promise<QuoteLineItem | undefined> {
  const [updated] = await db.update(quoteLineItems)
    .set(updates)
    .where(and(eq(quoteLineItems.id, id), eq(quoteLineItems.userId, userId)))
    .returning();
  return updated;
}

export async function deleteQuoteLineItem(db: Db, id: string, userId: string): Promise<boolean> {
  const result = await db.delete(quoteLineItems)
    .where(and(eq(quoteLineItems.id, id), eq(quoteLineItems.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

const SUBTOTAL_TOTAL_KEYWORDS = [
  'zwischensumme', 'gesamtbetrag', 'endsumme', 'nettobetrag',
  'subtotal', 'sub-total', 'sub total',
  'total', 'grand total', 'sum total', 'net total',
  'sous-total', 'sous total', 'total general', 'total général',
];

function isSubtotalOrTotalDescription(rawDesc: string): boolean {
  const normalized = rawDesc.trim().toLowerCase().replace(/[^a-zà-ÿ0-9\s-]/g, '').trim();
  if (!normalized) return false;
  return SUBTOTAL_TOTAL_KEYWORDS.some(keyword =>
    normalized === keyword || normalized.startsWith(keyword + ' ') || normalized.startsWith(keyword + '\t')
  );
}

export async function deleteSubtotalAndTotalLineItems(db: Db, quoteVersionId: string, userId: string): Promise<number> {
  const allLineItems = await db.select({ id: quoteLineItems.id, lineType: quoteLineItems.lineType, description: quoteLineItems.description })
    .from(quoteLineItems)
    .where(and(
      eq(quoteLineItems.quoteVersionId, quoteVersionId),
      eq(quoteLineItems.userId, userId),
    ));

  const itemsToDelete = allLineItems.filter(item => {
    if (item.lineType === 'subtotal' || item.lineType === 'total') return true;
    return isSubtotalOrTotalDescription(item.description ?? '');
  });

  if (itemsToDelete.length === 0) return 0;

  const idsToDelete = itemsToDelete.map(item => item.id);

  const result = await db.delete(quoteLineItems)
    .where(inArray(quoteLineItems.id, idsToDelete));

  return result.rowCount ?? 0;
}

export async function getTotalsByVersion(db: Db, quoteVersionId: string, userId: string): Promise<QuoteTotal | undefined> {
  const [totals] = await db.select().from(quoteTotals)
    .where(and(eq(quoteTotals.quoteVersionId, quoteVersionId), eq(quoteTotals.userId, userId)));
  return totals;
}

export async function createQuoteTotals(db: Db, totals: InsertQuoteTotal): Promise<QuoteTotal> {
  const [created] = await db.insert(quoteTotals).values(totals).returning();
  return created;
}

export async function updateQuoteTotals(db: Db, id: string, userId: string, updates: Partial<InsertQuoteTotal>): Promise<QuoteTotal | undefined> {
  const [updated] = await db.update(quoteTotals)
    .set(updates)
    .where(and(eq(quoteTotals.id, id), eq(quoteTotals.userId, userId)))
    .returning();
  return updated;
}

export async function createPendingUpload(db: Db, upload: InsertPendingUpload): Promise<PendingUpload> {
  const [created] = await db.insert(pendingUploads).values(upload).returning();
  return created;
}

export async function getPendingUpload(db: Db, token: string): Promise<PendingUpload | undefined> {
  const [upload] = await db
    .select()
    .from(pendingUploads)
    .where(eq(pendingUploads.token, token));
  return upload;
}

export async function consumePendingUpload(db: Db, token: string): Promise<PendingUpload | undefined> {
  const [upload] = await db
    .update(pendingUploads)
    .set({ consumed: true })
    .where(
      and(
        eq(pendingUploads.token, token),
        eq(pendingUploads.consumed, false)
      )
    )
    .returning();
  return upload;
}

export async function deleteExpiredPendingUploads(db: Db): Promise<void> {
  const now = new Date();
  await db.delete(pendingUploads).where(
    and(
      eq(pendingUploads.consumed, true)
    )
  );
  const expiredUploads = await db
    .select()
    .from(pendingUploads)
    .where(eq(pendingUploads.consumed, false));
  
  for (const upload of expiredUploads) {
    if (upload.expiresAt < now) {
      await db.delete(pendingUploads).where(eq(pendingUploads.token, upload.token));
    }
  }
}
