import { merchantKey, isPaymentCompany } from './merchantKey';

describe('merchantKey', () => {
  it('lowercases and trims', () => {
    expect(merchantKey('  BUS/MRT ')).toBe('bus/mrt');
  });
  it('drops trailing transaction references', () => {
    expect(merchantKey('Grab* 5-C8ETT76ERJX1UE')).toBe('grab');
    expect(merchantKey('Grab* 5-ZZ99ABCDEF12')).toBe('grab');
  });
  it('drops company suffixes', () => {
    expect(merchantKey('GOMO BY SINGTEL')).toBe('gomo by singtel');
    expect(merchantKey('SURE AESTHETIC PTE. LTD')).toBe('sure aesthetic');
    expect(merchantKey('DONER KEBAB TURKISH PTE LTD')).toBe('doner kebab turkish');
  });
  it('keeps the shop name after a processor prefix', () => {
    expect(merchantKey('Qas*7am Hair Pte Ltd')).toBe('qas*7am hair');
    expect(merchantKey('SMP**MODU Samgyetang')).toBe('smp**modu samgyetang');
  });
  it('keeps short names with digits', () => {
    expect(merchantKey('7-ELEVEN')).toBe('7-eleven');
  });
});

describe('isPaymentCompany', () => {
  it('flags names that are only a payment company', () => {
    expect(isPaymentCompany('QASHIER-SL APPS GURU')).toBe(true);
    expect(isPaymentCompany('PINE PAYMENT SINGAPORE PTE')).toBe(true);
    expect(isPaymentCompany('NETS')).toBe(true);
    expect(isPaymentCompany(undefined)).toBe(true);
  });
  it('does not flag real shops', () => {
    expect(isPaymentCompany('Qas*7am Hair Pte Ltd')).toBe(false);
    expect(isPaymentCompany('BUS/MRT')).toBe(false);
    expect(isPaymentCompany('Netflix.com')).toBe(false);
  });
});
