"use client";

import * as React from "react";
import {
  type SupportedCurrency,
  SUPPORTED_CURRENCIES,
  CURRENCY_SYMBOLS,
} from "@/lib/currency";
import { setCurrencyCookieAction } from "./currency-actions";

export interface CurrencySwitcherProps {
  initialCurrency?: SupportedCurrency;
}

export function CurrencySwitcher({
  initialCurrency = "TRY",
}: CurrencySwitcherProps) {
  const [current, setCurrent] = React.useState<SupportedCurrency>(initialCurrency);
  const [isPending, startTransition] = React.useTransition();

  function handleChange(currency: SupportedCurrency) {
    if (currency === current || isPending) return;
    setCurrent(currency);
    startTransition(async () => {
      await setCurrencyCookieAction(currency);
    });
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs">
      {SUPPORTED_CURRENCIES.map((cur) => {
        const isActive = current === cur;
        return (
          <button
            key={cur}
            type="button"
            disabled={isPending}
            onClick={() => handleChange(cur)}
            className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold transition-all ${
              isActive
                ? "bg-[var(--ink)] text-[var(--surface)] shadow-2xs"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
            title={`${cur} (${CURRENCY_SYMBOLS[cur]})`}
            aria-label={`Para birimini ${cur} yap`}
          >
            {CURRENCY_SYMBOLS[cur]} {cur}
          </button>
        );
      })}
    </div>
  );
}
