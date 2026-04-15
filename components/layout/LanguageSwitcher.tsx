"use client";

import { useLocale } from "@/contexts/LocaleContext";
import { useTranslations } from "next-intl";

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const t = useTranslations("navbar");

  const toggle = () => setLocale(locale === "en" ? "sl" : "en");

  return (
    <button
      onClick={toggle}
      title={locale === "en" ? t("switchToSlovenian") : t("switchToEnglish")}
      className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-primary-light)] hover:border-[var(--color-primary-border)] transition-colors text-[var(--color-muted)] hover:text-[var(--color-primary)] text-xs font-semibold"
    >
      {locale === "en" ? "SL" : "EN"}
    </button>
  );
}
