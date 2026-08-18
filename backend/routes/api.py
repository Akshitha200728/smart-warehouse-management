import datetime
from flask import Blueprint, jsonify, request
from bson import ObjectId
from database.db import get_db, persist_all, is_database_mock
from database.seed_data import get_seed_data
from services.priority_engine import calculate_priority_score
from services.allocation_engine import allocate_inventory, log_audit
from services.reorder_engine import analyze_reorders
from services.picking_optimizer import optimize_picking_route
from services.exception_engine import handle_damaged_item, handle_missing_item

api_bp = Blueprint("api", __name__)

# Helper to serialize mongo documents
def serialize_doc(doc):
    if not doc:
        return None
    doc_copy = doc.copy()
    if "_id" in doc_copy:
        doc_copy["_id"] = str(doc_copy["_id"])
    return doc_copy

def serialize_docs(docs):
    return [serialize_doc(doc) for doc in docs]

# --- AUTH ---
@api_bp.route("/auth/login", methods=["POST"])
def login():
    db = get_db()
    data = request.json or {}
    email = data.get("email")
    password = data.get("password")
    
    user = db.users.find_one({"email": email, "password": password})
    if not user:
        # Dynamic self-registration helper for hackathon judges
        if email and password and "@" in email and len(password) >= 6:
            name_part = email.split("@")[0]
            # Format clean username (e.g. "chakshitha28" -> "Chakshitha28")
            clean_name = ''.join(c for c in name_part if c.isalnum() or c.isspace()).title()
            
            user = {
                "_id": f"usr-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}",
                "email": email,
                "password": password,
                "name": clean_name,
                "role": "Warehouse Manager",
                "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces"
            }
            db.users.insert_one(user)
            persist_all()
            logger.info(f"Dynamically registered and authenticated new user: {email}")
        else:
            return jsonify({"success": False, "message": "Invalid email or password (must be at least 6 characters)"}), 401
            
    return jsonify({
        "success": True,
        "user": {
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "avatar": user.get("avatar")
        }
    })


# --- PRODUCTS & INVENTORY ---
@api_bp.route("/products", methods=["GET"])
def get_products():
    db = get_db()
    category = request.args.get("category")
    status = request.args.get("status")
    search = request.args.get("search")
    
    query = {}
    if category:
        query["category"] = category
        
    products_list = list(db.products.find(query))
    
    # Enrich products with their inventory data
    enriched = []
    for prod in products_list:
        pid = prod["_id"]
        inv = db.inventory.find_one({"product_id": pid})
        if not inv:
            continue
            
        # Calculate status automatically
        avail = inv.get("available_stock", 0)
        reorder_lvl = inv.get("reorder_level", 0)
        
        if avail == 0:
            inv_status = "Out of Stock"
        elif avail <= reorder_lvl:
            inv_status = "Low Stock"
        else:
            inv_status = "Healthy"
            
        if inv.get("damaged_stock", 0) > 0 and inv_status != "Out of Stock" and inv_status != "Low Stock":
            # Just a supplementary status details if requested
            pass
            
        # Filter by status if requested
        if status and inv_status != status:
            continue
            
        # Search filter
        if search:
            search_lower = search.lower()
            if search_lower not in prod["name"].lower() and search_lower not in prod["sku"].lower():
                continue
                
        p_enriched = serialize_doc(prod)
        p_enriched["inventory"] = serialize_doc(inv)
        p_enriched["inventory"]["status"] = inv_status
        enriched.append(p_enriched)
        
    return jsonify(enriched)

@api_bp.route("/products", methods=["POST"])
def add_product():
    db = get_db()
    data = request.json or {}
    
    sku = data.get("sku")
    name = data.get("name")
    category = data.get("category")
    description = data.get("description", "")
    
    # Inventory attributes
    location = data.get("location", "A-01-01")
    total_stock = int(data.get("total_stock", 0))
    reorder_level = int(data.get("reorder_level", 10))
    safety_stock = int(data.get("safety_stock", 5))
    avg_daily_demand = float(data.get("avg_daily_demand", 2.0))
    lead_time = int(data.get("lead_time", 5))
    
    p_id = f"PROD-{sku[:3].upper()}-{datetime.datetime.now().strftime('%M%S')}"
    
    db.products.insert_one({
        "_id": p_id,
        "sku": sku,
        "name": name,
        "category": category,
        "description": description
    })
    
    db.inventory.insert_one({
        "_id": f"INV-{p_id[-6:]}",
        "product_id": p_id,
        "location": location,
        "total_stock": total_stock,
        "available_stock": total_stock,
        "reserved_stock": 0,
        "damaged_stock": 0,
        "reorder_level": reorder_level,
        "safety_stock": safety_stock,
        "avg_daily_demand": avg_daily_demand,
        "lead_time": lead_time,
        "status": "Out of Stock" if total_stock == 0 else "Low Stock" if total_stock <= reorder_level else "Healthy"
    })
    
    log_audit(db, "Manager", "Create Product", None, p_id, None, f"Created SKU: {sku}, Qty: {total_stock}")
    persist_all()
    
    return jsonify({"success": True, "product_id": p_id})

