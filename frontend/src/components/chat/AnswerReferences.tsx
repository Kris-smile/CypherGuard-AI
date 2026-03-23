import { FileText, Link2, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AnswerReference } from './referenceUtils';
import { cn } from '../../utils';

function isHttpUrl(url?: string) {
  return Boolean(url && /^https?:\/\//i.test(url));
}

export default function AnswerReferences({
  references,
}: {
  references: AnswerReference[];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = references.some((reference) => reference.snippet || reference.citations.length > 1);
  const sortedReferences = useMemo(
    () => [...references].sort((a, b) => a.id - b.id),
    [references],
  );

  if (!references.length) {
    return null;
  }

  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            References
          </p>
          <div className="mt-2 space-y-2 text-xs text-slate-500">
            {sortedReferences.map((reference) => (
              <div
                key={reference.id}
                className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 transition-colors hover:border-slate-300 hover:bg-white"
              >
                <span className="mt-0.5 font-semibold text-slate-700">{reference.label}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-700">{reference.title}</span>
                    {isHttpUrl(reference.url) && <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />}
                  </div>
                  {reference.url ? (
                    isHttpUrl(reference.url) ? (
                      <a
                        href={reference.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block break-all text-slate-700 transition-colors hover:text-slate-900 hover:underline"
                      >
                        {reference.url}
                      </a>
                    ) : (
                      <p className="mt-1 break-all text-slate-400">{reference.url}</p>
                    )
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {hasDetails && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
          >
            Details
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              {sortedReferences.map((reference) => (
                <div
                  key={`detail-${reference.id}`}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {reference.label} {reference.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {reference.sourceType} · {reference.citations.length} related citation
                        {reference.citations.length > 1 ? 's' : ''}
                      </p>
                      {reference.snippet && (
                        <p className="mt-2 text-sm leading-6 text-slate-600">{reference.snippet}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
