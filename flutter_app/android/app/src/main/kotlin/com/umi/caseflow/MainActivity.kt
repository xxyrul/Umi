package com.umi.caseflow

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.core.view.WindowCompat
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {
    private val CHANNEL = "com.umi.caseflow/security"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        enableHighRefreshRate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NotificationManager::class.java) ?: return

            val appUpdatesChannel = NotificationChannel(
                "app-updates",
                "App Updates",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications about new versions and critical updates"
                enableVibration(true)
            }

            val updatesChannel = NotificationChannel(
                "updates",
                "Update Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Reminders for pending updates"
                enableVibration(true)
            }

            val generalChannel = NotificationChannel(
                "general",
                "General Announcements",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Case progress alerts and agency announcements"
                enableVibration(true)
            }

            notificationManager.createNotificationChannels(listOf(appUpdatesChannel, updatesChannel, generalChannel))
        }
    }

    override fun onResume() {
        super.onResume()
        enableHighRefreshRate()
    }

    private fun enableHighRefreshRate() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val currentDisplay = display
                val modes = currentDisplay?.supportedModes
                val highestMode = modes?.maxByOrNull { it.refreshRate }
                if (highestMode != null) {
                    val params = window.attributes
                    params.preferredDisplayModeId = highestMode.modeId
                    window.attributes = params
                }
            } catch (e: Exception) {
                try {
                    val params = window.attributes
                    params.preferredRefreshRate = 120f
                    window.attributes = params
                } catch (_: Exception) {}
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                @Suppress("DEPRECATION")
                val modes = window.windowManager.defaultDisplay.supportedModes
                val highestMode = modes?.maxByOrNull { it.refreshRate }
                if (highestMode != null) {
                    val params = window.attributes
                    params.preferredDisplayModeId = highestMode.modeId
                    window.attributes = params
                }
            } catch (_: Exception) {}
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "setSecureMode" -> {
                    val enabled = call.argument<Boolean>("enabled") ?: false
                    if (enabled) {
                        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                    } else {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                    }
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
    }
}
