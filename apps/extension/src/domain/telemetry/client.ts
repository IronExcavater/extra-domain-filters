import { sendExtensionMessage } from "../../platform/messaging";
import type { TelemetryEventInput } from "./model";

export async function trackTelemetry(event: TelemetryEventInput): Promise<void> {
    await sendExtensionMessage("telemetry:track", { event });
}
