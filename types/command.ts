/**
 * Command parsing types for the Robotics Intelligence Globe
 *
 * Used to parse and execute natural language commands
 * from the command bar interface.
 */

/**
 * Available command actions
 */
export type CommandAction = 'filter' | 'select' | 'compare' | 'search';

/**
 * Comparison operators for filter commands
 */
export type FilterOperator = 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'not_contains';

/**
 * Parameters for filter commands
 * e.g., "show companies with funding > $10M"
 */
export interface FilterParams {
  /** Field to filter on (e.g., "funding", "region", "stage") */
  field?: string;
  /** Comparison operator */
  operator?: FilterOperator;
  /** Value to compare against */
  value?: string | number;
  /** Tags to filter by */
  tags?: string[];
  /** Region to filter by */
  region?: string;
  /** Funding stage to filter by */
  stage?: string;
}

/**
 * Parameters for select commands
 * e.g., "select Figure AI"
 */
export interface SelectParams {
  /** Company name to select */
  companyName: string;
  /** Optional: company ID if known */
  companyId?: string;
}

/**
 * Parameters for compare commands
 * e.g., "compare Boston Dynamics and Figure AI"
 */
export interface CompareParams {
  /** List of company names to compare (2-4 companies) */
  companies: string[];
}

/**
 * Parameters for search commands
 * e.g., "search humanoid robots"
 */
export interface SearchParams {
  /** Search query string */
  query: string;
}

/**
 * Union type for all command parameters
 */
export type CommandParams = FilterParams | SelectParams | CompareParams | SearchParams;

/**
 * Parsed command result from NLP processing
 */
export interface ParsedCommand {
  /** Original user input */
  originalQuery: string;
  /** Detected action type */
  action: CommandAction;
  /** Action-specific parameters */
  params: CommandParams;
  /** AI confidence in the parsing (0-1) */
  confidence: number;
  /** Optional: alternative interpretations */
  alternatives?: ParsedCommand[];
}

/**
 * Command execution result
 */
export interface CommandResult {
  /** Whether command executed successfully */
  success: boolean;
  /** Action that was taken */
  action: CommandAction;
  /** Human-readable description of what happened */
  message: string;
  /** Optional: data returned by the command */
  data?: unknown;
  /** Optional: error details if failed */
  error?: string;
}

/**
 * Confidence thresholds for command parsing
 */
export const COMMAND_CONFIDENCE_THRESHOLDS = {
  /** High confidence: execute immediately */
  HIGH: 0.85,
  /** Medium confidence: show preview before executing */
  MEDIUM: 0.6,
  /** Low confidence: ask for clarification */
  LOW: 0.4,
} as const;

/**
 * Get confidence level from score
 */
export function getCommandConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= COMMAND_CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (confidence >= COMMAND_CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

/**
 * Common field aliases for normalization
 */
export const FIELD_ALIASES: Record<string, string> = {
  'money': 'funding',
  'raised': 'funding',
  'investment': 'funding',
  'valuation': 'funding',
  'location': 'region',
  'country': 'region',
  'area': 'region',
  'round': 'stage',
  'phase': 'stage',
  'type': 'tags',
  'category': 'tags',
  'sector': 'tags',
};

/**
 * Normalize a field name using aliases
 */
export function normalizeFieldName(field: string): string {
  const lower = field.toLowerCase().trim();
  return FIELD_ALIASES[lower] || lower;
}

/**
 * Example commands for help/suggestions
 */
export const EXAMPLE_COMMANDS = [
  { query: 'show humanoid companies', action: 'filter' as CommandAction },
  { query: 'select Figure AI', action: 'select' as CommandAction },
  { query: 'compare Boston Dynamics and Agility', action: 'compare' as CommandAction },
  { query: 'filter by funding > $100M', action: 'filter' as CommandAction },
  { query: 'search autonomous navigation', action: 'search' as CommandAction },
  { query: 'show US-based companies', action: 'filter' as CommandAction },
] as const;
