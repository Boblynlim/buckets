import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { parseBankEmail, dedupeKeyFor, RawEmail } from "./lib/emailParsers";

const http = httpRouter();

type InboundEmail = {
  from: string;
  subject: string;
  body: string;
  messageId?: string;
  receivedAt?: number; // ms; Apps Script sends message.getDate().getTime()
};

/**
 * Inbound endpoint for forwarded bank-alert emails.
 *
 * Auth: a shared secret in the `X-Import-Secret` header, compared against the
 * BUCKETS_IMPORT_SECRET env var. Only the Google Apps Script bound to the
 * dedicated Gmail account knows this secret. No mailbox access lives here —
 * the script pushes us the handful of emails it has already filtered.
 *
 * Body: a single InboundEmail or an array of them (the script may batch).
 */
const importEmail = httpAction(async (ctx, request) => {
  const secret = process.env.BUCKETS_IMPORT_SECRET;
  if (!secret) {
    console.error("import-email: BUCKETS_IMPORT_SECRET not configured");
    return new Response("Server not configured", { status: 500 });
  }
  const provided = request.headers.get("X-Import-Secret");
  if (!provided || provided !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: InboundEmail | InboundEmail[];
  try {
    payload = await request.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const emails = Array.isArray(payload) ? payload : [payload];

  const results: Array<{ status: string }> = [];
  for (const e of emails) {
    if (!e || typeof e.body !== "string" || typeof e.from !== "string") {
      results.push({ status: "skipped_invalid" });
      continue;
    }
    const raw: RawEmail = {
      from: e.from,
      subject: e.subject ?? "",
      body: e.body,
      receivedAt: e.receivedAt,
    };
    const parsed = parseBankEmail(raw);
    const dedupeKey = dedupeKeyFor(e.messageId, parsed);
    const rawSource = e.body.slice(0, 4000); // cap stored raw text

    // Money received (PayNow in, refunds) isn't a spend — capture it as income
    // straight away rather than queueing it as an expense.
    if (parsed.direction === "in") {
      const res = await ctx.runMutation(
        internal.pendingTransactions.ingestIncome,
        {
          bank: parsed.bank,
          amount: parsed.amount,
          currency: parsed.currency,
          merchant: parsed.merchant,
          date: parsed.date,
          dedupeKey,
          rawSource,
        }
      );
      results.push({ status: res.status });
      continue;
    }

    const res = await ctx.runMutation(internal.pendingTransactions.ingest, {
      bank: parsed.bank,
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      date: parsed.date,
      last4: parsed.last4,
      dedupeKey,
      rawSource,
    });
    results.push({ status: res.status });
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

http.route({ path: "/import-email", method: "POST", handler: importEmail });

export default http;
