"use client"

import { FactorySettings } from "@/components/settings/factory-settings";
import { TeamManagement } from "@/components/settings/team-management";
import { BackupRestorePanel } from "@/components/settings/backup-restore-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatabaseBackup } from "lucide-react";
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
        <Card className="bg-card/30 border-border">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <DatabaseBackup className="w-5 h-5 text-accent" />
              Data Backup &amp; Restore
            </CardTitle>
            <CardDescription>
              This app auto-backs-up to a file in your Downloads folder as you work, independent of
              whether the cloud database is reachable. Use these controls to trigger one manually or
              bring an older backup back into this browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BackupRestorePanel />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
