import React from "react";
import { Analytics, track, type BeforeSendEvent } from "@vercel/analytics/react";

const PRODUCTION_ORIGIN = "https://businessboy.ai";
const TRACKED_PATHS = new Set(["/gen3/identity", "/gen3/sales", "/gen3/products"]);
const ALLOWED_EVENTS = new Set<Gen3AnalyticsEvent>([
  "identity_prompt_copied",
  "sales_prompt_copied",
  "product_details_copied",
  "product_image_download_clicked",
  "product_shopee_opened",
]);
const PRODUCT_COPY_TYPES = new Set(["name", "summary", "summary_price"]);

export type Gen3AnalyticsEvent =
  | "identity_prompt_copied"
  | "sales_prompt_copied"
  | "product_details_copied"
  | "product_image_download_clicked"
  | "product_shopee_opened";

export type Gen3AnalyticsProperties = {
  copy_type?: "name" | "summary" | "summary_price";
};

function isProductionHost() {
  return typeof window !== "undefined"
    && window.location.origin === PRODUCTION_ORIGIN
    && TRACKED_PATHS.has(window.location.pathname);
}

export function sanitizeGen3AnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    if (!isProductionHost()) return null;
    const url = new URL(event.url, window.location.origin);
    if (
      url.origin !== PRODUCTION_ORIGIN
      || url.username !== ""
      || url.password !== ""
      || !TRACKED_PATHS.has(url.pathname)
    ) return null;
    return { ...event, url: `${PRODUCTION_ORIGIN}${url.pathname}` };
  } catch {
    return null;
  }
}

export function trackGen3Event(name: Gen3AnalyticsEvent, properties?: Gen3AnalyticsProperties) {
  if (!isProductionHost() || !ALLOWED_EVENTS.has(name)) return;
  let safeProperties: Gen3AnalyticsProperties | undefined;
  if (name === "product_details_copied") {
    const copyType = properties?.copy_type;
    if (!copyType || !PRODUCT_COPY_TYPES.has(copyType)) return;
    safeProperties = { copy_type: copyType };
  } else if (properties !== undefined) {
    return;
  }
  try {
    track(name, safeProperties);
  } catch {
    // Analytics must never interrupt the classroom workflow.
  }
}

export function Gen3Analytics() {
  if (!isProductionHost()) return null;
  return <Analytics beforeSend={sanitizeGen3AnalyticsEvent} mode="production" />;
}
