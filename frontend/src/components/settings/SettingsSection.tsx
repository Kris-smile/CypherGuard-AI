import type { ReactNode } from 'react';

interface SettingsSectionProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h4 className="text-lg font-semibold text-slate-900">{title}</h4>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
