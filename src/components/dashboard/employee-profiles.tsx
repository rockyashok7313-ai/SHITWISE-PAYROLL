"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPLOYEES as INITIAL_EMPLOYEES } from "@/lib/mock-data";
import { Users, Mail, Phone, Edit, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function EmployeeProfiles() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);

  const handleUpdate = () => {
    setEmployees(prev => prev.map(emp => emp.id === editingEmployee.id ? editingEmployee : emp));
    setEditingEmployee(null);
    toast({
      title: "Profile Updated",
      description: "Employee records have been synchronized successfully.",
    });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card/30 border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="font-headline flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" />
              Factory Staff & Labour Directory
            </CardTitle>
            <CardDescription>Manage machine operators, helpers, and management staff.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border bg-background/30">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Default Shift</TableHead>
                  <TableHead>Hourly Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
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
                    <TableCell>
                      <Badge variant="secondary" className="bg-muted/50 text-[10px] uppercase">
                        {emp.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={emp.shift === '12-hour' ? 'text-accent border-accent/20' : 'text-primary border-primary/20'}>
                        {emp.shift}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">₹{emp.rate}/hr</TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setEditingEmployee({ ...emp })} className="hover:text-accent">
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] bg-card border-border">
                          <DialogHeader>
                            <DialogTitle className="font-headline">Edit Employee Profile</DialogTitle>
                            <DialogDescription>Modify wages and shift details for {editingEmployee?.name}.</DialogDescription>
                          </DialogHeader>
                          {editingEmployee && (
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">Name</Label>
                                <Input 
                                  id="name" 
                                  value={editingEmployee.name} 
                                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                                  className="col-span-3 bg-background border-muted" 
                                />
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="role" className="text-right">Role</Label>
                                <Input 
                                  id="role" 
                                  value={editingEmployee.role} 
                                  onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                                  className="col-span-3 bg-background border-muted" 
                                />
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="rate" className="text-right">Rate (₹)</Label>
                                <Input 
                                  id="rate" 
                                  type="number"
                                  value={editingEmployee.rate} 
                                  onChange={(e) => setEditingEmployee({ ...editingEmployee, rate: Number(e.target.value) })}
                                  className="col-span-3 bg-background border-muted" 
                                />
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="shift" className="text-right">Shift</Label>
                                <div className="col-span-3">
                                  <Select 
                                    value={editingEmployee.shift} 
                                    onValueChange={(val) => setEditingEmployee({ ...editingEmployee, shift: val })}
                                  >
                                    <SelectTrigger className="bg-background border-muted">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="9-hour">9-hour Shift</SelectItem>
                                      <SelectItem value="12-hour">12-hour Shift</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          )}
                          <DialogFooter>
                            <Button type="submit" onClick={handleUpdate} className="bg-primary hover:bg-primary/90">
                              <Save className="w-4 h-4 mr-2" />
                              Save Changes
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
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
