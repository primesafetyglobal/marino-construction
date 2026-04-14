import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
