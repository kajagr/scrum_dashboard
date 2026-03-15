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
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    email: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [revealIndex, setRevealIndex] = useState<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!formData.username.trim()) e.username = "Uporabniško ime je obvezno.";
    if (!formData.password.trim()) e.password = "Geslo je obvezno.";
    else if (formData.password.length < 6)
      e.password = "Geslo mora imeti vsaj 12 znakov.";
    if (!formData.firstName.trim()) e.firstName = "Ime je obvezno.";
    if (!formData.lastName.trim()) e.lastName = "Priimek je obvezen.";
    if (!formData.email.trim()) e.email = "E-pošta je obvezna.";
    else if (!emailRegex.test(formData.email))
      e.email = "Vnesi veljaven e-poštni naslov.";
    return e;
  };

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      email: "",
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({
          general: data.error || "Napaka pri ustvarjanju uporabnika.",
        });
        setLoading(false);
        return;
      }
      resetForm();
      setLoading(false);
      onClose();
      router.refresh();
    } catch {
      setErrors({ general: "Prišlo je do napake na strežniku." });
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass =
    "mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)]";
  const labelClass = "block text-sm font-medium text-[var(--color-foreground)]";
  const errorClass = "text-xs mt-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div
        className="relative m-4 w-full max-w-md overflow-hidden rounded-xl shadow-2xl"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-foreground)",
        }}
      >
        <div
          className="p-6"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <h2 className="text-xl font-bold">Dodaj uporabnika</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Username */}
          <div>
            <label className={labelClass}>Uporabniško ime *</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              autoFocus
              placeholder="npr. janez123"
              className={inputClass}
            />
            {errors.username && (
              <p className={errorClass} style={{ color: "var(--color-error)" }}>
                {errors.username}
              </p>
            )}
          </div>

          {/* Password z eye ikono + reveal */}
          <div>
            <label className={labelClass}>Geslo *</label>
            <div className="relative">
              {!showPassword && formData.password.length > 0 && (
                <div
                  className="absolute inset-0 flex items-center pl-3 pr-10 text-sm pointer-events-none select-none rounded-lg overflow-hidden"
                  style={{ color: "var(--color-foreground)" }}
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
                placeholder="Vsaj 6 znakov"
                className={`${inputClass} pr-10`}
                style={
                  !showPassword
                    ? { color: "transparent", caretColor: "transparent" }
                    : {}
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "var(--color-muted)" }}
              >
                <EyeIcon show={showPassword} />
              </button>
            </div>
            {errors.password && (
              <p className={errorClass} style={{ color: "var(--color-error)" }}>
                {errors.password}
              </p>
            )}
          </div>

          {/* Ime + Priimek */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ime *</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Janez"
                className={inputClass}
              />
              {errors.firstName && (
                <p
                  className={errorClass}
                  style={{ color: "var(--color-error)" }}
                >
                  {errors.firstName}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Priimek *</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Novak"
                className={inputClass}
              />
              {errors.lastName && (
                <p
                  className={errorClass}
                  style={{ color: "var(--color-error)" }}
                >
                  {errors.lastName}
                </p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={labelClass}>E-pošta *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="janez.novak@email.com"
              className={inputClass}
            />
            {errors.email && (
              <p className={errorClass} style={{ color: "var(--color-error)" }}>
                {errors.email}
              </p>
            )}
          </div>

          {errors.general && (
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--color-error-light)",
                border: "1px solid var(--color-error-border)",
                color: "var(--color-error)",
              }}
            >
              {errors.general}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-80"
              style={{
                background: "var(--color-background)",
                color: "var(--color-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              Prekliči
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 hover:opacity-90"
              style={{ background: "var(--color-primary)" }}
            >
              {loading ? "Shranjujem..." : "Dodaj uporabnika"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
