"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { Shield, Mail, Trash2 } from "lucide-react";

export function TeamManagement({ activeCompanyId }: { activeCompanyId: string }) {
  const { toast } = useToast();
  const { isAdmin } = useRole(activeCompanyId);
  
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("accountant");
  const [isInviting, setIsInviting] = useState(false);

  const loadMembers = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      // Goes through the team-invite edge function (action "list") rather
      // than querying company_members directly -- resolving each member's
      // email needs the service-role admin API, which only that function
      // has access to. See supabase/functions/team-invite.
      const { data, error } = await supabase.functions.invoke('team-invite', {
        body: { action: 'list', company_id: activeCompanyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMembers(data?.members || []);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [activeCompanyId]);

  const handleInvite = async () => {
    if (!newEmail || !activeCompanyId) return;
    setIsInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('team-invite', {
        body: {
          action: 'invite',
          company_id: activeCompanyId,
          email: newEmail,
          role: newRole,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: data.alreadyHadAccount ? "Added to Team" : "Invitation Sent",
        description: data.alreadyHadAccount
          ? `${newEmail} already had an account and now has access as ${newRole}.`
          : `An invite email is on its way to ${newEmail} (role: ${newRole}).`,
      });
      setNewEmail("");
      await loadMembers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!activeCompanyId) return;
    try {
      const { data, error } = await supabase.functions.invoke('team-invite', {
        body: { action: 'remove', company_id: activeCompanyId, member_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMembers(members.filter(m => m.id !== id));
      toast({ title: "Member Removed" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>You need Administrator privileges to manage the team.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Shield className="w-4 h-4" />
            </span>
            Team Access Management
          </CardTitle>
          <CardDescription>
            Invite team members and assign roles (Admin, Supervisor, Accountant).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 mb-8 bg-card/50 p-4 rounded-xl border border-border">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-semibold">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="colleague@company.com" 
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-48 space-y-2">
              <label className="text-sm font-semibold">Role</label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="accountant">Accountant (Read-only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleInvite} 
              disabled={isInviting || !newEmail}
              className="bg-accent text-accent-foreground"
            >
              Send Invite
            </Button>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <th className="text-left p-4">User ID / Email</th>
                  <th className="text-left p-4">Role</th>
                  <th className="text-left p-4">Added On</th>
                  <th className="text-right p-4">Action</th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading members...</TableCell>
                  </TableRow>
                ) : members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No additional team members found.</TableCell>
                  </TableRow>
                ) : (
                  members.map(member => (
                    <TableRow key={member.id}>
                      <TableCell className="text-sm">{member.email || <span className="font-mono text-muted-foreground">{member.user_id}</span>}</TableCell>
                      <TableCell className="capitalize">{member.role}</TableCell>
                      <TableCell>{new Date(member.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleRemove(member.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
