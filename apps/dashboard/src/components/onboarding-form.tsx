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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Set up your account</CardTitle>
        <CardDescription>
          Tell us about your business. You can change these later in Settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createMerchant} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Business / brand name</Label>
            <Input id="name" name="name" placeholder="birthstarai" required />
            <p className="text-[11px] text-muted-foreground">
              Shown to customers on the payment page
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="upi_id">UPI ID</Label>
            <Input id="upi_id" name="upi_id" placeholder="yourname@ybl" required className="font-mono" />
            <p className="text-[11px] text-muted-foreground">
              Personal or business UPI — both work
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="upi_account_holder">Name on bank account</Label>
            <Input id="upi_account_holder" name="upi_account_holder" placeholder="AMAR KUMAR PATHAK" />
            <p className="text-[11px] text-muted-foreground">
              The name customers will see in their UPI app. Helps build trust when it differs from your brand name.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contact_email">Contact email</Label>
            <Input id="contact_email" name="contact_email" type="email" placeholder="you@example.com" />
            <p className="text-[11px] text-muted-foreground">
              Shown on payment page so customers can reach you
            </p>
          </div>

          <Button type="submit" className="mt-2">Continue</Button>
        </form>
      </CardContent>
    </Card>
  );
}
