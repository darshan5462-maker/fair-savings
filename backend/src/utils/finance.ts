/**
 * Core financial calculations for Fair Savings.
 * Kept framework-agnostic and pure so they're easy to unit test.
 */

export interface LoanTerms {
  principalAmount: number;
  interestRate: number; // percent, e.g. 10 for 10%
  durationWeeks: number;
}

export interface LoanComputed {
  totalRepayment: number;
  weeklyEmi: number;
  remainingAmount: number;
  remainingWeeks: number;
}

/** Simple interest loan: totalRepayment = principal * (1 + rate/100) */
export function computeLoan({ principalAmount, interestRate, durationWeeks }: LoanTerms): LoanComputed {
  const totalRepayment = round2(principalAmount * (1 + interestRate / 100));
  const weeklyEmi = round2(totalRepayment / durationWeeks);
  return {
    totalRepayment,
    weeklyEmi,
    remainingAmount: totalRepayment,
    remainingWeeks: durationWeeks,
  };
}

/** Penalty is `penaltyRate`% of the missed EMI amount (default 1%). */
export function computePenalty(emiAmount: number, penaltyRate = 1): number {
  return round2(emiAmount * (penaltyRate / 100));
}

/**
 * Builds a renewed loan from the unpaid balance of a completed-duration loan,
 * applying interest again on the outstanding amount and resetting the term.
 */
export function computeRenewal(remainingAmount: number, interestRate: number, durationWeeks: number): LoanComputed {
  return computeLoan({ principalAmount: remainingAmount, interestRate, durationWeeks });
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Progress percentage for a 52-week savings cycle (or any cycle length). */
export function savingsProgress(weeksCompleted: number, totalWeeks: number): number {
  if (totalWeeks <= 0) return 0;
  return Math.min(100, round2((weeksCompleted / totalWeeks) * 100));
}

// ---------- Collection due-date scheduling ----------

const WEEKDAY_MAP: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

/** The next date on/after `date` that falls on the given weekday name (e.g. "FRIDAY"). */
export function nextWeekdayOnOrAfter(date: Date, weekdayName: string): Date {
  const target = WEEKDAY_MAP[weekdayName.toUpperCase()] ?? 5;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (target - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * The actual date the whole savings scheme began collecting Week 1, shared
 * across every member - NOT each member's individual `joiningDate` (which
 * only reflects when their record happened to be created in the system,
 * often well after the real collection already started).
 */
export const FALLBACK_SAVINGS_START_DATE = new Date("2026-08-07");

export function resolveSavingsStartDate(settingsStartDate: Date | null | undefined): Date {
  return settingsStartDate ?? FALLBACK_SAVINGS_START_DATE;
}

/** Due date for a given week number, counting weekly from a shared anchor date (e.g. the scheme's start date). */
export function collectionDueDate(anchorDate: Date, weekNumber: number, collectionDay: string): Date {
  const firstDue = nextWeekdayOnOrAfter(anchorDate, collectionDay);
  const due = new Date(firstDue);
  due.setDate(due.getDate() + (weekNumber - 1) * 7);
  return due;
}

/** Due date for a given loan EMI week number, anchored to the loan's issue date. */
export function loanPaymentDueDate(issueDate: Date, weekNumber: number, collectionDay: string): Date {
  const firstDue = nextWeekdayOnOrAfter(issueDate, collectionDay);
  const due = new Date(firstDue);
  due.setDate(due.getDate() + (weekNumber - 1) * 7);
  return due;
}
