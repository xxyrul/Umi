import * as ImageManipulator from "expo-image-manipulator";

export async function compressImage(uri: string): Promise<string> {
  try {
    if (!uri || uri.startsWith("http://") || uri.startsWith("https://")) {
      return uri;
    }
    if (uri.includes("ImageManipulator") && uri.endsWith(".webp")) {
      return uri;
    }
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1080 } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.WEBP,
      }
    );
    return manipResult.uri;
  } catch (error) {
    console.warn("Image compression failed, fallback to original", error);
    return uri;
  }
}
