import { storage } from "./storage";
import { db } from "./db";
import { documents, scopeNodes, budgetAllocations, quotes, invoices, financingSources, projects } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { completeJson } from "./ai/claude";
import { randomUUID } from "crypto";
import { getLocaleFromRegionalContext, getLocalePromptContext, normalizeNumber, LocaleConfig } from "./localeUtils";

interface ClaimExtractionResult {
  claims: Array<{
    claimType: 'fact' | 'constraint' | 'expectation' | 'assumption' | 'date' | 'amount' | 'party';
    text: string;
    normalizedValue?: string;
    confidence: number;
    sourceLocation?: string;
    reasoning?: string;
  }>;
  interpretation: {
    summary: string;
    keyInsights: string[];
    documentIntent?: string;
    parties?: string[];
    dateReferences?: Array<{ date: string; context: string }>;
    amounts?: Array<{ amount: string; currency?: string; context: string }>;
  };
  suggestedLinks: Array<{
    linkType: 'scope' | 'budget' | 'quote' | 'invoice' | 'financing' | 'task' | 'assumption';
    targetHint: string;
    relationship: 'supports' | 'contradicts' | 'supersedes' | 'references' | 'constrains';
    confidence: number;
    reasoning: string;
  }>;
}

const CLAIMS_EXTRACTION_PROMPT = `You are a document analysis assistant for a construction project management system.

Analyze the provided document text and extract:

1. CLAIMS - Factual assertions that can be used for project reasoning:
   - fact: Definitive statements of truth (e.g., "Total cost is €15,000")
   - constraint: Limitations or requirements (e.g., "Work must be completed by March")
   - expectation: Future projections or assumptions (e.g., "We expect delivery in 2 weeks")
   - assumption: Implicit or explicit assumptions made (e.g., "Assuming standard materials")
   - date: Specific dates mentioned (e.g., quote date, delivery dates)
   - amount: Financial amounts, quantities (e.g., prices, totals, measurements)
   - party: Persons, companies, or entities mentioned (e.g., vendors, contractors)

2. INTERPRETATION - Your understanding of the document:
   - summary: Brief overall summary (2-3 sentences)
   - keyInsights: List of 3-5 most important takeaways
   - documentIntent: What is this document trying to accomplish?
   - parties: List of parties/vendors/companies mentioned
   - dateReferences: Important dates with context
   - amounts: Financial figures with context

3. SUGGESTED LINKS - Potential connections to project entities:
   - scope: Work areas this document relates to
   - budget: Budget line items this affects
   - quote: Related quotes
   - invoice: Related invoices
   - financing: Financing implications

For each claim and link, provide a confidence score (0.0 to 1.0):
- 1.0: Explicitly stated, unambiguous
- 0.8: Clearly implied, very likely
- 0.6: Reasonable inference
- 0.4: Possible but uncertain
- 0.2: Speculative

Respond with valid JSON matching this structure:
{
  "claims": [
    {
      "claimType": "fact|constraint|expectation|assumption|date|amount|party",
      "text": "The exact or paraphrased claim",
      "normalizedValue": "Standardized value if applicable (e.g., ISO date, numeric amount)",
      "confidence": 0.0-1.0,
      "sourceLocation": "Quote from document if available",
      "reasoning": "Why this confidence level"
    }
  ],
  "interpretation": {
    "summary": "Overall document summary",
    "keyInsights": ["insight1", "insight2"],
    "documentIntent": "Purpose of document",
    "parties": ["Party1", "Party2"],
    "dateReferences": [{"date": "2024-03-15", "context": "delivery date"}],
    "amounts": [{"amount": "15000", "currency": "EUR", "context": "total price"}]
  },
  "suggestedLinks": [
    {
      "linkType": "scope|budget|quote|invoice|financing",
      "targetHint": "Description to help match entity (e.g., 'bathroom renovation' for scope)",
      "relationship": "supports|contradicts|supersedes|references|constrains",
      "confidence": 0.0-1.0,
      "reasoning": "Why this link is suggested"
    }
  ]
}`;

