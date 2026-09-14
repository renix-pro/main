import type { db as DbType } from "../db";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { sourceDocuments, quotes } from "@shared/schema";
import * as documentsStorage from "./documents";
import { storage } from "../storage";

type Db = typeof DbType;

export async function cleanupEntityDocuments(
  db: Db,
  entityType: string,
  entityId: string,
  userId: string
): Promise<{ deletedDocuments: number; removedAssociations: number }> {
  const entityAssociations = await documentsStorage.getAssociationsByEntity(db, entityType, entityId, userId);

  const seen = new Set<string>();
  const linkedDocumentIds: string[] = [];
  for (const a of entityAssociations) {
    if (!seen.has(a.documentId)) {
      seen.add(a.documentId);
      linkedDocumentIds.push(a.documentId);
    }
  }

  let deletedDocuments = 0;
  let removedAssociations = 0;

  for (const docId of linkedDocumentIds) {
    const allDocAssociations = await documentsStorage.getAssociationsByDocument(db, docId, userId);

    const thisEntityAssocs = allDocAssociations.filter(
      a => a.associationType === entityType && a.entityId === entityId
    );
    for (const assoc of thisEntityAssocs) {
      await documentsStorage.deleteAssociation(db, assoc.id, userId);
      removedAssociations++;
    }

    const remaining = allDocAssociations.filter(
      a => !thisEntityAssocs.some(ea => ea.id === a.id) && a.associationType !== 'scope'
    );

    if (remaining.length === 0) {
      await documentsStorage.deleteDocument(db, docId, userId);
      deletedDocuments++;
    }
  }

  return { deletedDocuments, removedAssociations };
}

export async function cleanupScopeAssociations(
  db: Db,
  scopeId: string,
  userId: string
): Promise<number> {
  return await documentsStorage.deleteAssociationsByEntity(db, 'scope', scopeId, userId);
}

export async function unlinkAndDeleteDocument(
  docId: string,
  projectId: string,
  userId: string,
  deleteDocument: boolean = true
): Promise<{
  unlinkedQuotes: number;
  unlinkedInvoices: number;
  unlinkedScopes: number;
  unlinkedSessions: number;
  documentDeleted: boolean;
}> {
  const associations = await storage.getAssociationsByDocument(docId, userId);

  let unlinkedQuotes = 0;
  let unlinkedInvoices = 0;
  let unlinkedScopes = 0;

  for (const assoc of associations) {
    if (assoc.associationType === 'quote') {
      try {
        await storage.deleteQuote(assoc.entityId, userId);
      } catch (e) {
        console.warn(`[DocumentReplace] Failed to delete quote ${assoc.entityId}, may already be deleted:`, e);
      }
      await storage.deleteAssociation(assoc.id, userId);
      unlinkedQuotes++;
    } else if (assoc.associationType === 'invoice') {
      try {
        const payments = await storage.getPaymentsByInvoice(assoc.entityId, userId);
        for (const payment of payments) {
          await storage.deleteInvoicePayment(payment.id, userId);
        }
        const lines = await storage.getLinesByInvoice(assoc.entityId, userId);
        for (const line of lines) {
          await storage.deleteInvoiceLine(line.id, userId);
        }
        await storage.deleteInvoice(assoc.entityId, userId);
      } catch (e) {
        console.warn(`[DocumentReplace] Failed to delete invoice ${assoc.entityId}, may already be deleted:`, e);
      }
      await storage.deleteAssociation(assoc.id, userId);
      unlinkedInvoices++;
    } else if (assoc.associationType === 'scope') {
      await storage.deleteAssociation(assoc.id, userId);
      unlinkedScopes++;
    }
  }

  // Second pass: cascade through the source_documents → quotes path.
  // When ingestion is interrupted, document_associations may never be written,
  // leaving quotes orphaned after the document is deleted. Find and clean them up.
  const linkedSourceDocs = await db
    .select({ id: sourceDocuments.id })
    .from(sourceDocuments)
    .where(eq(sourceDocuments.documentId, docId));

  for (const sd of linkedSourceDocs) {
    const orphanedQuotes = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(eq(quotes.sourceDocumentId, sd.id));

    for (const q of orphanedQuotes) {
      try {
        await storage.deleteQuote(q.id, userId);
        unlinkedQuotes++;
        console.log(`[DocumentCleanup] Cascade-deleted orphaned quote ${q.id} (via sourceDocument ${sd.id})`);
      } catch (e) {
        console.warn(`[DocumentCleanup] Failed to delete orphaned quote ${q.id}:`, e);
      }
    }
  }

  let documentDeleted = false;
  if (deleteDocument) {
    try {
      const deleted = await storage.deleteDocument(docId, userId);
      documentDeleted = !!deleted;
    } catch (e) {
      console.warn(`[DocumentReplace] Failed to delete document ${docId}:`, e);
    }
  }

  console.log(`[DocumentReplace] doc=${docId} unlinkedQuotes=${unlinkedQuotes} unlinkedInvoices=${unlinkedInvoices} unlinkedScopes=${unlinkedScopes} documentDeleted=${documentDeleted}`);

  return { unlinkedQuotes, unlinkedInvoices, unlinkedScopes, unlinkedSessions: 0, documentDeleted };
}
