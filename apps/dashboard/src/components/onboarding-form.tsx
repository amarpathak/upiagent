"use client";

import { createMerchant } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function OnboardingForm() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Set up your business</CardTitle>
        <CardDescription>
          Enter your business details to start accepting payments with upiagent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createMerchant} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Business name</Label>
            <Input
              id="name"
              name="name"
              placeholder="My Business"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="upi_id">UPI ID</Label>
            <Input
              id="upi_id"
              name="upi_id"
              placeholder="business@upi"
              required
            />
          </div>
          <Button type="submit">Continue</Button>
        </form>
      </CardContent>
    </Card>
  );
}
