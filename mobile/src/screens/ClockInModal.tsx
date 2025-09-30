import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function ClockInModal() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Clock In Modal - Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    fontSize: 18,
    color: '#000000',
  },
});
