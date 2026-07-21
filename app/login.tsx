import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { COLORS, SPACING } from "@/constants/theme";
import { Button, FormInput } from "@/components";
import { signInWithGoogle, signInWithEmail, signUpWithEmail, initializeGoogleSignIn } from "@/services/auth";

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    initializeGoogleSignIn();
  }, []);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const clearErrors = () => {
    setEmailError("");
    setPasswordError("");
    setNameError("");
  };

  const handleGoogleSignIn = async () => {
    try {
      clearErrors();
      setIsLoading(true);
      await signInWithGoogle();
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Sign In Error", error.message || "Failed to sign in with Google");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    try {
      clearErrors();
      if (!validateEmail(email)) {
        setEmailError("Invalid email address");
        return;
      }
      if (password.length < 6) {
        setPasswordError("Password must be at least 6 characters");
        return;
      }

      setIsLoading(true);
      await signInWithEmail(email, password);
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Sign In Error", error.message || "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    try {
      clearErrors();
      if (!displayName.trim()) {
        setNameError("Name is required");
        return;
      }
      if (!validateEmail(email)) {
        setEmailError("Invalid email address");
        return;
      }
      if (password.length < 6) {
        setPasswordError("Password must be at least 6 characters");
        return;
      }

      setIsLoading(true);
      await signUpWithEmail(email, password, displayName);
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Sign Up Error", error.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: COLORS.background,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: SPACING.lg,
          paddingVertical: SPACING.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: SPACING.xl }}>
          <Text
            style={{
              fontSize: 32,
              fontWeight: "700",
              color: COLORS.primary,
              marginBottom: SPACING.sm,
            }}
          >
            Umi
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: COLORS.onSurfaceVariant,
              lineHeight: 24,
            }}
          >
            Real Estate Case Tracking for Property Agents
          </Text>
        </View>

        {/* Features Showcase Card */}
        {!showEmail && (
          <View
            style={{
              backgroundColor: COLORS.surfaceContainer,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: COLORS.outlineVariant,
              padding: SPACING.lg,
              marginBottom: SPACING.xl,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: COLORS.onSurface,
                marginBottom: SPACING.md,
              }}
            >
              Manage Your Cases Efficiently
            </Text>

            <View style={{ gap: SPACING.md }}>
              {[
                { icon: "folder-multiple", text: "Organize all property cases" },
                { icon: "chart-line", text: "Track progress in real-time" },
                { icon: "shield-check", text: "Secure cloud storage" },
              ].map((feature, idx) => (
                <View
                  key={idx}
                  style={{ flexDirection: "row", gap: SPACING.md, alignItems: "center" }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: COLORS.primaryContainer,
                      borderRadius: 8,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <MaterialCommunityIcons
                      name={feature.icon as any}
                      size={16}
                      color={COLORS.onPrimaryContainer}
                    />
                  </View>
                  <Text style={{ color: COLORS.onSurfaceVariant, flex: 1 }}>
                    {feature.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Sign In / Sign Up Forms */}
        {showEmail ? (
          <View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "600",
                color: COLORS.onSurface,
                marginBottom: SPACING.lg,
              }}
            >
              {isSigningUp ? "Create Account" : "Sign In"}
            </Text>

            {isSigningUp && (
              <FormInput
                label="Full Name"
                placeholder="Enter your name"
                value={displayName}
                onChangeText={setDisplayName}
                error={nameError}
                icon="account"
              />
            )}

            <FormInput
              label="Email"
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              error={emailError}
              icon="email"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <FormInput
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              error={passwordError}
              icon="lock"
              secureTextEntry
            />

            <Button
              label={isSigningUp ? "Create Account" : "Sign In"}
              onPress={isSigningUp ? handleSignUp : handleEmailSignIn}
              loading={isLoading}
              disabled={isLoading}
              style={{ marginTop: SPACING.lg }}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                marginTop: SPACING.lg,
                gap: SPACING.sm,
              }}
            >
              <Text style={{ color: COLORS.onSurfaceVariant }}>
                {isSigningUp ? "Already have an account?" : "Don't have an account?"}
              </Text>
              <TouchableOpacity onPress={() => setIsSigningUp(!isSigningUp)}>
                <Text
                  style={{
                    color: COLORS.primary,
                    fontWeight: "600",
                    textDecorationLine: "underline",
                  }}
                >
                  {isSigningUp ? "Sign In" : "Sign Up"}
                </Text>
              </TouchableOpacity>
            </View>

            <Button
              label="Back to Google"
              onPress={() => setShowEmail(false)}
              variant="secondary"
              style={{ marginTop: SPACING.lg }}
            />
          </View>
        ) : (
          <>
            {/* Google Sign-In Button */}
            <Button
              label="Sign in with Google"
              onPress={handleGoogleSignIn}
              icon="google"
              loading={isLoading}
              disabled={isLoading}
              style={{ marginBottom: SPACING.md }}
            />

            {/* Divider */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginVertical: SPACING.lg,
                gap: SPACING.md,
              }}
            >
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: COLORS.outlineVariant,
                }}
              />
              <Text style={{ color: COLORS.onSurfaceVariant }}>OR</Text>
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: COLORS.outlineVariant,
                }}
              />
            </View>

            {/* Email Sign-In Option */}
            <Button
              label="Sign in with Email"
              onPress={() => setShowEmail(true)}
              variant="secondary"
            />
          </>
        )}

        {/* Footer */}
        <View style={{ marginTop: SPACING.xl, paddingTop: SPACING.xl, borderTopWidth: 1, borderTopColor: COLORS.outlineVariant }}>
          <Text
            style={{
              fontSize: 12,
              color: COLORS.onSurfaceVariant,
              textAlign: "center",
              lineHeight: 18,
            }}
          >
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
