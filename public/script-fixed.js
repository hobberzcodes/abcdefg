// =======================
// Chat + WebRTC Client - FIXED
// =======================
document.addEventListener("DOMContentLoaded", async () => {
    const input = document.querySelector(".chat-input input");
    const sendBtn = document.querySelector(".send-btn");
    const chatBox = document.querySelector(".chat-box");
    const skipButton = document.getElementById("skipButton");
    const shareScreenButton = document.getElementById("shareScreenButton");

    const localVideo = document.getElementById("localVideo");
    const remoteVideo = document.getElementById("remoteVideo");
    
    // Get the profile card elements by their new IDs (with null checks)
    const usernameDisplay = document.getElementById("username-display");
    const pfpImage = document.getElementById("pfp-image");
    const bannerImage = document.getElementById("banner-image");

    const audioUploadInput = document.getElementById("audioUpload");
    const imageUploadInput = document.getElementById("imageUpload");

    let localStream;
    let peerConnection;
    let dataChannel;
    let isSearching = false;
    let searchTimeout;
    
    // Store the remote user's profile info
    let remoteUserProfile = {};

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

    let wsUrl = location.origin.replace(/^http/, "ws");
    if (location.protocol === "https:") {
        wsUrl = wsUrl.replace("ws://", "wss://");
    }
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log("🔌 Connected to signaling server");
        appendSystemMessage("✅ Connected to signaling server");
        startSearch();
    };

    socket.onclose = () => {
        console.log("🔌 Disconnected from signaling server");
        appendSystemMessage("❌ Disconnected from signaling server");
    };

    socket.onerror = (err) => {
        console.error("⚠️ WebSocket error:", err);
        appendSystemMessage("⚠️ WebSocket error — check server logs");
    };

    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log("📩 Signaling message:", data);

        if (data.type === "peerFound") {
            isSearching = false;
            clearTimeout(searchTimeout);
            console.log("🤝 Peer found:", data.peerId);
            
            // Load peer profile safely
            if (data.peerId && window.supabaseClient) {
                try {
                    await loadPeerProfile(data.peerId);
                } catch (error) {
                    console.log("Could not load peer profile:", error.message);
                }
            }

            if (data.isCaller) {
                appendSystemMessage("🤝 Found a peer! Initiating call...");
                createOffer();
            } else {
                appendSystemMessage("🤝 Found a peer! Waiting for call...");
            }
        } else if (data.type === "offer") {
            console.log("📡 Received offer");
            if (peerConnection) {
                peerConnection.close();
            }
            peerConnection = new RTCPeerConnection(configuration);
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
            console.log("👉 Other user skipped. Automatically searching for next peer...");
            appendSystemMessage("👋 The other user skipped. Searching for a new connection...");
            resetConnection();
            startSearch();
        }
    };

    // Load peer profile function with error handling
    async function loadPeerProfile(peerId) {
        if (!window.supabaseClient) return;
        
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('username, pfp_url, banner_url')
            .eq('id', peerId)
            .single();

        if (error || !profile) {
            console.log("Could not fetch peer profile:", error?.message);
            // Set defaults
            if (usernameDisplay) usernameDisplay.textContent = "Friend";
            if (pfpImage) pfpImage.src = "pfp.png";
            if (bannerImage) bannerImage.src = "defbanner.png";
            return;
        }

        // Store the profile for later use
        remoteUserProfile = profile;
        console.log("Loaded remote user profile:", remoteUserProfile);

        // Update the DOM with the fetched data (safely)
        if (usernameDisplay) usernameDisplay.textContent = remoteUserProfile.username || "Friend";
        if (pfpImage) pfpImage.src = remoteUserProfile.pfp_url || "pfp.png";
        if (bannerImage) bannerImage.src = remoteUserProfile.banner_url || "defbanner.png";
    }

    async function initMedia() {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            localVideo.srcObject = localStream;
            await new Promise((resolve) => (localVideo.onloadedmetadata = resolve));
            console.log("🎤 Camera and mic initialized and ready.");
        } catch (err) {
            console.error("❌ Error accessing camera/mic:", err);
            appendSystemMessage("🚨 Error: Please allow access to your camera and microphone.");
        }
    }
    await initMedia();

    function setupPeerConnection() {
        if (localStream) {
            localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
        }
        
        peerConnection.ontrack = (event) => {
            console.log("🎥 Remote stream received");
            remoteVideo.srcObject = event.streams[0];
            appendSystemMessage("🎥 Video connection established!");
        };
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("🧊 Sending ICE candidate");
                socket.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
            } else {
                console.log("🧊 All ICE candidates sent");
            }
        };
        
        peerConnection.ondatachannel = (event) => {
            console.log("💬 Data channel received from remote peer.");
            dataChannel = event.channel;
            setupDataChannelListeners();
        };
        
        // Add connection state monitoring
        peerConnection.onconnectionstatechange = () => {
            console.log(`🔗 Connection state: ${peerConnection.connectionState}`);
            if (peerConnection.connectionState === 'connected') {
                appendSystemMessage("🔗 Peer-to-peer connection established!");
            } else if (peerConnection.connectionState === 'failed') {
                appendSystemMessage("❌ Connection failed. Searching for new peer...");
                setTimeout(() => {
                    resetConnection();
                    startSearch();
                }, 2000);
            }
        };
        
        peerConnection.oniceconnectionstatechange = () => {
            console.log(`🧊 ICE connection state: ${peerConnection.iceConnectionState}`);
            if (peerConnection.iceConnectionState === 'failed') {
                appendSystemMessage("❌ ICE connection failed. Trying to reconnect...");
            }
        };
    }

    async function createOffer() {
        if (peerConnection) {
            peerConnection.close();
        }
        peerConnection = new RTCPeerConnection(configuration);
        setupPeerConnection();
        dataChannel = peerConnection.createDataChannel("chat");
        setupDataChannelListeners();

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.send(JSON.stringify({ type: "offer", offer }));
        console.log("📡 Sent offer");
    }

    function startSearch() {
        if (isSearching) return; // Prevent multiple searches
        
        isSearching = true;
        appendSystemMessage("🔍 Searching for a new connection...");
        socket.send(JSON.stringify({ type: "search" }));

        searchTimeout = setTimeout(() => {
            if (isSearching) {
                appendSystemMessage("🤔 Still searching...");
                socket.send(JSON.stringify({ type: "search" }));
                startSearch();
            }
        }, 5000);
    }

    function stopSearch() {
        isSearching = false;
        clearTimeout(searchTimeout);
        appendSystemMessage("🛑 Stopping search...");
        socket.send(JSON.stringify({ type: "stopSearch" }));
    }

    function resetConnection() {
        if (peerConnection) {
            peerConnection.close();
        }
        peerConnection = null;
        if (remoteVideo) remoteVideo.srcObject = null;
        dataChannel = null;
        if (chatBox) chatBox.innerHTML = "";
        
        // Reset the profile card safely
        if (usernameDisplay) usernameDisplay.textContent = "Username";
        if (pfpImage) pfpImage.src = "pfp.png";
        if (bannerImage) bannerImage.src = "defbanner.png";
        remoteUserProfile = {};
    }

    // Skip button - single click only
    if (skipButton) {
        skipButton.addEventListener("click", () => {
            console.log("Skip button clicked");
            appendSystemMessage("📞 Disconnecting from current user.");
            socket.send(JSON.stringify({ type: "skipToNext" }));
            resetConnection();
            startSearch();
        });
    }

    // Chat and messaging functions
    function appendMessage(text, sender = "You") {
        const msg = document.createElement("div");
        msg.classList.add("message");
        msg.innerHTML = `<span class="user ${sender === "You" ? "blue" : "cyan"}">${sender}:</span> ${text}`;
        if (chatBox) chatBox.appendChild(msg);
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    }

    function appendSystemMessage(text) {
        const msg = document.createElement("div");
        msg.classList.add("message", "system");
        msg.innerHTML = `<span class="user red">[System]</span> ${text}`;
        if (chatBox) chatBox.appendChild(msg);
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    }

    function sendMessage() {
        const text = input ? input.value.trim() : "";
        if (text !== "" && dataChannel && dataChannel.readyState === "open") {
            const message = JSON.stringify({ type: "textMessage", content: text });
            dataChannel.send(message);
            appendMessage(text, "You");
            if (input) input.value = "";
        } else if (!dataChannel || dataChannel.readyState !== "open") {
            appendSystemMessage("🚨 Cannot send message. Chat channel is not connected.");
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
                if (message.type === "textMessage") {
                    appendMessage(message.content, remoteUserProfile.username || "Friend");
                }
            } catch (e) {
                console.error("Failed to parse message as JSON:", e);
                appendMessage(event.data, remoteUserProfile.username || "Friend");
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

    // Event listeners
    if (sendBtn) {
        sendBtn.addEventListener("click", sendMessage);
    }
    if (input) {
        input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") sendMessage();
        });
    }
});