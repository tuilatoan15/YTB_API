import os
import requests
import isodate
import yt_dlp
import re
import time
import threading

from urllib.parse import urlencode
from flask import Flask, request, session, jsonify, make_response, redirect, Request
from flask_cors import CORS, cross_origin
from dotenv import load_dotenv
from flask_session import Session

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from urllib.parse import quote_plus

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "default_secret_key")  # Lấy từ .env file

# Cấu hình CORS - đảm bảo bao gồm cả origins localhost và 127.0.0.1
CORS(app, supports_credentials=True, origins=["http://127.0.0.1:5500", "http://localhost:5500"])

# Cấu hình session cookie
app.config["SESSION_COOKIE_NAME"] = "my_session_cookie"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = None  # Sử dụng None (Python) không phải "None" (string)
app.config["SESSION_COOKIE_SECURE"] = False  # Đặt thành True trong môi trường sản xuất
app.config["SESSION_COOKIE_DOMAIN"] = None  # Cho phép cookie hoạt động trên localhost
app.config["SESSION_TYPE"] = "filesystem" 
app.config["SECRET_KEY"] = "supersecretkey"

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")
API_KEY = os.getenv("API_KEY")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USER_INFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# API_KEY = "AIzaSyDpr5ShfyPFeeTxPWJ7rXMGHdGrjHRL_DM"
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
YOUTUBE_VIDEO_DETAILS_URL = "https://www.googleapis.com/youtube/v3/videos"
YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
YOUTUBE_CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"
YOUTUBE_COMMENTS_URL = "https://www.googleapis.com/youtube/v3/commentThreads"
YOUTUBE_SUBSCRIBE_URL = "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet"
YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/videos/rate"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/youtube.force-ssl"
]

CREDENTIALS_FILE = "client_secret.json"

# @app.route("/auth/google")
# @cross_origin(supports_credentials=True, origins=["http://127.0.0.1:5500", "http://localhost:5500"])
# def auth_google():
#     auth_url = (
#         f"{GOOGLE_AUTH_URL}?response_type=code"
#         f"&client_id={GOOGLE_CLIENT_ID}"
#         f"&redirect_uri={GOOGLE_REDIRECT_URI}"
#         f"&scope={SCOPES}"
#     )

#     return redirect(auth_url)

@app.route("/auth/google")
@cross_origin(supports_credentials=True, origins=["http://127.0.0.1:5500", "http://localhost:5500"])
def auth_google():
    # Chuyển đổi danh sách SCOPES thành chuỗi và mã hóa URL
    scope = " ".join(SCOPES)  # Nối các phạm vi với dấu cách
    encoded_scope = quote_plus(scope)  # Mã hóa các phạm vi để sử dụng trong URL

    auth_url = (
        f"{GOOGLE_AUTH_URL}?response_type=code"
        f"&client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        f"&scope={encoded_scope}"
    )

    return redirect(auth_url)
    

@app.route("/auth/callback")
def auth_callback():
    code = request.args.get("code")
    if not code:
        return jsonify({"error": "Không tìm thấy mã xác thực!"}), 400

    token_data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    try:
        response = requests.post(GOOGLE_TOKEN_URL, data=token_data)
        token_info = response.json()

        if "access_token" not in token_info:
            return jsonify({"error": "Không lấy được access_token!", "details": token_info}), 400

        access_token = token_info["access_token"]

        headers = {"Authorization": f"Bearer {access_token}"}
        user_data = requests.get(GOOGLE_USER_INFO_URL, headers=headers).json()

        if user_data.get("error"):
            return jsonify({"error": "Không thể lấy thông tin người dùng từ Google!", "details": user_data}), 400

        # Lưu thông tin vào session
        session["user"] = user_data
        session["access_token"] = access_token
        session.modified = True

        # Tạo response với cookie đúng cách
        redirect_url = "http://localhost:5500/index.html"
        response = make_response(redirect(redirect_url))

        # Lưu access_token vào cookie HTTP-Only (chống XSS)
        response.set_cookie(
            "access_token",
            access_token,
            httponly=True,   # Bảo mật: JavaScript không đọc được
            secure=False,    # Chạy trên HTTP, đổi thành True nếu dùng HTTPS
            samesite="Lax"   # Cho phép gửi cookie khi điều hướng trang
        )

        return response

    except Exception as e:
        app.logger.error(f"Error in auth callback: {str(e)}")
        return jsonify({"error": "Lỗi xử lý xác thực", "details": str(e)}), 500


