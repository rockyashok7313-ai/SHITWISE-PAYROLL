import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ShiftStats } from "@/components/dashboard/shift-stats";
import { AttendanceLogger } from "@/components/dashboard/attendance-logger";
import { PayrollAuditTool } from "@/components/payroll/audit-tool";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, ListTodo, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen bg-background font-body text-foreground">
      <SidebarNav />
      
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex flex-col gap-1">
          <h2 className="text-3xl font-headline font-bold tracking-tight text-foreground flex items-center gap-3">
            Operations Hub
          </h2>
          <p className="text-muted-foreground">Precision shift management and payroll tracking system.</p>
        </header>

        <ShiftStats />

        <Tabs defaultValue="attendance" className="space-y-6">
          <TabsList className="bg-card/50 border border-border p-1 w-fit">
            <TabsTrigger value="attendance" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Clock className="w-4 h-4" />
              Daily Logging
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ShieldCheck className="w-4 h-4" />
              AI Audit
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ListTodo className="w-4 h-4" />
              Shift History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="mt-0 space-y-6 focus-visible:outline-none focus-visible:ring-0">
            <Card className="bg-card/30 border-border">
              <CardContent className="p-6">
                <AttendanceLogger />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <PayrollAuditTool />
          </TabsContent>

          <TabsContent value="history" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <Card className="bg-card/30 border-border">
              <CardHeader>
                <CardTitle className="font-headline">Recent Shift Logs</CardTitle>
                <CardDescription>Comprehensive list of historical attendance and cost calculations.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                  <ListTodo className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-medium">Historical logs will appear here after shift finalization.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
