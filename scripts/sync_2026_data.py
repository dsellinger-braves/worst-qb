import sys
sys.path.insert(0, r"c:\Users\danie\Documents\Fantasy Football\worst-qb")
import os
from supabase import create_client, Client
from scraper.update_stats import (
    fetch_actuals_gamecast,
    calculate_worst_qb_score,
    scrape_espn_projections,
    fuzzy_match_player,
    get_current_nfl_week,
    ESPN_TEAM_MAP
)

SUPABASE_URL = "https://fudkcwwfkofvcqtpjzfy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZGtjd3dma29mdmNxdHBqemZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njg4NDI1OCwiZXhwIjoyMTAyNDYwMjU4fQ.H25C4gmO9pQReWtGFPbk0cPm0PJgNkYReqpIlO8Gec8"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def sync_2026():
    print("=== STARTING 2026 DATA PURGE AND REFRESH ===")
    
    # 1. Fetch genuine 2026 actuals
    print("\n1. Fetching genuine 2026 NFL actuals from ESPN Gamecast...")
    all_game_stats = []
    
    # 2026 Preseason (weeks 1 to 4)
    for w in range(1, 5):
        stats = fetch_actuals_gamecast(2026, w, 1)
        if stats:
            print(f"  Preseason Week {w}: {len(stats)} player gamecast lines")
            all_game_stats.extend(stats)
            
    # 2026 Regular Season (weeks 1 to 6 - week 7 starts tomorrow)
    for w in range(1, 7):
        stats = fetch_actuals_gamecast(2026, w, 2)
        if stats:
            print(f"  Regular Season Week {w}: {len(stats)} player gamecast lines")
            all_game_stats.extend(stats)
            
    records_to_upsert = []
    players_to_upsert = {}
    
    for row in all_game_stats:
        player_id = row['player_id']
        if player_id not in players_to_upsert:
            players_to_upsert[player_id] = {
                'id': player_id,
                'name': row.get('name', 'Unknown'),
                'team': row.get('team', 'FA'),
                'position': 'Unknown',
                'headshot_url': row.get('headshot', ''),
                'height': '', 'weight': 0, 'college': '', 'age': 0
            }
        
        if row['attempts'] == 0 and row['rushing_yards'] == 0 and row['fumbles_lost'] == 0:
            continue
            
        custom_points = calculate_worst_qb_score(row)
        records_to_upsert.append({
            'player_id': player_id,
            'week': int(row['week']),
            'season_type': row['season_type'],
            'passing_yards': int(row['passing_yards']),
            'passing_tds': int(row['passing_tds']),
            'interceptions': int(row['interceptions']),
            'pick_sixes': int(row['pick_sixes']),
            'rushing_yards': int(row['rushing_yards']),
            'rushing_tds': int(row['rushing_tds']),
            'fumbles_lost': int(row['fumbles_lost']),
            'sacks': int(row['sacks']),
            'attempts': int(row['attempts']),
            'completions': int(row['completions']),
            'completion_percentage': float(row['completions']/row['attempts']) if row['attempts'] > 0 else 0,
            'custom_points': float(custom_points),
            'team_loss': bool(row['team_loss'])
        })
        
    # Aggregate Team QBs
    team_stats_dict = {}
    for row in all_game_stats:
        team = row.get('team')
        if not team or team == 'FA': continue
        if row['attempts'] == 0 and row['rushing_yards'] == 0 and row['fumbles_lost'] == 0:
            continue
            
        week = row['week']
        season_type = row['season_type']
        key = (team, week, season_type)
        
        if key not in team_stats_dict:
            team_stats_dict[key] = {
                'player_id': f'TEAM_{team}_{season_type}',
                'team': team,
                'week': int(week),
                'season_type': season_type,
                'attempts': 0,
                'completions': 0,
                'passing_yards': 0,
                'passing_tds': 0,
                'interceptions': 0,
                'pick_sixes': 0,
                'rushing_yards': 0,
                'rushing_tds': 0,
                'fumbles_lost': 0,
                'sacks': 0,
                'team_loss': bool(row.get('team_loss', False))
            }
            
        ts = team_stats_dict[key]
        ts['attempts'] += row['attempts']
        ts['completions'] += row['completions']
        ts['passing_yards'] += row['passing_yards']
        ts['passing_tds'] += row['passing_tds']
        ts['interceptions'] += row['interceptions']
        ts['pick_sixes'] += row.get('pick_sixes', 0)
        ts['rushing_yards'] += row['rushing_yards']
        ts['rushing_tds'] += row['rushing_tds']
        ts['fumbles_lost'] += row['fumbles_lost']
        ts['sacks'] += row['sacks']
        if row.get('team_loss'):
            ts['team_loss'] = True

    for key, ts in team_stats_dict.items():
        team = ts['team']
        player_data = {
            'id': ts['player_id'],
            'name': f'{team} QBs',
            'team': team,
            'position': 'TM_QB',
            'headshot_url': '',
            'height': '', 'weight': 0, 'college': '', 'age': 0
        }
        try:
            supabase.table('players').upsert(player_data).execute()
        except Exception:
            pass
            
        custom_points = calculate_worst_qb_score(ts)
        records_to_upsert.append({
            'player_id': ts['player_id'],
            'week': ts['week'],
            'season_type': ts['season_type'],
            'passing_yards': ts['passing_yards'],
            'passing_tds': ts['passing_tds'],
            'interceptions': ts['interceptions'],
            'pick_sixes': ts['pick_sixes'],
            'rushing_yards': ts['rushing_yards'],
            'rushing_tds': ts['rushing_tds'],
            'fumbles_lost': ts['fumbles_lost'],
            'sacks': ts['sacks'],
            'attempts': ts['attempts'],
            'completions': ts['completions'],
            'completion_percentage': float(ts['completions']/ts['attempts']) if ts['attempts'] > 0 else 0,
            'custom_points': float(custom_points),
            'team_loss': bool(ts['team_loss'])
        })

    print(f"Total active 2026 records ready: {len(records_to_upsert)}")

    # 2. Fetch 2026 pure projections
    current_week = get_current_nfl_week()
    print(f"\n2. Scraping 2026 Projections (Current Week: {current_week})...")
    projections_data = scrape_espn_projections(2026, current_week)
    
    db_players = supabase.table('players').select('id, name').like('id', 'espn-%').execute().data
    name_to_id = { p['name'].lower(): p['id'] for p in db_players }
    
    new_players = []
    proj_records = []
    for p_data in projections_data:
        player_info = p_data['player']
        pid = player_info['id']
        new_players.append({
            'id': pid,
            'name': player_info['name'],
            'team': player_info['team'],
            'position': player_info['position'],
            'status': 'active'
        })
        for proj in p_data['projections']:
            proj_records.append({
                'player_id': pid,
                'week': proj['week'],
                'projected_custom_points': proj['projected_custom_points'],
                'opponent': proj.get('opponent', None)
            })

    unique_projs = list({ (pr['player_id'], pr['week']): pr for pr in proj_records }.values())
    print(f"Total pure 2026 projections ready: {len(unique_projs)}")

    # 3. Clean database tables
    print("\n3. Purging stale multi-year stats and projections from Supabase...")
    # Delete from player_stats and player_projections
    supabase.table('player_stats').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    supabase.table('player_projections').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    print("Database purged cleanly.")

    # 4. Upsert players
    print("\n4. Upserting player profiles...")
    all_players = list({ p['id']: p for p in (list(players_to_upsert.values()) + new_players) }.values())
    for i in range(0, len(all_players), 500):
        chunk = all_players[i:i + 500]
        supabase.table('players').upsert(chunk, on_conflict='id').execute()
    print(f"Upserted {len(all_players)} players.")

    # 5. Upsert 2026 player_stats
    print("\n5. Upserting 2026 player_stats...")
    for i in range(0, len(records_to_upsert), 500):
        chunk = records_to_upsert[i:i + 500]
        supabase.table('player_stats').upsert(chunk, on_conflict='player_id,week,season_type').execute()
    print(f"Upserted {len(records_to_upsert)} 2026 stats lines.")

    # 6. Upsert 2026 player_projections
    print("\n6. Upserting 2026 player_projections...")
    for i in range(0, len(unique_projs), 500):
        chunk = unique_projs[i:i + 500]
        supabase.table('player_projections').upsert(chunk, on_conflict='player_id,week').execute()
    print(f"Upserted {len(unique_projs)} 2026 projections.")

    print("\n=== 2026 DATA SYNC COMPLETE! ===")

if __name__ == '__main__':
    sync_2026()
