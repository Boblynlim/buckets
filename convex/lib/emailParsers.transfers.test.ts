import { parseBankEmail } from './emailParsers';

// Shapes taken from real OCBC / DBS alerts; names, account and reference
// numbers are made up.

const ocbc = (body: string, subject = 'OCBC alert') =>
  parseBankEmail({ from: 'Notifications@ocbc.com', subject, body });

describe('OCBC transfers out', () => {
  it('reads a funds transfer to another bank as money out, not income', () => {
    const r = ocbc(
      'We have processed your funds transfer request Dear Valued Customer We have ' +
        'received your request to make the following transfer: Date of Transfer : ' +
        '30 Sep 2026 Time of Transfer : 07.46 AM SGT Amount : SGD 1100.00 From your ' +
        'account : 360 Account (-111111) To account : House (-222222) at UNITED ' +
        'OVERSEAS BANK LTD Reference number : 2609300000000001 You can log in to OCBC'
    );
    expect(r.direction).toBe('out');
    expect(r.amount).toBe(1100);
    expect(r.merchant).toBe('House');
    expect(r.skip).toBeFalsy();
    expect(r.date).toBe(Date.UTC(2026, 8, 30, 12, 0, 0));
  });

  it('keeps the destination name for an investment platform account', () => {
    const r = ocbc(
      'We have processed your funds transfer request Dear Valued Customer We have ' +
        'received your request to make the following transfer: Date of Transfer : ' +
        '30 Aug 2026 Time of Transfer : 07.48 AM SGT Amount : SGD 250.00 From your ' +
        'account : 360 Account (-111111) To account : UOB KAY HIAN P L (-333333) at ' +
        'HSBC (CORPORATE) Reference number : 2508300000000002 You can log in'
    );
    expect(r.direction).toBe('out');
    expect(r.merchant).toBe('UOB KAY HIAN P L');
  });

  it('skips "upcoming recurring transfer" reminders (the real alert follows later)', () => {
    const r = ocbc(
      'OCBC Reminder: Upcoming recurring funds transfer Dear Valued Customer As you ' +
        'instructed, we will make the following transfer: Transfer Date : 01 Oct 2026 ' +
        'Amount : SGD 1100.00 From your account : 360 Account (-111111) To account : ' +
        'House (-222222) at UNITED OVERSEAS BANK LTD'
    );
    expect(r.skip).toBe(true);
  });

  it('keeps a PayNow name that contains a stray bracket', () => {
    const r = ocbc(
      'Dear Valued Customer SGD300.00 was sent to TAN AH KOW (TAN using his/her mobile ' +
        'number (+XXXXXX1234) from the account you linked to Google Pay. Here are the ' +
        'details: Date of transfer: 02-Oct-2026 Time of transfer: 8:30 AM SG Time'
    );
    expect(r.direction).toBe('out');
    expect(r.merchant).toBe('TAN AH KOW');
  });

  it('reads "the following PayNow transfer has been made to"', () => {
    const r = ocbc(
      'Dear Valued Customer The following PayNow transfer has been made to LIM BEE ' +
        'HONG using his/her Mobile (+******1234). Date : 21 Jul 2026 Time : 11:41 AM ' +
        'SGT Amount : SGD 500.00 From your account : 360 Account'
    );
    expect(r.direction).toBe('out');
    expect(r.amount).toBe(500);
    expect(r.merchant).toBe('LIM BEE HONG');
  });

  it('reads "we have sent money to" (UEN / virtual payment address)', () => {
    const r = ocbc(
      'Dear Valued Customer, As you requested, we have sent money to WISE ASIA-PACIFIC ' +
        'PTE LTD using Virtual Payment Address UEN number UEN000000000X#WISE. Here are ' +
        'the details of your transfer: Date of Transfer : 12 Aug 2026 Amount : SGD 280.00'
    );
    expect(r.direction).toBe('out');
    expect(r.amount).toBe(280);
    expect(r.merchant).toBe('WISE ASIA-PACIFIC PTE LTD');
  });
});

describe('HSBC descriptions with payment-processor prefixes', () => {
  it('keeps names with * in them', () => {
    const r = parseBankEmail({
      from: 'x@notification.hsbc.com.hk',
      subject: 'Transaction Alerts (Credit Card)',
      body:
        'Dear Customer Please note there was a transaction made on your HSBC credit card. ' +
        'Card Number XXXX-XXXX-XXXX-0000 Transaction Date 15/SEP/2026 Transaction Amount ' +
        'SGD38.15 Description Qas*7am Hair Pte Ltd You can also log on to the HSBC app',
    });
    expect(r.merchant).toBe('Qas*7am Hair Pte Ltd');
  });
});

describe('DBS / POSB / PayLah', () => {
  const dbs = (body: string, subject = 'digibank Alerts') =>
    parseBankEmail({ from: 'ibanking.alert@dbs.com', subject, body });

  it('reads a PayLah payment as money out with the merchant', () => {
    const r = dbs(
      'Transaction Ref: 00000000 Dear Sir / Madam, We refer to your PayLah! ' +
        'transaction on 03 Oct 2026 12:41 SGT. Amount: SGD 6.50 From: PayLah! Wallet ' +
        '(Mobile ending 1234) To: KOPI CORNER If you did not make this transaction',
      'PayLah! Alerts'
    );
    expect(r.bank).toBe('dbs');
    expect(r.direction).toBe('out');
    expect(r.amount).toBe(6.5);
    expect(r.merchant).toBe('KOPI CORNER');
  });

  it('reads a POSB funds transfer / bill payment as money out with the payee', () => {
    const r = dbs(
      'Transaction Ref: 00000000 Dear Sir / Madam, We refer to your funds transfer ' +
        'dated 05 Oct 2026 09:10 SGT. Amount: SGD 812.40 From: My Account A/C ending ' +
        '5678 To: HSBC CREDIT CARD If unauthorised, please call'
    );
    expect(r.direction).toBe('out');
    expect(r.amount).toBe(812.4);
    expect(r.merchant).toBe('HSBC CREDIT CARD');
  });

  it('still reads money received as income', () => {
    const r = dbs(
      'Dear Customer, You have received SGD 24.00 via PayNow on 04 Apr 2026 20:34 SGT. ' +
        'From: JANE TAN To: Your DBS/ POSB account ending 0000'
    );
    expect(r.direction).toBe('in');
    expect(r.merchant).toBe('JANE TAN');
  });
});
