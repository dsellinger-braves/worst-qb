import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv
from supabase import create_client, Client
from google import genai

# Load environment variables from .env
load_dotenv()

def get_supabase_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    # Check both common names for the service key
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env. Exiting.")
        return None
        
    return create_client(url, key)

def calculate_league_score(stats, settings):
    if not stats:
        return 0.0
    attempts = stats.get('attempts', 0)
    if attempts <= 0:
        return float(settings.get('no_attempts', -20.0))
        
    pts = 0.0
    pts += stats.get('passing_yards', 0) * float(settings.get('pass_yds', -0.05))
    pts += stats.get('passing_tds', 0) * float(settings.get('pass_tds', -5.0))
    pts += stats.get('interceptions', 0) * float(settings.get('ints', 5.0))
    pts += stats.get('pick_sixes', 0) * float(settings.get('pick_sixes', 10.0))
    pts += stats.get('rushing_yards', 0) * float(settings.get('rush_yds', -0.1))
    pts += stats.get('rushing_tds', 0) * float(settings.get('rush_tds', -5.0))
    pts += stats.get('fumbles_lost', 0) * float(settings.get('fumbles_lost', 4.0))
    pts += stats.get('sacks', 0) * float(settings.get('sacks', 1.0))
    if stats.get('team_loss'):
        pts += float(settings.get('team_loss', 5.0))
        
    comp_pct = stats.get('completions', 0) / attempts
    pts += float(settings.get('completion_penalty_multiplier', 20.0)) * (1.0 - comp_pct)
    return round(pts, 2)

def get_league_data(supabase: Client, league_id: str):
    # Get league details
    league_res = supabase.table('leagues').select('*').eq('id', league_id).single().execute()
    league = league_res.data
    current_week = league['current_week']
    settings = league.get('scoring_settings') or {}
    
    # Get members and their YTD points
    members_res = supabase.table('league_members').select('*').eq('league_id', league_id).order('season_points', desc=True).execute()
    members = members_res.data
    
    # Get this week's picks
    picks_res = supabase.table('draft_picks').select('*, players(name)').eq('league_id', league_id).eq('week', current_week).execute()
    picks = picks_res.data
    
    # Get regular season player stats for this week
    stats_res = supabase.table('player_stats').select('*').eq('week', current_week).eq('season_type', 'regular').execute()
    stats = { s['player_id']: s for s in stats_res.data }
    
    # Aggregate weekly points for each member using league scoring settings
    weekly_scores = {}
    for member in members:
        uid = member['user_id']
        member_picks = [p for p in picks if p['user_id'] == uid]
        pts = 0.0
        for p in member_picks:
            stat = stats.get(p['player_id'])
            if stat:
                pts += calculate_league_score(stat, settings)
        weekly_scores[uid] = {
            'team_name': member['team_name'],
            'points': pts,
            'picks': member_picks
        }
        
    # Sort members by weekly points descending (highest points is "best" worst QB)
    weekly_standings = sorted(weekly_scores.values(), key=lambda x: x['points'], reverse=True)
    
    return league, current_week, members, weekly_standings, stats

def generate_blog_post(league, current_week, members, weekly_standings):
    # Create the prompt context
    prompt = f"""
    You are a witty, slightly cynical sports blogger (think Barstool Sports or Deadspin) writing a weekly recap for a fantasy football league called "{league['name']}".
    
    CRITICAL RULE: In this league, "Worst QB", the goal is to draft the WORST performing quarterbacks each week. 
    A HIGHER score means the QB played terribly (which is GOOD for the fantasy team). A lower or negative score means the QB played well (which is BAD for the fantasy team).
    
    Here is the recap for Week {current_week}:
    
    Weekly Standings (Highest score wins the week):
    """
    for idx, team in enumerate(weekly_standings):
        pick_names = [p['players']['name'] for p in team['picks']]
        picks_str = ", ".join(pick_names) if pick_names else "No picks"
        prompt += f"{idx+1}. {team['team_name']}: {team['points']:.2f} pts (Drafted: {picks_str})\n"
        
    prompt += "\nYear-To-Date (YTD) Standings (Highest score is in first place):\n"
    for idx, member in enumerate(members):
        prompt += f"{idx+1}. {member['team_name']}: {member['season_points']:.2f} pts\n"
        
    prompt += """
    Please write a fun, engaging, 3-4 paragraph blog post summarizing the week's action. 
    Highlight the team that scored the most points (they had the worst QBs and won the week). 
    Make fun of the team that scored the fewest points (they drafted good QBs, which means they lose).
    Mention any historical trends from the YTD standings.
    Format your response in clean HTML using <p>, <strong>, <h3>, etc. Do NOT wrap it in ```html markdown blocks.
    """
    
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )
    
    # Strip markdown if Gemini includes it
    html = response.text
    if html.startswith('```html'):
        html = html[7:]
    if html.endswith('```'):
        html = html[:-3]
        
    return html.strip()

