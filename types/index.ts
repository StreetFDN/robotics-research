export interface Company {
  id: string;
  name: string;
  tags: string[];
  hq_lat: number;
  hq_lon: number;
  locations?: Array<{ lat: number; lon: number; name: string }>;
  website?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
  };
  description?: string;
  latestActivity?: Date;
  activityScore?: number;
}

export interface Event {
  id: string;
  company_id: string;
  timestamp: Date;
  type: 'funding' | 'product' | 'partnership' | 'hiring' | 'research' | 'patent' | 'other';
  title: string;
  description?: string;
  source_url?: string;
  lat?: number;
  lon?: number;
  severity?: 'low' | 'medium' | 'high';
  entities?: string[];
  funding_usd?: number;
}

export interface GlobeState {
  selectedCompany: Company | null;
  selectedEvent: Event | null;
  rotationSpeed: number;
  showGrid: boolean;
  showArcs: boolean;
  showNodes: boolean;
}

