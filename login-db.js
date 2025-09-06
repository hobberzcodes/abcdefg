// login-db.js
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

  // ----- PANEL TRANSITIONS -----
  signUpButton.addEventListener('click', () => container.classList.add("right-panel-active"));
  signInButton.addEventListener('click', () => container.classList.remove("right-panel-active"));

  // ----- LOGIN -----
  signInForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value.trim();

    if (!email || !password) return alert("Please fill in all fields.");

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      console.error("Supabase login error:", error.message);
      if (error.message.includes("Invalid login credentials") || error.message.includes("Invalid email or password")) {
        alert("Incorrect email or password.");
      } else {
        alert("Login error: " + error.message);
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

    alert(`Welcome back, ${profile?.username || data.user.email}!`);

    // REDIRECT TO INDEX.HTML AFTER LOGIN
    window.location.href = "index.html";
  });

  // ----- SIGNUP -----
  signUpForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();

    if (!username || !email || !password) return alert("Please fill in all fields.");

    // Check if username is already taken
    const { data: usernameCheck, error: usernameError } = await supabaseClient
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (usernameCheck) {
      alert("Username is already taken. Please choose another.");
      return;
    }

    if (usernameError && usernameError.code !== "PGRST116") {
      console.error("Username check error:", usernameError.message);
      return alert("An error occurred. Please try again.");
    }

    // Sign up the user with Supabase Auth
    const { data, error: signUpError } = await supabaseClient.auth.signUp({ email, password });

    if (signUpError) {
      console.error("Supabase signup error:", signUpError.message);
      if (signUpError.message.includes("User already registered")) {
        alert("Email is already taken. Please sign in.");
        container.classList.remove("right-panel-active");
      } else {
        alert("Signup error: " + signUpError.message);
      }
      return;
    }

    const user = data.user;
    if (!user) {
      return alert("A confirmation email has been sent. Please verify your email before signing in.");
    }

    // Insert a new profile row for the new user
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .insert({ id: user.id, username });

    if (profileError) {
      console.error("Profile creation error:", profileError.message);
      return alert("An error occurred while creating your profile. Please try again.");
    }

    alert("Signup successful! You can now sign in.");
    container.classList.remove("right-panel-active"); // switch to sign-in panel
  });
});
