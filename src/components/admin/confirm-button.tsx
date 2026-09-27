"use client";

import type { ComponentProps, MouseEvent } from "react";
import { Button } from "@/components/ui/button";

type Props = ComponentProps<typeof Button> & {
  /** The plain-words question the owner sees before the form submits. */
  message: string;
};

/**
 * A submit button that asks first. Wraps the normal Button so it looks the same,
 * but cancels the form when the owner taps "Cancel" on the confirm box.
 */
export function ConfirmButton({ message, onClick, type = "submit", variant = "danger", children, ...rest }: Props) {
  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(message)) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  }
  return (
    <Button type={type} variant={variant} onClick={handleClick} {...rest}>
      {children}
    </Button>
  );
}