@api_bp.route("/products/<id>", methods=["PUT"])
def adjust_stock(id):
    db = get_db()
    data = request.json or {}
    
    adjustment = int(data.get("adjustment", 0))
    action = data.get("action", "adjustment") # "adjustment", "edit"
    user_name = data.get("user", "Alex Carter")
    
    inv = db.inventory.find_one({"product_id": id})
    if not inv:
        return jsonify({"success": False, "message": "Product inventory not found"}), 404
        
    old_avail = inv.get("available_stock", 0)
    old_total = inv.get("total_stock", 0)
    
    if action == "adjustment":
        new_avail = max(0, old_avail + adjustment)
        new_total = max(0, old_total + adjustment)
        
        status = "Out of Stock" if new_avail == 0 else "Low Stock" if new_avail <= inv["reorder_level"] else "Healthy"
        
        db.inventory.update_one(
            {"product_id": id},
            {"$set": {"available_stock": new_avail, "total_stock": new_total, "status": status}}
        )
        
        log_audit(db, user_name, "Inventory Adjust", None, id, 
                  f"Available: {old_avail}, Total: {old_total}", 
                  f"Available: {new_avail}, Total: {new_total} (Adj: {adjustment})")
    else:
        # Edit general product details
        # Updates fields
        location = data.get("location", inv["location"])
        reorder_level = int(data.get("reorder_level", inv["reorder_level"]))
        safety_stock = int(data.get("safety_stock", inv["safety_stock"]))
        lead_time = int(data.get("lead_time", inv["lead_time"]))
        avg_demand = float(data.get("avg_daily_demand", inv["avg_daily_demand"]))
        
        new_avail = old_avail
        status = "Out of Stock" if new_avail == 0 else "Low Stock" if new_avail <= reorder_level else "Healthy"
        
        db.inventory.update_one(
            {"product_id": id},
            {
                "$set": {
                    "location": location,
                    "reorder_level": reorder_level,
                    "safety_stock": safety_stock,
                    "lead_time": lead_time,
                    "avg_daily_demand": avg_demand,
                    "status": status
                }
            }
        )
        
        db.products.update_one(
            {"_id": id},
            {"$set": {"name": data.get("name"), "category": data.get("category"), "description": data.get("description", "")}}
        )
        
        log_audit(db, user_name, "Edit Product Settings", None, id, "Settings updated", f"Loc: {location}, Reorder: {reorder_level}")
        
    persist_all()
    return jsonify({"success": True})

@api_bp.route("/inventory/reorder-recommendations", methods=["GET"])
def get_reorder_recommendations():
    recs = analyze_reorders()
    return jsonify(recs)


# --- ORDERS & ALLOCATION ---
@api_bp.route("/orders", methods=["GET"])
def get_orders():
    db = get_db()
    status = request.args.get("status")
    search = request.args.get("search")
    
    query = {}
    if status:
        query["status"] = status
        
    orders_list = list(db.orders.find(query))
    
    # Calculate scores on request to reflect aging
    for order in orders_list:
        priority_details = calculate_priority_score(order)
        # Update priority score in DB dynamically
        db.orders.update_one(
            {"_id": order["_id"]},
            {"$set": {"priority_score": priority_details["score"], "priority": priority_details["classification"]}}
        )
        order["priority_score"] = priority_details["score"]
        order["priority"] = priority_details["classification"]
        
    # Search filter
    if search:
        search_lower = search.lower()
        orders_list = [o for o in orders_list if search_lower in o["_id"].lower() or search_lower in o["customer"].lower()]
        
    # Sort orders by priority score descending
    orders_list.sort(key=lambda x: x.get("priority_score", 0), reverse=True)
    
    return jsonify(serialize_docs(orders_list))

@api_bp.route("/orders/<id>", methods=["GET"])
def get_order_detail(id):
    db = get_db()
    order = db.orders.find_one({"_id": id})
    if not order:
        return jsonify({"message": "Order not found"}), 404
        
    priority_details = calculate_priority_score(order)
    order["priority_score"] = priority_details["score"]
    order["priority"] = priority_details["classification"]
    order["priority_breakdown"] = priority_details["breakdown"]
    
    # Enrich items with product details (sku, name, location)
    enriched_items = []
    for item in order.get("items", []):
        pid = item["product_id"]
        prod = db.products.find_one({"_id": pid})
        inv = db.inventory.find_one({"product_id": pid})
        
        enriched_item = item.copy()
        if prod:
            enriched_item["sku"] = prod.get("sku")
            enriched_item["name"] = prod.get("name")
        if inv:
            enriched_item["location"] = inv.get("location")
            enriched_item["available_stock"] = inv.get("available_stock")
            
        enriched_items.append(enriched_item)
        
    order_serialized = serialize_doc(order)
    order_serialized["items"] = enriched_items
    
    return jsonify(order_serialized)

