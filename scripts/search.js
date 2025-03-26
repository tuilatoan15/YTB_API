// Biến toàn cục
const API_BASE_URL = 'http://127.0.0.1:5000'; // Thay đổi URL này thành URL của Flask API
const API_ENDPOINTS = {
    search: `${API_BASE_URL}/search`,
    videoDetails: `${API_BASE_URL}/api/videos/details`
};

// Khởi tạo khi trang tải xong
document.addEventListener('DOMContentLoaded', function() {
    // Tìm kiếm ô input và nút tìm kiếm
    const searchInput = document.getElementById('search-query');
    const searchButton = document.getElementById('search-button');

    // Thêm sự kiện cho nút tìm kiếm (nếu có)
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `index.html?search=${encodeURIComponent(query)}`;
            }
        });
    }

    // Thêm sự kiện cho ô tìm kiếm (nếu có)
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    window.location.href = `index.html?search=${encodeURIComponent(query)}`;
                }
            }
        });
    }

    // Kiểm tra URL để lấy từ khóa tìm kiếm
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('search') || 'Nhạc EDM TikTok';

    const voiceButton = document.querySelector(".voice-button");

    // Kiểm tra trình duyệt hỗ trợ Web Speech API không
    if (!("webkitSpeechRecognition" in window)) {
        alert("Trình duyệt của bạn không hỗ trợ tìm kiếm bằng giọng nói.");
        return;
    }

    const recognition = new webkitSpeechRecognition(); 
    recognition.continuous = false; 
    recognition.lang = "vi-VN"; 
    recognition.interimResults = false; 

    voiceButton.addEventListener("click", function () {
        recognition.start();
        console.log("🎤 Đang lắng nghe...");
    });

    recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript; 
        console.log("📝 Nhận dạng:", transcript);
        searchInput.value = transcript;
        searchButton.click();
    };

    recognition.onerror = function (event) {
        console.error("Lỗi nhận dạng:", event.error);
        alert("Lỗi nhận diện giọng nói, vui lòng cho phép trình duyệt nhận diện giọng nói và thử lại.");
    };

    recognition.onend = function () {
        console.log("🎤 Đã dừng nhận diện.");
    };

    searchVideos(query); // Chỉ gọi 1 lần
});


async function searchVideos(defaultQuery) {
    // Hiển thị trạng thái đang tải
    showLoadingState();
    
    // Lấy giá trị tìm kiếm từ input hoặc dùng giá trị mặc định
    const searchInput = document.getElementById('search-query');
    const query = defaultQuery || (searchInput ? searchInput.value.trim() : '');
    
    // Kiểm tra query không rỗng và không phải 'undefined'
    if (!query || query === 'undefined') {
        hideLoadingState();
        return;
    }
    
    try {
        // Kiểm tra xem có dữ liệu trong localStorage không
        const cachedData = localStorage.getItem('videoList');
        if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            
            // Kiểm tra xem dữ liệu trong localStorage có phù hợp với query hiện tại không
            if (parsedData.query === query) {
                console.log('Đang sử dụng dữ liệu từ localStorage');
                displayVideos(parsedData.videos);
                return; // Không cần gọi API nếu dữ liệu đã có sẵn
            }
        }

        const encodedQuery = encodeURIComponent(query);
        console.log('Đang gọi API:', `${API_ENDPOINTS.search}?query=${encodedQuery}`);
        
        // Gọi API tìm kiếm từ backend với timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // Timeout sau 10 giây
        
        const response = await fetch(`${API_ENDPOINTS.search}?query=${encodedQuery}`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId); // Xóa timeout nếu request hoàn thành
        
        // Kiểm tra xem response có phải là JSON không
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Phản hồi không phải là JSON:', text);
            throw new Error('Phản hồi từ server không đúng định dạng JSON');
        }

        const data = await response.json();

        // Lưu danh sách video vào localStorage cùng với query
        const dataToCache = {
            query: query,
            videos: data.videos
        };
        localStorage.removeItem('videoList');
        localStorage.setItem('videoList', JSON.stringify(dataToCache));
        
        if (!response.ok) {
            const errorMessage = data.error || `Lỗi từ server: ${response.status}`;
            console.error('Lỗi từ API:', errorMessage);
            throw new Error(errorMessage);
        }
        
        if (!data.videos || data.videos.length === 0) {
            console.log('Không tìm thấy video nào với từ khóa:', query);
            showError(`Không tìm thấy video nào với từ khóa "${query}"`);
            return;
        }
        
        // Lấy ID của tất cả video để lấy thông tin chi tiết
        const videoIds = data.videos.map(video => {
            // Trích xuất videoId từ URL
            try {
                const url = new URL(video.video_url);
                return url.searchParams.get('v');
            } catch (e) {
                console.error('Lỗi khi trích xuất video ID từ URL:', video.video_url, e);
                return null;
            }
        }).filter(id => id); // Lọc ra các giá trị null/undefined
        
        console.log(`Tìm thấy ${videoIds.length} video`);
        
        // Nếu có video ID, lấy thông tin chi tiết
        if (videoIds.length > 0) {
            await getVideoDetailsAndDisplay(videoIds, data.videos);
        } else {
            // Nếu không có ID nào, hiển thị thông tin cơ bản
            displayVideos(data.videos);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('Yêu cầu tìm kiếm đã hết thời gian chờ');
            showError('Yêu cầu tìm kiếm mất quá nhiều thời gian, vui lòng thử lại');
        } else {
            console.error('Lỗi khi tìm kiếm:', error);
        }
    } finally {
        hideLoadingState();
    }
}

