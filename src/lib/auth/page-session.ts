import { cache } from "react";
import { auth } from "@/auth";

export const getPageSession = cache(async () => auth());
