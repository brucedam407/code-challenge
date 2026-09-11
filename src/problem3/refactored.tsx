import { useMemo } from 'react';

import {
  Box,
  WalletRow,
  classes,
  usePrices,
  useWalletBalances,
  type BoxProps,
  type WalletBalance,
} from './deps';

type Blockchain = 'Osmosis' | 'Ethereum' | 'Arbitrum' | 'Zilliqa' | 'Neo';

const PRIORITY: Record<Blockchain, number> = {
  Osmosis: 100,
  Ethereum: 50,
  Arbitrum: 30,
  Zilliqa: 20,
  Neo: 20,
};

const UNSUPPORTED = -99;

/** Closes over nothing - never a hook dependency. */
function getPriority(blockchain: string): number {
  return PRIORITY[blockchain as Blockchain] ?? UNSUPPORTED;
}

/** Constructing an Intl formatter per row costs ~300x. */
const AMOUNT_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

interface WalletRowModel {
  key: string;
  amount: number;
  formatted: string;
  usdValue: number;
}

type Props = BoxProps;

export default function WalletPage({ children, ...rest }: Props) {
  const balances = useWalletBalances();
  const prices = usePrices();

  /** A price tick must not re-sort the wallet. */
  const sortedBalances = useMemo(() => {
    // One pass: filter and derive the sort key together.
    const ranked: { balance: WalletBalance; priority: number }[] = [];
    for (const balance of balances) {
      const priority = getPriority(balance.blockchain);
      if (priority > UNSUPPORTED && balance.amount > 0) ranked.push({ balance, priority });
    }
    ranked.sort((lhs, rhs) => rhs.priority - lhs.priority);
    return ranked.map((entry) => entry.balance);
  }, [balances]);

  const rows = useMemo<WalletRowModel[]>(
    () =>
      sortedBalances.map((balance) => ({
        // Currency alone is not unique across chains.
        key: `${balance.blockchain}-${balance.currency}`,
        amount: balance.amount,
        formatted: AMOUNT_FORMAT.format(balance.amount),
        // A missing quote would otherwise render as NaN.
        usdValue: (prices[balance.currency] ?? 0) * balance.amount,
      })),
    [sortedBalances, prices],
  );

  return (
    <Box {...rest}>
      {rows.map((row) => (
        // Primitives, not the row object: React.memo would then pay off.
        <WalletRow
          key={row.key}
          className={classes.row}
          amount={row.amount}
          usdValue={row.usdValue}
          formattedAmount={row.formatted}
        />
      ))}
      {children}
    </Box>
  );
}
