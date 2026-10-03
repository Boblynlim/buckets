// Turn a bank's merchant text into a stable key for learned filing rules,
// and spot payment companies whose name says nothing about what was bought.
//
// Conservative on purpose: when unsure, keep more of the name. A key that is
// too specific just means the app asks once more; one that is too loose would
// file things into the wrong cup.

const PAYMENT_COMPANIES = [
  "qashier",
  "pine payment",
  "nets",
  "fomo pay",
  "hitpay",
  "stripe",
  "paypal",
  "2c2p",
  "adyen",
  "razer",
  "shopeepay",
  "atome",
];

// A token that looks like a transaction reference: mixes letters and digits
// and is long, or is a long run of digits.
function isRefToken(t: string): boolean {
  const s = t.replace(/[^a-z0-9]/gi, "");
  if (s.length >= 4 && /^\d+$/.test(s)) return true;
  return s.length >= 6 && /\d/.test(s) && /[a-z]/i.test(s);
}

export function merchantKey(name: string | undefined | null): string {
  if (!name) return "";
  let tokens = name.toLowerCase().replace(/\s+/g, " ").trim().split(" ");
  // Drop trailing reference numbers ("Grab* 5-C8ETT76ERJX1UE" -> "grab*").
  while (tokens.length > 1 && isRefToken(tokens[tokens.length - 1])) tokens.pop();
  let key = tokens.join(" ");
  // Company suffixes carry no meaning for filing.
  key = key.replace(/[\s,]+(pte\.?\s*ltd\.?|pte\.?|ltd\.?|sdn\.?\s*bhd\.?|inc\.?)$/i, "");
  // "grab*" -> "grab"; keep inner * ("qas*7am hair") which names the shop.
  key = key.replace(/[*#\s.\-]+$/, "").trim();
  return key;
}

// True when the name is just the payment company, so the same key could be
// lunch one day and a haircut the next. These always ask.
export function isPaymentCompany(name: string | undefined | null): boolean {
  const key = merchantKey(name);
  if (!key) return true; // nothing to learn from
  return PAYMENT_COMPANIES.some((p) => key === p || key.startsWith(p + " ") || key.startsWith(p + "-"));
}
