/**
 * Buckets — bank-alert importer (Google Apps Script)
 *
 * Bind this to the dedicated Gmail account (jazlynlim99@gmail.com).
 * It reads only emails labelled `buckets-import`, POSTs each to the Buckets
 * Convex HTTP endpoint with a shared secret, then marks them processed by
 * swapping the label so they're never sent twice.
 *
 * SETUP
 *  1. script.google.com → New project → paste this file.
 *  2. Project Settings → Script properties → add:
 *       IMPORT_URL    = https://<YOUR-DEPLOYMENT>.convex.site/import-email
 *       IMPORT_SECRET = <the same secret you set in Convex>
 *  3. Run `importBankAlerts` once manually to grant Gmail permission.
 *  4. Triggers (clock icon) → Add trigger → importBankAlerts →
 *       time-driven → minutes timer → every 15 minutes.
 */

var SOURCE_LABEL = 'buckets-import';
var DONE_LABEL = 'buckets-imported';
var BATCH_SIZE = 25;

function importBankAlerts() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('IMPORT_URL');
  var secret = props.getProperty('IMPORT_SECRET');
  if (!url || !secret) {
    throw new Error('Set IMPORT_URL and IMPORT_SECRET in Script properties.');
  }

  var source = GmailApp.getUserLabelByName(SOURCE_LABEL);
  if (!source) {
    Logger.log('No "%s" label yet — nothing to do.', SOURCE_LABEL);
    return;
  }
  var done =
    GmailApp.getUserLabelByName(DONE_LABEL) ||
    GmailApp.createLabel(DONE_LABEL);

  var threads = source.getThreads(0, BATCH_SIZE);
  if (!threads.length) {
    Logger.log('Nothing new to import.');
    return;
  }

  threads.forEach(function (thread) {
    var messages = thread.getMessages();
    var payload = messages.map(function (m) {
      return {
        from: m.getFrom(),
        subject: m.getSubject(),
        body: m.getPlainBody(),
        messageId: m.getId(),
        receivedAt: m.getDate().getTime(),
      };
    });

    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Import-Secret': secret },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    var code = resp.getResponseCode();
    if (code >= 200 && code < 300) {
      // Swap labels so this thread is never reprocessed.
      thread.removeLabel(source);
      thread.addLabel(done);
    } else {
      // Leave the label in place so the next run retries.
      Logger.log('Import failed (%s): %s', code, resp.getContentText());
    }
  });
}
