"use client"

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Factory, Clock, IndianRupee, ShieldCheck, CalendarRange } from "lucide-react";

export function FactorySettings() {
  const { toast } = useToast();
  const [config, setConfig] = useState({
    companyName: "ShiftWise Systems Ltd",
    factoryUnit: "Unit #1 - Manufacturing",
    standardShiftHours: 9,
    factoryShiftHours: 12,
    defaultIncentive: 100,
    currency: "INR",
    financialYear: "2024-25",
  });

  const handleSave = () => {
    toast({
      title: "Settings Updated",
      description: `Factory configuration for FY ${config.financialYear} has been saved successfully.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card/30 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <Factory className="w-5 h-5 text-primary" />
                Company Profile
              </CardTitle>
              <CardDescription>Basic identification for reports and payslips.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input 
                    id="companyName" 
                    value={config.companyName} 
                    onChange={(e) => setConfig({...config, companyName: e.target.value})}
                    className="bg-background border-muted" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="factoryUnit">Factory Unit / Branch</Label>
                  <Input 
                    id="factoryUnit" 
                    value={config.factoryUnit} 
                    onChange={(e) => setConfig({...config, factoryUnit: e.target.value})}
                    className="bg-background border-muted" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/30 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <CalendarRange className="w-5 h-5 text-accent" />
                Reporting Period
              </CardTitle>
              <CardDescription>Configure the active Financial Year for statutory tracking.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fy">Active Financial Year</Label>
                  <Select 
                    value={config.financialYear} 
                    onValueChange={(val) => setConfig({...config, financialYear: val})}
                  >
                    <SelectTrigger id="fy" className="bg-background border-muted">
                      <SelectValue placeholder="Select FY" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2023-24">FY 2023-24 (Apr-Mar)</SelectItem>
                      <SelectItem value="2024-25">FY 2024-25 (Apr-Mar)</SelectItem>
                      <SelectItem value="2025-26">FY 2025-26 (Apr-Mar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/30 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent" />
                Shift Definitions
              </CardTitle>
              <CardDescription>Configure default durations for shift types.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stdShift">Standard Shift Hours</Label>
                  <Input 
                    id="stdShift" 
                    type="number"
                    value={config.standardShiftHours} 
                    onChange={(e) => setConfig({...config, standardShiftHours: Number(e.target.value)})}
                    className="bg-background border-muted" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facShift">Factory (Extended) Shift Hours</Label>
                  <Input 
                    id="facShift" 
                    type="number"
                    value={config.factoryShiftHours} 
                    onChange={(e) => setConfig({...config, factoryShiftHours: Number(e.target.value)})}
                    className="bg-background border-muted" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/30 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-green-500" />
                Financial Presets
              </CardTitle>
              <CardDescription>Default values for payout calculations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defInc">Default Daily Incentive (₹)</Label>
                  <Input 
                    id="defInc" 
                    type="number"
                    value={config.defaultIncentive} 
                    onChange={(e) => setConfig({...config, defaultIncentive: Number(e.target.value)})}
                    className="bg-background border-muted" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="curr">Reporting Currency</Label>
                  <Input 
                    id="curr" 
                    value={config.currency} 
                    readOnly
                    className="bg-muted/50 border-muted font-mono" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-border">
                <ShieldCheck className="w-5 h-5 text-green-500" />
                <span className="text-xs font-medium">Compliance Verified</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Updating the Financial Year affects statutory reports, bonus calculations, and seasonal trend analysis.
              </p>
              <Button onClick={handleSave} className="w-full bg-primary hover:bg-primary/90">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
