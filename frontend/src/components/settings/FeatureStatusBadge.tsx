import { cn } from '../../utils';

export type FeatureStatus = 'completed' | 'developing' | 'coming_soon';

const STATUS_STYLES: Record<
  FeatureStatus,
  { label: string; className: string; helper: string }
> = {
  completed: {
    label: 'Completed',
    helper: 'Available now',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  developing: {
    label: 'Developing',
    helper: 'In progress',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  coming_soon: {
    label: 'Coming Soon',
    helper: 'Planned',
    className: 'border-slate-200 bg-slate-100 text-slate-500',
  },
};

interface FeatureStatusBadgeProps {
  status: FeatureStatus;
}

export function FeatureStatusBadge({ status }: FeatureStatusBadgeProps) {
  const meta = STATUS_STYLES[status];

  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
          meta.className,
        )}
      >
        {meta.label}
      </span>
      <span className="text-[11px] text-slate-400">{meta.helper}</span>
    </div>
  );
}
