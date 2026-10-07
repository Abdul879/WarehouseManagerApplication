import os, sqlite3, secrets
from functools import wraps
from flask import Flask, g, jsonify, request, send_from_directory

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("WMS_DB", os.path.join(BASE, "wms.db"))
ADMIN_USER = os.environ.get("WMS_USER", "admin")
ADMIN_PASS = os.environ.get("WMS_PASS", "admin123")

app = Flask(__name__, static_folder="static", static_url_path="/static")


def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_):
    d = g.pop("db", None)
    if d:
        d.close()


def init_db():
    with sqlite3.connect(DB_PATH) as c:
        c.executescript(open(os.path.join(BASE, "schema.sql")).read())


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

init_db()

if __name__ == "__main__":
    print(f"\n  WMS running → http://127.0.0.1:5000 ")
    app.run(host="0.0.0.0", port=5000, debug=False)