@api_bp.route("/orders", methods=["POST"])
def create_order():
    db = get_db()
    data = request.json or {}
    
    customer = data.get("customer")
    customer_type = data.get("customer_type", "Regular")
    urgency = data.get("urgency", "Normal")
    items_input = data.get("items", []) # List of {product_id, quantity}
    
    # Validate items
    items = []
    for it in items_input:
        items.append({
            "product_id": it["product_id"],
            "quantity": int(it["quantity"]),
            "allocated": 0
        })
        
    now = datetime.datetime.now()
    due_days = 2
    if urgency == "Critical":
        due_days = 0.25 # 6 hours
    elif urgency == "Urgent":
        due_days = 0.5 # 12 hours
    elif urgency == "High":
        due_days = 1
        
    due_date = now + datetime.timedelta(days=due_days)
    
    o_id = f"ORD-{now.strftime('%y%m%d%H%M%S')}"
    
    order = {
        "_id": o_id,
        "customer": customer,
        "customer_type": customer_type,
        "items": items,
        "order_date": now.isoformat(),
        "due_date": due_date.isoformat(),
        "urgency": urgency,
        "delay_risk": "Low" if due_days >= 2 else "Medium" if due_days >= 1 else "High",
        "priority_score": 0.0, # Will be computed
        "status": "Created",
        "allocation_status": "Pending Allocation",
        "picking_status": "Pending",
        "packing_status": "Pending",
        "dispatch_status": "Ready",
        "history": [{"status": "Created", "timestamp": now.isoformat(), "comment": "Order created by management"}]
    }
    
    # Calculate score initial
    score_details = calculate_priority_score(order)
    order["priority_score"] = score_details["score"]
    order["priority"] = score_details["classification"]
    
    db.orders.insert_one(order)
    
    log_audit(db, "Manager", "Order Created", o_id, None, None, f"Order created for customer '{customer}'")
    persist_all()
    
    return jsonify({"success": True, "order_id": o_id})

@api_bp.route("/orders/<id>/allocate", methods=["POST"])
def allocate_order_inventory(id):
    # This runs the global allocation logic, but wait, let's allow setting strategy
    data = request.json or {}
    strategy = data.get("strategy", "Priority First")
    
    # Running allocation algorithm
    result = allocate_inventory(strategy)
    
    # Fetch final order state to return
    db = get_db()
    order = db.orders.find_one({"_id": id})
    
    return jsonify({
        "success": True,
        "message": f"Allocation executed using strategy: {strategy}",
        "order": serialize_doc(order)
    })

# --- PICKING WORKFLOW ---
@api_bp.route("/orders/<id>/pick", methods=["POST"])
def start_picking(id):
    db = get_db()
    order = db.orders.find_one({"_id": id})
    if not order:
        return jsonify({"message": "Order not found"}), 404
        
    if order["status"] not in ["Fully Allocated", "Partially Allocated"]:
        return jsonify({"success": False, "message": "Order must have allocated inventory before picking."}), 400
        
    # Gather items to pick (only pick items that have been allocated)
    pick_items = []
    for item in order.get("items", []):
        alloc = item.get("allocated", 0)
        if alloc > 0:
            prod = db.products.find_one({"_id": item["product_id"]})
            inv = db.inventory.find_one({"product_id": item["product_id"]})
            
            pick_items.append({
                "product_id": item["product_id"],
                "sku": prod.get("sku") if prod else "N/A",
                "name": prod.get("name") if prod else "Unknown",
                "quantity": alloc,
                "location": inv.get("location") if inv else "Unspecified",
                "picked": 0
            })
            
    if not pick_items:
        return jsonify({"success": False, "message": "No allocated stock available to pick."}), 400
        
    # Optimize routing
    opt_result = optimize_picking_route(pick_items)
    
    # Create Picking Task
    task_id = f"PICK-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{id[-4:]}"
    picker = "Sarah Miller" # default demo picker
    
    db.picking_tasks.insert_one({
        "_id": task_id,
        "order_id": id,
        "picker": picker,
        "items": opt_result["route"],
        "status": "In Progress",
        "start_time": datetime.datetime.now().isoformat(),
        "estimated_completion": (datetime.datetime.now() + datetime.timedelta(minutes=opt_result["estimated_time_mins"])).isoformat(),
        "route": opt_result["locations"],
        "distance_meters": opt_result["total_distance"]
    })
    
    # Update Order
    history_entry = {
        "status": "Picking",
        "timestamp": datetime.datetime.now().isoformat(),
        "comment": f"Picking task '{task_id}' assigned to {picker}."
    }
    db.orders.update_one(
        {"_id": id},
        {
            "$set": {"status": "Picking", "picking_status": "In Progress"},
            "$push": {"history": history_entry}
        }
    )
    
    log_audit(db, "System", "Picking Started", id, None, "Allocated", f"Task: {task_id}, Picker: {picker}")
    persist_all()
    
    return jsonify({
        "success": True,
        "picking_task_id": task_id,
        "route": opt_result["locations"],
        "distance_meters": opt_result["total_distance"],
        "estimated_time_mins": opt_result["estimated_time_mins"]
    })

@api_bp.route("/picking/tasks", methods=["GET"])
def get_picking_tasks():
    db = get_db()
    tasks = list(db.picking_tasks.find({}))
    return jsonify(serialize_docs(tasks))

