import { parseBankEmail, dedupeKeyFor } from './emailParsers';

// Bodies below mirror what Apps Script's getPlainBody() yields for the real
// forwarded alerts (HSBC has a text/plain part; DBS & OCBC are HTML-only and
// get stripped to text). Amounts/cards are as sampled.

describe('parseBankEmail', () => {
  it('parses an HSBC credit-card spend (table format)', () => {
    const r = parseBankEmail({
      from: 'HSBC Singapore <HSBC.Bank.Singapore.Limited@notification.hsbc.com.hk>',
      subject: 'Transaction Alerts (Credit Card)',
      body: [
        'Dear Customer',
        'Please note there was a transaction made on your HSBC credit card.',
        'Card Number',
        'XXXX-XXXX-XXXX-8219',
        'Transaction Date',
        '20/JUN/2026',
        'Transaction Time',
        '06:36:40',
        'Transaction Amount',
        'SGD6.98',
        'Description',
        'BUS/MRT',
        'You can also log on to the HSBC Singapore app to view your recent transactions.',
      ].join('\n'),
    });
    expect(r.bank).toBe('hsbc');
    expect(r.direction).toBe('out');
    expect(r.amount).toBe(6.98);
    expect(r.currency).toBe('SGD');
    expect(r.merchant).toBe('BUS/MRT');
    expect(r.last4).toBe('8219');
    expect(r.date).toBe(Date.UTC(2026, 5, 20, 12, 0, 0));
  });

  it('parses an OCBC outgoing PayNow/Google Pay transfer', () => {
    const r = parseBankEmail({
      from: 'Notifications@ocbc.com',
      subject: 'Your funds transfer via Google Pay is successful',
      body:
        'Dear Valued Customer SGD4.20 was sent to Hainanese curry rice using ' +
        'his/her mobile number (+XXXXXX0314) from the account you linked to ' +
        'Google Pay. Here are the details: Date of transfer: 26-May-2026 ' +
        'Time of transfer: 11:40 AM SG Time',
    });
    expect(r.bank).toBe('ocbc');
    expect(r.direction).toBe('out');
    expect(r.amount).toBe(4.2);
    expect(r.currency).toBe('SGD');
    expect(r.merchant).toBe('Hainanese curry rice');
    expect(r.date).toBe(Date.UTC(2026, 4, 26, 12, 0, 0));
    // The masked phone number must NOT be mistaken for a card last-4.
    expect(r.last4).toBeUndefined();
  });

  it('flags a DBS received transfer as incoming (money in)', () => {
    const r = parseBankEmail({
      from: 'ibanking.alert@dbs.com',
      subject: "digibank Alerts - You've received a transfer",
      body:
        'Transaction Ref: PIB2604049854189469 C120520342290 Dear Customer, ' +
        'You have received SGD 24.00 via PayNow on 04 Apr 2026 20:34 SGT. ' +
        'From: SHANNON GOH To: Your DBS/ POSB account ending 0613 ' +
        "Didn't expect these funds?",
    });
    expect(r.bank).toBe('dbs');
    expect(r.direction).toBe('in'); // must be skipped, not turned into a spend
    expect(r.amount).toBe(24);
    expect(r.merchant).toBe('SHANNON GOH');
    expect(r.date).toBe(Date.UTC(2026, 3, 4, 12, 0, 0));
  });

  it('falls back to unknown (amount 0) when nothing parses', () => {
    const r = parseBankEmail({
      from: 'Newsletter <hi@example.com>',
      subject: 'Weekly digest',
      body: 'No money here, just vibes.',
      receivedAt: 1750384800000,
    });
    expect(r.bank).toBe('unknown');
    expect(r.amount).toBe(0);
    expect(r.date).toBe(1750384800000);
  });

  it('dedupeKey prefers the message id', () => {
    const r = parseBankEmail({
      from: 'Notifications@ocbc.com',
      subject: 'x',
      body: 'SGD5.00 was sent to SHOP using mobile. Date of transfer: 01-Jan-2026',
    });
    expect(dedupeKeyFor('abc123', r)).toBe('mid:abc123');
    expect(dedupeKeyFor(undefined, r)).toMatch(/^txn:ocbc:5:/);
  });
});
