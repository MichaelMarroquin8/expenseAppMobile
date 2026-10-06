package com.michart.ExpenseApp

import android.database.Cursor
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = "BancolombiaSmsBridge")
class BancolombiaSmsBridgeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "BancolombiaSmsBridge"

  @ReactMethod
  fun listRecentBySenders(params: ReadableMap?, promise: Promise) {
    try {
      val senders = readableArrayToStrings(params?.getArray("senders"))
      if (senders.isEmpty()) {
        promise.resolve(WritableNativeArray())
        return
      }

      val sinceMs: Long? =
        if (params != null && params.hasKey("sinceTimestamp") && params.getType("sinceTimestamp") != ReadableType.Null) {
          params.getDouble("sinceTimestamp").toLong()
        } else {
          null
        }

      val limit =
        if (params != null && params.hasKey("limit") && params.getType("limit") != ReadableType.Null) {
          params.getInt("limit").coerceIn(1, 500)
        } else {
          50
        }

      val selectionArgs = ArrayList<String>()
      val parts = ArrayList<String>()
      for (s in senders) {
        parts.add("address = ?")
        selectionArgs.add(s)
      }
      var selection = parts.joinToString(" OR ")
      if (sinceMs != null) {
        selection = "($selection) AND date >= ?"
        selectionArgs.add(sinceMs.toString())
      }

      val uri = Uri.parse("content://sms/inbox")
      val cursor: Cursor? =
        reactContext.contentResolver.query(
          uri,
          arrayOf("address", "body", "date"),
          selection,
          selectionArgs.toTypedArray(),
          "date DESC",
        )

      val out = WritableNativeArray()
      cursor?.use { c ->
        var n = 0
        while (c.moveToNext() && n < limit) {
          val address = c.getString(0)
          val body = c.getString(1)
          val date = c.getLong(2)
          val row = WritableNativeMap()
          row.putString("address", address)
          row.putString("body", body)
          row.putDouble("date", date.toDouble())
          out.pushMap(row)
          n++
        }
      }

      promise.resolve(out)
    } catch (e: Exception) {
      promise.reject("SMS_READ_ERROR", e.message, e)
    }
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
}
