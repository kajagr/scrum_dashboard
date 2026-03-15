"use client";

import { useState, useEffect, useRef } from "react";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FieldErrors {
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  general?: string;
}

// Ocena moči gesla
function getPasswordStrength(
  password: string,
  commonPasswords: Set<string>,
): {
  score: number;
  label: string;
  color: string;
} {
  if (password.length === 0) return { score: 0, label: "", color: "" };

  const isCommon = commonPasswords.has(password.toLowerCase());
  if (isCommon) return { score: 1, label: "Too common", color: "#EF4444" };

  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (password.length >= 20) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 2, label: "Weak", color: "#EF4444" };
  if (score <= 3) return { score: 3, label: "Fair", color: "#F59E0B" };
  if (score <= 4) return { score: 4, label: "Good", color: "#3B82F6" };
  if (score <= 5) return { score: 5, label: "Strong", color: "#10B981" };
  return { score: 6, label: "Very strong", color: "#10B981" };
}

export default function ChangePasswordModal({
  isOpen,
  onClose,
}: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [commonPasswords, setCommonPasswords] = useState<Set<string>>(
    new Set(),
  );

  const [revealIndexNew, setRevealIndexNew] = useState<number | null>(null);
  const [revealIndexConfirm, setRevealIndexConfirm] = useState<number | null>(
    null,
  );
  const revealTimerNew = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerConfirm = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/common-passwords.txt")
      .then((r) => r.text())
      .then((text) => {
        const list = text
          .split("\n")
          .map((p) => p.trim().toLowerCase())
          .filter(Boolean);
        setCommonPasswords(new Set(list));
      })
      .catch(() => {
        /* če datoteka ne obstaja, nadaljuj brez */
      });
  }, []);

  const strength = getPasswordStrength(newPassword, commonPasswords);

  const handleClose = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setErrors({});
    setSuccess(false);
    onClose();
  };

  // Prepreči kopiranje/rezanje gesla
  const preventCopy = (e: React.ClipboardEvent) => e.preventDefault();

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!oldPassword) e.oldPassword = "Current password is required.";
    if (!newPassword) e.newPassword = "New password is required.";
    else if (newPassword.length < 12)
      e.newPassword = "Password must be at least 12 characters.";
    else if (newPassword.length > 64)
      e.newPassword = "Password cannot be longer than 64 characters.";
    else {
      const isCommon = commonPasswords.has(newPassword.toLowerCase());
      if (isCommon)
        e.newPassword =
          "This password is too common. Please choose a stronger one.";
    }
    if (!confirmPassword)
      e.confirmPassword = "Please confirm your new password.";
    else if (confirmPassword !== newPassword)
      e.confirmPassword = "Passwords do not match.";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401)
          setErrors({ oldPassword: "Incorrect current password." });
        else setErrors({ general: data.error || "Error changing password." });
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
      setTimeout(() => handleClose(), 1500);
    } catch {
      setErrors({ general: "Server error." });
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = (hasError: boolean) =>
    `block w-full pl-3 pr-10 py-2.5 rounded-lg text-sm transition-all bg-background border text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
      hasError
        ? "border-error-border focus:ring-error/20 focus:border-error"
        : "border-border"
    }`;

  const EyeIcon = ({ show }: { show: boolean }) => (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      {show ? (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
          />
        </>
      ) : (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </>
      )}
    </svg>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 backdrop-blur-sm bg-foreground/30"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface">
        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent" />

        <div className="p-7">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-0.5">
                Security
              </p>
              <h2 className="text-2xl font-bold text-foreground">
                Change Password
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-lg transition-colors bg-background hover:bg-border text-muted"
            >
              ×
            </button>
          </div>

          {success ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-primary-light border border-primary-border flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-foreground">
                Password changed successfully!
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Old password */}
              <div>
                <label className="block text-xs font-semibold tracking-widest uppercase text-primary mb-1">
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={showOld ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => {
                      setOldPassword(e.target.value);
                      setErrors((p) => ({ ...p, oldPassword: undefined }));
                    }}
                    autoFocus
                    placeholder="Enter current password"
                    className={inputClass(!!errors.oldPassword)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-muted transition-colors"
                  >
                    <EyeIcon show={showOld} />
                  </button>
                </div>
                {errors.oldPassword && (
                  <p className="text-xs text-error mt-1">
                    {errors.oldPassword}
                  </p>
                )}
              </div>

              {/* New password */}
              <div>
                <label className="block text-xs font-semibold tracking-widest uppercase text-primary mb-1">
                  New password
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={
                      showNew
                        ? newPassword
                        : newPassword
                            .split("")
                            .map((char, i) =>
                              i === revealIndexNew ? char : "•",
                            )
                            .join("")
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      let realValue: string;
                      if (showNew) {
                        realValue = val;
                      } else {
                        if (val.length > newPassword.length) {
                          realValue =
                            newPassword + val.slice(newPassword.length);
                        } else {
                          realValue = newPassword.slice(0, val.length);
                        }
                      }
                      setNewPassword(realValue);
                      setErrors((p) => ({
                        ...p,
                        newPassword: undefined,
                        confirmPassword: undefined,
                      }));
                      if (!showNew && realValue.length > 0) {
                        setRevealIndexNew(realValue.length - 1);
                        if (revealTimerNew.current)
                          clearTimeout(revealTimerNew.current);
                        revealTimerNew.current = setTimeout(
                          () => setRevealIndexNew(null),
                          1000,
                        );
                      } else {
                        setRevealIndexNew(null);
                      }
                    }}
                    onCopy={preventCopy}
                    onCut={preventCopy}
                    placeholder="At least 12 characters"
                    className={inputClass(!!errors.newPassword)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-muted transition-colors"
                  >
                    <EyeIcon show={showNew} />
                  </button>
                </div>

                {errors.newPassword && (
                  <p className="text-xs text-error mt-1">
                    {errors.newPassword}
                  </p>
                )}

                {/*  Password meter */}
                {newPassword.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                          key={i}
                          className="h-1 flex-1 rounded-full transition-all"
                          style={{
                            background:
                              i <= strength.score
                                ? strength.color
                                : "var(--color-border)",
                          }}
                        />
                      ))}
                    </div>
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: strength.color }}
                    >
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-xs font-semibold tracking-widest uppercase text-primary mb-1">
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={
                      showConfirm
                        ? confirmPassword
                        : confirmPassword
                            .split("")
                            .map((char, i) =>
                              i === revealIndexConfirm ? char : "•",
                            )
                            .join("")
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      let realValue: string;
                      if (showConfirm) {
                        realValue = val;
                      } else {
                        if (val.length > confirmPassword.length) {
                          realValue =
                            confirmPassword + val.slice(confirmPassword.length);
                        } else {
                          realValue = confirmPassword.slice(0, val.length);
                        }
                      }
                      setConfirmPassword(realValue);
                      setErrors((p) => ({ ...p, confirmPassword: undefined }));
                      if (!showConfirm && realValue.length > 0) {
                        setRevealIndexConfirm(realValue.length - 1);
                        if (revealTimerConfirm.current)
                          clearTimeout(revealTimerConfirm.current);
                        revealTimerConfirm.current = setTimeout(
                          () => setRevealIndexConfirm(null),
                          1000,
                        );
                      } else {
                        setRevealIndexConfirm(null);
                      }
                    }}
                    onCopy={preventCopy}
                    onCut={preventCopy}
                    placeholder="Repeat new password"
                    className={inputClass(!!errors.confirmPassword)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-muted transition-colors"
                  >
                    <EyeIcon show={showConfirm} />
                  </button>
                </div>

                {errors.confirmPassword && (
                  <p className="text-xs text-error mt-1">
                    {errors.confirmPassword}
                  </p>
                )}
                {confirmPassword &&
                  !errors.confirmPassword &&
                  confirmPassword === newPassword && (
                    <p className="text-xs text-primary mt-1 flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Passwords match
                    </p>
                  )}
              </div>

              {errors.general && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-error-border bg-error-light">
                  <svg
                    className="w-4 h-4 text-error mt-0.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                  <p className="text-sm text-error">{errors.general}</p>
                </div>
              )}

              <div className="border-t border-border pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors bg-background hover:bg-border text-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 bg-primary hover:bg-primary-hover"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    "Save password"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
