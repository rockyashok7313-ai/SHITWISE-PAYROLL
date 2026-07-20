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

const LoginBackground = dynamic(() => import("@/components/ui/login-background").then(m => m.LoginBackground), { ssr: false })

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
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
      <Card className="w-full max-w-md bg-card/60 backdrop-blur-xl border-border relative z-10 shadow-2xl">
        <CardHeader className="space-y-2 text-center pb-8 pt-8">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 border border-primary/20">
            <Factory className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-headline tracking-tight">ShiftWise</CardTitle>
            <CardDescription className="text-sm">Secure Factory Payroll & Attendance</CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
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
        </CardContent>
        
        <CardFooter className="flex flex-col gap-3 pb-8">
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
        </CardFooter>
      </Card>
    </div>
  )
}
