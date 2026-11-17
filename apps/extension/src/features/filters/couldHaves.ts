import type { CouldHaveOption } from "../../domain/matching";
import { trackTelemetry } from "../../domain/telemetry/client";
import type { LifecycleScope } from "../../platform/lifecycle";
import { onStorageChange } from "../../platform/storage";
import { Property } from "../../state/property";
import {
    addCouldHave,
    getSettings,
    isDefaultCouldHaveList,
    removeCouldHave,
    resetCouldHaves,
    setCouldHaveSelected,
    updateSettings,
    type Settings,
} from "../../state/settings";
import { createSvgIcon } from "../../ui/elements";
import { replaceWithCloseIcon, replaceWithCouldHavesFilterIcon, replaceWithPopupPlusIcon } from "../../ui/icons";
import { createDraftProperty } from "./bindings/draft";
import { createCheckboxControl, createFilterSection } from "./controls";

/**
 * Could-haves in Domain's filter panel: the user's own list of ticks (drafted with the rest of
 * the panel until Search), each removable, plus a field to add one and a reset back to the
 * built-in list. Adding or removing applies straight away, as it changes the list itself.
 */
export async function createCouldHavesSection(anchor: HTMLElement, scope: LifecycleScope): Promise<HTMLDivElement> {
    const section = createFilterSection(
        "Could-Haves",
        "dynamic-search-filters__preference-options",
        replaceWithCouldHavesFilterIcon,
    );
    const heading = section.querySelector("h3");
    const reset = document.createElement("button");
    const grid = document.createElement("div");
    const adder = document.createElement("div");
    const input = document.createElement("input");
    const add = document.createElement("button");
    let renderedKey = "";
    let optionsScope: LifecycleScope | undefined;

    reset.type = "button";
    reset.className = "edf-filter-heading-action";
    reset.textContent = "Reset";
    reset.ariaLabel = "Reset could-haves to the default list";
    heading?.append(reset);
    grid.className = "edf-filter-checkbox-grid";
    adder.className = "edf-filter-could-have-adder";
    input.className = "edf-filter-text";
    input.type = "text";
    input.maxLength = 60;
    input.placeholder = "Add a could-have, e.g. solar";
    input.ariaLabel = "Add a could-have";
    add.type = "button";
    add.className = "edf-filter-could-have-add";
    add.ariaLabel = "Add could-have";
    add.append(createSvgIcon(replaceWithPopupPlusIcon), "Add");
    adder.append(input, add);
    section.append(grid, adder);

    const render = async (options: readonly CouldHaveOption[]): Promise<void> => {
        const key = JSON.stringify(options);
        if (key === renderedKey || scope.disposed) return;
        renderedKey = key;
        optionsScope?.dispose();
        const current = scope.child("could-have-options");
        optionsScope = current;

        const items = await Promise.all(options.map(async (option, index) => {
            const selected = Property.from("boolean", {
                get: async () => (await getSettings()).filters.couldHaveRuleIds.includes(option.id),
                set: async value => {
                    await setCouldHaveSelected(option.id, value);
                    void trackTelemetry({ name: "feature_used", feature: "could_haves" });
                },
            });
            const control = await createCheckboxControl(
                await createDraftProperty(anchor, selected, false, current),
                { id: `could-have-${index}`, label: option.label },
            );
            const item = document.createElement("div");
            const remove = document.createElement("button");
            item.className = "edf-filter-could-have";
            remove.type = "button";
            remove.className = "edf-filter-could-have-remove";
            remove.ariaLabel = `Remove ${option.label} from could-haves`;
            remove.append(createSvgIcon(replaceWithCloseIcon));
            remove.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                item.dataset.removing = "true";
                void removeCouldHave(option.id);
            });
            item.append(control, remove);
            return item;
        }));
        if (current.disposed) return;
        grid.replaceChildren(...items);
        reset.hidden = isDefaultCouldHaveList(options);
    };

    const submit = async (): Promise<void> => {
        const text = input.value.trim();
        if (!text) {
            input.focus();
            return;
        }
        input.value = "";
        await addCouldHave(text);
        void trackTelemetry({ name: "feature_used", feature: "could_haves" });
        input.focus();
    };
    // Enter must not reach Domain's panel, which treats it as Search.
    input.addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        void submit();
    });
    add.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        void submit();
    });
    reset.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        void resetCouldHaves();
    });

    const strict = Property.from("boolean", {
        get: async () => (await getSettings()).filters.excludeWhenNoCouldHaveMatch,
        set: value => updateSettings({ filters: { excludeWhenNoCouldHaveMatch: value } }),
    });
    const strictControl = await createCheckboxControl(
        await createDraftProperty(anchor, strict, false, scope),
        { id: "could-have-strict", label: "Hide listings with none of these" },
    );
    strictControl.classList.add("edf-filter-could-have-strict");
    section.append(strictControl);

    await render((await getSettings()).filters.couldHaveOptions);
    scope.add(onStorageChange<Settings>("settings", next => {
        if (next?.filters?.couldHaveOptions) void render(next.filters.couldHaveOptions);
    }));
    scope.add(() => optionsScope?.dispose());
    return section;
}
