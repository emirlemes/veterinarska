"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    setIsSubmitting(false);
    if (!result || result.error) {
      setError("E-mail ili lozinka nisu ispravni, ili je korisnički račun deaktiviran.");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="my-4 grid gap-[7px]">
        <label className="text-xs font-[650]" htmlFor="email">E-mail adresa</label>
        <input
          className="h-11 w-full rounded-[7px] border border-[#dce4de] bg-white px-3 outline-none focus:border-green focus:ring-[3px] focus:ring-[rgb(46_118_88_/_12%)]"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          maxLength={254}
          required
        />
      </div>
      <div className="my-4 grid gap-[7px]">
        <label className="text-xs font-[650]" htmlFor="password">Lozinka</label>
        <input
          className="h-11 w-full rounded-[7px] border border-[#dce4de] bg-white px-3 outline-none focus:border-green focus:ring-[3px] focus:ring-[rgb(46_118_88_/_12%)]"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
        />
      </div>
      <button className="mt-2 min-h-11 w-full cursor-pointer rounded-[7px] border-0 bg-green font-bold text-white hover:bg-green-dark disabled:cursor-wait disabled:opacity-70" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Prijava u toku..." : "Prijavi se"}
      </button>
      {error ? (
        <p className="mt-[13px] rounded-[7px] bg-[#fbefee] px-3 py-2.5 text-xs text-[#a43e3c]" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
