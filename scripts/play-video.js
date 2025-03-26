document.addEventListener("DOMContentLoaded", () => {
    fetchAndUpdateUser();
});

function fetchAndUpdateUser() {
    fetch("/api/user/info")
        .then(response => response.json())
        .then(data => {
            console.log("User info:", data); // Kiểm tra xem có dữ liệu user hay không
            if (data && data.username) {
                sessionStorage.setItem("user", JSON.stringify(data));
            }
        })
        .catch(error => console.error("Lỗi khi lấy thông tin người dùng:", error));
}

// Hàm hiển thị video
function displayVideo(videoUrl) {
    // Lấy phần tử container để hiển thị video
    const videoContainer = document.getElementById('video-container');
    if (videoContainer) {
        // Tạo một iframe để phát video từ YouTube
        videoContainer.innerHTML = `
            <h1>Video</h1>
            <iframe width="560" height="315" src="${videoUrl}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        `;
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    // Lấy thông tin từ URL
    const urlParams = new URLSearchParams(window.location.search);
    const videoUrl = urlParams.get('videoUrl'); // Dành cho file MP4
    const videoId = urlParams.get('videoid');  // Dành cho YouTube
    const accessToken = await getAccessToken();
    // Lấy container hiển thị video
    const videoContainer = document.getElementById('video-container');
    document.getElementById("progress-container").style.display = "none";

    if (!videoContainer) {
        console.error('Không tìm thấy phần tử video-container');
        return;
    }

    // Nếu có video URL (MP4)
    if (videoUrl) {
        console.log('🔹 Video URL:', videoUrl);
        videoContainer.innerHTML = `
            <video controls autoplay width="100%" height="630">
                <source src="${decodeURIComponent(videoUrl)}" type="video/mp4">
                Trình duyệt của bạn không hỗ trợ video.
            </video>
        `;

        // Ẩn thông tin video vì file MP4 không có metadata từ API
        // document.getElementById('video-info').style.display = 'none';
    } 
    else if (videoId) {
        console.log('🔹 Video ID:', videoId);
        fetchComments(videoId);

        // Gọi API để lấy thông tin video từ server
        await fetch(`http://localhost:5000/api/videos/details?ids=${videoId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Lỗi HTTP: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (!data.videoDetails || !Array.isArray(data.videoDetails)) {
                    console.error("❌ Lỗi: Dữ liệu API không đúng định dạng!", data);
                    return;
                }
    
                // Tìm video trong danh sách trả về
                let videoData = data.videoDetails.find(video => video.id === videoId);
    
                if (videoData) {
                    console.log("Video Info:", videoData, videoData.channelId);
                    localStorage.removeItem('channel_id');
                    localStorage.setItem('channel_id', videoData.channelId);

                    localStorage.removeItem('video_id');
                    localStorage.setItem('video_id', videoId);
    
                    document.getElementById("video-title").innerText = videoData.title;
                    document.getElementById("video-stats").innerText =
                        `${videoData.viewCount ? formatViewCount(videoData.viewCount) : "Không có lượt xem"} | ${formatPublishedTime(videoData.publishedAt)}`;
                    document.getElementById("video-likes").innerText =
                        videoData.likeCount ? `${formatLikeVideoAndSubscribers(videoData.likeCount)}` : "Không có dữ liệu";
                    document.getElementById("channel-avatar").src =
                        videoData.channel_avatar || "./assets/images/default-avata.png";
                    document.getElementById("channel-name").innerText = videoData.channelTitle;
                    document.getElementById("channel-subscribers").innerText =
                        videoData.subscriberCount ? `${formatLikeVideoAndSubscribers(videoData.subscriberCount)} người đăng ký` : "Không có dữ liệu";
                    
                    //Description
                    const vidDecribe = document.getElementById("vid-decribe");
                    if (vidDecribe) {
                        vidDecribe.innerHTML = formatDescription(videoData.description.replace(/\n/g, "<br>")) || "Video này chưa được thêm nội dung mô tả.";
                    } else {
                        console.error("Không tìm thấy phần tử có ID 'vid-decribe'");
                    }       

                } else {
                    console.error("Không tìm thấy dữ liệu video!");
                }
            })
            .catch(error => console.error("Lỗi khi lấy dữ liệu video:", error));

            videoContainer.innerHTML = `
            <iframe 
                width="100%" 
                height="630" 
                src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
            </iframe>
            `;

    } else {
        console.error("Không có videoUrl hoặc videoId trong URL!");
    }
    
    // const storedData = sessionStorage.getItem("videoList");
    const storedData = localStorage.getItem("videoList");
    const data = storedData ? JSON.parse(storedData) : null;

    if (!data || !Array.isArray(data.videos)) {
        console.error("Không có danh sách video hoặc dữ liệu không hợp lệ.");
        return;
    }

    const sidebar = document.querySelector(".right-sidebar");

    if (!sidebar) {
        console.error("Không tìm thấy phần tử .right-sidebar");
        return;
    }

    sidebar.innerHTML = ""; // Xóa nội dung cũ trước khi thêm mới

    console.log("List videos: ", data);

    data.videos.forEach((video) => {
        if (getYouTubeVideoId(video.video_url) === videoId) {
            return; // Bỏ qua video đang phát
        }
        
        // console.log("Time: ", video);

        const videoElement = document.createElement("div");
        videoElement.classList.add("side-video-list");
        videoElement.innerHTML = `
            <a href="play-video.html?videoid=${getYouTubeVideoId(video.video_url)}" class="small-thumbnail">
                <img src="${video.thumbnail}" alt="Thumbnail">
            </a>
            <div class="vid-info">
                <a href="watch.html?videoid=${getYouTubeVideoId(video.video_url)}">${video.title}</a>
                <p>${video.channel}</p>
                <p>${formatViewCount(video.viewCount)} &bull; ${formatPublishedTime(video.published_at)}</p>
            </div>
        `;
        sidebar.appendChild(videoElement);
    });

    const btnSubscribe = document.querySelector(".btn-subcribe button");

    if (btnSubscribe) {
        btnSubscribe.addEventListener("click", async function () {
            if (this.classList.contains("subscribed")) {
                await new Promise(resolve => setTimeout(resolve, 300));
                this.classList.remove("subscribed");
                this.innerHTML = `<span>Đăng ký</span>`;
            } else {
                await new Promise(resolve => setTimeout(resolve, 300));
                this.classList.add("subscribed");
                this.innerHTML = `<i class="fas fa-bell"></i> <span>Đã đăng ký</span> <i class="fa-solid fa-caret-down"></i>`;
            }
        });
    }

    const commentInput = document.getElementById("comment-input");
    const commentActions = document.querySelector(".comment-actions");
    const cancelBtn = document.getElementById("cancel-btn");
    const submitBtn = document.getElementById("submit-btn");

    // Hiện nút khi click vào ô nhập
    commentInput.addEventListener("focus", () => {
        commentActions.style.display = "flex";
        submitBtn.style.backgroundColor = "lightgray";
        submitBtn.style.color = "#909090";
    });

    // Ẩn nút khi bấm "Hủy"
    cancelBtn.addEventListener("click", () => {
        commentInput.value = "";
        commentActions.style.display = "none";
        submitBtn.disabled = true;
    });

    // Kiểm tra khi nhập văn bản để kích hoạt nút "Bình luận"
    commentInput.addEventListener("input", () => {
        if (commentInput.value.trim() === "") {
            submitBtn.disabled = true;
            submitBtn.style.backgroundColor = "lightgray";
            submitBtn.style.color = "#333";
        } else {
            submitBtn.disabled = false;
            submitBtn.style.backgroundColor = "#065fd4";
            submitBtn.style.color = "#fff";
        }
    });

    const avatarImg = document.getElementById("comment-avatar");

    const userData = JSON.parse(localStorage.getItem("user")); 

    if (userData && userData.picture) {
        avatarImg.src = userData.picture;
    }
    
    var channelId = localStorage.getItem('channel_id');

    const shareBtn = document.getElementById("shareBtn");
    const modal = document.getElementById("shareModal");
    const closeBtn = document.querySelector(".close");
    const copyBtn = document.getElementById("copyLink");
    const shareLink = document.getElementById("shareLink");

    // Khi bấm Share thì mở modal
    shareBtn.addEventListener("click", function (event) {
        event.preventDefault();
        modal.style.display = "block";
    });

    // Đóng modal khi bấm nút đóng
    closeBtn.addEventListener("click", function () {
        modal.style.display = "none";
    });

    // Sao chép link vào clipboard
    copyBtn.addEventListener("click", function () {
        shareLink.select();
        navigator.clipboard.writeText(shareLink.value);
        // alert("Đã sao chép link!");
    });

    // Đóng modal nếu bấm ra ngoài
    window.addEventListener("click", function (event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });



    let videoUrlShare = "https://youtu.be/" + videoId;

    document.getElementById("shareLink").value = "https://youtu.be/" + videoId;

    document.getElementById("facebookShare").href =
        "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(videoUrlShare);
    document.getElementById("facebookShare").setAttribute("target", "_blank");

    document.getElementById("twitterShare").href =
        "https://twitter.com/intent/tweet?url=" + encodeURIComponent(videoUrlShare) + "&text=Check%20this%20out!";
    document.getElementById("twitterShare").setAttribute("target", "_blank");

    document.getElementById("whatsappShare").href =
        "https://api.whatsapp.com/send?text=" + encodeURIComponent(videoUrlShare);
    document.getElementById("whatsappShare").setAttribute("target", "_blank");

    document.getElementById("emailShare").href =
        "mailto:?subject=Check%20this%20video&body=" + encodeURIComponent(videoUrlShare);
    document.getElementById("emailShare").setAttribute("target", "_blank");

    checkLikeStatus(videoId, accessToken);
    // await checkIfUserSubscribedToChannel(channelId, accessToken);
    // await updateSubscribeButtonUI(channelId);
});


// Hàm format số lượt xem
function formatViewCount(views) {
    if (!views || views === 'N/A') return 'N/A';
    
    views = parseInt(views);
    if (isNaN(views)) return 'N/A';
    
    if (views >= 1000000) return `${Math.floor(views / 1000000)}M lượt xem`;
    if (views >= 1000) return `${Math.floor(views / 1000)}K lượt xem`;
    return `${views} lượt xem`;
}

// Hàm format thời gian đăng
function formatPublishedTime(publishedAt) {
    if (!publishedAt || publishedAt === 'N/A') return '';
    
    const publishedDate = new Date(publishedAt);
    if (isNaN(publishedDate.getTime())) return '';
    
    const now = new Date();
    const timeDiff = Math.floor((now - publishedDate) / (1000 * 60 * 60 * 24));
    
    if (timeDiff > 365) {
        return `${Math.floor(timeDiff / 365)} năm trước`;
    } else if (timeDiff > 30) {
        return `${Math.floor(timeDiff / 30)} tháng trước`;
    } else if (timeDiff > 0) {
        return `${timeDiff} ngày trước`;
    } else {
        return 'Today';
    }
}

// Lấy danh sách video từ sessionStorage
// const data = JSON.parse(sessionStorage.getItem('videoList'));
const data = JSON.parse(localStorage.getItem('videoList'));

if (data) {
    console.log(data); // Hiển thị danh sách video
} else {
    console.error("Không có dữ liệu video.");
}

// 🛠 Hàm lấy ID video từ URL YouTube
function getYouTubeVideoId(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/))([^?&]+)/);
    return match ? match[1] : null;
}

// 🛠 Hàm định dạng số lượt like và người đăng ký 
function formatLikeVideoAndSubscribers(likeCount) {
    if (!likeCount || isNaN(likeCount)) {
        return "Không có dữ liệu";
    }

    likeCount = Number(likeCount);

    if (likeCount >= 1_000_000_000) {
        return (likeCount / 1_000_000_000).toFixed(1) + " Tỷ";
    } else if (likeCount >= 1_000_000) {
        return (likeCount / 1_000_000).toFixed(1) + " Tr";
    } else if (likeCount >= 1_000) {
        return (likeCount / 1_000).toFixed(1) + " N";
    } else {
        return likeCount.toString();
    }
}

function formatDescription(description) {
    if (!description) return "Không có mô tả";

    // Chuyển đổi xuống dòng `\n` thành `<br>`
    let formattedText = description;

    // Thay đổi các URL thành link có thể click
    formattedText = formattedText.replace(/(\bhttps?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="video-link">$1</a>');

    // Thay đổi các hashtag thành màu xanh
    formattedText = formattedText.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');

    // Nếu mô tả dài hơn 300 ký tự -> Hiển thị rút gọn + Thêm / Ẩn bớt
    if (formattedText.length > 300) {
        let shortText = formattedText.slice(0, 300);

        // Tạo ID duy nhất cho mô tả
        const uniqueId = new Date().getTime();

        return `
            <span id="short-desc-${uniqueId}" class="short-desc">${shortText}...
                <a href="javascript:void(0)" onclick="toggleDescription('${uniqueId}')" class="show-more">thêm</a>
            </span>
            <span id="full-desc-${uniqueId}" class="full-desc" style="display:none;">${formattedText} 
                <br><a href="javascript:void(0)" onclick="toggleDescription('${uniqueId}')" class="show-less">Ẩn bớt</a>
            </span>
        `;
    }

    // Nếu mô tả ngắn hơn 300 ký tự -> Hiển thị nguyên văn
    return `<span class="short-desc">${formattedText}</span>`;
}

// Hàm toggle ẩn/hiện mô tả
function toggleDescription(id) {
    let shortDesc = document.getElementById(`short-desc-${id}`);
    let fullDesc = document.getElementById(`full-desc-${id}`);

    if (shortDesc.style.display === "none") {
        shortDesc.style.display = "inline";
        fullDesc.style.display = "none";
    } else {
        shortDesc.style.display = "none";
        fullDesc.style.display = "inline";
    }
}


// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
async function fetchComments(videoId) {
    const response = await fetch(`http://localhost:5000/api/comments?videoId=${videoId}`);
    const data = await response.json();
    // console.log("Comment: \n", data.comments);
    await displayComments(data.comments);
}

async function displayComments(comments) {
    const container = document.getElementById('comments-list');
    container.innerHTML = ''; // Xóa nội dung cũ

    comments.forEach(comment => {
        const commentHtml = `
            <div class="old-comment">
                <img class="avatar-img" src="${comment.author_avatar}" onerror="this.onerror=null; this.src='./accets/images/default-avatar.png';" alt="Avatar">
                <div>
                    <h3>${comment.author} <span>${timeAgo(comment.published_at)}</span></h3>
                    <p>${comment.text}</p>
                    <div class="acomment-action">
                        <img src="./assets/images/like.png">
                        <span>${comment.like_count}</span>
                        <img src="./assets/images/dislike.png">
                        <span>0</span>
                        <span class="reply-btn" data-id="${comment.id}">Phản hồi </span>
                        <a href="#" class="toggle-replies" data-id="${comment.id}">
                            ${comment.replies && comment.replies.length > 0 ? `${comment.replies.length} phản hồi` : ''}
                        </a>
                    </div>
                </div>
            </div>
            <div class="replies-container" id="replies-${comment.id}" style="display: none;">
                ${comment.replies ? comment.replies.map(reply => `
                    <div class="old-comment reply">
                        <img class="comment-reply-avatar" src="${reply.author_avatar}" alt="Avatar">
                        <div>
                            <h3>${reply.author} <span>${timeAgo(reply.published_at)}</span></h3>
                            <p>${reply.text}</p>
                            <div class="acomment-action">
                                <img src="./assets/images/like.png">
                                <span>${reply.like_count}</span>
                                <img src="./assets/images/dislike.png">
                                <span>0</span>
                            </div>
                        </div>
                    </div>
                `).join('') : ''}
            </div>
        `;
        container.innerHTML += commentHtml;
    });

    // Thêm sự kiện ẩn/hiện phản hồi
    document.querySelectorAll(".toggle-replies").forEach(button => {
        button.addEventListener("click", function (event) {
            event.preventDefault();
            const repliesDiv = document.getElementById(`replies-${this.dataset.id}`);
            if (repliesDiv.style.display === "none") {
                repliesDiv.style.display = "block";
                this.textContent = `${repliesDiv.children.length} phản hồi`;
            } else {
                repliesDiv.style.display = "none";
                this.textContent = `${repliesDiv.children.length} phản hồi`;
            }
        });
    });
}

// Hàm tính thời gian đã trôi qua (ví dụ: "2 hours ago")
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60,
    };

    for (const [unit, secondsPerUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsPerUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
    }
    return "Just now";
}

async function getAccessToken() {
    try {
        const response = await fetch("http://127.0.0.1:5000/get-access-token", {
            method: "GET",
            credentials: "include",  // BẮT BUỘC để gửi cookie
        });

        if (!response.ok) {
            throw new Error(`Lỗi HTTP: ${response.status}`);
        }

        const data = await response.json();
        if (data.access_token) {
            return data.access_token;  // Trả về access_token
        } else {
            console.error("Không lấy được access_token:", data.error);
            return null;
        }
    } catch (error) {
        console.error("Lỗi khi gọi API:", error);
        return null;
    }
}

document.getElementById('likeButton').addEventListener('click', async function () {
    var accessToken = await getAccessToken();
    var videoId = localStorage.getItem('video_id');
    const likeButton = document.getElementById('likeButton');
    const dislikeButton = document.getElementById('dislikeButton');

    if (!accessToken) {
        alert("Cần đăng nhập để thực hiện hành động này!");
        return;
    }

    // Kiểm tra trạng thái hiện tại
    const currentRating = await checkLikeStatus(videoId, accessToken);

    if (currentRating === "like") {
        const success = await rateVideo(videoId, accessToken, "none");
        if (success) {
            likeButton.src = './assets/images/like.png';
            likeButton.alt = 'Like Video';
            console.log("Đã bỏ like video.");
        }
    } else {
        const success = await rateVideo(videoId, accessToken, "like");
        if (success) {
            likeButton.src = './assets/images/liked.png';
            likeButton.alt = 'Liked Video';
            console.log("Đã like video.");         
        }
    }

    dislikeButton.src = './assets/images/dislike.png';
    // Cập nhật lại trạng thái sau khi thay đổi
    await checkLikeStatus(videoId, accessToken);
});

document.getElementById('dislikeButton').addEventListener('click', async function () {
    var accessToken = await getAccessToken();
    var videoId = localStorage.getItem('video_id');
    const dislikeButton = document.getElementById('dislikeButton');
    const likeButton = document.getElementById('likeButton');

    if (!accessToken) {
        alert("Cần đăng nhập để thực hiện hành động này!");
        return;
    }

    // Kiểm tra trạng thái hiện tại
    const currentRating = await checkLikeStatus(videoId, accessToken);

    if (currentRating === "dislike") {
        const success = await rateVideo(videoId, accessToken, "none");
        if (success) {
            dislikeButton.src = './assets/images/dislike.png';
            dislikeButton.alt = 'Dislike Video';
            console.log("Đã bỏ dislike video.");
        }
    } else {
        const success = await rateVideo(videoId, accessToken, "dislike");
        if (success) {
            dislikeButton.src = './assets/images/disliked.png';
            dislikeButton.alt = 'Disliked Video';
            console.log("Đã dislike video.");         
        }
    }

    likeButton.src = './assets/images/like.png';
    // Cập nhật lại trạng thái sau khi thay đổi
    await checkLikeStatus(videoId, accessToken);
});


/**
 * Kiểm tra trạng thái like của video
 */
async function checkLikeStatus(videoId, accessToken) {
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos/getRating?id=${videoId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`Lỗi API YouTube: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const likeButton = document.getElementById('likeButton');
        const dislikeButton = document.getElementById('dislikeButton');

        if (data.items && data.items.length > 0) {
            const rating = data.items[0].rating; // "like", "dislike" hoặc "none"

            if (rating === 'like') {
                console.log('Người dùng đã like video này');
                likeButton.src = './assets/images/liked.png';
            } else if (rating === 'dislike') {
                console.log('Người dùng đã dislike video này');
                dislikeButton.src = './assets/images/disliked.png';
            } else {
                console.log('Người dùng chưa like video này');
            }

            return rating; //  Trả về trạng thái hiện tại
        } else {
            console.log('Không có dữ liệu');
            return "none"; // Mặc định nếu không có dữ liệu
        }
    } catch (error) {
        console.error('Lỗi khi kiểm tra trạng thái like:', error);
        return "none"; // Trả về mặc định khi lỗi
    }
}


/**
 * Gửi yêu cầu like hoặc bỏ like video
 */
async function rateVideo(videoId, accessToken, rating) {
    try {
        let response = await fetch("http://localhost:5000/rate_video", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                access_token: accessToken,
                video_id: videoId,
                rating: rating
            })
        });

        if (response.ok) {
            return true; // Thành công
        } else {
            let errorData = await response.json();
            console.error("Lỗi API:", errorData);
            return false;
        }
    } catch (error) {
        console.error("Lỗi kết nối API:", error);
        return false;
    }
}

async function checkIfUserSubscribedToChannel(channelId, accessToken) {
    if (!accessToken || !channelId) {
        console.error("Thiếu accessToken hoặc channelId!");
        return false; // Trả về false nếu thiếu thông tin
    }

    let isSubscribed = false;
    let nextPageToken = null;

    try {
        do {
            const response = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            const data = await response.json();
            console.log(data);

            if (!data.items || data.items.length === 0) {
                console.log("Người dùng chưa đăng ký kênh nào hoặc API không trả về dữ liệu.");
                return false; // Không có đăng ký => trả về false
            }

            // Kiểm tra xem kênh có trong danh sách không
            isSubscribed = data.items.some(subscription => subscription.snippet.resourceId.channelId === channelId);
            console.log("Tìm thấy subscription: ", isSubscribed);
            // await updateSubscribeButtonUI(channelId);
            if (isSubscribed) return true; // Nếu tìm thấy, trả về true ngay lập tức

            nextPageToken = data.nextPageToken; // Tiếp tục nếu còn trang tiếp theo
        } while (nextPageToken);

        return false; // Nếu duyệt hết danh sách mà không tìm thấy
    } catch (error) {
        console.error("Lỗi API Subscriptions:", error);
        return false; // Trả về false nếu có lỗi
    }
}

async function subscribeToChannel(channelId) {
    try {
        const accessToken = await getAccessToken();  // Dùng await để lấy token thực
        console.log("Access_token khi đăng ký:", accessToken);
        console.log("Channel ID:", channelId);

        if (!accessToken) {
            alert("Bạn chưa đăng nhập!");
            return false;
        }

        if (!channelId) {
            alert("Không có channel ID!");
            return false;
        }

        const response = await fetch("http://127.0.0.1:5000/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: accessToken, channel_id: channelId })
        });

        const result = await response.json();
        console.log("Kết quả API:", result);

        if (response.ok) {
            alert(result.message);
            return true;
        } else {
            console.error("Lỗi:", result);
            return false;
            // alert("Không thể đăng ký kênh!");
        }
    } catch (error) {
        console.error("Lỗi gọi API:", error);
        return false;
    }
}

// Hàm lấy token và kiểm tra đăng ký khi load trang
// async function initializeSubscriptionStatus() {
//     let accessToken = localStorage.getItem("access_token"); 
//     const channelId = localStorage.getItem("channel_id");

//     if (!accessToken) {
//         accessToken = await getAccessToken();
//         if (accessToken) localStorage.setItem("access_token", accessToken);
//     }

//     if (accessToken && channelId) {
//         let isSubscribed = await checkIfUserSubscribedToChannel(channelId, accessToken);
//         if (isSubscribed) {
//             document.getElementById("subscribe-btn").classList.add("subscribed");
//             document.getElementById("subscribe-btn").innerHTML = `<i class="fas fa-bell"></i> <span>Đã đăng ký</span> <i class="fa-solid fa-caret-down"></i>`; 
//         }
//         else {
//             document.getElementById("subscribe-btn").classList.remove("subscribed");
//             document.getElementById("subscribe-btn").innerHTML = `<span>Đăng ký</span>`; 
//         }
//     }
// }

document.getElementById("subscribe-btn").addEventListener("click", async function () { 
    let channelId = localStorage.getItem('channel_id');
    let accessToken = await getAccessToken();
    if (!accessToken) {
        alert("Bạn cần đăng nhập để đăng ký kênh!");
        return;
    }
    
    if (!channelId) {
        alert("Không tìm thấy Channel ID!");
        return;
    }

    // Kiểm tra trạng thái hiện tại
    let isSubscribed = await checkIfUserSubscribedToChannel(channelId, accessToken);
    console.log("Trạng thái sub: ", isSubscribed);

    if (isSubscribed) {
        // Hủy đăng ký
        const success = await unsubscribeFromChannel(channelId, accessToken);
        if (success) {
            console.log("Đã hủy đăng ký kênh.");
            alert("Đã hủy đăng ký kênh.");
            // localStorage.setItem(`subscribed_${channelId}`, "false");
        }
        return
    } 

    if(isSubscribed === false) {
        // Đăng ký kênh
        const success = await subscribeToChannel(channelId, accessToken);
        if (success) {
            console.log("Đã đăng ký kênh.");
            // alert("Đã đăng ký kênh.");
            // localStorage.setItem(`subscribed_${channelId}`, "true");
        }
        return;
    }

    // Cập nhật lại giao diện nút
    updateSubscribeButtonUI(channelId);
});

// Hàm cập nhật giao diện nút Đăng ký
async function updateSubscribeButtonUI(channelId) {
    let accessToken = await getAccessToken();
    let btnSubscribe = document.getElementById("subscribe-btn");

    if (!accessToken || !channelId) return;

    // Kiểm tra từ API
    let isSubscribed = await checkIfUserSubscribedToChannel(channelId, accessToken);

    // Cập nhật giao diện nút
    if (isSubscribed) {
        btnSubscribe.classList.add("subscribed");
        btnSubscribe.innerHTML = `<i class="fas fa-bell"></i> <span>Đã đăng ký</span> <i class="fa-solid fa-caret-down"></i>`;
    } else {
        btnSubscribe.classList.remove("subscribed");
        btnSubscribe.innerHTML = `<span>Đăng ký</span>`;
    }
}

async function getAllSubscriptions(accessToken) {
    let subscriptions = [];
    let nextPageToken = null;

    try {
        do {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/subscriptions?part=id,snippet&mine=true&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`, 
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Lỗi API: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            subscriptions.push(...data.items); // Thêm vào danh sách
            nextPageToken = data.nextPageToken || null; // Lấy token trang tiếp theo (nếu có)

        } while (nextPageToken); // Lặp lại nếu còn trang tiếp theo

        console.log(`Tổng số subscription lấy được: ${subscriptions.length}`);
        return subscriptions;
    } catch (error) {
        console.error("Lỗi khi lấy danh sách đăng ký:", error);
        return [];
    }
}


async function unsubscribeFromChannel(channelId, accessToken) {
    if (!accessToken || !channelId) {
        console.error("Thiếu accessToken hoặc channelId!");
        return false;
    }

    try {
        // Lấy toàn bộ danh sách đăng ký
        const subscriptions = await getAllSubscriptions(accessToken);

        if (subscriptions.length === 0) {
            console.warn("Người dùng chưa đăng ký bất kỳ kênh nào.");
            return false;
        }

        // Tìm subscription cần hủy
        const subscription = subscriptions.find(sub => sub.snippet?.resourceId?.channelId === channelId);

        if (!subscription) {
            console.warn(`Không tìm thấy subscription để hủy với channelId: ${channelId}`);
            return false;
        }

        console.log(`Tìm thấy subscription ID: ${subscription.id}, tiến hành hủy đăng ký...`);

        // Gọi API hủy đăng ký
        const deleteResponse = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?id=${subscription.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!deleteResponse.ok) {
            throw new Error(`Lỗi API khi hủy đăng ký: ${deleteResponse.status} - ${deleteResponse.statusText}`);
        }

        console.log("Hủy đăng ký thành công!");
        return true;
    } catch (error) {
        console.error("Lỗi khi hủy đăng ký:", error);
        return false;
    }
}

async function updateNotifications() {
    try {
        const response = await fetch("/my-latest-videos");
        if (!response.ok) throw new Error("Lỗi khi lấy video mới");

        const videos = await response.json();
        const container = document.querySelector(".notifications-container");

        // Xóa các thông báo cũ trước khi thêm mới
        container.innerHTML = `<h3>Thông báo</h3>`;

        // Lặp qua danh sách video và thêm vào giao diện
        videos.slice(0, 10).forEach(video => {
            const notificationHTML = `
                <div class="notification-item">
                    <img class="avatar" src="./assets/images/channel-1.jpeg" alt="Avatar">
                    <div class="notification-content">
                        <p class="notification-video-title">${video.channel_title} đã tải lên: ${video.video_title}</p>
                        <span class="time">${new Date(video.published_at).toLocaleString()}</span>
                    </div>
                    <img class="notification-thumbnail" src="${video.thumbnail_url}" alt="Thumbnail">
                </div>
            `;
            container.innerHTML += notificationHTML;
        });
    } catch (error) {
        console.error("Lỗi khi cập nhật thông báo:", error);
    }
}

document.getElementById('comment-input').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') { // Nhấn Enter cũng có thể gửi bình luận
        submitComment();
    }
});

