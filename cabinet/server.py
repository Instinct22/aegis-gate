"""Сайт и кабинет на одном адресе.

Запуск из корня сайта: py -3 cabinet/server.py
Мастер: MASTER_BASE (по умолчанию http://127.0.0.1:8091).
Логин мастера читается из CONVERTER_ENV или переменных MASTER_ADMIN_USERNAME
и MASTER_ADMIN_PASSWORD.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.cookiejar import CookieJar
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from secrets import token_urlsafe

ROOT = Path(__file__).resolve().parent
SITE = ROOT.parent
PROVIDERS = {'telegram', 'google', 'yandex'}

_sessions: dict[str, int] = {}
_sessions_lock = threading.Lock()
_db_lock = threading.Lock()
_master_lock = threading.Lock()
_master: urllib.request.OpenerDirector | None = None
_oauth: dict[str, dict] = {}
_oauth_lock = threading.Lock()
AUTH_PATHS = {'/auth/google', '/auth/yandex', '/auth/telegram'}


def utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_env_file(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    found: dict[str, str] = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        found[key.strip()] = value.strip().strip('"').strip("'")
    return found


def load_local_env() -> None:
    for key, value in read_env_file(ROOT / '.env').items():
        os.environ.setdefault(key, value)


load_local_env()
HOST = os.environ.get('CABINET_HOST', '127.0.0.1')
PORT = int(os.environ.get('CABINET_PORT', '8766'))
MASTER_BASE = os.environ.get('MASTER_BASE', 'http://127.0.0.1:8091').rstrip('/')
DATA = Path(os.environ.get('CABINET_DATA', str(ROOT / 'data')))
DB_PATH = DATA / 'cabinet.db'


def master_credentials() -> tuple[str, str]:
    username = os.environ.get('MASTER_ADMIN_USERNAME', '').strip()
    password = os.environ.get('MASTER_ADMIN_PASSWORD', '').strip()
    if username and password:
        return username, password
    env_path = Path(os.environ.get('CONVERTER_ENV', r'E:\GitHub\converter\.env'))
    file_env = read_env_file(env_path)
    return file_env.get('ADMIN_USERNAME', ''), file_env.get('ADMIN_PASSWORD', '')


def connect() -> sqlite3.Connection:
    DATA.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            '''
            CREATE TABLE IF NOT EXISTS account (
                id INTEGER PRIMARY KEY,
                display_name TEXT NOT NULL,
                master_client_id INTEGER,
                sub_url TEXT NOT NULL DEFAULT '',
                sub_token TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS identity (
                provider TEXT NOT NULL,
                subject TEXT NOT NULL,
                account_id INTEGER NOT NULL REFERENCES account(id),
                PRIMARY KEY (provider, subject)
            );
            '''
        )


def master_opener() -> urllib.request.OpenerDirector:
    global _master
    with _master_lock:
        if _master is not None:
            return _master
        username, password = master_credentials()
        if not username or not password:
            raise RuntimeError('Нет логина мастера: задайте CONVERTER_ENV или MASTER_ADMIN_USERNAME')
        jar = CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        data = urllib.parse.urlencode({'username': username, 'password': password}).encode()
        request = urllib.request.Request(MASTER_BASE + '/login', data=data)
        try:
            opener.open(request, timeout=15).read()
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f'Мастер не пустил админа: {exc.code}') from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f'Мастер недоступен ({MASTER_BASE}): {exc.reason}') from exc
        _master = opener
        return opener


def master_json(method: str, path: str, body: dict | None = None) -> dict:
    opener = master_opener()
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(
        MASTER_BASE + path,
        data=data,
        method=method,
        headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
    )
    try:
        with opener.open(request, timeout=60) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors='replace')
        if exc.code == 401:
            global _master
            with _master_lock:
                _master = None
            raise RuntimeError('Мастер отклонил сессию администратора') from exc
        raise RuntimeError(f'Мастер ответил {exc.code}: {detail[:300]}') from exc


def ensure_master_client(conn: sqlite3.Connection, account_id: int) -> dict:
    row = conn.execute('SELECT * FROM account WHERE id = ?', (account_id,)).fetchone()
    if row is None:
        raise RuntimeError('Аккаунт кабинета не найден')
    payload = master_json(
        'POST',
        '/api/clients',
        {
            'name': row['display_name'] or f'Кабинет {account_id}',
            'days': 0,
            'limit_ip': 5,
            'note': 'кабинет',
            'cabinet_account_id': f'cab-{account_id}',
        },
    )
    client = payload['client']
    conn.execute(
        '''
        UPDATE account
        SET master_client_id = ?, sub_url = ?, sub_token = ?
        WHERE id = ?
        ''',
        (client['id'], client['sub_url'], client['sub_token'], account_id),
    )
    conn.commit()
    return payload


def account_view(conn: sqlite3.Connection, account_id: int, payload: dict | None = None) -> dict:
    row = conn.execute('SELECT * FROM account WHERE id = ?', (account_id,)).fetchone()
    identities = conn.execute(
        'SELECT provider, subject FROM identity WHERE account_id = ? ORDER BY provider',
        (account_id,),
    ).fetchall()
    return {
        'account_id': row['id'],
        'cabinet_account_id': f'cab-{row["id"]}',
        'display_name': row['display_name'],
        'master_client_id': row['master_client_id'],
        'sub_url': row['sub_url'],
        'sub_token': row['sub_token'],
        'identities': [
            {'provider': item['provider'], 'subject': item['subject']} for item in identities
        ],
        'created': None if payload is None else payload.get('created'),
    }


def login_identity(provider: str, subject: str, name: str) -> dict:
    with _db_lock:
        conn = connect()
        try:
            found = conn.execute(
                'SELECT account_id FROM identity WHERE provider = ? AND subject = ?',
                (provider, subject),
            ).fetchone()
            if found is None:
                cursor = conn.execute(
                    'INSERT INTO account (display_name, created_at) VALUES (?, ?)',
                    (name or f'{provider}:{subject}', utcnow()),
                )
                account_id = int(cursor.lastrowid)
                conn.execute(
                    'INSERT INTO identity (provider, subject, account_id) VALUES (?, ?, ?)',
                    (provider, subject, account_id),
                )
                conn.commit()
            else:
                account_id = int(found['account_id'])
            payload = ensure_master_client(conn, account_id)
            return account_view(conn, account_id, payload)
        finally:
            conn.close()


def link_identity(account_id: int, provider: str, subject: str) -> dict:
    with _db_lock:
        conn = connect()
        try:
            owner = conn.execute(
                'SELECT account_id FROM identity WHERE provider = ? AND subject = ?',
                (provider, subject),
            ).fetchone()
            if owner is not None and int(owner['account_id']) != account_id:
                raise ValueError('Этот способ входа уже привязан к другому кабинету')
            if owner is None:
                conn.execute(
                    'INSERT INTO identity (provider, subject, account_id) VALUES (?, ?, ?)',
                    (provider, subject, account_id),
                )
                conn.commit()
            return account_view(conn, account_id)
        finally:
            conn.close()


def current_account(token: str) -> dict | None:
    with _sessions_lock:
        account_id = _sessions.get(token)
    if account_id is None:
        return None
    with _db_lock:
        conn = connect()
        try:
            row = conn.execute('SELECT id FROM account WHERE id = ?', (account_id,)).fetchone()
            if row is None:
                return None
            return account_view(conn, account_id)
        finally:
            conn.close()


def parse_identity(body: dict, *, name_required: bool) -> tuple[str, str, str]:
    provider = str(body.get('provider') or '').strip()
    subject = str(body.get('subject') or '').strip()
    name = str(body.get('name') or '').strip()
    if provider not in PROVIDERS:
        raise ValueError('Способ входа: telegram, google или yandex')
    if not subject or len(subject) > 200:
        raise ValueError('Нужен постоянный id человека у провайдера')
    if name_required and not name:
        raise ValueError('Нужно имя для нового кабинета')
    return provider, subject, name[:80]


CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
}


def static_file(url_path: str) -> Path | None:
    raw = urllib.parse.unquote(url_path.split('?', 1)[0])
    if raw.startswith('/api/'):
        return None
    rel = raw.lstrip('/') or 'index.html'
    site = SITE.resolve()
    candidate = (site / rel).resolve()
    try:
        candidate.relative_to(site)
    except ValueError:
        return None
    if candidate.is_dir():
        candidate = candidate / 'index.html'
    if not candidate.is_file() and candidate.suffix == '':
        html = Path(str(candidate) + '.html')
        if html.is_file():
            candidate = html
    if not candidate.is_file() or candidate.suffix == '.py':
        return None
    data_dir = (site / 'cabinet' / 'data').resolve()
    if candidate == data_dir or data_dir in candidate.parents:
        return None
    return candidate


def cfg(name: str) -> str:
    return os.environ.get(name, '').strip()


def pkce_pair() -> tuple[str, str]:
    verifier = token_urlsafe(48)
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b'=').decode()
    return verifier, challenge


def form_post(url: str, fields: dict[str, str]) -> dict:
    data = urllib.parse.urlencode(fields).encode()
    request = urllib.request.Request(
        url,
        data=data,
        headers={'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json'},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors='replace')[:300]
        raise RuntimeError(f'Провайдер ответил {exc.code}: {detail}') from exc


def json_get(url: str, headers: dict[str, str]) -> dict:
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode())


def jwt_payload(token: str) -> dict:
    part = token.split('.')[1]
    padded = part + '=' * (-len(part) % 4)
    return json.loads(base64.urlsafe_b64decode(padded))


def provider_keys(provider: str) -> tuple[str, str]:
    if provider == 'google':
        return cfg('GOOGLE_CLIENT_ID'), cfg('GOOGLE_CLIENT_SECRET')
    if provider == 'yandex':
        return cfg('YANDEX_CLIENT_ID'), cfg('YANDEX_CLIENT_SECRET')
    return cfg('TELEGRAM_CLIENT_ID'), cfg('TELEGRAM_CLIENT_SECRET')


def begin_oauth(provider: str, redirect_uri: str, nonce: str) -> str:
    client_id, secret = provider_keys(provider)
    if not client_id or not secret:
        raise RuntimeError(f'Для {provider} не заданы ключи входа')
    state = token_urlsafe(24)
    verifier, challenge = pkce_pair()
    with _oauth_lock:
        now = time.time()
        expired = [key for key, item in _oauth.items() if now - item['at'] > 600]
        for key in expired:
            _oauth.pop(key, None)
        _oauth[state] = {
            'provider': provider,
            'verifier': verifier,
            'redirect': redirect_uri,
            'nonce': nonce,
            'at': now,
        }
    query = {
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'state': state,
        'code_challenge': challenge,
        'code_challenge_method': 'S256',
    }
    if provider == 'google':
        query['scope'] = 'openid email'
        query['access_type'] = 'online'
        base = 'https://accounts.google.com/o/oauth2/v2/auth'
    elif provider == 'yandex':
        query['scope'] = 'login:email'
        base = 'https://oauth.yandex.ru/authorize'
    else:
        query['scope'] = 'openid'
        base = 'https://oauth.telegram.org/auth'
    return base + '?' + urllib.parse.urlencode(query)


def take_oauth(state: str, provider: str) -> dict:
    with _oauth_lock:
        item = _oauth.pop(state, None)
    if not item or item['provider'] != provider or time.time() - item['at'] > 600:
        raise RuntimeError('Вход устарел. Начните его ещё раз.')
    return item


def identity_from_provider(provider: str, code: str, verifier: str, redirect_uri: str) -> tuple[str, str]:
    client_id, secret = provider_keys(provider)
    if provider == 'google':
        token = form_post('https://oauth2.googleapis.com/token', {
            'code': code,
            'client_id': client_id,
            'client_secret': secret,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code',
            'code_verifier': verifier,
        })
        info = json_get(
            'https://openidconnect.googleapis.com/v1/userinfo',
            {'Authorization': 'Bearer ' + token['access_token']},
        )
        subject = str(info.get('sub') or '')
        name = str(info.get('email') or info.get('name') or 'Google')
    elif provider == 'yandex':
        token = form_post('https://oauth.yandex.ru/token', {
            'grant_type': 'authorization_code',
            'code': code,
            'client_id': client_id,
            'client_secret': secret,
            'redirect_uri': redirect_uri,
            'code_verifier': verifier,
        })
        info = json_get(
            'https://login.yandex.ru/info?format=json',
            {'Authorization': 'OAuth ' + token['access_token']},
        )
        subject = str(info.get('id') or info.get('default_email') or '')
        name = str(info.get('default_email') or info.get('login') or 'Яндекс')
    else:
        token = form_post('https://oauth.telegram.org/token', {
            'grant_type': 'authorization_code',
            'code': code,
            'client_id': client_id,
            'client_secret': secret,
            'redirect_uri': redirect_uri,
            'code_verifier': verifier,
        })
        claims = jwt_payload(token['id_token'])
        if claims.get('iss') != 'https://oauth.telegram.org' or str(claims.get('aud')) != client_id:
            raise RuntimeError('Ответ Telegram не совпал с нашим приложением')
        subject = str(claims.get('sub') or '')
        name = str(claims.get('preferred_username') or claims.get('name') or 'Telegram')
    if not subject:
        raise RuntimeError('Провайдер не прислал постоянный id')
    return subject, name[:80]


def remember_session(account_id: int) -> str:
    token = token_urlsafe(24)
    with _sessions_lock:
        _sessions[token] = account_id
    return token


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        print('[cabinet]', fmt % args)

    def https_request(self) -> bool:
        proto = (self.headers.get('X-Forwarded-Proto') or '').split(',')[0].strip().lower()
        if proto:
            return proto == 'https'
        host = (self.headers.get('Host') or '').split(':')[0]
        return host == 'aegis-gate.ru' or host.endswith('.aegis-gate.ru')

    def session_cookie(self, value: str, *, clear: bool = False) -> str:
        parts = [f'cab_session={value}', 'HttpOnly', 'Path=/', 'SameSite=Lax']
        if clear:
            parts.append('Max-Age=0')
        if self.https_request():
            parts.append('Secure')
        return '; '.join(parts)

    def send_json(self, code: int, payload: dict, *, cookie: str | None = None, clear: bool = False) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        if cookie is not None:
            self.send_header('Set-Cookie', self.session_cookie(cookie))
        if clear:
            self.send_header('Set-Cookie', self.session_cookie('', clear=True))
        self.end_headers()
        self.wfile.write(raw)

    def session_token(self) -> str:
        header = self.headers.get('Cookie', '')
        for part in header.split(';'):
            name, _, value = part.strip().partition('=')
            if name == 'cab_session':
                return value
        return ''

    def account_id(self) -> int | None:
        with _sessions_lock:
            return _sessions.get(self.session_token())

    def read_json(self) -> dict:
        length = int(self.headers.get('Content-Length', '0') or 0)
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode())

    def redirect(self, location: str, *, session: str | None = None) -> None:
        self.send_response(302)
        self.send_header('Location', location)
        self.send_header('Cache-Control', 'no-store')
        if session is not None:
            self.send_header('Set-Cookie', self.session_cookie(session))
        self.end_headers()

    def auth_error(self, message: str, nonce: str = '') -> None:
        self.redirect('/auth/done?' + urllib.parse.urlencode({'auth_error': message, 'nonce': nonce}))

    def auth_done(self) -> None:
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        nonce = (query.get('nonce') or [''])[0]
        error = (query.get('auth_error') or [''])[0]
        payload = json.dumps({'nonce': nonce, 'error': error}, ensure_ascii=False)
        fallback = '/account'
        if error:
            fallback += '?' + urllib.parse.urlencode({'auth_error': error})
        html = f'''<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>Вход</title></head>
<body><p>Это окно можно закрыть.</p>
<script>
var payload = {payload};
try {{ localStorage.setItem('aegis-auth-done', JSON.stringify(payload)); }} catch (e) {{}}
if (window.opener) {{
  window.opener.postMessage({{type: 'aegis-auth', nonce: payload.nonce, error: payload.error}}, location.origin);
  window.close();
}} else {{
  location.replace({json.dumps(fallback)});
}}
</script></body></html>'''
        raw = html.encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(raw)

    def public_base(self) -> str:
        host = self.headers.get('Host', f'{HOST}:{PORT}')
        if host.startswith('127.0.0.1') or host.startswith('localhost'):
            return 'http://' + host
        return 'https://aegis-gate.ru'

    def handle_auth(self, provider: str) -> None:
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        redirect_uri = self.public_base() + '/auth/' + provider
        nonce = (query.get('nonce') or [''])[0]
        if query.get('error'):
            detail = query['error_description'][0] if query.get('error_description') else query['error'][0]
            self.auth_error(detail, nonce)
            return
        if not query.get('code'):
            try:
                target = begin_oauth(provider, redirect_uri, nonce)
            except Exception as exc:
                self.auth_error(str(exc), nonce)
                return
            self.redirect(target)
            return
        saved_nonce = ''
        try:
            state = (query.get('state') or [''])[0]
            saved = take_oauth(state, provider)
            saved_nonce = saved.get('nonce') or ''
            subject, name = identity_from_provider(
                provider,
                query['code'][0],
                saved['verifier'],
                saved['redirect'],
            )
            current = self.account_id()
            if current is None:
                view = login_identity(provider, subject, name)
            else:
                view = link_identity(current, provider, subject)
            self.redirect(
                '/auth/done?' + urllib.parse.urlencode({'ok': '1', 'nonce': saved_nonce}),
                session=remember_session(view['account_id']),
            )
        except Exception as exc:
            self.auth_error(str(exc), saved_nonce)

    def do_GET(self) -> None:
        path = self.path.split('?', 1)[0]
        if path == '/api/health':
            self.send_json(200, {'ok': True})
            return
        if path == '/auth/done':
            self.auth_done()
            return
        if path.startswith('/auth/'):
            provider = path.removeprefix('/auth/')
            if provider in PROVIDERS:
                self.handle_auth(provider)
                return
            self.auth_error('Неизвестный способ входа')
            return
        if path == '/api/me':
            account_id = self.account_id()
            if account_id is None:
                self.send_json(401, {'error': 'Сначала войдите'})
                return
            view = current_account(self.session_token())
            self.send_json(200, view or {'error': 'Сессия устарела'})
            return
        target = static_file(self.path)
        if target is None:
            missing = static_file('/404.html')
            if missing is None:
                self.send_error(404)
                return
            target = missing
            code = 404
        else:
            code = 200
        raw = target.read_bytes()
        self.send_response(code)
        self.send_header('Content-Type', CONTENT_TYPES.get(target.suffix, 'application/octet-stream'))
        self.send_header('Content-Length', str(len(raw)))
        if target.suffix == '.html':
            self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self) -> None:
        path = self.path.split('?', 1)[0]
        try:
            body = self.read_json()
            if path == '/api/logout':
                with _sessions_lock:
                    _sessions.pop(self.session_token(), None)
                self.send_json(200, {'ok': True}, clear=True)
                return
            if path == '/api/login':
                provider, subject, name = parse_identity(body, name_required=True)
                view = login_identity(provider, subject, name)
                token = token_urlsafe(24)
                with _sessions_lock:
                    _sessions[token] = view['account_id']
                self.send_json(200, view, cookie=token)
                return
            if path == '/api/link':
                account_id = self.account_id()
                if account_id is None:
                    self.send_json(401, {'error': 'Сначала войдите'})
                    return
                provider, subject, _name = parse_identity(body, name_required=False)
                self.send_json(200, link_identity(account_id, provider, subject))
                return
            if path == '/api/me':
                account_id = self.account_id()
                if account_id is None:
                    self.send_json(401, {'error': 'Сначала войдите'})
                    return
                view = current_account(self.session_token())
                self.send_json(200, view or {'error': 'Сессия устарела'})
                return
            self.send_error(404)
        except ValueError as exc:
            self.send_json(400, {'error': str(exc)})
        except Exception as exc:
            self.send_json(502, {'error': str(exc)})


def main() -> None:
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f'Сайт и кабинет: http://{HOST}:{PORT}')
    print(f'Мастер: {MASTER_BASE}')
    server.serve_forever()


if __name__ == '__main__':
    main()
