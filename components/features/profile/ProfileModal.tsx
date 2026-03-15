"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ChangePasswordModal from "@/components/features/profile/ChangepasswordModal";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface FormErrors {
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  general?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const labelClass =
  "block text-xs font-semibold tracking-widest uppercase text-primary mb-1";
const inputClass = (hasError?: boolean) =>
  `block w-full px-3 py-2.5 rounded-lg text-sm transition-all bg-background border text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
    hasError
      ? "border-error-border focus:ring-error/20 focus:border-error"
      : "border-border"
  }`;

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const router = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState<FormData>({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    role: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaStep, setMfaStep] = useState<
    "idle" | "enroll" | "verify" | "unenroll"
  >("idle");
  const [mfaQR, setMfaQR] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaEnrollId, setMfaEnrollId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchProfile = async () => {
      setProfileLoading(true);
      setErrors({});
      try {
        const res = await fetch("/api/users/profile", {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          setErrors({ general: data.error || "Error loading profile." });
          return;
        }
        setFormData({
          username: data.username || "",
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          email: data.email || "",
          role: data.system_role || data.role || "",
        });
      } catch {
        setErrors({ general: "Server error." });
      } finally {
        setProfileLoading(false);
      }
    };

    const checkMfa = async () => {
      // Sync session iz cookijev da client ve za prijavo
      await supabase.auth.getSession();
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (verified) {
        setMfaEnabled(true);
        setMfaFactorId(verified.id);
      } else {
        setMfaEnabled(false);
        setMfaFactorId(null);
      }
    };

    fetchProfile();
    checkMfa();
  }, [isOpen]);

  // Začni enrollment — pridobi QR kodo
  const handleEnroll = async () => {
    setMfaLoading(true);
    setMfaError(null);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
    });
    if (error || !data) {
      setMfaError("Error starting 2FA setup.");
      setMfaLoading(false);
      return;
    }
    setMfaQR(data.totp.qr_code);
    setMfaSecret(data.totp.secret);
    setMfaEnrollId(data.id);
    setMfaStep("verify");
    setMfaLoading(false);
  };

  // Potrdi enrollment z TOTP kodo
  const handleVerifyEnroll = async () => {
    if (!mfaEnrollId) return;
    setMfaLoading(true);
    setMfaError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaEnrollId,
      code: mfaCode,
    });
    if (error) {
      setMfaError("Incorrect code. Please try again.");
      setMfaLoading(false);
      return;
    }
    setMfaEnabled(true);
    setMfaFactorId(mfaEnrollId);
    setMfaStep("idle");
    setMfaCode("");
    setMfaQR(null);
    setMfaLoading(false);
  };

  // Izklopi 2FA
  const handleUnenroll = async () => {
    if (!mfaFactorId) return;
    setMfaLoading(true);
    setMfaError(null);
    const { error } = await supabase.auth.mfa.unenroll({
      factorId: mfaFactorId,
    });
    if (error) {
      setMfaError("Error disabling 2FA.");
      setMfaLoading(false);
      return;
    }
    setMfaEnabled(false);
    setMfaFactorId(null);
    setMfaStep("idle");
    setMfaCode("");
    setMfaLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
  };

  const validate = (): FormErrors => {
    const e: FormErrors = {};
    if (!formData.username.trim()) e.username = "Username is required.";
    if (!formData.firstName.trim()) e.firstName = "First name is required.";
    if (!formData.lastName.trim()) e.lastName = "Last name is required.";
    if (!formData.email.trim()) e.email = "Email is required.";
    else if (!emailRegex.test(formData.email))
      e.email = "Enter a valid email address.";
    return e;
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: formData.username,
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ general: data.error || "Error saving changes." });
        setLoading(false);
        return;
      }
      setLoading(false);
      onClose();
      router.refresh();
    } catch {
      setErrors({ general: "Server error." });
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const roleLabel: Record<string, string> = {
    admin: "Admin",
    user: "User",
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 backdrop-blur-sm bg-foreground/30"
          onClick={handleClose}
        />

        <div className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface">
          <div className="h-1 w-full bg-gradient-to-r from-primary to-accent" />

          <div className="p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-0.5">
                  Account
                </p>
                <h2 className="text-2xl font-bold text-foreground">
                  My Profile
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg transition-colors bg-background hover:bg-border text-muted"
              >
                ×
              </button>
            </div>

            {profileLoading ? (
              <div className="flex items-center gap-2 py-8 text-subtle">
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
                <span className="text-sm">Loading profile...</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Avatar + role */}
                <div className="flex items-center gap-6 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-primary-light border border-primary-border flex items-center justify-center text-lg font-bold text-primary flex-shrink-0">
                    {formData.firstName?.[0]}
                    {formData.lastName?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {formData.firstName} {formData.lastName}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border mt-0.5 ${
                        formData.role === "admin"
                          ? "bg-accent-light text-accent-text border-accent-border"
                          : "bg-surface text-muted border-border"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${formData.role === "admin" ? "bg-accent" : "bg-subtle"}`}
                      />
                      {roleLabel[formData.role] ?? formData.role}
                    </span>
                  </div>
                </div>

                {/* Username */}
                <div className="mt-5">
                  <label className={labelClass}>
                    Username{" "}
                    <span className="text-error normal-case font-normal tracking-normal">
                      *
                    </span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    autoFocus
                    className={inputClass(!!errors.username)}
                  />
                  {errors.username && (
                    <p className="text-xs text-error mt-1">{errors.username}</p>
                  )}
                </div>

                {/* First + Last name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>
                      First name{" "}
                      <span className="text-error normal-case font-normal tracking-normal">
                        *
                      </span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className={inputClass(!!errors.firstName)}
                    />
                    {errors.firstName && (
                      <p className="text-xs text-error mt-1">
                        {errors.firstName}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>
                      Last name{" "}
                      <span className="text-error normal-case font-normal tracking-normal">
                        *
                      </span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className={inputClass(!!errors.lastName)}
                    />
                    {errors.lastName && (
                      <p className="text-xs text-error mt-1">
                        {errors.lastName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className={labelClass}>
                    Email{" "}
                    <span className="text-error normal-case font-normal tracking-normal">
                      *
                    </span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={inputClass(!!errors.email)}
                  />
                  {errors.email && (
                    <p className="text-xs text-error mt-1">{errors.email}</p>
                  )}
                </div>

                {/* Change password */}
                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-background border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Password
                    </p>
                    <p className="text-xs text-subtle">••••••••••••</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChangePasswordOpen(true)}
                    className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors flex items-center gap-1"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                      />
                    </svg>
                    Change password
                  </button>
                </div>

                {/* ✅ 2FA sekcija */}
                <div className="rounded-xl bg-background border border-border overflow-hidden">
                  <div className="flex items-center justify-between py-2 px-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Two-factor authentication
                      </p>
                      <p className="text-xs text-subtle">
                        {mfaEnabled ? "2FA is enabled" : "2FA is disabled"}
                      </p>
                    </div>
                    {mfaEnabled ? (
                      <button
                        type="button"
                        onClick={() => setMfaStep("unenroll")}
                        className="text-xs font-semibold transition-colors flex items-center gap-1"
                        style={{ color: "#EF4444" }}
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMfaStep("enroll");
                          handleEnroll();
                        }}
                        className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors flex items-center gap-1"
                      >
                        Enable
                      </button>
                    )}
                  </div>

                  {/* Enroll — QR koda */}
                  {mfaStep === "verify" && mfaQR && (
                    <div className="px-3 pb-4 border-t border-border pt-3 space-y-3">
                      <p className="text-xs text-muted">
                        Scan this QR code with Google Authenticator or Authy:
                      </p>
                      <div className="flex justify-center">
                        <img
                          src={mfaQR}
                          alt="QR code"
                          className="w-40 h-40 rounded-lg"
                        />
                      </div>
                      {mfaSecret && (
                        <p className="text-xs text-center text-muted">
                          Or enter manually:{" "}
                          <span className="font-mono text-foreground">
                            {mfaSecret}
                          </span>
                        </p>
                      )}
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(e) =>
                          setMfaCode(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="Enter 6-digit code"
                        autoFocus
                        className="block w-full px-3 py-2 rounded-lg text-sm text-center tracking-widest bg-background border border-border text-foreground outline-none focus:border-primary"
                      />
                      {mfaError && (
                        <p className="text-xs text-error">{mfaError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMfaStep("idle");
                            setMfaCode("");
                            setMfaQR(null);
                          }}
                          className="flex-1 py-2 text-xs rounded-lg bg-surface border border-border text-muted"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleVerifyEnroll}
                          disabled={mfaLoading || mfaCode.length !== 6}
                          className="flex-1 py-2 text-xs rounded-lg text-white disabled:opacity-50 bg-primary"
                        >
                          {mfaLoading ? "Verifying..." : "Activate 2FA"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Unenroll potrditev */}
                  {mfaStep === "unenroll" && (
                    <div className="px-3 pb-4 border-t border-border pt-3 space-y-3">
                      <p className="text-xs text-muted">
                        Are you sure you want to disable two-factor
                        authentication?
                      </p>
                      {mfaError && (
                        <p className="text-xs text-error">{mfaError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setMfaStep("idle")}
                          className="flex-1 py-2 text-xs rounded-lg bg-surface border border-border text-muted"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleUnenroll}
                          disabled={mfaLoading}
                          className="flex-1 py-2 text-xs rounded-lg text-white disabled:opacity-50"
                          style={{ background: "#EF4444" }}
                        >
                          {mfaLoading ? "Disabling..." : "Disable 2FA"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Loading za enroll */}
                  {mfaStep === "enroll" && mfaLoading && (
                    <div className="px-3 pb-3 border-t border-border pt-3 flex items-center gap-2 text-muted">
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
                      <span className="text-xs">Generating QR code...</span>
                    </div>
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
                    Close
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
                      "Save changes"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}
