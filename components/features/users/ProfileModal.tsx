"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface FormErrors {
  username?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  general?: string;
}

export default function ProfileModal({
  isOpen,
  onClose,
}: ProfileModalProps) {
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    role: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
          setErrors({
            general: data.error || "Failed to load profile.",
          });
          return;
        }

        setFormData({
          username: data.username || "",
          password: "",
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          email: data.email || "",
          role: data.role || "",
        });
      } catch {
        setErrors({
          general: "A server error occurred while loading the profile.",
        });
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: undefined,
      general: undefined,
    }));
  };

  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = "Username is required.";
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters long.";
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required.";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required.";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    return newErrors;
  };

  const handleClose = () => {
    setErrors({});
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
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username: formData.username,
          password: formData.password || undefined,
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({
          general: data.error || "Error updating profile.",
        });
        setLoading(false);
        return;
      }

      setLoading(false);
      onClose();
      router.refresh();
    } catch {
      setErrors({
        general: "A server error occurred.",
      });
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative w-full max-w-md p-6 m-4 rounded-lg shadow-xl bg-[var(--color-surface)] text-[var(--color-foreground)] border border-[var(--color-border)]">
        <h2 className="text-xl font-bold mb-4 text-[var(--color-foreground)]">
          My Profile
        </h2>

        {profileLoading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading profile...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-[var(--color-foreground)]"
              >
                Username *
              </label>
              <input
                id="username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                autoFocus
                className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-md shadow-sm bg-[var(--color-background)] text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
              {errors.username && (
                <p className="text-[var(--color-error)] text-sm mt-1">{errors.username}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--color-foreground)]"
              >
                New Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Leave empty if you do not want to change it"
                className="appearance-none mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-md shadow-sm bg-[var(--color-surface)] text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
              {errors.password && (
                <p className="text-[var(--color-error)] text-sm mt-1">{errors.password}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-[var(--color-foreground)]"
                >
                  First Name *
                </label>
                <input
                  id="firstName"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-md shadow-sm bg-[var(--color-background)] text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                />
                {errors.firstName && (
                  <p className="text-[var(--color-error)] text-sm mt-1">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-[var(--color-foreground)]"
                >
                  Last Name *
                </label>
                <input
                  id="lastName"
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-md shadow-sm bg-[var(--color-background)] text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
                />
                {errors.lastName && (
                  <p className="text-[var(--color-error)] text-sm mt-1">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--color-foreground)]"
              >
                Email *
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-md shadow-sm bg-[var(--color-background)] text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
              {errors.email && (
                <p className="text-[var(--color-error)] text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-[var(--color-foreground)]"
              >
                System Role
              </label>
              <input
                id="role"
                type="text"
                name="role"
                value={formData.role}
                readOnly
                className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-md shadow-sm bg-[var(--color-surface)] text-[var(--color-muted)]"
              />
            </div>

            {errors.general && (
              <p className="text-[var(--color-error)] text-sm">{errors.general}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-md font-medium border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] hover:bg-[var(--color-subtle)] transition-colors"
              >
                Close
              </button>

              <button
                type="submit"
                disabled={loading || profileLoading}
                className="px-4 py-2 rounded-md font-medium bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white disabled:opacity-50 transition-colors"
              >
                {loading ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}