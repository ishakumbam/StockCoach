// Server-side notification machinery: admin Supabase client (service role),
// notification inserts, and web-push delivery. Only imported by API routes.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

let admin: SupabaseClient | null = null;

export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!admin) {
    admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return admin;
}

let vapidReady = false;

function ensureVapid(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!vapidReady) {
    webpush.setVapidDetails("mailto:alerts@stockcoach.app", pub, priv);
    vapidReady = true;
  }
  return true;
}

export interface NotificationInput {
  userId: string;
  title: string;
  body: string;
  symbol?: string | null;
  kind: string;
}

/** Insert an in-app notification and push it to the user's browsers. */
export async function notify(n: NotificationInput): Promise<void> {
  const sb = adminClient();
  if (!sb) return;

  await sb.from("notifications").insert({
    user_id: n.userId,
    title: n.title,
    body: n.body,
    symbol: n.symbol ?? null,
    kind: n.kind,
  });

  if (!ensureVapid()) return;
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", n.userId);

  await Promise.allSettled(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title: n.title,
            body: n.body,
            url: n.symbol ? `/stock/${n.symbol}` : "/",
          })
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await sb.from("push_subscriptions").delete().eq("id", s.id); // dead subscription
        }
      }
    })
  );
}
