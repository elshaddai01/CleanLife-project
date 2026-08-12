import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";

import Input from "../components/Input";
import Button from "../components/Button";
import Dropdown from "../components/Dropdown";

export default function IndependentCollectorScreen() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [mobilityType, setMobilityType] = useState("Bike");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleRegister = () => {
    if (
      !fullName ||
      !phone ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    // Replace this with your API call later
    console.log({
      fullName,
      phone,
      email,
      mobilityType,
      password,
    });

    Alert.alert(
      "Success",
      "Collector registration submitted!"
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>
        Independent Collector
      </Text>

      <Text style={styles.subtitle}>
        Create your collector account
      </Text>

      <Input
        placeholder="Full Name"
        value={fullName}
        onChangeText={setFullName}
      />

      <Input
        placeholder="Phone Number"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <Input
        placeholder="Email Address"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={styles.label}>Mobility Type</Text>

      <Dropdown
        selectedValue={mobilityType}
        onValueChange={setMobilityType}
      />

      <Input
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Input
        placeholder="Confirm Password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <Button
        title="Register"
        onPress={handleRegister}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 20,
    color: "#1F2937",
  },

  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 25,
    marginTop: 6,
  },

  label: {
    marginTop: 10,
    marginBottom: 6,
    fontWeight: "600",
    color: "#374151",
  },
});