"use client"

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EMPLOYEES as INITIAL_EMPLOYEES } from "@/lib/mock-data";
import { Users, Edit, Save, Calculator, IndianRupee, ArrowRightLeft, Trash2, Phone, Landmark, CreditCard, Camera, Plus, Search, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Employee {
  id: string;
  name: string;
  gender: string;
  role: string;
  rate: number;
  shift: string;
  mobile: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  photoUrl: string;
}

interface EmployeeProfilesProps {
  // Now using AppContext
}
import { useAppContext } from "@/components/providers/app-provider";
import { useRole } from "@/hooks/use-role";

export function EmployeeProfiles() {
  const { activeCompanyId, employees: propEmployees, handleEmployeesChange: onEmployeesChange } = useAppContext();
  const { isAccountant } = useRole(activeCompanyId);
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>(propEmployees);
  const [searchQuery, setSearchQuery] = useState("");

  // Sync internal state when prop changes (e.g. company switched)
  useEffect(() => {
    setEmployees(propEmployees);
  }, [propEmployees]);

  // Sync parent state when local state changes
  useEffect(() => {
    if (employees !== propEmployees) {
      onEmployeesChange(employees);
    }
  }, [employees, propEmployees, onEmployeesChange]);

  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    role: "",
    gender: "male",
    rate: 300,
    shift: "9-hour",
    mobile: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    photoUrl: "",
  });

  const handleCreate = () => {
    if (!newEmployee.name || !newEmployee.role) {
      toast({
        variant: "destructive",
        title: "Missing Fields",
        description: "Please enter at least the name and role of the employee.",
      });
      return;
    }
    const isStaff = newEmployee.role.toLowerCase().includes('supervisor') || newEmployee.role.toLowerCase().includes('manager') || newEmployee.role.toLowerCase().includes('staff');
    const prefix = isStaff ? 'STF' : 'LBR';
    const existingIds = employees.filter(e => e.id.startsWith(prefix)).map(e => parseInt(e.id.replace(prefix, '')));
    const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    const id = `${prefix}${String(nextNum).padStart(3, '0')}`;

    setEmployees(prev => [...prev, { ...newEmployee, id }]);
    setNewEmployee({
      name: "",
      role: "",
      gender: "male",
      rate: 300,
      shift: "9-hour",
      mobile: "",
      bankName: "",
      accountNumber: "",
      ifscCode: "",
      photoUrl: "",
    });
    setIsAddOpen(false);
    toast({
      title: "Employee Registered",
      description: `${newEmployee.name} has been successfully registered with ID ${id}.`,
    });
  };

  const handleNewPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewEmployee({ ...newEmployee, photoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };
  
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

  const handleDelete = (id: string) => {
    const deletedName = employees.find(e => e.id === id)?.name;
    setEmployees(prev => prev.filter(emp => emp.id !== id));
    toast({
      variant: "destructive",
      title: "Employee Deleted",
      description: `${deletedName} has been permanently removed from the directory.`,
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingEmployee({ ...editingEmployee, photoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
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
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 pb-4">
          <div>
            <CardTitle className="font-headline flex items-center gap-2 text-2xl">
              <Users className="w-6 h-6 text-accent" />
              Factory Staff Directory
            </CardTitle>
            <CardDescription>Management of manufacturing staff wages and shift allocations.</CardDescription>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 w-full sm:w-[250px] bg-background/50 border-border focus-visible:ring-accent"
              />
            </div>
            {!isAccountant && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-accent text-accent-foreground hover:bg-accent/90 h-10">
                    <Plus className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Add Staff Member</span>
                  </Button>
                </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-headline">Add New Staff Member</DialogTitle>
                <DialogDescription>Register a new worker with details, contact info, and bank records.</DialogDescription>
              </DialogHeader>
              
              <div className="flex justify-center py-6">
                <div className="relative">
                  <Avatar className="h-24 w-24 border-2 border-primary/20">
                    {newEmployee.photoUrl ? (
                      <AvatarImage src={newEmployee.photoUrl} />
                    ) : (
                      <AvatarFallback className="bg-muted text-2xl font-bold">
                        {newEmployee.name ? newEmployee.name.split(' ').map((n: string) => n[0]).join('') : '?'}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-0 right-0 rounded-full h-8 w-8 shadow-lg border border-border"
                    onClick={() => addFileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                  <input
                    type="file"
                    ref={addFileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleNewPhotoUpload}
                  />
                </div>
              </div>

              <Tabs defaultValue="details" className="mt-0">
                <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                  <TabsTrigger value="details">Basic Info</TabsTrigger>
                  <TabsTrigger value="bank">Bank & Contact</TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="space-y-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-name" className="text-left text-xs">Name</Label>
                    <Input 
                      id="new-name" 
                      value={newEmployee.name} 
                      placeholder="e.g. Ramesh Yadav"
                      onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                      className="col-span-3 bg-background border-muted" 
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-role" className="text-left text-xs">Role</Label>
                    <Input 
                      id="new-role" 
                      value={newEmployee.role} 
                      placeholder="e.g. Machine Operator"
                      onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                      className="col-span-3 bg-background border-muted" 
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-gender" className="text-left text-xs">Gender</Label>
                    <div className="col-span-3">
                      <Select 
                        value={newEmployee.gender} 
                        onValueChange={(val) => setNewEmployee({ ...newEmployee, gender: val })}
                      >
                        <SelectTrigger className="bg-background border-muted">
                          <SelectValue placeholder="Select Gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-rate" className="text-left text-xs">Rate (₹/hr)</Label>
                    <div className="col-span-3 relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input 
                        id="new-rate" 
                        type="number"
                        value={newEmployee.rate} 
                        onChange={(e) => setNewEmployee({ ...newEmployee, rate: Number(e.target.value) })}
                        className="pl-8 bg-background border-muted font-mono" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-left text-xs">Per Day Salary</Label>
                    <div className="col-span-3 relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input 
                        type="number"
                        step="any"
                        value={Number((newEmployee.rate * (newEmployee.shift === '12-hour' ? 12 : 9)).toFixed(2))} 
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const shiftHrs = newEmployee.shift === '12-hour' ? 12 : 9;
                          setNewEmployee({ ...newEmployee, rate: val / shiftHrs });
                        }}
                        className="pl-8 bg-background border-muted font-mono text-primary font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-shift" className="text-left text-xs">Shift</Label>
                    <div className="col-span-3">
                      <Select 
                        value={newEmployee.shift} 
                        onValueChange={(val) => setNewEmployee({ ...newEmployee, shift: val })}
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

                <TabsContent value="bank" className="space-y-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-mobile" className="text-left text-xs flex items-center justify-start gap-1">
                      <Phone className="w-3 h-3" />
                      Mobile
                    </Label>
                    <Input 
                      id="new-mobile" 
                      value={newEmployee.mobile} 
                      placeholder="10-digit number"
                      onChange={(e) => setNewEmployee({ ...newEmployee, mobile: e.target.value })}
                      className="col-span-3 bg-background border-muted" 
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-bankName" className="text-left text-xs flex items-center justify-start gap-1">
                      <Landmark className="w-3 h-3" />
                      Bank
                    </Label>
                    <Input 
                      id="new-bankName" 
                      value={newEmployee.bankName} 
                      placeholder="e.g. State Bank of India"
                      onChange={(e) => setNewEmployee({ ...newEmployee, bankName: e.target.value })}
                      className="col-span-3 bg-background border-muted" 
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-accNo" className="text-left text-xs flex items-center justify-start gap-1">
                      <CreditCard className="w-3 h-3" />
                      Acc No.
                    </Label>
                    <Input 
                      id="new-accNo" 
                      value={newEmployee.accountNumber} 
                      placeholder="Account Number"
                      onChange={(e) => setNewEmployee({ ...newEmployee, accountNumber: e.target.value })}
                      className="col-span-3 bg-background border-muted font-mono" 
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-ifsc" className="text-left text-xs">IFSC</Label>
                    <Input 
                      id="new-ifsc" 
                      value={newEmployee.ifscCode} 
                      placeholder="e.g. SBIN0001234"
                      onChange={(e) => setNewEmployee({ ...newEmployee, ifscCode: e.target.value.toUpperCase() })}
                      className="col-span-3 bg-background border-muted font-mono" 
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="submit" onClick={handleCreate} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Worker
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
            )}
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
                {employees.filter(emp => 
                  emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  emp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  emp.role.toLowerCase().includes(searchQuery.toLowerCase())
                ).map((emp) => {
                  const hours = emp.shift === '12-hour' ? 12 : 9;
                  const perDay = emp.rate * hours;
                  const monthly = perDay * 26;
                  
                  return (
                    <TableRow key={emp.id} className="border-border hover:bg-muted/10">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-primary/20">
                            {emp.photoUrl ? (
                              <AvatarImage src={emp.photoUrl} alt={emp.name} />
                            ) : (
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {(emp.name || 'U').split(' ').map((n: string) => n[0]).join('')}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex flex-col text-xs sm:text-sm">
                            <span className="font-semibold">{emp.name}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{emp.id} • {emp.gender}</span>
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
                      <TableCell className="font-mono text-sm">₹{emp.rate.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="font-mono text-sm text-primary font-bold">₹{perDay.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="font-mono text-sm text-accent">₹{monthly.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="hover:text-primary"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[400px] bg-card border-border shadow-2xl">
                              <DialogHeader className="pb-4 border-b border-border/50">
                                <DialogTitle className="font-headline text-center text-xl">Staff ID Card</DialogTitle>
                              </DialogHeader>
                              <div className="flex flex-col items-center pt-4 space-y-4">
                                <Avatar className="h-32 w-32 border-4 border-primary/20 shadow-lg">
                                  {emp.photoUrl ? (
                                    <AvatarImage src={emp.photoUrl} />
                                  ) : (
                                    <AvatarFallback className="bg-primary/10 text-primary text-4xl">
                                      {(emp.name || 'U').split(' ').map((n: string) => n[0]).join('')}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                                <div className="text-center space-y-1">
                                  <h3 className="text-2xl font-bold font-headline text-foreground">{emp.name}</h3>
                                  <p className="text-sm text-muted-foreground font-mono">{emp.id} • {(emp.gender || '').toUpperCase()}</p>
                                  <Badge variant="outline" className="mt-2 bg-primary/10 text-primary border-primary/20 uppercase">{emp.role}</Badge>
                                </div>
                              </div>
                              <div className="grid gap-2 mt-6">
                                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <Phone className="w-4 h-4 text-primary" />
                                    <span className="text-sm text-muted-foreground">Mobile Number</span>
                                  </div>
                                  <span className="font-mono text-sm">{emp.mobile || 'N/A'}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <Landmark className="w-4 h-4 text-primary" />
                                    <span className="text-sm text-muted-foreground">Bank Name</span>
                                  </div>
                                  <span className="font-medium text-sm">{emp.bankName || 'N/A'}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <CreditCard className="w-4 h-4 text-primary" />
                                    <span className="text-sm text-muted-foreground">Account Number</span>
                                  </div>
                                  <span className="font-mono text-sm tracking-widest">{emp.accountNumber || 'N/A'}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <IndianRupee className="w-4 h-4 text-primary" />
                                    <span className="text-sm text-muted-foreground">IFSC Code</span>
                                  </div>
                                  <span className="font-mono text-sm tracking-wider uppercase">{emp.ifscCode || 'N/A'}</span>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          {!isAccountant && (
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
                            <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="font-headline">Edit Profile: {editingEmployee?.name}</DialogTitle>
                                <DialogDescription>Update labor details, contact info, and bank records.</DialogDescription>
                              </DialogHeader>
                              
                              <div className="flex justify-center py-6">
                                <div className="relative">
                                  <Avatar className="h-24 w-24 border-2 border-primary/20">
                                    {editingEmployee?.photoUrl ? (
                                      <AvatarImage src={editingEmployee.photoUrl} />
                                    ) : (
                                      <AvatarFallback className="bg-muted text-2xl font-bold">
                                        {(editingEmployee?.name || 'U').split(' ').map((n: string) => n[0]).join('')}
                                      </AvatarFallback>
                                    )}
                                  </Avatar>
                                  <Button
                                    size="icon"
                                    variant="secondary"
                                    className="absolute bottom-0 right-0 rounded-full h-8 w-8 shadow-lg border border-border"
                                    onClick={() => fileInputRef.current?.click()}
                                  >
                                    <Camera className="h-4 w-4" />
                                  </Button>
                                  <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handlePhotoUpload}
                                  />
                                </div>
                              </div>

                              <Tabs defaultValue="details" className="mt-0">
                                <TabsList className="grid w-full grid-cols-3 bg-muted/50">
                                  <TabsTrigger value="details">Basic Info</TabsTrigger>
                                  <TabsTrigger value="bank">Bank & Contact</TabsTrigger>
                                  <TabsTrigger value="calculator" className="flex items-center gap-2">
                                    <Calculator className="w-4 h-4" />
                                    Wage Tool
                                  </TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="details" className="space-y-4 py-4">
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-left text-xs">Name</Label>
                                    <Input 
                                      id="name" 
                                      value={editingEmployee?.name || ""} 
                                      onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                                      className="col-span-3 bg-background border-muted" 
                                    />
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="role" className="text-left text-xs">Role</Label>
                                    <Input 
                                      id="role" 
                                      value={editingEmployee?.role || ""} 
                                      onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                                      className="col-span-3 bg-background border-muted" 
                                    />
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="gender" className="text-left text-xs">Gender</Label>
                                    <div className="col-span-3">
                                      <Select 
                                        value={editingEmployee?.gender} 
                                        onValueChange={(val) => setEditingEmployee({ ...editingEmployee, gender: val })}
                                      >
                                        <SelectTrigger className="bg-background border-muted">
                                          <SelectValue placeholder="Select Gender" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="male">Male</SelectItem>
                                          <SelectItem value="female">Female</SelectItem>
                                          <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="rate" className="text-left text-xs">Rate (₹/hr)</Label>
                                    <div className="col-span-3 relative">
                                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                      <Input 
                                        id="rate" 
                                        type="number"
                                        value={editingEmployee?.rate || 0} 
                                        onChange={(e) => setEditingEmployee({ ...editingEmployee, rate: Number(e.target.value) })}
                                        className="pl-8 bg-background border-muted font-mono" 
                                      />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-left text-xs">Per Day Salary</Label>
                                    <div className="col-span-3 relative">
                                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                      <Input 
                                        type="number"
                                        step="any"
                                        value={editingEmployee ? Number((editingEmployee.rate * (editingEmployee.shift === '12-hour' ? 12 : 9)).toFixed(2)) : 0} 
                                        onChange={(e) => {
                                          if (!editingEmployee) return;
                                          const val = Number(e.target.value);
                                          const shiftHrs = editingEmployee.shift === '12-hour' ? 12 : 9;
                                          setEditingEmployee({ ...editingEmployee, rate: val / shiftHrs });
                                        }}
                                        className="pl-8 bg-background border-muted font-mono text-primary font-bold"
                                      />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="shift" className="text-left text-xs">Shift</Label>
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

                                <TabsContent value="bank" className="space-y-4 py-4">
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="mobile" className="text-left text-xs flex items-center justify-start gap-1">
                                      <Phone className="w-3 h-3" />
                                      Mobile
                                    </Label>
                                    <Input 
                                      id="mobile" 
                                      value={editingEmployee?.mobile || ""} 
                                      placeholder="10-digit number"
                                      onChange={(e) => setEditingEmployee({ ...editingEmployee, mobile: e.target.value })}
                                      className="col-span-3 bg-background border-muted" 
                                    />
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="bankName" className="text-left text-xs flex items-center justify-start gap-1">
                                      <Landmark className="w-3 h-3" />
                                      Bank
                                    </Label>
                                    <Input 
                                      id="bankName" 
                                      value={editingEmployee?.bankName || ""} 
                                      placeholder="Bank Name"
                                      onChange={(e) => setEditingEmployee({ ...editingEmployee, bankName: e.target.value })}
                                      className="col-span-3 bg-background border-muted" 
                                    />
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="accNo" className="text-left text-xs flex items-center justify-start gap-1">
                                      <CreditCard className="w-3 h-3" />
                                      Acc No.
                                    </Label>
                                    <Input 
                                      id="accNo" 
                                      value={editingEmployee?.accountNumber || ""} 
                                      placeholder="Account Number"
                                      onChange={(e) => setEditingEmployee({ ...editingEmployee, accountNumber: e.target.value })}
                                      className="col-span-3 bg-background border-muted font-mono" 
                                    />
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="ifsc" className="text-right text-xs">IFSC</Label>
                                    <Input 
                                      id="ifsc" 
                                      value={editingEmployee?.ifscCode || ""} 
                                      placeholder="IFSC Code"
                                      onChange={(e) => setEditingEmployee({ ...editingEmployee, ifscCode: e.target.value.toUpperCase() })}
                                      className="col-span-3 bg-background border-muted font-mono" 
                                    />
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
                          )}

                          {!isAccountant && (
                            <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-border">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Permanently Delete Staff?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {emp.name}? This action cannot be undone and all historical links will be lost.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDelete(emp.id)}
                                  className="bg-destructive hover:bg-destructive/90 text-white"
                                >
                                  Confirm Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          )}
                        </div>
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
