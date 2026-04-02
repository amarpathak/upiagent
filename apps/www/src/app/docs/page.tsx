import { DocsContent } from "@/components/docs/docs-content";
import { DocsNav } from "@/components/docs/docs-nav";
import { Nav } from "@/components/nav";
import { FooterNew } from "@/components/footer-new";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs — upiagent",
  description:
    "Learn how to accept UPI payments with upiagent. Quick start, API reference, webhooks, security layers, and more.",
};

export default function DocsPage() {
  return (
    <main id="main-content" className="flex flex-col">
      <Nav />
      <div className="pt-14">
        <div className="max-w-[1100px] mx-auto px-8 py-16 flex gap-16">
          <DocsNav />
          <DocsContent />
        </div>
      </div>
      <FooterNew />
    </main>
  );
}
