# -*- coding: utf-8 -*-
"""
Orbit App Backend for PythonAnywhere (Flask + WSGI + SQLite/JSON)
This file provides a complete Python backend matching the Orbit Node/Express REST API endpoints.
"""

import os
import sys
import json
import time
import uuid
import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import jwt

app = Flask(__name__, static_folder='dist')
CORS(app)

SECRET_KEY = os.environ.get('JWT_SECRET', 'orbit_super_secret_jwt_key_2026')
DATA_DIR = Path(__file__).parent / 'data'
UPLOADS_DIR = Path(__file__).parent / 'uploads'

DATA_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)

DB_FILE = DATA_DIR / 'orbit_db.json'

def load_db():
    if not DB_FILE.exists():
        default_db = {
            "users": [
                {
                    "id": "u_admin",
                    "username": "alex_orbit",
                    "handle": "alex_orbit",
                    "passwordHash": "admin123",
                    "role": "admin",
                    "avatarColor": "from-sky-400 to-indigo-500",
                    "initials": "AO",
                    "bio": "Основатель Orbit",
                    "phone": "+7 999 111 2233",
                    "isVerified": True,
                    "createdAt": int(time.time() * 1000)
                },
                {
                    "id": "u_support",
                    "username": "Support Orbit",
                    "handle": "orbit_support",
                    "passwordHash": "support123",
                    "role": "user",
                    "avatarColor": "from-emerald-400 to-teal-500",
                    "initials": "SO",
                    "bio": "Служба поддержки",
                    "phone": "+7 900 000 0000",
                    "isVerified": True,
                    "createdAt": int(time.time() * 1000)
                }
            ],
            "messages": {},
            "stories": [],
            "news": [],
            "blocked": {}
        }
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(default_db, f, ensure_ascii=False, indent=2)
        return default_db
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {"users": [], "messages": {}, "stories": [], "news": [], "blocked": {}}

def save_db(db_data):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(db_data, f, ensure_ascii=False, indent=2)

def get_auth_user():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        db = load_db()
        for u in db.get('users', []):
            if u['id'] == payload.get('userId'):
                return u
    except Exception:
        return None
    return None

# --- API ENDPOINTS ---

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'platform': 'PythonAnywhere WSGI', 'time': datetime.datetime.utcnow().isoformat()})

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    handle = data.get('handle', '').strip().lstrip('@') or username.lower()
    
    if not username or not password:
        return jsonify({'error': 'Имя пользователя и пароль обязательны'}), 400

    db_data = load_db()
    for u in db_data['users']:
        if u['username'].lower() == username.lower() or u['handle'].lower() == handle.lower():
            return jsonify({'error': 'Пользователь с таким именем или хэндлом уже существует'}), 400

    new_user = {
        'id': 'u_' + uuid.uuid4().hex[:10],
        'username': username,
        'handle': handle,
        'passwordHash': password,
        'role': 'user',
        'avatarColor': 'from-sky-400 to-indigo-500',
        'initials': (username[:2] if len(username) >= 2 else username).upper(),
        'phone': data.get('phone', ''),
        'bio': '',
        'createdAt': int(time.time() * 1000)
    }

    db_data['users'].append(new_user)
    save_db(db_data)

    token = jwt.encode({'userId': new_user['id']}, SECRET_KEY, algorithm='HS256')
    return jsonify({'token': token, 'user': new_user})

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    login_id = data.get('login', '').strip()
    password = data.get('password', '')

    db_data = load_db()
    user = None
    for u in db_data['users']:
        if (u['username'].lower() == login_id.lower() or u['handle'].lower() == login_id.lower().lstrip('@') or u.get('phone') == login_id) and u['passwordHash'] == password:
            user = u
            break

    if not user:
        return jsonify({'error': 'Неверный логин или пароль'}), 401

    token = jwt.encode({'userId': user['id']}, SECRET_KEY, algorithm='HS256')
    return jsonify({'token': token, 'user': user})

@app.route('/api/auth/me', methods=['GET'])
def me():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Не авторизован'}), 401
    return jsonify({'user': user})

