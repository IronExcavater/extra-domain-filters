import { showToast } from "../shared/ui/toast";

export function showPopupToast(message: string): void {
    showToast(message, "popup");
}
