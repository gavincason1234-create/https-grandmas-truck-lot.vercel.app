import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type Common = { label: ReactNode; hint?: ReactNode; error?: string; optional?: boolean; id: string; className?: string };

function Label({ id, label, optional }: Pick<Common, "id" | "label" | "optional">) {
  return (
    <label htmlFor={id} className="block text-[13.5px] font-semibold mb-1.5">
      {label}
      {optional ? <span className="font-normal text-muted"> — optional</span> : null}
    </label>
  );
}

function Below({ hint, error, id }: Pick<Common, "hint" | "error" | "id">) {
  if (error) {
    return (
      <p id={`${id}-error`} role="alert" className="mt-1.5 text-[13px] font-semibold text-warn">
        {error}
      </p>
    );
  }
  if (hint) return <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] text-muted">{hint}</p>;
  return null;
}

export function Field({ label, hint, error, optional, id, className = "", ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`mb-4 ${className}`}>
      <Label id={id} label={label} optional={optional} />
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...rest} />
      <Below id={id} hint={hint} error={error} />
    </div>
  );
}

export function TextArea({ label, hint, error, optional, id, className = "", ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={`mb-4 ${className}`}>
      <Label id={id} label={label} optional={optional} />
      <textarea id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...rest} />
      <Below id={id} hint={hint} error={error} />
    </div>
  );
}

export function Select({ label, hint, error, optional, id, className = "", children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className={`mb-4 ${className}`}>
      <Label id={id} label={label} optional={optional} />
      <select id={id} aria-invalid={error ? true : undefined} {...rest}>
        {children}
      </select>
      <Below id={id} hint={hint} error={error} />
    </div>
  );
}

export function Check({ id, label, className = "", ...rest }: { id: string; label: ReactNode; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label htmlFor={id} className={`flex items-center gap-3 min-h-12 text-[15px] font-medium cursor-pointer ${className}`}>
      <input id={id} type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function Row2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-2 gap-3 ${className}`}>{children}</div>;
}
