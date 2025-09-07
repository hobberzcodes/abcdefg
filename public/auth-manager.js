/**
 * Authentication Manager for SoundLink App
 * 
 * Handles authentication state, user data fetching, and profile management
 * across the vanilla JavaScript application.
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.currentUserProfile = null;
        this.authStateReady = false;
        this.authStatePromise = null;
        
        // Initialize auth state check
        this.init();
    }

    /**
     * Initialize authentication state
     */
    async init() {
        if (this.authStatePromise) {
            return this.authStatePromise;
        }

        this.authStatePromise = this._checkAuthState();
        return this.authStatePromise;
    }

    /**
     * Check current authentication state with Supabase
     */
    async _checkAuthState() {
        try {
            console.log("🔐 Checking authentication state...");
            
            if (!supabaseClient) {
                console.error("❌ Supabase client not available");
                this._redirectToLogin();
                return;
            }

            // Get current session
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

            // Store the current user
            this.currentUser = session.user;
            console.log("✅ Authentication verified for user:", this.currentUser.email);

            // Fetch user profile data
            await this._fetchUserProfile();
            
            this.authStateReady = true;
            console.log("🎯 Auth state ready, user profile loaded");

        } catch (error) {
            console.error("❌ Authentication check failed:", error);
            this._redirectToLogin();
        }
    }

    /**
     * Fetch user profile data from Supabase profiles table
     */
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
                // Create a minimal profile with just email if profile fetch fails
                this.currentUserProfile = {
                    username: this.currentUser.email.split('@')[0], // Use email prefix as fallback
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
            // Fallback profile
            this.currentUserProfile = {
                username: this.currentUser.email.split('@')[0],
                profile_picture: 'pfp.png',
                banner: 'defbanner.png',
                tag: 'User'
            };
        }
    }

    /**
     * Get current user data
     * @returns {Object|null} Current user object from Supabase auth
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Get current user profile data
     * @returns {Object|null} Current user profile from profiles table
     */
    getCurrentUserProfile() {
        return this.currentUserProfile;
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} True if user is authenticated
     */
    isAuthenticated() {
        return !!this.currentUser;
    }

    /**
     * Check if auth state is ready
     * @returns {boolean} True if auth check is complete
     */
    isReady() {
        return this.authStateReady;
    }

    /**
     * Wait for auth state to be ready
     * @returns {Promise} Promise that resolves when auth state is ready
     */
    async waitForAuth() {
        if (this.authStateReady) return;
        await this.init();
    }

    /**
     * Sign out current user
     */
    async signOut() {
        try {
            console.log("🚪 Signing out user...");
            const { error } = await supabaseClient.auth.signOut();
            
            if (error) {
                console.error("❌ Error signing out:", error);
                return;
            }

            // Clear local state
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

    /**
     * Update user profile data
     * @param {Object} profileData - New profile data to update
     */
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

            // Update local profile data
            this.currentUserProfile = { ...this.currentUserProfile, ...data };
            console.log("✅ Profile updated successfully");
            return true;

        } catch (error) {
            console.error("❌ Profile update failed:", error);
            return false;
        }
    }

    /**
     * Redirect to login page
     */
    _redirectToLogin() {
        // Only redirect if we're not already on the login page
        if (!window.location.pathname.includes('login.html')) {
            console.log("🔄 Redirecting to login page...");
            window.location.href = 'login.html';
        }
    }

    /**
     * Listen for auth state changes
     */
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

// Create global auth manager instance
const authManager = new AuthManager();

// Make it globally available
window.authManager = authManager;

console.log("🔐 Auth Manager initialized");
