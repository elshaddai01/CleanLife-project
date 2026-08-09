import React from "react";
import {
  View,
  Text,
  StyleSheet,
} from "react-native";

import Button from "../components/Button";

export default function CollectorTypeScreen({
  navigation,
}: any) {
  return (
    <View style={styles.container}>

      <Text style={styles.title}>
        Register as Collector
      </Text>

      <Button
        title="Independent Collector"
        onPress={() =>
          navigation.navigate(
            "IndependentCollector"
          )
        }
      />

      <Button
        title="Corporate Collector"
        onPress={() =>
          navigation.navigate(
            "CorporateCollector"
          )
        }
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 25,
    backgroundColor: "#fff",
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
});