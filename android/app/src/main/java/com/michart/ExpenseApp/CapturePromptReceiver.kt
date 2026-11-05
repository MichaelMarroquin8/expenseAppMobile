package com.michart.ExpenseApp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Aplica Agregar o Rechazar desde la notificación, aunque JS esté en segundo plano. */
class CapturePromptReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context?, intent: Intent?) {
    if (context == null || intent == null) return
    val id = intent.getStringExtra(CapturePromptNotifier.EXTRA_ID)?.trim().orEmpty()
    if (id.isEmpty()) return
    val action =
      when (intent.action) {
        CapturePromptNotifier.ACTION_ACCEPT -> "accept"
        CapturePromptNotifier.ACTION_REJECT -> "reject"
        else -> return
      }
    val app = context.applicationContext
    CapturePromptNotifier.dismiss(app, listOf(id))
    CapturePromptNotifier.enqueueAction(app, id, action)
    CapturePromptModule.emitAction(id, action)
  }
}
