import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Colors } from "../theme/colors";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  isAlert?: boolean;
  onPress?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  isAlert = false,
  onPress,
}) => {
  const content = (
    <View
      style={[
        styles.card,
        isAlert && styles.cardAlert,
      ]}
    >
      <Text style={styles.title}>{title}</Text>
      <Text
        style={[
          styles.value,
          isAlert && { color: Colors.accent },
        ]}
      >
        {value}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={styles.touchable}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.touchable}>{content}</View>;
};

const styles = StyleSheet.create({
  touchable: {
    flex: 1,
    minWidth: "47%",
  },
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    minHeight: 90,
    justifyContent: "space-between",
  },
  cardAlert: {
    borderColor: Colors.accentLight,
    backgroundColor: "#fffaf8",
  },
  title: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
