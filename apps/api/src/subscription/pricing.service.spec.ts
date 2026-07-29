import type { PriceBook, SubscriptionPlan } from '@prisma/client';
import { PricingService } from './pricing.service';

const PLAN: Pick<SubscriptionPlan, 'id' | 'currency' | 'priceMonthly' | 'priceYearly'> = {
  id: 'plan1',
  currency: 'JOD',
  priceMonthly: 4900,
  priceYearly: 49000,
};

function book(overrides: Partial<PriceBook>): PriceBook {
  return {
    id: overrides.id ?? 'b1',
    planId: 'plan1',
    currency: overrides.currency ?? 'JOD',
    countryCode: overrides.countryCode ?? null,
    monthlyPrice: overrides.monthlyPrice ?? 1000,
    yearlyPrice: overrides.yearlyPrice ?? 10000,
    setupFee: overrides.setupFee ?? 0,
    effectiveFrom: overrides.effectiveFrom ?? new Date('2026-01-01'),
    effectiveTo: overrides.effectiveTo ?? null,
    isDefault: overrides.isDefault ?? false,
    isActive: overrides.isActive ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('PricingService.selectPrice', () => {
  it('falls back to the plan legacy columns when there is no price book', () => {
    const p = PricingService.selectPrice(PLAN, [], { currency: 'JOD' });
    expect(p).toMatchObject({ source: 'plan-default', monthlyPrice: 4900, yearlyPrice: 49000 });
  });

  it('returns "contact sales" (none) when the requested currency has no match', () => {
    const p = PricingService.selectPrice(PLAN, [], { currency: 'USD' });
    expect(p).toMatchObject({ source: 'none', monthlyPrice: null, yearlyPrice: null });
  });

  it('prefers a price book over the legacy plan columns', () => {
    const p = PricingService.selectPrice(PLAN, [book({ monthlyPrice: 5500 })], { currency: 'JOD' });
    expect(p).toMatchObject({ source: 'pricebook', monthlyPrice: 5500 });
  });

  it('prefers an exact country match over a currency-wide row', () => {
    const books = [
      book({ id: 'any', countryCode: null, monthlyPrice: 5000 }),
      book({ id: 'jo', countryCode: 'JO', monthlyPrice: 4200 }),
    ];
    const p = PricingService.selectPrice(PLAN, books, { currency: 'JOD', countryCode: 'JO' });
    expect(p).toMatchObject({ priceBookId: 'jo', monthlyPrice: 4200 });
  });

  it('resolves per-currency pricing', () => {
    const books = [book({ id: 'usd', currency: 'USD', monthlyPrice: 6900, yearlyPrice: 69000 })];
    const p = PricingService.selectPrice(PLAN, books, { currency: 'USD' });
    expect(p).toMatchObject({ source: 'pricebook', currency: 'USD', monthlyPrice: 6900 });
  });

  it('ignores an out-of-window promo and picks the active row', () => {
    const books = [
      book({ id: 'expired', monthlyPrice: 3000, effectiveTo: new Date('2026-02-01') }),
      book({ id: 'current', monthlyPrice: 4800, effectiveFrom: new Date('2026-03-01') }),
    ];
    const at = new Date('2026-06-01');
    const p = PricingService.selectPrice(PLAN, books, { currency: 'JOD', at });
    expect(p.priceBookId).toBe('current');
  });

  it('applies the most recently effective promo when several are active', () => {
    const books = [
      book({ id: 'old', monthlyPrice: 5000, effectiveFrom: new Date('2026-01-01') }),
      book({ id: 'promo', monthlyPrice: 3900, effectiveFrom: new Date('2026-05-01') }),
    ];
    const at = new Date('2026-06-01');
    const p = PricingService.selectPrice(PLAN, books, { currency: 'JOD', at });
    expect(p.priceBookId).toBe('promo');
    expect(p.monthlyPrice).toBe(3900);
  });
});
