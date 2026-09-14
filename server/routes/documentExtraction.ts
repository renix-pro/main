/**
 * Document-level quote extraction for the Quotes-frame import pipeline and the
 * AI companion's upload flow.
 *
 *   POST /api/projects/:projectId/documents/:docId/extract     start (idempotent)
 *   GET  /api/projects/:projectId/documents/:docId/extraction  poll status
 *
 * The client (QuoteImportPipeline.tsx, AIConversationPane.tsx) polls the GET
 * every 2 s until `status` is "completed" or "failed". Jobs are kept in memory
 * for the life of the server process; after a restart the client sees
 * "pending" and re-triggers the POST, which re-runs the extraction.
 */
import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireProjectAccess } from "./shared/middleware";
import { extractFromObjectPath, type ExtractedQuote } from "../replit_integrations/document";

type ExtractionStatus = "pending" | "processing" | "completed" | "failed";

interface ReviewTreeNode {
  id: string;
  number: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  rowType: "section" | "line_item" | "subtotal" | "note";
  children: ReviewTreeNode[];
}

/** Shape consumed by client/src/frames/quotes/ExtractionReviewScreen.tsx (ExtractedQuoteData). */
export interface ReviewExtractedData {
  vendorName: string | null;
  vendorContact?: string | null;
  vendorEmail?: string | null;
  vendorPhone?: string | null;
  quoteReference: string | null;
  quoteDate: string | null;
  currency: string | null;
  notes?: string | null;
  tree: ReviewTreeNode[];
  financials: {
    netTotal: number | null;
    taxAmount: number | null;
    grossTotal: number | null;
    taxRate: number | null;
    taxLabel: string | null;
  };
}

interface ExtractionJob {
  status: ExtractionStatus;
  extractedData?: ReviewExtractedData;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

const jobs = new Map<string, ExtractionJob>();
const JOB_TTL_MS = 60 * 60 * 1000;

function pruneJobs() {
  const now = Date.now();
  jobs.forEach((job, id) => {
    if (job.finishedAt && now - job.finishedAt > JOB_TTL_MS) jobs.delete(id);
  });
}

export function toReviewExtractedData(extracted: ExtractedQuote): ReviewExtractedData {
  const tree: ReviewTreeNode[] = [];
  let n = 0;
  for (const item of extracted.lineItems || []) {
    if (item.lineType === "total") continue; // grand totals live in financials
    n += 1;
    tree.push({
      id: `row-${n}`,
      number: String(n),
      description: item.description || "",
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      unitPrice: item.unitPrice ?? null,
      totalPrice: item.amount ?? null,
      rowType: item.lineType === "subtotal" ? "subtotal" : "line_item",
      children: [],
    });
  }
  // Models return the rate either as a percentage (19) or a fraction (0.19).
  const rawTaxRate = extracted.taxRate ?? null;
  const taxRate = rawTaxRate != null && rawTaxRate > 0 && rawTaxRate <= 1
    ? Math.round(rawTaxRate * 1000) / 10
    : rawTaxRate;
  return {
    vendorName: extracted.vendorName ?? null,
    vendorContact: extracted.vendorContact ?? null,
    vendorEmail: extracted.vendorEmail ?? null,
    vendorPhone: extracted.vendorPhone ?? null,
    quoteReference: extracted.reference ?? null,
    quoteDate: extracted.date ?? null,
    currency: extracted.currency ?? null,
    notes: extracted.notes ?? null,
    tree,
    financials: {
      netTotal: extracted.subtotal ?? null,
      taxAmount: extracted.tax ?? null,
      grossTotal: extracted.total ?? null,
      taxRate,
      taxLabel: taxRate != null ? `Tax ${taxRate}%` : null,
    },
  };
}

async function loadProjectDocument(req: Request, res: Response) {
  const user = (req as any).user;
  const { projectId, docId } = req.params;
  const document = await storage.getDocumentById(docId, user.id);
  if (!document || document.projectId !== projectId) {
    res.status(404).json({ message: "Document not found" });
    return null;
  }
  return document;
}

export function registerDocumentExtractionRoutes(app: Express): void {
  app.post("/api/projects/:projectId/documents/:docId/extract", requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const document = await loadProjectDocument(req, res);
      if (!document) return;
      pruneJobs();

      const existing = jobs.get(document.id);
      if (existing && (existing.status === "processing" || existing.status === "completed")) {
        return res.status(200).json({ documentId: document.id, status: existing.status });
      }

      const objectPath = document.fileDataUrl;
      if (!objectPath) {
        return res.status(400).json({ message: "Document has no stored file to extract from" });
      }

      const job: ExtractionJob = { status: "processing", startedAt: Date.now() };
      jobs.set(document.id, job);

      extractFromObjectPath(objectPath)
        .then((extracted) => {
          job.extractedData = toReviewExtractedData(extracted);
          job.status = "completed";
          job.finishedAt = Date.now();
          console.log(`[DocExtraction] Completed for document ${document.id} (${job.extractedData.tree.length} rows)`);
        })
        .catch((error) => {
          job.status = "failed";
          job.error = error instanceof Error ? error.message : "Extraction failed";
          job.finishedAt = Date.now();
          console.error(`[DocExtraction] Failed for document ${document.id}:`, job.error);
        });

      return res.status(202).json({ documentId: document.id, status: job.status });
    } catch (error) {
      console.error("[DocExtraction] Error starting extraction:", error);
      return res.status(500).json({ message: "Failed to start extraction" });
    }
  });

  app.get("/api/projects/:projectId/documents/:docId/extraction", requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const document = await loadProjectDocument(req, res);
      if (!document) return;
      const job = jobs.get(document.id);
      if (!job) {
        return res.json({ documentId: document.id, status: "pending" as ExtractionStatus });
      }
      return res.json({
        documentId: document.id,
        status: job.status,
        extractedData: job.extractedData,
        error: job.error,
      });
    } catch (error) {
      console.error("[DocExtraction] Error reading extraction status:", error);
      return res.status(500).json({ message: "Failed to read extraction status" });
    }
  });
}