@app.route("/auth/user", methods=["GET", "OPTIONS"])
@cross_origin(supports_credentials=True, origins=["http://127.0.0.1:5500", "http://localhost:5500"])
def get_user():
    # Xử lý OPTIONS request cho preflight
    if request.method == "OPTIONS":
        return "", 200
        
    try:
        app.logger.info(f"Session content: {session}")
        app.logger.info(f"Cookies: {request.cookies}")
        user = session.get("user")
        access_token = session.get("access_token")

        if user:
            return jsonify(user)

        if access_token:
            headers = {"Authorization": f"Bearer {access_token}"}
            user_data = requests.get(GOOGLE_USER_INFO_URL, headers=headers).json()
            if user_data and "email" in user_data:
                session["user"] = user_data
                return jsonify(user_data)

        return jsonify({"error": "Chưa đăng nhập"}), 401
    except Exception as e:
        app.logger.error(f"Error in get_user: {str(e)}")
        return jsonify({"error": "Lỗi server", "details": str(e)}), 500

@app.after_request
def add_cors_headers(response):
    # Thêm header CORS cho tất cả các response
    origin = request.headers.get('Origin')
    if origin in ["http://127.0.0.1:5500", "http://localhost:5500"]:
        response.headers['Access-Control-Allow-Origin'] = origin
    else:
        response.headers['Access-Control-Allow-Origin'] = "http://localhost:5500"
        
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Vary'] = 'Origin'  # Rất quan trọng cho các origins khác nhau
    
    return response

# Thêm bộ xử lý lỗi 500
@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f"Internal server error: {error}")
    return jsonify({"error": "Lỗi server nội bộ", "details": str(error)}), 500

#------------------------------------------------------------------------------Search--------------------------------------------------------------------------------------

@app.route('/search', methods=['GET'])
def search_videos():
    query = request.args.get('query', '')
    if not query:
        return jsonify({"error": "Chưa có từ khóa tìm kiếm"}), 400

    params = {
        'part': 'snippet',
        'q': query,
        'key': API_KEY,
        'maxResults': 12 # Số lượng kết quả tối đa
    }

    try:
        # Gửi yêu cầu tìm kiếm video
        response = requests.get(YOUTUBE_SEARCH_URL, params=params)

        if response.status_code != 200:
            return jsonify({"error": f"Lỗi API YouTube, mã: {response.status_code}"}), 500

        data = response.json()
        if 'items' not in data or len(data['items']) == 0:
            return jsonify({"error": "Không tìm thấy video nào"}), 404

        videos = []
        for item in data.get('items', []):
            video_id = item.get('id', {}).get('videoId')
            if not video_id:
                continue  # Bỏ qua nếu không có videoId

            channel_id = item['snippet']['channelId']
            video_info = {
                'title': item['snippet']['title'],
                'channel': item['snippet']['channelTitle'],
                'thumbnail': item['snippet']['thumbnails']['medium']['url'],
                'video_url': f"https://www.youtube.com/watch?v={video_id}",
                'published_at': item['snippet']['publishedAt'],  # Thêm ngày public
            }

            # 🟢 Gửi yêu cầu lấy lượt thích & số lượt xem
            video_params = {
                'part': 'statistics,contentDetails',
                'id': video_id,
                'key': API_KEY
            }
            video_response = requests.get('https://www.googleapis.com/youtube/v3/videos', params=video_params)
            if video_response.status_code == 200:
                video_data = video_response.json()
                if 'items' in video_data and len(video_data['items']) > 0:
                    stats = video_data['items'][0]['statistics']
                    video_info['viewCount'] = stats.get('viewCount', '0')
                    video_info['likeCount'] = stats.get('likeCount', '0')

                    # 🟢 Lấy thời lượng video
                    duration = video_data['items'][0]['contentDetails']['duration']
                    video_info['duration'] = parse_duration(duration)

            # 🟢 Gửi yêu cầu lấy avatar & số người đăng ký
            channel_params = {
                'part': 'snippet,statistics',
                'id': channel_id,
                'key': API_KEY
            }
            channel_response = requests.get('https://www.googleapis.com/youtube/v3/channels', params=channel_params)
            if channel_response.status_code == 200:
                channel_data = channel_response.json()
                if 'items' in channel_data and len(channel_data['items']) > 0:
                    channel_info = channel_data['items'][0]
                    video_info['channel_avatar'] = channel_info['snippet']['thumbnails']['default']['url']
                    video_info['subscriberCount'] = channel_info['statistics'].get('subscriberCount', '0')

            videos.append(video_info)

        return jsonify({'videos': videos})

    except Exception as e:
        return jsonify({"error": "Đã có lỗi xảy ra", "details": str(e)}), 500

