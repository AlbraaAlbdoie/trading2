// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Native Web Push Notifications Utility
// High-Confluence Trade Alerts (OS/Mobile System Notifications)
// ═══════════════════════════════════════════════════════════════════════════

import { AiTradeRecommendation } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

/** Check if Web Push Notification is supported in this browser/device */
export function isWebPushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Get current permission state */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isWebPushSupported()) return "unsupported";
  return Notification.permission;
}

/** Request notification permission from the user */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isWebPushSupported()) {
    return "unsupported";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error("[WebNotification] Error requesting permission:", err);
    return Notification.permission;
  }
}

/** Send generic native push alert */
export function sendWebPushNotification(
  title: string,
  options?: NotificationOptions,
): Notification | null {
  if (!isWebPushSupported() || Notification.permission !== "granted") {
    return null;
  }

  try {
    const defaultOptions: NotificationOptions = {
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      dir: "rtl",
      lang: "ar",
      ...options,
    };

    const notification = new Notification(title, defaultOptions);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch (err) {
    console.warn("[WebNotification] Native notification dispatch error:", err);
    return null;
  }
}

/** Dispatch High-Confluence Trade Signal Alert (Score >= 80%) */
export function sendTradeSignalNotification(rec: AiTradeRecommendation): boolean {
  if (!isWebPushSupported() || Notification.permission !== "granted") {
    return false;
  }

  const score = rec.confluence_score || rec.confidence_score || 0;
  const isTrade =
    rec.status === "LONG" || rec.status === "SHORT" || rec.status === "SPOT_BUY";

  // Only trigger for confirmed trade setups with >= 80% confluence
  if (!isTrade || score < 80) {
    return false;
  }

  const directionText =
    rec.status === "LONG"
      ? "🟢 صفقة شراء (LONG)"
      : rec.status === "SHORT"
      ? "🔴 صفقة بيع (SHORT)"
      : "🔵 شراء فوري (SPOT BUY)";

  const title = `🚨 NEXUS ALPHA: ${directionText} على ${rec.symbol}`;
  const body = `نسبة التوافق المؤسساتي: ${score}%\nسعر الدخول: $${formatPrice(
    rec.entry_price,
  )}\nوقف الخسارة: $${formatPrice(rec.stop_loss)}\nالهدف الأول: $${formatPrice(
    rec.take_profit_1,
  )}`;

  sendWebPushNotification(title, {
    body,
    tag: `signal-${rec.symbol}-${Date.now()}`,
    requireInteraction: true,
  });

  return true;
}
