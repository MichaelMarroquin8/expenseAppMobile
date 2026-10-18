package com.michart.ExpenseApp

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.module.annotations.ReactModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject

@ReactModule(name = "NotificationBridge")
class NotificationBridgeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  override fun getName(): String = "NotificationBridge"

  override fun initialize() {
    super.initialize()
    companionContext = reactContext
  }

  override fun invalidate() {
    scope.cancel()
    if (companionContext === reactContext) {
      companionContext = null
    }
    super.invalidate()
  }

  @ReactMethod
  fun isAccessEnabled(promise: Promise) {
    scope.launch {
      try {
        promise.resolve(WalletNotificationListenerService.isAccessEnabled(reactContext))
      } catch (e: Exception) {
        promise.reject("NOTIF_ACCESS_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun openAccessSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("NOTIF_SETTINGS_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun getRecentNotifications(params: ReadableMap?, promise: Promise) {
    scope.launch {
      try {
        val sinceMs: Long? =
          if (params != null && params.hasKey("sinceTimestamp") && params.getType("sinceTimestamp") != ReadableType.Null) {
            params.getDouble("sinceTimestamp").toLong()
          } else {
            null
          }
        val limit =
          if (params != null && params.hasKey("limit") && params.getType("limit") != ReadableType.Null) {
            params.getInt("limit").coerceIn(1, 200)
          } else {
            40
          }

        val buffer = WalletNotificationListenerService.getBuffered(reactContext)
        val out = WritableNativeArray()
        var count = 0
        for (i in 0 until buffer.length()) {
          if (count >= limit) break
          val item = buffer.optJSONObject(i) ?: continue
          val postedAt = item.optLong("postedAt", 0L)
          if (sinceMs != null && postedAt < sinceMs) continue
          out.pushMap(jsonToMap(item))
          count++
        }
        promise.resolve(out)
      } catch (e: Exception) {
        promise.reject("NOTIF_READ_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun clearBuffer(promise: Promise) {
    scope.launch {
      try {
        WalletNotificationListenerService.clearBuffer(reactContext)
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("NOTIF_CLEAR_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun markConsumed(params: ReadableMap?, promise: Promise) {
    scope.launch {
      try {
        WalletNotificationListenerService.markConsumed(
          reactContext,
          readableArrayToStrings(params?.getArray("ids")),
        )
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("NOTIF_MARK_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun setWatchedPackages(params: ReadableMap?, promise: Promise) {
    scope.launch {
      try {
        WalletNotificationListenerService.setWatchedPackages(
          reactContext,
          readableArrayToStrings(params?.getArray("packages")),
        )
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("NOTIF_PACKAGES_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun getWatchedPackages(promise: Promise) {
    scope.launch {
      try {
        val pkgs = WalletNotificationListenerService.getWatchedPackages(reactContext)
        val out = WritableNativeArray()
        for (pkg in pkgs) out.pushString(pkg)
        promise.resolve(out)
      } catch (e: Exception) {
        promise.reject("NOTIF_PACKAGES_READ_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun setDebugEnabled(enabled: Boolean, promise: Promise) {
    scope.launch {
      try {
        BridgeDiagnostics.setDebugEnabled(reactContext, enabled)
        if (!enabled) BridgeDiagnostics.clearRejections(reactContext)
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("NOTIF_DEBUG_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun setBackgroundSyncEnabled(enabled: Boolean, promise: Promise) {
    scope.launch {
      try {
        if (enabled) {
          BridgeSyncWorker.schedule(reactContext)
        } else {
          BridgeSyncWorker.cancel(reactContext)
        }
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("NOTIF_BG_SYNC_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun getBridgeStatus(promise: Promise) {
    scope.launch {
      try {
        val buffer = WalletNotificationListenerService.getBuffered(reactContext)
        val pkgs = WalletNotificationListenerService.getWatchedPackages(reactContext)
        val lastAt = BridgeDiagnostics.lastNotificationCapturedAt(reactContext)
        val lastBg = BridgeDiagnostics.lastBackgroundSyncAt(reactContext)
        val map = Arguments.createMap()
        map.putBoolean("accessEnabled", WalletNotificationListenerService.isAccessEnabled(reactContext))
        map.putInt("bufferSize", buffer.length())
        map.putInt("watchedPackagesCount", pkgs.size)
        map.putBoolean("debugEnabled", BridgeDiagnostics.isDebugEnabled(reactContext))
        map.putBoolean("backgroundSyncEnabled", BridgeSyncWorker.isScheduled(reactContext))
        map.putInt("minPaymentScore", BridgeDiagnostics.MIN_PAYMENT_SCORE)
        if (lastAt > 0L) map.putDouble("lastCapturedAt", lastAt.toDouble()) else map.putNull("lastCapturedAt")
        if (lastBg > 0L) map.putDouble("lastBackgroundSyncAt", lastBg.toDouble()) else map.putNull("lastBackgroundSyncAt")

        val rejections = BridgeDiagnostics.getRejections(reactContext)
        val rejArr = WritableNativeArray()
        for (i in 0 until rejections.length()) {
          val item = rejections.optJSONObject(i) ?: continue
          val row = Arguments.createMap()
          row.putDouble("at", item.optLong("at", 0L).toDouble())
          row.putString("packageName", item.optString("packageName"))
          row.putString("title", item.optString("title"))
          row.putString("text", item.optString("text"))
          row.putInt("score", item.optInt("score", 0))
          val reasons = item.optJSONArray("reasons")
          val reasonArr = WritableNativeArray()
          if (reasons != null) {
            for (r in 0 until reasons.length()) {
              reasonArr.pushString(reasons.optString(r))
            }
          }
          row.putArray("reasons", reasonArr)
          rejArr.pushMap(row)
        }
        map.putArray("rejections", rejArr)
        promise.resolve(map)
      } catch (e: Exception) {
        promise.reject("NOTIF_STATUS_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun clearRejectionLog(promise: Promise) {
    scope.launch {
      try {
        BridgeDiagnostics.clearRejections(reactContext)
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("NOTIF_CLEAR_REJ_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun addListener(eventName: String?) {
    // Required by RN NativeEventEmitter
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required by RN NativeEventEmitter
  }

  private fun jsonToMap(item: JSONObject): WritableNativeMap {
    val map = WritableNativeMap()
    map.putString("id", item.optString("id"))
    map.putString("key", item.optString("key"))
    map.putString("packageName", item.optString("packageName"))
    map.putString("title", item.optString("title"))
    map.putString("text", item.optString("text"))
    map.putDouble("postedAt", item.optLong("postedAt", 0L).toDouble())
    return map
  }

  private fun readableArrayToStrings(array: ReadableArray?): List<String> {
    if (array == null) return emptyList()
    val out = ArrayList<String>(array.size())
    for (i in 0 until array.size()) {
      if (array.getType(i) == ReadableType.String) {
        val s = array.getString(i)?.trim().orEmpty()
        if (s.isNotEmpty()) out.add(s)
      }
    }
    return out
  }

  companion object {
    @Volatile
    private var companionContext: ReactApplicationContext? = null

    fun emitNotificationCaptured(entry: JSONObject) {
      val ctx = companionContext ?: return
      if (!ctx.hasActiveReactInstance()) return
      try {
        val map = Arguments.createMap()
        map.putString("id", entry.optString("id"))
        map.putString("key", entry.optString("key"))
        map.putString("packageName", entry.optString("packageName"))
        map.putString("title", entry.optString("title"))
        map.putString("text", entry.optString("text"))
        map.putDouble("postedAt", entry.optLong("postedAt", 0L).toDouble())
        ctx
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("WalletNotificationCaptured", map)
      } catch (_: Exception) {
        // buffer atómico basta
      }
    }
  }
}
