package com.michart.ExpenseApp

import android.content.Context
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.charset.Charset

/**
 * Cola JSON durable con escritura atómica (tmp + rename vía [AtomicFile]).
 * Reemplaza el buffer monolítico en SharedPreferences.
 */
class AtomicJsonQueue(
  context: Context,
  fileName: String,
  private val maxSize: Int = 80,
  private val idKey: String = "id",
) {
  private val lock = Any()
  private val file = File(context.filesDir, fileName)
  private val atomic = AtomicFile(file)
  private val charset: Charset = Charsets.UTF_8

  fun read(): JSONArray =
    synchronized(lock) {
      if (!file.exists() || file.length() == 0L) return JSONArray()
      return try {
        atomic.openRead().use { input ->
          val bytes = input.readBytes()
          JSONArray(String(bytes, charset))
        }
      } catch (_: Exception) {
        JSONArray()
      }
    }

  fun write(array: JSONArray) {
    synchronized(lock) {
      val text = array.toString()
      val out = atomic.startWrite()
      try {
        out.write(text.toByteArray(charset))
        atomic.finishWrite(out)
      } catch (e: Exception) {
        atomic.failWrite(out)
        throw e
      }
    }
  }

  fun clear() {
    write(JSONArray())
  }

  fun size(): Int = read().length()

  /** Inserta al frente; deduplica por [idKey]. Retorna false si ya existía. */
  fun append(entry: JSONObject): Boolean {
    synchronized(lock) {
      val current = readUnlocked()
      val entryId = entry.optString(idKey)
      if (entryId.isNotEmpty()) {
        for (i in 0 until current.length()) {
          if (current.optJSONObject(i)?.optString(idKey) == entryId) {
            return false
          }
        }
      }
      val next = JSONArray()
      next.put(entry)
      val keep = (maxSize - 1).coerceAtLeast(0)
      val start = (current.length() - keep).coerceAtLeast(0)
      for (i in start until current.length()) {
        next.put(current.get(i))
      }
      writeUnlocked(next)
      return true
    }
  }

  fun markConsumed(ids: Collection<String>) {
    if (ids.isEmpty()) return
    val idSet = ids.toHashSet()
    synchronized(lock) {
      val current = readUnlocked()
      val next = JSONArray()
      for (i in 0 until current.length()) {
        val item = current.optJSONObject(i) ?: continue
        if (!idSet.contains(item.optString(idKey))) {
          next.put(item)
        }
      }
      writeUnlocked(next)
    }
  }

  /**
   * Migra una sola vez desde SharedPreferences si el archivo está vacío.
   */
  fun migrateFromPrefsIfEmpty(context: Context, prefsName: String, prefsKey: String) {
    synchronized(lock) {
      if (file.exists() && file.length() > 0L) return
      val raw =
        context.getSharedPreferences(prefsName, Context.MODE_PRIVATE).getString(prefsKey, null)
          ?: return
      try {
        val arr = JSONArray(raw)
        if (arr.length() > 0) {
          writeUnlocked(arr)
          context
            .getSharedPreferences(prefsName, Context.MODE_PRIVATE)
            .edit()
            .remove(prefsKey)
            .apply()
        }
      } catch (_: Exception) {
        // ignore corrupt prefs
      }
    }
  }

  private fun readUnlocked(): JSONArray {
    if (!file.exists() || file.length() == 0L) return JSONArray()
    return try {
      atomic.openRead().use { input ->
        JSONArray(String(input.readBytes(), charset))
      }
    } catch (_: Exception) {
      JSONArray()
    }
  }

  private fun writeUnlocked(array: JSONArray) {
    val text = array.toString()
    val out = atomic.startWrite()
    try {
      out.write(text.toByteArray(charset))
      atomic.finishWrite(out)
    } catch (e: Exception) {
      atomic.failWrite(out)
      throw e
    }
  }

  companion object {
    @Volatile private var smsQueue: AtomicJsonQueue? = null
    @Volatile private var notifQueue: AtomicJsonQueue? = null

    fun sms(context: Context): AtomicJsonQueue {
      val existing = smsQueue
      if (existing != null) return existing
      return synchronized(this) {
        smsQueue
          ?: AtomicJsonQueue(context.applicationContext, "expenseapp_sms_buffer.json").also {
            it.migrateFromPrefsIfEmpty(context, "expenseapp_bank_sms", "buffer")
            smsQueue = it
          }
      }
    }

    fun notifications(context: Context): AtomicJsonQueue {
      val existing = notifQueue
      if (existing != null) return existing
      return synchronized(this) {
        notifQueue
          ?: AtomicJsonQueue(context.applicationContext, "expenseapp_notif_buffer.json").also {
            it.migrateFromPrefsIfEmpty(context, "expenseapp_wallet_notifications", "buffer")
            notifQueue = it
          }
      }
    }
  }
}
