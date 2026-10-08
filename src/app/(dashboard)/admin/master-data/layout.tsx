import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Master Data",
};

export default function AdminMasterDataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
