// settings-db.js

// Make sure Supabase client exists
if (typeof supabase === "undefined") {
  console.error("🚨 Supabase client not found. Load database.js before this file.");
}

// 🔑 Ensure session persists across pages
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    console.log("⚠️ User not logged in, redirecting...");
    window.location.href = "login.html";
  }
});

// Helper: get logged-in user
async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    console.warn("⚠️ No authenticated user found.");
    return null;
  }
  return data.user;
}

// ✅ Update navbar with logged-in user's username
function updateNavbarUsername(username) {
  const navUser = document.getElementById("navbar-username");
  if (navUser) {
    navUser.textContent = username ? `SoundLink - ${username}` : "SoundLink";
  }
}

// Load profile into form + preview
async function loadUserProfile() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("❌ Error loading profile:", error.message);
    return;
  }

  // ✅ Update navbar username
  updateNavbarUsername(data.username);

  // Fill settings form
  document.getElementById("username-edit").value = data.username || "";
  document.getElementById("bio-edit").value = data.description || "";
  document.getElementById("tag-dropdown").value = data.tag || "Artist";

  document.getElementById("tiktok-edit").value = data.tiktok || "";
  document.getElementById("spotify-edit").value = data.spotify || "";
  document.getElementById("youtube-edit").value = data.youtube || "";
  document.getElementById("instagram-edit").value = data.instagram || "";

  updateProfileCard(data);
}

// Upload file to your "profiles" bucket
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

// Save profile updates
async function saveUserProfile(e) {
  e.preventDefault();
  const user = await getCurrentUser();
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

  const pfpFile = document.getElementById("pfp-upload")?.files?.[0];
  const bannerFile = document.getElementById("banner-upload")?.files?.[0];

  let pfpUrl = null;
  let bannerUrl = null;

  if (pfpFile) {
    pfpUrl = await uploadImage(pfpFile, `pfp/${user.id}`);
  }
  if (bannerFile) {
    bannerUrl = await uploadImage(bannerFile, `banner/${user.id}`);
  }

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

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    alert("❌ Failed to update profile: " + error.message);
    return;
  }

  // ✅ Update live navbar username
  updateNavbarUsername(data.username);

  updateProfileCard(data);
  alert("✅ Profile saved!");
}

// Update the preview card
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

// Init
document.addEventListener("DOMContentLoaded", () => {
  loadUserProfile();

  const profileForm = document.getElementById("profile-form");
  if (profileForm) {
    profileForm.addEventListener("submit", saveUserProfile);
  }
});
