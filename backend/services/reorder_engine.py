import math
from database.db import get_db

def analyze_reorders():
    """
    Evaluates all products to see if they need reordering based on the inventory levels.
    
    Formula:
    Recommended Stock = Avg Daily Demand * Lead Time + Safety Stock
    Recommended Reorder Quantity = Recommended Stock - Current Available Stock
    """
    db = get_db()
    
    inventories = list(db.inventory.find({}))
    products = list(db.products.find({}))
    product_map = {p["_id"]: p for p in products}
    
    recommendations = []
    
    for inv in inventories:
        pid = inv["product_id"]
        prod = product_map.get(pid)
        if not prod:
            continue
            
        avail = inv.get("available_stock", 0)
        reorder_lvl = inv.get("reorder_level", 0)
        
        # If available stock is at or below the reorder level, trigger recommendation
        if avail <= reorder_lvl:
            avg_demand = inv.get("avg_daily_demand", 0)
            lead_time = inv.get("lead_time", 0)
            safety = inv.get("safety_stock", 0)
            
            # Calculations
            recommended_stock = (avg_demand * lead_time) + safety
            recommended_qty = max(0, recommended_stock - avail)
            
            if recommended_qty == 0:
                continue
                
            # Determine Urgency
            if avail == 0:
                urgency = "Critical"
            elif avail <= safety:
                urgency = "High"
            else:
                urgency = "Medium"
                
            # Explanation
            reason = (
                f"Available stock ({avail}) is below the reorder level ({reorder_lvl}). "
                f"Formula: (Avg Daily Demand '{avg_demand}' * Lead Time '{lead_time}' days) + Safety Stock '{safety}' = "
                f"Recommended Stock '{recommended_stock}'. "
                f"Reorder quantity required: {recommended_stock} - {avail} = {recommended_qty}."
            )
            
            recommendations.append({
                "product_id": pid,
                "sku": prod.get("sku"),
                "name": prod.get("name"),
                "category": prod.get("category"),
                "current_stock": avail,
                "reorder_level": reorder_lvl,
                "safety_stock": safety,
                "predicted_demand": avg_demand * lead_time,
                "recommended_quantity": recommended_qty,
                "urgency": urgency,
                "reason": reason,
                "location": inv.get("location")
            })
            
    # Sort recommendations by urgency: Critical first, then High, then Medium
    urgency_ranks = {"Critical": 3, "High": 2, "Medium": 1}
    recommendations.sort(key=lambda x: urgency_ranks.get(x["urgency"], 0), reverse=True)
    
    return recommendations
