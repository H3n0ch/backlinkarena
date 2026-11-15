import type { Metadata } from "next";
import { Suspense } from "react";
import { ArenaSkeleton } from "@/components/ArenaSkeleton";
import { matchMetadata, MatchScreen } from "./screen";

export async function generateMetadata({ params }: PageProps<"/match/[id]">): Promise<Metadata> {
  const { id } = await params;
  return matchMetadata(id);
}

export default function MatchPage({ params, searchParams }: PageProps<"/match/[id]">) {
  return (
    <Suspense fallback={<ArenaSkeleton />}>
      <ById params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ById({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  return <MatchScreen id={id} searchParams={searchParams} />;
}
