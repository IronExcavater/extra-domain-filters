export { CHROME_WEB_STORE_URL, GITHUB_URL, SUPPORT_EMAIL } from "@extra-domain-filters/shared/config/links";

export type SiteRoute = "/" | "/support/" | "/privacy/" | "/terms/" | "/data-deletion/";

/** The extension's own icons the landing page uses (landing.ts ICONS). */
export type IconName = "bell" | "bin" | "could-haves" | "sync";

export interface Feature {
    /** Describes the popup capture shown with it. */
    alt: string;
    bullets: readonly string[];
    icon: IconName;
    id: string;
    shot: "blacklist" | "filters" | "filters-more" | "saved-searches" | "sign-in";
    summary: string;
    title: string;
}

/** The landing page's features, each with its popup capture (docs/store/web). Each says what
 * the extension adds to Domain, not what Domain already does. */
export const features: readonly Feature[] = [
    {
        id: "filters",
        icon: "could-haves",
        title: "Extra filters",
        summary: "What Domain's filters can't do",
        shot: "filters-more",
        alt: "The extension's Filters page: excluded keywords, a strata limit of $1,200 a quarter, and property types",
        bullets: [
            "Could-haves like a pool or solar, or your own",
            "Hide listings that mention words like \"tenanted\"",
            "A strata limit, and property types that stay hidden",
        ],
    },
    {
        id: "blacklist",
        icon: "bin",
        title: "Blacklist",
        summary: "Hide a listing once, for good",
        shot: "blacklist",
        alt: "The extension's blacklist, with tabs for properties, agencies and agents, and one listing selected",
        bullets: [
            "Hide listings, agencies or agents from every search",
            "See what's hidden, and why, at the end of each page",
            "Unblacklist several at once",
        ],
    },
    {
        id: "saved-searches",
        icon: "bell",
        title: "Better saved searches",
        summary: "Saved without the emails",
        shot: "saved-searches",
        alt: "The extension's saved searches, each with its filters, new listings and email alert setting",
        bullets: [
            "Set any search's emails to Never",
            "Each search's filters at a glance",
            "Share a search with your extra filters",
        ],
    },
    {
        id: "sync",
        icon: "sync",
        title: "Sync",
        summary: "The same setup on every browser",
        shot: "sign-in",
        alt: "The extension's sign-in page, with Google, Apple, Facebook and email",
        bullets: [
            "Optional: it all works without an account",
            "Google, Apple, Facebook or email",
        ],
    },
];

export interface Place {
    /** Picks its picture of the extension's own UI there (landing.ts PLACE_ART). */
    id: "filter-panel" | "results" | "saved-searches" | "shortlist";
    text: string;
    title: string;
}

/** What the extension adds to each part of domain.com.au. */
export const places: readonly Place[] = [
    { id: "results", title: "Search results", text: "Could-haves tagged on photos, and a bin on every listing." },
    { id: "filter-panel", title: "Filter panel", text: "Could-have, keyword and strata filters under Domain's own." },
    { id: "shortlist", title: "Shortlist", text: "A note on every card, saved as you type." },
    { id: "saved-searches", title: "Saved searches", text: "Alerts set to Never, and searches you can share." },
];

export interface Faq {
    /** May hold a link. */
    answer: string;
    question: string;
}

export interface LegalSection {
    body: readonly string[];
    id: string;
    /** Support's sections are questions, each opening to its answer. */
    questions?: readonly Faq[];
    title: string;
}

export interface LegalPage {
    intro: string;
    sections: readonly LegalSection[];
    title: string;
}

export const EFFECTIVE_DATE = "12 August 2026";

