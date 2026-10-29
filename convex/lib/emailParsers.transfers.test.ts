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

describe('OCBC money in', () => {
  it('reads a deposit alert as income from the sender', () => {
    const r = parseBankEmail({
      from: 'x@forwarded.example',
      subject: 'Fwd: OCBC Alert: Deposit in your account',
      body:
        'Subject: OCBC Alert: Deposit in your account Dear Valued Customer, A deposit was made in ' +
        'your account. Here are the details: Time of deposit: 11:10 AM Amount: SGD 6,400.00 Account ' +
        'that money was deposited in: (-000000) Reference: from Wandering Stud For assistance at any time',
    });
    expect(r.direction).toBe('in');
    expect(r.amount).toBe(6400);
    expect(r.merchant).toBe('Wandering Stud');
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

// Shapes taken verbatim from real forwarded alerts (names/cards scrubbed).
// Each of these used to lose the merchant because the old field regexes
// allow-listed characters and depended on a fixed terminator word.
describe('real alert shapes', () => {
  const dbs = (body: string) =>
    parseBankEmail({ from: 'ibanking.alert@dbs.com', subject: '', body });

  it('keeps a slash in a DBS card payee', () => {
    const r = dbs(
      'Card Transaction Alert Transaction Ref: SP1300516540000000053109 Dear Sir / ' +
        'Madam, We refer to your card transaction request dated 13/10/26. Date & Time: ' +
        '13 OCT 05:31 (SGT) Amount: SGD3.38 From: DBS/POSB card ending 3284 To: BUS/MRT ' +
        'If unauthorised, please login to DBS digibank mobile'
    );
    expect(r.amount).toBe(3.38);
    expect(r.merchant).toBe('BUS/MRT');
    expect(r.last4).toBe('3284');
    expect(new Date(r.date).toISOString().slice(0, 10)).toBe('2026-10-13');
  });

  it('ends a PayLah payee at "To view your transactions"', () => {
    const r = dbs(
      'Transaction Alerts Transaction Ref: PLPE4628709104998098 Dear Sir / Madam, We ' +
        'refer to your PayLah! Scan & Pay Transfer dated 14 Oct. Date & Time: 14 Oct ' +
        '11:42 (SGT) Amount: SGD5.30 From: PayLah! Wallet (Mobile ending 2570) To: ' +
        'MING FA FISHBALL To view your transactions, login to your PayLah! Wallet'
    );
    expect(r.merchant).toBe('MING FA FISHBALL');
  });

  it('drops the "(Mobile ending ...)" tail from a person-to-person payee', () => {
    const r = dbs(
      'Transaction Alerts Dear Sir / Madam, We refer to your PayLah! Transfer dated ' +
        '27 Sep. Date & Time: 27 Sep 18:50 (SGT) Amount: SGD50.00 From: PayLah! Wallet ' +
        '(Mobile ending 2570) To: Xing Han (Mobile ending 0427) To view your transactions'
    );
    expect(r.merchant).toBe('Xing Han');
  });

  it('unwraps DBS bold-marker labels on a bill payment', () => {
    const r = dbs(
      'digibank alert Transaction Ref: 17819172935812756295 Dear Customer, You’ve ' +
        'successfully made a bill payment. *Date and Time: *20 Jun 09:01 (SGT) *Amount: ' +
        '*SGD 137.10 *From: *POSB Passbook Savings Account (A/C ending 0613) *To: *DBS ' +
        'Altitude Visa Signature Card (Ref ending 3284) If unauthorised, please call'
    );
    expect(r.amount).toBe(137.1);
    expect(r.merchant).toBe('DBS Altitude Visa Signature Card');
  });

  it('unwraps bold markers around the payer on a received PayNow transfer', () => {
    const r = dbs(
      'Dear Customer, You have received SGD 53.00 via PayNow on 25 Oct 2026 01:16 SGT. ' +
        '* From:* CHUA PEI RONG, VIVIAN *To:* Your DBS/ POSB account ending 0613 Didn’t ' +
        'expect these funds?'
    );
    expect(r.direction).toBe('in');
    expect(r.merchant).toBe('CHUA PEI RONG, VIVIAN');
  });

  it('dates a yearless alert from when the mail arrived', () => {
    const r = parseBankEmail({
      from: 'ibanking.alert@dbs.com',
      subject: '',
      body:
        'Dear Sir / Madam, We refer to your PayLah! Scan & Pay Transfer dated 31 Dec. ' +
        'Date & Time: 31 Dec 23:55 (SGT) Amount: SGD4.00 From: PayLah! Wallet To: ' +
        'LATE NIGHT PRATA To view your transactions',
      receivedAt: Date.UTC(2027, 0, 1, 2, 0, 0), // read on 1 Jan, spent 31 Dec
    });
    expect(new Date(r.date).toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('keeps parentheses and symbols in an HSBC description', () => {
    const hsbc = (desc: string) =>
      parseBankEmail({
        from: 'alerts@notification.hsbc.com.hk',
        subject: '',
        body:
          'Dear Customer Please note there was a transaction made on your HSBC credit ' +
          'card. Card Number XXXX-XXXX-XXXX-8219 Transaction Date 29/OCT/2026 ' +
          'Transaction Time 08:00:20 Transaction Amount SGD6.95 Description ' +
          desc +
          ' You can also log on to the HSBC Singapore app',
      }).merchant;
    expect(hsbc("MCDONALD'S (BWC)")).toBe("MCDONALD'S (BWC)");
    expect(hsbc('SUSHIRO @ THE LINQ')).toBe('SUSHIRO @ THE LINQ');
    expect(hsbc('SMP_BIBI1 PTE. LTD.')).toBe('SMP_BIBI1 PTE. LTD');
    expect(hsbc('Grab* 5-C8ETT76ERJX1UE')).toBe('Grab* 5-C8ETT76ERJX1UE');
  });

  it('skips DBS notices that move no money', () => {
    const r = dbs(
      'Transaction Alerts Problems viewing this email? Select "always display images" ' +
        'Dear Sir/Madam, For your account security, Express Checkout linkage with GOJEK ' +
        'automatically expired on Date & Time: 01 Sep 2026 02:01 (SGT).'
    );
    expect(r.skip).toBe(true);
  });
});
