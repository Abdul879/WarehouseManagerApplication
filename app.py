import os, secrets
from urllib.parse import quote_plus
from functools import wraps
from flask import Flask, jsonify, request, send_from_directory
from pymongo import MongoClient
from dotenv import load_dotenv

BASE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE, ".env"))          # reads settings from the .env file next to app.py


def build_uri():
    """WMS_MONGO_URI wins if set. Otherwise the URI is built from user / password / host, with the
    username and password URL-encoded automatically (so characters like @ : / # are safe)."""
    if os.environ.get("WMS_MONGO_URI"):
        return os.environ["WMS_MONGO_URI"]
    user, pwd = os.environ.get("WMS_MONGO_USER"), os.environ.get("WMS_MONGO_PASS")
    host = os.environ.get("WMS_MONGO_HOST")
    if user and pwd and host:
        opts = os.environ.get("WMS_MONGO_OPTIONS", "")
        return f"mongodb+srv://{quote_plus(user)}:{quote_plus(pwd)}@{host}/" + (f"?{opts}" if opts else "")
    return "mongodb://localhost:27017"


MONGO_URI = build_uri()
MONGO_DB = os.environ.get("WMS_DB", "wms")          # database name
ADMIN_USER = os.environ.get("WMS_USER", "admin")
ADMIN_PASS = os.environ.get("WMS_PASS", "admin123")

app = Flask(__name__, static_folder="static", static_url_path="/static")


_client = None


def db():
    """Returns the MongoDB database. One MongoClient is shared (it is thread-safe and pools connections)."""
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    return _client[MONGO_DB]


def init_db():
    from wms_api import ensure_indexes
    ensure_indexes(db())


def err(msg, code=400, details=None):
    body = {"success": False, "error": msg}
    if details:
        body["details"] = details
    return jsonify(body), code


def auth(f):
    """HTTP Basic auth on every request: username + password are sent with each call. No login API, no token."""
    @wraps(f)
    def wrapper(*a, **kw):
        c = request.authorization
        if (not c or c.type != "basic"
                or not secrets.compare_digest((c.username or "").encode(), ADMIN_USER.encode())
                or not secrets.compare_digest((c.password or "").encode(), ADMIN_PASS.encode())):
            r, code = err("Unauthorized. Send HTTP Basic auth (username and password) with every request.", 401)
            r.headers["WWW-Authenticate"] = 'Basic realm="WMS", charset="UTF-8"'
            return r, code
        return f(*a, **kw)
    return wrapper


from wms_api import register
register(app, db, auth, err, lambda: request.headers.get("X-Created-By") or ADMIN_USER)


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

try:
    init_db()
except Exception as ex:   # keep the app importable; requests will fail until MongoDB is reachable
    print(f"\n  WARNING: cannot reach MongoDB at {MONGO_URI} ({ex.__class__.__name__}). Check the .env file (WMS_MONGO_*) and the Atlas IP allow-list.\n")


if __name__ == "__main__":
    print(f"\n  WMS running → http://127.0.0.1:5000 ")
    app.run(host="0.0.0.0", port=5000, debug=False)
