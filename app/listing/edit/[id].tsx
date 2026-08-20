import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function ListingEditRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  if (!id) {
    return <Redirect href="/(tabs)/listings" />;
  }

  return <Redirect href={{ pathname: "/tambah" as any, params: { id } }} />;
}
