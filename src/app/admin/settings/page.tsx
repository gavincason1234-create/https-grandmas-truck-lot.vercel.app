import type { Metadata } from "next";
import { KeyRound, Lock, LockOpen } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Notice } from "@/components/admin/notice";
import { SettingsForm } from "@/components/admin/settings-form";
import { Button } from "@/components/ui/button";
import { Note, Panel, SectionTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { getAdminEmails, vaultStatus } from "@/lib/vault";
import { clearAll, loadSample, savePrivateSettings, saveSettings } from "../actions";

export const metadata: Metadata = { title: "Settings · Owner" };
export const dynamic = "force-dynamic";

type Search = { saved?: string; error?: string };

function savedMessage(saved: string | undefined): string | null {
  switch (saved) {
    case "1":
      return "Saved.";
    case "codes":
      return "Gate codes saved. Drivers with a paid stay see the new codes right away.";
    case "cleared":
      return "Everything is cleared — bookings, members, payments, reviews and the log. Settings and codes were kept.";
    default:
      return null;
  }
}

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin("/admin/settings");
  const sp = await searchParams;
  const store = getStore();
  const [settings, priv] = await Promise.all([store.getSettings(), store.getPrivateSettings()]);
  const vault = vaultStatus();
  const admins = getAdminEmails();
  const saved = savedMessage(sp.saved);

  return (
    <div className="pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Settings</h1>
        <span className="text-muted text-[14.5px] font-semibold">Changes show on the site as soon as you save</span>
      </div>

      {saved ? <Notice className="mt-4">{saved}</Notice> : null}
      {sp.error ? <Notice tone="warn" className="mt-4">{sp.error}</Notice> : null}

      <div className="mt-5 grid gap-5">
        <Panel className="border-l-4 border-l-accent">
          <SectionTitle right={<Tag tone="accent">Private</Tag>}>
            <span className="inline-flex items-center gap-2">
              <KeyRound size={18} aria-hidden /> Gate codes — drivers see these only after paying
            </span>
          </SectionTitle>
          <p className="m-0 mb-4 text-[13.5px] text-muted leading-relaxed">
            Kept apart from the rest of the settings. A driver sees them on their confirmation page and in &quot;Find my booking&quot; only when they have paid and their stay is close. Nightly guests get the shed code only if they bought a shower or laundry.
          </p>
          <form action={savePrivateSettings} autoComplete="off">
            <div className="grid gap-3 sm:grid-cols-3 [&>div]:mb-0">
              {!priv.gate1 || !priv.gate2 ? (
                <p role="alert" className="m-0 mb-3 rounded-sm bg-warn-bg px-3 py-2 text-[13.5px] font-semibold text-warn">The gate codes are blank, so paid drivers are being told to call you. Type the real keypad codes and save.</p>
              ) : null}
              <Field id="p-gate1" label="Gate 1" name="gate1" inputMode="numeric" defaultValue={priv.gate1} required maxLength={16} autoComplete="off" />
              <Field id="p-gate2" label="Gate 2" name="gate2" inputMode="numeric" defaultValue={priv.gate2} required maxLength={16} autoComplete="off" />
              <Field id="p-shed" label="Shower & laundry shed" name="shedCode" inputMode="numeric" defaultValue={priv.shedCode} required maxLength={16} autoComplete="off" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="submit" variant="dark">
                Save gate codes
              </Button>
              <span className="text-[12.5px] text-muted">Changing a code here does not change the keypad — set the keypad first, then update this.</span>
            </div>
          </form>
        </Panel>

        <SettingsForm settings={settings} action={saveSettings} />

        <Panel>
          <SectionTitle>Test data</SectionTitle>
          <p className="m-0 mb-4 text-[13.5px] text-muted leading-relaxed">Pretend drivers for trying the dashboard. Load them, click around, then clear everything before real bookings start.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <form action={loadSample}>
              <Button type="submit" variant="ghost" className="w-full">
                Load sample bookings
              </Button>
            </form>
            <form action={clearAll}>
              <ConfirmButton
                variant="danger"
                className="w-full"
                message="Clear EVERYTHING? Every booking, member, payment, review and log entry is deleted for good. Settings and gate codes stay. There is no undo."
              >
                Clear everything
              </ConfirmButton>
            </form>
          </div>
        </Panel>

        <Panel>
          <SectionTitle
            right={
              vault.state === "open" ? (
                <Tag tone="ok">Open</Tag>
              ) : (
                <Tag tone="warn">{vault.state === "no-key" ? "No key" : "Locked"}</Tag>
              )
            }
          >
            <span className="inline-flex items-center gap-2">
              {vault.state === "open" ? <LockOpen size={18} aria-hidden /> : <Lock size={18} aria-hidden />} The safe
            </span>
          </SectionTitle>
          {vault.state === "open" ? (
            <p className="m-0 text-[14.5px] leading-relaxed">
              Safe is open · {vault.admins} admin{vault.admins === 1 ? "" : "s"}
              {vault.updatedAt ? <span className="text-muted"> · last sealed {new Date(vault.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" })}</span> : null}
            </p>
          ) : (
            <p className="m-0 text-[14.5px] leading-relaxed text-warn font-semibold">{vault.reason}. Admins are coming from the ADMIN_EMAILS fallback until VAULT_KEY is set.</p>
          )}
          <div className="mt-4 text-xs font-bold text-muted mb-1.5">Accounts that get this dashboard</div>
          {admins.length === 0 ? (
            <p className="m-0 text-[14px] text-warn font-semibold">No admin emails are set anywhere. Nobody but the offline test owner can sign in as an owner.</p>
          ) : (
            <ul className="list-none m-0 p-0 grid gap-1">
              {admins.map((email) => (
                <li key={email} className="min-h-12 flex items-center px-3 rounded-sm bg-sunk text-[15px] font-semibold break-all">
                  {email}
                </li>
              ))}
            </ul>
          )}
          <Note className="mt-4">
            Owner accounts are changed on a computer, not from this screen — on purpose. Someone who picks up your phone can&apos;t add themselves. To add one: <code className="text-fg">pnpm vault add-admin grandma@gmail.com</code>, then redeploy. See vault/README.md.
          </Note>
        </Panel>
      </div>
    </div>
  );
}
