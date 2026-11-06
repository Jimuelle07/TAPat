// zod schemas for the request bodies and query strings defined in docs/api-and-data.md §5.2.
// A parse failure is 400 VALIDATION_ERROR with the failing path in `message` (§1).
import { z } from 'zod';
import { normalizeUid } from './device-hash';
import type { BeneficiaryStatus } from './types';

const BENEFICIARY_STATUSES = [
  'approved',
  'rejected',
  'uncertain',
  'evidence_requested',
  'enrolled',
] as const satisfies readonly BeneficiaryStatus[];

/** True when `value` has at most 2 decimals (checked on its shortest decimal form, so 0.1 + 0.2 fails). */
function hasAtMostTwoDecimals(value: number): boolean {
  const text = String(value);
  if (/e/i.test(text)) return Number.isInteger(value);
  const fraction = text.split('.')[1] ?? '';
  return fraction.length <= 2;
}

const phpAmount = z.number().refine(hasAtMostTwoDecimals, 'must have at most 2 decimals');

/** UID as posted by Read card or a virtual UID; re-normalized idempotently, then `^[0-9A-Z]{4,32}$`. */
export const uidSchema = z
  .string()
  .transform(normalizeUid)
  .pipe(z.string().regex(/^[0-9A-Z]{4,32}$/, 'must be 4-32 characters A-Z/0-9 after normalization'));

/** #3 `POST /api/program`: every field optional; omitted fields take the demo defaults. */
export const createProgramBodySchema = z.strictObject({
  name: z.string().trim().min(1).optional(),
  perTapCapPhp: phpAmount.positive().optional(),
  tranchePhp: phpAmount.positive().optional(),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
  priceThresholdPhp: z.number().positive().optional(),
  alpha: z.number().gt(0).lt(1).optional(),
  beta: z.number().gt(0).lt(1).optional(),
});
export type CreateProgramBody = z.infer<typeof createProgramBodySchema>;

/** #4 `POST /api/program/budget-checkout`: a whole peso amount (10000 -> "1000.00" XLM). */
export const budgetCheckoutBodySchema = z.strictObject({
  amountPhp: z.number().int().positive(),
});
export type BudgetCheckoutBody = z.infer<typeof budgetCheckoutBodySchema>;

/** #8 `GET /api/beneficiaries` query: `?status=` repeatable, `?limit=` default 200, max 500. */
export const beneficiariesQuerySchema = z.object({
  status: z
    .union([z.enum(BENEFICIARY_STATUSES), z.array(z.enum(BENEFICIARY_STATUSES))])
    .optional()
    .transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type BeneficiariesQuery = z.infer<typeof beneficiariesQuerySchema>;

/** #10 `POST /api/enroll` multipart text fields (all strings on the wire; `photo` is the file part). */
export const enrollFieldsSchema = z.strictObject({
  beneficiaryId: z.string().min(1),
  uid: uidSchema,
  samplePhoto: z.literal('d4-photo.jpg').optional(),
  officerConfirmed: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
export type EnrollFields = z.infer<typeof enrollFieldsSchema>;

const tapStationId = z.enum(['A', 'B']);
const tapAmountPhp = phpAmount.positive().max(100000);

/** #13 `POST /api/taps`: a card read (`uid`) or a simulated tap (`cardId`, `simulated: true`). */
export const tapBodySchema = z.union([
  z.strictObject({
    stationId: tapStationId,
    amountPhp: tapAmountPhp,
    uid: uidSchema,
    simulated: z.literal(false).optional(),
  }),
  z.strictObject({
    stationId: tapStationId,
    amountPhp: tapAmountPhp,
    cardId: z.string().min(1),
    simulated: z.literal(true),
  }),
]);
export type TapBody = z.infer<typeof tapBodySchema>;

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** #22 `POST /api/auth/signup`: always creates a `viewer`. */
export const signupBodySchema = z.strictObject({
  email,
  password: z.string().min(8, 'must be at least 8 characters').max(200),
  displayName: z.string().trim().min(1).max(80),
});
export type SignupBody = z.infer<typeof signupBodySchema>;

/** #23 `POST /api/auth/login`. */
export const loginBodySchema = z.strictObject({
  email,
  password: z.string().min(1).max(200),
});
export type LoginBody = z.infer<typeof loginBodySchema>;
