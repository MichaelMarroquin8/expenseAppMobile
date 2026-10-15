package com.michart.ExpenseApp

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.module.annotations.ReactModule
import org.json.JSONObject

@ReactModule(name = "NotificationBridge")
class NotificationBridgeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "NotificationBridge"

  override fun initialize() {
    super.initialize()
    companionContext = reactContext
  }

  override fun invalidate() {
    if (companionContext === reactContext) {
      companionContext = null
    }
    super.invalidate()
  }

  @ReactMethod
  fun isAccessEnabled(promise: Promise) {
    try {
      promise.resolve(WalletNotificationListenerService.isAccessEnabled(reactContext))
    } catch (e: Exception) {
      promise.reject("NOTIF_ACCESS_ERROR", e.message, e)
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

  @ReactMethod
  fun clearBuffer(promise: Promise) {
    try {
      WalletNotificationListenerService.clearBuffer(reactContext)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("NOTIF_CLEAR_ERROR", e.message, e)
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
        // App puede estar en background sin JS listo; el buffer basta.
      }
    }
  }
}
