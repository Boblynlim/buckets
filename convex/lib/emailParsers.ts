// Per-bank parsers for forwarded transaction-alert emails.
//
// Each parser is a pure function over the raw email and returns a normalized
// ParsedTxn (or an "unknown" fallback). Tuned against real DBS / OCBC / HSBC
// alert samples — see emailParsers.test.ts for the exact shapes.
//
// IMPORTANT:
//  - Parsers must never throw. On any doubt, fall back to "unknown" so the
//    email still surfaces for manual review rather than vanishing.
//  - `direction` matters: "in" = money received (NOT a spend), "out" = money
//    spent. The caller skips "in" transfers so received funds never become
//    phantom expenses.

export type ParsedTxn = {
  bank: "dbs" | "ocbc" | "hsbc" | "amex" | "unknown";
  direction: "in" | "out";
  amount: number;
  currency: string;
  merchant?: string; // merchant or transaction description (used as the note)
  date: number; // ms timestamp
  last4?: string; // card last-4, when the alert exposes it
};

export type RawEmail = {
  from: string; // e.g. "HSBC Singapore <...@notification.hsbc.com.hk>"
  subject: string;
  body: string; // plain-text or HTML body
  receivedAt?: number; // fallback date if the body has none
};

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Collapse HTML / multi-line bodies into a single clean line of text. Apps
// Script usually hands us plain text already, but DBS and OCBC alerts are
// HTML-only, so we strip defensively and normalise whitespace.
function toPlainText(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&zwnj;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[  ]/g, " ") // non-breaking / narrow no-break spaces
    .replace(/\s+/g, " ")
    .trim();
}

function parseAmount(raw: string): number {
  return Number(raw.replace(/,/g, "").trim());
}

function normCurrency(raw: string): string {
  const u = raw.toUpperCase();
  if (u === "S$") return "SGD";
  if (u === "US$") return "USD";
  return u;
}

// First currency+amount in the text, e.g. "SGD6.98", "SGD 24.00", "US$ 5.00".
function findAmount(text: string): { amount: number; currency: string } | null {
  const m = text.match(/(SGD|USD|HKD|S\$|US\$)\s?([\d,]+\.\d{2})/i);
  if (m) return { amount: parseAmount(m[2]), currency: normCurrency(m[1]) };
  const bare = text.match(/\$\s?([\d,]+\.\d{2})/);
  if (bare) return { amount: parseAmount(bare[1]), currency: "USD" };
  return null;
}

// Dates seen in the wild: "20/JUN/2026", "26-May-2026", "04 Apr 2026",
// and numeric "20/06/2026". Month name is required to be real, and a 4-digit
// year must be present, so transaction refs full of digits don't false-match.
function parseDate(text: string, fallback?: number): number {
  const named = text.match(
    /(\d{1,2})[\s\-\/](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-\/](\d{4})/i
  );
  if (named) {
    const day = Number(named[1]);
    const mon = MONTHS[named[2].toLowerCase()];
    const year = Number(named[3]);
    const t = Date.UTC(year, mon, day, 12, 0, 0);
    if (!Number.isNaN(t)) return t;
  }
  const slash = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slash) {
    const day = Number(slash[1]);
    const mon = Number(slash[2]) - 1;
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    const t = Date.UTC(year, mon, day, 12, 0, 0);
    if (!Number.isNaN(t)) return t;
  }
  return fallback ?? Date.UTC(1970, 0, 1);
}

function clean(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const out = s.replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
  return out.length ? out : undefined;
}

// Card last-4 only — deliberately strict so masked phone numbers like
// "(+XXXXXX0314)" are NOT mistaken for a card.
function last4From(text: string): string | undefined {
  const ending = text.match(/ending\s+(?:in\s+)?(\d{4})/i);
  if (ending) return ending[1];
  // Masked card: at least two "XXXX<sep>" groups before the visible digits.
  const masked = text.match(/(?:[X*]{4}[\s\-]){2,}(\d{4})/i);
  if (masked) return masked[1];
  return undefined;
}

// "in" if funds were received, "out" otherwise (the safe default for spends).
function detectDirection(text: string): "in" | "out" {
  const t = text.toLowerCase();
  const outish = /\bsent to\b|\bwas charged\b|made on your|\bpaid\b|\bdebited\b|you(?:'ve| have) made/.test(
    t
  );
  if (/\breceived\b/.test(t) && !outish) return "in";
  return "out";
}

