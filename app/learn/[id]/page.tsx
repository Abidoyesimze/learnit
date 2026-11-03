"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { LessonPlayer } from "@/components/LessonPlayer";

export default function LessonPage({ params }: { params: { id: string } }) {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  useEffect(() => { if (ready && !authenticated) router.replace("/"); }, [ready, authenticated, router]);
  if (!ready || !authenticated) return null;
  return <LessonPlayer id={params.id} />;
}
