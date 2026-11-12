"use client";

import { signOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";

export function LogoutButton() {
  const queryClient = useQueryClient();
  return (
    <button
      className="mt-[15px] min-h-11 w-full cursor-pointer rounded-[7px] border-0 bg-transparent px-2.5 py-[9px] text-left text-[#64736a] hover:bg-[#fbf0ef] hover:text-red max-[820px]:text-center"
      type="button"
      onClick={() => {
        queryClient.clear();
        void signOut({ redirectTo: "/login" });
      }}
    >
      <span aria-hidden="true">↪</span> <span className="max-[820px]:hidden">Odjavi se</span>
    </button>
  );
}