@app.route('/api/contacts', methods=['GET'])
def contacts():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Не авторизован'}), 401

    db_data = load_db()
    result = []
    for u in db_data['users']:
        if u['id'] != user['id']:
            chat_key = f"{min(user['id'], u['id'])}_{max(user['id'], u['id'])}"
            msgs = db_data.get('messages', {}).get(chat_key, [])
            last_text = msgs[-1].get('text', 'Нажмите, чтобы начать чат') if msgs else 'Нажмите, чтобы начать чат'
            last_time = datetime.datetime.fromtimestamp(msgs[-1]['timestamp']/1000).strftime('%H:%M') if msgs else ''
            
            result.append({
                'id': u['id'],
                'name': u['username'],
                'initials': u.get('initials', 'UR'),
                'color': u.get('avatarColor', 'from-sky-400 to-indigo-500'),
                'avatarUrl': u.get('avatarUrl'),
                'handle': u['handle'],
                'phone': u.get('phone', ''),
                'last': last_text,
                'time': last_time,
                'unread': 0,
                'isOnline': True
            })
    return jsonify(result)

@app.route('/api/messages/<contact_id>', methods=['GET'])
def get_messages(contact_id):
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Не авторизован'}), 401

    db_data = load_db()
    chat_key = f"{min(user['id'], contact_id)}_{max(user['id'], contact_id)}"
    msgs = db_data.get('messages', {}).get(chat_key, [])
    return jsonify({'messages': msgs, 'has_more': False})

@app.route('/api/messages/<contact_id>', methods=['POST'])
def send_message(contact_id):
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Не авторизован'}), 401

    data = request.get_json() or {}
    db_data = load_db()
    chat_key = f"{min(user['id'], contact_id)}_{max(user['id'], contact_id)}"
    
    if chat_key not in db_data['messages']:
        db_data['messages'][chat_key] = []

    msg = {
        'id': 'm_' + uuid.uuid4().hex[:10],
        'from': 'me',
        'senderId': user['id'],
        'text': data.get('text', ''),
        'timestamp': int(time.time() * 1000),
        'mediaUrl': data.get('mediaUrl'),
        'mediaType': data.get('mediaType'),
        'pending': False
    }

    db_data['messages'][chat_key].append(msg)
    save_db(db_data)
    return jsonify(msg)

@app.route('/api/stories', methods=['GET'])
def get_stories():
    db_data = load_db()
    return jsonify(db_data.get('stories', []))

@app.route('/api/stories', methods=['POST'])
def create_story():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Не авторизован'}), 401

    data = request.get_json() or {}
    db_data = load_db()
    
    media_url = data.get('mediaUrl', '')
    slides = data.get('slides', [media_url])
    
    new_story = {
        'id': 'story_' + uuid.uuid4().hex[:10],
        'userId': user['id'],
        'userName': user['username'],
        'userAvatar': user.get('avatarUrl'),
        'mediaUrl': media_url,
        'caption': data.get('caption', ''),
        'timestamp': int(time.time() * 1000),
        'slides': slides,
        'reactions': [],
        'comments': [],
        'audience': data.get('audience', 'everyone')
    }

    db_data['stories'].insert(0, new_story)
    save_db(db_data)
    return jsonify(new_story)

@app.route('/api/news', methods=['GET'])
def get_news():
    db_data = load_db()
    return jsonify(db_data.get('news', []))

@app.route('/api/news', methods=['POST'])
def create_news():
    user = get_auth_user()
    if not user:
        return jsonify({'error': 'Не авторизован'}), 401

    data = request.get_json() or {}
    db_data = load_db()

    new_post = {
        'id': 'news_' + uuid.uuid4().hex[:10],
        'title': data.get('title', 'Новый пост'),
        'content': data.get('content', ''),
        'mediaUrl': data.get('mediaUrl'),
        'mediaType': data.get('mediaType', 'image'),
        'tag': data.get('tag', 'Новости'),
        'timestamp': datetime.datetime.utcnow().isoformat(),
        'accent': data.get('accent', 'blue'),
        'authorName': user['username'],
        'authorAvatar': user.get('avatarUrl'),
        'likesCount': 0,
        'userLiked': False,
        'commentsCount': 0,
        'comments': []
    }

    db_data['news'].insert(0, new_post)
    save_db(db_data)
    return jsonify(new_post)

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOADS_DIR, filename)

# Serve SPA static files
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    dist_dir = Path(__file__).parent / 'dist'
    if path != "" and (dist_dir / path).exists():
        return send_from_directory(dist_dir, path)
    else:
        return send_from_directory(dist_dir, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port, debug=True)
