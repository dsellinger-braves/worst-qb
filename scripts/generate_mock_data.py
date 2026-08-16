import os
import random
from supabase import create_client, Client

def main():
    print("Starting Mock Data Generation...")
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.")
        return
        
    supabase: Client = create_client(url, key)
    
    # 1. Create Mock Users
    print("1. Creating 6 Mock Users...")
    mock_users = []
    suffix = random.randint(1000, 9999)
    
    for i in range(1, 7):
        email = f'mock_{suffix}_{i}@worstqb.com'
        try:
            response = supabase.auth.admin.create_user({
                'email': email,
                'password': 'password123',
                'email_confirm': True
            })
            mock_users.append(response.user.id)
            print(f"Created user {email} with password: password123")
        except Exception as e:
            print(f"Failed to create {email}: {e}")
            
    if len(mock_users) < 6:
        print("Could not create 6 mock users. Exiting.")
        return
        
    creator_id = mock_users[0]
    
    # 2. Create Mock Leagues
    print("2. Creating Mock Leagues...")
    try:
        indiv_league = supabase.table('leagues').insert({
            'name': f'Mock Individual League {suffix}',
            'created_by': creator_id,
            'current_week': 18,
            'draft_status': 'completed',
            'scoring_type': 'individual'
        }).execute()
        indiv_league_id = indiv_league.data[0]['id']
        
        team_league = supabase.table('leagues').insert({
            'name': f'Mock Team League {suffix}',
            'created_by': creator_id,
            'current_week': 18,
            'draft_status': 'completed',
            'scoring_type': 'team_qb'
        }).execute()
        team_league_id = team_league.data[0]['id']
        print(f"Created leagues {indiv_league_id} and {team_league_id}")
    except Exception as e:
        print(f"Error creating leagues: {e}")
        return
        
    # 3. Populate League Members
    print("3. Populating League Members...")
    team_names = [
        "The Pick Sixers",
        "Fumble Kings",
        "Sack Lunch",
        "Interception Inspectors",
        "Clipboard Holders",
        "Incomplete Passes"
    ]
    
    indiv_members = []
    team_members = []
    for i, user_id in enumerate(mock_users):
        indiv_members.append({
            'league_id': indiv_league_id,
            'user_id': user_id,
            'team_name': f"{team_names[i]} (Indiv)"
        })
        team_members.append({
            'league_id': team_league_id,
            'user_id': user_id,
            'team_name': f"{team_names[i]} (Team)"
        })
        
    supabase.table('league_members').insert(indiv_members).execute()
    supabase.table('league_members').insert(team_members).execute()
    
    # 4. Fetch Available Players & Stats
    print("4. Fetching Players & Stats to simulate drafts...")
    players_res = supabase.table('players').select('id, position').execute()
    all_players = players_res.data
    
    indiv_qbs = [p['id'] for p in all_players if p['position'] == 'QB']
    team_qbs = [p['id'] for p in all_players if p['position'] == 'TM_QB']
    
    if len(indiv_qbs) < 12 or len(team_qbs) < 12:
        print("WARNING: Not enough QBs in database to support 12 picks per week. Did you run the scraper first?")
    
    stats_res = supabase.table('player_stats').select('player_id, week, custom_points').execute()
    stats_map = {}
    for s in stats_res.data:
        key = (s['player_id'], s['week'])
        stats_map[key] = float(s['custom_points'])
        
    # 5. Simulate 18 weeks
    print("5. Simulating 18 Weeks of Drafts...")
    draft_picks_to_insert = []
    indiv_season_points = {uid: 0.0 for uid in mock_users}
    team_season_points = {uid: 0.0 for uid in mock_users}
    
    for week in range(1, 19):
        # Shuffle QBs to simulate random picks
        random.shuffle(indiv_qbs)
        random.shuffle(team_qbs)
        
        indiv_idx = 0
        team_idx = 0
        
        for user_id in mock_users:
            # Pick 2 for indiv
            for pick_num in [1, 2]:
                if indiv_idx < len(indiv_qbs):
                    pid = indiv_qbs[indiv_idx]
                    indiv_idx += 1
                    draft_picks_to_insert.append({
                        'league_id': indiv_league_id,
                        'user_id': user_id,
                        'player_id': pid,
                        'week': week,
                        'pick_number': pick_num
                    })
                    pts = stats_map.get((pid, week), 0.0)
                    indiv_season_points[user_id] += pts
                
            # Pick 2 for team
            for pick_num in [1, 2]:
                if team_idx < len(team_qbs):
                    pid = team_qbs[team_idx]
                    team_idx += 1
                    draft_picks_to_insert.append({
                        'league_id': team_league_id,
                        'user_id': user_id,
                        'player_id': pid,
                        'week': week,
                        'pick_number': pick_num
                    })
                    pts = stats_map.get((pid, week), 0.0)
                    team_season_points[user_id] += pts
                
    # Chunk inserts to avoid payload too large errors
    print(f"Inserting {len(draft_picks_to_insert)} total draft picks...")
    chunk_size = 100
    for i in range(0, len(draft_picks_to_insert), chunk_size):
        chunk = draft_picks_to_insert[i:i+chunk_size]
        try:
            supabase.table('draft_picks').insert(chunk).execute()
        except Exception as e:
            print(f"Error inserting draft picks chunk: {e}")
        
    # 6. Update Season Points
    print("6. Calculating and updating season point standings...")
    for user_id in mock_users:
        supabase.table('league_members').update({'season_points': round(indiv_season_points[user_id], 2)}).eq('league_id', indiv_league_id).eq('user_id', user_id).execute()
        supabase.table('league_members').update({'season_points': round(team_season_points[user_id], 2)}).eq('league_id', team_league_id).eq('user_id', user_id).execute()
        
    print("\n✅ Mock data generation complete!")
    print(f"You can log in to the web app using the generated mock account:\nEmail: {mock_users[0]} (Wait, the email is mock_{suffix}_1@worstqb.com)\nPassword: password123")
    print("----------------------------------------------------------------")
    for i in range(1, 7):
        print(f"User {i}: mock_{suffix}_{i}@worstqb.com (password123)")

if __name__ == '__main__':
    main()
