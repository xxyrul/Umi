const { withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const moduleSource = `package com.umi.caseflow

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.io.File
import java.util.ArrayList

class MultiShareModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "MultiShare"
    }

    @ReactMethod
    fun shareMultipleImages(filePaths: ReadableArray, title: String?, message: String?, promise: Promise) {
        val activity = reactContext.currentActivity
        try {
            val uriList = ArrayList<Uri>()
            val authority = "\${reactContext.packageName}.provider"

            for (i in 0 until filePaths.size()) {
                val path = filePaths.getString(i) ?: continue
                val cleanPath = if (path.startsWith("file://")) path.substring(7) else path
                val file = File(cleanPath)
                if (file.exists()) {
                    val uri = FileProvider.getUriForFile(reactContext, authority, file)
                    uriList.add(uri)
                }
            }

            if (uriList.isEmpty()) {
                promise.reject("E_NO_VALID_FILES", "No valid image files found to share")
                return
            }

            val shareIntent = Intent().apply {
                action = if (uriList.size == 1) Intent.ACTION_SEND else Intent.ACTION_SEND_MULTIPLE
                type = "image/*"
                flags = Intent.FLAG_GRANT_READ_URI_PERMISSION

                if (uriList.size == 1) {
                    putExtra(Intent.EXTRA_STREAM, uriList[0])
                } else {
                    putParcelableArrayListExtra(Intent.EXTRA_STREAM, uriList)
                }

                if (!message.isNullOrBlank()) {
                    putExtra(Intent.EXTRA_TEXT, message)
                    putExtra(Intent.EXTRA_SUBJECT, title ?: "Property Listing")
                }
            }

            val chooser = Intent.createChooser(shareIntent, title ?: "Share Listing Photos")
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

            if (activity != null) {
                activity.startActivity(chooser)
            } else {
                reactContext.startActivity(chooser)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_SHARE_FAILED", e.message, e)
        }
    }
}
`;

const packageSource = `package com.umi.caseflow

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager
import java.util.Collections

class MultiSharePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(MultiShareModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<View, ReactShadowNode<*>>> {
        return emptyList()
    }
}
`;

const withMultiShareFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const targetDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'umi',
        'caseflow'
      );

      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'MultiShareModule.kt'), moduleSource);
      fs.writeFileSync(path.join(targetDir, 'MultiSharePackage.kt'), packageSource);

      return config;
    },
  ]);
};

const withMultiShareMainApplication = (config) => {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('MultiSharePackage()')) {
      contents = contents.replace(
        /PackageList\(this\)\.packages/g,
        'PackageList(this).packages.apply {\n          add(MultiSharePackage())\n        }'
      );
      config.modResults.contents = contents;
    }

    return config;
  });
};

module.exports = function withMultiShare(config) {
  config = withMultiShareFiles(config);
  config = withMultiShareMainApplication(config);
  return config;
};
