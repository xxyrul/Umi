import React from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  TextInputProps,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING } from "@/constants/theme";

interface FormInputProps extends TextInputProps {
  label: string;
  icon?: string;
  error?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
}

export function FormInput({
  label,
  icon,
  error,
  rightIcon,
  onRightIconPress,
  ...props
}: FormInputProps) {
  return (
    <View style={{ marginBottom: SPACING.lg }}>
      {/* Label */}
      <Text
        style={{
          fontSize: 12,
          fontWeight: "500",
          color: COLORS.onSurfaceVariant,
          textTransform: "uppercase",
          letterSpacing: 0.02,
          marginBottom: SPACING.sm,
        }}
      >
        {label}
      </Text>

      {/* Input Container */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: COLORS.surfaceContainer,
          borderWidth: 1,
          borderColor: error ? COLORS.error : COLORS.outlineVariant,
          borderRadius: 8,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.sm,
          gap: SPACING.sm,
        }}
      >
        {/* Left Icon */}
        {icon && (
          <MaterialCommunityIcons
            name={icon as any}
            size={20}
            color={COLORS.onSurfaceVariant}
          />
        )}

        {/* Text Input */}
        <TextInput
          style={{
            flex: 1,
            fontSize: 16,
            color: COLORS.onSurface,
            fontFamily: "Inter",
            paddingVertical: SPACING.sm,
          }}
          placeholderTextColor={COLORS.onSurfaceVariant}
          {...props}
        />

        {/* Right Icon */}
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress}>
            <MaterialCommunityIcons
              name={rightIcon as any}
              size={20}
              color={COLORS.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message */}
      {error && (
        <Text
          style={{
            fontSize: 12,
            color: COLORS.error,
            marginTop: SPACING.xs,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
