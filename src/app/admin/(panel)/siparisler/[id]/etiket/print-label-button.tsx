"use client";

import { Printer } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function PrintLabelButton() {
  return (
    <Button type="button" variant="primary" size="sm" onClick={() => window.print()}>
      <Printer size={16} aria-hidden="true" />
      Etiketi Yazdır
    </Button>
  );
}