@api_bp.route("/picking/tasks/<id>/complete", methods=["POST"])
def complete_picking_task(id):
    db = get_db()
    task = db.picking_tasks.find_one({"_id": id})
    if not task:
        return jsonify({"message": "Picking task not found"}), 404
        
    data = request.json or {}
    items_picked = data.get("items", []) # List of {product_id, picked_quantity}
    reporter = data.get("user", "Sarah Miller")
    
    order_id = task["order_id"]
    order = db.orders.find_one({"_id": order_id})
    
    # Verify if there were missing/damaged items reported
    mismatch_detected = False
    
    for item in task.get("items", []):
        pid = item["product_id"]
        req_qty = item["quantity"]
        
        # Check actual pick count
        picked_qty = req_qty # Default to fully picked
        for item_report in items_picked:
            if item_report["product_id"] == pid:
                picked_qty = int(item_report["picked"])
                break
                
        # If worker reports less than requested
        if picked_qty < req_qty:
            mismatch_detected = True
            # Log missing items
            handle_missing_item(order_id, pid, req_qty, picked_qty, reporter)
            
    if mismatch_detected:
        # If there's an exception, picking task state is set to "Exception"
        db.picking_tasks.update_one(
            {"_id": id},
            {"$set": {"status": "Exception"}}
        )
        db.orders.update_one(
            {"_id": order_id},
            {"$set": {"picking_status": "Exception", "status": "Partially Allocated"}}
        )
        persist_all()
        return jsonify({
            "success": True,
            "message": "Picking task completed with exceptions. Problems logged in Exception Center.",
            "status": "Exception"
        })
        
    # Mark task as completed successfully
    db.picking_tasks.update_one(
        {"_id": id},
        {"$set": {"status": "Completed", "end_time": datetime.datetime.now().isoformat()}}
    )
    
    # Update Order
    history_entry = {
        "status": "Picked",
        "timestamp": datetime.datetime.now().isoformat(),
        "comment": "All items picked successfully from shelves."
    }
    db.orders.update_one(
        {"_id": order_id},
        {
            "$set": {"status": "Picking", "picking_status": "Completed", "packing_status": "Pending"},
            "$push": {"history": history_entry}
        }
    )
    
    log_audit(db, reporter, "Picking Complete", order_id, None, "In Progress", "Completed successfully")
    persist_all()
    
    return jsonify({"success": True, "message": "Picking completed successfully.", "status": "Completed"})


# --- PACKING WORKFLOW ---
@api_bp.route("/packing/tasks", methods=["GET"])
def get_packing_tasks():
    db = get_db()
    # Find orders that are ready for packing: picking_status == Completed, packing_status != Completed
    orders = list(db.orders.find({"picking_status": "Completed", "packing_status": {"$ne": "Completed"}}))
    
    tasks = []
    for order in orders:
        items_to_pack = []
        for item in order.get("items", []):
            prod = db.products.find_one({"_id": item["product_id"]})
            items_to_pack.append({
                "product_id": item["product_id"],
                "sku": prod.get("sku") if prod else "N/A",
                "name": prod.get("name") if prod else "Unknown",
                "quantity": item["allocated"]
            })
            
        tasks.append({
            "order_id": order["_id"],
            "customer": order["customer"],
            "items": items_to_pack,
            "status": order["packing_status"],
            "package_type": "Standard Box" if len(items_to_pack) > 2 else "Padded Envelope",
            "weight": round(0.5 + (len(items_to_pack) * 0.4), 2)
        })
        
    return jsonify(tasks)

@api_bp.route("/orders/<id>/pack", methods=["POST"])
def pack_order(id):
    db = get_db()
    data = request.json or {}
    action = data.get("action") # "start", "complete", "issue"
    package_type = data.get("package_type", "Standard Box")
    weight = float(data.get("weight", 1.5))
    worker = data.get("user", "Sarah Miller")
    
    if action == "start":
        db.orders.update_one(
            {"_id": id},
            {"$set": {"packing_status": "In Progress"}}
        )
        return jsonify({"success": True, "status": "In Progress"})
        
    elif action == "complete":
        # Check if there is an active packing task record, if not insert
        db.packing_tasks.insert_one({
            "_id": f"PACK-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{id[-4:]}",
            "order_id": id,
            "package_type": package_type,
            "weight": weight,
            "worker": worker,
            "status": "Completed",
            "timestamp": datetime.datetime.now().isoformat()
        })
        
        # Update Order
        history_entry = {
            "status": "Packed",
            "timestamp": datetime.datetime.now().isoformat(),
            "comment": f"Packed into {package_type} (Weight: {weight} kg)."
        }
        db.orders.update_one(
            {"_id": id},
            {
                "$set": {"status": "Packing", "packing_status": "Completed", "quality_check_status": "Pending"},
                "$push": {"history": history_entry}
            }
        )
        
        log_audit(db, worker, "Packing Complete", id, None, "In Progress", f"Packed: {package_type}, Wt: {weight}")
        persist_all()
        return jsonify({"success": True, "status": "Completed"})
        
    elif action == "issue":
        # Report issue
        issue_type = data.get("issue_type", "Packaging Mismatch")
        problem_desc = data.get("problem", "Incorrect box size chosen.")
        
        # Create Exception
        exc_id = f"EXC-PCK-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{id[-4:]}"
        db.exceptions.insert_one({
            "_id": exc_id,
            "exception_type": "Packing Issue",
            "severity": "Medium",
            "order_id": id,
            "product_id": None,
            "problem": f"Packing Issue: {issue_type}. {problem_desc}",
            "impact": f"Order {id} packing suspended.",
            "recommended_action": "Verify packaging requirements and repack.",
            "status": "Active",
            "timestamp": datetime.datetime.now().isoformat()
        })
        
        db.orders.update_one(
            {"_id": id},
            {"$set": {"packing_status": "Exception", "status": "Packing"}}
        )
        persist_all()
        return jsonify({"success": True, "status": "Exception"})
        
    return jsonify({"success": False, "message": "Invalid packing action"})


