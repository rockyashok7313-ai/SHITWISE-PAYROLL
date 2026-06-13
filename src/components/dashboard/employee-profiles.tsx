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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EMPLOYEES as INITIAL_EMPLOYEES } from "@/lib/mock-data";
import { Users, Edit, Save, Calculator, IndianRupee, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function EmployeeProfiles() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  
  // Calculator state
  const [calcMode, setCalcMode] = useState<'day-to-hourly' | 'hourly-to-day'>('hourly-to-day');
  const [calcInput, setCalcInput] = useState<string>("");

  const handleUpdate = () => {
    setEmployees(prev => prev.map(emp => emp.id === editingEmployee.id ? editingEmployee : emp));
    setEditingEmployee(null);
    toast({
      title: "Profile Updated",
      description: "Employee records and wage rates have been updated.",
    });
  };

  const calculateRates = () => {
    if (!calcInput || !editingEmployee) return;
    const inputVal = parseFloat(calcInput);
    if (isNaN(inputVal)) return;

    const shiftHours = editingEmployee.shift === '12-hour' ? 12 : 9;
    
    if (calcMode === 'day-to-hourly') {
      const perHour = Math.round(inputVal / shiftHours);
      setEditingEmployee({ ...editingEmployee, rate: perHour });
      toast({
        title: "Rates Applied",
        description: `Daily ₹${inputVal} → ₹${perHour}/hr (based on ${shiftHours}h shift).`,
      });
    } else {
      const perDay = Math.round(inputVal * shiftHours);
      setEditingEmployee({ ...editingEmployee, rate: inputVal });
      toast({
        title: "Rates Applied",
        description: `₹${inputVal}/hr → ₹${perDay} per day (based on ${shiftHours}h shift).`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card/30 border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="font-headline flex items-center gap-2 text-2xl">
              <Users className="w-6 h-6 text-accent" />
              Factory Staff Directory
            </CardTitle>
            <CardDescription>Management of manufacturing staff wages and shift allocations.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border bg-background/30 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Labour Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Per Hour</TableHead>
                  <TableHead>Per Day</TableHead>
                  <TableHead>Monthly (26d)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => {
                  const hours = emp.shift === '12-hour' ? 12 : 9;
                  const perDay = emp.rate * hours;
                  const monthly = perDay * 26;
                  
                  return (
                    <TableRow key={emp.id} className="border-border hover:bg-muted/10">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-primary/20">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {emp.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col text-xs sm:text-sm">
                            <span className="font-semibold">{emp.name}</span>
                            <span className="text-muted-foreground">{emp.id}</span>
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
                      <TableCell className="font-mono text-sm">₹{emp.rate}</TableCell>
                      <TableCell className="font-mono text-sm text-primary font-bold">₹{perDay}</TableCell>
                      <TableCell className="font-mono text-sm text-accent">₹{monthly.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                setEditingEmployee({ ...emp });
                                setCalcInput("");
                              }} 
                              className="hover:text-accent"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[500px] bg-card border-border">
                            <DialogHeader>
                              <DialogTitle className="font-headline">Edit Profile: {editingEmployee?.name}</DialogTitle>
                              <DialogDescription>Update labor details and calculate specific wage rates.</DialogDescription>
                            </DialogHeader>
                            
                            <Tabs defaultValue="details" className="mt-4">
                              <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                                <TabsTrigger value="details">Basic Info</TabsTrigger>
                                <TabsTrigger value="calculator" className="flex items-center gap-2">
                                  <Calculator className="w-4 h-4" />
                                  Wage Tool
                                </TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="details" className="space-y-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="name" className="text-right text-xs">Name</Label>
                                  <Input 
                                    id="name" 
                                    value={editingEmployee?.name || ""} 
                                    onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                                    className="col-span-3 bg-background border-muted" 
                                  />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="rate" className="text-right text-xs">Rate (₹/hr)</Label>
                                  <Input 
                                    id="rate" 
                                    type="number"
                                    value={editingEmployee?.rate || 0} 
                                    onChange={(e) => setEditingEmployee({ ...editingEmployee, rate: Number(e.target.value) })}
                                    className="col-span-3 bg-background border-muted font-mono" 
                                  />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="shift" className="text-right text-xs">Shift</Label>
                                  <div className="col-span-3">
                                    <Select 
                                      value={editingEmployee?.shift} 
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
                              </TabsContent>

                              <TabsContent value="calculator" className="space-y-4 py-4">
                                <div className="p-3 bg-accent/5 border border-accent/20 rounded-md mb-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] text-accent uppercase font-bold flex items-center gap-1">
                                      <Calculator className="w-3 h-3" />
                                      Hourly/Day Wage Tool
                                    </p>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6"
                                      onClick={() => setCalcMode(prev => prev === 'hourly-to-day' ? 'day-to-hourly' : 'hourly-to-day')}
                                    >
                                      <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                                    </Button>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {calcMode === 'hourly-to-day' 
                                      ? "Calculate Per Day Salary based on Hourly Rate." 
                                      : "Calculate Hourly Rate based on Per Day Salary."}
                                  </p>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label className="text-right text-xs">
                                    {calcMode === 'hourly-to-day' ? "Hourly Rate" : "Per Day Salary"}
                                  </Label>
                                  <div className="col-span-3 relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                    <Input 
                                      type="number" 
                                      placeholder={calcMode === 'hourly-to-day' ? "e.g. 45" : "e.g. 500"} 
                                      value={calcInput}
                                      onChange={(e) => setCalcInput(e.target.value)}
                                      className="pl-8 bg-background border-muted"
                                    />
                                  </div>
                                </div>
                                
                                <div className="p-3 bg-muted/10 rounded-md">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">Assigned Shift:</span>
                                    <span className="font-bold">{editingEmployee?.shift}</span>
                                  </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                  <Button size="sm" variant="secondary" onClick={calculateRates}>
                                    Apply Calculation
                                  </Button>
                                </div>
                              </TabsContent>
                            </Tabs>

                            <DialogFooter>
                              <Button type="submit" onClick={handleUpdate} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
                                <Save className="w-4 h-4 mr-2" />
                                Save Profile
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
