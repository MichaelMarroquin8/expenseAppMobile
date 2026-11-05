package com.michart.ExpenseApp

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * Publica un aviso del sistema por cada movimiento detectado y guarda
 * Agregar / Rechazar hasta que JS pueda aplicarlo en el store.
 */
object CapturePromptNotifier {
  const val ACTION_ACCEPT = "com.michart.ExpenseApp.CAPTURE_PROMPT_ACCEPT"
  const val ACTION_REJECT = "com.michart.ExpenseApp.CAPTURE_PROMPT_REJECT"
  const val EXTRA_ID = "detectionId"

  private const val CHANNEL_ID = "capture_prompts"
  private const val PREFS = "expenseapp_capture_prompts"
  private const val KEY_ACTIONS = "actions"
  private const val KEY_SEQ = "nid_seq"
  private const val MAX_ACTIONS = 40
  private val lock = Any()

  fun canPost(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= 33) {
      val granted =
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
          PackageManager.PERMISSION_GRANTED
      if (!granted) return false
    }
    return NotificationManagerCompat.from(context).areNotificationsEnabled()
  }

  fun show(context: Context, id: String, title: String, body: String): Boolean {
    if (id.isBlank() || !canPost(context)) return false
    val app = context.applicationContext
    ensureChannel(app)
    val notificationId = notificationId(app, id)
    val content =
      NotificationCompat.Builder(app, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_stat_capture)
        .setColor(0xFF2563EB.toInt())
        .setContentTitle(title.ifBlank { app.getString(R.string.capture_prompt_fallback_title) })
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
        .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
        .setPublicVersion(publicVersion(app))
        .setAutoCancel(false)
        .setOnlyAlertOnce(true)
        .setContentIntent(openAppIntent(app, notificationId))
        .addAction(
          android.R.drawable.ic_input_add,
          app.getString(R.string.capture_prompt_action_accept),
          actionIntent(app, notificationId, ACTION_ACCEPT, id),
        )
        .addAction(
          android.R.drawable.ic_menu_close_clear_cancel,
          app.getString(R.string.capture_prompt_action_reject),
          actionIntent(app, notificationId, ACTION_REJECT, id),
        )
        .build()
    NotificationManagerCompat.from(app).notify(notificationId, content)
    return true
  }

  fun dismiss(context: Context, ids: Collection<String>) {
    val app = context.applicationContext
    val manager = NotificationManagerCompat.from(app)
    for (id in ids) {
      val trimmed = id.trim()
      if (trimmed.isEmpty()) continue
      manager.cancel(notificationId(app, trimmed))
    }
  }

  fun enqueueAction(context: Context, id: String, action: String) {
    if (id.isBlank()) return
    if (action != "accept" && action != "reject") return
    synchronized(lock) {
      val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val current = readActions(prefs.getString(KEY_ACTIONS, null))
      val next = JSONArray()
      for (i in 0 until current.length()) {
        val item = current.optJSONObject(i) ?: continue
        if (item.optString("id") == id) continue
        next.put(item)
      }
      next.put(JSONObject().put("id", id).put("action", action))
      val capped = JSONArray()
      val start = (next.length() - MAX_ACTIONS).coerceAtLeast(0)
      for (i in start until next.length()) capped.put(next.get(i))
      prefs.edit().putString(KEY_ACTIONS, capped.toString()).apply()
    }
  }

  fun drainActions(context: Context): JSONArray {
    synchronized(lock) {
      val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val current = readActions(prefs.getString(KEY_ACTIONS, null))
      prefs.edit().remove(KEY_ACTIONS).apply()
      return current
    }
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel =
      NotificationChannel(
        CHANNEL_ID,
        context.getString(R.string.capture_prompt_channel_name),
        NotificationManager.IMPORTANCE_HIGH,
      )
    channel.description = context.getString(R.string.capture_prompt_channel_desc)
    channel.lockscreenVisibility = NotificationCompat.VISIBILITY_PRIVATE
    channel.enableVibration(true)
    manager.createNotificationChannel(channel)
  }

  private fun publicVersion(context: Context): android.app.Notification =
    NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_capture)
      .setContentTitle(context.getString(R.string.capture_prompt_fallback_title))
      .setContentText(context.getString(R.string.capture_prompt_public_text))
      .build()

  private fun openAppIntent(context: Context, notificationId: Int): PendingIntent {
    val intent =
      Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      }
    return PendingIntent.getActivity(context, notificationId, intent, pendingFlags())
  }

  private fun actionIntent(
    context: Context,
    notificationId: Int,
    action: String,
    id: String,
  ): PendingIntent {
    val intent =
      Intent(context, CapturePromptReceiver::class.java).apply {
        this.action = action
        putExtra(EXTRA_ID, id)
        data = Uri.parse("expenseapp://capture-prompt/${Uri.encode(action)}/${Uri.encode(id)}")
      }
    val salt = if (action == ACTION_ACCEPT) 1 else 2
    return PendingIntent.getBroadcast(
      context,
      notificationId xor (salt shl 16),
      intent,
      pendingFlags(),
    )
  }

  private fun pendingFlags(): Int =
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

  private fun notificationId(context: Context, detectionId: String): Int {
    synchronized(lock) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val key = "nid:$detectionId"
      val existing = prefs.getInt(key, 0)
      if (existing != 0) return existing
      val next = prefs.getInt(KEY_SEQ, 1000) + 1
      prefs.edit().putInt(KEY_SEQ, next).putInt(key, next).apply()
      return next
    }
  }

  private fun readActions(raw: String?): JSONArray {
    if (raw.isNullOrBlank()) return JSONArray()
    return try {
      JSONArray(raw)
    } catch (_: Exception) {
      JSONArray()
    }
  }
}
