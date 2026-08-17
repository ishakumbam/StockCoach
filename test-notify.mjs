import { readFileSync } from "fs";
for (const line of readFileSync("/Users/kumbami/stockcoach/.env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0) process.env[line.slice(0, i)] = line.slice(i + 1).trim();
}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: users } = await sb.auth.admin.listUsers();
console.log("users:", users.users.map(u => u.email));
for (const u of users.users) {
  await sb.from("notifications").insert({
    user_id: u.id,
    title: "🔔 Notifications are live!",
    body: "StockCoach now watches your stocks every ~10 minutes during market hours: big moves, price targets, signal flips, and a morning briefing. Manage everything in Alerts.",
    kind: "system",
  });
}
console.log("test notification sent to", users.users.length, "user(s)");
