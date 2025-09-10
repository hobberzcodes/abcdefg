// settings-db.js

// Make sure AuthManager exists
if (!window.authManager) {
  console.error(
    "🚨 AuthManager not found. Load auth-manager.js before this file.",
  );
}

/**
 * Helper: Get currently logged-in user via AuthManager
 */
function getCurrentUser() {
  return authManager.getCurrentUser();
}

/**
 * Load user profile and populate the form + preview
 */
async function loadUserProfile() {
  const user = getCurrentUser();
  if (!user) {
    console.warn("⚠️ No authenticated user found, redirecting...");
    window.location.href = "login.html";
    return;
  }

  const profile = authManager.getCurrentUserProfile();
  if (!profile) {
    console.warn("⚠️ User profile not found, using fallback values.");
  }

  // Populate form fields
  document.getElementById("username-edit").value = profile?.username || "";
  document.getElementById("bio-edit").value = profile?.description || "";
  document.getElementById("tag-dropdown").value = profile?.tag || "Artist";

  document.getElementById("tiktok-edit").value = profile?.tiktok || "";
  document.getElementById("spotify-edit").value = profile?.spotify || "";
  document.getElementById("youtube-edit").value = profile?.youtube || "";
  document.getElementById("instagram-edit").value = profile?.instagram || "";

  updateProfileCard(profile || {});
}

/**
 * Upload an image to Supabase Storage
 * @param {File} file
 * @param {string} path
 * @returns {string|null} public URL of uploaded file
 */
async function uploadImage(file, path) {
  if (!file) return null;

  const { error } = await supabase.storage
    .from("profiles")
    .upload(path, file, { upsert: true });

  if (error) {
    console.error("❌ Upload failed:", error.message);
    return null;
  }

  const { data: publicUrlData } = supabase.storage
    .from("profiles")
    .getPublicUrl(path);

  return publicUrlData.publicUrl;
}

/**
 * Save user profile updates
 */
async function saveUserProfile(e) {
  e.preventDefault();

  const user = getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const username = document.getElementById("username-edit").value;
  const description = document.getElementById("bio-edit").value;
  const tag = document.getElementById("tag-dropdown").value;

  const tiktok = document.getElementById("tiktok-edit").value;
  const spotify = document.getElementById("spotify-edit").value;
  const youtube = document.getElementById("youtube-edit").value;
  const instagram = document.getElementById("instagram-edit").value;

  const pfpFile = document.getElementById("pfp-upload")?.files[0];
  const bannerFile = document.getElementById("banner-upload")?.files[0];

  let pfpUrl = null;
  let bannerUrl = null;

  if (pfpFile) pfpUrl = await uploadImage(pfpFile, `pfp/${user.id}`);
  if (bannerFile)
    bannerUrl = await uploadImage(bannerFile, `banner/${user.id}`);

  const updates = {
    username,
    description,
    tag,
    tiktok,
    spotify,
    youtube,
    instagram,
    updated_at: new Date().toISOString(),
  };
  if (pfpUrl) updates.profile_picture = pfpUrl;
  if (bannerUrl) updates.banner = bannerUrl;

  const success = await authManager.updateProfile(updates);
  if (success) {
    updateProfileCard(authManager.getCurrentUserProfile());
    alert("✅ Profile saved!");
  } else {
    alert("❌ Failed to update profile!");
  }
}

/**
 * Update the profile card UI
 */
function updateProfileCard(profile) {
  document.getElementById("username-display").textContent =
    profile.username || "Username";
  document.getElementById("profile-description").textContent =
    profile.description || "";
  document.querySelector(".tag").textContent = profile.tag || "Artist";

  document.getElementById("spotify-link").href = profile.spotify || "#";
  document.getElementById("youtube-link").href = profile.youtube || "#";
  document.getElementById("tiktok-link").href = profile.tiktok || "#";
  document.getElementById("instagram-link").href = profile.instagram || "#";

  if (profile.profile_picture) {
    document.getElementById("pfp-image").src = profile.profile_picture;
  }
  if (profile.banner) {
    document.getElementById("banner-image").src = profile.banner;
  }
}

/**
 * Initialize settings page
 */
document.addEventListener("DOMContentLoaded", async () => {
  // Wait until AuthManager has fully loaded auth state
  await authManager.waitForAuth();

  if (!authManager.isAuthenticated()) {
    window.location.href = "login.html";
    return;
  }

  // Load profile into form and preview
  await loadUserProfile();

  // Attach save handler
  const profileForm = document.getElementById("profile-form");
  if (profileForm) {
    profileForm.addEventListener("submit", saveUserProfile);
  }
});
