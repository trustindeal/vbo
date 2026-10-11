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

    function parseTimestamp(value) {
        if (!value) return null;
        if (value instanceof Date) return value;

        if (typeof value === "number") {
            return new Date(value < 100000000000 ? value * 1000 : value);
        }

        const raw = String(value).trim();
        if (!raw || raw === "-") return null;

        if (/^\d+$/.test(raw)) {
            const numeric = Number(raw);
            return new Date(raw.length <= 10 ? numeric * 1000 : numeric);
        }

        let normalized = raw.replace(" ", "T");
        const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
        const looksLikeDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized);

        if (looksLikeDateTime && !hasTimezone) {
            normalized += "Z";
        }

        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function formatTimestamp(value, options, fallback) {
        const parsed = parseTimestamp(value);
        if (!parsed) return fallback ?? String(value || "");

        return parsed.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour12: false,
            ...options
        });
    }

    function getDateParts(value) {
        const parsed = parseTimestamp(value || new Date());
        if (!parsed) return null;

        const parts = new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).formatToParts(parsed);

        return parts.reduce(function (result, part) {
            if (part.type !== "literal") result[part.type] = part.value;
            return result;
        }, {});
    }

    window.VBOTime = {
        parse: parseTimestamp,
        parts: getDateParts,
        dateInput(value) {
            const parts = getDateParts(value || new Date());
            return parts ? `${parts.year}-${parts.month}-${parts.day}` : "";
        },
        date(value) {
            return formatTimestamp(value, {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }, String(value || ""));
        },
        time(value) {
            return formatTimestamp(value, {
                hour: "2-digit",
                minute: "2-digit"
            }, "");
        },
        dateTime(value) {
            return formatTimestamp(value, {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
            }, String(value || ""));
        },
        dateTimeFull(value) {
            return formatTimestamp(value, {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }, String(value || ""));
        },
        dateTimeNumeric(value) {
            return formatTimestamp(value, {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }, String(value || ""));
        }
    };

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
