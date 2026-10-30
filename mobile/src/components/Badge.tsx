import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../theme/colors";

export type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "accent" | "info";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = "neutral" }) => {
  const getColors = () => {
    switch (variant) {
      case "success":
        return { text: Colors.success, bg: Colors.successBg, border: Colors.successBorder };
      case "warning":
        return { text: Colors.warning, bg: Colors.warningBg, border: Colors.warningBorder };
      case "danger":
        return { text: Colors.danger, bg: Colors.dangerBg, border: Colors.dangerBorder };
      case "accent":
        return { text: Colors.accent, bg: Colors.accentLight, border: Colors.accentLight };
      case "info":
        return { text: Colors.info, bg: Colors.infoBg, border: Colors.infoBorder };
      case "neutral":
      default:
        return { text: Colors.textSecondary, bg: Colors.surfaceSubtle, border: Colors.border };
    }
  };

  const c = getColors();

  return (
    <View style={[styles.container, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
