import datetime
import math

def calculate_priority_score(order):
    """
    Calculates the priority score for an order.
    
    Priority Score = Urgency Score + Customer Score + Delay Risk Score + Order Age Score
    
    Classification:
    - 80+ = Critical
    - 60-79 = Urgent
    - 40-59 = High
    - 20-39 = Normal
    - Below 20 = Low
    """
    # 1. Urgency Score
    urgency_map = {
        "Critical": 50,
        "Urgent": 40,
        "High": 30,
        "Normal": 20,
        "Low": 10
    }
    urgency = order.get("urgency", "Normal")
    urgency_score = urgency_map.get(urgency, 20)
    
    # 2. Customer Score
    customer_map = {
        "VIP": 25,
        "Premium": 15,
        "Regular": 10
    }
    customer_type = order.get("customer_type", "Regular")
    customer_score = customer_map.get(customer_type, 10)
    
    # 3. Delay Risk Score
    delay_risk_map = {
        "High": 20,
        "Medium": 10,
        "Low": 5
    }
    delay_risk = order.get("delay_risk", "Low")
    delay_risk_score = delay_risk_map.get(delay_risk, 5)
    
    # 4. Order Age Score
    # Wait time in hours: +5 points per hour, capped at 25 points.
    order_date_str = order.get("order_date")
    age_score = 0
    hours_waiting = 0
    if order_date_str:
        try:
            # Parse isoformat date
            # Python datetime.fromisoformat can handle standard formats
            order_date = datetime.datetime.fromisoformat(order_date_str.replace("Z", "+00:00"))
            # Make sure we don't have timezone offset mismatch
            now = datetime.datetime.now(order_date.tzinfo)
            delta = now - order_date
            hours_waiting = max(0, delta.total_seconds() / 3600.0)
            age_score = min(25, math.floor(hours_waiting * 5))
        except Exception as e:
            # Fallback if parsing fails
            age_score = 0
            
    total_score = urgency_score + customer_score + delay_risk_score + age_score
    
    # Classify priority
    if total_score >= 80:
        classification = "Critical"
    elif total_score >= 60:
        classification = "Urgent"
    elif total_score >= 40:
        classification = "High"
    elif total_score >= 20:
        classification = "Normal"
    else:
        classification = "Low"
        
    reason_breakdown = [
        f"{urgency} urgency (+{urgency_score} pts)",
        f"{customer_type} customer (+{customer_score} pts)",
        f"{delay_risk} delay risk (+{delay_risk_score} pts)",
        f"Waiting for {hours_waiting:.1f} hours (+{age_score} pts)"
    ]
    
    return {
        "score": total_score,
        "classification": classification,
        "breakdown": reason_breakdown,
        "urgency_score": urgency_score,
        "customer_score": customer_score,
        "delay_risk_score": delay_risk_score,
        "age_score": age_score,
        "hours_waiting": hours_waiting
    }
