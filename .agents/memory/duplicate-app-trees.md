---
name: Duplicate app trees in this repo
description: Which listing/screen tree actually runs, and why edits to the uploaded mirror have no runtime effect.
---

This project contains two near-identical Expo Router screen trees: the repository-root `app/` directory and an uploaded build mirror under a separate top-level directory. They are NOT symlinked and drift independently — the mirror uses a compat Firebase service wrapper while the root tree uses native `@react-native-firebase` modules directly, and their listing screens have different state models (segment naming, buyer-criteria handling, share action).

**Rule:** edit the tree that the package `main` entry resolves. With `expo-router/entry`, that is the repository-root `app/` directory. Changes made only in the uploaded mirror never reach the running app, the preview, or the Android build.

**Why:** a full screen redesign was once implemented, reviewed, and validated entirely inside the mirror before it was noticed that the configured workflow never loads it. Type-checking passes for both trees, so `tsc` gives no signal about which one is live.

**How to apply:** before editing any screen here, confirm the entry point (`main` in package.json) and prefer the tree it resolves. If a task brief names a mirror path, treat that as a pointer to the intended design, then port the change into the runtime tree. When both must stay consistent, change the runtime tree first and mirror afterwards.