# 🟢 Hàm chuyển đổi thời lượng từ ISO8601 sang định dạng "mm:ss"
def parse_duration(duration):
    try:
        parsed_duration = isodate.parse_duration(duration)
        minutes = parsed_duration.total_seconds() // 60
        seconds = int(parsed_duration.total_seconds() % 60)
        return f"{int(minutes)}:{seconds:02d}"
    except Exception:
        return "0:00"

@app.route('/api/videos/details', methods=['GET'])
def get_video_details():
    video_ids = request.args.get('ids', '')
    if not video_ids:
        return jsonify({"error": "Thiếu tham số ids"}), 400

    video_ids = video_ids.split(',')

    params = {
        'part': 'snippet,contentDetails,statistics',
        'id': ','.join(video_ids),
        'key': API_KEY
    }

    try:
        response = requests.get(YOUTUBE_VIDEO_DETAILS_URL, params=params)
        if response.status_code != 200:
            return jsonify({"error": f"Lỗi từ API YouTube, mã lỗi: {response.status_code}"}), 500

        data = response.json()
        if 'error' in data:
            return jsonify({"error": data['error']}), 500

        video_details = []
        channel_ids = set()

        # Trích xuất thông tin video + ID kênh để lấy thêm avatar & số subs
        for item in data.get('items', []):
            channel_id = item['snippet']['channelId']
            channel_ids.add(channel_id)

            video_info = {
                'id': item['id'],
                'title': item['snippet']['title'],
                'channelTitle': item['snippet']['channelTitle'],
                'description': item['snippet']['description'],
                'channelId': channel_id,  # Lưu lại để lấy thông tin kênh
                'publishedAt': item['snippet']['publishedAt'],
                'viewCount': item['statistics'].get('viewCount', 'N/A'),
                'likeCount': item['statistics'].get('likeCount', 'N/A'),
                'duration': item['contentDetails'].get('duration', 'N/A'),
                'thumbnail': item['snippet']['thumbnails']['medium']['url']
            }
            video_details.append(video_info)

        # Nếu có danh sách ID kênh, tiếp tục gọi API để lấy avatar & subscriberCount
        if channel_ids:
            channel_params = {
                'part': 'snippet,statistics',
                'id': ','.join(channel_ids),
                'key': API_KEY
            }
            channel_response = requests.get(YOUTUBE_CHANNELS_URL, params=channel_params)
            if channel_response.status_code == 200:
                channel_data = channel_response.json()
                channel_info_map = {c['id']: c for c in channel_data.get('items', [])}

                # Gán thêm thông tin vào danh sách video
                for video in video_details:
                    channel_info = channel_info_map.get(video['channelId'])
                    if channel_info:
                        video['channel_avatar'] = channel_info['snippet']['thumbnails']['default']['url']
                        video['subscriberCount'] = channel_info['statistics'].get('subscriberCount', 'N/A')

        return jsonify({'videoDetails': video_details})

    except Exception as e:
        return jsonify({"error": "Đã có lỗi xảy ra", "details": str(e)}), 500

