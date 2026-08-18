import datetime
from database.db import get_db, persist_all
from services.priority_engine import calculate_priority_score

def allocate_inventory(strategy="Priority First"):
    """
    Executes smart inventory allocation for all pending/created orders.
    
    Strategies:
    - 'Priority First': Order by priority score descending.
    - 'Earliest Due Date': Order by due date ascending.
    - 'VIP First': Order by VIP, Premium, Regular.
    - 'Fair Share': Allocate proportionally based on demand.
    """
    db = get_db()
    
    # 1. Fetch all active products and their inventory
    inventories = list(db.inventory.find({}))
    inventory_map = {inv["product_id"]: inv for inv in inventories}
    
    # 2. Fetch all orders that need allocation
    # Statuses: Created, Pending Allocation, Partially Allocated
    orders = list(db.orders.find({"status": {"$in": ["Created", "Pending Allocation", "Partially Allocated"]}}))
    
    if not orders:
        return {"message": "No pending orders to allocate", "allocations": []}
        
    # Recalculate priority scores for all these orders first
    for order in orders:
        priority_details = calculate_priority_score(order)
        db.orders.update_one(
            {"_id": order["_id"]},
            {"$set": {"priority_score": priority_details["score"], "priority": priority_details["classification"]}}
        )
        order["priority_score"] = priority_details["score"]
        order["priority"] = priority_details["classification"]
        
    # Group orders by product demand
    product_demands = {} # product_id -> list of (order, requested_item)
    for order in orders:
        for item in order.get("items", []):
            req_qty = item.get("quantity", 0)
            allocated = item.get("allocated", 0)
            needed = req_qty - allocated
            if needed > 0:
                pid = item["product_id"]
                if pid not in product_demands:
                    product_demands[pid] = []
                product_demands[pid].append((order, item, needed))
                
    allocations_made = []
    
    # Process allocation product by product
    for pid, demands in product_demands.items():
        inv = inventory_map.get(pid)
        if not inv:
            continue
            
        available = inv.get("available_stock", 0)
        total_needed = sum(needed for _, _, needed in demands)
        
        # Look up product name for auditing/reporting
        product_doc = db.products.find_one({"_id": pid})
        p_name = product_doc["name"] if product_doc else pid
        
        if total_needed <= available:
            # We have enough stock for all demands of this product
            for order, item, needed in demands:
                item["allocated"] = item.get("allocated", 0) + needed
                # Update order in DB
                db.orders.update_one(
                    {"_id": order["_id"], "items.product_id": pid},
                    {"$set": {"items.$.allocated": item["allocated"]}}
                )
                
                # Update inventory
                db.inventory.update_one(
                    {"product_id": pid},
                    {
                        "$inc": {"available_stock": -needed, "reserved_stock": needed},
                        "$set": {"status": "Low Stock" if (available - needed) <= inv["reorder_level"] else "Healthy"}
                    }
                )
                
                # Check order completeness
                check_order_allocation_completion(db, order["_id"])
                
                # Log audit
                log_audit(db, "System", "Allocation Success", order["_id"], pid, 
                          f"Available: {available}", f"Allocated {needed} units to {order['_id']}")
                
            # Update local tracking
            inv["available_stock"] -= total_needed
            inv["reserved_stock"] += total_needed
            
        else:
            # Shortage Detected!
            shortage = total_needed - available
            
            # Sort demands based on strategy
            if strategy == "Priority First":
                demands.sort(key=lambda x: x[0].get("priority_score", 0), reverse=True)
            elif strategy == "Earliest Due Date":
                demands.sort(key=lambda x: x[0].get("due_date", ""))
            elif strategy == "VIP First":
                tier_rank = {"VIP": 3, "Premium": 2, "Regular": 1}
                demands.sort(key=lambda x: tier_rank.get(x[0].get("customer_type", "Regular"), 1), reverse=True)
            elif strategy == "Fair Share":
                # Allocate proportionally: allocation = available * (needed / total_needed)
                # Keep track of fractional parts to distribute remainders
                pass # We will handle Fair Share separately below
                
            if strategy != "Fair Share":
                # Sequentially allocate stock to sorted orders
                remaining_stock = available
                for order, item, needed in demands:
                    if remaining_stock <= 0:
                        # No stock left for this order
                        recommend_replenishment(db, order, pid, needed, 0, strategy, p_name)
                        continue
                        
                    to_allocate = min(needed, remaining_stock)
                    item["allocated"] = item.get("allocated", 0) + to_allocate
                    remaining_stock -= to_allocate
                    
                    # Update order in DB
                    db.orders.update_one(
                        {"_id": order["_id"], "items.product_id": pid},
                        {"$set": {"items.$.allocated": item["allocated"]}}
                    )
                    
                    # Update inventory
                    db.inventory.update_one(
                        {"product_id": pid},
                        {
                            "$inc": {"available_stock": -to_allocate, "reserved_stock": to_allocate},
                            "$set": {"status": "Out of Stock" if (available - to_allocate) == 0 else "Low Stock" if (available - to_allocate) <= inv["reorder_level"] else "Healthy"}
                        }
                    )
                    
                    # Check order completeness
                    check_order_allocation_completion(db, order["_id"])
                    
                    # Log audit
                    log_audit(db, "System", "Partial Allocation", order["_id"], pid, 
                              f"Shortage of {shortage}", f"Allocated {to_allocate}/{needed} units. Strategy: {strategy}")
                    
                    # Create Decision/Exception if partial
                    if to_allocate < needed:
                        recommend_replenishment(db, order, pid, needed, to_allocate, strategy, p_name)
                        
                inv["available_stock"] = remaining_stock
                inv["reserved_stock"] += (available - remaining_stock)
                
            else:
                # Fair Share strategy
                remaining_stock = available
                allocated_amounts = []
                for order, item, needed in demands:
                    share = int(available * (needed / total_needed))
                    allocated_amounts.append(share)
                
                # Distribute remainder
                remainder = available - sum(allocated_amounts)
                # Give remainder to highest priority orders
                sorted_indices = sorted(range(len(demands)), key=lambda k: demands[k][0].get("priority_score", 0), reverse=True)
                for idx in sorted_indices[:remainder]:
                    allocated_amounts[idx] += 1
                    
                for i, (order, item, needed) in enumerate(demands):
                    to_allocate = allocated_amounts[i]
                    if to_allocate > 0:
                        item["allocated"] = item.get("allocated", 0) + to_allocate
                        
                        db.orders.update_one(
                            {"_id": order["_id"], "items.product_id": pid},
                            {"$set": {"items.$.allocated": item["allocated"]}}
                        )
                        
                        db.inventory.update_one(
                            {"product_id": pid},
                            {
                                "$inc": {"available_stock": -to_allocate, "reserved_stock": to_allocate},
                                "$set": {"status": "Out of Stock" if (available - to_allocate) == 0 else "Low Stock" if (available - to_allocate) <= inv["reorder_level"] else "Healthy"}
                            }
                        )
                        
                        check_order_allocation_completion(db, order["_id"])
                        
                        log_audit(db, "System", "Fair Share Allocation", order["_id"], pid, 
                                  f"Shortage of {shortage}", f"Allocated {to_allocate}/{needed} units. Strategy: Fair Share")
                    
                    if to_allocate < needed:
                        recommend_replenishment(db, order, pid, needed, to_allocate, "Fair Share", p_name)
                
                inv["available_stock"] = 0
                inv["reserved_stock"] += available
                
    persist_all()
    return {"message": "Allocation completed successfully", "strategy_used": strategy}

