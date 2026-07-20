"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { History, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AuditLogs({ activeCompanyId }: { activeCompanyId: string }) {
  const { toast } = useToast();
  const { isAdmin, isSupervisor } = useRole(activeCompanyId);
  
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      if (!activeCompanyId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('company_id', activeCompanyId)
          .order('timestamp', { ascending: false })
          .limit(100);
        
        if (error) throw error;
        setLogs(data || []);
      } catch (err: any) {
        toast({ variant: "destructive", title: "Error", description: err.message });
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, [activeCompanyId]);

  if (!isAdmin && !isSupervisor) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-50 text-destructive" />
            <p>You do not have permission to view audit logs.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getActionColor = (action: string) => {
    switch(action) {
      case 'INSERT': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'UPDATE': return 'bg-accent/10 text-accent border-accent/20';
      case 'DELETE': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <History className="w-5 h-5 text-accent" />
            System Audit Logs
          </CardTitle>
          <CardDescription>
            Record of all inserts, updates, and deletes for sensitive tables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <th className="text-left p-4 w-[160px]">Timestamp</th>
                  <th className="text-left p-4">User</th>
                  <th className="text-left p-4">Action</th>
                  <th className="text-left p-4">Table</th>
                  <th className="text-left p-4">Details</th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading audit logs...</TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No recent activity found.</TableCell>
                  </TableRow>
                ) : (
                  logs.map(log => (
                    <TableRow key={log.id} className="text-sm">
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.user_id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{log.table_name}</TableCell>
                      <TableCell className="font-mono text-xs max-w-md truncate" title={JSON.stringify(log.new_data || log.old_data)}>
                        {log.action === 'UPDATE' && 'Modified record'}
                        {log.action === 'INSERT' && 'Created record'}
                        {log.action === 'DELETE' && 'Deleted record'}
                        : {log.record_id}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
