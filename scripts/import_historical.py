import os
import csv
import argparse
from supabase import create_client, Client

def fuzzy_match_player(qb_name, players_db):
    """
    Attempts to match a QB name from the CSV to the database.
    """
    qb_lower = qb_name.lower().strip()
    
    # Exact Match
    for p in players_db:
        if p['name'].lower() == qb_lower:
            return p['id']
            
    # Last Name Match
    for p in players_db:
        db_last_name = p['name'].split()[-1].lower()
        csv_last_name = qb_lower.split()[-1]
        if db_last_name == csv_last_name:
            return p['id']
            
    return None

def main():
    parser = argparse.ArgumentParser(description="Import historical Worst QB draft picks from CSV.")
    parser.add_argument('csv_file', help="Path to the historical_picks.csv file")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables.")
        return

    supabase: Client = create_client(url, key)
    
    if not os.path.exists(args.csv_file):
        print(f"File not found: {args.csv_file}")
        return

    print(f"Reading {args.csv_file}...")
    
    records = []
    with open(args.csv_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append(row)
            
    print(f"Found {len(records)} draft picks to import.")

    # 1. Fetch existing users or create dummy ones?
    # In a real scenario, you probably want to map owner names to real user UUIDs.
    # For now, we will fetch all users and let the user modify this logic to match emails.
    # Warning: Service role can fetch users, but it's often easier to map them manually.
    
    # 2. Get existing QBs to match against
    print("Fetching QBs from database for matching...")
    players_res = supabase.table('players').select('id, name').execute()
    db_players = players_res.data
    
    # 3. Create Leagues per year
    years = set(r['year'] for r in records)
    league_map = {}
    for year in years:
        league_name = f"Worst QB {year} Historical"
        # Check if exists
        existing = supabase.table('leagues').select('id').eq('name', league_name).execute()
        if existing.data:
            league_map[year] = existing.data[0]['id']
            print(f"Found existing league: {league_name}")
        else:
            print(f"Creating new league: {league_name}")
            # Insert (assuming we have a system admin UUID, replace 'admin_uuid' as needed)
            # You might need to update this script to assign an actual creator_id
            # new_league = supabase.table('leagues').insert({'name': league_name}).execute()
            # league_map[year] = new_league.data[0]['id']
            print("  -> SKIPPING LEAGUE CREATION (Need to provide a created_by UUID in script)")

    print("\n--- Dry Run Mapping ---")
    missing_qbs = set()
    for row in records:
        pid = fuzzy_match_player(row['qb_name'], db_players)
        if not pid:
            missing_qbs.add(row['qb_name'])
            
    if missing_qbs:
        print("\nWARNING: The following QBs from your CSV could not be found in the database:")
        for mqb in missing_qbs:
            print(f" - {mqb}")
        print("\nDid you run `python scraper/update_stats.py --year YYYY` for all historical years yet?")
        print("Please do that first to populate the players table, then run this script again.")
        return

    print("\nAll QBs matched successfully! Implement the final insert statements in this script to finalize.")
    
    # Final step to implement:
    # 1. Assign real user UUIDs to owner names.
    # 2. Create the league_members entries.
    # 3. Batch insert the draft_picks array.

if __name__ == "__main__":
    main()
