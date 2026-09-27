import { MessageSquareText, Phone } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { phoneDigits } from "@/lib/codes";

/** Tap to call the driver. Renders nothing when there is no usable number. */
export function CallButton({ phone, text = false }: { phone: string; text?: boolean }) {
  const digits = phoneDigits(phone);
  if (!digits) return null;
  if (text) {
    return (
      <LinkButton href={`sms:${digits}`} variant="ghost" aria-label={`Text ${phone}`}>
        <MessageSquareText size={16} aria-hidden /> Text
      </LinkButton>
    );
  }
  return (
    <LinkButton href={`tel:${digits}`} variant="ghost" aria-label={`Call ${phone}`}>
      <Phone size={16} aria-hidden /> Call
    </LinkButton>
  );
}