# --- QUALITY CHECK WORKFLOW ---
@api_bp.route("/quality-checks", methods=["GET"])
def get_quality_checks():
    db = get_db()
    # Find orders that are packed (packing_status == Completed) and QA not completed
    orders = list(db.orders.find({"packing_status": "Completed", "quality_check_status": {"$ne": "Approved"}}))
    
    tasks = []
    for order in orders:
        items_to_check = []
        for item in order.get("items", []):
            prod = db.products.find_one({"_id": item["product_id"]})
            items_to_check.append({
                "product_id": item["product_id"],
                "sku": prod.get("sku") if prod else "N/A",
                "name": prod.get("name") if prod else "Unknown",
                "quantity": item["allocated"]
            })
            
        tasks.append({
            "order_id": order["_id"],
            "customer": order["customer"],
            "items": items_to_check,
            "status": order.get("quality_check_status", "Pending")
        })
        
    return jsonify(tasks)

@api_bp.route("/orders/<id>/quality-check", methods=["POST"])
def qa_order(id):
    db = get_db()
    data = request.json or {}
    action = data.get("action") # "approve", "reject"
    worker = data.get("user", "Alex Carter")
    checks = data.get("checks", {}) # e.g. {product_correct, quantity_correct, undamaged, packaging_correct, label_correct}
    
    if action == "approve":
        # Create QA record
        db.quality_checks.insert_one({
            "_id": f"QA-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{id[-4:]}",
            "order_id": id,
            "checker": worker,
            "checks": checks,
            "status": "Approved",
            "timestamp": datetime.datetime.now().isoformat()
        })
        
        # Update Order
        history_entry = {
            "status": "Quality Approved",
            "timestamp": datetime.datetime.now().isoformat(),
            "comment": "Order passed QA check successfully."
        }
        db.orders.update_one(
            {"_id": id},
            {
                "$set": {"status": "Quality Check", "quality_check_status": "Approved", "dispatch_status": "Ready"},
                "$push": {"history": history_entry}
            }
        )
        
        log_audit(db, worker, "Quality Check Approved", id, None, "Packed", "Passed all validation checkpoints")
        persist_all()
        return jsonify({"success": True, "status": "Approved"})
        
    elif action == "reject":
        # Create QA record (Failed)
        db.quality_checks.insert_one({
            "_id": f"QA-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{id[-4:]}",
            "order_id": id,
            "checker": worker,
            "checks": checks,
            "status": "Rejected",
            "timestamp": datetime.datetime.now().isoformat()
        })
        
        reason = data.get("reason", "Items damaged or incorrect quantities.")
        
        # Report exception
        exc_id = f"EXC-QA-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{id[-4:]}"
        db.exceptions.insert_one({
            "_id": exc_id,
            "exception_type": "Quality Failure",
            "severity": "High",
            "order_id": id,
            "product_id": None,
            "problem": f"QA Rejection: {reason}",
            "impact": f"Order {id} QA check failed. Prevented shipping bad stock.",
            "recommended_action": "Reject order, inspect contents, and re-pick if necessary.",
            "status": "Active",
            "timestamp": datetime.datetime.now().isoformat()
        })
        
        db.orders.update_one(
            {"_id": id},
            {"$set": {"quality_check_status": "Rejected", "status": "Quality Check"}}
        )
        
        log_audit(db, worker, "Quality Check Rejected", id, None, "Packed", f"Failed: {reason}")
        persist_all()
        return jsonify({"success": True, "status": "Rejected"})
        
    return jsonify({"success": False, "message": "Invalid QA action"})


# --- DISPATCH WORKFLOW ---
@api_bp.route("/dispatches", methods=["GET"])
def get_dispatches():
    db = get_db()
    # Find orders that are QA Approved and not yet Dispatched
    orders = list(db.orders.find({"quality_check_status": "Approved", "status": {"$ne": "Dispatched"}}))
    
    tasks = []
    for order in orders:
        # Check weight from packing tasks if exists
        pack_t = db.packing_tasks.find_one({"order_id": order["_id"]})
        weight = pack_t.get("weight", 1.2) if pack_t else 1.2
        
        tasks.append({
            "order_id": order["_id"],
            "customer": order["customer"],
            "priority": order["priority"],
            "weight": weight,
            "status": order["dispatch_status"]
        })
        
    return jsonify(tasks)

