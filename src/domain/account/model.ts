export type AccountProvider = "apple" | "facebook" | "google";

export interface AccountCapabilities {
    apple: boolean;
    emailPassword: boolean;
    facebook: boolean;
    google: boolean;
}

export interface AccountProfile {
    displayName?: string;
    email?: string;
    emailVerified: boolean;
    photoUrl?: string;
    providers: Array<AccountProvider | "email">;
    uid: string;
}

export interface AccountState {
    capabilities: AccountCapabilities;
    configured: boolean;
    profile?: AccountProfile;
    status: "signed-in" | "signed-out" | "unavailable";
}
