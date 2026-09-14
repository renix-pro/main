import { useState, useCallback, useMemo, useRef } from 'react';
import { 
  useProjectsData, 
  type ProjectMetadata, 
  type ProjectType,
  type ProjectColor,
  PROJECT_COLORS,
  getColorValue,
  SUPPORTED_REGIONS,
  type RegionId,
  type CurrencyCode,
  type ProjectRegionalContext
} from '../persistence/useProjectsData';
import { useUser } from '../auth';
import { getAuthHeaders } from '@/auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Settings, Users, Trash2, Archive, 
  FolderArchive, FolderKanban, X, Check, MapPin,
  Clock, ArrowRight, Hammer, Building2, ArrowUpRight,
  HelpCircle, Sparkles, LayoutGrid, ListChecks,
  DollarSign, ChevronDown, Camera, FileText, Loader2, ImageIcon
} from 'lucide-react';
import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  'renovation': 'Renovation',
  'new-build': 'New Build',
  'extension': 'Extension / Addition',
  'unsure': 'Unsure'
};

const PROJECT_TYPE_ICONS: Record<ProjectType, typeof Hammer> = {
  'renovation': Hammer,
  'new-build': Building2,
  'extension': ArrowUpRight,
  'unsure': HelpCircle
};

type SortMode = 'recent' | 'name' | 'newest';
type FilterMode = 'active' | 'all' | 'closed';

interface ProjectSummary {
  totalBudget: number;
  totalScopeNodes: number;
  totalTasks: number;
  doneTasks: number;
  totalInvoiced: number;
  totalPaid: number;
  completeness: number;
  totalQuotes: number;
  heroImagePath: string | null;
}