export async function extractClaimsFromDocument(
  documentText: string,
  fileName: string,
  existingContext?: { scopes?: string[]; budgetItems?: string[]; vendors?: string[] },
  locale?: LocaleConfig
): Promise<ClaimExtractionResult | null> {
  try {
    const contextHint = existingContext ? `
EXISTING PROJECT CONTEXT (use for link suggestions):
- Scopes: ${existingContext.scopes?.join(", ") || "none defined"}
- Budget items: ${existingContext.budgetItems?.join(", ") || "none defined"}
- Vendors: ${existingContext.vendors?.join(", ") || "none defined"}
` : "";

    const localeContext = locale ? getLocalePromptContext(locale) : "";

    const truncatedText = documentText.length > 25000 
      ? documentText.substring(0, 25000) + "\n\n[Document truncated...]"
      : documentText;

    const result = await completeJson<ClaimExtractionResult>({
      system: [CLAIMS_EXTRACTION_PROMPT, localeContext],
      messages: [
        { role: "user", content: `Document: "${fileName}"\n${contextHint}\n\nDocument Content:\n${truncatedText}` },
      ],
    });
    console.log(`[DocumentProcessor] Extracted ${result.claims?.length || 0} claims, ${result.suggestedLinks?.length || 0} suggested links`);
    
    return result;
  } catch (error) {
    console.error("[DocumentProcessor] Claims extraction error:", error);
    return null;
  }
}

export async function processDocument(documentId: string): Promise<boolean> {
  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    
    if (!doc) {
      console.error(`[DocumentProcessor] Document not found: ${documentId}`);
      return false;
    }

    if (!doc.extractedText && !doc.summary) {
      console.log(`[DocumentProcessor] Document ${documentId} has no extracted text or summary`);
      return false;
    }

    const textToAnalyze = doc.extractedText || doc.summary || "";
    
    const [projectScopes, [project]] = await Promise.all([
      db.select({ name: scopeNodes.name })
        .from(scopeNodes)
        .where(eq(scopeNodes.projectId, doc.projectId)),
      db.select({ regionalContext: projects.regionalContext })
        .from(projects)
        .where(eq(projects.id, doc.projectId))
        .limit(1),
    ]);
    
    const locale = getLocaleFromRegionalContext(project?.regionalContext);
    console.log(`[DocumentProcessor] Using locale ${locale.region} for document ${documentId}`);
    
    const projectContext = {
      scopes: projectScopes.map(s => s.name),
    };

    const extraction = await extractClaimsFromDocument(
      textToAnalyze,
      doc.fileName,
      projectContext,
      locale
    );

    if (!extraction) {
      console.error(`[DocumentProcessor] Failed to extract claims from document ${documentId}`);
      await storage.updateProcessingStatus(documentId, 'failed', 'Claims extraction failed');
      return false;
    }

    const interpretation = await storage.createDocumentInterpretation({
      documentId: doc.id,
      projectId: doc.projectId,
      userId: doc.userId,
      interpretationType: 'general',
      model: 'gpt-4o-mini',
      summary: extraction.interpretation.summary,
      keyFacts: extraction.interpretation.keyInsights,
      confidence: 0.7,
      metadata: {
        documentIntent: extraction.interpretation.documentIntent,
        parties: extraction.interpretation.parties,
        dateReferences: extraction.interpretation.dateReferences,
        amounts: extraction.interpretation.amounts,
      },
    });

    console.log(`[DocumentProcessor] Created interpretation ${interpretation.id} for document ${documentId}`);

    const claimsToInsert = extraction.claims.map(claim => {
      let extractedValue: Record<string, unknown> | null = claim.normalizedValue 
        ? { value: claim.normalizedValue, reasoning: claim.reasoning } 
        : null;
      
      if (claim.claimType === 'amount' && claim.normalizedValue) {
        const numericValue = normalizeNumber(claim.normalizedValue, locale);
        if (numericValue !== null) {
          extractedValue = { 
            value: numericValue.toString(), 
            originalValue: claim.normalizedValue,
            reasoning: claim.reasoning,
            locale: locale.region,
          };
        }
      }
      
      return {
        interpretationId: interpretation.id,
        documentId: doc.id,
        projectId: doc.projectId,
        userId: doc.userId,
        claimType: claim.claimType,
        content: claim.text,
        confidence: claim.confidence,
        sourceLocation: claim.sourceLocation || null,
        extractedValue,
      };
    });

    if (claimsToInsert.length > 0) {
      await storage.createExtractedClaims(claimsToInsert);
      console.log(`[DocumentProcessor] Created ${claimsToInsert.length} claims for document ${documentId}`);
    }

    for (const link of extraction.suggestedLinks || []) {
      const matchedTarget = await matchLinkTarget(
        doc.projectId,
        doc.userId,
        link.linkType,
        link.targetHint
      );

      if (matchedTarget) {
        await storage.createDocumentLink({
          documentId: doc.id,
          projectId: doc.projectId,
          userId: doc.userId,
          linkType: link.linkType,
          targetId: matchedTarget.id,
          targetName: matchedTarget.name,
          relationship: link.relationship,
          confidence: link.confidence,
          reasoning: link.reasoning,
          proposedByAI: true,
          confirmedByUser: false,
          rejectedByUser: false,
        });
        console.log(`[DocumentProcessor] Created link to ${link.linkType}:${matchedTarget.name} for document ${documentId}`);
      }
    }

    return true;
  } catch (error) {
    console.error(`[DocumentProcessor] Error processing document ${documentId}:`, error);
    return false;
  }
}

