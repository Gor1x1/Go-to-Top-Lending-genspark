/**
 * Telegram notification helper — sends lead notifications via Telegram Bot API
 */

export async function notifyTelegram(db: D1Database, leadData: any) {
  try {
    const configs = await db.prepare('SELECT * FROM telegram_bot_config WHERE is_active = 1 AND notify_leads = 1').all();
    for (const cfg of configs.results) {
      const token = cfg.bot_token as string;
      const chatId = cfg.chat_id as string;
      if (!token || !chatId) continue;
      const text = `\ud83d\udd14 <b>\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u044f\u0432\u043a\u0430!</b>\n\n` +
        `\ud83d\udc64 <b>\u0418\u043c\u044f:</b> ${leadData.name || '\u2014'}\n` +
        `\ud83d\udcf1 <b>\u041a\u043e\u043d\u0442\u0430\u043a\u0442:</b> ${leadData.contact || '\u2014'}\n` +
        `\ud83d\udce6 <b>\u041f\u0440\u043e\u0434\u0443\u043a\u0442:</b> ${leadData.product || '\u2014'}\n` +
        `\ud83d\udee0 <b>\u0423\u0441\u043b\u0443\u0433\u0430:</b> ${leadData.service || '\u2014'}\n` +
        `\ud83d\udcac <b>\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435:</b> ${leadData.message || '\u2014'}\n` +
        `\ud83c\udf10 <b>\u042f\u0437\u044b\u043a:</b> ${leadData.lang || '\u2014'}\n` +
        `\ud83d\udccb <b>\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a:</b> ${leadData.source || 'form'}\n` +
        (leadData.referral_code ? `\ud83c\udf81 <b>\u0420\u0435\u0444. \u043a\u043e\u0434:</b> ${leadData.referral_code}\n` : '') +
        `\ud83d\udd50 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Yerevan' })}`;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
      }).catch(() => {});
    }
  } catch {}
}
