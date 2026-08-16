import nfl_data_py as nfl
rosters = nfl.import_rosters([2024])
qbs = rosters[rosters['position'] == 'QB'].head(1)
print(qbs.columns.tolist())
print(qbs[['player_name', 'headshot_url', 'height', 'weight', 'college']].to_dict('records'))
