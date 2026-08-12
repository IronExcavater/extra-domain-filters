import { SUPPORT_EMAIL } from "@shared/config/links";

export { CHROME_WEB_STORE_URL, GITHUB_URL, SUPPORT_EMAIL } from "@shared/config/links";

export type SiteRoute = "/" | "/privacy/" | "/terms/" | "/data-deletion/";

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

export const capabilities = [
    ["Adaptable filters", "Refine results around the details that matter to you."],
    ["Saved searches", "Keep useful searches close and revisit them without starting over."],
    ["More control", "Blacklist listings and keep your search experience focused."],
] as const;

export const legalPages: Readonly<Record<Exclude<SiteRoute, "/">, LegalPage>> = {
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
