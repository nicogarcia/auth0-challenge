# Auth0 Challenge

Auth0 Challenge is a little game built upon Webtasks and Firebase that consists of people concurrently voting to make their favorite Auth0 site win races.

### Rules
- Hacking is forbidden! (if we can say doing a simple HTTP POST loop is hacking).
- Votes are short-lived.
- Game resets every 5 minutes.
- Global wins counters don't reset.

### Development tools
- Webtasks: 
  - Receives votes from each site and saves them in Webtask Storage.
  - Receives update signal to write the game state into Firebase Database.
  - Stores secrets to access Firebase Database.
- Firebase:
  - Database: stores the game state and updates clients in real-time.
  - Authentication: allows only Webtask to write into the database.
- D3:
  - Draws the race field and the sites icons.
  - Animates icons according to each site's score.
  
### Known issues
- Ugly UI.
- Maybe some race conditions on vote or winners writing.
- Maybe req/sec webtask limitation is hit when there are many players at the same time.
- Webtask GET method must be called from outside every second to update game state.
- Some obvious refactorings and code optimizations needed.
