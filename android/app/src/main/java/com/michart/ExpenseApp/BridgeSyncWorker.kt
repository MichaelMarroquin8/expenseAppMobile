package com.michart.ExpenseApp

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ListenableWorker.Result
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Poll ligero de SMS bancarios cuando la app no está en foreground.
 * Las notificaciones siguen cubiertas por NotificationListenerService.
 */
class BridgeSyncWorker(
  appContext: Context,
  params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

  override suspend fun doWork(): Result {
    return try {
      val imported = importRecentSms(applicationContext)
      BridgeDiagnostics.markBackgroundSync(applicationContext)
      if (imported > 0) {
        // Nada más: el buffer queda listo para JS al abrir la app.
      }
      Result.success()
    } catch (_: Exception) {
      Result.retry()
    }
  }

  companion object {
    const val UNIQUE_WORK = "expenseapp_bridge_sms_sync"
    private const val PREFS_CURSOR = "expenseapp_bridge_sync_cursor"
    private const val KEY_SINCE = "sms_since_ms"

    fun schedule(context: Context) {
      BridgeDiagnostics.setBackgroundSyncEnabled(context, true)
      val request =
        PeriodicWorkRequestBuilder<BridgeSyncWorker>(15, TimeUnit.MINUTES)
          .build()
      WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        UNIQUE_WORK,
        ExistingPeriodicWorkPolicy.UPDATE,
        request,
      )
    }

    fun cancel(context: Context) {
      BridgeDiagnostics.setBackgroundSyncEnabled(context, false)
      WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_WORK)
    }

    fun isScheduled(context: Context): Boolean =
      BridgeDiagnostics.isBackgroundSyncEnabled(context)

    fun ensureScheduledIfEnabled(context: Context) {
      if (BridgeDiagnostics.isBackgroundSyncEnabled(context)) {
        schedule(context)
      }
    }

    private fun importRecentSms(context: Context): Int {
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) !=
          PackageManager.PERMISSION_GRANTED
      ) {
        return 0
      }

      val senders = BankSmsReceiver.getWatchedShortCodes(context)
      if (senders.isEmpty()) return 0

      val prefs = context.getSharedPreferences(PREFS_CURSOR, Context.MODE_PRIVATE)
      val sinceMs = prefs.getLong(KEY_SINCE, System.currentTimeMillis() - TimeUnit.HOURS.toMillis(6))

      val selectionArgs = ArrayList<String>()
      val parts = ArrayList<String>()
      for (s in senders) {
        val digits = s.filter { it.isDigit() }
        val alpha = s.replace(Regex("[^A-Za-z0-9]"), "")
        if (digits.isNotEmpty()) {
          parts.add("address LIKE ?")
          selectionArgs.add("%$digits")
        } else if (alpha.isNotEmpty()) {
          parts.add("address LIKE ?")
          selectionArgs.add("%$alpha%")
        }
      }
      if (parts.isEmpty()) return 0

      var selection = "(${parts.joinToString(" OR ")}) AND date > ?"
      selectionArgs.add(sinceMs.toString())

      val uri = Uri.parse("content://sms/inbox")
      val cursor: Cursor? =
        context.contentResolver.query(
          uri,
          arrayOf("_id", "address", "body", "date"),
          selection,
          selectionArgs.toTypedArray(),
          "date DESC",
        )

      var imported = 0
      var newest = sinceMs
      cursor?.use { c ->
        var n = 0
        while (c.moveToNext() && n < 40) {
          val smsId = c.getLong(0)
          val address = c.getString(1) ?: ""
          val body = c.getString(2) ?: ""
          val date = c.getLong(3)
          if (!BankSmsReceiver.matchesAnySender(address, senders)) continue
          if (body.isBlank()) continue
          val entry =
            JSONObject()
              .put("id", "sms_inbox:$smsId")
              .put("address", address)
              .put("body", body)
              .put("date", date)
          BankSmsReceiver.appendSms(context, entry)
          BancolombiaSmsBridgeModule.emitSmsCaptured(entry)
          BridgeDiagnostics.markSmsCaptured(context, date)
          if (date > newest) newest = date
          imported += 1
          n += 1
        }
      }

      if (newest > sinceMs) {
        prefs.edit().putLong(KEY_SINCE, newest).apply()
      }
      return imported
    }
  }
}
