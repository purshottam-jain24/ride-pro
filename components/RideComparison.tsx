import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';

interface RideComparisonProps {
  rideProPrice: number;
  distanceKm: number;
}

export default function RideComparison({ rideProPrice, distanceKm }: RideComparisonProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [rideProPrice]);

  // Estimated prices for competitors
  const uberPrice = Math.round(rideProPrice * 1.25);
  const rapidoPrice = Math.round(rideProPrice * 0.85); // Rapido Bike is cheaper
  const olaPrice = Math.round(rideProPrice * 1.18);

  const maxPrice = Math.max(uberPrice, olaPrice, rideProPrice);

  const getWidth = (price: number): `${number}%` => {
    return `${(price / maxPrice) * 100}%`;
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Smart Comparison</Text>
          <Text style={styles.subtitle}>Real-time market rates</Text>
        </View>
        <View style={styles.uspBadge}>
          <Text style={styles.uspText}>USP: Best Price</Text>
        </View>
      </View>

      <View style={styles.comparisonList}>
        {/* RidePro - Our App */}
        <View style={styles.comparisonItem}>
          <View style={styles.labelRow}>
            <View style={styles.appNameContainer}>
              <Text style={styles.appIcon}>🚀</Text>
              <Text style={styles.appNameHighlight}>RidePro</Text>
            </View>
            <Text style={styles.priceHighlight}>₹{rideProPrice}</Text>
          </View>
          <View style={styles.barContainer}>
            <View style={[styles.bar, styles.rideProBar, { width: getWidth(rideProPrice) }]} />
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>CHEAPEST</Text>
            </View>
          </View>
        </View>

        {/* Uber */}
        <View style={styles.comparisonItem}>
          <View style={styles.labelRow}>
            <View style={styles.appNameContainer}>
              <Text style={styles.appIcon}>⚫</Text>
              <Text style={styles.appName}>Uber Go</Text>
            </View>
            <Text style={styles.competitorPrice}>₹{uberPrice}</Text>
          </View>
          <View style={styles.barContainer}>
            <View style={[styles.bar, styles.competitorBar, { width: getWidth(uberPrice) }]} />
          </View>
        </View>

        {/* Ola */}
        <View style={styles.comparisonItem}>
          <View style={styles.labelRow}>
            <View style={styles.appNameContainer}>
              <Text style={styles.appIcon}>🟡</Text>
              <Text style={styles.appName}>Ola Mini</Text>
            </View>
            <Text style={styles.competitorPrice}>₹{olaPrice}</Text>
          </View>
          <View style={styles.barContainer}>
            <View style={[styles.bar, styles.competitorBar, { width: getWidth(olaPrice) }]} />
          </View>
        </View>
      </View>

      <View style={styles.savingBanner}>
        <Text style={styles.savingText}>
          You save <Text style={styles.savingsAmount}>₹{uberPrice - rideProPrice}</Text> by choosing RidePro!
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
      }
    }),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  uspBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  uspText: {
    color: '#1E88E5',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  comparisonList: {
    gap: 18,
  },
  comparisonItem: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  appName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  appNameHighlight: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
  },
  priceHighlight: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2e7d32',
  },
  competitorPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#999',
  },
  barContainer: {
    height: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 7,
  },
  rideProBar: {
    backgroundColor: '#000', // Premium Black
  },
  competitorBar: {
    backgroundColor: '#e0e0e0',
  },
  bestValueBadge: {
    position: 'absolute',
    right: 8,
    backgroundColor: '#4caf50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bestValueText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#fff',
  },
  savingBanner: {
    marginTop: 20,
    backgroundColor: '#f1f8e9',
    padding: 12,
    borderRadius: 15,
    alignItems: 'center',
  },
  savingText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  savingsAmount: {
    color: '#2e7d32',
    fontWeight: '900',
    fontSize: 16,
  },
});

