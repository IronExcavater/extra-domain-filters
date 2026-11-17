import { SUPPORT_EMAIL } from "@extra-domain-filters/shared/config/links";

export { CHROME_WEB_STORE_URL, GITHUB_URL, SUPPORT_EMAIL } from "@extra-domain-filters/shared/config/links";

export type SiteRoute = "/" | "/support/" | "/privacy/" | "/terms/" | "/data-deletion/";

export interface LegalSection {
    body: readonly string[];
    id: string;
    title: string;
}

export interface LegalPage {
    intro: string;
    sections: readonly LegalSection[];
    title: string;
}

export const EFFECTIVE_DATE = "12 August 2026";

export interface Feature {
    /** The part of the title in green. */
    accent: string;
    bullets: readonly string[];
    /** One of the extension's own icons (landing.ts ICONS). */
    icon: "bell" | "bin" | "could-haves" | "sync";
    id: string;
    rest: string;
    shot: "blacklist" | "filters" | "saved-searches" | "sign-in";
}

/** The landing page's features, each with its popup capture (docs/store/web). */
export const features: readonly Feature[] = [
    {
        id: "filters",
        icon: "could-haves",
        accent: "Filters",
        rest: "Domain doesn't have",
        shot: "filters",
        bullets: [
            "Tick could-haves like a pool or a dishwasher, or add your own",
            "Matches get a gold tag in results and a gold pin on the map",
            "Exclude keywords such as \"studio\" or \"tenanted\"",
            "Cap strata fees, and hide property types, even mis-tagged ones",
        ],
    },
    {
        id: "blacklist",
        icon: "bin",
        accent: "Hide it once,",
        rest: "it stays hidden",
        shot: "blacklist",
        bullets: [
            "Bin a listing and it's gone from every search",
            "Hide every listing from an agency, or from one agent",
            "See why each listing is hidden, and bring it back in a click",
            "Hidden listings' pins disappear from the map too",
        ],
    },
    {
        id: "saved-searches",
        icon: "bell",
        accent: "Saved searches,",
        rest: "without the inbox",
        shot: "saved-searches",
        bullets: [
            "Every saved search in one place, with what's new",
            "Daily or weekly emails, or none at all: save a search with no alerts",
            "Share a search, filters included, with a link",
            "Notes on shortlisted listings, on the back of each card",
        ],
    },
    {
        id: "sync",
        icon: "sync",
        accent: "Your setup,",
        rest: "on every browser",
        shot: "sign-in",
        bullets: [
            "Optional: everything works without an account",
            "Sign in with Google, Apple, Facebook or email",
            "Filters, blacklist and searches follow you everywhere",
        ],
    },
];

