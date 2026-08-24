import React from "react";
import {
  TextInput,
  StyleSheet,
  TextInputProps,
} from "react-native";

export default function Input(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      style={styles.input}
      placeholderTextColor="#888"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 55,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginVertical: 10,
    backgroundColor: "#fff",
    fontSize: 16,
  },
});