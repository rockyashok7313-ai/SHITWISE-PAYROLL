"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/components/providers/app-provider";
import { supabase } from "@/lib/supabase";
import { History as HistoryIcon, Activity, Clock, Trash2, Edit2, PlusCircle, ArrowRight, User } from "lucide-react";
import { format } from "date-fns";
import { useRole } from "@/hooks/use-role";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ActivityLogs() {
  const { activeCompanyId } = useAppContext();
  const { isAdmin, isSupervisor } = useRole(activeCompanyId);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState("all");

  useEffect(() => {
    async function fetchLogs() {
      if (!activeCompanyId) return;
      setLoading(true);
      
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('company_id', activeCompanyId)
        .order('timestamp', { ascending: false })
        .limit(100);
        
      if (tableFilter !== 'all') {
        query = query.eq('table_name', tableFilter);
      }

      const { data, error } = await query;
      
      if (!error && data) {
        setLogs(data);
      }
      setLoading(false);
    }
    
    fetchLogs();
  }, [activeCompanyId, tableFilter]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'INSERT': return <PlusCircle className="w-4 h-4 text-emerald-500" />;
      case 'UPDATE': return <Edit2 className="w-4 h-4 text-amber-500" />;
      case 'DELETE': return <Trash2 className="w-4 h-4 text-red-500" />;
      default: return <Activity className="w-4 h-4 text-blue-500" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'UPDATE': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'DELETE': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const formatDataValue = (key: string, value: any) => {
    if (value === null || value === undefined) return "None";
    if (typeof value === 'boolean') return value ? "Yes" : "No";
    if (typeof value === 'object') return JSON.stringify(value);
    
    // Format currency or specific fields if needed
    if (['rate', 'amount', 'totalWage', 'incentive'].includes(key)) {
      return `₹${Number(value).toLocaleString('en-IN')}`;
    }
    
    return String(value);
  };

  const renderDataDiff = (oldData: any, newData: any, action: string) => {
    if (action === 'DELETE' && oldData) {
      return (
        <div className="mt-3 text-xs bg-red-950/20 border border-red-900/30 rounded-md p-3">
          <div className="font-semibold text-red-500/80 mb-2">Deleted Record:</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(oldData).map(([key, val]) => (
              val !== null && key !== 'id' && key !== 'company_id' && (
                <div key={key} className="flex flex-col">
                  <span className="text-muted-foreground opacity-70 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-foreground">{formatDataValue(key, val)}</span>
                </div>
              )
            ))}
          </div>
        </div>
      );
    }
    
    if (action === 'INSERT' && newData) {
      return (
        <div className="mt-3 text-xs bg-emerald-950/20 border border-emerald-900/30 rounded-md p-3">
          <div className="font-semibold text-emerald-500/80 mb-2">New Record:</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(newData).map(([key, val]) => (
              val !== null && key !== 'id' && key !== 'company_id' && (
                <div key={key} className="flex flex-col">
                  <span className="text-muted-foreground opacity-70 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-foreground">{formatDataValue(key, val)}</span>
                </div>
              )
            ))}
          </div>
        </div>
      );
    }

    if (action === 'UPDATE' && oldData && newData) {
      const changedKeys = Object.keys(newData).filter(k => 
        k !== 'id' && 
        k !== 'company_id' && 
        k !== 'is_modified' && 
        JSON.stringify(oldData[k]) !== JSON.stringify(newData[k])
      );

      if (changedKeys.length === 0) return null;

      return (
        <div className="mt-3 text-xs bg-amber-950/20 border border-amber-900/30 rounded-md p-3">
          <div className="font-semibold text-amber-500/80 mb-2">Changes Made:</div>
          <div className="space-y-2">
            {changedKeys.map(key => (
              <div key={key} className="flex items-center gap-2 bg-background/50 p-1.5 rounded border border-border/50">
                <span className="text-muted-foreground w-24 truncate capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="text-red-400 line-through truncate max-w-[100px]">{formatDataValue(key, oldData[key])}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-emerald-400 font-medium truncate max-w-[100px]">{formatDataValue(key, newData[key])}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  if (!isAdmin && !isSupervisor) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card/30">
        <HistoryIcon className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground">Access Denied</h3>
        <p className="text-muted-foreground mt-2 max-w-sm">
          You need Administrator or Supervisor privileges to view the system activity logs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-headline">Audit Logs</h2>
          <p className="text-sm text-muted-foreground">Monitor system changes and user activity</p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Filter by Table:</span>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Activity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activity</SelectItem>
              <SelectItem value="attendance">Attendance</SelectItem>
              <SelectItem value="employees">Employees</SelectItem>
              <SelectItem value="companies">Company Settings</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center">
              <Activity className="w-6 h-6 animate-pulse mb-2 text-accent" />
              Loading audit trails...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <HistoryIcon className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-foreground">No activity found</h3>
              <p className="text-sm text-muted-foreground mt-1">No recorded changes match your current filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="p-5 hover:bg-muted/10 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getActionIcon(log.action)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getActionColor(log.action)}>
                            {log.action}
                          </Badge>
                          <span className="text-sm font-medium">
                            {log.table_name.replace(/_/g, ' ')}
                          </span>
                        </div>
                        
                        <div className="mt-2 text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            <span className="font-mono text-xs">{log.user_id}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{format(new Date(log.timestamp), "MMM d, yyyy h:mm a")}</span>
                          </div>
                        </div>

                        {renderDataDiff(log.old_data, log.new_data, log.action)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
