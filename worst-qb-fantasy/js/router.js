export class Router {
    constructor(routes) {
        this.routes = routes;
        this.appContent = document.getElementById('app-content');
        
        // Listen to nav links globally
        document.addEventListener('click', (e) => {
            // Find closest element with nav-link class or data-route
            const link = e.target.closest('[data-route]');
            if (link) {
                e.preventDefault();
                const route = link.getAttribute('data-route');
                // Extract any data attributes to pass as params
                const params = { ...link.dataset };
                delete params.route; // remove the route key itself
                this.navigate(route, params);
            }
        });
    }

    navigate(routeName, params = {}) {
        if (!this.routes[routeName]) return;

        // Update active nav link (only for main top-level navs)
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('data-route') === routeName) {
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
