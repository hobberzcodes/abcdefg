class AuthManager {
    constructor() {
        this.currentUser = null;
        this.currentUserProfile = null;
        this.authStateReady = false;
        this.authStatePromise = null;

        this.init();
    }

    async init() {
        if (this.authStatePromise) {
            return this.authStatePromise;
        }

        this.authStatePromise = this._checkAuthState();
        return this.authStatePromise;
    }

    async _checkAuthState() {
        try {
            console.log("🔐 Checking authentication state...");

            if (!supabaseClient) {
                console.error("❌ Supabase client not available");
                this._redirectToLogin();
                return;
            }

            const { data: { session }, error } = await supabaseClient.auth.getSession();

            if (error) {
                console.error("❌ Error getting auth session:", error);
                this._redirectToLogin();
                return;
            }

            if (!session) {
                console.log("🚪 No active session, redirecting to login");
                this._redirectToLogin();
                return;
            }

            this.currentUser = session.user;
            console.log("✅ Authentication verified for user:", this.currentUser.email);

            await this._fetchUserProfile();

            this.authStateReady = true;
            console.log("🎯 Auth state ready, user profile loaded");

        } catch (error) {
            console.error("❌ Authentication check failed:", error);
            this._redirectToLogin();
        }
    }

    async _fetchUserProfile() {
        if (!this.currentUser) {
            console.error("❌ Cannot fetch profile - no authenticated user");
            return;
        }

        try {
            console.log(`🔍 Fetching profile for user ID: ${this.currentUser.id}`);

            const { data: profile, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error) {
                console.error("❌ Error fetching user profile:", error);

                this.currentUserProfile = {
                    username: this.currentUser.email.split('@')[0], 
                    profile_picture: 'pfp.png',
                    banner: 'defbanner.png',
                    tag: 'User'
                };
                return;
            }

            if (!profile) {
                console.warn("⚠️ No profile found for authenticated user");
                this.currentUserProfile = {
                    username: this.currentUser.email.split('@')[0],
                    profile_picture: 'pfp.png',
                    banner: 'defbanner.png',
                    tag: 'User'
                };
                return;
            }

            this.currentUserProfile = profile;
            console.log("✅ User profile loaded:", this.currentUserProfile);

        } catch (error) {
            console.error("❌ Failed to fetch user profile:", error);

            this.currentUserProfile = {
                username: this.currentUser.email.split('@')[0],
                profile_picture: 'pfp.png',
                banner: 'defbanner.png',
                tag: 'User'
            };
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getCurrentUserProfile() {
        return this.currentUserProfile;
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    isReady() {
        return this.authStateReady;
    }

    async waitForAuth() {
        if (this.authStateReady) return;
        await this.init();
    }

    async signOut() {
        try {
            console.log("🚪 Signing out user...");
            const { error } = await supabaseClient.auth.signOut();

            if (error) {
                console.error("❌ Error signing out:", error);
                return;
            }

            this.currentUser = null;
            this.currentUserProfile = null;
            this.authStateReady = false;
            this.authStatePromise = null;

            console.log("✅ User signed out successfully");
            this._redirectToLogin();

        } catch (error) {
            console.error("❌ Sign out failed:", error);
        }
    }

    async updateProfile(profileData) {
        if (!this.currentUser) {
            console.error("❌ Cannot update profile - no authenticated user");
            return false;
        }

        try {
            console.log("📝 Updating user profile...");

            const { data, error } = await supabaseClient
                .from('profiles')
                .update(profileData)
                .eq('id', this.currentUser.id)
                .select()
                .single();

            if (error) {
                console.error("❌ Error updating profile:", error);
                return false;
            }

            this.currentUserProfile = { ...this.currentUserProfile, ...data };
            console.log("✅ Profile updated successfully");
            return true;

        } catch (error) {
            console.error("❌ Profile update failed:", error);
            return false;
        }
    }

    _redirectToLogin() {

        if (!window.location.pathname.includes('login.html')) {
            console.log("🔄 Redirecting to login page...");
            window.location.href = 'login.html';
        }
    }

    onAuthStateChange(callback) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log("🔄 Auth state changed:", event);

            if (event === 'SIGNED_OUT' || !session) {
                this.currentUser = null;
                this.currentUserProfile = null;
                this.authStateReady = false;
                this.authStatePromise = null;
                callback(null, null);
                this._redirectToLogin();
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                this.currentUser = session.user;
                this._fetchUserProfile().then(() => {
                    this.authStateReady = true;
                    callback(this.currentUser, this.currentUserProfile);
                });
            }
        });
    }
}

const authManager = new AuthManager();

window.authManager = authManager;

console.log("🔐 Auth Manager initialized");