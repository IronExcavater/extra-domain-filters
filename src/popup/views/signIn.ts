import wordmarkUrl from "../../../public/icons/brand/wordmark.svg?url";
import { signIn } from "../../domain/account/client";

interface SignInViewOptions {
    onComplete(): void;
    onBack(): void;
}

function createGoogleMark(): SVGSVGElement {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.innerHTML = "<path fill=\"#4285f4\" d=\"M21.35 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.52h3.15c1.84-1.7 2.9-4.2 2.9-7.29Z\"/><path fill=\"#34a853\" d=\"M12 21.75c2.63 0 4.84-.87 6.45-2.23l-3.15-2.52c-.87.59-1.99.94-3.3.94-2.54 0-4.7-1.72-5.47-4.03H3.27v2.6A9.75 9.75 0 0 0 12 21.75Z\"/><path fill=\"#fbbc05\" d=\"M6.53 13.91A5.87 5.87 0 0 1 6.22 12c0-.66.11-1.3.31-1.91v-2.6H3.27A9.75 9.75 0 0 0 3.27 16.5l3.26-2.59Z\"/><path fill=\"#ea4335\" d=\"M12 6.06c1.43 0 2.72.49 3.73 1.45l2.8-2.8C16.84 3.14 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.73 5.24l3.26 2.6C7.3 7.78 9.46 6.06 12 6.06Z\"/>";
    return icon;
}

function createWordmark(): HTMLImageElement {
    const image = document.createElement("img");

    image.alt = "Extra Domain Filters";
    image.src = wordmarkUrl;
    return image;
}

export function createSignInView(options: SignInViewOptions): HTMLElement {
    const view = document.createElement("section");
    const panel = document.createElement("div");
    const brand = createWordmark();
    const back = document.createElement("button");
    const title = document.createElement("h1");
    const google = document.createElement("button");
    const error = document.createElement("p");
    const image = document.createElement("aside");

    view.className = "edf-popup-sign-in";
    panel.className = "edf-popup-sign-in-panel";
    brand.className = "edf-popup-sign-in-brand";
    back.className = "edf-popup-sign-in-back";
    back.type = "button";
    back.textContent = "Back";
    back.addEventListener("click", options.onBack);
    title.textContent = "Sign in to sync";
    google.className = "edf-popup-auth-provider";
    google.type = "button";
    google.append(createGoogleMark(), document.createTextNode("Continue with Google"));
    error.className = "edf-popup-auth-error";
    error.hidden = true;
    google.addEventListener("click", async () => {
        google.disabled = true;
        error.hidden = true;
        try {
            await signIn();
            options.onComplete();
        } catch (reason) {
            error.textContent = reason instanceof Error ? reason.message : "Unable to sign in.";
            error.hidden = false;
            google.disabled = false;
        }
    });
    image.className = "edf-popup-sign-in-image";
    image.setAttribute("aria-label", "Contemporary Australian home interior");
    panel.append(brand, back, title, google, error);
    view.append(panel, image);
    return view;
}
