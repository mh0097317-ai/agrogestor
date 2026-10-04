"use client";

import { useState } from "react";
import type { MembershipStatus } from "@/types";
import { monthKey, planCovers } from "@/lib/payments";
import type { PublicPlan } from "./types";
import { usePublicData } from "./use-public-catalog";

/** The subscriber's own membership, as `GET /club/[token]` returns it. */
export interface MemberView {
  status: MembershipStatus;
  customerName: string;
  customerPhone: string;
  price: number;
  invoiceUrl: string | null;
  nextDueDate: string | null;
  plan: PublicPlan | null;
  usage: Record<string, number>;
  simulatedCharge?: string;
}

const key = (slug: string) => `studioflow:club:${slug}`;
const validToken = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

/** Club access token kept only on the customer's device. */
export function readClubToken(slug: string) {
  try {
    const value = localStorage.getItem(key(slug));
    return validToken(value) ? value : "";
  } catch {
    return "";
  }
}
export function saveClubToken(slug: string, token: string) {
  try {
    if (validToken(token)) localStorage.setItem(key(slug), token);
  } catch {
    // Without storage the access link still works.
  }
}
export function forgetClubToken(slug: string) {
  try {
    localStorage.removeItem(key(slug));
  } catch {
    // Nothing stored.
  }
}

/** For components rendered only after the catalog loads in the browser. */
export function useClubToken(slug: string) {
  return useState(() =>
    typeof window === "undefined" ? "" : readClubToken(slug),
  );
}

/** Membership of this device's token, empty when there is none. */
export function useMembership(slug: string, token: string, check = false) {
  const { data, error, loading, reload } = usePublicData<MemberView>(
    token
      ? `/api/public/${encodeURIComponent(slug)}/club/${token}${check ? "?check=1" : ""}`
      : "",
  );
  return { member: token ? data : null, error, loading, reload };
}

const digits = (value: string) =>
  value.replace(/\D/g, "").replace(/^55(?=\d{11}$)/, "");

/**
 * Prediction for the booking screen; the server decides for real.
 * `phone` is what the customer typed (empty while not typed yet).
 */
export function clubCoverage(
  member: MemberView | null | undefined,
  serviceIds: string[],
  start: string,
  phone: string,
) {
  if (!member?.plan || member.status !== "active") return null;
  const result = planCovers(
    member.plan,
    serviceIds,
    member.usage[monthKey(start)] || 0,
  );
  const samePhone = !phone || digits(phone) === member.customerPhone;
  return { result: samePhone ? result : ("phone" as const), member };
}
