import os
import nfl_data_py as nfl
import pandas as pd
from supabase import create_client, Client
import requests
from bs4 import BeautifulSoup
import re
import argparse

def calculate_worst_qb_score(row):
    """
    Calculates the 'Worst QB' fantasy score based on custom rules.
    """
    attempts = row.get('attempts', 0)
    completions = row.get('completions', 0)
    if attempts <= 0:
        return -20.0
        
    comp_pct = completions / attempts
    comp_pct_score = 20 * (1 - comp_pct)
        
    pass_yds = row.get('passing_yards', 0)
    pass_tds = row.get('passing_tds', 0)
    ints = row.get('interceptions', 0)
    pick_sixes = row.get('pick_sixes', 0)
    rush_yds = row.get('rushing_yards', 0)
    rush_tds = row.get('rushing_tds', 0)
    fumbles_lost = row.get('fumbles_lost', 0)
    sacks = row.get('sacks', 0)
    team_loss = row.get('team_loss', False)
    
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

def fuzzy_match_player(name, db_players):
    name_lower = name.lower().replace('.', '').replace('-', ' ')
    # Try exact match
    for p in db_players:
        if p['name'].lower().replace('.', '').replace('-', ' ') == name_lower:
            return p['id']
    
    # Try last name + initial
    for p in db_players:
        db_parts = p['name'].lower().split()
        csv_parts = name_lower.split()
        if len(db_parts) > 1 and len(csv_parts) > 1:
            if db_parts[-1] == csv_parts[-1] and db_parts[0][0] == csv_parts[0][0]:
                return p['id']
    return None

ESPN_TEAM_MAP = {
    0: 'FA', 1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN',
    8: 'DET', 9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA',
    16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT',
    24: 'LAC', 25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WAS', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU'
}

ESPN_POS_MAP = {
    1: 'QB',
    2: 'RB',
    3: 'WR',
    4: 'TE',
    5: 'K',
    16: 'DST'
}

ESPN_SLOT_MAP = {
    0: 'QB',
    2: 'RB',
    4: 'WR',
    6: 'TE',
    17: 'K',
    16: 'DST'
}

def scrape_espn_projections(year, current_week):
    print("Scraping ESPN Projections (All Players)...")
    import urllib.request
    import json
    
    url = f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/segments/0/leaguedefaults/3?view=kona_player_info&platformVersion=03952a53323901871b54cebc123891a6966b3143"
    
    # Remove filterSlotIds and limit to grab every player
    headers = {
        'X-Fantasy-Filter': '{"players":{"sortPercOwned":{"sortPriority":1,"sortAsc":false}}}',
        'User-Agent': 'Mozilla/5.0'
    }
    
    try:
        req = urllib.request.Request(url, headers=headers)
        res = urllib.request.urlopen(req)
        data = json.loads(res.read())
        
        projections = []
        for p_data in data.get('players', []):
            player = p_data.get('player', {})
            name = player.get('fullName')
            pro_team_id = player.get('proTeamId', 0)
            team = ESPN_TEAM_MAP.get(pro_team_id, 'FA')
            pos_id = player.get('defaultPositionId', 0)
            
            slots = player.get('eligibleSlots', [])
            pos_labels = []
            for s in slots:
                if s in ESPN_SLOT_MAP:
                    pos_labels.append(ESPN_SLOT_MAP[s])
                    
            if not pos_labels:
                pos_labels = [ESPN_POS_MAP.get(pos_id, 'FLEX')]
                
            pos_label = "/".join(pos_labels)
            
            # Always add player to our list to be saved to DB
            espn_player = {
                'id': f"espn-{player.get('id')}",
                'name': name,
                'team': team,
                'position': pos_label,
            }
            
            player_projections = []
            
            # Find the projected stats for all weeks (statSourceId = 1, statSplitTypeId = 1)
            stats = player.get('stats', [])
            for s in stats:
                if s.get('statSourceId') == 1 and s.get('statSplitTypeId') == 1:
                    week = s.get('scoringPeriodId')
                    proj_stats = s.get('stats', {})
                    
                    if not proj_stats or week == 0:
                        continue
                        
                    # ESPN Stat ID mapping to our format
                    stats_dict = {
                        'attempts': float(proj_stats.get('0', 0)),
                        'completions': float(proj_stats.get('1', 0)),
                        'passing_yards': float(proj_stats.get('3', 0)),
                        'passing_tds': float(proj_stats.get('4', 0)),
                        'interceptions': float(proj_stats.get('20', 0)),
                        'pick_sixes': 0,
                        'rushing_yards': float(proj_stats.get('24', 0)),
                        'rushing_tds': float(proj_stats.get('25', 0)),
                        'fumbles_lost': float(proj_stats.get('72', 0)),
                        'sacks': 0, # Sacks typically aren't projected
                        'team_loss': False
                    }
                    
                    custom_pts = calculate_worst_qb_score(stats_dict)
                    
                    # Store raw stats in opponent column as a JSON string since we can't alter schema
                    import json
                    opp_payload = json.dumps({
                        'opp': 'TBD',
                        'raw': stats_dict
                    })
                    
                    player_projections.append({
                        'projected_custom_points': float(custom_pts),
                        'week': week,
                        'opponent': opp_payload
                    })
                    
            projections.append({
                'player': espn_player,
                'projections': player_projections
            })
            
        print(f"Found {len(projections)} players from ESPN.")
        return projections
    except Exception as e:
        print(f"Error scraping ESPN: {e}")
        return []

