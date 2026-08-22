import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

interface ButtonProps {
  title: string;
  onPress: () => void;
}

export default function Button({
  title,
  onPress,
}: ButtonProps) {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
    >
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#2E8B57",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 15,
  },

  text: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});