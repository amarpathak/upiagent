// apps/www/src/app/api/verify/route.ts
import { NextResponse } from "next/server";

/**
 * POST /api/verify
 *
 * Legacy endpoint — verification now happens in the background
 * via after() when a payment is created. Results are delivered
 * via webhook to /api/webhook/demo.
 *
 * Poll GET /api/webhook/demo?paymentId=xxx for results.
 */
export async function POST() {
  return NextResponse.json({
    verified: false,
    message: "Verification is now handled via webhooks. Poll GET /api/webhook/demo?paymentId=xxx for results.",
  });
}