// Hàm lấy thông tin chi tiết và hiển thị
async function getVideoDetailsAndDisplay(videoIds, basicVideos) {
    try {
        console.log('Đang gọi API chi tiết:', `${API_ENDPOINTS.videoDetails}?ids=${videoIds.join(',')}`);
        
        const dataLocal = localStorage.getItem("videoList");
        if (dataLocal) {
            const data = JSON.parse(dataLocal);
            // Kết hợp thông tin cơ bản với thông tin chi tiết
            const enrichedVideos = basicVideos.map(basicVideo => {
                const matchingVideo = data.videos.find(video => video.video_url === basicVideo.video_url);
                return matchingVideo ? { ...basicVideo, ...matchingVideo } : basicVideo;
            });
            displayVideos(enrichedVideos);
            return;
        }

        const response = await fetch(`${API_ENDPOINTS.videoDetails}?ids=${videoIds.join(',')}`);
        
        // Kiểm tra xem response có phải là JSON không
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Phản hồi chi tiết không phải là JSON:', text);
            // Hiển thị thông tin cơ bản nếu không lấy được chi tiết
            displayVideos(basicVideos);
            return;
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Lỗi khi lấy thông tin chi tiết video');
        }
        
        // Kết hợp thông tin cơ bản với thông tin chi tiết
        const enrichedVideos = basicVideos.map(basicVideo => {
            // Trích xuất videoId từ URL
            try {
                const url = new URL(basicVideo.video_url);
                const videoId = url.searchParams.get('v');
                
                // Tìm thông tin chi tiết tương ứng
                const details = data.videoDetails.find(detail => detail.id === videoId);
                
                if (details) {
                    return {
                        ...basicVideo,
                        viewCount: details.viewCount || 'N/A',
                        duration: formatDuration(details.duration) || 'N/A',
                        publishedAt: details.publishedAt || 'N/A'
                    };
                }
            } catch (e) {
                console.error('Lỗi khi trích xuất dữ liệu chi tiết:', e);
            }
            
            return basicVideo;
        });
        
        // Hiển thị video với thông tin đầy đủ
        displayVideos(enrichedVideos);
    } catch (error) {
        console.error('Lỗi khi lấy thông tin chi tiết:', error);
        // Nếu không lấy được thông tin chi tiết, hiển thị thông tin cơ bản
        displayVideos(basicVideos);
    }
}

