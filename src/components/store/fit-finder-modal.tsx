"use client";

import * as React from "react";
import {
  SizeGuideModal,
  calculateBraSize,
  type SizeGuideModalProps,
} from "./size-guide-modal";

export { calculateBraSize };

export interface FitFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSize?: (size: string) => void;
}

export function FitFinderModal(props: FitFinderModalProps) {
  return <SizeGuideModal {...props} sizeGuideType="BRA" />;
}
