"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { KeyRound, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { FadeIn } from "@/components/ui/motion"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { ThemeColorPicker } from "@/components/ui/theme-color-picker"
import { GradientOrbs } from "@/components/ui/gradient-orbs"

const LoginBackground = dynamic(() => import("@/components/ui/login-background").then(m => m.LoginBackground), { ssr: false })

/**
 * Landing page for the link inside a Supabase password-recovery email
 * (see handleForgotPassword in src/app/login/page.tsx, which sets
 * redirectTo to this route). Deliberately outside the (app) route group --
 * that group's layout redirects anyone without a session to /login, which
 * would bounce a user arriving here straight back out again.
 */
export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    // Supabase parses the recovery token out of the URL on load and fires
    // this event once it's installed a temporary session from it. The form
    // stays disabled until then so nothing can be submitted against a
    // session that isn't actually a password-recovery one.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true)
      }
    })

    // Belt-and-braces for the case where the event fires before this
    // component mounts (fast networks) -- check for a live session too.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const handleReset = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ variant: "destructive", title: "Error", description: "Enter and confirm your new password." })
      return
    }
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Password too short", description: "Use at least 6 characters." })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords don't match", description: "Double-check both fields." })
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast({ title: "Password Updated", description: "Sign in with your new password." })
      await supabase.auth.signOut()
      router.push("/login")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Could not update your password." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <GradientOrbs />
      <LoginBackground />
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
        <ThemeColorPicker />
        <ThemeToggle />
      </div>
      <FadeIn y={16} className="w-full max-w-md relative z-10">
        <Card className="w-full bg-card/60 backdrop-blur-xl border-border shadow-2xl">
          <CardHeader className="space-y-2 text-center pb-8 pt-8">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 border border-primary/20">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-headline tracking-tight">Set New Password</CardTitle>
            <CardDescription className="text-sm">
              {ready ? "Choose a new password for your account." : "Verifying your reset link…"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                New Password
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={!ready}
                className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Confirm New Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={!ready}
                onKeyDown={(e) => e.key === 'Enter' && ready && handleReset()}
                className="bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pb-8">
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              onClick={handleReset}
              disabled={!ready || loading}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Update Password
            </Button>
            {!ready && (
              <p className="text-xs text-muted-foreground text-center">
                This link may have expired. Request a new one from the login page.
              </p>
            )}
          </CardFooter>
        </Card>
      </FadeIn>
    </div>
  )
}
