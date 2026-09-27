import type { HTMLAttributes, ReactNode } from "react";

type Tone = "plain" | "ok" | "accent" | "warn";

const tones: Record<Tone, string> = {
  plain: "border-l-line",
  ok: "border-l-ok",
  accent: "border-l-accent",
  warn: "border-l-warn",
};

export function Card({ tone = "plain", className = "", children, ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: Tone; children: ReactNode }) {
  return (
    <div className={`bg-elev border border-line border-l-4 rounded-sm p-4 ${tones[tone]} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Panel({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={`bg-elev border border-line rounded-md p-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Note({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={`bg-sunk rounded-sm px-4 py-3 text-[13.5px] leading-relaxed text-muted ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Empty({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`border border-dashed border-faint rounded-sm px-5 py-7 text-center text-[14px] text-muted leading-relaxed ${className}`}>{children}</div>;
}

export function SectionTitle({ children, className = "", right }: { children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 mb-3 ${className}`}>
      <h2 className="text-[17px] font-bold tracking-tight m-0">{children}</h2>
      {right}
    </div>
  );
}

export function GroupName({ children }: { children: ReactNode }) {
  return <div className="text-xs font-bold text-muted mt-6 mb-2 pb-1.5 border-b border-line first:mt-0">{children}</div>;
}
