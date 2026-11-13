
import { motion } from "framer-motion";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  clearPendingAuthAction,
  getAuthActionTypeFromLocation,
  type AuthActionType,
} from "@/lib/auth-links";
import { supabase } from "@/lib/supabase";
import "./Login.css";

const MIN_PASSWORD_LENGTH = 8;

const getCurrentAuthAction = (): AuthActionType | null => {
  if (typeof window === "undefined") return null;

  return getAuthActionTypeFromLocation(
    window.location.hash,
    window.location.search
  );
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [authActionType, setAuthActionType] =
    useState<AuthActionType | null>(getCurrentAuthAction);

  const [isPasswordSubmitting, setIsPasswordSubmitting] =
    useState(false);

  const navigate = useNavigate();
  const { login, logout, isLoading } = useAuth();

  // Synchronize authentication links.
  useEffect(() => {
    const syncAuthAction = () => {
      setAuthActionType(getCurrentAuthAction());
    };

    syncAuthAction();

    window.addEventListener("hashchange", syncAuthAction);
    window.addEventListener("popstate", syncAuthAction);

    return () => {
      window.removeEventListener("hashchange", syncAuthAction);
      window.removeEventListener("popstate", syncAuthAction);
    };
  }, []);

  const isPasswordSetupMode =
    authActionType === "invite" ||
    authActionType === "recovery";

  const screenCopy = useMemo(() => {
    if (authActionType === "invite") {
      return {
        title: "Set Your Password",
        description: "Create a secure password for your account.",
        buttonLabel: "Save Password",
      };
    }

    if (authActionType === "recovery") {
      return {
        title: "Reset Your Password",
        description: "Enter and confirm your new password.",
        buttonLabel: "Update Password",
      };
    }

    return {
      title: "Internal Portal",
      description: "Sign in to access your account",
      buttonLabel: "Sign In",
    };
  }, [authActionType]);

  const clearAuthActionFromUrl = () => {
    clearPendingAuthAction();

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    setAuthActionType(null);
  };

  // Login functionality.
  const handleLogin = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const result = await login(email.trim(), password);

    if (result.success) {
      clearPendingAuthAction();
      navigate(useAuth.getState().homePath);
      return;
    }

    toast({
      title: "Login failed",
      description:
        result.error ||
        "Please check your email and password.",
      variant: "destructive",
    });
  };

  // Set or reset password.
  const handlePasswordSetup = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: "Password too short",
        description: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please enter the same password in both fields.",
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
        throw new Error(
          "This password link is invalid or expired. Please request a new email."
        );
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      const sessionEmail = session.user.email ?? "";
      const completedAction = authActionType;

      clearAuthActionFromUrl();
      await logout();

      setEmail(sessionEmail);
      setPassword("");
      setConfirmPassword("");

      toast({
        title:
          completedAction === "invite"
            ? "Password saved"
            : "Password updated",
        description:
          "Your password has been saved. Please sign in with your email and password.",
      });

      navigate("/login", { replace: true });
    } catch (error) {
      toast({
        title: "Unable to update password",
        description:
          error instanceof Error
            ? error.message
            : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  // Forgot password.
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address first.",
        variant: "destructive",
      });
      return;
    }

    setIsPasswordSubmitting(true);

    try {
      const redirectTo =
        `${window.location.origin}/login?auth_action=recovery`;

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo }
        );

      if (error) throw error;

      toast({
        title: "Password reset email requested",
        description: "Check your email for a password reset link.",
      });
    } catch (error) {
      toast({
        title: "Password reset failed",
        description:
          error instanceof Error
            ? error.message
            : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center bg-white px-4 py-8 font-body sm:px-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[430px]"
      >
        {/* INTERNAL PORTAL HEADING */}
        <h1
          className="mb-8 text-center font-heading text-[32px] font-bold leading-tight tracking-tight text-black sm:text-[38px]"
        >
          {screenCopy.title}
        </h1>

        {/* Login Card */}
        <div className="rounded-2xl border border-[#D9D9D9] bg-white px-6 py-8 shadow-[0_8px_30px_rgba(31,41,55,0.08)] sm:px-9 sm:py-9">

          <p className="mb-8 text-center text-sm font-normal text-[#52647D] sm:text-base">
            {screenCopy.description}
          </p>

          {isPasswordSetupMode ? (
            <form
              onSubmit={handlePasswordSetup}
              className="space-y-6"
            >
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-2 block text-sm font-medium text-black"
                >
                  New Password
                </label>

                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                    className="login-field h-[50px] w-full rounded-lg border border-[#D9D9D9] bg-white px-4 pr-12 text-sm text-[#333] outline-none transition placeholder:text-[#858B96] focus:border-[#E87532] focus:ring-2 focus:ring-[#E87532]/15"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#858B96] transition hover:text-[#E87532]"
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block text-sm font-medium text-black"
                >
                  Confirm Password
                </label>

                <div className="relative">
                  <input
                    id="confirm-password"
                    type={
                      showConfirmPassword ? "text" : "password"
                    }
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                    className="login-field h-[50px] w-full rounded-lg border border-[#D9D9D9] bg-white px-4 pr-12 text-sm text-[#333] outline-none transition placeholder:text-[#858B96] focus:border-[#E87532] focus:ring-2 focus:ring-[#E87532]/15"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    aria-label={
                      showConfirmPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#858B96] transition hover:text-[#E87532]"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPasswordSubmitting || isLoading}
                className="flex h-[50px] w-full items-center justify-center rounded-lg bg-[#FF4500] text-sm font-semibold text-white transition hover:bg-[#FF8A00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPasswordSubmitting
                  ? "Saving..."
                  : screenCopy.buttonLabel}
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleLogin}
              className="space-y-6"
            >
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-black"
                >
                  Email Address
                </label>

                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="Enter your email"
                    autoComplete="email"
                    required
                    className="login-field h-[50px] w-full rounded-lg border border-[#D9D9D9] bg-white py-3 pl-4 pr-12 text-sm text-[#333] outline-none transition placeholder:text-[#858B96] focus:border-[#E87532] focus:ring-2 focus:ring-[#E87532]/15"
                  />

                  <Mail
                    size={19}
                    strokeWidth={1.8}
                    aria-hidden="true"
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#858B96]"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-black"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="login-field h-[50px] w-full rounded-lg border border-[#D9D9D9] bg-white py-3 pl-4 pr-12 text-sm text-[#333] outline-none transition placeholder:text-[#858B96] focus:border-[#E87532] focus:ring-2 focus:ring-[#E87532]/15"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#858B96] transition hover:text-[#E87532]"
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <LockKeyhole size={19} />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me and Sign In */}
              <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[#626873]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) =>
                      setRememberMe(event.target.checked)
                    }
                    className="h-4 w-4 cursor-pointer accent-[#E87532]"
                  />
                  Remember Me
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-[46px] w-full items-center justify-center rounded-lg bg-[#ff9100] px-8 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-[#ff9100] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[130px]"
                >
                  {isLoading
                    ? "Signing in..."
                    : screenCopy.buttonLabel}
                </button>
              </div>

              {/* Forgot Password */}
              <div className="border-t border-[#D9D9D9] pt-5">
                <button
                  type="button"
                  onClick={() => void handleForgotPassword()}
                  disabled={isPasswordSubmitting}
                  className="text-sm font-medium text-black transition hover:text-black hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Forgot your password?
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs font-normal tracking-wide text-[#858B96] sm:text-sm">
          HRMS Employee Management System
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