def main():
    parser = argparse.ArgumentParser(description="Worst QB Live Stats Scraper")
    parser.add_argument('--year', type=int, default=2023, help="NFL Season Year to scrape (e.g. 2021)")
    args = parser.parse_args()
    
    print(f"Starting Worst QB Stats Scraper for {args.year}...")
    
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Exiting.")
        return
        
    supabase: Client = create_client(url, key)
    
    year = args.year
    print("Fetching Roster, Weekly Data, and Schedules...")
    try:
        weekly_data = nfl.import_weekly_data([year])
        rosters = nfl.import_seasonal_rosters([year])
        schedules = nfl.import_schedules([year])
    except Exception as e:
        print(f"Error fetching NFL data: {e}")
        weekly_data = pd.DataFrame()
        rosters = pd.DataFrame()
        schedules = pd.DataFrame()
        
    def did_team_lose(team, week):
        game = schedules[(schedules['week'] == week) & ((schedules['home_team'] == team) | (schedules['away_team'] == team))]
        if game.empty: return False
        g = game.iloc[0]
        if pd.isna(g['home_score']) or pd.isna(g['away_score']):
            return False
        if g['home_team'] == team:
            return g['home_score'] < g['away_score']
        else:
            return g['away_score'] < g['home_score']
        
    records_to_upsert = []
    if weekly_data.empty:
        qbs = pd.DataFrame()
    else:
        qbs = weekly_data[weekly_data['position'] == 'QB'].copy()
    
    for index, row in qbs.iterrows():
        player_id = row['player_id']
        
        # Get bio from roster data
        roster_info = rosters[rosters['player_id'] == player_id]
        headshot = ""
        height = ""
        weight = 0
        college = ""
        age = 0
        
        if not roster_info.empty:
            r = roster_info.iloc[0]
            headshot = r.get('headshot_url', "")
            height = r.get('height', "")
            weight = r.get('weight', 0)
            college = r.get('college', "")
            age = r.get('age', 0)
            # handle NaNs safely
            weight = int(weight) if pd.notna(weight) else 0
            age = int(age) if pd.notna(age) else 0
            headshot = headshot if pd.notna(headshot) else ""
            height = height if pd.notna(height) else ""
            college = college if pd.notna(college) else ""

        stats = {
            'player_id': player_id,
            'week': row['week'],
            'attempts': row['attempts'],
            'completions': row['completions'],
            'passing_yards': row['passing_yards'],
            'passing_tds': row['passing_tds'],
            'interceptions': row['interceptions'],
            'pick_sixes': 0, 
            'rushing_yards': row['rushing_yards'],
            'rushing_tds': row['rushing_tds'],
            'fumbles_lost': row.get('sack_fumbles_lost', 0),
            'sacks': row['sacks'],
            'team_loss': did_team_lose(row['recent_team'], row['week'])
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
            'attempts': int(stats['attempts']),
            'completions': int(stats['completions']),
            'completion_percentage': float(stats['completions']/stats['attempts']) if stats['attempts'] > 0 else 0,
            'custom_points': float(custom_points),
            'team_loss': bool(stats['team_loss'])
        })
        
        # Upsert Player Info with new bio fields
        player_data = {
            'id': player_id,
            'name': row['player_display_name'],
            'team': row['recent_team'],
            'position': 'QB',
            'headshot_url': headshot,
            'height': height,
            'weight': weight,
            'college': college,
            'age': age
        }
        try:
            supabase.table('players').upsert(player_data).execute()
        except Exception as e:
            pass

    # Aggregate Team QBs
    team_stats_dict = {}
    for index, row in qbs.iterrows():
        team = row.get('recent_team')
        if not team or pd.isna(team):
            continue
            
        week = row.get('week')
        key = (team, week)
        
        if key not in team_stats_dict:
            team_stats_dict[key] = {
                'player_id': f'TEAM_{team}',
                'team': team,
                'week': int(week),
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
                'team_loss': did_team_lose(team, int(week))
            }
            
        ts = team_stats_dict[key]
        ts['attempts'] += int(row.get('attempts', 0) if pd.notna(row.get('attempts')) else 0)
        ts['completions'] += int(row.get('completions', 0) if pd.notna(row.get('completions')) else 0)
        ts['passing_yards'] += int(row.get('passing_yards', 0) if pd.notna(row.get('passing_yards')) else 0)
        ts['passing_tds'] += int(row.get('passing_tds', 0) if pd.notna(row.get('passing_tds')) else 0)
        ts['interceptions'] += int(row.get('interceptions', 0) if pd.notna(row.get('interceptions')) else 0)
        ts['rushing_yards'] += int(row.get('rushing_yards', 0) if pd.notna(row.get('rushing_yards')) else 0)
        ts['rushing_tds'] += int(row.get('rushing_tds', 0) if pd.notna(row.get('rushing_tds')) else 0)
        ts['fumbles_lost'] += int(row.get('sack_fumbles_lost', 0) if pd.notna(row.get('sack_fumbles_lost')) else 0)
        ts['sacks'] += int(row.get('sacks', 0) if pd.notna(row.get('sacks')) else 0)

    # Upsert Team QB players and their stats
    for key, ts in team_stats_dict.items():
        team = ts['team']
        player_data = {
            'id': ts['player_id'],
            'name': f'{team} QBs',
            'team': team,
            'position': 'TM_QB',
            'headshot_url': '',
            'height': '',
            'weight': 0,
            'college': '',
            'age': 0
        }
        try:
            supabase.table('players').upsert(player_data).execute()
        except Exception as e:
            pass
            
        custom_points = calculate_worst_qb_score(ts)
        records_to_upsert.append({
            'player_id': ts['player_id'],
            'week': ts['week'],
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

    # Upsert Stats
    if records_to_upsert:
        print(f"Upserting {len(records_to_upsert)} stat records...")
        try:
            supabase.table('player_stats').upsert(records_to_upsert, on_conflict='player_id,week').execute()
            print("Stats updated successfully!")
        except Exception as e:
            print(f"Error updating Supabase stats: {e}")
            
    # Upsert Projections
    current_week = int(weekly_data['week'].max() + 1) if not weekly_data.empty else 1
    projections_data = scrape_espn_projections(year, current_week)
    if projections_data:
        try:
            db_players = supabase.table('players').select('id, name').execute().data
            
            # Simple fuzzy matching (last name or exact match)
            name_to_id = {}
            for p in db_players:
                name_to_id[p['name'].lower()] = p['id']
                # also map last names for easier matching (e.g. "P. Mahomes" -> "Mahomes")
                parts = p['name'].split(' ')
            new_players = []
            proj_records = []
            
            for p_data in projections_data:
                player_info = p_data['player']
                pid = fuzzy_match_player(player_info['name'], db_players)
                if not pid:
                    # New player, insert them into DB
                    pid = player_info['id']
                    new_players.append({
                        'id': pid,
                        'name': player_info['name'],
                        'team': player_info['team'],
                        'position': player_info['position'],
                        'status': 'active'
                    })
                    # Add to db_players locally so we don't duplicate
                    db_players.append({'id': pid, 'name': player_info['name']})
                else:
                    # Existing player, update their position/team
                    new_players.append({
                        'id': pid,
                        'name': player_info['name'],
                        'team': player_info['team'],
                        'position': player_info['position'],
                        'status': 'active'
                    })
                
                # If they have no projections, we at least want a baseline 0 for the current week so they show up
                if not p_data['projections']:
                    proj_records.append({
                        'player_id': pid,
                        'week': current_week,
                        'projected_custom_points': 0.0
                    })
                else:
                    for proj in p_data['projections']:
                        proj_records.append({
                            'player_id': pid,
                            'week': proj['week'],
                            'projected_custom_points': proj['projected_custom_points'],
                            'opponent': proj.get('opponent', None)
                        })
                
            if new_players:
                # Deduplicate before upserting
                unique_players = { p['id']: p for p in new_players }.values()
                print(f"Adding/Updating {len(unique_players)} players in database...")
                supabase.table('players').upsert(list(unique_players), on_conflict='id').execute()

            if proj_records:
                unique_projs = { (pr['player_id'], pr['week']): pr for pr in proj_records }.values()
                print(f"Upserting {len(unique_projs)} projections...")
                supabase.table('player_projections').upsert(list(unique_projs), on_conflict='player_id,week').execute()
                print("Projections updated successfully!")
        except Exception as e:
            print(f"Error updating Supabase projections: {e}")
            
    print("Worst QB Stats Scraper finished.")

if __name__ == '__main__':
    main()
