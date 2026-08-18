import datetime

def get_seed_data():
    now = datetime.datetime.now()
    
    # 1. Users
    users = [
        {
            "_id": "usr-001",
            "email": "admin@smartfulfill.com",
            "password": "password123", # simple simulated auth
            "name": "Alex Carter",
            "role": "Warehouse Manager",
            "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces"
        },
        {
            "_id": "usr-002",
            "email": "picker1@smartfulfill.com",
            "password": "password123",
            "name": "Sarah Miller",
            "role": "Inventory Picker",
            "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces"
        }
    ]
    
    # 2. Products (30+ items)
    products = [
        # Medical
        {"_id": "PROD-MED01", "sku": "MED-KIT-001", "name": "Medical Emergency Kit", "category": "Medical", "description": "Industrial grade first aid emergency kit."},
        {"_id": "PROD-MED02", "sku": "MED-MSK-100", "name": "N95 Respirator Masks (100pk)", "category": "Medical", "description": "Particulate respirator masks."},
        {"_id": "PROD-MED03", "sku": "MED-GLV-500", "name": "Nitrile Exam Gloves (500pk)", "category": "Medical", "description": "Powder-free medical gloves."},
        
        # Electronics / Computer Accessories
        {"_id": "PROD-ELE01", "sku": "ELE-MOU-002", "name": "Wireless Ergonomic Mouse", "category": "Electronics", "description": "Rechargeable silent optical mouse."},
        {"_id": "PROD-ELE02", "sku": "ELE-KEY-104", "name": "Mechanical Keyboard Blue Switch", "category": "Electronics", "description": "RGB back-lit tactile keyboard."},
        {"_id": "PROD-ELE03", "sku": "ELE-MON-027", "name": "27-inch 4K UHD Monitor", "category": "Electronics", "description": "IPS panel color-accurate monitor."},
        {"_id": "PROD-ELE04", "sku": "ELE-SSD-001", "name": "1TB NVMe M.2 SSD", "category": "Electronics", "description": "High speed solid state drive."},
        {"_id": "PROD-ELE05", "sku": "ELE-CHG-065", "name": "65W USB-C GaN Charger", "category": "Electronics", "description": "Compact fast charging brick."},
        {"_id": "PROD-ELE06", "sku": "ELE-HDM-010", "name": "10ft High-Speed HDMI Cable", "category": "Electronics", "description": "Supports 4K @ 120Hz."},
        {"_id": "PROD-ELE07", "sku": "ELE-HDP-300", "name": "Active Noise Cancelling Headphones", "category": "Electronics", "description": "Over-ear bluetooth headphones."},
        {"_id": "PROD-ELE08", "sku": "ELE-WBC-108", "name": "1080p Auto-Focus Webcam", "category": "Electronics", "description": "Webcam with built-in ring light."},
        {"_id": "PROD-ELE09", "sku": "ELE-WCH-015", "name": "15W Qi Wireless Charging Pad", "category": "Electronics", "description": "Fast wireless desktop charger."},
        {"_id": "PROD-ELE10", "sku": "ELE-USB-128", "name": "128GB USB 3.2 Flash Drive", "category": "Electronics", "description": "Metal body portable storage."},
        
        # Office Supplies
        {"_id": "PROD-OFF01", "sku": "OFF-NTB-005", "name": "A5 Leatherbound Notebook", "category": "Office", "description": "Dotted grid journal, 120gsm paper."},
        {"_id": "PROD-OFF02", "sku": "OFF-PEN-012", "name": "Gel Ink Pens Assorted (12pk)", "category": "Office", "description": "0.5mm fine tip smooth gel pens."},
        {"_id": "PROD-OFF03", "sku": "OFF-STP-001", "name": "Heavy Duty Desk Stapler", "category": "Office", "description": "All metal stapler, 25 sheet capacity."},
        {"_id": "PROD-OFF04", "sku": "OFF-FLP-100", "name": "Letter Size File Folders (100pk)", "category": "Office", "description": "1/3 cut tab manila folders."},
        {"_id": "PROD-OFF05", "sku": "OFF-STN-010", "name": "Sticky Notes 3x3 Yellow (12pk)", "category": "Office", "description": "Super sticky note pads."},
        {"_id": "PROD-OFF06", "sku": "OFF-PCP-500", "name": "Jumbo Paper Clips (500pk)", "category": "Office", "description": "Vinyl coated colored paper clips."},
        {"_id": "PROD-OFF07", "sku": "OFF-SCS-002", "name": "8-inch Titanium Scissors (2pk)", "category": "Office", "description": "Ergonomic soft-grip scissors."},
        
        # Household / Tools / Storage
        {"_id": "PROD-HOU01", "sku": "HOU-WTR-032", "name": "32oz Insulated Water Bottle", "category": "Household", "description": "Double-wall vacuum stainless steel."},
        {"_id": "PROD-HOU02", "sku": "HOU-BKP-025", "name": "Travel Tech Backpack 25L", "category": "Household", "description": "Water-resistant laptop backpack."},
        {"_id": "PROD-HOU03", "sku": "HOU-BAT-AAA", "name": "AAA Alkaline Batteries (48pk)", "category": "Household", "description": "Long lasting 1.5V batteries."},
        {"_id": "PROD-HOU04", "sku": "HOU-BAT-AA0", "name": "AA Alkaline Batteries (48pk)", "category": "Household", "description": "Long lasting 1.5V batteries."},
        {"_id": "PROD-HOU05", "sku": "HOU-SDR-024", "name": "24-in-1 Precision Screwdriver", "category": "Household", "description": "Magnetic driver set for electronics."},
        {"_id": "PROD-HOU06", "sku": "HOU-LMP-001", "name": "LED Smart Desk Lamp", "category": "Household", "description": "Dimmable lamp with USB port."},
        {"_id": "PROD-HOU07", "sku": "HOU-CHR-002", "name": "Ergonomic Mesh Office Chair", "category": "Household", "description": "Adjustable height & lumbar support."},
        {"_id": "PROD-HOU08", "sku": "HOU-MUG-016", "name": "Ceramic Travel Mug 16oz", "category": "Household", "description": "Splash-proof lid insulated mug."},
        {"_id": "PROD-HOU09", "sku": "HOU-FLS-300", "name": "Tactical LED Flashlight 1000lm", "category": "Household", "description": "Waterproof zoomable flashlight."},
        {"_id": "PROD-HOU10", "sku": "HOU-ORG-003", "name": "Desktop Organizer Tray", "category": "Household", "description": "3-tier wire mesh desk file tray."},
        {"_id": "PROD-HOU11", "sku": "HOU-TME-001", "name": "Digital Kitchen Timer", "category": "Household", "description": "Loud alarm large LCD display."}
    ]
    
    # 3. Inventory (associated with products)
    # Status rules: IF availableStock == 0 -> Out of Stock, ELIF availableStock <= reorderLevel -> Low Stock, ELSE -> Healthy
    # Damaged items can exist separately.
    inventory = [
        # Medical (Shortage Demo: Medical kit has 7 units available, safety stock 5, reorder 10)
        {"_id": "INV-01", "product_id": "PROD-MED01", "location": "A-01-05", "total_stock": 7, "available_stock": 7, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 10, "safety_stock": 5, "avg_daily_demand": 2, "lead_time": 5, "status": "Low Stock"},
        {"_id": "INV-02", "product_id": "PROD-MED02", "location": "A-01-06", "total_stock": 45, "available_stock": 45, "reserved_stock": 0, "damaged_stock": 2, "reorder_level": 20, "safety_stock": 10, "avg_daily_demand": 4, "lead_time": 4, "status": "Healthy"},
        {"_id": "INV-03", "product_id": "PROD-MED03", "location": "A-02-01", "total_stock": 12, "available_stock": 12, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 30, "safety_stock": 15, "avg_daily_demand": 8, "lead_time": 5, "status": "Low Stock"}, # Low Stock (12 <= 30)
        
        # Electronics (Some out of stock, some healthy, some low stock)
        {"_id": "INV-04", "product_id": "PROD-ELE01", "location": "B-01-01", "total_stock": 80, "available_stock": 80, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 25, "safety_stock": 10, "avg_daily_demand": 5, "lead_time": 3, "status": "Healthy"},
        {"_id": "INV-05", "product_id": "PROD-ELE02", "location": "B-01-02", "total_stock": 0, "available_stock": 0, "reserved_stock": 0, "damaged_stock": 1, "reorder_level": 15, "safety_stock": 5, "avg_daily_demand": 3, "lead_time": 7, "status": "Out of Stock"}, # Out of stock
        {"_id": "INV-06", "product_id": "PROD-ELE03", "location": "B-02-01", "total_stock": 18, "available_stock": 18, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 10, "safety_stock": 5, "avg_daily_demand": 2, "lead_time": 6, "status": "Healthy"},
        {"_id": "INV-07", "product_id": "PROD-ELE04", "location": "B-02-02", "total_stock": 4, "available_stock": 4, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 15, "safety_stock": 5, "avg_daily_demand": 4, "lead_time": 4, "status": "Low Stock"}, # Low Stock (4 <= 15)
        {"_id": "INV-08", "product_id": "PROD-ELE05", "location": "B-03-01", "total_stock": 150, "available_stock": 150, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 40, "safety_stock": 15, "avg_daily_demand": 10, "lead_time": 3, "status": "Healthy"},
        {"_id": "INV-09", "product_id": "PROD-ELE06", "location": "B-03-02", "total_stock": 9, "available_stock": 9, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 25, "safety_stock": 10, "avg_daily_demand": 6, "lead_time": 4, "status": "Low Stock"}, # Low Stock
        {"_id": "INV-10", "product_id": "PROD-ELE07", "location": "B-04-01", "total_stock": 22, "available_stock": 22, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 12, "safety_stock": 5, "avg_daily_demand": 2, "lead_time": 5, "status": "Healthy"},
        {"_id": "INV-11", "product_id": "PROD-ELE08", "location": "B-04-02", "total_stock": 0, "available_stock": 0, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 8, "safety_stock": 3, "avg_daily_demand": 1, "lead_time": 10, "status": "Out of Stock"}, # Out of stock
        {"_id": "INV-12", "product_id": "PROD-ELE09", "location": "B-05-01", "total_stock": 65, "available_stock": 65, "reserved_stock": 0, "damaged_stock": 3, "reorder_level": 20, "safety_stock": 8, "avg_daily_demand": 4, "lead_time": 4, "status": "Healthy"},
        {"_id": "INV-13", "product_id": "PROD-ELE10", "location": "B-05-02", "total_stock": 31, "available_stock": 31, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 30, "safety_stock": 10, "avg_daily_demand": 5, "lead_time": 3, "status": "Healthy"},
        
        # Office Supplies
        {"_id": "INV-14", "product_id": "PROD-OFF01", "location": "C-01-01", "total_stock": 110, "available_stock": 110, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 25, "safety_stock": 10, "avg_daily_demand": 6, "lead_time": 5, "status": "Healthy"},
        {"_id": "INV-15", "product_id": "PROD-OFF02", "location": "C-01-02", "total_stock": 420, "available_stock": 420, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 100, "safety_stock": 40, "avg_daily_demand": 25, "lead_time": 3, "status": "Healthy"},
        {"_id": "INV-16", "product_id": "PROD-OFF03", "location": "C-02-01", "total_stock": 8, "available_stock": 8, "reserved_stock": 0, "damaged_stock": 1, "reorder_level": 12, "safety_stock": 5, "avg_daily_demand": 2, "lead_time": 5, "status": "Low Stock"}, # Low stock
        {"_id": "INV-17", "product_id": "PROD-OFF04", "location": "C-02-02", "total_stock": 300, "available_stock": 300, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 80, "safety_stock": 30, "avg_daily_demand": 20, "lead_time": 4, "status": "Healthy"},
        {"_id": "INV-18", "product_id": "PROD-OFF05", "location": "C-03-01", "total_stock": 25, "available_stock": 25, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 50, "safety_stock": 20, "avg_daily_demand": 12, "lead_time": 3, "status": "Low Stock"}, # Low stock
        {"_id": "INV-19", "product_id": "PROD-OFF06", "location": "C-03-02", "total_stock": 610, "available_stock": 610, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 150, "safety_stock": 50, "avg_daily_demand": 35, "lead_time": 4, "status": "Healthy"},
        {"_id": "INV-20", "product_id": "PROD-OFF07", "location": "C-04-01", "total_stock": 14, "available_stock": 14, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 15, "safety_stock": 5, "avg_daily_demand": 3, "lead_time": 5, "status": "Low Stock"},
        
        # Household
        {"_id": "INV-21", "product_id": "PROD-HOU01", "location": "D-01-01", "total_stock": 85, "available_stock": 85, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 20, "safety_stock": 8, "avg_daily_demand": 4, "lead_time": 4, "status": "Healthy"},
        {"_id": "INV-22", "product_id": "PROD-HOU02", "location": "D-01-02", "total_stock": 19, "available_stock": 19, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 10, "safety_stock": 4, "avg_daily_demand": 1, "lead_time": 8, "status": "Healthy"},
        {"_id": "INV-23", "product_id": "PROD-HOU03", "location": "D-02-01", "total_stock": 35, "available_stock": 35, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 50, "safety_stock": 20, "avg_daily_demand": 15, "lead_time": 3, "status": "Low Stock"}, # Low stock
        {"_id": "INV-24", "product_id": "PROD-HOU04", "location": "D-02-02", "total_stock": 12, "available_stock": 12, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 50, "safety_stock": 20, "avg_daily_demand": 15, "lead_time": 3, "status": "Low Stock"}, # Low stock
        {"_id": "INV-25", "product_id": "PROD-HOU05", "location": "D-03-01", "total_stock": 45, "available_stock": 45, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 15, "safety_stock": 5, "avg_daily_demand": 3, "lead_time": 4, "status": "Healthy"},
        {"_id": "INV-26", "product_id": "PROD-HOU06", "location": "D-03-02", "total_stock": 3, "available_stock": 3, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 8, "safety_stock": 3, "avg_daily_demand": 1, "lead_time": 6, "status": "Low Stock"}, # Low stock
        {"_id": "INV-27", "product_id": "PROD-HOU07", "location": "D-04-01", "total_stock": 15, "available_stock": 15, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 5, "safety_stock": 2, "avg_daily_demand": 0.5, "lead_time": 12, "status": "Healthy"},
        {"_id": "INV-28", "product_id": "PROD-HOU08", "location": "D-04-02", "total_stock": 42, "available_stock": 42, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 15, "safety_stock": 5, "avg_daily_demand": 3, "lead_time": 4, "status": "Healthy"},
        {"_id": "INV-29", "product_id": "PROD-HOU09", "location": "D-05-01", "total_stock": 7, "available_stock": 7, "reserved_stock": 0, "damaged_stock": 1, "reorder_level": 10, "safety_stock": 4, "avg_daily_demand": 2, "lead_time": 5, "status": "Low Stock"}, # Low stock
        {"_id": "INV-30", "product_id": "PROD-HOU10", "location": "D-05-02", "total_stock": 28, "available_stock": 28, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 12, "safety_stock": 5, "avg_daily_demand": 2, "lead_time": 5, "status": "Healthy"},
        {"_id": "INV-31", "product_id": "PROD-HOU11", "location": "D-06-01", "total_stock": 0, "available_stock": 0, "reserved_stock": 0, "damaged_stock": 0, "reorder_level": 10, "safety_stock": 4, "avg_daily_demand": 2, "lead_time": 6, "status": "Out of Stock"} # Out of stock
    ]
    
    # 4. Orders (20+ orders)
    orders = [
        # Demo Orders
        {
            "_id": "ORD-1024",
            "customer": "Apex Health Systems",
            "customer_type": "VIP",
            "items": [{"product_id": "PROD-MED01", "quantity": 10, "allocated": 0}],
            "order_date": (now - datetime.timedelta(hours=4)).isoformat(),
            "due_date": (now + datetime.timedelta(hours=4)).isoformat(),
            "urgency": "Critical",
            "delay_risk": "High",
            "priority_score": 94.0, # Will be computed dynamically, but initialized here
            "status": "Created",
            "allocation_status": "Pending Allocation",
            "picking_status": "Pending",
            "packing_status": "Pending",
            "dispatch_status": "Ready",
            "history": [{"status": "Created", "timestamp": (now - datetime.timedelta(hours=4)).isoformat(), "comment": "Order placed online"}]
        },
        {
            "_id": "ORD-1025",
            "customer": "Prime Care Distributors",
            "customer_type": "Premium",
            "items": [{"product_id": "PROD-MED01", "quantity": 5, "allocated": 0}],
            "order_date": (now - datetime.timedelta(hours=2, minutes=36)).isoformat(),
            "due_date": (now + datetime.timedelta(hours=12)).isoformat(),
            "urgency": "Normal",
            "delay_risk": "Medium",
            "priority_score": 58.0,
            "status": "Created",
            "allocation_status": "Pending Allocation",
            "picking_status": "Pending",
            "packing_status": "Pending",
            "dispatch_status": "Ready",
            "history": [{"status": "Created", "timestamp": (now - datetime.timedelta(hours=2, minutes=36)).isoformat(), "comment": "Order placed online"}]
        },
        # Other Seed Orders
        {
            "_id": "ORD-1001",
            "customer": "Global Tech Corp",
            "customer_type": "VIP",
            "items": [{"product_id": "PROD-ELE01", "quantity": 5, "allocated": 5}, {"product_id": "PROD-ELE02", "quantity": 2, "allocated": 0}], # Has shortage item
            "order_date": (now - datetime.timedelta(days=1)).isoformat(),
            "due_date": (now + datetime.timedelta(hours=6)).isoformat(),
            "urgency": "Urgent",
            "delay_risk": "High",
            "priority_score": 75.0,
            "status": "Partially Allocated",
            "allocation_status": "Partially Allocated",
            "picking_status": "Pending",
            "packing_status": "Pending",
            "dispatch_status": "Ready",
            "history": [{"status": "Created", "timestamp": (now - datetime.timedelta(days=1)).isoformat(), "comment": "Order received"}]
        },
        {
            "_id": "ORD-1002",
            "customer": "Standard Office Depot",
            "customer_type": "Regular",
            "items": [{"product_id": "PROD-OFF01", "quantity": 50, "allocated": 50}],
            "order_date": (now - datetime.timedelta(days=1)).isoformat(),
            "due_date": (now - datetime.timedelta(hours=2)).isoformat(), # Overdue
            "urgency": "High",
            "delay_risk": "High",
            "priority_score": 68.0,
            "status": "Delayed",
            "allocation_status": "Fully Allocated",
            "picking_status": "In Progress",
            "packing_status": "Pending",
            "dispatch_status": "Ready",
            "history": [{"status": "Created", "timestamp": (now - datetime.timedelta(days=1)).isoformat(), "comment": "Order received"}]
        },
        {
            "_id": "ORD-1003",
            "customer": "Byte Solutions LLC",
            "customer_type": "Regular",
            "items": [{"product_id": "PROD-ELE05", "quantity": 10, "allocated": 10}],
            "order_date": (now - datetime.timedelta(hours=6)).isoformat(),
            "due_date": (now + datetime.timedelta(days=2)).isoformat(),
            "urgency": "Low",
            "delay_risk": "Low",
            "priority_score": 25.0,
            "status": "Fully Allocated",
            "allocation_status": "Fully Allocated",
            "picking_status": "Pending",
            "packing_status": "Pending",
            "dispatch_status": "Ready",
            "history": []
        }
    ]
    # Add more orders to satisfy "20+ orders"
    for i in range(4, 21):
        cust_types = ["Regular", "Premium", "VIP"]
        urgencies = ["Low", "Normal", "High", "Urgent", "Critical"]
        cust_type = cust_types[i % 3]
        urgency = urgencies[i % 5]
        prod_id = f"PROD-HOU{i%10 + 1:02d}"
        if prod_id == "PROD-HOU11": prod_id = "PROD-HOU10"
        
        due_hours = (i * 4) - 10
        status = "Created"
        alloc_status = "Pending Allocation"
        if i % 3 == 0:
            status = "Fully Allocated"
            alloc_status = "Fully Allocated"
            
        ord_id = f"ORD-10{i:02d}"
        orders.append({
            "_id": ord_id,
            "customer": f"Retail Client {i}",
            "customer_type": cust_type,
            "items": [{"product_id": prod_id, "quantity": i % 4 + 1, "allocated": 0}],
            "order_date": (now - datetime.timedelta(hours=i)).isoformat(),
            "due_date": (now + datetime.timedelta(hours=due_hours)).isoformat(),
            "urgency": urgency,
            "delay_risk": "High" if due_hours < 12 else "Medium" if due_hours < 48 else "Low",
            "priority_score": 15 + (i * 2),
            "status": "Delayed" if due_hours < 0 and status != "Dispatched" else status,
            "allocation_status": alloc_status,
            "picking_status": "Pending",
            "packing_status": "Pending",
            "dispatch_status": "Ready",
            "history": []
        })
        
    # 5. Picking Tasks
    picking_tasks = [
        {
            "_id": "PICK-001",
            "order_id": "ORD-1002",
            "picker": "Sarah Miller",
            "items": [
                {
                    "product_id": "PROD-OFF01",
                    "sku": "OFF-NTB-005",
                    "name": "A5 Leatherbound Notebook",
                    "quantity": 50,
                    "location": "C-01-01",
                    "picked": 0
                }
            ],
            "status": "In Progress",
            "start_time": (now - datetime.timedelta(minutes=30)).isoformat(),
            "estimated_completion": (now + datetime.timedelta(minutes=15)).isoformat(),
            "route": ["C-01-01"],
            "distance_meters": 12.0
        }
    ]
    
    # 6. Packing Tasks
    packing_tasks = []
    
    # 7. Quality Checks
    quality_checks = []
    
    # 8. Dispatches
    dispatches = []
    
    # 9. Exceptions
    exceptions = [
        {
            "_id": "EXC-001",
            "exception_type": "Stock Shortage",
            "severity": "High",
            "order_id": "ORD-1001",
            "product_id": "PROD-ELE02",
            "problem": "Required 2 units of Mechanical Keyboard, but only 0 are available in the warehouse.",
            "impact": "Order ORD-1001 is on hold and cannot be fulfilled.",
            "recommended_action": "Order is short of stock. Safety level exceeded. Replenish immediately. Trigger reorder engine.",
            "status": "Active",
            "timestamp": (now - datetime.timedelta(hours=2)).isoformat()
        }
    ]
    
    # 10. Decisions
    decisions = [
        {
            "_id": "DEC-001",
            "problem": "Inventory shortage of Mechanical Keyboard (PROD-ELE02) for order ORD-1001.",
            "data": {"required": 2, "available": 0, "reorder_level": 15},
            "decision": "Wait for stock replenishment.",
            "reason": "Available inventory is 0 and no alternate location is configured.",
            "impact": "Delivery will be delayed by 5 days (supplier lead time).",
            "recommended_action": "Procure 42 units of PROD-ELE02 immediately (includes safety stock reorder quantity).",
            "status": "Pending",
            "timestamp": (now - datetime.timedelta(hours=2)).isoformat()
        }
    ]
    
    # 11. Notifications
    notifications = [
        {"_id": "NTF-001", "type": "warning", "title": "Low Stock Warning", "message": "Product 'A5 Leatherbound Notebook' is below its safety stock limit.", "timestamp": (now - datetime.timedelta(minutes=45)).isoformat(), "read": False},
        {"_id": "NTF-002", "type": "critical", "title": "Inventory Shortage", "message": "Order ORD-1001 has an unresolvable inventory shortage.", "timestamp": (now - datetime.timedelta(hours=2)).isoformat(), "read": False},
        {"_id": "NTF-003", "type": "alert", "title": "SLA At Risk", "message": "Order ORD-1002 is past its dispatch target SLA.", "timestamp": (now - datetime.timedelta(minutes=15)).isoformat(), "read": False}
    ]
    
    # 12. Audit Logs
    audit_logs = [
        {
            "_id": "AUD-001",
            "user": "System",
            "action": "System Initialization",
            "order_id": None,
            "product_id": None,
            "previous_value": None,
            "new_value": "Initialized database with seed values.",
            "timestamp": (now - datetime.timedelta(days=2)).isoformat()
        },
        {
            "_id": "AUD-002",
            "user": "Alex Carter",
            "action": "Inventory Adjust",
            "order_id": None,
            "product_id": "PROD-MED02",
            "previous_value": "43",
            "new_value": "45 (Found 2 mislaid packages during bin audit)",
            "timestamp": (now - datetime.timedelta(days=1)).isoformat()
        }
    ]
    
    return {
        "users": users,
        "products": products,
        "inventory": inventory,
        "orders": orders,
        "picking_tasks": picking_tasks,
        "packing_tasks": packing_tasks,
        "quality_checks": quality_checks,
        "exceptions": exceptions,
        "dispatches": dispatches,
        "notifications": notifications,
        "decisions": decisions,
        "audit_logs": audit_logs
    }
