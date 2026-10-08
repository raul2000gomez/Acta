"use client";

import { useState } from "react";
import { UploadZone } from "./upload-zone";
import { EmailGate } from "@/components/auth/email-gate";
import { UpgradeDialog } from "@/components/billing/upgrade-dialog";

/** Zona de subida con las dos puertas: pedir email y pedir plan Pro. */
export function UploadSection({ hasAccount, compact }: { hasAccount: boolean; compact?: boolean }) {
  const [emailGate, setEmailGate] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<string | null>(null);
  return (
    <>
      <UploadZone hasAccount={hasAccount} compact={compact} onNeedEmail={setEmailGate} onNeedUpgrade={setUpgrade} />
      <EmailGate open={emailGate !== null} message={emailGate ?? ""} onOpenChange={(o) => !o && setEmailGate(null)} />
      <UpgradeDialog open={upgrade !== null} message={upgrade ?? ""} onOpenChange={(o) => !o && setUpgrade(null)} />
    </>
  );
}
