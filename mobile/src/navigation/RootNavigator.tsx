import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { LoginScreen } from "../screens/LoginScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { OrdersScreen } from "../screens/OrdersScreen";
import { OrderDetailScreen } from "../screens/OrderDetailScreen";
import { CatalogScreen } from "../screens/CatalogScreen";
import { ReturnsScreen } from "../screens/ReturnsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { Colors } from "../theme/colors";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const OrdersStack = createNativeStackNavigator();

function OrdersStackNavigator() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="OrdersList" component={OrdersScreen} />
      <OrdersStack.Screen name="OrderDetail" component={OrderDetailScreen} />
    </OrdersStack.Navigator>
  );
}

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "grid-outline";

          if (route.name === "DashboardTab") {
            iconName = focused ? "grid" : "grid-outline";
          } else if (route.name === "OrdersTab") {
            iconName = focused ? "receipt" : "receipt-outline";
          } else if (route.name === "CatalogTab") {
            iconName = focused ? "cube" : "cube-outline";
          } else if (route.name === "ReturnsTab") {
            iconName = focused ? "repeat" : "repeat-outline";
          } else if (route.name === "SettingsTab") {
            iconName = focused ? "settings" : "settings-outline";
          }

          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{ tabBarLabel: "Genel Bakış" }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersStackNavigator}
        options={{ tabBarLabel: "Siparişler" }}
      />
      <Tab.Screen
        name="CatalogTab"
        component={CatalogScreen}
        options={{ tabBarLabel: "Katalog & Stok" }}
      />
      <Tab.Screen
        name="ReturnsTab"
        component={ReturnsScreen}
        options={{ tabBarLabel: "İadeler" }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{ tabBarLabel: "Ayarlar" }}
      />
    </Tab.Navigator>
  );
}

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.text} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
});
