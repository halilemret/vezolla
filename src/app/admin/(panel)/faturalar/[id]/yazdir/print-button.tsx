"use client";

import { Printer } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      type="button"
      size="sm"
      onClick={() => window.print()}
      className="gap-1.5"
    >
      <Printer className="h-4 w-4" />
      <span>Yazdır / PDF Olarak Kaydet</span>
    </Button>
  );
}
