import os
import logging
from flask import Flask, send_from_directory, redirect
from flask_cors import CORS
from database.db import init_db
from routes.api import api_bp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

# Define folder paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
CSS_DIR = os.path.join(BASE_DIR, "css")
JS_DIR = os.path.join(BASE_DIR, "js")

app = Flask(__name__)
# Enable CORS for all routes (crucial for local testing across protocols)
CORS(app)

# Register REST API blueprint
app.register_blueprint(api_bp, url_prefix="/api")

# --- STATIC FILE SERVING FOR FULL-STACK INTEGRATION ---
@app.route("/")
def index():
    """Serves the login page by default."""
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/<string:page_name>.html")
def serve_html(page_name):
    """Serves specific HTML pages from frontend/."""
    return send_from_directory(FRONTEND_DIR, f"{page_name}.html")

@app.route("/css/<path:filename>")
def serve_css(filename):
    """Serves stylesheets."""
    return send_from_directory(CSS_DIR, filename)

@app.route("/js/<path:filename>")
def serve_js(filename):
    """Serves javascript controllers."""
    return send_from_directory(JS_DIR, filename)

@app.route("/favicon.ico")
def serve_favicon():
    """Silence favicon requests."""
    return "", 204

if __name__ == "__main__":
    logger.info("Initializing database...")
    init_db()
    
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Starting SmartFulfill backend server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
