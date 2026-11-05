package com.michart.ExpenseApp

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule

@ReactModule(name = "CapturePromptBridge")
class CapturePromptModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "CapturePromptBridge"

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
  fun areNotificationsEnabled(promise: Promise) {
    try {
      promise.resolve(CapturePromptNotifier.canPost(reactContext))
    } catch (e: Exception) {
      promise.reject("PROMPT_STATUS_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun showPrompt(params: ReadableMap?, promise: Promise) {
    try {
      val id = params?.stringOrNull("id").orEmpty()
      if (id.isEmpty()) {
        promise.reject("PROMPT_ID", "Falta el id de la detección")
        return
      }
      val title =
        params?.stringOrNull("title").orEmpty().ifBlank {
          reactContext.getString(R.string.capture_prompt_fallback_title)
        }
      val body = params?.stringOrNull("body").orEmpty()
      promise.resolve(CapturePromptNotifier.show(reactContext, id, title, body))
    } catch (e: Exception) {
      promise.reject("PROMPT_SHOW_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun dismissPrompts(params: ReadableMap?, promise: Promise) {
    try {
      CapturePromptNotifier.dismiss(reactContext, readableIds(params))
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("PROMPT_DISMISS_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun drainActions(promise: Promise) {
    try {
      val actions = CapturePromptNotifier.drainActions(reactContext)
      val out = WritableNativeArray()
      for (i in 0 until actions.length()) {
        val item = actions.optJSONObject(i) ?: continue
        val id = item.optString("id").trim()
        val action = item.optString("action")
        if (id.isEmpty() || (action != "accept" && action != "reject")) continue
        val row = Arguments.createMap()
        row.putString("id", id)
        row.putString("action", action)
        out.pushMap(row)
      }
      promise.resolve(out)
    } catch (e: Exception) {
      promise.reject("PROMPT_DRAIN_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun addListener(eventName: String?) {
    // Lo exige NativeEventEmitter.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Lo exige NativeEventEmitter.
  }

  private fun readableIds(params: ReadableMap?): List<String> {
    val array = params?.getArray("ids") ?: return emptyList()
    val out = ArrayList<String>(array.size())
    for (i in 0 until array.size()) {
      if (array.getType(i) != ReadableType.String) continue
      val id = array.getString(i)?.trim().orEmpty()
      if (id.isNotEmpty()) out.add(id)
    }
    return out
  }

  private fun ReadableMap.stringOrNull(key: String): String? {
    if (!hasKey(key) || getType(key) == ReadableType.Null) return null
    if (getType(key) != ReadableType.String) return null
    return getString(key)?.trim()
  }

  companion object {
    @Volatile
    private var companionContext: ReactApplicationContext? = null

    fun emitAction(id: String, action: String) {
      val ctx = companionContext ?: return
      if (!ctx.hasActiveReactInstance()) return
      try {
        val map = Arguments.createMap()
        map.putString("id", id)
        map.putString("action", action)
        ctx
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("CapturePromptAction", map)
      } catch (_: Exception) {
        // La acción queda en la cola local.
      }
    }
  }
}
