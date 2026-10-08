"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Email atau kata sandi tidak valid.");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader className="space-y-1.5 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gold-dark">Autentikasi Internal</span>
        </div>
        <CardTitle className="text-2xl font-extrabold text-foreground tracking-tight">Masuk ke Akun Staf</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Masukkan alamat email dan kata sandi operasional Anda
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-xs text-primary bg-primary-soft border border-primary/20 rounded-lg flex items-center gap-2 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-foreground">Email Resmi Pegawai</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="nama@bpradiartha.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 bg-background border-border focus-visible:border-primary focus-visible:ring-primary/20"
              required 
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold text-foreground">Kata Sandi</Label>
            <Input 
              id="password" 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 bg-background border-border focus-visible:border-primary focus-visible:ring-primary/20"
              required 
            />
          </div>
        </CardContent>
        <CardFooter className="pt-2 pb-6">
          <Button type="submit" size="lg" className="w-full font-semibold shadow-xs gap-2" disabled={loading}>
            {loading ? "Memproses Autentikasi..." : "Masuk ke Sistem"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
