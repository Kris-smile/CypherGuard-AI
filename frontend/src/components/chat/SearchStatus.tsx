import { Globe, Loader2, Search, Sparkles, TriangleAlert } from 'lucide-react';

type StatusTone = 'search' | 'organize' | 'answer' | 'error';

function getTone(status: string): StatusTone {
  const normalized = status.toLowerCase();

  if (
    normalized.includes('error') ||
    normalized.includes('failed') ||
    normalized.includes('timeout') ||
    normalized.includes('閿欒') ||
    normalized.includes('澶辫触') ||
    normalized.includes('瓒呮椂')
  ) {
    return 'error';
  }

  if (
    normalized.includes('鏁寸悊') ||
    normalized.includes('閲嶆帓') ||
    normalized.includes('organize') ||
    normalized.includes('rerank')
  ) {
    return 'organize';
  }

  if (
    normalized.includes('鐢熸垚') ||
    normalized.includes('鎬濊') ||
    normalized.includes('answer') ||
    normalized.includes('thinking')
  ) {
    return 'answer';
  }

  return 'search';
}

const toneConfig = {
  search: {
    icon: Globe,
    className: 'border-slate-300 bg-slate-100 text-slate-700',
  },
  organize: {
    icon: Search,
    className: 'border-slate-300 bg-slate-100 text-slate-700',
  },
  answer: {
    icon: Sparkles,
    className: 'border-slate-300 bg-slate-100 text-slate-700',
  },
  error: {
    icon: TriangleAlert,
    className: 'border-slate-400 bg-slate-200 text-slate-800',
  },
} as const;

export default function SearchStatus({ status }: { status: string }) {
  const tone = getTone(status);
  const { icon: Icon, className } = toneConfig[tone];
  const showSpinner = tone !== 'error';

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${className}`}
    >
      {showSpinner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      <Icon className="h-3.5 w-3.5" />
      <span>{status}</span>
    </div>
  );
}
