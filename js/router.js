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

    renderRoute(routeName, params = {}) {
        if (!this.routes[routeName]) return;

        // Update active nav link (only for main top-level navs)
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('data-route') === routeName || link.getAttribute('href') === `#/${routeName}`) {
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
    }
}
