export interface AccountProfile {
    displayName?: string;
    email?: string;
    photoUrl?: string;
    uid: string;
}

export interface AccountState {
    configured: boolean;
    profile?: AccountProfile;
    status: "signed-in" | "signed-out" | "unavailable";
}