document.getElementById('submit-btn').addEventListener('click', function() {
    submitComment();
});

async function submitComment() {
    const commentInput = document.getElementById('comment-input');
    const commentText = commentInput.value.trim();

    if (commentText === '') return; // Không gửi nếu rỗng

    const accessToken = await getAccessToken(); // Token của YouTube API
    const videoId = localStorage.getItem('video_id'); // ID của video cần bình luận

    await postYouTubeComment(accessToken, videoId, commentText)
        .then(async () => {
            commentInput.value = ''; // Xóa input sau khi gửi thành công
            alert('Bình luận đã được đăng!');
        })
        .catch(error => {
            console.error('Lỗi khi gửi bình luận:', error);
        });

        const submitBtn = document.getElementById("submit-btn");
        const cancelbtn = document.getElementById("cancel-btn");

        submitBtn.style.display = "none";
        cancelbtn.style.display = "none";
}

// async function submitComment() {
//     const commentInput = document.getElementById('comment-input');
//     const commentText = commentInput.value.trim();

//     if (commentText === '') return; // Không gửi nếu rỗng

//     const accessToken = await getAccessToken(); // Token của YouTube API
//     const videoId = localStorage.getItem('video_id'); // ID của video cần bình luận

//     // Dữ liệu bình luận giả lập để hiển thị ngay
//     const newComment = {
//         author: localStorage.getItem('user.name'),
//         author_avatar: localStorage.getItem('user.picture'),
//         published_at: new Date().toISOString(),
//         text: commentText,
//         like_count: 0,
//         replies: []
//     };

