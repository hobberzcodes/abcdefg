document.addEventListener("DOMContentLoaded", async () => {
    // Wait for authentication before initializing the app
    console.log("🔐 Waiting for authentication...");
    await authManager.waitForAuth();
    
    if (!authManager.isAuthenticated()) {
        console.log("❌ User not authenticated, redirecting...");
        return; // Auth manager will handle redirect
    }
    
    console.log("✅ User authenticated, initializing app...");

    
    
    const input = document.querySelector(".chat-input input");
    const sendBtn = document.querySelector(".send-btn");
    const chatBox = document.querySelector(".chat-box");
    const skipButton = document.getElementById("skipButton");
    const shareScreenButton = document.getElementById("shareScreenButton");
    

    const localVideo = document.getElementById("localVideo");
    const remoteVideo = document.getElementById("remoteVideo");

    // Get the profile card elements by their new IDs
    const usernameDisplay = document.getElementById("username-display");
    const pfpImage = document.getElementById("pfp-image");
    const bannerImage = document.getElementById("banner-image");
    const verifyBadge = document.getElementById("verify-badge");
    const premiumBadge = document.getElementById("premium-badge");
    const audioUploadInput = document.getElementById("audioUpload");
    const imageUploadInput = document.getElementById("imageUpload");
    
    // Initialize the current user's profile display
    initializeCurrentUserProfile();

    let localStream;
    let peerConnection;
    let dataChannel;
    let isSearching = false;
    let searchTimeout;
    let mediaInitialized = false;

    // Store the remote user's profile info
    let remoteUserProfile = {};
    
    // Initialize current user's profile display
    function initializeCurrentUserProfile() {
        const currentUserProfile = authManager.getCurrentUserProfile();
        
        if (!currentUserProfile) {
            console.warn("⚠️ No current user profile available");
            return;
        }
        
        console.log("👤 Setting up current user profile display:", currentUserProfile);
        
        // Update navbar to show current user
        const currentUsernameElement = document.querySelector('.navbar h1');
        if (currentUsernameElement) {
            currentUsernameElement.textContent = `SoundLink - ${currentUserProfile.username}`;
        }
        
        // Show current user's profile in the profile panel (until connected to a peer)
        displayUserProfile(currentUserProfile, true);
        
        // Set up logout functionality
        const logoutLink = document.querySelector('a[href="login.html"]');
        if (logoutLink) {
            logoutLink.addEventListener('click', async (e) => {
                e.preventDefault();
                console.log("🚪 Logout clicked");
                await authManager.signOut();
            });
        }
        
        console.log("✅ Current user profile initialized");
    }
    
    // Display user profile in the profile panel
    // Display user profile in the profile panel
    function displayUserProfile(profile, isCurrentUser = false) {
        console.log("👤 Displaying profile:", profile, "Current user:", isCurrentUser);

        // Update username display
        if (usernameDisplay && profile.username) {
            usernameDisplay.textContent = profile.username;
        }

        // Update profile picture
        if (pfpImage && profile.profile_picture) {
            pfpImage.src = profile.profile_picture;
            pfpImage.onerror = () => {
                console.warn("⚠️ Failed to load profile picture, using fallback");
                pfpImage.src = "pfp.png";
            };
        }

        // Update banner image
        if (bannerImage && profile.banner) {
            bannerImage.src = profile.banner;
            bannerImage.onerror = () => {
                console.warn("⚠️ Failed to load banner image, using fallback");
                bannerImage.src = "defbanner.png";
            };
        }

        // Update verification badge
        
        if (verifyBadge) {
            if (profile.verified) {
                verifyBadge.style.display = "inline-block"; // or "block" depending on layout
            } else {
                verifyBadge.style.display = "none";
            }
        }
        // Update premium badge
        
        if (premiumBadge) {
            if (profile.premium) {
                premiumBadge.style.display = "inline-block"; // show if premium
            } else {
                premiumBadge.style.display = "none"; // hide if not
            }
        }

        // Update tag if available
        const tagElement = document.querySelector('.tag');
        if (tagElement && profile.tag) {
            tagElement.textContent = profile.tag.toUpperCase();
        }

        // Update description/bio
        const bioElement = document.getElementById("profile-description");
        if (bioElement) {
            bioElement.textContent = profile.description || "";
            bioElement.style.display = profile.description ? "block" : "none";
        }

        // Update social links
        const socials = {
            spotify: "spotify-link",
            youtube: "youtube-link",
            tiktok: "tiktok-link",
            instagram: "instagram-link",
        };

        Object.entries(socials).forEach(([field, elementId]) => {
            const el = document.getElementById(elementId);
            if (el) {
                if (profile[field]) {
                    el.href = profile[field];
                    el.style.display = "inline-block";
                } else {
                    el.removeAttribute("href");
                    el.style.display = "none";
                }
            }
        });

        // Add visual indicator for current user vs peer
        const profileContainer = document.querySelector('.profile');
        if (profileContainer) {
            profileContainer.classList.toggle('current-user', isCurrentUser);
            profileContainer.classList.toggle('peer-user', !isCurrentUser);
        }

        console.log(`✅ Profile display updated for ${isCurrentUser ? 'current user' : 'peer'}`);
    }

    const configuration = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }, // Google STUN
            {
                urls: "turn:openrelay.metered.ca:80",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
            {
                urls: "turn:openrelay.metered.ca:443",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
            {
                urls: "turn:openrelay.metered.ca:443?transport=tcp",
                username: "openrelayproject",
                credential: "openrelayproject",
            },
        ],
    };

    let socket;
    
    // Helper function to get current user info for socket messages
    function getCurrentUserForSocket() {
        const currentUser = authManager.getCurrentUser();
        const currentUserProfile = authManager.getCurrentUserProfile();

        if (!currentUser) {
            console.error("❌ No authenticated user available for socket communication");
            return null;
        }

        return {
            userId: currentUser.id,
            userProfile: {
                username: currentUserProfile?.username || currentUser.email?.split('@')[0] || 'Unknown',
                profile_picture: currentUserProfile?.profile_picture || 'pfp.png',
                banner: currentUserProfile?.banner || 'defbanner.png',
                tag: currentUserProfile?.tag || 'User',
                description: currentUserProfile?.description || "",
                spotify: currentUserProfile?.spotify || "",
                youtube: currentUserProfile?.youtube || "",
                tiktok: currentUserProfile?.tiktok || "",
                instagram: currentUserProfile?.instagram || ""
            }
        };
    }


    function initializeSocket() {
        // Verify authentication before initializing socket
        if (!authManager.isAuthenticated()) {
            console.error("❌ Cannot initialize socket - user not authenticated");
            
            return;
        }

        let wsUrl = location.origin.replace(/^http/, "ws");
        if (location.protocol === "https:") {
            wsUrl = wsUrl.replace("ws://", "wss://");
        }
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            const currentUser = authManager.getCurrentUser();
            console.log("🔌 Connected to signaling server as user:", currentUser?.id);
            
            startSearch();
        };

        socket.onclose = () => {
            console.log("🔌 Disconnected from signaling server");
            
        };

        socket.onerror = (err) => {
            console.error("⚠️ WebSocket error:", err);
            
            
            // Check if the error might be due to authentication issues
            if (!authManager.isAuthenticated()) {
                console.error("❌ Socket error may be due to authentication failure");
                
            }
        };

        socket.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("📩 Signaling message:", data);
                
                // Verify we're still authenticated before processing messages
                if (!authManager.isAuthenticated()) {
                    console.error("❌ Received socket message but user is not authenticated");
                    
                    return;
                }

            if (data.type === "peerFound") {
                isSearching = false;
                clearTimeout(searchTimeout);
                console.log("🤝 Peer found with details:", {
                    peerId: data.peerId,
                    peerProfile: data.peerProfile,
                    isCaller: data.isCaller
                });

                // Handle peer profile data - either from direct profile data or by UUID lookup
                if (data.peerProfile) {
                    // Server provided complete profile data
                    console.log("✅ Received peer profile data directly from server");
                    remoteUserProfile = data.peerProfile;
                    displayUserProfile(remoteUserProfile, false);
                } else if (data.peerId) {
                    // Fallback: lookup peer profile by UUID
                    console.log("🔍 Looking up peer profile by UUID:", data.peerId);
                    await loadPeerProfileByUUID(data.peerId);
                } else {
                    console.warn("⚠️ No peer profile data or UUID provided");
                    // Create fallback profile
                    remoteUserProfile = {
                        username: "Unknown Peer",
                        profile_picture: "pfp.png",
                        banner: "defbanner.png",
                        tag: "User"
                    };
                    displayUserProfile(remoteUserProfile, false);
                }

                if (data.isCaller) {
                    
                    createOffer();
                } else {
                    
                }
            } else if (data.type === "offer") {
                console.log("📡 Received offer");
                if (peerConnection) {
                    peerConnection.close();
                }
                console.log("🔗 Peer connection starting");
                peerConnection = new RTCPeerConnection(configuration);
                console.log("🔗 Peer connection created");
                setupPeerConnection();
                await peerConnection.setRemoteDescription(data.offer);
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                socket.send(
                    JSON.stringify({
                        type: "answer",
                        answer: peerConnection.localDescription,
                    }),
                );
            } else if (data.type === "answer") {
                console.log("📡 Received answer");
                if (peerConnection) {
                    await peerConnection.setRemoteDescription(data.answer);
                }
            } else if (data.type === "candidate") {
                console.log("📡 Received ICE candidate");
                if (peerConnection) {
                    try {
                        await peerConnection.addIceCandidate(data.candidate);
                    } catch (err) {
                        console.error("❌ Error adding ICE candidate", err);
                    }
                }
            } else if (data.type === "skipToNext") {
                console.log(
                    "👉 Other user skipped. Automatically searching for next peer...",
                );
                
                
                resetConnection();
                chatBox.innerHTML = "";
                startSearch();
            }
        } catch (error) {
            console.error("❌ Error processing socket message:", error);
            
        }
        };
    }

    // Function to fetch peer profile from database using UUID
    // Function to fetch peer profile from database using UUID
    async function loadPeerProfileByUUID(userUUID) {
        if (!supabaseClient) {
            console.error("🚨 Supabase client not initialized.");
            return;
        }

        // Validate the UUID format before querying Supabase
        const isUUID =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userUUID);
        if (!isUUID) {
            console.warn(`⚠️ Invalid UUID format received: ${userUUID}`);
            appendSystemMessage("⚠️ Invalid user ID format. Could not load peer profile.");
            remoteUserProfile = { 
                username: "Unknown User", 
                profile_picture: "pfp.png", 
                banner: "defbanner.png",
                tag: "User",
                description: "",
                spotify: "",
                youtube: "",
                tiktok: "",
                instagram: ""
            };
            displayUserProfile(remoteUserProfile, false);
            return;
        }

        console.log(`🔍 Loading peer profile for UUID: ${userUUID}`);
        const { data: profile, error } = await supabaseClient
            .from("profiles")
            .select(`
                username,
                profile_picture,
                banner,
                tag,
                description,
                verified,
                premium,
                spotify,
                youtube,
                tiktok,
                instagram
            `)
            .eq("id", userUUID)
            .single();

        if (error) {
            console.error("❌ Error fetching peer profile:", error.message);
            remoteUserProfile = { 
                username: "Unknown User", 
                profile_picture: "pfp.png", 
                banner: "defbanner.png",
                tag: "User",
                description: "",
                spotify: "",
                youtube: "",
                tiktok: "",
                instagram: ""
            };
            displayUserProfile(remoteUserProfile, false);
            return;
        }

        if (!profile) {
            console.warn(`⚠️ No profile found for UUID: ${userUUID}`);
            remoteUserProfile = { 
                username: "Unknown User", 
                profile_picture: "pfp.png", 
                banner: "defbanner.png",
                tag: "User",
                description: "",
                spotify: "",
                youtube: "",
                tiktok: "",
                instagram: ""
            };
            displayUserProfile(remoteUserProfile, false);
            return;
        }

        remoteUserProfile = profile;
        console.log("✅ Loaded remote user profile:", remoteUserProfile);

        // Show peer's profile in UI
        displayUserProfile(remoteUserProfile, false);
    }


    async function initMedia() {
        // Return early if media initialization has already been attempted
        if (mediaInitialized) {
            console.log("🎤 Media initialization already completed");
            return;
        }

        console.log("🎤 Initializing media...");

        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            console.log("🎤 Local stream successfully initialized", localStream);
            localVideo.srcObject = localStream;
            
            // Wait for video metadata to load to ensure stream is fully ready
            await new Promise(
                (resolve) => (localVideo.onloadedmetadata = resolve),
            );
            console.log("✅ Camera and microphone ready for peer connections");
            
        } catch (err) {
            console.error("❌ Error accessing camera/mic:", err);
            
            console.warn("⚠️ Proceeding without media access - text chat only");
            localStream = null; // Explicitly set to null for clarity
        }

        // Mark initialization as complete (whether successful or not) and start socket
        mediaInitialized = true;
        console.log("🔌 Media initialization complete, starting socket connection...");
        initializeSocket();
    }

    await initMedia();

    function setupPeerConnection() {
        console.log("🔗 Setting up peer connection. Local stream:", localStream);
        
        // Only add local tracks if localStream exists and has tracks
        if (localStream && localStream.getTracks().length > 0) {
            localStream
                .getTracks()
                .forEach((track) => peerConnection.addTrack(track, localStream));
            console.log("🎤 Added local media tracks to peer connection");
        } else {
            console.warn("⚠️ No local stream available - proceeding with text/data only");
        }
        
        peerConnection.ontrack = (event) => {
            console.log("🎥 Remote stream received");
            remoteVideo.srcObject = event.streams[0];
        };
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.send(
                    JSON.stringify({
                        type: "candidate",
                        candidate: event.candidate,
                    }),
                );
            }
        };
        peerConnection.ondatachannel = (event) => {
            console.log("💬 Data channel received from remote peer.");
            dataChannel = event.channel;
            setupDataChannelListeners();
        };
    }

    async function createOffer() {
        console.log("🔗 Creating offer");
        if (peerConnection) {
            peerConnection.close();
        }
        console.log("🔗 Preparing to create RTC peer connection");
        peerConnection = new RTCPeerConnection(configuration);
        console.log("🔗 Peer connection via RTCPeerConnection created", peerConnection);
        setupPeerConnection();
        console.log("🔗 Data channel created");
        dataChannel = peerConnection.createDataChannel("chat");
        setupDataChannelListeners();

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.send(JSON.stringify({ type: "offer", offer }));
        console.log("📡 Sent offer");
    }

    function startSearch() {
        isSearching = true;
        
        
        // Get current user info for socket message
        const userInfo = getCurrentUserForSocket();
        if (!userInfo) {
            
            return;
        }
        
        const searchMessage = {
            type: "search",
            ...userInfo
        };
        
        console.log("🔍 Sending search message with user ID:", userInfo.userId);
        socket.send(JSON.stringify(searchMessage));

        searchTimeout = setTimeout(() => {
            if (isSearching) {
                
                const retryUserInfo = getCurrentUserForSocket();
                if (retryUserInfo) {
                    socket.send(JSON.stringify({ type: "search", ...retryUserInfo }));
                    startSearch();
                } else {
                    console.error("❌ Authentication lost during search retry");
                    isSearching = false;
                    
                }
            }
        }, 5000);
    }

    function stopSearch() {
        isSearching = false;
        clearTimeout(searchTimeout);
        
        
        // Include user ID in stop search message for server-side cleanup
        const userInfo = getCurrentUserForSocket();
        const stopMessage = {
            type: "stopSearch",
            userId: userInfo?.userId || null
        };
        
        socket.send(JSON.stringify(stopMessage));
    }

    function resetConnection() {
        if (peerConnection) {
            peerConnection.close();
        }
        peerConnection = null;
        remoteVideo.srcObject = null;
        dataChannel = null;
        chatBox.innerHTML = "";

        // Reset remote user profile
        remoteUserProfile = {};
        
        // Restore current user's profile display
        const currentUserProfile = authManager.getCurrentUserProfile();
        if (currentUserProfile) {
            displayUserProfile(currentUserProfile, true);
        } else {
            // Fallback display
            usernameDisplay.textContent = "Username";
            pfpImage.src = "pfp.png";
            bannerImage.src = "defbanner.png";
        }
    }

    skipButton.addEventListener("click", () => {
       
        
        // Include user ID in skip message
        const userInfo = getCurrentUserForSocket();
        const skipMessage = {
            type: "skipToNext",
            userId: userInfo?.userId || null
        };
        
        socket.send(JSON.stringify(skipMessage));
        resetConnection();
        startSearch();
    });

    skipButton.addEventListener("dblclick", () => {
        stopSearch();
        resetConnection();
    });

    // =========================
    // Share Screen Feature
    // =========================
    shareScreenButton.addEventListener("click", async () => {
        if (!peerConnection) {
            
            return;
        }

        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            });

            const screenTrack = screenStream.getVideoTracks()[0];
            const systemAudioTrack = screenStream.getAudioTracks()[0];

            const videoSender = peerConnection
                .getSenders()
                .find((s) => s.track && s.track.kind === "video");
            if (videoSender) {
                videoSender.replaceTrack(screenTrack);
            }

            if (systemAudioTrack) {
                console.log(
                    "🎶 Adding system audio track from screen share...",
                );
                peerConnection.addTrack(systemAudioTrack, screenStream);
            }

            localVideo.srcObject = screenStream;
           

            screenTrack.onended = async () => {
                
                try {
                    const camStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true,
                    });
                    localStream = camStream;

                    const camTrack = camStream.getVideoTracks()[0];
                    if (videoSender && camTrack) {
                        videoSender.replaceTrack(camTrack);
                    }

                    localVideo.srcObject = camStream;
                    
                } catch (err) {
                    console.error("❌ Failed to restore camera after screen share:", err);
                   
                    localStream = null;
                    localVideo.srcObject = null;
                    // Remove video track from peer connection if it exists
                    if (videoSender) {
                        videoSender.replaceTrack(null);
                    }
                }
            };
        } catch (err) {
            console.error("❌ Error sharing screen:", err);
            
        }
    });

    // =========================
    // Chat + file transfer
    // =========================
    function getSenderName() {
        return remoteUserProfile.username || "Friend";
    }

    function appendMessage(text, sender = "You") {
        const msg = document.createElement("div");
        msg.classList.add("message");
        msg.innerHTML = `<span class="user ${sender === "You" ? "blue" : "cyan"}">${sender}:</span> ${text}`;
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function appendAudioMessage(audioData, fileName, sender = "You") {
        const msg = document.createElement("div");
        msg.classList.add("message", "audio-message");

        const userSpan = document.createElement("span");
        userSpan.classList.add("user", sender === "You" ? "blue" : "cyan");
        userSpan.textContent = `${sender}:`;

        const audioPlayerContainer = document.createElement("div");
        audioPlayerContainer.classList.add("audio-player");

        audioPlayerContainer.innerHTML = `
          <div class="audio-controls">
            <button class="play-pause-btn">▶️</button>
            <div class="audio-time">
                <span class="current-time">0:00</span> / <span class="total-time">0:00</span>
            </div>
            <input type="range" class="audio-slider" value="0" step="0.01">
          </div>
          <a href="${audioData}" download="${fileName}" class="download-btn">⬇️</a>
      `;
        const audioElement = new Audio(audioData);
        const playPauseBtn =
            audioPlayerContainer.querySelector(".play-pause-btn");
        const timeSlider = audioPlayerContainer.querySelector(".audio-slider");
        const currentTimeSpan =
            audioPlayerContainer.querySelector(".current-time");
        const totalTimeSpan = audioPlayerContainer.querySelector(".total-time");

        playPauseBtn.addEventListener("click", () => {
            if (audioElement.paused) {
                audioElement.play();
                playPauseBtn.textContent = "⏸️";
            } else {
                audioElement.pause();
                playPauseBtn.textContent = "▶️";
            }
        });

        audioElement.addEventListener("timeupdate", () => {
            const progress =
                (audioElement.currentTime / audioElement.duration) * 100;
            timeSlider.value = progress;

            const currentMinutes = Math.floor(audioElement.currentTime / 60);
            const currentSeconds = Math.floor(audioElement.currentTime % 60);
            currentTimeSpan.textContent = `${currentMinutes}:${currentSeconds < 10 ? "0" : ""}${currentSeconds}`;
        });

        audioElement.addEventListener("loadedmetadata", () => {
            const totalMinutes = Math.floor(audioElement.duration / 60);
            const totalSeconds = Math.floor(audioElement.duration % 60);
            totalTimeSpan.textContent = `${totalMinutes}:${totalSeconds < 10 ? "0" : ""}${totalSeconds}`;
        });

        timeSlider.addEventListener("input", () => {
            const newTime = (timeSlider.value / 100) * audioElement.duration;
            audioElement.currentTime = newTime;
        });

        msg.appendChild(userSpan);
        msg.appendChild(audioPlayerContainer);
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function appendImageMessage(imageData, sender = "You") {
        const msg = document.createElement("div");
        msg.classList.add("message", "image-message");

        const userSpan = document.createElement("span");
        userSpan.classList.add("user", sender === "You" ? "blue" : "cyan");
        userSpan.textContent = `${sender}:`;

        const imageContainer = document.createElement("div");
        imageContainer.classList.add("image-container");

        const imageElement = document.createElement("img");
        imageElement.src = imageData;

        imageContainer.appendChild(imageElement);

        msg.appendChild(userSpan);
        msg.appendChild(imageContainer);
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function appendSystemMessage(text) {
        const msg = document.createElement("div");
        msg.classList.add("message", "system");
        msg.innerHTML = `<span class="user red">[System]</span> ${text}`;
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function sendMessage() {
        const text = input.value.trim();
        
        if (text !== "" && dataChannel && dataChannel.readyState === "open") {
            const message = JSON.stringify({
                type: "textMessage",
                content: text,
            });
            dataChannel.send(message);
            appendMessage(text, "You");
            input.value = "";
        } else if (!dataChannel || dataChannel.readyState !== "open") {
            appendSystemMessage(
                "🚨 Cannot send message. Chat channel is not connected.",
            );
        }
    }

    function setupDataChannelListeners() {
        if (!dataChannel) return;
        dataChannel.onopen = () => {
            console.log("💬 Data channel open");
            appendSystemMessage("💬 Chat channel connected");
        };
        dataChannel.onmessage = (event) => {
            console.log("💬 Message received:", event.data);
            try {
                const message = JSON.parse(event.data);
                const senderName = getSenderName();

                if (message.type === "audioMessage") {
                    appendAudioMessage(
                        message.audioData,
                        message.fileName,
                        senderName,
                    );
                } else if (message.type === "imageMessage") {
                    appendImageMessage(message.imageData, senderName);
                } else if (message.type === "textMessage") {
                    appendMessage(message.content, senderName);
                }
            } catch (e) {
                console.error("Failed to parse message as JSON:", e);
                appendMessage(event.data, getSenderName());
            }
        };
        dataChannel.onclose = () => {
            console.log("💬 Data channel closed");
            appendSystemMessage("❌ Chat channel closed.");
        };
        dataChannel.onerror = (error) => {
            console.error("❌ Data channel error:", error);
            appendSystemMessage("⚠️ Chat channel error.");
        };
    }

    audioUploadInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
            if (dataChannel && dataChannel.readyState === "open") {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const audioData = e.target.result;
                    const message = JSON.stringify({
                        type: "audioMessage",
                        fileName: file.name,
                        audioData: audioData,
                    });
                    dataChannel.send(message);
                    appendAudioMessage(audioData, file.name, "You");
                };
                reader.readAsDataURL(file);
            } else {
                appendSystemMessage(
                    "🚨 Cannot send audio. Chat channel is not connected.",
                );
            }
        }
    });

    imageUploadInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
            if (dataChannel && dataChannel.readyState === "open") {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageData = e.target.result;
                    const message = JSON.stringify({
                        type: "imageMessage",
                        imageData: imageData,
                    });
                    dataChannel.send(message);
                    appendImageMessage(imageData, "You");
                };
                reader.readAsDataURL(file);
            } else {
                appendSystemMessage(
                    "🚨 Cannot send image. Chat channel is not connected.",
                );
            }
        }
    });

    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });
});