#------------------------------------------------------------------get Comments---------------------------------------------------------------------------------------------

@app.route('/api/comments', methods=['GET'])
def get_comments():
    # Lấy video ID từ query parameter
    video_id = request.args.get('videoId')
    if not video_id:
        return jsonify({"error": "Thiếu tham số videoId"}), 400

    try:
        # Tham số cho API
        params = {
            'part': 'snippet,replies',
            'videoId': video_id,
            'key': API_KEY,
            'maxResults': 100  # Chỉ lấy 10 comments
        }

        # Gửi request đến YouTube API
        response = requests.get(YOUTUBE_COMMENTS_URL, params=params)
        if response.status_code != 200:
            return jsonify({"error": "Lỗi khi gọi YouTube API", "details": response.json()}), 500

        data = response.json()

        # Duyệt qua từng comment
        comments = []
        for item in data.get('items', []):
            comment = item['snippet']['topLevelComment']['snippet']
            comment_info = {
                'id': item['id'],
                'author': comment['authorDisplayName'],
                'author_avatar': comment['authorProfileImageUrl'],
                'text': comment['textDisplay'],
                'like_count': comment['likeCount'],
                'published_at': comment['publishedAt'],
                'replies': []
            }

            # Nếu có replies, lấy thông tin replies
            if 'replies' in item:
                for reply in item['replies']['comments']:
                    reply_snippet = reply['snippet']
                    reply_info = {
                        'id': reply['id'],
                        'author': reply_snippet['authorDisplayName'],
                        'author_avatar': reply_snippet['authorProfileImageUrl'],
                        'text': reply_snippet['textDisplay'],
                        'like_count': reply_snippet['likeCount'],
                        'published_at': reply_snippet['publishedAt']
                    }
                    comment_info['replies'].append(reply_info)

            comments.append(comment_info)

        return jsonify({'comments': comments})

    except Exception as e:
        return jsonify({"error": "Đã có lỗi xảy ra", "details": str(e)}), 500
    
@app.route("/auth/logout", methods=["POST"])
@cross_origin(supports_credentials=True)  # Cho phép gửi cookie
def logout():
    session.clear()  # Xóa toàn bộ session của người dùng
    response = jsonify({"message": "Đăng xuất thành công"})
    
    # Xóa access_token trong cookie
    response.set_cookie("access_token", "", expires=0, httponly=True, secure=False, samesite="None")

    return response, 200


#-----------------------------------------------------------------------Log out-------------------------------------------------------------------------------------------------
@app.route("/subscribe", methods=["POST"])
@cross_origin(supports_credentials=True, origins=["http://127.0.0.1:5500", "http://localhost:5500"])
def subscribe():
    try:
        data = request.json
        access_token = data.get("access_token")
        channel_id = data.get("channel_id")

        if not access_token or not channel_id:
            return jsonify({"error": "Thiếu access_token hoặc channel_id"}), 400

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

        body = {
            "snippet": {
                "resourceId": {
                    "kind": "youtube#channel",
                    "channelId": channel_id
                }
            }
        }

        response = requests.post(YOUTUBE_SUBSCRIBE_URL, json=body, headers=headers)

        # Kiểm tra phản hồi từ API YouTube
        if response.status_code == 200:
            return jsonify({"message": "Đăng ký kênh thành công!", "data": response.json()}), 200
        else:
            return jsonify({
                "error": "Lỗi API YouTube",
                "details": response.json(),
                "status_code": response.status_code
            }), response.status_code

    except Exception as e:
        return jsonify({"error": "Lỗi server", "details": str(e)}), 500

