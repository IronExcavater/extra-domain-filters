import { sendExtensionRequest } from "../../platform/messages";
import type { TelemetryEventInput } from "./model";

export async function trackTelemetry(event: TelemetryEventInput): Promise<void> {
    await sendExtensionRequest({ type: "telemetry:track", event });
}
