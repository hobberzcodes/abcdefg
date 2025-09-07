// The 'supabaseClient' object is already available globally after `database.js` has run.

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById('container');
  const signUpButton = document.getElementById('signUp');
  const signInButton = document.getElementById('signIn');

  const signInForm = document.querySelector('.sign-in-container form');
  const signUpForm = document.querySelector('.sign-up-container form');

  if (!signInForm || !signUpForm || !signUpButton || !signInButton) {
    console.error("One or more DOM elements are missing. Check your HTML.");
    return;
  }

  // Creates and displays a dynamic message box instead of using alert()
  function createMessageBox(message, type = 'error') {
    let bgColor = '';
    if (type === 'success') {
      bgColor = 'bg-green-500';
    } else if (type === 'warning') {
      bgColor = 'bg-yellow-500';
    } else {
      bgColor = 'bg-red-500';
    }

    const messageBox = document.createElement('div');
    messageBox.className = `fixed bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-white font-semibold shadow-xl transition-transform transform-gpu duration-300 z-50 ${bgColor}`;
    messageBox.style.transform = 'translate(-50%, 100px)';
    messageBox.textContent = message;
    document.body.appendChild(messageBox);

    // Animate the message box in
    setTimeout(() => {
      messageBox.style.transform = 'translate(-50%, 0)';
    }, 10);

    // Animate the message box out and remove it after a delay
    setTimeout(() => {
      messageBox.style.transform = 'translate(-50%, 100px)';
      setTimeout(() => messageBox.remove(), 300);
    }, 3000);
  }

  // ----- PANEL TRANSITIONS -----
  signUpButton.addEventListener('click', () => container.classList.add("right-panel-active"));
  signInButton.addEventListener('click', () => container.classList.remove("right-panel-active"));

  // ----- LOGIN -----
  signInForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value.trim();

    if (!email || !password) {
      createMessageBox("Please fill in all fields.", "warning");
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      console.error("Supabase login error:", error.message);
      if (error.message.includes("Invalid login credentials") || error.message.includes("Invalid email or password")) {
        createMessageBox("Incorrect email or password.");
      } else {
        createMessageBox("Login error: " + error.message);
      }
      return;
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.warn("Profile fetch error:", profileError);
    }

    createMessageBox(`Welcome back, ${profile?.username || data.user.email}!`, 'success');

    // REDIRECT TO INDEX.HTML AFTER LOGIN
    window.location.href = "index.html";
  });

  // ----- SIGNUP -----
  signUpForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    const tag = document.getElementById('signup-tag').value;

    if (!username || !email || !password || tag === "Select a tag") {
      createMessageBox("Please fill in all fields and select a tag.", "warning");
      return;
    }

    // Check if username is already taken
    const { data: usernameCheck, error: usernameError } = await supabaseClient
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (usernameCheck) {
      createMessageBox("Username is already taken. Please choose another.");
      return;
    }

    if (usernameError && usernameError.code !== "PGRST116") {
      console.error("Username check error:", usernameError.message);
      createMessageBox("An error occurred. Please try again.");
      return;
    }

    // Sign up the user with Supabase Auth
    const { data, error: signUpError } = await supabaseClient.auth.signUp({ email, password });

    if (signUpError) {
      console.error("Supabase signup error:", signUpError.message);
      if (signUpError.message.includes("User already registered")) {
        createMessageBox("Email is already taken. Please sign in.");
      } else {
        createMessageBox("Signup error: " + signUpError.message);
      }
      return;
    }

    const user = data.user;
    if (!user) {
      createMessageBox("A confirmation email has been sent. Please verify your email before signing in.", "success");
      return;
    }

    // Get the public URLs for the default assets
    const pfpUrl = supabaseClient.storage.from('default').getPublicUrl('defaultpfp.png').data.publicUrl;
    const bannerUrl = supabaseClient.storage.from('default').getPublicUrl('defaultbanner.png').data.publicUrl;

    // Insert a new profile row for the new user
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .insert({ id: user.id, username, profile_picture: pfpUrl, banner: bannerUrl, tag: tag });

    if (profileError) {
      console.error("Profile creation error:", profileError.message);
      createMessageBox("An error occurred while creating your profile. Please try again.");
      return;
    }

    createMessageBox("Signup successful! You can now sign in.", "success");
    container.classList.remove("right-panel-active"); // switch to sign-in panel
  });
});
