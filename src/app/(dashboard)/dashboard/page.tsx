import { Users, CreditCard, ArrowUpRight, Clock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard Operasional",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gold-dark">Ringkasan Sistem</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Dashboard Operasional
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Selamat datang di portal pengelolaan dan operasional PT BPR Adiartha Utama.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant="gold" className="text-xs px-2.5 py-1 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
            Sistem Perbankan Aktif
          </Badge>
        </div>
      </div>
      
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border bg-card shadow-xs hover:border-primary/40 transition-colors relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Prospek Baru
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-primary-soft text-primary flex items-center justify-center border border-primary/20 group-hover:scale-105 transition-transform">
              <Users className="h-4.5 w-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground tracking-tight">12</div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span className="text-emerald-700 font-semibold flex items-center">
                <ArrowUpRight className="h-3 w-3 mr-0.5" /> +2
              </span>
              <span className="text-muted-foreground">dari hari kemarin</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-border bg-card shadow-xs hover:border-gold/60 transition-colors relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gold" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Aplikasi Kredit Aktif
            </CardTitle>
            <div className="h-9 w-9 rounded-lg bg-gold-soft text-gold-dark flex items-center justify-center border border-gold/30 group-hover:scale-105 transition-transform">
              <CreditCard className="h-4.5 w-4.5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground tracking-tight">5</div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 text-gold-dark" />
              <span className="text-gold-dark font-medium">Menunggu review AO & Komite</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
