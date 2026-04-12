"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { HeartHandshake, ShieldCheck } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const publicApplicationUrl =
  "https://forms.zohopublic.com/southwestvirginiachihuahua/form/PuppyApplication/formperma/MxCOxyG77E3yShC2GCnwbjiMu1z3vqR8Gql1nug9gTY";

function InfoTile({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-[rgba(192,164,132,0.2)] bg-white/78 px-4 py-4 shadow-[0_12px_24px_rgba(91,66,39,0.06)] backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(205,169,125,0.16)] text-[#a76a39]">
          {icon}
        </span>
        <div>
          <div className="text-sm font-semibold text-[#463123]">{title}</div>
          <div className="mt-1 text-sm leading-6 text-[#7a6252]">{detail}</div>
        </div>
      </div>
    </div>
  );
}

export default function ApplicationPage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }

    void loadUser();
  }, []);

  const formUrl = useMemo(() => {
    return userId ? `${publicApplicationUrl}?user_id=${userId}` : publicApplicationUrl;
  }, [userId]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fcf8f2_0%,#f7f2ea_44%,#f5f6f8_100%)] py-16 lg:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2.25rem] border border-[rgba(194,166,136,0.24)] bg-[linear-gradient(135deg,rgba(255,251,246,0.96)_0%,rgba(248,239,228,0.94)_55%,rgba(246,248,251,0.96)_100%)] p-6 shadow-[0_28px_70px_rgba(87,63,39,0.10)] md:p-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(198,159,116,0.24)] bg-white/84 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c6239] shadow-sm">
                Southwest Virginia Chihuahua
              </div>
              <h1 className="mt-5 font-serif text-4xl text-[#2f2219] md:text-5xl">
                Puppy Application
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-[#715b4e]">
                Apply publicly without creating a puppy portal account first. We review every
                application personally to make thoughtful, lifelong matches for our families and
                puppies.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <InfoTile
                  icon={<HeartHandshake className="h-5 w-5" />}
                  title="No portal sign-in required"
                  detail="This application is intentionally public. If you are invited into the portal later, your application can follow you there."
                />
                <InfoTile
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="Reviewed personally"
                  detail="ChiChi and the breeder workspace can organize the details behind the scenes, but every application is still reviewed with real breeder judgment."
                />
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[rgba(194,166,136,0.2)] bg-white/76 p-5 shadow-[0_14px_30px_rgba(87,63,39,0.06)] backdrop-blur-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a7a5f]">
                Before you begin
              </div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[#6f5a4b]">
                <li>Applications are reviewed before a puppy is approved or reserved.</li>
                <li>Questions, preferences, and household details help guide the right match.</li>
                <li>
                  If you later receive portal access, your application record can be linked to your
                  buyer journey there.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-[rgba(194,166,136,0.18)] bg-white/94 p-2 shadow-[0_24px_56px_rgba(87,63,39,0.08)] sm:p-4">
          <iframe
            src={formUrl}
            className="h-[1080px] w-full rounded-[1.5rem] border-0 bg-white"
            title="Southwest Virginia Chihuahua Puppy Application"
          />
        </section>
      </div>
    </main>
  );
}
