package com.michart.ExpenseApp

import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.text.TextUtils
import org.json.JSONArray
import org.json.JSONObject

/**
 * Captura notificaciones de pago (Google Wallet y similares) y las guarda
 * en un buffer local para que JS las lea y las deje como pendientes de aprobar.
 */
class WalletNotificationListenerService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    val packageName = sbn.packageName ?: return
    if (!getWatchedPackages(this).contains(packageName)) return

    val extras = sbn.notification?.extras ?: return
    val title = extras.getCharSequence("android.title")?.toString()?.trim().orEmpty()
    val text = extras.getCharSequence("android.text")?.toString()?.trim().orEmpty()
    val bigText = extras.getCharSequence("android.bigText")?.toString()?.trim().orEmpty()
    val body = when {
      bigText.isNotEmpty() -> bigText
      text.isNotEmpty() -> text
      else -> ""
    }

    if (title.isEmpty() && body.isEmpty()) return
    if (!looksLikePayment(title, body)) return

    val entry =
      JSONObject()
        .put("id", "${sbn.packageName}:${sbn.key}:${sbn.postTime}")
        .put("key", sbn.key)
        .put("packageName", packageName)
        .put("title", title)
        .put("text", body)
        .put("postedAt", sbn.postTime)

    appendNotification(applicationContext, entry)
    NotificationBridgeModule.emitNotificationCaptured(entry)
  }

  companion object {
    private const val PREFS = "expenseapp_wallet_notifications"
    private const val KEY_BUFFER = "buffer"
    private const val KEY_PACKAGES = "watched_packages"
    private const val MAX_BUFFER = 80

    /** Paquetes conocidos de Google Wallet / Pay en distintos dispositivos. */
    val WATCHED_PACKAGES =
      setOf(
        "com.google.android.apps.walletnfcrel",
        "com.google.android.gms",
        "com.google.android.apps.nbu.paisa.user",
      )

    fun isAccessEnabled(context: Context): Boolean {
      val flat =
        Settings.Secure.getString(
          context.contentResolver,
          "enabled_notification_listeners",
        ) ?: return false
      if (TextUtils.isEmpty(flat)) return false
      val names = flat.split(':')
      val myPackage = context.packageName
      for (name in names) {
        val component = ComponentName.unflattenFromString(name) ?: continue
        if (component.packageName == myPackage) return true
      }
      return false
    }

    fun getBuffered(context: Context): JSONArray {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val raw = prefs.getString(KEY_BUFFER, "[]") ?: "[]"
      return try {
        JSONArray(raw)
      } catch (_: Exception) {
        JSONArray()
      }
    }

    fun clearBuffer(context: Context) {
      context
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_BUFFER, "[]")
        .apply()
    }

    fun getWatchedPackages(context: Context): List<String> {
      val raw =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_PACKAGES, null)
      if (raw.isNullOrBlank()) return WATCHED_PACKAGES.toList()
      return try {
        val array = JSONArray(raw)
        val out = ArrayList<String>(array.length())
        for (i in 0 until array.length()) {
          val pkg = array.optString(i).trim()
          if (pkg.isNotEmpty()) out.add(pkg)
        }
        if (out.isEmpty()) WATCHED_PACKAGES.toList() else out
      } catch (_: Exception) {
        WATCHED_PACKAGES.toList()
      }
    }

    fun setWatchedPackages(context: Context, packages: List<String>) {
      val array = JSONArray()
      for (pkg in packages) {
        val trimmed = pkg.trim()
        if (trimmed.isNotEmpty()) array.put(trimmed)
      }
      context
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_PACKAGES, array.toString())
        .apply()
    }

    fun markConsumed(context: Context, ids: List<String>) {
      if (ids.isEmpty()) return
      val drop = ids.toSet()
      val current = getBuffered(context)
      val next = JSONArray()
      for (i in 0 until current.length()) {
        val item = current.optJSONObject(i) ?: continue
        if (drop.contains(item.optString("id"))) continue
        next.put(item)
      }
      context
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_BUFFER, next.toString())
        .apply()
    }

    private fun appendNotification(context: Context, entry: JSONObject) {
      val current = getBuffered(context)
      // Evitar duplicados exactos por id
      for (i in 0 until current.length()) {
        if (current.optJSONObject(i)?.optString("id") == entry.optString("id")) {
          return
        }
      }

      val next = JSONArray()
      next.put(entry)
      val keep = (MAX_BUFFER - 1).coerceAtLeast(0)
      val start = (current.length() - keep).coerceAtLeast(0)
      for (i in start until current.length()) {
        next.put(current.get(i))
      }

      context
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_BUFFER, next.toString())
        .apply()
    }

    private fun looksLikePayment(title: String, body: String): Boolean {
      val haystack = "$title $body"
      if (haystack.contains(Regex("""[\$€£]|COP|USD|MXN""", RegexOption.IGNORE_CASE))) return true
      if (haystack.contains(Regex("""\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?"""))) return true
      if (haystack.contains(Regex("""(?:with|con)\s+(?:visa|mastercard|amex|debit|crédito|credito)""", RegexOption.IGNORE_CASE))) {
        return true
      }
      if (haystack.contains(Regex("""[•*]{2,}\s*\d{4}|terminaci[oó]n\s*\d{4}""", RegexOption.IGNORE_CASE))) {
        return true
      }
      // Título de comercio + cuerpo con dígitos suele ser Wallet
      if (title.isNotBlank() && body.contains(Regex("""\d"""))) return true
      return false
    }
  }
}
