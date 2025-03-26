async function loginWithGoogle() {
    try {
        const state = Math.random().toString(36).substring(2); // Tạo state ngẫu nhiên
        sessionStorage.setItem("oauth_state", state); // Lưu state vào sessionStorage
        window.location.href = `http://localhost:5000/auth/google?prompt=select_account&state=${state}`;
    } catch (error) {
        console.error("Lỗi khi chuyển hướng đến trang đăng nhập Google:", error);
    }
}

// Hàm lấy và cập nhật thông tin người dùng
async function fetchAndUpdateUser() {
    try {
        const response = await fetch("http://localhost:5000/auth/user", {
            method: "GET",
            credentials: "include",  // 
            // Quan trọng: Bắt buộc để gửi cookie
        });

        console.log("Response Status:", response.status);

        if (!response.ok) {
            if (response.status === 401) {
                console.warn("Người dùng chưa đăng nhập hoặc token hết hạn!");
                localStorage.setItem("isLoggedIn", "false");
            } else {
                console.warn(`Lỗi từ server: ${response.status}`);
            }
            return;
        }

        const userData = await response.json();
        localStorage.setItem("user", JSON.stringify(userData));
        console.log("Dữ liệu người dùng:", userData);

        const avatarElement = document.getElementById("user-avatar");
        const avataMenu = document.getElementById("menu-avatar");

        if (avatarElement && avataMenu) {
            avatarElement.src = userData.picture;
            avataMenu.src = userData.picture;
            localStorage.setItem("isLoggedIn", "true");
        } else {
            console.warn("Không tìm thấy phần tử user-avatar hoặc menu-avatar!");
        }
    } catch (error) {
        console.error("Lỗi khi lấy thông tin người dùng:", error);
    }
}


// Hàm thiết lập sự kiện
function setupEventListeners() {
    const avatar = document.getElementById("user-avatar");
    const loginBtn = document.getElementById("google-login-btn");

    if (avatar && loginBtn) {
        const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

        if (!isLoggedIn) {
            sessionStorage.clear();
            console.log("Session cleared because user is not logged in.");
            loginBtn.style.display = "block";
        } else {
            loginBtn.style.display = "none";
        }
    }

    if (loginBtn) {
        loginBtn.addEventListener("click", loginWithGoogle);
    }
}

// Xử lý sự kiện khi DOM được tải
document.addEventListener("DOMContentLoaded", function () {
    getAccessToken();
    // fetchNotifications();
    fetchAndUpdateUser();
    setupEventListeners();

    const avatar = document.getElementById("user-avatar");
    const loginBtn = document.getElementById("google-login-btn");
    const menu = document.getElementById("user-menu");
    const logoutBtn = document.getElementById("logout-btn");
    // Ẩn nút đăng nhập ngay từ đầu
    if (loginBtn) {
        loginBtn.style.display = "none";
    }

    if (avatar) {
        avatar.addEventListener("click", function (event) {
            event.stopPropagation();
            if (!menu || !loginBtn) return;

            const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

            if (!isLoggedIn) {
                // Nếu chưa đăng nhập, chỉ hiển thị nút đăng nhập khi click avatar
                loginBtn.style.display = "block";
                loginBtn.style.position = "absolute";
                loginBtn.style.left = avatar.offsetLeft + "px";
                loginBtn.style.top = (avatar.offsetTop + avatar.offsetHeight + 5) + "px";
                menu.style.display = "none";
            } else {
                // Nếu đã đăng nhập, hiển thị menu
                loginBtn.style.display = "none";
                menu.style.display = "block";
            }

            const idGoogleUser = document.getElementById("user-handle");
            const userData = localStorage.getItem("user");
            if (userData) {
                const user = JSON.parse(userData); // Parse the JSON string into an object
                idGoogleUser.textContent = "ID: " + user.id; // Now you can access user.id
            }
            console.log("User ID:", idGoogleUser.textContent);
        });
    }

    // Ẩn menu và nút đăng nhập khi click bên ngoài
    document.addEventListener("click", function (event) {
        if (!menu || !loginBtn) return;
        if (menu.contains(event.target) || loginBtn.contains(event.target) || event.target.id === "user-avatar") return;
        menu.style.display = "none";
        loginBtn.style.display = "none";
    });

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async function () {
            try {
                const response = await fetch("http://localhost:5000/auth/logout", {
                    method: "POST",
                    credentials: "include",
                });

                if (response.ok) {
                    console.log("✅ Đăng xuất thành công!");
                    localStorage.clear();
                    document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                    sessionStorage.clear();

                    await fetch("http://localhost:5000/auth/logout", {
                        method: "POST",
                        credentials: "include"
                    })
                    .then(response => response.json())
                    .then(data => console.log(data));

                    if (menu) menu.style.display = "none";
                    if (avatar) avatar.src = "./assets/images/default-avata.png";
                    if (loginBtn) loginBtn.style.display = "none"; // Ẩn nút đăng nhập sau khi đăng xuất
                } else {
                    console.warn("Lỗi khi đăng xuất:", response.status);
                }
            } catch (error) {
                console.error("Lỗi khi gửi yêu cầu đăng xuất:", error);
            }
        });
    } else {
        console.error("Không tìm thấy phần tử #logout-btn!");
    }
});

