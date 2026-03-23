import MarkdownRenderer from './MarkdownRenderer';
import type { AnswerReference } from './referenceUtils';
import { hasInlineReferenceMarker } from './referenceUtils';

export function AnswerContent({
  content,
  references,
  isStreaming = false,
}: {
  content: string;
  references?: AnswerReference[];
  isStreaming?: boolean;
}) {
  const showFallbackMarkers = !hasInlineReferenceMarker(content) && (references?.length || 0) > 0;

  return (
    <div className="text-sm text-slate-800">
      <div className="prose prose-slate max-w-none prose-p:my-0 prose-headings:my-0">
        <MarkdownRenderer content={content} />
        {isStreaming && <span className="ml-1 animate-pulse text-slate-500">|</span>}
      </div>
      {showFallbackMarkers && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
          {references?.map((reference) => (
            <span
              key={reference.id}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-medium"
            >
              {reference.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default AnswerContent;
