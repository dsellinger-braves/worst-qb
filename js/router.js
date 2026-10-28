export class Router {
    constructor(routes) {
        this.routes = routes;
        this.appContent = document.getElementById('app-content');
        
        // Listen to hash changes globally
        window.addEventListener('hashchange', () => this.handleHashChange());
        
        // Ensure legacy clicks on data-route work by updating the hash
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-route]');
            if (link) {
                e.preventDefault();
                const routeName = link.getAttribute('data-route');
                const params = { ...link.dataset };
                delete params.route;
                
                // Build query string
                const query = new URLSearchParams(params).toString();
                window.location.hash = query ? `#/${routeName}?${query}` : `#/${routeName}`;
            }
        });
    }

    handleHashChange() {
        let hash = window.location.hash.slice(1); // remove '#'
        if (!hash) hash = '/rules'; // default route
        if (hash.startsWith('/')) hash = hash.slice(1);
        
        const [routePath, queryString] = hash.split('?');
        const params = {};
        if (queryString) {
            new URLSearchParams(queryString).forEach((value, key) => {
                params[key] = value;
            });
        }
        
        this.renderRoute(routePath, params);
    }

    navigate(routeName, params = {}) {
        const query = new URLSearchParams(params).toString();
        window.location.hash = query ? `#/${routeName}?${query}` : `#/${routeName}`;
    }

    async renderRoute(routeName, params = {}) {
        if (!this.routes[routeName]) {
            if (routeName === 'claim') {
                const fallbackRoute = params.league ? 'league_detail' : 'leagues';
                await this.renderRoute(fallbackRoute, params);
                import('./claim.js?v=1.7').then(({ ClaimManager }) => {
                    ClaimManager.openClaimModal(params.league, params.team);
                });
                return;
            }
            return;
        }

        // Manage League Sub-Navigation Context
        const leagueNav = document.getElementById('league-nav');
        if (params.league) {
            leagueNav.style.display = 'flex';
            // Update Hrefs to maintain league context
            document.getElementById('ln-home').href = `#/league_detail?league=${params.league}`;
            document.getElementById('ln-draft').href = `#/draft?league=${params.league}`;
            if (document.getElementById('ln-scoreboard')) document.getElementById('ln-scoreboard').href = `#/scoreboard?league=${params.league}`;
            if (document.getElementById('ln-cumulative')) document.getElementById('ln-cumulative').href = `#/cumulative?league=${params.league}`;
            document.getElementById('ln-matchups').href = `#/matchups?league=${params.league}`;
            document.getElementById('ln-proj').href = `#/projections?league=${params.league}`;
            document.getElementById('ln-stats').href = `#/stats?league=${params.league}`;
            
            // Set active state for sub-nav
            const currentHref = `#/${routeName}?league=${params.league}`;
            document.querySelectorAll('#league-nav-links .nav-link').forEach(link => {
                if (link.getAttribute('href') === currentHref || (routeName === 'league_detail' && link.id === 'ln-home')) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });

            // Fetch League Name asynchronously to avoid blocking render
            import('./supabase.js').then(({ supabase }) => {
                if (supabase) {
                    supabase.from('leagues').select('name').eq('id', params.league).single().then(({ data }) => {
                        if (data) document.getElementById('league-nav-name').innerText = data.name;
                    });
                }
            });
        } else {
            leagueNav.style.display = 'none';
        }

        // Update active nav link for global navs
        document.querySelectorAll('#global-nav .nav-link').forEach(link => {
            if (link.getAttribute('href') === `#/${routeName}`) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Render the view
        this.appContent.innerHTML = this.routes[routeName].render(params);
        
        // Execute any initialization logic for the view
        if (typeof this.routes[routeName].init === 'function') {
            this.routes[routeName].init(params);
        }

        // If claim query parameter was passed, open claim modal
        if (params.claim === 'true' || params.claim === '1') {
            import('./claim.js?v=1.7').then(({ ClaimManager }) => {
                ClaimManager.openClaimModal(params.league, params.team);
            });
        }
    }
}
