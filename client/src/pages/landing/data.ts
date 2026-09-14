import {
  Compass,
  Lightbulb,
  TreePine,
  Wallet,
  FileText,
  Receipt,
  Landmark,
  HardHat,
  FolderOpen,
  Upload,
  Brain,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  TableProperties,
  MessageSquare,
  LayoutDashboard,
} from 'lucide-react';
import previewAIFeature from '@assets/image_1771747181688.png';

export const PAGES = [
  { icon: LayoutDashboard, name: 'Projects', desc: 'Your home base — all renovations at a glance' },
  { icon: Compass, name: 'Overview', desc: 'Project snapshot and status at a glance' },
  { icon: Lightbulb, name: 'Vision', desc: 'Moodboards and desire statements' },
  { icon: TreePine, name: 'Scope', desc: 'Interactive work breakdown tree' },
  { icon: Wallet, name: 'Budget', desc: 'Budget intent and allocation tracking' },
  { icon: FileText, name: 'Quotes', desc: 'AI-extracted vendor quotes with versioning' },
  { icon: Receipt, name: 'Invoices', desc: 'Scope-backed invoice management' },
  { icon: Landmark, name: 'Financing', desc: 'Funding sources and coverage' },
  { icon: HardHat, name: 'Execution', desc: 'Construction progress tracking' },
  { icon: FolderOpen, name: 'Documents', desc: 'Centralized document intelligence' },
];

export const FEATURE_DEEPDIVES: Array<{
  src?: string;
  preview?: 'scope' | 'budget' | 'quotes';
  title: string;
  desc: string;
  badge: string;
  imgClass?: string;
}> = [
  {
    src: previewAIFeature,
    title: 'AI Companion that thinks with you',
    desc: 'Upload a document and your AI companion classifies it, extracts financial data, proposes scope changes, and reconciles budgets — all through natural conversation. You stay in control; AI does the heavy lifting.',
    badge: 'AI-Powered',
    imgClass: 'w-full max-h-[520px] object-contain',
  },
  {
    preview: 'scope',
    title: 'Scope that grows with your project',
    desc: 'Build an interactive work breakdown tree with parent and child scopes. Nest, reorganize, and allocate budgets as your renovation evolves. Direct cost scopes bypass the quote pipeline entirely.',
    badge: 'Structured',
  },
  {
    preview: 'budget',
    title: 'Budget truth at a glance',
    desc: 'Set budget intent, allocate across scopes, track committed costs versus actuals, and maintain contingency reserves. Every euro has a clear audit trail from allocation to invoice.',
    badge: 'Financial',
  },
  {
    preview: 'quotes',
    title: 'Quote intelligence, not guesswork',
    desc: 'AI extracts line items from vendor quotes automatically. Compare versions side by side, track commitment status, and get AI assessments on budget alignment and competitive positioning.',
    badge: 'Automated',
  },
];

export const STEPS = [
  {
    icon: Upload,
    num: '01',
    title: 'Upload & Classify',
    desc: 'Drop in quotes, invoices, or any project document. AI classifies and extracts data instantly.',
  },
  {
    icon: Brain,
    num: '02',
    title: 'AI Proposes, You Decide',
    desc: 'Your AI companion suggests scope changes, budget allocations, and reconciliations — you always have final say.',
  },
  {
    icon: CheckCircle2,
    num: '03',
    title: 'Track & Control',
    desc: 'Monitor budget vs. actuals, quote lineage, invoice payments, and financial health across all scopes.',
  },
];

export const DIFFERENTIATORS = [
  {
    icon: Sparkles,
    title: 'AI-native, not bolted on',
    desc: 'AI is woven into every workflow — document ingestion, scope proposals, budget reconciliation — not a chatbot sidebar.',
  },
  {
    icon: ShieldCheck,
    title: 'Financial truth, always',
    desc: 'Budget, quotes, invoices, and financing remain distinct. No fuzzy numbers. Every cent traces back to a source document.',
  },
  {
    icon: TrendingUp,
    title: 'Purpose-built for renovation',
    desc: 'Unlike generic project tools, RENIX understands construction scopes, vendor quotes, change orders, and payment milestones.',
  },
  {
    icon: TableProperties,
    title: '10 purpose-built pages',
    desc: 'Every aspect of your project lives in a dedicated, structured page — searchable, connected, and always in sync.',
  },
  {
    icon: MessageSquare,
    title: 'You decide, AI assists',
    desc: 'AI proposes, you approve. No automated actions without your explicit confirmation. User agency is absolute.',
  },
  {
    icon: FolderOpen,
    title: 'Document intelligence',
    desc: 'Documents are more than files. AI extracts claims, tracks interpretations, and links data across your entire project.',
  },
];

export const PRICING_PLANS = [
  {
    name: 'Free',
    planId: 'free',
    price: '€0',
    period: 'forever',
    desc: 'Perfect for exploring RENIX on a single project.',
    highlighted: false,
    features: [
      { text: '1 active project', included: true },
      { text: 'All 10 pages', included: true },
      { text: 'AI document ingestion', included: true },
      { text: 'Up to 20 documents', included: true },
      { text: 'Basic AI companion', included: true },
      { text: 'Community support', included: true },
      { text: 'Unlimited quote versions', included: false },
      { text: 'Advanced AI insights', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  {
    name: 'Pro',
    planId: 'pro',
    price: '€9.99',
    period: '/month',
    desc: 'For homeowners managing real renovation projects.',
    highlighted: true,
    features: [
      { text: 'Unlimited projects', included: true },
      { text: 'All 10 pages', included: true },
      { text: 'AI document ingestion', included: true },
      { text: 'Unlimited documents', included: true },
      { text: 'Full AI companion', included: true },
      { text: 'Unlimited quote versions', included: true },
      { text: 'Advanced AI insights', included: true },
      { text: 'Priority support', included: true },
    ],
  },
];

export const TESTIMONIALS = [
  {
    quote: "RENIX replaced three separate spreadsheets I was using to track our kitchen renovation. The AI quote extraction alone saved me hours of manual data entry.",
    name: "Sarah K.",
    role: "Homeowner, Kitchen & Bath Renovation",
    rating: 5,
  },
  {
    quote: "As someone managing a €350K full-home renovation, having budget, quotes, and invoices as distinct truths — not one messy spreadsheet — changed how I make decisions.",
    name: "Marcus T.",
    role: "Homeowner, Full Home Renovation",
    rating: 5,
  },
  {
    quote: "I upload a vendor quote and within seconds the AI has extracted every line item, mapped it to my scope, and flagged budget impacts. It's like having a project manager on call.",
    name: "Elena R.",
    role: "Interior Designer",
    rating: 5,
  },
];

export const STATS = [
  { value: '10', label: 'Purpose-built pages' },
  { value: '<30s', label: 'Quote data extracted by AI' },
  { value: '4', label: 'Financial truths kept separate' },
  { value: '100%', label: 'User control over AI actions' },
];
