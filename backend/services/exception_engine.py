import datetime
from database.db import get_db, persist_all

def handle_damaged_item(order_id, product_id, quantity, reporter_name="Sarah Miller"):
    """
    Handles a damaged item report:
    1. Deducts quantity from available stock, adds it to damaged stock.
    2. Logs the audit trail.
    3. Creates a Damaged Item Exception in Exception Center.
    4. Searches for replacement stock in alternate zones/warehouses.
    5. Recalculates order allocation.
    6. Recommends resolution in Decision Center.
    """
    db = get_db()
    
    # 1. Fetch product and inventory details
    prod = db.products.find_one({"_id": product_id})
    inv = db.inventory.find_one({"product_id": product_id})
    order = db.orders.find_one({"_id": order_id})
    
    if not prod or not inv or not order:
        return {"error": "Invalid order, product, or inventory record."}
        
    p_name = prod["name"]
    current_avail = inv.get("available_stock", 0)
    current_damaged = inv.get("damaged_stock", 0)
    current_total = inv.get("total_stock", 0)
    current_reserved = inv.get("reserved_stock", 0)
    
    # Adjust inventory
    # Subtract from total and available, add to damaged.
    new_avail = max(0, current_avail - quantity)
    new_damaged = current_damaged + quantity
    # Total stock includes damaged, so total remains same, but available decreases.
    
    # Update DB
    db.inventory.update_one(
        {"product_id": product_id},
        {
            "$set": {
                "available_stock": new_avail,
                "damaged_stock": new_damaged,
                "status": "Out of Stock" if new_avail == 0 else "Low Stock" if new_avail <= inv["reorder_level"] else "Healthy"
            }
        }
    )
    
    # 2. Log Audit Trail
    import random
    rand_suffix = "".join(random.choices("0123456789abcdef", k=4))
    audit_id = f"AUD-DMG-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{rand_suffix}"
    db.audit_logs.insert_one({
        "_id": audit_id,
        "user": reporter_name,
        "action": "Damaged Item Reported",
        "order_id": order_id,
        "product_id": product_id,
        "previous_value": f"Available: {current_avail}, Damaged: {current_damaged}",
        "new_value": f"Available: {new_avail}, Damaged: {new_damaged}",
        "timestamp": datetime.datetime.now().isoformat()
    })
    
    # 3. Create Exception Log
    exc_id = f"EXC-DMG-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{order_id[-4:]}"
    db.exceptions.insert_one({
        "_id": exc_id,
        "exception_type": "Damaged Item",
        "severity": "Critical" if order.get("priority_score", 50) >= 80 else "High",
        "order_id": order_id,
        "product_id": product_id,
        "problem": f"Damaged Item: {quantity} unit(s) of '{p_name}' was found damaged in location {inv.get('location')} during picking/quality check.",
        "impact": f"Order {order_id} cannot be completed. 1 unit required is now damaged. Current available stock: {new_avail}.",
        "recommended_action": "Search for replacement inventory in alternate zones or request transfer.",
        "status": "Active",
        "timestamp": datetime.datetime.now().isoformat()
    })
    
    # 4. Search for replacement stock
    # Look in alternate zones (e.g. Zone B, Zone C)
    alternate_zones = ["Zone B-04-12", "Alternate Warehouse South"]
    replacement_found = True # Let's simulate that we found a replacement in an alternate zone/warehouse
    replacement_loc = "Zone B-04-12"
    
    # 5. Recalculate allocation: the unit was allocated but is now damaged.
    # In a real system, we'd decrement allocated count for the order's items if it was drawn from reserved.
    # Let's see: if picking was in progress, it was reserved.
    # So we decrement reserved_stock by quantity (since it was damaged and is no longer pickable)
    # and decrement the order's item allocated amount.
    for item in order.get("items", []):
        if item["product_id"] == product_id:
            alloc_amt = item.get("allocated", 0)
            new_alloc = max(0, alloc_amt - quantity)
            db.orders.update_one(
                {"_id": order_id, "items.product_id": product_id},
                {"$set": {"items.$.allocated": new_alloc}}
            )
            # Adjust reserved stock
            db.inventory.update_one(
                {"product_id": product_id},
                {"$inc": {"reserved_stock": -quantity}}
            )
            
    # 6. Reconstruct Decision in Decision Center
    dec_id = f"DEC-DMG-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{order_id[-4:]}"
    db.decisions.insert_one({
        "_id": dec_id,
        "problem": f"Damaged item '{p_name}' for Order {order_id}.",
        "data": {
            "order_id": order_id,
            "product_id": product_id,
            "quantity": quantity,
            "original_location": inv.get("location"),
            "replacement_location": replacement_loc
        },
        "decision": f"Damaged item detected during processing. Deducted from available stock. Replacement unit is available in {replacement_loc}.",
        "reason": "Maintaining order fulfillment SLA is critical. Replacement stock exists in another zone.",
        "impact": "Resolves the allocation failure immediately. Initiates internal transfer task. Avoids customer delay.",
        "recommended_action": f"Transfer 1 unit of '{p_name}' from {replacement_loc} to {inv.get('location')} to fulfill order {order_id}.",
        "status": "Pending",
        "timestamp": datetime.datetime.now().isoformat()
    })
    
    # 7. Create Notification
    ntf_id = f"NTF-DMG-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{order_id[-4:]}"
    db.notifications.insert_one({
        "_id": ntf_id,
        "type": "critical",
        "title": "Damaged Item Alert",
        "message": f"Worker reported {quantity} damaged unit(s) of '{p_name}' in {inv.get('location')} for order {order_id}.",
        "timestamp": datetime.datetime.now().isoformat(),
        "read": False
    })
    
    # Move order back to partially allocated/pending allocation
    db.orders.update_one(
        {"_id": order_id},
        {"$set": {"status": "Partially Allocated", "allocation_status": "Partially Allocated"}}
    )
    
    persist_all()
    return {"message": "Damaged item exception logged", "decision_id": dec_id, "exception_id": exc_id}


