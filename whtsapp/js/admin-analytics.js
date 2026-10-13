(() => {
    "use strict";

    const API_URL = "https://app.vbo.co.in/api/v1/whatsapp/admin/stats/analytics";
    const charts = {};

    const money = value => value == null
        ? "Unverified"
        : "₹" + Number(value).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

    const number = value => Number(value || 0).toLocaleString("en-IN");

    function showMessage(message, isError = false) {
        const el = document.getElementById("analyticsMessage");
        if (!el) return;
        el.textContent = message;
        el.classList.toggle("is-error", isError);
    }

    function drawChart(id, config) {
        const canvas = document.getElementById(id);
        if (!canvas || typeof Chart === "undefined") return;
        if (charts[id]) charts[id].destroy();
        charts[id] = new Chart(canvas, config);
    }

    function renderSummary(summary) {
        const cards = [
            ["Total Messages", number(summary.total_messages)],
            ["Incoming", number(summary.incoming)],
            ["Outgoing", number(summary.outgoing)],
            ["Recorded Charges", money(summary.recorded_charges)],
            ["Recorded Refunds", money(summary.recorded_refunds)],
            ["Recorded Net", money(summary.recorded_net)]
        ];

        document.getElementById("analyticsSummary").innerHTML = cards.map(item =>
            '<div class="analytics-metric"><span>' + item[0] +
            '</span><strong>' + item[1] + '</strong></div>'
        ).join("");
    }

    function renderClientChart(clients) {
        drawChart("analyticsClientChart", {
            type: "pie",
            data: {
                labels: clients.map(c => c.client_name),
                datasets: [{
                    data: clients.map(c => Number(c.total_messages || 0))
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } }
            }
        });
    }

    function renderStatusChart(statuses) {
        drawChart("analyticsStatusChart", {
            type: "doughnut",
            data: {
                labels: statuses.map(s => s.status),
                datasets: [{
                    data: statuses.map(s => Number(s.count || 0))
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } }
            }
        });
    }

    function renderBillingChart(clients) {
        drawChart("analyticsBillingChart", {
            type: "bar",
            data: {
                labels: clients.map(c => c.client_name),
                datasets: [
                    {
                        label: "Charges",
                        data: clients.map(c => c.recorded_charges),
                        backgroundColor: "#2878b5"
                    },
                    {
                        label: "Refunds",
                        data: clients.map(c => c.recorded_refunds),
                        backgroundColor: "#e5a23c"
                    },
                    {
                        label: "Net",
                        data: clients.map(c => c.recorded_net),
                        backgroundColor: "#27966b"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                },
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            label: context => context.dataset.label + ": " +
                                (context.raw == null ? "Unverified" : money(context.raw))
                        }
                    }
                }
            }
        });
    }

    function renderTable(clients) {
        const tbody = document.getElementById("analyticsClientRows");
        tbody.innerHTML = "";

        if (!clients.length) {
            tbody.innerHTML = '<tr><td colspan="8">No active client data found.</td></tr>';
            return;
        }

        clients.forEach(client => {
            const values = [
                client.client_name,
                number(client.total_messages),
                number(client.incoming),
                number(client.outgoing),
                money(client.recorded_charges),
                money(client.recorded_refunds),
                money(client.recorded_net),
                client.billing_verified ? "Verified" : "Unverified"
            ];

            const tr = document.createElement("tr");
            values.forEach((value, index) => {
                const td = document.createElement("td");
                td.textContent = value;
                if (index === 7) {
                    td.className = client.billing_verified
                        ? "analytics-verified" : "analytics-unverified";
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    function ensureAnalyticsFilters() {
        const panel = document.getElementById("adminAnalytics");
        if (!panel || document.getElementById("analyticsFilters")) return;
        const box = document.createElement("div");
        box.id = "analyticsFilters";
        box.className = "analytics-filters";
        box.innerHTML = `
          <label>Client <select id="filterClient"><option value="">All clients</option></select></label>
          <label>From <input type="date" id="filterStartDate"></label>
          <label>To <input type="date" id="filterEndDate"></label>
          <label>Direction <select id="filterDirection"><option value="">All directions</option><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select></label>
          <label>Status <select id="filterStatus"><option value="">All statuses</option><option value="delivered">Delivered</option><option value="read">Read</option><option value="sent">Sent</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="rejected">Rejected</option></select></label>
          <label>Billing <select id="filterBilling"><option value="">All billing</option><option value="verified">Verified</option><option value="unverified">Unverified</option></select></label>
          <button type="button" id="applyAnalyticsFilters">Apply filters</button>
          <button type="button" id="clearAnalyticsFilters">Clear</button>`;
        const summary = document.getElementById("analyticsMessage");
        summary?.insertAdjacentElement("afterend", box);
        const style = document.createElement("style");
        style.textContent = `
          .analytics-filters{display:flex;flex-wrap:wrap;gap:12px;align-items:end;padding:14px 0}
          .analytics-filters label{display:flex;flex-direction:column;gap:5px;font-size:13px;min-width:125px}
          .analytics-filters input,.analytics-filters select{padding:8px;max-width:100%;border:1px solid #bbb;border-radius:6px}
          .analytics-filters button{padding:9px 13px;border:1px solid #aaa;border-radius:6px;cursor:pointer}
        `;
        document.head.appendChild(style);
    }

    function populateClientFilter(clients) {
        const select = document.getElementById("filterClient");
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">All clients</option>';
        clients.forEach(client => {
            const option = document.createElement("option");
            option.value = client.client_id || client.client_name;
            option.textContent = client.client_name;
            select.appendChild(option);
        });
        if ([...select.options].some(option => option.value === current)) select.value = current;
    }

    function analyticsFilterQuery() {
        const params = new URLSearchParams();
        const fields = {
            client: "filterClient",
            start_date: "filterStartDate",
            end_date: "filterEndDate",
            direction: "filterDirection",
            status: "filterStatus",
            billing_status: "filterBilling"
        };
        for (const [key, id] of Object.entries(fields)) {
            const value = document.getElementById(id)?.value?.trim();
            if (value) params.set(key, value);
        }
        return params.toString();
    }
    async function loadAnalytics() {
        const token = localStorage.getItem("vbonotif_admin_token");
        if (!token) {
            showMessage("Admin token not found. Please log in again.", true);
            return;
        }

        showMessage("Loading analytics...");
        const button = document.getElementById("refreshAdminAnalytics");
        if (button) button.disabled = true;

        try {
            const query = analyticsFilterQuery();
            const response = await fetch(API_URL + (query ? "?" + query : ""), {
                method: "GET",
                headers: { Authorization: "Bearer " + token }
            });

            if (response.status === 401 || response.status === 403) {
                throw new Error("Admin authentication failed. Please log in again.");
            }
            if (!response.ok) {
                throw new Error("Analytics API returned HTTP " + response.status);
            }

            const data = await response.json();
            if (!data.success || !data.summary) {
                throw new Error("Unexpected analytics API response.");
            }

            const summary = data.summary;
            const clients = Array.isArray(data.clients) ? data.clients : [];
            const statuses = Array.isArray(data.status_breakdown)
                ? data.status_breakdown : [];

            populateClientFilter(clients);
            renderSummary(summary);
            renderClientChart(clients);
            renderStatusChart(statuses);
            renderBillingChart(clients);
            renderTable(clients);

            document.getElementById("analyticsBillingNote").textContent =
                (data.billing_note || "") +
                (summary.billing_totals_complete
                    ? " All active clients have a compatible billing ledger."
                    : " Some client billing totals are incomplete; unverified values are intentionally not treated as zero.");

            showMessage("Analytics loaded successfully.");
        } catch (error) {
            showMessage(error.message || "Unable to load analytics.", true);
        } finally {
            if (button) button.disabled = false;
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        ensureAnalyticsFilters();
        document.getElementById("applyAnalyticsFilters")?.addEventListener("click", loadAnalytics);
        document.getElementById("clearAnalyticsFilters")?.addEventListener("click", () => {
            ["filterClient","filterStartDate","filterEndDate","filterDirection","filterStatus","filterBilling"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
            loadAnalytics();
        });
        document.getElementById("refreshAdminAnalytics")
            ?.addEventListener("click", loadAnalytics);
        loadAnalytics();
    });
})();