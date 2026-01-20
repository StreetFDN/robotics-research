import { create } from 'zustand';
import { Company, Event, GlobeState } from '@/types';
import type { PrivateCompany } from '@/types/companies';

interface HeatmapFocus {
  lat: number;
  lon: number;
}

interface EventFilter {
  companyId?: string;
  eventId?: string;
  regionId?: string;
}

interface CompanyFilter {
  tags?: string[];
  field?: string;
  operator?: string;
  value?: unknown;
}

interface GlobeStore extends GlobeState {
  companies: Company[];
  events: Event[];
  filteredCompanies: Company[];
  searchQuery: string;
  selectedTags: string[];
  heatmapFocus: HeatmapFocus | null;
  eventFilter: EventFilter | null;
  companyFilter: CompanyFilter | null;
  privateCompanies: PrivateCompany[];
  selectedCompanyId: string | null;
  hoveredPrivateCompany: PrivateCompany | null;
  selectedPrivateCompany: PrivateCompany | null;
  showPrivateCompanies: boolean;
  setCompanies: (companies: Company[]) => void;
  setEvents: (events: Event[]) => void;
  setSelectedCompany: (company: Company | null) => void;
  setSelectedEvent: (event: Event | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedTags: (tags: string[]) => void;
  setHeatmapFocus: (focus: HeatmapFocus | null) => void;
  setEventFilter: (filter: EventFilter | null) => void;
  setCompanyFilter: (filter: CompanyFilter | null) => void;
  setPrivateCompanies: (companies: PrivateCompany[]) => void;
  setSelectedCompanyId: (id: string | null) => void;
  setHoveredPrivateCompany: (company: PrivateCompany | null) => void;
  setSelectedPrivateCompany: (company: PrivateCompany | null) => void;
  clearSelection: () => void;
  setShowPrivateCompanies: (show: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setShowArcs: (show: boolean) => void;
  setShowNodes: (show: boolean) => void;
  updateFilteredCompanies: () => void;
}

export const useGlobeStore = create<GlobeStore>((set, get) => ({
  companies: [],
  events: [],
  filteredCompanies: [],
  selectedCompany: null,
  selectedEvent: null,
  rotationSpeed: 5.0, // Slow smooth spin when idle
  showGrid: true,
  showArcs: true,
  showNodes: true,
  searchQuery: '',
  selectedTags: [],
  heatmapFocus: null,
  eventFilter: null,
  companyFilter: null,
  privateCompanies: [],
  selectedCompanyId: null,
  hoveredPrivateCompany: null,
  selectedPrivateCompany: null,
  showPrivateCompanies: true,

  setCompanies: (companies) => {
    set({ companies, filteredCompanies: companies });
  },

  setEvents: (events) => {
    set({ events });
  },

  setSelectedCompany: (company) => {
    set({ selectedCompany: company });
  },

  setSelectedEvent: (event) => {
    set({ selectedEvent: event });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().updateFilteredCompanies();
  },

  setSelectedTags: (tags) => {
    set({ selectedTags: tags });
    get().updateFilteredCompanies();
  },

  setHeatmapFocus: (focus) => {
    set({ heatmapFocus: focus });
  },

  setEventFilter: (filter) => {
    set({ eventFilter: filter });
  },

  setCompanyFilter: (filter) => {
    set({ companyFilter: filter });
    // Also update selectedTags if tags are in the filter
    if (filter?.tags) {
      set({ selectedTags: filter.tags });
      get().updateFilteredCompanies();
    }
  },

  setPrivateCompanies: (companies) => {
    set({ privateCompanies: companies });
  },

  setSelectedCompanyId: (id) => {
    set({ selectedCompanyId: id });
  },

  setHoveredPrivateCompany: (company) => {
    set({ hoveredPrivateCompany: company });
  },

  setSelectedPrivateCompany: (company) => {
    set({ selectedPrivateCompany: company });
  },

  clearSelection: () => {
    set({
      selectedPrivateCompany: null,
      selectedCompanyId: null,
      selectedCompany: null
    });
  },

  setShowPrivateCompanies: (show) => {
    set({ showPrivateCompanies: show });
  },

  setShowGrid: (show) => {
    set({ showGrid: show });
  },

  setShowArcs: (show) => {
    set({ showArcs: show });
  },

  setShowNodes: (show) => {
    set({ showNodes: show });
  },

  updateFilteredCompanies: () => {
    const { companies, searchQuery, selectedTags } = get();
    let filtered = companies;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query) ||
          c.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((c) =>
        selectedTags.some((tag) => c.tags.includes(tag))
      );
    }

    set({ filteredCompanies: filtered });
  },
}));

