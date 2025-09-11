document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    alert("No session found! Redirecting...");
    window.location.href = "login.html";
    return;
  }

  const user = session.user;

  let newPfpFile = null;
  let newBannerFile = null;

  async function loadProfile() {
    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Profile fetch error:", error.message);
      return;
    }

    const tagDropdown = document.getElementById("tag-dropdown");
    tagDropdown.innerHTML = ""; 

    const tags = ["Artist", "Producer", "Engineer", "Manager", "Composer", "Recruiter"];
    tags.forEach(tag => {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      if (profile.tag && profile.tag.toLowerCase() === tag.toLowerCase()) option.selected = true;
      tagDropdown.appendChild(option);
    });

    document.getElementById("navbar-username").textContent = `SoundLink - ${profile.username || "Unknown User"}`;
    document.getElementById("username-display").textContent = profile.username || "Unknown User";
    document.getElementById("pfp-image").src = profile.profile_picture || "pfp.png";
    document.getElementById("banner-image").src = profile.banner || "defbanner.png";
    document.querySelector(".tag").textContent = profile.tag || "ARTIST";
    document.getElementById("verify-badge").style.display = profile.is_verified ? "inline" : "none";
    document.getElementById("premium-badge").style.display = profile.is_premium ? "inline" : "none";
    document.getElementById("profile-description").innerHTML = profile.description || "No bio yet.";

    if (profile.spotify) document.getElementById("spotify-link").href = profile.spotify;
    if (profile.youtube) document.getElementById("youtube-link").href = profile.youtube;
    if (profile.tiktok) document.getElementById("tiktok-link").href = profile.tiktok;
    if (profile.instagram) document.getElementById("instagram-link").href = profile.instagram;

    document.getElementById("username-edit").value = profile.username || "";
    document.getElementById("bio-edit").value = profile.description || "";
    document.getElementById("tiktok-edit").value = profile.tiktok || "";
    document.getElementById("spotify-edit").value = profile.spotify || "";
    document.getElementById("youtube-edit").value = profile.youtube || "";
    document.getElementById("instagram-edit").value = profile.instagram || "";

    document.getElementById("pfp-preview").src = profile.profile_picture || "pfp.png";
    document.getElementById("banner-preview").src = profile.banner || "defbanner.png";
  }

  await loadProfile();

  document.getElementById("pfp-upload").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        if (img.width !== img.height) {
          alert("Profile picture must be square!");
          e.target.value = "";
          return;
        }
        newPfpFile = file;
        document.getElementById("pfp-preview").src = URL.createObjectURL(file);
      };
      img.src = URL.createObjectURL(file);
    }
  });

  document.getElementById("banner-upload").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        const requiredRatio = 400 / 170;
        const actualRatio = img.width / img.height;
        if (Math.abs(actualRatio - requiredRatio) > 0.05) {
          alert("Banner must match the required aspect ratio (400x170).");
          e.target.value = "";
          return;
        }
        newBannerFile = file;
        document.getElementById("banner-preview").src = URL.createObjectURL(file);
      };
      img.src = URL.createObjectURL(file);
    }
  });

  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const updates = {
      username: document.getElementById("username-edit").value,
      tag: document.getElementById("tag-dropdown").value,
      description: document.getElementById("bio-edit").value,
      tiktok: document.getElementById("tiktok-edit").value,
      spotify: document.getElementById("spotify-edit").value,
      youtube: document.getElementById("youtube-edit").value,
      instagram: document.getElementById("instagram-edit").value
    };

    if (newPfpFile) {
      try {
        const { error: uploadError } = await supabaseClient.storage
          .from("userpfp")
          .upload(`${user.id}/${user.id}.png`, newPfpFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabaseClient.storage
          .from("userpfp")
          .getPublicUrl(`${user.id}/${user.id}.png`);

        updates.profile_picture = publicUrl.publicUrl;
      } catch (err) {
        alert("Error uploading profile picture: " + err.message);
        return;
      }
    }

    if (newBannerFile) {
      try {
        const { error: uploadError } = await supabaseClient.storage
          .from("userbanner")
          .upload(`${user.id}/${user.id}.png`, newBannerFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabaseClient.storage
          .from("userbanner")
          .getPublicUrl(`${user.id}/${user.id}.png`);

        updates.banner = publicUrl.publicUrl;
      } catch (err) {
        alert("Error uploading banner: " + err.message);
        return;
      }
    }

    const { error } = await supabaseClient
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      if (error.message.includes("duplicate key value")) {
        alert("Username already exists. Please choose another.");
      } else {
        alert("Error saving profile: " + error.message);
      }
      return;
    }

    newPfpFile = null;
    newBannerFile = null;

    await loadProfile();
    alert("Profile updated!");
  });
});