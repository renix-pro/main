import type { Express, Request, Response } from "express";
import { completeJson, imageBlock, pdfBlock } from "../../ai/claude";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ObjectStorageService } from "../object_storage/objectStorage";
import { PDFParse } from "pdf-parse";

/** Image or PDF content block for vision-based extraction. */
function visualBlock(base64Data: string, mimeType: string): Anthropic.ContentBlockParam {
  return mimeType === "application/pdf" ? pdfBlock(base64Data) : imageBlock(base64Data, mimeType);
}

const ExtractedLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  unitPrice: z.number().nullable().optional(),
  amount: z.number().nullable().optional(),
  lineType: z.enum(['item', 'subtotal', 'total']).optional().default('item'),
});

const ExtractedQuoteSchema = z.object({
  vendorName: z.string().nullable().optional(),
  vendorContact: z.string().nullable().optional(),
  vendorEmail: z.string().nullable().optional(),
  vendorPhone: z.string().nullable().optional(),
  vendorAddress: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  lineItems: z.array(ExtractedLineItemSchema),
  subtotal: z.number().nullable().optional(),
  tax: z.number().nullable().optional(),
  taxRate: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

export type ExtractedQuote = z.infer<typeof ExtractedQuoteSchema>;
export type ExtractedLineItem = z.infer<typeof ExtractedLineItemSchema>;

// Invoice Extraction Schema
const ExtractedInvoiceSchema = z.object({
  vendorName: z.string().nullable().optional(),
  vendorContact: z.string().nullable().optional(),
  vendorEmail: z.string().nullable().optional(),
  vendorPhone: z.string().nullable().optional(),
  vendorAddress: z.string().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  lineItems: z.array(ExtractedLineItemSchema),
  subtotal: z.number().nullable().optional(),
  tax: z.number().nullable().optional(),
  taxRate: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

export type ExtractedInvoice = z.infer<typeof ExtractedInvoiceSchema>;

// Native Row Schema - preserves original vendor structure exactly
const NativeRowSchema = z.object({
  rowType: z.enum(['section', 'line_item', 'note', 'subtotal', 'total']),
  originalCells: z.record(z.string(), z.any()), // Preserves vendor's column structure
  orderIndex: z.number(),
  confidenceMap: z.record(z.string(), z.number()).optional(),
});

const NativeExtractionSchema = z.object({
  nativeRows: z.array(NativeRowSchema),
  columnHeaders: z.array(z.string()), // Original column headers from the document
  language: z.string().optional(), // Detected language
  confidence: z.number().min(0).max(1),
});

export type NativeRow = z.infer<typeof NativeRowSchema>;
export type NativeExtraction = z.infer<typeof NativeExtractionSchema>;

// Document Classification Schema
const DocumentClassificationSchema = z.object({
  documentType: z.enum(['quote', 'invoice', 'contract', 'plan', 'image', 'unknown']),
  confidence: z.enum(['high', 'medium', 'low']),
  signals: z.object({
    hasVendorName: z.boolean(),
    hasQuoteWording: z.boolean(),
    hasPricesOrTotals: z.boolean(),
    hasValidityDate: z.boolean(),
    hasLineItems: z.boolean(),
    hasInvoiceWording: z.boolean(),
    hasContractWording: z.boolean(),
  }),
  suggestedAction: z.enum(['auto_process', 'confirm_with_user', 'ask_document_type']),
  explanation: z.string(),
  coverageSummary: z.string().nullable().optional(),
});

export type DocumentClassification = z.infer<typeof DocumentClassificationSchema>;

// Combined extraction result
export interface FullExtractionResult {
  native: NativeExtraction;
  derived: ExtractedQuote;
  classification?: DocumentClassification;
}

const DOCUMENT_CLASSIFICATION_PROMPT = `You are a document classification expert. Analyze this document and determine its type.

DOCUMENT TYPES:
- quote: Quotes, estimates, offers, proposals with prices from vendors
- invoice: Invoices, bills, payment requests
- contract: Contracts, agreements, terms
- plan: Floor plans, blueprints, technical drawings
- image: Photos, images without structured data
- unknown: Cannot determine document type

QUOTE IDENTIFICATION SIGNALS:
- Presence of vendor/company name
- Quote/offer/estimate wording (Angebot, Kostenvoranschlag, Estimate, Quote, Proposal)
- Prices, totals, tax (VAT/MwSt/GST)
- Validity dates (gültig bis, valid until)
- Line items or grouped cost sections

CONFIDENCE LEVELS:
- high: Strong signals, clearly identifiable document type (3+ quote signals)
- medium: Some signals present, but not definitive (1-2 quote signals)
- low: Unclear, ambiguous, or conflicting signals (0 quote signals)

SUGGESTED ACTIONS:
- auto_process: High confidence quote - proceed automatically
- confirm_with_user: Medium/low confidence quote - ask user to confirm
- ask_document_type: Unknown type - ask user what this document is

Also provide a brief coverage summary if this appears to be a quote (what work is included/excluded).

Return JSON:
{
  "documentType": "quote" | "invoice" | "contract" | "plan" | "image" | "unknown",
  "confidence": "high" | "medium" | "low",
  "signals": {
    "hasVendorName": boolean,
    "hasQuoteWording": boolean,
    "hasPricesOrTotals": boolean,
    "hasValidityDate": boolean,
    "hasLineItems": boolean,
    "hasInvoiceWording": boolean,
    "hasContractWording": boolean
  },
  "suggestedAction": "auto_process" | "confirm_with_user" | "ask_document_type",
  "explanation": "Brief explanation of classification",
  "coverageSummary": "What work appears included/excluded (for quotes only)"
}

Return ONLY valid JSON.`;

const NATIVE_EXTRACTION_PROMPT = `You are a document extraction expert. Your task is to extract quote data EXACTLY as it appears in the document.

CRITICAL RULES:
1. PRESERVE the original language - DO NOT translate
2. PRESERVE original numbering (e.g., "Pos 1", "1.1", "A")
3. PRESERVE original column headers exactly as written
4. PRESERVE section hierarchy

Extract ALL rows from the document as native rows. Each row must have:
- rowType: 'section' | 'line_item' | 'note' | 'subtotal' | 'total'
- originalCells: key-value map using the ORIGINAL column headers
- orderIndex: sequential order (0, 1, 2, ...)
- confidenceMap: confidence per cell (0.0-1.0)

GERMAN NUMBER FORMAT (DO NOT CONVERT):
- Keep numbers in their original format for display
- For numeric values, also provide the parsed number

Row Type Guidelines:
- 'section': Section headers (e.g., "1. Rohbauarbeiten")
- 'line_item': Individual items with prices
- 'note': Text-only rows, comments
- 'subtotal': "Zwischensumme", "Übertrag" - intermediate totals
- 'total': "Gesamtsumme", "Endsumme" - final totals

Return JSON:
{
  "nativeRows": [
    {
      "rowType": "section",
      "originalCells": {"Pos": "1", "Beschreibung": "Rohbauarbeiten"},
      "orderIndex": 0,
      "confidenceMap": {"Pos": 0.95, "Beschreibung": 0.98}
    },
    {
      "rowType": "line_item",
      "originalCells": {"Pos": "1.1", "Beschreibung": "Mauerwerk", "Menge": "120", "Einheit": "m²", "EP": "45,00 €", "GP": "5.400,00 €", "EP_value": 45.00, "GP_value": 5400.00},
      "orderIndex": 1,
      "confidenceMap": {"Pos": 0.99, "Beschreibung": 0.95, "GP": 0.98}
    }
  ],
  "columnHeaders": ["Pos", "Beschreibung", "Menge", "Einheit", "EP", "GP"],
  "language": "de",
  "confidence": 0.95
}

Return ONLY valid JSON. Preserve ALL original text exactly.`;

async function extractNativeRowsFromText(text: string): Promise<NativeExtraction> {
  const parsed = await completeJson<any>({
    system: "You extract document data preserving original language and structure exactly.",
    messages: [{ role: "user", content: `${NATIVE_EXTRACTION_PROMPT}\n\nDOCUMENT TEXT:\n\n${text}` }],
    maxTokens: 32000,
  });
  console.log('Native extraction response:', JSON.stringify(parsed).substring(0, 500));
  
  return NativeExtractionSchema.parse({
    nativeRows: parsed.nativeRows || [],
    columnHeaders: parsed.columnHeaders || [],
    language: parsed.language,
    confidence: parsed.confidence ?? 0.8,
  });
}

const EXTRACTION_PROMPT = `You are a document extraction expert specializing in German construction quotes (Angebote) and estimates (Kostenvoranschläge).

CRITICAL RULES FOR GERMAN QUOTES:
1. IGNORE all "Übertrag" (carry forward) amounts - these are page-break subtotals, NOT the final total
2. The FINAL TOTAL is labeled: "Gesamtsumme Brutto", "Endsumme", "Bruttobetrag", or "Rechnungsbetrag"
3. Look for the NET total: "Nettobetrag", "Gesamtsumme Netto", or "Summe netto"
4. MwSt/USt = VAT tax (usually 19% in Germany)
5. "Zwischensumme" = section subtotal (include these as line items)

GERMAN NUMBER FORMAT:
- "206.976,00 €" = 206976.00 (dots for thousands, comma for decimal)
- "39.325,65 €" = 39325.65
- ALWAYS parse German format: X.XXX,XX means X,XXX.XX in US format

Extract the following:
- Vendor: company name, address, phone, email from letterhead
- Reference: "Angebot Nr." or quote number
- Date: "Datum" field
- Line items: Each "Pos" (position) with description, quantity (Menge), unit, unit price (Einzelpreis), amount (Summe)
- Section subtotals ("Zwischensumme") as separate line items
- Final amounts from the LAST PAGE: Netto, MwSt, Brutto

Return JSON:
{
  "vendorName": "company name",
  "vendorContact": "contact person or null",
  "vendorEmail": "email or null", 
  "vendorPhone": "phone or null",
  "vendorAddress": "full address",
  "reference": "quote reference number",
  "date": "YYYY-MM-DD",
  "validUntil": "YYYY-MM-DD or null",
  "lineItems": [
    {"description": "item", "quantity": number, "unit": "unit", "unitPrice": number, "amount": number, "lineType": "item|subtotal|total"}
  ],
  "subtotal": NET_TOTAL_NUMBER (Gesamtsumme Netto),
  "tax": TAX_AMOUNT_NUMBER (MwSt/USt amount),
  "taxRate": 0.19 (or actual rate as decimal),
  "total": GROSS_TOTAL_NUMBER (Gesamtsumme Brutto - THIS IS THE MOST IMPORTANT VALUE),
  "currency": "EUR",
  "notes": "payment terms, validity, etc.",
  "confidence": 0.0-1.0
}

For each line item, set lineType to: "item" for actual work/material items, "subtotal" for intermediate totals (Zwischensumme), "total" for final totals (Gesamtsumme/Endsumme). Most items should be "item".

CRITICAL: The "total" field MUST be the FINAL "Gesamtsumme Brutto" or "Endsumme" from the END of the document.
Do NOT use "Übertrag" amounts - these are just page subtotals.

Return ONLY valid JSON.`;

const INVOICE_EXTRACTION_PROMPT = `You are a document extraction expert specializing in invoices (Rechnungen) and bills.

CRITICAL RULES FOR INVOICES:
1. Look for invoice number: "Rechnungsnummer", "Rechnung Nr.", "Invoice No."
2. Look for invoice date: "Rechnungsdatum", "Datum", "Date"
3. Look for due date: "Fällig am", "Zahlbar bis", "Due Date", "Payment Due"
4. The FINAL TOTAL is labeled: "Gesamtsumme Brutto", "Endsumme", "Bruttobetrag", "Total", "Amount Due"
5. Look for the NET total: "Nettobetrag", "Gesamtsumme Netto", "Subtotal"
6. MwSt/USt/VAT = Tax (usually 19% in Germany)

GERMAN NUMBER FORMAT:
- "206.976,00 €" = 206976.00 (dots for thousands, comma for decimal)
- "39.325,65 €" = 39325.65
- ALWAYS parse German format: X.XXX,XX means X,XXX.XX in US format

Extract the following:
- Vendor: company name, address, phone, email from letterhead
- Invoice Number: "Rechnungsnummer", "Rechnung Nr." 
- Invoice Date: "Rechnungsdatum" or "Datum" field
- Due Date: "Fällig am", "Zahlbar bis", or payment terms
- Line items: Each position with description, quantity, unit, unit price, amount
- Final amounts: Netto, MwSt, Brutto

Return JSON:
{
  "vendorName": "company name",
  "vendorContact": "contact person or null",
  "vendorEmail": "email or null", 
  "vendorPhone": "phone or null",
  "vendorAddress": "full address",
  "invoiceNumber": "invoice reference number",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD or null",
  "lineItems": [
    {"description": "item", "quantity": number, "unit": "unit", "unitPrice": number, "amount": number, "lineType": "item|subtotal|total"}
  ],
  "subtotal": NET_TOTAL_NUMBER,
  "tax": TAX_AMOUNT_NUMBER,
  "taxRate": 0.19 (or actual rate as decimal),
  "total": GROSS_TOTAL_NUMBER (THIS IS THE MOST IMPORTANT VALUE - the amount due),
  "currency": "EUR",
  "notes": "any additional notes",
  "paymentTerms": "payment terms or conditions",
  "confidence": 0.0-1.0
}

For each line item, set lineType to: "item" for actual work/material items, "subtotal" for intermediate totals (Zwischensumme), "total" for final totals (Gesamtsumme/Endsumme). Most items should be "item".

Return ONLY valid JSON.`;

async function downloadFileAsBuffer(objectPath: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const objectStorageService = new ObjectStorageService();
  
  console.log(`Looking for file at: ${objectPath}`);
  
  // Use the ObjectStorageService which correctly handles path parsing
  const file = await objectStorageService.getObjectEntityFile(objectPath);
  
  const [metadata] = await file.getMetadata();
  const mimeType = (metadata.contentType as string) || 'application/octet-stream';
  
  console.log(`Downloading file, mimeType: ${mimeType}`);
  const [contents] = await file.download();
  
  return { buffer: contents, mimeType };
}

async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; numPages: number }> {
  try {
    // pdf-parse v2.x uses PDFParse class with getText() method
    const pdfParser = new PDFParse({ data: buffer });
    const result = await pdfParser.getText();
    
    const numPages = result.total || 1;
    const text = result.text || '';
    
    console.log(`PDF parsed: ${numPages} pages, ${text.length} characters`);
    
    // Log the last 500 characters to verify we're getting the final totals
    const lastPart = text.slice(-1000);
    console.log('Last 1000 chars of PDF (should contain final totals):', lastPart.substring(0, 500));
    
    // Clean up
    pdfParser.destroy();
    
    return { text, numPages };
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

export async function classifyDocument(text: string): Promise<DocumentClassification> {
  const parsed = await completeJson<any>({
    system: "You are a document classification expert. Analyze documents to determine their type and provide classification with confidence scores.",
    messages: [{ role: "user", content: `${DOCUMENT_CLASSIFICATION_PROMPT}\n\nDOCUMENT TEXT:\n\n${text.substring(0, 8000)}` }],
    effort: "low",
  });
  console.log('[Classification] Response:', JSON.stringify(parsed).substring(0, 500));
  
  return DocumentClassificationSchema.parse({
    documentType: parsed.documentType || 'unknown',
    confidence: parsed.confidence || 'low',
    signals: {
      hasVendorName: parsed.signals?.hasVendorName ?? false,
      hasQuoteWording: parsed.signals?.hasQuoteWording ?? false,
      hasPricesOrTotals: parsed.signals?.hasPricesOrTotals ?? false,
      hasValidityDate: parsed.signals?.hasValidityDate ?? false,
      hasLineItems: parsed.signals?.hasLineItems ?? false,
      hasInvoiceWording: parsed.signals?.hasInvoiceWording ?? false,
      hasContractWording: parsed.signals?.hasContractWording ?? false,
    },
    suggestedAction: parsed.suggestedAction || 'ask_document_type',
    explanation: parsed.explanation || 'Unable to classify document',
    coverageSummary: parsed.coverageSummary || null,
  });
}

export async function classifyDocumentFromImage(base64Data: string, mimeType: string): Promise<DocumentClassification> {
  const parsed = await completeJson<any>({
    messages: [{
      role: "user",
      content: [visualBlock(base64Data, mimeType), { type: "text", text: DOCUMENT_CLASSIFICATION_PROMPT }],
    }],
    effort: "low",
  });
  console.log('[Classification] Image response:', JSON.stringify(parsed).substring(0, 500));
  
  return DocumentClassificationSchema.parse({
    documentType: parsed.documentType || 'unknown',
    confidence: parsed.confidence || 'low',
    signals: {
      hasVendorName: parsed.signals?.hasVendorName ?? false,
      hasQuoteWording: parsed.signals?.hasQuoteWording ?? false,
      hasPricesOrTotals: parsed.signals?.hasPricesOrTotals ?? false,
      hasValidityDate: parsed.signals?.hasValidityDate ?? false,
      hasLineItems: parsed.signals?.hasLineItems ?? false,
      hasInvoiceWording: parsed.signals?.hasInvoiceWording ?? false,
      hasContractWording: parsed.signals?.hasContractWording ?? false,
    },
    suggestedAction: parsed.suggestedAction || 'ask_document_type',
    explanation: parsed.explanation || 'Unable to classify document',
    coverageSummary: parsed.coverageSummary || null,
  });
}

export async function extractQuoteFromText(text: string): Promise<ExtractedQuote> {
  const parsed = await completeJson<any>({
    system: "You are a document extraction expert specializing in construction quotes and estimates. You excel at parsing German documents.",
    messages: [{ role: "user", content: `${EXTRACTION_PROMPT}\n\nDOCUMENT TEXT:\n\n${text}` }],
  });
  console.log('AI extraction response (first 1500 chars):', JSON.stringify(parsed).substring(0, 1500));
  console.log('[Extraction] Parsed result - lineItems count:', parsed.lineItems?.length ?? 0);
  console.log('[Extraction] Parsed result - vendorName:', parsed.vendorName);
  console.log('[Extraction] Parsed result - total:', parsed.total);
  
  return ExtractedQuoteSchema.parse({
    ...parsed,
    lineItems: parsed.lineItems || [],
    confidence: parsed.confidence ?? 0.8,
  });
}

export async function extractQuoteFromImage(base64Data: string, mimeType: string): Promise<ExtractedQuote> {
  const parsed = await completeJson<any>({
    messages: [{
      role: "user",
      content: [visualBlock(base64Data, mimeType), { type: "text", text: EXTRACTION_PROMPT }],
    }],
  });
  
  return ExtractedQuoteSchema.parse({
    ...parsed,
    lineItems: parsed.lineItems || [],
    confidence: parsed.confidence ?? 0.8,
  });
}

async function extractFullQuote(text: string): Promise<FullExtractionResult> {
  // Run both extractions in parallel
  const [native, derived] = await Promise.all([
    extractNativeRowsFromText(text),
    extractQuoteFromText(text),
  ]);
  
  return { native, derived };
}

// Invoice extraction functions
export async function extractInvoiceFromText(text: string): Promise<ExtractedInvoice> {
  const parsed = await completeJson<any>({
    system: "You are a document extraction expert specializing in invoices and bills. You excel at parsing German documents.",
    messages: [{ role: "user", content: `${INVOICE_EXTRACTION_PROMPT}\n\nDOCUMENT TEXT:\n\n${text}` }],
  });
  console.log('[Invoice Extraction] AI response (first 1500 chars):', JSON.stringify(parsed).substring(0, 1500));
  console.log('[Invoice Extraction] Parsed result - lineItems count:', parsed.lineItems?.length ?? 0);
  console.log('[Invoice Extraction] Parsed result - vendorName:', parsed.vendorName);
  console.log('[Invoice Extraction] Parsed result - invoiceNumber:', parsed.invoiceNumber);
  console.log('[Invoice Extraction] Parsed result - total:', parsed.total);
  
  return ExtractedInvoiceSchema.parse({
    ...parsed,
    lineItems: parsed.lineItems || [],
    confidence: parsed.confidence ?? 0.8,
  });
}

export async function extractInvoiceFromImage(base64Data: string, mimeType: string): Promise<ExtractedInvoice> {
  const parsed = await completeJson<any>({
    messages: [{
      role: "user",
      content: [visualBlock(base64Data, mimeType), { type: "text", text: INVOICE_EXTRACTION_PROMPT }],
    }],
  });
  
  return ExtractedInvoiceSchema.parse({
    ...parsed,
    lineItems: parsed.lineItems || [],
    confidence: parsed.confidence ?? 0.8,
  });
}

/**
 * Extract invoice data from an object path in storage.
 * This is the main entry point for invoice extraction after upload.
 */
export async function extractInvoiceFromObjectPath(objectPath: string): Promise<ExtractedInvoice> {
  console.log(`[Invoice Extraction] Starting extraction from: ${objectPath}`);
  
  const fileData = await downloadFileAsBuffer(objectPath);
  console.log(`[Invoice Extraction] Downloaded file, mimeType: ${fileData.mimeType}, size: ${fileData.buffer.length}`);
  
  if (fileData.mimeType === 'application/pdf') {
    console.log('[Invoice Extraction] Extracting text from PDF...');
    const pdfResult = await extractTextFromPdf(fileData.buffer);
    console.log(`[Invoice Extraction] Extracted ${pdfResult.text.length} characters from ${pdfResult.numPages} pages`);
    return await extractInvoiceFromText(pdfResult.text);
  } else if (fileData.mimeType.startsWith('image/')) {
    console.log('[Invoice Extraction] Extracting from image...');
    const base64 = fileData.buffer.toString('base64');
    return await extractInvoiceFromImage(base64, fileData.mimeType);
  } else {
    throw new Error(`Unsupported file type: ${fileData.mimeType}. Please upload a PDF or image.`);
  }
}

/**
 * Extract quote data from an object path in storage.
 * This is the main entry point for automatic extraction after upload.
 */
export async function extractFromObjectPath(objectPath: string): Promise<ExtractedQuote> {
  console.log(`[Extraction] Starting extraction from: ${objectPath}`);
  
  const fileData = await downloadFileAsBuffer(objectPath);
  console.log(`[Extraction] Downloaded file, mimeType: ${fileData.mimeType}, size: ${fileData.buffer.length}`);
  
  if (fileData.mimeType === 'application/pdf') {
    console.log('[Extraction] Extracting text from PDF...');
    const pdfResult = await extractTextFromPdf(fileData.buffer);
    console.log(`[Extraction] Extracted ${pdfResult.text.length} characters from ${pdfResult.numPages} pages`);
    return await extractQuoteFromText(pdfResult.text);
  } else if (fileData.mimeType.startsWith('image/')) {
    console.log('[Extraction] Extracting from image...');
    const base64 = fileData.buffer.toString('base64');
    return await extractQuoteFromImage(base64, fileData.mimeType);
  } else {
    throw new Error(`Unsupported file type: ${fileData.mimeType}. Please upload a PDF or image.`);
  }
}

export interface ClassifyAndExtractResult {
  classification: DocumentClassification;
  extraction?: ExtractedQuote;
  requiresConfirmation: boolean;
}

/**
 * AUTHORITATIVE INGESTION FLOW:
 * Classification happens BEFORE scope selection
 * Extraction happens ONLY AFTER scope is confirmed
 * 
 * This function classifies and extracts in one call.
 * For the authoritative flow, use classifyDocumentOnly() first,
 * then extractFromObjectPath() after scope confirmation.
 */
export async function classifyAndExtractFromObjectPath(objectPath: string): Promise<ClassifyAndExtractResult> {
  console.log(`[ClassifyAndExtract] Starting from: ${objectPath}`);
  
  const fileData = await downloadFileAsBuffer(objectPath);
  console.log(`[ClassifyAndExtract] Downloaded file, mimeType: ${fileData.mimeType}, size: ${fileData.buffer.length}`);
  
  let classification: DocumentClassification;
  let textContent: string | undefined;
  let base64Content: string | undefined;
  
  if (fileData.mimeType === 'application/pdf') {
    console.log('[ClassifyAndExtract] Processing PDF...');
    const pdfResult = await extractTextFromPdf(fileData.buffer);
    textContent = pdfResult.text;
    classification = await classifyDocument(textContent);
  } else if (fileData.mimeType.startsWith('image/')) {
    console.log('[ClassifyAndExtract] Processing image...');
    base64Content = fileData.buffer.toString('base64');
    classification = await classifyDocumentFromImage(base64Content, fileData.mimeType);
  } else {
    throw new Error(`Unsupported file type: ${fileData.mimeType}. Please upload a PDF or image.`);
  }
  
  console.log(`[ClassifyAndExtract] Classification: ${classification.documentType} (${classification.confidence})`);
  
  const requiresConfirmation = 
    classification.confidence !== 'high' || 
    classification.documentType !== 'quote';
  
  if (classification.documentType === 'quote' && classification.confidence === 'high') {
    console.log('[ClassifyAndExtract] High confidence quote - proceeding with extraction');
    const extraction = textContent 
      ? await extractQuoteFromText(textContent)
      : await extractQuoteFromImage(base64Content!, fileData.mimeType);
    
    return { classification, extraction, requiresConfirmation: false };
  }
  
  return { classification, requiresConfirmation };
}

/**
 * AUTHORITATIVE: Classification ONLY - no extraction
 * Use this for initial document ingestion before scope selection
 */
export async function classifyDocumentOnly(objectPath: string): Promise<{
  classification: DocumentClassification;
  requiresConfirmation: boolean;
}> {
  console.log(`[ClassifyOnly] Starting from: ${objectPath}`);
  
  const fileData = await downloadFileAsBuffer(objectPath);
  console.log(`[ClassifyOnly] Downloaded file, mimeType: ${fileData.mimeType}, size: ${fileData.buffer.length}`);
  
  let classification: DocumentClassification;
  
  if (fileData.mimeType === 'application/pdf') {
    const pdfResult = await extractTextFromPdf(fileData.buffer);
    classification = await classifyDocument(pdfResult.text);
  } else if (fileData.mimeType.startsWith('image/')) {
    const base64Content = fileData.buffer.toString('base64');
    classification = await classifyDocumentFromImage(base64Content, fileData.mimeType);
  } else {
    throw new Error(`Unsupported file type: ${fileData.mimeType}. Please upload a PDF or image.`);
  }
  
  console.log(`[ClassifyOnly] Classification: ${classification.documentType} (${classification.confidence})`);
  
  const requiresConfirmation = 
    classification.confidence !== 'high' || 
    classification.documentType !== 'quote';
  
  return { classification, requiresConfirmation };
}

export function registerDocumentRoutes(app: Express): void {
  // Original endpoint for derived-only extraction (backward compatible)
  app.post("/api/documents/extract", async (req: Request, res: Response) => {
    try {
      const { objectPath, base64Data, mimeType, textContent } = req.body;

      if (!objectPath && !base64Data && !textContent) {
        return res.status(400).json({ error: "Either objectPath, base64Data, or textContent is required" });
      }

      let extracted: ExtractedQuote;
      
      if (textContent) {
        console.log('Extracting from text content');
        extracted = await extractQuoteFromText(textContent);
      } else if (objectPath) {
        console.log(`Processing file from: ${objectPath}`);
        const fileData = await downloadFileAsBuffer(objectPath);
        console.log(`Downloaded file, mimeType: ${fileData.mimeType}, size: ${fileData.buffer.length}`);
        
        if (fileData.mimeType === 'application/pdf') {
          console.log('Extracting text from PDF...');
          const pdfResult = await extractTextFromPdf(fileData.buffer);
          console.log(`Extracted ${pdfResult.text.length} characters from ${pdfResult.numPages} pages`);
          extracted = await extractQuoteFromText(pdfResult.text);
        } else if (fileData.mimeType.startsWith('image/')) {
          const base64 = fileData.buffer.toString('base64');
          extracted = await extractQuoteFromImage(base64, fileData.mimeType);
        } else {
          throw new Error(`Unsupported file type: ${fileData.mimeType}. Please upload a PDF or image.`);
        }
      } else {
        const type = mimeType || "image/png";
        if (type === 'application/pdf') {
          const buffer = Buffer.from(base64Data, 'base64');
          const pdfResult = await extractTextFromPdf(buffer);
          console.log(`Extracted ${pdfResult.text.length} chars from ${pdfResult.numPages} pages (base64 upload)`);
          extracted = await extractQuoteFromText(pdfResult.text);
        } else {
          extracted = await extractQuoteFromImage(base64Data, type);
        }
      }

      console.log('Extraction successful:', {
        vendorName: extracted.vendorName,
        reference: extracted.reference,
        total: extracted.total,
        lineItemCount: extracted.lineItems.length,
        confidence: extracted.confidence
      });

      res.json(extracted);
    } catch (error) {
      console.error("Error extracting quote:", error);
      const message = error instanceof Error ? error.message : "Failed to extract quote data";
      res.status(500).json({ error: message });
    }
  });

  // New endpoint for full extraction (native + derived)
  app.post("/api/documents/extract-full", async (req: Request, res: Response) => {
    try {
      const { objectPath, base64Data, mimeType, textContent } = req.body;

      if (!objectPath && !base64Data && !textContent) {
        return res.status(400).json({ error: "Either objectPath, base64Data, or textContent is required" });
      }

      let pdfText: string | null = null;
      
      if (textContent) {
        pdfText = textContent;
      } else if (objectPath) {
        console.log(`Processing file for full extraction from: ${objectPath}`);
        const fileData = await downloadFileAsBuffer(objectPath);
        console.log(`Downloaded file, mimeType: ${fileData.mimeType}, size: ${fileData.buffer.length}`);
        
        if (fileData.mimeType === 'application/pdf') {
          const pdfResult = await extractTextFromPdf(fileData.buffer);
          console.log(`Extracted ${pdfResult.text.length} characters from ${pdfResult.numPages} pages`);
          pdfText = pdfResult.text;
        } else {
          return res.status(400).json({ error: "Full extraction currently only supports PDF files" });
        }
      } else {
        const type = mimeType || "image/png";
        if (type === 'application/pdf') {
          const buffer = Buffer.from(base64Data, 'base64');
          const pdfResult = await extractTextFromPdf(buffer);
          pdfText = pdfResult.text;
        } else {
          return res.status(400).json({ error: "Full extraction currently only supports PDF files" });
        }
      }

      if (!pdfText) {
        return res.status(400).json({ error: "Failed to extract text from document" });
      }

      const result = await extractFullQuote(pdfText);

      console.log('Full extraction successful:', {
        nativeRowCount: result.native.nativeRows.length,
        columnHeaders: result.native.columnHeaders,
        derivedVendor: result.derived.vendorName,
        derivedTotal: result.derived.total,
        nativeConfidence: result.native.confidence,
        derivedConfidence: result.derived.confidence,
      });

      res.json(result);
    } catch (error) {
      console.error("Error in full extraction:", error);
      const message = error instanceof Error ? error.message : "Failed to extract quote data";
      res.status(500).json({ error: message });
    }
  });
}
