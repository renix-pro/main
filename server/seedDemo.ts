/**
 * RENIX vNext — Demo Data Seeder
 * 
 * Creates a fully populated Berlin Altbau renovation demo project
 * with realistic data across all 10 frames.
 * 
 * Region: Germany (DE)
 * Currency: EUR
 */

import { db } from './db';
import { eq } from 'drizzle-orm';
import { 
  users, projects, scopes,
  budgetData, budgetAllocations,
  vendors, quotes, quoteVersions, sourceDocuments,
  invoices, invoiceLines,
  financingData, financingSources,
  executionTasks,
  documents,
  visionBoards, visionInspirations
} from '@shared/schema';

const DEMO_PROJECT_ID = 'demo-berlin-altbau';

export async function seedDemoData() {
  console.log('[Seed] Starting demo data population...');

  // 1. Find existing user or create demo user
  let existingUsers = await db.select().from(users).limit(1);
  let DEMO_USER_ID: string;
  
  if (existingUsers.length > 0) {
    DEMO_USER_ID = existingUsers[0].id;
    console.log(`[Seed] Using existing user: ${existingUsers[0].email}`);
  } else {
    const [newUser] = await db.insert(users).values({
      id: 'demo-user-001',
      email: 'demo@renix.app',
      name: 'Demo User',
      passwordHash: 'demo-password-hash',
      salt: 'demo-salt-value',
    }).returning();
    DEMO_USER_ID = newUser.id;
    console.log('[Seed] Created demo user');
  }

  // 2. Create demo project with Germany region
  const [project] = await db.insert(projects).values({
    id: DEMO_PROJECT_ID,
    userId: DEMO_USER_ID,
    name: 'Berlin Altbau Renovation',
    type: 'renovation',
    description: 'Complete renovation of a classic 1920s Altbau apartment in Prenzlauer Berg. Preserving original stucco ceilings and herringbone floors while modernizing kitchen, bathroom, and electrical systems.',
    status: 'open',
    color: 'teal',
    regionalContext: { region: 'DE', currency: 'EUR' },
    members: [
      { id: 'u1', name: 'Max Müller', role: 'owner' },
      { id: 'u2', name: 'Anna Schmidt', role: 'contributor' }
    ],
  }).onConflictDoNothing().returning();
  console.log('[Seed] Created demo project');

  // 3. Create Scopes
  const scopeData = [
    { id: 'scope-kitchen', name: 'Kitchen Renovation', description: 'Complete kitchen modernization with new appliances', isOptional: false },
    { id: 'scope-bathroom', name: 'Bathroom Renovation', description: 'Master bathroom upgrade with walk-in shower', isOptional: false },
    { id: 'scope-electrical', name: 'Electrical System', description: 'Full rewiring to modern standards', isOptional: false },
    { id: 'scope-floors', name: 'Floor Restoration', description: 'Restore original herringbone parquet', isOptional: true },
  ];

  for (const scope of scopeData) {
    await db.insert(scopes).values({
      ...scope,
      projectId: DEMO_PROJECT_ID,
      userId: DEMO_USER_ID,
      createdBy: DEMO_USER_ID,
    }).onConflictDoNothing();
  }
  console.log('[Seed] Created scopes');

  // 4. Create Budget
  await db.insert(budgetData).values({
    id: 'budget-main',
    projectId: DEMO_PROJECT_ID,
    userId: DEMO_USER_ID,
    totalBudget: 85000,
    currency: 'EUR',
    notes: 'Budget based on initial contractor estimates. Excludes furniture and decoration.',
  }).onConflictDoNothing();

  const allocationData = [
    { id: 'alloc-kitchen', label: 'Kitchen', amount: 28000, target: { type: 'scope', scopeId: 'scope-kitchen' }, notes: 'Includes cabinets, appliances, and installation' },
    { id: 'alloc-bathroom', label: 'Bathroom', amount: 18000, target: { type: 'scope', scopeId: 'scope-bathroom' }, notes: 'Complete bathroom renovation' },
    { id: 'alloc-electrical', label: 'Electrical', amount: 18000, target: { type: 'scope', scopeId: 'scope-electrical' }, notes: 'Full rewiring and panel upgrade' },
    { id: 'alloc-floors', label: 'Flooring', amount: 12000, target: { type: 'scope', scopeId: 'scope-floors' }, notes: 'Parquet restoration and finishing' },
    { id: 'alloc-contingency', label: 'Contingency', amount: 9000, target: { type: 'general', category: 'contingency' }, notes: '10% buffer for unexpected costs' },
  ];

  for (const alloc of allocationData) {
    await db.insert(budgetAllocations).values({
      ...alloc,
      budgetId: 'budget-main',
      projectId: DEMO_PROJECT_ID,
      userId: DEMO_USER_ID,
      createdBy: DEMO_USER_ID,
    }).onConflictDoNothing();
  }
  console.log('[Seed] Created budget data');

  // 5. Create Vendors
  const vendorData = [
    { id: 'vendor-mueller', name: 'Müller Küchen GmbH', notes: 'Kitchen Installation specialist, 5-star rating' },
    { id: 'vendor-elektro', name: 'Elektro Schmidt Berlin', notes: 'Electrical contractor, 4-star rating' },
    { id: 'vendor-bad', name: 'Bad & Wellness Berlin', notes: 'Bathroom specialist, 5-star rating' },
  ];

  for (const vendor of vendorData) {
    await db.insert(vendors).values({
      ...vendor,
      projectId: DEMO_PROJECT_ID,
      userId: DEMO_USER_ID,
    }).onConflictDoNothing();
  }
  console.log('[Seed] Created vendors');

  // 6. Create source documents for quotes, then create quotes
  const quoteSourceDocs = [
    { id: 'src-doc-kitchen', fileName: 'kitchen-quote.pdf', fileType: 'application/pdf' },
    { id: 'src-doc-electrical', fileName: 'electrical-quote.pdf', fileType: 'application/pdf' },
    { id: 'src-doc-bathroom', fileName: 'bathroom-quote.pdf', fileType: 'application/pdf' },
  ];

  for (const doc of quoteSourceDocs) {
    await db.insert(sourceDocuments).values({
      ...doc,
      projectId: DEMO_PROJECT_ID,
      userId: DEMO_USER_ID,
    }).onConflictDoNothing();
  }

  const quoteData = [
    { id: 'quote-kitchen', vendorId: 'vendor-mueller', description: 'Kitchen renovation quote - accepted', sourceDocumentId: 'src-doc-kitchen' },
    { id: 'quote-electrical', vendorId: 'vendor-elektro', description: 'Electrical work estimate - pending', sourceDocumentId: 'src-doc-electrical' },
    { id: 'quote-bathroom', vendorId: 'vendor-bad', description: 'Bathroom renovation quote - draft', sourceDocumentId: 'src-doc-bathroom' },
  ];

  for (const quote of quoteData) {
    await db.insert(quotes).values({
      ...quote,
      projectId: DEMO_PROJECT_ID,
      userId: DEMO_USER_ID,
    }).onConflictDoNothing();
  }

  // Quote versions
  const versionData = [
    { id: 'version-kitchen-1', quoteId: 'quote-kitchen', sourceDocumentId: 'src-doc-kitchen', versionNumber: 1, validUntil: new Date('2026-03-01'), notes: 'Initial kitchen quote' },
    { id: 'version-electrical-1', quoteId: 'quote-electrical', sourceDocumentId: 'src-doc-electrical', versionNumber: 1, validUntil: new Date('2026-02-15'), notes: 'Electrical work estimate' },
    { id: 'version-bathroom-1', quoteId: 'quote-bathroom', sourceDocumentId: 'src-doc-bathroom', versionNumber: 1, validUntil: new Date('2026-02-28'), notes: 'Bathroom renovation quote' },
  ];

  for (const version of versionData) {
    await db.insert(quoteVersions).values({
      ...version,
      projectId: DEMO_PROJECT_ID,
      userId: DEMO_USER_ID,
    }).onConflictDoNothing();
  }

  console.log('[Seed] Created quotes');

  // 7. Create Invoices (paid deposit)
  await db.insert(invoices).values({
    id: 'invoice-deposit',
    projectId: DEMO_PROJECT_ID,
    userId: DEMO_USER_ID,
    vendorName: 'Müller Küchen GmbH',
    vendorId: 'vendor-mueller',
    reference: 'INV-2026-001',
    status: 'paid',
    issueDate: new Date('2026-01-05'),
    dueDate: new Date('2026-01-20'),
    paidAt: new Date('2026-01-10'),
    notes: '30% deposit for kitchen work',
    createdBy: DEMO_USER_ID,
  }).onConflictDoNothing();

  await db.insert(invoiceLines).values({
    id: 'invline-deposit',
    invoiceId: 'invoice-deposit',
    projectId: DEMO_PROJECT_ID,
    userId: DEMO_USER_ID,
    label: 'Kitchen renovation deposit',
    description: '30% deposit payment',
    amount: 8250,
  }).onConflictDoNothing();
  console.log('[Seed] Created invoices');

  // 8. Create Financing
  await db.insert(financingData).values({
    id: 'financing-main',
    projectId: DEMO_PROJECT_ID,
    userId: DEMO_USER_ID,
    notes: 'Mix of KfW loan and personal savings. Total required: €85,000, Total secured: €70,000',
  }).onConflictDoNothing();

  const sourceData = [
    { id: 'source-kfw', name: 'KfW Energy Efficiency Loan', type: 'loan', amount: 50000, status: 'approved', provider: 'KfW Bank', conditions: '2.5% interest rate', notes: 'Low-interest renovation loan' },
    { id: 'source-savings', name: 'Personal Savings', type: 'savings', amount: 20000, status: 'available', notes: 'Immediately available' },
    { id: 'source-pending', name: 'Additional Savings', type: 'savings', amount: 15000, status: 'planned', notes: 'Expected by March 2026' },
  ];

  for (const source of sourceData) {
    await db.insert(financingSources).values({
      ...source,
      projectId: DEMO_PROJECT_ID,
      userId: DEMO_USER_ID,
      createdBy: DEMO_USER_ID,
    }).onConflictDoNothing();
  }
  console.log('[Seed] Created financing');

  // 9. Create Execution Tasks
  const taskData = [
    { id: 'task-demo', label: 'Demolition', description: 'Remove old kitchen and bathroom', status: 'completed', plannedStart: new Date('2026-01-15'), plannedEnd: new Date('2026-01-20'), actualStart: new Date('2026-01-15'), actualEnd: new Date('2026-01-20') },
    { id: 'task-electrical', label: 'Electrical Rough-in', description: 'Install new wiring', status: 'in_progress', plannedStart: new Date('2026-01-22'), plannedEnd: new Date('2026-02-05'), actualStart: new Date('2026-01-22') },
    { id: 'task-plumbing', label: 'Plumbing Rough-in', description: 'New water and drain lines', status: 'not_started', plannedStart: new Date('2026-02-01'), plannedEnd: new Date('2026-02-10') },
    { id: 'task-kitchen', label: 'Kitchen Installation', description: 'Install cabinets and appliances', status: 'not_started', plannedStart: new Date('2026-02-15'), plannedEnd: new Date('2026-02-28') },
  ];

  for (const task of taskData) {
    await db.insert(executionTasks).values({
      ...task,
      projectId: DEMO_PROJECT_ID,
      userId: DEMO_USER_ID,
      createdBy: DEMO_USER_ID,
    }).onConflictDoNothing();
  }
  console.log('[Seed] Created execution data');

  // 10. Create Documents
  const docData = [
    { id: 'doc-permit', fileName: 'permit-2026.pdf', fileSize: 245000, mimeType: 'application/pdf', documentType: 'permit', title: 'Building Permit', description: 'Approved January 2026', tags: ['permit', 'official'] },
    { id: 'doc-floor-plan', fileName: 'floor-plan.pdf', fileSize: 1250000, mimeType: 'application/pdf', documentType: 'plan', title: 'Floor Plan', description: 'Architect drawings', tags: ['plan', 'architecture'] },
    { id: 'doc-contract', fileName: 'kitchen-contract.pdf', fileSize: 180000, mimeType: 'application/pdf', documentType: 'contract', title: 'Kitchen Contract', description: 'Müller Küchen agreement', tags: ['contract', 'kitchen'] },
  ];

  for (const doc of docData) {
    await db.insert(documents).values({
      ...doc,
      projectId: DEMO_PROJECT_ID,
      userId: DEMO_USER_ID,
      uploadedBy: DEMO_USER_ID,
    }).onConflictDoNothing();
  }
  console.log('[Seed] Created documents');

  // 11. Create Vision Boards with Inspirations
  await db.insert(visionBoards).values({
    id: 'board-warm-natural',
    projectId: DEMO_PROJECT_ID,
    userId: DEMO_USER_ID,
    title: 'Warm & Natural',
    desireStatement: 'A cozy, natural space with lots of light and organic textures.',
    tags: ['warm', 'earthy', 'calm', 'natural light'],
    themes: ['Natural materials', 'Soft textures', 'Earthy tones'],
    archived: false,
  }).onConflictDoNothing();

  await db.insert(visionBoards).values({
    id: 'board-minimalist',
    projectId: DEMO_PROJECT_ID,
    userId: DEMO_USER_ID,
    title: 'Modern Minimalist',
    desireStatement: 'Clean lines and simple elegance with a focus on functionality.',
    tags: ['minimal', 'clean', 'modern', 'white'],
    themes: ['Clean lines', 'Open space', 'Functional beauty'],
    archived: false,
  }).onConflictDoNothing();

  // Vision inspirations
  const inspirationData = [
    { id: 'insp-living-1', boardId: 'board-warm-natural', imageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400', caption: 'Cozy living room with natural light', tags: ['living', 'natural'] },
    { id: 'insp-living-2', boardId: 'board-warm-natural', imageUrl: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400', caption: 'Warm wood tones and soft textiles', tags: ['wood', 'textile'] },
    { id: 'insp-kitchen-1', boardId: 'board-warm-natural', imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400', caption: 'Open kitchen with wooden cabinets', tags: ['kitchen', 'wood'] },
    { id: 'insp-bedroom-1', boardId: 'board-warm-natural', imageUrl: 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=400', caption: 'Serene bedroom with linen bedding', tags: ['bedroom', 'linen'] },
    { id: 'insp-bathroom-1', boardId: 'board-warm-natural', imageUrl: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400', caption: 'Spa-like bathroom with natural stone', tags: ['bathroom', 'stone'] },
    { id: 'insp-detail-1', boardId: 'board-warm-natural', imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e35a6?w=400', caption: 'Natural textures and materials', tags: ['texture', 'detail'] },
    { id: 'insp-min-1', boardId: 'board-minimalist', imageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb3?w=400', caption: 'Clean white kitchen', tags: ['kitchen', 'white'] },
    { id: 'insp-min-2', boardId: 'board-minimalist', imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400', caption: 'Minimal living space', tags: ['living', 'minimal'] },
  ];

  for (const insp of inspirationData) {
    await db.insert(visionInspirations).values({
      ...insp,
      projectId: DEMO_PROJECT_ID,
      userId: DEMO_USER_ID,
      archived: false,
    }).onConflictDoNothing();
  }
  console.log('[Seed] Created vision boards and inspirations');

  console.log('[Seed] Demo data population complete!');
  return { userId: DEMO_USER_ID, projectId: DEMO_PROJECT_ID };
}