// Hàm format thời lượng từ ISO 8601 sang phút:giây
function formatDuration(duration) {
    if (!duration || duration === 'N/A') return 'N/A';
    
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 'N/A';
    
    const hours = (match[1] ? parseInt(match[1].replace('H', '')) : 0);
    const minutes = (match[2] ? parseInt(match[2].replace('M', '')) : 0);
    const seconds = (match[3] ? parseInt(match[3].replace('S', '')) : 0);
    
    return hours > 0
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        : `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Hàm format số lượt xem
function formatViewCount(views) {
    if (!views || views === 'N/A') return 'N/A';
    
    views = parseInt(views);
    if (isNaN(views)) return 'N/A';
    
    if (views >= 1000000) return `${Math.floor(views / 1000000)}M views`;
    if (views >= 1000) return `${Math.floor(views / 1000)}K views`;
    return `${views} views`;
}

function formatPublishedTime(publishedAt) {
    if (!publishedAt || publishedAt === 'N/A') return '';

    const publishedDate = new Date(publishedAt);
    if (isNaN(publishedDate.getTime())) return '';

    const now = new Date();
    const diffInSeconds = Math.floor((now - publishedDate) / 1000);

    if (diffInSeconds < 60) {
        return `${diffInSeconds} seconds ago`;
    } else if (diffInSeconds < 3600) {
        return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    } else if (diffInSeconds < 86400) {
        return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    } else if (diffInSeconds < 2592000) {
        return `${Math.floor(diffInSeconds / 86400)} days ago`;
    } else if (diffInSeconds < 31536000) {
        return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    } else {
        return `${Math.floor(diffInSeconds / 31536000)} years ago`;
    }
}


function displayVideos(videos) {
    console.log('Hiển thị video:', videos);
    // Tìm container để hiển thị video
    const listContainer = document.querySelector('.list-container') || document.querySelector('.video-grid');
    if (!listContainer) {
        // console.error('Không tìm thấy container để hiển thị video. Vui lòng thêm class .list-container hoặc .video-grid.');
        return;
    }
    
    // Xóa nội dung cũ
    listContainer.innerHTML = '';
    
    // Hiển thị danh sách video
    videos.forEach(video => {
        // Tạo phần tử video mới
        const videoItem = document.createElement('div');
        videoItem.className = 'video-preview';
        
        // Lấy thời gian đăng video
        const timeText = formatPublishedTime(video.published_at);
        
        // Chuẩn bị thông tin lượt xem
        const viewCount = formatViewCount(video.viewCount || 'N/A');
        
        // Trích xuất video ID từ video.video_url
        const videoId = extractVideoId(video.video_url);
        
        // Tạo URL chuyển hướng đến trang play-video.html với tham số videoid
        const playVideoUrl = `play-video.html?videoid=${videoId}`;
        
        videoItem.innerHTML = `
        <div class="thumbnail-row">
            <a href="${playVideoUrl}" id="video-link">
                <img class="thumbnail" src="${video.thumbnail}" alt="${video.title}">
                <div class="video-time">
                    ${video.duration || 'N/A'}
                </div>
            </a>
        </div>
        <div class="video-info-grid">
            <div class="channel-picture">
                <img class="profile-picture" src="${video.channel_avatar || '/api/placeholder/48/48'}" alt="${video.channel}">
            </div>
            <div class="video-info">
                <p class="video-title">
                    <a href="${playVideoUrl}">${video.title}</a>
                </p>
                <p class="video-author">
                    ${video.channel}
                </p>
                <p class="video-stats">
                    ${viewCount} &#183; ${timeText}
                </p>
            </div>
        </div>
        `;
        // Thêm video vào container
        listContainer.appendChild(videoItem);
    });
}

// Hàm trích xuất video ID từ URL YouTube
function extractVideoId(url) {
    if (!url) return '';
    
    try {
        // Trường hợp URL đầy đủ (youtube.com/watch?v=...)
        if (url.includes('youtube.com/watch')) {
            const urlObj = new URL(url);
            return urlObj.searchParams.get('v') || '';
        }
        
        // Trường hợp URL rút gọn (youtu.be/...)
        if (url.includes('youtu.be/')) {
            const parts = url.split('youtu.be/');
            if (parts.length > 1) {
                return parts[1].split('?')[0].split('&')[0];
            }
        }
        
        // Trường hợp url đã là ID (11 ký tự)
        if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
            return url;
        }
        
        // Trường hợp URL có dạng youtube.com/embed/...
        if (url.includes('/embed/')) {
            const parts = url.split('/embed/');
            if (parts.length > 1) {
                return parts[1].split('?')[0].split('&')[0];
            }
        }
    } catch (error) {
        console.error('Lỗi khi trích xuất videoId:', error);
    }
    
    return '';
}

// Hiển thị trạng thái đang tải
function showLoadingState() {
    const listContainer = document.querySelector('.list-container') || document.querySelector('.video-grid');
    if (listContainer) {
        listContainer.innerHTML = '<div class="loading">Đang tải video...</div>';
    }
}

// Ẩn trạng thái đang tải
function hideLoadingState() {
    const loadingElement = document.querySelector('.loading');
    if (loadingElement) {
        loadingElement.remove();
    }
}

// Hiển thị thông báo lỗi
function showError(message) {
    const listContainer = document.querySelector('.list-container') || document.querySelector('.video-grid');
    if (listContainer) {
        listContainer.innerHTML = `<div class="error-message">${message}</div>`;
    }
}

searchButton.addEventListener('click', function() {
    const query = searchInput.value.trim();
    if (query) {
        history.pushState(null, '', `index.html?search=${encodeURIComponent(query)}`);
        searchVideos(query); // Gọi hàm tìm kiếm mà không tải lại trang
    }
});

document.getElementById("video-link").addEventListener("click", async function(event) {
    event.preventDefault();
    // Kiểm tra trạng thái đăng nhập (ví dụ: lưu token trong sessionStorage)
    let isLoggedIn = await getAccessToken();
    console.log("Trạng thái đăng nhập:", isLoggedIn);

    if (isLoggedIn === null || isLoggedIn === undefined) {
        alert("Bạn cần đăng nhập để xem video!");
        window.location.href = `http://localhost:5000/auth/google?prompt=select_account&state=${state}`;
    } else {
        // Nếu đã đăng nhập, chuyển đến link video
        window.location.href = this.href;
    }
});