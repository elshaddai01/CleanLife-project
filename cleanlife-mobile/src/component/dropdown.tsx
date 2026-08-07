import React from "react";
import { View, Picker, StyleSheet } from "react-native";

interface Props {
  selectedValue: string;
  onValueChange: (value: string) => void;
}

export default function Dropdown({
  selectedValue,
  onValueChange,
}: Props) {
  return (
    <View style={styles.container}>
      <Picker
        selectedValue={selectedValue}
        onValueChange={onValueChange}
      >
        <Picker.Item label="Bike" value="Bike" />
        <Picker.Item label="Tricycle" value="Tricycle" />
        <Picker.Item label="Pickup" value="Pickup" />
        <Picker.Item label="Truck" value="Truck" />
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    marginVertical: 10,
    overflow: "hidden",
  },
});