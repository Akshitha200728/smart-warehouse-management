import math

def parse_location(loc_str):
    """
    Parses location string 'Zone-Aisle-Shelf' (e.g. 'A-01-05') into parts.
    If parsing fails, returns default values.
    """
    parts = loc_str.split("-")
    zone = "A"
    aisle = 1
    shelf = 1
    
    if len(parts) >= 1:
        zone = parts[0]
    if len(parts) >= 2:
        try:
            aisle = int(parts[1])
        except ValueError:
            aisle = 1
    if len(parts) >= 3:
        try:
            shelf = int(parts[2])
        except ValueError:
            shelf = 1
            
    return zone, aisle, shelf

def get_coordinates(zone, aisle, shelf):
    """
    Calculates simulated 2D grid coordinates (X, Y) for a location in the warehouse.
    Zones: A = 0, B = 30, C = 60, D = 90
    Aisle: Vertical corridors. Distance between aisles = 5m.
    Shelf: Position along the aisle. Distance between shelves = 1.5m.
    """
    zone_x = {"A": 10, "B": 40, "C": 70, "D": 100}
    x_base = zone_x.get(zone, 10)
    
    # Grid coordinate logic:
    # Aisle determines horizontal offset in the zone
    # Shelf determines vertical position
    x = x_base + (aisle * 4)
    y = shelf * 2
    
    return x, y

def optimize_picking_route(items):
    """
    Optimizes the picking route for a list of items using a serpentine (S-Shape) routing path.
    
    Serpentine sorting rule:
    1. Group/Sort by Zone.
    2. Sort by Aisle.
    3. If Aisle is odd, sort Shelf ascending (moving up the aisle).
    4. If Aisle is even, sort Shelf descending (moving down the aisle to return).
    """
    if not items:
        return {
            "route": [],
            "total_distance": 0,
            "estimated_time_mins": 0,
            "locations": []
        }
        
    # Enrich items with location parts and coordinates
    enriched_items = []
    for item in items:
        loc = item.get("location", "A-01-01")
        zone, aisle, shelf = parse_location(loc)
        x, y = get_coordinates(zone, aisle, shelf)
        
        enriched_items.append({
            "original_item": item,
            "location": loc,
            "zone": zone,
            "aisle": aisle,
            "shelf": shelf,
            "x": x,
            "y": y
        })
        
    # Sort: Zone -> Aisle -> Serpentine Shelf
    # Python sorts are stable, so we sort backwards:
    # 1. Sort by shelf (conditionally ascending or descending based on aisle - we'll handle this in custom comparator or key)
    # Actually, we can use a custom sort key:
    # Key: (Zone, Aisle, Shelf if Aisle is odd else -Shelf)
    enriched_items.sort(key=lambda item: (
        item["zone"],
        item["aisle"],
        item["shelf"] if item["aisle"] % 2 != 0 else -item["shelf"]
    ))
    
    # Calculate Manhattan distance along the route
    total_distance = 0.0
    # Start coordinates at warehouse staging area (x=0, y=0)
    curr_x, curr_y = 0, 0
    
    route_path = []
    locations_visited = []
    
    for item in enriched_items:
        dest_x, dest_y = item["x"], item["y"]
        
        # Manhattan distance = |x1 - x2| + |y1 - y2|
        dist = abs(dest_x - curr_x) + abs(dest_y - curr_y)
        total_distance += dist
        
        curr_x, curr_y = dest_x, dest_y
        
        route_path.append(item["original_item"])
        locations_visited.append(item["location"])
        
    # Add distance back to staging area (x=0, y=0)
    total_distance += abs(0 - curr_x) + abs(0 - curr_y)
    
    # Estimated time = walking time + picking time
    # Walking speed = 1.0 m/s (60 m/min)
    # Pick time = 15 seconds per item (0.25 mins)
    walk_time_mins = total_distance / 60.0
    pick_time_mins = len(items) * 0.25
    estimated_time = walk_time_mins + pick_time_mins
    
    return {
        "route": route_path,
        "total_distance": round(total_distance, 1),
        "estimated_time_mins": round(estimated_time, 1),
        "locations": locations_visited
    }
