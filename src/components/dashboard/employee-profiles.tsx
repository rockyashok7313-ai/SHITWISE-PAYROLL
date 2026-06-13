"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EMPLOYEES } from "@/lib/mock-data";
import { Users, Mail, Phone, MapPin } from "lucide-react";

export function EmployeeProfiles() {
  return (
    <div className="space-y-6">
      <Card className="bg-card/30 border-border">
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            Active Employee Directory
          </CardTitle>
          <CardDescription>Manage staff profiles, shift assignments, and hourly rates.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border bg-background/30">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Default Shift</TableHead>
                  <TableHead>Hourly Rate</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EMPLOYEES.map((emp) => (
                  <TableRow key={emp.id} className="border-border hover:bg-muted/10">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-primary/20">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {emp.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{emp.name}</span>
                          <span className="text-xs text-muted-foreground">{emp.id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{emp.role}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Mail className="w-3 h-3" /> {emp.name.toLowerCase().replace(' ', '.')}@shiftwise.in
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Phone className="w-3 h-3" /> +91 98765 43210
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={emp.shift === '12-hour' ? 'text-accent border-accent/20' : 'text-primary border-primary/20'}>
                        {emp.shift}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">₹{emp.rate}/hr</TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
