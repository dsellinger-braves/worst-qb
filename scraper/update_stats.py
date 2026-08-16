import os
import nfl_data_py as nfl
import pandas as pd
from supabase import create_client, Client
import requests
from bs4 import BeautifulSoup
import re

def calculate_worst_qb_score(row):
    """
    Calculates the 'Worst QB' fantasy score based on custom rules.
    """
    attempts = row.get('attempts', 0)
    completions = row.get('completions', 0)
    comp_pct_score = 0
    if attempts > 0:
        comp_pct = completions / attempts
        comp_pct_score = 20 * (1 - comp_pct)
    else:
        comp_pct_score = -20
        
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

def scrape_cbs_projections(year, current_week):
    print("Scraping CBS Projections...")
    url = f"https://www.cbssports.com/fantasy/football/stats/QB/{year}/season/projections/nonppr/"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        rows = soup.find_all('tr', class_='TableBase-bodyTr')
        projections = []
        for row in rows:
            cols = row.find_all('td')
            if len(cols) < 11:
                continue
            
            name_cell = cols[0].find('a')
            if not name_cell:
                continue
            name = name_cell.text.strip()
            
            try:
                vals = [c.text.strip() for c in cols]
                att = float(vals[1])
                cmp = float(vals[2])
                p_yds = float(vals[3])
                p_td = float(vals[4])
                p_int = float(vals[5])
                r_yds = float(vals[8])
                r_td = float(vals[9])
                fl = float(vals[10])
                
                # Convert season to weekly (divide by 17)
                stats = {
                    'attempts': att / 17,
                    'completions': cmp / 17,
                    'passing_yards': p_yds / 17,
                    'passing_tds': p_td / 17,
                    'interceptions': p_int / 17,
                    'pick_sixes': 0,
                    'rushing_yards': r_yds / 17,
                    'rushing_tds': r_td / 17,
                    'fumbles_lost': fl / 17,
                    'sacks': 0,
                    'team_loss': False
                }
                
                custom_pts = calculate_worst_qb_score(stats)
                projections.append({
                    'name': name,
                    'projected_custom_points': float(custom_pts),
                    'week': current_week
                })
            except Exception as e:
                pass
                
        return projections
    except Exception as e:
        print(f"Error scraping CBS: {e}")
        return []

def main():
    print("Starting Worst QB Live Stats Scraper...")
    
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Exiting.")
        return
        
    supabase: Client = create_client(url, key)
    
    year = 2023
    print("Fetching Roster and Weekly Data...")
    try:
        weekly_data = nfl.import_weekly_data([year])
        rosters = nfl.import_seasonal_rosters([year])
    except Exception as e:
        print(f"Error fetching NFL data: {e}")
        return
        
    if weekly_data.empty:
        print("No data available for the given year.")
        return
        
    # Filter for Quarterbacks
    qbs = weekly_data[weekly_data['position'] == 'QB'].copy()
    
    records_to_upsert = []
    
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
            'team_loss': False
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
            'custom_points': float(custom_points)
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
                'team_loss': False
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
            'custom_points': float(custom_points)
        })

    # Upsert Stats
    if records_to_upsert:
        print(f"Upserting {len(records_to_upsert)} stat records...")
        try:
            supabase.table('player_stats').upsert(records_to_upsert).execute()
            print("Stats updated successfully!")
        except Exception as e:
            print(f"Error updating Supabase stats: {e}")
            
    # Upsert Projections
    current_week = int(weekly_data['week'].max() + 1) if not weekly_data.empty else 1
    projections_data = scrape_cbs_projections(year, current_week)
    if projections_data:
        try:
            db_players = supabase.table('players').select('id, name').execute().data
            
            # Simple fuzzy matching (last name or exact match)
            name_to_id = {}
            for p in db_players:
                name_to_id[p['name'].lower()] = p['id']
                # also map last names for easier matching (e.g. "P. Mahomes" -> "Mahomes")
                parts = p['name'].split(' ')
                if len(parts) > 1:
                    name_to_id[parts[-1].lower()] = p['id']
                    
            proj_to_upsert = []
            for p in projections_data:
                # Try exact
                pid = name_to_id.get(p['name'].lower())
                # Try last name
                if not pid:
                    parts = p['name'].split(' ')
                    pid = name_to_id.get(parts[-1].lower())
                    
                if pid:
                    proj_to_upsert.append({
                        'player_id': pid,
                        'week': p['week'],
                        'projected_custom_points': p['projected_custom_points'],
                        'opponent': 'TBD'
                    })
                    
            if proj_to_upsert:
                supabase.table('player_projections').upsert(proj_to_upsert).execute()
                print(f"Projections updated successfully for {len(proj_to_upsert)} players!")
        except Exception as e:
            print(f"Error updating projections: {e}")
            
if __name__ == '__main__':
    main()
