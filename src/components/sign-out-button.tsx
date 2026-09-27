import { LogOut } from "lucide-react";
import { Button, type ButtonSize } from "@/components/ui/button";

/**
 * "Sign out" — a plain form post to /auth/signout, so it works without JavaScript and from
 * any page. Server component; nothing interactive lives here.
 */
export function SignOutButton({ size = "md", className = "" }: { size?: ButtonSize; className?: string }) {
  return (
    <form method="post" action="/auth/signout" className={className}>
      <Button type="submit" variant="ghost" size={size}>
        <LogOut size={18} aria-hidden /> Sign out
      </Button>
    </form>
  );
}
