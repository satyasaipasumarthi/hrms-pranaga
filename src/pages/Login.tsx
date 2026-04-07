import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import GlowButton from "@/components/ui/GlowButton";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { getAuthActionTypeFromHash, type AuthActionType } from "@/lib/auth-links";
import { supabase } from "@/lib/supabase";

const MIN_PASSWORD_LENGTH = 8;

const getCurrentAuthAction = (): AuthActionType | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return getAuthActionTypeFromHash(window.location.hash);
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authActionType, setAuthActionType] = useState<AuthActionType | null>(getCurrentAuthAction);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login, logout, isLoading } = useAuth();

  useEffect(() => {
    const syncAuthAction = () => setAuthActionType(getCurrentAuthAction());

    syncAuthAction();
    window.addEventListener("hashchange", syncAuthAction);

    return () => window.removeEventListener("hashchange", syncAuthAction);
  }, []);

  const isPasswordSetupMode = authActionType === "invite" || authActionType === "recovery";

  const screenCopy = useMemo(() => {
    if (authActionType === "invite") {
      return {
        title: "Set Your Access Key",
        eyebrow: "INVITE_ACCEPTED",
        description: "Create a password now. After saving, you will return to the login page and sign in with your work email and password.",
        buttonLabel: "Save Password",
      };
    }

    if (authActionType === "recovery") {
      return {
        title: "Reset Your Password",
        eyebrow: "PASSWORD_RECOVERY",
        description: "Set a new password now. After saving, you will return to the login page and sign in again with your email and password.",
        buttonLabel: "Update Password",
      };
    }

    return {
      title: "Secure Access Portal",
      eyebrow: "SECURE_ACCESS_PORTAL",
      description: "Sign in with your work email and password to access the PraNaga HRMS.",
      buttonLabel: "Initiate Session",
    };
  }, [authActionType]);

  const clearAuthActionFromUrl = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.history.replaceState({}, document.title, window.location.pathname);
    setAuthActionType(null);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await login(email, password);

    if (result.success) {
      navigate(useAuth.getState().homePath);
      return;
    }

    toast({
      title: "Access Denied",
      description: result.error || "Invalid credentials. Please check your email and password.",
      variant: "destructive",
    });
  };

  const handlePasswordSetup = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: "Password too short",
        description: `Use at least ${MIN_PASSWORD_LENGTH} characters for the new password.`,
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Re-enter the same password in both fields and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsPasswordSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("This password link is invalid or expired. Request a fresh invite or recovery email.");
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }

      const sessionEmail = session.user.email ?? "";
      clearAuthActionFromUrl();
      await logout();
      setEmail(sessionEmail);
      setPassword("");
      setConfirmPassword("");

      toast({
        title: authActionType === "invite" ? "Password saved" : "Password updated",
        description:
          authActionType === "invite"
            ? "Your account is ready. Please sign in now with your email and new password."
            : "Your password has been reset. Please sign in again with your new password.",
      });

      navigate("/login", { replace: true });
    } catch (error) {
      toast({
        title: authActionType === "invite" ? "Could not set password" : "Could not reset password",
        description: error instanceof Error ? error.message : "Please request a fresh email and try again.",
        variant: "destructive",
      });
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid-overlay flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="glass-card p-8 w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto">
            <img src="/brand-logo.svg" alt="PraNaga Logo" className="w-full h-full object-contain rounded-xl" />
          </div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Pra<span className="text-primary">Naga</span> HRMS
          </h1>
          <p className="text-xs text-muted-foreground font-heading tracking-widest">{screenCopy.eyebrow}</p>
          <p className="text-xs text-muted-foreground">{screenCopy.description}</p>
        </div>

        {isPasswordSetupMode ? (
          <form onSubmit={handlePasswordSetup} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-heading tracking-wider">NEW_PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                placeholder="Enter a strong password"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-heading tracking-wider">CONFIRM_PASSWORD</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                placeholder="Re-enter the same password"
                required
              />
            </div>
            <GlowButton className="w-full" type="submit" disabled={isLoading || isPasswordSubmitting}>
              {isPasswordSubmitting ? "Saving..." : screenCopy.buttonLabel}
            </GlowButton>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-heading tracking-wider">EMAIL_ADDRESS</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                placeholder="Email"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-heading tracking-wider">ACCESS_KEY</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
            <GlowButton className="w-full" type="submit" disabled={isLoading}>
              {screenCopy.buttonLabel}
            </GlowButton>
          </form>
        )}

        <p className="text-xs text-center text-muted-foreground">
          PraNaga Solutions © 2026 • Enterprise Systems
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
