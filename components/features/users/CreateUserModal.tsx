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

export default function CreateUserModal({ isOpen, onClose }: CreateUserModalProps) {
  const [formData, setFormData] = useState<FormData>({
    username: "", password: "", firstName: "", lastName: "", email: "", systemRole: "user",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [revealIndex, setRevealIndex] = useState<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
    if (!formData.username.trim())             e.username  = "Username is required.";
    if (!formData.password.trim())             e.password  = "Password is required.";
    else if (formData.password.length < 6)     e.password  = "Password must be at least 6 characters.";
    if (!formData.firstName.trim())            e.firstName = "First name is required.";
    if (!formData.lastName.trim())             e.lastName  = "Last name is required.";
    if (!formData.email.trim())                e.email     = "Email is required.";
    else if (!emailRegex.test(formData.email)) e.email     = "Enter a valid email address.";
    return e;
  };

  const resetForm = () => {
    setFormData({ username: "", password: "", firstName: "", lastName: "", email: "", systemRole: "user" });
    setErrors({});
    setRevealIndex(null);
  };

  const handleClose = () => { resetForm(); onClose(); };

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
      hasError ? "border-error-border focus:ring-error/20 focus:border-error" : "border-border"
    }`;

  const labelClass = "block text-xs font-semibold tracking-widest uppercase text-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm bg-foreground/20" onClick={handleClose} />

      <div className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl bg-surface">
        <div className="h-1 w-full bg-gradient-to-r from-primary to-accent" />

        <div className="p-7">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-0.5">Admin</p>
              <h2 className="text-2xl font-bold text-foreground leading-tight">Add user</h2>
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
              <label className={labelClass}>Username <span className="text-error normal-case font-normal tracking-normal">*</span></label>
              <input
                type="text" name="username"
                value={formData.username} onChange={handleChange}
                autoFocus placeholder="e.g. janez123"
                className={inputClass(!!errors.username)}
              />
              {errors.username && <p className="text-xs text-error mt-1">{errors.username}</p>}
            </div>

            {/* Password */}
            <div>
              <label className={labelClass}>Password <span className="text-error normal-case font-normal tracking-normal">*</span></label>
              <input
                type="password" name="password"
                value={formData.password} onChange={handleChange}
                placeholder="At least 6 characters"
                className={inputClass(!!errors.password)}
              />
              {errors.password && <p className="text-xs text-error mt-1">{errors.password}</p>}
            </div>

            {/* First + Last name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>First name <span className="text-error normal-case font-normal tracking-normal">*</span></label>
                <input
                  type="text" name="firstName"
                  value={formData.firstName} onChange={handleChange}
                  placeholder="John"
                  className={inputClass(!!errors.firstName)}
                />
                {errors.firstName && <p className="text-xs text-error mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className={labelClass}>Last name <span className="text-error normal-case font-normal tracking-normal">*</span></label>
                <input
                  type="text" name="lastName"
                  value={formData.lastName} onChange={handleChange}
                  placeholder="Doe"
                  className={inputClass(!!errors.lastName)}
                />
                {errors.lastName && <p className="text-xs text-error mt-1">{errors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className={labelClass}>Email <span className="text-error normal-case font-normal tracking-normal">*</span></label>
              <input
                type="email" name="email"
                value={formData.email} onChange={handleChange}
                placeholder="john.doe@email.com"
                className={inputClass(!!errors.email)}
              />
              {errors.email && <p className="text-xs text-error mt-1">{errors.email}</p>}
            </div>

            {/* System Role */}
            <div>
              <label className={labelClass}>System role <span className="text-error normal-case font-normal tracking-normal">*</span></label>
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
                <svg className="w-4 h-4 text-error mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-error">{errors.general}</p>
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-border pt-4 flex justify-end gap-3">
              <button
                type="button" onClick={handleClose}
                className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors bg-background hover:bg-border text-muted"
              >
                Cancel
              </button>
              <button
                type="submit" disabled={loading}
                className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 bg-primary hover:bg-primary-hover"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving...
                  </span>
                ) : "Add user →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
