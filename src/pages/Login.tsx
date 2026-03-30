import { motion } from "framer-motion";
import { useState } from "react";
import GlowButton from "@/components/ui/GlowButton";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      navigate(useAuth.getState().homePath);
    } else {
      toast({
        title: "Access Denied",
        description: result.error || "Invalid credentials. Please check your email and password.",
        variant: "destructive",
      });
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
          <p className="text-xs text-muted-foreground font-heading tracking-widest">SECURE_ACCESS_PORTAL</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-heading tracking-wider">EMAIL_ADDRESS</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              placeholder="employee@test.com"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-heading tracking-wider">ACCESS_KEY</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              placeholder="••••••••"
            />
          </div>
          <GlowButton className="w-full" type="submit" disabled={isLoading}>
            Initiate Session
          </GlowButton>
        </form>

        <div className="space-y-2">
          <p className="text-xs text-center text-muted-foreground font-heading tracking-wider">DEMO_CREDENTIALS</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { email: "employee@test.com", role: "Employee" },
              { email: "manager@test.com", role: "Manager" },
              { email: "hr@test.com", role: "HR" },
              { email: "admin@test.com", role: "Admin" },
            ].map((cred) => (
              <button
                key={cred.email}
                type="button"
                onClick={() => { setEmail(cred.email); setPassword("demo"); }}
                className="text-xs p-2 rounded-lg bg-muted/50 border border-border/30 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors text-left"
              >
                <span className="text-primary font-heading">{cred.role}</span>
                <br />
                <span className="text-[10px]">{cred.email}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          PraNaga Solutions © 2026 • Enterprise Systems
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
