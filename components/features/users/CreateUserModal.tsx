"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
  systemRole: "user" | "admin";
}

interface FormErrors {
  username?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  general?: string;
}

const EyeIcon = ({ show }: { show: boolean }) => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    {show ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
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

export default function CreateUserModal({
  isOpen,
  onClose,
}: CreateUserModalProps) {
  const [formData, setFormData] = useState<FormData>({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    systemRole: "user",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [revealIndex, setRevealIndex] = useState<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, password: val }));
    setErrors((prev) => ({ ...prev, password: undefined, general: undefined }));
    if (!showPassword && val.length > 0) {
      setRevealIndex(val.length - 1);
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => setRevealIndex(null), 1000);
    } else {
      setRevealIndex(null);
    }
  };

  const validateForm = (): FormErrors => {
    const e: FormErrors = {};
    if (!formData.username.trim()) e.username = "Username is required.";
    if (!formData.password.trim()) e.password = "Password is required.";
    else if (formData.password.length < 12)
      e.password = "Password must be at least 12 characters.";
    else if (formData.password.length > 64)
      e.password = "Password must be less than 65 characters.";
    if (!formData.firstName.trim()) e.firstName = "First name is required.";
    if (!formData.lastName.trim()) e.lastName = "Last name is required.";
    if (!formData.email.trim()) e.email = "Email is required.";
    else if (!emailRegex.test(formData.email))
      e.email = "Enter a valid email address.";
    return e;
  };

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      email: "",
      systemRole: "user",
    });
    setErrors({});
    setRevealIndex(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          system_role: formData.systemRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({
          general: data.error || "Error creating user.",
        });
        setLoading(false);
        return;
      }
      resetForm();
      onClose();
    } catch {
      setErrors({ general: "A server error occurred." });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = (hasError: boolean) =>
    `mt-1 block w-full px-3 py-2.5 rounded-lg text-sm transition-all bg-background border text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
      hasError
        ? "border-error-border focus:ring-error/20 focus:border-error"
        : "border-border"
    }`;

  const labelClass =
    "block text-xs font-semibold tracking-widest uppercase text-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 backdrop-blur-sm bg-foreground/20"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface">
        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent" />

        <div className="p-7">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-0.5">
                Admin
              </p>
              <h2 className="text-2xl font-bold text-foreground leading-tight">
                Add user
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none transition-colors bg-background hover:bg-border text-muted"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
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
                placeholder="e.g. janez123"
                className={inputClass(!!errors.username)}
              />
              {errors.username && (
                <p className="text-xs text-error mt-1">{errors.username}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className={labelClass}>
                Password{" "}
                <span className="text-error normal-case font-normal tracking-normal">
                  *
                </span>
              </label>
              <div className="relative">
                {/* Overlay — reveal zadnjega znaka za 1s */}
                {!showPassword && formData.password.length > 0 && (
                  <div
                    className="absolute inset-0 flex items-center pl-3 pr-10 text-sm pointer-events-none select-none rounded-lg overflow-hidden"
                    style={{
                      color: "var(--color-foreground)",
                      marginTop: "4px",
                    }}
                  >
                    {formData.password
                      .split("")
                      .map((char, i) => (i === revealIndex ? char : "•"))}
                  </div>
                )}
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handlePasswordChange}
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  placeholder="At least 12 characters"
                  className={`${inputClass(!!errors.password)} pr-10`}
                  style={
                    !showPassword
                      ? { color: "transparent", caretColor: "transparent" }
                      : {}
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-muted transition-colors"
                  style={{ marginTop: "2px" }}
                >
                  <EyeIcon show={showPassword} />
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-error mt-1">{errors.password}</p>
              )}
            </div>

            {/* First + Last name */}
            <div className="grid grid-cols-2 gap-4">
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
                  placeholder="John"
                  className={inputClass(!!errors.firstName)}
                />
                {errors.firstName && (
                  <p className="text-xs text-error mt-1">{errors.firstName}</p>
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
                  placeholder="Doe"
                  className={inputClass(!!errors.lastName)}
                />
                {errors.lastName && (
                  <p className="text-xs text-error mt-1">{errors.lastName}</p>
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
                placeholder="john.doe@email.com"
                className={inputClass(!!errors.email)}
              />
              {errors.email && (
                <p className="text-xs text-error mt-1">{errors.email}</p>
              )}
            </div>

            {/* System Role */}
            <div>
              <label className={labelClass}>
                System role{" "}
                <span className="text-error normal-case font-normal tracking-normal">
                  *
                </span>
              </label>
              <select
                name="systemRole"
                value={formData.systemRole}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2.5 rounded-lg text-sm transition-all bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* General error */}
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

            {/* Actions */}
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
                  "Add user →"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
