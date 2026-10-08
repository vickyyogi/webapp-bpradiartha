"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
      <LogOut className="h-5 w-5" />
      <span className="sr-only">Keluar</span>
    </Button>
  );
}