function getStageLabel(status: ProjectMetadata['status']): string {
  switch (status) {
    case 'open': return 'Active';
    case 'closed': return 'Completed';
    case 'archived': return 'Archived';
    default: return status;
  }
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatMoney(wholeUnits: number, currency?: string): string {
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'JPY' ? '¥' : '$';
  if (wholeUnits >= 1000000) return `${symbol}${(wholeUnits / 1000000).toFixed(1)}M`;
  if (wholeUnits >= 1000) return `${symbol}${Math.round(wholeUnits / 1000)}k`;
  return `${symbol}${wholeUnits}`;
}

const CURRENCIES = ['AUD', 'USD', 'GBP', 'CAD', 'NZD', 'EUR', 'JPY'] as const;

function getDefaultCurrency(regionId: RegionId): CurrencyCode {
  const region = SUPPORTED_REGIONS.find(r => r.id === regionId);
  return (region?.currency ?? 'USD') as CurrencyCode;
}

function detectRegion(): RegionId {
  try {
    const browserLocale = navigator.language || 'en-US';
    const countryCode = browserLocale.split('-')[1]?.toUpperCase();
    const region = SUPPORTED_REGIONS.find(r => r.id === countryCode);
    if (region) return region.id as RegionId;
  } catch {
    // Ignore detection errors
  }
  return 'US';
}

export function ProjectsPage() {
  const { projects, isLoading, createProject, updateProjectMetadata, archiveProject, restoreProject, deleteProject } = useProjectsData();
  const user = useUser();
  const [, setLocation] = useLocation();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [settingsProject, setSettingsProject] = useState<ProjectMetadata | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [filterMode, setFilterMode] = useState<FilterMode>('active');
  
  const detectedRegion = detectRegion();
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState<RegionId>(detectedRegion);
  const [newCurrency, setNewCurrency] = useState<CurrencyCode>(getDefaultCurrency(detectedRegion));
  const [newType, setNewType] = useState<ProjectType | ''>('');
  const [newDesc, setNewDesc] = useState('');
  
  
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const pendingHeroFileRef = useRef<File | null>(null);

  const { data: summariesData } = useQuery<{ summaries: Record<string, ProjectSummary> }>({
    queryKey: ['api/projects/summaries'],
    enabled: projects.length > 0,
  });
  const summaries = summariesData?.summaries ?? {};

  const uploadHeroForProject = useCallback(async (projectId: string, file: File) => {
    try {
      const urlRes = await fetch('/api/uploads/request-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || 'application/octet-stream',
          projectId,
          purpose: 'hero-image',
        }),
      });
      if (!urlRes.ok) return;
      const { uploadURL, objectPath } = await urlRes.json();
      const putRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!putRes.ok) return;
      await fetch(`/api/projects/${projectId}/hero-image/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ objectPath }),
      });
      queryClient.invalidateQueries({ queryKey: ['api/projects/summaries'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'projects'] });
    } catch (err) {
      console.error('Hero image upload failed:', err);
    }
  }, []);

  const handleCreate = useCallback(() => {
    if (!newName.trim() || !newRegion) return;
    const projectType = newType || undefined;
    const heroFile = pendingHeroFileRef.current;
    pendingHeroFileRef.current = null;
    createProject(newName.trim(), projectType, newDesc.trim(), {
      region: newRegion,
      currency: newCurrency
    }, (realProjectId) => {
      setLocation(`/project/${realProjectId}/overview`);
      if (heroFile) {
        uploadHeroForProject(realProjectId, heroFile);
      }
    });
    setIsCreateOpen(false);
    const detected = detectRegion();
    setNewName('');
    setNewRegion(detected);
    setNewCurrency(getDefaultCurrency(detected));
    setNewType('');
    setNewDesc('');
  }, [newName, newRegion, newCurrency, newType, newDesc, createProject, setLocation, uploadHeroForProject]);

  const openSettings = useCallback((project: ProjectMetadata) => {
    setSettingsProject(project);
    setEditName(project.name);
    setEditDesc(project.description);
    setDeleteConfirm(false);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsProject(null);
    setDeleteConfirm(false);
  }, []);

  const handleSaveSettings = useCallback(() => {
    if (!settingsProject || !editName.trim()) return;
    updateProjectMetadata(settingsProject.id, {
      name: editName.trim(),
      description: editDesc.trim()
    });
    closeSettings();
  }, [settingsProject, editName, editDesc, updateProjectMetadata, closeSettings]);

  const handleArchive = useCallback(() => {
    if (!settingsProject) return;
    archiveProject(settingsProject.id);
    closeSettings();
  }, [settingsProject, archiveProject, closeSettings]);

  const handleDelete = useCallback(() => {
    if (!settingsProject || !deleteConfirm) return;
    deleteProject(settingsProject.id);
    closeSettings();
  }, [settingsProject, deleteConfirm, deleteProject, closeSettings]);

  const handleClose = useCallback(() => {
    if (!settingsProject) return;
    updateProjectMetadata(settingsProject.id, { status: 'closed' });
    closeSettings();
  }, [settingsProject, updateProjectMetadata, closeSettings]);

  const archivedProjects = projects.filter(p => p.status === 'archived');
  
  const filteredAndSorted = useMemo(() => {
    let filtered = projects.filter(p => p.status !== 'archived');
    
    if (filterMode === 'closed') {
      filtered = filtered.filter(p => p.status === 'closed');
    } else if (filterMode === 'active') {
      filtered = filtered.filter(p => p.status === 'open');
    }
    
    const sorted = [...filtered];
    switch (sortMode) {
      case 'recent':
        sorted.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }
    return sorted;
  }, [projects, sortMode, filterMode]);

  const hasProjects = projects.length > 0;
  const nonArchivedCount = projects.filter(p => p.status !== 'archived').length;
  const firstName = user?.name?.split(' ')[0] || '';

  return (
    <div className="min-h-screen pb-16" data-testid="page-projects">
      {isLoading ? (
        <LoadingSkeleton />
      ) : !hasProjects ? (
        <EmptyStateHero 
          firstName={firstName}
          onCreateProject={() => setIsCreateOpen(true)} 
        />
      ) : (
        <>
          <WelcomeBand 
            firstName={firstName}
            projectCount={nonArchivedCount}
            onCreateProject={() => setIsCreateOpen(true)}
          />

          <div className="px-8">
            <ControlRow
              sortMode={sortMode}
              filterMode={filterMode}
              onSortChange={setSortMode}
              onFilterChange={setFilterMode}
              resultCount={filteredAndSorted.length}
            />

            {filteredAndSorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground" data-testid="text-no-results">
                  No {filterMode === 'closed' ? 'completed' : filterMode === 'active' ? 'active' : ''} projects found.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAndSorted.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    summary={summaries[project.id]}
                    onEnter={() => setLocation(`/project/${project.id}/overview`)}
                    onOpenSettings={() => openSettings(project)}
                  />
                ))}
              </div>
            )}

            {archivedProjects.length > 0 && (
              <ArchivedSection
                projects={archivedProjects}
                summaries={summaries}
                onEnter={(id) => setLocation(`/project/${id}/overview`)}
                onOpenSettings={openSettings}
              />
            )}
          </div>
        </>
      )}

      <CreateProjectDialog
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        newName={newName}
        setNewName={setNewName}
        newRegion={newRegion}
        setNewRegion={setNewRegion}
        newCurrency={newCurrency}
        setNewCurrency={setNewCurrency}
        newType={newType}
        setNewType={setNewType}
        newDesc={newDesc}
        setNewDesc={setNewDesc}
        onCreate={handleCreate}
        pendingHeroFileRef={pendingHeroFileRef}
      />

      <SettingsDialog
        project={settingsProject}
        summary={settingsProject ? summaries[settingsProject.id] : undefined}
        editName={editName}
        setEditName={setEditName}
        editDesc={editDesc}
        setEditDesc={setEditDesc}
        deleteConfirm={deleteConfirm}
        setDeleteConfirm={setDeleteConfirm}
        onSave={handleSaveSettings}
        onClose={handleClose}
        onArchive={handleArchive}
        onRestore={(id) => { restoreProject(id); closeSettings(); }}
        onDelete={handleDelete}
        onDismiss={closeSettings}
        updateProjectMetadata={updateProjectMetadata}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="px-8 pt-8" data-testid="skeleton-projects">
      <div className="h-8 w-48 bg-muted/50 rounded animate-pulse mb-2" />
      <div className="h-4 w-64 bg-muted/30 rounded animate-pulse mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="overflow-hidden border-border/50">
            <div className="h-[3px] bg-muted/40" />
            <CardHeader className="pt-5 pb-1">
              <div className="h-6 w-3/4 bg-muted/50 rounded animate-pulse" />
              <div className="flex gap-1.5 mt-2">
                <div className="h-[18px] w-16 bg-muted/30 rounded animate-pulse" />
                <div className="h-[18px] w-12 bg-muted/30 rounded animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="h-4 w-full bg-muted/20 rounded animate-pulse mb-1" />
              <div className="h-4 w-2/3 bg-muted/20 rounded animate-pulse mb-4" />
              <div className="flex gap-3 pt-2">
                <div className="h-3 w-16 bg-muted/20 rounded animate-pulse" />
                <div className="h-3 w-16 bg-muted/20 rounded animate-pulse" />
                <div className="h-3 w-16 bg-muted/20 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmptyStateHero({ firstName, onCreateProject }: { firstName: string; onCreateProject: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-8 text-center" data-testid="empty-state-hero">
      <div className="max-w-2xl mx-auto">
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--accent-copper)' }} data-testid="text-greeting">
          {getGreeting()}{firstName ? `, ${firstName}` : ''}
        </p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4" data-testid="text-hero-title">
          Your renovation command center
        </h1>
        <p className="text-base text-muted-foreground max-w-md mx-auto mb-10 leading-relaxed" data-testid="text-hero-subtitle">
          Renix helps you manage scope, budget, quotes, and execution — all in one place.
        </p>
        <Button 
          onClick={onCreateProject}
          size="lg"
          className="px-8 text-base mb-16"
          data-testid="button-create-first-project"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Your First Project
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-xl mx-auto">
          <BenefitCard
            icon={Sparkles}
            title="AI-Powered"
            description="Upload a quote and watch AI extract every line item"
          />
          <BenefitCard
            icon={LayoutGrid}
            title="Always Organized"
            description="Scope, budget, quotes, invoices — connected and clear"
          />
          <BenefitCard
            icon={ListChecks}
            title="Track Everything"
            description="From first vision board to final payment"
          />
        </div>
      </div>
    </div>
  );
}

function BenefitCard({ icon: Icon, title, description }: { icon: typeof Sparkles; title: string; description: string }) {
  return (
    <div className="renix-glass rounded-lg p-4 text-left" data-testid={`benefit-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <Icon className="w-4 h-4 mb-2" style={{ color: 'var(--accent-copper)' }} />
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function WelcomeBand({ firstName, projectCount, onCreateProject }: { 
  firstName: string; 
  projectCount: number;
  onCreateProject: () => void;
}) {
  return (
    <div className="px-8 pt-8 pb-4" data-testid="welcome-band">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-page-title">
            {getGreeting()}{firstName ? ', ' : ''}
            {firstName && (
              <span style={{ color: 'var(--accent-copper)' }}>{firstName}</span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-project-count">
            {projectCount} {projectCount === 1 ? 'project' : 'projects'}
          </p>
        </div>
        <Button 
          onClick={onCreateProject}
          data-testid="button-new-project"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>
    </div>
  );
}

function ControlRow({ sortMode, filterMode, onSortChange, onFilterChange, resultCount }: {
  sortMode: SortMode;
  filterMode: FilterMode;
  onSortChange: (mode: SortMode) => void;
  onFilterChange: (mode: FilterMode) => void;
  resultCount: number;
}) {
  const filters: { mode: FilterMode; label: string }[] = [
    { mode: 'active', label: 'Active' },
    { mode: 'closed', label: 'Completed' },
    { mode: 'all', label: 'All' },
  ];

  return (
    <div className="flex items-center justify-between mb-5" data-testid="control-row">
      <div className="flex items-center gap-1.5">
        {filters.map(f => (
          <Button
            key={f.mode}
            variant={filterMode === f.mode ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-3 rounded-full"
            onClick={() => onFilterChange(f.mode)}
            data-testid={`filter-${f.mode}`}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Select value={sortMode} onValueChange={(v) => onSortChange(v as SortMode)}>
        <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-sort">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recent">Recently Active</SelectItem>
          <SelectItem value="name">Name A–Z</SelectItem>
          <SelectItem value="newest">Newest First</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

interface ProjectCardProps {
  project: ProjectMetadata;
  summary?: ProjectSummary;
  isNew?: boolean;
  onEnter: () => void;
  onOpenSettings: () => void;
}

function ProjectCard({ project, summary, isNew, onEnter, onOpenSettings }: ProjectCardProps) {
  const colorValue = getColorValue(project.color);
  const regionMatch = SUPPORTED_REGIONS.find(r => r.id === project.regionalContext?.region || r.label === project.regionalContext?.region);
  const regionLabel = regionMatch?.label || project.regionalContext?.region;
  const lastActivity = project.updatedAt || project.createdAt;
  const currency = project.regionalContext?.currency;
  const isArchived = project.status === 'archived';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const heroImage = summary?.heroImagePath || project.heroImagePath || null;
  const completeness = summary?.completeness ?? 0;
  const progressWidth = `${(completeness / 5) * 100}%`;
  const progressColor = completeness >= 4 ? '#34C759' : '#B8805A';

  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsUploading(true);
    try {
      const urlRes = await fetch('/api/uploads/request-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || 'application/octet-stream',
          projectId: project.id,
          purpose: 'hero-image',
        }),
      });
      if (!urlRes.ok) throw new Error('Failed to get upload URL');
      const { uploadURL, objectPath } = await urlRes.json();

      const putRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!putRes.ok) throw new Error('Failed to upload file');

      const confirmRes = await fetch(`/api/projects/${project.id}/hero-image/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ objectPath }),
      });
      if (!confirmRes.ok) throw new Error('Failed to confirm upload');

      queryClient.invalidateQueries({ queryKey: ['api/projects/summaries'] });
    } catch (err) {
      console.error('Hero image upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRegenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/hero-image/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error('Failed to generate hero image');
      queryClient.invalidateQueries({ queryKey: ['api/projects/summaries'] });
    } catch (err) {
      console.error('Hero image generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className={`group rounded-xl overflow-visible transition-all duration-200 cursor-pointer border border-border/50 h-full flex flex-col ${
        isNew ? 'ring-2 ring-accent/50 animate-pulse' : ''
      }`}
      style={{
        filter: isArchived ? 'grayscale(0.6)' : undefined,
        opacity: isArchived ? 0.75 : 1,
      }}
      onClick={onEnter}
      data-testid={`card-project-${project.id}`}
    >
      <div className="rounded-xl overflow-hidden bg-card transition-shadow duration-200 group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.12),0_0_0_1px_rgba(184,128,90,0.25)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex flex-col h-full">
        <div className="relative h-[140px] overflow-hidden">
          {heroImage ? (
            <img
              src={heroImage}
              alt={project.name}
              className="w-full h-full object-cover"
              style={{ filter: isArchived ? 'grayscale(1)' : undefined }}
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, ${colorValue}22 0%, ${colorValue}08 60%, transparent 100%), linear-gradient(to bottom, var(--bg-light-2, #f6f7f9), var(--bg-light-3, #eceff3))`,
              }}
            />
          )}

          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
            }}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelected}
            onClick={(e) => e.stopPropagation()}
          />

          {!heroImage && !isArchived && (
            <div className="absolute inset-0 flex items-center justify-center gap-3">
              <button
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                title="Upload your own photo"
                onClick={handleUploadClick}
                disabled={isUploading}
                data-testid={`button-upload-hero-${project.id}`}
              >
                {isUploading ? <Loader2 className="w-4 h-4 text-slate-600 animate-spin" /> : <Camera className="w-4 h-4 text-slate-600" />}
              </button>
              <button
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                title="Generate AI image"
                onClick={handleRegenerate}
                disabled={isGenerating}
                data-testid={`button-generate-hero-${project.id}`}
              >
                {isGenerating ? <Loader2 className="w-4 h-4 text-slate-600 animate-spin" /> : <Sparkles className="w-4 h-4 text-slate-600" />}
              </button>
            </div>
          )}

          {heroImage && !isArchived && (
            <>
              <div className={`absolute inset-0 flex items-center justify-center gap-3 transition-opacity pointer-events-none hero-overlay-${project.id.replace(/[^a-zA-Z0-9]/g, '')}`}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  backdropFilter: 'blur(2px)',
                  opacity: 0,
                }}
              >
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110 pointer-events-auto"
                  style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
                  title="Upload your own photo"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                  data-testid={`button-upload-hero-replace-${project.id}`}
                >
                  {isUploading ? <Loader2 className="w-4 h-4 text-slate-700 animate-spin" /> : <Camera className="w-4 h-4 text-slate-700" />}
                </button>
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110 pointer-events-auto"
                  style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
                  title="Generate new AI image"
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  data-testid={`button-generate-hero-replace-${project.id}`}
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 text-slate-700 animate-spin" /> : <Sparkles className="w-4 h-4 text-slate-700" />}
                </button>
              </div>

              <button
                className="absolute top-2.5 left-2.5 w-7 h-7 rounded-full flex items-center justify-center md:hidden"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(8px)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRegenerate(e as any);
                }}
                data-testid={`button-hero-mobile-${project.id}`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-slate-700" />
              </button>
            </>
          )}

          <button
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center settings-btn-${project.id.replace(/[^a-zA-Z0-9]/g, '')}"
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            data-testid={`button-settings-${project.id}`}
          >
            <Settings className="w-3.5 h-3.5 text-white/80" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
            <h3
              className="font-semibold text-[17px] leading-tight text-white"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
              data-testid={`text-project-name-${project.id}`}
            >
              {project.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {project.type && (
                <span
                  className="px-1.5 py-0 h-[18px] inline-flex items-center rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(4px)',
                    color: 'rgba(255,255,255,0.9)',
                  }}
                >
                  {PROJECT_TYPE_LABELS[project.type]}
                </span>
              )}
              <span
                className="px-1.5 py-0 h-[18px] inline-flex items-center rounded text-[10px] font-medium"
                style={{
                  backgroundColor: project.status === 'open' ? 'rgba(52,199,89,0.3)' : 'rgba(142,142,147,0.3)',
                  color: project.status === 'open' ? '#fff' : 'rgba(255,255,255,0.7)',
                }}
              >
                {getStageLabel(project.status)}
              </span>
            </div>
          </div>
        </div>

        {completeness > 0 && !isArchived && (
          <div className="h-[2px]" style={{ backgroundColor: 'var(--bg-light-3, #eceff3)' }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: progressWidth,
                backgroundColor: progressColor,
              }}
            />
          </div>
        )}

        <div className="px-4 pt-3 pb-4 space-y-3 flex-1 flex flex-col">
          {project.description && (
            <p className="text-[13px] leading-relaxed text-secondary line-clamp-2">
              {project.description}
            </p>
          )}

          {summary ? (
            <div className="rounded-lg bg-muted/15 px-2.5 py-2" data-testid={`stats-${project.id}`}>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                  <span className="text-[11px] text-muted-foreground">Budget</span>
                  <span className="text-[11px] font-semibold text-foreground ml-auto" data-testid={`stat-budget-${project.id}`}>
                    {summary.totalBudget > 0 ? formatMoney(summary.totalBudget, currency) : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <LayoutGrid className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                  <span className="text-[11px] text-muted-foreground">Scope</span>
                  <span className="text-[11px] font-semibold text-foreground ml-auto" data-testid={`stat-scope-${project.id}`}>
                    {summary.totalScopeNodes > 0 ? `${summary.totalScopeNodes}` : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                  <span className="text-[11px] text-muted-foreground">Quotes</span>
                  <span className="text-[11px] font-semibold text-foreground ml-auto" data-testid={`stat-quotes-${project.id}`}>
                    {summary.totalQuotes > 0 ? summary.totalQuotes : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ListChecks className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                  <span className="text-[11px] text-muted-foreground">Tasks</span>
                  <span className="text-[11px] font-semibold text-foreground ml-auto" data-testid={`stat-tasks-${project.id}`}>
                    {summary.totalTasks > 0 ? `${summary.doneTasks}/${summary.totalTasks}` : '—'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/15 px-2.5 py-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <div className="h-4 bg-muted/30 rounded animate-pulse" />
                <div className="h-4 bg-muted/30 rounded animate-pulse" />
                <div className="h-4 bg-muted/30 rounded animate-pulse" />
                <div className="h-4 bg-muted/30 rounded animate-pulse" />
              </div>
            </div>
          )}

          <div className="flex-1" />

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {regionLabel}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {getRelativeTime(lastActivity)}
              </span>
            </div>
            <ArrowRight
              className="w-3.5 h-3.5 transition-colors text-transparent group-hover:text-[var(--accent-copper)]"
            />
          </div>
        </div>
      </div>

      <style>{`
        [data-testid="card-project-${project.id}"] .hero-overlay-${project.id.replace(/[^a-zA-Z0-9]/g, '')} { opacity: 0; }
        [data-testid="card-project-${project.id}"]:hover .hero-overlay-${project.id.replace(/[^a-zA-Z0-9]/g, '')} { opacity: 1; }
        @media (min-width: 768px) {
          [data-testid="card-project-${project.id}"] .settings-btn-${project.id.replace(/[^a-zA-Z0-9]/g, '')} { opacity: 0; transition: opacity 0.15s; }
          [data-testid="card-project-${project.id}"]:hover .settings-btn-${project.id.replace(/[^a-zA-Z0-9]/g, '')} { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function ArchivedSection({ projects, summaries, onEnter, onOpenSettings }: {
  projects: ProjectMetadata[];
  summaries: Record<string, ProjectSummary>;
  onEnter: (id: string) => void;
  onOpenSettings: (project: ProjectMetadata) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-12" data-testid="archived-section">
      <button
        className="flex items-center gap-2 mb-4 group/archive cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="button-toggle-archived"
      >
        <FolderArchive className="w-4 h-4 text-secondary" />
        <span className="text-sm font-medium text-secondary">
          Archived ({projects.length})
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-60">
          {projects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              summary={summaries[project.id]}
              onEnter={() => onEnter(project.id)}
              onOpenSettings={() => onOpenSettings(project)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateProjectDialog({ isOpen, onOpenChange, newName, setNewName, newRegion, setNewRegion, newCurrency, setNewCurrency, newType, setNewType, newDesc, setNewDesc, onCreate, pendingHeroFileRef }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  newName: string;
  setNewName: (v: string) => void;
  newRegion: RegionId;
  setNewRegion: (v: RegionId) => void;
  newCurrency: CurrencyCode;
  setNewCurrency: (v: CurrencyCode) => void;
  newType: ProjectType | '';
  setNewType: (v: ProjectType | '') => void;
  newDesc: string;
  setNewDesc: (v: string) => void;
  onCreate: () => void;
  pendingHeroFileRef: React.MutableRefObject<File | null>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    pendingHeroFileRef.current = file;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const clearImage = () => {
    pendingHeroFileRef.current = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const handleCreate = () => {
    onCreate();
    clearImage();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) clearImage();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-lg p-0 overflow-y-auto">
        <div className="relative h-[120px] overflow-hidden shrink-0">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Project hero preview"
              className="w-full h-full object-cover"
              data-testid="create-hero-preview"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: 'linear-gradient(135deg, rgba(184,128,90,0.15) 0%, rgba(184,128,90,0.05) 60%, transparent 100%), linear-gradient(to bottom, var(--bg-light-2, #f6f7f9), var(--bg-light-3, #eceff3))',
              }}
              data-testid="create-hero-placeholder"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.08) 40%, transparent 100%)',
            }}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelected}
            data-testid="create-hero-file-input"
          />

          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full shadow-md"
              style={{
                backgroundColor: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)',
              }}
              onClick={() => fileInputRef.current?.click()}
              data-testid="create-upload-hero"
              aria-label="Upload project image"
            >
              <Camera className="w-3.5 h-3.5" />
              {previewUrl ? 'Change' : 'Upload'}
            </Button>
            {previewUrl && (
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full shadow-md"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(8px)',
                }}
                onClick={clearImage}
                data-testid="create-remove-hero"
                aria-label="Remove project image"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          <div className="absolute bottom-3 left-4">
            <p className="text-[11px] text-white/70" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
              {previewUrl ? 'Project image selected' : 'Add a project image (optional)'}
            </p>
          </div>
        </div>

        <div className="px-6 pt-3 pb-1">
          <DialogHeader className="space-y-2 mb-0">
            <DialogTitle className="text-xl">Create your project</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              This is the beginning of something real.
              Renix will be your partner in planning and delivering it.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 space-y-5 pb-2">
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-base font-medium">Project Name</Label>
            <Input 
              id="project-name" 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              placeholder="e.g. Backyard Studio"
              className="text-lg h-12"
              data-testid="input-project-name"
            />
            <p className="text-xs text-secondary">
              This is how you'll refer to this project everywhere.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="project-region">Country / Region</Label>
              <Select 
                value={newRegion} 
                onValueChange={(v) => {
                  setNewRegion(v as RegionId);
                  setNewCurrency(getDefaultCurrency(v as RegionId));
                }}
              >
                <SelectTrigger id="project-region" data-testid="select-project-region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_REGIONS.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-currency">Currency</Label>
              <Select value={newCurrency} onValueChange={(v) => setNewCurrency(v as CurrencyCode)}>
                <SelectTrigger id="project-currency" data-testid="select-project-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-[var(--signal-warning)]">
            Region and currency cannot be changed after project creation.
          </p>

          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PROJECT_TYPE_LABELS) as [ProjectType, string][]).map(([value, label]) => {
                const Icon = PROJECT_TYPE_ICONS[value];
                return (
                  <Button
                    key={value}
                    type="button"
                    variant={newType === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewType(newType === value ? '' : value)}
                    data-testid={`button-type-${value}`}
                  >
                    <Icon className="w-3.5 h-3.5 mr-1.5" />
                    {label}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-secondary">
              This helps Renix adapt expectations and guidance.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-desc">
              What's this project about? <span className="text-secondary">(optional)</span>
            </Label>
            <Textarea 
              id="project-desc" 
              value={newDesc} 
              onChange={e => setNewDesc(e.target.value)} 
              placeholder="A light-filled backyard studio for focused work, with insulation, power, and a small kitchenette…"
              className="resize-none"
              rows={3}
              data-testid="input-project-description"
            />
          </div>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => { clearImage(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!newName.trim() || !newRegion}
            data-testid="button-create-confirm"
          >
            Create project
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({ project, summary, editName, setEditName, editDesc, setEditDesc, deleteConfirm, setDeleteConfirm, onSave, onClose, onArchive, onRestore, onDelete, onDismiss, updateProjectMetadata }: {
  project: ProjectMetadata | null;
  summary?: ProjectSummary;
  editName: string;
  setEditName: (v: string) => void;
  editDesc: string;
  setEditDesc: (v: string) => void;
  deleteConfirm: boolean;
  setDeleteConfirm: (v: boolean) => void;
  onSave: () => void;
  onClose: () => void;
  onArchive: () => void;
  onRestore: (id: string) => void;
  onDelete: () => void;
  onDismiss: () => void;
  updateProjectMetadata: (id: string, updates: Partial<Omit<ProjectMetadata, 'id' | 'createdAt' | 'regionalContext'>>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const heroImage = summary?.heroImagePath || project?.heroImagePath || null;
  const colorValue = project ? getColorValue(project.color) : '#6B7280';

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;
    e.target.value = '';
    setIsUploading(true);
    try {
      const urlRes = await fetch('/api/uploads/request-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || 'application/octet-stream',
          projectId: project.id,
          purpose: 'hero-image',
        }),
      });
      if (!urlRes.ok) throw new Error('Failed to get upload URL');
      const { uploadURL, objectPath } = await urlRes.json();
      const putRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!putRes.ok) throw new Error('Failed to upload file');
      const confirmRes = await fetch(`/api/projects/${project.id}/hero-image/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ objectPath }),
      });
      if (!confirmRes.ok) throw new Error('Failed to confirm upload');
      queryClient.invalidateQueries({ queryKey: ['api/projects/summaries'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'projects'] });
    } catch (err) {
      console.error('Hero image upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!project) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/hero-image/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error('Failed to generate hero image');
      queryClient.invalidateQueries({ queryKey: ['api/projects/summaries'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'projects'] });
    } catch (err) {
      console.error('Hero image generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={!!project} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="max-w-lg p-0 overflow-y-auto" aria-describedby="settings-desc">
        <DialogHeader className="sr-only">
          <DialogTitle>Project Settings</DialogTitle>
          <DialogDescription id="settings-desc">Manage project details, image, and actions.</DialogDescription>
        </DialogHeader>
        {project && (
          <>
            <div className="relative h-[160px] overflow-hidden shrink-0">
              {heroImage ? (
                <img
                  src={heroImage}
                  alt={project.name}
                  className="w-full h-full object-cover"
                  data-testid="settings-hero-image"
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{
                    background: `linear-gradient(135deg, ${colorValue}33 0%, ${colorValue}11 60%, transparent 100%), linear-gradient(to bottom, var(--bg-light-2, #f6f7f9), var(--bg-light-3, #eceff3))`,
                  }}
                  data-testid="settings-hero-placeholder"
                />
              )}
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 40%, transparent 100%)',
                }}
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelected}
              />

              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full shadow-md"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(8px)',
                  }}
                  onClick={handleUploadClick}
                  disabled={isUploading}
                  data-testid="settings-upload-hero"
                  aria-label="Upload project image"
                >
                  {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  Upload
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full shadow-md"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(8px)',
                  }}
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  data-testid="settings-generate-hero"
                  aria-label="Generate AI project image"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Generate
                </Button>
              </div>

              <div className="absolute bottom-3 left-4">
                <p className="text-[11px] text-white/70" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                  {heroImage ? 'Change your project image' : 'Add a project image'}
                </p>
              </div>
            </div>

            <div className="px-6 pt-5 pb-6 space-y-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Project Details</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-name" className="text-xs">Name</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="h-9"
                      data-testid="input-edit-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-desc" className="text-xs">Description</Label>
                    <Textarea
                      id="edit-desc"
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      className="resize-none text-sm min-h-[60px]"
                      rows={2}
                      data-testid="input-edit-description"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Color</Label>
                    <div className="flex gap-2">
                      {PROJECT_COLORS.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                            project.color === c.id ? 'border-foreground ring-2 ring-offset-2 ring-primary/40 scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c.value }}
                          onClick={() => updateProjectMetadata(project.id, { color: c.id })}
                          title={c.label}
                          data-testid={`color-${c.id}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Project Info</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{SUPPORTED_REGIONS.find(r => r.id === project.regionalContext?.region)?.label ?? 'Unknown'}</span>
                    </div>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="text-sm">{project.regionalContext?.currency ?? 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm">{project.members.length} member{project.members.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Region and currency are set at creation and cannot be changed.
                </p>
              </div>

              <Separator />

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Actions</p>
                <div className="space-y-2">
                  {project.status === 'open' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start h-9"
                      onClick={onClose}
                      data-testid="button-close-project"
                    >
                      <Check className="w-3.5 h-3.5 mr-2" />
                      Close Project
                    </Button>
                  )}

                  {project.status !== 'archived' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start h-9"
                      onClick={onArchive}
                      data-testid="button-archive-project"
                    >
                      <Archive className="w-3.5 h-3.5 mr-2" />
                      Archive Project
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start h-9"
                      onClick={() => onRestore(project.id)}
                      data-testid="button-restore-project"
                    >
                      <FolderArchive className="w-3.5 h-3.5 mr-2" />
                      Restore Project
                    </Button>
                  )}

                  <div className="pt-1">
                    {!deleteConfirm ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteConfirm(true)}
                        data-testid="button-delete-project"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        Delete Project
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1 h-9"
                          onClick={onDelete}
                          data-testid="button-confirm-delete"
                        >
                          Confirm Delete
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => setDeleteConfirm(false)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 pb-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onDismiss}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={onSave}
                disabled={!editName.trim()}
                data-testid="button-save-settings"
              >
                Save Changes
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ProjectsPage;
