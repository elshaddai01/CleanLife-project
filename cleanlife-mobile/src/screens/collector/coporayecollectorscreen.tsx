import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";

import Input from "../../component/input";
import Button from "../../component/button";

export default function CorporateCollectorScreen() {
  const [verificationCode, setVerificationCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleContinue = () => {
    if (!verificationCode || !username || !password) {
      Alert.alert("Missing Information", "Please fill in all fields.");
      return;
    }

    // Replace with API call later
    console.log({
      verificationCode,
      username,
      password,
    });

    Alert.alert(
      "Success",
      "Corporate collector verified successfully."
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>
        Corporate Collector
      </Text>

      <Text style={styles.subtitle}>
        Enter the credentials provided by your company.
      </Text>

      <Input
        placeholder="Company Verification Code"
        value={verificationCode}
        onChangeText={setVerificationCode}
        autoCapitalize="characters"
      />

      <Input
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <Input
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Button
        title="Continue"
        onPress={handleContinue}
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
    color: "#1F2937",
    marginTop: 20,
  },

  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 25,
    lineHeight: 22,
  },
});
