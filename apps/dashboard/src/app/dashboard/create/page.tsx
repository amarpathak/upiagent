import { CreatePaymentForm } from "@/components/create-payment-form";

export default function CreatePaymentPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-xl font-semibold">Create Payment</h1>
      <CreatePaymentForm />
    </div>
  );
}