@api_bp.route("/orders/<id>/dispatch", methods=["POST"])
def dispatch_order(id):
    db = get_db()
    data = request.json or {}
    carrier = data.get("carrier", "FedEx Express")
    worker = data.get("user", "Alex Carter")
    
    order = db.orders.find_one({"_id": id})
    if not order:
        return jsonify({"message": "Order not found"}), 404
        
    # Get weight from packing
    pack_t = db.packing_tasks.find_one({"order_id": id})
    weight = pack_t.get("weight", 1.5) if pack_t else 1.5
    
    # 1. Create Dispatch task
    disp_id = f"DISP-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{id[-4:]}"
    tracking_num = f"TRK{datetime.datetime.now().strftime('%Y%H%M%S')}{id[-4:]}"
    
    db.dispatches.insert_one({
        "_id": disp_id,
        "order_id": id,
        "customer": order["customer"],
        "package_id": f"PKG-{id[-6:]}",
        "weight": weight,
        "priority": order["priority"],
        "carrier": carrier,
        "tracking_number": tracking_num,
        "status": "Dispatched",
        "dispatch_time": datetime.datetime.now().isoformat()
    })
    
    # 2. Update Order
    history_entry = {
        "status": "Dispatched",
        "timestamp": datetime.datetime.now().isoformat(),
        "comment": f"Dispatched via {carrier}. Tracking: {tracking_num}."
    }
    db.orders.update_one(
        {"_id": id},
        {
            "$set": {"status": "Dispatched", "dispatch_status": "Dispatched"},
            "$push": {"history": history_entry}
        }
    )
    
    # 3. Update inventory final counts!
    # Reduce total_stock and reserved_stock since they have shipped!
    for item in order.get("items", []):
        pid = item["product_id"]
        qty = item["allocated"]
        
        # Total stock decrements, reserved stock decrements
        db.inventory.update_one(
            {"product_id": pid},
            {"$inc": {"total_stock": -qty, "reserved_stock": -qty}}
        )
        
    # 4. Create Success Notification
    ntf_id = f"NTF-DISP-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{id[-4:]}"
    db.notifications.insert_one({
        "_id": ntf_id,
        "type": "success",
        "title": "Order Dispatched",
        "message": f"Order {id} dispatched successfully via {carrier}.",
        "timestamp": datetime.datetime.now().isoformat(),
        "read": False
    })
    
    log_audit(db, worker, "Order Dispatched", id, None, "Quality Approved", f"Carrier: {carrier}, Tracking: {tracking_num}")
    persist_all()
    
    return jsonify({
        "success": True,
        "dispatch_id": disp_id,
        "tracking_number": tracking_num
    })


# --- EXCEPTIONS & DECISIONS ---
@api_bp.route("/exceptions", methods=["GET"])
def get_exceptions():
    db = get_db()
    excs = list(db.exceptions.find({}))
    
    # Enrich with product/order descriptions
    enriched = []
    for exc in excs:
        exc_e = serialize_doc(exc)
        if exc.get("product_id"):
            prod = db.products.find_one({"_id": exc["product_id"]})
            if prod:
                exc_e["product_name"] = prod["name"]
                exc_e["sku"] = prod["sku"]
        enriched.append(exc_e)
        
    return jsonify(enriched)

@api_bp.route("/exceptions/report", methods=["POST"])
def report_exception():
    db = get_db()
    data = request.json or {}
    order_id = data.get("order_id")
    product_id = data.get("product_id")
    exc_type = data.get("exception_type")
    reporter = data.get("user", "Sarah Miller")
    
    if exc_type == "Damaged Item":
        qty = int(data.get("quantity", 1))
        res = handle_damaged_item(order_id, product_id, qty, reporter)
        return jsonify(res)
    elif exc_type == "Missing Item":
        expected = int(data.get("expected", 1))
        found = int(data.get("found", 0))
        res = handle_missing_item(order_id, product_id, expected, found, reporter)
        return jsonify(res)
    else:
        # Generic Exception reporting
        exc_id = f"EXC-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{order_id[-4:]}"
        db.exceptions.insert_one({
            "_id": exc_id,
            "exception_type": exc_type,
            "severity": data.get("severity", "Medium"),
            "order_id": order_id,
            "product_id": product_id,
            "problem": data.get("problem", "Operational bottleneck reported."),
            "impact": data.get("impact", "Processing delayed."),
            "recommended_action": data.get("recommended_action", "Investigate immediately."),
            "status": "Active",
            "timestamp": datetime.datetime.now().isoformat()
        })
        log_audit(db, reporter, f"Report Exception: {exc_type}", order_id, product_id, None, "Logged exception")
        persist_all()
        return jsonify({"success": True, "exception_id": exc_id})

@api_bp.route("/decisions", methods=["GET"])
def get_decisions():
    db = get_db()
    decs = list(db.decisions.find({}))
    return jsonify(serialize_docs(decs))

