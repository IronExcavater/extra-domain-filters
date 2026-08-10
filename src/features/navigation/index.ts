import { onBodyMutations } from "../../shared/dom/bodyMutations";
import { findNavigationMenus, observeNavigationMenu } from "../../shared/domain/navigation";
import type { PageContext } from "../../shared/platform/router";

const boundMenus = new WeakMap<HTMLElement, AbortSignal>();

export function enableNavigationChevronAnimation(context: PageContext): void {
    const bind = (): void => {
        for (const binding of findNavigationMenus()) {
            const existingSignal = boundMenus.get(binding.carrier);
            if (existingSignal && !existingSignal.aborted) continue;
            boundMenus.set(binding.carrier, context.signal);
            binding.chevron.dataset.edfNavigationChevron = "true";
            observeNavigationMenu(binding, open => {
                binding.carrier.dataset.edfNavigationOpen = String(open);
                if (binding.carrier.dataset.edfNavigationReady !== "true") {
                    requestAnimationFrame(() => {
                        if (!context.signal.aborted) binding.carrier.dataset.edfNavigationReady = "true";
                    });
                }
            }, context.signal);
            context.scope.add(() => {
                if (boundMenus.get(binding.carrier) === context.signal) {
                    boundMenus.delete(binding.carrier);
                }
                delete binding.carrier.dataset.edfNavigationOpen;
                delete binding.carrier.dataset.edfNavigationReady;
                delete binding.chevron.dataset.edfNavigationChevron;
            });
        }
    };

    bind();
    onBodyMutations(bind, context.signal);
}

export function enableStickyHeader(context: PageContext): void {
    document.documentElement.dataset.edfStickyHeader = "true";
    const header = document.querySelector<HTMLElement>(
        'header.header[role="banner"] > section.css-a5sdz5 + div',
    );
    const headerRoot = header?.closest<HTMLElement>('header.header[role="banner"]');
    const sentinel = document.createElement("span");

    if (header && headerRoot) {
        sentinel.ariaHidden = "true";
        sentinel.style.cssText = "display:block;height:1px;margin:0;pointer-events:none;";
        headerRoot.before(sentinel);
        const observer = new IntersectionObserver(([entry]) => {
            header.dataset.edfStuck = String(!entry.isIntersecting);
        });

        observer.observe(sentinel);
        context.scope.add(() => {
            observer.disconnect();
            sentinel.remove();
            delete header.dataset.edfStuck;
        });
    }
    context.scope.add(() => {
        delete document.documentElement.dataset.edfStickyHeader;
    });
}
