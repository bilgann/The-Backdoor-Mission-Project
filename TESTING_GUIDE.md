# Testing Guide for Total Clients Chart

## Prerequisites
1. Make sure your backend server is running: `python backend/app.py`
2. Make sure your frontend is running: `npm run dev` (in frontend folder)
3. Make sure you're logged in to the application

## Method 1: Using SQL Commands (Direct Database Insert)

### Step 1: Create a Test Client
```sql
-- Insert a test client into the database
INSERT INTO client (full_name, dob) 
VALUES ('Test Client', '1990-01-01');

-- Note the client_id that was created (you'll need it for the next step)
-- You can check with: SELECT * FROM client ORDER BY client_id DESC LIMIT 1;
```

### Step 2: Create a Coat Check Record for TODAY
```sql
-- Replace CLIENT_ID with the actual client_id from step 1
-- Replace the date with TODAY's date (YYYY-MM-DD format)
-- Replace the time with current time or a time between 9am-6pm

INSERT INTO coat_check_records (client_id, bin_no, time_in, date)
VALUES (
    1,  -- Replace with your client_id
    5,  -- Bin number (1-100)
    '2024-12-19 14:30:00',  -- Time in (use today's date and time between 9am-6pm)
    '2024-12-19'  -- Today's date (YYYY-MM-DD format)
);
```

### Step 3: Create More Test Records (Optional)
```sql
-- Add a washroom record
INSERT INTO washroom_records (client_id, washroom_type, time_in, date)
VALUES (
    1,  -- Your client_id
    'M',  -- Washroom type (M or F)
    '2024-12-19 10:00:00',  -- Time in
    '2024-12-19'  -- Today's date
);

-- Add a sanctuary record
INSERT INTO sanctuary_records (client_id, date, time_in, if_serviced)
VALUES (
    1,  -- Your client_id
    '2024-12-19',  -- Today's date
    '2024-12-19 11:00:00',  -- Time in
    false
);

-- Add a clinic record
INSERT INTO clinic_records (client_id, date, purpose_of_visit)
VALUES (
    1,  -- Your client_id
    '2024-12-19',  -- Today's date
    'General checkup'
);

-- Add a safe sleep record
INSERT INTO safe_sleep_records (client_id, date)
VALUES (
    1,  -- Your client_id
    '2024-12-19'  -- Today's date
);
```

## Method 2: Using API Endpoints (Recommended)

### Step 1: Create a Client via API
```bash
# Using curl (Windows PowerShell)
curl -X POST http://localhost:5000/client `
  -H "Content-Type: application/json" `
  -d '{\"full_name\": \"Test Client\", \"dob\": \"1990-01-01\"}'

# Or using PowerShell Invoke-RestMethod
$body = @{
    full_name = "Test Client"
    dob = "1990-01-01"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/client" -Method POST -Body $body -ContentType "application/json"
```

**Response will include `client_id` - save this number!**

### Step 2: Create a Coat Check Record via API
```bash
# Replace CLIENT_ID with the client_id from step 1
# Replace dates/times with TODAY's values

# Using curl
curl -X POST http://localhost:5000/coat_check_records `
  -H "Content-Type: application/json" `
  -d '{\"client_id\": 1, \"bin_no\": 5, \"time_in\": \"2024-12-19T14:30:00\", \"date\": \"2024-12-19\"}'

# Or using PowerShell
$body = @{
    client_id = 1  # Replace with your client_id
    bin_no = 5
    time_in = "2024-12-19T14:30:00"  # Use today's date and time (ISO format)
    date = "2024-12-19"  # Today's date (YYYY-MM-DD)
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/coat_check_records" -Method POST -Body $body -ContentType "application/json"
```

### Step 3: Test the Statistics API
```bash
# Test the API endpoint directly
curl http://localhost:5000/api/client-statistics?range=day

# Or in PowerShell
Invoke-RestMethod -Uri "http://localhost:5000/api/client-statistics?range=day"
```

## Method 3: Quick Test Script

Create a file `test_data.py` in your backend folder:

```python
from app import app, db, Client, CoatCheckRecord
from datetime import datetime, date

with app.app_context():
    # Create a test client
    client = Client(full_name="Test Client", dob=date(1990, 1, 1))
    db.session.add(client)
    db.session.commit()
    
    client_id = client.client_id
    print(f"Created client with ID: {client_id}")
    
    # Create a coat check record for today
    today = date.today()
    now = datetime.now()
    
    # Set time to current hour (or a specific hour between 9am-6pm)
    hour = max(9, min(18, now.hour))  # Ensure between 9am-6pm
    time_in = datetime.combine(today, datetime.min.time().replace(hour=hour, minute=30))
    
    coat_check = CoatCheckRecord(
        client_id=client_id,
        bin_no=5,
        time_in=time_in,
        date=today
    )
    
    db.session.add(coat_check)
    db.session.commit()
    
    print(f"Created coat check record for today at {time_in}")
    print("Check your frontend - the chart should now show data!")
```

Run it with: `python test_data.py`

## What to Expect

1. **After adding a coat check record:**
   - The "Total Clients" number should increase
   - The "Coat Check" count in the service breakdown should show 1
   - If the time_in is between 9am-6pm, you should see a point on the line chart

2. **Testing different time ranges:**
   - **Day (D)**: Shows hourly data (9am-6pm) for today
   - **Week (W)**: Shows daily data for the current week
   - **Month (M)**: Shows selected days for the current month
   - **Year (Y)**: Shows monthly data for the current year

3. **Real-time updates:**
   - The chart refreshes every 30 seconds automatically
   - Add a new record and wait up to 30 seconds to see it appear

## Troubleshooting

### "Error fetching data" message:
1. Check if backend is running: `python backend/app.py`
2. Check browser console (F12) for specific error messages
3. Test API directly: `http://localhost:5000/api/client-statistics?range=day`
4. Check CORS is enabled in backend

### No data showing:
1. Make sure records have TODAY's date (not yesterday or tomorrow)
2. For "Day" view, make sure time_in is between 9am-6pm
3. Check database directly: `SELECT * FROM coat_check_records WHERE date = CURRENT_DATE;`

### Chart not updating:
1. Wait 30 seconds (auto-refresh interval)
2. Manually refresh the page
3. Check browser console for errors

## Quick SQL Query to Check Today's Records

```sql
-- Check all coat check records for today
SELECT * FROM coat_check_records WHERE date = CURRENT_DATE;

-- Check all clients
SELECT * FROM client;

-- Check total unique clients across all services today
SELECT COUNT(DISTINCT client_id) FROM (
    SELECT client_id FROM coat_check_records WHERE date = CURRENT_DATE
    UNION
    SELECT client_id FROM washroom_records WHERE date = CURRENT_DATE
    UNION
    SELECT client_id FROM sanctuary_records WHERE date = CURRENT_DATE
    UNION
    SELECT client_id FROM clinic_records WHERE date = CURRENT_DATE
    UNION
    SELECT client_id FROM safe_sleep_records WHERE date = CURRENT_DATE
) AS all_clients;
```

