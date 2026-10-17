/**
 * Formato euro unico per tutta l'app: "€12.844,31".
 * Intl 'it-IT' di default NON raggruppa i numeri a 4 cifre ("8271,76"): useGrouping 'always' lo forza.
 */
export const formatEuro = (value: number, decimals: number = 2): string =>
    '€' + new Intl.NumberFormat('it-IT', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: 'always',
    }).format(value || 0);