export const legalPages: Readonly<Record<Exclude<SiteRoute, "/">, LegalPage>> = {
    "/support/": {
        title: "Support",
        intro: "Answers about filters, the blacklist, saved searches and your account. If yours isn't here, <a href=\"#contact\">contact us</a>.",
        sections: [
            {
                id: "getting-started",
                title: "Getting started",
                body: [],
                questions: [
                    {
                        question: "How do I start using it?",
                        answer: "<a href=\"/#browsers\">Install it</a> from your browser's store, then open any search on domain.com.au. The extra filters are in Domain's filter panel, under its own filters. The extension's toolbar button opens your saved searches, filters and blacklist from any tab.",
                    },
                    {
                        question: "Do I need an account?",
                        answer: "No, everything works without one. Signing in only keeps your setup the same on every browser you use.",
                    },
                    {
                        question: "Is it made by Domain?",
                        answer: "No. It's an independent extension and isn't affiliated with Domain. It only changes how domain.com.au works in your own browser.",
                    },
                    {
                        question: "Which browsers does it work in?",
                        answer: "Chrome, Edge, Firefox and Opera. Brave, Vivaldi, Arc and other Chromium browsers install it from the Chrome Web Store, as Edge and Opera can, and Zen, LibreWolf and other Firefox-based browsers from Firefox Add-ons. <a href=\"/#browsers\">Get it for your browser</a>.",
                    },
                ],
            },
            {
                id: "filters",
                title: "Filters",
                body: [],
                questions: [
                    {
                        question: "What are could-haves?",
                        answer: "Extras you'd like but don't need, such as a pool or a dishwasher. Listings that mention one are tagged on their photo and get a gold pin on the map. Tick the ones you want, add your own (\"ocean view / sea view\" matches either), or hide listings that mention none of them.",
                    },
                    {
                        question: "How do the keyword and strata filters work?",
                        answer: "Exclude keywords hides listings whose description mentions any of your words, such as \"tenanted\". The strata slider hides listings whose quarterly strata fee is above your maximum.",
                    },
                    {
                        question: "How is the property type filter different from Domain's?",
                        answer: "Domain's goes by how a listing is tagged. The extension also hides listings whose description names a type you unticked, such as a \"3 bedroom townhouse\" tagged as a house.",
                    },
                    {
                        question: "Will it slow Domain down?",
                        answer: "No. Filters read listing descriptions in the background, one at a time, so a listing can take a moment to be filtered after it appears. You can change the pace, or turn it off, in preferences.",
                    },
                ],
            },
            {
                id: "blacklist",
                title: "Blacklist",
                body: [],
                questions: [
                    {
                        question: "How do I hide a listing?",
                        answer: "Use the bin on its card, and it's hidden from every search until you unblacklist it. Hover a listing's agency strip for a bin that hides every listing from that agency, or from one of its agents.",
                    },
                    {
                        question: "Why is a listing hidden?",
                        answer: "Open the summary of hidden listings at the end of the results. Each listing shows the filter or blacklist entry that hides it, with a button to show it again.",
                    },
                    {
                        question: "How do I get a listing back?",
                        answer: "Open your blacklist in the toolbar popup, or from Domain's account menu. Select the listings, agencies or agents you want back and choose Unblacklist.",
                    },
                ],
            },
            {
                id: "saved-searches",
                title: "Saved searches and shortlist",
                body: [],
                questions: [
                    {
                        question: "Can I save a search without the emails?",
                        answer: "Yes. When you save a search, Domain asks for daily or weekly emails; the extension adds Never. You can change it on the search's card at any time.",
                    },
                    {
                        question: "What does sharing a search include?",
                        answer: "The link opens the same search with your extra filters too, such as your could-haves and excluded keywords. Anyone with the link can open it until it expires, after seven days.",
                    },
                    {
                        question: "How do I add a note to a shortlisted listing?",
                        answer: "Choose Add note on its card. The card turns over to your note, which saves as you type, and View details turns it back. Notes you wrote on Domain before show there too.",
                    },
                ],
            },
            {
                id: "accounts",
                title: "Accounts and sync",
                body: [],
                questions: [
                    {
                        question: "What does signing in do?",
                        answer: "It keeps your filters, blacklist and saved searches the same on every browser you use. Sign in with Google, Apple, Facebook or email.",
                    },
                    {
                        question: "Why did sign-in open a new tab?",
                        answer: "On Chrome, sign-in finishes in the popup. Other browsers finish it in a sign-in tab, which closes by itself.",
                    },
                    {
                        question: "Where is my data kept?",
                        answer: "In your browser. If you sign in, it's also synced to your account so your other browsers can load it. The <a href=\"/privacy/\">privacy policy</a> has the details, and <a href=\"/data-deletion/\">data deletion</a> explains how to have it deleted.",
                    },
                ],
            },
            {
                id: "troubleshooting",
                title: "Troubleshooting",
                body: [],
                questions: [
                    {
                        question: "The extra filters don't show up on Domain.",
                        answer: "Reload the page, then check that Extra Domain Filters is switched on in its preferences and in your browser's extension settings.",
                    },
                    {
                        question: "Something stopped working.",
                        answer: "Domain changes its website from time to time, which can break a feature until the extension is updated. <a href=\"#contact\">Contact us</a> with what happened and it'll be fixed sooner.",
                    },
                ],
            },
        ],
    },
    "/privacy/": {
        title: "Privacy Policy",
        intro: "What Extra Domain Filters collects, what it's used for, where it's kept, and the choices you have.",
        sections: [
            {
                id: "who-we-are",
                title: "Who we are",
                body: [
                    "Extra Domain Filters is operated by Niclas Rogulski (we, us and our). You can <a href=\"/support/#contact\">contact us</a> about privacy at any time.",
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
                    "To request access to, correction of or deletion of personal information we hold, <a href=\"/support/#contact\">contact us</a>. For deletion, follow the <a href=\"/data-deletion/\">data deletion instructions</a>. We may need to verify that a request relates to your account before acting on it.",
                    "If you believe we have mishandled personal information, please <a href=\"/support/#contact\">contact us</a> first so we can investigate. Privacy rights and complaint options may vary based on where you live.",
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
                    "For privacy questions, access, correction, complaints or deletion requests, contact Niclas Rogulski using the <a href=\"/support/#contact\">contact details on the Support page</a>.",
                ],
            },
        ],
    },
    "/terms/": {
        title: "Terms of Service",
        intro: "The terms you agree to when you use Extra Domain Filters or this website.",
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
                    "Some features require an account. You are responsible for providing accurate information, safeguarding your credentials and activity performed through your account. <a href=\"/support/#contact\">Tell us</a> promptly if you believe your account has been accessed without permission.",
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
                    "Send questions about these Terms to Niclas Rogulski using the <a href=\"/support/#contact\">contact details on the Support page</a>.",
                ],
            },
        ],
    },
    "/data-deletion/": {
        title: "Data Deletion Instructions",
        intro: "How to have your account and synced data deleted, and what a request covers.",
        sections: [
            {
                id: "make-a-request",
                title: "How to make a request",
                body: [
                    "Email us at the address in <a href=\"/support/#contact\">Support's contact details</a>, from the email address used for your Extra Domain Filters account. Use the subject line: Extra Domain Filters data deletion request.",
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
                    "Uninstalling the extension or using Chrome's extension-data controls removes data stored locally in Chrome on that device. It does not automatically remove cloud-synced data, so <a href=\"/support/#contact\">contact us</a> if you also want the account and synced data deleted.",
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
                    "For questions about a deletion request, contact Niclas Rogulski using the <a href=\"/support/#contact\">contact details on the Support page</a>.",
                ],
            },
        ],
    },
};
