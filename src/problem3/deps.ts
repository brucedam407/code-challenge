/**
 * Ambient stand-ins for what the brief omits, so `refactored.tsx` type-checks in
 * isolation. Delete in a real codebase and import the app's own.
 */
import type { ComponentType, ReactNode } from 'react';

/** `string`, not `Blockchain`: the feed is an external boundary. */
export interface WalletBalance {
  blockchain: string;
  currency: string;
  amount: number;
}

/** Optional: a quote can be missing while the feed loads. */
export type Prices = Record<string, number | undefined>;

export declare function useWalletBalances(): WalletBalance[];
export declare function usePrices(): Prices;

export interface BoxProps {
  children?: ReactNode;
  className?: string;
  sx?: Record<string, unknown>;
}

export declare const Box: ComponentType<BoxProps>;

export interface WalletRowProps {
  className?: string;
  amount: number;
  usdValue: number;
  formattedAmount: string;
}

export declare const WalletRow: ComponentType<WalletRowProps>;

export declare const classes: { row: string };
