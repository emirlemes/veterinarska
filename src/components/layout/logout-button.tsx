"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      className="mt-[15px] min-h-11 w-full cursor-pointer rounded-[7px] border-0 bg-transparent px-2.5 py-[9px] text-left text-[#64736a] hover:bg-[#fbf0ef] hover:text-red max-[820px]:text-center"
      type="button"
      onClick={() => signOut({ redirectTo: "/login" })}
    >
      <span aria-hidden="true">↪</span> <span className="max-[820px]:hidden">Odjavi se</span>
    </button>
  );
}