// Hàm lấy access token
async function getAccessToken() {
    try {
        const response = await fetch('http://localhost:5000/get-access-token', {
            method: 'GET',
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(data.error || 'Failed to get access token');
        }

        const data = await response.json();
        // console.log("Access token:", data.access_token);
        return data.access_token;
    } catch (error) {
        console.error('Error fetching access token:', error);
        throw error;
    }
}

const notificationIconContainer = document.querySelector(".notifications-icon-container");
const notificationContainer = document.querySelector(".notifications-container");

// async function fetchNotifications() {
//     try {
//         // Lấy access token từ getAccessToken()
//         const accessToken = await getAccessToken();
//         if (!accessToken) {
//             console.error("Không lấy được access token");
//             return;
//         }

//         console.log("Access token:", accessToken);

//         // Gửi request lấy danh sách video mới
//         const response = await fetch("http://127.0.0.1:5000/my-latest-videos", {
//             method: "GET",
//             headers: {
//                 "Authorization": `Bearer ${accessToken}`, // Gửi token như khi like video
//                 "Content-Type": "application/json"
//             }
//         });

//         if (!response.ok) {
//             throw new Error(`Lỗi HTTP: ${response.status}`);
//         }

//         const videos = await response.json();
//         console.log("Danh sách video:", videos);

//         // Tìm container thông báo
//         const notificationContainer = document.querySelector(".notifications-container");
//         if (!notificationContainer) {
//             console.error("Không tìm thấy phần tử notifications-container");
//             return;
//         }

//         // Hiển thị danh sách video
//         if (!videos || videos.length === 0) {
//             notificationContainer.innerHTML = "<p class='no-videos'>Không có video mới nào.</p>";
//         } else {
//             notificationContainer.innerHTML = `
//                 <h3>Thông báo</h3>
//                 ${videos.slice(0, 10).map(video => `
//                     <div class="notification-item">
//                         <img class="avatar" src="https://www.gstatic.com/webp/gallery3/1.png" alt="Avatar">
//                         <div class="notification-content">
//                             <p class="notification-video-title">
//                                 ${video.channel_title} đã tải lên: 
//                                 <a href="https://www.youtube.com/watch?v=${video.video_id}" target="_blank">
//                                     ${video.video_title}
//                                 </a>
//                             </p>
//                             <span class="time">${new Date(video.published_at).toLocaleString()}</span>
//                         </div>
//                         <img class="notification-thumbnail" src="${video.thumbnail_url}" alt="Thumbnail">
//                     </div>
//                 `).join("")}
//             `;
//         }
//     } catch (error) {
//         console.error("Lỗi tải dữ liệu:", error);

//         // Hiển thị lỗi trong UI
//         const notificationContainer = document.querySelector(".notifications-container");
//         if (notificationContainer) {
//             notificationContainer.innerHTML = "<p class='error'>Lỗi khi tải dữ liệu video.</p>";
//         }
//     }
// }

// Click icon để mở/đóng thông báo
notificationIconContainer.addEventListener("click", function (event) {
    event.stopPropagation();
    const isVisible = notificationContainer.style.display === "block";
    
    if (!isVisible) {
        // fetchNotifications(); 
    }
    
    notificationContainer.style.display = isVisible ? "none" : "block";
});

// Ẩn thông báo khi click ra ngoài
document.addEventListener("click", function (event) {
    if (!notificationContainer.contains(event.target) && event.target !== notificationIconContainer) {
        notificationContainer.style.display = "none";
    }
});

window.onload = async function () {
    let accessToken = await getAccessToken();
    if (accessToken === null | accessToken === undefined) {
        loginWithGoogle();
    }
};