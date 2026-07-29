import { Injectable } from '@nestjs/common';
import type { PriceBook, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withPlatform } from '../prisma/tenant.helpers';

/** The resolved price for a plan in a given currency/country at a point in time. */
export interface EffectivePrice {
  planId: string;
  currency: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  setupFee: number;
  /** Where the price came from: a PriceBook row, the plan's legacy columns, or nothing. */
  source: 'pricebook' | 'plan-default' | 'none';
  priceBookId: string | null;
}

export interface PriceQuery {
  currency?: string;
  countryCode?: string | null;
  at?: Date;
}

/**
 * Resolves commercial pricing, decoupled from plan entitlements. Prices live in {@link PriceBook}
 * (multi-currency / per-country / time-boxed / promotional); the legacy {@link SubscriptionPlan}
 * price columns are the default-currency fallback so existing plans keep working with no migration.
 *
 * This service does NOT resolve entitlements — that stays in {@link SubscriptionService}. Pricing
 * and entitlement are separate responsibilities (v2 decoupling).
 */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /** All price books for a plan (platform view). */
  listPriceBooks(planId: string): Promise<PriceBook[]> {
    return withPlatform(this.prisma, (tx) =>
      tx.priceBook.findMany({
        where: { planId },
        orderBy: [{ currency: 'asc' }, { effectiveFrom: 'desc' }],
      }),
    );
  }

  /** Resolve the effective price for a plan given currency/country/date. */
  async resolvePrice(planId: string, query: PriceQuery = {}): Promise<EffectivePrice> {
    return withPlatform(this.prisma, async (tx) => {
      const [plan, books] = await Promise.all([
        tx.subscriptionPlan.findUniqueOrThrow({ where: { id: planId } }),
        tx.priceBook.findMany({ where: { planId, isActive: true } }),
      ]);
      return PricingService.selectPrice(plan, books, query);
    });
  }

  /**
   * Pure price selection (no I/O — unit-testable). Among active, in-window price books for the
   * requested currency, prefer an exact country match over a currency-wide (null-country) row,
   * then `isDefault`, then the most recently effective. Falls back to the plan's legacy columns
   * when they match the requested currency; otherwise "contact sales".
   */
  static selectPrice(
    plan: Pick<SubscriptionPlan, 'id' | 'currency' | 'priceMonthly' | 'priceYearly'>,
    books: PriceBook[],
    query: PriceQuery = {},
  ): EffectivePrice {
    const currency = (query.currency ?? plan.currency).toUpperCase();
    const at = query.at ?? new Date();
    const country = query.countryCode ?? null;

    const candidates = books
      .filter((b) => b.currency.toUpperCase() === currency)
      .filter((b) => b.effectiveFrom <= at && (b.effectiveTo === null || b.effectiveTo >= at))
      .filter((b) => b.countryCode === null || b.countryCode === country);

    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        // 1) exact country match first
        const ac = a.countryCode === country && country !== null ? 1 : 0;
        const bc = b.countryCode === country && country !== null ? 1 : 0;
        if (ac !== bc) return bc - ac;
        // 2) default rows next
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        // 3) most recently effective wins (latest promo)
        return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
      });
      const best = candidates[0]!;
      return {
        planId: plan.id,
        currency,
        monthlyPrice: best.monthlyPrice,
        yearlyPrice: best.yearlyPrice,
        setupFee: best.setupFee,
        source: 'pricebook',
        priceBookId: best.id,
      };
    }

    // Legacy fallback: the plan's own columns, but only if the currency matches.
    if (plan.currency.toUpperCase() === currency) {
      return {
        planId: plan.id,
        currency,
        monthlyPrice: plan.priceMonthly,
        yearlyPrice: plan.priceYearly,
        setupFee: 0,
        source: 'plan-default',
        priceBookId: null,
      };
    }

    return {
      planId: plan.id,
      currency,
      monthlyPrice: null,
      yearlyPrice: null,
      setupFee: 0,
      source: 'none',
      priceBookId: null,
    };
  }
}
