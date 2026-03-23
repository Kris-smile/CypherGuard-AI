import { motion } from 'framer-motion';
import AnswerContent from './AnswerContent';
import AnswerReferences from './AnswerReferences';
import type { Citation } from '../../services/api';
import { normalizeAnswerReferences } from './referenceUtils';

export default function AnswerMessage({
  content,
  citations,
  isStreaming = false,
}: {
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
}) {
  const references = normalizeAnswerReferences(citations);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-3xl"
    >
      <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/40">
        <AnswerContent content={content} references={references} isStreaming={isStreaming} />
        {!isStreaming && <AnswerReferences references={references} />}
      </div>
    </motion.div>
  );
}