//     // Hiển thị bình luận lên giao diện ngay lập tức
//     addNewCommentToUI(newComment);

//     try {
//         await postYouTubeComment(accessToken, videoId, commentText);
//         commentInput.value = ''; // Xóa input sau khi gửi thành công
//         alert('Bình luận đã được đăng!');
//     } catch (error) {
//         console.error('Lỗi khi gửi bình luận:', error);
//     }
// }

// async function addNewCommentToUI(comment) {
//     const commentList = document.getElementById('comment-list');
//     const newComment = document.createElement('div');
//     newComment.classList.add('old-comment');
    
//     newComment.innerHTML = `
//         <img class="avatar-img" src="${comment.author_avatar}" alt="Avatar">
//         <div>
//             <h3>${comment.author} <span>${timeAgo(comment.published_at)}</span></h3>
//             <p>${comment.text}</p>
//             <div class="acomment-action">
//                 <img src="./assets/images/like.png">
//                 <span>${comment.like_count}</span>
//                 <img src="./assets/images/dislike.png">
//                 <span>0</span>
//                 <span class="reply-btn" data-id="${comment.id}">Phản hồi </span>
//                 <a href="#" class="toggle-replies" data-id="${comment.id}">
//                     ${comment.replies && comment.replies.length > 0 ? `${comment.replies.length} phản hồi` : ''}
//                 </a>
//             </div>
//         </div>
//     `;
    
