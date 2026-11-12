import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Prijava",
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_18%_10%,#e6f3eb_0,transparent_34%),var(--color-canvas)] p-6">
      <section className="w-full max-w-[420px] rounded-[15px] border border-line bg-white p-[34px] shadow-[0_18px_60px_rgb(34_62_47_/_8%)]">
        <div className="flex items-center gap-[11px]">
          <div className="grid size-[38px] place-items-center rounded-xl bg-green text-lg font-bold text-white" aria-hidden="true">
            V
          </div>
          <div>
            <div className="text-base font-[750] tracking-[-0.3px]">VetCare</div>
            <div className="mt-0.5 text-[11px] text-muted">Veterinarski sistem</div>
          </div>
        </div>
        <h1 className="mb-2 mt-[26px] text-[25px] tracking-[-0.7px]">Dobro došli</h1>
        <p className="mb-6 leading-[1.6] text-muted">
          Prijavite se na svoj korisnički račun za pristup sistemu ambulante.
        </p>
        <LoginForm />
        <p className="mt-[21px] text-center text-[11px] text-[#8b9790]">
          Pristup je dozvoljen samo ovlaštenim korisnicima.
        </p>
      </section>
    </main>
  );
}