@api_bp.route("/decisions/<id>/approve", methods=["POST"])
def approve_decision(id):
    db = get_db()
    dec = db.decisions.find_one({"_id": id})
    if not dec:
        return jsonify({"message": "Decision not found"}), 404
        
    data = request.json or {}
    worker = data.get("user", "Alex Carter")
    
    # Execute recommended resolution based on type of decision
    problem_text = dec.get("problem", "")
    dec_data = dec.get("data", {})
    
    if "Stock Shortage" in problem_text:
        # Resolution: Replenish the shortage quantity!
        pid = dec_data.get("product_id")
        short_qty = dec_data.get("shortage", 1)
        order_id = dec_data.get("order_id")
        
        # Simulate intake of replenishment inventory
        inv = db.inventory.find_one({"product_id": pid})
        if inv:
            db.inventory.update_one(
                {"product_id": pid},
                {"$inc": {"available_stock": short_qty, "total_stock": short_qty}}
            )
            
            # Now trigger allocation again!
            allocate_inventory(dec_data.get("strategy", "Priority First"))
            
            # Close the associated stock shortage exceptions
            db.exceptions.update_many(
                {"order_id": order_id, "product_id": pid, "exception_type": "Stock Shortage"},
                {"$set": {"status": "Resolved"}}
            )
            
    elif "Damaged item" in problem_text:
        # Resolution: Transfer replacement unit from Zone B
        pid = dec_data.get("product_id")
        qty = dec_data.get("quantity", 1)
        order_id = dec_data.get("order_id")
        repl_loc = dec_data.get("replacement_location", "Zone B-04-12")
        
        # Increment available stock back (simulating transfer arrival)
        db.inventory.update_one(
            {"product_id": pid},
            {"$inc": {"available_stock": qty, "total_stock": qty}}
        )
        
        # Trigger allocation again to fill the order
        allocate_inventory()
        
        # Close associated damaged item exceptions
        db.exceptions.update_many(
            {"order_id": order_id, "product_id": pid, "exception_type": "Damaged Item"},
            {"$set": {"status": "Resolved"}}
        )
        
        # Update associated picking task status back to Completed (if it was an exception)
        # In the demo, resolving the exception allows the picking task to be successfully completed
        db.picking_tasks.update_many(
            {"order_id": order_id, "status": "Exception"},
            {"$set": {"status": "Completed", "end_time": datetime.datetime.now().isoformat()}}
        )
        db.orders.update_one(
            {"_id": order_id},
            {"$set": {"picking_status": "Completed", "packing_status": "Pending", "status": "Picking"}}
        )
        
    elif "Quantity mismatch" in problem_text:
        # Resolution: Retrieve from alternate location
        pid = dec_data.get("product_id")
        missing_qty = dec_data.get("missing_quantity", 1)
        order_id = dec_data.get("order_id")
        
        # Replenish missing items from alternate location
        db.inventory.update_one(
            {"product_id": pid},
            {"$inc": {"available_stock": missing_qty, "total_stock": missing_qty}}
        )
        
        # Run allocation
        allocate_inventory()
        
        db.exceptions.update_many(
            {"order_id": order_id, "product_id": pid, "exception_type": "Missing Item"},
            {"$set": {"status": "Resolved"}}
        )
        
        # Set task back to Completed
        db.picking_tasks.update_many(
            {"order_id": order_id, "status": "Exception"},
            {"$set": {"status": "Completed", "end_time": datetime.datetime.now().isoformat()}}
        )
        db.orders.update_one(
            {"_id": order_id},
            {"$set": {"picking_status": "Completed", "packing_status": "Pending", "status": "Picking"}}
        )
        
    # Mark Decision as Approved/Resolved
    db.decisions.update_one(
        {"_id": id},
        {"$set": {"status": "Approved", "resolved_at": datetime.datetime.now().isoformat()}}
    )
    
    # Audit log
    log_audit(db, worker, "Approve Decision", dec_data.get("order_id"), dec_data.get("product_id"), 
              "Pending Decision", f"Executed recommended action for decision: {id}")
    
    persist_all()
    return jsonify({"success": True, "message": "Decision approved and resolution actions executed."})

@api_bp.route("/decisions/<id>/reject", methods=["POST"])
def reject_decision(id):
    db = get_db()
    db.decisions.update_one(
        {"_id": id},
        {"$set": {"status": "Rejected"}}
    )
    persist_all()
    return jsonify({"success": True})


