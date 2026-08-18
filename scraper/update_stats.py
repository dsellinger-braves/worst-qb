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
    
    team_loss_prob = row.get('team_loss_prob', 0)
    if team_loss_prob > 0:
        score += (5 * team_loss_prob)
    else:
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

def fetch_schedules_and_odds(year):
    import urllib.request
    import json
    schedule_matrix = {}
    for week in range(1, 19):
        url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates={year}&seasontype=2&week={week}"
        try:
            req = urllib.request.Request(url)
            res = urllib.request.urlopen(req)
            data = json.loads(res.read())
            for event in data.get('events', []):
                for comp in event.get('competitions', []):
                    home_id = None
                    away_id = None
                    for c in comp['competitors']:
                        if c['homeAway'] == 'home': home_id = int(c['team']['id'])
                        if c['homeAway'] == 'away': away_id = int(c['team']['id'])
                        
                    odds_list = comp.get('odds', [])
                    home_prob = 0.5
                    away_prob = 0.5
                    if odds_list:
                        ml_data = odds_list[0].get('moneyline', {})
                        if ml_data:
                            home_ml_str = ml_data.get('home', {}).get('close', {}).get('odds', 'EVEN')
                            away_ml_str = ml_data.get('away', {}).get('close', {}).get('odds', 'EVEN')
                            def parse_ml(ml_str):
                                if ml_str.upper() == 'EVEN': return 100
                                try: return int(ml_str)
                                except: return 100
                            home_ml = parse_ml(home_ml_str)
                            away_ml = parse_ml(away_ml_str)
                            def imp_prob(ml):
                                if ml > 0: return 100.0 / (ml + 100.0)
                                else: return abs(ml) / (abs(ml) + 100.0)
                            hp = imp_prob(home_ml)
                            ap = imp_prob(away_ml)
                            total = hp + ap
                            if total > 0:
                                home_prob = hp / total
                                away_prob = ap / total
                    schedule_matrix[(home_id, week)] = {'opponent': away_id, 'loss_prob': 1.0 - home_prob}
                    schedule_matrix[(away_id, week)] = {'opponent': home_id, 'loss_prob': 1.0 - away_prob}
        except Exception:
            pass
    return schedule_matrix

