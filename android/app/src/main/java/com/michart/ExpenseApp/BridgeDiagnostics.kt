package com.michart.ExpenseApp

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Preferencias compartidas de diagnóstico del bridge (debug, rechazos, última captura).
 */
object BridgeDiagnostics {
  private const val PREFS = "expenseapp_bridge_diagnostics"
  private const val KEY_DEBUG = "debug_enabled"
  private const val KEY_BG_SYNC = "background_sync_enabled"
  private const val KEY_LAST_NOTIF_AT = "last_notif_captured_at"
  private const val KEY_LAST_SMS_AT = "last_sms_captured_at"
  private const val KEY_LAST_BG_AT = "last_background_sync_at"
  private const val KEY_REJECTIONS = "payment_rejections"
  private const val MAX_REJECTIONS = 30
  const val MIN_PAYMENT_SCORE = 2

  data class PaymentScore(val score: Int, val reasons: List<String>) {
    val passes: Boolean
      get() = score >= MIN_PAYMENT_SCORE
  }

  fun isDebugEnabled(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_DEBUG, false)

  fun setDebugEnabled(context: Context, enabled: Boolean) {
    context
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_DEBUG, enabled)
      .apply()
  }

  fun isBackgroundSyncEnabled(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_BG_SYNC, false)

  fun setBackgroundSyncEnabled(context: Context, enabled: Boolean) {
    context
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_BG_SYNC, enabled)
      .apply()
  }

  fun markNotificationCaptured(context: Context, atMs: Long = System.currentTimeMillis()) {
    context
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putLong(KEY_LAST_NOTIF_AT, atMs)
      .apply()
  }

  fun markSmsCaptured(context: Context, atMs: Long = System.currentTimeMillis()) {
    context
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putLong(KEY_LAST_SMS_AT, atMs)
      .apply()
  }

  fun markBackgroundSync(context: Context, atMs: Long = System.currentTimeMillis()) {
    context
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putLong(KEY_LAST_BG_AT, atMs)
      .apply()
  }

  fun lastNotificationCapturedAt(context: Context): Long =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_LAST_NOTIF_AT, 0L)

  fun lastSmsCapturedAt(context: Context): Long =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_LAST_SMS_AT, 0L)

  fun lastBackgroundSyncAt(context: Context): Long =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_LAST_BG_AT, 0L)

  fun getRejections(context: Context): JSONArray {
    val raw =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_REJECTIONS, "[]")
        ?: "[]"
    return try {
      JSONArray(raw)
    } catch (_: Exception) {
      JSONArray()
    }
  }

  fun clearRejections(context: Context) {
    context
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_REJECTIONS, "[]")
      .apply()
  }

  fun logRejection(
    context: Context,
    packageName: String,
    title: String,
    body: String,
    score: PaymentScore,
  ) {
    if (!isDebugEnabled(context)) return
    val entry =
      JSONObject()
        .put("at", System.currentTimeMillis())
        .put("packageName", packageName)
        .put("title", title.take(80))
        .put("text", body.take(120))
        .put("score", score.score)
        .put("reasons", JSONArray(score.reasons))

    val current = getRejections(context)
    val next = JSONArray()
    next.put(entry)
    val keep = (MAX_REJECTIONS - 1).coerceAtLeast(0)
    val start = (current.length() - keep).coerceAtLeast(0)
    for (i in start until current.length()) {
      next.put(current.get(i))
    }
    context
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_REJECTIONS, next.toString())
      .apply()
  }

  /**
   * Scoring estricto: hace falta al menos [MIN_PAYMENT_SCORE] señales fuertes.
   * "título + un dígito" ya no alcanza solo.
   */
  fun scorePayment(title: String, body: String): PaymentScore {
    val haystack = "$title $body"
    var score = 0
    val reasons = ArrayList<String>()

    if (haystack.contains(Regex("""[\$€£]|COP|USD|MXN""", RegexOption.IGNORE_CASE))) {
      score += 2
      reasons.add("currency")
    }
    if (haystack.contains(Regex("""\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?"""))) {
      score += 2
      reasons.add("amount_thousands")
    } else if (haystack.contains(Regex("""\d+[.,]\d{2}\b"""))) {
      score += 2
      reasons.add("amount_decimal")
    }
    if (haystack.contains(
        Regex(
          """(?:with|con)\s+(?:visa|mastercard|amex|débito|debito|crédito|credito|debit)""",
          RegexOption.IGNORE_CASE,
        ),
      )
    ) {
      score += 2
      reasons.add("card_brand")
    }
    if (haystack.contains(
        Regex("""[•*·xX]{2,}\s*\d{4}|terminaci[oó]n\s*\d{4}|\*{2,}\d{4}""", RegexOption.IGNORE_CASE),
      )
    ) {
      score += 2
      reasons.add("last4")
    }
    if (haystack.contains(
        Regex("""compra|pagaste|pago|retiro|transfer|compra\s+por|charged|purchase""", RegexOption.IGNORE_CASE),
      )
    ) {
      score += 1
      reasons.add("payment_verb")
    }
    // Señal débil: ya no basta sola
    if (title.isNotBlank() && body.contains(Regex("""\d"""))) {
      score += 1
      reasons.add("title_plus_digit")
    }

    return PaymentScore(score, reasons)
  }
}
