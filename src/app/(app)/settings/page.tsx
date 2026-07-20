"use client"

import { FactorySettings } from "@/components/settings/factory-settings";
import { TeamManagement } from "@/components/settings/team-management";
import { useAppContext } from "@/components/providers/app-provider";

export default function SettingsPage() {
  const { activeCompanyId } = useAppContext();

  return (
    <div className="p-8 h-full overflow-y-auto space-y-6">
      <header className="mb-8">
        <h2 className="text-3xl font-headline font-bold tracking-tight text-foreground">
          Factory Configuration
        </h2>
        <p className="text-muted-foreground">Manage global factory settings and system access.</p>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <FactorySettings />
        {activeCompanyId && (
          <TeamManagement activeCompanyId={activeCompanyId} />
        )}
      </div>
    </div>
  );
}