def scrape_espn_projections(year, current_week):
    print("Scraping ESPN Projections (All Players)...")
    import urllib.request
    import json
    
    schedule_matrix = fetch_schedules_and_odds(year)
    
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
        
        # Build defense sacks matrix
        defense_sacks = {}
        for p_data in data.get('players', []):
            player = p_data.get('player', {})
            pos_id = player.get('defaultPositionId', 0)
            if pos_id == 16: # D/ST
                pro_team_id = player.get('proTeamId', 0)
                stats = player.get('stats', [])
                for s in stats:
                    if s.get('statSourceId') == 1 and s.get('statSplitTypeId') == 1:
                        week = s.get('scoringPeriodId')
                        proj_stats = s.get('stats', {})
                        sacks = float(proj_stats.get('99', 0))
                        defense_sacks[(pro_team_id, week)] = sacks
                        
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
                        
                    opp_info = schedule_matrix.get((pro_team_id, week), {'opponent': 0, 'loss_prob': 0.5})
                    opp_team_id = opp_info['opponent']
                    loss_prob = opp_info['loss_prob']
                    
                    proj_sacks = 0
                    if pos_id == 1 or 'QB' in pos_label:
                        proj_sacks = defense_sacks.get((opp_team_id, week), 0)

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
                        'sacks': proj_sacks,
                        'team_loss_prob': loss_prob,
                        'team_loss': False
                    }
                    
                    custom_pts = calculate_worst_qb_score(stats_dict)
                    
                    # Store raw stats in opponent column as a JSON string since we can't alter schema
                    import json
                    opp_payload = json.dumps({
                        'opp': ESPN_TEAM_MAP.get(opp_team_id, 'TBD'),
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

def fetch_actuals_gamecast(year, week, season_type):
    import urllib.request
    import json
    
    url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates={year}&seasontype={season_type}&week={week}"
    try:
        req = urllib.request.Request(url)
        res = urllib.request.urlopen(req)
        data = json.loads(res.read())
        
        events = data.get('events', [])
        
        all_stats = []
        for event in events:
            event_id = event['id']
            gc_url = f"https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/summary?region=us&lang=en&contentorigin=espn&event={event_id}&features=ng"
            gc_req = urllib.request.Request(gc_url)
            gc_res = urllib.request.urlopen(gc_req)
            gc_data = json.loads(gc_res.read())
            
            boxscore = gc_data.get('boxscore', {})
            players_block = boxscore.get('players', [])
            
            team_loss_dict = {}
            competitions = gc_data.get('header', {}).get('competitions', [{}])
            if competitions:
                competitors = competitions[0].get('competitors', [])
                for c in competitors:
                    team_id = c.get('team', {}).get('id')
                    winner = c.get('winner', False)
                    is_loss = False
                    if winner == False:
                        other_team = next((o for o in competitors if o['id'] != c['id']), None)
                        if other_team and other_team.get('winner'):
                            is_loss = True
                    if team_id:
                        team_loss_dict[int(team_id)] = is_loss

            for team_obj in players_block:
                team_id = team_obj.get('team', {}).get('id')
                if team_id: team_id = int(team_id)
                team_abbr = ESPN_TEAM_MAP.get(team_id, 'FA') if team_id else 'FA'
                is_loss = team_loss_dict.get(team_id, False)
                
                player_stats = {}
                for stat_group in team_obj.get('statistics', []):
                    cat_name = stat_group.get('name', '')
                    keys = stat_group.get('keys', [])
                    for athlete in stat_group.get('athletes', []):
                        pid = athlete.get('athlete', {}).get('id')
                        pname = athlete.get('athlete', {}).get('displayName')
                        if not pid: continue
                        
                        espn_id = f"espn-{pid}"
                        if espn_id not in player_stats:
                            player_stats[espn_id] = {
                                'player_id': espn_id, 'name': pname, 'team': team_abbr, 'week': week,
                                'season_type': 'preseason' if season_type == 1 else 'regular',
                                'attempts': 0, 'completions': 0, 'passing_yards': 0,
                                'passing_tds': 0, 'interceptions': 0, 'pick_sixes': 0,
                                'rushing_yards': 0, 'rushing_tds': 0, 'fumbles_lost': 0,
                                'sacks': 0, 'team_loss': is_loss
                            }
                            
                        p_obj = player_stats[espn_id]
                        stats_arr = athlete.get('stats', [])
                        
                        if cat_name == 'passing':
                            for i, key in enumerate(keys):
                                val = stats_arr[i] if i < len(stats_arr) else "0"
                                if key == "completions/passingAttempts":
                                    parts = val.split('/')
                                    if len(parts) == 2:
                                        p_obj['completions'] = int(parts[0])
                                        p_obj['attempts'] = int(parts[1])
                                elif key == "passingYards": p_obj['passing_yards'] = int(val)
                                elif key == "passingTouchdowns": p_obj['passing_tds'] = int(val)
                                elif key == "interceptions": p_obj['interceptions'] = int(val)
                                elif key == "sacks-sackYardsLost":
                                    parts = val.split('-')
                                    if len(parts) >= 1: p_obj['sacks'] = int(parts[0])
                        elif cat_name == 'rushing':
                            for i, key in enumerate(keys):
                                val = stats_arr[i] if i < len(stats_arr) else "0"
                                if key == "rushingYards": p_obj['rushing_yards'] = int(val)
                                elif key == "rushingTouchdowns": p_obj['rushing_tds'] = int(val)
                        elif cat_name == 'fumbles':
                            for i, key in enumerate(keys):
                                val = stats_arr[i] if i < len(stats_arr) else "0"
                                if key == "fumblesLost": p_obj['fumbles_lost'] = int(val)
                all_stats.extend(player_stats.values())
        return all_stats
    except Exception as e:
        print(f"Error fetching actuals for week {week} seasonType {season_type}: {e}")
        return []

def main():
    parser = argparse.ArgumentParser(description="Worst QB Live Stats Scraper")
    parser.add_argument('--year', type=int, default=2026, help="NFL Season Year to scrape (e.g. 2026)")
    args = parser.parse_args()
    
    print(f"Starting Worst QB Stats Scraper for {args.year}...")
    
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Exiting.")
        return
        
    supabase: Client = create_client(url, key)
    
    year = args.year
    print("Fetching Gamecast Actuals...")
        
    # We will fetch preseason weeks (1 to 4) and regular season weeks (1 to 18)
    all_game_stats = []
    
    # Preseason (season_type = 1)
    for w in range(1, 5):
        stats = fetch_actuals_gamecast(year, w, 1)
        if stats: all_game_stats.extend(stats)
        
    # Regular Season (season_type = 2)
    for w in range(1, 19):
        stats = fetch_actuals_gamecast(year, w, 2)
        if stats: all_game_stats.extend(stats)
        
    records_to_upsert = []
    
    for row in all_game_stats:
        player_id = row['player_id']
        
        # We only want to save players who actually registered attempts (either passing or rushing) 
        # to avoid cluttering the DB with 0-stat lines for every player in the boxscore
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
    for row in records_to_upsert:
        team = row.get('team')
        if not team or team == 'FA': continue
            
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
                'team_loss': row['team_loss']
            }
            
        ts = team_stats_dict[key]
        ts['attempts'] += row['attempts']
        ts['completions'] += row['completions']
        ts['passing_yards'] += row['passing_yards']
        ts['passing_tds'] += row['passing_tds']
        ts['interceptions'] += row['interceptions']
        ts['rushing_yards'] += row['rushing_yards']
        ts['rushing_tds'] += row['rushing_tds']
        ts['fumbles_lost'] += row['fumbles_lost']
        ts['sacks'] += row['sacks']

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

    if records_to_upsert:
        # Upsert in chunks to avoid payload limits
        chunk_size = 500
        for i in range(0, len(records_to_upsert), chunk_size):
            chunk = records_to_upsert[i:i + chunk_size]
            try:
                # Need to use the new unique constraint for on_conflict
                supabase.table('player_stats').upsert(chunk, on_conflict='player_id,week,season_type').execute()
            except Exception as e:
                print(f"Error upserting stats chunk: {e}")
        print(f"Successfully upserted {len(records_to_upsert)} actual stat lines!")
            
    # Upsert Projections
    current_week = 1 
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
