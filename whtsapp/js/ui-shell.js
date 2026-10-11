(function () {
    const isAdminPage = document.body && document.body.classList.contains("admin-shell");
    const tokenKey = isAdminPage ? "vbonotif_admin_token" : "vbonotif_token";
    const userKey = isAdminPage ? "vbonotif_admin_user" : "vbonotif_client";
    const loginPage = isAdminPage ? "admin-login.html" : "index.html";
    let redirecting = false;

    function clearSessionAndRedirect() {
        if (redirecting) return;
        redirecting = true;
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
        window.location.href = loginPage;
    }

    function shouldWatchRequest(input) {
        const url = typeof input === "string" ? input : input && input.url;
        if (!url) return false;
        return url.includes("/api/v1/") &&
            !url.includes("/auth/login") &&
            !url.includes("/whatsapp/admin/login");
    }

    if (window.fetch && !window.__vbonotifFetchWrapped) {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async function (input, init) {
            const response = await originalFetch(input, init);
            if (shouldWatchRequest(input) && response.status === 401) {
                clearSessionAndRedirect();
            }
            return response;
        };
        window.__vbonotifFetchWrapped = true;
    }

    function setupMobileMenu() {
        const sidebar = document.querySelector(".sidebar");
        const brand = sidebar ? sidebar.querySelector(".brand") : null;
        if (!sidebar || !brand || document.getElementById("mobileMenuButton")) return;

        const button = document.createElement("button");
        button.type = "button";
        button.id = "mobileMenuButton";
        button.className = "mobile-menu-button";
        button.setAttribute("aria-label", "Open menu");
        button.setAttribute("aria-expanded", "false");
        button.innerHTML = "<span></span><span></span><span></span>";

        const backdrop = document.createElement("div");
        backdrop.className = "mobile-menu-backdrop";

        brand.appendChild(button);
        document.body.appendChild(backdrop);

        function setOpen(open) {
            document.body.classList.toggle("mobile-menu-open", open);
            button.setAttribute("aria-expanded", open ? "true" : "false");
            button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        }

        button.addEventListener("click", function () {
            setOpen(!document.body.classList.contains("mobile-menu-open"));
        });

        backdrop.addEventListener("click", function () {
            setOpen(false);
        });

        sidebar.querySelectorAll("a, button").forEach(function (item) {
            if (item === button) return;
            item.addEventListener("click", function () {
                if (window.matchMedia("(max-width: 760px)").matches) {
                    setOpen(false);
                }
            });
        });

        window.addEventListener("keydown", function (event) {
            if (event.key === "Escape") setOpen(false);
        });

        window.addEventListener("resize", function () {
            if (!window.matchMedia("(max-width: 760px)").matches) {
                setOpen(false);
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupMobileMenu);
    } else {
        setupMobileMenu();
    }
})();
