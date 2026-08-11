"use client"

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, DatabaseBackup } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  downloadBackupNow,
  parseBackupFile,
  mergeBackupIntoStorage,
  readFileAsText,
  getLastBackupAt,
} from "@/lib/backup";

/**
 * Manual backup download + restore-from-file. Deliberately has NO dependency
 * on AppContext or a Supabase session: it reads and writes only this
 * browser's localStorage via @/lib/backup, which is exactly what makes it
 * usable from the login page during an outage, not only from Settings once
 * signed in.
 *
 * Restoring is a MERGE (see mergeBackupIntoStorage), not an overwrite, and it
 * only touches localStorage -- it does not call Supabase. The data becomes
 * visible, and gets pushed to the cloud, the next time the app loads with a
 * working session; that is the existing sync path (@/lib/sync) and is not
 * duplicated here.
 */
export function BackupRestorePanel({ className }: { className?: string }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() =>
    typeof window !== "undefined" ? getLastBackupAt(window.localStorage) : null
  );

  const handleDownload = () => {
    try {
      const { filename } = downloadBackupNow(window.localStorage);
      setLastBackupAt(new Date().toISOString());
      toast({ title: "Backup downloaded", description: filename });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Backup failed", description: e.message || "Could not create a backup." });
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRestoring(true);
    try {
      const text = await readFileAsText(file);
      const payload = parseBackupFile(text);
      const summary = mergeBackupIntoStorage(payload, window.localStorage);
      const recordsTotal = Object.values(summary.recordCounts).reduce((a, b) => a + b, 0);

      toast({
        title: summary.restoredKeys.length > 0 ? "Backup restored into this browser" : "Nothing to restore",
        description: summary.restoredKeys.length > 0
          ? `Merged ${summary.restoredKeys.length} data set(s), ${recordsTotal} record(s) now cached here. Log in (or reload) to sync it.`
          : "That file did not contain any recognisable ShiftWise data.",
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Restore failed", description: e.message || "Could not read that file." });
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleDownload} className="gap-2 justify-center">
          <Download className="w-3.5 h-3.5" /> Download Backup Now
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRestoring}
          className="gap-2 justify-center"
        >
          <Upload className="w-3.5 h-3.5" /> {isRestoring ? "Restoring..." : "Restore From Backup File"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFileSelected}
          aria-label="Choose a ShiftWise backup file to restore"
        />
      </div>
      <p className="text-[11px] text-muted-foreground mt-2 flex items-start gap-1.5">
        <DatabaseBackup className="w-3 h-3 mt-0.5 shrink-0" />
        <span>
          {lastBackupAt
            ? <>Last automatic backup in this browser: {new Date(lastBackupAt).toLocaleString()}.</>
            : <>No automatic backup has run in this browser yet.</>}
          {" "}Backups save to your Downloads folder and only contain what is cached on this device.
        </span>
      </p>
    </div>
  );
}