@app.route("/get-access-token")
@cross_origin(supports_credentials=True, origins=["http://127.0.0.1:5500", "http://localhost:5500"])
def get_access_token():
    access_token = request.cookies.get("access_token")
    if not access_token:
        return jsonify({"error": "Chưa đăng nhập"}), 401
    return jsonify({"access_token": access_token})
#---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
@app.route("/auth/status")
@cross_origin(supports_credentials=True, origins=["http://127.0.0.1:5500", "http://localhost:5500"])
def auth_status():
    access_token = request.cookies.get("access_token")

    if not access_token:
        return jsonify({"logged_in": False, "message": "Chưa đăng nhập"}), 401

    # Gửi request kiểm tra token với Google
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(GOOGLE_USER_INFO_URL, headers=headers)
    
    if response.status_code != 200:
        return jsonify({"logged_in": False, "message": "Access token không hợp lệ"}), 401

    user_data = response.json()
    return jsonify({"logged_in": True, "user": user_data})

@app.route("/login")
def login():
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),  # Đảm bảo quyền youtube.force-ssl có trong scope
        "access_type": "offline",
        "prompt": "consent"
    }
    return redirect(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")

#---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
def get_youtube_service(access_token):
    """Tạo service YouTube API với access_token từ OAuth2"""
    credentials = Credentials(
        token=access_token,  # Sử dụng đúng access_token truyền vào
        token_uri=GOOGLE_TOKEN_URL,
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET
    )
    return build("youtube", "v3", credentials=credentials)

def get_subscribed_channels(youtube):
    """Lấy danh sách 10 kênh YouTube mà user đã đăng ký"""
    try:
        request = youtube.subscriptions().list(
            part="snippet",
            mine=True,   # Yêu cầu quyền OAuth2 phù hợp
            maxResults=10
        )
        response = request.execute()

        channels = []
        if "items" in response:  # Kiểm tra tồn tại 'items'
            for item in response["items"]:
                channels.append({
                    "channel_id": item["snippet"]["resourceId"]["channelId"],
                    "channel_title": item["snippet"]["title"]
                })
        
        print("Channels:", channels)
        return channels
    except Exception as e:
        print(f"❌ Lỗi khi lấy danh sách kênh đã đăng ký: {e}")
        return []

@app.route("/my-latest-videos", methods=["GET"])
@cross_origin(supports_credentials=True, origins="*")
def my_latest_videos():
    print("Headers received:", request.headers)  # In headers ra terminal Flask
    auth_header = request.headers.get("Authorization")
    print("Received Authorization:", auth_header)

    access_token = session.get("access_token")
    print("Session Access Token:", access_token)

    if not access_token or auth_header != f"Bearer {access_token}":
        return jsonify({"error": "Chưa đăng nhập hoặc token không hợp lệ"}), 401

    youtube = get_youtube_service(access_token)
    channels = get_subscribed_channels(youtube)

    videos = []
    for channel in channels:
        video = get_latest_video(youtube, channel["channel_id"])
        if video:
            videos.append({
                "channel_title": channel["channel_title"],
                "video_title": video["video_title"],
                "video_id": video["video_id"],
                "published_at": video["published_at"],
                "thumbnail_url": video["thumbnail_url"]
            })

    return jsonify(videos)


def get_latest_video(youtube, channel_id):
    """Lấy video mới nhất từ một kênh YouTube"""
    try:
        request = youtube.search().list(
            part="snippet",
            channelId=channel_id,
            order="date",  # Sắp xếp theo ngày mới nhất
            type="video",
            maxResults=1
        )
        response = request.execute()

        if "items" in response and response["items"]:  # Kiểm tra danh sách rỗng
            video = response["items"][0]
            return {
                "video_id": video["id"]["videoId"],
                "video_title": video["snippet"]["title"],
                "published_at": video["snippet"]["publishedAt"],
                "thumbnail_url": video["snippet"]["thumbnails"]["high"]["url"]
            }
        else:
            return None
    except Exception as e:
        print(f"❌ Lỗi khi lấy video mới nhất của kênh {channel_id}: {e}")
        return None


#---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
@app.route("/rate_video", methods=["POST"])
def rate_video():
    try:
        # Nhận thông tin từ request
        access_token = request.json.get("access_token")
        video_id = request.json.get("video_id")
        rating = request.json.get("rating")  # "like", "dislike" hoặc "none"

        if not access_token or not video_id or not rating:
            return jsonify({"error": "Thiếu access_token, video_id hoặc rating"}), 400

        headers = {
            "Authorization": f"Bearer {access_token}"
        }

        params = {
            "id": video_id,
            "rating": rating  # "like", "dislike" hoặc "none"
        }

        response = requests.post(YOUTUBE_API_URL, headers=headers, params=params)

        if response.status_code == 204:
            return jsonify({"message": f"Đã cập nhật trạng thái video: {rating}"}), 200
        else:
            return jsonify({"error": "Lỗi API YouTube", "details": response.json()}), response.status_code

    except Exception as e:
        return jsonify({"error": "Lỗi server", "details": str(e)}), 500
    
@app.route("/debug-session")
def debug_session():
    return jsonify({"session_access_token": session.get("access_token")})

#---------------------------------------------------------------------------------------------------------------------------------------------------------------------------

download_status = {}

def get_unique_filename(download_folder, filename):
    """ Tạo tên file duy nhất nếu bị trùng """
    base, ext = os.path.splitext(filename)
    counter = 1
    new_filename = filename

    while os.path.exists(os.path.join(download_folder, new_filename)):
        new_filename = f"{base} ({counter}){ext}"
        counter += 1

    return new_filename

def download_video_task(video_id, video_url, download_folder):
    """ Tải video trong luồng riêng & cập nhật tiến trình """
    try:
        # Lấy thông tin tiêu đề video
        ydl_opts_info = {"quiet": True, "skip_download": True, "force_generic_extractor": True}
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            info = ydl.extract_info(video_url, download=False)
            video_title = re.sub(r'[<>:"/\\|?*]', '_', info['title'])

        filename = get_unique_filename(download_folder, f"{video_title}.mp4")
        video_path = os.path.join(download_folder, filename)

        def progress_hook(d):
            """ Cập nhật trạng thái tải """
            if d['status'] == 'downloading':
                percent = d['_percent_str']
                download_status[video_id] = f"Đang tải... {percent}"
            elif d['status'] == 'finished':
                download_status[video_id] = f"✅ Tải xong! Lưu tại {video_path}"
                percent = "0%";            

        ydl_opts = {
            'format': 'bestvideo+bestaudio/best',
            'merge_output_format': 'mp4',
            'outtmpl': video_path,
            'progress_hooks': [progress_hook]
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])

    except Exception as e:
        download_status[video_id] = f"⚠️ Lỗi tải video: {str(e)}"

@app.route('/download', methods=['POST'])
@cross_origin(supports_credentials=True)
def download_video():
    """ Nhận request tải video """
    data = request.json
    video_id = data.get('videoId')

    if not video_id:
        return jsonify({"message": "Video ID không hợp lệ!"}), 400

    video_url = f"https://www.youtube.com/watch?v={video_id}"
    download_folder = os.path.join(os.path.expanduser("~"), "Downloads")

    # Đặt trạng thái tải xuống
    download_status[video_id] = "🔄 Bắt đầu tải..."

    # Chạy tải video trong luồng riêng để không chặn API
    thread = threading.Thread(target=download_video_task, args=(video_id, video_url, download_folder))
    thread.start()

    return jsonify({"message": "🚀 Đã bắt đầu tải video!", "videoId": video_id})

@app.route('/download/status/<video_id>', methods=['GET'])
def check_download_status(video_id):
    """ Trả về tiến trình tải video """
    status = download_status.get(video_id, "Không tìm thấy video đang tải!")
    return jsonify({"status": status})

#---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True, port=5000)
    app.logger.info(f"Session content: {session}")
