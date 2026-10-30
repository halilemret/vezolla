"use client";

import * as React from "react";
import { Sparkle, ArrowClockwise } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const COUPON_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateClientCouponCode(prefix = "VZ"): string {
  const chars: string[] = [];
  const array = new Uint8Array(8);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(array);
    for (let i = 0; i < 8; i++) {
      const val = array[i] ?? 0;
      chars.push(COUPON_CHARSET[val % COUPON_CHARSET.length] ?? "X");
    }
  } else {
    for (let i = 0; i < 8; i++) {
      const rnd = Math.floor(Math.random() * COUPON_CHARSET.length);
      chars.push(COUPON_CHARSET[rnd] ?? "X");
    }
  }
  return `${prefix}-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}`;
}

interface CodeGeneratorFieldProps {
  id?: string;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  prefix?: string;
}

export function CodeGeneratorField({
  id = "code",
  name = "code",
  defaultValue = "",
  placeholder = "Örn: BAHAR15 (Boşsa Otomatik)",
  prefix = "VZ",
}: CodeGeneratorFieldProps) {
  const [value, setValue] = React.useState(defaultValue);

  function handleGenerate() {
    const newCode = generateClientCouponCode(prefix);
    setValue(newCode);
  }

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        placeholder={placeholder}
        className="font-mono uppercase"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleGenerate}
        title="Rastgele benzersiz kod üret"
        className="shrink-0 gap-1.5 text-xs text-zinc-700 hover:text-zinc-950"
      >
        <Sparkle className="h-3.5 w-3.5 text-amber-600" weight="fill" />
        <span>Rastgele Üret</span>
      </Button>
    </div>
  );
}