export const legalPages: Readonly<Record<Exclude<SiteRoute, "/">, LegalPage>> = {
    "/support/": {
        title: "Support",
        intro: "How to get the most out of Extra Domain Filters, and how to reach us when something isn't working.",
        sections: [
            {
                id: "getting-started",
                title: "Getting started",
                body: [
                    "Install the extension, then open any search on domain.com.au. Your extra filters appear in Domain's own filter panel, under its filters, and apply to every search.",
                    "The extension's toolbar button opens your saved searches, your filters and your blacklist, plus preferences for every feature. The same preferences are on Domain under your profile, as Extension preferences.",
                ],
            },
            {
                id: "filters",
                title: "Filters",
                body: [
                    "Could-haves are extras you'd like, such as a pool or a dishwasher. Tick the ones you want, add your own (\"ocean view / sea view\" matches either), or reset to the defaults. Listings that mention one get a gold tag in results and a gold pin on the map. You can also hide listings that mention none of them.",
                    "Exclude keywords hides listings whose description mentions any of your words. The strata slider hides listings whose quarterly strata fee is above your maximum.",
                    "Property types you untick in Domain's type filter are hidden, along with listings whose description names them as that type, such as a \"3 bedroom townhouse\" tagged as a house.",
                    "Filters read listing descriptions in the background, one at a time, so a listing can take a moment to be filtered after it first appears. You can turn this off, or change its pace, in preferences.",
                ],
            },
            {
                id: "blacklist",
                title: "Blacklist",
                body: [
                    "Use the bin on a listing to hide it from every search. Hover a listing's agency strip for a bin that hides every listing from that agency or one of its agents.",
                    "Hidden listings are summarised at the end of each page of results, with why each one is hidden and a button to show it again. Your blacklist, with tabs for properties, agencies and agents, is in the toolbar popup and in Domain's account menu.",
                ],
            },
            {
                id: "sync",
                title: "Accounts and sync",
                body: [
                    "An account is optional. Signing in keeps your filters, blacklist and saved searches the same on every browser you use.",
                    "Sign in with Google, Apple, Facebook or an email and password, in any browser. On Chrome, Google, Apple and Facebook sign-in finishes in the popup; in other browsers it finishes in a sign-in tab that closes by itself.",
                    "Saved searches sync with your Domain account while you're signed in to domain.com.au in the same browser.",
                ],
            },
            {
                id: "troubleshooting",
                title: "Troubleshooting",
                body: [
                    "If the extra filters don't appear, reload the Domain page, and check that Extra Domain Filters is switched on in its preferences and in your browser's extension settings.",
                    "If a listing is hidden and you don't know why, open the hidden listings summary at the end of the results: each listing shows the filter or blacklist entry that hides it.",
                    "Domain changes its website from time to time, which can briefly break a feature until the extension is updated. Reporting it helps us fix it sooner.",
                ],
            },
            {
                id: "contact",
                title: "Contact",
                body: [
                    `Email ${SUPPORT_EMAIL} with questions, problems or ideas. Include your browser and what you were doing on Domain when it happened.`,
                    "You can also report a problem or request a feature on GitHub, at github.com/IronExcavater/extra-domain-filters/issues.",
                ],
            },
        ],
    },
    "/privacy/": {
        title: "Privacy Policy",
        intro: "This Privacy Policy explains how Extra Domain Filters handles personal information when you use the browser extension or this website.",
        sections: [
            {
                id: "who-we-are",
                title: "Who we are",
                body: [
                    `Extra Domain Filters is operated by Niclas Rogulski (we, us and our). You can contact us about privacy at ${SUPPORT_EMAIL}.`,
                    "This policy applies to the Extra Domain Filters browser extension and this website. It does not apply to domain.com.au, Chrome, Firebase, Google, Meta, Apple or another third-party service, each of which has its own privacy practices.",
                ],
            },
            {
                id: "information-we-collect",
                title: "Information we collect",
                body: [
                    "When you create or use an account, Firebase Authentication may process your Firebase user ID, email address, display name, chosen sign-in provider and session information. If you choose Google, Facebook or Apple sign-in, the selected provider may provide account information needed to complete that sign-in.",
                    "The extension stores settings, saved searches, blacklist records, sync/device metadata and queued telemetry locally in Chrome extension storage. Saved searches can include search URLs, filter parameters, titles, alert preferences and timestamps. Blacklist records can include listing URLs and timestamps.",
                    "If you sign in and enable sync, the extension stores your settings, saved-search records and blacklist records in Firebase Firestore under your Firebase user ID. If you create a shared search link, its search parameters, owner identifier, creation time and expiry are stored so that the link can be opened.",
                    "If usage analytics or diagnostics are enabled in the extension, we may process an installation/device identifier and the configured event data. We do not ask you to send passwords, recovery codes or OAuth tokens to us by email.",
                ],
            },
            {
                id: "how-we-use-information",
                title: "How we use information",
                body: [
                    "We use information to provide account sign-in, sync the preferences you choose to sync, save and share searches, maintain extension settings, troubleshoot issues and improve the extension when optional analytics or diagnostics are enabled.",
                    "We do not use your information to make property, credit, insurance or investment decisions about you. We do not sell personal information as a product.",
                ],
            },
            {
                id: "storage-and-sharing",
                title: "Storage and sharing",
                body: [
                    "The extension uses Chrome extension storage on your device and Firebase services supplied by Google to provide authentication and optional cloud sync. Depending on the service and your chosen provider, information may be processed outside Australia.",
                    "When you choose a federated sign-in method, the relevant identity provider processes that sign-in under its own terms. When you open a shared-search link, anyone with that link can view the search parameters in it until it expires, so do not share a link that includes information you would not want another person to see.",
                    "We may disclose information where required or permitted by law, to protect the security of the service, or to service providers that process it for the purposes described in this policy.",
                ],
            },
            {
                id: "retention",
                title: "Retention",
                body: [
                    "Local extension data remains on your device until you change it, clear extension data or remove the extension. Synced account data remains while your account and sync data are retained, unless you ask us to delete it or a longer period is required by law.",
                    "Shared-search records expire after seven days. Eligible analytics and diagnostic records are configured to expire within 30 days. Some technical records may remain temporarily in backups or service-provider systems before being overwritten under their normal retention processes.",
                ],
            },
            {
                id: "your-choices",
                title: "Your choices, access and correction",
                body: [
                    "You can change many preferences in the extension, disable optional analytics or diagnostics in its settings, and remove local data by uninstalling the extension or using Chrome's extension-data controls.",
                    `To request access to, correction of or deletion of personal information we hold, email ${SUPPORT_EMAIL}. For deletion instructions, see our Data Deletion page. We may need to verify that a request relates to your account before acting on it.`,
                    "If you believe we have mishandled personal information, please contact us first so we can investigate. Privacy rights and complaint options may vary based on where you live.",
                ],
            },
            {
                id: "security",
                title: "Security",
                body: [
                    "We use reasonable measures designed to limit access to personal information, including authenticated Firestore access rules and the security controls provided by the services we use. No internet-based service can guarantee absolute security, so please keep your account credentials secure and do not share them.",
                ],
            },
            {
                id: "changes",
                title: "Changes to this policy",
                body: [
                    "We may update this policy as the extension changes or legal requirements evolve. We will publish the current version on this page and update the effective date when a material change is made.",
                ],
            },
            {
                id: "contact",
                title: "Contact",
                body: [
                    `For privacy questions, access, correction, complaints or deletion requests, email Niclas Rogulski at ${SUPPORT_EMAIL}.`,
                ],
            },
        ],
    },
    "/terms/": {
        title: "Terms of Service",
        intro: "These Terms of Service set out the rules for using Extra Domain Filters and this website. They are effective from 12 August 2026.",
        sections: [
            {
                id: "agreement",
                title: "Agreement to these Terms",
                body: [
                    "By installing, accessing or using Extra Domain Filters, you agree to these Terms. If you do not agree, do not use the extension or this website.",
                    "You must be able to enter a binding agreement in your location. If you use the extension for an organisation, you confirm that you are authorised to accept these Terms on its behalf.",
                ],
            },
            {
                id: "service",
                title: "The service",
                body: [
                    "Extra Domain Filters is a browser extension that provides optional tools for a person's use of domain.com.au property-search pages, including filters, saved searches, listing controls and optional account sync. Features may change as the extension evolves.",
                    "The extension and website are independently operated. They are not affiliated with, endorsed by, sponsored by or operated by Domain Group, domain.com.au, Google, Chrome, Meta or Apple.",
                ],
            },
            {
                id: "accounts",
                title: "Accounts and security",
                body: [
                    "Some features require an account. You are responsible for providing accurate information, safeguarding your credentials and activity performed through your account. Tell us promptly if you believe your account has been accessed without permission.",
                    "Your use of Google, Facebook or Apple sign-in is also subject to the relevant provider's terms and policies.",
                ],
            },
            {
                id: "acceptable-use",
                title: "Acceptable use",
                body: [
                    "You must use the extension lawfully and in accordance with these Terms and the rules that apply to third-party websites you visit. Do not interfere with the extension, bypass access controls, introduce malicious code, attempt unauthorised access, use the service to violate another person's rights, or use automated collection in a manner prohibited by the relevant website or law.",
                    "You must not reverse engineer, decompile or attempt to derive source code from the extension except to the extent a restriction is prohibited by applicable law.",
                ],
            },
            {
                id: "third-party-services",
                title: "Third-party services",
                body: [
                    "The extension interacts with services you choose to use, including Chrome, Firebase Authentication, Firebase Firestore, identity providers and domain.com.au. Those services are controlled by their providers, and we are not responsible for their availability, content, policies or acts.",
                    "You are responsible for maintaining any accounts, permissions and subscriptions required by third-party services.",
                ],
            },
            {
                id: "intellectual-property",
                title: "Intellectual property",
                body: [
                    "We grant you a limited, revocable, non-exclusive, non-transferable licence to use the extension for personal or internal lawful purposes while you comply with these Terms. Except for that licence, all rights in Extra Domain Filters and this website are reserved by Niclas Rogulski and relevant licensors.",
                    "Third-party names, marks and content remain the property of their respective owners.",
                ],
            },
            {
                id: "availability",
                title: "Availability and changes",
                body: [
                    "We may modify, suspend or discontinue all or part of the extension or website, including a feature, integration or account option. We do not guarantee uninterrupted availability, compatibility with every browser or website layout, or that every result will be accurate or complete.",
                ],
            },
            {
                id: "disclaimers",
                title: "Important disclaimers",
                body: [
                    "Extra Domain Filters is a convenience tool. It does not provide property, real-estate, investment, financial, legal or other professional advice. You are responsible for verifying listings, prices, alerts, availability and other information through appropriate sources before acting.",
                    "To the maximum extent permitted by law, the service is provided on an as-is and as-available basis. Nothing in these Terms excludes rights or guarantees that cannot lawfully be excluded, including applicable rights under the Australian Consumer Law.",
                ],
            },
            {
                id: "liability",
                title: "Liability",
                body: [
                    "To the maximum extent permitted by law, we are not liable for indirect, incidental, special or consequential loss, or loss of data, profit, opportunity or goodwill arising from use of or inability to use the extension or website. Where liability cannot lawfully be excluded, it is limited to the remedies available under applicable law.",
                ],
            },
            {
                id: "termination",
                title: "Termination",
                body: [
                    "You may stop using the extension at any time by uninstalling it. We may suspend or end access where reasonably necessary to protect the service, users or third parties, or where you materially breach these Terms.",
                ],
            },
            {
                id: "governing-law",
                title: "Governing law",
                body: [
                    "These Terms are governed by the laws of New South Wales, Australia. Subject to rights that cannot be excluded, you and we submit to the exclusive jurisdiction of the courts of New South Wales and courts entitled to hear appeals from them.",
                ],
            },
            {
                id: "changes",
                title: "Changes to these Terms",
                body: [
                    "We may update these Terms from time to time. The current version will be published on this page with its effective date. Continued use after an update takes effect means you accept the updated Terms to the extent permitted by law.",
                ],
            },
            {
                id: "contact",
                title: "Contact",
                body: [
                    `Questions about these Terms can be sent to Niclas Rogulski at ${SUPPORT_EMAIL}.`,
                ],
            },
        ],
    },
    "/data-deletion/": {
        title: "Data Deletion Instructions",
        intro: "You can ask us to delete personal information associated with your Extra Domain Filters account. This page explains the manual request process used by the service today.",
        sections: [
            {
                id: "make-a-request",
                title: "How to make a request",
                body: [
                    `Email ${SUPPORT_EMAIL} from the email address used for your Extra Domain Filters account. Use the subject line: Extra Domain Filters data deletion request.`,
                    "Include the account email address and, if relevant, any shared-search links you created. Do not include your password, recovery codes, OAuth tokens or other credentials in an email.",
                ],
            },
            {
                id: "verification-and-timing",
                title: "Verification and timing",
                body: [
                    "We may ask for proportionate information to verify that the request relates to your account. Once a request is verified, we aim to process it within 30 days. If we need more information or cannot complete a request, we will explain why using the email address from which the request was made.",
                ],
            },
            {
                id: "what-we-delete",
                title: "What a verified request covers",
                body: [
                    "A verified request can cover the Firebase Authentication account, synced Firestore settings, saved-search records, blacklist records, owned shared-search records where identifiable, and eligible telemetry held by the service. Some records may remain temporarily in backups or provider systems before being overwritten under their normal retention processes.",
                    "Uninstalling the extension or using Chrome's extension-data controls removes data stored locally in Chrome on that device. It does not automatically remove cloud-synced data, so email us if you also want the account and synced data deleted.",
                ],
            },
            {
                id: "third-party-data",
                title: "Third-party services",
                body: [
                    "A request to us does not delete information held by Google, Firebase, Chrome, Meta, Apple, domain.com.au or another provider. You may need to use the privacy or account-deletion process offered by the relevant provider for information held by that provider.",
                ],
            },
            {
                id: "contact",
                title: "Contact",
                body: [
                    `For questions about a deletion request, contact Niclas Rogulski at ${SUPPORT_EMAIL}.`,
                ],
            },
        ],
    },
};
