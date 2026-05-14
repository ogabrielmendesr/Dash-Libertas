import { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-5 sm:pb-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="min-w-0">
          <div className="pill text-[11px] font-mono uppercase tracking-[0.22em] text-white/70 mb-4">
            <span className="dot text-teal-400 bg-teal-400" />
            {eyebrow}
          </div>
          <h1 className="font-display text-[34px] sm:text-[44px] lg:text-[56px] leading-[1.0] tracking-tight text-white max-w-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 sm:mt-4 max-w-2xl text-[13px] sm:text-[15px] text-white/60">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0 flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
