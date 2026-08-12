import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function CaseEditRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  if (!id) {
    return <Redirect href="/(tabs)/cases" />;
  }

  return <Redirect href={{ pathname: "/case/form" as any, params: { caseId: id } }} />;
}
