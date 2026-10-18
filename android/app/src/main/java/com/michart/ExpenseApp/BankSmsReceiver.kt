package com.michart.ExpenseApp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import org.json.JSONArray
import org.json.JSONObject

/**
 * Captura SMS entrantes de short codes bancarios, los guarda en buffer local
 * y emite el evento a JS cuando hay instancia React activa.
 */
class BankSmsReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context?, intent: Intent?) {
    if (context == null || intent == null) return
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
    if (messages.isEmpty()) return

    val watchedCodes = getWatchedShortCodes(context.applicationContext)
    val byAddress = LinkedHashMap<String, StringBuilder>()
    var latestDate = 0L
    for (msg in messages) {
      val address = msg.displayOriginatingAddress?.trim().orEmpty()
      if (address.isEmpty()) continue
      if (!matchesAnySender(address, watchedCodes)) continue
      val bodyPart = msg.displayMessageBody ?: msg.messageBody ?: ""
      byAddress.getOrPut(address) { StringBuilder() }.append(bodyPart)
      val ts = msg.timestampMillis
      if (ts > latestDate) latestDate = ts
    }

    if (byAddress.isEmpty()) return
    val now = if (latestDate > 0L) latestDate else System.currentTimeMillis()

    for ((address, bodyBuilder) in byAddress) {
      val body = bodyBuilder.toString().trim()
      if (body.isEmpty()) continue
      val entry =
        JSONObject()
          .put("id", "sms_rx:${address}:${now}:${body.hashCode()}")
          .put("address", address)
          .put("body", body)
          .put("date", now)
      appendSms(context.applicationContext, entry)
      BridgeDiagnostics.markSmsCaptured(context.applicationContext, now)
      BancolombiaSmsBridgeModule.emitSmsCaptured(entry)
    }
  }

  companion object {
    private const val PREFS = "expenseapp_bank_sms"
    private const val KEY_SHORT_CODES = "watched_short_codes"

    /** Defaults alineados con src/domain/bankSources.ts */
    val DEFAULT_SHORT_CODES =
      listOf("85540", "85784", "NU", "NEQUI", "4455637", "BBVA", "DAVIPLATA")

    fun matchesAnySender(address: String?, senders: List<String>): Boolean {
      val addr = address?.trim().orEmpty()
      if (addr.isEmpty() || senders.isEmpty()) return false
      val digits = addr.filter { it.isDigit() }
      val normalized = addr.replace(Regex("[^A-Za-z0-9]"), "").uppercase()
      return senders.any { sender ->
        val codeDigits = sender.filter { it.isDigit() }
        val codeNorm = sender.replace(Regex("[^A-Za-z0-9]"), "").uppercase()
        val digitMatch =
          codeDigits.isNotEmpty() &&
            digits.isNotEmpty() &&
            (digits == codeDigits || digits.endsWith(codeDigits))
        val alphaMatch =
          codeNorm.isNotEmpty() &&
            (normalized == codeNorm || normalized.endsWith(codeNorm) || normalized.contains(codeNorm))
        digitMatch || alphaMatch
      }
    }

    fun getWatchedShortCodes(context: Context): List<String> {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val raw = prefs.getString(KEY_SHORT_CODES, null)
      if (raw.isNullOrBlank()) return DEFAULT_SHORT_CODES
      return try {
        val arr = JSONArray(raw)
        val out = ArrayList<String>()
        for (i in 0 until arr.length()) {
          val s = arr.optString(i).trim()
          if (s.isNotEmpty()) out.add(s)
        }
        if (out.isEmpty()) DEFAULT_SHORT_CODES else out
      } catch (_: Exception) {
        DEFAULT_SHORT_CODES
      }
    }

    fun setWatchedShortCodes(context: Context, codes: Collection<String>) {
      val arr = JSONArray()
      val seen = HashSet<String>()
      for (code in codes) {
        val s = code.trim()
        if (s.isEmpty() || !seen.add(s.uppercase())) continue
        arr.put(s)
      }
      if (arr.length() == 0) {
        for (code in DEFAULT_SHORT_CODES) arr.put(code)
      }
      context
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_SHORT_CODES, arr.toString())
        .apply()
    }

    fun getBuffered(context: Context): JSONArray = AtomicJsonQueue.sms(context).read()

    fun clearBuffer(context: Context) {
      AtomicJsonQueue.sms(context).clear()
    }

    fun markConsumed(context: Context, ids: Collection<String>) {
      AtomicJsonQueue.sms(context).markConsumed(ids)
    }

    fun appendSms(context: Context, entry: JSONObject) {
      AtomicJsonQueue.sms(context).append(entry)
    }
  }
}
