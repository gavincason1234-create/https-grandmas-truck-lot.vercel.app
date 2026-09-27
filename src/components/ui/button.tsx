import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "dark" | "ghost" | "danger" | "link";
export type ButtonSize = "md" | "lg" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 font-bold rounded-sm cursor-pointer select-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  dark: "bg-asphalt text-dust hover:bg-asphalt-soft dark:bg-elev dark:text-fg dark:border dark:border-line dark:hover:bg-sunk",
  ghost: "bg-transparent border border-line text-fg hover:bg-sunk font-semibold",
  danger: "bg-transparent border border-warn text-warn hover:bg-warn-bg font-semibold",
  link: "bg-transparent text-fg underline underline-offset-4 font-semibold px-0",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 px-3 text-sm",
  md: "min-h-12 px-4 text-[15px]",
  lg: "min-h-14 px-5 text-base w-full",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
  children: ReactNode;
};

export function Button({ variant = "primary", size = "md", busy, className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <span className="spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

type LinkButtonProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function LinkButton({ href, variant = "primary", size = "md", className = "", children, ...rest }: LinkButtonProps) {
  const external = /^(https?:|tel:|sms:|mailto:)/.test(href);
  if (external) {
    return (
      <a href={href} className={buttonClass(variant, size, className)} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
