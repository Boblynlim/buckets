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
  // A heads-up, not a transaction (e.g. OCBC's "upcoming recurring transfer"
  // reminder). The real alert follows when the money moves, so skip these.
  skip?: boolean;
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
    // DBS wraps field labels in markdown-ish bold markers when the HTML is
    // flattened: "*Amount: *SGD 137.10", "* From:* NAME". Unwrap the label so
    // the field regexes below see a plain "Label: value". HSBC merchant names
    // genuinely contain "*" ("Grab* 5-C8E...", "SMP**MODU"), so only the
    // label form is touched, never a bare asterisk.
    .replace(/\*\s*(Amount|From|To|Date(?: and| &)? Time|Date)\s*:\s*\*/gi, "$1: ")
    .trim();
}

// Trailing account qualifiers DBS appends to a counterparty name:
// "Xing Han (Mobile ending 0427)" -> "Xing Han".
function stripAccountSuffix(s: string | undefined): string | undefined {
  if (!s) return s;
  return s
    .replace(/\s*\((?:Mobile|A\/C|Ref|Account|Card)\s+ending[^)]*\)\s*$/i, "")
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
  // DBS PayLah! and bill-payment alerts omit the year entirely
  // ("Date & Time: 14 Oct 11:42 (SGT)"). Borrow the year from when the mail
  // arrived, stepping back one year if that would date the spend in the
  // future — a 31 Dec alert read on 1 Jan belongs to the old year.
  const dayMon = text.match(
    /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i
  );
  if (dayMon && fallback) {
    const day = Number(dayMon[1]);
    const mon = MONTHS[dayMon[2].toLowerCase()];
    const ref = new Date(fallback);
    let t = Date.UTC(ref.getUTCFullYear(), mon, day, 12, 0, 0);
    if (t - fallback > 7 * 24 * 60 * 60 * 1000) {
      t = Date.UTC(ref.getUTCFullYear() - 1, mon, day, 12, 0, 0);
    }
    if (!Number.isNaN(t)) return t;
  }
  return fallback ?? Date.UTC(1970, 0, 1);
}

