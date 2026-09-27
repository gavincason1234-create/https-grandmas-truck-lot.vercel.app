import type { ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { ConfirmButton } from "./confirm-button";

type Props = {
  /** A server action from src/app/admin/actions.ts. It reads the id from the hidden field. */
  action: (formData: FormData) => Promise<void>;
  id: string;
  /** When set, the owner is asked this question before the form goes through. */
  confirm?: string;
  variant?: ButtonVariant;
  children: ReactNode;
};

/** One button = one form = one server action. Used inside StayCard's `actions` slot. */
export function StayAction({ action, id, confirm, variant = "ghost", children }: Props) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {confirm ? (
        <ConfirmButton message={confirm} variant={variant} className="w-full">
          {children}
        </ConfirmButton>
      ) : (
        <Button type="submit" variant={variant} className="w-full">
          {children}
        </Button>
      )}
    </form>
  );
}
