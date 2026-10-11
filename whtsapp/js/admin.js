document.addEventListener("DOMContentLoaded", function () {

    const API_BASE = "https://app.vbo.co.in/api/v1";
    const token = localStorage.getItem("vbonotif_admin_token");

    const refreshButton = document.getElementById("refreshRequests");
    const tableBody = document.getElementById("rechargeTableBody");
    const pendingCount = document.getElementById("pendingCount");
    const totalClients = document.getElementById("totalClients");
    const todayMessages = document.getElementById("todayMessages");

    if (!token) {
        window.location.href = "admin-login.html";
        return;
    }

    function updateTableHeader() {
        const table = tableBody ? tableBody.closest("table") : null;
        const headerRow = table ? table.querySelector("thead tr") : null;

        if (headerRow) {
            headerRow.innerHTML = `
                <th>Client</th>
                <th>Original Amount</th>
                <th>Approved Amount</th>
                <th>UTR / Reference</th>
                <th>Requested On</th>
                <th>Remark</th>
                <th>Status</th>
                <th>Action</th>
            `;
        }
    }

    async function loadTotalClients() {
        try {
            const response = await fetch(
                API_BASE + "/whatsapp/admin/clients",
                {
                    method: "GET",
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                }
            );

            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("vbonotif_admin_token");
                localStorage.removeItem("vbonotif_admin_user");
                window.location.href = "admin-login.html";
                return;
            }

            if (!response.ok || !data.success) {
                throw new Error(
                    data.detail || "Could not load clients"
                );
            }

            if (totalClients) {
                totalClients.textContent = data.count;
            }

        } catch (error) {
            console.error("Total clients error:", error);
        }
    }

    async function loadTodayMessages() {
        try {
            const response = await fetch(
                API_BASE + "/whatsapp/admin/stats/today-messages",
                {
                    method: "GET",
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                }
            );

            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("vbonotif_admin_token");
                localStorage.removeItem("vbonotif_admin_user");
                window.location.href = "admin-login.html";
                return;
            }

            if (!response.ok || !data.success) {
                throw new Error(
                    data.detail || "Could not load message stats"
                );
            }

            const today = data.today;
            const total = data.total;

            window.vbonotifTodayStats = today;
            window.vbonotifTotalStats = total;

            const todayMessages = document.getElementById("todayMessages");
            const todayBreakdown = document.getElementById("todayMessagesBreakdown");
            const totalMessages = document.getElementById("totalMessages");
            const totalBreakdown = document.getElementById("totalMessagesBreakdown");

            if (todayMessages) {
                todayMessages.textContent = today.total;
            }

            if (todayBreakdown) {
                todayBreakdown.innerHTML =
                    "Incoming: " + today.incoming +
                    "<br>Sent: " + today.sent +
                    "<br>Delivered: " + today.delivered +
                    "<br>Read: " + today.read +
                    "<br>Failed: " + today.failed +
                    "<br>Pending: " + today.pending;
            }

            if (totalMessages) {
                totalMessages.textContent = total.total;
            }

            if (totalBreakdown) {
                totalBreakdown.innerHTML =
                    "Incoming: " + total.incoming +
                    "<br>Sent: " + total.sent +
                    "<br>Delivered: " + total.delivered +
                    "<br>Read: " + total.read +
                    "<br>Failed: " + total.failed +
                    "<br>Pending: " + total.pending;
            }

        } catch (error) {
            console.error("Message stats error:", error);
        }
    }
    function openMessageStatsModal(type) {
        const modal = document.getElementById("messageStatsModal");
        if (!modal) return;

        const title = document.getElementById("messageModalTitle");
        const subtitle = document.getElementById("messageModalSubtitle");

        const today = window.vbonotifTodayStats;
        const total = window.vbonotifTotalStats;

        if (!today || !total) return;

        if (title) {
            title.textContent = "Message Analysis";
        }

        if (subtitle) {
            subtitle.textContent = "Today and all-time WhatsApp message statistics";
        }

        document.getElementById("todayModalIncoming").textContent = today.incoming;
        document.getElementById("todayModalSent").textContent = today.sent;
        document.getElementById("todayModalDelivered").textContent = today.delivered;
        document.getElementById("todayModalRead").textContent = today.read;
        document.getElementById("todayModalFailed").textContent = today.failed;
        document.getElementById("todayModalPending").textContent = today.pending;

        document.getElementById("totalModalIncoming").textContent = total.incoming;
        document.getElementById("totalModalSent").textContent = total.sent;
        document.getElementById("totalModalDelivered").textContent = total.delivered;
        document.getElementById("totalModalRead").textContent = total.read;
        document.getElementById("totalModalFailed").textContent = total.failed;
        document.getElementById("totalModalPending").textContent = total.pending;

        modal.classList.add("show");

        loadMessageTrend();
    }

    function closeMessageStatsModal() {
        const modal = document.getElementById("messageStatsModal");
        if (modal) {
            modal.classList.remove("show");
        }
    }

    function setupMessageStatsModal() {
        const todayCard = document.getElementById("todayMessagesCard");
        const totalCard = document.getElementById("totalMessagesCard");
        const closeButton = document.getElementById("messageStatsClose");
        const modal = document.getElementById("messageStatsModal");

        if (todayCard) {
            todayCard.addEventListener(
                "click",
                function () {
                    openMessageStatsModal("today");
                }
            );
        }

        if (totalCard) {
            totalCard.addEventListener(
                "click",
                function () {
                    openMessageStatsModal("total");
                }
            );
        }

        if (closeButton) {
            closeButton.addEventListener(
                "click",
                closeMessageStatsModal
            );
        }

        if (modal) {
            modal.addEventListener(
                "click",
                function (event) {
                    if (event.target === modal) {
                        closeMessageStatsModal();
                    }
                }
            );
        }
    }
    async function loadRechargeRequests() {

        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.textContent = "↻ Loading...";
        }

        try {

            const response = await fetch(
                API_BASE + "/whatsapp/admin/recharge-requests",
                {
                    method: "GET",
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                }
            );

            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("vbonotif_admin_token");
                localStorage.removeItem("vbonotif_admin_user");
                window.location.href = "admin-login.html";
                return;
            }

            if (!response.ok || !data.success) {
                throw new Error(
                    data.detail || "Could not load recharge requests"
                );
            }

            const requests = data.requests || [];

            const pending = requests.filter(function (item) {
                return item.status === "pending";
            }).length;

            if (pendingCount) {
                pendingCount.textContent = pending;
            }

            if (!tableBody) {
                return;
            }

            if (requests.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="empty-state">
                            No recharge requests yet.
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = requests.map(function (item) {

                const originalAmount = Number(
                    item.original_amount ?? item.amount ?? 0
                ).toFixed(2);

                const approvedAmount = Number(
                    item.amount ?? 0
                ).toFixed(2);

                const requestedOn = item.requested_at
                    ? new Date(
                        item.requested_at.replace(" ", "T") + "Z"
                    ).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true
                    })
                    : "—";

                const statusText = item.status
                    ? item.status.charAt(0).toUpperCase()
                      + item.status.slice(1)
                    : "—";

                let approvedAmountHtml = "₹" + approvedAmount;
                let remarkHtml = escapeHtml(item.remark || "—");
                let actionHtml = "—";

                if (item.status === "pending") {

                    approvedAmountHtml = `
                        <input
                            type="number"
                            class="approved-amount-input"
                            data-request-id="${item.id}"
                            value="${originalAmount}"
                            min="0.01"
                            max="${originalAmount}"
                            step="0.01"
                            style="width:110px;"
                        >
                    `;

                    remarkHtml = `
                        <input
                            type="text"
                            class="remark-input"
                            data-request-id="${item.id}"
                            placeholder="Optional"
                            maxlength="500"
                            style="width:130px;"
                        >
                    `;

                    actionHtml = `
                        <div class="recharge-actions">
                            <button
                                class="approve-button"
                                data-request-id="${item.id}"
                            >
                                Approve
                            </button>

                            <button
                                class="reject-button"
                                data-request-id="${item.id}"
                            >
                                Reject
                            </button>
                        </div>
                    `;

                } else if (item.status === "approved") {
                    actionHtml = "Approved";
                } else if (item.status === "rejected") {
                    actionHtml = "Rejected";
                }

                return `
                    <tr>
                        <td>${escapeHtml(item.client_name || "—")}</td>
                        <td>₹${originalAmount}</td>
                        <td>${approvedAmountHtml}</td>
                        <td>${escapeHtml(item.payment_reference || "—")}</td>
                        <td>${escapeHtml(requestedOn)}</td>
                        <td>${remarkHtml}</td>
                        <td>${escapeHtml(statusText)}</td>
                        <td>${actionHtml}</td>
                    </tr>
                `;

            }).join("");

            attachActionHandlers();

        } catch (error) {

            console.error("Recharge requests error:", error);

            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="empty-state">
                            Could not load recharge requests.
                        </td>
                    </tr>
                `;
            }

        } finally {

            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.textContent = "↻ Refresh";
            }
        }
    }

    function attachActionHandlers() {

        document.querySelectorAll(".approve-button").forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        const requestId = Number(
                            button.dataset.requestId
                        );

                        const amountInput = document.querySelector(
                            '.approved-amount-input[data-request-id="' +
                            requestId +
                            '"]'
                        );

                        const remarkInput = document.querySelector(
                            '.remark-input[data-request-id="' +
                            requestId +
                            '"]'
                        );

                        const approvedAmount = Number(
                            amountInput ? amountInput.value : 0
                        );

                        const remark = remarkInput
                            ? remarkInput.value.trim()
                            : "";

                        approveRequest(
                            requestId,
                            approvedAmount,
                            remark
                        );
                    }
                );
            }
        );

        document.querySelectorAll(".reject-button").forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        const requestId = Number(
                            button.dataset.requestId
                        );

                        rejectRequest(requestId);
                    }
                );
            }
        );
    }

    async function approveRequest(
        requestId,
        approvedAmount,
        remark
    ) {

        if (!approvedAmount || approvedAmount <= 0) {
            alert("Please enter a valid approved amount.");
            return;
        }

        const confirmed = confirm(
            "Approve this recharge request?\n\n" +
            "Approved amount: ₹" +
            approvedAmount.toFixed(2) +
            "\n\n" +
            "This amount will be added to the client's wallet."
        );

        if (!confirmed) {
            return;
        }

        try {

            const response = await fetch(
                API_BASE +
                "/whatsapp/admin/recharge-requests/approve",
                {
                    method: "POST",
                    headers: {
                        "Authorization": "Bearer " + token,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        request_id: requestId,
                        approved_amount: approvedAmount,
                        remark: remark
                    })
                }
            );

            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("vbonotif_admin_token");
                localStorage.removeItem("vbonotif_admin_user");
                window.location.href = "admin-login.html";
                return;
            }

            if (!response.ok || !data.success) {
                throw new Error(
                    data.detail || "Recharge approval failed"
                );
            }

            alert(
                "Recharge approved successfully.\n\n" +
                "Original amount: ₹" +
                Number(data.original_amount).toFixed(2) +
                "\nApproved amount: ₹" +
                Number(data.approved_amount).toFixed(2) +
                "\nNew balance: ₹" +
                Number(data.new_balance).toFixed(2)
            );

            loadTotalClients();
    loadTodayMessages();
    loadTotalClients();
    loadTodayMessages();

    loadRechargeRequests();

        } catch (error) {
            alert(error.message);
        }
    }

    async function rejectRequest(requestId) {

        const confirmed = confirm(
            "Reject this recharge request?\n\n" +
            "No amount will be added to the client's wallet."
        );

        if (!confirmed) {
            return;
        }

        try {

            const response = await fetch(
                API_BASE +
                "/whatsapp/admin/recharge-requests/reject",
                {
                    method: "POST",
                    headers: {
                        "Authorization": "Bearer " + token,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        request_id: requestId
                    })
                }
            );

            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("vbonotif_admin_token");
                localStorage.removeItem("vbonotif_admin_user");
                window.location.href = "admin-login.html";
                return;
            }

            if (!response.ok || !data.success) {
                throw new Error(
                    data.detail || "Recharge rejection failed"
                );
            }

            alert("Recharge request rejected.");

            loadTotalClients();
    loadTodayMessages();

    loadRechargeRequests();

        } catch (error) {
            alert(error.message);
        }
    }


function setupGlobalEntrySearch() {
    const searchInput = document.getElementById("globalEntrySearch");
    const tableBody = document.getElementById("rechargeTableBody");

    if (!searchInput || !tableBody) return;

    searchInput.addEventListener("input", function () {
        const query = searchInput.value.trim().toLowerCase();

        tableBody.querySelectorAll("tr").forEach(function (row) {
            const text = row.textContent.toLowerCase();
            row.style.display =
                !query || text.includes(query) ? "" : "none";
        });
    });
}
    function escapeHtml(value) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    setupMessageStatsModal();

    document.addEventListener("click", function (event) {
        const messageCard = event.target.closest("#messageStatsCard");

        if (messageCard) {
            openMessageStatsModal("today");
        }
    });
    loadMessageTrend();

    updateTableHeader();

    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            loadRechargeRequests
        );
    }

    loadTotalClients();
    loadTodayMessages();

    loadRechargeRequests();

});








let vbonotifTrendControlsReady = false;

function setupMessageTrendControls() {
    if (vbonotifTrendControlsReady) return;

    const period = document.getElementById("messageTrendPeriod");
    const chartType = document.getElementById("messageTrendChartType");
    const customDates = document.getElementById("messageTrendCustomDates");
    const fromInput = document.getElementById("messageTrendFrom");
    const toInput = document.getElementById("messageTrendTo");
    const applyButton = document.getElementById("messageTrendApply");

    if (!period || !chartType || !customDates || !fromInput || !toInput || !applyButton) {
        return;
    }

    const today = new Date();
    const isoToday = today.toISOString().slice(0, 10);
    const defaultFrom = new Date(today);
    defaultFrom.setDate(defaultFrom.getDate() - 6);

    fromInput.value = defaultFrom.toISOString().slice(0, 10);
    toInput.value = isoToday;

    period.addEventListener("change", function () {
        const isCustom = period.value === "custom";
        customDates.style.display = isCustom ? "flex" : "none";
        if (!isCustom) loadMessageTrend();
    });

    chartType.addEventListener("change", function () {
        loadMessageTrend();
    });

    applyButton.addEventListener("click", function () {
        if (!fromInput.value || !toInput.value) {
            alert("Please select both From and To dates.");
            return;
        }
        if (fromInput.value > toInput.value) {
            alert("From date cannot be after To date.");
            return;
        }
        loadMessageTrend();
    });

    vbonotifTrendControlsReady = true;
}

async function loadMessageTrend() {
    const API_BASE = "https://app.vbo.co.in/api/v1";
    const adminToken = localStorage.getItem("vbonotif_admin_token");
    const canvas = document.getElementById("messageTrendChart");
    if (!canvas || typeof Chart === "undefined") return;

    setupMessageTrendControls();

    const periodEl = document.getElementById("messageTrendPeriod");
    const chartTypeEl = document.getElementById("messageTrendChartType");
    const customDates = document.getElementById("messageTrendCustomDates");
    const fromEl = document.getElementById("messageTrendFrom");
    const toEl = document.getElementById("messageTrendTo");
    const titleEl = document.getElementById("messageTrendTitle");
    const rangeEl = document.getElementById("messageTrendRange");

    const period = periodEl ? periodEl.value : "7";
    const chartType = chartTypeEl ? chartTypeEl.value : "line";

    let url = API_BASE + "/whatsapp/admin/stats/message-trend";
    let title = "Message Trend — Last 7 Days";

    if (period === "custom") {
        if (!fromEl || !toEl || !fromEl.value || !toEl.value) return;
        if (fromEl.value > toEl.value) return;

        url += "?start_date=" + encodeURIComponent(fromEl.value) +
            "&end_date=" + encodeURIComponent(toEl.value);
        title = "Message Trend — Custom Range";
        if (customDates) customDates.style.display = "flex";
    } else {
        url += "?days=" + encodeURIComponent(period);
        const labels = {
            "7": "Last 7 Days",
            "30": "Last 30 Days",
            "90": "Last 90 Days",
            "180": "Last 180 Days",
            "365": "Last 1 Year"
        };
        title = "Message Trend — " + (labels[period] || "Selected Period");
        if (customDates) customDates.style.display = "none";
    }

    try {
        const response = await fetch(url, {
            headers: { "Authorization": "Bearer " + adminToken }
        });
        if (!response.ok) throw new Error("Message trend request failed");

        const data = await response.json();
        const trend = data.trend || [];

        if (titleEl) titleEl.textContent = title;
        if (rangeEl && data.start_date && data.end_date) {
            rangeEl.textContent = data.start_date + " to " + data.end_date;
        }

        const labels = trend.map(item => {
            const parts = item.date.split("-");
            return parts[2] + "/" + parts[1];
        });

        const series = [
            { key: "incoming", label: "Incoming", color: "#1E3A8A" },
            { key: "sent", label: "Sent", color: "#166534" },
            { key: "delivered", label: "Delivered", color: "#E400FF" },
            { key: "read", label: "Read", color: "#1BBEF7" },
            { key: "failed", label: "Failed", color: "#B91C1C" },
            { key: "pending", label: "Pending", color: "#C2410C" }
        ];

        if (window.vbonotifMessageChart) window.vbonotifMessageChart.destroy();

        if (chartType === "pie") {
            const totals = series.map(item =>
                trend.reduce((sum, row) => sum + Number(row[item.key] || 0), 0)
            );

            window.vbonotifMessageChart = new Chart(canvas, {
                type: "pie",
                data: {
                    labels: series.map(item => item.label),
                    datasets: [{ data: totals, backgroundColor: series.map(item => item.color), borderColor: "#ffffff", borderWidth: 2 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
            return;
        }

        const datasets = series.map(item => ({
            label: item.label,
            data: trend.map(row => Number(row[item.key] || 0)),
            borderColor: item.color,
            backgroundColor: item.color,
            tension: 0.3,
            fill: false
        }));

        window.vbonotifMessageChart = new Chart(canvas, {
            type: chartType,
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        });
    } catch (error) {
        console.error("Message trend error:", error);
    }
}




/* Global Search - Direct Event Listener */
document.addEventListener("input", function (event) {

    if (event.target.id !== "globalEntrySearch") {
        return;
    }

    const query = event.target.value.trim().toLowerCase();
    const tableBody = document.getElementById("rechargeTableBody");

    if (!tableBody) {
        return;
    }

    tableBody.querySelectorAll("tr").forEach(function (row) {

        const rowText = row.textContent.toLowerCase();

        row.style.display =
            query === "" || rowText.includes(query)
                ? ""
                : "none";
    });
});


/* ========================================================
   ADMIN CLIENT MANAGEMENT
   ======================================================== */

(function () {
    const API_BASE_CLIENTS = "https://app.vbo.co.in/api/v1";
    const adminToken = localStorage.getItem("vbonotif_admin_token");

    function escapeClientHtml(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

    function clientHeaders() {
        return {
            "Authorization": "Bearer " + adminToken,
            "Content-Type": "application/json"
        };
    }

    async function loadAdminClients() {
        const tableBody = document.getElementById("clientsTableBody");
        if (!tableBody) return;

        try {
            const response = await fetch(
                API_BASE_CLIENTS + "/whatsapp/admin/clients",
                {
                    method: "GET",
                    headers: {
                        "Authorization": "Bearer " + adminToken
                    }
                }
            );

            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("vbonotif_admin_token");
                localStorage.removeItem("vbonotif_admin_user");
                window.location.href = "admin-login.html";
                return;
            }

            if (!response.ok || !data.success) {
                throw new Error(data.detail || ("Could not load clients (HTTP " + response.status + ")"));
            }

            const clients = data.clients || [];

            const table = tableBody.closest("table");
            const headerRow = table ? table.querySelector("thead tr") : null;
            if (headerRow) {
                headerRow.innerHTML = "<th>Client</th><th>Status</th><th>Meta Status</th><th>Action</th>";
            }

            if (!clients.length) {
                tableBody.innerHTML =
                    '<tr><td colspan="4" class="empty-state">No clients found.</td></tr>';
                return;
            }

            tableBody.innerHTML = clients.map(function (client) {
                return `
                    <tr>
                        <td>${escapeClientHtml(client.client_name || "—")}</td>
                                                <td>${escapeClientHtml(client.status || "—")}</td>
                        <td>
                            ${
                                client.meta_status === "active"
                                    ? '<span style="display:inline-block;padding:4px 10px;border-radius:12px;background:#dcfce7;color:#166534;font-size:12px;font-weight:600;">Active</span>'
                                    : client.meta_status === "inactive"
                                        ? '<span style="display:inline-block;padding:4px 10px;border-radius:12px;background:#fee2e2;color:#991b1b;font-size:12px;font-weight:600;">Inactive</span>'
                                        : '<span style="display:inline-block;padding:4px 10px;border-radius:12px;background:#f3f4f6;color:#6b7280;font-size:12px;font-weight:600;">Not Linked</span>'
                            }
                        </td>
                        <td><button type="button" class="refresh-button link-meta-button" data-client-name="${escapeClientHtml(client.client_name || "")}">🔗 Link Meta</button> <button type="button" class="refresh-button edit-client-button" data-client-name="${escapeClientHtml(client.client_name || "")}">Edit</button> <button type="button" class="refresh-button delete-client-button" data-client-name="${escapeClientHtml(client.client_name || "")}">Delete</button></td>
                    </tr>
                `;
            }).join("");

        } catch (error) {
            console.error("Client list error:", error);
            tableBody.innerHTML =
                '<tr><td colspan="3" class="empty-state">Could not load clients.</td></tr>';
        }
    }

    function openNewClientModal() {
        const modal = document.getElementById("newClientModal");
        if (modal) modal.style.display = "flex";
    }

    function closeNewClientModal() {
        const modal = document.getElementById("newClientModal");
        if (modal) modal.style.display = "none";
    }

    async function createAdminClient(event) {
        event.preventDefault();

        const form = document.getElementById("newClientForm");
        const submitButton = document.getElementById("createClientSubmit");

        if (!form) return;

        const formData = new FormData(form);

        const payload = {
            client_name: formData.get("client_name").trim(),
            username: formData.get("username").trim(),
            password: formData.get("password"),
            phone_number: formData.get("phone_number").trim(),
            display_name: formData.get("display_name").trim(),
            initial_balance: Number(formData.get("initial_balance") || 0),
            validity_days: Number(formData.get("validity_days") || 30),
            text_message: Number(formData.get("text_message") || 0),
            template_message: Number(formData.get("template_message") || 0),
            minimum_recharge: Number(formData.get("minimum_recharge") || 0),
            upi_id: formData.get("upi_id").trim(),
            bot_enabled: formData.get("bot_enabled") === "on",
            status: formData.get("status")
        };

        if (!payload.client_name || !payload.username || !payload.password) {
            alert("Client name, username and password are required.");
            return;
        }

        const confirmed = confirm(
            "Create this client?\n\n" +
            "Client: " + payload.client_name +
            "\nUsername: " + payload.username
        );

        if (!confirmed) return;

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Creating...";
        }

        try {
            const response = await fetch(
                API_BASE_CLIENTS + "/whatsapp/admin/clients",
                {
                    method: "POST",
                    headers: clientHeaders(),
                    body: JSON.stringify(payload)
                }
            );

            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("vbonotif_admin_token");
                localStorage.removeItem("vbonotif_admin_user");
                window.location.href = "admin-login.html";
                return;
            }

            if (!response.ok || !data.success) {
                throw new Error(data.detail || "Client creation failed");
            }

            alert(
                "Client created successfully.\n\n" +
                "Client: " + data.client_name
            );

            form.reset();
            closeNewClientModal();
            loadAdminClients();} catch (error) {
            alert(error.message);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Create Client";
            }
        }
    }

    function setupClientManagement() {
        const newButton = document.getElementById("newClientButton");
        const closeButton = document.getElementById("closeNewClientModal");
        const cancelButton = document.getElementById("cancelNewClient");
        const form = document.getElementById("newClientForm");
        const modal = document.getElementById("newClientModal");

        if (newButton) {
            newButton.addEventListener("click", openNewClientModal);
        }

        if (closeButton) {
            closeButton.addEventListener("click", closeNewClientModal);
        }

        if (cancelButton) {
            cancelButton.addEventListener("click", closeNewClientModal);
        }

        if (modal) {
            modal.addEventListener("click", function (event) {
                if (event.target === modal) {
                    closeNewClientModal();
                }
            });
        }

        if (form) {
            form.addEventListener("submit", createAdminClient);
        }

        loadAdminClients();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            setupClientManagement
        );
    } else {
        setupClientManagement();
    }
})();




/* ========================================================
   ADMIN CLIENT EDIT
   ======================================================== */

(function () {
    const editApiBase = "https://app.vbo.co.in/api/v1";

    async function editClient(clientName) {
        const token = localStorage.getItem("vbonotif_admin_token");

        try {
            const response = await fetch(
                editApiBase + "/whatsapp/admin/clients/" +
                encodeURIComponent(clientName),
                {
                    method: "GET",
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.detail || "Could not load client");
            }

            const client = data.client || {};
            const login = client.login || {};
            const whatsapp = client.whatsapp || {};
            const wallet = client.wallet || {};
            const pricing = client.pricing || {};
            const recharge = client.recharge || {};
            const bot = client.bot || {};

            document.getElementById("editClientName").value = client.client_name || clientName;
            document.getElementById("editClientSubtitle").textContent = "Editing: " + (client.client_name || clientName);
            document.getElementById("editUsername").value = login.username || "";
            document.getElementById("editPassword").value = login.password || "";
            document.getElementById("editPhoneNumber").value = whatsapp.phone_number || "";
            document.getElementById("editDisplayName").value = whatsapp.display_name || "";
            document.getElementById("editBalance").value = Number(wallet.balance || 0);
            document.getElementById("editValidityDays").value = Number(recharge.validity_days || 30);
            document.getElementById("editTextMessage").value = Number(pricing.text_message || 0);
            document.getElementById("editTemplateMessage").value = Number(pricing.template_message || 0);
            document.getElementById("editMinimumRecharge").value = Number(recharge.minimum_amount || 0);
            document.getElementById("editUpiId").value = recharge.upi_id || "";
            document.getElementById("editStatus").value = client.status || "active";
            document.getElementById("editBotEnabled").checked = bot.enabled === true;
            const apiSettings = client.api_settings || {};
            const apiEnabled = document.getElementById("editApiEnabled");
            const apiLimit = document.getElementById("editApiRecipientLimit");
            const apiKeyState = document.getElementById("editApiKeyState");
            if (apiEnabled) apiEnabled.checked = apiSettings.enabled === true;
            if (apiLimit) apiLimit.value = Number(apiSettings.recipient_limit || 20);
            if (apiKeyState) apiKeyState.textContent = apiSettings.key_configured ? "Key configured (hidden)" : "No API key generated";
            const apiKeyReveal = document.getElementById("generatedApiKeyNotice");
            if (apiKeyReveal) { apiKeyReveal.style.display = "none"; apiKeyReveal.textContent = ""; }

            document.getElementById("editClientModal").style.display = "flex";

        } catch (error) {
            alert(error.message);
        }
    }

    async function saveClientChanges(event) {
        event.preventDefault();

        const token = localStorage.getItem("vbonotif_admin_token");
        const clientName = document.getElementById("editClientName").value;

        const payload = {
            username: document.getElementById("editUsername").value.trim(),
            phone_number: document.getElementById("editPhoneNumber").value.trim(),
            display_name: document.getElementById("editDisplayName").value.trim(),
            balance: Number(document.getElementById("editBalance").value || 0),
            validity_days: Number(document.getElementById("editValidityDays").value || 30),
            text_message: Number(document.getElementById("editTextMessage").value || 0),
            template_message: Number(document.getElementById("editTemplateMessage").value || 0),
            minimum_recharge: Number(document.getElementById("editMinimumRecharge").value || 0),
            upi_id: document.getElementById("editUpiId").value.trim(),
            bot_enabled: document.getElementById("editBotEnabled").checked,
            status: document.getElementById("editStatus").value
        };

        const password = document.getElementById("editPassword").value;
        if (password.trim()) {
            payload.password = password;
        }

        if (!confirm("Save changes for " + clientName + "?")) return;

        const button = document.getElementById("saveClientChanges");
        if (button) {
            button.disabled = true;
            button.textContent = "Saving...";
        }

        try {
            const response = await fetch(
                editApiBase + "/whatsapp/admin/clients/" +
                encodeURIComponent(clientName),
                {
                    method: "PUT",
                    headers: {
                        "Authorization": "Bearer " + token,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.detail || "Client update failed");
            }

            const apiSettingsResponse = await fetch(
                editApiBase + "/whatsapp/admin/clients/" + encodeURIComponent(clientName) + "/api-settings",
                { method: "PUT", headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    enabled: document.getElementById("editApiEnabled").checked,
                    recipient_limit: Number(document.getElementById("editApiRecipientLimit").value || 20)
                  }) }
            );
            const apiSettingsData = await apiSettingsResponse.json();
            if (!apiSettingsResponse.ok || !apiSettingsData.success) {
                throw new Error(apiSettingsData.detail || "API settings could not be saved. Other client changes may already be saved.");
            }
            alert("Client and API settings saved successfully.");
            document.getElementById("editClientModal").style.display = "none";

            if (typeof loadAdminClients === "function") {
                loadAdminClients();
            }

        } catch (error) {
            alert(error.message);

        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Save Changes";
            }
        }
    }

    function setupClientEdit() {
        const modal = document.getElementById("editClientModal");
        const closeButton = document.getElementById("closeEditClientModal");
        const cancelButton = document.getElementById("cancelEditClient");
        const form = document.getElementById("editClientForm");

        if (closeButton) {
            closeButton.addEventListener("click", function () {
                modal.style.display = "none";
            });
        }

        if (cancelButton) {
            cancelButton.addEventListener("click", function () {
                modal.style.display = "none";
            });
        }

        if (modal) {
            modal.addEventListener("click", function (event) {
                if (event.target === modal) {
                    modal.style.display = "none";
                }
            });
        }

        if (form) {
            form.addEventListener("submit", saveClientChanges);
        }
        const regenerateApiKeyButton = document.getElementById("regenerateApiKeyButton");
        if (regenerateApiKeyButton) {
            regenerateApiKeyButton.addEventListener("click", async function () {
                const clientName = document.getElementById("editClientName").value;
                const token = localStorage.getItem("vbonotif_admin_token");
                if (!clientName || !confirm("Regenerate API key for " + clientName + "? The old key will stop working immediately.")) return;
                regenerateApiKeyButton.disabled = true;
                try {
                    const response = await fetch(editApiBase + "/whatsapp/admin/clients/" + encodeURIComponent(clientName) + "/api-key/regenerate", {
                        method: "POST", headers: { "Authorization": "Bearer " + token }
                    });
                    const data = await response.json();
                    if (!response.ok || !data.success) throw new Error(data.detail || "API key regeneration failed");
                    const notice = document.getElementById("generatedApiKeyNotice");
                    notice.textContent = "NEW API KEY — copy it now; it will not be shown again: " + data.api_key;
                    notice.style.display = "block";
                    document.getElementById("editApiKeyState").textContent = "Key generated; shown once above";
                } catch (error) { alert(error.message); }
                finally { regenerateApiKeyButton.disabled = false; }
            });
        }

        document.addEventListener("click", function (event) {
            const button = event.target.closest(".edit-client-button");
            if (!button) return;

            const clientName = button.dataset.clientName;
            if (clientName) {
                editClient(clientName);
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupClientEdit);
    } else {
        setupClientEdit();
    }
})();


/* ========================================================
   ADMIN CLIENT DELETE
   ======================================================== */

async function deleteClient(clientName) {
    const token = localStorage.getItem("vbonotif_admin_token");

    if (!confirm(
        "PERMANENTLY delete " + clientName +
        "?\n\nThis will delete the client folder, configuration and WhatsApp database.\n\nThis cannot be undone."
    )) {
        return;
    }

    try {
        const response = await fetch(
            "https://app.vbo.co.in/api/v1/whatsapp/admin/clients/" +
            encodeURIComponent(clientName),
            {
                method: "DELETE",
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.detail || "Client deletion failed");
        }

        alert("Client deleted permanently.");

        if (typeof loadAdminClients === "function") {
            loadAdminClients();
        }

        if (typeof loadTotalClients === "function") {
            loadTotalClients();
        }

    } catch (error) {
        alert(error.message);
    }
}

document.addEventListener("click", function (event) {
    const button = event.target.closest(".delete-client-button");
    if (!button) return;

    const clientName = button.dataset.clientName;
    if (clientName) {
        deleteClient(clientName);
    }
});






/* ========================================================
   ADMIN META LINK
   ======================================================== */

(function () {
    const metaApiBase = "https://app.vbo.co.in/api/v1";

    function getMetaToken() {
        return localStorage.getItem("vbonotif_admin_token");
    }

    function closeMetaModal() {
        const modal = document.getElementById("linkMetaModal");
        if (modal) modal.style.display = "none";
    }

    function closeMetaGuide() {
        const modal = document.getElementById("metaGuideModal");
        if (modal) modal.style.display = "none";
    }

    async function openLinkMetaModal(clientName) {
        const modal = document.getElementById("linkMetaModal");
        if (!modal) return;

        document.getElementById("linkMetaClientName").textContent = clientName;
        document.getElementById("linkMetaSubtitle").textContent = "Loading Meta connection...";
        document.getElementById("metaPhoneNumberId").value = "";
        document.getElementById("metaWabaId").value = "";
        document.getElementById("metaBusinessId").value = "";
        document.getElementById("metaAccessToken").value = "";
        document.getElementById("metaTokenExpiresAt").value = "";
        document.getElementById("metaStatus").value = "active";

        modal.dataset.clientName = clientName;
        modal.style.display = "flex";

        try {
            const response = await fetch(
                metaApiBase + "/whatsapp/admin/clients/" +
                encodeURIComponent(clientName) + "/meta",
                {
                    method: "GET",
                    headers: {
                        "Authorization": "Bearer " + getMetaToken()
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.detail || "Could not load Meta connection");
            }

            const client = data.client || {};
            const whatsapp = client.whatsapp || {};
            const meta = client.meta || {};

            document.getElementById("linkMetaClientName").textContent =
                client.client_name || clientName;

            document.getElementById("linkMetaPhone").textContent =
                whatsapp.phone_number || "Not set";

            document.getElementById("linkMetaDisplayName").textContent =
                whatsapp.display_name || "Not set";

            document.getElementById("metaPhoneNumberId").value =
                meta.phone_number_id || "";

            document.getElementById("metaWabaId").value =
                meta.waba_id || "";

            document.getElementById("metaBusinessId").value =
                meta.business_id || "";

            document.getElementById("metaTokenExpiresAt").value =
                meta.token_expires_at
                    ? String(meta.token_expires_at).replace(" ", "T").slice(0, 16)
                    : "";

            document.getElementById("metaStatus").value =
                meta.status || "active";

            document.getElementById("metaAccessToken").placeholder =
                meta.has_access_token
                    ? "Existing token saved — leave blank to keep it"
                    : "Enter Meta access token";

            document.getElementById("linkMetaSubtitle").textContent =
                "Connect WhatsApp Cloud API";

        } catch (error) {
            closeMetaModal();
            alert(error.message);
        }
    }

    async function saveMetaConnection(event) {
        event.preventDefault();

        const modal = document.getElementById("linkMetaModal");
        const clientName = modal ? modal.dataset.clientName : "";

        if (!clientName) {
            alert("Client not selected.");
            return;
        }

        const token = getMetaToken();

        const payload = {
            phone_number_id: document.getElementById("metaPhoneNumberId").value.trim(),
            waba_id: document.getElementById("metaWabaId").value.trim(),
            business_id: document.getElementById("metaBusinessId").value.trim(),
            access_token: document.getElementById("metaAccessToken").value,
            token_expires_at: document.getElementById("metaTokenExpiresAt").value,
            status: document.getElementById("metaStatus").value
        };

        if (!payload.phone_number_id || !payload.waba_id || !payload.business_id) {
            alert("Phone Number ID, WABA ID and Business ID are required.");
            return;
        }

        const button = document.getElementById("saveMetaConnection");
        if (button) {
            button.disabled = true;
            button.textContent = "Saving...";
        }

        try {
            const response = await fetch(
                metaApiBase + "/whatsapp/admin/clients/" +
                encodeURIComponent(clientName) + "/meta",
                {
                    method: "PUT",
                    headers: {
                        "Authorization": "Bearer " + token,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                }
            );

            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("vbonotif_admin_token");
                localStorage.removeItem("vbonotif_admin_user");
                window.location.href = "admin-login.html";
                return;
            }

            if (!response.ok || !data.success) {
                throw new Error(data.detail || "Meta connection save failed");
            }

            alert("Meta connection saved successfully.");
            closeMetaModal();

        } catch (error) {
            alert(error.message);
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Save Meta Connection";
            }
        }
    }

    function setupMetaLinking() {
        const linkModal = document.getElementById("linkMetaModal");
        const guideModal = document.getElementById("metaGuideModal");

        const closeLink = document.getElementById("closeLinkMetaModal");
        const cancelLink = document.getElementById("cancelLinkMeta");
        const metaForm = document.getElementById("linkMetaForm");

        const guideButton = document.getElementById("metaGuideButton");
        const closeGuide = document.getElementById("closeMetaGuideModal");
        const closeGuideBottom = document.getElementById("closeMetaGuideBottom");

        document.addEventListener("click", function (event) {
            const button = event.target.closest(".link-meta-button");
            if (!button) return;

            const clientName = button.dataset.clientName;
            if (clientName) {
                openLinkMetaModal(clientName);
            }
        });

        if (closeLink) closeLink.addEventListener("click", closeMetaModal);
        if (cancelLink) cancelLink.addEventListener("click", closeMetaModal);

        if (linkModal) {
            // Link Meta modal closes only through X or Cancel.
        }

        if (metaForm) {
            metaForm.addEventListener("submit", saveMetaConnection);
        }

        if (guideButton) {
            guideButton.addEventListener("click", function () {
                if (guideModal) guideModal.style.display = "flex";
            });
        }

        if (closeGuide) closeGuide.addEventListener("click", closeMetaGuide);
        if (closeGuideBottom) closeGuideBottom.addEventListener("click", closeMetaGuide);

        if (guideModal) {
            guideModal.addEventListener("click", function (event) {
                if (event.target === guideModal) closeMetaGuide();
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupMetaLinking);
    } else {
        setupMetaLinking();
    }
})();


/* ========================================================
   ADMIN SCHEDULER / MPS SETTINGS
   ======================================================== */
(function () {
    const settingsApiBase = "https://app.vbo.co.in/api/v1";
    const settingsToken = localStorage.getItem("vbonotif_admin_token");

    function setupSchedulerSettingsStyles() {
        if (document.getElementById("vbonotifSchedulerSettingsStyles")) return;
        const style = document.createElement("style");
        style.id = "vbonotifSchedulerSettingsStyles";
        style.textContent = `
            .vbonotif-settings-modal{position:fixed;inset:0;background:rgba(15,23,42,.48);display:none;align-items:center;justify-content:center;z-index:99999;padding:20px}
            .vbonotif-settings-card{width:min(520px,100%);background:#fff;border-radius:14px;box-shadow:0 24px 70px rgba(15,23,42,.22);overflow:hidden}
            .vbonotif-settings-head{padding:20px 22px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;gap:12px}
            .vbonotif-settings-head h2{margin:0;font-size:20px}.vbonotif-settings-head p{margin:5px 0 0;color:#64748b;font-size:13px}
            .vbonotif-settings-close{border:0;background:transparent;font-size:26px;cursor:pointer;color:#64748b}
            .vbonotif-settings-body{padding:22px}.vbonotif-settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
            .vbonotif-settings-field label{display:block;font-size:13px;font-weight:600;margin-bottom:7px;color:#334155}
            .vbonotif-settings-field input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px}
            .vbonotif-settings-note{margin-top:16px;padding:12px 14px;background:#f8fafc;border-radius:8px;color:#64748b;font-size:13px;line-height:1.5}
            .vbonotif-settings-footer{padding:16px 22px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:10px}
            .vbonotif-settings-button{border:0;border-radius:8px;padding:10px 16px;cursor:pointer;font-weight:600}
            .vbonotif-settings-cancel{background:#e2e8f0;color:#334155}.vbonotif-settings-save{background:#111827;color:#fff}
            @media(max-width:560px){.vbonotif-settings-grid{grid-template-columns:1fr}}
        `;
        document.head.appendChild(style);
    }

    function createSchedulerSettingsModal() {
        if (document.getElementById("vbonotifSchedulerSettingsModal")) return;
        const modal = document.createElement("div");
        modal.id = "vbonotifSchedulerSettingsModal";
        modal.className = "vbonotif-settings-modal";
        modal.innerHTML = `
            <div class="vbonotif-settings-card">
                <div class="vbonotif-settings-head">
                    <div><h2>Scheduler Settings</h2><p>Central sending-rate control for all clients</p></div>
                    <button type="button" class="vbonotif-settings-close" id="vbonotifSettingsClose">×</button>
                </div>
                <div class="vbonotif-settings-body">
                    <div class="vbonotif-settings-grid">
                        <div class="vbonotif-settings-field">
                            <label for="vbonotifMinMps">Minimum MPS</label>
                            <input id="vbonotifMinMps" type="number" min="0.1" step="0.1" value="5">
                        </div>
                        <div class="vbonotif-settings-field">
                            <label for="vbonotifMaxMps">Maximum MPS</label>
                            <input id="vbonotifMaxMps" type="number" min="0.1" step="0.1" value="20">
                        </div>
                    </div>
                    <div class="vbonotif-settings-note">
                        MPS = messages per second. This is one central limit for the complete VBONotif server. There is no client-wise MPS setting.
                    </div>
                </div>
                <div class="vbonotif-settings-footer">
                    <button type="button" class="vbonotif-settings-button vbonotif-settings-cancel" id="vbonotifSettingsCancel">Cancel</button>
                    <button type="button" class="vbonotif-settings-button vbonotif-settings-save" id="vbonotifSettingsSave">Save Settings</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        document.getElementById("vbonotifSettingsClose").addEventListener("click", closeSchedulerSettings);
        document.getElementById("vbonotifSettingsCancel").addEventListener("click", closeSchedulerSettings);
        document.getElementById("vbonotifSettingsSave").addEventListener("click", saveSchedulerSettings);
        modal.addEventListener("click", function (event) {
            if (event.target === modal) closeSchedulerSettings();
        });
    }

    async function openSchedulerSettings() {
        setupSchedulerSettingsStyles();
        createSchedulerSettingsModal();
        const modal = document.getElementById("vbonotifSchedulerSettingsModal");
        modal.style.display = "flex";

        try {
            const response = await fetch(
                settingsApiBase + "/whatsapp/admin/settings/scheduler",
                { headers: { "Authorization": "Bearer " + settingsToken } }
            );
            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("vbonotif_admin_token");
                localStorage.removeItem("vbonotif_admin_user");
                window.location.href = "admin-login.html";
                return;
            }
            if (!response.ok || !data.success) {
                throw new Error(data.detail || "Could not load scheduler settings");
            }

            document.getElementById("vbonotifMinMps").value = Number(data.min_mps);
            document.getElementById("vbonotifMaxMps").value = Number(data.max_mps);
        } catch (error) {
            closeSchedulerSettings();
            alert(error.message);
        }
    }

    function closeSchedulerSettings() {
        const modal = document.getElementById("vbonotifSchedulerSettingsModal");
        if (modal) modal.style.display = "none";
    }

    async function saveSchedulerSettings() {
        const minMps = Number(document.getElementById("vbonotifMinMps").value);
        const maxMps = Number(document.getElementById("vbonotifMaxMps").value);
        const button = document.getElementById("vbonotifSettingsSave");

        if (!Number.isFinite(minMps) || minMps <= 0) {
            alert("Minimum MPS must be greater than zero."); return;
        }
        if (!Number.isFinite(maxMps) || maxMps <= 0) {
            alert("Maximum MPS must be greater than zero."); return;
        }
        if (maxMps < minMps) {
            alert("Maximum MPS cannot be lower than Minimum MPS."); return;
        }

        if (button) { button.disabled = true; button.textContent = "Saving..."; }

        try {
            const response = await fetch(
                settingsApiBase + "/whatsapp/admin/settings/scheduler",
                {
                    method: "PUT",
                    headers: {
                        "Authorization": "Bearer " + settingsToken,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ min_mps: minMps, max_mps: maxMps })
                }
            );
            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("vbonotif_admin_token");
                localStorage.removeItem("vbonotif_admin_user");
                window.location.href = "admin-login.html";
                return;
            }
            if (!response.ok || !data.success) {
                throw new Error(data.detail || "Scheduler settings save failed");
            }

            alert(
                "Scheduler settings saved successfully.\n\n" +
                "Minimum MPS: " + Number(data.min_mps) + "\n" +
                "Maximum MPS: " + Number(data.max_mps)
            );
            closeSchedulerSettings();
        } catch (error) {
            alert(error.message);
        } finally {
            if (button) { button.disabled = false; button.textContent = "Save Settings"; }
        }
    }

    function setupSchedulerSettings() {
        setupSchedulerSettingsStyles();
        document.addEventListener("click", function (event) {
            const navItem = event.target.closest(".nav-item");
            if (!navItem) return;
            const text = navItem.textContent.trim().replace(/\s+/g, " ");
            if (!text.includes("Settings")) return;
            event.preventDefault();
            openSchedulerSettings();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupSchedulerSettings);
    } else {
        setupSchedulerSettings();
    }
})();


/* ========================================================
   ADMIN SCHEDULE MANAGEMENT
   ======================================================== */

(function () {
    const adminScheduleApiBase = "https://app.vbo.co.in/api/v1";
    let adminSchedules = [];
    let adminScheduleTab = "upcoming";

    function adminScheduleToken() {
        return localStorage.getItem("vbonotif_admin_token") || "";
    }

    function adminScheduleEscape(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function adminScheduleIsHistory(item) {
        return ["completed", "partial", "failed", "cancelled"].includes(
            String(item.status || "").toLowerCase()
        );
    }

    function adminScheduleFormatDate(value) {
        if (!value) return "—";
        const dt = new Date(String(value).replace(" ", "T"));
        if (Number.isNaN(dt.getTime())) return String(value);
        return dt.toLocaleString([], {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function adminScheduleStatusLabel(status) {
        const value = String(status || "").toLowerCase();
        return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Unknown";
    }

    function createAdminScheduleSection() {
        if (document.getElementById("adminSchedules")) return;

        const rechargeSection = document.getElementById("rechargeRequests");
        if (!rechargeSection || !rechargeSection.parentNode) return;

        const section = document.createElement("section");
        section.className = "panel";
        section.id = "adminSchedules";
        section.style.marginBottom = "24px";
        section.innerHTML = `
            <div class="panel-header">
                <div>
                    <h2>Schedules</h2>
                    <p>All client schedules — upcoming and execution history.</p>
                </div>
                <button type="button" class="refresh-button" id="adminScheduleRefresh">↻ Refresh</button>
            </div>

            <div style="display:flex;gap:8px;margin-bottom:16px;">
                <button type="button" class="refresh-button admin-schedule-tab active" data-tab="upcoming">Upcoming</button>
                <button type="button" class="refresh-button admin-schedule-tab" data-tab="history">History</button>
            </div>

            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Client</th>
                            <th>Date / Slot</th>
                            <th>Message / Template</th>
                            <th>Recipients</th>
                            <th>Status</th>
                            <th>Result</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="adminScheduleTableBody">
                        <tr><td colspan="7" class="empty-state">Loading schedules...</td></tr>
                    </tbody>
                </table>
            </div>
        `;

        rechargeSection.parentNode.insertBefore(section, rechargeSection);

        document.querySelectorAll(".admin-schedule-tab").forEach(function (button) {
            button.addEventListener("click", function () {
                adminScheduleTab = button.dataset.tab || "upcoming";
                document.querySelectorAll(".admin-schedule-tab").forEach(function (item) {
                    item.classList.toggle("active", item === button);
                });
                renderAdminSchedules();
            });
        });

        document.getElementById("adminScheduleRefresh")?.addEventListener("click", loadAdminSchedules);
    }

    function renderAdminSchedules() {
        const tbody = document.getElementById("adminScheduleTableBody");
        if (!tbody) return;

        const visible = adminSchedules.filter(function (item) {
            return adminScheduleTab === "history"
                ? adminScheduleIsHistory(item)
                : !adminScheduleIsHistory(item);
        });

        if (!visible.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No ${adminScheduleTab} schedules found.</td></tr>`;
            return;
        }

        tbody.innerHTML = visible.map(function (item) {
            const history = adminScheduleIsHistory(item);
            const pending = String(item.status || "").toLowerCase() === "pending";
            const message = item.message_type === "template"
                ? `Template #${item.template_id || "—"}`
                : (item.message_text || "—");
            const result = `${Number(item.sent_count || 0)} sent / ${Number(item.failed_count || 0)} failed`;
            const action = history
                ? `<span style="color:#9ca3af;">Read only</span>`
                : pending
                    ? `<button type="button" class="refresh-button" style="margin-right:6px;" data-schedule-action="edit" data-client="${adminScheduleEscape(item.client_name)}" data-id="${item.id}">Edit</button><button type="button" class="refresh-button" data-schedule-action="delete" data-client="${adminScheduleEscape(item.client_name)}" data-id="${item.id}">Delete</button>`
                    : `<span style="color:#9ca3af;">Running</span>`;

            return `
                <tr>
                    <td><strong>${adminScheduleEscape(item.client_name)}</strong></td>
                    <td>${adminScheduleEscape(adminScheduleFormatDate(item.scheduled_at))}</td>
                    <td style="max-width:320px;white-space:normal;">${adminScheduleEscape(message)}</td>
                    <td>${Number(item.total_recipients || 0)}</td>
                    <td>${adminScheduleEscape(adminScheduleStatusLabel(item.status))}</td>
                    <td>${adminScheduleEscape(result)}</td>
                    <td style="white-space:nowrap;">${action}</td>
                </tr>
            `;
        }).join("");
    }

    async function loadAdminSchedules() {
        createAdminScheduleSection();
        const tbody = document.getElementById("adminScheduleTableBody");
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Loading schedules...</td></tr>`;

        const token = adminScheduleToken();
        if (!token) {
            window.location.href = "admin-login.html";
            return;
        }

        try {
            const response = await fetch(
                adminScheduleApiBase + "/whatsapp/admin/schedules",
                { headers: { "Authorization": "Bearer " + token } }
            );
            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("vbonotif_admin_token");
                localStorage.removeItem("vbonotif_admin_user");
                window.location.href = "admin-login.html";
                return;
            }

            if (!response.ok || !data.success) {
                throw new Error(data.detail || "Unable to load schedules.");
            }

            adminSchedules = data.schedules || [];
            renderAdminSchedules();
        } catch (error) {
            console.error("ADMIN SCHEDULE LOAD ERROR:", error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${adminScheduleEscape(error.message || "Unable to load schedules.")}</td></tr>`;
        }
    }

    function adminScheduleOpenEdit(item) {
        let modal = document.getElementById("adminScheduleEditModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "adminScheduleEditModal";
            modal.style.cssText = "display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:15000;align-items:center;justify-content:center;padding:20px;";
            modal.innerHTML = `
                <div style="background:#fff;width:min(620px,100%);border-radius:14px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.25);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
                        <div><h2 style="margin:0;">Edit Schedule</h2><p id="adminScheduleEditSubtitle" style="margin:5px 0 0;color:#6b7280;"></p></div>
                        <button type="button" id="adminScheduleEditClose" style="border:0;background:none;font-size:28px;cursor:pointer;">×</button>
                    </div>
                    <input type="hidden" id="adminScheduleEditClient">
                    <input type="hidden" id="adminScheduleEditId">
                    <label style="display:block;margin-bottom:14px;">Date
                        <input type="date" id="adminScheduleEditDate" style="width:100%;box-sizing:border-box;padding:10px;margin-top:5px;">
                    </label>
                    <label style="display:block;margin-bottom:14px;">2-hour Slot
                        <select id="adminScheduleEditSlot" style="width:100%;box-sizing:border-box;padding:10px;margin-top:5px;"></select>
                    </label>
                    <label style="display:block;margin-bottom:14px;">Message
                        <textarea id="adminScheduleEditMessage" rows="5" style="width:100%;box-sizing:border-box;padding:10px;margin-top:5px;"></textarea>
                    </label>
                    <div id="adminScheduleEditTemplateNote" style="display:none;margin-bottom:14px;padding:10px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;color:#6b7280;">Template schedule: message text is not editable here; only the date/slot will change.</div>
                    <div style="display:flex;justify-content:flex-end;gap:10px;">
                        <button type="button" id="adminScheduleEditCancel" class="refresh-button">Cancel</button>
                        <button type="button" id="adminScheduleEditSave" class="refresh-button">Save Changes</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            document.getElementById("adminScheduleEditClose").onclick = adminScheduleCloseEdit;
            document.getElementById("adminScheduleEditCancel").onclick = adminScheduleCloseEdit;
            document.getElementById("adminScheduleEditSave").onclick = adminScheduleSaveEdit;
        }

        document.getElementById("adminScheduleEditClient").value = item.client_name;
        document.getElementById("adminScheduleEditId").value = item.id;
        document.getElementById("adminScheduleEditSubtitle").textContent = "Client: " + item.client_name;

        const raw = String(item.scheduled_at || "");
        const datePart = raw.slice(0, 10);
        const timePart = raw.slice(11, 16);
        document.getElementById("adminScheduleEditDate").value = datePart;

        const slotSelect = document.getElementById("adminScheduleEditSlot");
        slotSelect.innerHTML = "";
        for (let hour = 0; hour < 24; hour += 2) {
            const start = String(hour).padStart(2, "0") + ":00";
            const end = String((hour + 2) % 24).padStart(2, "0") + ":00";
            const option = document.createElement("option");
            option.value = start;
            option.textContent = start + " – " + end;
            option.selected = start === timePart;
            slotSelect.appendChild(option);
        }

        const isTemplate = item.message_type === "template";
        const messageInput = document.getElementById("adminScheduleEditMessage");
        messageInput.value = item.message_text || "";
        messageInput.disabled = isTemplate;
        document.getElementById("adminScheduleEditTemplateNote").style.display = isTemplate ? "block" : "none";

        modal.style.display = "flex";
    }

    function adminScheduleCloseEdit() {
        const modal = document.getElementById("adminScheduleEditModal");
        if (modal) modal.style.display = "none";
    }

    async function adminScheduleSaveEdit() {
        const client = document.getElementById("adminScheduleEditClient").value;
        const id = document.getElementById("adminScheduleEditId").value;
        const date = document.getElementById("adminScheduleEditDate").value;
        const slot = document.getElementById("adminScheduleEditSlot").value;
        const messageInput = document.getElementById("adminScheduleEditMessage");
        const item = adminSchedules.find(x => String(x.id) === String(id) && String(x.client_name) === String(client));
        const saveButton = document.getElementById("adminScheduleEditSave");

        if (!date || !slot) {
            alert("Please select date and slot.");
            return;
        }

        saveButton.disabled = true;
        try {
            const response = await fetch(
                adminScheduleApiBase + "/whatsapp/admin/schedules/" + encodeURIComponent(client) + "/" + encodeURIComponent(id),
                {
                    method: "PUT",
                    headers: {
                        "Authorization": "Bearer " + adminScheduleToken(),
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        scheduled_at: date + "T" + slot,
                        message: item?.message_type === "template" ? null : messageInput.value.trim()
                    })
                }
            );
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.detail || "Schedule update failed.");
            adminScheduleCloseEdit();
            await loadAdminSchedules();
        } catch (error) {
            alert(error.message || "Schedule update failed.");
        } finally {
            saveButton.disabled = false;
        }
    }

    async function adminScheduleDelete(client, id) {
        if (!confirm("Delete this upcoming schedule?\n\nClient: " + client)) return;

        try {
            const response = await fetch(
                adminScheduleApiBase + "/whatsapp/admin/schedules/" + encodeURIComponent(client) + "/" + encodeURIComponent(id),
                {
                    method: "DELETE",
                    headers: { "Authorization": "Bearer " + adminScheduleToken() }
                }
            );
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.detail || "Schedule deletion failed.");
            await loadAdminSchedules();
        } catch (error) {
            alert(error.message || "Schedule deletion failed.");
        }
    }

    function setupAdminScheduleEvents() {
        createAdminScheduleSection();
        const section = document.getElementById("adminSchedules");
        if (!section || section.dataset.bound === "1") return;
        section.dataset.bound = "1";

        section.addEventListener("click", function (event) {
            const button = event.target.closest("[data-schedule-action]");
            if (!button) return;

            const client = button.dataset.client;
            const id = button.dataset.id;
            const item = adminSchedules.find(x => String(x.id) === String(id) && String(x.client_name) === String(client));
            if (!item) return;

            if (button.dataset.scheduleAction === "edit") adminScheduleOpenEdit(item);
            if (button.dataset.scheduleAction === "delete") adminScheduleDelete(client, id);
        });
    }

    function initAdminScheduleManagement() {
        setupAdminScheduleEvents();
        loadAdminSchedules();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAdminScheduleManagement);
    } else {
        initAdminScheduleManagement();
    }
})();