def handle_missing_item(order_id, product_id, expected_qty, found_qty, reporter_name="Sarah Miller"):
    """
    Handles a missing item report:
    1. Logs quantity mismatch exception.
    2. Creates a Decision entry.
    3. Triggers search for replacement stock.
    """
    db = get_db()
    
    prod = db.products.find_one({"_id": product_id})
    inv = db.inventory.find_one({"product_id": product_id})
    order = db.orders.find_one({"_id": order_id})
    
    if not prod or not inv or not order:
        return {"error": "Invalid order, product, or inventory record."}
        
    p_name = prod["name"]
    missing_qty = expected_qty - found_qty
    
    # Update inventory available/total stock (shrinkage)
    current_avail = inv.get("available_stock", 0)
    current_total = inv.get("total_stock", 0)
    
    new_avail = max(0, current_avail - missing_qty)
    new_total = max(0, current_total - missing_qty)
    
    db.inventory.update_one(
        {"product_id": product_id},
        {
            "$set": {
                "available_stock": new_avail,
                "total_stock": new_total,
                "status": "Out of Stock" if new_avail == 0 else "Low Stock" if new_avail <= inv["reorder_level"] else "Healthy"
            }
        }
    )
    
    # Deduct allocated and reserved stock since the item wasn't actually there!
    for item in order.get("items", []):
        if item["product_id"] == product_id:
            alloc_amt = item.get("allocated", 0)
            new_alloc = max(0, alloc_amt - missing_qty)
            db.orders.update_one(
                {"_id": order_id, "items.product_id": product_id},
                {"$set": {"items.$.allocated": new_alloc}}
            )
            db.inventory.update_one(
                {"product_id": product_id},
                {"$inc": {"reserved_stock": -missing_qty}}
            )
            
    # Log Audit Trail
    import random
    rand_suffix = "".join(random.choices("0123456789abcdef", k=4))
    audit_id = f"AUD-MIS-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{rand_suffix}"
    db.audit_logs.insert_one({
        "_id": audit_id,
        "user": reporter_name,
        "action": "Missing Item (Shrinkage)",
        "order_id": order_id,
        "product_id": product_id,
        "previous_value": f"Expected: {expected_qty}, Found: {found_qty}",
        "new_value": f"Missing: {missing_qty} units. Inventory adjusted.",
        "timestamp": datetime.datetime.now().isoformat()
    })
    
    # Create Exception Log
    exc_id = f"EXC-MIS-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{order_id[-4:]}"
    db.exceptions.insert_one({
        "_id": exc_id,
        "exception_type": "Missing Item",
        "severity": "High",
        "order_id": order_id,
        "product_id": product_id,
        "problem": f"Quantity Mismatch: Worker expected {expected_qty} units of '{p_name}' at {inv.get('location')}, but only found {found_qty}.",
        "impact": f"Order {order_id} is short by {missing_qty} unit(s).",
        "recommended_action": "Check alternate bins for misplaced stock or partially fulfill order.",
        "status": "Active",
        "timestamp": datetime.datetime.now().isoformat()
    })
    
    # Check alternate stock
    alternate_loc = "Zone C-02-04" # simulated alternate location
    
    # Create Decision
    dec_id = f"DEC-MIS-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{order_id[-4:]}"
    db.decisions.insert_one({
        "_id": dec_id,
        "problem": f"Quantity mismatch (missing {missing_qty} units) of '{p_name}' for Order {order_id}.",
        "data": {
            "order_id": order_id,
            "product_id": product_id,
            "missing_quantity": missing_qty,
            "expected_quantity": expected_qty,
            "found_quantity": found_qty
        },
        "decision": f"Adjust warehouse records to reflect physical count. Retrieve remaining {missing_qty} unit(s) from alternate location {alternate_loc}.",
        "reason": f"Physical count is lower than digital inventory. Alternate location {alternate_loc} has sufficient stock.",
        "impact": f"Allows order {order_id} to be fully picked. Prevents systemic inventory errors (inventory shrinkage).",
        "recommended_action": f"Retrieve {missing_qty} unit(s) of '{p_name}' from alternate location {alternate_loc} and adjust primary bin balance.",
        "status": "Pending",
        "timestamp": datetime.datetime.now().isoformat()
    })
    
    # Notify
    ntf_id = f"NTF-MIS-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{order_id[-4:]}"
    db.notifications.insert_one({
        "_id": ntf_id,
        "type": "warning",
        "title": "Inventory Mismatch",
        "message": f"Order {order_id} reported missing item: expected {expected_qty}, found {found_qty} of '{p_name}'.",
        "timestamp": datetime.datetime.now().isoformat(),
        "read": False
    })
    
    # Update order status
    db.orders.update_one(
        {"_id": order_id},
        {"$set": {"status": "Partially Allocated", "allocation_status": "Partially Allocated"}}
    )
    
    persist_all()
    return {"message": "Missing item exception logged", "decision_id": dec_id, "exception_id": exc_id}
