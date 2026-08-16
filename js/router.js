export class Router {
    constructor(routes) {
        this.routes = routes;
        this.appContent = document.getElementById('app-content');
        
        // Listen to nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const route = e.target.getAttribute('data-route');
                this.navigate(route);
            });
        });
    }

    navigate(routeName) {
        if (!this.routes[routeName]) return;

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('data-route') === routeName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Render the view
        this.appContent.innerHTML = this.routes[routeName].render();
        
        // Execute any initialization logic for the view
        if (typeof this.routes[routeName].init === 'function') {
            this.routes[routeName].init();
        }
    }
}
