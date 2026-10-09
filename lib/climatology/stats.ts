/** Linear-interpolation quantile (Hyndman–Fan type 7) on an ascending array. */
export function quantileSorted(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (p <= 0) return sorted[0]!;
  if (p >= 1) return sorted[sorted.length - 1]!;
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function quantile(values: number[], p: number): number | null {
  return quantileSorted([...values].sort((a, b) => a - b), p);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardDeviation(values: number[]): number | null {
  const average = mean(values);
  if (average === null || values.length < 2) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let sum = 0.99999999999980993;
  for (let index = 0; index < LANCZOS.length; index += 1) sum += LANCZOS[index]! / (z + index + 1);
  const t = z + LANCZOS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

/** Regularized lower incomplete gamma P(a, x). Series for x < a + 1, continued fraction otherwise. */
export function regularizedGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  const logPrefix = -x + a * Math.log(x) - logGamma(a);
  if (x < a + 1) {
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < 500; n += 1) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
    }
    return Math.min(1, sum * Math.exp(logPrefix));
  }
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let n = 1; n < 500; n += 1) {
    const an = -n * (n - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return Math.max(0, 1 - Math.exp(logPrefix) * h);
}

export interface GammaFit {
  /** Shape. */
  alpha: number;
  /** Scale, in the unit of the input (mm). */
  beta: number;
  /** Share of samples equal to zero, handled as a point mass. */
  zeroFraction: number;
  /** Total samples, including zeros. */
  n: number;
}

/**
 * Gamma fit with a zero point mass, as used for the Standardized Precipitation Index.
 * Shape uses the Thom (1958) maximum-likelihood approximation.
 */
export function fitGammaWithZeros(values: number[]): GammaFit | null {
  const positive = values.filter((value) => value > 0);
  if (values.length < 10 || positive.length < 5) return null;
  const average = mean(positive)!;
  const meanLog = positive.reduce((sum, value) => sum + Math.log(value), 0) / positive.length;
  const a = Math.log(average) - meanLog;
  if (!(a > 0)) return null;
  const alpha = (1 + Math.sqrt(1 + (4 * a) / 3)) / (4 * a);
  return { alpha, beta: average / alpha, zeroFraction: (values.length - positive.length) / values.length, n: values.length };
}

export function mixedGammaCdf(value: number, fit: GammaFit): number {
  const q = fit.zeroFraction;
  if (value <= 0) return q;
  return q + (1 - q) * regularizedGammaP(fit.alpha, value / fit.beta);
}

/** Inverse standard normal CDF (Acklam's rational approximation, relative error below 1.2e-9). */
export function inverseNormalCdf(p: number): number {
  if (p <= 0) return Number.NEGATIVE_INFINITY;
  if (p >= 1) return Number.POSITIVE_INFINITY;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

export const SPI_LIMIT = 3;

export function standardizedIndex(value: number, fit: GammaFit): number {
  const probability = Math.min(1 - 1e-9, Math.max(1e-9, mixedGammaCdf(value, fit)));
  return Math.max(-SPI_LIMIT, Math.min(SPI_LIMIT, inverseNormalCdf(probability)));
}