function clean(s: string | undefined): string | undefined {
  if (!s) return undefined;
  let out = s.replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
  // Masked PayNow names arrive cut off mid-bracket ("TAN AH KOW (TAN").
  // Drop an unclosed trailing bracket rather than keep half of it.
  const open = out.lastIndexOf("(");
  if (open > 0 && out.indexOf(")", open) === -1) out = out.slice(0, open).trim();
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
// Phrases that follow the "To:" / "From:" value in a DBS alert. Matching on
// these rather than on an allowlist of characters is what lets real payees
// through: "BUS/MRT", "AMIBA F&B PTE. LTD.", "MCDONALD'S (BWC)", "SMP_BIBI1".
const DBS_TAIL =
  "If\\b|To view your transactions|Didn['’]t expect|Please call|Thank you for banking|Yours faithfully|$";

function parseDbs(text: string, at?: number): Omit<ParsedTxn, "bank"> | null {
  const amt = findAmount(text);
  if (!amt) return null;
  const direction = detectDirection(text);
  // For received transfers, the counterparty is the payer ("From: NAME To:").
  const payer = clean(
    stripAccountSuffix(
      (text.match(/\bFrom:\s*(.{2,60}?)\s*\bTo:/i) || [])[1]
    )
  );
  const sentTo = clean(
    (text.match(/(?:paid|sent) to ([A-Za-z0-9 &'._\-]{2,40}?)(?: using| on| via|\.)/i) ||
      [])[1]
  );
  const toField = clean(
    stripAccountSuffix(
      (text.match(new RegExp(`\\bTo:\\s*(.{2,60}?)\\s+(?:${DBS_TAIL})`, "i")) ||
        [])[1]
    )
  );
  return {
    direction,
    amount: amt.amount,
    currency: amt.currency,
    merchant: direction === "in" ? payer : sentTo ?? toField,
    date: parseDate(text, at),
    last4: last4From(text),
  };
}

// --- OCBC ---------------------------------------------------------------------
// Outgoing: "SGD4.20 was sent to Hainanese curry rice using ... Date of transfer: 26-May-2026"
function parseOcbc(text: string, at?: number): Omit<ParsedTxn, "bank"> | null {
  const amt = findAmount(text);
  if (!amt) return null;

  // "To account : House (-222222) at UNITED OVERSEAS BANK LTD" -> "House"
  const toAccount =
    clean((text.match(/To account\s*:\s*(.+?)\s*\(-?\d+\)/i) || [])[1]) ??
    // PayNow/QR transfers carry no "To account" row, only a free-text
    // description: "Description : Bkk Reference number : 2607210119298453".
    clean(
      (text.match(
        /Description(?:\/reference no\.)?\s*:\s*(.{1,60}?)\s+(?:Reference number|You can also|If you have|$)/i
      ) || [])[1]
    );

  // Reminder ahead of a scheduled transfer: not a transaction itself.
  if (/upcoming recurring funds transfer|we will make the following transfer/i.test(text)) {
    return {
      direction: "out",
      amount: amt.amount,
      currency: amt.currency,
      merchant: toAccount,
      date: parseDate(text, at),
      skip: true,
    };
  }

  // "We have received your request to make the following transfer" is money
  // OUT; the word "received" here must not flip it to income.
  if (/funds transfer request|make the following transfer/i.test(text)) {
    return {
      direction: "out",
      amount: amt.amount,
      currency: amt.currency,
      merchant: toAccount,
      date: parseDate(text, at),
    };
  }

  // "A deposit was made in your account ... Reference: from WANDERING STUD"
  if (/deposit was made in your account|deposit in your account/i.test(text)) {
    return {
      direction: "in",
      amount: amt.amount,
      currency: amt.currency,
      merchant: clean((text.match(/Reference:\s*(?:from\s+)?([A-Za-z0-9 &'._\-]{2,40}?)(?:\s+For assistance|\s+If |\.|$)/i) || [])[1]),
      date: parseDate(text, at),
    };
  }

  const direction = detectDirection(text);
  const sentTo = clean(
    (text.match(
      /(?:sent to|transfer has been made to|sent money to) ([A-Za-z0-9 &'._\-()]{2,60}?)(?: using| on|\.)/i
    ) || [])[1]
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
    date: parseDate(text, at),
    last4: last4From(text),
  };
}

// --- HSBC ---------------------------------------------------------------------
// Card spend, label/value table:
//   Transaction Amount  SGD6.98
//   Description         BUS/MRT
//   Transaction Date    20/JUN/2026
//   Card Number         XXXX-XXXX-XXXX-8219
function parseHsbc(text: string, at?: number): Omit<ParsedTxn, "bank"> | null {
  // Prefer the labelled "Transaction Amount" cell; fall back to first amount.
  const labelled = text.match(
    /Transaction Amount\s+(SGD|USD|HKD|S\$|US\$)\s?([\d,]+\.\d{2})/i
  );
  const amt = labelled
    ? { amount: parseAmount(labelled[2]), currency: normCurrency(labelled[1]) }
    : findAmount(text);
  if (!amt) return null;
  // Capture up to the boilerplate rather than by allowed characters — real
  // descriptors carry parens, "@", "_" and stars: "MCDONALD'S (BWC)",
  // "SUSHIRO @ THE LINQ", "SMP_BIBI1 PTE. LTD.", "Grab* 5-C8ETT76ERJX1UE".
  const description = clean(
    (text.match(
      /Description\s+(.{1,60}?)\s+(?:You can also|Yours|Thank you|$)/i
    ) || [])[1]
  );
  return {
    direction: detectDirection(text), // "made on your ... card" => out
    amount: amt.amount,
    currency: amt.currency,
    merchant: description,
    date: parseDate(text, at),
    last4: last4From(text),
  };
}

// --- American Express ---------------------------------------------------------
function parseAmex(text: string, at?: number): Omit<ParsedTxn, "bank"> | null {
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
    date: parseDate(text, at),
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
  (text: string, at?: number) => Omit<ParsedTxn, "bank"> | null
> = {
  dbs: parseDbs,
  ocbc: parseOcbc,
  hsbc: parseHsbc,
  amex: parseAmex,
};

// Alerts that arrive on the same channel but describe no money movement:
// linkage/security notices, statement-ready mails, seasonal promos. Without
// this they land in the queue as amount-0 rows with nothing to review.
const NOT_A_TRANSACTION =
  /automatically expired|eDocument|e-?Packets? are now available|Problems viewing this email\?\s*Select "always display images"\s*(?:\[image[^\]]*\]\s*)?Dear Sir\/Madam, For your account security/i;

export function parseBankEmail(email: RawEmail): ParsedTxn {
  const text = toPlainText(email.body);
  const bank = detectBank(email.from, text);

  if (!findAmount(text) && NOT_A_TRANSACTION.test(text)) {
    return {
      bank: bank ?? "unknown",
      direction: "out",
      amount: 0,
      currency: "SGD",
      date: email.receivedAt ?? Date.UTC(1970, 0, 1),
      skip: true,
    };
  }

  let parsed: Omit<ParsedTxn, "bank"> | null = null;
  let resolvedBank: ParsedTxn["bank"] = bank ?? "unknown";

  if (bank) {
    parsed = PARSERS[bank](text, email.receivedAt);
  }
  // If detection failed or its parser bailed, cross-try everything.
  if (!parsed) {
    for (const key of Object.keys(PARSERS) as Array<keyof typeof PARSERS>) {
      const p = PARSERS[key](text, email.receivedAt);
      if (p) {
        parsed = p;
        resolvedBank = bank ?? "unknown";
        break;
      }
    }
  }

  if (parsed && Number.isFinite(parsed.amount) && parsed.amount > 0) {
    // (parsed.skip, when set, rides along so the caller can drop reminders.)
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
