"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { KeyRound, Loader2 } from "lucide-react"

export function ChangePassword() {
  const { toast } = useToast()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ variant: "destructive", title: "Missing fields", description: "Fill in all three fields." })
      return
    }
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Password too short", description: "Use at least 6 characters." })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords don't match", description: "New password and confirmation must match." })
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) throw new Error("Could not determine your account email.")

      // Re-verify identity with the current password before changing it --
      // updateUser alone would let anyone with a still-open tab silently
      // lock the real owner out.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (verifyError) {
        throw new Error("Current password is incorrect.")
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      toast({ title: "Password Updated", description: "Your password has been changed successfully." })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Could not update your password." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-card/30 border-border">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <KeyRound className="w-4 h-4" />
          </span>
          Change Password
        </CardTitle>
        <CardDescription>Update the password used to sign in to your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="current-password">Current Password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm New Password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
          />
        </div>
        <Button onClick={handleChangePassword} disabled={loading} className="bg-accent text-accent-foreground">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Update Password
        </Button>
      </CardContent>
    </Card>
  )
}