def check_order_allocation_completion(db, order_id):
    """Updates order status based on item allocations."""
    order = db.orders.find_one({"_id": order_id})
    if not order:
        return
        
    total_items = len(order.get("items", []))
    allocated_count = 0
    partially_allocated_count = 0
    
    for item in order.get("items", []):
        qty = item.get("quantity", 0)
        alloc = item.get("allocated", 0)
        if alloc >= qty:
            allocated_count += 1
        elif alloc > 0:
            partially_allocated_count += 1
            
    if allocated_count == total_items:
        new_status = "Fully Allocated"
        alloc_status = "Fully Allocated"
    elif allocated_count > 0 or partially_allocated_count > 0:
        new_status = "Partially Allocated"
        alloc_status = "Partially Allocated"
    else:
        new_status = "Created"
        alloc_status = "Pending Allocation"
        
    db.orders.update_one(
        {"_id": order_id},
        {"$set": {"status": new_status, "allocation_status": alloc_status}}
    )

def recommend_replenishment(db, order, product_id, needed, allocated, strategy, product_name):
    """Creates Exception and Decision Center entries for shortages."""
    short_qty = needed - allocated
    order_id = order["_id"]
    priority_score = order.get("priority_score", 50)
    
    # 1. Create Stock Shortage Exception
    exc_id = f"EXC-SHR-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{order_id[-4:]}"
    db.exceptions.insert_one({
        "_id": exc_id,
        "exception_type": "Stock Shortage",
        "severity": "Critical" if priority_score >= 80 else "High" if priority_score >= 60 else "Medium",
        "order_id": order_id,
        "product_id": product_id,
        "problem": f"Stock Shortage: Order {order_id} requires {needed} units of '{product_name}' but only {allocated} could be allocated.",
        "impact": f"High priority order {order_id} (Score: {priority_score}) is stuck at {allocated}/{needed} units allocated.",
        "recommended_action": f"Allocate available {allocated} units. Replenish remaining {short_qty} units immediately.",
        "status": "Active",
        "timestamp": datetime.datetime.now().isoformat()
    })
    
    # 2. Create Decision in Decision Center
    dec_id = f"DEC-SHR-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{order_id[-4:]}"
    db.decisions.insert_one({
        "_id": dec_id,
        "problem": f"Stock Shortage of '{product_name}' for Order {order_id}.",
        "data": {
            "order_id": order_id,
            "product_id": product_id,
            "required": needed,
            "allocated": allocated,
            "shortage": short_qty,
            "priority_score": priority_score,
            "strategy": strategy
        },
        "decision": f"Allocate {allocated} units to {order_id} and wait for replenishment of {short_qty} units.",
        "reason": f"{order_id} has a high priority score of {priority_score} compared to other competing orders. Strategy used: {strategy}.",
        "impact": f"Partially fulfills {order_id} immediately. Order remains on hold for dispatch until the replenishment of {short_qty} units is received.",
        "recommended_action": f"Approve immediate replenishment reorder of {short_qty} units for '{product_name}'.",
        "status": "Pending",
        "timestamp": datetime.datetime.now().isoformat()
    })
    
    # 3. Create Notification
    ntf_id = f"NTF-SHR-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{order_id[-4:]}"
    db.notifications.insert_one({
        "_id": ntf_id,
        "type": "critical" if priority_score >= 80 else "warning",
        "title": "Inventory Shortage",
        "message": f"Order {order_id} requires {needed} units of '{product_name}' but only {allocated} units are available.",
        "timestamp": datetime.datetime.now().isoformat(),
        "read": False
    })

def log_audit(db, user, action, order_id, product_id, prev_val, new_val):
    """Utility to log system audit records."""
    import random
    rand_suffix = "".join(random.choices("0123456789abcdef", k=4))
    audit_id = f"AUD-{datetime.datetime.now().strftime('%y%m%d%H%M%S')}-{rand_suffix}-{order_id[-4:] if order_id else 'SYS'}"
    db.audit_logs.insert_one({
        "_id": audit_id,
        "user": user,
        "action": action,
        "order_id": order_id,
        "product_id": product_id,
        "previous_value": prev_val,
        "new_value": new_val,
        "timestamp": datetime.datetime.now().isoformat()
    })
