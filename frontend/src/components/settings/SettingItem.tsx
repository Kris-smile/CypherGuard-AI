import type { ReactNode } from 'react';
import { FeatureStatusBadge, type FeatureStatus } from './FeatureStatusBadge';
import { cn } from '../../utils';

interface SettingItemProps {
  title: string;
  description: string;
  status: FeatureStatus;
  icon?: ReactNode;
}

export function SettingItem({
  title,
  description,
  status,
  icon,
}: SettingItemProps) {
  const isMuted = status === 'coming_soon';

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-2xl border px-5 py-4 transition-colors',
        isMuted
          ? 'border-slate-200 bg-slate-50 text-slate-500'
          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300',
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <div
            className={cn(
              'mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl',
              isMuted ? 'bg-white text-slate-400 ring-1 ring-slate-200' : 'bg-slate-100 text-slate-600',
            )}
          >
            {icon}
          </div>
        ) : null}

        <div className="min-w-0">
          <p className={cn('text-sm font-semibold', isMuted ? 'text-slate-500' : 'text-slate-900')}>
            {title}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>

      <FeatureStatusBadge status={status} />
    </div>
  );
}
