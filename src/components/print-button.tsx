"use client";

import { Printer } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

/** "Print" — for drivers who like a paper copy on the dash. Hidden on the printout itself. */
export function PrintButton({ variant = "ghost", size = "md", className = "" }: { variant?: ButtonVariant; size?: ButtonSize; className?: string }) {
  return (
    <Button type="button" variant={variant} size={size} className={`no-print ${className}`} onClick={() => window.print()}>
      <Printer size={18} aria-hidden /> Print
    </Button>
  );
}