//     // Thêm bình luận mới lên đầu danh sách
//     // commentList.prepend(newComment);
// }

async function postYouTubeComment(accessToken, videoId, commentText) {
    const url = 'https://www.googleapis.com/youtube/v3/commentThreads?part=snippet';

    const requestBody = {
        snippet: {
            videoId: videoId,
            topLevelComment: {
                snippet: {
                    textOriginal: commentText
                }
            }
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Lỗi API: ${errorData.error.message}`);
        }

        console.log("Bình luận đã được đăng thành công!");
    } catch (error) {
        console.error("Lỗi khi gửi bình luận:", error);
    }
}

document.getElementById("download-btn").addEventListener("click", function () {
    const videoId = localStorage.getItem("video_id");
    if (!videoId) {
        console.log("Không tìm thấy videoId!");
        return;
    }

    fetch("http://localhost:5000/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: videoId })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById("status").innerText = data.message;
        document.getElementById("progress-container").style.display = "block";

        // Cập nhật tiến trình tải
        const statusInterval = setInterval(() => {
            fetch(`http://localhost:5000/download/status/${videoId}`)
            .then(response => response.json())
            .then(statusData => {
                let statusText = statusData.status;
                document.getElementById("status").innerText = statusText;

                // Cập nhật progress bar
                let match = statusText.match(/(\d+(\.\d+)?)%/);
                if (match) {
                    let percent = parseFloat(match[1]);
                    document.getElementById("progress-bar").style.width = percent + "%";
                    document.getElementById("progress-bar").innerText = percent + "%";
                }

                if (statusText.startsWith("") || statusText.startsWith("⚠️")) {
                    clearInterval(statusInterval);
                    document.getElementById("progress-bar").style.width = "100%";
                    document.getElementById("progress-bar").innerText = "Hoàn tất!";
                    document.getElementById("progress-container").style.display = "none";
                }
            });
        }, 2000);
    })
    .catch(error => {
        document.getElementById("progress-container").style.display = "none";
        console.error("Lỗi tải video:", error);
    });
});

document.getElementById("copyLink").addEventListener("click", function () {
    let shareLink = document.getElementById("shareLink");
    navigator.clipboard.writeText(shareLink.value).then(() => {
        let toast = document.getElementById("toast");
        toast.classList.add("show");

        setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    });
});