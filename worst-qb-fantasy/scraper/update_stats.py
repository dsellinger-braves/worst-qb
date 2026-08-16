import os
import nfl_data_py as nfl
import pandas as pd
from supabase import create_client, Client

def calculate_worst_qb_score(row):
    """
    Calculates the 'Worst QB' fantasy score based on custom rules.
    """
    # 1. Completion Percentage: 20 * (1 - completion percentage)
    attempts = row.get('attempts', 0)
    completions = row.get('completions', 0)
    comp_pct_score = 0
    if attempts > 0:
        comp_pct = completions / attempts
        comp_pct_score = 20 * (1 - comp_pct)
        
    # Stats
    pass_yds = row.get('passing_yards', 0)
    pass_tds = row.get('passing_tds', 0)
    ints = row.get('interceptions', 0)
    pick_sixes = row.get('pick_sixes', 0) # Note: nfl_data_py might not easily separate pick sixes from standard INTs in weekly aggregates without deep play-by-play analysis.
    rush_yds = row.get('rushing_yards', 0)
    rush_tds = row.get('rushing_tds', 0)
    fumbles_lost = row.get('fumbles_lost', 0)
    sacks = row.get('sacks', 0)
    team_loss = row.get('team_loss', False) # Requires joining schedule data to see if game is final and team lost
    
    # Calculate total
    score = comp_pct_score
    score += (pass_yds * -0.05)
    score += (pass_tds * -5)
    score += (ints * 5)
    score += (pick_sixes * 10)
    score += (rush_yds * -0.1)
    score += (rush_tds * -5)
    score += (fumbles_lost * 4)
    score += (sacks * 1)
    score += (5 if team_loss else 0)
    
    return round(score, 2)

def main():
    print("Starting Worst QB Live Stats Scraper...")
    
    # Init Supabase
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Exiting.")
        return
        
    supabase: Client = create_client(url, key)
    
    # 1. Fetch Weekly Stats from nfl_data_py
    year = 2024 # Target year
    # Ideally, we dynamically determine the week based on current date
    # For now, we fetch the latest weekly data
    try:
        weekly_data = nfl.import_weekly_data([year])
    except Exception as e:
        print(f"Error fetching NFL data: {e}")
        return
        
    if weekly_data.empty:
        print("No data available for the given year.")
        return
        
    # Filter for Quarterbacks only (position mapping might be needed, or filtering by passing attempts)
    qbs = weekly_data[weekly_data['position'] == 'QB'].copy()
    
    # Map nfl_data_py columns to our scoring function
    # nfl_data_py columns: player_id, player_name, completions, attempts, passing_yards, passing_tds, interceptions, sacks, sack_yards, sack_fumbles, sack_fumbles_lost, passing_air_yards, passing_yards_after_catch, passing_first_downs, passing_epa, passing_2pt_conversions, pacr, dakota, rushing_yards, rushing_tds...
    records_to_upsert = []
    
    for index, row in qbs.iterrows():
        stats = {
            'player_id': row['player_id'],
            'week': row['week'],
            'attempts': row['attempts'],
            'completions': row['completions'],
            'passing_yards': row['passing_yards'],
            'passing_tds': row['passing_tds'],
            'interceptions': row['interceptions'],
            'pick_sixes': 0, # Needs advanced PBP cross-referencing
            'rushing_yards': row['rushing_yards'],
            'rushing_tds': row['rushing_tds'],
            'fumbles_lost': row.get('sack_fumbles_lost', 0), # Fallback mapping
            'sacks': row['sacks'],
            'team_loss': False # Needs schedule cross-referencing
        }
        
        custom_points = calculate_worst_qb_score(stats)
        
        records_to_upsert.append({
            'player_id': stats['player_id'],
            'week': int(stats['week']),
            'passing_yards': int(stats['passing_yards']),
            'passing_tds': int(stats['passing_tds']),
            'interceptions': int(stats['interceptions']),
            'pick_sixes': 0,
            'rushing_yards': int(stats['rushing_yards']),
            'rushing_tds': int(stats['rushing_tds']),
            'fumbles_lost': int(stats['fumbles_lost']),
            'sacks': int(stats['sacks']),
            'completion_percentage': float(stats['completions']/stats['attempts']) if stats['attempts'] > 0 else 0,
            'custom_points': float(custom_points)
        })
        
        # We also want to upsert the Player into the players table to ensure foreign keys exist
        player_data = {
            'id': row['player_id'],
            'name': row['player_display_name'],
            'team': row['recent_team'],
            'position': 'QB'
        }
        try:
            supabase.table('players').upsert(player_data).execute()
        except Exception as e:
            pass # Ignore if it fails due to duplicates, upsert should handle it

    # Upsert Stats
    if records_to_upsert:
        print(f"Upserting {len(records_to_upsert)} stat records...")
        try:
            response = supabase.table('player_stats').upsert(records_to_upsert).execute()
            print("Stats updated successfully!")
        except Exception as e:
            print(f"Error updating Supabase: {e}")
            
if __name__ == '__main__':
    main()
