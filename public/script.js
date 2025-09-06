// =======================
// Chat + WebRTC Client
// =======================
document.addEventListener("DOMContentLoaded", async () => {
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
            
            // --- NEW: Load peer's profile from Supabase
            if (data.peerId) {
                 await loadPeerProfile(data.peerId);
            }
            // --- END NEW

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
            chatBox.innerHTML = "";
            startSearch();
        }
    };

    // --- NEW FUNCTION: Fetch peer profile from database ---
    async function loadPeerProfile(peerId) {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('username, pfp_url, banner_url') // Select only the required columns
            .eq('id', peerId)
            .single();

        if (error || !profile) {
            console.error("Error fetching peer profile:", error);
            // Revert to default or show an error state
            usernameDisplay.textContent = "Unknown User";
            pfpImage.src = "pfp.png";
            bannerImage.src = "defbanner.png";
            return;
        }

        // Store the profile for later use (e.g., chat messages)
        remoteUserProfile = profile;
        console.log("Loaded remote user profile:", remoteUserProfile);

        // Update the DOM with the fetched data
        usernameDisplay.textContent = remoteUserProfile.username;
        pfpImage.src = remoteUserProfile.pfp_url || "pfp.png";
        bannerImage.src = remoteUserProfile.banner_url || "defbanner.png";
    }
    // --- END NEW FUNCTION ---


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
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
        peerConnection.ontrack = (event) => {
            console.log("🎥 Remote stream received");
            remoteVideo.srcObject = event.streams[0];
        };
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
            }
        };
        peerConnection.ondatachannel = (event) => {
            console.log("💬 Data channel received from remote peer.");
            dataChannel = event.channel;
            setupDataChannelListeners();
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
        remoteVideo.srcObject = null;
        dataChannel = null;
        chatBox.innerHTML = "";
        
        // --- NEW: Reset the profile card ---
        usernameDisplay.textContent = "Username";
        pfpImage.src = "pfp.png";
        bannerImage.src = "defbanner.png";
        remoteUserProfile = {};
        // --- END NEW ---
    }

    // Skip to next (single click)
    skipButton.addEventListener("click", () => {
        appendSystemMessage("📞 Disconnecting from current user.");
        socket.send(JSON.stringify({ type: "skipToNext" }));
        resetConnection();
        startSearch();
    });

    // Stop searching completely (double click)
    skipButton.addEventListener("dblclick", () => {
        stopSearch();
        resetConnection();
    });

    // =========================
    // Share Screen Feature
    // =========================
    shareScreenButton.addEventListener("click", async () => {
        if (!peerConnection) {
            appendSystemMessage("🚨 Cannot share screen. No active connection.");
            return;
        }

        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true, // <-- system audio if user checks "Share audio"
            });

            const screenTrack = screenStream.getVideoTracks()[0];
            const systemAudioTrack = screenStream.getAudioTracks()[0];

            const videoSender = peerConnection.getSenders().find((s) => s.track && s.track.kind === "video");
            if (videoSender) {
                videoSender.replaceTrack(screenTrack);
            }

            if (systemAudioTrack) {
                console.log("🎶 Adding system audio track from screen share...");
                peerConnection.addTrack(systemAudioTrack, screenStream);
            }

            localVideo.srcObject = screenStream;
            appendSystemMessage("🖥️ Sharing your screen...");

            screenTrack.onended = async () => {
                appendSystemMessage("📷 Screen share ended. Restoring camera...");
                const camStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                localStream = camStream;

                const camTrack = camStream.getVideoTracks()[0];
                if (videoSender) {
                    videoSender.replaceTrack(camTrack);
                }

                localVideo.srcObject = camStream;
            };
        } catch (err) {
            console.error("❌ Error sharing screen:", err);
            appendSystemMessage("🚨 Failed to share screen.");
        }
    });

    // =========================
    // Chat + file transfer
    // =========================
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
        const playPauseBtn = audioPlayerContainer.querySelector(".play-pause-btn");
        const timeSlider = audioPlayerContainer.querySelector(".audio-slider");
        const currentTimeSpan = audioPlayerContainer.querySelector(".current-time");
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
            const progress = (audioElement.currentTime / audioElement.duration) * 100;
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
            const message = JSON.stringify({ type: "textMessage", content: text });
            dataChannel.send(message);
            appendMessage(text, "You");
            input.value = "";
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
                if (message.type === "audioMessage") {
                    appendAudioMessage(message.audioData, message.fileName, remoteUserProfile.username || "Friend");
                } else if (message.type === "imageMessage") {
                    appendImageMessage(message.imageData, remoteUserProfile.username || "Friend");
                } else if (message.type === "textMessage") {
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
                appendSystemMessage("🚨 Cannot send audio. Chat channel is not connected.");
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
                appendSystemMessage("🚨 Cannot send image. Chat channel is not connected.");
            }
        }
    });

    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });
});
