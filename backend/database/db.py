import os
import json
import logging
from pymongo import MongoClient
import mongomock

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("db_connector")

# Path for persistent simulation files
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
os.makedirs(DATA_DIR, exist_ok=True)

COLLECTIONS = [
    "users",
    "products",
    "inventory",
    "orders",
    "picking_tasks",
    "packing_tasks",
    "quality_checks",
    "exceptions",
    "dispatches",
    "notifications",
    "decisions",
    "audit_logs"
]

db_client = None
db = None
is_mock = False

def init_db():
    global db_client, db, is_mock
    
    # Try connecting to real MongoDB first
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/smart_warehouse")
    try:
        # Set a short server selection timeout so it doesn't hang if Mongo isn't running
        db_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
        # Force a connection test
        db_client.server_info()
        db = db_client.get_database()
        is_mock = False
        logger.info(f"Successfully connected to MongoDB at {mongo_uri}")
    except Exception as e:
        logger.warning(f"Failed to connect to MongoDB ({e}). Falling back to JSON-backed Mock DB.")
        db_client = mongomock.MongoClient()
        db = db_client.get_database("smart_warehouse")
        is_mock = True
        
    load_seed_or_persistent_data()

def persist_collection(collection_name):
    """Saves a mock collection to a local JSON file to persist state across restarts."""
    if not is_mock:
        return
    try:
        coll = db[collection_name]
        docs = list(coll.find({}))
        # Convert ObjectIds to strings for JSON serialization
        for doc in docs:
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
        
        file_path = os.path.join(DATA_DIR, f"{collection_name}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(docs, f, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error persisting mock collection {collection_name}: {e}")

def persist_all():
    """Persists all collections if in mock mode."""
    if not is_mock:
        return
    for col in COLLECTIONS:
        persist_collection(col)

def load_seed_or_persistent_data():
    """Loads either the persisted JSON state or seed data for all collections."""
    from .seed_data import get_seed_data
    seeds = get_seed_data()
    
    for col in COLLECTIONS:
        file_path = os.path.join(DATA_DIR, f"{col}.json")
        data = []
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                logger.info(f"Loaded {len(data)} items for {col} from persistent store.")
            except Exception as e:
                logger.error(f"Error loading persistent data for {col}: {e}")
                data = seeds.get(col, [])
        else:
            data = seeds.get(col, [])
            logger.info(f"No persistent file for {col}, using {len(data)} seed items.")
            
        if is_mock:
            # Seed the mongomock database
            db[col].drop()
            if data:
                db[col].insert_many(data)
                # Persist right away to establish the files
                persist_collection(col)
        else:
            # If using real MongoDB, only seed if collection is empty
            if db[col].count_documents({}) == 0:
                if data:
                    db[col].insert_many(data)
                    logger.info(f"Seeded MongoDB collection: {col}")

def get_db():
    if db is None:
        init_db()
    return db

def is_database_mock():
    if db is None:
        init_db()
    return is_mock
