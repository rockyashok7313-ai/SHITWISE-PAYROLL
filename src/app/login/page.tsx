"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Lock, Mail, Factory, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { BackupRestorePanel } from "@/components/settings/backup-restore-panel"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { LifeBuoy, ChevronDown } from "lucide-react"

const LoginBackground = dynamic(() => import("@/components/ui/login-background").then(m => m.LoginBackground), { ssr: false })

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    // Check if already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/')
      }
    }
    checkSession()
  }, [router])

  const handleAuth = async (isSignUp: boolean) => {
    if (!email || !password) {
      toast({ variant: "destructive", title: "Error", description: "Please enter both email and password." })
      return
    }

    setLoading(true)
    
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        
        if (data.session) {
          toast({ title: "Account Created", description: "Welcome to ShiftWise!" })
          router.push('/')
        } else {
          toast({ 
            title: "Check Your Email", 
            description: "Account created! Please check your email inbox to verify your account before logging in." 
          })
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        toast({ title: "Logged In", description: "Welcome back to ShiftWise." })
        router.push('/')
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Authentication Failed", description: error.message || "An unknown error occurred." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <LoginBackground />
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <FadeIn y={16} className="w-full max-w-md relative z-10">
      <Card className="w-full bg-card/60 backdrop-blur-xl border-border shadow-2xl">
        <Stagger stagger={0.07} delayChildren={0.1}>
        <CardHeader className="space-y-2 text-center pb-8 pt-8">
          <StaggerItem>
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 border border-primary/20">
              <Factory className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl font-headline tracking-tight">ShiftWise</CardTitle>
              <CardDescription className="text-sm">Secure Factory Payroll &amp; Attendance</CardDescription>
            </div>
          </StaggerItem>
        </CardHeader>

        <CardContent className="space-y-6">
          <StaggerItem>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Email Address</Label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="admin@factory.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
          </StaggerItem>
          <StaggerItem>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Password</Label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleAuth(false)}
              />
            </div>
          </div>
          </StaggerItem>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pb-8">
          <StaggerItem className="w-full flex flex-col gap-3">
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 active:scale-[0.98]"
            onClick={() => handleAuth(false)}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Sign In"}
          </Button>
          <div className="relative w-full text-center py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50"></div></div>
            <span className="relative bg-card px-2 text-xs text-muted-foreground">OR</span>
          </div>
          <Button
            variant="outline"
            className="w-full border-border/50 bg-background/30 hover:bg-background/50 transition-all active:scale-[0.98]"
            onClick={() => handleAuth(true)}
            disabled={loading}
          >
            Create New Account
          </Button>
          </StaggerItem>
        </CardFooter>
        </Stagger>
      </Card>
      </FadeIn>

      {/* Reachable WITHOUT signing in, on purpose: reads/writes only this
          browser's localStorage via @/lib/backup, no Supabase call at all.
          This is the one place to grab or restore your local data cache when
          sign-in itself is broken -- e.g. the cloud database is unreachable. */}
      <FadeIn delay={0.2} className="w-full max-w-md relative z-10 mt-4">
        <Collapsible open={recoveryOpen} onOpenChange={setRecoveryOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              Trouble signing in? Recover local data
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${recoveryOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="bg-card/60 backdrop-blur-xl border-border mt-2">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground mb-3">
                  If the cloud database is unreachable, this doesn&apos;t block your data:
                  anything already loaded in this browser is cached here and stays safe.
                  These buttons work whether or not sign-in succeeds -- they only read
                  and write this browser&apos;s local storage, nothing goes to Supabase.
                </p>
                <BackupRestorePanel />
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </FadeIn>
    </div>
  )
}