def send_email(recipients, subject, html_content):
    sender = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")
    
    if not sender or not password:
        print("Missing GMAIL_USER or GMAIL_APP_PASSWORD. Cannot send email.")
        return
        
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender, password)
        
        for recipient in recipients:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = sender
            msg['To'] = recipient
            part = MIMEText(html_content, 'html')
            msg.attach(part)
            server.sendmail(sender, [recipient], msg.as_string())
            
        server.quit()
        print(f"Successfully sent individual emails to {len(recipients)} recipients.")
    except Exception as e:
        print(f"Failed to send email: {e}")

def main():
    supabase = get_supabase_client()
    if not supabase:
        return
        
    if not os.environ.get("GEMINI_API_KEY"):
        print("Missing GEMINI_API_KEY. Exiting.")
        return

    # Fetch all users to map user_id -> email
    # This requires the service role key!
    try:
        users_response = supabase.auth.admin.list_users()
        user_emails = {}
        for user in users_response:
            # Check opt_in metadata (default true if not set)
            opt_in = user.user_metadata.get('email_opt_in', True)
            if opt_in:
                user_emails[user.id] = user.email
    except Exception as e:
        print(f"Failed to fetch users from auth.admin. Ensure you are using the SUPABASE_SERVICE_ROLE_KEY. Error: {e}")
        return

    # Process each active league
    leagues_res = supabase.table('leagues').select('*').execute()
    for league in leagues_res.data:
        print(f"Processing league: {league['name']}")
        
        try:
            _, current_week, members, weekly_standings, stats = get_league_data(supabase, league['id'])
            
            # If no picks or no members, skip
            if not members:
                print(f"No members in {league['name']}, skipping.")
                continue
                
            print(f"Generating blog post for Week {current_week}...")
            blog_html = generate_blog_post(league, current_week, members, weekly_standings)
            
            # Build final HTML email
            email_html = f"""
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }}
                    h2 {{ color: #1a56db; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }}
                    .blog-post {{ background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0; }}
                    table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
                    th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }}
                    th {{ background-color: #f3f4f6; font-weight: bold; }}
                    .highlight {{ color: #dc2626; font-weight: bold; }}
                </style>
            </head>
            <body>
                <h2>Worst QB - {league['name']} Week {current_week} Summary</h2>
                
                <div class="blog-post">
                    {blog_html}
                </div>
                
                <h3>Weekly Performances</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Team</th>
                            <th>Drafted</th>
                            <th>Points</th>
                        </tr>
                    </thead>
                    <tbody>
            """
            
            for idx, team in enumerate(weekly_standings):
                pick_names = [p['players']['name'] for p in team['picks']]
                picks_str = ", ".join(pick_names) if pick_names else "-"
                email_html += f"""
                        <tr>
                            <td>{idx + 1}</td>
                            <td>{team['team_name']}</td>
                            <td>{picks_str}</td>
                            <td class="highlight">{team['points']:.2f}</td>
                        </tr>
                """
                
            email_html += """
                    </tbody>
                </table>
                
                <h3>YTD Season Standings</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Team</th>
                            <th>Total Points</th>
                        </tr>
                    </thead>
                    <tbody>
            """
            
            for idx, member in enumerate(members):
                email_html += f"""
                        <tr>
                            <td>{idx + 1}</td>
                            <td>{member['team_name']}</td>
                            <td class="highlight">{member['season_points']:.2f}</td>
                        </tr>
                """
                
            # Note: Unsubscribe URL assumes standard local/production routing
            email_html += """
                    </tbody>
                </table>
                
                <div style="font-size: 0.8em; color: #6b7280; margin-top: 40px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                    <p>Generated automatically by the Worst QB Commissioner Bot.</p>
                    <p>Don't want to receive these emails? <a href="http://localhost:5500/#/settings" style="color: #1a56db;">Click here to update your Account Settings</a>.</p>
                </div>
            </body>
            </html>
            """
            
            # Collect emails for league members
            recipients = []
            for m in members:
                uid = m['user_id']
                if uid in user_emails and user_emails[uid]:
                    recipients.append(user_emails[uid])
                    
            if recipients:
                subject = f"Worst QB Recap: {league['name']} Week {current_week}"
                print(f"Sending email to {len(recipients)} recipients...")
                send_email(recipients, subject, email_html)
            else:
                print("No recipient emails found for this league (or all opted out).")
                
        except Exception as e:
            print(f"Error processing league {league['name']}: {e}")

if __name__ == "__main__":
    main()
