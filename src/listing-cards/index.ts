import { PageContext } from "../shared/router";
import { bindAdRemoval } from "./ads";

// TODO: dispatch each listing <li> to a type-specific handler, in its own file per type:
// - standard: a single property, data-testid="listing-{id}"
// - topspot: a carousel of several featured properties in one <li data-testid="topspot">
// - project: a new-development card covering many properties/apartments at once (DOM not seen yet)

export function bindListingCards(context: PageContext): void {
    bindAdRemoval(context.signal);
}
