export interface LoyaltyProgress {
  /** Stamps filled on the current card. */
  stamps: number;
  goal: number;
  /** The card is full: the next appointment earns the reward. */
  rewardReady: boolean;
  /** Visits still needed for the reward (0 when ready). */
  missing: number;
}

/**
 * Stamp card: every completed visit is a stamp. With a goal of 10, the
 * card fills on the 10th visit and the reward is given on the next one,
 * which also starts a new card.
 */
export function loyaltyProgress(visits: number, goal: number): LoyaltyProgress {
  const safeGoal = Math.max(2, Math.round(goal));
  const done = Math.max(0, Math.floor(visits));
  const rewardReady = done > 0 && done % safeGoal === 0;
  const stamps = rewardReady ? safeGoal : done % safeGoal;
  return {
    stamps,
    goal: safeGoal,
    rewardReady,
    missing: rewardReady ? 0 : safeGoal - stamps,
  };
}

/** Completed visits of one customer, straight from the appointments. */
export function completedVisits(
  appointments: { customerId: string; status: string }[],
  customerId: string,
) {
  return appointments.filter(
    (item) => item.customerId === customerId && item.status === "completed",
  ).length;
}