async function matchLinkTarget(
  projectId: string,
  userId: string,
  linkType: string,
  targetHint: string
): Promise<{ id: string; name: string } | null> {
  const hintLower = targetHint.toLowerCase();

  try {
    switch (linkType) {
      case 'scope': {
        const scopes = await db.select()
          .from(scopeNodes)
          .where(and(
            eq(scopeNodes.projectId, projectId),
            eq(scopeNodes.userId, userId)
          ));
        
        for (const scope of scopes) {
          if (scope.name.toLowerCase().includes(hintLower) || 
              hintLower.includes(scope.name.toLowerCase())) {
            return { id: scope.id, name: scope.name };
          }
        }
        
        for (const scope of scopes) {
          const scopeWords = scope.name.toLowerCase().split(/\s+/);
          const hintWords = hintLower.split(/\s+/);
          const matchingWords = scopeWords.filter(w => 
            hintWords.some(hw => hw.includes(w) || w.includes(hw))
          );
          if (matchingWords.length > 0) {
            return { id: scope.id, name: scope.name };
          }
        }
        break;
      }

      case 'budget': {
        const allocations = await db.select()
          .from(budgetAllocations)
          .where(and(
            eq(budgetAllocations.projectId, projectId),
            eq(budgetAllocations.userId, userId)
          ));
        
        for (const alloc of allocations) {
          const label = alloc.label || '';
          if (label.toLowerCase().includes(hintLower) || 
              hintLower.includes(label.toLowerCase())) {
            return { id: alloc.id, name: label };
          }
        }
        break;
      }

      case 'quote': {
        const projectQuotes = await db.select()
          .from(quotes)
          .where(and(
            eq(quotes.projectId, projectId),
            eq(quotes.userId, userId)
          ));
        
        for (const quote of projectQuotes) {
          const desc = quote.description || '';
          if (desc.toLowerCase().includes(hintLower) || 
              hintLower.includes(desc.toLowerCase())) {
            return { id: quote.id, name: desc };
          }
        }
        break;
      }

      case 'financing': {
        const sources = await db.select()
          .from(financingSources)
          .where(and(
            eq(financingSources.projectId, projectId),
            eq(financingSources.userId, userId)
          ));
        
        for (const source of sources) {
          if (source.name.toLowerCase().includes(hintLower) || 
              hintLower.includes(source.name.toLowerCase())) {
            return { id: source.id, name: source.name };
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error(`[DocumentProcessor] Error matching link target:`, error);
  }

  return null;
}

export async function processNextQueuedDocument(): Promise<boolean> {
  const queueItem = await storage.getNextPendingDocument();
  
  if (!queueItem) {
    console.log("[DocumentProcessor] No pending documents in queue");
    return false;
  }

  console.log(`[DocumentProcessor] Processing queued document: ${queueItem.documentId}`);
  
  await storage.updateProcessingStatus(queueItem.id, 'processing');
  
  try {
    const success = await processDocument(queueItem.documentId);
    
    if (success) {
      await storage.updateProcessingStatus(queueItem.id, 'completed');
      console.log(`[DocumentProcessor] Successfully processed document: ${queueItem.documentId}`);
    } else {
      await storage.updateProcessingStatus(queueItem.id, 'failed', 'Processing returned false');
    }
    
    return success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await storage.updateProcessingStatus(queueItem.id, 'failed', errorMessage);
    console.error(`[DocumentProcessor] Failed to process document ${queueItem.documentId}:`, error);
    return false;
  }
}

export async function queueUnprocessedDocuments(projectId?: string, userId?: string): Promise<number> {
  let unprocessedDocs;
  
  if (projectId && userId) {
    unprocessedDocs = await storage.getUnprocessedDocuments(projectId, userId);
  } else {
    unprocessedDocs = await storage.getAllUnprocessedDocuments();
  }

  console.log(`[DocumentProcessor] Found ${unprocessedDocs.length} unprocessed documents`);

  let queuedCount = 0;
  for (const doc of unprocessedDocs) {
    const existing = await storage.getDocumentProcessingStatus(doc.id);
    if (!existing || existing.status === 'failed') {
      await storage.queueDocumentForProcessing({
        documentId: doc.id,
        projectId: doc.projectId,
        userId: doc.userId,
        priority: 5,
        status: 'pending',
        attempts: 0,
      });
      queuedCount++;
    }
  }

  console.log(`[DocumentProcessor] Queued ${queuedCount} documents for processing`);
  return queuedCount;
}

export async function processAllPendingDocuments(batchSize: number = 5): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;
  let count = 0;

  while (count < batchSize) {
    const success = await processNextQueuedDocument();
    if (success === false) {
      const next = await storage.getNextPendingDocument();
      if (!next) break;
      failed++;
    } else {
      processed++;
    }
    count++;
  }

  console.log(`[DocumentProcessor] Batch complete: ${processed} processed, ${failed} failed`);
  return { processed, failed };
}

export async function getDocumentInsights(documentId: string, userId: string): Promise<{
  interpretation: any | null;
  claims: any[];
  links: any[];
} | null> {
  const interpretation = await storage.getLatestDocumentInterpretation(documentId, userId);
  const claims = await storage.getDocumentClaims(documentId, userId);
  const links = await storage.getDocumentLinks(documentId, userId);

  return {
    interpretation,
    claims,
    links,
  };
}

export async function getProjectDocumentInsights(projectId: string, userId: string): Promise<{
  interpretations: any[];
  claimsByType: Record<string, any[]>;
  linksByType: Record<string, any[]>;
  highConfidenceFacts: any[];
}> {
  const interpretations = await storage.getProjectInterpretations(projectId, userId);
  const allClaims = await storage.getProjectClaims(projectId, userId);
  const allLinks = await storage.getProjectDocumentLinks(projectId, userId);

  const claimsByType: Record<string, any[]> = {};
  for (const claim of allClaims) {
    if (!claimsByType[claim.claimType]) {
      claimsByType[claim.claimType] = [];
    }
    claimsByType[claim.claimType].push(claim);
  }

  const linksByType: Record<string, any[]> = {};
  for (const link of allLinks) {
    if (!linksByType[link.linkType]) {
      linksByType[link.linkType] = [];
    }
    linksByType[link.linkType].push(link);
  }

  const highConfidenceFacts = allClaims
    .filter(c => c.claimType === 'fact' && c.confidence >= 0.8)
    .sort((a, b) => b.confidence - a.confidence);

  return {
    interpretations,
    claimsByType,
    linksByType,
    highConfidenceFacts,
  };
}
