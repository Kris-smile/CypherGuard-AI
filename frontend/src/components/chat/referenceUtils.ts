import type { Citation } from '../../services/api';

export interface AnswerReference {
  id: number;
  title: string;
  label: string;
  url?: string;
  sourceType: string;
  snippet?: string;
  score?: number;
  citations: Citation[];
}

function buildReferenceKey(citation: Citation) {
  return [
    citation.source_uri || '',
    citation.document_id || '',
    citation.title || '',
    citation.source_type || '',
  ].join('::');
}

export function normalizeAnswerReferences(citations?: Citation[]): AnswerReference[] {
  if (!citations?.length) {
    return [];
  }

  const grouped = new Map<string, AnswerReference>();

  citations.forEach((citation) => {
    const key = buildReferenceKey(citation);
    const existing = grouped.get(key);

    if (existing) {
      existing.citations.push(citation);
      existing.score = Math.max(existing.score || 0, citation.score || 0);
      if (!existing.snippet && citation.snippet) {
        existing.snippet = citation.snippet;
      }
      return;
    }

    grouped.set(key, {
      id: citation.reference_id || grouped.size + 1,
      title: citation.title || 'Untitled source',
      label: `[${citation.reference_id || grouped.size + 1}]`,
      url: citation.source_uri || undefined,
      sourceType: citation.source_type || 'document',
      snippet: citation.snippet || undefined,
      score: citation.score,
      citations: [citation],
    });
  });

  return Array.from(grouped.values());
}

export function hasInlineReferenceMarker(content: string) {
  return /\[\d+\]/.test(content);
}
