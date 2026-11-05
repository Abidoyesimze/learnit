import type { Metadata } from "next";
import { LoginScreen } from "@/components/LoginScreen";
import { RedirectIfSignedIn } from "@/components/RedirectIfSignedIn";

const description = "Ten calm minutes a day of French or Spanish, from zero. Pass a lesson, keep your streak, and earn GoodDollar (G$) rewards on Celo.";
export const metadata: Metadata = {
  title: "LearnIt: learn French or Spanish, earn G$",
  description,
  openGraph: { title: "LearnIt: learn French or Spanish, earn G$", description, type: "website", siteName: "LearnIt" },
  twitter: { card: "summary", title: "LearnIt: learn French or Spanish, earn G$", description },
};

/** The public landing page. The app itself lives at /home. */
export default function Landing() {
  return (
    <>
      <RedirectIfSignedIn />
      <LoginScreen />
    </>
  );
}
