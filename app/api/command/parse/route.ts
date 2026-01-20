import { NextRequest, NextResponse } from 'next/server';
import { parseCommand, isOpenAIAvailable } from '@/lib/openai';
import { buildConfidenceMeta } from '@/utils/confidence';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid query parameter' },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Query cannot be empty' },
        { status: 400 }
      );
    }

    if (trimmedQuery.length > 500) {
      return NextResponse.json(
        { ok: false, error: 'Query too long (max 500 characters)' },
        { status: 400 }
      );
    }

    // Parse the command
    const { command, error } = await parseCommand(trimmedQuery);

    if (!command) {
      return NextResponse.json({
        ok: false,
        error: 'Could not parse command',
        details: error,
        data: {
          originalQuery: trimmedQuery,
          action: null,
          params: null,
          confidence: 0,
          suggestion: 'Try: "show humanoid companies", "select Figure AI", or "compare Boston Dynamics and Figure"',
        },
        _meta: buildConfidenceMeta(
          { query: trimmedQuery, parsed: false },
          'Command Parser'
        ),
      });
    }

    // Generate human-readable description of the action
    const actionDescription = generateActionDescription(command.action, command.params);

    return NextResponse.json({
      ok: true,
      data: {
        originalQuery: command.originalQuery,
        action: command.action,
        params: command.params,
        confidence: command.confidence,
        description: actionDescription,
        usedOpenAI: isOpenAIAvailable(),
      },
      _meta: buildConfidenceMeta(
        { query: trimmedQuery, action: command.action, confidence: command.confidence },
        isOpenAIAvailable() ? 'OpenAI GPT-4o-mini' : 'Keyword Parser'
      ),
    });
  } catch (error: any) {
    console.error('[Command Parse API] Error:', error);

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to parse command',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a human-readable description of the parsed action
 */
function generateActionDescription(action: string, params: Record<string, unknown>): string {
  switch (action) {
    case 'filter':
      if (params.tags && Array.isArray(params.tags)) {
        return `Filter companies by tags: ${(params.tags as string[]).join(', ')}`;
      }
      if (params.field && params.operator && params.value !== undefined) {
        const opMap: Record<string, string> = {
          gt: 'greater than',
          lt: 'less than',
          eq: 'equal to',
          contains: 'containing',
        };
        const op = opMap[params.operator as string] || params.operator;
        return `Filter companies where ${params.field} is ${op} ${formatValue(params.value)}`;
      }
      return 'Apply filter to companies';

    case 'select':
      return `Select company: ${params.companyName}`;

    case 'compare':
      if (params.companies && Array.isArray(params.companies)) {
        return `Compare: ${(params.companies as string[]).join(' vs ')}`;
      }
      return 'Compare companies';

    case 'search':
      return `Search for: "${params.query}"`;

    default:
      return `Execute ${action}`;
  }
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(0)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`;
    }
    return String(value);
  }
  return String(value);
}

// Also support GET for simple testing
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Missing query parameter',
        usage: 'POST /api/command/parse with body { "query": "your command" } or GET /api/command/parse?query=your+command',
      },
      { status: 400 }
    );
  }

  // Create a fake request with the query
  const fakeRequest = {
    json: async () => ({ query }),
  } as NextRequest;

  return POST(fakeRequest);
}
