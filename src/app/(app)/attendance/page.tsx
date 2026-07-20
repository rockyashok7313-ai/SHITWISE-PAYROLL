"use client"

import { AttendanceLogger } from "@/components/dashboard/attendance-logger";
import { Card, CardContent } from "@/components/ui/card";

export default function AttendancePage() {
  return (
    <div className="p-8 h-full overflow-y-auto space-y-6">
      <header className="mb-8">
        <h2 className="text-3xl font-headline font-bold tracking-tight text-foreground">
          Attendance Tracking
        </h2>
        <p className="text-muted-foreground">Manage daily shift logs, clock-in/out times, and advances.</p>
      </header>

      <Card className="bg-card/30 border-border">
        <CardContent className="p-6">
          <AttendanceLogger />
        </CardContent>
      </Card>
    </div>
  );
}
