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
 * Captura notificaciones de pago (Wallet, Nu, Nequi y demás bancos activos)
 * y las guarda en un buffer local para que JS las deje pendientes de aprobar.
 */
class WalletNotificationListenerService : NotificationListenerService() {

  override fun onListenerConnected() {
    super.onListenerConnected()
    connectedService = this
    ingestActiveNotifications()
  }

  override fun onListenerDisconnected() {
    if (connectedService === this) connectedService = null
    super.onListenerDisconnected()
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    capturePosted(sbn)
  }

  fun capturePosted(sbn: StatusBarNotification) {
    val packageName = sbn.packageName ?: return
    if (!getWatchedPackages(this).contains(packageName)) return

    val extras = sbn.notification?.extras ?: return
    val title = extras.getCharSequence("android.title")?.toString()?.trim().orEmpty()
    val text = extras.getCharSequence("android.text")?.toString()?.trim().orEmpty()
    val bigText = extras.getCharSequence("android.bigText")?.toString()?.trim().orEmpty()
    val lines = extras.getCharSequenceArray("android.textLines")
    val linesText = lines?.joinToString("\n") { it?.toString()?.trim().orEmpty() }?.trim().orEmpty()
    val body = when {
      bigText.isNotEmpty() -> bigText
      text.isNotEmpty() -> text
      linesText.isNotEmpty() -> linesText
      else -> ""
    }

    if (title.isEmpty() && body.isEmpty()) return
    val score = BridgeDiagnostics.scorePayment(title, body)
    if (!score.passes) {
      BridgeDiagnostics.logRejection(this, packageName, title, body, score)
      return
    }

    val entry =
      JSONObject()
        .put("id", "${sbn.packageName}:${sbn.key}:${sbn.postTime}")
        .put("key", sbn.key)
        .put("packageName", packageName)
        .put("title", title)
        .put("text", body)
        .put("postedAt", sbn.postTime)

    appendNotification(applicationContext, entry)
    BridgeDiagnostics.markNotificationCaptured(applicationContext, sbn.postTime)
    NotificationBridgeModule.emitNotificationCaptured(entry)
  }

  companion object {
    private const val PREFS = "expenseapp_wallet_notifications"
    private const val KEY_BUFFER = "buffer"
    private const val KEY_PACKAGES = "watched_packages"
    private const val MAX_BUFFER = 80

    @Volatile
    private var connectedService: WalletNotificationListenerService? = null

    /**
     * Misma lista que BANK_SOURCE_PRESETS en bankSources.ts.
     * Si JS aún no guardó preferencias, igual se escuchan Nu y Nequi.
     */
    val WATCHED_PACKAGES =
      setOf(
        "com.google.android.apps.walletnfcrel",
        "com.google.android.gms",
        "com.google.android.apps.nbu.paisa.user",
        "com.bancolombia.bancolombia",
        "com.nu.production",
        "com.nequi.MobileApp",
        "com.bbva.bbvacontigo",
        "com.davivienda.daviplata",
      )

    fun ingestActiveNotifications() {
      val service = connectedService ?: return
      val active =
        try {
          service.activeNotifications
        } catch (_: Exception) {
          null
        } ?: return
      for (sbn in active) {
        service.capturePosted(sbn)
      }
    }

    fun requestIngest(context: Context) {
      try {
        if (connectedService != null) {
          ingestActiveNotifications()
          return
        }
        val component = ComponentName(context, WalletNotificationListenerService::class.java)
        requestRebind(component)
      } catch (_: Exception) {
      }
    }

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
      requestIngest(context)
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

  }
}