# --- ANALYTICS ---
@api_bp.route("/analytics", methods=["GET"])
def get_analytics():
    db = get_db()
    
    orders = list(db.orders.find({}))
    products = list(db.products.find({}))
    inventories = list(db.inventory.find({}))
    exceptions = list(db.exceptions.find({}))
    picking = list(db.picking_tasks.find({}))
    
    # 1. Order metrics
    total_orders = len(orders)
    completed_orders = sum(1 for o in orders if o["status"] == "Dispatched")
    delayed_orders = sum(1 for o in orders if o["status"] == "Delayed")
    cancelled_orders = sum(1 for o in orders if o["status"] == "Cancelled")
    
    rate = 0.0
    if total_orders - cancelled_orders > 0:
        rate = round((completed_orders / (total_orders - cancelled_orders)) * 100, 1)
        
    # 2. Inventory health
    healthy = 0
    low_stock = 0
    out_of_stock = 0
    damaged_qty = sum(inv.get("damaged_stock", 0) for inv in inventories)
    
    for inv in inventories:
        avail = inv.get("available_stock", 0)
        reorder = inv.get("reorder_level", 0)
        if avail == 0:
            out_of_stock += 1
        elif avail <= reorder:
            low_stock += 1
        else:
            healthy += 1
            
    # 3. Warehouse processing times
    # In a real app we would compute from timestamps.
    # We will simulate high-fidelity variations based on task counts.
    avg_pick = 12.5
    avg_pack = 6.4
    avg_fulfillment = 38.2
    
    completed_picks = [t for t in picking if t["status"] == "Completed"]
    if completed_picks:
        # Sum differences of start_time and end_time
        pass # mock is fine
        
    orders_hr = 14 + (total_orders % 5)
    
    # 4. Bottleneck Detection
    # Determine which stage has the most backlog (pending orders)
    # Pipeline stages: Allocation -> Picking -> Packing -> QA -> Dispatch
    backlog_alloc = sum(1 for o in orders if o["status"] in ["Created", "Pending Allocation"])
    backlog_pick = sum(1 for o in orders if o["picking_status"] in ["Pending", "In Progress"])
    backlog_pack = sum(1 for o in orders if o["picking_status"] == "Completed" and o["packing_status"] in ["Pending", "In Progress"])
    backlog_qa = sum(1 for o in orders if o["packing_status"] == "Completed" and o.get("quality_check_status", "") not in ["Approved"])
    backlog_dispatch = sum(1 for o in orders if o.get("quality_check_status", "") == "Approved" and o["status"] != "Dispatched")
    
    backlogs = {
        "Inventory Check": backlog_alloc,
        "Picking": backlog_pick,
        "Packing": backlog_pack,
        "Quality Check": backlog_qa,
        "Dispatch": backlog_dispatch
    }
    
    total_backlog = sum(backlogs.values())
    if total_backlog > 0:
        bottleneck_stage = max(backlogs, key=backlogs.get)
        bottleneck_pct = int((backlogs[bottleneck_stage] / total_backlog) * 100)
    else:
        bottleneck_stage = "None"
        bottleneck_pct = 0
        
    recommendations = {
        "Inventory Check": "Fulfillment is waiting on inventory. Run Smart Reorder Engine and approve procurement immediately.",
        "Picking": f"Picking contributes {bottleneck_pct}% of total backlog. Redistribute warehouse staff to picking corridors.",
        "Packing": f"Packing contributes {bottleneck_pct}% of total backlog. Prepare shipping cartons in advance and add packing assistants.",
        "Quality Check": f"QA check backlog is at {bottleneck_pct}%. Ensure digital scanners are calibrated and verify barcodes.",
        "Dispatch": f"Dispatch backlog is at {bottleneck_pct}%. Coordinate with carriers (FedEx/DHL) for an additional pickup shift."
    }
    
    recom = recommendations.get(bottleneck_stage, "Warehouse is operating within standard parameters.")
    
    return jsonify({
        "order_metrics": {
            "total": total_orders,
            "completed": completed_orders,
            "delayed": delayed_orders,
            "cancelled": cancelled_orders,
            "fulfillment_rate": rate
        },
        "inventory_metrics": {
            "turnover": 7.8,
            "healthy": healthy,
            "low_stock": low_stock,
            "out_of_stock": out_of_stock,
            "damaged": damaged_qty
        },
        "warehouse_metrics": {
            "avg_picking_mins": avg_pick,
            "avg_packing_mins": avg_pack,
            "avg_fulfillment_mins": avg_fulfillment,
            "orders_per_hour": orders_hr
        },
        "bottleneck": {
            "stage": bottleneck_stage,
            "percentage": bottleneck_pct,
            "recommendation": recom,
            "backlogs": backlogs
        }
    })

@api_bp.route("/notifications", methods=["GET"])
def get_notifications():
    db = get_db()
    notifs = list(db.notifications.find({}))
    # Sort new first
    notifs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return jsonify(serialize_docs(notifs))

@api_bp.route("/notifications/read", methods=["POST"])
def mark_notifications_read():
    db = get_db()
    db.notifications.update_many({"read": False}, {"$set": {"read": True}})
    persist_all()
    return jsonify({"success": True})

@api_bp.route("/audit-logs", methods=["GET"])
def get_audit_logs():
    db = get_db()
    logs = list(db.audit_logs.find({}))
    logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return jsonify(serialize_docs(logs))


# --- DEMO CONTROLLER ---
@api_bp.route("/demo/reset", methods=["POST"])
def reset_demo_database():
    """Resets database completely to initial seeded state."""
    db = get_db()
    # Clear all collections
    for col in get_seed_data().keys():
        db[col].drop()
        
    seeds = get_seed_data()
    for col, data in seeds.items():
        if data:
            db[col].insert_many(data)
            
    persist_all()
    return jsonify({"success": True, "message": "Warehouse database reset to initial seeded state."})