// --- DBS / POSB ---------------------------------------------------------------
// Incoming: "You have received SGD 24.00 via PayNow on 04 Apr 2026 ... From: NAME"
function parseDbs(text: string): Omit<ParsedTxn, "bank"> | null {
  const amt = findAmount(text);
  if (!amt) return null;
  const direction = detectDirection(text);
  // For received transfers, the counterparty is the payer ("From: NAME To:").
  const payer = clean(
    (text.match(/From:\s*([A-Za-z][A-Za-z .'\-]{1,40}?)\s+To:/) || [])[1]
  );
  const sentTo = clean(
    (text.match(/(?:paid|sent) to ([A-Za-z0-9 &'._\-]{2,40}?)(?: using| on|\.)/i) ||
      [])[1]
  );
  return {
    direction,
    amount: amt.amount,
    currency: amt.currency,
    merchant: direction === "in" ? payer : sentTo,
    date: parseDate(text),
    last4: last4From(text),
  };
}

// --- OCBC ---------------------------------------------------------------------
// Outgoing: "SGD4.20 was sent to Hainanese curry rice using ... Date of transfer: 26-May-2026"
function parseOcbc(text: string): Omit<ParsedTxn, "bank"> | null {
  const amt = findAmount(text);
  if (!amt) return null;
  const direction = detectDirection(text);
  const sentTo = clean(
    (text.match(/sent to ([A-Za-z0-9 &'._\-]{2,40}?)(?: using| on|\.)/i) || [])[1]
  );
  const receivedFrom = clean(
    (text.match(/received .*?from ([A-Za-z0-9 &'._\-]{2,40}?)(?: using| on|\.)/i) ||
      [])[1]
  );
  return {
    direction,
    amount: amt.amount,
    currency: amt.currency,
    merchant: direction === "in" ? receivedFrom : sentTo,
    date: parseDate(text),
    last4: last4From(text),
  };
}

// --- HSBC ---------------------------------------------------------------------
// Card spend, label/value table:
//   Transaction Amount  SGD6.98
//   Description         BUS/MRT
//   Transaction Date    20/JUN/2026
//   Card Number         XXXX-XXXX-XXXX-8219
function parseHsbc(text: string): Omit<ParsedTxn, "bank"> | null {
  // Prefer the labelled "Transaction Amount" cell; fall back to first amount.
  const labelled = text.match(
    /Transaction Amount\s+(SGD|USD|HKD|S\$|US\$)\s?([\d,]+\.\d{2})/i
  );
  const amt = labelled
    ? { amount: parseAmount(labelled[2]), currency: normCurrency(labelled[1]) }
    : findAmount(text);
  if (!amt) return null;
  const description = clean(
    (text.match(
      /Description\s+([A-Za-z0-9 ,&'._\/\-]+?)\s+(?:You can also|Yours|$)/i
    ) || [])[1]
  );
  return {
    direction: detectDirection(text), // "made on your ... card" => out
    amount: amt.amount,
    currency: amt.currency,
    merchant: description,
    date: parseDate(text),
    last4: last4From(text),
  };
}

// --- American Express ---------------------------------------------------------
function parseAmex(text: string): Omit<ParsedTxn, "bank"> | null {
  const amt = findAmount(text);
  if (!amt) return null;
  const merchant = clean(
    (text.match(/merchant[:\s]+([A-Za-z0-9 &'._\-]{2,40})/i) ||
      text.match(/\bat\s+([A-Z0-9][A-Za-z0-9 &'._\-]{2,40})/) ||
      [])[1]
  );
  return {
    direction: detectDirection(text),
    amount: amt.amount,
    currency: amt.currency,
    merchant,
    date: parseDate(text),
    last4: last4From(text),
  };
}

// Identify the bank from sender domain first, then body keywords (a forwarded
// alert can carry the forwarder's address in From, so body is the backstop).
function detectBank(
  from: string,
  text: string
): Exclude<ParsedTxn["bank"], "unknown"> | null {
  const f = from.toLowerCase();
  if (/dbs\.com|posb\.com/.test(f)) return "dbs";
  if (/ocbc\.com/.test(f)) return "ocbc";
  if (/hsbc\./.test(f)) return "hsbc";
  if (/americanexpress\.com|aexp\.com/.test(f)) return "amex";

  const t = text.toLowerCase();
  if (/\bhsbc\b/.test(t)) return "hsbc";
  if (/\bocbc\b/.test(t)) return "ocbc";
  if (/digibank|\bdbs\b|\bposb\b/.test(t)) return "dbs";
  if (/american express|amex/.test(t)) return "amex";
  return null;
}

const PARSERS: Record<
  Exclude<ParsedTxn["bank"], "unknown">,
  (text: string) => Omit<ParsedTxn, "bank"> | null
> = {
  dbs: parseDbs,
  ocbc: parseOcbc,
  hsbc: parseHsbc,
  amex: parseAmex,
};

export function parseBankEmail(email: RawEmail): ParsedTxn {
  const text = toPlainText(email.body);
  const bank = detectBank(email.from, text);

  let parsed: Omit<ParsedTxn, "bank"> | null = null;
  let resolvedBank: ParsedTxn["bank"] = bank ?? "unknown";

  if (bank) {
    parsed = PARSERS[bank](text);
  }
  // If detection failed or its parser bailed, cross-try everything.
  if (!parsed) {
    for (const key of Object.keys(PARSERS) as Array<keyof typeof PARSERS>) {
      const p = PARSERS[key](text);
      if (p) {
        parsed = p;
        resolvedBank = bank ?? "unknown";
        break;
      }
    }
  }

  if (parsed && Number.isFinite(parsed.amount) && parsed.amount > 0) {
    // Stamp the date fallback now that we know receivedAt.
    return {
      bank: resolvedBank,
      ...parsed,
      date:
        parsed.date && parsed.date > Date.UTC(1971, 0, 1)
          ? parsed.date
          : email.receivedAt ?? parsed.date,
    };
  }

  return {
    bank: "unknown",
    direction: "out",
    amount: 0,
    currency: "SGD",
    merchant: undefined,
    date: email.receivedAt ?? Date.UTC(1970, 0, 1),
    last4: undefined,
  };
}

// Stable de-dup key. Prefer the email's Message-ID; else derive from fields.
export function dedupeKeyFor(
  messageId: string | undefined,
  parsed: ParsedTxn
): string {
  if (messageId && messageId.trim()) return `mid:${messageId.trim()}`;
  return `txn:${parsed.bank}:${parsed.amount}:${parsed.date}:${(
    parsed.merchant || ""
  ).toLowerCase()}`;
}
