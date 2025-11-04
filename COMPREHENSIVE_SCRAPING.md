# Comprehensive IND Appointment Scraping

## What Changed

The application now performs **comprehensive scraping** of ALL possible appointment combinations, regardless of user preferences.

### Coverage

The system now checks **90 combinations** every 15 minutes:

- **3 Appointment Types**:
  - BIO (Biometric)
  - DOC (Document Pickup)
  - VAA (Visa Application)

- **5 Locations**:
  - AM (Amsterdam)
  - DH (Den Haag)
  - ZW (Zwolle)
  - DEN (Den Bosch)
  - UT (Utrecht)

- **6 Person Counts**:
  - 1 person
  - 2 persons
  - 3 persons
  - 4 persons
  - 5 persons
  - 6 persons

**Total**: 3 × 5 × 6 = **90 API calls** per check

## Benefits

### For Users
1. **Complete flexibility**: Filter by any combination of type, location, and person count
2. **No setup required**: All appointments are available immediately
3. **Better discovery**: See appointments you might not have known to look for
4. **Multiple person counts**: Easily find appointments for groups

### For the System
1. **Comprehensive database**: Complete picture of IND availability
2. **Better analytics**: Can track trends across all combinations
3. **User-agnostic**: Not dependent on user preferences to populate data

## How It Works

### 1. Scraping (Every 15 minutes)

```
FOR each appointment_type in [BIO, DOC, VAA]:
  FOR each location in [AM, DH, ZW, DEN, UT]:
    FOR each persons in [1, 2, 3, 4, 5, 6]:
      - Query IND API
      - Store new appointments in database
      - Mark old appointments as unavailable
```

### 2. User Interface

Users can filter by:
- **Type**: All, Biometric, Document Pickup, Visa Application
- **Location**: All, Amsterdam, Den Haag, Zwolle, Den Bosch, Utrecht
- **Persons**: Any, 1, 2, 3, 4, 5, 6

### 3. Notifications

Users set up notification preferences:
- Choose specific type, location, and person count
- Get notified ONLY for their preferences
- Can have multiple preferences

## Performance Considerations

### API Calls
- **90 calls** every 15 minutes
- **6 calls per minute** on average
- **360 calls per hour**
- **8,640 calls per day**

This is well within reasonable limits for the IND API.

### Database Growth

Estimated storage per check cycle:
- Each appointment: ~200 bytes
- Average 100 appointments per combination
- 90 combinations × 100 = 9,000 appointments
- ~1.8 MB per check cycle
- Cleanup removes old appointments daily

### Execution Time

Expected time per check:
- 90 API calls × 0.5 seconds = 45 seconds
- Database operations: ~5 seconds
- **Total: ~50 seconds** per check

## Monitoring

Check the cron job logs to see scraping performance:

```sql
SELECT
  started_at,
  appointments_found,
  new_appointments,
  notifications_sent,
  duration_ms,
  status
FROM cron_job_log
ORDER BY started_at DESC
LIMIT 10;
```

## Sample Data Distribution

After the first scraping cycle, you should see appointments distributed like:

```
Location    | Type | 1p  | 2p  | 3p  | 4p  | 5p  | 6p  | Total
------------|------|-----|-----|-----|-----|-----|-----|-------
Amsterdam   | BIO  | 501 | 485 | 467 | 445 | 423 | 398 | 2,719
Amsterdam   | DOC  | 234 | 221 | 210 | 198 | 185 | 171 | 1,219
Den Haag    | BIO  | 412 | 398 | 381 | 365 | 347 | 329 | 2,232
...
```

## Configuration

The scraping behavior is controlled by:

```env
# How often to check (in minutes)
IND_CHECK_INTERVAL_MINUTES=15

# API base URL
IND_API_BASE_URL=https://oap.ind.nl/oap/api
```

## Advantages Over Preference-Based Scraping

### Before (Preference-Based)
- ❌ Only scraped what users requested
- ❌ Empty database for new users
- ❌ Missed appointments users didn't think to check
- ❌ Had to wait for next cycle to get new preferences

### After (Comprehensive)
- ✅ Complete coverage of all possibilities
- ✅ Instant results for new users
- ✅ Users can explore all options
- ✅ One scraping cycle covers everything

## Example Use Cases

### 1. Family Trip
User wants to bring 4 people to Amsterdam for biometric:
- Filter: Type=BIO, Location=Amsterdam, Persons=4
- Sees all available slots instantly

### 2. Flexible on Location
User needs document pickup for 2 people, any location:
- Filter: Type=DOC, Location=Any, Persons=2
- Compare availability across all cities

### 3. Group Planning
User checking for 1-6 people to see best availability:
- Check each person count
- Find which group size has earliest appointments

## Testing the Comprehensive Scraping

Run a manual check to see it in action:

```bash
# Start the app
npm run dev

# Trigger a manual check (admin only, via API)
# Or wait 15 minutes for automatic check

# Check the database
sqlite3 data/ind_appointments.db "
SELECT
  appointment_type,
  location,
  persons,
  COUNT(*) as count
FROM ind_appointments
WHERE is_available = 1
GROUP BY appointment_type, location, persons
ORDER BY appointment_type, location, persons;
"
```

You should see results for all 90 combinations!

## Future Enhancements

Possible improvements:
1. **Smart caching**: Don't re-query combinations with no appointments
2. **Parallel requests**: Query multiple combinations simultaneously
3. **Priority scraping**: Check popular combinations more frequently
4. **Historical data**: Track appointment availability trends
5. **Prediction**: Predict when new appointments typically appear

---

**Status**: ✅ Implemented and ready to use
**Coverage**: 3 types × 5 locations × 6 person counts = 90 combinations
**Frequency**: Every 15 minutes
